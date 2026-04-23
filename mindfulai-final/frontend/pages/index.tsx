import React, { useState, useRef, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { v4 as uuid } from 'uuid'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { ChatBubble, TypingBubble, Message } from '@/components/chat/ChatBubble'
import { Sidebar } from '@/components/ui/Sidebar'
import { RightPanel } from '@/components/ui/RightPanel'

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

const STARTERS = [
  "I've been feeling really anxious lately",
  "I need to vent about something",
  "I'm struggling with work stress",
  "I don't feel okay today",
  "I feel really lonely recently",
  "I've been overthinking everything",
]

const EMOTION_MAP: Record<string, { emoji: string; color: string }> = {
  joy:        { emoji: '😊', color: '#F59E0B' },
  sadness:    { emoji: '😔', color: '#3B82F6' },
  anger:      { emoji: '😠', color: '#EF4444' },
  fear:       { emoji: '😰', color: '#8B5CF6' },
  anxiety:    { emoji: '😟', color: '#F97316' },
  neutral:    { emoji: '😐', color: '#6B7280' },
  grief:      { emoji: '💔', color: '#3B82F6' },
  stress:     { emoji: '😓', color: '#F97316' },
  loneliness: { emoji: '🌫️', color: '#3B82F6' },
  shame:      { emoji: '😶', color: '#9CA3AF' },
  guilt:      { emoji: '😞', color: '#6B7280' },
  overwhelm:  { emoji: '😰', color: '#8B5CF6' },
}

function getEmotion(label: string) {
  return EMOTION_MAP[label.toLowerCase()] || { emoji: '💭', color: '#6B7280' }
}

// Local emotion detection fallback (no API needed)
function detectEmotionLocal(text: string) {
  const t = text.toLowerCase()
  if (/anxious|panic|worry|anxiet|nervous|overthink/.test(t)) return { label: 'anxiety', score: 0.8 }
  if (/sad|depress|cry|hopeless|empty|numb|worthless/.test(t)) return { label: 'sadness', score: 0.78 }
  if (/angry|furious|hate|frustrated|rage/.test(t)) return { label: 'anger', score: 0.76 }
  if (/alone|lonely|isolat|no one/.test(t)) return { label: 'loneliness', score: 0.74 }
  if (/stress|overwhelm|too much|exhaust|burnout/.test(t)) return { label: 'stress', score: 0.75 }
  if (/scared|afraid|terrif|dread/.test(t)) return { label: 'fear', score: 0.72 }
  return { label: 'neutral', score: 0.5 }
}

function detectRisk(text: string) {
  if (/kill.*self|suicide|end.*life|want to die|self.harm/i.test(text)) return 'crisis'
  if (/hopeless|no reason to live|can't go on/i.test(text)) return 'high'
  if (/really struggling|falling apart|can't take it/i.test(text)) return 'medium'
  return 'low'
}

export default function ChatPage() {
  const { ready, user, logout } = useAuth(true)

  // Session state
  const [sessionId, setSessionId] = useState(() => uuid())
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // Emotion / flow state
  const [emotion, setEmotion] = useState('neutral')
  const [emotionEmoji, setEmotionEmoji] = useState('😐')
  const [emotionColor, setEmotionColor] = useState('#6B7280')
  const [emotionScore, setEmotionScore] = useState(0.5)
  const [emotionLog, setEmotionLog] = useState<EmotionEntry[]>([])
  const [flowType, setFlowType] = useState('venting')
  const [flowStep, setFlowStep] = useState(0)
  const [riskLevel, setRiskLevel] = useState('low')

  // History for right panel
  const [historyMsgs, setHistoryMsgs] = useState<HistoryMsg[]>([])
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, boolean>>({})

  const [sessionStart] = useState(new Date())
  const [provider, setProvider] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (ready) {
      api.health().then(d => setProvider(d.provider)).catch(() => {})
    }
  }, [ready])

  const updateEmotion = useCallback((label: string, score: number, emoji?: string, color?: string) => {
    const em = getEmotion(label)
    setEmotion(label)
    setEmotionScore(score)
    setEmotionEmoji(emoji || em.emoji)
    setEmotionColor(color || em.color)
    setEmotionLog(prev => [...prev, { label, emoji: emoji || em.emoji, color: color || em.color, time: new Date() }])
  }, [])

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || input).trim()
    if (!content || loading) return

    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    setLoading(true)

    // Optimistic user message
    const userMsg: Message = {
      id: uuid(),
      role: 'user',
      content,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setHistoryMsgs(prev => [...prev, { role: 'user', content }])

    // Local instant detection
    const localEm = detectEmotionLocal(content)
    updateEmotion(localEm.label, localEm.score)
    setRiskLevel(detectRisk(content))

    try {
      // 1. CALL NEW LIGHTWEIGHT API
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_input: content,
          messages: historyMsgs.slice(-6) // Only send last 6 for context
        })
      })

      const data = await res.json()
      const aiReply = data.reply

      // 2. CREATE AI MESSAGE
      const aiMsg: Message = {
        id: uuid(),
        role: 'assistant',
        content: aiReply,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, aiMsg])
      setHistoryMsgs(prev => [...prev, { role: 'assistant', content: aiReply }])

      // 3. UPDATE FLOW (Local logic for simplicity)
      setFlowStep(prev => prev + 1)
      if (flowStep > 2) setFlowType('exploring')
      if (flowStep > 5) setFlowType('guiding')

    } catch (err: any) {
      console.error('Chat error:', err)
      const errMsg: Message = {
        id: uuid(),
        role: 'assistant',
        content: "I'm here with you. Something went wrong on my side, but I'm still listening.",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, sessionId, updateEmotion])

  const newSession = () => {
    setSessionId(uuid())
    setMessages([])
    setHistoryMsgs([])
    setEmotionLog([])
    setEmotion('neutral')
    setEmotionEmoji('😐')
    setEmotionColor('#6B7280')
    setEmotionScore(0.5)
    setFlowType('venting')
    setFlowStep(0)
    setRiskLevel('low')
    setFeedbackGiven({})
    inputRef.current?.focus()
  }

  const onFeedback = async (msgId: string, rating: number, suggestionTitle?: string) => {
    setFeedbackGiven(prev => ({ ...prev, [msgId]: true }))
    try {
      await api.feedback(0, rating, suggestionTitle)
    } catch {}
  }

  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg)', color: 'var(--t2)', fontSize: '14px' }}>
      Loading...
    </div>
  )

  const msgCount = messages.length

  return (
    <>
      <Head>
        <title>MindfulAI — Your Mental Health Companion</title>
        <meta name="description" content="AI-powered mental health support" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

        {/* Sidebar */}
        <Sidebar
          emotion={emotion}
          emotionEmoji={emotionEmoji}
          emotionColor={emotionColor}
          emotionScore={emotionScore}
          flowType={flowType}
          flowStep={flowStep}
          riskLevel={riskLevel}
          username={user.username}
          msgCount={msgCount}
          onNewSession={newSession}
          onLogout={logout}
        />

        {/* Main chat */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

          {/* Header */}
          <div style={{
            padding: '14px 22px', borderBottom: '1px solid var(--b1)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--s1)', flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Conversation</div>
              <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '1px' }}>
                Session · {sessionStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {provider && <span style={{ marginLeft: '8px', color: 'var(--acc)', fontFamily: 'monospace' }}>
                  ⚡ {provider}
                </span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {/* Flow chip */}
              <div style={{
                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontFamily: 'monospace',
                border: '1px solid rgba(91,142,240,0.25)', color: 'var(--acc)',
                background: 'var(--acc-d)', textTransform: 'capitalize',
              }}>{flowType}</div>
              {/* Msg count */}
              <div style={{
                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontFamily: 'monospace',
                border: '1px solid var(--b1)', color: 'var(--t2)', background: 'var(--s2)',
              }}>{msgCount} msgs</div>
              {/* Risk */}
              <div style={{
                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontFamily: 'monospace',
                border: `1px solid ${riskLevel === 'low' ? 'rgba(45,212,191,0.25)' : 'rgba(248,113,133,0.25)'}`,
                color: riskLevel === 'low' ? '#2dd4bf' : '#f87171',
                background: riskLevel === 'low' ? 'rgba(45,212,191,0.06)' : 'rgba(248,113,133,0.06)',
              }}>● {riskLevel} risk</div>
            </div>
          </div>

          {/* Crisis banner */}
          {(riskLevel === 'crisis' || riskLevel === 'high') && (
            <div style={{
              padding: '8px 22px', display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.2)',
              fontSize: '12px', color: '#fb7185', flexShrink: 0,
            }}>
              <span>⚠</span>
              <span>
                You're not alone. Crisis support available 24/7:{' '}
                <strong>iCall 9152987821</strong> · <strong>Vandrevala 1860-2662-345</strong>
              </span>
            </div>
          )}

          {/* Messages area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.length === 0 ? (
              /* Empty state */
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '40px',
                minHeight: '300px',
              }}>
                <div style={{ fontSize: '44px' }}>🌿</div>
                <div style={{ fontSize: '20px', fontWeight: 600 }}>This is your safe space</div>
                <div style={{ fontSize: '13px', color: 'var(--t3)', textAlign: 'center',
                  maxWidth: '360px', lineHeight: '1.65' }}>
                  Share what's on your mind. No judgment, no rush. Just honest conversation.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
                  {STARTERS.map(s => (
                    <button key={s} onClick={() => sendMessage(s)}
                      style={{
                        padding: '7px 14px', background: 'var(--s1)', border: '1px solid var(--b2)',
                        borderRadius: '20px', fontSize: '12px', color: 'var(--t2)', cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--acc)'
                        e.currentTarget.style.color = 'var(--acc)'
                        e.currentTarget.style.background = 'var(--acc-d)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--b2)'
                        e.currentTarget.style.color = 'var(--t2)'
                        e.currentTarget.style.background = 'var(--s1)'
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  username={user.username}
                  feedbackGiven={feedbackGiven[msg.id]}
                  onFeedback={(rating, sugTitle) => onFeedback(msg.id, rating, sugTitle)}
                />
              ))
            )}

            {/* Typing indicator */}
            {loading && <TypingBubble />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div style={{
            padding: '14px 22px', borderTop: '1px solid var(--b1)',
            background: 'var(--s1)', flexShrink: 0,
          }}>
            <div style={{
              display: 'flex', gap: '10px', alignItems: 'flex-end',
              background: 'var(--s2)', border: '1px solid var(--b2)',
              borderRadius: '18px', padding: '9px 13px',
              transition: 'border-color 0.15s',
            }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--b3)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--b2)')}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Tell me what's on your mind..."
                rows={1}
                disabled={loading}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: 'var(--t1)', fontFamily: 'inherit', fontSize: '14px',
                  resize: 'none', maxHeight: '120px', lineHeight: '1.5',
                  minHeight: '20px',
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: !input.trim() || loading ? 'var(--s3)' : 'var(--acc)',
                  border: 'none', cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.12s',
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
            <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--t3)',
              marginTop: '7px', fontFamily: 'monospace' }}>
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </main>

        {/* Right panel */}
        <RightPanel
          emotionLog={emotionLog}
          history={historyMsgs}
          flowType={flowType}
          flowStep={flowStep}
          msgCount={msgCount}
          sessionStart={sessionStart}
        />
      </div>
    </>
  )
}
