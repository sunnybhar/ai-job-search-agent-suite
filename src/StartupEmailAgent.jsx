import { useState, useRef } from "react";

// ─────────────────────────────────────────────────────────────────
// 🔑 YOUR API KEY
// ─────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.REACT_APP_ANTHROPIC_KEY;

// ─────────────────────────────────────────────────────────────────
// CANDIDATE CONSTANTS — Pre-filled from your actual details
// ─────────────────────────────────────────────────────────────────
const CANDIDATE = {
  name: "Sunny Bhargava",
  title: "MBA Candidate, Fordham University - Gabelli School of Business",
  email: "sb299@fordham.edu",
  linkedin: "linkedin.com/in/bhargavasunny",
  mobile: "+1 (551) 998-5759",
  calendly: "https://calendly.com/sunnybhargava1611/30min",
};

const RESUME_TEXT = `Sunny Bhargava | MBA Candidate, Fordham Gabelli (2027) | Dean's Scholar | IIT-ISM B.Tech Mechanical Engineering

KEY METRICS & ACHIEVEMENTS:
- Scaled subscription platform 200→11,000 users (55x), +12% revenue, +40% activation, +25% onboarding speed (Livguard PM)
- Onboarded 7,000 customers across 35+ cities via city-by-city SOPs (Livguard Ops)
- Cut payment defaults 20%, grew revenue 15% via KYC/fraud controls (Livguard Ops)
- Reduced fleet breakdowns 10%, inventory excess 50% via telematics + forecasting model (Tata Hitachi)
- Sustained 95%+ fleet availability across 6 excavators (Gainwell)
- 40% MoM customer acquisition growth, led 70-person cross-functional team (Livguard Ops)

SKILLS: SQL, Python, Power BI, Tableau, OpenAI API, Jira, Figma | PRDs, Roadmaps, A/B Testing, North Star Metrics, User Flows, Business Cases, Cross-functional Alignment, Data-driven Decision Making

EXPERIENCE TIMELINE: Livguard PM (2023-2025) → Livguard Ops Mgr (2022-2023) → Tata Hitachi Ops Mgr (2019-2022) → OYO Sr Ops Mgr (2018-2019) → Gainwell Project Lead (2015-2018)`;

const PORTFOLIO_TEXT = `WHAT I DO WELL (Portfolio Highlights):
1. Field problems → shippable decisions: Cut 13-feature roadmap to 4 after field validation; shipped UPI payments + complaint handling → fewer support calls, faster collections
2. Growth vs fraud vs ops balance: KYC-first over faster activation → defaults <2%, revenue +15% in 3 months
3. City-by-city scaling: SOPs + hiring plan + routing logic for 70-person team → 7,000 customers across 18 months
4. Telematics feedback loop: Deployed ConSite, identified parts gap → +20% availability, +15% spare-parts sales`;

// ─────────────────────────────────────────────────────────────────
// SYSTEM PROMPTS
// ─────────────────────────────────────────────────────────────────

const PROMPT_PAIN_POINTS = `You are a startup research analyst and cold email strategist. Your job is to analyze a startup and identify 3 genuine pain points that an MBA candidate with operations and product management experience can credibly solve.

CANDIDATE BACKGROUND:
${RESUME_TEXT}

RULES FOR PAIN POINTS:
- Each pain point must be a REAL operational or product problem the startup faces — not generic startup challenges
- Problems must be identifiable from their website, product, blog, or business model
- Solutions must directly reference specific achievements from the candidate's background
- Never fabricate metrics or experiences not in the resume
- The fit must be credible and specific — not "I am a fast learner"
- Format: Problem (2 sentences max) + Solution & Fit (2 sentences max referencing specific candidate experience)

RESPOND IN THIS EXACT JSON — raw JSON only, no preamble, no markdown:
{
  "startup_name": "name",
  "founder_name": "name as provided",
  "startup_summary": "2 sentence summary of what they do and their current stage/challenge",
  "pain_points": [
    {
      "title": "Short punchy title like: Cold-Start Supply Problem in Every New City",
      "problem": "2 sentences describing the real operational/product problem",
      "solution_and_fit": "2 sentences — specific solution approach + exact candidate experience/metric that proves fit",
      "resume_anchor": "The specific bullet or achievement from resume being referenced"
    }
  ],
  "email_subject": "Subject line in this EXACT format: [Pain Point 1 keyword], [Pain Point 2 keyword], [Pain Point 3 keyword] - How I Would Tackle [Startup Name]'s [theme word like: Growth / Operations / Scale / Product] Challenges This Summer. Extract the 2-3 word essence of each pain point as the keywords — short, punchy, specific. Example for a fashion rental startup with supply, trust, and retention pain points: 'Supply Gaps, Trust at Scale, Retention — How I Would Tackle Pickle's Growth Challenges This Summer'. Example for a healthtech startup with data, ops, and onboarding pain points: 'Data Gaps, Ops Friction, Onboarding — How I Would Tackle Clipboard's Scale Challenges This Summer'. Use an em dash (—) not a hyphen. Never use generic words like 'Issues' or 'Problems'. The theme word must match the startup's core challenge.",
  "opening_line": "One personalized opening sentence referencing something specific about the startup — not 'I hope you are doing well' equivalent",
  "confidence_score": 82,
  "confidence_note": "One sentence on how strong the fit is based on available context"
}`;

const PROMPT_EMAIL = `You are a cold email writer specializing in MBA-to-startup founder outreach. You write emails that are direct, specific, and respect the founder's time.

FORMAT TO FOLLOW EXACTLY:
1. Personalized greeting with first name only
2. One personalized opening sentence (specific to their startup — not "I hope you are doing well")
3. One sentence: spent time learning about [startup], came away genuinely excited, saw areas where you could contribute
4. Three pain points — each formatted as:
   Pain Point N: [Title]
   Problem: [2 sentences]
   Solution & Fit: [2 sentences with specific candidate experience]
5. One sentence: resume and portfolio attached
6. One sentence: Calendly link offer for brief coffee chat
7. Fallback scheduling sentence
8. "If there is someone else on the team..." sentence
9. Thank you + close
10. Signature block

RULES:
- First name only in greeting (Hi Alexandra, not Hi Alexandra Smith)
- Never start with "I hope you are doing well" or any wellness opener
- Keep the whole email under 450 words body text
- Pain points must be specific to THIS startup — not generic
- Solution must reference specific metrics from candidate background
- Tone: confident, peer-level, respectful of their time
- Never beg or over-thank
- Signature always ends with full block: Name, Title, Email, LinkedIn, Mobile

CANDIDATE CONSTANTS:
Name: ${CANDIDATE.name}
Title: ${CANDIDATE.title}
Email: ${CANDIDATE.email}
LinkedIn: ${CANDIDATE.linkedin}
Mobile: ${CANDIDATE.mobile}
Calendly: ${CANDIDATE.calendly}

RESPOND WITH THE COMPLETE EMAIL TEXT ONLY — no JSON, no commentary, no markdown. Just the email.`;

const PROMPT_PORTFOLIO = `You are rewriting two specific sections of a professional portfolio document for a startup internship application.

CANDIDATE BACKGROUND:
${RESUME_TEXT}

PORTFOLIO CONTEXT:
${PORTFOLIO_TEXT}

YOU MUST REWRITE EXACTLY TWO SECTIONS:

SECTION 1 — "WHY I WANT TO BUILD AT [STARTUP NAME]"
Rules:
- Replace every reference to the previous startup with this specific startup
- Connect candidate's actual background to this startup's specific problem space
- Must reference something concrete about what the startup builds and why it matters
- Keep the voice — first person, direct, no corporate language
- 3-4 paragraphs, same structure as original
- End with a line about what they will bring — builder mentality, not intern mentality
- Length: ~200-250 words

SECTION 2 — "90-DAY EXECUTION STRATEGY"
Rules:
- Rewrite the 3 milestones (Day 30, Day 60, Day 90) for this specific startup's context
- Day 30: Learning and diagnosing — specific to their business model
- Day 60: Building and testing — specific to their growth/product challenge
- Day 90: Making it repeatable — specific to their stage
- Each milestone: 2-3 sentences
- Reference specific tools, frameworks, or approaches from candidate's background where relevant
- Must feel like a real plan for this startup, not a generic MBA framework

RESPOND IN THIS EXACT JSON — raw JSON only, no preamble, no markdown:
{
  "startup_name": "name",
  "why_i_want_to_build": "Full rewritten section text. Use \\n for paragraph breaks.",
  "execution_strategy": [
    {
      "day": "Day 30",
      "title": "Short milestone title",
      "description": "2-3 sentences specific to this startup"
    },
    {
      "day": "Day 60",
      "title": "Short milestone title",
      "description": "2-3 sentences specific to this startup"
    },
    {
      "day": "Day 90",
      "title": "Short milestone title",
      "description": "2-3 sentences specific to this startup"
    }
  ]
}`;

// ─────────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────────

function safeParseJSON(raw) {
  if (!raw || typeof raw !== "string") throw new Error("Empty response from API");
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    console.error("No JSON found. Preview:", text.slice(0, 300));
    throw new Error(`No JSON found. Preview: "${text.slice(0, 120)}..."`);
  }
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (e1) {
    try {
      const sanitized = slice.replace(/"((?:[^"\\]|\\.)*)"/gs, (match) =>
        match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
      );
      return JSON.parse(sanitized);
    } catch (e2) {
      throw new Error(`JSON parse failed: ${e2.message}`);
    }
  }
}

async function apiCall(systemPrompt, userMessage) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }
  const data = await response.json();
  return data.content.filter(b => b.type === "text").map(b => b.text || "").join("\n").trim();
}

// Forces JSON output by pre-filling the assistant turn with "{"
// Claude then completes the JSON with no preamble — most reliable method
async function apiCallJSON(systemPrompt, userMessage) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: "{" }
      ]
    })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }
  const data = await response.json();
  const text = data.content.filter(b => b.type === "text").map(b => b.text || "").join("").trim();
  return safeParseJSON("{" + text);
}

// ─────────────────────────────────────────────────────────────────
// URL CONTENT FETCHER
// Strategy:
// 1. First try direct fetch via a CORS proxy (works for most public sites)
// 2. If that fails, fall back to web_search tool which has real internet access
// LinkedIn is always handled via web_search since it blocks direct fetches
// ─────────────────────────────────────────────────────────────────
async function fetchUrlContent(url) {
  const isLinkedIn = url.includes("linkedin.com");

  // For LinkedIn and other social platforms — use web_search tool
  // which has real internet access and can pull public profile/company data
  if (isLinkedIn) {
    return await fetchViaWebSearch(url);
  }

  // For regular websites — try direct CORS proxy first, fall back to web_search
  try {
    return await fetchViaCorsProxy(url);
  } catch (e) {
    // Fallback to web search approach
    return await fetchViaWebSearch(url);
  }
}

// Approach 1: CORS proxy for regular websites
async function fetchViaCorsProxy(url) {
  // Use allorigins — a free CORS proxy that works for most public websites
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error("CORS proxy failed");
  const data = await res.json();
  if (!data.contents) throw new Error("No content returned");

  // Strip HTML tags and clean up
  const raw = data.contents
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (raw.length < 100) throw new Error("Content too short — likely blocked");

  // Limit to 1500 words to stay within rate limits
  return raw.split(" ").slice(0, 1500).join(" ");
}

// Approach 2: Claude web_search tool — has real internet access
// Works for LinkedIn, blocked sites, and search-based discovery
async function fetchViaWebSearch(url) {
  // Extract a search query from the URL
  let searchQuery;
  if (url.includes("linkedin.com/company/")) {
    const company = url.split("linkedin.com/company/")[1]?.replace(/\/$/, "").replace(/-/g, " ");
    searchQuery = `${company} startup company overview product`;
  } else if (url.includes("linkedin.com/in/")) {
    const person = url.split("linkedin.com/in/")[1]?.replace(/\/$/, "").replace(/-/g, " ");
    searchQuery = `${person} LinkedIn profile founder`;
  } else {
    // For regular URLs use the domain as search query
    try {
      const domain = new URL(url).hostname.replace("www.", "");
      searchQuery = `${domain} company product about`;
    } catch {
      searchQuery = url;
    }
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
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
      system: "You are a research assistant. Use web search to find information about the given company or person. Return a detailed summary of: what the company does, their product, business model, stage, team, any recent news, and challenges they face. Be specific and factual. Return plain text only.",
      messages: [{
        role: "user",
        content: `Search for information about this URL and summarize everything you find about the company/person: ${url}\n\nSearch query to use: "${searchQuery}"`
      }],
      tools: [{
        type: "web_search_20250305",
        name: "web_search"
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || "Web search failed");
  }

  const data = await response.json();
  // Extract all text content from the response (includes search results)
  const text = data.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n")
    .trim();

  if (!text || text.length < 50) throw new Error("No useful content found");
  return text;
}

// ─────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────
function Pill({ word, variant = "default" }) {
  const v = {
    default: { bg: "#f0f1fa", color: "#666a8a", border: "#dde0f0" },
    green:   { bg: "#05966908", color: "#059669", border: "#05966930" },
    blue:    { bg: "#2563eb08", color: "#2563eb", border: "#2563eb30" },
    amber:   { bg: "#d9770608", color: "#d97706", border: "#d9770630" },
    rose:    { bg: "#e1184908", color: "#e11d48", border: "#e1184930" },
    violet:  { bg: "#7c3aed08", color: "#7c3aed", border: "#7c3aed30" },
  }[variant] || { bg: "#f0f1fa", color: "#666a8a", border: "#dde0f0" };
  return (
    <span style={{
      padding: "3px 11px", borderRadius: 20, fontSize: 11,
      background: v.bg, color: v.color, border: `1px solid ${v.border}`,
      fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", display: "inline-block"
    }}>{word}</span>
  );
}

function Card({ children, accent, style = {} }) {
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 14,
      padding: "20px 24px", boxShadow: "0 1px 6px #00000006",
      borderLeft: accent ? `3px solid ${accent}` : undefined, ...style
    }}>{children}</div>
  );
}

function CopyBtn({ text, id, copied, onCopy }) {
  return (
    <button onClick={() => onCopy(text, id)} style={{
      padding: "8px 16px", borderRadius: 8, border: "1px solid #e8eaf4",
      background: copied === id ? "#05966908" : "transparent",
      color: copied === id ? "#059669" : "#888baa",
      fontSize: 12, fontWeight: 600, cursor: "pointer",
      fontFamily: "inherit", transition: "all 0.15s"
    }}>
      {copied === id ? "✅ Copied!" : "📋 Copy"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function StartupEmailAgent() {
  // Inputs
  const [founderName, setFounderName]     = useState("");
  const [startupName, setStartupName]     = useState("");
  const [urlInputs, setUrlInputs]         = useState(["", "", ""]);
  const [manualContext, setManualContext] = useState("");
  const [fetchStatuses, setFetchStatuses] = useState(["idle", "idle", "idle"]);
  const [fetchedContents, setFetchedContents] = useState(["", "", ""]);

  // Results
  const [analysisResult, setAnalysisResult]   = useState(null);
  const [emailText, setEmailText]             = useState("");
  const [portfolioResult, setPortfolioResult] = useState(null);

  // UI
  const [activeTab, setActiveTab]     = useState("email");
  const [loading, setLoading]         = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError]             = useState("");
  const [copied, setCopied]           = useState("");
  const resultRef = useRef(null);

  // ── URL FETCH ──
  async function handleFetchUrl(index) {
    const url = urlInputs[index];
    if (!url.trim()) return;
    const newStatuses = [...fetchStatuses];
    const newContents = [...fetchedContents];
    newStatuses[index] = "loading";
    setFetchStatuses([...newStatuses]);
    try {
      const content = await fetchUrlContent(url);
      newContents[index] = content;
      newStatuses[index] = "success";
    } catch (e) {
      newStatuses[index] = "error";
    }
    setFetchStatuses([...newStatuses]);
    setFetchedContents([...newContents]);
  }

  function updateUrl(index, value) {
    const updated = [...urlInputs];
    updated[index] = value;
    setUrlInputs(updated);
  }

  // ── GENERATE ALL ──
  async function handleGenerate() {
    if (!founderName.trim() || !startupName.trim()) {
      setError("Founder name and startup name are required.");
      return;
    }
    const hasContext = fetchedContents.some(c => c.trim()) || manualContext.trim();
    if (!hasContext) {
      setError("Please fetch at least one URL or paste some context about the startup.");
      return;
    }
    if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "YOUR_API_KEY_HERE") {
      setError("API key missing — paste your key at line 6.");
      return;
    }

    setError("");
    setLoading(true);
    setAnalysisResult(null);
    setEmailText("");
    setPortfolioResult(null);

    // Trim each URL content to 800 words max, total context to 2000 words
    const trimWords = (text, max) => text.split(" ").slice(0, max).join(" ");
    const contextParts = [
      ...fetchedContents.filter(c => c.trim()).map((c, i) => `--- SOURCE ${i + 1} ---\n${trimWords(c, 800)}`),
      manualContext.trim() ? `--- ADDITIONAL CONTEXT ---\n${trimWords(manualContext, 400)}` : ""
    ].filter(Boolean);
    const allContext = trimWords(contextParts.join("\n\n"), 2000);

    const inputBlock = `STARTUP NAME: ${startupName}
FOUNDER NAME: ${founderName}

STARTUP CONTEXT:
${allContext}`;

    // Helper: wait between calls to avoid rate limit (30k tokens/min)
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      // Step 1 — Pain point analysis (JSON call — pre-filled assistant turn)
      setProgressMsg("Step 1 of 3 — Analyzing startup and identifying pain points...");
      const analysis = await apiCallJSON(PROMPT_PAIN_POINTS, inputBlock);
      setAnalysisResult(analysis);

      // Wait 8 seconds before next call to reset token window
      setProgressMsg("Step 1 complete — waiting briefly before next step...");
      await sleep(8000);

      // Step 2 — Draft email
      setProgressMsg("Step 2 of 3 — Drafting your cold email...");
      const emailInput = `STARTUP NAME: ${startupName}
FOUNDER NAME: ${founderName}
FOUNDER FIRST NAME: ${founderName.split(" ")[0]}

PAIN POINTS IDENTIFIED:
${analysis.pain_points.map((p, i) => `Pain Point ${i + 1}: ${p.title}
Problem: ${p.problem}
Solution & Fit: ${p.solution_and_fit}`).join("\n\n")}

OPENING LINE TO USE: ${analysis.opening_line}
EMAIL SUBJECT: ${analysis.email_subject}`;

      const emailRaw = await apiCall(PROMPT_EMAIL, emailInput);
      setEmailText(emailRaw.trim());

      // Wait before step 3
      setProgressMsg("Step 2 complete — waiting briefly before final step...");
      await sleep(8000);

      // Step 3 — Portfolio rewrite (JSON call — pre-filled assistant turn)
      setProgressMsg("Step 3 of 3 — Rewriting portfolio sections...");
      const portfolio = await apiCallJSON(PROMPT_PORTFOLIO, inputBlock);
      setPortfolioResult(portfolio);

      setActiveTab("email");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setError(`Error: ${e.message}`);
    }

    setProgressMsg("");
    setLoading(false);
  }

  function copyText(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(""), 2500);
  }

  const URL_LABELS = ["Startup Website / About Page", "Product Page or Blog", "LinkedIn or Any Other Link"];
  const fetchedCount = fetchedContents.filter(c => c.trim()).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8ff", fontFamily: "'Sora', sans-serif", color: "#1a1c30", paddingBottom: 80 }}>
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
        .fetch-btn:hover:not(:disabled) { filter: brightness(1.1); }
        .fetch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .tab-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; border: none; background: transparent; }
        pre { white-space: pre-wrap; word-break: break-word; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ borderBottom: "1px solid #e8eaf4", padding: "24px 40px", background: "linear-gradient(180deg, #fff0f2 0%, #f7f8ff 100%)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg, #e11d48 0%, #7c3aed 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, boxShadow: "0 4px 20px #e1184920"
            }}>🚀</div>
            <div>
              <div style={{ fontSize: 10, color: "#e11d48", letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                Agent 06 · Job Search Suite
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: "#111328", lineHeight: 1 }}>
                Startup Cold Email + Portfolio Agent
              </h1>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 11, color: "#888baa", lineHeight: 1.9 }}>
              Analyzes startup → 3 pain points → cold email<br />
              + rewrites portfolio for this specific startup
            </div>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {["Startup analysis", "3 pain points + fit", "Cold email draft", "Portfolio rewrite", "Why I Want to Build", "90-Day Strategy"].map(t => (
              <Pill key={t} word={t} variant="default" />
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 40px 0" }}>

        {/* ── FOUNDER + STARTUP ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
          {[
            { label: "Founder Name", val: founderName, set: setFounderName, ph: "e.g. Alexandra Waldman" },
            { label: "Startup Name", val: startupName, set: setStartupName, ph: "e.g. Pickle" },
          ].map(({ label, val, set, ph }) => (
            <div key={label}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#555878", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7 }}>
                {label} <span style={{ color: "#e11d48" }}>*</span>
              </label>
              <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
                style={{
                  width: "100%", background: "#ffffff", border: "1px solid #e8eaf4",
                  borderRadius: 10, padding: "11px 14px", color: "#1a1c30",
                  fontSize: 13, boxShadow: "0 1px 4px #00000005",
                  transition: "border-color 0.2s"
                }}
              />
            </div>
          ))}
        </div>

        {/* ── URL INPUTS ── */}
        <div style={{
          background: "#ffffff", border: "1px solid #e8eaf4",
          borderRadius: 14, padding: "20px 24px", marginBottom: 16,
          boxShadow: "0 1px 6px #00000006"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111328", marginBottom: 3 }}>Startup Context — URLs</div>
              <div style={{ fontSize: 11, color: "#888baa" }}>Paste up to 3 URLs — website, product page, blog, LinkedIn</div>
            </div>
            {fetchedCount > 0 && (
              <div style={{ background: "#05966910", border: "1px solid #05966930", borderRadius: 20, padding: "4px 12px", fontSize: 11, color: "#059669", fontWeight: 700 }}>
                ✓ {fetchedCount} URL{fetchedCount > 1 ? "s" : ""} fetched
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {URL_LABELS.map((label, i) => (
              <div key={i}>
                <div style={{ fontSize: 10, color: "#555878", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                  {label}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={urlInputs[i]}
                    onChange={e => updateUrl(i, e.target.value)}
                    placeholder={`https://...`}
                    onKeyDown={e => e.key === "Enter" && handleFetchUrl(i)}
                    style={{
                      flex: 1, background: "#f7f8ff", border: "1px solid #e8eaf4",
                      borderRadius: 8, padding: "9px 12px", color: "#1a1c30",
                      fontSize: 12.5, transition: "border-color 0.2s"
                    }}
                  />
                  <button
                    className="fetch-btn"
                    onClick={() => handleFetchUrl(i)}
                    disabled={!urlInputs[i].trim() || fetchStatuses[i] === "loading"}
                    style={{
                      padding: "9px 16px", borderRadius: 8,
                      background: fetchStatuses[i] === "success" ? "#05966910"
                        : fetchStatuses[i] === "error" ? "#e1184910" : "#e11d48",
                      color: fetchStatuses[i] === "success" ? "#059669"
                        : fetchStatuses[i] === "error" ? "#e11d48" : "#ffffff",
                      fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                      border: `1px solid ${fetchStatuses[i] === "success" ? "#05966930"
                        : fetchStatuses[i] === "error" ? "#e1184930" : "transparent"}`
                    }}
                  >
                    {fetchStatuses[i] === "loading"
                      ? (urlInputs[i].includes("linkedin") ? "⏳ Searching..." : "⏳ Fetching...")
                      : fetchStatuses[i] === "success" ? "✅ Done"
                      : fetchStatuses[i] === "error" ? "⚠ Failed"
                      : urlInputs[i].includes("linkedin") ? "Search" : "Fetch"}
                  </button>
                </div>
                {fetchStatuses[i] === "success" && fetchedContents[i] && (
                  <p style={{ fontSize: 11, color: "#059669", marginTop: 4 }}>
                    ✓ {fetchedContents[i].split(" ").length} words loaded
                  </p>
                )}
                {fetchStatuses[i] === "error" && (
                  <p style={{ fontSize: 11, color: "#e11d48", marginTop: 4 }}>
                    ⚠ Could not fetch this URL. Paste the text manually in the box below instead — copy their About page or LinkedIn summary directly.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── MANUAL CONTEXT ── */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#555878", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7 }}>
            Additional Context — Paste Anything
            <span style={{ fontSize: 10, color: "#aaaacc", fontWeight: 400, marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>
              About page text, LinkedIn summary, pitch deck text, your notes
            </span>
          </label>
          <textarea value={manualContext} onChange={e => setManualContext(e.target.value)} rows={4}
            placeholder="Paste startup description, their LinkedIn About, notes from research, anything about the company, their product, their challenges, their stage..."
            style={{
              width: "100%", background: "#ffffff", border: "1px solid #e8eaf4",
              borderRadius: 10, padding: "12px 14px", color: "#1a1c30",
              fontSize: 12.5, lineHeight: 1.7, boxShadow: "0 1px 4px #00000005",
              transition: "border-color 0.2s"
            }}
          />
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div style={{ background: "#e1184908", border: "1px solid #e1184930", borderRadius: 10, padding: "12px 16px", marginBottom: 14, color: "#e11d48", fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── GENERATE BUTTON ── */}
        <button className="gen-btn" onClick={handleGenerate} disabled={loading} style={{
          width: "100%", padding: "16px 0", borderRadius: 12,
          background: loading ? "#e8eaf4" : "linear-gradient(135deg, #e11d48 0%, #7c3aed 100%)",
          color: loading ? "#888baa" : "#ffffff",
          fontSize: 14, fontWeight: 700, letterSpacing: 0.4,
          boxShadow: loading ? "none" : "0 4px 20px #e1184920"
        }}>
          {loading
            ? `🚀  ${progressMsg || "Analyzing..."}`
            : "🚀  Analyze Startup · Draft Email · Rewrite Portfolio"}
        </button>

        {/* ── RESULTS ── */}
        {(analysisResult || emailText || portfolioResult) && (
          <div ref={resultRef} style={{ marginTop: 44 }}>

            {/* Summary bar */}
            {analysisResult && (
              <div style={{
                background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 14,
                padding: "16px 22px", marginBottom: 24, boxShadow: "0 2px 8px #00000006",
                display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap"
              }}>
                <div>
                  <div style={{ fontSize: 9, color: "#888baa", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Startup</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#111328" }}>{analysisResult.startup_name}</div>
                </div>
                <div style={{ width: 1, height: 32, background: "#e8eaf4" }} />
                <div>
                  <div style={{ fontSize: 9, color: "#888baa", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Founder</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1c30" }}>{analysisResult.founder_name}</div>
                </div>
                <div style={{ width: 1, height: 32, background: "#e8eaf4" }} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 9, color: "#888baa", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Fit Assessment</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ height: 6, width: 100, background: "#e8eaf4", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 3,
                        width: `${analysisResult.confidence_score || 70}%`,
                        background: analysisResult.confidence_score >= 75 ? "#059669" : "#d97706"
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1c30", fontFamily: "'DM Mono', monospace" }}>
                      {analysisResult.confidence_score || 70}%
                    </span>
                    <span style={{ fontSize: 11, color: "#666a8a" }}>{analysisResult.confidence_note}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Startup summary */}
            {analysisResult?.startup_summary && (
              <div style={{ background: "#e1184908", border: "1px solid #e1184920", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 12.5, color: "#555878", lineHeight: 1.6 }}>
                <strong style={{ color: "#e11d48" }}>Startup Summary: </strong>{analysisResult.startup_summary}
              </div>
            )}

            {/* Tab Nav */}
            <div style={{ display: "flex", borderBottom: "1px solid #e8eaf4", marginBottom: 28 }}>
              {[
                { id: "email",     label: "📧 Cold Email",       show: !!emailText },
                { id: "analysis",  label: "🔍 Pain Points",      show: !!analysisResult },
                { id: "portfolio", label: "📁 Portfolio Rewrite", show: !!portfolioResult },
              ].filter(t => t.show).map(tab => (
                <button key={tab.id} className="tab-btn" onClick={() => setActiveTab(tab.id)} style={{
                  flex: 1, padding: "12px 10px",
                  borderBottom: `2px solid ${activeTab === tab.id ? "#e11d48" : "transparent"}`,
                  color: activeTab === tab.id ? "#e11d48" : "#888baa",
                  background: activeTab === tab.id ? "#e1184906" : "transparent",
                  fontSize: 13, fontWeight: 600
                }}>{tab.label}</button>
              ))}
            </div>

            {/* ── TAB: EMAIL ── */}
            {activeTab === "email" && emailText && (
              <div>
                {/* Subject line — prominent display */}
                {analysisResult?.email_subject && (
                  <div style={{
                    background: "#fff8f0", border: "1px solid #e1184930",
                    borderRadius: 10, padding: "12px 18px", marginBottom: 16,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                      <span style={{ fontSize: 10, color: "#e11d48", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", flexShrink: 0 }}>Subject Line</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#111328", fontFamily: "'DM Mono', monospace" }}>
                        {analysisResult.email_subject}
                      </span>
                    </div>
                    <button onClick={() => copyText(analysisResult.email_subject, "subject")} style={{
                      padding: "5px 12px", borderRadius: 6, border: "1px solid #e1184930",
                      background: copied === "subject" ? "#05966910" : "transparent",
                      color: copied === "subject" ? "#059669" : "#e11d48",
                      fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      whiteSpace: "nowrap", flexShrink: 0
                    }}>
                      {copied === "subject" ? "✅ Copied" : "Copy Subject"}
                    </button>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111328" }}>Email Body — Ready to Send</div>
                  <CopyBtn text={emailText} id="email" copied={copied} onCopy={copyText} />
                </div>
                <Card>
                  <pre style={{ fontSize: 13.5, color: "#1a1c30", lineHeight: 1.95, fontFamily: "'Sora', sans-serif", fontWeight: 400 }}>
                    {emailText}
                  </pre>
                </Card>
              </div>
            )}

            {/* ── TAB: PAIN POINTS ── */}
            {activeTab === "analysis" && analysisResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111328", marginBottom: 4 }}>
                  3 Pain Points Identified
                </div>
                {analysisResult.pain_points?.map((pp, i) => (
                  <Card key={i} accent="#e11d48">
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                        background: "#e1184910", border: "1px solid #e1184930",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 800, color: "#e11d48", fontFamily: "'DM Mono', monospace"
                      }}>{i + 1}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111328" }}>{pp.title}</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#e11d48", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Problem</div>
                        <p style={{ fontSize: 13, color: "#555878", lineHeight: 1.65 }}>{pp.problem}</p>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#059669", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Solution & Fit</div>
                        <p style={{ fontSize: 13, color: "#1a1c30", lineHeight: 1.65 }}>{pp.solution_and_fit}</p>
                      </div>
                    </div>
                    <div style={{ background: "#f7f8ff", borderRadius: 8, padding: "8px 12px" }}>
                      <span style={{ fontSize: 10, color: "#888baa", fontWeight: 700 }}>Resume anchor: </span>
                      <span style={{ fontSize: 11, color: "#555878" }}>{pp.resume_anchor}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* ── TAB: PORTFOLIO ── */}
            {activeTab === "portfolio" && portfolioResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Why I Want to Build */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111328" }}>Why I Want to Build at {portfolioResult.startup_name}</div>
                      <div style={{ fontSize: 11, color: "#888baa", marginTop: 2 }}>Replace this section in your portfolio doc</div>
                    </div>
                    <CopyBtn text={portfolioResult.why_i_want_to_build} id="why" copied={copied} onCopy={copyText} />
                  </div>
                  <Card accent="#7c3aed">
                    <pre style={{ fontSize: 13.5, color: "#1a1c30", lineHeight: 1.95, fontFamily: "'Sora', sans-serif', fontWeight: 400" }}>
                      {portfolioResult.why_i_want_to_build}
                    </pre>
                  </Card>
                </div>

                {/* 90-Day Strategy */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111328" }}>90-Day Execution Strategy</div>
                      <div style={{ fontSize: 11, color: "#888baa", marginTop: 2 }}>Replace this section in your portfolio doc</div>
                    </div>
                    <CopyBtn
                      text={portfolioResult.execution_strategy?.map(s => `${s.day} | ${s.title}\n${s.description}`).join("\n\n")}
                      id="strategy" copied={copied} onCopy={copyText}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {portfolioResult.execution_strategy?.map((s, i) => (
                      <Card key={i} accent="#2563eb">
                        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <div style={{
                            padding: "4px 10px", borderRadius: 8, flexShrink: 0,
                            background: "#2563eb10", border: "1px solid #2563eb25",
                            fontSize: 11, fontWeight: 800, color: "#2563eb", fontFamily: "'DM Mono', monospace"
                          }}>{s.day}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#111328", marginBottom: 5 }}>{s.title}</div>
                            <p style={{ fontSize: 13, color: "#555878", lineHeight: 1.65 }}>{s.description}</p>
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
