import { useState, useEffect } from "react";

// ── Agents ──
import ResumeTailorAgent from "./ResumeTailorAgent_Sunny";
import ResumeTailorAgentTanya from "./ResumeTailorAgent_Tanya";
import ATSScannerAgent from "./ATSScannerAgent";
import ResumeAuditAgent from "./ResumeAuditAgent";
import CoverLetterAgent from "./CoverLetterAgent";
import StartupEmailAgent from "./StartupEmailAgent";
import FollowUpAgent from "./FollowUpAgent";
import CoffeeChatAgent from "./CoffeeChatAgent";
import BehavioralCoach from "./BehavioralCoach";
import LinkedInTrendScout from "./LinkedInTrendScout";

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
      { id: "audit", name: "Resume Audit & Rewrite", desc: "Two-step gated audit: ATS score, hiring manager read, then rewrite on your decisions", icon: "⚖️", component: ResumeAuditAgent },
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
  {
    label: "Stage 4 · Build Your Brand",
    color: "#f5a623",
    agents: [
      { id: "trendscout", name: "LinkedIn Trend Scout", desc: "Daily top 5 traction topics in AI, PM and tech — your angle, hook, verified articles and videos", icon: "📈", component: LinkedInTrendScout },
    ],
  },
];

// ── Live metrics from the history the agents save ──
//
// FOUR PROBLEMS IN THE OLD BLOCK, ALL FIXED HERE
//
// 1. Measurement was averaged with opinion. tailorRuns included
//    audits. Tailor afterPct is deterministic keyword coverage.
//    Audit afterPct is parsed from the model's own RESCORE block,
//    which is the model grading its own work. Averaging them into
//    one "Avg Coverage After" breaks the principle that judgment
//    must be labelled as judgment. They are two numbers now.
//
// 2. Tanya's runs sat inside Sunny's funnel. Metrics are computed
//    per person.
//
// 3. Double counting. One application usually produces a tailored
//    resume and a cover letter, and a priority application an audit
//    too. Each was its own funnel row, so priority applications
//    carried two or three times the weight of volume ones. Runs are
//    deduplicated into applications by company and role.
//
// 4. The sign was hardcoded. `+${avgImprovement}` printed "+-4" on
//    a regression.
//
// It also reports how many applications have no status set, because
// a response rate over the four you remembered to update is not a
// response rate.
function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}

const STATUS_RANK = {
  applied: 0, "no reply": 0, rejected: 0, response: 1, interview: 2, offer: 3,
};

function average(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

function formatDelta(n) {
  if (n === null || n === undefined) return null;
  return `${n > 0 ? "+" : ""}${n}`;
}

function applicationKey(run) {
  const company = String(run.company || "unknown").trim().toLowerCase();
  const role = String(run.role || "").trim().toLowerCase();
  return `${company}|${role}`;
}

function computeMetrics(person = "sunny") {
  const tailor = readJSON(`tailor_${person}_history`);
  const letters = readJSON(`coverletter_${person}_history`);
  const audits = readJSON(`audit_${person}_history`);

  // Measured: deterministic keyword coverage, tailor runs only.
  const measuredRuns = tailor.filter((r) => typeof r.afterPct === "number");
  const avgCoverage = average(measuredRuns.map((r) => r.afterPct));
  // Named "keywords addressed", not "improvement". The rewrite prompt
  // is handed the missing keyword list and then scored against that
  // same list, so this measures compliance with the instruction, not
  // document quality. It structurally cannot fall.
  const avgKeywordsAddressed = average(
    measuredRuns.map((r) => r.afterPct - (r.beforePct || 0))
  );

  // Judged: the audit agent's own re-score. Opinion, kept separate.
  const judgedRuns = audits.filter((r) => typeof r.afterPct === "number");
  const avgAuditScore = average(judgedRuns.map((r) => r.afterPct));

  // Funnel: one row per application, not one per document.
  const applications = new Map();
  [...tailor, ...letters, ...audits].forEach((run) => {
    const key = applicationKey(run);
    const rank = run.status ? (STATUS_RANK[run.status] ?? 0) : -1;
    const existing = applications.get(key);
    if (!existing) {
      applications.set(key, { key, company: run.company, role: run.role, status: run.status || null, rank, id: run.id || 0 });
      return;
    }
    if (rank > existing.rank) { existing.rank = rank; existing.status = run.status || null; }
    if ((run.id || 0) > existing.id) existing.id = run.id || 0;
  });

  const apps = [...applications.values()];
  const tracked = apps.filter((a) => a.rank >= 0);
  const responses = tracked.filter((a) => a.rank >= 1).length;
  const interviews = tracked.filter((a) => a.rank >= 2).length;
  const offers = tracked.filter((a) => a.rank >= 3).length;

  const funnel = {
    applications: apps.length,
    tracked: tracked.length,
    untracked: apps.length - tracked.length,
    responses,
    interviews,
    offers,
    responseRate: tracked.length ? Math.round((responses / tracked.length) * 100) : null,
  };

  const activity = [
    ...tailor.map((r) => ({ id: r.id, who: person === "sunny" ? "Sunny" : "Tanya", what: `Resume tailored · ${r.company}`, detail: `${r.beforePct}% → ${r.afterPct}% coverage`, status: r.status })),
    ...audits.map((r) => ({ id: r.id, who: person === "sunny" ? "Sunny" : "Tanya", what: `Resume audit · ${r.company}`, detail: `${r.beforePct}/100 → ${r.afterPct}/100 (AI self-score)`, status: r.status })),
    ...letters.map((r) => ({ id: r.id, who: person === "sunny" ? "Sunny" : "Tanya", what: `Cover letter · ${r.company}`, detail: r.role || "", status: r.status })),
  ]
    .sort((a, b) => b.id - a.id)
    .slice(0, 5);

  return {
    person,
    tailored: tailor.length,
    letters: letters.length,
    audits: audits.length,
    avgCoverage,
    avgKeywordsAddressed,
    avgAuditScore,
    judgedRuns: judgedRuns.length,
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
                9 AI agents across the job search pipeline — tailor, verify, apply, connect, prepare, and build your brand.
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
            <MetricCard label="Avg Coverage (measured)" value={metrics.avgCoverage} suffix="%" accent="#00a184" />
            <MetricCard label="Keywords Addressed" value={formatDelta(metrics.avgKeywordsAddressed)} suffix="pts" accent="#0066ff" />
            {metrics.judgedRuns > 0 && (
              <MetricCard label="Avg Audit Score (AI judgment)" value={metrics.avgAuditScore} suffix="/100" accent="#a855f7" />
            )}
          </div>
        )}

        {/* ── OUTCOME FUNNEL — the numbers that actually matter ── */}
        {metrics && (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
            <MetricCard label="Responses" value={metrics.funnel.responses} accent="#0099ff" />
            <MetricCard label="Interviews" value={metrics.funnel.interviews} accent="#a855f7" />
            <MetricCard label="Offers" value={metrics.funnel.offers} accent="#00d4aa" />
            <MetricCard label="Response Rate" value={metrics.funnel.responseRate} suffix="%" accent="#f5a623" />
            {metrics.funnel.untracked > 0 && (
              <MetricCard label="Untracked" value={metrics.funnel.untracked} suffix=" apps" accent="#888baa" />
            )}
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
