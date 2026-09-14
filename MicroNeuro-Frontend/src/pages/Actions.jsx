import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Search, ListChecks } from 'lucide-react'
import { toast } from 'sonner'
import { getData, patchData, apiError } from '../lib/api'

const TABS = ['All', 'Open', 'Done']

export default function Actions() {
  const [tab, setTab] = useState('All')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    getData('/action-items')
      .then(d => setRows(Array.isArray(d) ? d : d?.actionItems || []))
      .catch(e => toast.error(apiError(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle(row) {
    const next = row.status === 'done' ? 'open' : 'done'
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, status: next } : r))
    try {
      await patchData(`/action-items/${row.id}`, { status: next })
    } catch (e) {
      toast.error(apiError(e))
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, status: row.status } : r))
    }
  }

  const visible = rows.filter(r => tab === 'All' || (tab === 'Open' && r.status !== 'done') || (tab === 'Done' && r.status === 'done'))

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow"><ListChecks size={14} /> Intelligence</div>
          <h1>Action items</h1>
          <p>The next steps that keep work moving.</p>
        </div>
        <button className="button button-light" onClick={load}><RefreshCw size={16} /> Refresh</button>
      </div>

      <div className="filter-row">
        <div className="tabs">
          {TABS.map(t => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
        </div>
        <div className="search compact"><Search size={15} /><input placeholder="Search action items" /></div>
      </div>

      <section className="panel table-panel">
        {loading ? (
          <div className="loading"><RefreshCw className="spin" /> Loading action items…</div>
        ) : visible.length ? (
          <div className="table">
            {visible.map((row, i) => (
              <div className="table-row" key={row.id || i} style={{ cursor: 'pointer' }} onClick={() => toggle(row)}>
                <div className="row-main">
                  <span className={`task-check ${row.status === 'done' ? 'checked' : ''}`} />
                  <div>
                    <strong style={row.status === 'done' ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>
                      {row.description || row.title || 'Untitled task'}
                    </strong>
                    <span>{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : 'No due date'}</span>
                  </div>
                </div>
                <span className={`pill ${row.status === 'done' ? 'success' : ''}`}>{row.status || 'open'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon"><ListChecks size={24} /></div>
            <h3>No action items found</h3>
            <p>Sync your inbox and MicroNeuro will pull out anything you owe someone.</p>
          </div>
        )}
      </section>
    </div>
  )
}