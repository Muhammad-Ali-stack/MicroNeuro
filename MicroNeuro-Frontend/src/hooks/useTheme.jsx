
import { useState, useEffect, useCallback } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('mn-theme') || 'light' } catch { return 'light' }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('mn-theme', theme) } catch {}
  }, [theme])

  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), [])
  return { theme, toggleTheme }
}