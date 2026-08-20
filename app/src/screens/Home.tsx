import { useAuth } from '../context/AuthContext'

export function Home() {
  const { user, signOut } = useAuth()

  return (
    <div className="home">
      <h1>HerShield</h1>
      <p>Signed in as {user?.email}</p>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  )
}