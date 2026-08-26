import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RequireAuth } from './components/RequireAuth'
import { Login } from './screens/Login'
import { Register } from './screens/Register'
import { Home } from './screens/Home'
import { Contacts } from './screens/Contacts'
import { Listen } from './screens/Listen'
import { Dashboard } from './screens/Dashboard'

export default function App() {
  return (
    <AuthProvider>
      <div className="app-shell">
        <div className="demo-banner">DEMO / SIMULATION — no real emergency services are contacted</div>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  )
}