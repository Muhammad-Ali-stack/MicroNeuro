import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useTheme } from '../../hooks/useTheme'
import { postData, apiError } from '../../lib/api'
import ChatInterface from '../ChatInterface'

export default function AppShell({ children, unread = 0 }) {
  const [collapsed, setCollapsed] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') setAiOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [])
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  async function handleSync() {
    setSyncing(true)
    try {
      const d = await postData('/sync/inbox')
      toast.success(
        `Sync complete — ${d?.processed ?? 0} new, ${d?.skipped ?? 0} already seen`
      )
    } catch (e) {
      toast.error(apiError(e))
    } finally {
      setSyncing(false)
    }
  }

  const showSync = ['/', '/inbox'].includes(location.pathname)

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        unread={unread}
      />

      <main className="main">
        <Topbar
          onSync={showSync ? handleSync : null}
          syncing={syncing}
          unread={unread}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>

        {location.pathname !== '/assistant' && (
          <>
            {aiOpen && <div className="ai-flyout"><div className="flyout-head"><strong>Ask MicroNeuro</strong><button className="icon-button" onClick={() => setAiOpen(false)} aria-label="Close AI assistant">×</button></div><ChatInterface compact /></div>}
            <button className="floating-ai" onClick={() => setAiOpen(value => !value)} aria-expanded={aiOpen}><Sparkles size={16} /><span>Ask AI</span></button>
          </>
        )}
      </main>
    </div>
  )
}