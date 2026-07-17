import { useState, useRef } from "react";

// All API calls go through the serverless proxy — key never in the browser
const API_URL = "/api/claude";
// LOCAL DEV FALLBACK: with REACT_APP_ANTHROPIC_KEY in .env, plain `npm start`
// works. In Vercel, DELETE that env var so production uses the proxy.
const DEV_KEY = process.env.REACT_APP_ANTHROPIC_KEY;
const apiUrl = () => (DEV_KEY ? "https://api.anthropic.com/v1/messages" : API_URL);
const apiHeaders = () =>
  DEV_KEY
    ? { "Content-Type": "application/json", "x-api-key": DEV_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }
    : { "Content-Type": "application/json" };

// ── STORY BANK — durable STAR stories linked to resume claims ──
const STORY_BANK_KEY = "jobsuite_story_bank";
function loadStories() {
  try { return JSON.parse(localStorage.getItem(STORY_BANK_KEY)) || []; } catch { return []; }
}
function saveStory(story) {
  const all = [story, ...loadStories()].slice(0, 40);
  try { localStorage.setItem(STORY_BANK_KEY, JSON.stringify(all)); } catch {}
  return all;
}
function deleteStory(id) {
  const all = loadStories().filter((s) => s.id !== id);
  try { localStorage.setItem(STORY_BANK_KEY, JSON.stringify(all)); } catch {}
  return all;
}

// Quantified claims from the saved base resume (Resume Tailor stores it) —
// every one of these is a claim an interviewer will probe. Each needs a story.
function resumeClaims() {
  const base = localStorage.getItem("tailor_sunny_base_resume") || "";
  return base
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => (l.startsWith("\u2022") || l.startsWith("-")) && /\d/.test(l))
    .map((l) => l.replace(/^[\u2022-]\s*/, "").slice(0, 110))
    .slice(0, 12);
}

// ─────────────────────────────────────────────────────────────────
// CANDIDATE
// ─────────────────────────────────────────────────────────────────
const CANDIDATE_BASE = `Sunny Bhargava | MBA Candidate, Fordham Gabelli (2027) | Dean's Scholar | IIT-ISM B.Tech
~10 years ops + PM experience. Key achievements:
- Scaled subscription platform 200→11,000 users (55x), +12% revenue, +40% activation (Livguard PM)
- Onboarded 7,000 customers across 35+ cities via city-by-city SOPs (Livguard Ops)
- Cut payment defaults 20%, grew revenue 15% via KYC/fraud controls
- Reduced fleet breakdowns 10%, inventory excess 50% via telematics + forecasting (Tata Hitachi)
- Led 70-person cross-functional team, 40% MoM customer acquisition growth
- Built AI-powered job search agent suite (React, OpenAI API) — currently in use
Skills: SQL, Python, Power BI, Jira, Figma | PRDs, Roadmaps, A/B Testing, Cross-functional Alignment`;

// Merged candidate context — base always included, pasted resume appended if provided
const buildCandidateBG = (resumeText) => resumeText?.trim()
  ? `${CANDIDATE_BASE}

FULL RESUME (use this for story mining and question calibration):
${resumeText.trim()}`
  : CANDIDATE_BASE;

// ─────────────────────────────────────────────────────────────────
// TRACKS & COMPANIES
// ─────────────────────────────────────────────────────────────────
const TRACKS = [
  { id: "pm",         label: "PM — Tech",          icon: "📱", color: "#7c3aed", desc: "Product sense, prioritization, metrics, roadmap" },
  { id: "ops",        label: "Ops / Strategy",      icon: "⚙️", color: "#0d9488", desc: "Execution, scaling, cross-functional, data-driven" },
  { id: "consulting", label: "Consulting",           icon: "📊", color: "#2563eb", desc: "Structured thinking, MECE, stakeholder management" },
  { id: "startup",    label: "Startup Generalist",  icon: "🚀", color: "#d97706", desc: "Ambiguity, 0→1 building, bias for action" },
  { id: "amazon",     label: "Amazon",               icon: "📦", color: "#FF9900", desc: "16 Leadership Principles — LP-tagged questions" },
  { id: "google",     label: "Google",               icon: "🔍", color: "#4285F4", desc: "Googleyness, role-related knowledge, general cognitive" },
  { id: "microsoft",  label: "Microsoft",            icon: "🪟", color: "#00A4EF", desc: "Growth mindset, collaboration, customer obsession" },
  { id: "netflix",    label: "Netflix",              icon: "🎬", color: "#E50914", desc: "Keeper Test culture, high performance, context not control" },
];

const MODES = [
  { id: "bank",  icon: "📋", label: "Question Bank",   desc: "Get 8 calibrated questions for your role" },
  { id: "grade", icon: "🎯", label: "Answer Grader",   desc: "Paste your answer — get scored + coached" },
  { id: "mock",  icon: "🎤", label: "Full Mock",       desc: "Live interview — question → answer → feedback → next" },
  { id: "stories", icon: "📚", label: "Story Bank",     desc: "Your saved STAR stories, mapped to resume claims" },
];

// ─────────────────────────────────────────────────────────────────
// COMPANY FRAMEWORKS
// ─────────────────────────────────────────────────────────────────
const COMPANY_FRAMEWORKS = {
  amazon: `Amazon uses the Leadership Principles (LPs) framework. Every behavioral question maps to 1-2 LPs.
The 16 LPs: Customer Obsession, Ownership, Invent and Simplify, Are Right A Lot, Learn and Be Curious, Hire and Develop the Best, Insist on the Highest Standards, Think Big, Bias for Action, Frugality, Earn Trust, Dive Deep, Have Backbone Disagree and Commit, Deliver Results, Strive to be Earth's Best Employer, Success and Scale Bring Broad Responsibility.
Amazon uses the STAR format strictly. Interviewers probe for: specific actions YOU took (not the team), measurable results, scale of impact, what you would do differently.
Red flags Amazon hates: "we" without clarifying your specific role, vague metrics, not knowing your numbers, no pushback moment (Have Backbone), no failure story.`,

  google: `Google behavioral interviews assess: Googleyness (comfortable with ambiguity, works well with teams, does the right thing), Role-Related Knowledge, General Cognitive Ability (how you think, not just what you did).
Google uses the STAR format but also values "what did you learn?" and "what would you do differently?".
Google values: intellectual humility, data-driven decisions, thinking at scale, collaboration over hierarchy.
Red flags Google hates: arrogance, not crediting teammates, no learning from failure, over-polished answers that sound rehearsed.`,

  microsoft: `Microsoft behavioral interviews center on Growth Mindset (Carol Dweck). They want to see: learning from failure, seeking feedback, developing others, clarity about customers.
Microsoft asks a lot about: collaboration with difficult people, times you changed your mind based on data, how you developed team members.
Microsoft values: empathy, clarity, the ability to "model, coach, care" for teams.
Red flags: fixed mindset answers ("I've always been good at X"), no mention of feedback or iteration, individual heroics without team development.`,

  netflix: `Netflix culture is unique: high performance, radical candor, context not control, the Keeper Test.
Netflix behavioral questions probe: Would your manager fight to keep you? Can you make great decisions with minimal oversight? Do you give and receive direct feedback?
Netflix values: judgment over process, impact over effort, candor over diplomacy.
Netflix asks: "Tell me about a time you disagreed with your manager and what happened." "Tell me about a decision you made with incomplete information." "Tell me about feedback you received that was hard to hear."
Red flags Netflix hates: rule-following without judgment, process over outcome, inability to give direct feedback, team-wide credit without individual ownership.`,
};

// ─────────────────────────────────────────────────────────────────
// SYSTEM PROMPTS
// ─────────────────────────────────────────────────────────────────
const PROMPT_BANK = (track, company, jobTitle, jd, resumeText) => {
  const framework = COMPANY_FRAMEWORKS[track] || "";
  return `You are a senior hiring manager and interview coach who has conducted 500+ behavioral interviews across PM, Operations, Consulting, and FAANG companies.

CANDIDATE:
${buildCandidateBG(resumeText)}

${framework ? `COMPANY FRAMEWORK:\n${framework}\n` : ""}

TASK: Generate exactly 8 behavioral interview questions for this candidate.

TRACK: ${track}
${jobTitle ? `ROLE: ${jobTitle}` : ""}
${jd ? `JD CONTEXT: ${jd}` : ""}

RULES:
- Questions must be calibrated to THIS candidate's background — reference their industry/scale where relevant
- Questions must test competencies actually needed for this role
- Mix difficulty: 2 warm-up, 4 core, 2 stretch/hard
- For FAANG: tag each question with the specific LP/competency it tests
- Include "tell me about a time..." format AND situational ("how would you...") format
- Include at least 1 failure/challenge question
- Include at least 1 data/metrics question
- Questions should expose gaps an international candidate might have (US market unfamiliarity, team size, brand name)

RESPOND IN RAW JSON ONLY — no preamble, no markdown:
{
  "track": "${track}",
  "role": "${jobTitle || track}",
  "questions": [
    {
      "id": 1,
      "question": "full question text",
      "competency": "e.g. Ownership / Bias for Action / Stakeholder Management",
      "lp_tag": "LP name if FAANG else null",
      "difficulty": "warm-up | core | stretch",
      "what_they_want": "2 sentences on what a strong answer looks like for THIS role",
      "watch_out": "1 sentence on the trap or common mistake in this question"
    }
  ],
  "prep_tip": "One honest paragraph of advice for this specific track and candidate background"
}`;
};

const PROMPT_GRADE = (track, company, question, answer, resumeText) => {
  const framework = COMPANY_FRAMEWORKS[track] || "";
  return `You are a senior hiring manager who has conducted 500+ behavioral interviews. You give honest, direct feedback — not encouraging fluff.

CANDIDATE:
${buildCandidateBG(resumeText)}

${framework ? `COMPANY FRAMEWORK:\n${framework}\n` : ""}

TRACK: ${track}
QUESTION: ${question}
CANDIDATE'S ANSWER: ${answer}

TASK: Grade this answer on the STAR framework and give actionable coaching.

GRADING RUBRIC (total 100 points):
- Situation Clarity (0-20): Context set without over-explaining. Clear who, what, when.
- Task Ownership (0-20): YOUR role is unambiguous. Not "we". Specific responsibility stated.
- Action Specificity (0-30): Actions are concrete, decision-driven, YOUR choices. Not vague "led" or "managed".
- Result Quantification (0-30): Impact is measured. Numbers, percentages, timelines. Credible and specific.

RED FLAGS TO CHECK:
- Overuse of "we" without stating individual role
- No metrics or vague metrics ("significantly improved")
- Passive language ("was responsible for" instead of "I decided/built/cut")
- Answer too long (over 3 minutes spoken = too long)
- No clear personal decision or judgment call
- Sounds rehearsed / generic / could apply to any candidate
- Missing learning or reflection (especially for Google/Microsoft/Netflix)

RESPOND IN RAW JSON ONLY:
{
  "overall_score": 72,
  "grade": "B",
  "verdict": "One honest sentence summary of the answer quality",
  "scores": {
    "situation": { "score": 15, "max": 20, "feedback": "specific feedback" },
    "task": { "score": 14, "max": 20, "feedback": "specific feedback" },
    "action": { "score": 22, "max": 30, "feedback": "specific feedback" },
    "result": { "score": 21, "max": 30, "feedback": "specific feedback" }
  },
  "red_flags": ["flag 1 if present", "flag 2 if present"],
  "strengths": ["what worked well — be specific"],
  "improvements": ["specific change 1", "specific change 2"],
  "rewritten_opening": "Rewrite just the first 2 sentences of their answer to show them a stronger opener",
  "follow_up_question": "The follow-up question this interviewer would ask next based on gaps in this answer",
  "lp_alignment": "If FAANG track: which LP this maps to and how well it demonstrates it. Otherwise null."
}`;
};

const PROMPT_MOCK_START = (track, company, jobTitle, jd, resumeText) => {
  const framework = COMPANY_FRAMEWORKS[track] || "";
  return `You are conducting a live behavioral interview. You ask ONE question at a time. After the candidate answers, you give coaching feedback, then ask the next question. You are direct and honest — not a cheerleader.

CANDIDATE:
${buildCandidateBG(resumeText)}

${framework ? `COMPANY FRAMEWORK:\n${framework}\n` : ""}

TRACK: ${track}
${jobTitle ? `ROLE: ${jobTitle}` : ""}
${jd ? `JD CONTEXT: ${jd}` : ""}

INTERVIEW RULES:
- Ask exactly ONE question per turn
- After candidate answers: give 3-4 lines of honest coaching (what worked, what to fix)
- Then ask the next question — build on gaps from previous answer
- Run 5 questions total then give a final assessment
- For FAANG: label each question with the LP/competency being tested
- Never be sycophantic — "great answer" is banned unless it actually was great
- Track question count internally

RESPOND IN RAW JSON ONLY per turn:
{
  "turn": 1,
  "type": "question",
  "lp_tag": "LP if FAANG else null",
  "competency": "competency being tested",
  "question": "the interview question",
  "context": "1 sentence on why you're asking this first"
}`;
};

const PROMPT_MOCK_FEEDBACK = (track, question, answer, turnNumber, resumeText) => {
  const framework = COMPANY_FRAMEWORKS[track] || "";
  const isFinal = turnNumber >= 5;
  return `You are conducting turn ${turnNumber} of a live behavioral interview.

CANDIDATE BACKGROUND:
${buildCandidateBG(resumeText)}

${framework ? `COMPANY FRAMEWORK:\n${framework}\n` : ""}

QUESTION ASKED: ${question}
CANDIDATE ANSWER: ${answer}
TURN NUMBER: ${turnNumber}
IS FINAL TURN: ${isFinal}

${isFinal ? `This is the last question. After feedback, provide a full interview assessment instead of another question.` : `After feedback, ask the next question. Build on gaps from this answer.`}

RESPOND IN RAW JSON ONLY:
{
  "turn": ${turnNumber},
  "type": "${isFinal ? "final" : "feedback_and_question"}",
  "feedback": {
    "score": 72,
    "verdict": "honest 1-sentence summary",
    "what_worked": "specific strength",
    "what_to_fix": "specific gap — be direct",
    "red_flag": "red flag if present else null"
  },
  ${isFinal ? `"final_assessment": {
    "overall_score": 74,
    "hire_recommendation": "Strong Yes | Yes | Maybe | No",
    "summary": "2-3 honest sentences on overall interview performance",
    "top_strength": "their single strongest competency demonstrated",
    "critical_gap": "the one thing that would cost them the offer",
    "top_3_improvements": ["improvement 1", "improvement 2", "improvement 3"]
  }` : `"next_question": {
    "lp_tag": "LP if FAANG else null",
    "competency": "competency being tested",
    "question": "next interview question",
    "why_this_next": "1 sentence on why this question follows from the gap identified"
  }`}
}`;
};

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
  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 3000,
      system: systemPrompt + "\n\nIMPORTANT: Respond with ONLY the raw JSON object. Start with { and end with }. No preamble, no markdown fences.",
      messages: [{ role: "user", content: userMessage }]
    })
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || `API error ${res.status}`); }
  const data = await res.json();
  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
  return safeParseJSON(text);
}

// ─────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────
function ScoreBar({ label, score, max, feedback, color }) {
  const pct = Math.round((score / max) * 100);
  const barColor = pct >= 75 ? "#059669" : pct >= 50 ? "#d97706" : "#e11d48";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: barColor }}>{score}/{max}</span>
      </div>
      <div style={{ height: 6, background: "#e8eaf4", borderRadius: 3, marginBottom: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3, transition: "width 0.8s ease" }} />
      </div>
      <p style={{ fontSize: 11.5, color: "#6b7280", lineHeight: 1.5 }}>{feedback}</p>
    </div>
  );
}

function ScoreBadge({ score, size = "normal" }) {
  const color = score >= 80 ? "#059669" : score >= 65 ? "#d97706" : "#e11d48";
  const bg = score >= 80 ? "#f0fdf4" : score >= 65 ? "#fffbeb" : "#fff1f2";
  const sz = size === "large" ? { w: 72, h: 72, fs: 24 } : { w: 48, h: 48, fs: 16 };
  return (
    <div style={{
      width: sz.w, height: sz.h, borderRadius: "50%",
      background: bg, border: `2px solid ${color}40`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 0 20px ${color}20`
    }}>
      <span style={{ fontSize: sz.fs, fontWeight: 800, color, fontFamily: "'DM Mono', monospace" }}>{score}</span>
    </div>
  );
}

function Pill({ word, variant = "default" }) {
  const v = {
    default: { bg: "#f0f2ff", color: "#6b7280", border: "#e5e7f0" },
    green:   { bg: "#f0fdf4", color: "#059669", border: "#bbf7d0" },
    amber:   { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
    red:     { bg: "#fff1f2", color: "#e11d48", border: "#fecdd3" },
    blue:    { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
    violet:  { bg: "#faf5ff", color: "#7c3aed", border: "#ddd6fe" },
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
export default function BehavioralCoach() {
  const [activeTrack, setActiveTrack] = useState("pm");
  const [activeMode, setActiveMode] = useState("bank");
  const [jobTitle, setJobTitle] = useState("");
  const [jd, setJd] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [showResume, setShowResume] = useState(true);

  // Mode: bank
  const [bankResult, setBankResult] = useState(null);
  const [selectedQ, setSelectedQ] = useState(null);

  // Mode: grade
  const [gradeQuestion, setGradeQuestion] = useState("");
  const [gradeAnswer, setGradeAnswer] = useState("");
  const [gradeResult, setGradeResult] = useState(null);

  // Mode: mock
  const [mockStarted, setMockStarted] = useState(false);
  const [mockTurns, setMockTurns] = useState([]);
  const [mockAnswer, setMockAnswer] = useState("");
  const [mockEnded, setMockEnded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  // Story bank
  const [stories, setStories] = useState(() => loadStories());
  const [storyClaim, setStoryClaim] = useState("");
  const [storySaved, setStorySaved] = useState(false);
  const claims = resumeClaims();

  function handleSaveStory() {
    if (!gradeAnswer.trim()) return;
    setStories(saveStory({
      id: Date.now(),
      title: (gradeQuestion || "Untitled story").slice(0, 90),
      competency: gradeResult?.scores ? Object.keys(gradeResult.scores).join(", ") : track.label,
      claim: storyClaim,
      answer: gradeAnswer,
      score: gradeResult?.overall_score || null,
      date: new Date().toISOString().slice(0, 10),
    }));
    setStorySaved(true);
    setTimeout(() => setStorySaved(false), 3000);
  }
  const resultRef = useRef(null);
  const mockBottomRef = useRef(null);

  const track = TRACKS.find(t => t.id === activeTrack);

  function copyText(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(""), 2500);
  }

  function resetMode() {
    setBankResult(null); setSelectedQ(null);
    setGradeResult(null); setGradeQuestion(""); setGradeAnswer("");
    setMockStarted(false); setMockTurns([]); setMockAnswer(""); setMockEnded(false);
    setError("");
  }

  // ── MODE: BANK ──
  async function handleBank() {
    setLoading(true); setError(""); setBankResult(null);
    try {
      const r = await apiCallJSON(PROMPT_BANK(activeTrack, activeTrack, jobTitle, jd, resumeText), "Generate the question bank now.");
      setBankResult(r);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setError(e.message === "API_KEY_MISSING" ? "API key missing — paste it at line 4." : `Error: ${e.message}`);
    }
    setLoading(false);
  }

  // ── MODE: GRADE ──
  async function handleGrade() {
    if (!gradeQuestion.trim() || !gradeAnswer.trim()) { setError("Paste both the question and your answer."); return; }
    setLoading(true); setError(""); setGradeResult(null);
    try {
      const r = await apiCallJSON(PROMPT_GRADE(activeTrack, activeTrack, gradeQuestion, gradeAnswer, resumeText), "Grade this answer now.");
      setGradeResult(r);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setError(e.message === "API_KEY_MISSING" ? "API key missing." : `Error: ${e.message}`);
    }
    setLoading(false);
  }

  // ── MODE: MOCK — START ──
  async function handleMockStart() {
    setLoading(true); setError(""); setMockTurns([]); setMockEnded(false); setMockStarted(false);
    try {
      const r = await apiCallJSON(PROMPT_MOCK_START(activeTrack, activeTrack, jobTitle, jd, resumeText), "Start the mock interview now. Ask the first question.");
      setMockTurns([{ type: "question", data: r }]);
      setMockStarted(true);
      setTimeout(() => mockBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setError(e.message === "API_KEY_MISSING" ? "API key missing." : `Error: ${e.message}`);
    }
    setLoading(false);
  }

  // ── MODE: MOCK — SUBMIT ANSWER ──
  async function handleMockAnswer() {
    if (!mockAnswer.trim()) { setError("Type your answer first."); return; }
    const lastQ = [...mockTurns].reverse().find(t => t.type === "question");
    if (!lastQ) return;
    const turnNum = mockTurns.filter(t => t.type === "question").length;
    const newTurns = [...mockTurns, { type: "answer", text: mockAnswer }];
    setMockTurns(newTurns);
    setMockAnswer("");
    setLoading(true); setError("");
    try {
      const r = await apiCallJSON(
        PROMPT_MOCK_FEEDBACK(activeTrack, lastQ.data.question, mockAnswer, turnNum, resumeText),
        "Provide feedback and next question."
      );
      const updatedTurns = [...newTurns, { type: "feedback", data: r }];
      if (r.type === "final") {
        setMockEnded(true);
      } else {
        updatedTurns.push({ type: "question", data: { ...r.next_question, turn: turnNum + 1 } });
      }
      setMockTurns(updatedTurns);
      setTimeout(() => mockBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setError(`Error: ${e.message}`);
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fe", fontFamily: "'Sora', sans-serif", color: "#1a1c2e", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea, input { font-family: inherit; }
        textarea { resize: vertical; }
        textarea:focus, input:focus { outline: none !important; border-color: ${track.color} !important; box-shadow: 0 0 0 3px ${track.color}18 !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #f8f9fe; }
        ::-webkit-scrollbar-thumb { background: #e2e4f0; border-radius: 2px; }
        .btn { transition: all 0.18s; cursor: pointer; border: none; font-family: inherit; }
        .btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
        .btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .track-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; }
        .mode-btn { transition: all 0.15s; cursor: pointer; font-family: inherit; border: none; background: transparent; }
        pre { white-space: pre-wrap; word-break: break-word; }
        .fade { animation: fadeIn 0.35s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e8eaf4", padding: "22px 40px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg, ${track.color}, ${track.color}bb)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, boxShadow: `0 4px 20px ${track.color}28`, transition: "background 0.3s"
            }}>🎤</div>
            <div>
              <div style={{ fontSize: 10, color: track.color, letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 4, transition: "color 0.3s" }}>
                Agent 09 · Job Search Suite
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: "#111328", lineHeight: 1 }}>
                Behavioral Interview Coach
              </h1>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 11, color: "#9ca3af", lineHeight: 1.9 }}>
              STAR grading · FAANG frameworks · 3 practice modes<br />
              Honest feedback · No cheerleading
            </div>
          </div>
          {/* Mode selector */}
          <div style={{ display: "flex", gap: 8 }}>
            {MODES.map(m => (
              <button key={m.id} className="mode-btn" onClick={() => { setActiveMode(m.id); resetMode(); }} style={{
                flex: 1, padding: "10px 14px", borderRadius: 10,
                border: `1.5px solid ${activeMode === m.id ? track.color : "#e8eaf4"}`,
                background: activeMode === m.id ? `${track.color}08` : "#fafbff",
                display: "flex", alignItems: "center", gap: 8
              }}>
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: activeMode === m.id ? track.color : "#374151" }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>{m.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "26px 40px 0" }}>

        {/* ── RESUME INPUT ── */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setShowResume(!showResume)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: showResume ? track.color : "#6b7280",
              fontWeight: 600, fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 7, marginBottom: showResume ? 10 : 0,
              transition: "color 0.15s"
            }}
          >
            <span style={{ display: "inline-block", transition: "transform 0.2s", transform: showResume ? "rotate(90deg)" : "none", fontSize: 9 }}>▶</span>
            {resumeText.trim()
              ? `✓ Resume loaded — ${resumeText.trim().split(" ").length} words · Click to edit`
              : "Paste your resume — questions and stories will be calibrated to your specific background"}
          </button>
          {showResume && (
            <div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 8 }}>
                Your base profile is pre-loaded. Pasting the full resume here lets the agent mine your actual stories, use your real metrics, and ask questions based on gaps in YOUR background — not a generic profile.
              </div>
              <textarea
                value={resumeText}
                onChange={e => setResumeText(e.target.value)}
                rows={8}
                placeholder={`Paste your full resume here — all sections including Experience, Education, Skills, Projects...\n\nThe agent will:\n• Generate questions based on YOUR stories and gaps\n• Reference your actual metrics when grading answers\n• Suggest which experiences to draw on for each competency`}
                style={{
                  width: "100%", background: "#ffffff",
                  border: `1px solid ${resumeText.trim() ? track.color + "40" : "#e8eaf4"}`,
                  borderRadius: 10, padding: "12px 14px", color: "#1a1c2e",
                  fontSize: 12.5, lineHeight: 1.7,
                  transition: "border-color 0.2s",
                  boxShadow: resumeText.trim() ? `0 0 0 3px ${track.color}10` : "none"
                }}
              />
              {resumeText.trim() && (
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>
                    ✓ {resumeText.trim().split(" ").length} words loaded
                  </span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>— all 3 modes will now use your full resume for context</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── TRACK SELECTOR ── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 10 }}>
            Interview Track
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {TRACKS.map(t => {
              const isActive = activeTrack === t.id;
              return (
                <button key={t.id} className="track-btn" onClick={() => { setActiveTrack(t.id); resetMode(); }} style={{
                  padding: "12px 10px", borderRadius: 10, textAlign: "center",
                  border: `1.5px solid ${isActive ? t.color : "#e8eaf4"}`,
                  background: isActive ? `${t.color}08` : "#ffffff",
                  boxShadow: isActive ? `0 3px 14px ${t.color}20` : "0 1px 4px #00000005"
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? t.color : "#374151", marginBottom: 3 }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.3 }}>{t.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── ROLE CONTEXT (shared) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
              Role Title <span style={{ color: "#9ca3af", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
            </label>
            <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
              placeholder="e.g. Product Manager Intern"
              style={{ width: "100%", background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 8, padding: "10px 12px", color: "#1a1c2e", fontSize: 12.5 }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
              Job Description <span style={{ color: "#9ca3af", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional but improves calibration)</span>
            </label>
            <input value={jd} onChange={e => setJd(e.target.value)}
              placeholder="Paste key requirements or the full JD..."
              style={{ width: "100%", background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 8, padding: "10px 12px", color: "#1a1c2e", fontSize: 12.5 }} />
          </div>
        </div>

        {/* ══════════════════════════════
            MODE: QUESTION BANK
        ══════════════════════════════ */}
        {activeMode === "bank" && (
          <div>
            <button className="btn" onClick={handleBank} disabled={loading} style={{
              width: "100%", padding: "14px", borderRadius: 12,
              background: loading ? "#e8eaf4" : `linear-gradient(135deg, ${track.color}, ${track.color}cc)`,
              color: loading ? "#9ca3af" : "#ffffff", fontSize: 14, fontWeight: 700,
              boxShadow: loading ? "none" : `0 4px 20px ${track.color}28`
            }}>
              {loading ? "📋  Generating questions..." : `📋  Generate 8 ${track.label} Questions`}
            </button>

            {bankResult && (
              <div ref={resultRef} className="fade" style={{ marginTop: 28 }}>
                {bankResult.prep_tip && (
                  <div style={{ background: `${track.color}08`, border: `1px solid ${track.color}25`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 12.5, color: "#374151", lineHeight: 1.65 }}>
                    <span style={{ fontWeight: 700, color: track.color }}>Prep Tip: </span>{bankResult.prep_tip}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {bankResult.questions?.map((q, i) => {
                    const diffColor = q.difficulty === "warm-up" ? "#059669" : q.difficulty === "stretch" ? "#e11d48" : "#d97706";
                    const isOpen = selectedQ === i;
                    return (
                      <div key={i} style={{
                        background: "#ffffff", border: `1px solid ${isOpen ? track.color : "#e8eaf4"}`,
                        borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px #00000006",
                        transition: "border-color 0.2s"
                      }}>
                        <button className="btn" onClick={() => setSelectedQ(isOpen ? null : i)}
                          style={{ width: "100%", padding: "14px 18px", background: "transparent", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                            background: `${track.color}12`, border: `1px solid ${track.color}25`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 800, color: track.color, fontFamily: "'DM Mono', monospace"
                          }}>{q.id}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1c2e", lineHeight: 1.4, marginBottom: 5 }}>{q.question}</div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <Pill word={q.competency} variant="blue" />
                              {q.lp_tag && <Pill word={`LP: ${q.lp_tag}`} variant="violet" />}
                              <span style={{ fontSize: 10, fontWeight: 700, color: diffColor, background: `${diffColor}10`, border: `1px solid ${diffColor}25`, padding: "2px 8px", borderRadius: 20, fontFamily: "'DM Mono', monospace" }}>
                                {q.difficulty}
                              </span>
                            </div>
                          </div>
                          <span style={{ color: "#9ca3af", fontSize: 14, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none" }}>▼</span>
                        </button>

                        {isOpen && (
                          <div className="fade" style={{ padding: "0 18px 16px", borderTop: `1px solid ${track.color}15` }}>
                            <div style={{ paddingTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px" }}>
                                <div style={{ fontSize: 10, color: "#059669", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>What They Want</div>
                                <p style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>{q.what_they_want}</p>
                              </div>
                              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "10px 14px" }}>
                                <div style={{ fontSize: 10, color: "#d97706", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>Watch Out For</div>
                                <p style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>{q.watch_out}</p>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <button className="btn" onClick={() => {
                                setActiveMode("grade");
                                setGradeQuestion(q.question);
                                resetMode();
                                setGradeQuestion(q.question);
                              }} style={{
                                padding: "8px 14px", borderRadius: 7, border: `1px solid ${track.color}30`,
                                background: `${track.color}08`, color: track.color, fontSize: 11, fontWeight: 700
                              }}>Practice This Question →</button>
                              <button className="btn" onClick={() => copyText(q.question, `q${i}`)} style={{
                                padding: "8px 14px", borderRadius: 7, border: "1px solid #e8eaf4",
                                background: "transparent", color: copied === `q${i}` ? "#059669" : "#6b7280", fontSize: 11, fontWeight: 600
                              }}>{copied === `q${i}` ? "✅ Copied" : "Copy"}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════
            MODE: ANSWER GRADER
        ══════════════════════════════ */}
        {activeMode === "grade" && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
                  The Interview Question
                </label>
                <textarea value={gradeQuestion} onChange={e => setGradeQuestion(e.target.value)} rows={2}
                  placeholder="Paste the interview question here..."
                  style={{ width: "100%", background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 10, padding: "11px 14px", color: "#1a1c2e", fontSize: 13, lineHeight: 1.6 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
                  Your Answer
                  <span style={{ color: "#9ca3af", fontWeight: 400, marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>— write it as you would say it in the interview</span>
                </label>
                <textarea value={gradeAnswer} onChange={e => setGradeAnswer(e.target.value)} rows={8}
                  placeholder="Type or paste your STAR answer here. Write it the way you'd actually say it — don't sanitize it before grading..."
                  style={{ width: "100%", background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 10, padding: "11px 14px", color: "#1a1c2e", fontSize: 13, lineHeight: 1.7 }} />
              </div>
            </div>

            {error && <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "10px 14px", marginBottom: 12, color: "#e11d48", fontSize: 13 }}>⚠️ {error}</div>}

            <button className="btn" onClick={handleGrade} disabled={loading} style={{
              width: "100%", padding: "14px", borderRadius: 12,
              background: loading ? "#e8eaf4" : `linear-gradient(135deg, ${track.color}, ${track.color}cc)`,
              color: loading ? "#9ca3af" : "#ffffff", fontSize: 14, fontWeight: 700,
              boxShadow: loading ? "none" : `0 4px 20px ${track.color}28`
            }}>
              {loading ? "🎯  Grading your answer..." : "🎯  Grade My Answer"}
            </button>

            {gradeResult && (
              <div ref={resultRef} className="fade" style={{ marginTop: 28 }}>

                {/* Score header */}
                <div style={{ background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 14, padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 6px #00000006", display: "flex", alignItems: "center", gap: 20 }}>
                  <ScoreBadge score={gradeResult.overall_score} size="large" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 5 }}>Overall Score</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#111328", marginBottom: 6 }}>{gradeResult.verdict}</div>
                    {gradeResult.lp_alignment && <p style={{ fontSize: 12, color: "#6b7280" }}>{gradeResult.lp_alignment}</p>}
                  </div>
                  {gradeResult.red_flags?.length > 0 && (
                    <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ fontSize: 10, color: "#e11d48", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>Red Flags</div>
                      {gradeResult.red_flags.map((f, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#e11d48", marginBottom: 2 }}>• {f}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* STAR breakdown */}
                <div style={{ background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 14, padding: "20px 24px", marginBottom: 16, boxShadow: "0 1px 6px #00000006" }}>
                  <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>STAR Breakdown</div>
                  {gradeResult.scores && Object.entries(gradeResult.scores).map(([k, v]) => (
                    <ScoreBar key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} score={v.score} max={v.max} feedback={v.feedback} />
                  ))}
                </div>

                {/* Strengths + Improvements */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>What Worked</div>
                    {gradeResult.strengths?.map((s, i) => <p key={i} style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6, marginBottom: 5 }}>✓ {s}</p>)}
                  </div>
                  <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, color: "#d97706", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>Fix These</div>
                    {gradeResult.improvements?.map((s, i) => <p key={i} style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6, marginBottom: 5 }}>→ {s}</p>)}
                  </div>
                </div>

                {/* Rewritten opener */}
                {gradeResult.rewritten_opening && (
                  <div style={{ background: `${track.color}06`, border: `1px solid ${track.color}20`, borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: track.color, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Stronger Opening — Rewritten</div>
                    <p style={{ fontSize: 13.5, color: "#1a1c2e", lineHeight: 1.75, fontStyle: "italic" }}>"{gradeResult.rewritten_opening}"</p>
                  </div>
                )}

                {/* Follow-up question */}
                {gradeResult.follow_up_question && (
                  <div style={{ background: "#f8f9fe", border: "1px solid #e8eaf4", borderRadius: 12, padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>🎤</span>
                    <div>
                      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>Likely Follow-Up Question</div>
                      <p style={{ fontSize: 13.5, color: "#1a1c2e", fontWeight: 600, lineHeight: 1.5 }}>{gradeResult.follow_up_question}</p>
                    </div>
                  </div>
                )}

                {/* Save to story bank */}
                <div style={{ background: "#ffffff", border: "1px dashed #c7d2fe", borderRadius: 12, padding: "16px 18px", marginTop: 14 }}>
                  <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
                    📚 Save this answer to your Story Bank
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <select value={storyClaim} onChange={(e) => setStoryClaim(e.target.value)} style={{ flex: 1, minWidth: 260, padding: "9px 12px", borderRadius: 8, border: "1px solid #e8eaf4", background: "#fafbff", fontSize: 12, color: "#374151", fontFamily: "inherit" }}>
                      <option value="">Which resume claim does this story prove? (optional)</option>
                      {claims.map((c, i) => <option key={i} value={c}>{c}</option>)}
                    </select>
                    <button onClick={handleSaveStory} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {storySaved ? "✅ Saved" : "💾 Save story"}
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 8, lineHeight: 1.5 }}>
                    Every number on your resume is a claim an interviewer will probe. The Story Bank tab shows which claims still have no rehearsed story.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════
            MODE: STORY BANK
        ══════════════════════════════ */}
        {activeMode === "stories" && (
          <div>
            <div style={{ background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
                Claim Coverage — every resume number needs a rehearsed story
              </div>
              {claims.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "#9ca3af", lineHeight: 1.6 }}>
                  No base resume found. Save your resume in the Resume Tailor ("Save as base") and your quantified claims will appear here.
                </p>
              ) : (
                claims.map((c, i) => {
                  const covered = stories.some((s) => s.claim === c);
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid #f7f8fc" }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>{covered ? "✅" : "⭕"}</span>
                      <span style={{ fontSize: 12.5, color: covered ? "#374151" : "#9ca3af", lineHeight: 1.5 }}>{c}</span>
                      {!covered && <span style={{ fontSize: 10.5, color: "#d97706", fontWeight: 700, flexShrink: 0, marginLeft: "auto" }}>NO STORY YET</span>}
                    </div>
                  );
                })
              )}
              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 10, lineHeight: 1.5 }}>
                To cover a claim: go to Answer Grader, practice a story that proves it, and save it with that claim selected.
              </p>
            </div>

            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
              Saved Stories ({stories.length})
            </div>
            {stories.length === 0 && (
              <div style={{ background: "#ffffff", border: "1px dashed #e8eaf4", borderRadius: 14, padding: "24px", textAlign: "center", fontSize: 12.5, color: "#9ca3af" }}>
                No stories saved yet. Grade an answer in Answer Grader, then hit "Save story".
              </div>
            )}
            {stories.map((s) => (
              <div key={s.id} style={{ background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: 14, padding: "16px 20px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111328", marginBottom: 4 }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
                      {s.date}{s.score ? ` · scored ${s.score}` : ""}{s.competency ? ` · ${s.competency}` : ""}
                    </div>
                    {s.claim && <div style={{ fontSize: 11.5, color: "#6366f1", marginBottom: 6 }}>Proves: {s.claim}</div>}
                    <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>{s.answer.slice(0, 220)}{s.answer.length > 220 ? "..." : ""}</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => copyText(s.answer, `story-${s.id}`)} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #e8eaf4", background: "transparent", color: "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      {copied === `story-${s.id}` ? "✅" : "📋 Copy"}
                    </button>
                    <button onClick={() => setStories(deleteStory(s.id))} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #fecdd3", background: "transparent", color: "#e11d48", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      ✕ Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════════
            MODE: FULL MOCK INTERVIEW
        ══════════════════════════════ */}
        {activeMode === "mock" && (
          <div>
            {!mockStarted ? (
              <div>
                <div style={{ background: `${track.color}08`, border: `1px solid ${track.color}25`, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111328", marginBottom: 6 }}>What to Expect</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {["5 questions in sequence — each builds on the last", "Coaching feedback after every answer", "Final hire/no-hire assessment with gap analysis", "For FAANG: every question tagged to LP/competency"].map((item, i) => (
                      <div key={i} style={{ fontSize: 12.5, color: "#4b5563", display: "flex", gap: 8 }}>
                        <span style={{ color: track.color }}>→</span>{item}
                      </div>
                    ))}
                  </div>
                </div>
                {error && <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "10px 14px", marginBottom: 12, color: "#e11d48", fontSize: 13 }}>⚠️ {error}</div>}
                <button className="btn" onClick={handleMockStart} disabled={loading} style={{
                  width: "100%", padding: "14px", borderRadius: 12,
                  background: loading ? "#e8eaf4" : `linear-gradient(135deg, ${track.color}, ${track.color}cc)`,
                  color: loading ? "#9ca3af" : "#ffffff", fontSize: 14, fontWeight: 700,
                  boxShadow: loading ? "none" : `0 4px 20px ${track.color}28`
                }}>
                  {loading ? "🎤  Setting up your interview..." : `🎤  Start ${track.label} Mock Interview`}
                </button>
              </div>
            ) : (
              <div>
                {/* Mock conversation */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {mockTurns.map((turn, i) => {
                    if (turn.type === "question") {
                      const qNum = mockTurns.slice(0, i + 1).filter(t => t.type === "question").length;
                      return (
                        <div key={i} className="fade" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: `${track.color}12`, border: `1px solid ${track.color}25`,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16
                          }}>🎤</div>
                          <div style={{ flex: 1, background: "#ffffff", border: `1px solid ${track.color}25`, borderRadius: "4px 12px 12px 12px", padding: "14px 18px", boxShadow: "0 1px 6px #00000006" }}>
                            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 10, color: track.color, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>Q{qNum} of 5</span>
                              {turn.data.competency && <Pill word={turn.data.competency} variant="blue" />}
                              {turn.data.lp_tag && <Pill word={`LP: ${turn.data.lp_tag}`} variant="violet" />}
                            </div>
                            <p style={{ fontSize: 14, color: "#111328", fontWeight: 600, lineHeight: 1.65 }}>{turn.data.question}</p>
                            {turn.data.context && <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 6, fontStyle: "italic" }}>{turn.data.context}</p>}
                          </div>
                        </div>
                      );
                    }

                    if (turn.type === "answer") {
                      return (
                        <div key={i} className="fade" style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: "row-reverse" }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: "#f0f2ff", border: "1px solid #e5e7f0",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16
                          }}>👤</div>
                          <div style={{ flex: 1, background: "#f0f2ff", border: "1px solid #e5e7f0", borderRadius: "12px 4px 12px 12px", padding: "14px 18px" }}>
                            <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.7 }}>{turn.text}</p>
                          </div>
                        </div>
                      );
                    }

                    if (turn.type === "feedback") {
                      const fb = turn.data.feedback;
                      
                      return (
                        <div key={i} className="fade" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: "#f0fdf4", border: "1px solid #bbf7d0",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16
                          }}>📊</div>
                          <div style={{ flex: 1 }}>
                            {/* Feedback card */}
                            <div style={{ background: "#ffffff", border: "1px solid #e8eaf4", borderRadius: "4px 12px 12px 12px", padding: "14px 18px", boxShadow: "0 1px 6px #00000006", marginBottom: turn.data.final_assessment ? 12 : 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                                <ScoreBadge score={fb.score} />
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111328" }}>{fb.verdict}</div>
                                  {fb.red_flag && <div style={{ fontSize: 11.5, color: "#e11d48", marginTop: 3 }}>⚠ {fb.red_flag}</div>}
                                </div>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "8px 12px" }}>
                                  <div style={{ fontSize: 10, color: "#059669", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Worked</div>
                                  <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{fb.what_worked}</p>
                                </div>
                                <div style={{ background: "#fff7ed", borderRadius: 8, padding: "8px 12px" }}>
                                  <div style={{ fontSize: 10, color: "#d97706", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Fix</div>
                                  <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{fb.what_to_fix}</p>
                                </div>
                              </div>
                            </div>

                            {/* Final assessment */}
                            {turn.data.final_assessment && (
                              <div style={{ background: `${track.color}06`, border: `1px solid ${track.color}25`, borderRadius: 14, padding: "20px 22px" }}>
                                <div style={{ fontSize: 12, color: track.color, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Final Interview Assessment</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                                  <ScoreBadge score={turn.data.final_assessment.overall_score} size="large" />
                                  <div>
                                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Recommendation</div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: track.color }}>{turn.data.final_assessment.hire_recommendation}</div>
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>{turn.data.final_assessment.summary}</p>
                                  </div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                                  <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "12px 14px" }}>
                                    <div style={{ fontSize: 10, color: "#059669", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Top Strength</div>
                                    <p style={{ fontSize: 12.5, color: "#374151" }}>{turn.data.final_assessment.top_strength}</p>
                                  </div>
                                  <div style={{ background: "#fff1f2", borderRadius: 10, padding: "12px 14px" }}>
                                    <div style={{ fontSize: 10, color: "#e11d48", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Critical Gap</div>
                                    <p style={{ fontSize: 12.5, color: "#374151" }}>{turn.data.final_assessment.critical_gap}</p>
                                  </div>
                                </div>
                                <div style={{ background: "#fff7ed", borderRadius: 10, padding: "12px 14px" }}>
                                  <div style={{ fontSize: 10, color: "#d97706", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Top 3 Improvements</div>
                                  {turn.data.final_assessment.top_3_improvements?.map((imp, j) => (
                                    <p key={j} style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6, marginBottom: 4 }}>→ {imp}</p>
                                  ))}
                                </div>
                                <button className="btn" onClick={() => { setMockStarted(false); setMockTurns([]); setMockEnded(false); }} style={{
                                  marginTop: 14, width: "100%", padding: "11px", borderRadius: 10,
                                  background: `${track.color}10`, border: `1px solid ${track.color}30`,
                                  color: track.color, fontSize: 13, fontWeight: 700
                                }}>🔄 Start Another Mock Interview</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                  <div ref={mockBottomRef} />
                </div>

                {/* Answer input */}
                {mockStarted && !mockEnded && !loading && mockTurns[mockTurns.length - 1]?.type === "question" && (
                  <div className="fade" style={{ marginTop: 16 }}>
                    <textarea value={mockAnswer} onChange={e => setMockAnswer(e.target.value)} rows={5}
                      placeholder="Type your answer here — write it as you'd say it in a real interview. Don't over-polish..."
                      style={{
                        width: "100%", background: "#ffffff", border: `1px solid ${track.color}30`,
                        borderRadius: 12, padding: "13px 15px", color: "#1a1c2e",
                        fontSize: 13.5, lineHeight: 1.7, marginBottom: 10
                      }}
                      onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleMockAnswer(); }}
                    />
                    <button className="btn" onClick={handleMockAnswer} disabled={!mockAnswer.trim()} style={{
                      width: "100%", padding: "13px", borderRadius: 10,
                      background: `linear-gradient(135deg, ${track.color}, ${track.color}cc)`,
                      color: "#ffffff", fontSize: 13.5, fontWeight: 700,
                      boxShadow: `0 4px 16px ${track.color}28`
                    }}>
                      Submit Answer →  <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>or Cmd+Enter</span>
                    </button>
                  </div>
                )}

                {loading && (
                  <div style={{ textAlign: "center", padding: "20px", color: "#9ca3af", fontSize: 13 }}>
                    ⏳ Evaluating your answer...
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && activeMode !== "grade" && (
          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "11px 16px", marginTop: 14, color: "#e11d48", fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

      </div>
    </div>
  );
}
