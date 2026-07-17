import { useState, useRef, useEffect } from "react";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } from "docx";

// pdfjs worker — served from public/ (same setup as ATS Scanner)
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

// ─────────────────────────────────────────────────────────────────
// v4.0 — Tanya
// All API calls go through /api/claude (serverless proxy).
// Scores are DETERMINISTIC keyword coverage, not AI guesses.
// Pipeline: keywords → before-coverage → analysis+plan → rewrite
//           (implements the plan) → after-coverage → fact-check.
// ─────────────────────────────────────────────────────────────────
const API_URL = "/api/claude";
// ── LOCAL DEV FALLBACK ──
// If REACT_APP_ANTHROPIC_KEY exists in your local .env, the app calls the
// Anthropic API directly so plain `npm start` works (no `vercel dev` needed).
// IMPORTANT: in Vercel, DELETE the REACT_APP_ANTHROPIC_KEY env variable —
// production must use the proxy, or the key gets baked into the public bundle.
const DEV_KEY = process.env.REACT_APP_ANTHROPIC_KEY;
const apiUrl = () => (DEV_KEY ? "https://api.anthropic.com/v1/messages" : API_URL);
const apiHeaders = () =>
  DEV_KEY
    ? { "Content-Type": "application/json", "x-api-key": DEV_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }
    : { "Content-Type": "application/json" };

const STORAGE_KEYS = {
  baseResume: "tailor_tanya_base_resume",
  history: "tailor_tanya_history",
  slots: "resume_slots_tanya",
};

// Used for the DOCX export header — edit freely
const PROFILE = {
  name: "TANYA SINHA",
  headline: null,
  contact: "New York, NY | (203) 850-3317 | tanyasinha1906@gmail.com | linkedin.com/in/tanyasinha1916",
  font: "Calibri",
  underlineSections: true, // Tanya's template: ruled section headers
};

const CANDIDATE_CONTEXT = `Experienced sustainability and ESG consultant with top-tier credentials — Yale School of the Environment (MEM, Research Assistant at Yale Initiative for Sustainable Finance) and IIT-ISM Dhanbad B.Tech Environmental Engineering. Currently Management Consultant at ERM (~9 years total experience): end-to-end ESG reporting and disclosure programs for Fortune 500 clients, Scope 1-3 GHG inventories, CDP/CSRD/ISSB/SB 253 disclosure readiness, seconded operational leadership inside client organizations. Prior: Goldman Sachs (Summer Associate — ESG in investment decision-making, Watershed deployment across 40 portfolio companies), Hannon Armstrong (SBTi targets), Rio Tinto (2030 GHG targets with executive team), CII ($2M national GHG inventory program), Capgemini (Operations & EHS consulting). FSA Level II.
TARGET ROLE ARCHETYPES — infer which one this JD is from its title and responsibilities, and let that drive emphasis:
- Sustainability/ESG leadership → lead with program ownership, frameworks (GHG Protocol, TCFD, CSRD, ISSB), disclosure delivery
- Climate strategy → lead with GHG target-setting, decarbonization roadmaps, executive advisory
- Management consulting → lead with client delivery, cross-functional workstreams, business development ($1M in new fees)
- Corporate sustainability (in-house) → lead with the seconded operational-lead experience and internal stakeholder coordination
Emphasize top-tier credentials and Fortune 500 delivery. Be honest and direct.`;

// ─────────────────────────────────────────────────────────────────
// PROMPTS
// ─────────────────────────────────────────────────────────────────
const PROMPT_KEYWORDS = `You are a JD keyword extraction tool for ATS matching.

Extract the most important keywords from the job description.

Return plain text ONLY, one keyword per line, in this exact format:
category :: keyword

Use ONLY these categories: title, required_skill, preferred_skill, responsibility, tool, soft_skill, domain, metric

Rules:
- Max 40 lines total
- Keywords are short phrases (1-4 words) that would literally appear in a resume
- No duplicates, no bullets, no numbering, no commentary`;

const PROMPT_ANALYSIS = `You are a senior hiring manager and resume strategist.

CANDIDATE CONTEXT:
${CANDIDATE_CONTEXT}

You are given a JD, a resume, and a DETERMINISTIC keyword coverage report (computed by exact text matching — treat it as ground truth for what is present/missing).

Produce a rewrite plan:
- For each MISSING keyword: if the candidate has adjacent, truthful experience, plan how to add it. If there is no basis, list it as a remaining gap — NEVER plan to invent.
- For each MATCHED keyword that is weak or buried: plan how to strengthen or elevate it.
- Identify grammar/structural errors to fix.
- Plan reordering so the most JD-relevant experience leads.

OUTPUT: Respond with ONLY valid JSON. No preamble, no markdown fences.
Every string value must be a single line and SHORT (under 25 words).

{
  "company": "company name from JD or Unknown",
  "role_title": "exact title from JD",
  "role_archetype": "product | program | operations | consulting",
  "top_responsibilities": ["the 3 most important responsibilities from the JD, short phrases"],
  "rewrite_plan": [
    { "change": "one short sentence", "reason": "one short sentence" }
  ],
  "keyword_actions": [
    { "keyword": "SQL", "action": "add", "how": "one short sentence, truthful basis" }
  ],
  "error_report": [
    { "type": "Grammar", "original": "short excerpt", "issue": "what is wrong", "fix": "corrected version" }
  ],
  "remaining_gaps": [
    { "keyword": "keyword", "reason": "no truthful basis", "recommendation": "one short sentence" }
  ],
  "strategic_advice": "2-3 sentences, direct and honest"
}`;

const PROMPT_REWRITE = `You are an ATS optimization expert and resume rewriter.

CANDIDATE CONTEXT:
${CANDIDATE_CONTEXT}

You are given a JD, the original resume, and an approved REWRITE PLAN. Implement EVERY item in the plan. Do not silently skip planned changes.

RULES:
- Output the rewritten resume as PLAIN TEXT ONLY — no JSON, no markdown, no commentary
- Do NOT include the candidate's name or contact line (added automatically on export)
- PRESERVE the original resume's section order (if EDUCATION is first, keep it first)
- ALL CAPS section headers only: EDUCATION, SKILLS, EXPERIENCE, AWARDS & CERTIFICATIONS (use the sections that exist in the original)
- Company lines format: COMPANY | Title | Location | Dates
- Every bullet starts with "• " and a strong past-tense action verb
- Blank line between sections
- Quantify only where the original resume supports it — NEVER fabricate or inflate numbers, skills, tools, or scope
- Fix all grammar and spelling errors
- No summary section, no icons, no tables, no columns
- ONE-PAGE BUDGET: maximum 700 words total. Max 5 bullets for the most JD-relevant role, 2-3 for older roles. Cut the weakest bullets, never the strongest evidence
- The FIRST 3 bullets of the top EXPERIENCE entry must directly answer the JD's 3 most important responsibilities
- BANNED AI-CLICHE WORDS (human screeners flag these instantly): spearheaded, orchestrated, leveraged, utilized, honed, delved, fostered, championed, synergy, dynamic, results-driven, seamlessly, meticulously, passionate
- Vary bullet rhythm: do not end every bullet with a percentage; vary verb choice and sentence structure

Output the resume text and nothing else.`;

const PROMPT_VERIFY = `You are a resume fact-checker. Compare the REWRITTEN resume against the ORIGINAL resume.

List every quantified claim (numbers, percentages, dollar amounts, team sizes, user counts, timeframes) and every named tool, skill, or certification that appears in the REWRITTEN resume. For each, check whether the ORIGINAL resume supports it (same number, or a direct truthful restatement).

Return plain text ONLY, one line per claim, in this exact format:
claim text || GROUNDED or UNSUPPORTED || short basis, or "not found in original"

Rules: max 40 lines, most important claims first, no other text, no headers.`;

// ─────────────────────────────────────────────────────────────────
// API HELPER — via serverless proxy
// ─────────────────────────────────────────────────────────────────
async function apiCall({ model, system, userMessage, maxTokens }) {
  const response = await fetch(apiUrl(), {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "API error");
  return (data.content || []).map((b) => b.text || "").join("");
}

function safeParseJSON(raw) {
  if (!raw) throw new Error("Empty response");
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in response");
  text = text.slice(start, end + 1);
  try { return JSON.parse(text); } catch {}
  // eslint-disable-next-line no-control-regex
  const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  try { return JSON.parse(cleaned); } catch {}
  const sanitized = cleaned.replace(/"((?:[^"\\]|\\.)*)"/gs, (m) =>
    m.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
  );
  return JSON.parse(sanitized);
}

// ─────────────────────────────────────────────────────────────────
// DETERMINISTIC KEYWORD MATCHING
// Fixed stemmer: loops until stable so "operations" and "operation"
// reduce to the SAME stem (the old single-pass version did not).
// ─────────────────────────────────────────────────────────────────
function normalizeText(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s+#.]/g, " ").replace(/\s+/g, " ");
}

function stemWord(w) {
  let word = w;
  let prev = null;
  while (word !== prev && word.length > 4) {
    prev = word;
    word = word.replace(/(ings?|ations?|ions?|ments?|ed|es|s)$/, "");
  }
  if (word.length > 4) word = word.replace(/e$/, "");
  return word;
}

function stemsEqual(a, b) {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4) return a.startsWith(b) || b.startsWith(a);
  return false;
}

function keywordMatches(keyword, normResume, resumeStems) {
  const normKw = normalizeText(keyword).trim();
  if (!normKw) return false;
  if (normResume.includes(normKw)) return true;
  const kwWords = normKw.split(" ").filter((w) => w.length > 3);
  if (kwWords.length === 0) return false;
  return kwWords.every((w) => {
    const ks = stemWord(w);
    return resumeStems.some((rs) => stemsEqual(ks, rs)) || normResume.includes(w);
  });
}

function scoreCoverage(keywords, resumeText) {
  const normResume = normalizeText(resumeText);
  const resumeStems = [...new Set(normResume.split(" ").filter((w) => w.length > 3).map(stemWord))];
  const matched = [];
  const missing = [];
  keywords.forEach((k) => {
    if (keywordMatches(k.keyword, normResume, resumeStems)) matched.push(k);
    else missing.push(k);
  });
  const pct = keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0;
  return { matched, missing, pct };
}

function parseKeywordLines(raw) {
  const CATEGORIES = ["title", "required_skill", "preferred_skill", "responsibility", "tool", "soft_skill", "domain", "metric"];
  const seen = new Set();
  const out = [];
  raw.split("\n").forEach((line) => {
    const parts = line.split("::");
    if (parts.length !== 2) return;
    const category = parts[0].trim().toLowerCase();
    const keyword = parts[1].replace(/^[-•*\d.]+\s*/, "").trim();
    if (!CATEGORIES.includes(category)) return;
    if (keyword.length < 2 || keyword.length > 60) return;
    const dedup = keyword.toLowerCase();
    if (seen.has(dedup)) return;
    seen.add(dedup);
    out.push({ keyword, category });
  });
  return out.slice(0, 40);
}

function parseVerifyLines(raw) {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.includes("||"))
    .map((l) => {
      const [claim, status, basis] = l.split("||").map((p) => (p || "").trim());
      return {
        claim,
        grounded: /grounded/i.test(status || ""),
        basis: basis || "",
      };
    })
    .filter((c) => c.claim);
}

// ─────────────────────────────────────────────────────────────────
// QUALITY CHECKS — deterministic scans of the rewritten resume
// ─────────────────────────────────────────────────────────────────
const AI_CLICHES = ["spearheaded", "orchestrated", "leveraged", "utilized", "honed", "delved", "fostered", "championed", "synergy", "dynamic", "results-driven", "seamlessly", "meticulously", "passionate"];

function qualityChecks(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const bullets = text.split("\n").filter((l) => l.trim().startsWith("\u2022"));
  const lower = text.toLowerCase();
  const cliches = AI_CLICHES.filter((c) => lower.includes(c));
  const endNum = bullets.filter((b) => /[\d%)]\s*$/.test(b.trim())).length;
  return {
    words,
    bulletCount: bullets.length,
    onePage: words <= 700,
    cliches,
    rhythmFlag: bullets.length >= 6 && endNum / bullets.length > 0.8,
  };
}

// First 3 bullets of the top EXPERIENCE entry — what a recruiter reads
// in the six-second skim
function topThirdBullets(text) {
  const lines = text.split("\n").map((l) => l.trim());
  const expIdx = lines.findIndex((l) => /^EXPERIENCE/.test(l));
  const bullets = [];
  for (let i = expIdx === -1 ? 0 : expIdx; i < lines.length && bullets.length < 3; i++) {
    if (lines[i].startsWith("\u2022")) bullets.push(lines[i].replace(/^\u2022\s*/, ""));
  }
  return bullets;
}

// ─────────────────────────────────────────────────────────────────
// FILE EXTRACTION (same approach as ATS Scanner)
// ─────────────────────────────────────────────────────────────────
async function extractDOCX(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => it.str.trim())
      .map((it) => ({ str: it.str, x: it.transform[4], y: Math.round(it.transform[5]) }));
    const lines = {};
    items.forEach((it) => {
      const yKey = Object.keys(lines).find((y) => Math.abs(Number(y) - it.y) < 3);
      const key = yKey !== undefined ? yKey : it.y;
      if (!lines[key]) lines[key] = [];
      lines[key].push(it);
    });
    // Built into a local string first (not a closure reassigning the outer
    // `fullText`) so ESLint's no-loop-func rule is satisfied.
    let pageText = "";
    Object.keys(lines)
      .sort((a, b) => Number(b) - Number(a))
      .forEach((y) => {
        pageText += lines[y].sort((a, b) => a.x - b.x).map((it) => it.str).join(" ") + "\n";
      });
    fullText += pageText + "\n";
  }
  return fullText.trim();
}

// ─────────────────────────────────────────────────────────────────
// DOCX EXPORT — mirrors Tanya's real resume layout
// (Calibri, centered bold name, ruled CAPS section headers, 9pt bullets)
// ─────────────────────────────────────────────────────────────────
function buildResumeDocx(resumeText, profile) {
  const children = [];
  const F = profile.font;

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: profile.name, bold: true, size: 32, font: F })],
      spacing: { after: 40 },
    })
  );
  if (profile.headline) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: profile.headline, size: 19, font: F })],
        spacing: { after: 20 },
      })
    );
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: profile.contact, size: 18, font: F })],
      spacing: { after: 120 },
    })
  );

  const sectionBorder = profile.underlineSections
    ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 2 } }
    : undefined;

  resumeText.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    const isHeader = /^[A-Z][A-Z &,'/-]+$/.test(line) && line.length < 45;
    const isBullet = line.startsWith("•") || line.startsWith("- ");
    const isEntry = !isBullet && line.includes("|");

    if (isHeader) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, bold: true, size: 20, font: F })],
          border: sectionBorder,
          spacing: { before: 140, after: 60 },
        })
      );
    } else if (isEntry) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, bold: true, size: 19, font: F })],
          spacing: { before: 60, after: 30 },
        })
      );
    } else if (isBullet) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line.replace(/^[-•]\s*/, ""), size: 18, font: F })],
          bullet: { level: 0 },
          spacing: { after: 20 },
        })
      );
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 18, font: F })],
          spacing: { after: 20 },
        })
      );
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 360, bottom: 360, left: 540, right: 540 } },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}

async function downloadDocx(resumeText, profile, filenameBase) {
  const blob = await buildResumeDocx(resumeText, profile);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────
// HISTORY — localStorage, last 20 runs
// ─────────────────────────────────────────────────────────────────

// ── RESUME SLOTS — 3 named go-to resumes, shared with the Cover Letter ──
function loadSlots() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.slots)) || [null, null, null];
    while (s.length < 3) s.push(null);
    return s.slice(0, 3);
  } catch { return [null, null, null]; }
}
function persistSlots(slots) {
  try { localStorage.setItem(STORAGE_KEYS.slots, JSON.stringify(slots)); } catch {}
}

const CONTACTS_KEY = "jobsuite_contacts"; // written by the Coffee Chat agent
function loadContacts() {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY)) || []; } catch { return []; }
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.history)) || []; } catch { return []; }
}
function saveHistoryEntry(entry) {
  const history = [entry, ...loadHistory()].slice(0, 20);
  try { localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history)); } catch {}
  return history;
}
function setHistoryStatus(id, status) {
  const history = loadHistory().map((h) => (h.id === id ? { ...h, status } : h));
  try { localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history)); } catch {}
  return history;
}
function deleteHistoryEntry(id) {
  const history = loadHistory().filter((h) => h.id !== id);
  try { localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history)); } catch {}
  return history;
}

// ─────────────────────────────────────────────────────────────────
// PIPELINE
// ─────────────────────────────────────────────────────────────────
async function runTailor(jd, resume, onProgress) {
  // 1 — JD keywords (Sonnet, plain text — no JSON risk)
  onProgress("Step 1 of 5 — Extracting JD keywords...");
  const kwRaw = await apiCall({
    model: "claude-sonnet-4-6",
    system: PROMPT_KEYWORDS,
    userMessage: `JOB DESCRIPTION:\n${jd}`,
    maxTokens: 1500,
  });
  const keywords = parseKeywordLines(kwRaw);
  if (keywords.length === 0) throw new Error("Keyword extraction returned nothing usable. Re-run.");

  // 2 — deterministic BEFORE coverage
  const before = scoreCoverage(keywords, resume);

  // 3 — analysis + rewrite plan (Opus), grounded in the real coverage report
  onProgress("Step 2 of 5 — Building the rewrite plan...");
  const coverageReport = `DETERMINISTIC COVERAGE (ground truth):
MATCHED (${before.matched.length}): ${before.matched.map((k) => k.keyword).join("; ")}
MISSING (${before.missing.length}): ${before.missing.map((k) => k.keyword).join("; ")}`;
  const analysisRaw = await apiCall({
    model: "claude-opus-4-8",
    system: PROMPT_ANALYSIS,
    userMessage: `JOB DESCRIPTION:\n${jd}\n\n${"─".repeat(40)}\n\nRESUME:\n${resume}\n\n${"─".repeat(40)}\n\n${coverageReport}`,
    maxTokens: 4000,
  });
  const analysis = safeParseJSON(analysisRaw);

  // 4 — rewrite that IMPLEMENTS the plan (Opus)
  onProgress("Step 3 of 5 — Rewriting resume to the plan...");
  const planText = JSON.stringify(
    { rewrite_plan: analysis.rewrite_plan || [], keyword_actions: analysis.keyword_actions || [] },
    null,
    2
  );
  const rewritten = (
    await apiCall({
      model: "claude-opus-4-8",
      system: PROMPT_REWRITE,
      userMessage: `JOB DESCRIPTION:\n${jd}\n\n${"─".repeat(40)}\n\nORIGINAL RESUME:\n${resume}\n\n${"─".repeat(40)}\n\nAPPROVED REWRITE PLAN:\n${planText}`,
      maxTokens: 8000,
    })
  ).trim();

  // 5 — deterministic AFTER coverage (same keywords, same math)
  onProgress("Step 4 of 5 — Re-scoring the rewrite (deterministic)...");
  const after = scoreCoverage(keywords, rewritten);

  // 6 — anti-fabrication fact-check (Sonnet, plain text — graceful on failure)
  onProgress("Step 5 of 5 — Fact-checking every claim against your original...");
  let verification = [];
  try {
    const verifyRaw = await apiCall({
      model: "claude-sonnet-4-6",
      system: PROMPT_VERIFY,
      userMessage: `ORIGINAL RESUME:\n${resume}\n\n${"─".repeat(40)}\n\nREWRITTEN RESUME:\n${rewritten}`,
      maxTokens: 3000,
    });
    verification = parseVerifyLines(verifyRaw);
  } catch {
    verification = [];
  }

  return { keywords, before, after, analysis, rewritten, verification, quality: qualityChecks(rewritten) };
}

// ─────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────
function ScoreBadge({ score, label, sub }) {
  const color = score >= 75 ? "#00d4aa" : score >= 50 ? "#f5a623" : "#ff4d6d";
  return (
    <div style={{ textAlign: "center", minWidth: 120 }}>
      <div
        style={{
          width: 84, height: 84, borderRadius: "50%",
          border: `3px solid ${color}`, background: `${color}12`,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 10px", boxShadow: `0 0 28px ${color}30`,
        }}
      >
        <span style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "'DM Mono', monospace" }}>{score}%</span>
      </div>
      <div style={{ fontSize: 11, color: "#888baa", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#555878", maxWidth: 160, margin: "0 auto", lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

function Pill({ word, variant = "default" }) {
  const variants = {
    default: { bg: "#dde0f0", color: "#888baa", border: "#ccd0e8" },
    green: { bg: "#00d4aa12", color: "#00d4aa", border: "#00d4aa40" },
    blue: { bg: "#0099ff12", color: "#0099ff", border: "#0099ff40" },
    red: { bg: "#ff4d6d12", color: "#ff4d6d", border: "#ff4d6d40" },
    yellow: { bg: "#f5a62312", color: "#f5a623", border: "#f5a62340" },
    purple: { bg: "#a855f712", color: "#a855f7", border: "#a855f740" },
  };
  const v = variants[variant] || variants.default;
  return (
    <span
      style={{
        padding: "3px 10px", borderRadius: 20, fontSize: 11,
        background: v.bg, color: v.color, border: `1px solid ${v.border}`,
        fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", display: "inline-block", margin: 2,
      }}
    >
      {word}
    </span>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #dde0f0", borderRadius: 14, padding: "20px 22px", ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ text, count }) {
  return (
    <div style={{ fontSize: 11, color: "#555878", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
      {text}
      {count !== undefined && (
        <span style={{ background: "#dde0f0", color: "#888baa", padding: "1px 8px", borderRadius: 10, fontSize: 10 }}>{count}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function ResumeTailorAgentTanya() {
  const [jd, setJd] = useState("");
  const [resume, setResume] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [hasSavedResume, setHasSavedResume] = useState(false);
  const resultRef = useRef(null);
  const fileInputRef = useRef(null);

  // Resume slots — 3 saved go-to resumes
  const [slots, setSlots] = useState([null, null, null]);
  const [activeSlot, setActiveSlot] = useState(null);

  function handleSlotLoad(i) {
    if (!slots[i]) return;
    setResume(slots[i].text);
    setActiveSlot(i);
    // Mirror into the base-resume key so the Cover Letter auto-load and the
    // Behavioral Coach claim list follow whichever resume you're working from
    try { localStorage.setItem(STORAGE_KEYS.baseResume, slots[i].text); } catch {}
    setNotice(`Loaded "${slots[i].name}" into the resume box.`);
  }

  function handleSlotSave(i) {
    if (!resume.trim()) { setError("Nothing to save — the resume box is empty."); return; }
    const name = window.prompt("Name this resume (e.g. PM Resume, Ops Resume, Consulting Resume):", slots[i]?.name || `Resume ${i + 1}`);
    if (!name) return;
    const next = [...slots];
    next[i] = { id: Date.now(), name: name.trim().slice(0, 30), text: resume, updated: new Date().toISOString().slice(0, 10) };
    setSlots(next);
    persistSlots(next);
    setActiveSlot(i);
    try { localStorage.setItem(STORAGE_KEYS.baseResume, resume); } catch {}
    setHasSavedResume(true);
    setNotice(`Saved as "${next[i].name}" — one click to load it for every future role.`);
  }

  function handleSlotClear(i) {
    const next = [...slots];
    next[i] = null;
    setSlots(next);
    persistSlots(next);
    if (activeSlot === i) setActiveSlot(null);
  }


  useEffect(() => {
    setHistory(loadHistory());
    let s = loadSlots();
    const saved = localStorage.getItem(STORAGE_KEYS.baseResume);
    // Migrate: seed slot 1 from the previously saved base resume
    if (saved && !s[0] && !s[1] && !s[2]) {
      s = [{ id: Date.now(), name: "Base resume", text: saved, updated: new Date().toISOString().slice(0, 10) }, null, null];
      persistSlots(s);
    }
    setSlots(s);
    if (saved) {
      setResume(saved);
      setHasSavedResume(true);
    } else if (s[0]) {
      setResume(s[0].text);
      setActiveSlot(0);
    }
  }, []);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const ext = file.name.toLowerCase().split(".").pop();
      let text = "";
      if (ext === "docx") text = await extractDOCX(file);
      else if (ext === "pdf") text = await extractPDF(file);
      else throw new Error("Upload a PDF or DOCX file.");
      if (!text.trim() || text.length < 30) throw new Error("Could not extract text from this file.");
      setResume(text.trim());
      setNotice(`Extracted ${text.split(/\s+/).filter(Boolean).length} words from ${file.name}. Review below, then save it as your base resume.`);
    } catch (err) {
      setError(`File extraction failed: ${err.message}`);
    }
    e.target.value = "";
  }

  async function handleRun() {
    if (!jd.trim() || !resume.trim()) {
      setError("Both fields are required. Paste the full JD and your full resume.");
      return;
    }
    setError("");
    setNotice("");
    setLoading(true);
    setResult(null);
    try {
      const data = await runTailor(jd, resume, (msg) => setProgressMsg(msg));
      setResult(data);
      const entry = {
        id: Date.now(),
        date: new Date().toISOString().slice(0, 10),
        company: data.analysis.company || "Unknown",
        role: data.analysis.role_title || "",
        beforePct: data.before.pct,
        afterPct: data.after.pct,
        status: "applied",
        jd: jd,
        result: data,
      };
      setHistory(saveHistoryEntry(entry));
      setProgressMsg("");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setError(`Error: ${e.message}`);
      setProgressMsg("");
    }
    setLoading(false);
  }

  function restoreEntry(entry) {
    setJd(entry.jd || "");
    setResult(entry.result);
    setShowHistory(false);
    setActiveTab("overview");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
  }

  function copyResume() {
    navigator.clipboard.writeText(result.rewritten);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleDocx() {
    const company = (result.analysis.company || "resume").replace(/[^a-z0-9]/gi, "_");
    await downloadDocx(result.rewritten, PROFILE, `Tanya_Sinha_Resume_${company}`);
  }

  const improvement = result ? result.after.pct - result.before.pct : 0;

  // Referral check — contacts logged in the Coffee Chat agent at this company
  const referralContacts = result
    ? loadContacts().filter((c) => {
        const co = (result.analysis.company || "").toLowerCase();
        const cc = (c.company || "").toLowerCase();
        return co.length > 2 && cc.length > 2 && (co.includes(cc) || cc.includes(co));
      })
    : [];
  const unsupported = result ? result.verification.filter((v) => !v.grounded) : [];

  const catCounts = {};
  if (result) {
    result.keywords.forEach((k) => {
      if (!catCounts[k.category]) catCounts[k.category] = { total: 0, matched: 0 };
      catCounts[k.category].total++;
    });
    result.after.matched.forEach((k) => {
      if (catCounts[k.category]) catCounts[k.category].matched++;
    });
  }

  const TABS = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "keywords", label: "Keywords", icon: "🔑" },
    { id: "plan", label: "Rewrite Plan", icon: "🔀" },
    { id: "resume", label: "Rewritten Resume", icon: "📄" },
    { id: "verify", label: `Fact Check${unsupported.length ? ` (${unsupported.length}!)` : ""}`, icon: "🛡️" },
    { id: "gaps", label: "Gaps & Errors", icon: "⚠️" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8ff", fontFamily: "'Sora', sans-serif", color: "#1a1c30", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea { resize: vertical; font-family: inherit; }
        textarea:focus { outline: none !important; border-color: #00d4aa !important; box-shadow: 0 0 0 3px #00d4aa15 !important; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #f7f8ff; }
        ::-webkit-scrollbar-thumb { background: #ccd0e8; border-radius: 3px; }
        .tab-btn { transition: all 0.15s; cursor: pointer; border: none; background: transparent; font-family: inherit; }
        .tab-btn:hover { color: #2a2c42 !important; }
        .run-btn { transition: all 0.2s; cursor: pointer; border: none; font-family: inherit; }
        .run-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.08); box-shadow: 0 8px 30px #00d4aa30 !important; }
        .run-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .copy-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; }
        .copy-btn:hover { border-color: #00d4aa !important; color: #00d4aa !important; }
        pre { white-space: pre-wrap; word-break: break-word; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ borderBottom: "1px solid #dde0f0", padding: "26px 40px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, flexShrink: 0, background: "linear-gradient(135deg, #00d4aa, #0066ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>⚡</div>
          <div>
            <div style={{ fontSize: 10, color: "#00d4aa", letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>
              Agent 01T · Job Search Suite
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "#111328", lineHeight: 1 }}>
              JD to Resume — Tanya{" "}
              <span style={{ fontSize: 12, fontWeight: 400, color: "#555878", letterSpacing: 0 }}>v4.0</span>
            </h1>
          </div>
          <div style={{ marginLeft: "auto", position: "relative" }}>
            <button
              className="copy-btn"
              onClick={() => setShowHistory((s) => !s)}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ccd0e8", background: "transparent", color: "#555878", fontSize: 12, fontWeight: 600 }}
            >
              🕘 History ({history.length})
            </button>
            {showHistory && (
              <div style={{ position: "absolute", right: 0, top: 42, width: 340, maxHeight: 380, overflowY: "auto", background: "#fff", border: "1px solid #dde0f0", borderRadius: 12, boxShadow: "0 10px 40px #00000018", zIndex: 50, padding: 8 }}>
                {history.length === 0 && (
                  <div style={{ padding: 16, fontSize: 12, color: "#888baa", textAlign: "center" }}>No saved runs yet.</div>
                )}
                {history.map((h) => (
                  <div key={h.id} style={{ padding: "10px 12px", borderBottom: "1px solid #f0f1fa", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, cursor: "pointer" }} onClick={() => restoreEntry(h)}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111328" }}>{h.company}</div>
                      <div style={{ fontSize: 11, color: "#555878" }}>{h.role}</div>
                      <div style={{ fontSize: 10, color: "#888baa", fontFamily: "'DM Mono', monospace" }}>
                        {h.date} · {h.beforePct}% → {h.afterPct}%
                      </div>
                    </div>
                    <select
                      value={h.status || "applied"}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setHistory(setHistoryStatus(h.id, e.target.value))}
                      style={{ fontSize: 10, padding: "3px 4px", borderRadius: 6, border: "1px solid #dde0f0", background: "#f7f8ff", color: "#555878", fontFamily: "inherit", cursor: "pointer" }}
                      title="Outcome — keep this updated so the home page can show what converts"
                    >
                      {["applied", "no reply", "response", "interview", "offer", "rejected"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setHistory(deleteHistoryEntry(h.id))}
                      style={{ border: "none", background: "transparent", color: "#ff4d6d", cursor: "pointer", fontSize: 14 }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "30px 40px 0" }}>
        {/* ── INPUTS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#555878", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
              Job Description
            </label>
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description here — title, responsibilities, required and preferred skills, tools..."
              rows={15}
              style={{ width: "100%", background: "#f0f1fa", border: "1px solid #dde0f0", borderRadius: 12, padding: "13px 15px", color: "#111328", fontSize: 12.5, lineHeight: 1.7, transition: "border-color 0.2s, box-shadow 0.2s" }}
            />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#555878", letterSpacing: 1.5, textTransform: "uppercase" }}>
                Your Resume {hasSavedResume && <span style={{ color: "#00d4aa" }}>· saved copy loaded</span>}
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="copy-btn" onClick={() => fileInputRef.current?.click()} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #ccd0e8", background: "transparent", color: "#555878", fontSize: 10.5, fontWeight: 600 }}>
                  📎 Upload PDF/DOCX
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx" onChange={handleFileUpload} style={{ display: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#888baa", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>My resumes:</span>
              {[0, 1, 2].map((i) =>
                slots[i] ? (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 6px 4px 12px", borderRadius: 8, border: activeSlot === i ? "1.5px solid #00d4aa" : "1px solid #ccd0e8", background: activeSlot === i ? "#00d4aa10" : "#ffffff" }}>
                    <span onClick={() => handleSlotLoad(i)} title={`Load — updated ${slots[i].updated}`} style={{ fontSize: 11.5, fontWeight: 700, color: activeSlot === i ? "#00a184" : "#555878", cursor: "pointer" }}>
                      {slots[i].name}
                    </span>
                    <span onClick={() => handleSlotSave(i)} title="Overwrite this slot with the current text" style={{ fontSize: 11, cursor: "pointer", opacity: 0.6 }}>💾</span>
                    <span onClick={() => handleSlotClear(i)} title="Clear slot" style={{ fontSize: 11, color: "#ff4d6d", cursor: "pointer", opacity: 0.6 }}>✕</span>
                  </span>
                ) : (
                  <button key={i} className="copy-btn" onClick={() => handleSlotSave(i)} style={{ padding: "4px 12px", borderRadius: 8, border: "1px dashed #ccd0e8", background: "transparent", color: "#888baa", fontSize: 11, fontWeight: 600 }}>
                    ＋ Save slot {i + 1}
                  </button>
                )
              )}
            </div>
            <textarea
              value={resume}
              onChange={(e) => { setResume(e.target.value); setActiveSlot(null); }}
              placeholder="Paste or upload your resume once, save it to a slot above — then it's one click per application."
              rows={15}
              style={{ width: "100%", background: "#f0f1fa", border: "1px solid #dde0f0", borderRadius: 12, padding: "13px 15px", color: "#111328", fontSize: 12.5, lineHeight: 1.7, transition: "border-color 0.2s, box-shadow 0.2s" }}
            />
          </div>
        </div>

        {/* ── BANNERS ── */}
        {error && (
          <div style={{ background: "#ff4d6d0a", border: "1px solid #ff4d6d30", borderRadius: 10, padding: "12px 16px", marginBottom: 14, color: "#ff4d6d", fontSize: 13, lineHeight: 1.5 }}>
            {error}
          </div>
        )}
        {notice && !error && (
          <div style={{ background: "#00d4aa0a", border: "1px solid #00d4aa30", borderRadius: 10, padding: "12px 16px", marginBottom: 14, color: "#00a184", fontSize: 13, lineHeight: 1.5 }}>
            {notice}
          </div>
        )}

        {/* ── RUN BUTTON ── */}
        <button
          className="run-btn"
          onClick={handleRun}
          disabled={loading}
          style={{ width: "100%", padding: "15px 0", borderRadius: 12, background: loading ? "#e8eaf4" : "linear-gradient(135deg, #00d4aa 0%, #0055ff 100%)", color: loading ? "#555878" : "#050810", fontSize: 14, fontWeight: 700, letterSpacing: 0.5, boxShadow: loading ? "none" : "0 4px 20px #00d4aa25" }}
        >
          {loading ? `⏳  ${progressMsg || "Starting..."}` : "⚡  Tailor Resume — Real Before/After Scoring"}
        </button>

        {/* ── RESULTS ── */}
        {result && (
          <div ref={resultRef} style={{ marginTop: 44 }}>
            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #dde0f0", marginBottom: 28, overflowX: "auto" }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className="tab-btn"
                  onClick={() => setActiveTab(tab.id)}
                  style={{ padding: "10px 15px", borderRadius: "8px 8px 0 0", color: activeTab === tab.id ? "#00d4aa" : "#555878", borderBottom: activeTab === tab.id ? "2px solid #00d4aa" : "2px solid transparent", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── OVERVIEW ── */}
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {referralContacts.length > 0 && (
                  <Card style={{ borderColor: "#00d4aa50", background: "#00d4aa08" }}>
                    <div style={{ display: "flex", gap: 14 }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>☕</span>
                      <div>
                        <div style={{ fontSize: 10, color: "#00a184", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                          Referral first — you know someone here
                        </div>
                        <p style={{ fontSize: 13, color: "#2a2c42", lineHeight: 1.7 }}>
                          {referralContacts.map((c) => `${c.name}${c.role ? ` (${c.role})` : ""}`).join(", ")} — logged from your coffee chats at {result.analysis.company}. A referral beats a cold application roughly 10 to 1: ask before you submit this resume through the portal.
                        </p>
                      </div>
                    </div>
                  </Card>
                )}
                <Card>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 32, flexWrap: "wrap" }}>
                    <ScoreBadge score={result.before.pct} label="Before" sub={`${result.before.matched.length} of ${result.keywords.length} JD keywords found`} />
                    <div style={{ textAlign: "center", paddingTop: 8 }}>
                      <div style={{ fontSize: 10, color: "#555878", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>Improvement</div>
                      <div style={{ fontSize: 38, fontWeight: 800, color: improvement > 0 ? "#00d4aa" : "#f5a623", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
                        {improvement >= 0 ? "+" : ""}{improvement}
                      </div>
                      <div style={{ fontSize: 10, color: "#555878", marginTop: 4 }}>coverage points — measured, not guessed</div>
                    </div>
                    <ScoreBadge score={result.after.pct} label="After" sub={`${result.after.matched.length} of ${result.keywords.length} JD keywords found`} />
                    <div style={{ flex: 1, minWidth: 220, paddingLeft: 24, borderLeft: "1px solid #dde0f0" }}>
                      <div style={{ fontSize: 10, color: "#555878", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>Coverage by Category (After)</div>
                      {Object.entries(catCounts).map(([cat, c]) => (
                        <div key={cat} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 10.5, color: "#555878", textTransform: "capitalize" }}>{cat.replace(/_/g, " ")}</span>
                            <span style={{ fontSize: 10.5, color: "#00d4aa", fontFamily: "'DM Mono', monospace" }}>{c.matched}/{c.total}</span>
                          </div>
                          <div style={{ height: 5, background: "#dde0f0", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${c.total ? (c.matched / c.total) * 100 : 0}%`, background: "linear-gradient(90deg, #00d4aa, #0066ff)", borderRadius: 3 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 16, fontSize: 11, color: "#888baa", lineHeight: 1.6 }}>
                    Scores are deterministic keyword-coverage math (same engine as the ATS Scanner) — re-running the same inputs gives the same numbers. They measure keyword presence, not interview odds.
                  </div>
                </Card>

                <Card style={{ borderColor: "#0066ff33", background: "#0066ff08" }}>
                  <div style={{ display: "flex", gap: 14 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>🎯</span>
                    <div>
                      <div style={{ fontSize: 10, color: "#0099ff", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 9 }}>
                        Strategic Advice · {result.analysis.role_archetype || "role"} archetype detected
                      </div>
                      <p style={{ fontSize: 13.5, color: "#2a2c42", lineHeight: 1.75 }}>{result.analysis.strategic_advice}</p>
                    </div>
                  </div>
                </Card>

                {result.quality && (
                  <Card style={result.quality.onePage && result.quality.cliches.length === 0 && !result.quality.rhythmFlag ? {} : { borderColor: "#f5a62340", background: "#f5a62306" }}>
                    <div style={{ fontSize: 10, color: "#555878", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
                      Six-Second Skim Checks — what a human screener sees
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 14 }}>{result.quality.onePage ? "\u2705" : "\ud83d\udea8"}</span>
                        <span style={{ fontSize: 12.5, color: "#2a2c42" }}>
                          One-page budget: {result.quality.words} words {result.quality.onePage ? "(within 700-word budget)" : "(OVER 700 \u2014 likely spills to page 2. Cut weakest bullets before sending.)"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14 }}>{result.quality.cliches.length === 0 ? "\u2705" : "\ud83d\udea8"}</span>
                        <span style={{ fontSize: 12.5, color: "#2a2c42" }}>
                          AI-clich\u00e9 scan: {result.quality.cliches.length === 0 ? "clean" : "found \u2014"}
                        </span>
                        {result.quality.cliches.map((c) => <Pill key={c} word={c} variant="red" />)}
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 14 }}>{result.quality.rhythmFlag ? "\u26a0\ufe0f" : "\u2705"}</span>
                        <span style={{ fontSize: 12.5, color: "#2a2c42" }}>
                          Bullet rhythm: {result.quality.rhythmFlag ? "most bullets end in a number \u2014 reads AI-written, vary a few endings" : "varied"}
                        </span>
                      </div>
                    </div>
                    <div style={{ borderTop: "1px solid #dde0f0", paddingTop: 14 }}>
                      <div style={{ fontSize: 10, color: "#555878", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
                        Top-Third Test \u2014 first 3 bullets vs the JD top 3 responsibilities
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 10, color: "#0099ff", fontWeight: 700, marginBottom: 6 }}>JD WANTS</div>
                          {(result.analysis.top_responsibilities || []).map((r, i) => (
                            <p key={i} style={{ fontSize: 12, color: "#2a2c42", lineHeight: 1.6, marginBottom: 5 }}>{i + 1}. {r}</p>
                          ))}
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "#00a184", fontWeight: 700, marginBottom: 6 }}>YOUR FIRST 3 BULLETS</div>
                          {topThirdBullets(result.rewritten).map((b, i) => (
                            <p key={i} style={{ fontSize: 12, color: "#2a2c42", lineHeight: 1.6, marginBottom: 5 }}>{i + 1}. {b}</p>
                          ))}
                        </div>
                      </div>
                      <p style={{ fontSize: 11, color: "#888baa", marginTop: 10, lineHeight: 1.6 }}>
                        These two columns are what a recruiter compares in the first six seconds. If they do not visibly answer each other, fix before sending.
                      </p>
                    </div>
                  </Card>
                )}

                {unsupported.length > 0 && (
                  <Card style={{ borderColor: "#ff4d6d40", background: "#ff4d6d08" }}>
                    <div style={{ display: "flex", gap: 14 }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>🛡️</span>
                      <div>
                        <div style={{ fontSize: 10, color: "#ff4d6d", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 9 }}>
                          {unsupported.length} claim{unsupported.length > 1 ? "s" : ""} need your review before sending
                        </div>
                        <p style={{ fontSize: 13, color: "#2a2c42", lineHeight: 1.7 }}>
                          The fact-checker flagged claims in the rewrite it could not ground in your original resume. Open the Fact Check tab — verify or remove each one.
                        </p>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ── KEYWORDS ── */}
            {activeTab === "keywords" && (
              <Card>
                <SectionLabel text="Keyword Coverage — Deterministic Match" count={result.keywords.length} />
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr>
                        {["Keyword", "Category", "Before", "After"].map((h) => (
                          <th key={h} style={{ padding: "9px 12px", background: "#f7f8ff", color: "#555878", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontSize: 10, textAlign: "left", borderBottom: "1px solid #dde0f0" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.keywords.map((k, i) => {
                        const inBefore = result.before.matched.some((m) => m.keyword === k.keyword);
                        const inAfter = result.after.matched.some((m) => m.keyword === k.keyword);
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "#f0f1fa" }}>
                            <td style={{ padding: "10px 12px", color: "#1a1c30", fontFamily: "'DM Mono', monospace", borderBottom: "1px solid #e8eaf4" }}>{k.keyword}</td>
                            <td style={{ padding: "10px 12px", borderBottom: "1px solid #e8eaf4" }}>
                              <Pill word={k.category.replace(/_/g, " ")} variant="blue" />
                            </td>
                            <td style={{ padding: "10px 12px", borderBottom: "1px solid #e8eaf4", fontSize: 15 }}>{inBefore ? "✅" : "❌"}</td>
                            <td style={{ padding: "10px 12px", borderBottom: "1px solid #e8eaf4", fontSize: 15 }}>
                              {inAfter ? "✅" : "❌"}
                              {!inBefore && inAfter && <span style={{ fontSize: 10, color: "#00d4aa", marginLeft: 6, fontFamily: "'DM Mono', monospace" }}>added</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* ── REWRITE PLAN ── */}
            {activeTab === "plan" && (
              <div>
                <SectionLabel text="Rewrite Plan — What Was Changed and Why" count={(result.analysis.rewrite_plan || []).length} />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(result.analysis.rewrite_plan || []).map((note, i) => (
                    <Card key={i} style={{ borderLeft: "3px solid #a855f7", display: "flex", gap: 16, alignItems: "flex-start" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "#a855f718", border: "1px solid #a855f740", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#a855f7", fontFamily: "'DM Mono', monospace" }}>
                        {i + 1}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, color: "#1a1c30", fontWeight: 600, marginBottom: 5 }}>{note.change}</p>
                        <p style={{ fontSize: 12, color: "#555878", lineHeight: 1.6 }}>Why: {note.reason}</p>
                      </div>
                    </Card>
                  ))}
                </div>
                {(result.analysis.keyword_actions || []).length > 0 && (
                  <Card style={{ marginTop: 20 }}>
                    <SectionLabel text="Keyword Actions" count={result.analysis.keyword_actions.length} />
                    {result.analysis.keyword_actions.map((a, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap" }}>
                        <Pill word={a.keyword} variant="green" />
                        <Pill word={a.action} variant="purple" />
                        <span style={{ fontSize: 12, color: "#555878", lineHeight: 1.6, flex: 1, minWidth: 200 }}>{a.how}</span>
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            )}

            {/* ── REWRITTEN RESUME ── */}
            {activeTab === "resume" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <SectionLabel text="ATS-Optimized Rewritten Resume" />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="copy-btn" onClick={copyResume} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #ccd0e8", background: "transparent", color: "#888baa", fontSize: 12, fontWeight: 600 }}>
                      {copied ? "✅ Copied!" : "📋 Copy Text"}
                    </button>
                    <button className="copy-btn" onClick={handleDocx} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #00d4aa60", background: "#00d4aa10", color: "#00a184", fontSize: 12, fontWeight: 700 }}>
                      ⬇️ Download DOCX
                    </button>
                  </div>
                </div>
                <Card>
                  <pre style={{ fontSize: 12.5, color: "#1a1c30", lineHeight: 1.9, fontFamily: "'DM Mono', monospace" }}>{result.rewritten}</pre>
                </Card>
                <div style={{ marginTop: 12, fontSize: 11, color: "#555878", textAlign: "center" }}>
                  DOCX download uses your real resume layout — name, headline, and contact line are added automatically.
                </div>
              </div>
            )}

            {/* ── FACT CHECK ── */}
            {activeTab === "verify" && (
              <div>
                <SectionLabel text="Anti-Fabrication Fact Check — Every Claim vs Your Original" count={result.verification.length} />
                {result.verification.length === 0 ? (
                  <Card>
                    <p style={{ color: "#f5a623", fontSize: 13, textAlign: "center" }}>Fact-check step did not return results for this run — review the rewrite manually before sending.</p>
                  </Card>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[...result.verification].sort((a, b) => Number(a.grounded) - Number(b.grounded)).map((v, i) => (
                      <Card key={i} style={{ borderLeft: `3px solid ${v.grounded ? "#00d4aa" : "#ff4d6d"}`, padding: "14px 18px" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                          <Pill word={v.grounded ? "GROUNDED" : "REVIEW"} variant={v.grounded ? "green" : "red"} />
                          <div style={{ flex: 1, minWidth: 220 }}>
                            <p style={{ fontSize: 12.5, color: "#1a1c30", fontWeight: 600, marginBottom: 3 }}>{v.claim}</p>
                            <p style={{ fontSize: 11.5, color: "#555878" }}>{v.basis}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── GAPS & ERRORS ── */}
            {activeTab === "gaps" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <SectionLabel text="Remaining Gaps — No Truthful Basis, Not Invented" count={(result.analysis.remaining_gaps || []).length} />
                  {!(result.analysis.remaining_gaps || []).length ? (
                    <Card>
                      <p style={{ color: "#00d4aa", fontSize: 13, textAlign: "center" }}>✅ No critical gaps flagged.</p>
                    </Card>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {result.analysis.remaining_gaps.map((g, i) => (
                        <Card key={i} style={{ padding: "16px 20px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                            <Pill word={g.keyword} variant="yellow" />
                            <div style={{ flex: 1, minWidth: 200 }}>
                              <p style={{ fontSize: 12, color: "#666a8a", marginBottom: 4 }}>{g.reason}</p>
                              {g.recommendation && <p style={{ fontSize: 11.5, color: "#0099ff" }}>→ {g.recommendation}</p>}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <SectionLabel text="Errors Fixed" count={(result.analysis.error_report || []).length} />
                  {!(result.analysis.error_report || []).length ? (
                    <Card>
                      <p style={{ color: "#00d4aa", fontSize: 13, textAlign: "center" }}>✅ No grammar or structural errors detected.</p>
                    </Card>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {result.analysis.error_report.map((e, i) => (
                        <Card key={i} style={{ borderLeft: "3px solid #ff4d6d" }}>
                          <div style={{ marginBottom: 12 }}>
                            <Pill word={e.type} variant="red" />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                            <div>
                              <div style={{ fontSize: 10, color: "#ff4d6d", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 7 }}>Original</div>
                              <p style={{ fontSize: 12.5, color: "#666a8a", lineHeight: 1.6, fontStyle: "italic" }}>"{e.original}"</p>
                              <p style={{ fontSize: 11, color: "#555878", marginTop: 8 }}>⚠ {e.issue}</p>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: "#00d4aa", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 7 }}>Fixed</div>
                              <p style={{ fontSize: 12.5, color: "#1a1c30", lineHeight: 1.6 }}>"{e.fix}"</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
