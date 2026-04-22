import React from 'react'

const STEP_LABELS = ['Validate', 'Explore', 'Identify', 'Guide', 'Suggest']
const FLOW_DESC: Record<string, string> = {
  venting:  'Listening and reflecting — no rush to fix.',
  anxiety:  'Slowing down, grounding the feeling first.',
  sadness:  'Holding space. No silver linings.',
  grief:    'Present without agenda.',
  anger:    'Acknowledging the heat before digging under it.',
  coaching: 'Helping you think through it yourself.',
  cbt:      'Gently surfacing thought patterns.',
  crisis:   'Your safety comes first.',
  stress:   'One thing at a time.',
  neutral:  'Open conversation.',
}

interface Props {
  emotion: string
  emotionEmoji: string
  emotionColor: string
  emotionScore: number
  flowType: string
  flowStep: number
  riskLevel: string
  username: string
  msgCount: number
  onNewSession: () => void
  onLogout: () => void
}

export function Sidebar({ emotion, emotionEmoji, emotionColor, emotionScore,
  flowType, flowStep, riskLevel, username, msgCount, onNewSession, onLogout }: Props) {

  const RISK_COLORS: Record<string, string> = {
    low: '#2dd4bf', medium: '#fbbf24', high: '#f87171', crisis: '#ef4444'
  }
  const riskColor = RISK_COLORS[riskLevel] || '#2dd4bf'

  return (
    <aside style={{
      width: '260px', flexShrink: 0, background: 'var(--s1)',
      borderRight: '1px solid var(--b1)', display: 'flex',
      flexDirection: 'column', height: '100vh', overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--b1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '9px',
            background: 'linear-gradient(135deg, #5b8ef0, #9b6ef0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
          }}>🧠</div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>MindfulAI</div>
            <div style={{ fontSize: '10px', color: 'var(--t3)', fontFamily: 'monospace' }}>v3.0 · groq + llama-3.1</div>
          </div>
        </div>

        {/* Emotion widget */}
        <div style={{ padding: '12px', background: 'var(--s2)', borderRadius: '12px', border: '1px solid var(--b1)' }}>
          <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--t3)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Emotion
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '20px' }}>{emotionEmoji}</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: emotionColor, textTransform: 'capitalize' }}>
                {emotion}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--t3)', fontFamily: 'monospace' }}>
                {Math.round(emotionScore * 100)}% confidence
              </div>
            </div>
          </div>
          <div style={{ height: '3px', background: 'var(--s3)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(emotionScore * 100)}%`,
              background: emotionColor, borderRadius: '2px', transition: 'width 0.5s' }} />
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: '12px 10px', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--t3)',
          textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 8px 4px' }}>
          Session
        </div>

        {/* New session */}
        <button onClick={onNewSession} style={{
          display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
          padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
          fontSize: '13px', color: 'var(--t2)', border: '1px solid transparent',
          background: 'none', textAlign: 'left', transition: 'all 0.12s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
          <span>✨</span> New Session
        </button>

        {/* Flow steps */}
        <div style={{ margin: '12px 0', padding: '12px', background: 'var(--s2)',
          borderRadius: '12px', border: '1px solid var(--b1)' }}>
          <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--t3)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Flow · <span style={{ color: 'var(--acc)' }}>{flowType}</span>
          </div>

          {STEP_LABELS.map((label, i) => {
            const done = i < flowStep
            const active = i === flowStep
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px',
                padding: '5px 0', fontSize: '12px',
                color: active ? 'var(--t1)' : done ? 'var(--t2)' : 'var(--t3)' }}>
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontFamily: 'monospace',
                  background: active ? 'var(--acc)' : done ? 'var(--acc-d)' : 'transparent',
                  border: active ? '1px solid var(--acc)' : done ? '1px solid rgba(91,142,240,0.3)' : '1px solid var(--b2)',
                  color: active ? '#fff' : done ? 'var(--acc)' : 'var(--t3)',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                {label}
              </div>
            )
          })}

          <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '10px',
            lineHeight: '1.5', borderTop: '1px solid var(--b1)', paddingTop: '8px' }}>
            {FLOW_DESC[flowType] || ''}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[['Messages', msgCount], ['Risk', riskLevel]].map(([label, val]) => (
            <div key={String(label)} style={{ padding: '10px', background: 'var(--s2)',
              borderRadius: '8px', border: '1px solid var(--b1)', textAlign: 'center' }}>
              <div style={{
                fontSize: '16px', fontWeight: 600, fontFamily: 'monospace',
                color: String(label) === 'Risk' ? riskColor : 'var(--t1)',
              }}>{String(val)}</div>
              <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '2px' }}>{String(label)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* User pill */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--b1)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 12px',
          background: 'var(--s2)', borderRadius: '8px', border: '1px solid var(--b1)',
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #5b8ef0, #9b6ef0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 600,
          }}>{username[0]?.toUpperCase() || 'U'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username}</div>
            <div style={{ fontSize: '10px', color: 'var(--t3)' }}>active session</div>
          </div>
          <button onClick={onLogout} title="Sign out" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--t3)', fontSize: '13px', padding: '4px',
          }}>⏻</button>
        </div>
      </div>
    </aside>
  )
}
