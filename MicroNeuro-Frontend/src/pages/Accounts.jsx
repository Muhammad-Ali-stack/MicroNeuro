import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, UserPlus, Repeat, Trash2, ShieldCheck, User as UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { getData, postData, apiError } from '../lib/api'

export default function Accounts() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getData('/auth/accounts')
      .then(d => setRows(Array.isArray(d) ? d : d?.accounts || []))
      .catch(e => toast.error(apiError(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function switchAccount(row) {
    if (row.isActive) return
    setBusyId(row.id)
    try {
      await postData('/auth/switch-account', { connectedAccountId: row.id })
      toast.success(`Switched to ${row.email}`)
      load()
    } catch (e) {
      toast.error(apiError(e))
    } finally {
      setBusyId(null)
    }
  }

  async function removeAccount(row) {
    if (!window.confirm(`Remove ${row.email}? You will need to sign in again to reconnect it.`)) return
    setBusyId(row.id)
    try {
      const res = await postData('/auth/remove-account', { connectedAccountId: row.id })
      if (res?.loggedOut) {
        toast.success('Account removed — you have been signed out')
        window.location.href = '/login'
        return
      }
      toast.success('Account removed')
      load()
    } catch (e) {
      toast.error(apiError(e))
    } finally {
      setBusyId(null)
    }
  }

  function addAccount() {
    const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
    window.location.href = `${apiOrigin}/api/v1/auth/login?addAccount=true`
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow"><ShieldCheck size={14} /> Identity</div>
          <h1>Connected accounts</h1>
          <p>Manage the Microsoft accounts linked to MicroNeuro.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="button button-light" onClick={load}><RefreshCw size={16} /> Refresh</button>
          <button className="button button-dark" onClick={addAccount}><UserPlus size={16} /> Add account</button>
        </div>
      </div>

      <section className="panel table-panel">
        {loading ? (
          <div className="loading"><RefreshCw className="spin" /> Loading accounts…</div>
        ) : rows.length ? (
          <div className="table">
            {rows.map((row, i) => (
              <div className="table-row" key={row.id || i}>
                <div className="row-main">
                  <div className="row-icon meetings"><UserIcon size={17} /></div>
                  <div>
                    <strong>{row.displayName || row.email}</strong>
                    <span>{row.email}{row.connectedAt ? ` · connected ${new Date(row.connectedAt).toLocaleDateString()}` : ''}</span>
                  </div>
                </div>
                <span className={`pill ${row.isActive ? 'success' : ''}`}>{row.isActive ? 'Active' : 'Inactive'}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!row.isActive && (
                    <button
                      className="icon-button"
                      title="Switch to this account"
                      disabled={busyId === row.id}
                      onClick={() => switchAccount(row)}
                    >
                      <Repeat size={15} />
                    </button>
                  )}
                  <button
                    className="icon-button"
                    title="Remove account"
                    disabled={busyId === row.id}
                    onClick={() => removeAccount(row)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon"><ShieldCheck size={24} /></div>
            <h3>No connected accounts</h3>
            <p>Add a Microsoft account to start syncing your inbox.</p>
          </div>
        )}
      </section>
    </div>
  )
}