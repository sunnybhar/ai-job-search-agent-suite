import { useState } from 'react';
import ResumeTailorAgentSunny from './ResumeTailorAgent_Sunny';
import ResumeTailorAgentTanya from './ResumeTailorAgent_Tanya';
import CoverLetterAgent from './CoverLetterAgent';
import CoffeeChatAgent from './CoffeeChatAgent';
import StartupEmailAgent from './StartupEmailAgent';
import FollowUpAgent from './FollowUpAgent';
import BehavioralCoach from './BehavioralCoach';

const AGENTS = [
{
  id: 'resume-sunny',
  number: '01',
  name: 'JD to Resume — Sunny',
  description: 'ATS scoring + full resume rewrite — calibrated for PM and Ops roles',
  icon: '⚡',
  color: '#00a67e',
  component: <ResumeTailorAgentSunny />
},
{
  id: 'resume-tanya',
  number: '01T',
  name: 'JD to Resume — Tanya',
  description: 'ATS scoring + full resume rewrite — calibrated for Sustainability and ESG roles',
  icon: '🌿',
  color: '#059669',
  component: <ResumeTailorAgentTanya />
},
  {
    id: 'cover',
    number: '03',
    name: 'Cover Letter Generator',
    description: '3 tailored versions using 6-step structure — Professional, Bold, and Strategic tones',
    icon: '✉️',
    color: '#7c3aed',
    component: <CoverLetterAgent />
  },
  {
    id: 'coffee',
    number: '05',
    name: 'Coffee Chat Prep Agent',
    description: 'Opener, pitch, questions, talking points — URL fetch + YouTube transcript',
    icon: '☕',
    color: '#2563eb',
    component: <CoffeeChatAgent />
  },
  {
  id: 'startup',
  number: '06',
  name: 'Startup Cold Email Agent',
  description: 'Analyzes startup → 3 pain points → cold email + portfolio rewrite',
  icon: '🚀',
  color: '#e11d48',
  component: <StartupEmailAgent />
  },
  {
    id: 'followup',
    number: '07',
    name: 'Follow-Up Email Agent',
    description: '5 scenarios — coffee chat, interview, application, cold outreach, LinkedIn',
    icon: '↩️',
    color: '#0d9488',
    component: <FollowUpAgent />
  },
  {
    id: 'behavioral',
    number: '09',
    name: 'Behavioral Interview Coach',
    description: 'STAR grading · FAANG frameworks · Question bank · Full mock interview',
    icon: '🎤',
    color: '#7c3aed',
    component: <BehavioralCoach />
  },
];

export default function App() {
  const [active, setActive] = useState(null);

  if (active) {
    const agent = AGENTS.find(a => a.id === active);
    return (
      <div style={{ minHeight: '100vh', background: '#f7f8ff' }}>
        {/* Back bar */}
        <div style={{
          background: '#ffffff',
          borderBottom: '1px solid #dde0f0',
          padding: '11px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 4px #00000008'
        }}>
          <button
            onClick={() => setActive(null)}
            style={{
              background: 'none',
              border: '1px solid #dde0f0',
              borderRadius: 8,
              color: '#555878',
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.target.style.borderColor = '#6366f1'; e.target.style.color = '#4f46e5'; }}
            onMouseLeave={e => { e.target.style.borderColor = '#dde0f0'; e.target.style.color = '#555878'; }}
          >
            ← All Agents
          </button>
          <div style={{ width: 1, height: 20, background: '#dde0f0' }} />
          <span style={{ fontSize: 11, color: '#888baa', fontWeight: 600, letterSpacing: 0.5 }}>
            Agent {agent.number}
          </span>
          <span style={{ fontSize: 13, color: '#1a1c30', fontWeight: 700 }}>
            {agent.name}
          </span>
        </div>
        {agent.component}
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f7f8ff',
      fontFamily: "'Sora', sans-serif",
      padding: '52px 40px 80px'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .agent-card {
          transition: all 0.2s;
          cursor: pointer;
        }
        .agent-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px #00000012 !important;
          border-color: #ccd0e8 !important;
        }
        .coming-card {
          opacity: 0.5;
        }
      `}</style>

      <div style={{ maxWidth: 920, margin: '0 auto' }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 50, height: 50, borderRadius: 14,
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, boxShadow: '0 4px 20px #6366f120'
            }}>🚀</div>
            <div>
              <div style={{ fontSize: 10, color: '#6366f1', letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
                Job Search Suite · Fordham MBA
              </div>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111328', letterSpacing: -0.8, lineHeight: 1 }}>
                AI Agent Dashboard
              </h1>
            </div>
          </div>
          <p style={{ fontSize: 14, color: '#666a8a', maxWidth: 520, lineHeight: 1.7 }}>
            Your personal job search toolkit. Each agent handles one part of the pipeline — from resume tailoring to cover letters, outreach, and interview prep.
          </p>
        </div>

        {/* ── PROGRESS BAR ── */}
        <div style={{
          background: '#ffffff', border: '1px solid #dde0f0',
          borderRadius: 14, padding: '18px 24px', marginBottom: 32,
          display: 'flex', alignItems: 'center', gap: 20
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#555878', fontWeight: 600 }}>Suite Progress</span>
              <span style={{ fontSize: 12, color: '#6366f1', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                {AGENTS.length} / 10 agents built
              </span>
            </div>
            <div style={{ height: 8, background: '#eef0fb', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(AGENTS.length / 10) * 100}%`,
                background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                borderRadius: 4,
                transition: 'width 1s ease'
              }} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111328', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
              {AGENTS.length}
            </div>
            <div style={{ fontSize: 11, color: '#888baa' }}>of 10 live</div>
          </div>
        </div>

        {/* ── SECTION LABEL ── */}
        <div style={{ fontSize: 10, color: '#888baa', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
          Live Agents — Click to Launch
        </div>

        {/* ── AGENT CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          {AGENTS.map(agent => (
            <div
              key={agent.id}
              className="agent-card"
              onClick={() => setActive(agent.id)}
              style={{
                background: '#ffffff',
                border: '1px solid #dde0f0',
                borderRadius: 14,
                padding: '22px 24px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 2px 8px #00000006'
              }}
            >
              {/* Top accent line */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: 3, background: agent.color,
                borderRadius: '14px 14px 0 0'
              }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 11, flexShrink: 0,
                  background: `${agent.color}12`,
                  border: `1px solid ${agent.color}28`,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 20
                }}>{agent.icon}</div>

                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 10, color: agent.color, fontWeight: 700,
                    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 5
                  }}>
                    Agent {agent.number}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111328', marginBottom: 7 }}>
                    {agent.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#666a8a', lineHeight: 1.6 }}>
                    {agent.description}
                  </div>
                </div>

                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: '#f0f1fa', border: '1px solid #dde0f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, color: '#888baa', flexShrink: 0
                }}>→</div>
              </div>

              {/* Launch tag */}
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{
                  fontSize: 10, color: agent.color,
                  background: `${agent.color}10`,
                  border: `1px solid ${agent.color}25`,
                  padding: '3px 10px', borderRadius: 20,
                  fontWeight: 700, letterSpacing: 0.5
                }}>Launch →</span>
              </div>
            </div>
          ))}

          {/* ── COMING SOON PLACEHOLDERS ── */}
          {[
            { num: '02', name: 'ATS Score & Gap Analyzer', icon: '📊', desc: 'Score your resume before applying' },
            { num: '04', name: 'LinkedIn Outreach Drafter', icon: '🤝', desc: 'Personalized connection messages at scale' },
            { num: '05', name: 'Coffee Chat Prep Agent', icon: '☕', desc: 'Smart questions + elevator pitch per person' },
            { num: '06', name: 'Follow-Up Email Agent', icon: '📬', desc: 'Post-interview follow-up that converts' },
            { num: '07', name: 'Company Intelligence Agent', icon: '🔍', desc: 'Research any company before applying' },
            { num: '08', name: 'Job Fit Scoring Agent', icon: '🎯', desc: 'Rank JDs by realistic fit before you apply' },
            { num: '09', name: 'Behavioral Interview Coach', icon: '🎤', desc: 'STAR-format practice with AI feedback' },
            { num: '10', name: 'Case & Technical Prep Agent', icon: '🧠', desc: 'PM and consulting interview simulations' },
          ].map((item) => (
            <div
              key={item.num}
              className="coming-card"
              style={{
                background: '#fafbff',
                border: '1px dashed #dde0f0',
                borderRadius: 14,
                padding: '22px 24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 11, flexShrink: 0,
                  background: '#f0f1fa', border: '1px solid #e8eaf4',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 20, opacity: 0.5
                }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 10, color: '#aaaacc', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 5 }}>
                    Agent {item.num} · Coming Soon
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#888baa', marginBottom: 5 }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#aaaacc', lineHeight: 1.5 }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}