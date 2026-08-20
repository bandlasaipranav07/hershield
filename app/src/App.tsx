import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RequireAuth } from './components/RequireAuth'
import { Login } from './screens/Login'
import { Register } from './screens/Register'
import { Home } from './screens/Home'

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
        </Routes>
      </div>
    </AuthProvider>
  )
}