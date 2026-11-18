import { useEffect, useState } from 'react'
import { NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RequireAuth } from './components/RequireAuth'
import { Login } from './screens/Login'
import { Register } from './screens/Register'
import { Home } from './screens/Home'
import { Contacts } from './screens/Contacts'
import { Listen, isVoiceMonitoringActive, disarmGlobalMonitoring } from './screens/Listen'
import { Dashboard } from './screens/Dashboard'
import { TestingDashboard } from './screens/TestingDashboard'

/* ── Top Header Navigation & Account Bar ────────────────────────────── */

function AppNavigation() {
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const [monitoringActive, setMonitoringActive] = useState(() => isVoiceMonitoringActive())

  useEffect(() => {
    const handleUpdate = () => {
      setMonitoringActive(isVoiceMonitoringActive())
    }
    window.addEventListener('hershield_monitor_change', handleUpdate)
    return () => {
      window.removeEventListener('hershield_monitor_change', handleUpdate)
    }
  }, [])

  if (!user || pathname === '/login' || pathname === '/register') return null

  return (
    <>
      {/* Top Bar with Brand and Account */}
      <header className="app-nav">
        <div className="app-brand-row">
          <NavLink to="/" className="app-brand" aria-label="HerShield overview">
            <span className="app-brand-mark" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L4 5V11.09C4 16.14 7.41 20.85 12 22C16.59 20.85 20 16.14 20 11.09V5L12 2Z"
                  fill="url(#brand-shield-grad)"
                  stroke="#7c3aed"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path d="M9 11.5L11 13.5L15 9.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <linearGradient id="brand-shield-grad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#a78bfa" />
                    <stop offset="1" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            <span>HerShield</span>
          </NavLink>

          {/* Active Monitoring Pill in Top Bar */}
          {monitoringActive && (
            <div className="app-arm-active-pill" role="status" aria-label="Monitoring is active">
              <span className="arm-pulse-dot" aria-hidden="true" />
              <span className="arm-pill-text">ARMED</span>
              <button
                type="button"
                className="arm-quick-disarm-btn"
                onClick={() => void disarmGlobalMonitoring()}
                title="Disarm voice monitoring"
              >
                Disarm
              </button>
            </div>
          )}

          <div className="app-account">
            <span className="app-user-email">Signed in as {user.email}</span>
            <button type="button" onClick={() => void signOut()} className="app-signout-btn">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Mobile-First Frosted Bottom Tab Bar */}
      <nav className="app-nav-links" aria-label="Main navigation">
        <NavLink to="/" end className="nav-tab">
          <svg className="nav-tab-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Overview</span>
        </NavLink>

        <NavLink to="/listen" className="nav-tab">
          <svg className="nav-tab-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          <span>Voice check</span>
        </NavLink>

        <NavLink to="/dashboard" className="nav-tab">
          <svg className="nav-tab-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Activity &amp; SOS</span>
        </NavLink>

        <NavLink to="/contacts" className="nav-tab">
          <svg className="nav-tab-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Contacts</span>
        </NavLink>

        <NavLink to="/testing" className="nav-tab">
          <svg className="nav-tab-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3h6" />
            <path d="M10 3v7.4a2 2 0 0 1-.6 1.4L4 17.2A2 2 0 0 0 5.4 21h13.2a2 2 0 0 0 1.4-3.4L14.6 12a2 2 0 0 1-.6-1.4V3" />
          </svg>
          <span>Test lab</span>
        </NavLink>
      </nav>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app-shell">
        <div className="demo-banner">DEMO / SIMULATION — no real emergency services are contacted</div>
        <AppNavigation />
        <main className="app-main">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Home />
                </RequireAuth>
              }
            />
            <Route
              path="/contacts"
              element={
                <RequireAuth>
                  <Contacts />
                </RequireAuth>
              }
            />
            <Route
              path="/listen"
              element={
                <RequireAuth>
                  <Listen />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/testing"
              element={
                <RequireAuth>
                  <TestingDashboard />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  )
}
