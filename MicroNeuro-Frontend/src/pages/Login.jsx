import { useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Sparkles, ArrowRight, Shield, Zap, Brain, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api, apiError } from '../lib/api'
import Logo from '../components/ui/Logo'

function MicrosoftSVG() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
      <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  )
}

const FEATURES = [
  {
    icon: Brain,
    title: 'AI-powered inbox triage',
    desc: 'MicroNeuro reads every email and extracts meetings, deadlines and actions — automatically.',
  },
  {
    icon: Zap,
    title: 'Instant action items',
    desc: 'Every thread becomes actionable. No manual sorting, no missed follow-ups.',
  },
  {
    icon: Shield,
    title: 'Enterprise-grade security',
    desc: 'OAuth 2.0 with Microsoft. Your credentials never touch our servers.',
  },
]

const STEPS = [
  "You'll be redirected to Microsoft's secure sign-in page",
  'Grant MicroNeuro read access to your mailbox',
  "You're in — your inbox syncs and you get your first brief",
]

export default function Login() {
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    try {
      const { data } = await api.get('/auth/login')
      const url = data?.data?.authorizationUrl
      if (url) {
        window.location.href = url
      } else {
        toast.error('Microsoft sign-in is not configured — check AZURE_CLIENT_ID and AZURE_TENANT_ID on the server.')
      }
    } catch (e) {
      const message = e?.response?.status === 502
        ? `The MicroNeuro API is unavailable. Start the backend service at ${import.meta.env.VITE_API_URL || 'http://localhost:8000'} and try again.`
        : apiError(e)
      toast.error(message)
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      {/* Ambient blobs */}
      <div className="login-blob blob-1" />
      <div className="login-blob blob-2" />
      <div className="login-blob blob-3" />

      <div className="login-layout">
        {/* ── Left panel ── */}
        <motion.div
          className="login-panel"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        >
          <Logo className="login-logo" />

          <div className="login-hero-text">
            <motion.div
              className="login-orb"
              animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles size={30} />
            </motion.div>
            <h1 className="login-headline">
              Make space<br />for <em>good work.</em>
            </h1>
            <p className="login-tagline">
              MicroNeuro brings your Microsoft 365 inbox into focus —
              so you spend less time sorting and more time on what matters.
            </p>
          </div>

          <div className="login-features">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                className="login-feature"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.1 }}
              >
                <div className="login-feature-icon"><Icon size={17} /></div>
                <div>
                  <strong>{title}</strong>
                  <span>{desc}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Right card ── */}
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="login-card-top">
            <div className="login-card-icon">
              <Sparkles size={22} />
            </div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Welcome to MicroNeuro</div>
            <h2 style={{ fontSize: 22, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 8 }}>
              Sign in to get started
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Connect your Microsoft 365 account and let AI turn your inbox into
              your daily brief.
            </p>
          </div>

          <button
            className="ms-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            <span className="ms-btn-icon">
              {loading ? <RefreshCw size={18} className="spin" /> : <MicrosoftSVG />}
            </span>
            <span>{loading ? 'Connecting to Microsoft…' : 'Continue with Microsoft'}</span>
            {!loading && <ArrowRight size={15} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
          </button>

          <div className="login-divider"><span>What happens next</span></div>

          <ol className="login-steps">
            {STEPS.map((s, i) => (
              <li key={i}>
                <CheckCircle size={14} />
                <span>{s}</span>
              </li>
            ))}
          </ol>

          <p className="login-legal">
            By signing in you agree to MicroNeuro's terms of service.
            We use Microsoft OAuth 2.0 — your password is never shared with us.
          </p>
        </motion.div>
      </div>

      <div className="login-footer">
        <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>MicroNeuro</span>
        <span>·</span>
        <span>Built for focused teams</span>
        <span>·</span>
        <a href="#" style={{ color: 'inherit' }}>Privacy</a>
        <span>·</span>
        <a href="#" style={{ color: 'inherit' }}>Terms</a>
      </div>
    </div>
  )
}