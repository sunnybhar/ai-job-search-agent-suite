import { useState, useRef } from "react";

// ─────────────────────────────────────────────────────────────────
// 🔑 YOUR API KEY — paste it between the quotes below
// ─────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.REACT_APP_ANTHROPIC_KEY;

// ─────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — CALL 1: Analysis only (no resume text in JSON)
// ─────────────────────────────────────────────────────────────────
const PROMPT_ANALYSIS = `You are a senior hiring manager, ATS software simulator, and resume strategist combined.
You evaluate resumes the way both a machine (ATS) and a human recruiter would.

CANDIDATE CONTEXT:
International MBA student at Fordham University, Gabelli School of Business, Class of 2027. Strong operations and product management background. No US brand-name employer pedigree. Be honest and direct — not encouraging for the sake of it.

TASK 1 — KEYWORD EXTRACTION
Extract ALL relevant keywords from the JD:
- Job Title & Variants
- Required Skills (hard skills explicitly stated)
- Preferred Skills (nice to have)
- Responsibilities (action phrases from JD)
- Tools & Technologies
- Soft Skills
- Domain Keywords
- Metrics & Outcomes language

TASK 2 — DUAL AUDIT
ATS PASS: keyword presence, section headers, grammar errors, formatting risks, missing keywords.
HUMAN RECRUITER PASS: quantified impact, action verbs, relevant experience prominence, narrative match, weak phrases.

TASK 3 — REWRITING RULES
Rule 1: Keyword strong → keep, strengthen if possible.
Rule 2: Keyword weak or buried → elevate, quantify, move up.
Rule 3: Keyword missing but adjacent experience exists → add truthful sentence.
Rule 4: Keyword missing with no basis → DO NOT invent. Flag as gap.

HARD RULES:
- Never fabricate anything
- No summary section
- ATS-safe headers only: EXPERIENCE, EDUCATION, SKILLS, PROJECTS, CERTIFICATIONS
- Every bullet starts with strong past-tense action verb
- Fix all grammar and structure errors

OUTPUT: Respond with ONLY valid JSON. No preamble. No markdown. No extra text.
Every string value must be a single line — no newlines inside string values.
Keep all text fields short and concise.

{
  "before_score": 42,
  "before_score_reason": "one sentence only",
  "after_score": 78,
  "after_score_reason": "one sentence only",
  "keyword_categories": {
    "job_title_variants": ["keyword"],
    "required_skills": ["keyword"],
    "preferred_skills": ["keyword"],
    "responsibilities": ["keyword"],
    "tools_technologies": ["keyword"],
    "soft_skills": ["keyword"],
    "domain_keywords": ["keyword"],
    "metrics_outcomes": ["keyword"]
  },
  "keyword_match_table": [
    {
      "keyword": "product roadmap",
      "category": "required_skills",
      "found_in_resume": true,
      "strength": "weak",
      "action": "Elevated to lead bullet with quantified outcome"
    }
  ],
  "reorganization_notes": [
    {
      "change": "one sentence describing the change",
      "reason": "one sentence explaining why"
    }
  ],
  "error_report": [
    {
      "type": "Grammar",
      "original": "short excerpt only",
      "issue": "what is wrong",
      "fix": "corrected version"
    }
  ],
  "remaining_gaps": [
    {
      "keyword": "SQL",
      "category": "tools_technologies",
      "reason": "not present with no adjacent basis",
      "recommendation": "address in cover letter"
    }
  ],
  "strategic_advice": "2-3 sentences maximum. Direct and honest."
}`;

// ─────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — CALL 2: Rewritten resume as plain text only
// ─────────────────────────────────────────────────────────────────
const PROMPT_RESUME = `You are an ATS optimization expert and resume rewriter.

Rewrite the provided resume to match the job description.

RULES:
- Output the rewritten resume as plain text ONLY
- No JSON, no markdown, no code blocks, no commentary
- Use ALL CAPS section headers: EXPERIENCE, EDUCATION, SKILLS, PROJECTS, CERTIFICATIONS
- Each bullet point starts with bullet character • and a strong past-tense action verb
- Separate sections with a blank line
- Most JD-relevant experience appears first in EXPERIENCE section
- Quantify impact wherever the original resume supports it
- Fix all grammar and spelling errors
- No summary section
- No fabricated experience, metrics, or skills
- No icons, tables, or columns

Output the resume text and nothing else.`;

// ─────────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────────
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
  const sanitized = cleaned.replace(
    /"((?:[^"\\]|\\.)*)"/gs,
    m => m.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
  );
  return JSON.parse(sanitized);
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
      model: "claude-opus-4-8",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || "API error");
  }
  const data = await response.json();
  return data.content.map(b => b.text || "").join("");
}

async function callClaude(jd, resume, onProgress) {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "YOUR_API_KEY_HERE") {
    throw new Error("API_KEY_MISSING");
  }

  const input = `JOB DESCRIPTION:\n${jd}\n\n${"─".repeat(40)}\n\nRESUME:\n${resume}`;

  // Call 1 — analysis, scores, keywords, gaps (JSON only, no resume text)
  onProgress("Step 1 of 2 — Running ATS audit & keyword analysis...");
  const analysisRaw = await apiCall(PROMPT_ANALYSIS, input);
  const analysis = safeParseJSON(analysisRaw);

  // Call 2 — rewritten resume as plain text (no JSON at all)
  onProgress("Step 2 of 2 — Rewriting resume for ATS match...");
  const rewrittenResume = await apiCall(PROMPT_RESUME, input);

  return { ...analysis, rewritten_resume: rewrittenResume.trim() };
}

// ─────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────
function ScoreBadge({ score, label, reason }) {
  const color = score >= 75 ? "#00d4aa" : score >= 50 ? "#f5a623" : "#ff4d6d";
  const bg = `${color}12`;
  return (
    <div style={{ textAlign: "center", minWidth: 120 }}>
      <div style={{
        width: 84, height: 84, borderRadius: "50%",
        border: `3px solid ${color}`, background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 10px", boxShadow: `0 0 28px ${color}30`
      }}>
        <span style={{ fontSize: 28, fontWeight: 800, color, fontFamily: "'DM Mono', monospace" }}>{score}</span>
      </div>
      <div style={{ fontSize: 11, color: "#888baa", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>{label}</div>
      {reason && <div style={{ fontSize: 11, color: "#555878", maxWidth: 150, margin: "0 auto", lineHeight: 1.5 }}>{reason}</div>}
    </div>
  );
}

function Pill({ word, variant = "default" }) {
  const variants = {
    default: { bg: "#dde0f0", color: "#888baa", border: "#ccd0e8" },
    green:   { bg: "#00d4aa12", color: "#00d4aa", border: "#00d4aa40" },
    blue:    { bg: "#0099ff12", color: "#0099ff", border: "#0099ff40" },
    red:     { bg: "#ff4d6d12", color: "#ff4d6d", border: "#ff4d6d40" },
    yellow:  { bg: "#f5a62312", color: "#f5a623", border: "#f5a62340" },
    purple:  { bg: "#a855f712", color: "#a855f7", border: "#a855f740" },
  };
  const v = variants[variant] || variants.default;
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 20, fontSize: 11,
      background: v.bg, color: v.color, border: `1px solid ${v.border}`,
      fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", display: "inline-block"
    }}>{word}</span>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #dde0f0",
      borderRadius: 14, padding: "20px 22px", ...style
    }}>{children}</div>
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
export default function ResumeTailorAgent() {
  const [jd, setJd] = useState("");
  const [resume, setResume] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const resultRef = useRef(null);

  async function handleRun() {
    if (!jd.trim() || !resume.trim()) {
      setError("Both fields are required. Paste the full JD and your full resume.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    setProgressMsg("");
    try {
      const data = await callClaude(jd, resume, (msg) => setProgressMsg(msg));
      setResult(data);
      setProgressMsg("");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      if (e.message === "API_KEY_MISSING") {
        setError("⚠️ API key missing. Open ResumeTailorAgent.jsx and paste your key into ANTHROPIC_API_KEY.");
      } else {
        setError(`Error: ${e.message}`);
      }
      setProgressMsg("");
    }
    setLoading(false);
  }

  function copyResume() {
    navigator.clipboard.writeText(result.rewritten_resume);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const improvement = result ? result.after_score - result.before_score : 0;
  const improvColor = improvement >= 25 ? "#00d4aa" : improvement >= 10 ? "#f5a623" : "#ff4d6d";

  const TABS = [
    { id: "overview",        label: "Overview",         icon: "📊" },
    { id: "keywords",        label: "Keyword Table",    icon: "🔑" },
    { id: "reorganization",  label: "Reorganization",   icon: "🔀" },
    { id: "resume",          label: "Rewritten Resume", icon: "📄" },
    { id: "errors",          label: "Error Report",     icon: "🔍" },
    { id: "gaps",            label: "Gaps",             icon: "⚠️"  },
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
          <div style={{
            width: 44, height: 44, borderRadius: 11, flexShrink: 0,
            background: "linear-gradient(135deg, #00d4aa, #0066ff)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22
          }}>⚡</div>
          <div>
            <div style={{ fontSize: 10, color: "#00d4aa", letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>
              Agent 01 · Job Search Suite
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "#111328", lineHeight: 1 }}>
              JD to Resume — Sunny{" "}
              <span style={{ fontSize: 12, fontWeight: 400, color: "#555878", letterSpacing: 0 }}>v3.0</span>
            </h1>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 11, color: "#555878", lineHeight: 1.7 }}>
            Tasks 1–4 · Full ATS audit · Keyword extraction<br />
            Resume rewrite · Error detection · Gap analysis
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "30px 40px 0" }}>

        {/* ── INPUTS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 16 }}>
          {[
            {
              label: "Job Description",
              val: jd, set: setJd,
              placeholder: "Paste the full job description here — job title, responsibilities, required skills, preferred skills, tools and technologies..."
            },
            {
              label: "Your Full Resume",
              val: resume, set: setResume,
              placeholder: "Paste your complete resume as plain text — all sections including Experience, Education, Skills, Projects, Certifications..."
            }
          ].map(({ label, val, set, placeholder }) => (
            <div key={label}>
              <label style={{
                display: "block", fontSize: 10, fontWeight: 700, color: "#555878",
                letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8
              }}>{label}</label>
              <textarea
                value={val} onChange={e => set(e.target.value)}
                placeholder={placeholder} rows={15}
                style={{
                  width: "100%", background: "#f0f1fa",
                  border: "1px solid #dde0f0", borderRadius: 12,
                  padding: "13px 15px", color: "#2a2c42",
                  fontSize: 12.5, lineHeight: 1.7,
                  transition: "border-color 0.2s, box-shadow 0.2s"
                }}
              />
            </div>
          ))}
        </div>

        {/* ── ERROR BANNER ── */}
        {error && (
          <div style={{
            background: "#ff4d6d0a", border: "1px solid #ff4d6d30",
            borderRadius: 10, padding: "12px 16px", marginBottom: 14,
            color: "#ff4d6d", fontSize: 13, lineHeight: 1.5
          }}>
            {error}
          </div>
        )}

        {/* ── RUN BUTTON ── */}
        <button
          className="run-btn"
          onClick={handleRun}
          disabled={loading}
          style={{
            width: "100%", padding: "15px 0", borderRadius: 12,
            background: loading ? "#e8eaf4" : "linear-gradient(135deg, #00d4aa 0%, #0055ff 100%)",
            color: loading ? "#555878" : "#050810",
            fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
            boxShadow: loading ? "none" : "0 4px 20px #00d4aa25"
          }}
        >
          {loading
            ? `⏳  ${progressMsg || "Starting analysis..."}`
            : "⚡  Run Full ATS Audit & Tailor Resume"}
        </button>

        {/* ── RESULTS ── */}
        {result && (
          <div ref={resultRef} style={{ marginTop: 44 }}>

            {/* Tab Navigation */}
            <div style={{
              display: "flex", gap: 4, borderBottom: "1px solid #dde0f0",
              marginBottom: 28, overflowX: "auto", paddingBottom: 0
            }}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  className="tab-btn"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: "10px 15px", borderRadius: "8px 8px 0 0",
                    color: activeTab === tab.id ? "#00d4aa" : "#555878",
                    borderBottom: activeTab === tab.id ? "2px solid #00d4aa" : "2px solid transparent",
                    fontSize: 12.5, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap"
                  }}
                >
                  <span>{tab.icon}</span>{tab.label}
                </button>
              ))}
            </div>

            {/* ════════════════════════════════
                TAB: OVERVIEW
            ════════════════════════════════ */}
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Score Card */}
                <Card>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 32, flexWrap: "wrap" }}>
                    <ScoreBadge score={result.before_score} label="Before" reason={result.before_score_reason} />

                    <div style={{ textAlign: "center", paddingTop: 8 }}>
                      <div style={{ fontSize: 10, color: "#555878", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>Improvement</div>
                      <div style={{ fontSize: 38, fontWeight: 800, color: improvColor, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
                        +{improvement}
                      </div>
                      <div style={{ fontSize: 10, color: "#555878", marginTop: 4 }}>ATS points</div>
                    </div>

                    <ScoreBadge score={result.after_score} label="After" reason={result.after_score_reason} />

                    <div style={{ flex: 1, minWidth: 200, paddingLeft: 24, borderLeft: "1px solid #dde0f0" }}>
                      {/* Progress bar */}
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                          <span style={{ fontSize: 11, color: "#555878" }}>ATS Match After Rewrite</span>
                          <span style={{ fontSize: 11, color: "#00d4aa", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{result.after_score}%</span>
                        </div>
                        <div style={{ height: 7, background: "#dde0f0", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{
                            height: "100%",
                            width: `${result.after_score}%`,
                            background: "linear-gradient(90deg, #00d4aa, #0066ff)",
                            borderRadius: 4
                          }} />
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div style={{ fontSize: 10, color: "#555878", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>Quick Stats</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        <Pill word={`${result.keyword_match_table?.filter(k => k.found_in_resume).length || 0} keywords matched`} variant="green" />
                        <Pill word={`${result.keyword_match_table?.filter(k => !k.found_in_resume).length || 0} keywords added`} variant="blue" />
                        <Pill word={`${result.remaining_gaps?.length || 0} gaps remaining`} variant="yellow" />
                        <Pill word={`${result.error_report?.length || 0} errors fixed`} variant="red" />
                        <Pill word={`${result.reorganization_notes?.length || 0} structural changes`} variant="purple" />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Strategic Advice */}
                <Card style={{ borderColor: "#0066ff33", background: "#0066ff08" }}>
                  <div style={{ display: "flex", gap: 14 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>🎯</span>
                    <div>
                      <div style={{ fontSize: 10, color: "#0099ff", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 9 }}>Strategic Advice</div>
                      <p style={{ fontSize: 13.5, color: "#2a2c42", lineHeight: 1.75 }}>{result.strategic_advice}</p>
                    </div>
                  </div>
                </Card>

                {/* Keywords by Category */}
                <Card>
                  <SectionLabel text="Keywords Extracted by Category (Task 1)" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                    {result.keyword_categories && Object.entries(result.keyword_categories).map(([cat, words]) =>
                      words?.length > 0 && (
                        <div key={cat} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <div style={{
                            fontSize: 11, color: "#555878", width: 150, flexShrink: 0,
                            paddingTop: 3, textTransform: "capitalize", lineHeight: 1.4
                          }}>
                            {cat.replace(/_/g, " ")}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {words.map(w => <Pill key={w} word={w} variant="green" />)}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* ════════════════════════════════
                TAB: KEYWORD MATCH TABLE
            ════════════════════════════════ */}
            {activeTab === "keywords" && (
              <Card>
                <SectionLabel text="Keyword Match Table — Task 2 ATS Audit" count={result.keyword_match_table?.length} />
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr>
                        {["Keyword", "Category", "In Resume?", "Strength", "Action Taken"].map(h => (
                          <th key={h} style={{
                            padding: "9px 12px", background: "#f7f8ff", color: "#555878",
                            fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                            fontSize: 10, textAlign: "left", borderBottom: "1px solid #dde0f0"
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.keyword_match_table?.map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "#f0f1fa" }}>
                          <td style={{ padding: "10px 12px", color: "#1a1c30", fontFamily: "'DM Mono', monospace", borderBottom: "1px solid #e8eaf4" }}>
                            {row.keyword}
                          </td>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid #e8eaf4" }}>
                            <Pill word={row.category || "—"} variant="blue" />
                          </td>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid #e8eaf4", fontSize: 16 }}>
                            {row.found_in_resume ? "✅" : "❌"}
                          </td>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid #e8eaf4" }}>
                            {row.strength && (
                              <Pill
                                word={row.strength}
                                variant={row.strength === "strong" ? "green" : row.strength === "weak" ? "yellow" : "default"}
                              />
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#888baa", fontSize: 12, lineHeight: 1.5, borderBottom: "1px solid #e8eaf4" }}>
                            {row.action}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* ════════════════════════════════
                TAB: REORGANIZATION (TASK 4)
            ════════════════════════════════ */}
            {activeTab === "reorganization" && (
              <div>
                <SectionLabel text="Resume Reorganization — Task 4 Structural Changes" count={result.reorganization_notes?.length} />
                {!result.reorganization_notes?.length ? (
                  <Card>
                    <p style={{ color: "#00d4aa", fontSize: 13, textAlign: "center" }}>✅ No structural reorganization was needed.</p>
                  </Card>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {result.reorganization_notes?.map((note, i) => (
                      <Card key={i} style={{ borderLeft: "3px solid #a855f7", display: "flex", gap: 16, alignItems: "flex-start" }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                          background: "#a855f718", border: "1px solid #a855f740",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, color: "#a855f7", fontFamily: "'DM Mono', monospace"
                        }}>{i + 1}</div>
                        <div>
                          <p style={{ fontSize: 13, color: "#1a1c30", fontWeight: 600, marginBottom: 5 }}>{note.change}</p>
                          <p style={{ fontSize: 12, color: "#555878", lineHeight: 1.6 }}>Why: {note.reason}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Also show hard rules reminder */}
                <Card style={{ marginTop: 20, borderColor: "#dde0f0", background: "#f4f5fd" }}>
                  <div style={{ fontSize: 10, color: "#555878", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
                    Task 3 Hard Rules Applied to This Resume
                  </div>
                  {[
                    "No summary section added",
                    "No icons, tables, or images in output",
                    "ATS-safe section headers only (EXPERIENCE, EDUCATION, SKILLS, PROJECTS)",
                    "All bullets lead with strong past-tense action verbs",
                    "No fabricated experience, metrics, or skills",
                    "Missing keywords with no basis flagged as gaps — not invented",
                  ].map((rule, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                      <span style={{ color: "#00d4aa", fontSize: 13 }}>✓</span>
                      <span style={{ fontSize: 12.5, color: "#888baa" }}>{rule}</span>
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {/* ════════════════════════════════
                TAB: REWRITTEN RESUME
            ════════════════════════════════ */}
            {activeTab === "resume" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <SectionLabel text="ATS-Optimized Rewritten Resume — Task 4 Output" />
                  <button
                    className="copy-btn"
                    onClick={copyResume}
                    style={{
                      padding: "8px 18px", borderRadius: 8,
                      border: "1px solid #ccd0e8", background: "transparent",
                      color: "#888baa", fontSize: 12, fontWeight: 600, marginBottom: 16
                    }}
                  >
                    {copied ? "✅ Copied!" : "📋 Copy Full Resume"}
                  </button>
                </div>
                <Card>
                  <pre style={{
                    fontSize: 12.5, color: "#1a1c30", lineHeight: 1.9,
                    fontFamily: "'DM Mono', monospace"
                  }}>
                    {result.rewritten_resume}
                  </pre>
                </Card>
                <div style={{ marginTop: 12, fontSize: 11, color: "#555878", textAlign: "center" }}>
                  Copy this text → paste into Word or Google Docs → format as needed
                </div>
              </div>
            )}

            {/* ════════════════════════════════
                TAB: ERROR REPORT
            ════════════════════════════════ */}
            {activeTab === "errors" && (
              <div>
                <SectionLabel text="Error & Quality Report — Task 2 Audit" count={result.error_report?.length} />
                {!result.error_report?.length ? (
                  <Card>
                    <p style={{ color: "#00d4aa", fontSize: 13, textAlign: "center" }}>✅ No grammar, spelling, or structural errors detected.</p>
                  </Card>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {result.error_report?.map((e, i) => (
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
            )}

            {/* ════════════════════════════════
                TAB: GAPS
            ════════════════════════════════ */}
            {activeTab === "gaps" && (
              <div>
                <SectionLabel text="Remaining Gaps — Keywords That Could Not Be Added" count={result.remaining_gaps?.length} />
                {!result.remaining_gaps?.length ? (
                  <Card>
                    <p style={{ color: "#00d4aa", fontSize: 13, textAlign: "center" }}>✅ No critical gaps — all major keywords were addressed.</p>
                  </Card>
                ) : (
                  <>
                    <Card style={{ marginBottom: 16, borderColor: "#f5a62330", background: "#f5a62308" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
                        <p style={{ fontSize: 13, color: "#2a2c42", lineHeight: 1.7 }}>
                          These JD requirements had no basis in your resume and were <strong style={{ color: "#f5a623" }}>not invented</strong>. Address them in your cover letter or prepare to speak to them in interviews.
                        </p>
                      </div>
                    </Card>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {result.remaining_gaps?.map((g, i) => (
                        <Card key={i} style={{ padding: "16px 20px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                            <Pill word={g.keyword} variant="yellow" />
                            <Pill word={g.category || "general"} variant="default" />
                            <div style={{ flex: 1, minWidth: 200 }}>
                              <p style={{ fontSize: 12, color: "#666a8a", marginBottom: 4 }}>{g.reason}</p>
                              {g.recommendation && (
                                <p style={{ fontSize: 11.5, color: "#0099ff" }}>→ {g.recommendation}</p>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
