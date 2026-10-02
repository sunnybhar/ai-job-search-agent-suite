import { useState, useEffect } from "react";
import {
  runTrendScout,
  draftPost,
  summarizePerformance,
  todayET,
  DEFAULT_PROFILE,
  FALLBACK_BETA,
  PILLARS,
} from "./trendScoutCore";
import { apiUrl, apiHeaders } from "./lib/api";

// ─────────────────────────────────────────────────────────────────
// LINKEDIN TREND SCOUT v1.0 — Sunny
// - Daily brief: a GitHub Action researches every weekday morning and
//   publishes /linkedin-briefs/latest.json — this page shows it on open
// - "Run fresh research" runs the same pipeline on demand (works under npm start)
// - 5 topics ranked by traction × fit, each with your angle, hook,
//   outline, verified articles + videos, and a one-click full draft
// - Post log feeds real follower results back into the next scan
// ─────────────────────────────────────────────────────────────────
// API routing comes from the shared client in src/lib/api.js: direct key
// only under `npm start`, the /api/claude proxy in any production build.

const HISTORY_KEY = "trendscout_history";
const PROFILE_KEY = "trendscout_profile";
const POSTLOG_KEY = "trendscout_postlog";

async function transport(body) {
  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: { ...apiHeaders(), "anthropic-beta": FALLBACK_BETA },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      res.status === 504
        ? "The server cut the request off for taking too long. Run the agent locally with `npm start`, or use the daily brief."
        : data?.error?.message || `API error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const PILLAR_COLORS = {
  AI: "#a855f7",
  "Product Management": "#0099ff",
  "Tech & Industry": "#00a184",
  "Career & Leadership": "#f5a623",
};
const pillarColor = (p) => PILLAR_COLORS[p] || "#888baa";

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

function Label({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#555878", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
      {children}
    </div>
  );
}

function ScoreBar({ label, value, color }) {
  return (
    <div style={{ minWidth: 110 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#555878", fontWeight: 700, marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontFamily: "'DM Mono', monospace", color }}>{value}/10</span>
      </div>
      <div style={{ height: 6, background: "#f0f1fa", borderRadius: 3 }}>
        <div style={{ width: `${value * 10}%`, height: 6, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="ghost-btn"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

function LinkList({ items, icon }) {
  return items.map((l) => (
    <div key={l.url} style={{ padding: "8px 0", borderTop: "1px solid #f0f1fa", fontSize: 12.5, lineHeight: 1.55 }}>
      <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: "#0066ff", fontWeight: 600, textDecoration: "none" }}>
        {icon} {l.title}
      </a>
      <span style={{ color: "#888baa", fontSize: 11.5 }}> · {l.source}</span>
      {l.verified === false && (
        <span style={{ marginLeft: 6, fontSize: 10, color: "#f5a623", fontWeight: 700 }}>UNVERIFIED</span>
      )}
      {l.note && <div style={{ color: "#555878", fontSize: 12 }}>{l.note}</div>}
    </div>
  ));
}

// ─────────────────────────────────────────────────────────────────
// TOPIC CARD
// ─────────────────────────────────────────────────────────────────
function TopicCard({ topic, profile, onLogPost, posted }) {
  const [draft, setDraft] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [impressions, setImpressions] = useState("");
  const [followers, setFollowers] = useState("");
  const color = pillarColor(topic.pillar);

  async function handleDraft() {
    setDrafting(true);
    setDraftError("");
    try {
      setDraft(await draftPost({ transport, profile, topic }));
    } catch (e) {
      setDraftError(e.message);
    }
    setDrafting(false);
  }

  const inputStyle = { background: "#f0f1fa", border: "1px solid #dde0f0", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, width: 120 };

  return (
    <Card style={{ marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${color}14`, border: `1px solid ${color}40`, color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontFamily: "'DM Mono', monospace" }}>
          {topic.rank}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111328", lineHeight: 1.35 }}>{topic.title}</div>
          <span style={{ display: "inline-block", marginTop: 6, fontSize: 10, fontWeight: 700, color, background: `${color}14`, padding: "2px 9px", borderRadius: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {topic.pillar}
          </span>
          {posted && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#00a184" }}>✓ POSTED</span>}
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <ScoreBar label="Traction" value={topic.traction} color="#ff4d6d" />
          <ScoreBar label="Your fit" value={topic.fit} color="#0099ff" />
        </div>
      </div>

      <p style={{ fontSize: 13, color: "#1a1c30", lineHeight: 1.6, marginTop: 14 }}>
        <b>Why now:</b> {topic.whyNow}
      </p>
      {topic.signals?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <Label>Traction signals</Label>
          <ul style={{ paddingLeft: 18, fontSize: 12.5, color: "#555878", lineHeight: 1.6 }}>
            {topic.signals.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      )}

      {topic.error ? (
        <div style={{ marginTop: 14, fontSize: 12.5, color: "#ff4d6d" }}>Deep dive failed for this topic: {topic.error}</div>
      ) : (
        <>
          {/* Your angle */}
          <div style={{ marginTop: 16, background: "#f7f8ff", border: "1px solid #dde0f0", borderRadius: 10, padding: "12px 14px" }}>
            <Label>Your angle</Label>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "#111328" }}>{topic.angle}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <Label>Hook (first 2 lines)</Label>
              <CopyButton text={topic.hook} />
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "#111328", fontWeight: 600 }}>{topic.hook}</div>
            {topic.outline?.length > 0 && (
              <>
                <div style={{ marginTop: 12 }}><Label>Outline</Label></div>
                <ol style={{ paddingLeft: 18, fontSize: 12.5, color: "#1a1c30", lineHeight: 1.65 }}>
                  {topic.outline.map((b) => <li key={b}>{b}</li>)}
                </ol>
              </>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 12, fontSize: 12.5, lineHeight: 1.55 }}>
            <div><Label>Format</Label>{topic.format}</div>
            <div><Label>Best time</Label>{topic.bestTime}</div>
            <div><Label>Closing question</Label>{topic.cta}</div>
            <div><Label>Hashtags</Label><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, color: "#0066ff" }}>{topic.hashtags?.join(" ")}</span></div>
          </div>
          {topic.risk && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#9a6400", background: "#f5a62312", border: "1px solid #f5a62340", borderRadius: 8, padding: "8px 12px" }}>
              ⚠ {topic.risk}
            </div>
          )}

          {/* Research */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18, marginTop: 16 }}>
            <div>
              <Label>Articles to read & reference</Label>
              {topic.articles?.length ? <LinkList items={topic.articles} icon="📰" /> : <div style={{ fontSize: 12, color: "#888baa" }}>None verified.</div>}
            </div>
            <div>
              <Label>Videos</Label>
              {topic.videos?.length ? <LinkList items={topic.videos} icon="▶" /> : <div style={{ fontSize: 12, color: "#888baa" }}>No verified video found.</div>}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button className="run-btn small" onClick={handleDraft} disabled={drafting}>
              {drafting ? "Writing…" : draft ? "↻ Rewrite post" : "✍️ Write the full post"}
            </button>
            <button className="ghost-btn" onClick={() => setLogOpen(!logOpen)}>
              {posted ? "Update results" : "I posted this → log results"}
            </button>
          </div>
          {draftError && <div style={{ marginTop: 8, fontSize: 12, color: "#ff4d6d" }}>{draftError}</div>}
          {draft && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Label>Draft · {draft.split(/\s+/).filter(Boolean).length} words — edit before posting</Label>
                <CopyButton text={draft} label="Copy post" />
              </div>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={14} style={{ width: "100%", background: "#f0f1fa", border: "1px solid #dde0f0", borderRadius: 10, padding: "12px 14px", fontSize: 13, lineHeight: 1.6 }} />
            </div>
          )}
          {logOpen && (
            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div><Label>Impressions</Label><input type="number" value={impressions} onChange={(e) => setImpressions(e.target.value)} style={inputStyle} /></div>
              <div><Label>New followers</Label><input type="number" value={followers} onChange={(e) => setFollowers(e.target.value)} style={inputStyle} /></div>
              <button
                className="run-btn small"
                onClick={() => {
                  onLogPost({ title: topic.title, pillar: topic.pillar, impressions: Number(impressions) || 0, followers: Number(followers) || 0 });
                  setLogOpen(false);
                }}
              >
                Save
              </button>
              <span style={{ fontSize: 11.5, color: "#888baa" }}>Log after ~3 days. Future scans lean toward what converts.</span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function LinkedInTrendScout() {
  const [brief, setBrief] = useState(null);
  const [briefSource, setBriefSource] = useState("");
  const [daily, setDaily] = useState([]); // archive from the GitHub Action
  const [history, setHistory] = useState([]); // on-demand runs in this browser
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [showProfile, setShowProfile] = useState(false);
  const [postLog, setPostLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const hist = readJSON(HISTORY_KEY, []);
    setHistory(hist);
    setProfile(readJSON(PROFILE_KEY, DEFAULT_PROFILE));
    setPostLog(readJSON(POSTLOG_KEY, []));

    Promise.all([
      fetch("/linkedin-briefs/latest.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/linkedin-briefs/index.json").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([latest, index]) => {
      setDaily(Array.isArray(index) ? index : []);
      const manual = hist[0];
      if (latest?.topics && (!manual || latest.generatedAt > manual.generatedAt)) {
        setBrief(latest);
        setBriefSource("daily");
      } else if (manual) {
        setBrief(manual);
        setBriefSource("manual");
      }
    });
  }, []);

  function saveProfile(value) {
    setProfile(value);
    writeJSON(PROFILE_KEY, value);
  }

  function logPost(entry) {
    const next = [{ ...entry, date: todayET() }, ...postLog.filter((p) => p.title !== entry.title)].slice(0, 100);
    setPostLog(next);
    writeJSON(POSTLOG_KEY, next);
  }

  async function handleRun() {
    setError("");
    setLoading(true);
    setProgress("Starting…");
    try {
      const recentTitles = [
        ...history.slice(0, 5).flatMap((b) => b.topics.map((t) => t.title)),
        ...daily.slice(0, 5).flatMap((d) => d.titles || []),
      ];
      const result = await runTrendScout({
        transport,
        profile,
        recentTitles: [...new Set(recentTitles)].slice(0, 30),
        performanceSummary: summarizePerformance(postLog),
        onProgress: setProgress,
      });
      const nextHistory = [result, ...history].slice(0, 15);
      setHistory(nextHistory);
      writeJSON(HISTORY_KEY, nextHistory);
      setBrief(result);
      setBriefSource("manual");
    } catch (e) {
      setError(`Error: ${e.message}`);
    }
    setLoading(false);
    setProgress("");
  }

  async function openArchive(value) {
    if (!value) return;
    const [kind, id] = value.split(":");
    if (kind === "manual") {
      const b = history.find((h) => h.generatedAt === id);
      if (b) { setBrief(b); setBriefSource("manual"); }
      return;
    }
    try {
      const res = await fetch(`/linkedin-briefs/${id}.json`);
      if (!res.ok) throw new Error(`Brief for ${id} not found`);
      setBrief(await res.json());
      setBriefSource("daily");
    } catch (e) {
      setError(e.message);
    }
  }

  const postedTitles = new Set(postLog.map((p) => p.title));
  const perf = summarizePerformance(postLog);
  const isToday = brief?.date === todayET();

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8ff", fontFamily: "'Sora', sans-serif", color: "#1a1c30", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea, input, select { resize: vertical; font-family: inherit; }
        textarea:focus, input:focus { outline: none !important; border-color: #00d4aa !important; box-shadow: 0 0 0 3px #00d4aa15 !important; }
        .run-btn { transition: all 0.2s; cursor: pointer; border: none; font-family: inherit; background: linear-gradient(135deg, #00d4aa, #0066ff); color: #fff; font-weight: 700; border-radius: 10px; padding: 12px 22px; font-size: 13.5px; }
        .run-btn.small { padding: 8px 14px; font-size: 12px; }
        .run-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.08); }
        .run-btn:disabled { opacity: 0.6; cursor: wait; }
        .ghost-btn { cursor: pointer; font-family: inherit; background: #fff; border: 1px solid #ccd0e8; color: #1a1c30; border-radius: 8px; padding: 6px 12px; font-size: 11.5px; font-weight: 600; }
        .ghost-btn:hover { border-color: #00d4aa; }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ borderBottom: "1px solid #dde0f0", padding: "32px 40px 26px", background: "#ffffff" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: "linear-gradient(135deg, #f5a623, #ff4d6d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📈</div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{ fontSize: 23, fontWeight: 800, color: "#111328" }}>LinkedIn Trend Scout</h1>
            <p style={{ fontSize: 12.5, color: "#555878", marginTop: 4 }}>
              Top 5 topics with traction in AI, product management and tech — ranked by traction × your fit, with verified articles and videos.
            </p>
          </div>
          <button className="run-btn" onClick={handleRun} disabled={loading}>
            {loading ? "Researching…" : "🔎 Run fresh research"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 40px 0" }}>
        {/* ── TOOLBAR: source, archive, profile ── */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          {brief && (
            <span style={{ fontSize: 11, fontWeight: 700, color: briefSource === "daily" ? "#00a184" : "#0066ff", background: briefSource === "daily" ? "#00d4aa14" : "#0099ff14", padding: "4px 10px", borderRadius: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {briefSource === "daily" ? "Daily auto-brief" : "On-demand run"} · {brief.date}{isToday ? " · today" : ""}
            </span>
          )}
          {(daily.length > 0 || history.length > 0) && (
            <select className="ghost-btn" value="" onChange={(e) => openArchive(e.target.value)}>
              <option value="">Past briefs…</option>
              {daily.map((d) => <option key={`d${d.date}`} value={`daily:${d.date}`}>Daily · {d.date}</option>)}
              {history.map((h) => <option key={`m${h.generatedAt}`} value={`manual:${h.generatedAt}`}>On-demand · {h.date} {new Date(h.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</option>)}
            </select>
          )}
          <button className="ghost-btn" onClick={() => setShowProfile(!showProfile)}>
            {showProfile ? "Hide creator profile" : "Edit creator profile"}
          </button>
        </div>

        {showProfile && (
          <Card style={{ marginBottom: 16 }}>
            <Label>Creator profile — what the scout optimizes for (saved in this browser)</Label>
            <textarea value={profile} onChange={(e) => saveProfile(e.target.value)} rows={12} style={{ width: "100%", background: "#f0f1fa", border: "1px solid #dde0f0", borderRadius: 10, padding: "10px 13px", fontSize: 12.5, lineHeight: 1.6 }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11.5, color: "#888baa" }}>
              <span>The daily GitHub Action uses DEFAULT_PROFILE in src/trendScoutCore.js — edit it there for the auto-brief.</span>
              <button className="ghost-btn" onClick={() => saveProfile(DEFAULT_PROFILE)}>Reset</button>
            </div>
          </Card>
        )}

        {loading && (
          <Card style={{ marginBottom: 16, borderColor: "#00d4aa60" }}>
            <div style={{ fontSize: 13, fontWeight: 600, animation: "pulse 1.6s infinite" }}>{progress}</div>
            <div style={{ fontSize: 11.5, color: "#888baa", marginTop: 6 }}>Takes about 2–4 minutes: one scan plus five deep dives with live web search.</div>
          </Card>
        )}
        {error && <Card style={{ marginBottom: 16, borderColor: "#ff4d6d60", color: "#ff4d6d", fontSize: 13 }}>{error}</Card>}

        {!brief && !loading && (
          <Card style={{ borderStyle: "dashed", fontSize: 13, color: "#555878", lineHeight: 1.7 }}>
            No brief yet. Click <b>Run fresh research</b> for one now. Once the daily GitHub Action is enabled, a new brief appears here every weekday morning.
          </Card>
        )}

        {brief && (
          <>
            {/* ── PULSE ── */}
            <Card style={{ marginBottom: 16, background: "linear-gradient(135deg, #ffffff, #f2fbf8)" }}>
              <Label>This week's pulse</Label>
              <div style={{ fontSize: 13.5, lineHeight: 1.65, color: "#111328" }}>{brief.pulse}</div>
              <div style={{ fontSize: 11, color: "#888baa", marginTop: 10, fontFamily: "'DM Mono', monospace" }}>
                {brief.stats?.searches ?? "—"} searches · {brief.stats?.linksVerified ?? "—"} links verified · {brief.stats?.linksDropped ?? 0} unverifiable dropped · pillars: {PILLARS.filter((p) => brief.topics.some((t) => t.pillar === p)).join(", ")}
              </div>
            </Card>

            {brief.topics.map((t) => (
              <TopicCard key={`${brief.generatedAt}-${t.rank}`} topic={t} profile={profile} onLogPost={logPost} posted={postedTitles.has(t.title)} />
            ))}
          </>
        )}

        {/* ── WHAT'S WORKING ── */}
        {postLog.length > 0 && (
          <Card style={{ marginTop: 8 }}>
            <Label>What's converting for you ({postLog.length} logged posts) — fed into every new scan</Label>
            <pre style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, color: "#1a1c30", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{perf}</pre>
          </Card>
        )}
      </div>
    </div>
  );
}
