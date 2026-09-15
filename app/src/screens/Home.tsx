import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Home() {
  const { user, signOut } = useAuth()

  return (
    <div className="home">
      <h1>HerShield</h1>
      <p>Signed in as {user?.email}</p>
      <p>
        <Link to="/contacts">Emergency contacts</Link>
      </p>
      <p>
        <Link to="/listen">Voice check (demo)</Link>
      </p>
      <p>
        <Link to="/dashboard">Dashboard &amp; SOS</Link>
      </p>
      <p>
        <Link to="/testing">Testing &amp; Fixtures (14 Cases)</Link>
      </p>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  )
}