import { useState, useEffect } from "react";

// ── Agents ──
import ResumeTailorAgent from "./ResumeTailorAgent_Sunny";
import ResumeTailorAgentTanya from "./ResumeTailorAgent_Tanya";
import ATSScannerAgent from "./ATSScannerAgent";
import CoverLetterAgent from "./CoverLetterAgent";
import StartupEmailAgent from "./StartupEmailAgent";
import FollowUpAgent from "./FollowUpAgent";
import CoffeeChatAgent from "./CoffeeChatAgent";
import BehavioralCoach from "./BehavioralCoach";

// ─────────────────────────────────────────────────────────────────
// HOME PAGE v2.0 — "Sunny Bhargava · Product Management Job Agent"
// Layout: workflow pipeline (Prepare → Apply → Connect & Interview)
// Metrics: live, read from the localStorage history the rebuilt
// agents save (resume runs, letters, coverage). No placeholder cards.
// ─────────────────────────────────────────────────────────────────

const STAGES = [
  {
    label: "Stage 1 · Prepare",
    color: "#0099ff",
    agents: [
      { id: "tailor_sunny", name: "Resume Tailor — Sunny", desc: "JD-tailored rewrite with real before/after scoring and fact check", icon: "⚡", component: ResumeTailorAgent },
      { id: "tailor_tanya", name: "Resume Tailor — Tanya", desc: "Same engine, tuned for sustainability / ESG consulting roles", icon: "🌱", component: ResumeTailorAgentTanya },
      { id: "scanner", name: "ATS Scanner & Match", desc: "Parse test, field extraction, deterministic keyword coverage", icon: "🔍", component: ATSScannerAgent },
    ],
  },
  {
    label: "Stage 2 · Apply",
    color: "#a855f7",
    agents: [
      { id: "cover", name: "Cover Letter", desc: "Dymax-format letters with real company news and your stories", icon: "✉️", component: CoverLetterAgent },
      { id: "startup", name: "Startup Cold Email", desc: "120-word founder emails with LinkedIn PDF research", icon: "🚀", component: StartupEmailAgent },
      { id: "followup", name: "Follow-Up", desc: "Post-application and post-interview follow-up messages", icon: "⏰", component: FollowUpAgent },
    ],
  },
  {
    label: "Stage 3 · Connect & Interview",
    color: "#00d4aa",
    agents: [
      { id: "coffee", name: "Coffee Chat", desc: "Outreach and prep for networking conversations", icon: "☕", component: CoffeeChatAgent },
      { id: "behavioral", name: "Behavioral Coach", desc: "STAR story practice and interview answer coaching", icon: "🎤", component: BehavioralCoach },
    ],
  },
];

// ── Live metrics from the history the rebuilt agents save ──
function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}

function computeMetrics() {
  const sunny = readJSON("tailor_sunny_history");
  const tanya = readJSON("tailor_tanya_history");
  const letters = readJSON("coverletter_sunny_history");
  const tailorRuns = [...sunny, ...tanya];

  const withScores = tailorRuns.filter((r) => typeof r.afterPct === "number");
  const avgCoverage = withScores.length
    ? Math.round(withScores.reduce((s, r) => s + r.afterPct, 0) / withScores.length)
    : null;
  const avgImprovement = withScores.length
    ? Math.round(withScores.reduce((s, r) => s + (r.afterPct - (r.beforePct || 0)), 0) / withScores.length)
    : null;

  const activity = [
    ...sunny.map((r) => ({ id: r.id, who: "Sunny", what: `Resume tailored · ${r.company}`, detail: `${r.beforePct}% → ${r.afterPct}%`, status: r.status })),
    ...tanya.map((r) => ({ id: r.id, who: "Tanya", what: `Resume tailored · ${r.company}`, detail: `${r.beforePct}% → ${r.afterPct}%`, status: r.status })),
    ...letters.map((r) => ({ id: r.id, who: "Sunny", what: `Cover letter · ${r.company}`, detail: r.role || "", status: r.status })),
  ]
    .sort((a, b) => b.id - a.id)
    .slice(0, 5);

  // Outcome funnel — from the status you set on each run in the agents'
  // history dropdowns (applied → response → interview → offer)
  const all = [...tailorRuns, ...letters];
  const tracked = all.filter((r) => r.status);
  const count = (list) => tracked.filter((r) => list.includes(r.status)).length;
  const responses = count(["response", "interview", "offer"]);
  const interviews = count(["interview", "offer"]);
  const offers = count(["offer"]);
  const funnel = {
    tracked: tracked.length,
    responses,
    interviews,
    offers,
    responseRate: tracked.length ? Math.round((responses / tracked.length) * 100) : null,
  };

  return {
    tailored: tailorRuns.length,
    letters: letters.length,
    avgCoverage,
    avgImprovement,
    activity,
    funnel,
  };
}

const STATUS_COLORS = {
  applied: "#888baa", "no reply": "#888baa", response: "#0099ff",
  interview: "#a855f7", offer: "#00d4aa", rejected: "#ff4d6d",
};

function MetricCard({ label, value, suffix = "", accent = "#111328" }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #dde0f0", borderRadius: 14, padding: "16px 20px", flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 10, color: "#555878", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
        {value === null ? "—" : value}
        {value !== null && suffix && <span style={{ fontSize: 15, fontWeight: 400, color: "#888baa", marginLeft: 3 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function HomePage({ onOpen }) {
  const [metrics, setMetrics] = useState(null);
  useEffect(() => { setMetrics(computeMetrics()); }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8ff", fontFamily: "'Sora', sans-serif", color: "#1a1c30", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .agent-card { transition: all 0.18s; cursor: pointer; }
        .agent-card:hover { transform: translateY(-3px); box-shadow: 0 10px 30px #00000012; border-color: #00d4aa60 !important; }
      `}</style>

      {/* ── HERO ── */}
      <div style={{ borderBottom: "1px solid #dde0f0", padding: "40px 40px 32px", background: "#ffffff" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 54, height: 54, borderRadius: 14, flexShrink: 0, background: "linear-gradient(135deg, #00d4aa, #0066ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>⚡</div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: "#111328", lineHeight: 1.2 }}>
                Sunny Bhargava <span style={{ color: "#ccd0e8", fontWeight: 400 }}>·</span> Product Management Job Agent
              </h1>
              <p style={{ fontSize: 13, color: "#555878", marginTop: 4 }}>
                8 AI agents across the job search pipeline — tailor, verify, apply, connect, prepare.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 40px 0" }}>

        {/* ── METRICS STRIP (live from agent history) ── */}
        {metrics && (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
            <MetricCard label="Resumes Tailored" value={metrics.tailored} />
            <MetricCard label="Cover Letters" value={metrics.letters} />
            <MetricCard label="Avg Coverage After" value={metrics.avgCoverage} suffix="%" accent="#00a184" />
            <MetricCard label="Avg Improvement" value={metrics.avgImprovement === null ? null : `+${metrics.avgImprovement}`} suffix="pts" accent="#0066ff" />
          </div>
        )}

        {/* ── OUTCOME FUNNEL — the numbers that actually matter ── */}
        {metrics && (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
            <MetricCard label="Responses" value={metrics.funnel.responses} accent="#0099ff" />
            <MetricCard label="Interviews" value={metrics.funnel.interviews} accent="#a855f7" />
            <MetricCard label="Offers" value={metrics.funnel.offers} accent="#00d4aa" />
            <MetricCard label="Response Rate" value={metrics.funnel.responseRate} suffix="%" accent="#f5a623" />
          </div>
        )}
        {metrics && metrics.funnel.tracked > 0 && metrics.funnel.responses === 0 && (
          <div style={{ fontSize: 11.5, color: "#888baa", marginBottom: 14, paddingLeft: 4 }}>
            Update outcomes in each agent's History dropdown (applied → response → interview → offer) — that's what makes these numbers, and the suite, learn what converts.
          </div>
        )}

        {/* ── PIPELINE STAGES ── */}
        {STAGES.map((stage) => (
          <div key={stage.label} style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color }} />
              <div style={{ fontSize: 12, color: "#555878", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>{stage.label}</div>
              <div style={{ flex: 1, height: 1, background: "#dde0f0" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {stage.agents.map((agent) => (
                <div
                  key={agent.id}
                  className="agent-card"
                  onClick={() => onOpen(agent.id)}
                  style={{ background: "#ffffff", border: "1px solid #dde0f0", borderRadius: 14, padding: "18px 20px" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `${stage.color}14`, border: `1px solid ${stage.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                      {agent.icon}
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "#111328", lineHeight: 1.3 }}>{agent.name}</div>
                  </div>
                  <p style={{ fontSize: 12, color: "#555878", lineHeight: 1.6 }}>{agent.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── RECENT ACTIVITY ── */}
        {metrics && metrics.activity.length > 0 && (
          <div style={{ background: "#ffffff", border: "1px solid #dde0f0", borderRadius: 14, padding: "16px 20px", marginBottom: 30 }}>
            <div style={{ fontSize: 10, color: "#555878", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>Recent Activity</div>
            {metrics.activity.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #f0f1fa", fontSize: 12.5 }}>
                <span style={{ color: "#1a1c30" }}>
                  <span style={{ color: "#888baa", fontFamily: "'DM Mono', monospace", fontSize: 11, marginRight: 8 }}>{a.who}</span>
                  {a.what}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {a.status && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLORS[a.status] || "#888baa", background: `${STATUS_COLORS[a.status] || "#888baa"}14`, padding: "2px 8px", borderRadius: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {a.status}
                    </span>
                  )}
                  <span style={{ color: "#888baa", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{a.detail}</span>
                </span>
              </div>
            ))}
          </div>
        )}
        {metrics && metrics.activity.length === 0 && (
          <div style={{ background: "#ffffff", border: "1px dashed #ccd0e8", borderRadius: 14, padding: "14px 20px", marginBottom: 30, fontSize: 12.5, color: "#888baa" }}>
            No runs saved yet — metrics and activity appear here after your first resume tailor or cover letter.
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// APP — home + agent views with a persistent back bar
// ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeId, setActiveId] = useState(null);

  const allAgents = STAGES.flatMap((s) => s.agents);
  const active = allAgents.find((a) => a.id === activeId);

  if (!active) return <HomePage onOpen={setActiveId} />;

  const ActiveComponent = active.component;
  return (
    <div>
      <div style={{ background: "#111328", padding: "10px 40px", display: "flex", alignItems: "center", gap: 14, fontFamily: "'Sora', sans-serif" }}>
        <button
          onClick={() => setActiveId(null)}
          style={{ background: "transparent", border: "1px solid #ffffff30", color: "#ffffff", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
        >
          ← Home
        </button>
        <span style={{ color: "#ffffff90", fontSize: 12 }}>
          Sunny Bhargava · Product Management Job Agent <span style={{ color: "#ffffff40" }}>/</span> {active.name}
        </span>
      </div>
      <ActiveComponent />
    </div>
  );
}
