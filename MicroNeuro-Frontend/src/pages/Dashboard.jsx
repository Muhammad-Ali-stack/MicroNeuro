import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles, Users, Clock3, ListChecks, Bell, ChevronDown, Check,
  ArrowUpRight, Inbox, MoveHorizontal as MoreHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import { getData, postData, apiError } from '../lib/api'

function StatCard({ label, value, hint, icon: Icon, tone }) {
  return (
    <motion.div className="stat-card" whileHover={{ y: -3 }}>
      <div className={`stat-icon ${tone}`}><Icon size={19} /></div>
      <div>
        <p>{label}</p>
        <strong>{value ?? '—'}</strong>
        <small>{hint}</small>
      </div>
      <ArrowUpRight size={16} className="stat-arrow" />
    </motion.div>
  )
}

function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', text = 'Connect your account and sync to bring your work into focus.' }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon size={24} /></div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

export default function Dashboard({ user }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getData('/dashboard/summary')
      .then(setSummary)
      .catch(e => toast.error(apiError(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function sync() {
    setSyncing(true)
    try {
      const d = await postData('/sync/inbox')
      toast.success(`${d?.processed || 0} processed, ${d?.skipped || 0} skipped`)
      load()
    } catch (e) {
      toast.error(apiError(e))
    } finally {
      setSyncing(false)
    }
  }

  const counts = summary?.counts
  const recent = summary?.recent
  const firstName = (user?.displayName || 'there').split(' ')[0]

  return (
    <div className="page">
      <div className="hero">
        <div>
          <div className="eyebrow"><span className="live-dot" /> Intelligence overview</div>
          <h1>Good to see you, <em>{firstName}.</em></h1>
          <p>MicroNeuro turns the noise across your Microsoft 365 into clear next steps.</p>
          <button className="button button-dark" onClick={sync} disabled={syncing} style={{ marginTop: 16 }}>
            <Sparkles size={15} className={syncing ? 'spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync inbox now'}
          </button>
        </div>
        <div className="hero-orbit">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="hero-brain"><Sparkles size={26} /></div>
        </div>
      </div>

      <div className="stats">
        {[
          ['Meetings', counts?.meetings, 'Extracted from inbox', Users, 'blue'],
          ['Deadlines', counts?.deadlines, 'Across all projects', Clock3, 'orange'],
          ['Action items', counts?.actionItems, 'Waiting for you', ListChecks, 'green'],
          ['Unread alerts', counts?.unreadAlerts, 'Worth a look', Bell, 'red'],
        ].map(item => (
          <StatCard key={item[0]} label={item[0]} value={loading ? '…' : item[1]} hint={item[2]} icon={item[3]} tone={item[4]} />
        ))}
      </div>

      <div className="content-grid">
        <section className="panel panel-wide">
          <div className="panel-head">
            <div><h2>Work pulse</h2><p>Your intelligence layer at a glance</p></div>
            <button className="button button-ghost">Last 30 days <ChevronDown size={14} /></button>
          </div>
          <div className="pulse">
            <div className="pulse-chart">
              <div className="chart-grid" />
              <svg viewBox="0 0 600 160" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="line" x1="0" x2="1">
                    <stop stopColor="#1677ff" /><stop offset=".5" stopColor="#14b87a" /><stop offset="1" stopColor="#f5a623" />
                  </linearGradient>
                  <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
                    <stop stopColor="#1677ff" stopOpacity=".18" /><stop offset="1" stopColor="#1677ff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 132 C42 118 56 127 87 105 S133 110 167 91 S207 101 240 72 S279 86 310 63 S359 68 395 77 S437 41 470 51 S532 45 600 15 V160 H0Z" fill="url(#fill)" />
                <path d="M0 132 C42 118 56 127 87 105 S133 110 167 91 S207 101 240 72 S279 86 310 63 S359 68 395 77 S437 41 470 51 S532 45 600 15" fill="none" stroke="url(#line)" strokeWidth="3" />
              </svg>
              <div className="chart-labels"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span><span>Now</span></div>
            </div>
            <div className="pulse-summary">
              <div><span className="summary-number">{counts ? Math.min(99, 40 + (counts.meetings || 0) + (counts.deadlines || 0)) : '—'}%</span><span className="summary-label">of your inbox is organized</span></div>
              <div className="mini-progress"><span /></div>
              <p><Check size={14} /> Synced {recent?.emails?.length ? `${recent.emails.length} recent emails` : 'no new emails yet'}</p>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><h2>Coming up</h2><p>Closest deadlines</p></div>
            <Link to="/deadlines" className="text-link">View all</Link>
          </div>
          {recent?.deadlines?.length
            ? recent.deadlines.slice(0, 3).map((item, i) => (
              <div className="list-row" key={item.id || i}>
                <div className="date-tile">
                  <strong>{new Date(item.dueDate).getDate()}</strong>
                  <span>{new Date(item.dueDate).toLocaleString('en', { month: 'short' })}</span>
                </div>
                <div><strong>{item.description || item.title}</strong><span>{item.status || 'Upcoming'}</span></div>
                <MoreHorizontal size={17} />
              </div>
            ))
            : <EmptyState icon={Clock3} title="No deadlines yet" text="Sync your inbox to discover important dates." />}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><h2>Action items</h2><p>Things waiting for you</p></div>
            <Link to="/actions" className="text-link">View all</Link>
          </div>
          {recent?.actionItems?.length
            ? recent.actionItems.slice(0, 3).map((item, i) => (
              <div className="task-row" key={item.id || i}>
                <span className="task-check" />
                <div><strong>{item.description || item.title}</strong><span>{item.status || 'Open'}</span></div>
              </div>
            ))
            : <EmptyState icon={ListChecks} title="You're all caught up" text="New action items will appear here after a sync." />}
        </section>
      </div>
    </div>
  )
}