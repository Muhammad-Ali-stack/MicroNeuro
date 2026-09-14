import { motion } from 'framer-motion'

export default function LoadingScreen({ message = '' }) {
  return (
    <div className="loading-screen">
      <motion.img
        className="brand-mark loading-logo"
        src="/Logo.png"
        alt="MicroNeuro loading"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ animation: 'logo-spin 1.8s linear infinite' }}
      />
      {message && (
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>{message}</p>
      )}
    </div>
  )
}