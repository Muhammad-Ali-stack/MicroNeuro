import { Link } from 'react-router-dom'

export default function Logo({ compact = false, className = '' }) {
  return (
    <Link to="/" className={`brand ${compact ? 'brand-compact' : ''} ${className}`}>
      <img className="brand-mark" src="/Logo.png" alt="MicroNeuro" />
      {!compact && <span>Micro<span>Neuro</span></span>}
    </Link>
  )
}