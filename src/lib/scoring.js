// ─────────────────────────────────────────────────────────────────
// src/lib/scoring.js
// The deterministic keyword coverage engine. ONE copy, imported by
// the ATS Scanner and both Resume Tailors.
//
// WHY THIS FILE EXISTS
// The Scanner scored weighted (2x on title, required_skill, tool)
// with a 25 entry acronym table. The Tailors scored
// matched.length / keywords.length with no weighting and no
// acronyms, while the Tailor UI told the user it was "the same
// engine as the ATS Scanner". Same resume and same JD produced two
// different numbers. That is what two copies of a function always
// do by the third edit.
//
// AGENT SEPARATION
// This file holds math only. No candidate context, no prompts, no
// storage keys, no export layout. Domain vocabulary is passed IN by
// each agent through the options argument, so Sunny's PM terms and
// Tanya's ESG terms stay in their own files.
//
// FIXES BEYOND CONSOLIDATION
//   1. Short keywords no longer substring match. "AI" used to match
//      inside detail, training, maintain and available, so it scored
//      as present on almost any resume. Matching is word boundary
//      aware now.
//   2. stemsEqual tightened. The old rule accepted any prefix
//      relationship at 4 characters, so "data" matched "database".
//      The shorter stem must now be 5 or more characters and within
//      2 characters of the longer one.
//   3. Ampersand keywords work. "P&L" normalised to "p l", both
//      tokens fell under the 4 character filter, and the Tailors had
//      no acronym table, so P&L could essentially never match.
//   4. exactOnly terms. Stemming collapses "production" to
//      "product". For a product versus program versus project
//      distinction that is a false positive that matters.
//
// Determinism is preserved. No randomness, no model calls.
// ─────────────────────────────────────────────────────────────────

export const CATEGORIES = [
  "title",
  "required_skill",
  "preferred_skill",
  "responsibility",
  "tool",
  "soft_skill",
  "domain",
  "metric",
];

// Categories a recruiter's boolean search actually weights.
const DOUBLE_WEIGHT = new Set(["title", "required_skill", "tool"]);

// Shared across every domain. Agent specific terms are passed in.
export const BASE_ACRONYMS = {
  gtm: "go to market",
  pandl: "profit and loss",
  kpi: "key performance indicator",
  okr: "objectives and key results",
  roi: "return on investment",
  saas: "software as a service",
  b2b: "business to business",
  b2c: "business to consumer",
  crm: "customer relationship management",
  erp: "enterprise resource planning",
  sla: "service level agreement",
  nps: "net promoter score",
  mrr: "monthly recurring revenue",
  arr: "annual recurring revenue",
  sql: "structured query language",
  api: "application programming interface",
};

// Applied to normalised text before tokenising. Longest forms first.
const CANONICAL_PHRASES = [
  [/\bp and l statement\b/g, "pandl"],
  [/\bprofit and loss\b/g, "pandl"],
  [/\bp and l\b/g, "pandl"],
  [/\bp l\b/g, "pandl"],
  [/\bpnl\b/g, "pandl"],
];

export function normalizeText(s) {
  let out = String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s+#.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [re, replacement] of CANONICAL_PHRASES) out = out.replace(re, replacement);
  return out;
}

export function stemWord(w) {
  let word = w;
  let prev = null;
  while (word !== prev && word.length > 4) {
    prev = word;
    word = word.replace(/(ings?|ations?|ions?|ments?|ed|es|s)$/, "");
  }
  if (word.length > 4) word = word.replace(/e$/, "");
  return word;
}

export function stemsEqual(a, b) {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.startsWith(short) && long.length - short.length <= 2;
}

// Whole word containment. normalizeText leaves a space delimited
// string, so padding and searching a spaced form is exact and avoids
// regex escaping problems with "c++" and "node.js".
function containsPhrase(padded, phrase) {
  return Boolean(phrase) && padded.includes(` ${phrase} `);
}

// exactOnly terms skip stemming but still allow a simple plural, so
// "product" still matches "products" while "production" does not
// collapse into "product".
function containsExact(padded, phrase) {
  if (containsPhrase(padded, phrase)) return true;
  if (containsPhrase(padded, `${phrase}s`)) return true;
  if (phrase.endsWith("s") && containsPhrase(padded, phrase.slice(0, -1))) return true;
  return false;
}

function buildConfig(options = {}) {
  const acronyms = { ...BASE_ACRONYMS, ...(options.acronyms || {}) };
  const expansions = Object.fromEntries(
    Object.entries(acronyms).map(([a, e]) => [e, a])
  );
  const exactOnly = new Set((options.exactOnly || []).map((t) => normalizeText(t)));
  return { acronyms, expansions, exactOnly };
}

function variantsFor(normKw, cfg) {
  const set = new Set([normKw]);
  if (cfg.acronyms[normKw]) set.add(cfg.acronyms[normKw]);
  if (cfg.expansions[normKw]) set.add(cfg.expansions[normKw]);
  return [...set];
}

export function buildResumeStems(normResume) {
  return [
    ...new Set(
      normResume.split(" ").filter((w) => w.length > 3).map(stemWord)
    ),
  ];
}

export function keywordMatches(keyword, normResume, resumeStems, cfg) {
  const config = cfg && cfg.acronyms ? cfg : buildConfig(cfg);
  const normKw = normalizeText(keyword);
  if (!normKw) return false;

  const padded = ` ${normResume} `;

  if (config.exactOnly.has(normKw)) return containsExact(padded, normKw);

  for (const variant of variantsFor(normKw, config)) {
    if (containsPhrase(padded, variant)) return true;
  }

  // Stem fallback, only for tokens long enough for stemming to mean
  // anything. Short acronyms never reach here, which is the point.
  const kwWords = normKw.split(" ").filter((w) => w.length > 3);
  if (kwWords.length === 0) return false;

  return kwWords.every((w) => {
    if (containsPhrase(padded, w)) return true;
    const ks = stemWord(w);
    return resumeStems.some((rs) => stemsEqual(ks, rs));
  });
}

export function weightFor(category, override) {
  if (typeof override === "number") return override;
  return DOUBLE_WEIGHT.has(category) ? 2 : 1;
}

/**
 * The one scoring function.
 *
 * @param keywords array of { keyword, category, weight? }
 * @param resumeText raw resume string
 * @param options { acronyms?, exactOnly? } supplied by the agent
 * @returns {
 *   matched, missing,   arrays of the original objects
 *   weights,            { keyword: weight }
 *   weightedPct,        headline number
 *   pct,                alias of weightedPct, kept for old call sites
 *   unweightedPct,      raw coverage, reference only
 *   byCategory
 * }
 */
export function scoreCoverage(keywords, resumeText, options = {}) {
  const cfg = buildConfig(options);
  const normResume = normalizeText(resumeText);
  const resumeStems = buildResumeStems(normResume);

  const matched = [];
  const missing = [];
  const weights = {};
  const byCategory = {};
  let wMatched = 0;
  let wTotal = 0;

  (keywords || []).forEach((k) => {
    const category = k.category || "domain";
    const w = weightFor(category, k.weight);
    weights[k.keyword] = w;
    wTotal += w;

    if (!byCategory[category]) byCategory[category] = { matched: 0, total: 0 };
    byCategory[category].total += 1;

    if (keywordMatches(k.keyword, normResume, resumeStems, cfg)) {
      matched.push(k);
      wMatched += w;
      byCategory[category].matched += 1;
    } else {
      missing.push(k);
    }
  });

  const total = matched.length + missing.length;
  const weightedPct = wTotal ? Math.round((wMatched / wTotal) * 100) : 0;

  return {
    matched,
    missing,
    weights,
    weightedPct,
    pct: weightedPct,
    unweightedPct: total ? Math.round((matched.length / total) * 100) : 0,
    byCategory,
  };
}

/**
 * Shared parser for the "category :: keyword" lines the extraction
 * prompt returns. Behaviour matches the previous per agent parsers,
 * including bullet stripping, the 2 to 60 character bound, and
 * deduplication on the keyword.
 *
 * @param options { limit, fallbackCategory }
 *   fallbackCategory keeps the Scanner's old behaviour of accepting
 *   a bare line with no category prefix. The Tailors leave it null
 *   so malformed lines are dropped, as before.
 */
export function parseKeywordLines(raw, options = {}) {
  const { limit = 40, fallbackCategory = null } = options;
  const seen = new Set();
  const out = [];

  String(raw || "")
    .split("\n")
    .forEach((line) => {
      const parts = line.split("::");
      const hasCategory = parts.length === 2;
      const category = hasCategory
        ? parts[0].trim().toLowerCase().replace(/\s+/g, "_")
        : fallbackCategory;
      if (!category) return;
      if (!CATEGORIES.includes(category)) return;

      const keyword = (hasCategory ? parts[1] : parts[0])
        .replace(/^[-•*\d.]+\s*/, "")
        .trim();
      if (keyword.length < 2 || keyword.length > 60) return;

      const dedupe = keyword.toLowerCase();
      if (seen.has(dedupe)) return;
      seen.add(dedupe);

      out.push({ keyword, category, weight: weightFor(category) });
    });

  return limit ? out.slice(0, limit) : out;
}
