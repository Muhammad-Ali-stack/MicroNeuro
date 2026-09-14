import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Search, Users, MoveHorizontal as MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { getData, apiError } from '../lib/api'

const TABS = ['All', 'Pending', 'Uploaded', 'Not required']
const TAB_VALUE = { All: null, Pending: 'pending', Uploaded: 'uploaded', 'Not required': 'not-required' }

function organizerLabel(value) {
  if (!value) return 'Recently added'
  if (typeof value === 'string') return value
  const person = value.emailAddress || value
  return person.name || person.address || 'Recently added'
}

export default function Meetings() {
  const [tab, setTab] = useState('All')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const status = TAB_VALUE[tab]
    getData(`/meetings${status ? `?status=${status}` : ''}`)
      .then(d => setRows(Array.isArray(d) ? d : d?.meetings || []))
      .catch(e => toast.error(apiError(e)))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => { load() }, [load])

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow"><Users size={14} /> Intelligence</div>
          <h1>Meetings</h1>
          <p>Decisions and conversations, extracted from your inbox.</p>
        </div>
        <button className="button button-light" onClick={load}><RefreshCw size={16} /> Refresh</button>
      </div>

      <div className="filter-row">
        <div className="tabs">
          {TABS.map(t => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
        </div>
        <div className="search compact"><Search size={15} /><input placeholder="Search meetings" /></div>
      </div>

      <section className="panel table-panel">
        {loading ? (
          <div className="loading"><RefreshCw className="spin" /> Loading meetings…</div>
        ) : rows.length ? (
          <div className="table">
            {rows.map((row, i) => (
              <div className="table-row" key={row.id || i}>
                <div className="row-main">
                  <div className="row-icon meetings"><Users size={17} /></div>
                  <div>
                    <strong>{row.subject || row.title || 'Untitled meeting'}</strong>
                    <span>{row.startDateTime ? new Date(row.startDateTime).toLocaleString() : organizerLabel(row.organizer)}</span>
                  </div>
                </div>
                <span className={`pill ${row.momStatus === 'uploaded' ? 'success' : ''}`}>{row.momStatus || 'pending'}</span>
                <MoreHorizontal size={18} />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon"><Users size={24} /></div>
            <h3>No meetings extracted</h3>
            <p>Sync your inbox and MicroNeuro will surface meetings automatically.</p>
          </div>
        )}
      </section>
    </div>
  )
}