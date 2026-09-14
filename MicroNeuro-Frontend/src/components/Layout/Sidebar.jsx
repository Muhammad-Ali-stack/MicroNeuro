import { NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Clock3,
  ListChecks,
  Bell,
  Sparkles,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from 'lucide-react'

import {
  CalendarBrandIcon,
  MailBrandIcon,
  ExcelIcon,
  WordIcon,
  PowerPointIcon,
  OneDriveIcon,
  MCPIcon,
} from '../BrandIcons'

import Logo from '../ui/Logo'

import { useAuth } from '../../hooks/useAuth'
import { api, apiError, getData, postData } from '../../lib/api'
import { toast } from 'sonner'


/* Wrap brand SVGs so they accept the same `size` prop as Lucide icons */
const B = (Comp) => ({ size = 18 }) => <Comp size={size} />


const NAV = [
  {
    title: 'Workspace',
    items: [
      {
        to: '/',
        label: 'Dashboard',
        Icon: LayoutDashboard,
      },
        {
          to: '/inbox',
        label: 'Inbox',
        Icon: B(MailBrandIcon),
      },
      {
        to: '/calendar',
        label: 'Calendar',
        Icon: B(CalendarBrandIcon),
      },
      {
        to: '/meetings',
        label: 'Meetings',
        Icon: Users,
      },
      {
        to: '/deadlines',
        label: 'Deadlines',
        Icon: Clock3,
      },
      {
        to: '/actions',
        label: 'Action items',
        Icon: ListChecks,
      },
      {
        to: '/alerts',
        label: 'Alerts',
        Icon: Bell,
      },
      {
        to: '/assistant',
        label: 'Ask MicroNeuro AI',
        Icon: Sparkles,
      },
    ],
  },

  {
    title: 'Microsoft 365',
    items: [
      {
        to: '/excel',
        label: 'Excel',
        Icon: B(ExcelIcon),
        badge: 'soon',
      },
      {
        to: '/word',
        label: 'Word',
        Icon: B(WordIcon),
        badge: 'soon',
      },
      {
        to: '/powerpoint',
        label: 'PowerPoint',
        Icon: B(PowerPointIcon),
        badge: 'soon',
      },
      {
        to: '/files',
        label: 'SharePoint / OneDrive',
        Icon: B(OneDriveIcon),
      },
    ],
  },

  {
    title: 'Manage',
    items: [
      {
        to: '/mcp',
        label: 'MCP Connection',
        Icon: B(MCPIcon),
      },
      {
        to: '/settings',
        label: 'Settings',
        Icon: Settings2,
      },
      {
        to: '/accounts',
        label: 'Accounts',
        Icon: Users,
      },
    ],
  },
]


export default function Sidebar({
  collapsed,
  setCollapsed,
  unread = 0,
}) {
  const location = useLocation()
  const [loggingOut, setLoggingOut] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [accounts, setAccounts] = useState([])
  const {
    user,
    activeAccount,
    logout,
  } = useAuth()

  const displayName =
    user?.displayName ||
    activeAccount?.displayName ||
    user?.name ||
    'Microsoft User'

  const email =
    user?.mail ||
    activeAccount?.email ||
    ''

  const initial =
    displayName
      ?.split(/\s+/)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'MU'

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await api.post('/auth/logout')
      toast.success('Signed out successfully.')
    } catch (error) {
      toast.error(apiError(error))
    } finally {
      logout()
      setLoggingOut(false)
    }
  }

  async function openAccounts() {
    setAccountOpen(value => !value)
    if (accounts.length) return
    try {
      const data = await getData('/auth/accounts')
      setAccounts(Array.isArray(data) ? data : data?.accounts || [])
    } catch (error) {
      toast.error(apiError(error))
    }
  }

  async function switchAccount(account) {
    if (account.isActive) return
    try {
      await postData('/auth/switch-account', { connectedAccountId: account.id })
      toast.success(`Switched to ${account.email}`)
      window.location.reload()
    } catch (error) {
      toast.error(apiError(error))
    }
  }

  return (
    <motion.aside
      className={`sidebar ${collapsed ? 'collapsed' : ''}`}
      animate={{
        width: collapsed ? 64 : 232,
      }}
      transition={{
        duration: 0.22,
        ease: [0.4, 0, 0.2, 1],
      }}
      style={{
        overflowX: 'hidden',
        overflowY: 'auto',
        height: '100vh',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        flexShrink: 0,
      }}
    >

      {/* Brand */}
      <div className="sidebar-top">

        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              key="full-logo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Logo />
            </motion.div>
          )}
          {collapsed && (
            <motion.div
              key="compact-logo"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
            >
              <Logo compact />
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed(value => !value)}
          title={
            collapsed
              ? 'Expand sidebar'
              : 'Collapse sidebar'
          }
          aria-label={
            collapsed
              ? 'Expand sidebar'
              : 'Collapse sidebar'
          }
        >
          {collapsed ? (
            <PanelLeftOpen size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>
      </div>


      {/* Navigation */}
      <nav className="nav">
        {NAV.map(group => (
          <div
            className="nav-group"
            key={group.title}
          >

            {!collapsed && (
              <span className="nav-label">
                {group.title}
              </span>
            )}

            {group.items.map(({
              to,
              label,
              Icon,
              badge,
            }) => {

              const isActive =
                to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(to)

              return (
                <NavLink
                  key={to}
                  to={to}
                  className={[
                    'nav-item',
                    isActive ? 'active' : '',
                    collapsed
                      ? 'nav-item-collapsed'
                      : '',
                  ].join(' ')}
                  title={
                    collapsed
                      ? label
                      : undefined
                  }
                  end={to === '/'}
                >

                  {/* Icon */}
                  <span
                    className="nav-icon"
                    style={{
                      position: 'relative',
                    }}
                  >
                    <Icon size={18} />

                    {to === '/alerts' &&
                      unread > 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            top: -3,
                            right: -3,
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: '#e5484d',
                            border:
                              '1.5px solid var(--bg-elevated)',
                          }}
                        />
                      )}
                  </span>


                  {/* Label */}
                  {!collapsed && (
                    <span className="nav-copy">
                      {label}

                      {badge === 'soon' && (
                        <span className="nav-badge">
                          Soon
                        </span>
                      )}
                    </span>
                  )}


                  {/* Alert count */}
                  {!collapsed &&
                    to === '/alerts' &&
                    unread > 0 && (
                      <span className="nav-count">
                        {unread}
                      </span>
                    )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>


      {/* User footer */}
      <div className="sidebar-footer">

        <button className="sidebar-user sidebar-user-button" onClick={openAccounts} aria-expanded={accountOpen}>

          <div className="avatar sidebar-avatar">
            {initial}
          </div>

          {!collapsed && (
            <div className="account-copy sidebar-user-info">
              <strong>
                {displayName}
              </strong>

              {email && (
                <span>
                  {email}
                </span>
              )}
            </div>
          )}

        </button>
        {accountOpen && <div className="account-flyout">{accounts.length ? accounts.map(account => <button className="account-option" key={account.id} onClick={() => switchAccount(account)}><span className="avatar">{(account.displayName || account.email || '?')[0]}</span><span><strong>{account.displayName || account.email}</strong><small>{account.email}</small></span>{account.isActive && <em>Active</em>}</button>) : <div className="flyout-empty">Loading accounts...</div>}</div>}


        <button
          type="button"
          className="sidebar-logout"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={15} />

          {!collapsed && (
            <span>
              Sign out
            </span>
          )}
        </button>

      </div>

    </motion.aside>
  )
}