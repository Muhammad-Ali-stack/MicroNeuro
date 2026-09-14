import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getData } from '../lib/api'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    getData('/auth/me')
      .then((d) => {
        if (d?.authenticated) {
          navigate('/', { replace: true })
        } else {
          setError('Sign-in did not complete. Please try again.')
        }
      })
      .catch(() => setError('Could not verify your session. Please try again.'))
  }, [navigate])

  return (
    <div className="loading-screen">
      <img className="brand-mark loading-logo" src="/Logo.png" alt="MicroNeuro loading" />
      {error ? (
        <>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <button className="button button-dark" onClick={() => navigate('/login', { replace: true })}>
            Back to sign in
          </button>
        </>
      ) : null}
    </div>
  )
}