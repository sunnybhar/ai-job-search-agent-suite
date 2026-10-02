# LinkedIn Trend Scout — setup

Agent #9 (Stage 4 · Build Your Brand). Every weekday morning it researches what's gaining traction in AI, product management and tech, then gives you **5 ranked topics**. Each topic comes with:
- why it's hot now, plus the traction signals it found
- your angle, a ready-to-paste hook and an outline
- the format, best time to post, closing question and hashtags
- articles and videos to read and reference

## How it works
| Piece | File |
|---|---|
| Research engine (shared) | `src/trendScoutCore.js` |
| In-app agent | `src/LinkedInTrendScout.jsx` |
| Daily job | `scripts/linkedin-trend-scout.mjs` + `.github/workflows/linkedin-trend-scout.yml` |
| Published briefs | `public/linkedin-briefs/` (`latest.json`, `index.json`, one file per day, kept 60 days) |

1. **Scan.** A single web-search call shortlists 5 topics. Each gets a **Traction** score (attention this week) and a **Fit** score (whether *you* can add a credible take). There's no public LinkedIn trending feed, so traction is triangulated from news, HN, Reddit, Product Hunt, YouTube and the major PM/AI newsletters.
2. **Rank.** Priority = 0.6 × traction + 0.4 × fit. Code does this math, not the model.
3. **Deep dive.** One web-search call per topic finds the articles and videos and writes the plan.
4. **Verify.** Every link must appear in the search results the model actually got back. Anything else is dropped, so made-up URLs never reach you.

## Turn on the daily brief (one time)
1. GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**: `ANTHROPIC_API_KEY`.
2. Merge this branch into `main`. GitHub only runs scheduled workflows from the default branch.
3. To test: **Actions → LinkedIn Trend Scout (daily) → Run workflow**. The full brief shows in the run summary. It's also committed to `public/linkedin-briefs/`, and Vercel redeploys so it shows up in the app.

It runs Mon–Fri at 7:17am New York time. To change that, edit the `cron` line in the workflow.

## Edit who it writes for
- **Daily job:** `DEFAULT_PROFILE` in `src/trendScoutCore.js`
- **In-app runs:** the "Edit creator profile" button (saved in your browser)

## Feedback loop
About 3 days after you post, click **"I posted this → log results"** and enter impressions and new followers. Every in-app scan then sees which pillars actually grow your following. The daily job doesn't see this log, because the log lives in your browser.

## Cost and limits
- Model: `claude-opus-5-5` with the `web_search_20260209` tool and server-side refusal fallback. Expect roughly **$1–2 per run**: about 20–30 searches plus 6 model calls. Weekdays only, that's about **$25–45 a month**. To cut cost, change `SCOUT_MODEL` in the core file.
- On-demand runs go through `/api/claude` and take about 2–4 minutes in total, split across calls of roughly 30–90s each. If Vercel times out (504), raise the function max duration under Vercel → Settings → Functions, or just use the daily brief.
