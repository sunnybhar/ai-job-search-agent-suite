import { useState, useRef, useEffect } from "react";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import { callClaude } from "./lib/api";

pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

// ─────────────────────────────────────────────────────────────────
// AGENT 09 — RESUME AUDIT & REWRITE (two-step, gated)
// Step A: ATS engine + hiring manager + mentor assessment, with real
//         web search for company and convention research.
// GATE:   Every Step 6 recommendation must be explicitly accepted or
//         rejected before the rewrite unlocks. This is deliberate. A
//         one-click "run both" would collapse this back into the single
//         prompt the two-step design exists to replace.
// Step B: Rewrite honouring those decisions, plus a re-score.
// ─────────────────────────────────────────────────────────────────
// API transport lives in src/lib/api.js (one copy for every agent).
// The dev fallback there is gated on NODE_ENV so a production
// build cannot bypass the proxy.

const HISTORY_KEY = "audit_sunny_history";
const RESUME_SLOTS_KEY = "resume_slots_sunny";
const BASE_RESUME_KEY = "tailor_sunny_base_resume";
const CONTACTS_KEY = "jobsuite_contacts";

const PROFILE = {
  name: "SUNNY BHARGAVA",
  headline: "Product Manager | Growth & Subscription | SaaS Platforms | 10 Years Scaling Subscription Platforms",
  contact: "+1 (551) 998-5759 | sb299@fordham.edu | linkedin.com/in/bhargavasunny",
  font: "Calibri",
};

function loadSlots() {
  try { return (JSON.parse(localStorage.getItem(RESUME_SLOTS_KEY)) || []).filter(Boolean); } catch { return []; }
}
function loadContacts() {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY)) || []; } catch { return []; }
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}
function saveHistoryEntry(entry) {
  const h = [entry, ...loadHistory()].slice(0, 20);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {}
  return h;
}
function setHistoryStatus(id, status) {
  const h = loadHistory().map((x) => (x.id === id ? { ...x, status } : x));
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {}
  return h;
}
function deleteHistoryEntry(id) {
  const h = loadHistory().filter((x) => x.id !== id);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {}
  return h;
}

const WRITING_CONSTRAINTS = `WRITING CONSTRAINTS FOR YOUR OUTPUT
Never use em dashes, en dashes, hyphens used as dashes, or semicolons.
Use complete sentences. Do not write in fragments.
Do not use bullet fragments where a sentence belongs.
Do not pad with restatement of the inputs.`;

// ─────────────────────────────────────────────────────────────────
// PROMPT A — ASSESSMENT
// ─────────────────────────────────────────────────────────────────
const PROMPT_ASSESSMENT = `ROLE

You are two evaluators operating in sequence, then a mentor.

Evaluator 1: An ATS parsing and keyword matching engine of the kind used by large US employers (Workday, Greenhouse, iCIMS, Lever).

Evaluator 2: A Senior Hiring Manager who owns headcount for this role and personally screens the shortlist. You have thirty seconds per resume and a stack of forty of them.

Mentor: A senior operator advising an MBA candidate on full time recruiting. Direct, grounded, not a cheerleader. You challenge weak reasoning. You do not soften findings to protect feelings, and you do not manufacture severity to appear rigorous.

CANDIDATE CONTEXT
International MBA candidate at Fordham University, Gabelli School of Business, Class of 2027. Approximately ten years across product management, program management, and operations. Livguard as Product Manager, scaling a subscription platform from 200 to 11,000 users with 12 percent revenue growth. Tata Hitachi as Regional Manager, reducing machine breakdowns 20 percent and operating costs 8 percent through IoT deployment across 60 plus field personnel. OYO as Operations Manager across 80 properties. Gainwell as Project Lead, 0.5M dollars in monthly savings with a 24 person team. B.Tech Mechanical Engineering, IIT-ISM Dhanbad. Builds AI powered workflow tools in Python and React. No US brand name employer pedigree. Treat international scope as scale and complexity rather than as a liability, but do not let that framing suppress a real finding.

STEP 0: RESEARCH
Use web search to find current, verifiable information on what the company does and its business model, where this function sits and what it actually owns there, recent company news from the last twelve months relevant to this role, and current US resume format conventions for this function and level in 2026.
Label every finding as VERIFIED with a source, or INFERRED. Do not present speculation about internal hiring practices as fact. If you cannot find something, say so and move on.

STEP 1: KEYWORD EXTRACTION
Extract every keyword from the JD and sort into job title and title variants, required hard skills, preferred hard skills, core responsibilities, tools and technologies and platforms, soft skills and behavioral signals, and domain and industry terms. Mark each as REQUIRED or PREFERRED based on JD language.

STEP 2: ATS SCORE OUT OF 100
Score against this rubric and show the arithmetic.
A. Keyword coverage, 40 points. Required keywords present, 30 points proportional. Preferred keywords present, 10 points proportional. A keyword counts as present only if it appears in context inside a bullet or section, not merely in a skills list. Skills list only mentions score half credit.
B. Evidence strength, 35 points. For each REQUIRED keyword rate the supporting evidence. Strong means quantified outcome, clear ownership, comparable scope, and takes full weight. Moderate means present but generic, unquantified, or adjacent scope, and takes half. Weak means assertion with no proof, and takes zero. Score is the weighted average across required keywords.
C. Format and parseability, 25 points. Standard section headers 5, no tables or columns or text boxes or graphics or headers or footers 5, chronological consistency and clean date formatting 5, length and density appropriate to level 5, contact block parseable with no embedded links in images 5.
Report each subscore, the total out of 100, and one line on what the number means in practice. Then state your confidence in the score and what would change it.

STEP 3: HIRING MANAGER READ
Answer directly, no hedging. In thirty seconds what single impression does this resume create. Would you advance it to a phone screen, yes or no and why. Where does the resume lose you and at which specific line. What is the strongest single item for THIS role. What is the biggest credibility gap between what the JD needs and what this resume proves. What will an interviewer probe hardest and is the resume set up to survive that probe. Compared to a realistic candidate pool for this specific role, is this top quartile, second quartile, or below the line.

STEP 4: LINE LEVEL FINDINGS
For every bullet that needs work, give the bullet as written, what is wrong with it, and the specific fix. Cover grammar, sentence structure, incomplete sentences, tense consistency, weak verbs, unquantified claims, responsibility statements that should be outcome statements, and redundancy across bullets.
Separately flag any bullet that reads as AI generated. Specifically inflated abstract nouns, three item lists used as filler, phrases like leveraged, spearheaded, seamlessly, robust, cutting edge, passionate about, and any sentence where removing the adjectives loses no information.

STEP 5: FORMAT AND CURRENT PRACTICE
Assess against 2026 US conventions for this function and level. Flag anything dated or regionally off, including page length, section order, photo, date of birth, marital status, address detail, references line, objective statement, and skills section placement.

STEP 6: PRIORITIZED ACTIONS
List every recommended change ranked by score impact, with estimated point movement on the rubric and effort as low, medium, or high. Then name the three that matter most and say why.

STEP 7: THE HONEST TAKE
Two paragraphs. Is this role a realistic target for this candidate as currently positioned. If the gap is structural rather than cosmetic, say so plainly and say what would actually close it. If the resume is close and only needs tightening, say that too. Do not inflate the diagnosis.

${WRITING_CONSTRAINTS}

DO NOT produce a rewritten resume in this response. Assessment only.

OUTPUT FORMAT
Respond in exactly this plain text marker format. No JSON, no markdown fences, no commentary outside the markers. Use double colon as the field separator on the lines that call for it. Keep every field on a single line.

<<<RESEARCH>>>
VERIFIED or INFERRED :: what you found :: source or reason it could not be verified
<<<KEYWORDS>>>
category :: REQUIRED or PREFERRED :: keyword
(category is one of: title, required_skill, preferred_skill, responsibility, tool, soft_skill, domain)
<<<SCORE>>>
keyword_coverage :: number out of 40 :: one line of arithmetic
evidence_strength :: number out of 35 :: one line of arithmetic
format_parseability :: number out of 25 :: one line of arithmetic
total :: number out of 100 :: what this means in practice
confidence :: high or medium or low :: what would change it
<<<HM_READ>>>
impression :: answer
advance :: YES or NO :: why
loses_you :: the specific line and why
strongest :: answer
credibility_gap :: answer
hardest_probe :: answer and whether the resume survives it
quartile :: top or second or below :: why
<<<FINDINGS>>>
bullet as written :: what is wrong :: the specific fix :: AI_FLAG or CLEAN
<<<FORMAT_NOTES>>>
item :: verdict and what to do
<<<ACTIONS>>>
change :: estimated point movement :: low or medium or high :: why it matters
<<<TOP_THREE>>>
the change :: why this one matters most
<<<HONEST_TAKE>>>
Two paragraphs of plain prose.
<<<END>>>`;

// ─────────────────────────────────────────────────────────────────
// PROMPT B — REWRITE
// ─────────────────────────────────────────────────────────────────
const PROMPT_REWRITE = `ROLE

You are an executive resume writer for MBA level candidates entering US full time roles, with working knowledge of how ATS parsers read a document.

RULES

1. Truth boundary. You may rewrite, reframe, re-sequence, and surface what is already there. You may not invent a skill, tool, metric, scope, or responsibility that the source resume does not support. If a JD requirement has no basis in the resume, leave the gap open and list it separately at the end.

2. Section handling. Keep the existing sections and their names. You may propose a new section or propose cutting one, but propose it in a note rather than doing it silently.

3. Summary. Produce one, always, as a separate block marked OPTIONAL SUMMARY so the candidate can decide. Three to four lines. Use the vocabulary of the JD but never lift four or more consecutive words from it. Every claim in the summary must be provable by a bullet below it. No adjectives about personality.

4. Bullet construction. Each bullet is a complete sentence with a clear actor, a specific action, and an outcome. Quantify wherever the source resume supports it. Lead with the outcome when the outcome is the strongest element.

5. Ordering. Within the constraint of chronology, order bullets inside each role so the most JD relevant sits first.

6. ATS formatting. Plain text structure. No tables, columns, icons, graphics, text boxes, headers, or footers. Standard section headers. Consistent date format throughout. Do not include the candidate name or contact line, which are added automatically on export.

7. Language. Never use em dashes, en dashes, hyphens used as dashes, or semicolons. No fragments. No corporate filler. If a sentence still works with a word removed, remove it.

8. Voice. It must read as though a competent person wrote it about their own work. Avoid leveraged, spearheaded, utilized, robust, seamless, dynamic, passionate, results driven, proven track record, synergies, best in class.

9. THE DECISIONS ARE BINDING. You are given a list of accepted changes and a list of rejected changes from the assessment. Implement every accepted change. Do NOT implement any rejected change, and do not implement it partially or under a different name. If a rejected change conflicts with an accepted one, honour the rejection and note the conflict.

${WRITING_CONSTRAINTS}

OUTPUT FORMAT
Respond in exactly this plain text marker format. No JSON, no markdown fences, no commentary outside the markers.

<<<RESUME>>>
The full rewritten resume as plain text. ALL CAPS section headers. Every bullet starts with the bullet character and a space.
<<<OPTIONAL_SUMMARY>>>
Three to four lines, clearly separate from the resume above.
<<<CHANGELOG>>>
the material edit :: the reason for it
<<<PROPOSALS>>>
proposed addition or cut :: the reasoning :: stated as a recommendation, not an action taken
<<<GAPS>>>
the gap between the JD and this resume :: how to address it in a cover letter or interview
<<<RESCORE>>>
keyword_coverage :: before number :: after number :: one line why
evidence_strength :: before number :: after number :: one line why
format_parseability :: before number :: after number :: one line why
total :: before number :: after number :: one line on what changed
<<<END>>>`;

// ─────────────────────────────────────────────────────────────────
// API + PARSING
// ─────────────────────────────────────────────────────────────────
// Delegates to the shared client, which adds a browser side timeout
// and a readable message when the gateway cuts a long call off.
// This agent requests 9000 tokens from Opus with web search, which
// is the call most likely to hit the serverless duration limit.
// The old code called response.json() on the 504 HTML and threw an
// unreadable parse error instead of saying what happened.
async function apiCall({ system, userMessage, maxTokens, useSearch }) {
  return callClaude({
    model: "claude-opus-4-8",
    system,
    userMessage,
    maxTokens,
    useSearch,
    maxSearches: 4,
  });
}

function splitMarkers(raw) {
  const sections = {};
  const re = /<<<([^>]+)>>>/g;
  const markers = [];
  let m;
  while ((m = re.exec(raw)) !== null) markers.push({ name: m[1].trim().toUpperCase(), start: m.index, end: re.lastIndex });
  for (let i = 0; i < markers.length; i++) {
    const body = raw.slice(markers[i].end, i + 1 < markers.length ? markers[i + 1].start : raw.length).trim();
    sections[markers[i].name] = body;
  }
  return sections;
}

function rows(block, expected) {
  if (!block) return [];
  return block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l.includes("::"))
    .map((l) => {
      const parts = l.split("::").map((p) => p.trim());
      while (parts.length < expected) parts.push("");
      return parts;
    });
}

function parseAssessment(raw) {
  const s = splitMarkers(raw);
  if (!s["SCORE"] || !s["ACTIONS"]) throw new Error("Assessment format unexpected. Re-run the assessment.");

  const scoreRows = rows(s["SCORE"], 3);
  const score = {};
  scoreRows.forEach(([k, v, note]) => {
    score[k.toLowerCase()] = { value: v, note };
  });

  const hmRows = rows(s["HM_READ"], 3);
  const hm = {};
  hmRows.forEach(([k, a, b]) => {
    hm[k.toLowerCase()] = b ? `${a} ${b}` : a;
    if (k.toLowerCase() === "advance") hm.advanceVerdict = a.toUpperCase();
    if (k.toLowerCase() === "quartile") hm.quartileVerdict = a.toLowerCase();
  });

  return {
    research: rows(s["RESEARCH"], 3).map(([label, finding, source]) => ({ label: label.toUpperCase(), finding, source })),
    keywords: rows(s["KEYWORDS"], 3).map(([category, req, keyword]) => ({ category, required: /required/i.test(req), keyword })),
    score,
    hm,
    findings: rows(s["FINDINGS"], 4).map(([bullet, problem, fix, flag]) => ({ bullet, problem, fix, aiFlag: /AI_FLAG/i.test(flag) })),
    formatNotes: rows(s["FORMAT_NOTES"], 2).map(([item, verdict]) => ({ item, verdict })),
    actions: rows(s["ACTIONS"], 4).map(([change, points, effort, why], i) => ({ id: i, change, points, effort, why })),
    topThree: rows(s["TOP_THREE"], 2).map(([change, why]) => ({ change, why })),
    honestTake: s["HONEST_TAKE"] || "",
  };
}

function parseRewrite(raw) {
  const s = splitMarkers(raw);
  if (!s["RESUME"]) throw new Error("Rewrite format unexpected. Re-run the rewrite.");
  return {
    resume: s["RESUME"],
    summary: s["OPTIONAL_SUMMARY"] || "",
    changelog: rows(s["CHANGELOG"], 2).map(([edit, reason]) => ({ edit, reason })),
    proposals: rows(s["PROPOSALS"], 3).map(([item, reasoning, note]) => ({ item, reasoning, note })),
    gaps: rows(s["GAPS"], 2).map(([gap, how]) => ({ gap, how })),
    rescore: rows(s["RESCORE"], 4).map(([k, before, after, why]) => ({ k, before, after, why })),
  };
}

// ─────────────────────────────────────────────────────────────────
// FILE EXTRACTION
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
    const items = content.items.filter((it) => it.str.trim()).map((it) => ({ str: it.str, x: it.transform[4], y: Math.round(it.transform[5]) }));
    const lines = {};
    items.forEach((it) => {
      const yKey = Object.keys(lines).find((y) => Math.abs(Number(y) - it.y) < 3);
      const key = yKey !== undefined ? yKey : it.y;
      if (!lines[key]) lines[key] = [];
      lines[key].push(it);
    });
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
// DOCX EXPORT
// ─────────────────────────────────────────────────────────────────
async function downloadDocx(resumeText, summary, includeSummary, filenameBase) {
  const F = PROFILE.font;
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: PROFILE.name, bold: true, size: 32, font: F })], spacing: { after: 40 } }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: PROFILE.headline, size: 19, font: F })], spacing: { after: 20 } }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: PROFILE.contact, size: 18, font: F })], spacing: { after: 120 } }),
  ];

  if (includeSummary && summary.trim()) {
    children.push(new Paragraph({ children: [new TextRun({ text: "SUMMARY", bold: true, size: 20, font: F })], spacing: { before: 140, after: 60 } }));
    summary.split("\n").forEach((line) => {
      if (line.trim()) children.push(new Paragraph({ children: [new TextRun({ text: line.trim(), size: 18, font: F })], spacing: { after: 20 } }));
    });
  }

  resumeText.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    const isHeader = /^[A-Z][A-Z &,'/-]+$/.test(line) && line.length < 45;
    const isBullet = line.startsWith("•") || line.startsWith("- ");
    const isEntry = !isBullet && line.includes("|");
    if (isHeader) {
      children.push(new Paragraph({ children: [new TextRun({ text: line, bold: true, size: 20, font: F })], spacing: { before: 140, after: 60 } }));
    } else if (isEntry) {
      children.push(new Paragraph({ children: [new TextRun({ text: line, bold: true, size: 19, font: F })], spacing: { before: 60, after: 30 } }));
    } else if (isBullet) {
      children.push(new Paragraph({ children: [new TextRun({ text: line.replace(/^[-•]\s*/, ""), size: 18, font: F })], bullet: { level: 0 }, spacing: { after: 20 } }));
    } else {
      children.push(new Paragraph({ children: [new TextRun({ text: line, size: 18, font: F })], spacing: { after: 20 } }));
    }
  });

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 360, bottom: 360, left: 540, right: 540 } } }, children }] });
  const blob = await Packer.toBlob(doc);
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
// UI PRIMITIVES
// ─────────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return <div style={{ background: "#ffffff", border: "1px solid #dde0f0", borderRadius: 14, padding: "20px 22px", ...style }}>{children}</div>;
}
function Pill({ word, variant = "default" }) {
  const v = {
    default: { bg: "#dde0f0", color: "#888baa", border: "#ccd0e8" },
    green: { bg: "#00d4aa12", color: "#00a184", border: "#00d4aa40" },
    blue: { bg: "#0099ff12", color: "#0099ff", border: "#0099ff40" },
    red: { bg: "#ff4d6d12", color: "#ff4d6d", border: "#ff4d6d40" },
    yellow: { bg: "#f5a62312", color: "#b07a10", border: "#f5a62340" },
    purple: { bg: "#a855f712", color: "#a855f7", border: "#a855f740" },
  }[variant];
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, background: v.bg, color: v.color, border: `1px solid ${v.border}`, fontFamily: "'DM Mono', monospace", display: "inline-block", margin: 2, whiteSpace: "nowrap" }}>{word}</span>
  );
}
function Label({ text, count }) {
  return (
    <div style={{ fontSize: 10, color: "#555878", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
      {text}
      {count !== undefined && <span style={{ background: "#dde0f0", color: "#888baa", padding: "1px 8px", borderRadius: 10, fontSize: 10 }}>{count}</span>}
    </div>
  );
}
function ScoreRing({ value, label }) {
  const n = parseInt(String(value), 10) || 0;
  const color = n >= 75 ? "#00d4aa" : n >= 55 ? "#f5a623" : "#ff4d6d";
  return (
    <div style={{ textAlign: "center", minWidth: 110 }}>
      <div style={{ width: 88, height: 88, borderRadius: "50%", border: `3px solid ${color}`, background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
        <span style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "'DM Mono', monospace" }}>{n}</span>
      </div>
      <div style={{ fontSize: 10, color: "#888baa", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
export default function ResumeAuditAgent() {
  const [jd, setJd] = useState("");
  const [company, setCompany] = useState("");
  const [resume, setResume] = useState("");
  const [slots, setSlots] = useState([]);
  const [activeSlot, setActiveSlot] = useState(null);

  const [assessment, setAssessment] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [ownNotes, setOwnNotes] = useState("");
  const [rewrite, setRewrite] = useState(null);
  const [includeSummary, setIncludeSummary] = useState(false);

  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("score");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const fileRef = useRef(null);
  const assessRef = useRef(null);
  const rewriteRef = useRef(null);

  useEffect(() => {
    setHistory(loadHistory());
    const s = loadSlots();
    setSlots(s);
    const base = localStorage.getItem(BASE_RESUME_KEY);
    if (base) setResume(base);
    else if (s[0]) { setResume(s[0].text); setActiveSlot(0); }
  }, []);

  const contacts = loadContacts();
  const referralContacts = company.trim()
    ? contacts.filter((c) => {
        const co = company.trim().toLowerCase();
        const cc = (c.company || "").toLowerCase();
        return cc.length > 2 && (co.includes(cc) || cc.includes(co));
      })
    : [];

  async function handleFile(e) {
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
      setActiveSlot(null);
    } catch (err) {
      setError(`File extraction failed: ${err.message}`);
    }
    e.target.value = "";
  }

  async function runAssessment() {
    if (!jd.trim() || !resume.trim()) { setError("Job description and resume are both required."); return; }
    setError("");
    setLoadingA(true);
    setAssessment(null);
    setRewrite(null);
    setDecisions({});
    setProgress("Researching the company and current conventions, then scoring...");
    try {
      const userMessage = `COMPANY: ${company.trim() || "not provided, infer from the job description"}

JOB DESCRIPTION:
${jd}

${"-".repeat(40)}

RESUME:
${resume}`;
      const raw = await apiCall({ system: PROMPT_ASSESSMENT, userMessage, maxTokens: 9000, useSearch: true });
      const parsed = parseAssessment(raw);
      setAssessment(parsed);
      setTab("score");
      setTimeout(() => assessRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setError(`Error: ${e.message}`);
    }
    setProgress("");
    setLoadingA(false);
  }

  const decidedCount = assessment ? Object.keys(decisions).filter((k) => decisions[k]).length : 0;
  const totalActions = assessment ? assessment.actions.length : 0;
  const gateOpen = assessment && totalActions > 0 && decidedCount === totalActions;
  const rejectedCount = Object.values(decisions).filter((d) => d === "reject").length;

  async function runRewrite() {
    if (!gateOpen) return;
    setError("");
    setLoadingB(true);
    setProgress("Rewriting to your accepted decisions...");
    try {
      const accepted = assessment.actions.filter((a) => decisions[a.id] === "accept").map((a) => `ACCEPTED: ${a.change}`);
      const rejected = assessment.actions.filter((a) => decisions[a.id] === "reject").map((a) => `REJECTED, do not implement: ${a.change}`);
      const priorScores = Object.entries(assessment.score).map(([k, v]) => `${k}: ${v.value}`).join("\n");

      const userMessage = `JOB DESCRIPTION:
${jd}

${"-".repeat(40)}

RESUME TO REWRITE:
${resume}

${"-".repeat(40)}

ASSESSMENT SUBSCORES FOR THE BEFORE COLUMN OF YOUR RESCORE:
${priorScores}

${"-".repeat(40)}

DECISIONS. These are binding.
${accepted.join("\n") || "None accepted."}

${rejected.join("\n") || "None rejected."}

${ownNotes.trim() ? `CANDIDATE INSTRUCTIONS, these override conflicting recommendations:\n${ownNotes.trim()}` : ""}`;

      const raw = await apiCall({ system: PROMPT_REWRITE, userMessage, maxTokens: 9000, useSearch: false });
      const parsed = parseRewrite(raw);
      setRewrite(parsed);
      setTab("rewrite");

      const totalRow = parsed.rescore.find((r) => /total/i.test(r.k));
      setHistory(
        saveHistoryEntry({
          id: Date.now(),
          date: new Date().toISOString().slice(0, 10),
          company: company.trim() || "Unknown",
          beforePct: totalRow ? parseInt(totalRow.before, 10) : null,
          afterPct: totalRow ? parseInt(totalRow.after, 10) : null,
          accepted: assessment.actions.length - rejectedCount,
          rejected: rejectedCount,
          status: "applied",
          jd,
          assessment,
          rewrite: parsed,
        })
      );
      setTimeout(() => rewriteRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setError(`Error: ${e.message}`);
    }
    setProgress("");
    setLoadingB(false);
  }

  function restore(h) {
    setJd(h.jd || "");
    setCompany(h.company || "");
    setAssessment(h.assessment);
    setRewrite(h.rewrite);
    setShowHistory(false);
    setTab("rewrite");
    setTimeout(() => assessRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
  }

  const inputStyle = { width: "100%", background: "#f0f1fa", border: "1px solid #dde0f0", borderRadius: 12, padding: "13px 15px", color: "#111328", fontSize: 12.5, lineHeight: 1.7, fontFamily: "inherit" };
  const labelStyle = { display: "block", fontSize: 10, fontWeight: 700, color: "#555878", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 };

  const TABS = [
    { id: "score", label: "Score", icon: "\u{1F4CA}" },
    { id: "hm", label: "Hiring Manager Read", icon: "\u{1F464}" },
    { id: "findings", label: "Line Findings", icon: "\u{1F50D}" },
    { id: "research", label: "Research & Format", icon: "\u{1F310}" },
    { id: "gate", label: `Decisions (${decidedCount}/${totalActions})`, icon: "⚖️" },
    { id: "rewrite", label: "Rewrite", icon: "\u{1F4C4}" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8ff", fontFamily: "'Sora', sans-serif", color: "#1a1c30", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea, input { resize: vertical; font-family: inherit; }
        textarea:focus, input:focus { outline: none !important; border-color: #f5a623 !important; box-shadow: 0 0 0 3px #f5a62315 !important; }
        .run-btn { transition: all 0.2s; cursor: pointer; border: none; font-family: inherit; }
        .run-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.08); }
        .run-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .tab-btn { transition: all 0.15s; cursor: pointer; border: none; background: transparent; font-family: inherit; }
        .copy-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; }
        .dec-btn { cursor: pointer; font-family: inherit; transition: all 0.12s; }
        pre { white-space: pre-wrap; word-break: break-word; }
      `}</style>

      {/* HEADER */}
      <div style={{ borderBottom: "1px solid #dde0f0", padding: "26px 40px", background: "#fff" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, flexShrink: 0, background: "linear-gradient(135deg, #f5a623, #ff4d6d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{"⚖️"}</div>
          <div>
            <div style={{ fontSize: 10, color: "#f5a623", letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>Agent 09 · Job Search Suite</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "#111328", lineHeight: 1 }}>
              Resume Audit & Rewrite <span style={{ fontSize: 12, fontWeight: 400, color: "#555878" }}>two-step, gated</span>
            </h1>
          </div>
          <div style={{ marginLeft: "auto", position: "relative" }}>
            <button className="copy-btn" onClick={() => setShowHistory((s) => !s)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ccd0e8", background: "transparent", color: "#555878", fontSize: 12, fontWeight: 600 }}>
              {"\u{1F558}"} History ({history.length})
            </button>
            {showHistory && (
              <div style={{ position: "absolute", right: 0, top: 42, width: 350, maxHeight: 380, overflowY: "auto", background: "#fff", border: "1px solid #dde0f0", borderRadius: 12, boxShadow: "0 10px 40px #00000018", zIndex: 50, padding: 8 }}>
                {history.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "#888baa", textAlign: "center" }}>No audits saved yet.</div>}
                {history.map((h) => (
                  <div key={h.id} style={{ padding: "10px 12px", borderBottom: "1px solid #f0f1fa", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, cursor: "pointer" }} onClick={() => restore(h)}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111328" }}>{h.company}</div>
                      <div style={{ fontSize: 10, color: "#888baa", fontFamily: "'DM Mono', monospace" }}>
                        {h.date} · {h.beforePct}/100 to {h.afterPct}/100 · {h.rejected} rejected
                      </div>
                    </div>
                    <select
                      value={h.status || "applied"}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setHistory(setHistoryStatus(h.id, e.target.value))}
                      style={{ fontSize: 10, padding: "3px 4px", borderRadius: 6, border: "1px solid #dde0f0", background: "#f7f8ff", color: "#555878", fontFamily: "inherit", cursor: "pointer" }}
                    >
                      {["applied", "no reply", "response", "interview", "offer", "rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => setHistory(deleteHistoryEntry(h.id))} style={{ border: "none", background: "transparent", color: "#ff4d6d", cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 40px 0" }}>
        {/* INPUTS */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Company</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Dymax" style={{ ...inputStyle, maxWidth: 340 }} />
        </div>

        {referralContacts.length > 0 && (
          <Card style={{ marginBottom: 14, borderColor: "#00d4aa50", background: "#00d4aa08" }}>
            <div style={{ display: "flex", gap: 14 }}>
              <span style={{ fontSize: 20 }}>{"☕"}</span>
              <div>
                <div style={{ fontSize: 10, color: "#00a184", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Referral first, you know someone here</div>
                <p style={{ fontSize: 13, color: "#2a2c42", lineHeight: 1.7 }}>
                  {referralContacts.map((c) => `${c.name}${c.role ? ` (${c.role})` : ""}`).join(", ")} from your logged coffee chats. A referral outperforms a cold application by a wide margin. Ask before you submit through the portal.
                </p>
              </div>
            </div>
          </Card>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Job Description</label>
            <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={14} placeholder="Paste the full job description." style={inputStyle} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Resume</label>
              <button className="copy-btn" onClick={() => fileRef.current?.click()} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #ccd0e8", background: "transparent", color: "#555878", fontSize: 10.5, fontWeight: 600 }}>
                {"\u{1F4CE}"} Upload PDF/DOCX
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.docx" onChange={handleFile} style={{ display: "none" }} />
            </div>
            {slots.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#888baa", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>My resumes:</span>
                {slots.map((s, i) => (
                  <button key={s.id} className="copy-btn" onClick={() => { setResume(s.text); setActiveSlot(i); }}
                    style={{ padding: "4px 12px", borderRadius: 8, border: activeSlot === i ? "1.5px solid #f5a623" : "1px solid #ccd0e8", background: activeSlot === i ? "#f5a62310" : "transparent", color: activeSlot === i ? "#b07a10" : "#555878", fontSize: 11, fontWeight: 700 }}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            <textarea value={resume} onChange={(e) => { setResume(e.target.value); setActiveSlot(null); }} rows={slots.length > 0 ? 12 : 14} placeholder="Pick a saved resume above, upload, or paste." style={inputStyle} />
          </div>
        </div>

        {error && <div style={{ background: "#ff4d6d0a", border: "1px solid #ff4d6d30", borderRadius: 10, padding: "12px 16px", marginBottom: 14, color: "#ff4d6d", fontSize: 13 }}>{error}</div>}

        <button className="run-btn" onClick={runAssessment} disabled={loadingA || loadingB}
          style={{ width: "100%", padding: "15px 0", borderRadius: 12, background: loadingA ? "#e8eaf4" : "linear-gradient(135deg, #f5a623 0%, #ff4d6d 100%)", color: loadingA ? "#555878" : "#ffffff", fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>
          {loadingA ? `⏳  ${progress}` : "⚖️  Step 1 of 2 — Run Assessment (ATS + hiring manager + mentor)"}
        </button>

        {/* ASSESSMENT */}
        {assessment && (
          <div ref={assessRef} style={{ marginTop: 40 }}>
            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #dde0f0", marginBottom: 24, overflowX: "auto" }}>
              {TABS.map((t) => (
                <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)}
                  style={{ padding: "10px 14px", borderRadius: "8px 8px 0 0", color: tab === t.id ? "#b07a10" : "#555878", borderBottom: tab === t.id ? "2px solid #f5a623" : "2px solid transparent", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                  <span>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>

            {/* SCORE */}
            {tab === "score" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <Card>
                  <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center" }}>
                    <ScoreRing value={assessment.score.total?.value} label="Total / 100" />
                    <div style={{ flex: 1, minWidth: 260 }}>
                      {["keyword_coverage", "evidence_strength", "format_parseability"].map((k) => (
                        assessment.score[k] && (
                          <div key={k} style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                              <span style={{ fontSize: 11.5, color: "#555878", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                              <span style={{ fontSize: 11.5, color: "#b07a10", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{assessment.score[k].value}</span>
                            </div>
                            <p style={{ fontSize: 11, color: "#888baa", lineHeight: 1.5 }}>{assessment.score[k].note}</p>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                  {assessment.score.total?.note && (
                    <p style={{ fontSize: 13, color: "#2a2c42", lineHeight: 1.7, marginTop: 14, paddingTop: 14, borderTop: "1px solid #dde0f0" }}>{assessment.score.total.note}</p>
                  )}
                  {assessment.score.confidence && (
                    <p style={{ fontSize: 11.5, color: "#888baa", marginTop: 8 }}>
                      Confidence: <strong style={{ color: "#555878" }}>{assessment.score.confidence.value}</strong>. {assessment.score.confidence.note}
                    </p>
                  )}
                </Card>

                <Card>
                  <Label text="Keywords Extracted" count={assessment.keywords.length} />
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: "#ff4d6d", fontWeight: 700, marginBottom: 6 }}>REQUIRED</div>
                    <div>{assessment.keywords.filter((k) => k.required).map((k, i) => <Pill key={i} word={k.keyword} variant="red" />)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#0099ff", fontWeight: 700, marginBottom: 6 }}>PREFERRED</div>
                    <div>{assessment.keywords.filter((k) => !k.required).map((k, i) => <Pill key={i} word={k.keyword} variant="blue" />)}</div>
                  </div>
                </Card>

                <Card style={{ borderColor: "#f5a62340", background: "#f5a62308" }}>
                  <Label text="Step 7 — The Honest Take" />
                  <p style={{ fontSize: 13.5, color: "#2a2c42", lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{assessment.honestTake}</p>
                </Card>
              </div>
            )}

            {/* HM READ */}
            {tab === "hm" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Card style={{ borderColor: assessment.hm.advanceVerdict === "YES" ? "#00d4aa50" : "#ff4d6d50", background: assessment.hm.advanceVerdict === "YES" ? "#00d4aa08" : "#ff4d6d08" }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: assessment.hm.advanceVerdict === "YES" ? "#00a184" : "#ff4d6d", fontFamily: "'DM Mono', monospace" }}>
                      {assessment.hm.advanceVerdict || "?"}
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontSize: 10, color: "#555878", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Would advance to phone screen</div>
                      <p style={{ fontSize: 13, color: "#2a2c42", lineHeight: 1.7 }}>{assessment.hm.advance}</p>
                    </div>
                    {assessment.hm.quartileVerdict && (
                      <Pill word={`${assessment.hm.quartileVerdict} quartile`} variant={assessment.hm.quartileVerdict === "top" ? "green" : assessment.hm.quartileVerdict === "second" ? "yellow" : "red"} />
                    )}
                  </div>
                </Card>
                {[
                  ["Thirty second impression", assessment.hm.impression],
                  ["Where it loses you", assessment.hm.loses_you],
                  ["Strongest single item", assessment.hm.strongest],
                  ["Biggest credibility gap", assessment.hm.credibility_gap],
                  ["What gets probed hardest", assessment.hm.hardest_probe],
                  ["Against the realistic pool", assessment.hm.quartile],
                ].map(([k, v]) => v && (
                  <Card key={k}>
                    <Label text={k} />
                    <p style={{ fontSize: 13, color: "#2a2c42", lineHeight: 1.75 }}>{v}</p>
                  </Card>
                ))}
              </div>
            )}

            {/* FINDINGS */}
            {tab === "findings" && (
              <div>
                <Label text="Line Level Findings" count={assessment.findings.length} />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {assessment.findings.map((f, i) => (
                    <Card key={i} style={{ borderLeft: f.aiFlag ? "3px solid #a855f7" : "3px solid #ff4d6d" }}>
                      {f.aiFlag && <div style={{ marginBottom: 8 }}><Pill word="reads as AI generated" variant="purple" /></div>}
                      <p style={{ fontSize: 12.5, color: "#666a8a", fontStyle: "italic", lineHeight: 1.6, marginBottom: 8 }}>"{f.bullet}"</p>
                      <p style={{ fontSize: 12, color: "#ff4d6d", lineHeight: 1.6, marginBottom: 8 }}>{f.problem}</p>
                      <p style={{ fontSize: 12.5, color: "#1a1c30", lineHeight: 1.7 }}><strong style={{ color: "#00a184" }}>Fix:</strong> {f.fix}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* RESEARCH + FORMAT */}
            {tab === "research" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <Card>
                  <Label text="Step 0 — Research" count={assessment.research.length} />
                  {assessment.research.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #f0f1fa" }}>
                      <Pill word={r.label} variant={r.label === "VERIFIED" ? "green" : "yellow"} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12.5, color: "#2a2c42", lineHeight: 1.6 }}>{r.finding}</p>
                        <p style={{ fontSize: 11, color: "#888baa", marginTop: 2 }}>{r.source}</p>
                      </div>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: "#888baa", marginTop: 10, lineHeight: 1.6 }}>
                    VERIFIED items came from a real web search. INFERRED items are the model reasoning from the JD and prior knowledge. Check anything you plan to repeat in an interview.
                  </p>
                </Card>
                <Card>
                  <Label text="Step 5 — Format & 2026 Conventions" count={assessment.formatNotes.length} />
                  {assessment.formatNotes.map((f, i) => (
                    <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #f0f1fa" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111328", marginBottom: 2 }}>{f.item}</div>
                      <p style={{ fontSize: 12, color: "#555878", lineHeight: 1.6 }}>{f.verdict}</p>
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {/* THE GATE */}
            {tab === "gate" && (
              <div>
                <Card style={{ marginBottom: 18, borderColor: "#f5a62340", background: "#f5a62308" }}>
                  <div style={{ display: "flex", gap: 14 }}>
                    <span style={{ fontSize: 22 }}>{"⚖️"}</span>
                    <div>
                      <div style={{ fontSize: 10, color: "#b07a10", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Decide every recommendation before the rewrite unlocks</div>
                      <p style={{ fontSize: 13, color: "#2a2c42", lineHeight: 1.75 }}>
                        This step is the point of the two-step design. The model optimizes keyword match against one job description. You are managing a narrative across thirty applications. Reject at least the recommendations that bury your strongest evidence, cut a bullet written for the human reader, or trade a number for a phrase.
                      </p>
                    </div>
                  </div>
                </Card>

                {assessment.topThree.length > 0 && (
                  <Card style={{ marginBottom: 18 }}>
                    <Label text="The three that matter most, per the assessment" />
                    {assessment.topThree.map((t, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#f5a623", fontFamily: "'DM Mono', monospace" }}>{i + 1}</span>
                        <div>
                          <p style={{ fontSize: 12.5, color: "#111328", fontWeight: 600 }}>{t.change}</p>
                          <p style={{ fontSize: 11.5, color: "#555878", lineHeight: 1.6 }}>{t.why}</p>
                        </div>
                      </div>
                    ))}
                  </Card>
                )}

                <Label text="Every recommendation" count={totalActions} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                  {assessment.actions.map((a) => {
                    const d = decisions[a.id];
                    return (
                      <Card key={a.id} style={{ borderLeft: d === "accept" ? "3px solid #00d4aa" : d === "reject" ? "3px solid #ff4d6d" : "3px solid #dde0f0", padding: "14px 18px" }}>
                        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 260 }}>
                            <p style={{ fontSize: 13, color: "#111328", fontWeight: 600, marginBottom: 4 }}>{a.change}</p>
                            <p style={{ fontSize: 11.5, color: "#555878", lineHeight: 1.6, marginBottom: 6 }}>{a.why}</p>
                            <Pill word={`${a.points} pts`} variant="blue" />
                            <Pill word={`${a.effort} effort`} variant="default" />
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="dec-btn" onClick={() => setDecisions((p) => ({ ...p, [a.id]: "accept" }))}
                              style={{ padding: "7px 16px", borderRadius: 8, border: d === "accept" ? "1.5px solid #00d4aa" : "1px solid #ccd0e8", background: d === "accept" ? "#00d4aa15" : "transparent", color: d === "accept" ? "#00a184" : "#888baa", fontSize: 11.5, fontWeight: 700 }}>
                              Accept
                            </button>
                            <button className="dec-btn" onClick={() => setDecisions((p) => ({ ...p, [a.id]: "reject" }))}
                              style={{ padding: "7px 16px", borderRadius: 8, border: d === "reject" ? "1.5px solid #ff4d6d" : "1px solid #ccd0e8", background: d === "reject" ? "#ff4d6d15" : "transparent", color: d === "reject" ? "#ff4d6d" : "#888baa", fontSize: 11.5, fontWeight: 700 }}>
                              Reject
                            </button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>Your own instructions (optional, these override the model)</label>
                  <textarea value={ownNotes} onChange={(e) => setOwnNotes(e.target.value)} rows={4}
                    placeholder="e.g. Keep the Livguard 55x scaling bullet first in every version. Do not soften any number into a phrase."
                    style={inputStyle} />
                </div>

                {rejectedCount === 0 && gateOpen && (
                  <div style={{ background: "#f5a6230a", border: "1px solid #f5a62340", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 12.5, color: "#b07a10", lineHeight: 1.65 }}>
                    You accepted every recommendation. That is allowed, but it rebuilds the single prompt this two-step design exists to replace. Worth a second look at anything that reorders your strongest bullets or removes a number.
                  </div>
                )}

                <button className="run-btn" onClick={runRewrite} disabled={!gateOpen || loadingB}
                  style={{ width: "100%", padding: "15px 0", borderRadius: 12, background: !gateOpen || loadingB ? "#e8eaf4" : "linear-gradient(135deg, #00d4aa 0%, #0055ff 100%)", color: !gateOpen || loadingB ? "#888baa" : "#ffffff", fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>
                  {loadingB
                    ? `⏳  ${progress}`
                    : gateOpen
                      ? `\u{1F4C4}  Step 2 of 2 — Rewrite (${totalActions - rejectedCount} accepted, ${rejectedCount} rejected)`
                      : `\u{1F512}  Decide all ${totalActions} recommendations to unlock the rewrite (${decidedCount} done)`}
                </button>
              </div>
            )}

            {/* REWRITE */}
            {tab === "rewrite" && (
              <div ref={rewriteRef}>
                {!rewrite ? (
                  <Card style={{ textAlign: "center", padding: "40px 24px" }}>
                    <p style={{ fontSize: 13.5, color: "#888baa", lineHeight: 1.8 }}>
                      No rewrite yet. Go to the Decisions tab, accept or reject each recommendation, then run Step 2.
                    </p>
                  </Card>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    {rewrite.rescore.length > 0 && (
                      <Card>
                        <Label text="Re-score, before and after" />
                        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
                          {rewrite.rescore.filter((r) => /total/i.test(r.k)).map((r, i) => (
                            <div key={i} style={{ display: "flex", gap: 18, alignItems: "center" }}>
                              <ScoreRing value={r.before} label="Before" />
                              <span style={{ fontSize: 22, color: "#ccd0e8" }}>{"→"}</span>
                              <ScoreRing value={r.after} label="After" />
                            </div>
                          ))}
                          <div style={{ flex: 1, minWidth: 240 }}>
                            {rewrite.rescore.filter((r) => !/total/i.test(r.k)).map((r, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f0f1fa" }}>
                                <span style={{ fontSize: 11.5, color: "#555878", textTransform: "capitalize" }}>{r.k.replace(/_/g, " ")}</span>
                                <span style={{ fontSize: 11.5, fontFamily: "'DM Mono', monospace", color: "#111328" }}>{r.before} {"→"} {r.after}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <p style={{ fontSize: 11, color: "#888baa", marginTop: 12, lineHeight: 1.6 }}>
                          This re-score is the model grading its own work against the same rubric. Treat it as directional, not as an independent measurement. Run the ATS Scanner on the exported file if you want deterministic keyword math.
                        </p>
                      </Card>
                    )}

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                        <Label text="Rewritten Resume" />
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {rewrite.summary && (
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#555878", cursor: "pointer" }}>
                              <input type="checkbox" checked={includeSummary} onChange={(e) => setIncludeSummary(e.target.checked)} />
                              include summary in export
                            </label>
                          )}
                          <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(rewrite.resume); setCopied(true); setTimeout(() => setCopied(false), 2500); }}
                            style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #ccd0e8", background: "transparent", color: "#888baa", fontSize: 12, fontWeight: 600 }}>
                            {copied ? "✅ Copied" : "\u{1F4CB} Copy"}
                          </button>
                          <button className="copy-btn" onClick={() => downloadDocx(rewrite.resume, rewrite.summary, includeSummary, `Sunny_Bhargava_Resume_${(company || "audit").replace(/[^a-z0-9]/gi, "_")}`)}
                            style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #00d4aa60", background: "#00d4aa10", color: "#00a184", fontSize: 12, fontWeight: 700 }}>
                            {"⬇️"} Download DOCX
                          </button>
                        </div>
                      </div>
                      <Card>
                        <pre style={{ fontSize: 12.5, color: "#1a1c30", lineHeight: 1.9, fontFamily: "'DM Mono', monospace" }}>{rewrite.resume}</pre>
                      </Card>
                    </div>

                    {rewrite.summary && (
                      <Card style={{ borderColor: "#a855f740", background: "#a855f708" }}>
                        <Label text="Optional Summary — your call whether to use it" />
                        <p style={{ fontSize: 13, color: "#2a2c42", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{rewrite.summary}</p>
                      </Card>
                    )}

                    <Card>
                      <Label text="Change Log" count={rewrite.changelog.length} />
                      {rewrite.changelog.map((c, i) => (
                        <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #f0f1fa" }}>
                          <p style={{ fontSize: 12.5, color: "#111328", fontWeight: 600 }}>{c.edit}</p>
                          <p style={{ fontSize: 11.5, color: "#555878", lineHeight: 1.6 }}>{c.reason}</p>
                        </div>
                      ))}
                    </Card>

                    {rewrite.proposals.length > 0 && (
                      <Card>
                        <Label text="Proposed additions or cuts, not applied" count={rewrite.proposals.length} />
                        {rewrite.proposals.map((p, i) => (
                          <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #f0f1fa" }}>
                            <p style={{ fontSize: 12.5, color: "#111328", fontWeight: 600 }}>{p.item}</p>
                            <p style={{ fontSize: 11.5, color: "#555878", lineHeight: 1.6 }}>{p.reasoning} {p.note}</p>
                          </div>
                        ))}
                      </Card>
                    )}

                    <Card style={{ borderColor: "#f5a62340", background: "#f5a62308" }}>
                      <Label text="Gaps no rewrite can close" count={rewrite.gaps.length} />
                      {rewrite.gaps.map((g, i) => (
                        <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #f5a62320" }}>
                          <p style={{ fontSize: 12.5, color: "#111328", fontWeight: 600 }}>{g.gap}</p>
                          <p style={{ fontSize: 11.5, color: "#b07a10", lineHeight: 1.6 }}>{"→"} {g.how}</p>
                        </div>
                      ))}
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
