import { Navigate, Route, Routes } from 'react-router-dom'

import AppShell from './components/Layout/AppShell'
import LoadingScreen from './components/ui/LoadingScreen'

import { useAuth } from './hooks/useAuth'
import { AuthProvider } from './hooks/useAuth'

import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'

import Dashboard from './pages/Dashboard'
import Inbox from './pages/Inbox'
import Calendar from './pages/Calendar'
import Meetings from './pages/Meetings'
import Deadlines from './pages/Deadlines'
import Actions from './pages/Actions'
import Alerts from './pages/Alerts'
import Assistant from './pages/Assistant'
import Files from './pages/Files'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'
import McpConnection from './pages/McpConnection'
import ComingSoon from './pages/ComingSoon'


function ProtectedRoutes() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <LoadingScreen />
  }

  if (status !== 'authed') {
    return <Navigate to="/login" replace />
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />

        <Route path="/inbox" element={<Inbox />} />

        <Route path="/calendar" element={<Calendar />} />

        <Route path="/meetings" element={<Meetings />} />

        <Route path="/deadlines" element={<Deadlines />} />

        <Route path="/actions" element={<Actions />} />

        <Route path="/alerts" element={<Alerts />} />

        <Route path="/assistant" element={<Assistant />} />

        <Route path="/excel" element={<ComingSoon type="excel" />} />

        <Route path="/word" element={<ComingSoon type="word" />} />

        <Route
          path="/powerpoint"
          element={<ComingSoon type="powerpoint" />}
        />

        <Route path="/files" element={<Files />} />

        <Route path="/settings" element={<Settings />} />

        <Route path="/accounts" element={<Accounts />} />

        <Route path="/mcp" element={<McpConnection />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}


export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}

        <Route path="/login" element={<Login />} />

        <Route
          path="/auth/callback"
          element={<AuthCallback />}
        />

        {/* Everything else requires authentication */}

        <Route
          path="/*"
          element={<ProtectedRoutes />}
        />
      </Routes>
    </AuthProvider>
  )
}