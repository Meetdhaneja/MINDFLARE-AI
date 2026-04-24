import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Sparkles, ThumbsUp, ThumbsDown } from 'lucide-react'

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
    <motion.div 
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-6 w-full`}
    >
      <div className={`flex gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-2xl flex-shrink-0 flex items-center justify-center text-sm font-bold glass shadow-lg
          ${isUser ? 'bg-white/5 text-slate-400' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'}`}>
          {isUser ? username[0]?.toUpperCase() || 'U' : <Sparkles size={16} />}
        </div>

        {/* Message Content */}
        <div className="flex flex-col gap-1">
          <div className={`px-5 py-3.5 text-[15px] leading-relaxed shadow-xl
            ${isUser 
              ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none' 
              : 'glass text-slate-100 rounded-2xl rounded-tl-none border-white/5'}`}>
            {message.content}
          </div>

          {/* Suggestion Card */}
          {!isUser && message.suggestion && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-3 p-5 glass-card border-indigo-500/20 bg-indigo-500/5 shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Personalized Suggestion</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-2 py-0.5 rounded-full">
                  {message.suggestion.category}
                </span>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-white mb-1">{message.suggestion.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{message.suggestion.description}</p>
              </div>

              {/* Feedback */}
              <div className="pt-2 flex items-center gap-3">
                {!feedbackGiven ? (
                  <>
                    <button 
                      onClick={() => onFeedback?.(1, message.suggestion?.title)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/5 hover:bg-indigo-500/20 transition-all text-[11px] text-slate-400 hover:text-indigo-300"
                    >
                      <ThumbsUp size={12} /> Helpful
                    </button>
                    <button 
                      onClick={() => onFeedback?.(-1, message.suggestion?.title)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/5 hover:bg-rose-500/20 transition-all text-[11px] text-slate-400 hover:text-rose-300"
                    >
                      <ThumbsDown size={12} /> Not quite
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-xl">
                    <Check size={12} /> Feedback received
                  </div>
                )}
              </div>
            </motion.div>
          )}

          <span className="text-[10px] text-slate-500 font-mono mt-1 px-1">
            {fmt(message.timestamp)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

export function TypingBubble() {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 mb-6"
    >
      <div className="w-9 h-9 rounded-2xl flex-shrink-0 flex items-center justify-center glass bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
        <Sparkles size={16} />
      </div>
      <div className="px-5 py-4 glass text-slate-100 rounded-2xl rounded-tl-none border-white/5 flex gap-1.5 items-center">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </motion.div>
  )
}
