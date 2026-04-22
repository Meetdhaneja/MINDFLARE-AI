import axios, { AxiosInstance } from 'axios'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ChatResponse {
  response: string
  emotion: string
  emotion_emoji: string
  emotion_color: string
  risk: string
  suggestion: { title: string; description: string; category: string } | null
  flow: string
  flow_step: number
  session_id: string
  safe: boolean
}

export interface StreamChunk {
  chunk?: string
  emotion?: string
  emotion_emoji?: string
  emotion_color?: string
  safe?: boolean
  flow?: string
  flow_step?: number
  suggestion?: { title: string; description: string; category: string } | null
  final_response?: string
  error?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user_id: number
  username: string
}

export interface HistoryMessage {
  role: string
  content: string
  emotion?: string
  timestamp?: string
}

class API {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({ baseURL: BASE, timeout: 30000 })
    this.client.interceptors.request.use(cfg => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('mf_token') : null
      if (token) cfg.headers.Authorization = `Bearer ${token}`
      return cfg
    })
    this.client.interceptors.response.use(
      r => r,
      err => {
        if (err.response?.status === 401 && typeof window !== 'undefined') {
          localStorage.clear()
          window.location.href = '/login'
        }
        return Promise.reject(err)
      }
    )
  }

  async signup(email: string, username: string, password: string): Promise<AuthResponse> {
    const r = await this.client.post('/auth/signup', { email, username, password })
    return r.data
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const r = await this.client.post('/auth/login', { email, password })
    return r.data
  }

  async chat(message: string, session_id: string): Promise<ChatResponse> {
    const r = await this.client.post('/chat', { message, session_id })
    return r.data
  }

  async chatStream(message: string, session_id: string): Promise<ReadableStream<StreamChunk>> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('mf_token') : null

    const response = await fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: JSON.stringify({ message, session_id })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    return new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader!.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  controller.close()
                  return
                }
                try {
                  const parsed: StreamChunk = JSON.parse(data)
                  controller.enqueue(parsed)
                } catch (e) {
                  console.warn('Failed to parse stream chunk:', data)
                }
              }
            }
          }
        } catch (error) {
          controller.error(error)
        } finally {
          reader?.releaseLock()
        }
      }
    })
  }

  async getHistory(session_id: string): Promise<{ history: HistoryMessage[] }> {
    const r = await this.client.get(`/history/${session_id}`)
    return r.data
  }

  async feedback(message_id: number, rating: number, suggestion_title?: string) {
    await this.client.post('/feedback', { message_id, rating, suggestion_title: suggestion_title || '' })
  }

  async getProfile() {
    const r = await this.client.get('/profile')
    return r.data
  }

  async health() {
    const r = await this.client.get('/health')
    return r.data
  }
}

export const api = new API()

// Auth helpers
export const saveAuth = (data: AuthResponse) => {
  localStorage.setItem('mf_token', data.access_token)
  localStorage.setItem('mf_user', data.username)
  localStorage.setItem('mf_uid', String(data.user_id))
}

export const getAuth = () => ({
  token: localStorage.getItem('mf_token'),
  username: localStorage.getItem('mf_user') || 'User',
  userId: localStorage.getItem('mf_uid'),
})

export const clearAuth = () => localStorage.clear()
export const isLoggedIn = () => !!localStorage.getItem('mf_token')
