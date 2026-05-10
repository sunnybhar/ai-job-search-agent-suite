import { useState, useRef } from "react";

// ─────────────────────────────────────────────────────────────────
// 🔑 YOUR API KEY
// ─────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.REACT_APP_ANTHROPIC_KEY;

// ─────────────────────────────────────────────────────────────────
// CANDIDATE CONSTANTS
// ─────────────────────────────────────────────────────────────────
const CANDIDATE = {
  name: "Sunny Bhargava",
  title: "MBA Candidate, Fordham University — Gabelli School of Business",
  email: "sb299@fordham.edu",
  linkedin: "linkedin.com/in/bhargavasunny",
  mobile: "+1 (551) 998-5759",
  calendly: "https://calendly.com/sunnybhargava1611/30min",
  background: `International MBA student, Fordham Gabelli, Class of 2027. ~10 years ops + PM. Key metrics: scaled platform 200→11,000 users (55x), onboarded 7,000 customers across 35+ cities, cut payment defaults 20%, grew revenue 15%, reduced fleet downtime 10%. Skills: SQL, Python, Power BI, Jira, Figma, PRDs, roadmaps, A/B testing.`
};

// ─────────────────────────────────────────────────────────────────
// SCENARIO DEFINITIONS
// ─────────────────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: "coffee_chat",
    icon: "☕",
    label: "After Coffee Chat",
    color: "#0d9488",
    description: "Networking call or informational conversation",
    fields: ["personName", "personRole", "company", "chatDate", "keyMoment", "nextStep", "lastMessage"],
    goal: "Keep relationship warm — no ask yet"
  },
  {
    id: "interview",
    icon: "🎤",
    label: "After Interview",
    color: "#7c3aed",
    description: "Phone screen, panel, or onsite interview",
    fields: ["personName", "personRole", "company", "interviewDate", "keyMoment", "missedPoint", "lastMessage"],
    goal: "Reinforce fit — move to next step"
  },
  {
    id: "application",
    icon: "📋",
    label: "Application Follow-Up",
    color: "#2563eb",
    description: "No response after applying — nudge",
    fields: ["personName", "personRole", "company", "appliedDate", "roleTitle", "lastMessage"],
    goal: "Re-surface your application without being annoying"
  },
  {
    id: "cold_email",
    icon: "📧",
    label: "Cold Email No Reply",
    color: "#d97706",
    description: "Sent cold outreach — silence for 5+ days",
    fields: ["personName", "personRole", "company", "sentDate", "originalAngle", "lastMessage"],
    goal: "Re-open without desperation — new angle"
  },
  {
    id: "linkedin",
    icon: "💼",
    label: "LinkedIn Message",
    color: "#e11d48",
    description: "Short LinkedIn follow-up — any context",
    fields: ["personName", "personRole", "company", "context", "lastMessage"],
    goal: "3 sentences max — conversational, not formal"
  }
];

// ─────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a professional communication strategist who writes follow-up emails and messages for MBA candidates. You write communications that are direct, specific, and make the recipient want to reply.

CANDIDATE:
${CANDIDATE.name} | ${CANDIDATE.title}
Background: ${CANDIDATE.background}
Email: ${CANDIDATE.email} | LinkedIn: ${CANDIDATE.linkedin} | Mobile: ${CANDIDATE.mobile}
Calendly: ${CANDIDATE.calendly}

═══════════════════════════════════
UNIVERSAL HARD RULES — never break
═══════════════════════════════════
- NEVER open with "I just wanted to follow up" — this is the weakest opener possible
- NEVER open with "I hope this email finds you well" or any wellness variant
- NEVER over-thank — maximum one expression of gratitude per message
- ALWAYS reference something specific from the interaction — never generic
- ALWAYS give them a reason to reply — a question, an insight, or a concrete next step
- NEVER beg or apologize for following up
- NEVER use "I wanted to reach out" — say what you mean directly
- Body text: maximum 150 words for emails, maximum 3 sentences for LinkedIn
- Tone: confident peer, not grateful student
- LAST MESSAGE SENT: if provided, read it carefully. The follow-up must:
  * Never repeat what was already said — move the conversation forward
  * Reference or build on the last message naturally to show continuity
  * Match the tone and register of the previous communication
  * If the last message made an ask, the follow-up should gently re-surface it or pivot
  * If the last message was informational, the follow-up should add something new

═══════════════════════════════════
SCENARIO-SPECIFIC RULES
═══════════════════════════════════

SCENARIO: AFTER COFFEE CHAT
Goal: Keep the relationship warm. No ask. Build on a specific moment.
- Open by referencing one specific thing they said or a specific moment
- Add one genuine insight or resource that connects to that moment
- Close with a soft non-ask — something that keeps the conversation alive
- Subject: reference the specific topic discussed, not "Great talking with you"
- NO Calendly link — that was for the first chat

SCENARIO: AFTER INTERVIEW
Goal: Reinforce fit. Add something you forgot to say. Move them to yes.
- Open by referencing one specific thing discussed in the interview
- Add one point that reinforces your fit — ideally something you didn't fully articulate in the interview
- Close with a direct but non-pushy expression of interest in next steps
- Subject: role title + something specific, not "Thank you for the opportunity"
- Keep it under 120 words — interviewers are busy

SCENARIO: APPLICATION FOLLOW-UP
Goal: Re-surface the application. Show continued interest. Give them a reason to look again.
- Open with a new piece of context — something about the company you noticed recently, or a new angle on your fit
- Reference when you applied and the role title
- One sentence on why you are still excited — specific to their product or mission
- Close with a direct but light ask — happy to chat, link to calendar
- Subject: role title + "— Still Very Interested" or a specific hook

SCENARIO: COLD EMAIL NO REPLY
Goal: Re-open with a different angle. Don't repeat the original email. Don't guilt them.
- Acknowledge the silence in a confident non-desperate way — one short line max
- Lead with a NEW angle or new piece of context — a recent company announcement, a new insight, something timely
- Keep it even shorter than the original — 3-4 sentences max
- Close with the lowest possible friction ask — "Worth a quick call?" or similar
- Subject: different from original — use the new angle

SCENARIO: LINKEDIN MESSAGE
Goal: Short, human, conversational. Not a formal email in a small box.
- Maximum 3 sentences — hard limit
- No subject line needed
- No formal opener, no signature block
- Reference one specific thing — their post, their role change, the conversation you had
- End with one soft question or observation that invites a reply
- Tone: how you'd message a classmate, not a cover letter

═══════════════════════════════════
OUTPUT FORMAT — raw JSON only, no preamble, no markdown:
═══════════════════════════════════
{
  "scenario": "scenario_id",
  "recipient_name": "first name only",
  "channel": "email or linkedin",
  "subject_line": "subject line if email, null if linkedin",
  "subject_line_alternatives": ["alt 1", "alt 2"],
  "message": "full message text ready to send",
  "message_linkedin": "3 sentence linkedin version if applicable, else null",
  "word_count": 95,
  "key_hook": "one sentence — what makes this message work",
  "timing_advice": "when to send this for best open rate",
  "what_to_avoid": "one sentence — the mistake most people make in this scenario"
}`;

// ─────────────────────────────────────────────────────────────────
// API CALL
// ─────────────────────────────────────────────────────────────────
function safeParseJSON(raw) {
  if (!raw) throw new Error("Empty response");
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`No JSON found. Got: "${text.slice(0, 100)}"`);
  const slice = text.slice(start, end + 1);
  try { return JSON.parse(slice); }
  catch (e) {
    const sanitized = slice.replace(/"((?:[^"\\]|\\.)*)"/gs,
      m => m.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t"));
    return JSON.parse(sanitized);
  }
}

async function callClaude(scenario, fields) {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "YOUR_API_KEY_HERE") {
    throw new Error("API_KEY_MISSING");
  }

  const scenarioMeta = SCENARIOS.find(s => s.id === scenario);
  const fieldLines = Object.entries(fields)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toUpperCase()}: ${v}`)
    .join("\n");

  const userMessage = `SCENARIO: ${scenarioMeta.label}
GOAL: ${scenarioMeta.goal}

INPUT DETAILS:
${fieldLines}`;

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
      system: SYSTEM_PROMPT,
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
  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
  return safeParseJSON("{" + text);
}

// ─────────────────────────────────────────────────────────────────
// FIELD CONFIGS PER SCENARIO
// ─────────────────────────────────────────────────────────────────
const FIELD_CONFIG = {
  personName:    { label: "Their Name",                    ph: "e.g. Jean Hannon",              rows: 0 },
  personRole:    { label: "Their Role / Title",            ph: "e.g. Principal Consultant",     rows: 0 },
  company:       { label: "Company",                       ph: "e.g. The Pivot Group",          rows: 0 },
  chatDate:      { label: "When Did You Chat?",            ph: "e.g. Yesterday, Last Tuesday",  rows: 0 },
  interviewDate: { label: "Interview Date",                ph: "e.g. Today, Yesterday",         rows: 0 },
  appliedDate:   { label: "When Did You Apply?",           ph: "e.g. 2 weeks ago, March 15",    rows: 0 },
  sentDate:      { label: "When Did You Send?",            ph: "e.g. Last Monday, 6 days ago",  rows: 0 },
  roleTitle:     { label: "Role Title",                    ph: "e.g. Product Manager Intern",   rows: 0 },
  keyMoment:     { label: "One Specific Moment or Topic",  ph: "e.g. They mentioned they're scaling to 3 new cities and struggling with supply quality", rows: 2 },
  missedPoint:   { label: "Something You Forgot to Say",  ph: "e.g. I didn't mention that I built a city-by-city SOP that scaled ops to 35 cities", rows: 2 },
  originalAngle: { label: "Original Email's Main Point",  ph: "e.g. I focused on their supply gap problem and my 7,000 customer onboarding experience", rows: 2 },
  context:       { label: "Context for the Message",      ph: "e.g. We connected at a Fordham event, they posted about a new funding round, or I sent a cold message last week", rows: 2 },
  lastMessage:   { label: "Last Message You Sent Them",    ph: "Paste the last email, LinkedIn message, or key points from your last interaction — the follow-up will build directly on this", rows: 4 },
};

// ─────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────
function Pill({ word, variant = "default" }) {
  const v = {
    default: { bg: "#f0f2ff", color: "#6b7280", border: "#e5e7f0" },
    teal:    { bg: "#f0fdfa", color: "#0d9488", border: "#99f6e4" },
    violet:  { bg: "#faf5ff", color: "#7c3aed", border: "#ddd6fe" },
    blue:    { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
    amber:   { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
    rose:    { bg: "#fff1f2", color: "#e11d48", border: "#fecdd3" },
    green:   { bg: "#f0fdf4", color: "#059669", border: "#bbf7d0" },
  }[variant] || { bg: "#f0f2ff", color: "#6b7280", border: "#e5e7f0" };
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 20, fontSize: 11,
      background: v.bg, color: v.color, border: `1px solid ${v.border}`,
      fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", display: "inline-block"
    }}>{word}</span>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function FollowUpAgent() {
  const [activeScenario, setActiveScenario] = useState("coffee_chat");
  const [fields, setFields] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [activeOutput, setActiveOutput] = useState("email");
  const resultRef = useRef(null);

  const scenario = SCENARIOS.find(s => s.id === activeScenario);
  const accentColor = scenario.color;

  function setField(key, val) {
    setFields(prev => ({ ...prev, [key]: val }));
  }

  async function handleGenerate() {
    const required = ["personName", "company"];
    const missing = required.filter(f => scenario.fields.includes(f) && !fields[f]?.trim());
    if (missing.length) {
      setError("Please fill in name and company at minimum.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const data = await callClaude(activeScenario, fields);
      setResult(data);
      setActiveOutput(activeScenario === "linkedin" ? "linkedin" : "email");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      if (e.message === "API_KEY_MISSING") {
        setError("API key missing — paste your key at line 6 of FollowUpAgent.jsx");
      } else {
        setError(`Error: ${e.message}`);
      }
    }
    setLoading(false);
  }

  function copyText(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(""), 2500);
  }

  // Reset fields when scenario changes
  function switchScenario(id) {
    setActiveScenario(id);
    setFields({});
    setResult(null);
    setError("");
  }

  const pillVariants = {
    coffee_chat: "teal", interview: "violet", application: "blue",
    cold_email: "amber", linkedin: "rose"
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fe", fontFamily: "'Sora', sans-serif", color: "#1a1c2e", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea, input { font-family: inherit; }
        textarea { resize: vertical; }
        textarea:focus, input:focus { outline: none !important; box-shadow: 0 0 0 3px ${accentColor}18 !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #f8f9fe; }
        ::-webkit-scrollbar-thumb { background: #e2e4f0; border-radius: 2px; }
        .gen-btn { transition: all 0.2s; cursor: pointer; border: none; font-family: inherit; }
        .gen-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); }
        .gen-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .sc-btn { transition: all 0.18s; cursor: pointer; font-family: inherit; }
        .sc-btn:hover { transform: translateY(-1px); }
        .out-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; border: none; background: transparent; }
        pre { white-space: pre-wrap; word-break: break-word; }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e8eaf4", padding: "24px 40px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg, #0d9488, #7c3aed)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, boxShadow: "0 4px 20px #0d948820"
            }}>↩️</div>
            <div>
              <div style={{ fontSize: 10, color: "#0d9488", letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                Agent 07 · Job Search Suite
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: "#111328", lineHeight: 1 }}>
                Follow-Up Email Agent
              </h1>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 11, color: "#9ca3af", lineHeight: 1.9 }}>
              5 scenarios · Email + LinkedIn<br />
              Never "just following up" · Always specific
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["No 'I just wanted to follow up'", "Always reference something specific", "Max 150 words", "Give them a reason to reply", "Never beg"].map(r => (
              <Pill key={r} word={r} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 40px 0" }}>

        {/* ── SCENARIO SELECTOR ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 12 }}>
            Select Your Scenario
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            {SCENARIOS.map(sc => {
              const isActive = activeScenario === sc.id;
              return (
                <button key={sc.id} className="sc-btn" onClick={() => switchScenario(sc.id)} style={{
                  padding: "14px 10px", borderRadius: 12,
                  border: `1.5px solid ${isActive ? sc.color : "#e8eaf4"}`,
                  background: isActive ? `${sc.color}08` : "#ffffff",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  boxShadow: isActive ? `0 4px 16px ${sc.color}20` : "0 1px 4px #00000006",
                  textAlign: "center"
                }}>
                  <span style={{ fontSize: 22 }}>{sc.icon}</span>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? sc.color : "#374151", lineHeight: 1.3 }}>
                    {sc.label}
                  </div>
                  <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.3 }}>{sc.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── GOAL BANNER ── */}
        <div style={{
          background: `${accentColor}08`, border: `1px solid ${accentColor}25`,
          borderRadius: 10, padding: "10px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10
        }}>
          <span style={{ fontSize: 16 }}>{scenario.icon}</span>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: accentColor }}>Goal: </span>
            <span style={{ fontSize: 12, color: "#4b5563" }}>{scenario.goal}</span>
          </div>
        </div>

        {/* ── DYNAMIC FIELDS ── */}
        <div style={{ background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 14, padding: "22px 24px", marginBottom: 18, boxShadow: "0 1px 6px #00000006" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>
            Details
          </div>

          {/* Single-line fields row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
            {scenario.fields.filter(f => FIELD_CONFIG[f]?.rows === 0).map(fieldKey => {
              const cfg = FIELD_CONFIG[fieldKey];
              if (!cfg) return null;
              return (
                <div key={fieldKey}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>
                    {cfg.label}
                  </label>
                  <input
                    value={fields[fieldKey] || ""}
                    onChange={e => setField(fieldKey, e.target.value)}
                    placeholder={cfg.ph}
                    style={{
                      width: "100%", background: "#f8f9fe",
                      border: `1px solid #e8eaf4`,
                      borderRadius: 8, padding: "10px 12px",
                      color: "#1a1c2e", fontSize: 12.5,
                      transition: "border-color 0.2s"
                    }}
                    onFocus={e => e.target.style.borderColor = accentColor}
                    onBlur={e => e.target.style.borderColor = "#e8eaf4"}
                  />
                </div>
              );
            })}
          </div>

          {/* Multi-line fields */}
          {scenario.fields.filter(f => FIELD_CONFIG[f]?.rows > 0).map(fieldKey => {
            const cfg = FIELD_CONFIG[fieldKey];
            if (!cfg) return null;
            return (
              <div key={fieldKey} style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>
                  {cfg.label}
                  <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400, marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>
                    — the more specific, the better
                  </span>
                </label>
                <textarea
                  value={fields[fieldKey] || ""}
                  onChange={e => setField(fieldKey, e.target.value)}
                  placeholder={cfg.ph}
                  rows={cfg.rows + 1}
                  style={{
                    width: "100%", background: "#f8f9fe",
                    border: "1px solid #e8eaf4",
                    borderRadius: 8, padding: "10px 12px",
                    color: "#1a1c2e", fontSize: 12.5, lineHeight: 1.65,
                    transition: "border-color 0.2s"
                  }}
                  onFocus={e => e.target.style.borderColor = accentColor}
                  onBlur={e => e.target.style.borderColor = "#e8eaf4"}
                />
              </div>
            );
          })}
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "11px 16px", marginBottom: 14, color: "#e11d48", fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── GENERATE BUTTON ── */}
        <button className="gen-btn" onClick={handleGenerate} disabled={loading} style={{
          width: "100%", padding: "15px 0", borderRadius: 12,
          background: loading ? "#e8eaf4" : `linear-gradient(135deg, ${accentColor}, ${scenario.color}dd)`,
          color: loading ? "#9ca3af" : "#ffffff",
          fontSize: 14, fontWeight: 700, letterSpacing: 0.4,
          boxShadow: loading ? "none" : `0 4px 20px ${accentColor}25`
        }}>
          {loading ? `${scenario.icon}  Writing your follow-up...` : `${scenario.icon}  Generate Follow-Up`}
        </button>

        {/* ── RESULTS ── */}
        {result && (
          <div ref={resultRef} className="fade-in" style={{ marginTop: 36 }}>

            {/* Meta strip */}
            <div style={{
              background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 14,
              padding: "14px 20px", marginBottom: 20, boxShadow: "0 1px 6px #00000006",
              display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center"
            }}>
              <div>
                <div style={{ fontSize: 9, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>To</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111328" }}>{result.recipient_name}</div>
              </div>
              <div style={{ width: 1, height: 30, background: "#e8eaf4" }} />
              <div>
                <div style={{ fontSize: 9, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Scenario</div>
                <Pill word={scenario.label} variant={pillVariants[activeScenario]} />
              </div>
              <div style={{ width: 1, height: 30, background: "#e8eaf4" }} />
              <div>
                <div style={{ fontSize: 9, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Word Count</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: result.word_count <= 150 ? "#059669" : "#d97706", fontFamily: "'DM Mono', monospace" }}>
                  {result.word_count}w {result.word_count <= 150 ? "✓" : "⚠ trim this"}
                </div>
              </div>
              <div style={{ width: 1, height: 30, background: "#e8eaf4" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Best Time to Send</div>
                <div style={{ fontSize: 12, color: "#4b5563" }}>{result.timing_advice}</div>
              </div>
            </div>

            {/* Insights row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div style={{ background: `${accentColor}06`, border: `1px solid ${accentColor}20`, borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 10, color: accentColor, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>What Makes This Work</div>
                <p style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>{result.key_hook}</p>
              </div>
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 10, color: "#d97706", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>Common Mistake to Avoid</div>
                <p style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>{result.what_to_avoid}</p>
              </div>
            </div>

            {/* Output tabs — Email vs LinkedIn */}
            {result.message_linkedin && (
              <div style={{ display: "flex", borderBottom: "1px solid #e8eaf4", marginBottom: 0 }}>
                {[
                  { id: "email", label: "📧 Email Version" },
                  { id: "linkedin", label: "💼 LinkedIn Version" }
                ].map(tab => (
                  <button key={tab.id} className="out-btn" onClick={() => setActiveOutput(tab.id)} style={{
                    flex: 1, padding: "11px 0", fontSize: 13, fontWeight: 600,
                    color: activeOutput === tab.id ? accentColor : "#9ca3af",
                    borderBottom: `2px solid ${activeOutput === tab.id ? accentColor : "transparent"}`,
                    background: activeOutput === tab.id ? `${accentColor}05` : "transparent"
                  }}>{tab.label}</button>
                ))}
              </div>
            )}

            {/* Subject line */}
            {activeOutput === "email" && result.subject_line && (
              <div style={{
                background: "#f8f9fe", border: "1px solid #e8eaf4",
                borderTop: result.message_linkedin ? "none" : "1px solid #e8eaf4",
                padding: "12px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", flexShrink: 0 }}>Subject</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#111328", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {result.subject_line}
                  </span>
                </div>
                <button onClick={() => copyText(result.subject_line, "subject")} style={{
                  padding: "5px 12px", borderRadius: 6, border: `1px solid ${accentColor}30`,
                  background: copied === "subject" ? "#f0fdf4" : "transparent",
                  color: copied === "subject" ? "#059669" : accentColor,
                  fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0
                }}>
                  {copied === "subject" ? "✅" : "Copy"}
                </button>
              </div>
            )}

            {/* Alt subjects */}
            {activeOutput === "email" && result.subject_line_alternatives?.length > 0 && (
              <div style={{
                background: "#fafbff", border: "1px solid #e8eaf4", borderTop: "none",
                padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap"
              }}>
                <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", flexShrink: 0 }}>Alt Subjects</span>
                {result.subject_line_alternatives.map((alt, i) => (
                  <button key={i} onClick={() => copyText(alt, `alt${i}`)} style={{
                    background: "#f0f2ff", border: "1px solid #e0e3f8", borderRadius: 6,
                    padding: "4px 10px", fontSize: 11, color: "#4b5563", cursor: "pointer",
                    fontFamily: "inherit", transition: "all 0.15s"
                  }}>
                    {copied === `alt${i}` ? "✅ Copied" : alt}
                  </button>
                ))}
              </div>
            )}

            {/* Message body */}
            <div style={{
              background: "#ffffff",
              border: "1px solid #e8eaf4",
              borderTop: (result.subject_line || result.message_linkedin) ? "none" : "1px solid #e8eaf4",
              padding: "28px 32px",
              borderRadius: (!result.subject_line && !result.message_linkedin) ? 14 : "0"
            }}>
              <pre style={{
                fontSize: 14, color: "#1a1c2e", lineHeight: 2,
                fontFamily: "'Sora', sans-serif", fontWeight: 400
              }}>
                {activeOutput === "linkedin" ? result.message_linkedin : result.message}
              </pre>
            </div>

            {/* Copy bar */}
            <div style={{
              background: "#f8f9fe", border: "1px solid #e8eaf4", borderTop: "none",
              borderRadius: "0 0 14px 14px", padding: "12px 16px",
              display: "flex", gap: 8
            }}>
              <button onClick={() => copyText(
                activeOutput === "linkedin" ? result.message_linkedin :
                (result.subject_line ? `Subject: ${result.subject_line}\n\n${result.message}` : result.message),
                "full"
              )} style={{
                flex: 1, padding: "10px", borderRadius: 8,
                border: `1px solid ${copied === "full" ? "#bbf7d0" : "#e8eaf4"}`,
                background: copied === "full" ? "#f0fdf4" : "transparent",
                color: copied === "full" ? "#059669" : "#6b7280",
                fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.15s"
              }}>
                {copied === "full"
                  ? "✅ Copied!"
                  : activeOutput === "linkedin"
                    ? "📋 Copy LinkedIn Message"
                    : "📋 Copy Full Email (Subject + Body)"}
              </button>
              {result.message_linkedin && activeOutput === "email" && (
                <button onClick={() => copyText(result.message_linkedin, "li")} style={{
                  padding: "10px 16px", borderRadius: 8,
                  border: "1px solid #e8eaf4", background: "transparent",
                  color: copied === "li" ? "#059669" : "#9ca3af",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit"
                }}>
                  {copied === "li" ? "✅" : "Copy LinkedIn Too"}
                </button>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
