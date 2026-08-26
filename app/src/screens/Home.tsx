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
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  )
}