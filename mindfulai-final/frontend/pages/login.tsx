import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react'
import { api, saveAuth } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

export default function Login() {
  const router = useRouter()
  const { ready } = useAuth(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!ready) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login(email, password)
      saveAuth(data)
      router.push('/')
    } catch (err: any) {
      const errors = err.response?.data?.detail
      if (Array.isArray(errors)) {
        const messages = errors.map((error: any) => error.msg || error.message).join('. ')
        setError(messages || 'Please check your input and try again')
      } else {
        setError(err.response?.data?.detail || 'Invalid email or password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head><title>Portal — MindFlare AI</title></Head>
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        {/* Sanctuary Aura Background */}
        <div className="aura-bg" />

        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-[440px] glass-card p-10 shadow-2xl relative z-10 overflow-hidden"
        >
          {/* Decorative Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -z-10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 blur-3xl -z-10" />

          {/* Logo Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
              <Brain className="text-white" size={28} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">MindFlare AI</h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.3em] mt-1">Neural Sanctuary</p>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-lg font-semibold text-white mb-2">Welcome Back</h2>
            <p className="text-sm text-slate-400">Continue your journey to inner peace</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                <Mail size={12} className="text-indigo-400" />
                Email Address
              </label>
              <input 
                className="premium-input" 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)} 
                placeholder="name@example.com" 
                required 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                <Lock size={12} className="text-indigo-400" />
                Security Key
              </label>
              <input 
                className="premium-input" 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••" 
                required 
              />
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="premium-btn w-full group overflow-hidden relative" 
              type="submit" 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" />
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:0.4s]" />
                </div>
              ) : (
                <>
                  Enter Sanctuary
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-xs text-slate-500">
              New to the sanctuary?{' '}
              <Link href="/signup" className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors ml-1">
                Create Identity
              </Link>
            </p>
          </div>

          {/* Footer Info */}
          <div className="mt-6 flex items-center justify-center gap-4">
             <div className="flex items-center gap-1.5 text-[9px] text-slate-600 font-bold uppercase tracking-widest">
               <Sparkles size={10} className="text-indigo-500/50" />
               v4.0 Elite
             </div>
             <div className="w-1 h-1 rounded-full bg-white/5" />
             <div className="flex items-center gap-1.5 text-[9px] text-slate-600 font-bold uppercase tracking-widest">
               Secure Pipeline
             </div>
          </div>
        </motion.div>
      </div>
    </>
  )
}

