import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { makeSession, makeSubscription, makeUser } from './test/factories'

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => makeEmptyQueryChain()),
  },
}))

function makeEmptyQueryChain() {
  const result = { data: [], error: null }
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single']) {
    chain[method] = () => chain
  }
  chain.then = (onFulfilled: (value: typeof result) => unknown) => onFulfilled(result)
  return chain
}

import { supabase } from './lib/supabase'

const mockedAuth = vi.mocked(supabase.auth)

function renderApp(initialEntries?: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  )
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: makeSubscription() },
    })
  })

  it('renders the HerShield heading on the login screen when signed out', async () => {
    mockedAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })

    renderApp()

    expect(await screen.findByRole('heading', { name: /hershield/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('always shows the DEMO/SIMULATION banner', async () => {
    mockedAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })

    renderApp()

    expect(await screen.findByText(/DEMO \/ SIMULATION/i)).toBeInTheDocument()
  })

  it('shows the home screen when a session exists', async () => {
    mockedAuth.getSession.mockResolvedValue({
      data: { session: makeSession(makeUser('a@b.com')) },
      error: null,
    })

    renderApp()

    expect(await screen.findByText('Signed in as a@b.com')).toBeInTheDocument()
  })

  it('redirects to /login when navigating to a protected route without a session', async () => {
    mockedAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })

    renderApp(['/'])

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('redirects to /login when opening /contacts without a session', async () => {
    mockedAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })

    renderApp(['/contacts'])

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('shows the contacts screen when signed in', async () => {
    mockedAuth.getSession.mockResolvedValue({
      data: { session: makeSession(makeUser('a@b.com')) },
      error: null,
    })

    renderApp(['/contacts'])

    expect(
      await screen.findByRole('heading', { name: /emergency contacts/i }),
    ).toBeInTheDocument()
  })

  it('redirects unknown routes to the app instead of rendering a blank shell', async () => {
    mockedAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })

    renderApp(['/definitely-not-a-route'])

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})