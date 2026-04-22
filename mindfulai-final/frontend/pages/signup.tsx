import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { api, saveAuth } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

export default function Signup() {
  const router = useRouter()
  const { ready } = useAuth(false)
  const [form, setForm] = useState({ email: '', username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!ready) return null

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.signup(form.email, form.username, form.password)
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
        setError(err.response?.data?.detail || 'Signup failed — try a different email')
      }
    } finally {
      setLoading(false)
    }
  }

  const field = (label: string, key: string, type = 'text', hint = '') => (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>{label}</label>
      <input className="input" type={type} value={(form as any)[key]}
        onChange={set(key)} placeholder={hint} required />
    </div>
  )

  return (
    <>
      <Head><title>Create Account — MindfulAI</title></Head>
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '20px',
        background: 'radial-gradient(ellipse at 70% 50%, rgba(91,142,240,0.08) 0%, transparent 60%), var(--bg)',
      }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '36px' }}>
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

          <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '6px' }}>Create your account</div>
          <div style={{ fontSize: '13px', color: 'var(--t2)', marginBottom: '24px' }}>
            Your conversations are private and never shared
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && (
              <div style={{
                padding: '10px 14px', background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px',
                color: '#fb7185', fontSize: '13px'
              }}>{error}</div>
            )}
            {field('Username', 'username', 'text', 'yourname')}
            {field('Email', 'email', 'email', 'you@example.com')}
            {field('Password', 'password', 'password', 'Minimum 8 characters')}
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--t2)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--acc)', textDecoration: 'none' }}>Sign in</Link>
          </div>
        </div>
      </div>
    </>
  )
}
