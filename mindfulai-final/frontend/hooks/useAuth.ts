import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { isLoggedIn, getAuth, clearAuth } from '@/lib/api'

export function useAuth(requireAuth = true) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState({ username: '', userId: null as string | null })

  useEffect(() => {
    const loggedIn = isLoggedIn()
    if (requireAuth && !loggedIn) {
      router.replace('/login')
      return
    }
    if (!requireAuth && loggedIn) {
      router.replace('/')
      return
    }
    setUser(getAuth())
    setReady(true)
  }, [])

  const logout = () => {
    clearAuth()
    router.push('/login')
  }

  return { ready, user, logout }
}
