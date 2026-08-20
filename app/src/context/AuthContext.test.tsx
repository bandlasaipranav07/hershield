import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import { makeSession, makeSubscription, makeUser } from '../test/factories'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

import { supabase } from '../lib/supabase'

const mockedAuth = vi.mocked(supabase.auth)

function Probe() {
  const { user, loading } = useAuth()
  if (loading) return <p>loading…</p>
  return <p>{user ? `user: ${user.email}` : 'no user'}</p>
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: makeSubscription() },
    })
  })

  it('exposes no user when there is no session', async () => {
    mockedAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(await screen.findByText('no user')).toBeInTheDocument()
  })

  it('exposes the user when a session exists', async () => {
    const user = makeUser('a@b.com')
    mockedAuth.getSession.mockResolvedValue({
      data: { session: makeSession(user) },
      error: null,
    })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(await screen.findByText('user: a@b.com')).toBeInTheDocument()
  })

  it('throws if useAuth is used outside AuthProvider', () => {
    expect(() => render(<Probe />)).toThrow('useAuth must be used inside <AuthProvider>')
  })
})