// Render post images from posts/queue.json using templates/card.html.
// Usage: node scripts/render.mjs          (only posts whose image is missing)
//        node scripts/render.mjs --all    (re-render everything)
//        node scripts/render.mjs 004 007  (specific ids)
// Needs Playwright: npm i -D playwright && npx playwright install chromium
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const queue = JSON.parse(readFileSync(resolve(root, "posts/queue.json"), "utf8"));
const args = process.argv.slice(2);
const all = args.includes("--all");
const ids = args.filter((a) => /^\d+$/.test(a));

const todo = queue.filter((p) =>
  ids.length ? ids.includes(p.id) : all || !existsSync(resolve(root, p.image))
);
if (!todo.length) {
  console.log("Nothing to render.");
  process.exit(0);
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
await page.goto(pathToFileURL(resolve(root, "templates/card.html")).href);

for (const post of todo) {
  await page.evaluate((p) => window.render(p), post);
  await page.evaluate(() => document.fonts.ready);
  const size = await page.evaluate(() => window.fit());
  await page.screenshot({ path: resolve(root, post.image), type: "jpeg", quality: 92 });
  console.log(`${post.id}  ${post.template.padEnd(6)}  headline ${size}px  -> ${post.image}`);
}
await browser.close();
