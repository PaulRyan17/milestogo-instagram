// Publishes the next "ready" post in posts/queue.json to Instagram, if a slot is due.
//
// Slots are 09:00, 13:00 and 19:00 Irish time. The workflow runs hourly during the day;
// this script decides whether a slot is due and not yet used, so DST and late cron runs
// are handled here rather than in the cron expression.
//
// Env:
//   IG_ACCESS_TOKEN    required (repo secret)
//   GITHUB_REPOSITORY  owner/repo, used to build the public image URL (set by Actions)
//   GITHUB_SHA         commit the image URL is pinned to (set by Actions; falls back to main)
//   GRAPH_VERSION      default v23.0
//   FORCE=true         post now, ignoring slots (manual test runs)
// Flags:
//   --dry              show what would be posted, call nothing
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

const SLOTS = [9, 13, 19]; // Europe/Dublin local hours
const MAX_LATE_HOURS = 1; // don't post a 09:00 slot at 13:00 if the cron missed it
const TZ = "Europe/Dublin";

const root = resolve(import.meta.dirname, "..");
const queuePath = resolve(root, "posts/queue.json");
const queue = JSON.parse(readFileSync(queuePath, "utf8"));

const dry = process.argv.includes("--dry");
const force = process.env.FORCE === "true";
const token = process.env.IG_ACCESS_TOKEN;
const repo = process.env.GITHUB_REPOSITORY || "PaulRyan17/milestogo-instagram";
const ref = process.env.GITHUB_SHA || "main";
const v = process.env.GRAPH_VERSION || "v23.0";
const API = `https://graph.instagram.com/${v}`;

const output = (k, val) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${val}\n`);
};

// --- which slot are we in? -------------------------------------------------
const parts = Object.fromEntries(
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).map((p) => [p.type, p.value])
);
const today = `${parts.year}-${parts.month}-${parts.day}`;
const hour = Number(parts.hour);
const slotHour = [...SLOTS].reverse().find((s) => s <= hour);

let slotKey;
if (force) {
  slotKey = `${today}T${String(hour).padStart(2, "0")}-manual-${Date.now()}`;
} else {
  if (slotHour === undefined) exit(`Before the first slot (${hour}:00 Dublin). Nothing to do.`);
  if (hour - slotHour > MAX_LATE_HOURS) exit(`Slot ${slotHour}:00 was missed and is now too late. Skipping.`);
  slotKey = `${today}T${String(slotHour).padStart(2, "0")}`;
  if (queue.some((p) => p.slot === slotKey)) exit(`Slot ${slotKey} already posted.`);
}

// --- what's next? -----------------------------------------------------------
const post = queue.find((p) => p.status === "ready");
if (!post) {
  console.error("::error::The queue is empty. Add more posts to posts/queue.json.");
  process.exit(1); // fail loudly so GitHub emails you
}
const imageUrl = `https://raw.githubusercontent.com/${repo}/${ref}/${post.image}`;

console.log(`Slot:  ${slotKey}`);
console.log(`Post:  ${post.id} (${post.template})`);
console.log(`Image: ${imageUrl}`);
console.log(`Caption:\n${post.caption}\n`);
if (dry) exit("Dry run. Nothing posted.");
if (!token) fail("IG_ACCESS_TOKEN is not set.");

// --- publish ----------------------------------------------------------------
async function call(method, path, params = {}) {
  const body = new URLSearchParams({ ...params, access_token: token });
  const url = method === "GET" ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, method === "GET" ? {} : { method, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    fail(`${method} ${path} failed (${res.status}): ${e.message || JSON.stringify(json)}${e.code === 190 ? "\nThe access token has expired or been revoked. Generate a new one and update the IG_ACCESS_TOKEN secret." : ""}`);
  }
  return json;
}

const me = await call("GET", "/me", { fields: "user_id,username" });
console.log(`Account: @${me.username} (${me.user_id})`);

const container = await call("POST", `/${me.user_id}/media`, {
  image_url: imageUrl,
  caption: post.caption,
});

// Instagram processes the image asynchronously; wait until it's ready.
for (let i = 0; ; i++) {
  const { status_code } = await call("GET", `/${container.id}`, { fields: "status_code" });
  if (status_code === "FINISHED") break;
  if (status_code === "ERROR" || status_code === "EXPIRED") fail(`Media container ${status_code}.`);
  if (i >= 20) fail("Timed out waiting for Instagram to process the image.");
  await new Promise((r) => setTimeout(r, 3000));
}

const published = await call("POST", `/${me.user_id}/media_publish`, { creation_id: container.id });

post.status = "posted";
post.slot = slotKey;
post.posted_at = new Date().toISOString();
post.media_id = published.id;
writeFileSync(queuePath, JSON.stringify(queue, null, 2) + "\n");

const left = queue.filter((p) => p.status === "ready").length;
console.log(`Published ${post.id} as media ${published.id}. ${left} post(s) left in the queue.`);
if (left <= 6) console.log(`::warning::Only ${left} post(s) left (about ${Math.ceil(left / 3)} day(s)). Top up posts/queue.json.`);
output("posted", post.id);

function exit(msg) {
  console.log(msg);
  process.exit(0);
}
function fail(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}
