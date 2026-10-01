// ─────────────────────────────────────────────────────────────────
// Daily LinkedIn Trend Scout — run by .github/workflows/linkedin-trend-scout.yml
// Writes public/linkedin-briefs/{YYYY-MM-DD,latest,index}.json, which the
// in-app agent reads at /linkedin-briefs/latest.json after Vercel redeploys.
//
// Local run:  ANTHROPIC_API_KEY=sk-ant-... node scripts/linkedin-trend-scout.mjs
// ─────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTrendScout, briefToMarkdown, FALLBACK_BETA } from "../src/trendScoutCore.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(here, "..", "public", "linkedin-briefs");
const INDEX_FILE = path.join(OUT_DIR, "index.json");
const KEEP_DAYS = 60;

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error("ANTHROPIC_API_KEY is not set (add it under GitHub → Settings → Secrets and variables → Actions).");
  process.exit(1);
}

async function transport(body) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": FALLBACK_BETA,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function readIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX_FILE, "utf8")); } catch { return []; }
}

const index = readIndex();
const recentTitles = index.slice(0, 10).flatMap((d) => d.titles || []);

const brief = await runTrendScout({
  transport,
  recentTitles,
  onProgress: (msg) => console.log(msg),
});

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, `${brief.date}.json`), JSON.stringify(brief, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "latest.json"), JSON.stringify(brief, null, 2));

const entry = { date: brief.date, titles: brief.topics.map((t) => t.title) };
const nextIndex = [entry, ...index.filter((d) => d.date !== brief.date)].slice(0, KEEP_DAYS);
fs.writeFileSync(INDEX_FILE, JSON.stringify(nextIndex, null, 2));
// Prune archive files that fell out of the index
const keep = new Set(nextIndex.map((d) => `${d.date}.json`));
for (const f of fs.readdirSync(OUT_DIR)) {
  if (/^\d{4}-\d{2}-\d{2}\.json$/.test(f) && !keep.has(f)) fs.unlinkSync(path.join(OUT_DIR, f));
}

const md = briefToMarkdown(brief);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
console.log(`\n${md}\n`);
console.log(`Done: ${brief.stats.searches} searches, ${brief.stats.inputTokens} input / ${brief.stats.outputTokens} output tokens.`);
