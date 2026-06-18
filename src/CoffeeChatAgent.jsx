import { useState, useRef } from "react";

// ─────────────────────────────────────────────────────────────────
// 🔑 YOUR API KEY
// ─────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.REACT_APP_ANTHROPIC_KEY;

// ─────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — Coffee Chat Prep
// ─────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a networking strategist and conversation coach who has helped hundreds of MBA students build genuine professional relationships from zero. You prepare people for coffee chats the way a debate coach prepares — not with scripts, but with deep contextual intelligence.

CANDIDATE CONTEXT:
International MBA student, Fordham University Gabelli School of Business, Class of 2027. Approximately 10 years of experience in operations, program management, and product management across India. No US brand-name employer pedigree. Primary goal: build a genuine, lasting professional relationship — NOT to make an immediate ask.

PERSON TYPES AND HOW THEY DIFFER:
- MBA Alumni: want to feel helpful, connect over Fordham experience, give practical advice
- Recruiter: time-pressed, want candidates who are self-aware and clear, dislike vagueness
- Operator / Startup: value execution and bias for action, skeptical of theory
- Consultant: appreciate structured thinking, frameworks, intellectual curiosity
- VC / PE: want pattern recognition, market thinking, opinions on trends — hate pitches
- Founder: focused on their problem, want to talk about their company, value builders

CONTEXT SOURCES — use ALL provided context to make output maximally specific:
- LinkedIn bio / about section
- URL content (fetched webpage — blog, company about page, article)
- YouTube transcript (spoken content from talks, podcasts, interviews)
- Manually pasted text
The more context provided, the more specific your output must be. Generic outputs when rich context exists are a failure.

OUTPUT — exactly 6 sections calibrated to this specific person and person type.

SECTION 1 — CONVERSATION OPENER
One natural icebreaker. Must reference something SPECIFIC from their context if provided.
Never: "I saw your profile and was really impressed." Never flattering. Always curious.

SECTION 2 — ELEVATOR PITCH (4-5 sentences)
Calibrated to person type:
- Alumni: lead with Fordham connection
- Recruiter: lead with clarity — what you want, what you bring
- Operator/Founder: lead with what you've built and solved
- Consultant: lead with structured thinking and cross-functional impact
- VC/PE: lead with market perspective and analytical rigor
International background = asset. Never apologize. Sound like a peer.

SECTION 3 — 5 SMART QUESTIONS
- At least 2 specific to their company, role, or something from their context
- At least 1 forward-looking
- At least 1 invites reflection on their own journey
- Zero questions answerable from their bio
- Zero questions about job openings or referrals
- If YouTube transcript or blog content was provided: at least 1 question referencing something specific they said or wrote

SECTION 4 — 3 TALKING POINTS
Natural bridges from candidate background into their world.
Format: context/setup → your bridge → specific detail to use
Grounded only in candidate's actual background.

SECTION 5 — WHAT NOT TO DO
2-3 pitfalls specific to THIS person type. Not generic advice.

SECTION 6 — HOW TO CLOSE
Exact words for last 2 minutes. Specific follow-up hook. Timing.
Never "can we stay in touch." Always a concrete next step.

HARD RULES:
- Never suggest asking for a job or referral in first chat
- If rich context was provided (transcript, blog, URL) — output MUST reference specific things from it
- Tone: warm, confident, peer-level — never junior or overly grateful
- Closing must be specific and actionable

RESPOND IN THIS EXACT JSON — raw JSON only, no preamble, no markdown:
{
  "person_name": "name",
  "person_role": "title",
  "company": "company",
  "person_type": "type",
  "context_used": ["linkedin_bio", "url_content", "youtube_transcript", "manual_text"],
  "personalization_score": 85,
  "personalization_note": "One sentence on how rich the context was and what drove personalization",
  "chat_duration_tip": "one sentence on ideal length for this person type",
  "opener": {
    "text": "The actual opening line",
    "source": "What context this was drawn from",
    "why": "Why this works for this specific person"
  },
  "elevator_pitch": {
    "text": "Full 4-5 sentence pitch",
    "emphasis": "What angle and why for this person type"
  },
  "smart_questions": [
    {
      "question": "Full question text",
      "type": "company-specific | forward-looking | reflective | context-reference | general",
      "source": "What context this references if applicable",
      "why": "Why this question works"
    }
  ],
  "talking_points": [
    {
      "setup": "Conversational context",
      "bridge": "Your experience that connects",
      "example": "Specific detail from candidate background"
    }
  ],
  "what_not_to_do": [
    {
      "mistake": "The specific mistake",
      "why_it_kills_rapport": "Why this person type hates it"
    }
  ],
  "closing": {
    "what_to_say": "Actual words",
    "follow_up_hook": "Specific reason to follow up",
    "timing": "When to send follow-up"
  }
}`;

// ─────────────────────────────────────────────────────────────────
// CONTEXT FETCHERS
// ─────────────────────────────────────────────────────────────────

// Detect YouTube URL
function isYouTubeUrl(url) {
  return /youtube\.com\/watch|youtu\.be\//.test(url);
}

// Extract YouTube video ID
function extractYouTubeId(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Fetch YouTube transcript via a public proxy
async function fetchYouTubeTranscript(videoId) {
  // Use the youtubetranscript API (free, no key needed)
  const res = await fetch(
    `https://api.youtubetranscript.com/?videoID=${videoId}`,
    { headers: { "Accept": "application/json" } }
  );
  if (!res.ok) throw new Error("Could not fetch transcript. The video may have no captions enabled.");
  const data = await res.json();
  if (!data || !Array.isArray(data)) throw new Error("No transcript data returned.");
  // Combine transcript segments into readable text, limit to ~3000 words
  const text = data.map(seg => seg.text).join(" ").replace(/\s+/g, " ").trim();
  return text.split(" ").slice(0, 3000).join(" ");
}

// Fetch URL content via Claude's fetch capability (Anthropic API url_fetch)
async function fetchUrlContent(url) {
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
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Please fetch and return the main text content from this URL. Return only the meaningful text content — no HTML, no navigation, no ads. Just the article/bio/about text.\n\nURL: ${url}`
      }],
      tools: [{
        type: "web_search_20250305",
        name: "web_search"
      }]
    })
  });
  if (!response.ok) throw new Error("URL fetch failed");
  const data = await response.json();
  return data.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
}

// ─────────────────────────────────────────────────────────────────
// SAFE JSON PARSE
// ─────────────────────────────────────────────────────────────────
function safeParseJSON(raw) {
  let text = raw.replace(/```json|```/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in response");
  return JSON.parse(text.slice(start, end + 1));
}

// ─────────────────────────────────────────────────────────────────
// MAIN CLAUDE CALL
// ─────────────────────────────────────────────────────────────────
async function callClaude(inputs, contextSections) {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "YOUR_API_KEY_HERE") {
    throw new Error("API_KEY_MISSING");
  }
  const { personName, personRole, company, personType, background } = inputs;

  const contextBlock = contextSections.length > 0
    ? contextSections.map(c => `--- ${c.label.toUpperCase()} ---\n${c.content}`).join("\n\n")
    : "No additional context provided — generate based on role and company only.";

  const userMessage = `PERSON NAME: ${personName}
PERSON ROLE / TITLE: ${personRole}
COMPANY: ${company}
PERSON TYPE: ${personType}

ADDITIONAL CONTEXT ABOUT THIS PERSON:
${contextBlock}

CANDIDATE BACKGROUND:
${background}`;

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
  return safeParseJSON(data.content.map(b => b.text || "").join(""));
}

// ─────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────
function Pill({ word, variant = "default" }) {
  const v = {
    default: { bg: "#f0f1fa", color: "#666a8a", border: "#dde0f0" },
    teal:    { bg: "#0d948808", color: "#0d9488", border: "#0d948830" },
    blue:    { bg: "#2563eb08", color: "#2563eb", border: "#2563eb30" },
    amber:   { bg: "#d9770608", color: "#d97706", border: "#d9770630" },
    rose:    { bg: "#e1184908", color: "#e11d48", border: "#e1184930" },
    violet:  { bg: "#7c3aed08", color: "#7c3aed", border: "#7c3aed30" },
    green:   { bg: "#05966908", color: "#059669", border: "#05966930" },
    gray:    { bg: "#f0f1fa",   color: "#888baa", border: "#dde0f0"   },
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
      background: "#ffffff", border: "1px solid #e8eaf4",
      borderRadius: 14, padding: "20px 24px",
      borderLeft: accent ? `3px solid ${accent}` : undefined,
      boxShadow: "0 1px 6px #00000006", ...style
    }}>{children}</div>
  );
}

function SectionHeader({ icon, number, title, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: `${color}12`, border: `1px solid ${color}30`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase" }}>Section {number}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111328" }}>{title}</div>
      </div>
    </div>
  );
}



const PERSON_TYPES = [
  { id: "MBA Alumni",        icon: "🎓", color: "#2563eb", pill: "blue"   },
  { id: "Recruiter",         icon: "📋", color: "#059669", pill: "green"  },
  { id: "Operator / Startup",icon: "⚙️", color: "#d97706", pill: "amber"  },
  { id: "Consultant",        icon: "📊", color: "#7c3aed", pill: "violet" },
  { id: "VC / PE",           icon: "💼", color: "#0d9488", pill: "teal"   },
  { id: "Founder",           icon: "🚀", color: "#e11d48", pill: "rose"   },
];

const SECTIONS = [
  { id: "opener",    icon: "👋", title: "Opener",        color: "#2563eb", number: 1 },
  { id: "pitch",     icon: "🎯", title: "Elevator Pitch", color: "#059669", number: 2 },
  { id: "questions", icon: "💬", title: "Smart Questions", color: "#7c3aed", number: 3 },
  { id: "talking",   icon: "🔗", title: "Talking Points",  color: "#d97706", number: 4 },
  { id: "notdo",     icon: "⚠️",  title: "What NOT To Do", color: "#e11d48", number: 5 },
  { id: "closing",   icon: "🤝", title: "How To Close",    color: "#0d9488", number: 6 },
];

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function CoffeeChatAgent() {
  // Core inputs
  const [personName, setPersonName]   = useState("");
  const [personRole, setPersonRole]   = useState("");
  const [company, setCompany]         = useState("");
  const [personType, setPersonType]   = useState("");
  const [background, setBackground]   = useState("");

  // Context sources
  const [urlInput, setUrlInput]           = useState("");
  const [urlStatus, setUrlStatus]         = useState("idle"); // idle | loading | success | error
  const [urlContent, setUrlContent]       = useState("");
  const [urlLabel, setUrlLabel]           = useState("");

  const [ytInput, setYtInput]             = useState("");
  const [ytStatus, setYtStatus]           = useState("idle");
  const [ytContent, setYtContent]         = useState("");
  const [ytLabel, setYtLabel]             = useState("");

  const [manualText, setManualText]       = useState("");

  // UI
  const [result, setResult]               = useState(null);
  const [loading, setLoading]             = useState(false);
  const [progressMsg, setProgressMsg]     = useState("");
  const [error, setError]                 = useState("");
  const [activeSection, setActiveSection] = useState("opener");
  const [copied, setCopied]               = useState("");
  const resultRef = useRef(null);

  // ── FETCH URL CONTENT ──
  async function handleFetchUrl() {
    if (!urlInput.trim()) return;
    setUrlStatus("loading");
    setUrlContent("");
    setUrlLabel("");
    try {
      if (isYouTubeUrl(urlInput)) {
        setUrlStatus("error");
        setUrlContent("");
        return;
      }
      const content = await fetchUrlContent(urlInput);
      const domain = new URL(urlInput).hostname.replace("www.", "");
      setUrlContent(content);
      setUrlLabel(`URL: ${domain}`);
      setUrlStatus("success");
    } catch (e) {
      setUrlStatus("error");
      setUrlContent("");
    }
  }

  // ── FETCH YOUTUBE TRANSCRIPT ──
  async function handleFetchYouTube() {
    if (!ytInput.trim()) return;
    setYtStatus("loading");
    setYtContent("");
    setYtLabel("");
    try {
      const videoId = extractYouTubeId(ytInput);
      if (!videoId) throw new Error("Invalid YouTube URL");
      const transcript = await fetchYouTubeTranscript(videoId);
      setYtContent(transcript);
      setYtLabel(`YouTube: ${videoId}`);
      setYtStatus("success");
    } catch (e) {
      setYtStatus("error");
      setYtContent("");
    }
  }

  // ── GENERATE ──
  async function handleGenerate() {
    if (!personName.trim() || !personRole.trim() || !company.trim() || !personType || !background.trim()) {
      setError("Name, role, company, person type and your background are all required.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    // Assemble context sections
    const contextSections = [];
    if (urlContent) contextSections.push({ label: urlLabel || "URL Content", content: urlContent });
    if (ytContent)  contextSections.push({ label: ytLabel  || "YouTube Transcript", content: ytContent });
    if (manualText.trim()) contextSections.push({ label: "Additional Context (Manually Pasted)", content: manualText });

    setProgressMsg(contextSections.length > 0
      ? `Using ${contextSections.length} context source${contextSections.length > 1 ? "s" : ""} — generating personalised brief...`
      : "Generating brief from role and company..."
    );

    try {
      const data = await callClaude(
        { personName, personRole, company, personType, background },
        contextSections
      );
      setResult(data);
      setActiveSection("opener");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      if (e.message === "API_KEY_MISSING") {
        setError("API key missing — paste your key into ANTHROPIC_API_KEY at line 6.");
      } else {
        setError(`Error: ${e.message}`);
      }
    }
    setProgressMsg("");
    setLoading(false);
  }

  function copyText(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(""), 2500);
  }

  const activePersonType = PERSON_TYPES.find(p => p.id === personType);
  const contextCount = [urlContent, ytContent, manualText.trim()].filter(Boolean).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8ff", fontFamily: "'Sora', sans-serif", color: "#1a1c30", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea, input { font-family: inherit; }
        textarea { resize: vertical; }
        textarea:focus, input:focus { outline: none !important; border-color: #2563eb !important; box-shadow: 0 0 0 3px #2563eb10 !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #f7f8ff; }
        ::-webkit-scrollbar-thumb { background: #dde0f0; border-radius: 2px; }
        .gen-btn { transition: all 0.2s; cursor: pointer; border: none; font-family: inherit; }
        .gen-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px #2563eb25 !important; }
        .gen-btn:disabled { opacity: 0.38; cursor: not-allowed; }
        .fetch-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; }
        .fetch-btn:hover:not(:disabled) { filter: brightness(1.1); }
        .fetch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .type-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; }
        .sec-btn { transition: all 0.12s; cursor: pointer; font-family: inherit; border: none; background: transparent; }
        .sec-btn:hover { background: #f0f1fa !important; }
        .copy-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; }
        .copy-btn:hover { border-color: #2563eb !important; color: #2563eb !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ borderBottom: "1px solid #e8eaf4", padding: "24px 40px", background: "linear-gradient(180deg, #eef0fb 0%, #f7f8ff 100%)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg, #2563eb 0%, #0d9488 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, boxShadow: "0 4px 20px #2563eb18"
            }}>☕</div>
            <div>
              <div style={{ fontSize: 10, color: "#2563eb", letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                Agent 05 · Job Search Suite
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: "#111328", lineHeight: 1 }}>
                Coffee Chat Prep Agent <span style={{ fontSize: 11, fontWeight: 400, color: "#888baa", letterSpacing: 0 }}>v2.0</span>
              </h1>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 11, color: "#888baa", lineHeight: 1.9 }}>
              URL fetch · YouTube transcript · Manual paste<br />
              6 sections · Calibrated per person type
            </div>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {PERSON_TYPES.map(pt => <Pill key={pt.id} word={`${pt.icon} ${pt.id}`} variant={pt.pill} />)}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 40px 0" }}>

        {/* ── PERSON TYPE ── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, color: "#555878", fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 10 }}>
            Who Are You Meeting? <span style={{ color: "#e11d48" }}>*</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PERSON_TYPES.map(pt => (
              <button key={pt.id} className="type-btn" onClick={() => setPersonType(pt.id)} style={{
                padding: "10px 16px", borderRadius: 10,
                border: `1.5px solid ${personType === pt.id ? pt.color : "#e8eaf4"}`,
                background: personType === pt.id ? `${pt.color}08` : "#ffffff",
                color: personType === pt.id ? pt.color : "#666a8a",
                fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 7,
                boxShadow: personType === pt.id ? `0 2px 12px ${pt.color}18` : "0 1px 4px #00000005"
              }}>
                <span>{pt.icon}</span>{pt.id}
              </button>
            ))}
          </div>
        </div>

        {/* ── PERSON DETAILS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
          {[
            { label: "Their Name",        val: personName, set: setPersonName, ph: "e.g. Jean Hannon" },
            { label: "Their Role / Title", val: personRole, set: setPersonRole, ph: "e.g. Principal Consultant" },
            { label: "Their Company",     val: company,    set: setCompany,    ph: "e.g. The Pivot Group" },
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
                  transition: "border-color 0.2s, box-shadow 0.2s"
                }}
              />
            </div>
          ))}
        </div>

        {/* ── YOUR BACKGROUND ── */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#555878", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7 }}>
            Your Background <span style={{ color: "#e11d48" }}>*</span>
            <span style={{ fontSize: 10, color: "#aaaacc", fontWeight: 400, marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>roles, achievements, MBA context</span>
          </label>
          <textarea value={background} onChange={e => setBackground(e.target.value)} rows={4}
            placeholder="e.g. First-year MBA at Fordham Gabelli, Class of 2027. ~10 years in ops and PM. Built subscription platform at Livguard (11,000 users). Led cross-functional ops at Tata Hitachi — 20% reduction in fleet downtime. Currently building AI job search agents. Interested in PM and ops roles at tech companies..."
            style={{
              width: "100%", background: "#ffffff", border: "1px solid #e8eaf4",
              borderRadius: 10, padding: "12px 14px", color: "#1a1c30",
              fontSize: 12.5, lineHeight: 1.7, boxShadow: "0 1px 4px #00000005",
              transition: "border-color 0.2s, box-shadow 0.2s"
            }}
          />
        </div>

        {/* ── CONTEXT SOURCES ── */}
        <div style={{
          background: "#ffffff", border: "1px solid #e8eaf4",
          borderRadius: 14, padding: "20px 24px", marginBottom: 20,
          boxShadow: "0 1px 6px #00000006"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#111328", marginBottom: 3 }}>
                Context Sources — Make It Personal
              </div>
              <div style={{ fontSize: 11, color: "#888baa" }}>
                The more context you add, the more specific the output. All sources are optional.
              </div>
            </div>
            {contextCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#05966910", border: "1px solid #05966930", borderRadius: 20, padding: "4px 12px" }}>
                <span style={{ fontSize: 12 }}>✓</span>
                <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>{contextCount} source{contextCount > 1 ? "s" : ""} ready</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── SOURCE 1: URL FETCH ── */}
            <div style={{ borderBottom: "1px solid #f0f1fa", paddingBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>🌐</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1c30" }}>Blog Post, Company Page, Article URL</div>
                  <div style={{ fontSize: 11, color: "#888baa" }}>Personal website, company about page, published article, Substack, Medium</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={urlInput} onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://theirwebsite.com/about  or  https://medium.com/@person/article"
                  onKeyDown={e => e.key === "Enter" && handleFetchUrl()}
                  style={{
                    flex: 1, background: "#f7f8ff", border: "1px solid #e8eaf4",
                    borderRadius: 8, padding: "9px 12px", color: "#1a1c30",
                    fontSize: 12.5, transition: "border-color 0.2s"
                  }}
                />
                <button className="fetch-btn" onClick={handleFetchUrl}
                  disabled={!urlInput.trim() || urlStatus === "loading"}
                  style={{
                    padding: "9px 16px", borderRadius: 8, border: "none",
                    background: urlStatus === "success" ? "#05966910" : "#2563eb",
                    color: urlStatus === "success" ? "#059669" : "#ffffff",
                    fontSize: 12, fontWeight: 700, whiteSpace: "nowrap"
                  }}>
                  {urlStatus === "loading" ? "⏳ Fetching..." : urlStatus === "success" ? "✅ Fetched" : "Fetch Content"}
                </button>
              </div>
              {urlStatus === "error" && (
                <p style={{ fontSize: 11, color: "#e11d48", marginTop: 6 }}>
                  ⚠ Could not fetch — try pasting the text manually below instead. (Note: LinkedIn URLs are blocked by their servers.)
                </p>
              )}
              {urlStatus === "success" && urlContent && (
                <div style={{ marginTop: 8, background: "#05966908", border: "1px solid #05966920", borderRadius: 8, padding: "8px 12px" }}>
                  <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>✓ Fetched from {urlLabel} · </span>
                  <span style={{ fontSize: 11, color: "#666a8a" }}>{urlContent.split(" ").length} words loaded</span>
                </div>
              )}
            </div>

            {/* ── SOURCE 2: YOUTUBE TRANSCRIPT ── */}
            <div style={{ borderBottom: "1px solid #f0f1fa", paddingBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>▶️</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1c30" }}>YouTube Video — Auto Transcript</div>
                  <div style={{ fontSize: 11, color: "#888baa" }}>Conference talk, podcast recording, interview, webinar — extracts what they said</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={ytInput} onChange={e => setYtInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=...  or  https://youtu.be/..."
                  onKeyDown={e => e.key === "Enter" && handleFetchYouTube()}
                  style={{
                    flex: 1, background: "#f7f8ff", border: "1px solid #e8eaf4",
                    borderRadius: 8, padding: "9px 12px", color: "#1a1c30",
                    fontSize: 12.5, transition: "border-color 0.2s"
                  }}
                />
                <button className="fetch-btn" onClick={handleFetchYouTube}
                  disabled={!ytInput.trim() || ytStatus === "loading"}
                  style={{
                    padding: "9px 16px", borderRadius: 8, border: "none",
                    background: ytStatus === "success" ? "#05966910" : "#e11d48",
                    color: ytStatus === "success" ? "#059669" : "#ffffff",
                    fontSize: 12, fontWeight: 700, whiteSpace: "nowrap"
                  }}>
                  {ytStatus === "loading" ? "⏳ Loading..." : ytStatus === "success" ? "✅ Loaded" : "Get Transcript"}
                </button>
              </div>
              {ytStatus === "error" && (
                <p style={{ fontSize: 11, color: "#e11d48", marginTop: 6 }}>
                  ⚠ Transcript unavailable — video may have captions disabled. Try pasting key quotes in the manual field below.
                </p>
              )}
              {ytStatus === "success" && ytContent && (
                <div style={{ marginTop: 8, background: "#05966908", border: "1px solid #05966920", borderRadius: 8, padding: "8px 12px" }}>
                  <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>✓ Transcript loaded · </span>
                  <span style={{ fontSize: 11, color: "#666a8a" }}>{ytContent.split(" ").length} words extracted (first 3,000)</span>
                </div>
              )}
            </div>

            {/* ── SOURCE 3: MANUAL TEXT ── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>📋</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1c30" }}>Paste Any Text — LinkedIn Bio, Tweet, Quote, Notes</div>
                  <div style={{ fontSize: 11, color: "#888baa" }}>LinkedIn About section, tweet thread, podcast summary, anything you copy manually</div>
                </div>
              </div>
              <textarea
                value={manualText} onChange={e => setManualText(e.target.value)} rows={4}
                placeholder="Paste their LinkedIn About section, a notable quote, a tweet thread, key points from their talk, or any notes you have about them..."
                style={{
                  width: "100%", background: "#f7f8ff", border: "1px solid #e8eaf4",
                  borderRadius: 8, padding: "10px 12px", color: "#1a1c30",
                  fontSize: 12.5, lineHeight: 1.7, transition: "border-color 0.2s"
                }}
              />
              {manualText.trim() && (
                <p style={{ fontSize: 11, color: "#059669", marginTop: 5 }}>
                  ✓ {manualText.trim().split(" ").length} words ready
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div style={{ background: "#e1184908", border: "1px solid #e1184930", borderRadius: 10, padding: "12px 16px", marginBottom: 14, color: "#e11d48", fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── GENERATE BUTTON ── */}
        <button className="gen-btn" onClick={handleGenerate} disabled={loading} style={{
          width: "100%", padding: "15px 0", borderRadius: 12,
          background: loading ? "#e8eaf4" : "linear-gradient(135deg, #2563eb 0%, #0d9488 100%)",
          color: loading ? "#888baa" : "#ffffff",
          fontSize: 14, fontWeight: 700, letterSpacing: 0.4,
          boxShadow: loading ? "none" : "0 4px 20px #2563eb20"
        }}>
          {loading
            ? `☕  ${progressMsg || "Generating..."}`
            : `☕  Generate Coffee Chat Brief${contextCount > 0 ? ` — ${contextCount} Context Source${contextCount > 1 ? "s" : ""} Loaded` : ""}`}
        </button>

        {/* ── RESULTS ── */}
        {result && (
          <div ref={resultRef} style={{ marginTop: 44 }}>

            {/* Person + personalization bar */}
            <div style={{
              background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 14,
              padding: "16px 22px", marginBottom: 24, boxShadow: "0 2px 8px #00000006",
              display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap"
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                background: activePersonType ? `${activePersonType.color}10` : "#f0f1fa",
                border: `1.5px solid ${activePersonType ? `${activePersonType.color}30` : "#e8eaf4"}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20
              }}>{activePersonType?.icon || "👤"}</div>

              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111328" }}>{result.person_name}</div>
                <div style={{ fontSize: 12, color: "#666a8a" }}>{result.person_role} · {result.company}</div>
              </div>

              <div style={{ width: 1, height: 36, background: "#e8eaf4", flexShrink: 0 }} />

              {/* Personalization score */}
              <div>
                <div style={{ fontSize: 9, color: "#888baa", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Personalization</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ height: 6, width: 100, background: "#e8eaf4", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      width: `${result.personalization_score || 50}%`,
                      background: result.personalization_score >= 75 ? "#059669" : result.personalization_score >= 50 ? "#d97706" : "#e11d48"
                    }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1c30", fontFamily: "'DM Mono', monospace" }}>
                    {result.personalization_score || 50}%
                  </span>
                </div>
              </div>

              <div style={{ width: 1, height: 36, background: "#e8eaf4", flexShrink: 0 }} />

              {/* Context sources used */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: "#888baa", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Context Used</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {result.context_used?.length > 0
                    ? result.context_used.map(c => <Pill key={c} word={c.replace(/_/g, " ")} variant="green" />)
                    : <Pill word="role + company only" variant="gray" />
                  }
                </div>
              </div>
            </div>

            {/* Personalization note */}
            {result.personalization_note && (
              <div style={{
                background: "#2563eb08", border: "1px solid #2563eb20",
                borderRadius: 10, padding: "10px 16px", marginBottom: 20,
                fontSize: 12.5, color: "#555878"
              }}>
                💡 {result.personalization_note}
              </div>
            )}

            {/* Duration tip */}
            <div style={{
              background: "#f7f8ff", border: "1px solid #e8eaf4",
              borderRadius: 10, padding: "10px 16px", marginBottom: 24,
              fontSize: 12, color: "#2563eb", fontStyle: "italic"
            }}>
              ⏱ {result.chat_duration_tip}
            </div>

            {/* Section nav */}
            <div style={{ display: "flex", borderBottom: "1px solid #e8eaf4", marginBottom: 28, overflowX: "auto" }}>
              {SECTIONS.map(sec => (
                <button key={sec.id} className="sec-btn" onClick={() => setActiveSection(sec.id)} style={{
                  flex: 1, padding: "12px 8px", minWidth: 100,
                  borderBottom: `2px solid ${activeSection === sec.id ? sec.color : "transparent"}`,
                  color: activeSection === sec.id ? sec.color : "#888baa",
                  background: activeSection === sec.id ? `${sec.color}06` : "transparent",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4
                }}>
                  <span style={{ fontSize: 16 }}>{sec.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{sec.title}</span>
                </button>
              ))}
            </div>

            {/* ── OPENER ── */}
            {activeSection === "opener" && result.opener && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <SectionHeader icon="👋" number={1} title="Conversation Opener" color="#2563eb" />
                <Card accent="#2563eb">
                  <div style={{ fontSize: 10, color: "#2563eb", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Say This to Open</div>
                  <p style={{ fontSize: 15, color: "#111328", lineHeight: 1.8, fontStyle: "italic", marginBottom: 14 }}>"{result.opener.text}"</p>
                  {result.opener.source && result.opener.source !== "general" && (
                    <div style={{ marginBottom: 10 }}><Pill word={`drawn from: ${result.opener.source}`} variant="blue" /></div>
                  )}
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span>💡</span>
                    <p style={{ fontSize: 12.5, color: "#555878", lineHeight: 1.6 }}>{result.opener.why}</p>
                  </div>
                </Card>
                <button className="copy-btn" onClick={() => copyText(result.opener.text, "opener")}
                  style={{ padding: "10px", borderRadius: 8, border: "1px solid #e8eaf4", background: "transparent", color: "#888baa", fontSize: 12, fontWeight: 600 }}>
                  {copied === "opener" ? "✅ Copied!" : "📋 Copy Opener"}
                </button>
              </div>
            )}

            {/* ── PITCH ── */}
            {activeSection === "pitch" && result.elevator_pitch && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <SectionHeader icon="🎯" number={2} title="Elevator Pitch" color="#059669" />
                <Card accent="#059669">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: "#059669", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Calibrated for {result.person_type}</div>
                  </div>
                  <p style={{ fontSize: 14, color: "#1a1c30", lineHeight: 1.85, marginBottom: 14 }}>{result.elevator_pitch.text}</p>
                  <div style={{ background: "#05966908", border: "1px solid #05966920", borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginBottom: 4 }}>Why this angle</div>
                    <p style={{ fontSize: 12, color: "#555878", lineHeight: 1.6 }}>{result.elevator_pitch.emphasis}</p>
                  </div>
                </Card>
                <button className="copy-btn" onClick={() => copyText(result.elevator_pitch.text, "pitch")}
                  style={{ padding: "10px", borderRadius: 8, border: "1px solid #e8eaf4", background: "transparent", color: "#888baa", fontSize: 12, fontWeight: 600 }}>
                  {copied === "pitch" ? "✅ Copied!" : "📋 Copy Pitch"}
                </button>
              </div>
            )}

            {/* ── QUESTIONS ── */}
            {activeSection === "questions" && result.smart_questions && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <SectionHeader icon="💬" number={3} title="Smart Questions" color="#7c3aed" />
                {result.smart_questions.map((q, i) => (
                  <Card key={i} accent="#7c3aed">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: 6,
                          background: "#7c3aed10", border: "1px solid #7c3aed25",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 800, color: "#7c3aed", fontFamily: "'DM Mono', monospace"
                        }}>{i + 1}</div>
                        <Pill word={q.type} variant="violet" />
                        {q.source && q.source !== "general" && <Pill word={`ref: ${q.source}`} variant="gray" />}
                      </div>
                      <button className="copy-btn" onClick={() => copyText(q.question, `q${i}`)}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e8eaf4", background: "transparent", color: "#aaaacc", fontSize: 11, fontWeight: 600 }}>
                        {copied === `q${i}` ? "✅" : "Copy"}
                      </button>
                    </div>
                    <p style={{ fontSize: 14, color: "#111328", lineHeight: 1.75, marginBottom: 8, fontWeight: 500 }}>{q.question}</p>
                    <p style={{ fontSize: 11.5, color: "#888baa", lineHeight: 1.5 }}>💡 {q.why}</p>
                  </Card>
                ))}
              </div>
            )}

            {/* ── TALKING POINTS ── */}
            {activeSection === "talking" && result.talking_points && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <SectionHeader icon="🔗" number={4} title="Talking Points" color="#d97706" />
                <div style={{ background: "#d9770608", border: "1px solid #d9770620", borderRadius: 10, padding: "12px 16px", marginBottom: 4 }}>
                  <p style={{ fontSize: 12.5, color: "#555878", lineHeight: 1.6 }}>
                    Natural bridges — use when the topic comes up. Not a pitch, just genuine overlap.
                  </p>
                </div>
                {result.talking_points.map((tp, i) => (
                  <Card key={i} accent="#d97706">
                    <div style={{ fontSize: 10, color: "#d97706", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Talking Point {i + 1}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#888baa", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>When / Context</div>
                        <p style={{ fontSize: 13, color: "#555878", lineHeight: 1.6, fontStyle: "italic" }}>{tp.setup}</p>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#d97706", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Your Bridge</div>
                        <p style={{ fontSize: 13, color: "#1a1c30", lineHeight: 1.6 }}>{tp.bridge}</p>
                      </div>
                    </div>
                    <div style={{ background: "#d9770608", borderRadius: 8, padding: "8px 12px" }}>
                      <span style={{ fontSize: 11, color: "#d97706", fontWeight: 700 }}>Specific detail: </span>
                      <span style={{ fontSize: 11, color: "#555878" }}>{tp.example}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* ── WHAT NOT TO DO ── */}
            {activeSection === "notdo" && result.what_not_to_do && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <SectionHeader icon="⚠️" number={5} title="What NOT To Do" color="#e11d48" />
                <div style={{ background: "#e1184908", border: "1px solid #e1184920", borderRadius: 10, padding: "12px 16px", marginBottom: 4 }}>
                  <p style={{ fontSize: 12.5, color: "#555878", lineHeight: 1.6 }}>
                    Specific to <strong style={{ color: "#e11d48" }}>{result.person_type}s</strong> — not generic networking advice.
                  </p>
                </div>
                {result.what_not_to_do.map((item, i) => (
                  <Card key={i} accent="#e11d48">
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: "#e1184910", border: "1px solid #e1184930",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14
                      }}>✗</div>
                      <div>
                        <p style={{ fontSize: 14, color: "#111328", fontWeight: 600, marginBottom: 7 }}>{item.mistake}</p>
                        <p style={{ fontSize: 12.5, color: "#666a8a", lineHeight: 1.6 }}>Why it kills rapport: {item.why_it_kills_rapport}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* ── CLOSING ── */}
            {activeSection === "closing" && result.closing && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <SectionHeader icon="🤝" number={6} title="How To Close the Chat" color="#0d9488" />
                <Card accent="#0d9488">
                  <div style={{ fontSize: 10, color: "#0d9488", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
                    What to Say in the Last 2 Minutes
                  </div>
                  <p style={{ fontSize: 15, color: "#111328", lineHeight: 1.85, fontStyle: "italic", marginBottom: 18 }}>
                    "{result.closing.what_to_say}"
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div style={{ background: "#0d948808", border: "1px solid #0d948820", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, color: "#0d9488", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Follow-Up Hook</div>
                      <p style={{ fontSize: 12.5, color: "#1a1c30", lineHeight: 1.6 }}>{result.closing.follow_up_hook}</p>
                    </div>
                    <div style={{ background: "#2563eb08", border: "1px solid #2563eb20", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, color: "#2563eb", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>When to Follow Up</div>
                      <p style={{ fontSize: 12.5, color: "#1a1c30", lineHeight: 1.6 }}>{result.closing.timing}</p>
                    </div>
                  </div>
                </Card>
                <button className="copy-btn" onClick={() => copyText(result.closing.what_to_say, "closing")}
                  style={{ padding: "10px", borderRadius: 8, border: "1px solid #e8eaf4", background: "transparent", color: "#888baa", fontSize: 12, fontWeight: 600 }}>
                  {copied === "closing" ? "✅ Copied!" : "📋 Copy Closing"}
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
