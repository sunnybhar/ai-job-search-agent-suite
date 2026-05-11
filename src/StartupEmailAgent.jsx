import { useState, useRef, useEffect } from "react";

const ANTHROPIC_API_KEY = process.env.REACT_APP_ANTHROPIC_KEY;

// ─────────────────────────────────────────────────────────────────
// CANDIDATE
// ─────────────────────────────────────────────────────────────────
const CANDIDATE = {
  name: "Sunny Bhargava",
  title: "MBA Candidate, Fordham University — Gabelli School of Business, Class of 2027",
  email: "sb299@fordham.edu",
  linkedin: "linkedin.com/in/bhargavasunny",
  mobile: "+1 (551) 998-5759",
  calendly: "https://calendly.com/sunnybhargava1611/30min",
};

const RESUME = `Sunny Bhargava | PM + Ops | Fordham MBA 2027 | Dean's Scholar | IIT-ISM B.Tech Mechanical Engineering
Key achievements:
- Scaled EV subscription platform 55x (200 to 11,000 users), 12% revenue growth, 6x user base in 9 months (Livguard PM)
- Automated KYC/doc verification: 90% fewer errors, 60% fraud reduction
- Reduced MTTR 66%, service resolution 24% via SLA-driven ticketing
- Launched dealer-management CRM supporting $3M in EV product transactions
- Cut feature backlog 60%, accelerating critical module delivery
- Onboarded 7,000 customers across 35+ cities, 70-person team (Livguard Ops)
- Cut payment defaults 20%, grew revenue 15% via full KYC prioritization
- Reduced machine breakdowns 20%, cut operating costs 8% via ConSite telematics (Tata Hitachi)
- Reduced stock 40% in 15 months, lead time 50%, 90%+ fill rate maintained
- Fleet availability 95%+ across 6 excavators, 30% inventory cost reduction (Gainwell)
- Built AI-powered PM toolkit: 10 agents, React + Anthropic API, live on portfolio
Skills: SQL, Python, Power BI, Figma, Jira, PRDs, Roadmaps, A/B Testing, Agile/Scrum`;

// ─────────────────────────────────────────────────────────────────
// DOMAIN CONSEQUENCE MAP
// ─────────────────────────────────────────────────────────────────
const DOMAIN_CONSEQUENCE = `
Map the startup's domain to the appropriate "consequence of failure" line for the Mechanical Engineer sentence:
- AEC / Construction tech / Engineering software: "a missed spec or a failed coordination check has real consequences downstream"
- Fintech / Payments / Credit: "a wrong process or a failed control check has real financial consequences downstream"
- Healthcare / Safety / Medical: "a missed signal or a failed protocol has real consequences for the people depending on it"
- Logistics / Supply chain / Fleet / Ops tech: "a wrong route or a failed handoff has real consequences for the people on the ground"
- Consumer marketplace / Two-sided platform: "a broken flow or a failed trust signal has real consequences for retention"
- SaaS / Enterprise software: "a missed requirement or a failed workflow has real consequences for the teams depending on it"
- Climate / Energy / Infrastructure: "a wrong calculation or a failed system check has real consequences at scale"
- If domain is fashion, lifestyle, beauty, or pure consumer brand with zero operational angle: SKIP the Mechanical Engineer line entirely and open Para 1 with the founder quote directly.`;

// ─────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — FOUNDER SUMMARY
// ─────────────────────────────────────────────────────────────────
const PROMPT_FOUNDER_SUMMARY = `You are extracting founder intelligence from a LinkedIn profile PDF and web context.

Extract and return a structured summary of the founder. Focus on:
1. Their background and career journey
2. Why they started this company — in their own words if available
3. Specific quotes, phrases, or insights they have expressed about the problem they are solving
4. Their operational or technical background that is relevant to the startup
5. Any recent activity, posts, or interviews that reveal their thinking

Be specific. Pull exact phrases or quotes where possible. This will be used to write a personalized cold email opening.

RESPOND IN RAW JSON — no preamble, no markdown:
{
  "founder_name": "full name",
  "current_role": "title at company",
  "background_summary": "2-3 sentences on their journey",
  "why_they_built_this": "what drove them to start this — their words if available",
  "key_quote": "a specific quote or phrase they used, or null if none found",
  "relevant_experience": "specific past experience most relevant to their startup",
  "talking_points": ["point 1", "point 2", "point 3"],
  "context_quality": "rich | moderate | thin",
  "context_note": "one sentence on what was found and what was missing"
}`;

// ─────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — FULL GENERATION
// ─────────────────────────────────────────────────────────────────
const buildGenerationPrompt = () => `You are writing a cold email and portfolio sections for an MBA candidate reaching out to a startup founder for an internship. You think like a founder who reads email in 10 seconds and archives anything that looks templated.

CANDIDATE:
${RESUME}

${DOMAIN_CONSEQUENCE}

════════════════════════════════════════════
EMAIL RULES — non-negotiable
════════════════════════════════════════════
- Maximum 5 sentences in the body. Hard limit.
- Maximum 120 words total body. Hard limit.
- Sentence 1: One specific observation about their business that shows you studied the product — ideally drawn from the founder's own words or a specific product decision. The founder should feel understood, not pitched.
- Sentence 2: One sentence connecting your specific experience to their specific problem. Include one number from the resume.
- Sentence 3: One concrete action you will take in the first 30 days. Specific to their business, not generic.
- Sentence 4: Direct ask. "Are you open to 20 minutes the week of [specific week]?" No "I would love to" or "I hope".
- Sentence 5: "Resume and portfolio attached." Only if word count allows.
- No pain point headers. No Problem/Solution/Fit structure. No bullet points. Plain prose.
- Never use: "excited", "passionate about", "quick learner", "team player", "great fit", "I wanted to reach out"
- Sign off: Best,\\n[Name]\\n[Title]\\n[Email]\\n[LinkedIn]\\n[Mobile]\\n[Calendly]

SUBJECT LINE RULES:
- First choice: something specific from the founder's background or journey that shows you know them
- Fallback: one sharp observation about their business problem
- Format: [Observation or insight] — Sunny Bhargava
- Never generic: not "Internship Application" not "MBA Candidate Interested"

════════════════════════════════════════════
PORTFOLIO — WHY I WANT TO BUILD
════════════════════════════════════════════
Two paragraphs. Follow this structure exactly.

PARA 1 (3 to 4 lines max):
- Open with something the founder said, wrote, built, or a specific problem they described in their own words. Use their key quote if available. The founder should recognize their own thinking in line one.
- Then: "I am a Mechanical Engineer turned Product Manager, and the thread connecting every role I have held is this: I work in industries where [insert domain-appropriate consequence of failure from the map above]."
- SKIP the Mechanical Engineer line ONLY if the startup is in fashion, lifestyle, beauty, or pure consumer brand with no operational angle.
- Close with: "That background is not incidental to what [Startup] is building — it is the exact context in which your product creates value." (adapt naturally)

PARA 2 (2 to 3 lines max):
- What you will do here. Direct. No hedging. No "I hope to learn".
- End with one line that sounds like a builder not an applicant.
- Example closing line: "I am not coming to manage a task list. I am coming to find the constraint that is killing your next [launch/deal/deployment] and fix it."

════════════════════════════════════════════
PORTFOLIO — 90-DAY EXECUTION STRATEGY
════════════════════════════════════════════
Three milestones. Follow this exact format. Short sentences. No fluff.

Day 30 | [Short punchy title]: [What you will learn or map. Shadow calls, identify the real constraint, align on one metric. 2 sentences max.]
Day 60 | [Short punchy title]: [What you will build or test. Run experiments, kill what does not work, double down on what does. 2 sentences max.]
Day 90 | [Short punchy title]: [Make it repeatable. Document everything so it survives after you leave. 2 sentences max.]

════════════════════════════════════════════
RESPOND IN RAW JSON ONLY — no preamble, no markdown fences:
════════════════════════════════════════════
{
  "startup_name": "name",
  "founder_first_name": "first name only",
  "startup_summary": "one sentence — what they do and their stage",
  "subject_line": "subject line",
  "subject_line_source": "founder_background or startup_problem",
  "insight_used": "the specific insight anchoring sentence 1",
  "resume_anchor": "the specific metric from resume used in sentence 2",
  "email_body": "full 5-sentence email body ending with:\\n\\nBest,\\nSunny Bhargava\\nMBA Candidate, Fordham Gabelli, Class of 2027\\nsb299@fordham.edu\\nlinkedin.com/in/bhargavasunny\\n+1 (551) 998-5759\\nhttps://calendly.com/sunnybhargava1611/30min",
  "word_count": 95,
  "portfolio": {
    "why_i_want_to_build": "Para 1 text\\n\\nPara 2 text",
    "execution_strategy": [
      { "day": "Day 30", "title": "short title", "description": "2 sentences max" },
      { "day": "Day 60", "title": "short title", "description": "2 sentences max" },
      { "day": "Day 90", "title": "short title", "description": "2 sentences max" }
    ]
  },
  "confidence_score": 82,
  "confidence_note": "one honest sentence on fit strength"
}`;

// ─────────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────────
function safeParseJSON(raw) {
  if (!raw) throw new Error("Empty response");
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`No JSON found: "${text.slice(0, 100)}"`);
  const slice = text.slice(start, end + 1);
  try { return JSON.parse(slice); }
  catch {
    const s = slice.replace(/"((?:[^"\\]|\\.)*)"/gs,
      m => m.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t"));
    return JSON.parse(s);
  }
}

async function apiCallJSON(systemPrompt, userMessage) {
  if (!ANTHROPIC_API_KEY) throw new Error("API_KEY_MISSING");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: "{" }
      ]
    })
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || `API error ${res.status}`); }
  const data = await res.json();
  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
  return safeParseJSON("{" + text);
}

async function fetchUrlContent(url) {
  if (!ANTHROPIC_API_KEY) throw new Error("API_KEY_MISSING");
  const isLinkedIn = url.includes("linkedin.com");
  if (!isLinkedIn) {
    try {
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxy);
      if (!res.ok) throw new Error("proxy failed");
      const data = await res.json();
      if (!data.contents || data.contents.length < 100) throw new Error("too short");
      const clean = data.contents
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return clean.split(" ").slice(0, 700).join(" ");
    } catch { /* fall through */ }
  }
  let q = url;
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    q = isLinkedIn
      ? url.includes("/company/") ? `${url.split("/company/")[1]?.replace(/\//g, "")} startup company` : `${url.split("/in/")[1]?.replace(/\//g, "")} founder`
      : `${domain} startup product`;
  } catch { q = url; }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 800,
      system: "Search and return a concise factual summary: what the company does, product, business model, customers, recent news. Plain text only.",
      messages: [{ role: "user", content: `Search: ${q}\nURL: ${url}` }],
      tools: [{ type: "web_search_20250305", name: "web_search" }]
    })
  });
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return data.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
}

// Extract text from PDF file
async function extractPDFText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result.split(",")[1];
        if (!ANTHROPIC_API_KEY) throw new Error("API_KEY_MISSING");
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514", max_tokens: 2000,
            messages: [{
              role: "user",
              content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
                { type: "text", text: "Extract all text content from this LinkedIn profile PDF. Return everything — name, headline, about section, experience, education, any posts or activity visible. Plain text only, preserve structure." }
              ]
            }]
          })
        });
        if (!res.ok) throw new Error("PDF extraction failed");
        const data = await res.json();
        resolve(data.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim());
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────────────────────────
// HISTORY HELPERS
// ─────────────────────────────────────────────────────────────────
const HISTORY_KEY = "startup_email_history";
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveToHistory(entry) {
  try {
    const history = loadHistory();
    history.unshift({ ...entry, id: Date.now(), date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  } catch {}
}
function deleteFromHistory(id) {
  try {
    const history = loadHistory().filter(h => h.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

// ─────────────────────────────────────────────────────────────────
// PDF EXPORT
// ─────────────────────────────────────────────────────────────────
function exportToPDF(result, founderSummary, startupContext) {
  const content = `
    <html>
    <head>
      <title>${result.startup_name} — Cold Email</title>
      <style>
        body { font-family: Georgia, serif; max-width: 750px; margin: 40px auto; color: #1a1c2e; line-height: 1.7; }
        h1 { font-size: 22px; color: #111; margin-bottom: 4px; }
        h2 { font-size: 16px; color: #2563eb; margin-top: 32px; margin-bottom: 8px; border-bottom: 1px solid #e8eaf4; padding-bottom: 6px; }
        h3 { font-size: 14px; color: #374151; margin-top: 20px; margin-bottom: 4px; }
        p { font-size: 13px; color: #374151; margin: 0 0 12px; }
        .meta { font-size: 12px; color: #6b7280; margin-bottom: 28px; }
        .subject { background: #f0f4ff; border-left: 3px solid #2563eb; padding: 10px 14px; font-size: 13px; font-weight: bold; margin-bottom: 16px; }
        .email-body { background: #fafafa; border: 1px solid #e8eaf4; padding: 24px; font-size: 13px; white-space: pre-wrap; }
        .section { margin-top: 32px; }
        .milestone { background: #f8f9ff; border: 1px solid #e8eaf4; border-left: 3px solid #2563eb; padding: 12px 16px; margin-bottom: 10px; }
        .milestone-day { font-size: 11px; font-weight: bold; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; }
        .milestone-title { font-size: 13px; font-weight: bold; color: #111; margin: 3px 0; }
        .context-box { background: #f8f9ff; border: 1px solid #e8eaf4; padding: 14px 16px; font-size: 12px; color: #4b5563; }
        .divider { border: none; border-top: 1px solid #e8eaf4; margin: 28px 0; }
        .pill { display: inline-block; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 20px; padding: 2px 10px; font-size: 11px; margin-right: 6px; }
      </style>
    </head>
    <body>
      <h1>Startup Cold Email — ${result.startup_name}</h1>
      <p class="meta">Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · Founder: ${result.founder_first_name} · Fit Score: ${result.confidence_score}%</p>

      <h2>📧 Cold Email</h2>
      <div class="subject">Subject: ${result.subject_line}</div>
      <div class="email-body">${result.email_body}</div>

      <div class="section">
        <h2>📁 Portfolio — Why I Want to Build at ${result.startup_name}</h2>
        <p style="white-space: pre-wrap;">${result.portfolio?.why_i_want_to_build}</p>
      </div>

      <div class="section">
        <h2>📁 Portfolio — 90-Day Execution Strategy</h2>
        ${result.portfolio?.execution_strategy?.map((s, i) => `
          <div class="milestone">
            <div class="milestone-day">${s.day}</div>
            <div class="milestone-title">${s.title}</div>
            <p>${s.description}</p>
          </div>
        `).join("")}
      </div>

      <hr class="divider"/>

      ${founderSummary ? `
        <div class="section">
          <h2>👤 Founder Intelligence — ${founderSummary.founder_name}</h2>
          <p><strong>Role:</strong> ${founderSummary.current_role}</p>
          <p><strong>Background:</strong> ${founderSummary.background_summary}</p>
          <p><strong>Why They Built This:</strong> ${founderSummary.why_they_built_this}</p>
          ${founderSummary.key_quote ? `<p><strong>Key Quote:</strong> "${founderSummary.key_quote}"</p>` : ""}
          <p><strong>Relevant Experience:</strong> ${founderSummary.relevant_experience}</p>
          <p><strong>Talking Points:</strong> ${founderSummary.talking_points?.join(" · ")}</p>
        </div>
      ` : ""}

      ${startupContext ? `
        <div class="section">
          <h2>🏢 Startup Context Used</h2>
          <div class="context-box">${startupContext.replace(/\n/g, "<br/>")}</div>
        </div>
      ` : ""}
    </body>
    </html>
  `;
  const win = window.open("", "_blank");
  win.document.write(content);
  win.document.close();
  win.print();
}

// ─────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────
function Pill({ word, variant = "default" }) {
  const v = {
    default: { bg: "#f0f1fa", color: "#666a8a", border: "#dde0f0" },
    green:   { bg: "#f0fdf4", color: "#059669", border: "#bbf7d0" },
    blue:    { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
    rose:    { bg: "#fff1f2", color: "#e11d48", border: "#fecdd3" },
    amber:   { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
    violet:  { bg: "#faf5ff", color: "#7c3aed", border: "#ddd6fe" },
  }[variant] || { bg: "#f0f1fa", color: "#666a8a", border: "#dde0f0" };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, background: v.bg, color: v.color, border: `1px solid ${v.border}`, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", display: "inline-block" }}>{word}</span>
  );
}

function Card({ children, accent, style = {} }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 6px #00000006", borderLeft: accent ? `3px solid ${accent}` : undefined, ...style }}>
      {children}
    </div>
  );
}

function CopyBtn({ text, id, copied, onCopy, label = "📋 Copy" }) {
  return (
    <button onClick={() => onCopy(text, id)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${copied === id ? "#bbf7d0" : "#e8eaf4"}`, background: copied === id ? "#f0fdf4" : "transparent", color: copied === id ? "#059669" : "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
      {copied === id ? "✅ Copied!" : label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function StartupEmailAgent() {
  const [founderName, setFounderName]         = useState("");
  const [startupName, setStartupName]         = useState("");
  const [urlInputs, setUrlInputs]             = useState(["", "", ""]);
  const [fetchStatuses, setFetchStatuses]     = useState(["idle", "idle", "idle"]);
  const [fetchedContents, setFetchedContents] = useState(["", "", ""]);
  const [manualContext, setManualContext]     = useState("");
  const [pdfFile, setPdfFile]                 = useState(null);
  const [pdfText, setPdfText]                 = useState("");
  const [pdfLoading, setPdfLoading]           = useState(false);
  const [founderSummary, setFounderSummary]   = useState(null);
  const [summaryConfirmed, setSummaryConfirmed] = useState(false);
  const [activeTab, setActiveTab]             = useState("email");
  const [result, setResult]                   = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [progressMsg, setProgressMsg]         = useState("");
  const [error, setError]                     = useState("");
  const [copied, setCopied]                   = useState("");
  const [history, setHistory]                 = useState(loadHistory);
  const [showHistory, setShowHistory]         = useState(false);
  const historyRef = useRef(null);
  const resultRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (historyRef.current && !historyRef.current.contains(e.target)) setShowHistory(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function copyText(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(""), 2500);
  }

  function updateUrl(i, val) {
    const u = [...urlInputs]; u[i] = val; setUrlInputs(u);
  }

  async function handleFetchUrl(i) {
    const url = urlInputs[i];
    if (!url.trim()) return;
    const st = [...fetchStatuses]; st[i] = "loading"; setFetchStatuses([...st]);
    try {
      const content = await fetchUrlContent(url);
      const fc = [...fetchedContents]; fc[i] = content; setFetchedContents([...fc]);
      st[i] = "success"; setFetchStatuses([...st]);
    } catch {
      st[i] = "error"; setFetchStatuses([...st]);
    }
  }

  async function handlePDFUpload(file) {
    if (!file) return;
    setPdfFile(file);
    setPdfLoading(true);
    setFounderSummary(null);
    setSummaryConfirmed(false);
    try {
      const text = await extractPDFText(file);
      setPdfText(text);
      // Generate founder summary
      const summary = await apiCallJSON(
        PROMPT_FOUNDER_SUMMARY,
        `FOUNDER NAME: ${founderName || "Unknown"}\nSTARTUP: ${startupName || "Unknown"}\n\nLINKEDIN PDF CONTENT:\n${text.split(" ").slice(0, 1500).join(" ")}`
      );
      setFounderSummary(summary);
    } catch (e) {
      setError(`PDF processing failed: ${e.message}`);
    }
    setPdfLoading(false);
  }

  async function handleGenerate() {
    if (!founderName.trim() || !startupName.trim()) { setError("Founder name and startup name are required."); return; }
    const hasContext = fetchedContents.some(c => c.trim()) || manualContext.trim() || pdfText;
    if (!hasContext) { setError("Fetch at least one URL, upload a PDF, or paste context."); return; }
    if (founderSummary && !summaryConfirmed) { setError("Please review and confirm the founder summary before generating."); return; }
    setError(""); setLoading(true); setResult(null);

    const trimWords = (t, max) => t.split(" ").slice(0, max).join(" ");
    const contextParts = [
      founderSummary ? `--- FOUNDER INTELLIGENCE ---\nName: ${founderSummary.founder_name}\nRole: ${founderSummary.current_role}\nBackground: ${founderSummary.background_summary}\nWhy built: ${founderSummary.why_they_built_this}\nKey quote: ${founderSummary.key_quote || "none"}\nTalking points: ${founderSummary.talking_points?.join(", ")}` : "",
      ...fetchedContents.filter(c => c.trim()).map((c, i) => `--- STARTUP SOURCE ${i + 1} ---\n${trimWords(c, 700)}`),
      manualContext.trim() ? `--- ADDITIONAL CONTEXT ---\n${trimWords(manualContext, 400)}` : ""
    ].filter(Boolean);
    const allContext = trimWords(contextParts.join("\n\n"), 2000);

    const userMessage = `STARTUP: ${startupName}\nFOUNDER: ${founderName}\nFOUNDER FIRST NAME: ${founderName.split(" ")[0]}\n\nCONTEXT:\n${allContext}`;

    setProgressMsg("Writing email and portfolio sections...");
    try {
      const data = await apiCallJSON(buildGenerationPrompt(), userMessage);
      setResult(data);
      setActiveTab("email");
      // Save to history
      const entry = {
        startupName, founderName,
        subjectLine: data.subject_line,
        result: data,
        founderSummary,
        startupContext: allContext,
      };
      saveToHistory(entry);
      setHistory(loadHistory());
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setError(e.message === "API_KEY_MISSING" ? "API key missing." : `Error: ${e.message}`);
    }
    setProgressMsg(""); setLoading(false);
  }

  function loadHistoryEntry(entry) {
    setFounderName(entry.founderName);
    setStartupName(entry.startupName);
    setResult(entry.result);
    setFounderSummary(entry.founderSummary || null);
    setSummaryConfirmed(true);
    setActiveTab("email");
    setShowHistory(false);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
  }

  function handleDeleteHistory(id, e) {
    e.stopPropagation();
    deleteFromHistory(id);
    setHistory(loadHistory());
  }

  const fetchedCount = fetchedContents.filter(c => c.trim()).length;
  const URL_LABELS = ["Startup Website / About Page", "Product Page or Blog Post", "LinkedIn or Any Other URL"];

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8ff", fontFamily: "'Sora', sans-serif", color: "#1a1c2e", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea, input { font-family: inherit; }
        textarea { resize: vertical; }
        textarea:focus, input:focus { outline: none !important; border-color: #e11d48 !important; box-shadow: 0 0 0 3px #e1184910 !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #f7f8ff; }
        ::-webkit-scrollbar-thumb { background: #dde0f0; border-radius: 2px; }
        .gen-btn { transition: all 0.2s; cursor: pointer; border: none; font-family: inherit; }
        .gen-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px #e1184925 !important; }
        .gen-btn:disabled { opacity: 0.38; cursor: not-allowed; }
        .fetch-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; border: none; }
        .fetch-btn:hover:not(:disabled) { filter: brightness(1.08); }
        .fetch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .tab-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; border: none; background: transparent; }
        .hist-item { transition: background 0.15s; cursor: pointer; }
        .hist-item:hover { background: #f0f4ff !important; }
        pre { white-space: pre-wrap; word-break: break-word; }
        .fade { animation: fadeIn 0.3s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e8eaf4", padding: "20px 40px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: "linear-gradient(135deg, #e11d48, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 20px #e1184920" }}>🚀</div>
            <div>
              <div style={{ fontSize: 10, color: "#e11d48", letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Agent 06 · Job Search Suite</div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: "#111328", lineHeight: 1 }}>
                Startup Cold Email Agent <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>v3.0</span>
              </h1>
            </div>

            {/* History dropdown */}
            <div ref={historyRef} style={{ marginLeft: "auto", position: "relative" }}>
              <button onClick={() => setShowHistory(!showHistory)} style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid #e8eaf4",
                background: showHistory ? "#f0f4ff" : "#ffffff", color: "#374151",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 7
              }}>
                🕐 History
                <span style={{ background: "#e11d48", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>{history.length}</span>
              </button>

              {showHistory && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0, width: 340,
                  background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 12,
                  boxShadow: "0 8px 32px #00000014", zIndex: 100, overflow: "hidden"
                }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #e8eaf4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#111328" }}>Last {history.length} Searches</span>
                    {history.length > 0 && (
                      <button onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); }} style={{ fontSize: 11, color: "#e11d48", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                        Clear all
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 360, overflowY: "auto" }}>
                    {history.length === 0 ? (
                      <div style={{ padding: "20px 16px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>No history yet</div>
                    ) : history.map(entry => (
                      <div key={entry.id} className="hist-item" onClick={() => loadHistoryEntry(entry)}
                        style={{ padding: "12px 16px", borderBottom: "1px solid #f0f1fa", display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#111328", marginBottom: 2 }}>{entry.startupName}</div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{entry.founderName} · {entry.date}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.subjectLine}</div>
                        </div>
                        <button onClick={(e) => handleDeleteHistory(entry.id, e)} style={{ color: "#d1d5db", background: "none", border: "none", cursor: "pointer", fontSize: 14, flexShrink: 0, padding: "2px 4px" }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["5 sentences · 120 words", "Founder-first opening", "PDF upload + URL fetch", "History saved", "PDF export", "60% fewer tokens"].map(r => <Pill key={r} word={r} />)}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 40px 0" }}>

        {/* ── FOUNDER + STARTUP ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
          {[
            { label: "Founder Name", val: founderName, set: setFounderName, ph: "e.g. Alexandra Waldman" },
            { label: "Startup Name", val: startupName, set: setStartupName, ph: "e.g. Pickle" },
          ].map(({ label, val, set, ph }) => (
            <div key={label}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7 }}>
                {label} <span style={{ color: "#e11d48" }}>*</span>
              </label>
              <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
                style={{ width: "100%", background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 10, padding: "11px 14px", color: "#1a1c2e", fontSize: 13, boxShadow: "0 1px 4px #00000005", transition: "border-color 0.2s" }} />
            </div>
          ))}
        </div>

        {/* ── FOUNDER PDF UPLOAD ── */}
        <div style={{ background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 14, padding: "18px 22px", marginBottom: 16, boxShadow: "0 1px 6px #00000006" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111328", marginBottom: 3 }}>Founder LinkedIn PDF</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Export their LinkedIn profile as PDF → upload here → agent extracts and summarizes before generating</div>
            </div>
            {pdfFile && !pdfLoading && (
              <Pill word={`✓ ${pdfFile.name}`} variant="green" />
            )}
          </div>

          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }}
            onChange={e => e.target.files?.[0] && handlePDFUpload(e.target.files[0])} />

          <button onClick={() => fileInputRef.current?.click()} disabled={pdfLoading}
            style={{
              padding: "10px 20px", borderRadius: 9, border: "1px dashed #dde0f0",
              background: pdfFile ? "#f0fdf4" : "#fafbff", color: pdfFile ? "#059669" : "#6b7280",
              fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s"
            }}>
            {pdfLoading ? "⏳ Extracting founder profile..." : pdfFile ? `✅ ${pdfFile.name} — click to replace` : "📄 Upload Founder LinkedIn PDF"}
          </button>

          {/* Founder Summary Card */}
          {founderSummary && !pdfLoading && (
            <div className="fade" style={{ marginTop: 16, background: "#f8f9ff", border: `1px solid ${summaryConfirmed ? "#bbf7d0" : "#bfdbfe"}`, borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111328" }}>
                  Founder Summary — {founderSummary.founder_name}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Pill word={founderSummary.context_quality} variant={founderSummary.context_quality === "rich" ? "green" : founderSummary.context_quality === "moderate" ? "amber" : "rose"} />
                  {!summaryConfirmed ? (
                    <button onClick={() => setSummaryConfirmed(true)} style={{
                      padding: "6px 14px", borderRadius: 7, border: "none",
                      background: "#2563eb", color: "#ffffff", fontSize: 11,
                      fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
                    }}>Confirm & Use This ✓</button>
                  ) : (
                    <Pill word="✓ Confirmed" variant="green" />
                  )}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>Background</div>
                  <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{founderSummary.background_summary}</p>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>Why They Built This</div>
                  <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{founderSummary.why_they_built_this}</p>
                </div>
                {founderSummary.key_quote && (
                  <div style={{ gridColumn: "1 / -1", background: "#eff6ff", borderLeft: "3px solid #2563eb", borderRadius: "0 8px 8px 0", padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, color: "#2563eb", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Key Quote</div>
                    <p style={{ fontSize: 12.5, color: "#1a1c2e", fontStyle: "italic", lineHeight: 1.6 }}>"{founderSummary.key_quote}"</p>
                  </div>
                )}
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Talking Points</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {founderSummary.talking_points?.map((p, i) => <Pill key={i} word={p} variant="blue" />)}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 10 }}>ℹ {founderSummary.context_note}</p>
            </div>
          )}
        </div>

        {/* ── URL INPUTS ── */}
        <div style={{ background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 14, padding: "18px 22px", marginBottom: 16, boxShadow: "0 1px 6px #00000006" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111328", marginBottom: 3 }}>Startup URLs</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Website, product page, blog, LinkedIn company page</div>
            </div>
            {fetchedCount > 0 && <Pill word={`✓ ${fetchedCount} fetched`} variant="green" />}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {URL_LABELS.map((label, i) => (
              <div key={i}>
                <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>
                  {label} {fetchStatuses[i] === "success" && <span style={{ color: "#059669", fontFamily: "'DM Mono', monospace" }}>✓ Ready</span>}
                  {fetchStatuses[i] === "loading" && <span style={{ color: "#2563eb" }}>Fetching...</span>}
                  {fetchStatuses[i] === "error" && <span style={{ color: "#e11d48" }}>Failed</span>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={urlInputs[i]} onChange={e => updateUrl(i, e.target.value)} placeholder="https://..."
                    onKeyDown={e => e.key === "Enter" && handleFetchUrl(i)}
                    style={{ flex: 1, background: "#f8f9fe", border: "1px solid #e8eaf4", borderRadius: 8, padding: "9px 12px", color: "#1a1c2e", fontSize: 12.5, transition: "border-color 0.2s" }} />
                  <button className="fetch-btn" onClick={() => handleFetchUrl(i)}
                    disabled={!urlInputs[i].trim() || fetchStatuses[i] === "loading"}
                    style={{
                      padding: "9px 16px", borderRadius: 8,
                      background: fetchStatuses[i] === "success" ? "#f0fdf4" : fetchStatuses[i] === "error" ? "#fff1f2" : "#e11d48",
                      color: fetchStatuses[i] === "success" ? "#059669" : fetchStatuses[i] === "error" ? "#e11d48" : "#ffffff",
                      fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                      border: `1px solid ${fetchStatuses[i] === "success" ? "#bbf7d0" : fetchStatuses[i] === "error" ? "#fecdd3" : "transparent"}`
                    }}>
                    {fetchStatuses[i] === "loading" ? "⏳" : fetchStatuses[i] === "success" ? "✅" : fetchStatuses[i] === "error" ? "Retry" : urlInputs[i].includes("linkedin") ? "Search" : "Fetch"}
                  </button>
                </div>
                {fetchStatuses[i] === "success" && fetchedContents[i] && (
                  <p style={{ fontSize: 11, color: "#059669", marginTop: 3 }}>✓ {fetchedContents[i].split(" ").length} words loaded</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── MANUAL CONTEXT ── */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7 }}>
            Additional Context
            <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400, marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>paste anything — pitch deck text, news, product notes</span>
          </label>
          <textarea value={manualContext} onChange={e => setManualContext(e.target.value)} rows={3}
            placeholder="Paste anything about the startup or founder — their product, customers, recent news, pitch deck language, how they make money..."
            style={{ width: "100%", background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 10, padding: "11px 14px", color: "#1a1c2e", fontSize: 12.5, lineHeight: 1.7, boxShadow: "0 1px 4px #00000005", transition: "border-color 0.2s" }} />
        </div>

        {error && (
          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "11px 16px", marginBottom: 14, color: "#e11d48", fontSize: 13 }}>⚠️ {error}</div>
        )}

        <button className="gen-btn" onClick={handleGenerate} disabled={loading} style={{
          width: "100%", padding: "15px 0", borderRadius: 12,
          background: loading ? "#e8eaf4" : "linear-gradient(135deg, #e11d48, #7c3aed)",
          color: loading ? "#9ca3af" : "#ffffff", fontSize: 14, fontWeight: 700, letterSpacing: 0.4,
          boxShadow: loading ? "none" : "0 4px 20px #e1184920"
        }}>
          {loading ? `🚀  ${progressMsg || "Generating..."}` : "🚀  Generate Email + Portfolio Sections"}
        </button>

        {/* ── RESULTS ── */}
        {result && (
          <div ref={resultRef} className="fade" style={{ marginTop: 38 }}>

            {/* Summary bar */}
            <div style={{ background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 14, padding: "14px 20px", marginBottom: 18, boxShadow: "0 1px 6px #00000006", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 9, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Startup</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#111328" }}>{result.startup_name}</div>
              </div>
              <div style={{ width: 1, height: 30, background: "#e8eaf4" }} />
              <div>
                <div style={{ fontSize: 9, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>To</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{result.founder_first_name}</div>
              </div>
              <div style={{ width: 1, height: 30, background: "#e8eaf4" }} />
              <div>
                <div style={{ fontSize: 9, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Words</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: result.word_count <= 120 ? "#059669" : "#d97706", fontFamily: "'DM Mono', monospace" }}>
                  {result.word_count}w {result.word_count <= 120 ? "✓" : "⚠"}
                </div>
              </div>
              <div style={{ width: 1, height: 30, background: "#e8eaf4" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Fit</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ height: 5, width: 70, background: "#e8eaf4", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${result.confidence_score}%`, background: result.confidence_score >= 75 ? "#059669" : "#d97706" }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", fontFamily: "'DM Mono', monospace" }}>{result.confidence_score}%</span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{result.confidence_note}</span>
                </div>
              </div>
              {/* Export PDF button */}
              <button onClick={() => exportToPDF(result, founderSummary, fetchedContents.filter(c => c.trim()).join("\n\n"))}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e8eaf4", background: "#f8f9ff", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
                📥 Export PDF
              </button>
            </div>

            {/* Insight + anchor */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 10, color: "#059669", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>Insight Used (Sentence 1)</div>
                <p style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>{result.insight_used}</p>
              </div>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 10, color: "#2563eb", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>Resume Anchor (Sentence 2)</div>
                <p style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>{result.resume_anchor}</p>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #e8eaf4" }}>
              {[{ id: "email", label: "📧 Cold Email" }, { id: "portfolio", label: "📁 Portfolio" }].map(tab => (
                <button key={tab.id} className="tab-btn" onClick={() => setActiveTab(tab.id)} style={{
                  flex: 1, padding: "11px 10px", fontSize: 13, fontWeight: 600,
                  color: activeTab === tab.id ? "#e11d48" : "#9ca3af",
                  borderBottom: `2px solid ${activeTab === tab.id ? "#e11d48" : "transparent"}`,
                  background: activeTab === tab.id ? "#fff1f206" : "transparent"
                }}>{tab.label}</button>
              ))}
            </div>

            {/* EMAIL TAB */}
            {activeTab === "email" && (
              <div>
                <div style={{ background: "#fafbff", border: "1px solid #e8eaf4", borderTop: "none", padding: "11px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", flexShrink: 0 }}>Subject</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111328", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.subject_line}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <Pill word={result.subject_line_source === "founder_background" ? "from founder" : "from startup"} variant={result.subject_line_source === "founder_background" ? "violet" : "blue"} />
                    <CopyBtn text={result.subject_line} id="subject" copied={copied} onCopy={copyText} label="Copy" />
                  </div>
                </div>
                <div style={{ background: "#ffffff", border: "1px solid #e8eaf4", borderTop: "none", padding: "32px 36px" }}>
                  <pre style={{ fontSize: 14, color: "#1a1c2e", lineHeight: 2, fontFamily: "'Sora', sans-serif", fontWeight: 400 }}>{result.email_body}</pre>
                </div>
                <div style={{ background: "#f8f9fe", border: "1px solid #e8eaf4", borderTop: "none", borderRadius: "0 0 14px 14px", padding: "12px 16px", display: "flex", gap: 8 }}>
                  <CopyBtn text={`Subject: ${result.subject_line}\n\n${result.email_body}`} id="full" copied={copied} onCopy={copyText} label="📋 Copy Full Email" />
                  <CopyBtn text={result.email_body} id="body" copied={copied} onCopy={copyText} label="Copy Body" />
                </div>
              </div>
            )}

            {/* PORTFOLIO TAB */}
            {activeTab === "portfolio" && result.portfolio && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 20 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111328" }}>Why I Want to Build at {result.startup_name}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Para 1: 3-4 lines · Para 2: 2-3 lines</div>
                    </div>
                    <CopyBtn text={result.portfolio.why_i_want_to_build} id="why" copied={copied} onCopy={copyText} />
                  </div>
                  <Card accent="#7c3aed">
                    <pre style={{ fontSize: 13.5, color: "#1a1c2e", lineHeight: 1.95, fontFamily: "'Sora', sans-serif", fontWeight: 400 }}>{result.portfolio.why_i_want_to_build}</pre>
                  </Card>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111328" }}>90-Day Execution Strategy</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Short, punchy, action-oriented</div>
                    </div>
                    <CopyBtn text={result.portfolio.execution_strategy?.map((s, i) => `${i + 1}. ${s.day} | ${s.title}: ${s.description}`).join("\n")} id="strategy" copied={copied} onCopy={copyText} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {result.portfolio.execution_strategy?.map((s, i) => (
                      <Card key={i} accent="#2563eb" style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ padding: "3px 10px", borderRadius: 8, flexShrink: 0, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 11, fontWeight: 800, color: "#2563eb", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>{s.day}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#111328", marginBottom: 4 }}>{s.title}</div>
                            <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.65 }}>{s.description}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}