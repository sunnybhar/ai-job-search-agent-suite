import { useState, useRef, useEffect } from "react";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";

// ─────────────────────────────────────────────────────────────────
// COVER LETTER AGENT v4.0 — Sunny
// - Dymax letter = the format & content gold standard (embedded below)
// - McKinsey letter techniques = the storytelling enhancement layer
// - REAL web search for company news (no more hallucinated research)
// - "Stories & Context" input: your role-specific material gets woven in
// - 3 versions varying EMPHASIS: Ops-led / Product-led / Narrative-led
// - Delimiter output format — no fragile JSON with long strings
// - All API calls via /api/claude proxy (key never in the browser)
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
const HISTORY_KEY = "coverletter_sunny_history";
const BASE_RESUME_KEY = "tailor_sunny_base_resume"; // shared with Resume Tailor
const CONTACTS_KEY = "jobsuite_contacts"; // written by the Coffee Chat agent
const RESUME_SLOTS_KEY = "resume_slots_sunny"; // managed in the Resume Tailor

function loadResumeSlots() {
  try { return (JSON.parse(localStorage.getItem(RESUME_SLOTS_KEY)) || []).filter(Boolean); } catch { return []; }
}

function loadContacts() {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY)) || []; } catch { return []; }
}
function contactStoryLine(c) {
  let line = `I spoke with ${c.name}${c.role ? ", " + c.role : ""} at ${c.company}`;
  if (c.quote) line += `, who told me: "${c.quote}"`;
  line += ".";
  if (c.learned) line += ` What I took away: ${c.learned}`;
  return line;
}

// Defaults for the letter header — editable in the UI
const DEFAULTS = {
  name: "Sunny Bhargava",
  phone: "+1 (551) 998-5759",
  email: "sb299@fordham.edu",
  linkedin: "linkedin.com/in/bhargavasunny",
};

const CANDIDATE_CONTEXT = `International MBA candidate at Fordham University, Gabelli School of Business, Class of 2027. ~10 years across product management, program management, and operations: Livguard (Product Manager — scaled subscription platform 200→11,000 users, 12% revenue growth, PRDs, roadmaps, IoT/QR tooling), Tata Hitachi (Regional Manager — 20% breakdown reduction, 8% cost cut via IoT deployment, 60+ field personnel), OYO (Operations Manager — 80 properties), Gainwell (Project Lead — $0.5M monthly savings, 24-person team, mining fleet MRC). B.Tech Mechanical Engineering, IIT-ISM Dhanbad. Builds AI-powered workflow tools (Python, React, Anthropic API) including a documentation tool cutting drafting time 90%. International experience = scale and complexity, never a liability. Never fabricate anything not present in the background or resume provided.`;

// The user's real, proven letter — this IS the standard
const GOLD_STANDARD = `I am a first-year MBA Candidate at Fordham University's Gabelli School of Business (Class of 2027) with ten years of experience in product management, new product introduction, and full product lifecycle execution, and I am applying for the Product Management Intern role at Dymax. Dymax's customer-intimate model, tailoring solutions rather than supplying standard products, is a product philosophy I recognize and respect: it requires deeper knowledge of customer use cases, more rigorous technical documentation, and a product team that understands both the commercial and operational dimensions of what they are bringing to market. My background is in exactly that kind of B2B product environment, and the NPI and lifecycle work this internship covers maps directly onto what I have been doing.

My most relevant experience is leading new product introduction at Livguard Drivetrain, where I managed the complete product lifecycle from discovery through launch and post-launch performance management. I authored the full PRD and technical documentation suite, coordinated product testing requirements across engineering and operations stakeholders, built the launch training and communications materials that enabled commercial adoption, and tracked product performance data post-launch to inform lifecycle decisions. At Tata Hitachi Construction Machinery, I worked within a global B2B industrial environment managing the deployment of a complex technical product platform, which required maintaining rigorous documentation standards, managing cross-functional workflows across engineering, operations, and commercial teams, and translating technical product capabilities into clear business-facing communications.

My data analysis and process automation capabilities reinforce the workflow improvement and reporting work this role involves. I have built quantitative models that analyze product performance data across sales, operational, and customer dimensions, and have experience translating that analysis into clear recommendations for product management decision-making. On the automation side, I have hands-on experience building AI-powered workflow tools using Python and the OpenAI API that convert manual, high-friction processes into structured, low-overhead systems.

For Dymax's Product Management team, I would contribute directly across the core responsibilities this internship describes:
• Technical documentation: reviewing and creating technical documentation across all aspects of the product lifecycle, drawing on direct experience authoring production-quality product documentation.
• Workflow review and automation: auditing current routing workflows to identify inefficiencies, applying hands-on experience building AI-powered process automation tools.
• Cross-functional coordination and presentations: supporting product managers across testing coordination and project deliverables, with the structured communication discipline built across ten years of stakeholder-facing PM work.

Thank you for your consideration. I look forward to the opportunity to discuss how my background in NPI execution, product lifecycle management, and process automation can contribute to Dymax's Product Management team this summer.`;

const SYSTEM_PROMPT = `You are a senior hiring strategist and executive ghostwriter writing cover letters for the candidate below. You write letters that get callbacks — dense with specific, verifiable substance, zero filler.

CANDIDATE CONTEXT:
${CANDIDATE_CONTEXT}

════════════════════════════════════════════
GOLD-STANDARD LETTER — match this format, density, and voice exactly
════════════════════════════════════════════
This is the candidate's proven letter. Every letter you write follows its structure:

${GOLD_STANDARD}

STRUCTURAL BLUEPRINT (from the gold standard):
1. OPENING PARAGRAPH — one sentence identifying the candidate (MBA at Fordham Gabelli, years of experience in the relevant domain) plus the exact role applied for. Then a company-specific observation showing genuine understanding of THEIR business model or strategic situation, connected back to the candidate's background. Never recite their mission statement. Never generic praise.
2. CORE EXPERIENCE PARAGRAPH — the single most relevant experience, deep and specific: what was owned, built, coordinated, and measured. Map it explicitly to what the role covers.
3. SECONDARY CAPABILITY PARAGRAPH — the reinforcing skillset (analytics, AI tool-building, program governance — whichever fits the JD), tied to concrete role responsibilities.
4. CONTRIBUTION BULLETS — "For [Company]'s [team name] team, I would contribute directly across the core responsibilities this role describes:" followed by 2-4 bullets. Each bullet: "• [Label pulled from the JD's actual responsibilities]: [one sentence grounding it in the candidate's experience]".
5. CLOSING — thank you plus one forward-looking sentence naming the candidate's specific capabilities. No over-thanking.

ENHANCEMENT TECHNIQUES (from the candidate's McKinsey letter — use when material supports them):
- Story arc: a real experience told as narrative — situation, action, quantified result, durable lesson (e.g. the e-rickshaw battery story ending in "solutions that last emerge from the intersection of rigorous analysis and genuine empathy")
- Operator positioning: "These were not advisory roles. I was the operator accountable for execution."
- Networking conversations: if the user's STORIES & CONTEXT mentions a real conversation with an employee, weave it in with the person's name and what it revealed about the firm
- Firm-specific language: if the user provides firm frameworks or values, use them precisely, never generically

════════════════════════════════════════════
SKEPTIC CHECK — mandatory, before writing anything
════════════════════════════════════════════
Identify the recruiter's single biggest skeptical question about this candidate for THIS role, and answer it inside the opening paragraph, before they can ask it. For this candidate the default doubt is: "Why does someone with 10 years of experience want this role — and will he stay?" Answer through confident framing: deliberate repositioning (engineering to operations to product at scale, now the US market via the MBA), a specific reason this role is the logical next step — never defensiveness, never naming the doubt out loud ("you may wonder..."). If the JD suggests a different primary doubt (domain switch, seniority mismatch, no US experience), answer that one instead. Report the doubt you identified in meta as skeptic_question.

════════════════════════════════════════════
RESEARCH — real search, never invented
════════════════════════════════════════════
- If ADDITIONAL DETAILS includes a COMPANY DETAIL provided by the user: use it, do NOT search.
- Otherwise: use web_search to find ONE recent (last 90 days), specific, concrete item about the company — product launch, partnership, strategic announcement, expansion, leadership change. Weave it into the opening or closing paragraph naturally.
- If search returns nothing specific and recent: use a concrete operational detail from the JD itself and report news_item_used as "NONE FOUND — used JD detail". NEVER invent or approximate a news item. A letter with no news beats a letter with fake news.
- If no hiring manager name was provided by the user: spend ONE web_search attempting to find the actual hiring manager, team lead, or recruiter name for this role or team. Use a name ONLY if you actually found it and are confident it is current. Report it in meta as hiring_manager_found (or NONE). If none found, use "Hiring Manager".

════════════════════════════════════════════
STORIES & CONTEXT — priority material
════════════════════════════════════════════
If the user supplies role-specific stories, conversation notes, or points, they are PRIORITY content: work them in naturally where they are strongest (Version 3 leans on them hardest). Preserve names, numbers, and specific phrasing. Do not pad them into clichés.

HARD RULES:
- Never use: "passionate about", "proven track record", "strong communication skills", "results-driven", "detail-oriented", "fast learner", "team player", "go-getter", "synergy", "great fit", "I am excited to apply"
- Never fabricate achievements, metrics, skills, or news
- Never summarize the company's mission back to them
- PUNCTUATION: never use em dashes (—), en dashes (–), or hyphens as sentence punctuation. Never use semicolons. Restructure with commas, periods, or two separate sentences instead. Hyphens inside compound words (cross-functional, post-launch, B2B) are fine.
- GRAMMAR: every sentence must be grammatically complete and correctly structured. Subject and verb in every sentence. No fragments, no run-ons, no comma splices. Consistent tense within each paragraph. Re-read each paragraph before finalizing and fix anything a careful editor would flag.
- Body length 380-500 words, never exceed 550. Dense beats long.
- Salutation "Dear [Hiring Manager Name]," or "Dear Hiring Manager," — never "To Whom It May Concern"
- Sign off "Sincerely," then the candidate's name
- At least 2 JD keywords woven naturally; at least 1 quantified achievement

════════════════════════════════════════════
OUTPUT — exactly 3 versions, SAME structure, different EMPHASIS
════════════════════════════════════════════
VERSION 1 — OPS & DELIVERY LEAD: core paragraph leads with operations/program delivery depth (Tata Hitachi, Gainwell, governance, scale, cost outcomes). Best when the JD is program/ops/consulting flavored.
VERSION 2 — PRODUCT & BUILDER LEAD: core paragraph leads with product wins and AI tool-building (Livguard platform scaling, PRDs, automation tools). Best when the JD is product/tech flavored.
VERSION 3 — NARRATIVE & MISSION LEAD: opens or supports with a story arc told McKinsey-letter style, weaves the user's supplied stories/conversations most prominently, connects to the company's direction. Best for mission-driven, consulting, or relationship-heavy applications.

Do NOT write the header block (name, contact, date, recipient) — it is added automatically. Each version starts at "Dear ..." and ends after "Sincerely," and the candidate's name.

RESPOND IN EXACTLY THIS PLAIN-TEXT FORMAT — no JSON, no markdown fences, no commentary outside the markers:

<<<META>>>
company: [company name from JD]
role: [exact role title from JD]
team: [team/department name from JD, or General]
news_item_used: [the specific item used, "MANUAL: ..." if user-provided, or "NONE FOUND — used JD detail"]
skeptic_question: [the biggest recruiter doubt you identified and answered]
hiring_manager_found: [name you found via search, name the user provided, or NONE]
keyword_hits: [keyword1; keyword2; keyword3]
recommended_version: [1, 2, or 3]
recommended_reason: [one direct sentence]
<<<VERSION 1>>>
Dear ...,
[letter body]
Sincerely,
${DEFAULTS.name}
<<<VERSION 2>>>
...
<<<VERSION 3>>>
...
<<<SHORT VERSION>>>
[A 120-150 word EMAIL-BODY version of whichever version you recommended: starts "Dear ...," — three short paragraphs maximum: (1) identity line that answers the skeptic question, (2) the single strongest proof point with one number, (3) direct ask for a conversation. No header block, no contribution bullets. This is for recruiters who read applications inside an email client in fifteen seconds. Ends "Sincerely," and the candidate name.]
<<<END>>>`;

// ─────────────────────────────────────────────────────────────────
// API + PARSING
// ─────────────────────────────────────────────────────────────────
async function callClaude(userMessage) {
  const response = await fetch(apiUrl(), {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "API error");
  // Web search responses contain multiple block types — keep only text
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text || "")
    .join("");
}

function parseResponse(raw) {
  const sections = {};
  const re = /<<<([^>]+)>>>/g;
  const markers = [];
  let m;
  while ((m = re.exec(raw)) !== null) markers.push({ name: m[1].trim().toUpperCase(), end: re.lastIndex, start: m.index });
  for (let i = 0; i < markers.length; i++) {
    const body = raw.slice(markers[i].end, i + 1 < markers.length ? markers[i + 1].start : raw.length).trim();
    sections[markers[i].name] = body;
  }
  if (!sections["VERSION 1"]) throw new Error("Response format unexpected — re-run generation.");

  const meta = {};
  (sections["META"] || "").split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    meta[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  });

  const versions = [
    { id: 1, label: "Ops & Delivery Lead", body: sections["VERSION 1"] || "" },
    { id: 2, label: "Product & Builder Lead", body: sections["VERSION 2"] || "" },
    { id: 3, label: "Narrative & Mission Lead", body: sections["VERSION 3"] || "" },
  ];
  if (sections["SHORT VERSION"]) {
    versions.push({ id: 4, label: "Short Email (120-150w)", body: sections["SHORT VERSION"], isShort: true });
  }
  return { meta, versions };
}

// Header block assembled deterministically — exact Dymax format every time
function buildHeaderLines(fields, meta) {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const lines = [
    { text: fields.name.toUpperCase(), style: "name" },
    { text: `${fields.phone} | ${fields.email} | ${fields.linkedin}`, style: "contact" },
    { text: "", style: "blank" },
    { text: today, style: "normal" },
    { text: "", style: "blank" },
    { text: fields.hiringManager || (meta.hiring_manager_found && !/^none$/i.test(meta.hiring_manager_found) ? meta.hiring_manager_found : "Hiring Manager"), style: "normal" },
    { text: meta.company || fields.company || "", style: "normal" },
  ];
  if (fields.companyLocation) lines.push({ text: fields.companyLocation, style: "normal" });
  if (fields.companyDept) lines.push({ text: fields.companyDept, style: "normal" });
  lines.push({ text: "", style: "blank" });
  lines.push({
    text: `Position - ${meta.role || "the role"}${fields.reqId ? ` (Job ID: ${fields.reqId})` : ""}`,
    style: "normal",
  });
  lines.push({ text: "", style: "blank" });
  return lines.filter((l) => l.style === "blank" || l.text);
}

function fullLetterText(headerLines, body) {
  return headerLines.map((l) => l.text).join("\n") + "\n" + body;
}

// ─────────────────────────────────────────────────────────────────
// DOCX EXPORT — Times New Roman 11pt, matches the Dymax letter file
// ─────────────────────────────────────────────────────────────────
function buildLetterDocx(headerLines, body) {
  const F = "Times New Roman";
  const children = [];

  headerLines.forEach((l) => {
    if (l.style === "name") {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: l.text, bold: true, size: 32, font: F })],
          spacing: { after: 40 },
        })
      );
    } else if (l.style === "contact") {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: l.text, size: 22, font: F })],
          spacing: { after: 120 },
        })
      );
    } else if (l.style === "blank") {
      children.push(new Paragraph({ children: [], spacing: { after: 60 } }));
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: l.text, size: 22, font: F })],
          spacing: { after: 20 },
        })
      );
    }
  });

  body.split(/\n\s*\n/).forEach((para) => {
    const lines = para.split("\n");
    lines.forEach((line) => {
      const t = line.trim();
      if (!t) return;
      if (t.startsWith("•")) {
        // Bold the label before the colon in contribution bullets
        const rest = t.replace(/^•\s*/, "");
        const ci = rest.indexOf(":");
        const runs =
          ci > 0 && ci < 60
            ? [
                new TextRun({ text: rest.slice(0, ci + 1), bold: true, size: 22, font: F }),
                new TextRun({ text: rest.slice(ci + 1), size: 22, font: F }),
              ]
            : [new TextRun({ text: rest, size: 22, font: F })];
        children.push(new Paragraph({ children: runs, bullet: { level: 0 }, spacing: { after: 60 } }));
      } else {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: t, size: 22, font: F })],
            spacing: { after: lines.length === 1 ? 160 : 40 },
          })
        );
      }
    });
  });

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children }],
  });
  return Packer.toBlob(doc);
}

async function downloadLetterDocx(headerLines, body, filenameBase) {
  const blob = await buildLetterDocx(headerLines, body);
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
// HISTORY
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #dde0f0", borderRadius: 14, padding: "20px 22px", ...style }}>
      {children}
    </div>
  );
}

function Pill({ word, variant = "default" }) {
  const variants = {
    default: { bg: "#dde0f0", color: "#888baa", border: "#ccd0e8" },
    green: { bg: "#00d4aa12", color: "#00d4aa", border: "#00d4aa40" },
    blue: { bg: "#0099ff12", color: "#0099ff", border: "#0099ff40" },
    yellow: { bg: "#f5a62312", color: "#f5a623", border: "#f5a62340" },
  };
  const v = variants[variant] || variants.default;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, background: v.bg, color: v.color, border: `1px solid ${v.border}`, fontFamily: "'DM Mono', monospace", display: "inline-block", margin: 2 }}>
      {word}
    </span>
  );
}

function wordCount(s) {
  return s.split(/\s+/).filter(Boolean).length;
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function CoverLetterAgent() {
  const [jd, setJd] = useState("");
  const [background, setBackground] = useState("");
  const [stories, setStories] = useState("");
  const [hiringManager, setHiringManager] = useState("");
  const [companyDept, setCompanyDept] = useState("");
  const [companyLocation, setCompanyLocation] = useState("");
  const [reqId, setReqId] = useState("");
  const [companyDetail, setCompanyDetail] = useState("");
  const [name, setName] = useState(DEFAULTS.name);
  const [phone, setPhone] = useState(DEFAULTS.phone);
  const [email, setEmail] = useState(DEFAULTS.email);
  const [linkedin, setLinkedin] = useState(DEFAULTS.linkedin);

  const [result, setResult] = useState(null);
  const [activeVersion, setActiveVersion] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const resultRef = useRef(null);

  const [contacts, setContacts] = useState([]);
  const [resumeSlots, setResumeSlots] = useState([]);
  const [activeResumeSlot, setActiveResumeSlot] = useState(null);

  useEffect(() => {
    setHistory(loadHistory());
    setContacts(loadContacts());
    setResumeSlots(loadResumeSlots());
    // Reuse the base resume saved by the Resume Tailor agent
    const saved = localStorage.getItem(BASE_RESUME_KEY);
    if (saved) setBackground(saved);
  }, []);

  // Coffee-chat contacts whose company appears in this JD — your best material
  const matchedContacts = contacts.filter(
    (c) => c.company && c.company.length > 2 && jd.toLowerCase().includes(c.company.toLowerCase())
  );

  function insertContactStory(c) {
    setStories((prev) => (prev ? prev.trimEnd() + "\n\n" : "") + contactStoryLine(c));
  }

  const fields = { name, phone, email, linkedin, hiringManager, companyDept, companyLocation, reqId };

  async function handleGenerate() {
    if (!jd.trim() || !background.trim()) {
      setError("Job description and your background/resume are both required.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const extras = [];
      if (hiringManager) extras.push(`HIRING MANAGER NAME: ${hiringManager}`);
      if (companyDept) extras.push(`DEPARTMENT: ${companyDept}`);
      if (reqId) extras.push(`REQ ID: ${reqId}`);
      if (companyDetail) extras.push(`COMPANY DETAIL (user-provided — use this, do not search): ${companyDetail}`);

      const userMessage = `JOB DESCRIPTION:
${jd}

${"─".repeat(40)}

CANDIDATE BACKGROUND / RESUME:
${background}

${"─".repeat(40)}

ROLE-SPECIFIC STORIES & CONTEXT (PRIORITY MATERIAL):
${stories.trim() || "None provided."}

${"─".repeat(40)}

ADDITIONAL DETAILS:
${extras.join("\n") || "None."}`;

      const raw = await callClaude(userMessage);
      const parsed = parseResponse(raw);
      setResult(parsed);
      setActiveVersion(Number(parsed.meta.recommended_version) || 1);
      setHistory(
        saveHistoryEntry({
          id: Date.now(),
          date: new Date().toISOString().slice(0, 10),
          company: parsed.meta.company || "Unknown",
          role: parsed.meta.role || "",
          status: "applied",
          result: parsed,
          jd,
          stories,
        })
      );
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setError(`Error: ${e.message}`);
    }
    setLoading(false);
  }

  function restoreEntry(h) {
    setJd(h.jd || "");
    setStories(h.stories || "");
    setResult(h.result);
    setActiveVersion(Number(h.result?.meta?.recommended_version) || 1);
    setShowHistory(false);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
  }

  const current = result?.versions.find((v) => v.id === activeVersion);
  const headerLines = result ? buildHeaderLines(fields, result.meta) : [];

  function copyLetter() {
    const text = current.isShort ? current.body : fullLetterText(headerLines, current.body);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleDocx() {
    const company = (result.meta.company || "letter").replace(/[^a-z0-9]/gi, "_");
    await downloadLetterDocx(headerLines, current.body, `${name.replace(/\s+/g, "_")}_Cover_Letter_${company}`);
  }

  const inputStyle = {
    width: "100%", background: "#f0f1fa", border: "1px solid #dde0f0", borderRadius: 10,
    padding: "10px 13px", color: "#111328", fontSize: 12.5, lineHeight: 1.6, fontFamily: "inherit",
  };
  const labelStyle = {
    display: "block", fontSize: 10, fontWeight: 700, color: "#555878",
    letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8ff", fontFamily: "'Sora', sans-serif", color: "#1a1c30", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea, input { resize: vertical; font-family: inherit; }
        textarea:focus, input:focus { outline: none !important; border-color: #00d4aa !important; box-shadow: 0 0 0 3px #00d4aa15 !important; }
        .run-btn { transition: all 0.2s; cursor: pointer; border: none; font-family: inherit; }
        .run-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.08); }
        .run-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .copy-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; }
        .copy-btn:hover { border-color: #00d4aa !important; color: #00d4aa !important; }
        .ver-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; }
        pre { white-space: pre-wrap; word-break: break-word; }
      `}</style>

      {/* HEADER */}
      <div style={{ borderBottom: "1px solid #dde0f0", padding: "26px 40px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, flexShrink: 0, background: "linear-gradient(135deg, #a855f7, #0066ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>✉️</div>
          <div>
            <div style={{ fontSize: 10, color: "#a855f7", letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>
              Agent 03 · Job Search Suite
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "#111328", lineHeight: 1 }}>
              Cover Letter — Sunny{" "}
              <span style={{ fontSize: 12, fontWeight: 400, color: "#555878", letterSpacing: 0 }}>v4.0 · real web search</span>
            </h1>
          </div>
          <div style={{ marginLeft: "auto", position: "relative" }}>
            <button className="copy-btn" onClick={() => setShowHistory((s) => !s)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ccd0e8", background: "transparent", color: "#555878", fontSize: 12, fontWeight: 600 }}>
              🕘 History ({history.length})
            </button>
            {showHistory && (
              <div style={{ position: "absolute", right: 0, top: 42, width: 340, maxHeight: 380, overflowY: "auto", background: "#fff", border: "1px solid #dde0f0", borderRadius: 12, boxShadow: "0 10px 40px #00000018", zIndex: 50, padding: 8 }}>
                {history.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "#888baa", textAlign: "center" }}>No saved letters yet.</div>}
                {history.map((h) => (
                  <div key={h.id} style={{ padding: "10px 12px", borderBottom: "1px solid #f0f1fa", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, cursor: "pointer" }} onClick={() => restoreEntry(h)}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111328" }}>{h.company}</div>
                      <div style={{ fontSize: 11, color: "#555878" }}>{h.role}</div>
                      <div style={{ fontSize: 10, color: "#888baa", fontFamily: "'DM Mono', monospace" }}>{h.date}</div>
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
                    <button onClick={() => setHistory(deleteHistoryEntry(h.id))} style={{ border: "none", background: "transparent", color: "#ff4d6d", cursor: "pointer", fontSize: 14 }} title="Delete">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "30px 40px 0" }}>
        {/* MAIN INPUTS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Job Description</label>
            <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={12} placeholder="Paste the full JD — title, team, responsibilities, requirements..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Your Background / Resume {background && <span style={{ color: "#00d4aa" }}>· loaded</span>}</label>
            {resumeSlots.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#888baa", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>My resumes:</span>
                {resumeSlots.map((s, i) => (
                  <button
                    key={s.id}
                    className="copy-btn"
                    onClick={() => { setBackground(s.text); setActiveResumeSlot(i); }}
                    style={{ padding: "4px 12px", borderRadius: 8, border: activeResumeSlot === i ? "1.5px solid #a855f7" : "1px solid #ccd0e8", background: activeResumeSlot === i ? "#a855f710" : "transparent", color: activeResumeSlot === i ? "#a855f7" : "#555878", fontSize: 11, fontWeight: 700 }}
                  >
                    {s.name}
                  </button>
                ))}
                <span style={{ fontSize: 10, color: "#ccd0e8" }}>· manage slots in the Resume Tailor</span>
              </div>
            )}
            <textarea value={background} onChange={(e) => { setBackground(e.target.value); setActiveResumeSlot(null); }} rows={12} placeholder="Pick one of your saved resumes above, or paste here." style={inputStyle} />
          </div>
        </div>

        {/* Matching coffee-chat contacts — one click into the stories box */}
        {matchedContacts.length > 0 && (
          <Card style={{ marginBottom: 16, borderColor: "#00d4aa50", background: "#00d4aa08" }}>
            <div style={{ fontSize: 10, color: "#00a184", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
              ☕ You've talked to people at this company — use it
            </div>
            {matchedContacts.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: "#2a2c42", flex: 1, minWidth: 220 }}>
                  <strong>{c.name}</strong>{c.role ? ` — ${c.role}` : ""} ({c.date}){c.quote ? ` · "${c.quote.slice(0, 60)}${c.quote.length > 60 ? "..." : ""}"` : ""}
                </span>
                <button className="copy-btn" onClick={() => insertContactStory(c)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #00d4aa60", background: "#00d4aa10", color: "#00a184", fontSize: 11.5, fontWeight: 700 }}>
                  + Insert into Stories
                </button>
              </div>
            ))}
            <p style={{ fontSize: 11, color: "#888baa", marginTop: 8 }}>
              A named conversation in the letter is your single strongest personalization — and consider asking them for a referral before submitting.
            </p>
          </Card>
        )}

        {/* STORIES & CONTEXT — the new priority-material input */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>
            Stories & Context for this role <span style={{ color: "#a855f7" }}>· priority material — woven into the letter</span>
          </label>
          <textarea
            value={stories}
            onChange={(e) => setStories(e.target.value)}
            rows={5}
            placeholder={'Anything specific to THIS application: a story ("At Livguard I once..."), a networking conversation ("I spoke with Sarah Chen, a PM there, who told me..."), firm frameworks or values you want referenced, points you want emphasized. Version 3 leans on this hardest.'}
            style={inputStyle}
          />
        </div>

        {/* DETAILS GRID */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "#555878", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
            Application Details (optional) & Letter Header
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><label style={labelStyle}>Hiring Manager</label><input value={hiringManager} onChange={(e) => setHiringManager(e.target.value)} placeholder="e.g. Sarah Chen" style={inputStyle} /></div>
            <div><label style={labelStyle}>Department / Team</label><input value={companyDept} onChange={(e) => setCompanyDept(e.target.value)} placeholder="e.g. Product Management" style={inputStyle} /></div>
            <div><label style={labelStyle}>Company Location</label><input value={companyLocation} onChange={(e) => setCompanyLocation(e.target.value)} placeholder="e.g. Torrington, CT" style={inputStyle} /></div>
            <div><label style={labelStyle}>Req / Job ID</label><input value={reqId} onChange={(e) => setReqId(e.target.value)} placeholder="e.g. 14918" style={inputStyle} /></div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Company Detail Override <span style={{ color: "#888baa", textTransform: "none", letterSpacing: 0 }}>— if filled, this is used instead of web search</span></label>
            <input value={companyDetail} onChange={(e) => setCompanyDetail(e.target.value)} placeholder="e.g. Their Q2 expansion of the AI-native platform into Fortune 100 accounts" style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Full Name</label><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>LinkedIn</label><input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} style={inputStyle} /></div>
          </div>
        </Card>

        {error && (
          <div style={{ background: "#ff4d6d0a", border: "1px solid #ff4d6d30", borderRadius: 10, padding: "12px 16px", marginBottom: 14, color: "#ff4d6d", fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          className="run-btn"
          onClick={handleGenerate}
          disabled={loading}
          style={{ width: "100%", padding: "15px 0", borderRadius: 12, background: loading ? "#e8eaf4" : "linear-gradient(135deg, #a855f7 0%, #0055ff 100%)", color: loading ? "#555878" : "#ffffff", fontSize: 14, fontWeight: 700, letterSpacing: 0.5, boxShadow: loading ? "none" : "0 4px 20px #a855f725" }}
        >
          {loading ? "⏳  Searching company news & writing 3 versions..." : "✉️  Generate Cover Letter — 3 Emphasis Versions"}
        </button>

        {/* RESULTS */}
        {result && current && (
          <div ref={resultRef} style={{ marginTop: 44 }}>
            {/* META BAR */}
            <Card style={{ marginBottom: 20, borderColor: "#a855f733", background: "#a855f708" }}>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 10, color: "#a855f7", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                    News / Company Detail Used
                  </div>
                  <p style={{ fontSize: 13, color: "#2a2c42", lineHeight: 1.7 }}>
                    {result.meta.news_item_used || "—"}
                  </p>
                  {/NONE FOUND/i.test(result.meta.news_item_used || "") && (
                    <p style={{ fontSize: 11.5, color: "#f5a623", marginTop: 6 }}>
                      ⚠ No verifiable recent news found — the letter uses a JD detail instead. Consider adding a Company Detail manually and re-running.
                    </p>
                  )}
                </div>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontSize: 10, color: "#f5a623", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                    Skeptic Question Answered
                  </div>
                  <p style={{ fontSize: 12.5, color: "#2a2c42", lineHeight: 1.6, marginBottom: 12 }}>{result.meta.skeptic_question || "—"}</p>
                  {result.meta.hiring_manager_found && !/^none$/i.test(result.meta.hiring_manager_found) && (
                    <p style={{ fontSize: 11.5, color: "#00a184", marginBottom: 12 }}>Addressed to: {result.meta.hiring_manager_found} (verify before sending)</p>
                  )}
                  <div style={{ fontSize: 10, color: "#0099ff", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                    JD Keywords Woven In
                  </div>
                  <div>{(result.meta.keyword_hits || "").split(";").filter((k) => k.trim()).map((k) => <Pill key={k} word={k.trim()} variant="blue" />)}</div>
                </div>
              </div>
            </Card>

            {/* VERSION TABS */}
            <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
              {result.versions.map((v) => {
                const isRec = Number(result.meta.recommended_version) === v.id;
                const isActive = activeVersion === v.id;
                return (
                  <button
                    key={v.id}
                    className="ver-btn"
                    onClick={() => setActiveVersion(v.id)}
                    style={{
                      flex: 1, minWidth: 180, padding: "12px 16px", borderRadius: 10, textAlign: "left",
                      border: isActive ? "2px solid #a855f7" : "1px solid #dde0f0",
                      background: isActive ? "#a855f70d" : "#ffffff",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: isActive ? "#a855f7" : "#555878", letterSpacing: 0.5 }}>
                      V{v.id} — {v.label} {isRec && <span style={{ color: "#00d4aa" }}>★ recommended</span>}
                    </div>
                    <div style={{ fontSize: 10.5, color: "#888baa", marginTop: 3, fontFamily: "'DM Mono', monospace" }}>
                      {wordCount(v.body)} words
                    </div>
                  </button>
                );
              })}
            </div>
            {Number(result.meta.recommended_version) === activeVersion && result.meta.recommended_reason && (
              <div style={{ fontSize: 12, color: "#00a184", marginBottom: 14 }}>★ {result.meta.recommended_reason}</div>
            )}

            {/* LETTER */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 10 }}>
              <button className="copy-btn" onClick={copyLetter} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #ccd0e8", background: "transparent", color: "#888baa", fontSize: 12, fontWeight: 600 }}>
                {copied ? "✅ Copied!" : "📋 Copy Full Letter"}
              </button>
              {!current.isShort && (
                <button className="copy-btn" onClick={handleDocx} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #a855f760", background: "#a855f710", color: "#a855f7", fontSize: 12, fontWeight: 700 }}>
                  ⬇️ Download DOCX
                </button>
              )}
            </div>
            {(() => {
              const dashes = (current.body.match(/[—–;]| - /g) || []).length;
              return dashes > 0 ? (
                <div style={{ background: "#f5a6230a", border: "1px solid #f5a62340", borderRadius: 10, padding: "10px 16px", marginBottom: 10, fontSize: 12.5, color: "#b07a10", lineHeight: 1.6 }}>
                  ⚠ Punctuation check: found {dashes} dash/semicolon use{dashes > 1 ? "s" : ""} in this version despite the rule. Fix them manually before sending, or regenerate.
                </div>
              ) : null;
            })()}
            <Card>
              <pre style={{ fontSize: 13, color: "#1a1c30", lineHeight: 1.9, fontFamily: "Georgia, serif" }}>
                {current.isShort ? current.body : fullLetterText(headerLines, current.body)}
              </pre>
            </Card>
            <div style={{ marginTop: 12, fontSize: 11, color: "#555878", textAlign: "center" }}>
              DOCX export uses your Dymax letter formatting — Times New Roman, centered name header, bold contribution labels.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
