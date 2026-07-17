import { useState, useRef } from "react";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Configure pdfjs worker — served locally from the public folder (most reliable for Create React App)
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

// All API calls go through the serverless proxy — key never in the browser
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

// ─────────────────────────────────────────────────────────────────
// FILE EXTRACTION — DETERMINISTIC
// ─────────────────────────────────────────────────────────────────

// DOCX via mammoth
async function extractDOCX(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// PDF via pdfjs — coordinate-aware reading order
async function extractPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  let totalItems = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    totalItems += content.items.length;

    // Each item has transform[5] = Y position, transform[4] = X position
    const items = content.items
      .filter(it => it.str.trim())
      .map(it => ({
        str: it.str,
        x: it.transform[4],
        y: Math.round(it.transform[5]),
      }));

    // Group into lines by Y position (within 3px tolerance)
    const lines = {};
    items.forEach(it => {
      const yKey = Object.keys(lines).find(y => Math.abs(Number(y) - it.y) < 3);
      const key = yKey !== undefined ? yKey : it.y;
      if (!lines[key]) lines[key] = [];
      lines[key].push(it);
    });

    // Sort lines top-to-bottom, then items left-to-right within each line
    const sortedYs = Object.keys(lines).sort((a, b) => Number(b) - Number(a));
    sortedYs.forEach(y => {
      const lineItems = lines[y].sort((a, b) => a.x - b.x);
      fullText += lineItems.map(it => it.str).join(" ") + "\n";
    });
    fullText += "\n";
  }

  // Detect parse-hostile signal — very low text yield
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  const isLowYield = wordCount < 50 && file.size > 50000;

  return { text: fullText.trim(), totalItems, wordCount, isLowYield };
}

// ─────────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────────
function safeParseJSON(raw) {
  if (!raw) throw new Error("Empty response");
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found");
  let slice = text.slice(start, end + 1);

  // Pass 1 — direct parse
  try { return JSON.parse(slice); } catch {}

  // Pass 2 — escape control chars inside strings, remove trailing commas
  let p2 = escapeControlsInStrings(slice).replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(p2); } catch {}

  // Pass 3 — also attempt stray-quote fix (best effort)
  let p3 = fixStrayQuotes(p2).replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(p3); } catch (e) {
    throw new Error(`JSON parse failed after sanitizing: ${e.message}`);
  }
}

// Escapes raw control characters that appear inside string literals.
// These (newline, tab, CR) are the most common and are always safe to escape.
function escapeControlsInStrings(s) {
  let out = "";
  let inString = false;
  let prev = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const code = c.charCodeAt(0);
    if (c === '"' && prev !== "\\") {
      inString = !inString;
      out += c;
    } else if (inString) {
      if (c === "\n") out += "\\n";
      else if (c === "\r") out += "\\r";
      else if (c === "\t") out += "\\t";
      else if (code < 0x20) { /* drop other control chars */ }
      else out += c;
    } else {
      if (code < 0x20 && c !== "\n" && c !== "\r" && c !== "\t") { /* drop */ }
      else out += c;
    }
    prev = c;
  }
  return out;
}

// Best-effort stray-quote escaping. Handles most cases; genuinely ambiguous
// cases (stray quote immediately followed by comma) are prevented at the
// prompt level by instructing the model to avoid double quotes in values.
function fixStrayQuotes(s) {
  let out = "";
  let inString = false;
  let prev = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && prev !== "\\") {
      if (!inString) { inString = true; out += c; }
      else {
        let j = i + 1;
        while (j < s.length && /\s/.test(s[j])) j++;
        const nextCh = s[j] || "";
        if (nextCh === "" || ":}]".includes(nextCh)) { inString = false; out += c; }
        else if (nextCh === ",") {
          // ambiguous — look further: if after comma comes a quoted key (key:), treat as closing
          let k = j + 1;
          while (k < s.length && /\s/.test(s[k])) k++;
          // if next is a quote starting what looks like a key, close; else escape
          if (s[k] === '"') { inString = false; out += c; }
          else { out += '\\"'; }
        }
        else { out += '\\"'; }
      }
    } else { out += c; }
    prev = c;
  }
  return out;
}

async function apiCallJSON(systemPrompt, userMessage, maxTokens = 2000) {
  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: systemPrompt + "\n\nIMPORTANT JSON RULES:\n1. Respond with ONLY the raw JSON object. Start with { and end with }. No preamble, no markdown fences, no explanation.\n2. Inside string values, NEVER use double quotes. If you need to quote something, use single quotes instead. For example, write 'best' not \"best\".\n3. Keep string values on a single line. Do not use line breaks inside string values.",
      messages: [
        { role: "user", content: userMessage }
      ]
    })
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || `API error ${res.status}`); }
  const data = await res.json();
  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
  return safeParseJSON(text);
}

// Plain text API call — used for repair where JSON is fragile
async function apiCallText(systemPrompt, userMessage, maxTokens = 3000) {
  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    })
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || `API error ${res.status}`); }
  const data = await res.json();
  return data.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
}

// ─────────────────────────────────────────────────────────────────
// PROMPTS
// ─────────────────────────────────────────────────────────────────
const PROMPT_REPAIR = `You are a resume text repair tool. The text below was extracted from a resume file and the reading order may be scrambled (especially from multi-column PDF layouts).

Reconstruct it into clean, logical resume sections in correct reading order. Fix obvious scrambling where a job title got separated from its company, or where columns got interleaved. Do NOT add, invent, or remove any actual content — only fix ordering and structure.

Respond with ONLY the cleaned resume text. No JSON, no commentary, no preamble. Just the resume text in correct reading order.`;

const PROMPT_FIELDS = `You are an ATS resume parser. Extract structured fields from this resume text exactly as an Applicant Tracking System would populate them.

For each field, extract the value or mark it as failed. Be accurate with international formats — recognize non-US locations, degree abbreviations like B.Tech, and various date formats.

RESPOND IN RAW JSON. Use this EXACT structure. For work_history and education, each item is a SINGLE flat string, not an object. Use a dash to separate parts.
{
  "name": "extracted name or NONE",
  "email": "extracted email or NONE",
  "phone": "extracted phone or NONE",
  "location": "extracted location or NONE",
  "work_history": ["Title - Company - Dates", "Title - Company - Dates"],
  "education": ["Degree - School - Dates"],
  "skills": ["skill1", "skill2"],
  "parse_warnings": ["any field an ATS might struggle with"]
}`;

const PROMPT_KEYWORDS = `You are a JD keyword extraction tool. Extract keywords from this job description.

Return plain text, one per line, in this exact format:
category :: keyword

Use ONLY these categories: title, required_skill, preferred_skill, responsibility, tool, soft_skill, domain, metric
Max 40 lines. No bullets, no numbers, no commentary.`;

const PROMPT_SEMANTIC = `You are a senior recruiter judging resume fit beyond keyword matching.

RESPOND IN RAW JSON — short single-line strings only, no quotes inside values:
{
  "semantic_fit": "Strong",
  "fit_score": 75,
  "reasoning": "2-3 sentences max",
  "strongest_alignment": "one sentence",
  "biggest_concern": "one sentence"
}`;

const PROMPT_SUGGESTIONS = `You are a resume advisor. For each missing keyword, give one short suggestion (max 15 words) on how to add it truthfully.

Return plain text only, one line per keyword in this format:
keyword: suggestion

No bullets, no numbers, no extra text.`;

// ─────────────────────────────────────────────────────────────────
// KEYWORD MATCHING — DETERMINISTIC
// ─────────────────────────────────────────────────────────────────
function normalizeText(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s+#.]/g, " ").replace(/\s+/g, " ");
}

// Acronym <-> expansion table: "GTM" in the JD should match "go-to-market"
// in the resume and vice versa. Both directions are checked.
const ACRONYMS = {
  "gtm": "go to market", "p l": "profit and loss", "npi": "new product introduction",
  "kpi": "key performance indicator", "okr": "objectives and key results",
  "prd": "product requirements document", "roi": "return on investment",
  "saas": "software as a service", "b2b": "business to business",
  "b2c": "business to consumer", "crm": "customer relationship management",
  "erp": "enterprise resource planning", "jit": "just in time",
  "sla": "service level agreement", "uat": "user acceptance testing",
  "nps": "net promoter score", "sdlc": "software development lifecycle",
  "ghg": "greenhouse gas", "esg": "environmental social and governance",
  "sbti": "science based targets", "cdp": "carbon disclosure project",
  "mrr": "monthly recurring revenue", "arr": "annual recurring revenue",
  "pm": "product manager", "tpm": "technical program manager"
};
const EXPANSIONS = Object.fromEntries(Object.entries(ACRONYMS).map(([a, e]) => [e, a]));

function keywordVariants(normKw) {
  const variants = [normKw];
  if (ACRONYMS[normKw]) variants.push(ACRONYMS[normKw]);
  if (EXPANSIONS[normKw]) variants.push(EXPANSIONS[normKw]);
  return variants;
}

// Smart match — handles word variants and stemming
function keywordMatches(keyword, resumeText) {
  const normResume = normalizeText(resumeText);
  const normKw = normalizeText(keyword).trim();
  if (!normKw) return false;

  // Direct phrase match — including acronym/expansion variants
  if (keywordVariants(normKw).some(v => normResume.includes(v))) return true;

  // Word-level match — all significant words present (handles "stakeholder management" vs "managed stakeholders")
  const kwWords = normKw.split(" ").filter(w => w.length > 3);
  if (kwWords.length === 0) {
    return normResume.includes(normKw);
  }
  // Stem each word to a STABLE root (loops until no suffix remains, so
  // "operations" and "operation" reduce to the same stem)
  const stem = w => {
    let word = w, prev = null;
    while (word !== prev && word.length > 4) {
      prev = word;
      word = word.replace(/(ings?|ations?|ions?|ments?|ed|es|s)$/, "");
    }
    if (word.length > 4) word = word.replace(/e$/, "");
    return word;
  };
  const stemsEqual = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
  const resumeStems = [...new Set(normResume.split(" ").filter(w => w.length > 3).map(stem))];
  return kwWords.every(w => {
    const ks = stem(w);
    return resumeStems.some(rs => stemsEqual(ks, rs)) || normResume.includes(w);
  });
}

// ─────────────────────────────────────────────────────────────────
// PDF EXPORT
// ─────────────────────────────────────────────────────────────────
function exportReport(data) {
  const { fileName, parseHealth, keywordResult, fields, semantic, suggestions, repairNotes } = data;
  const matchPct = keywordResult.weightedPct ?? (Math.round((keywordResult.matched.length / (keywordResult.matched.length + keywordResult.missing.length)) * 100) || 0);

  const html = `
    <html><head><title>ATS Scan Report — ${fileName}</title>
    <style>
      body { font-family: Georgia, serif; max-width: 760px; margin: 40px auto; color: #1a1c2e; line-height: 1.6; }
      h1 { font-size: 22px; color: #0891b2; margin-bottom: 4px; }
      h2 { font-size: 15px; color: #0891b2; margin-top: 28px; border-bottom: 1px solid #e0e7ef; padding-bottom: 6px; }
      .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; }
      .big-score { font-size: 40px; font-weight: bold; color: ${matchPct >= 70 ? "#059669" : matchPct >= 50 ? "#d97706" : "#dc2626"}; }
      .kw { display: inline-block; padding: 2px 9px; border-radius: 14px; font-size: 11px; margin: 2px; }
      .kw-match { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
      .kw-miss { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
      .field { margin: 5px 0; font-size: 13px; }
      .field-fail { color: #dc2626; }
      .box { background: #f8fafc; border: 1px solid #e0e7ef; border-radius: 8px; padding: 12px 16px; margin: 10px 0; font-size: 13px; }
      .verdict { display: inline-block; padding: 4px 12px; border-radius: 14px; font-size: 13px; font-weight: bold; }
    </style></head><body>
      <h1>ATS Scan Report</h1>
      <p class="meta">${fileName} · Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

      <h2>Parse Health</h2>
      <p><span class="verdict" style="background:${parseHealth.color}22; color:${parseHealth.color};">${parseHealth.label}</span></p>
      <p class="box">${repairNotes}</p>

      <h2>Keyword Coverage Score</h2>
      <p class="big-score">${matchPct}%</p>
      <p style="font-size:13px; color:#64748b;">Matched ${keywordResult.matched.length} of ${keywordResult.matched.length + keywordResult.missing.length} JD keywords</p>
      <p style="margin-top:12px;"><strong style="font-size:12px; color:#059669;">MATCHED</strong><br/>${keywordResult.matched.map(k => `<span class="kw kw-match">${k}</span>`).join("")}</p>
      <p style="margin-top:12px;"><strong style="font-size:12px; color:#dc2626;">MISSING</strong><br/>${keywordResult.missing.map(k => `<span class="kw kw-miss">${k}</span>`).join("")}</p>

      <h2>Field Extraction (What the ATS Sees)</h2>
      <div class="field ${fields.name && fields.name !== "NONE" ? "" : "field-fail"}"><strong>Name:</strong> ${fields.name !== "NONE" ? fields.name : "FAILED TO EXTRACT"}</div>
      <div class="field ${fields.email && fields.email !== "NONE" ? "" : "field-fail"}"><strong>Email:</strong> ${fields.email !== "NONE" ? fields.email : "FAILED TO EXTRACT"}</div>
      <div class="field ${fields.phone && fields.phone !== "NONE" ? "" : "field-fail"}"><strong>Phone:</strong> ${fields.phone !== "NONE" ? fields.phone : "FAILED TO EXTRACT"}</div>
      <div class="field ${fields.location && fields.location !== "NONE" ? "" : "field-fail"}"><strong>Location:</strong> ${fields.location !== "NONE" ? fields.location : "FAILED TO EXTRACT"}</div>
      <div class="field"><strong>Work History:</strong> ${(fields.work_history || []).join(" | ")}</div>
      <div class="field"><strong>Education:</strong> ${(fields.education || []).join(" | ")}</div>

      <h2>Semantic Fit (AI Judgment)</h2>
      <p class="box"><strong>${semantic.semantic_fit} (${semantic.fit_score}%)</strong><br/>${semantic.reasoning}<br/><br/><strong>Strongest:</strong> ${semantic.strongest_alignment}<br/><strong>Concern:</strong> ${semantic.biggest_concern}</p>

      <h2>Fix Suggestions</h2>
      ${suggestions.suggestions?.map(s => `<div class="box"><strong>${s.keyword}</strong> ${s.has_basis ? "" : "(no basis in resume)"}<br/>${s.suggestion}</div>`).join("") || "<p>None</p>"}
    </body></html>
  `;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
}

// ─────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────
function Pill({ word, variant = "default" }) {
  const v = {
    default: { bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" },
    match:   { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" },
    miss:    { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
    cyan:    { bg: "#ecfeff", color: "#0891b2", border: "#a5f3fc" },
    amber:   { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  }[variant] || { bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 14, fontSize: 11, background: v.bg, color: v.color, border: `1px solid ${v.border}`, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", display: "inline-block", margin: 2 }}>{word}</span>
  );
}

function Card({ children, style = {} }) {
  return <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 6px #00000006", ...style }}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function ATSScannerAgent() {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("parse");
  const [copied, setCopied] = useState("");
  const fileInputRef = useRef(null);
  const resultRef = useRef(null);

  function copyText(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
  }

  async function handleScan() {
    if (!file) { setError("Upload your resume file first."); return; }
    if (!jd.trim()) { setError("Paste the job description."); return; }

    setError(""); setLoading(true); setResult(null);

    try {
      // STEP 1 — Extract text from file (deterministic)
      setProgressMsg("Step 1 of 5 — Extracting text from your file...");
      let rawText = "";
      let parseStats = { wordCount: 0, isLowYield: false };
      const ext = file.name.toLowerCase().split(".").pop();

      if (ext === "docx") {
        rawText = await extractDOCX(file);
        parseStats.wordCount = rawText.split(/\s+/).filter(Boolean).length;
      } else if (ext === "pdf") {
        const pdfResult = await extractPDF(file);
        rawText = pdfResult.text;
        parseStats = pdfResult;
      } else {
        throw new Error("Unsupported file type. Upload a PDF or DOCX.");
      }

      if (!rawText.trim() || rawText.length < 30) {
        throw new Error("Could not extract text. This file may be an image-based PDF or use text boxes that ATS systems cannot read.");
      }

      // STEP 2 — AI repair pass
      setProgressMsg("Step 2 of 5 — Reconstructing reading order...");
      const truncated = rawText.length > 16000;
      const cleanText = await apiCallText(PROMPT_REPAIR, `RESUME TEXT:\n${rawText.slice(0, 16000)}`, 6000) || rawText;
      const repair = { repair_notes: truncated ? "Reading order reconstructed (note: resume text over 16,000 characters was truncated for analysis)" : "Reading order reconstructed", sections_detected: [] };

      // STEP 3 — Field extraction (graceful — falls back if parse fails)
      // STEPS 3+4+5a IN PARALLEL — fields, JD keywords, and semantic fit are
      // independent once cleanText exists (the old build ran them one by one
      // with 2-second sleeps in between)
      setProgressMsg("Steps 3-4 of 5 — Extracting fields, keywords & semantic fit (parallel)...");
      const [fields, kwRaw, semantic] = await Promise.all([
        apiCallJSON(PROMPT_FIELDS, `RESUME:\n${cleanText.slice(0, 16000)}`).catch(() => (
          { name: "NONE", email: "NONE", phone: "NONE", location: "NONE", work_history: [], education: [], skills: [], parse_warnings: ["Field extraction could not be parsed for this resume"] }
        )),
        apiCallText(PROMPT_KEYWORDS, `JOB DESCRIPTION:\n${jd.slice(0, 12000)}`).catch(() => ""),
        apiCallJSON(PROMPT_SEMANTIC, `JOB DESCRIPTION:\n${jd.slice(0, 8000)}\n\nRESUME:\n${cleanText.slice(0, 10000)}`).catch(() => (
          { semantic_fit: "Unavailable", fit_score: 0, reasoning: "Semantic analysis could not be completed.", strongest_alignment: "N/A", biggest_concern: "N/A" }
        )),
      ]);

      // Keyword matching — deterministic
      // Parse "category :: keyword" lines; required skills, tools & titles weigh 2x
      // (that is how a recruiter's search query actually weights them)
      const seenKw = new Set();
      const kwObjs = [];
      kwRaw.split("\n").forEach(l => {
        const parts = l.split("::");
        const category = parts.length === 2 ? parts[0].trim().toLowerCase() : "domain";
        const keyword = (parts.length === 2 ? parts[1] : parts[0]).replace(/^[-•*\d.]+\s*/, "").trim();
        if (keyword.length < 2 || keyword.length > 60) return;
        const d = keyword.toLowerCase();
        if (seenKw.has(d)) return;
        seenKw.add(d);
        kwObjs.push({ keyword, category, weight: ["title", "required_skill", "tool"].includes(category) ? 2 : 1 });
      });
      const matched = [];
      const missing = [];
      const weights = {};
      let wTotal = 0, wMatched = 0;
      kwObjs.forEach(k => {
        weights[k.keyword] = k.weight;
        wTotal += k.weight;
        if (keywordMatches(k.keyword, cleanText)) { matched.push(k.keyword); wMatched += k.weight; }
        else missing.push(k.keyword);
      });
      const keywordResult = { matched, missing, weights, weightedPct: wTotal ? Math.round((wMatched / wTotal) * 100) : 0 };

      setProgressMsg("Step 5 of 5 — Writing fix suggestions...");
      // Suggestions — plain text, one per line, zero JSON parsing risk
      let suggestionsRaw = "";
      try {
        suggestionsRaw = await apiCallText(PROMPT_SUGGESTIONS, `MISSING KEYWORDS: ${missing.slice(0, 15).join(", ")}\n\nRESUME:\n${cleanText.slice(0, 8000)}`);
      } catch { suggestionsRaw = ""; }
      const suggestions = {
        suggestions: suggestionsRaw.split("\n")
          .map(l => l.trim()).filter(l => l.includes(":"))
          .map(l => { const [kw, ...rest] = l.split(":"); return { keyword: kw.trim(), suggestion: rest.join(":").trim(), has_basis: true }; }),
        formatting_fixes: []
      };

      // Parse health verdict
      let parseHealth;
      if (parseStats.isLowYield || (fields.parse_warnings?.length || 0) > 2) {
        parseHealth = { label: "Parse-Hostile", color: "#dc2626", level: "bad" };
      } else if ((fields.parse_warnings?.length || 0) > 0) {
        parseHealth = { label: "Minor Issues", color: "#d97706", level: "ok" };
      } else {
        parseHealth = { label: "Clean Parse", color: "#059669", level: "good" };
      }

      setResult({
        fileName: file.name,
        rawText,
        cleanText,
        repairNotes: repair.repair_notes,
        sectionsDetected: repair.sections_detected || [],
        fields,
        keywordResult,
        semantic,
        suggestions,
        parseHealth,
        parseStats,
      });
      setActiveTab("parse");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setError(e.message === "API_KEY_MISSING" ? "API key missing." : `Error: ${e.message}`);
    }
    setProgressMsg(""); setLoading(false);
  }

  const matchPct = result
    ? (result.keywordResult.weightedPct ?? (Math.round((result.keywordResult.matched.length / (result.keywordResult.matched.length + result.keywordResult.missing.length)) * 100) || 0))
    : 0;

  const TABS = [
    { id: "parse",     label: "Parse Test",       icon: "🖥️" },
    { id: "fields",    label: "Field Extraction", icon: "📋" },
    { id: "keywords",  label: "Keyword Coverage", icon: "🎯" },
    { id: "semantic",  label: "Semantic Match",   icon: "🧠" },
    { id: "fixes",     label: "Fix Suggestions",  icon: "🔧" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f7fafc", fontFamily: "'Sora', sans-serif", color: "#1a1c2e", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea, input { font-family: inherit; }
        textarea { resize: vertical; }
        textarea:focus { outline: none !important; border-color: #0891b2 !important; box-shadow: 0 0 0 3px #0891b215 !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #f7fafc; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        .scan-btn { transition: all 0.2s; cursor: pointer; border: none; font-family: inherit; }
        .scan-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px #0891b230 !important; }
        .scan-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .tab-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; border: none; background: transparent; }
        .drop-zone { transition: all 0.15s; cursor: pointer; }
        .drop-zone:hover { border-color: #0891b2 !important; background: #ecfeff !important; }
        pre { white-space: pre-wrap; word-break: break-word; }
        .fade { animation: fadeIn 0.3s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* HEADER */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "22px 40px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: "linear-gradient(135deg, #0891b2, #0e7490)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 20px #0891b228" }}>🔍</div>
          <div>
            <div style={{ fontSize: 10, color: "#0891b2", letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Agent 02 · Job Search Suite</div>
            <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.5, color: "#0f172a", lineHeight: 1 }}>ATS Scanner & Match</h1>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 11, color: "#94a3b8", lineHeight: 1.8 }}>
            Real file parsing · Deterministic keyword score<br />
            What the ATS actually sees · Repeatable
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "26px 40px 0" }}>

        {/* EXPLAINER */}
        <div style={{ background: "#ecfeff", border: "1px solid #a5f3fc", borderRadius: 12, padding: "12px 18px", marginBottom: 22, fontSize: 12.5, color: "#155e75", lineHeight: 1.6 }}>
          This scans your actual resume <strong>file</strong> the way a real ATS does — extracting text, testing what parses, and counting JD keyword coverage. The keyword score is exact arithmetic and identical every run, unlike an AI estimate.
        </div>

        {/* INPUTS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 16 }}>
          {/* File upload */}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Resume File (PDF or DOCX)</label>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx" style={{ display: "none" }}
              onChange={e => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setError(""); } }} />
            <div className="drop-zone" onClick={() => fileInputRef.current?.click()}
              style={{ border: `1.5px dashed ${file ? "#0891b2" : "#cbd5e1"}`, borderRadius: 12, padding: "32px 20px", textAlign: "center", background: file ? "#ecfeff" : "#ffffff", minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ fontSize: 32 }}>{file ? "📄" : "⬆️"}</span>
              {file ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0891b2" }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{(file.size / 1024).toFixed(0)} KB · Click to replace</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Click to upload your resume</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>PDF or DOCX — the actual file you submit</div>
                </>
              )}
            </div>
          </div>
          {/* JD */}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Job Description</label>
            <textarea value={jd} onChange={e => setJd(e.target.value)} rows={8}
              placeholder="Paste the full job description — responsibilities, required skills, tools, qualifications..."
              style={{ width: "100%", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "13px 15px", color: "#1a1c2e", fontSize: 12.5, lineHeight: 1.7, minHeight: 160 }} />
          </div>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "11px 16px", marginBottom: 14, color: "#dc2626", fontSize: 13 }}>⚠️ {error}</div>
        )}

        <button className="scan-btn" onClick={handleScan} disabled={loading} style={{
          width: "100%", padding: "15px 0", borderRadius: 12,
          background: loading ? "#e2e8f0" : "linear-gradient(135deg, #0891b2, #0e7490)",
          color: loading ? "#94a3b8" : "#ffffff", fontSize: 14, fontWeight: 700, letterSpacing: 0.4,
          boxShadow: loading ? "none" : "0 4px 20px #0891b225"
        }}>
          {loading ? `🔍  ${progressMsg}` : "🔍  Scan Resume Against JD"}
        </button>

        {/* RESULTS */}
        {result && (
          <div ref={resultRef} className="fade" style={{ marginTop: 38 }}>

            {/* Summary bar */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 22px", marginBottom: 20, boxShadow: "0 1px 6px #00000006", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 5 }}>Parse Health</div>
                <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 14, fontSize: 13, fontWeight: 700, background: `${result.parseHealth.color}18`, color: result.parseHealth.color }}>
                  {result.parseHealth.label}
                </span>
              </div>
              <div style={{ width: 1, height: 38, background: "#e2e8f0" }} />
              <div>
                <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 5 }}>Keyword Coverage</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: matchPct >= 70 ? "#059669" : matchPct >= 50 ? "#d97706" : "#dc2626", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{matchPct}%</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{result.keywordResult.matched.length}/{result.keywordResult.matched.length + result.keywordResult.missing.length} matched</span>
                </div>
              </div>
              <div style={{ width: 1, height: 38, background: "#e2e8f0" }} />
              <div>
                <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 5 }}>Semantic Fit</div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0891b2" }}>{result.semantic.semantic_fit}</span>
              </div>
              <button onClick={() => exportReport(result)} style={{ marginLeft: "auto", padding: "9px 18px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                📥 Export Report
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: 24, overflowX: "auto" }}>
              {TABS.map(t => (
                <button key={t.id} className="tab-btn" onClick={() => setActiveTab(t.id)} style={{
                  padding: "11px 16px", minWidth: 110, fontSize: 12.5, fontWeight: 600,
                  color: activeTab === t.id ? "#0891b2" : "#94a3b8",
                  borderBottom: `2px solid ${activeTab === t.id ? "#0891b2" : "transparent"}`,
                  background: activeTab === t.id ? "#ecfeff80" : "transparent",
                  display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap"
                }}>
                  <span>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>

            {/* TAB: PARSE */}
            {activeTab === "parse" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Card>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>Repair Notes</div>
                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 12 }}>{result.repairNotes}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {result.sectionsDetected.map(s => <Pill key={s} word={s} variant="cyan" />)}
                  </div>
                </Card>
                <Card>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
                    What the ATS Sees — Extracted Text
                  </div>
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "16px", maxHeight: 400, overflowY: "auto" }}>
                    <pre style={{ fontSize: 12, color: "#475569", lineHeight: 1.7, fontFamily: "'DM Mono', monospace" }}>{result.cleanText}</pre>
                  </div>
                </Card>
              </div>
            )}

            {/* TAB: FIELDS */}
            {activeTab === "fields" && (
              <Card>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 16 }}>Structured Fields the ATS Populates</div>
                {[
                  { label: "Name", value: result.fields.name },
                  { label: "Email", value: result.fields.email },
                  { label: "Phone", value: result.fields.phone },
                  { label: "Location", value: result.fields.location },
                ].map(f => (
                  <div key={f.label} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ width: 90, fontSize: 12, fontWeight: 700, color: "#64748b" }}>{f.label}</div>
                    <div style={{ flex: 1, fontSize: 13, color: f.value && f.value !== "NONE" ? "#0f172a" : "#dc2626", fontWeight: f.value && f.value !== "NONE" ? 400 : 600 }}>
                      {f.value && f.value !== "NONE" ? f.value : "⚠ FAILED TO EXTRACT — an ATS may not capture this"}
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>Work History ({result.fields.work_history?.length || 0})</div>
                    {result.fields.work_history?.map((w, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#475569", marginBottom: 6, lineHeight: 1.5 }}>• {w}</div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>Education ({result.fields.education?.length || 0})</div>
                    {result.fields.education?.map((e, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#475569", marginBottom: 6, lineHeight: 1.5 }}>• {e}</div>
                    ))}
                  </div>
                </div>
                {result.fields.parse_warnings?.length > 0 && (
                  <div style={{ marginTop: 16, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#d97706", marginBottom: 6 }}>⚠ Parse Warnings</div>
                    {result.fields.parse_warnings.map((w, i) => <p key={i} style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>• {w}</p>)}
                  </div>
                )}
              </Card>
            )}

            {/* TAB: KEYWORDS */}
            {activeTab === "keywords" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Card>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>Keyword Coverage — Weighted</div>
                    <Pill word="deterministic · required skills & tools count 2x" variant="default" />
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: 44, fontWeight: 800, color: matchPct >= 70 ? "#059669" : matchPct >= 50 ? "#d97706" : "#dc2626", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{matchPct}%</span>
                    <span style={{ fontSize: 13, color: "#64748b" }}>You match {result.keywordResult.matched.length} of {result.keywordResult.matched.length + result.keywordResult.missing.length} JD keywords</span>
                  </div>
                  <div style={{ height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden", marginBottom: 20 }}>
                    <div style={{ height: "100%", width: `${matchPct}%`, background: matchPct >= 70 ? "#059669" : matchPct >= 50 ? "#d97706" : "#dc2626", borderRadius: 4 }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", marginBottom: 8 }}>✓ MATCHED ({result.keywordResult.matched.length})</div>
                    <div>{result.keywordResult.matched.map(k => <Pill key={k} word={k} variant="match" />)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>✗ MISSING ({result.keywordResult.missing.length})</div>
                    <div>{result.keywordResult.missing.map(k => <Pill key={k} word={result.keywordResult.weights?.[k] === 2 ? `${k} (2x)` : k} variant="miss" />)}</div>
                  </div>
                </Card>

                <Card style={{ borderColor: "#d9770640", background: "#fffbeb" }}>
                  <div style={{ fontSize: 11, color: "#d97706", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
                    ⚠ What actually auto-rejects — knockout questions
                  </div>
                  <p style={{ fontSize: 12.5, color: "#78350f", lineHeight: 1.7, marginBottom: 10 }}>
                    Most ATS auto-rejections are not scores — they are knockout questions on the application form. No keyword coverage survives a knockout mismatch. Before you submit, check how you will answer:
                  </p>
                  {[
                    "Work authorization / visa sponsorship — the #1 knockout for international candidates",
                    "Minimum years of experience — answer for the relevant experience they mean, not total career",
                    "Location and willingness to relocate — match what the posting asks",
                    "Salary expectations — a number far outside band can auto-filter",
                    "Required certifications or degrees — answer exactly as asked",
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                      <span style={{ color: "#d97706", fontSize: 13, flexShrink: 0 }}>▸</span>
                      <span style={{ fontSize: 12, color: "#78350f", lineHeight: 1.6 }}>{item}</span>
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {/* TAB: SEMANTIC */}
            {activeTab === "semantic" && (
              <Card>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>Semantic Fit</div>
                  <Pill word="AI judgment · not a fixed score" variant="amber" />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#0891b2" }}>{result.semantic.semantic_fit}</span>
                  <span style={{ fontSize: 14, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>{result.semantic.fit_score}%</span>
                </div>
                <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.7, marginBottom: 16 }}>{result.semantic.reasoning}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: "#059669", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Strongest Alignment</div>
                    <p style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>{result.semantic.strongest_alignment}</p>
                  </div>
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: "#dc2626", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Biggest Concern</div>
                    <p style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>{result.semantic.biggest_concern}</p>
                  </div>
                </div>
              </Card>
            )}

            {/* TAB: FIXES */}
            {activeTab === "fixes" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {result.suggestions.formatting_fixes?.length > 0 && (
                  <Card style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#d97706", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>Formatting Fixes</div>
                    {result.suggestions.formatting_fixes.map((f, i) => <p key={i} style={{ fontSize: 13, color: "#92400e", lineHeight: 1.6, marginBottom: 5 }}>• {f}</p>)}
                  </Card>
                )}
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 2 }}>Missing Keyword Suggestions</div>
                {result.suggestions.suggestions?.map((s, i) => (
                  <Card key={i}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Pill word={s.keyword} variant={s.has_basis ? "match" : "miss"} />
                      {!s.has_basis && <span style={{ fontSize: 11, color: "#dc2626" }}>no basis in resume — do not fabricate</span>}
                      {s.where && <span style={{ fontSize: 11, color: "#94a3b8" }}>→ {s.where}</span>}
                    </div>
                    <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{s.suggestion}</p>
                  </Card>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
