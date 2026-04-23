import React, { useState } from 'react'

interface EmotionEntry {
  label: string
  emoji: string
  color: string
  time: Date
}

interface HistoryMsg {
  role: string
  content: string
  emotion?: string
  timestamp?: string
}

interface Props {
  emotionLog: EmotionEntry[]
  history: HistoryMsg[]
  flowType: string
  flowStep: number
  msgCount: number
  sessionStart: Date
}

const STEP_LABELS = ['Validate', 'Explore', 'Identify', 'Guide', 'Suggest']

const FLOW_COLORS: Record<string, string> = {
  venting: '#60a5fa', anxiety: '#f97316', sadness: '#3b82f6',
  anger: '#ef4444', grief: '#8b5cf6', coaching: '#2dd4bf',
  cbt: '#a78bfa', stress: '#fbbf24', crisis: '#ef4444', neutral: '#6b7280',
}

export function RightPanel({ emotionLog, history, flowType, flowStep, msgCount, sessionStart }: Props) {
  const [tab, setTab] = useState<'emotions' | 'context' | 'stats'>('emotions')

  const dur = Math.round((new Date().getTime() - sessionStart.getTime()) / 60000)
  const uniqueEmotions = new Set(emotionLog.map(e => e.label)).size

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const tabStyle = (t: string) => ({
    flex: 1, padding: '10px 6px', fontSize: '11px', cursor: 'pointer',
    color: tab === t ? 'var(--acc)' : 'var(--t3)',
    border: 'none',
    borderBottom: tab === t ? '2px solid var(--acc)' : '2px solid transparent',
    marginBottom: '-1px', background: 'none',
    transition: 'all 0.12s', fontFamily: 'inherit',
  } as React.CSSProperties)

  return (
    <aside style={{
      width: '280px', flexShrink: 0, background: 'var(--s1)',
      borderLeft: '1px solid var(--b1)', display: 'flex',
      flexDirection: 'column', height: '100vh', overflow: 'hidden',
    }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--b1)', flexShrink: 0 }}>
        <button style={tabStyle('emotions')} onClick={() => setTab('emotions')}>Emotions</button>
        <button style={tabStyle('context')} onClick={() => setTab('context')}>Context</button>
        <button style={tabStyle('stats')} onClick={() => setTab('stats')}>Stats</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* ── Emotions tab ──────────────────────────── */}
        {tab === 'emotions' && (
          <>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--t3)',
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
              Emotion Timeline
            </div>
            {emotionLog.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--t3)', textAlign: 'center', padding: '24px 0' }}>
                Emotions tracked as you chat
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {emotionLog.slice(-12).map((e, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 0', borderBottom: '1px solid var(--b1)', fontSize: '12px',
                  }}>
                    <span style={{ fontSize: '15px' }}>{e.emoji}</span>
                    <span style={{ color: e.color, fontWeight: 500, textTransform: 'capitalize', flex: 1 }}>
                      {e.label}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--t3)', fontFamily: 'monospace' }}>
                      {fmt(e.time)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Breakdown chart */}
            {emotionLog.length > 0 && (() => {
              const counts: Record<string, { count: number; color: string; emoji: string }> = {}
              emotionLog.forEach(e => {
                if (!counts[e.label]) counts[e.label] = { count: 0, color: e.color, emoji: e.emoji }
                counts[e.label].count++
              })
              const sorted = Object.entries(counts).sort((a, b) => b[1].count - a[1].count)
              const total = emotionLog.length

              return (
                <div style={{ marginTop: '16px', padding: '14px', background: 'var(--s2)',
                  borderRadius: '12px', border: '1px solid var(--b1)' }}>
                  <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--t3)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                    Session Breakdown
                  </div>
                  {sorted.slice(0, 5).map(([label, { count, color, emoji }]) => {
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={label} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between',
                          fontSize: '12px', marginBottom: '4px' }}>
                          <span>{emoji} {label}</span>
                          <span style={{ fontFamily: 'monospace', color: 'var(--t3)' }}>{pct}%</span>
                        </div>
                        <div style={{ height: '3px', background: 'var(--s3)', borderRadius: '2px' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color,
                            borderRadius: '2px', transition: 'width 0.6s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </>
        )}

        {/* ── Context tab ───────────────────────────── */}
        {tab === 'context' && (
          <>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--t3)',
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
              Recent Context
            </div>
            {history.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--t3)', textAlign: 'center', padding: '24px 0' }}>
                Context builds as you chat
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {history.slice(-8).map((m, i) => (
                  <div key={i} style={{ padding: '8px 10px', background: 'var(--s2)',
                    borderRadius: '8px', border: '1px solid var(--b1)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--t3)',
                      textTransform: 'uppercase', marginBottom: '4px' }}>
                      {m.role}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--t2)', lineHeight: '1.5',
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Stats tab ─────────────────────────────── */}
        {tab === 'stats' && (
          <>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--t3)',
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
              Session Stats
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              {[
                ['Messages', msgCount],
                ['Duration', `${dur}m`],
                ['Emotions', uniqueEmotions],
                ['Flow Step', `${flowStep + 1}/5`],
              ].map(([label, val]) => (
                <div key={String(label)} style={{ padding: '12px', background: 'var(--s2)',
                  borderRadius: '8px', border: '1px solid var(--b1)', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'monospace' }}>{val}</div>
                  <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '2px' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Current flow */}
            <div style={{ padding: '14px', background: 'var(--s2)', borderRadius: '12px',
              border: '1px solid var(--b1)', marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--t3)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Conversation Flow
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 10px', borderRadius: '20px', background: 'var(--s3)',
                border: '1px solid var(--b2)', fontSize: '12px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%',
                  background: FLOW_COLORS[flowType] || 'var(--acc)', display: 'inline-block' }} />
                <span style={{ textTransform: 'capitalize', fontFamily: 'monospace' }}>{flowType}</span>
              </div>
              <div style={{ marginTop: '12px' }}>
                {STEP_LABELS.map((label, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '4px 0', fontSize: '12px',
                    color: i < flowStep ? 'var(--t2)' : i === flowStep ? 'var(--t1)' : 'var(--t3)' }}>
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', fontFamily: 'monospace', flexShrink: 0,
                      background: i === flowStep ? 'var(--acc)' : i < flowStep ? 'var(--acc-d)' : 'transparent',
                      border: i === flowStep ? '1px solid var(--acc)' : i < flowStep
                        ? '1px solid rgba(91,142,240,0.3)' : '1px solid var(--b2)',
                      color: i === flowStep ? '#fff' : i < flowStep ? 'var(--acc)' : 'var(--t3)',
                    }}>
                      {i < flowStep ? '✓' : i + 1}
                    </div>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
