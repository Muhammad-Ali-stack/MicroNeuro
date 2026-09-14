import { useEffect, useState } from 'react'
import { Bell, RefreshCw, Save, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiError, getData, patchData } from '../lib/api'

const defaults = {
	alertLeadTimeHours: 24,
	foldersToScan: ['inbox'],
	notifyByEmail: false,
}

export default function Settings() {
	const [settings, setSettings] = useState(defaults)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)

	function load() {
		setLoading(true)
		getData('/settings')
			.then(data => setSettings({ ...defaults, ...data }))
			.catch(error => toast.error(apiError(error)))
			.finally(() => setLoading(false))
	}

	useEffect(() => { load() }, [])

	async function save(event) {
		event.preventDefault()
		setSaving(true)
		try {
			await patchData('/settings', settings)
			toast.success('Settings saved')
		} catch (error) {
			toast.error(apiError(error))
		} finally {
			setSaving(false)
		}
	}

	return (
		<div className="page">
			<div className="page-heading">
				<div>
					<div className="eyebrow"><Settings2 size={14} /> Preferences</div>
					<h1>Settings</h1>
					<p>Choose how MicroNeuro scans your workspace and sends alerts.</p>
				</div>
				<button className="button button-light" onClick={load} disabled={loading}>
					<RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
				</button>
			</div>

			<form className="panel" onSubmit={save}>
				<div className="panel-head">
					<div><h2>Alert preferences</h2><p>Control when deadlines become alerts.</p></div>
					<Bell size={18} color="var(--accent-orange-text)" />
				</div>

				<label style={{ display: 'block', marginBottom: 20 }}>
					<strong style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Alert lead time</strong>
					<select
						value={settings.alertLeadTimeHours}
						onChange={event => setSettings({ ...settings, alertLeadTimeHours: Number(event.target.value) })}
						style={{ padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--bg-input)', color: 'var(--ink)' }}
					>
						{[12, 24, 48, 72].map(hours => <option key={hours} value={hours}>{hours} hours before due</option>)}
					</select>
				</label>

				<label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: 'var(--text-secondary)' }}>
					<input
						type="checkbox"
						checked={settings.notifyByEmail}
						onChange={event => setSettings({ ...settings, notifyByEmail: event.target.checked })}
					/>
					Email me when a deadline alert is created
				</label>

				<button className="button button-dark" type="submit" disabled={saving || loading} style={{ marginTop: 22 }}>
					<Save size={15} /> {saving ? 'Saving...' : 'Save settings'}
				</button>
			</form>
		</div>
	)
}
