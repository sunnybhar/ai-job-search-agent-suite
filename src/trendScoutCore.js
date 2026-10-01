// ─────────────────────────────────────────────────────────────────
// LINKEDIN TREND SCOUT — research engine (no React in this file)
// Shared by:
//   - src/LinkedInTrendScout.jsx        (in-app, via /api/claude proxy)
//   - scripts/linkedin-trend-scout.mjs  (daily GitHub Action, direct API)
//
// Pipeline:
//   1. SCAN   — one web-search call shortlists 5 topics with traction
//               signals, scored TRACTION (attention) and FIT (can this
//               creator add a credible take?)
//   2. RANK   — deterministic priority = 0.6·traction + 0.4·fit
//   3. DIVE   — one web-search call per topic: articles, videos, angle,
//               hook, outline (run 3 at a time)
//   4. VERIFY — every article/video URL must appear in the search results
//               the model actually received; anything else is dropped
// ─────────────────────────────────────────────────────────────────

export const SCOUT_MODEL = "claude-opus-5-5";
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const WEB_SEARCH_TOOL = "web_search_20260209";
const MAX_TOKENS = 16000;
const MAX_CONTINUATIONS = 4; // pause_turn resumes per call
const DIVE_CONCURRENCY = 3;

export const PILLARS = ["AI", "Product Management", "Tech & Industry", "Career & Leadership"];

// Edit this to change who the content is for. The in-app agent lets you
// override it per browser; the daily GitHub Action always uses this one.
export const DEFAULT_PROFILE = `Sunny Bhargava — engineer turned product manager, now a first-year MBA candidate at Fordham University, Gabelli School of Business (Class of 2027), New York.

Identity: comes from operations, working hands-on with physical products and with customers on the ground — not from a software-only background. Has led mining projects, built operations and service teams from scratch, and led regional operations planning. Product instincts were formed in the field: at machine sites, with service crews, and with the customers who use the product every day.

Experience (~10 years; use only these facts):
- Gainwell: Project Lead on mining projects — mining fleet maintenance contracts, 24-person team, $0.5M monthly savings.
- Tata Hitachi Construction Machinery: Regional Manager — led regional operations planning and field service; IoT deployment that cut machine breakdowns 20% and cost 8%; led 60+ field personnel in a global B2B industrial business.
- OYO: Operations Manager — built and ran operations across 80 properties.
- Livguard: Product Manager — scaled a subscription platform from 200 to 11,000 users, 12% revenue growth; PRDs, roadmaps, IoT/QR tooling, new product introduction end to end.
- B.Tech Mechanical Engineering, IIT-ISM Dhanbad.
- Builds AI-powered workflow tools himself (Python, React, Anthropic API), including a 9-agent job-search suite and a documentation tool that cut drafting time 90%.

Positioning: the PM who has been on the ground. Brings what software-native PMs usually lack: how physical products fail in the field, what frontline teams actually adopt, and how operations constraints shape product decisions. Pairs that with hands-on AI building and an MBA strategy lens.

Content territory (highest fit first):
1. AI and software meeting the physical world: industrial AI, IoT, predictive maintenance, field service, mining, construction, manufacturing, supply chain, robotics, hardware products.
2. Product management craft learned from operations: customer discovery on the ground, adoption by frontline users, service as part of the product, operational metrics as product metrics.
3. Building operations and service teams, and regional planning — what scales and what breaks.
4. Career: engineer/operator to PM transitions, the MBA path into product.
Mainstream AI or tech news is a fit only when the creator can tie it back to physical products, operations or frontline adoption.

Audience to grow: product managers and aspiring PMs, operators moving into product, people building industrial and physical-world tech, MBA peers, and PM hiring managers in the US.
Goals: grow followers with a consistent, recognizable point of view, and be visible to PM hiring managers — every post doubles as proof of product judgment.`;

// ─────────────────────────────────────────────────────────────────
// PROMPTS
// ─────────────────────────────────────────────────────────────────
const SCAN_SYSTEM = `You are a LinkedIn content strategist and research analyst working for one creator (profile in the user message). Each morning you find what is genuinely gaining traction in AI, product management and tech, and pick the topics where this creator can add a credible point of view that earns followers.

Judging traction: LinkedIn has no public trending feed, so triangulate with web search across proxies — news coverage over the last 7 days, Hacker News and Reddit discussion (r/ProductManagement, r/artificial, r/MachineLearning, r/cscareerquestions), Product Hunt launches, YouTube uploads, newsletters (Lenny's Newsletter, Stratechery, The Pragmatic Engineer, Ben's Bites and similar), industrial and operations trade press (Mining.com, Manufacturing Dive, Supply Chain Dive, IndustryWeek, The Robot Report and similar) when the creator's profile points there, and LinkedIn posts or LinkedIn News items when search surfaces them. A topic needs at least two independent signals. Report what you actually found; never invent numbers, view counts or quotes.

Scores:
- TRACTION 1-10: attention this week and whether it is still rising (10 = all of tech is discussing it and it's climbing; 5 = steady niche interest; 1 = quiet).
- FIT 1-10: how credibly this creator can add an original, experience-backed take rather than relaying news. High fit connects to their real experience or to a PM / MBA lens their audience values.

Selection rules:
- Exactly 5 topics.
- Cover at least 3 of these pillars: AI | Product Management | Tech & Industry | Career & Leadership — at most 2 topics per pillar.
- Prefer developments from the last 7 days. One evergreen PM-craft topic is fine if there is a fresh hook this week.
- Skip anything in the ALREADY COVERED list unless there is a major new development (say so in WHY_NOW).
- Skip partisan politics, gossip about named individuals, and topics this creator can't speak to credibly.

Output exactly this format and nothing else:
<<<PULSE>>>
Two or three sentences on the overall mood of the AI / PM / tech conversation this week.
<<<TOPIC>>>
TITLE: short and specific (not a hashtag)
PILLAR: AI | Product Management | Tech & Industry | Career & Leadership
TRACTION: integer 1-10
FIT: integer 1-10
WHY_NOW: one or two sentences naming the specific event or shift this week
SIGNALS: concrete signal ;; concrete signal ;; concrete signal
LEADS: search query ;; search query ;; search query
(five <<<TOPIC>>> blocks in total)
<<<END>>>`;

const DIVE_SYSTEM = `You research ONE LinkedIn topic for the creator in the user message and turn it into a post plan that earns followers.

Use web search to find:
- 2-4 strong articles: primary sources, reputable outlets, respected newsletters or practitioner blogs — recent where possible.
- 1-3 videos: YouTube talks, video podcasts, demos, conference sessions. Search YouTube specifically.
Only list links that appeared in your search results, copied exactly. If no good video exists, write a single line "- NONE" under VIDEOS.

What earns followers on LinkedIn: a clear point of view (experience-backed or mildly contrarian), a hook in the first two lines (roughly 210 characters show before "see more"), specifics over generalities, one idea per post, and a closing question practitioners want to answer. Never invent experience for the creator — use only what the profile says; where the angle needs a story they don't have, frame it as an observation or a question.

Output exactly this format and nothing else:
<<<PLAN>>>
ANGLE: the creator's specific point of view, one or two sentences
HOOK: the first two lines of the post, ready to paste, under 210 characters
OUTLINE:
- beat
- beat
- beat
FORMAT: Text post | Carousel | Poll | Short video | Article — then a few words on why
CTA: the closing question
HASHTAGS: 3-5 hashtags separated by spaces
BEST_TIME: suggested day and time in US Eastern
RISK: what could make this flop or backfire, one line
<<<ARTICLES>>>
- Title || Source || URL || one-line takeaway the creator can quote or react to
<<<VIDEOS>>>
- Title || Channel || URL || why it's worth watching, with length if known
<<<END>>>`;

const DRAFT_SYSTEM = `You ghostwrite LinkedIn posts for the creator in the user message. Write in first person, in a confident, plain, specific voice — no corporate filler, no "In today's fast-paced world", at most two emojis, no em-dash chains. Short paragraphs of one to three lines with blank lines between them. 150-260 words. Open with the given hook (you may tighten it), deliver one idea, use only experience the profile states, and end with the closing question followed by the hashtags on their own line. Output only the post text.`;

// ─────────────────────────────────────────────────────────────────
// DATES
// ─────────────────────────────────────────────────────────────────
export function todayET(date = new Date()) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date);
}

// ─────────────────────────────────────────────────────────────────
// API LOOP — retries, pause_turn continuation, refusal handling
// `transport(body)` POSTs a Messages API body and resolves to the parsed
// JSON, or throws an Error carrying `.status` on a non-2xx response.
// ─────────────────────────────────────────────────────────────────
const RETRYABLE = [429, 500, 502, 503, 529];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendWithRetry(transport, body) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await transport(body);
    } catch (e) {
      lastError = e;
      if (!RETRYABLE.includes(e.status)) throw e;
      await sleep(2000 * 2 ** attempt);
    }
  }
  throw lastError;
}

async function callModel(transport, { system, prompt, effort = "medium", maxSearches = 0 }) {
  const messages = [{ role: "user", content: prompt }];
  const body = {
    model: SCOUT_MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages,
    fallbacks: "default",
    output_config: { effort },
  };
  if (maxSearches > 0) body.tools = [{ type: WEB_SEARCH_TOOL, name: "web_search", max_uses: maxSearches }];

  const blocks = [];
  const usage = { input: 0, output: 0, searches: 0 };
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const data = await sendWithRetry(transport, body);
    if (data.stop_reason === "refusal") {
      throw new Error(`The model declined this request${data.stop_details?.category ? ` (${data.stop_details.category})` : ""}. Try re-running.`);
    }
    const content = data.content || [];
    blocks.push(...content);
    usage.input += data.usage?.input_tokens || 0;
    usage.output += data.usage?.output_tokens || 0;
    usage.searches += data.usage?.server_tool_use?.web_search_requests || 0;
    if (data.stop_reason !== "pause_turn") break;
    // Server-side search loop paused — send the turn back unchanged and it resumes
    messages.push({ role: "assistant", content });
  }

  const text = blocks.filter((b) => b.type === "text").map((b) => b.text || "").join("");
  return { text, sources: collectSourceUrls(blocks), usage };
}

function addUsage(total, u) {
  total.input += u.input;
  total.output += u.output;
  total.searches += u.searches;
}

// ─────────────────────────────────────────────────────────────────
// LINK VERIFICATION
// ─────────────────────────────────────────────────────────────────
const URL_RE = /https?:\/\/[^\s"'<>\\)\]]+/g;

export function normalizeUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  // One video, many URL shapes
  if (host === "youtu.be") return `youtube:${u.pathname.slice(1).split("/")[0]}`;
  if (host === "youtube.com") {
    if (u.searchParams.get("v")) return `youtube:${u.searchParams.get("v")}`;
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/);
    if (m) return `youtube:${m[2]}`;
  }
  const kept = [...u.searchParams.entries()].filter(([k]) => !/^(utm_|ref$|ref_src$|fbclid$|gclid$)/i.test(k));
  const query = kept.length ? `?${new URLSearchParams(kept).toString()}` : "";
  return `${host}${u.pathname.replace(/\/+$/, "")}${query}`;
}

// Every URL the model actually saw: search results, code-execution output
// from dynamic filtering, and citations on text blocks
export function collectSourceUrls(blocks) {
  const found = new Set();
  for (const b of blocks) {
    if (b.type === "text") {
      for (const c of b.citations || []) {
        const n = c.url && normalizeUrl(c.url);
        if (n) found.add(n);
      }
    } else if (b.type !== "thinking" && b.type !== "redacted_thinking") {
      for (const m of JSON.stringify(b).match(URL_RE) || []) {
        const n = normalizeUrl(m);
        if (n) found.add(n);
      }
    }
  }
  return found;
}

// ─────────────────────────────────────────────────────────────────
// PARSING — delimiter format, no fragile JSON
// ─────────────────────────────────────────────────────────────────
export function parseSections(raw) {
  const re = /<<<([^>]+)>>>/g;
  const markers = [];
  let m;
  while ((m = re.exec(raw)) !== null) markers.push({ name: m[1].trim().toUpperCase(), start: m.index, end: re.lastIndex });
  return markers.map((mk, i) => ({
    name: mk.name,
    body: raw.slice(mk.end, i + 1 < markers.length ? markers[i + 1].start : raw.length).trim(),
  }));
}

export function parseFields(body) {
  const fields = {};
  let listKey = null;
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const kv = t.match(/^([A-Z][A-Z_ ]{1,20}):\s*(.*)$/);
    if (kv) {
      const key = kv[1].trim().replace(/ /g, "_");
      fields[key] = kv[2].trim();
      listKey = kv[2].trim() ? null : key;
      if (listKey) fields[key] = [];
    } else if (listKey && /^[-•*]\s+/.test(t)) {
      fields[listKey].push(t.replace(/^[-•*]\s+/, ""));
    }
  }
  return fields;
}

const splitList = (s) => String(s || "").split(";;").map((x) => x.trim()).filter(Boolean);
const clampScore = (s) => Math.max(1, Math.min(10, parseInt(s, 10) || 5));

function parseLinkLines(body) {
  const links = [];
  for (const line of (body || "").split("\n")) {
    const t = line.trim().replace(/^[-•*]\s+/, "");
    if (!t || /^none$/i.test(t)) continue;
    const parts = t.split("||").map((p) => p.trim());
    if (parts.length < 3) continue;
    links.push({ title: parts[0], source: parts[1], url: parts[2], note: parts.slice(3).join(" ") });
  }
  return links;
}

export function parseScan(raw) {
  const sections = parseSections(raw);
  const pulse = sections.find((s) => s.name === "PULSE")?.body || "";
  const topics = sections
    .filter((s) => s.name === "TOPIC")
    .map((s) => {
      const f = parseFields(s.body);
      const traction = clampScore(f.TRACTION);
      const fit = clampScore(f.FIT);
      return {
        title: f.TITLE || "Untitled topic",
        pillar: PILLARS.find((p) => p.toLowerCase() === String(f.PILLAR || "").toLowerCase()) || f.PILLAR || "Tech & Industry",
        traction,
        fit,
        priority: Math.round((traction * 0.6 + fit * 0.4) * 10) / 10,
        whyNow: f.WHY_NOW || "",
        signals: splitList(f.SIGNALS),
        leads: splitList(f.LEADS),
      };
    })
    .filter((t) => t.title !== "Untitled topic");
  if (!topics.length) throw new Error("Trend scan came back in an unexpected format — re-run.");
  topics.sort((a, b) => b.priority - a.priority);
  return { pulse, topics: topics.slice(0, 5) };
}

export function parseDive(raw) {
  const sections = parseSections(raw);
  const get = (name) => sections.find((s) => s.name === name)?.body || "";
  const f = parseFields(get("PLAN"));
  return {
    angle: f.ANGLE || "",
    hook: f.HOOK || "",
    outline: Array.isArray(f.OUTLINE) ? f.OUTLINE : splitList(f.OUTLINE),
    format: f.FORMAT || "",
    cta: f.CTA || "",
    hashtags: String(f.HASHTAGS || "").split(/\s+/).filter((h) => h.startsWith("#")),
    bestTime: f.BEST_TIME || "",
    risk: f.RISK || "",
    articles: parseLinkLines(get("ARTICLES")),
    videos: parseLinkLines(get("VIDEOS")),
  };
}

// Keep links the model saw in search results. If no source URLs could be
// read at all (unexpected response shape), keep links but flag them.
export function verifyLinks(links, sources) {
  const kept = [];
  let dropped = 0;
  for (const l of links) {
    const n = normalizeUrl(l.url);
    if (!n) { dropped++; continue; }
    if (sources.size === 0) kept.push({ ...l, verified: false });
    else if (sources.has(n)) kept.push({ ...l, verified: true });
    else dropped++;
  }
  return { kept, dropped };
}

// ─────────────────────────────────────────────────────────────────
// PROMPT BUILDERS
// ─────────────────────────────────────────────────────────────────
function scanPrompt({ date, profile, recentTitles, performanceSummary }) {
  return `TODAY: ${date}

CREATOR PROFILE:
${profile}

WHAT HAS WORKED FOR THIS CREATOR SO FAR:
${performanceSummary || "No post performance logged yet."}

ALREADY COVERED (recent briefs):
${recentTitles.length ? recentTitles.map((t) => `- ${t}`).join("\n") : "- none"}

Find this week's five best LinkedIn topics for this creator.`;
}

function divePrompt({ date, profile, topic }) {
  return `TODAY: ${date}

CREATOR PROFILE:
${profile}

TOPIC: ${topic.title}
PILLAR: ${topic.pillar}
WHY NOW: ${topic.whyNow}
TRACTION SIGNALS FOUND IN THE SCAN:
${topic.signals.map((s) => `- ${s}`).join("\n") || "- none recorded"}
SUGGESTED SEARCHES:
${topic.leads.map((s) => `- ${s}`).join("\n") || "- your choice"}

Research this topic and write the post plan.`;
}

// ─────────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────
async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function runTrendScout({
  transport,
  profile = DEFAULT_PROFILE,
  recentTitles = [],
  performanceSummary = "",
  onProgress = () => {},
  date = todayET(),
}) {
  const usage = { input: 0, output: 0, searches: 0 };

  onProgress("Scanning news, HN, Reddit, YouTube and newsletters for traction…");
  const scanRes = await callModel(transport, {
    system: SCAN_SYSTEM,
    prompt: scanPrompt({ date, profile, recentTitles, performanceSummary }),
    effort: "medium",
    maxSearches: 8,
  });
  addUsage(usage, scanRes.usage);
  const scan = parseScan(scanRes.text);

  let done = 0;
  onProgress(`Deep-diving ${scan.topics.length} topics for articles, videos and your angle (0/${scan.topics.length})…`);
  const dives = await mapPool(scan.topics, DIVE_CONCURRENCY, async (topic) => {
    try {
      const res = await callModel(transport, {
        system: DIVE_SYSTEM,
        prompt: divePrompt({ date, profile, topic }),
        effort: "medium",
        maxSearches: 5,
      });
      addUsage(usage, res.usage);
      const sources = new Set([...scanRes.sources, ...res.sources]);
      const dive = parseDive(res.text);
      const articles = verifyLinks(dive.articles, sources);
      const videos = verifyLinks(dive.videos, sources);
      return { ...dive, articles: articles.kept, videos: videos.kept, dropped: articles.dropped + videos.dropped };
    } catch (e) {
      return { error: e.message, articles: [], videos: [], outline: [], hashtags: [], dropped: 0 };
    } finally {
      done++;
      onProgress(`Deep-diving ${scan.topics.length} topics for articles, videos and your angle (${done}/${scan.topics.length})…`);
    }
  });

  const topics = scan.topics.map((t, i) => ({ rank: i + 1, ...t, ...dives[i] }));
  return {
    date,
    generatedAt: new Date().toISOString(),
    model: SCOUT_MODEL,
    pulse: scan.pulse,
    topics,
    stats: {
      searches: usage.searches,
      inputTokens: usage.input,
      outputTokens: usage.output,
      linksVerified: topics.reduce((s, t) => s + t.articles.length + t.videos.length, 0),
      linksDropped: topics.reduce((s, t) => s + (t.dropped || 0), 0),
    },
  };
}

export async function draftPost({ transport, profile = DEFAULT_PROFILE, topic }) {
  const prompt = `CREATOR PROFILE:
${profile}

TOPIC: ${topic.title}
ANGLE: ${topic.angle}
HOOK: ${topic.hook}
OUTLINE:
${(topic.outline || []).map((b) => `- ${b}`).join("\n")}
SOURCES THE CREATOR CAN REFERENCE:
${(topic.articles || []).map((a) => `- ${a.title} (${a.source}): ${a.note}`).join("\n") || "- none"}
CLOSING QUESTION: ${topic.cta}
HASHTAGS: ${(topic.hashtags || []).join(" ")}

Write the post.`;
  const res = await callModel(transport, { system: DRAFT_SYSTEM, prompt, effort: "medium" });
  return res.text.trim();
}

// ─────────────────────────────────────────────────────────────────
// FEEDBACK LOOP — what actually grew followers, fed into the next scan
// ─────────────────────────────────────────────────────────────────
export function summarizePerformance(postLog) {
  if (!postLog || !postLog.length) return "";
  const byPillar = {};
  for (const p of postLog) {
    const k = p.pillar || "Other";
    byPillar[k] = byPillar[k] || { posts: 0, followers: 0, impressions: 0 };
    byPillar[k].posts++;
    byPillar[k].followers += Number(p.followers) || 0;
    byPillar[k].impressions += Number(p.impressions) || 0;
  }
  const lines = Object.entries(byPillar)
    .sort((a, b) => b[1].followers / b[1].posts - a[1].followers / a[1].posts)
    .map(([k, v]) => `- ${k}: ${v.posts} post(s), avg ${Math.round(v.followers / v.posts)} new followers, avg ${Math.round(v.impressions / v.posts)} impressions`);
  const best = [...postLog].sort((a, b) => (Number(b.followers) || 0) - (Number(a.followers) || 0))[0];
  return `${lines.join("\n")}\nBest single post so far: "${best.title}" (${best.followers || 0} new followers). Lean toward what converts, but keep the pillar mix.`;
}

// ─────────────────────────────────────────────────────────────────
// MARKDOWN — for the GitHub Actions run summary and archive
// ─────────────────────────────────────────────────────────────────
export function briefToMarkdown(brief) {
  const out = [`# LinkedIn Trend Scout — ${brief.date}`, "", `> ${brief.pulse}`, ""];
  for (const t of brief.topics) {
    out.push(`## ${t.rank}. ${t.title}`);
    out.push(`**${t.pillar}** · Traction ${t.traction}/10 · Fit ${t.fit}/10`, "");
    if (t.error) { out.push(`_Deep dive failed: ${t.error}_`, ""); continue; }
    out.push(`**Why now:** ${t.whyNow}`, "");
    if (t.signals.length) out.push("**Traction signals:**", ...t.signals.map((s) => `- ${s}`), "");
    out.push(`**Your angle:** ${t.angle}`, "", `**Hook:** ${t.hook}`, "");
    if (t.outline.length) out.push("**Outline:**", ...t.outline.map((b) => `- ${b}`), "");
    out.push(`**Format:** ${t.format}  `, `**Best time:** ${t.bestTime}  `, `**CTA:** ${t.cta}  `, `**Hashtags:** ${t.hashtags.join(" ")}  `, `**Risk:** ${t.risk}`, "");
    if (t.articles.length) out.push("**Articles:**", ...t.articles.map((a) => `- [${a.title}](${a.url}) — ${a.source}. ${a.note}`), "");
    if (t.videos.length) out.push("**Videos:**", ...t.videos.map((v) => `- [${v.title}](${v.url}) — ${v.source}. ${v.note}`), "");
  }
  out.push("---", `_${brief.stats.searches} searches · ${brief.stats.linksVerified} links verified · ${brief.stats.linksDropped} unverifiable links dropped · ${brief.model}_`);
  return out.join("\n");
}
