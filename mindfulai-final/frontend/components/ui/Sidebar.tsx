import React from 'react'
import { motion } from 'framer-motion'
import { 
  Brain, 
  Zap, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  LogOut, 
  MessageSquare,
  Activity,
  Heart
} from 'lucide-react'

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

export function Sidebar({ 
  emotion, 
  emotionEmoji, 
  emotionColor, 
  emotionScore,
  flowType, 
  flowStep, 
  riskLevel, 
  username, 
  msgCount, 
  onNewSession, 
  onLogout 
}: Props) {

  const RISK_COLORS: Record<string, string> = {
    low: '#2dd4bf', medium: '#fbbf24', high: '#f87171', crisis: '#ef4444'
  }
  const riskColor = RISK_COLORS[riskLevel] || '#2dd4bf'

  return (
    <aside className="w-[280px] flex-shrink-0 glass border-r border-white/5 flex flex-col h-screen overflow-hidden">
      {/* Header / Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Brain className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">MindFlare AI</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Zap size={10} className="text-indigo-400" />
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">v4.0 Elite Brain</span>
            </div>
          </div>
        </div>

        {/* Emotion Widget */}
        <div className="p-4 glass-card bg-white/[0.02] border-white/5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Activity size={12} />
            Emotional State
          </div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl drop-shadow-md">{emotionEmoji}</span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white capitalize" style={{ color: emotionColor }}>
                {emotion}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {Math.round(emotionScore * 100)}% accuracy
              </div>
            </div>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(emotionScore * 100)}%` }}
              className="h-full rounded-full"
              style={{ backgroundColor: emotionColor, boxShadow: `0 0 10px ${emotionColor}44` }}
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-2">
          <div className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Actions</div>
          <button 
            onClick={onNewSession}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-all group"
          >
            <Plus size={18} className="text-indigo-400 group-hover:rotate-90 transition-transform" />
            New Session
          </button>
        </div>

        {/* Conversation Flow */}
        <div className="p-4 glass-card bg-indigo-500/[0.02] border-indigo-500/10">
          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Heart size={12} />
            Therapeutic Flow
          </div>
          
          <div className="space-y-3">
            {STEP_LABELS.map((label, i) => {
              const isDone = i < flowStep
              const isActive = i === flowStep
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
                    ${isActive ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 
                      isDone ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 
                      'bg-white/5 text-slate-600 border border-white/5'}`}>
                    {isDone ? <CheckCircle2 size={12} /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium transition-all
                    ${isActive ? 'text-white' : isDone ? 'text-slate-400' : 'text-slate-600'}`}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-white/5 text-[11px] text-slate-500 leading-relaxed italic">
            "{FLOW_DESC[flowType] || 'Holding space for you.'}"
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 glass-card text-center">
            <div className="text-sm font-bold text-white mb-1 flex items-center justify-center gap-1.5">
              <MessageSquare size={12} className="text-indigo-400" />
              {msgCount}
            </div>
            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Messages</div>
          </div>
          <div className="p-3 glass-card text-center">
            <div className="text-sm font-bold mb-1 flex items-center justify-center gap-1.5" style={{ color: riskColor }}>
              <AlertTriangle size={12} />
              {riskLevel}
            </div>
            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Risk Level</div>
          </div>
        </div>
      </div>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-white/5">
        <div className="p-3 glass-card bg-white/[0.03] border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-lg">
            {username[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{username}</p>
            <p className="text-[10px] text-indigo-400 font-mono">Verified Session</p>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
            title="End Session"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
