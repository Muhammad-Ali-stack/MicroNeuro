import { Bell, Moon, RefreshCw, Search, Sun } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Logo from '../ui/Logo'
import { useAuth } from '../../hooks/useAuth'
import { apiError, getData } from '../../lib/api'
import { toast } from 'sonner'

const pageNames = {
	'/': 'Dashboard',
	'/inbox': 'Inbox',
	'/calendar': 'Calendar',
	'/meetings': 'Meetings',
	'/deadlines': 'Deadlines',
	'/actions': 'Action items',
	'/alerts': 'Alerts',
	'/assistant': 'Ask MicroNeuro AI',
	'/files': 'SharePoint / OneDrive',
	'/mcp': 'MCP Connection',
	'/settings': 'Settings',
	'/accounts': 'Accounts',
}

export default function Topbar({ onSync, syncing, unread = 0, theme, toggleTheme }) {
	const location = useLocation()
	const { user, activeAccount } = useAuth()
	const [alertsOpen, setAlertsOpen] = useState(false)
	const [alerts, setAlerts] = useState([])
	const [unreadCount, setUnreadCount] = useState(unread)

	useEffect(() => {
		getData('/alerts?unreadOnly=true').then(data => {
			const rows = Array.isArray(data) ? data : data?.alerts || []
			setUnreadCount(rows.length)
			if (alertsOpen) setAlerts(rows)
		}).catch(error => { if (alertsOpen) toast.error(apiError(error)) })
	}, [alertsOpen])

	useEffect(() => {
		function closeOnEscape(event) {
			if (event.key === 'Escape') setAlertsOpen(false)
		}
		document.addEventListener('keydown', closeOnEscape)
		return () => document.removeEventListener('keydown', closeOnEscape)
	}, [])
	const displayName = user?.displayName || activeAccount?.displayName || 'Microsoft User'
	const initial = displayName
		.split(/\s+/)
		.map(part => part[0])
		.join('')
		.slice(0, 2)
		.toUpperCase()

	return (
		<header className="topbar">
			<Logo compact className="mobile-logo" />
			<div className="crumb">
				<span>Workspace</span>
				<span>/</span>
				<strong>{pageNames[location.pathname] || 'Workspace'}</strong>
			</div>

			<div className="top-actions">
				<label className="search">
					<Search size={15} />
					<input type="search" placeholder="Search workspace" aria-label="Search workspace" />
				</label>
				{onSync && (
					<button className="button button-light sync-button" onClick={onSync} disabled={syncing}>
						<RefreshCw size={15} className={syncing ? 'spin' : ''} />
						<span className="sync-label">{syncing ? 'Syncing...' : 'Sync now'}</span>
					</button>
				)}
				<button className="theme-toggle" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
					{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
				</button>
				<div className="notification-wrap">
				<button className="icon-button notification" title="Notifications" aria-label="Notifications" onClick={() => setAlertsOpen(value => !value)} aria-expanded={alertsOpen}>
					<Bell size={18} />
					{unreadCount > 0 && <b>{unreadCount > 99 ? '99+' : unreadCount}</b>}
				</button>
				{alertsOpen && <div className="alerts-flyout"><div className="flyout-head"><strong>Unread alerts</strong><span>{alerts.length}</span></div>{alerts.length ? alerts.slice(0, 5).map((alert, index) => <div className="alert-flyout-row" key={alert.id || index}><strong>{alert.title || alert.message || 'Alert'}</strong><small>{alert.createdAt ? new Date(alert.createdAt).toLocaleString() : 'Recently'}</small></div>) : <div className="flyout-empty">No unread alerts</div>}</div>}
				</div>
				<div className="top-avatar" title={displayName}>{initial}</div>
			</div>
		</header>
	)
}
