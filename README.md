# milestogo-instagram

Automated Instagram posting for [@milestogoweb](https://www.instagram.com/milestogoweb/).
One offer, pushed three times a day: **your website for €97 a month** → [milestogo.ie](https://milestogo.ie).

## How it works

- `posts/queue.json` is the queue. Each post has an image, a caption and a `status`.
- `.github/workflows/post.yml` runs hourly through the day. At **09:00, 13:00 and 19:00 Irish
  time** it publishes the next post with `"status": "ready"` via the Instagram API (Instagram
  Login), then commits the queue back with `"status": "posted"`.
- Images are served to Instagram from this public repo's raw GitHub URL, so the repo must
  stay public.
- `.github/workflows/refresh-token.yml` refreshes the access token every Monday so it never hits
  its 60-day expiry.

## Secrets

| Secret            | What                                                                             |
| ----------------- | -------------------------------------------------------------------------------- |
| `IG_ACCESS_TOKEN` | Instagram token from the Meta dashboard (needs `instagram_business_content_publish`) |
| `GH_PAT`          | Fine-grained GitHub token, this repo only, **Secrets: Read and write**. Lets the refresh workflow save the new token. |

Never put either in a file or a commit.

## Day-to-day

**Review what's coming.** Open `images/` on GitHub, or `posts/queue.json` for captions.

**Skip a post.** Set its `"status"` to `"skip"`.

**Change a post.** Edit its `headline` / `sub` / `hand` / `caption` in `posts/queue.json`, then
re-render the image:

```bash
npm install
npx playwright install chromium
npm run render -- 004        # one post
npm run render -- --all      # everything
```

In headlines, wrap words in `*asterisks*` to highlight them. Each `\n` is a line break; the
font shrinks automatically to fit.

**Add posts.** Append new entries to `posts/queue.json` (next id, `"status": "ready"`,
`"image": "images/031.jpg"`, `template` either `cream` or `green`), then `npm run render`.
The workflow warns when fewer than 6 posts are left and fails (emailing you) when the queue is
empty.

**Test without posting.** `npm run publish:dry`, or run the workflow manually with *Dry run* ticked.

**Post one right now.** Actions → Post to Instagram → Run workflow → tick *force*.

**Pause everything.** Actions → Post to Instagram → ⋯ → Disable workflow.
