import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { getData, patchData, apiError } from '../lib/api'

export default function Alerts() {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    getData(`/alerts${unreadOnly ? '?unreadOnly=true' : ''}`)
      .then(d => setRows(Array.isArray(d) ? d : d?.alerts || []))
      .catch(e => toast.error(apiError(e)))
      .finally(() => setLoading(false))
  }, [unreadOnly])

  useEffect(() => { load() }, [load])

  async function markRead(row) {
    if (row.read) return
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, read: true } : r))
    try {
      await patchData(`/alerts/${row.id}/read`)
    } catch (e) { toast.error(apiError(e)) }
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow"><Bell size={14} /> Intelligence</div>
          <h1>Alerts</h1>
          <p>Signals generated from your connected work.</p>
        </div>
        <button className="button button-light" onClick={load}><RefreshCw size={16} /> Refresh</button>
      </div>

      <div className="filter-row">
        <div className="tabs">
          <button className={`tab ${!unreadOnly ? 'active' : ''}`} onClick={() => setUnreadOnly(false)}>All</button>
          <button className={`tab ${unreadOnly ? 'active' : ''}`} onClick={() => setUnreadOnly(true)}>Unread</button>
        </div>
      </div>

      <section className="panel table-panel">
        {loading ? (
          <div className="loading"><RefreshCw className="spin" /> Loading alerts…</div>
        ) : rows.length ? (
          <div className="table">
            {rows.map((row, i) => (
              <div className="table-row" key={row.id || i} style={{ cursor: 'pointer' }} onClick={() => markRead(row)}>
                <div className="row-main">
                  <div className="row-icon alerts"><Bell size={17} /></div>
                  <div>
                    <strong style={!row.read ? { fontWeight: 700 } : undefined}>{row.message || row.title || 'Alert'}</strong>
                    <span>{row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}</span>
                  </div>
                </div>
                <span className={`pill ${row.severity === 'high' ? 'danger' : ''}`}>{row.severity || (row.read ? 'read' : 'new')}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon"><Bell size={24} /></div>
            <h3>No alerts found</h3>
            <p>MicroNeuro will notify you here as deadlines approach.</p>
          </div>
        )}
      </section>
    </div>
  )
}