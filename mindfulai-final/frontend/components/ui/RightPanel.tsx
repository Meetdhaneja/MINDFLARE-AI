import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Activity, 
  BarChart3, 
  Clock, 
  MessageSquare, 
  Zap, 
  ChevronRight,
  TrendingUp,
  Brain
} from 'lucide-react'

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

  return (
    <aside className="w-[300px] flex-shrink-0 glass border-l border-white/5 flex flex-col h-screen overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b border-white/5 p-1">
        {(['emotions', 'context', 'stats'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg
              ${tab === t ? 'bg-white/5 text-white shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
        <AnimatePresence mode="wait">
          {/* Emotions Tab */}
          {tab === 'emotions' && (
            <motion.div
              key="emotions"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={12} />
                  Mood Timeline
                </div>
                
                {emotionLog.length === 0 ? (
                  <div className="p-8 glass-card border-dashed border-white/10 text-center space-y-3">
                    <Activity size={24} className="mx-auto text-slate-600" />
                    <p className="text-[11px] text-slate-500">Timeline will populate as we chat</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {emotionLog.slice(-10).map((e, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-3 glass-card bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                      >
                        <span className="text-xl">{e.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white capitalize" style={{ color: e.color }}>{e.label}</p>
                          <p className="text-[9px] text-slate-500 font-mono">{fmt(e.time)}</p>
                        </div>
                        <ChevronRight size={14} className="text-slate-700" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Breakdown Chart */}
              {emotionLog.length > 0 && (() => {
                const counts: Record<string, { count: number; color: string; emoji: string }> = {}
                emotionLog.forEach(e => {
                  if (!counts[e.label]) counts[e.label] = { count: 0, color: e.color, emoji: e.emoji }
                  counts[e.label].count++
                })
                const sorted = Object.entries(counts).sort((a, b) => b[1].count - a[1].count)
                const total = emotionLog.length

                return (
                  <div className="p-5 glass-card bg-indigo-500/[0.02] border-indigo-500/10">
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <BarChart3 size={12} />
                      Session Summary
                    </div>
                    <div className="space-y-4">
                      {sorted.slice(0, 4).map(([label, { count, color, emoji }]) => {
                        const pct = Math.round((count / total) * 100)
                        return (
                          <div key={label} className="space-y-2">
                            <div className="flex justify-between text-[11px] font-bold">
                              <span className="text-white flex items-center gap-2">
                                {emoji} {label}
                              </span>
                              <span className="text-slate-500 font-mono">{pct}%</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}44` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </motion.div>
          )}

          {/* Context Tab */}
          {tab === 'context' && (
            <motion.div
              key="context"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Brain size={12} />
                Neural Context
              </div>
              {history.length === 0 ? (
                <div className="p-8 glass-card border-dashed border-white/10 text-center">
                  <p className="text-[11px] text-slate-500">Active context window is empty</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.slice(-6).map((m, i) => (
                    <div key={i} className="p-4 glass-card bg-white/[0.02] border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${m.role === 'user' ? 'bg-indigo-400' : 'bg-purple-400'}`} />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{m.role}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                        {m.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Stats Tab */}
          {tab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Zap size={12} />
                Session Metrics
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Messages', val: msgCount, icon: <MessageSquare size={12} /> },
                  { label: 'Duration', val: `${dur}m`, icon: <Clock size={12} /> },
                  { label: 'Emotions', val: uniqueEmotions, icon: <Activity size={12} /> },
                  { label: 'Flow', val: `${flowStep + 1}/5`, icon: <TrendingUp size={12} /> },
                ].map((stat, i) => (
                  <div key={i} className="p-4 glass-card bg-white/[0.02] border-white/5 text-center">
                    <div className="text-indigo-400 flex justify-center mb-2">{stat.icon}</div>
                    <div className="text-lg font-bold text-white mb-1">{stat.val}</div>
                    <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Interactive Flow Indicator */}
              <div className="p-5 glass-card bg-purple-500/[0.02] border-purple-500/10">
                <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-4">Live Convergence</div>
                <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/5 mb-4">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: FLOW_COLORS[flowType] || '#6366f1' }} />
                  <span className="text-[11px] font-bold text-white uppercase tracking-tight">{flowType}</span>
                </div>
                <div className="space-y-3">
                  {['Validate', 'Explore', 'Identify', 'Guide', 'Suggest'].map((label, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${i <= flowStep ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'bg-white/10'}`} />
                      <span className={`text-[10px] font-bold tracking-tight transition-all ${i === flowStep ? 'text-white' : 'text-slate-600'}`}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  )
}
