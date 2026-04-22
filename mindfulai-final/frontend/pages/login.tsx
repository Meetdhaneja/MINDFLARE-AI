import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
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
      // Handle FastAPI/Pydantic validation errors
      const errors = err.response?.data?.detail
      if (Array.isArray(errors)) {
        // Extract error messages from validation errors
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
      <Head><title>Sign In — MindfulAI</title></Head>
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '20px',
        background: 'radial-gradient(ellipse at 30% 50%, rgba(91,142,240,0.08) 0%, transparent 60%), var(--bg)',
      }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '36px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #5b8ef0, #9b6ef0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
            }}>🧠</div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>MindfulAI</div>
              <div style={{ fontSize: '11px', color: 'var(--t3)' }}>mental health companion</div>
            </div>
          </div>

          <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '6px' }}>Welcome back</div>
          <div style={{ fontSize: '13px', color: 'var(--t2)', marginBottom: '24px' }}>
            Sign in to continue your journey
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && (
              <div style={{
                padding: '10px 14px', background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px',
                color: '#fb7185', fontSize: '13px'
              }}>{error}</div>
            )}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>Email</label>
              <input className="input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>Password</label>
              <input className="input" type="password" value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--t2)' }}>
            Don't have an account?{' '}
            <Link href="/signup" style={{ color: 'var(--acc)', textDecoration: 'none' }}>Sign up</Link>
          </div>
        </div>
      </div>
    </>
  )
}
