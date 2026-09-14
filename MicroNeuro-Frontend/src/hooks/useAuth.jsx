
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getData } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'authed' | 'guest'
  const [user, setUser] = useState(null)
  const [activeAccount, setActiveAccount] = useState(null)

  const checkAuth = useCallback(async () => {
    setStatus('loading')
    try {
      const d = await getData('/auth/me')
      if (d?.authenticated) {
        setStatus('authed')
        setUser(d.user || null)
        setActiveAccount(d.activeConnectedAccount || null)
      } else {
        setStatus('guest')
        setUser(null)
        setActiveAccount(null)
      }
    } catch {
      setStatus('guest')
    }
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  function logout() {
    setStatus('guest')
    setUser(null)
    setActiveAccount(null)
  }

  return (
    <AuthContext.Provider value={{ status, user, activeAccount, checkAuth, logout, setActiveAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}