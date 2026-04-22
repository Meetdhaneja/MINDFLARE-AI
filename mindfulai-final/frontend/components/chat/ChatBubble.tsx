import React from 'react'

interface Suggestion {
  title: string
  description: string
  category: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  emotion?: string
  emotionEmoji?: string
  suggestion?: Suggestion | null
  timestamp: Date
}

interface Props {
  message: Message
  username: string
  onFeedback?: (rating: number, suggestion?: string) => void
  feedbackGiven?: boolean
}

const CAT_COLORS: Record<string, string> = {
  grounding: '#2dd4bf', breathing: '#60a5fa', journaling: '#fbbf24',
  physical: '#f87171', somatic: '#2dd4bf', cbt: '#818cf8',
  social: '#fb923c', emotional: '#f472b6', behavioral: '#34d399',
  reflection: '#c084fc', productivity: '#a3e635', recovery: '#67e8f9',
  distraction: '#fda4af', mindfulness: '#86efac', 'self-care': '#d8b4fe',
}

export function ChatBubble({ message, username, onFeedback, feedbackGiven }: Props) {
  const isUser = message.role === 'user'

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: '4px' }}>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px',
        flexDirection: isUser ? 'row-reverse' : 'row' }}>

        {/* Avatar */}
        <div style={{
          width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 600,
          background: isUser ? 'var(--s3)' : 'linear-gradient(135deg, #5b8ef0, #9b6ef0)',
          color: isUser ? 'var(--t2)' : '#fff',
        }}>
          {isUser ? username[0]?.toUpperCase() || 'U' : '💭'}
        </div>

        {/* Bubble */}
        <div style={{ maxWidth: '72%' }}>
          <div style={{
            padding: '11px 15px', fontSize: '14px', lineHeight: '1.65',
            borderRadius: '18px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            ...(isUser
              ? { background: 'var(--acc)', color: '#fff', borderBottomRightRadius: '4px' }
              : { background: 'var(--s1)', border: '1px solid var(--b2)', color: 'var(--t1)', borderBottomLeftRadius: '4px' }
            )
          }}>
            {message.content}
          </div>

          {/* Suggestion pill */}
          {!isUser && message.suggestion && (
            <div style={{
              marginTop: '8px', padding: '12px 14px',
              background: 'var(--s2)', border: '1px solid var(--b2)',
              borderRadius: '14px', maxWidth: '100%',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'monospace',
                  color: CAT_COLORS[message.suggestion.category] || 'var(--acc)',
                  textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  💡 suggestion
                </span>
                <span style={{ fontSize: '10px', color: 'var(--t3)', fontFamily: 'monospace' }}>
                  {message.suggestion.category}
                </span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                {message.suggestion.title}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--t2)', lineHeight: '1.5' }}>
                {message.suggestion.description}
              </div>

              {!feedbackGiven && onFeedback && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  {[['👍', 1, 'Helpful'], ['👎', -1, 'Not quite']].map(([emoji, val, label]) => (
                    <button key={String(val)} onClick={() => onFeedback(val as number, message.suggestion?.title)}
                      style={{
                        padding: '4px 10px', borderRadius: '20px',
                        border: '1px solid var(--b2)', background: 'none',
                        color: 'var(--t3)', cursor: 'pointer', fontSize: '12px',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                      {emoji} {label}
                    </button>
                  ))}
                </div>
              )}
              {feedbackGiven && (
                <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '8px' }}>
                  Thanks for the feedback ✓
                </div>
              )}
            </div>
          )}

          {/* Time */}
          <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '4px',
            textAlign: isUser ? 'right' : 'left', fontFamily: 'monospace' }}>
            {fmt(message.timestamp)}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TypingBubble() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '4px' }}>
      <div style={{
        width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px',
        background: 'linear-gradient(135deg, #5b8ef0, #9b6ef0)',
      }}>💭</div>
      <div style={{
        padding: '12px 16px', background: 'var(--s1)', border: '1px solid var(--b2)',
        borderRadius: '18px', borderBottomLeftRadius: '4px',
        display: 'flex', gap: '4px', alignItems: 'center',
      }}>
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  )
}
