import { useState, useRef } from "react";

// ─────────────────────────────────────────────────────────────────
// 🔑 YOUR API KEY
// ─────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.REACT_APP_ANTHROPIC_KEY;

// ─────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — Agent 3 v2
// Full Cheat Sheet + MongoDB Format Instruction Set
// ─────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a senior hiring strategist and executive ghostwriter who has reviewed thousands of cover letters from both sides of the table. You write cover letters that get callbacks. You do not write cover letters that sound like cover letters.

════════════════════════════════════════════
CANDIDATE CONTEXT
════════════════════════════════════════════
International MBA student at Fordham University, Gabelli School of Business, 
Class of 2027. Approximately 10 years of experience in operations, program 
management, and product management. No US brand-name employer pedigree. 
The cover letter must reframe international experience as directly transferable, 
not foreign. Lead with impact, not apology.

════════════════════════════════════════════
BEFORE YOU WRITE — DO THESE TWO THINGS FIRST
════════════════════════════════════════════
1. RESEARCH: Search for one recent news item about the company from the last 
   90 days. Identify one specific concrete detail: a product launch, a 
   partnership, a strategic announcement, a leadership change. You will use 
   this in the closing paragraph. If no recent news is found, pull one 
   specific operational or strategic detail from the company website that is 
   NOT their generic mission statement.

2. SKEPTIC CHECK: What is the recruiter's single biggest skeptical question 
   about this candidate for this role? Write your hook to answer that question 
   before the recruiter can ask it. Common skeptical questions: Is this person 
   overqualified? Are they pivoting with no relevant background? Is their 
   experience actually transferable? Answer it in sentence one.

════════════════════════════════════════════
STRUCTURE — 3 paragraphs, built from these 6 elements
════════════════════════════════════════════
The 6 elements below are the building blocks. They do NOT map one-to-one 
to sentences or paragraphs. Weave them into 3 flowing paragraphs as shown.

ELEMENT 1 — HOOK (opens paragraph 1)
The core tension, insight, or problem that makes this role genuinely 
interesting. The recruiter should recognize their own world in sentence one 
before they know anything about the candidate. If the candidate is 
overqualified, pivoting, or international, address it directly here. 
A clear honest reason is stronger than pretending the mismatch does not exist.
NEVER open with: interest statement, school name, degree, or years of experience.
NEVER open with: "I am excited / pleased / eager / happy to apply."

ELEMENT 2 — MISSION RELEVANCE (closes paragraph 1)
1 to 2 sentences connecting the company's specific strategic direction to the 
candidate's career goals. Use the recent news item or specific company detail 
found in research. Never recite their mission statement back to them. 
Show you understand what they are trying to do and why that matters to you 
professionally.

ELEMENT 3 — PROOF (all of paragraph 2 — this is the core)
Highlight applicable skills, experience, and specific achievements that 
directly match the JD requirements. Rules:
- Every claim must be grounded in the candidate's actual background
- Use real numbers, real scale, real outcomes
- Reference at least 2 specific JD requirements explicitly
- Embed at least 2 JD keywords naturally
- Include at least 1 quantified achievement
- Frame international experience as global complexity, cross-cultural 
  leadership, emerging market operations — never apologize for it
- Never use: "strong communication skills", "proven track record", 
  "passionate about", "results-driven", "detail-oriented", "fast learner", 
  "team player", "go-getter", "synergy", "great fit"

ELEMENT 4 — FIT SUMMARY (opens paragraph 3)
1 to 2 sentences. Direct and confident. No hedging. No "I believe I would be."

ELEMENT 5 — IDENTITY AND CREDENTIALS (paragraph 3)
State MBA, school, class year, and relevant academic grounding here only. 
Never in paragraph 1 or 2. Credentials are supporting evidence, not the lead.

ELEMENT 6 — CLOSING (closes paragraph 3)
One direct sentence restating interest and inviting a conversation. 
Include relocation availability and work authorization if relevant. 
No over-thanking.

════════════════════════════════════════════
FORMAT — match exactly every time
════════════════════════════════════════════

[CANDIDATE FULL NAME in bold]
[Phone] | [Email] | [LinkedIn URL]

[Today's Date — Month DD, YYYY]

[Hiring Manager Name OR "Hiring Manager"]
[Company Name]
[Department if provided]

Position- [Exact Role Title as it appears in JD]
[Req ID if provided]

Dear [Hiring Manager Name OR "Hiring Manager"],

[3 paragraphs — Elements 1 through 6 woven in as above]

Sincerely,

[Candidate Name]

════════════════════════════════════════════
WORD LIMIT
════════════════════════════════════════════
Body only (header and closing not counted): 300 to 380 words per version. 
Never exceed 400. Tighter is stronger.

════════════════════════════════════════════
HARD RULES — never break
════════════════════════════════════════════
- Never open with interest statement, school, or degree
- Never use "passionate about" anywhere
- Never summarize the company's mission back to them
- Never fabricate achievements, metrics, or skills not in the background
- Never use em dashes, semicolons, or hyphens used as dashes
- Never use generic company facts from their About page
- Must embed at least 2 specific JD keywords naturally
- Must reference at least 1 quantified achievement from candidate background
- International background = asset, never liability
- Salutation: "Dear [Name]," — never "To Whom It May Concern"
- Closing: "Sincerely," — always
- Req ID: include in header if provided
- Hiring manager name: use throughout if provided

════════════════════════════════════════════
OUTPUT — generate exactly 3 versions
════════════════════════════════════════════
All 3 versions follow the same structure and format.
They differ in tone, proof emphasis, and how the hook is framed.

Version A — PROFESSIONAL AND DIRECT
Tone: Formal, precise, confident, zero fluff.
Hook framing: Lead with the operational or analytical problem the role solves.
Proof emphasis: Governance, program management, operational rigor.
Best for: Corporate, finance, consulting, large enterprise roles.

Version B — CONFIDENT AND BOLD
Tone: Results-first, direct, high-performer energy.
Hook framing: Lead with a metric or outcome that reframes the candidate's 
background immediately.
Proof emphasis: Scale, speed of execution, builder mindset, quantified impact.
Best for: Startups, PM roles, tech companies, high-growth environments.

Version C — WARM AND STRATEGIC
Tone: Human, thoughtful, shows understanding of the organization's challenges.
Hook framing: Lead with the strategic tension or market shift that makes 
this role important right now.
Proof emphasis: Mission alignment, stakeholder impact, cross-cultural 
complexity as a strength.
Best for: Mission-driven organizations, sustainability, nonprofits, 
social impact, international roles.

════════════════════════════════════════════
METADATA — output after the 3 versions
════════════════════════════════════════════
keyword_hits: JD keywords naturally embedded across versions
achievement_used: the primary quantified achievement anchoring paragraph 2
news_item_used: the specific recent detail used in paragraph 3
strongest_version: A, B, or C
strongest_reason: one direct sentence explaining why for this specific JD

════════════════════════════════════════════
RESPOND ONLY IN THIS EXACT JSON — no preamble, no markdown fences:
════════════════════════════════════════════
{
  "company_name": "from JD",
  "role_title": "exact title from JD",
  "hiring_manager": "name if provided, else Hiring Manager",
  "req_id": "if provided, else null",
  "department": "if provided, else null",
  "keyword_hits": ["keyword1", "keyword2"],
  "achievement_used": "The specific achievement used in proof paragraph",
  "news_item_used": "The specific recent detail used in paragraph 3",
  "strongest_version": "A",
  "strongest_reason": "One direct sentence on why this version fits this JD best",
  "versions": {
    "A": {
      "label": "Professional & Direct",
      "best_for": "Corporate, Finance, Consulting",
      "word_count": 340,
      "body": "FULL FORMATTED COVER LETTER including header block, date, recipient block, position line, salutation, all paragraphs, and closing. Use \\n for line breaks."
    },
    "B": {
      "label": "Confident & Bold",
      "best_for": "Startups, PM Roles, Tech",
      "word_count": 320,
      "body": "FULL FORMATTED COVER LETTER"
    },
    "C": {
      "label": "Warm & Strategic",
      "best_for": "Mission-Driven, Sustainability, Nonprofits",
      "word_count": 355,
      "body": "FULL FORMATTED COVER LETTER"
    }
  }
}`;

// ─────────────────────────────────────────────────────────────────
// API CALL
// ─────────────────────────────────────────────────────────────────
async function callClaude(inputs) {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "YOUR_API_KEY_HERE") {
    throw new Error("API_KEY_MISSING");
  }

  const { jd, background, hiringManager, companyDept, reqId, companyDetail, tone, candidateName, candidatePhone, candidateEmail, candidateLinkedIn } = inputs;

  const extras = [];
  if (hiringManager) extras.push(`HIRING MANAGER NAME: ${hiringManager}`);
  if (companyDept) extras.push(`DEPARTMENT: ${companyDept}`);
  if (reqId) extras.push(`REQ ID: ${reqId}`);
  if (companyDetail) extras.push(`SPECIFIC COMPANY DETAIL TO USE IN STEP 3: ${companyDetail}`);
  if (tone) extras.push(`PREFERRED TONE: ${tone}`);
  if (candidateName) extras.push(`CANDIDATE NAME: ${candidateName}`);
  if (candidatePhone) extras.push(`CANDIDATE PHONE: ${candidatePhone}`);
  if (candidateEmail) extras.push(`CANDIDATE EMAIL: ${candidateEmail}`);
  if (candidateLinkedIn) extras.push(`CANDIDATE LINKEDIN: ${candidateLinkedIn}`);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" });

  const userMessage = `TODAY'S DATE: ${today}

JOB DESCRIPTION:
${jd}

${"─".repeat(40)}

CANDIDATE BACKGROUND / RESUME:
${background}

${"─".repeat(40)}

ADDITIONAL DETAILS:
${extras.join("\n")}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || "API error");
  }

  const data = await response.json();
  const text = data.content.map(b => b.text || "").join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────
function Pill({ word, variant = "default" }) {
  const v = {
    default: { bg: "#dde0f0", color: "#444668", border: "#cdd0e8" },
    green:   { bg: "#00b87208", color: "#00b872", border: "#00b87235" },
    violet:  { bg: "#7c3aed08", color: "#7c3aed", border: "#7c3aed35" },
    amber:   { bg: "#d9770608", color: "#fbbf24", border: "#d9770635" },
    blue:    { bg: "#2563eb08", color: "#2563eb", border: "#2563eb35" },
    indigo:  { bg: "#4f46e508", color: "#4f46e5", border: "#4f46e535" },
    rose:    { bg: "#e1184908", color: "#fb7185", border: "#e1184935" },
  }[variant] || { bg: "#dde0f0", color: "#444668", border: "#cdd0e8" };
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 20, fontSize: 11,
      background: v.bg, color: v.color, border: `1px solid ${v.border}`,
      fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap", display: "inline-block"
    }}>{word}</span>
  );
}

function Label({ children, hint }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: "#555878", letterSpacing: 1.8, textTransform: "uppercase" }}>{children}</label>
      {hint && <span style={{ fontSize: 10, color: "#888aaa" }}>{hint}</span>}
    </div>
  );
}

function TextArea({ value, onChange, placeholder, rows = 6 }) {
  return (
    <textarea
      value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      style={{
        width: "100%", background: "#f4f5fd",
        border: "1px solid #dde0f0", borderRadius: 10,
        padding: "12px 14px", color: "#111328",
        fontSize: 12.5, lineHeight: 1.7, fontFamily: "inherit",
        transition: "border-color 0.2s, box-shadow 0.2s"
      }}
    />
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", background: "#f4f5fd",
        border: "1px solid #dde0f0", borderRadius: 10,
        padding: "10px 14px", color: "#111328",
        fontSize: 12.5, fontFamily: "inherit",
        transition: "border-color 0.2s, box-shadow 0.2s"
      }}
    />
  );
}

// Step badge for the 6-step structure display
function StepBadge({ num, title, desc }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
        background: "#6366f110", border: "1px solid #6366f130",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800, color: "#4f46e5",
        fontFamily: "'JetBrains Mono', monospace"
      }}>{num}</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#2d3058", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, color: "#555878", lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function CoverLetterAgent() {
  // Core inputs
  const [jd, setJd] = useState("");
  const [background, setBackground] = useState("");
  // Candidate header info
  const [candidateName, setCandidateName] = useState("Sunny Bhargava");
  const [candidatePhone, setCandidatePhone] = useState("+1 (551)-998-5759");
  const [candidateEmail, setCandidateEmail] = useState("sb299@fordham.edu");
  const [candidateLinkedIn, setCandidateLinkedIn] = useState("linkedin.com/in/bhargavasunny");
  // Job details
  const [hiringManager, setHiringManager] = useState("");
  const [companyDept, setCompanyDept] = useState("");
  const [reqId, setReqId] = useState("");
  const [companyDetail, setCompanyDetail] = useState("");
  // Tone
  const [tone, setTone] = useState("Professional & Direct");
  // UI state
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeVersion, setActiveVersion] = useState("A");
  const [copied, setCopied] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [showCandidate, setShowCandidate] = useState(false);
  const resultRef = useRef(null);

  async function handleGenerate() {
    if (!jd.trim() || !background.trim()) {
      setError("Job description and your background are both required.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const data = await callClaude({
        jd, background, hiringManager, companyDept, reqId,
        companyDetail, tone, candidateName, candidatePhone,
        candidateEmail, candidateLinkedIn
      });
      setResult(data);
      setActiveVersion(data.strongest_version || "A");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      if (e.message === "API_KEY_MISSING") {
        setError("API key missing — paste your key into ANTHROPIC_API_KEY at the top of CoverLetterAgent.jsx");
      } else {
        setError(`Error: ${e.message}`);
      }
    }
    setLoading(false);
  }

  function copyVersion(v) {
    const vData = result?.versions?.[v];
    if (!vData) return;
    navigator.clipboard.writeText(vData.body);
    setCopied(v);
    setTimeout(() => setCopied(""), 2500);
  }

  const TONES = ["Professional & Direct", "Confident & Bold", "Warm & Strategic"];
  const VERSION_META = {
    A: { color: "#2563eb", bg: "#2563eb0a", border: "#2563eb40" },
    B: { color: "#7c3aed", bg: "#7c3aed0a", border: "#7c3aed40" },
    C: { color: "#34d399", bg: "#0597540a", border: "#05975440" },
  };

  const activeData = result?.versions?.[activeVersion];
  

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9ff", fontFamily: "'Bricolage Grotesque', 'Sora', sans-serif", color: "#111328", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea, input { font-family: inherit; resize: vertical; }
        input { resize: none; }
        textarea:focus, input:focus { outline: none !important; border-color: #6366f1 !important; box-shadow: 0 0 0 3px #6366f110 !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #f4f5fd; }
        ::-webkit-scrollbar-thumb { background: #cdd0e8; border-radius: 2px; }
        .gen-btn { transition: all 0.2s; cursor: pointer; border: none; font-family: inherit; }
        .gen-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 8px 32px #6366f130 !important; }
        .gen-btn:disabled { opacity: 0.38; cursor: not-allowed; }
        .tone-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; }
        .tone-btn:hover { border-color: #6366f1 !important; }
        .ver-tab { transition: all 0.15s; cursor: pointer; font-family: inherit; border: none; background: transparent; }
        .act-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; }
        .act-btn:hover { border-color: #6366f1 !important; color: #4f46e5 !important; }
        .tog-btn { transition: color 0.15s; cursor: pointer; font-family: inherit; background: none; border: none; }
        .tog-btn:hover { color: #4f46e5 !important; }
        pre { white-space: pre-wrap; word-break: break-word; }
        .step-row { border-bottom: 1px solid #e8eaf4; padding-bottom: 10px; margin-bottom: 10px; }
        .step-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ borderBottom: "1px solid #dde0f0", padding: "26px 40px 22px", background: "linear-gradient(180deg, #eef0fa 0%, #f8f9ff 100%)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, boxShadow: "0 4px 24px #6366f120"
            }}>✉️</div>
            <div>
              <div style={{ fontSize: 10, color: "#6366f1", letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                Agent 03 · Job Search Suite
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: "#111328", lineHeight: 1 }}>
                Cover Letter Generator <span style={{ fontSize: 11, fontWeight: 400, color: "#888aaa", letterSpacing: 0 }}>v2.0</span>
              </h1>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 11, color: "#888aaa", lineHeight: 1.9 }}>
              6-step cheat sheet structure · 3 tone versions<br />
              MongoDB-style format · No templates · No clichés
            </div>
          </div>

          {/* 6-step structure preview */}
          <div style={{
            background: "#ffffff", border: "1px solid #dde0f0",
            borderRadius: 10, padding: "14px 18px"
          }}>
            <div style={{ fontSize: 10, color: "#555878", fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 12 }}>
              6-Step Structure Applied to Every Version
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 24px" }}>
              {[
                { num: 1, title: "Interest", desc: "Role + company, 1 sentence" },
                { num: 2, title: "Identity", desc: "MBA Candidate, Fordham, years of experience" },
                { num: 3, title: "Mission Relevance", desc: "Company direction → your career goal, 1–2 sentences" },
                { num: 4, title: "Proof", desc: "Specific achievements matching JD requirements" },
                { num: 5, title: "Fit Summary", desc: "Direct confident statement, 1–2 sentences" },
                { num: 6, title: "Closing", desc: "Restate interest, thank them, clean close" },
              ].map(s => (
                <div key={s.num} className="step-row">
                  <StepBadge {...s} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 40px 0" }}>

        {/* ── CANDIDATE HEADER INFO ── */}
        <div style={{ marginBottom: 18 }}>
          <button className="tog-btn" onClick={() => setShowCandidate(!showCandidate)}
            style={{ fontSize: 12, color: "#555878", fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ display: "inline-block", transition: "transform 0.2s", transform: showCandidate ? "rotate(90deg)" : "none", fontSize: 9 }}>▶</span>
            {showCandidate ? "Hide" : "Edit"} your header info (name, phone, email, LinkedIn — pre-filled with your details)
          </button>

          {showCandidate && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
              {[
                { label: "Full Name", val: candidateName, set: setCandidateName, placeholder: "Sunny Bhargava" },
                { label: "Phone", val: candidatePhone, set: setCandidatePhone, placeholder: "+1 (551)-998-5759" },
                { label: "Email", val: candidateEmail, set: setCandidateEmail, placeholder: "sb299@fordham.edu" },
                { label: "LinkedIn URL", val: candidateLinkedIn, set: setCandidateLinkedIn, placeholder: "linkedin.com/in/..." },
              ].map(({ label, val, set, placeholder }) => (
                <div key={label}>
                  <Label>{label}</Label>
                  <TextInput value={val} onChange={set} placeholder={placeholder} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── TONE SELECTOR ── */}
        <div style={{ marginBottom: 20 }}>
          <Label hint="All 3 versions generated — this sets your priority">Preferred Tone</Label>
          <div style={{ display: "flex", gap: 8 }}>
            {TONES.map(t => (
              <button key={t} className="tone-btn" onClick={() => setTone(t)} style={{
                padding: "9px 18px", borderRadius: 8,
                border: `1px solid ${tone === t ? "#6366f1" : "#dde0f0"}`,
                background: tone === t ? "#6366f110" : "transparent",
                color: tone === t ? "#4f46e5" : "#555878",
                fontSize: 12.5, fontWeight: 600
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* ── MAIN INPUTS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 14 }}>
          <div>
            <Label hint="Full JD preferred">Job Description</Label>
            <TextArea value={jd} onChange={setJd} rows={14}
              placeholder="Paste the full job description — company, role title, responsibilities, required skills, preferred qualifications, tools..." />
          </div>
          <div>
            <Label hint="Include real numbers">Your Background / Resume</Label>
            <TextArea value={background} onChange={setBackground} rows={14}
              placeholder={"Paste your resume or write key background points:\n• Role titles, companies, dates\n• Specific achievements with numbers\n• Skills and tools\n• MBA context — Fordham, Class of 2027\n• Anything you want the proof paragraph to draw from..."} />
          </div>
        </div>

        {/* ── JOB DETAILS (Optional) ── */}
        <div style={{ marginBottom: 16 }}>
          <button className="tog-btn" onClick={() => setShowDetails(!showDetails)}
            style={{ fontSize: 12, color: "#555878", fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ display: "inline-block", transition: "transform 0.2s", transform: showDetails ? "rotate(90deg)" : "none", fontSize: 9 }}>▶</span>
            {showDetails ? "Hide" : "Add"} job details — hiring manager, department, Req ID, company-specific detail
          </button>

          {showDetails && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
              {[
                { label: "Hiring Manager Name", val: hiringManager, set: setHiringManager, placeholder: "e.g. Sarah Chen" },
                { label: "Department", val: companyDept, set: setCompanyDept, placeholder: "e.g. Technical Services PMO" },
                { label: "Req ID", val: reqId, set: setReqId, placeholder: "e.g. 3263273688" },
                { label: "Company Detail for Step 3", val: companyDetail, set: setCompanyDetail, placeholder: "e.g. Their AI-native expansion into Fortune 100" },
              ].map(({ label, val, set, placeholder }) => (
                <div key={label}>
                  <Label>{label}</Label>
                  <TextInput value={val} onChange={set} placeholder={placeholder} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div style={{ background: "#e1184908", border: "1px solid #e1184930", borderRadius: 10, padding: "12px 16px", marginBottom: 14, color: "#fb7185", fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── GENERATE BUTTON ── */}
        <button className="gen-btn" onClick={handleGenerate} disabled={loading} style={{
          width: "100%", padding: "16px 0", borderRadius: 12,
          background: loading ? "#e8eaf6" : "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
          color: loading ? "#555878" : "#ffffff",
          fontSize: 14, fontWeight: 700, letterSpacing: 0.4,
          boxShadow: loading ? "none" : "0 4px 24px #6366f120"
        }}>
          {loading ? "✍️  Writing 3 versions using 6-step structure — 15–20 seconds..." : "✉️  Generate 3 Cover Letter Versions"}
        </button>

        {/* ── RESULTS ── */}
        {result && (
          <div ref={resultRef} style={{ marginTop: 44 }}>

            {/* Meta row */}
            <div style={{
              background: "#ffffff", border: "1px solid #dde0f0",
              borderRadius: 12, padding: "16px 22px", marginBottom: 20,
              display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center"
            }}>
              <div>
                <div style={{ fontSize: 9, color: "#555878", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 5 }}>Role</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111328" }}>{result.role_title}</div>
              </div>
              <div style={{ width: 1, height: 32, background: "#dde0f0" }} />
              <div>
                <div style={{ fontSize: 9, color: "#555878", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 5 }}>Company</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111328" }}>{result.company_name}</div>
              </div>
              {result.req_id && <>
                <div style={{ width: 1, height: 32, background: "#dde0f0" }} />
                <div>
                  <div style={{ fontSize: 9, color: "#555878", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 5 }}>Req ID</div>
                  <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "#4f46e5" }}>{result.req_id}</div>
                </div>
              </>}
              <div style={{ width: 1, height: 32, background: "#dde0f0" }} />
              <div>
                <div style={{ fontSize: 9, color: "#555878", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 6 }}>JD Keywords Embedded</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {result.keyword_hits?.map(k => <Pill key={k} word={k} variant="green" />)}
                </div>
              </div>
              <div style={{ width: 1, height: 32, background: "#dde0f0" }} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 9, color: "#555878", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 5 }}>Proof Achievement Used</div>
                <div style={{ fontSize: 12, color: "#4f46e5", lineHeight: 1.5 }}>{result.achievement_used}</div>
              </div>
              {result.news_item_used && <>
                <div style={{ width: 1, height: 32, background: "#dde0f0" }} />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 9, color: "#555878", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 5 }}>News Item Used</div>
                  <div style={{ fontSize: 12, color: "#059669", lineHeight: 1.5 }}>{result.news_item_used}</div>
                </div>
              </>}
            </div>

            {/* Recommendation */}
            {result.strongest_version && (
              <div style={{
                background: "#6366f108", border: "1px solid #6366f125",
                borderRadius: 10, padding: "12px 18px", marginBottom: 22,
                display: "flex", gap: 10, alignItems: "center"
              }}>
                <span style={{ fontSize: 16 }}>⭐</span>
                <p style={{ fontSize: 12.5, color: "#444668", lineHeight: 1.5 }}>
                  <span style={{ color: "#4f46e5", fontWeight: 700 }}>Version {result.strongest_version} recommended</span>
                  {" "}for this application. {result.strongest_reason}
                </p>
              </div>
            )}

            {/* Version tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #dde0f0", marginBottom: 0 }}>
              {["A", "B", "C"].map(v => {
                const vd = result.versions?.[v];
                const meta = VERSION_META[v];
                if (!vd) return null;
                const isActive = activeVersion === v;
                return (
                  <button key={v} className="ver-tab" onClick={() => setActiveVersion(v)} style={{
                    flex: 1, padding: "14px 10px",
                    background: isActive ? meta.bg : "transparent",
                    borderBottom: `2px solid ${isActive ? meta.color : "transparent"}`,
                    color: isActive ? meta.color : "#555878",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{v}</span>
                      {result.strongest_version === v && (
                        <span style={{ fontSize: 9, background: meta.color, color: "#ffffff", padding: "1px 6px", borderRadius: 10, fontWeight: 800 }}>★</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{vd.label}</div>
                    <div style={{ fontSize: 10, color: "#888aaa" }}>{vd.best_for}</div>
                    <Pill word={`${vd.word_count}w`} variant="default" />
                  </button>
                );
              })}
            </div>

            {/* Letter display */}
            {activeData && (
              <div>
                {/* Letter body — formatted like a real document */}
                <div style={{
                  background: "#ffffff", border: "1px solid #dde0f0", borderTop: "none",
                  padding: "40px 48px", minHeight: 400
                }}>
                  <pre style={{
                    fontSize: 13.5, color: "#111328", lineHeight: 1.95,
                    fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 400
                  }}>
                    {activeData.body}
                  </pre>
                </div>

                {/* Action bar */}
                <div style={{
                  background: "#ffffff", border: "1px solid #dde0f0", borderTop: "none",
                  borderRadius: "0 0 12px 12px", padding: "13px 18px",
                  display: "flex", gap: 8
                }}>
                  <button className="act-btn" onClick={() => copyVersion(activeVersion)} style={{
                    flex: 1, padding: "10px 0", borderRadius: 8,
                    border: `1px solid ${copied === activeVersion ? "#00b87235" : "#cdd0e8"}`,
                    background: copied === activeVersion ? "#00b87208" : "transparent",
                    color: copied === activeVersion ? "#00b872" : "#444668",
                    fontSize: 12.5, fontWeight: 600
                  }}>
                    {copied === activeVersion ? "✅ Copied to clipboard!" : `📋 Copy Version ${activeVersion} — Ready to paste into Word`}
                  </button>
                  {["A", "B", "C"].filter(v => v !== activeVersion).map(v => result.versions?.[v] && (
                    <button key={v} className="act-btn" onClick={() => copyVersion(v)} style={{
                      padding: "10px 16px", borderRadius: 8,
                      border: "1px solid #cdd0e8", background: "transparent",
                      color: copied === v ? "#00b872" : "#555878",
                      fontSize: 12, fontWeight: 600
                    }}>
                      {copied === v ? "✅" : `Copy ${v}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Rules applied */}
            <div style={{ marginTop: 20, background: "#ffffff", border: "1px solid #dde0f0", borderRadius: 12, padding: "18px 22px" }}>
              <div style={{ fontSize: 10, color: "#555878", fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 14 }}>
                Rules Applied to All 3 Versions
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 28px" }}>
                {[
                  "6-step cheat sheet structure followed",
                  "No 'I am excited / eager / pleased to apply'",
                  "No 'passionate about' anywhere",
                  "No company mission summary recitation",
                  "No fabricated achievements or metrics",
                  "At least 2 JD keywords naturally embedded",
                  "At least 1 quantified achievement in proof",
                  "International background framed as asset",
                  "Max 450 words body — concise and focused",
                  "Proper salutation: Dear [Name] / Dear Hiring Manager",
                  "Proper closing: Sincerely, [Candidate Name]",
                  "Req ID + Department included in header if provided",
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "#6366f1", fontSize: 12, marginTop: 2, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 11.5, color: "#555878", lineHeight: 1.5 }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}