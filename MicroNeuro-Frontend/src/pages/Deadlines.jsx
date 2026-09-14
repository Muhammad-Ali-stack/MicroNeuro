import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Search, Clock3, MoveHorizontal as MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { getData, apiError } from '../lib/api'

const TABS = ['All', 'Upcoming', 'Overdue', 'Completed']
const TAB_VALUE = { All: null, Upcoming: 'upcoming', Overdue: 'overdue', Completed: 'completed' }

export default function Deadlines() {
  const [tab, setTab] = useState('All')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const status = TAB_VALUE[tab]
    getData(`/deadlines${status ? `?status=${status}` : ''}`)
      .then(d => setRows(Array.isArray(d) ? d : d?.deadlines || []))
      .catch(e => toast.error(apiError(e)))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => { load() }, [load])

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow"><Clock3 size={14} /> Intelligence</div>
          <h1>Deadlines</h1>
          <p>Never lose track of an important date.</p>
        </div>
        <button className="button button-light" onClick={load}><RefreshCw size={16} /> Refresh</button>
      </div>

      <div className="filter-row">
        <div className="tabs">
          {TABS.map(t => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
        </div>
        <div className="search compact"><Search size={15} /><input placeholder="Search deadlines" /></div>
      </div>

      <section className="panel table-panel">
        {loading ? (
          <div className="loading"><RefreshCw className="spin" /> Loading deadlines…</div>
        ) : rows.length ? (
          <div className="table">
            {rows.map((row, i) => (
              <div className="table-row" key={row.id || i}>
                <div className="row-main">
                  <div className="row-icon deadlines"><Clock3 size={17} /></div>
                  <div>
                    <strong>{row.description || row.title || 'Untitled deadline'}</strong>
                    <span>{row.dueDate ? new Date(row.dueDate).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                  </div>
                </div>
                <span className={`pill ${row.status === 'completed' ? 'success' : row.status === 'overdue' ? 'danger' : ''}`}>{row.status || 'upcoming'}</span>
                <MoreHorizontal size={18} />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon"><Clock3 size={24} /></div>
            <h3>No deadlines found</h3>
            <p>Sync your inbox to discover important dates, or ask MicroNeuro AI to set one.</p>
          </div>
        )}
      </section>
    </div>
  )
}