import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Plus, MapPin, Users as UsersIcon, Clock3, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { getData, postData, patchData, deleteData, apiError } from '../lib/api'
import { CalendarBrandIcon } from '../components/BrandIcons'

function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}

export default function Calendar() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ subject: '', start: '', end: '', location: '' })
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventBusy, setEventBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const end = new Date(weekStart); end.setDate(end.getDate() + 7)
    getData(`/calendar/events?startDateTime=${weekStart.toISOString()}&endDateTime=${end.toISOString()}&limit=50`)
      .then(d => setEvents(d?.events || d || []))
      .catch(e => toast.error(apiError(e)))
      .finally(() => setLoading(false))
  }, [weekStart])

  useEffect(() => { load() }, [load])

  async function createEvent(e) {
    e.preventDefault()
    if (!form.subject || !form.start || !form.end) return toast.error('Subject, start and end are required')
    try {
      await postData('/calendar/events', {
        subject: form.subject,
        start: { dateTime: form.start, timeZone: 'UTC' },
        end: { dateTime: form.end, timeZone: 'UTC' },
        location: form.location || undefined,
      })
      toast.success('Event created')
      setShowCreate(false)
      setForm({ subject: '', start: '', end: '', location: '' })
      load()
    } catch (e2) { toast.error(apiError(e2)) }
  }

  async function updateEvent(event) {
    event.preventDefault()
    if (!selectedEvent?.id || eventBusy) return
    setEventBusy(true)
    try {
      await patchData(`/calendar/events/${encodeURIComponent(selectedEvent.id)}`, {
        subject: selectedEvent.subject,
        location: selectedEvent.location?.displayName || selectedEvent.location || undefined,
      })
      toast.success('Event updated')
      setSelectedEvent(null)
      load()
    } catch (error) { toast.error(apiError(error)) } finally { setEventBusy(false) }
  }

  async function deleteEvent() {
    if (!selectedEvent?.id || eventBusy) return
    setEventBusy(true)
    try {
      await deleteData(`/calendar/events/${encodeURIComponent(selectedEvent.id)}`)
      toast.success('Event deleted')
      setSelectedEvent(null)
      load()
    } catch (error) { toast.error(apiError(error)) } finally { setEventBusy(false) }
  }

  async function respond(response) {
    if (!selectedEvent?.id || eventBusy) return
    setEventBusy(true)
    try {
      await postData(`/calendar/events/${encodeURIComponent(selectedEvent.id)}/respond`, { response, sendResponse: true })
      toast.success(`Invitation ${response}`)
      setSelectedEvent(null)
      load()
    } catch (error) { toast.error(apiError(error)) } finally { setEventBusy(false) }
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
  })

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow"><CalendarBrandIcon size={14} /> Microsoft Calendar</div>
          <h1>Calendar</h1>
          <p>Keep your schedule moving.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="button button-light" onClick={load}><RefreshCw size={16} /> Refresh</button>
          <button className="button button-dark" onClick={() => setShowCreate(true)}><Plus size={16} /> New event</button>
        </div>
      </div>

      <div className="filter-row">
        <button className="button button-ghost" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }}>← Prev</button>
        <strong style={{ fontSize: 13 }}>{days[0].toLocaleDateString('en', { month: 'short', day: 'numeric' })} – {days[6].toLocaleDateString('en', { month: 'short', day: 'numeric' })}</strong>
        <button className="button button-ghost" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }}>Next →</button>
      </div>

      <section className="panel table-panel">
        {loading ? (
          <div className="loading"><RefreshCw className="spin" /> Loading events…</div>
        ) : events.length ? (
          <div className="table">
            {events.map((ev, i) => (
              <button className="table-row calendar-row" key={ev.id || i} onClick={() => setSelectedEvent(ev)}>
                <div className="row-main">
                  <div className="row-icon meetings"><Clock3 size={17} /></div>
                  <div>
                    <strong>{ev.subject || 'Untitled event'}</strong>
                    <span>
                      {ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleString('en', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      {ev.location?.displayName ? ` · ${ev.location.displayName}` : ''}
                    </span>
                  </div>
                </div>
                {ev.attendees?.length ? <span className="pill"><UsersIcon size={12} style={{ marginRight: 4 }} />{ev.attendees.length}</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon"><CalendarBrandIcon size={24} /></div>
            <h3>Nothing scheduled this week</h3>
            <p>Create an event or ask MicroNeuro AI to schedule one for you.</p>
          </div>
        )}
      </section>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={createEvent}>
            <div className="modal-head"><h3>New event</h3><button type="button" className="icon-button" onClick={() => setShowCreate(false)}>×</button></div>
            <label className="field"><span>Subject</span><input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required /></label>
            <label className="field"><span>Start</span><input type="datetime-local" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} required /></label>
            <label className="field"><span>End</span><input type="datetime-local" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} required /></label>
            <label className="field"><span>Location</span><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Optional" /></label>
            <div className="modal-actions"><button type="submit" className="button button-dark"><MapPin size={15} /> Create event</button></div>
          </form>
        </div>
      )}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <form className="modal" onClick={event => event.stopPropagation()} onSubmit={updateEvent}>
            <div className="modal-head"><h3>Event details</h3><button type="button" className="icon-button" onClick={() => setSelectedEvent(null)}>×</button></div>
            <label className="field"><span>Subject</span><input value={selectedEvent.subject || ''} onChange={event => setSelectedEvent(current => ({ ...current, subject: event.target.value }))} /></label>
            <label className="field"><span>Location</span><input value={selectedEvent.location?.displayName || selectedEvent.location || ''} onChange={event => setSelectedEvent(current => ({ ...current, location: event.target.value }))} /></label>
            <p className="modal-meta">{selectedEvent.start?.dateTime ? new Date(selectedEvent.start.dateTime).toLocaleString() : 'Time not available'} · {selectedEvent.attendees?.length || 0} attendees</p>
            <div className="modal-actions modal-actions-spread"><button type="button" className="button button-danger" onClick={deleteEvent} disabled={eventBusy}><Trash2 size={15} /> Delete</button><div><button type="button" className="button button-light" onClick={() => respond('decline')} disabled={eventBusy}><X size={15} /> Decline</button><button type="button" className="button button-light" onClick={() => respond('accept')} disabled={eventBusy}><Check size={15} /> Accept</button><button type="submit" className="button button-dark" disabled={eventBusy}>Save changes</button></div></div>
          </form>
        </div>
      )}
    </div>
  )
}