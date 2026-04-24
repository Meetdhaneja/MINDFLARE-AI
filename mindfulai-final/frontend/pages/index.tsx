import React, { useState, useRef, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { v4 as uuid } from 'uuid'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Leaf, Sparkles, MessageCircle, Heart, ShieldAlert, Zap } from 'lucide-react'
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
  "I've been overthinking everything",
]

const EMOTION_MAP: Record<string, { emoji: string; color: string }> = {
  joy:        { emoji: '😊', color: '#F59E0B' },
  sadness:    { emoji: '😔', color: '#6366f1' },
  anger:      { emoji: '😠', color: '#EF4444' },
  fear:       { emoji: '😰', color: '#8B5CF6' },
  anxiety:    { emoji: '😟', color: '#F97316' },
  neutral:    { emoji: '😐', color: '#64748b' },
  grief:      { emoji: '💔', color: '#3B82F6' },
  stress:     { emoji: '😓', color: '#F97316' },
}

function getEmotion(label: string) {
  return EMOTION_MAP[label.toLowerCase()] || { emoji: '💭', color: '#6B7280' }
}

function detectEmotionLocal(text: string) {
  const t = text.toLowerCase()
  if (/anxious|panic|worry|anxiet|nervous|overthink/.test(t)) return { label: 'anxiety', score: 0.8 }
  if (/sad|depress|cry|hopeless|empty|numb|worthless/.test(t)) return { label: 'sadness', score: 0.78 }
  if (/angry|furious|hate|frustrated|rage/.test(t)) return { label: 'anger', score: 0.76 }
  return { label: 'neutral', score: 0.5 }
}

function detectRisk(text: string) {
  if (/kill.*self|suicide|end.*life|want to die|self.harm/i.test(text)) return 'crisis'
  if (/hopeless|no reason to live|can't go on/i.test(text)) return 'high'
  return 'low'
}

export default function ChatPage() {
  const { ready, user, logout } = useAuth(true)

  const [sessionId, setSessionId] = useState(() => uuid())
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const [emotion, setEmotion] = useState('neutral')
  const [emotionEmoji, setEmotionEmoji] = useState('😐')
  const [emotionColor, setEmotionColor] = useState('#64748b')
  const [emotionScore, setEmotionScore] = useState(0.5)
  const [emotionLog, setEmotionLog] = useState<EmotionEntry[]>([])
  const [flowType, setFlowType] = useState('venting')
  const [flowStep, setFlowStep] = useState(0)
  const [riskLevel, setRiskLevel] = useState('low')

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
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setLoading(true)

    const userMsg: Message = { id: uuid(), role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setHistoryMsgs(prev => [...prev, { role: 'user', content }])

    const localEm = detectEmotionLocal(content)
    updateEmotion(localEm.label, localEm.score)
    setRiskLevel(detectRisk(content))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_input: content,
          messages: historyMsgs.slice(-6)
        })
      })

      const data = await res.json()
      const aiReply = data.reply

      const aiMsg: Message = { 
        id: uuid(), 
        role: 'assistant', 
        content: aiReply, 
        timestamp: new Date(),
        suggestion: data.suggestion || null 
      }

      setMessages(prev => [...prev, aiMsg])
      setHistoryMsgs(prev => [...prev, { role: 'assistant', content: aiReply }])

      api.saveChat({
        user_message: content,
        response: aiReply,
        emotion: data.emotion,
        flow: data.flow,
        flow_step: data.flow_step,
        session_id: sessionId,
        safe: data.safe
      }).catch(e => console.warn('Sync error:', e))

      setFlowStep(data.flow_step)
      setFlowType(data.flow)

    } catch (err: any) {
      console.error('Chat error:', err)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, sessionId, updateEmotion, historyMsgs])

  const newSession = () => {
    setSessionId(uuid())
    setMessages([])
    setHistoryMsgs([])
    setEmotionLog([])
    setEmotion('neutral')
    setEmotionEmoji('😐')
    setEmotionColor('#64748b')
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
    <div className="flex items-center justify-center h-screen bg-[#050608] text-slate-500 font-mono text-sm">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
        Synchronizing Neurons...
      </div>
    </div>
  )

  const msgCount = messages.length

  return (
    <div className="flex h-screen overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      <Head>
        <title>MindFlare AI — Premium Sanctuary</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="aura-bg" />

      {/* Sidebar Overlay for Mobile could be added here */}
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

      <main className="flex-1 flex flex-col min-w-0 bg-transparent relative">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-8 glass border-b border-white/5 z-10 backdrop-blur-3xl">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl glass bg-indigo-500/10 flex items-center justify-center border-indigo-500/20">
              <MessageCircle size={20} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Active Sanctuary Session</h2>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                {sessionStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Secure Pipeline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-1.5 glass rounded-full flex items-center gap-2 border-indigo-500/20 shadow-lg shadow-indigo-500/10">
              <Heart size={12} className="text-rose-400" />
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-tight">{flowType}</span>
            </div>
            <div className="px-4 py-1.5 glass rounded-full flex items-center gap-2 border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-tight">{msgCount} Messages</span>
            </div>
          </div>
        </header>

        {/* Risk Alert Banner */}
        <AnimatePresence>
          {(riskLevel === 'crisis' || riskLevel === 'high') && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-rose-500/10 border-b border-rose-500/20 px-8 py-3 flex items-center gap-4"
            >
              <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
                <ShieldAlert size={18} />
              </div>
              <p className="text-xs text-rose-300 font-medium leading-relaxed">
                You're in a safe space. If you need immediate support, crisis lines are available: 
                <span className="text-white ml-2">iCall 9152987821</span> • 
                <span className="text-white ml-2">Vandrevala 1860-2662-345</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Canvas */}
        <div className="flex-1 overflow-y-auto px-8 py-10 custom-scrollbar relative">
          <div className="max-w-4xl mx-auto w-full flex flex-col">
            {messages.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center min-h-[500px] text-center"
              >
                <div className="w-24 h-24 rounded-[40px] glass bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center border-indigo-500/30 mb-8 shadow-2xl relative">
                  <Leaf size={40} className="text-indigo-400" />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute inset-0 rounded-[40px] bg-indigo-500/20 blur-2xl -z-10"
                  />
                </div>
                <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">Welcome to your Sanctuary</h1>
                <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-10">
                  How are you feeling today? Share whatever is on your heart, there is no judgment here.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                  {STARTERS.map((s, i) => (
                    <motion.button
                      key={s}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => sendMessage(s)}
                      className="px-6 py-4 glass-card bg-white/[0.02] border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/5 text-xs text-slate-300 font-medium transition-all flex items-center gap-3 group text-left"
                    >
                      <div className="w-6 h-6 rounded-lg glass bg-white/5 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                        <Sparkles size={12} className="text-indigo-400" />
                      </div>
                      {s}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {messages.map(msg => (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    username={user.username}
                    feedbackGiven={feedbackGiven[msg.id]}
                    onFeedback={(rating, sugTitle) => onFeedback(msg.id, rating, sugTitle)}
                  />
                ))}
                {loading && <TypingBubble />}
                <div ref={messagesEndRef} className="h-20" />
              </div>
            )}
          </div>
        </div>

        {/* Input Dock */}
        <div className="px-8 pb-10 z-10">
          <div className="max-w-4xl mx-auto w-full relative group">
            <div className="absolute inset-0 bg-indigo-500/10 blur-3xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <div className="glass-card bg-white/[0.03] border-white/5 p-2 flex items-end gap-3 shadow-2xl relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Exhale your thoughts here..."
                rows={1}
                disabled={loading}
                className="flex-1 bg-transparent border-none outline-none p-4 text-sm text-white placeholder:text-slate-600 resize-none max-h-[150px] leading-relaxed"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg
                  ${!input.trim() || loading 
                    ? 'bg-white/5 text-slate-700' 
                    : 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-500/20 hover:scale-105 active:scale-95'}`}
              >
                <Send size={18} />
              </button>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
               <span className="text-[9px] text-slate-600 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                 <ShieldAlert size={10} /> Secure Encryption Active
               </span>
               <span className="text-[9px] text-slate-600 uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                 <Zap size={10} /> low-latency neural pipeline
               </span>
            </div>
          </div>
        </div>
      </main>

      <RightPanel
        emotionLog={emotionLog}
        history={historyMsgs}
        flowType={flowType}
        flowStep={flowStep}
        msgCount={msgCount}
        sessionStart={sessionStart}
      />
    </div>
  )
}
