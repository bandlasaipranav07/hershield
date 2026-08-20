import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { Login } from './Login'
import { makeAuthError, makeSession, makeSubscription, makeUser } from '../test/factories'

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

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mockedAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: makeSubscription() },
    })
  })

  it('renders the form fields and submit button', () => {
    renderLogin()

    expect(screen.getByRole('heading', { name: /hershield/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('submits the entered credentials', async () => {
    const user = userEvent.setup()
    const session = makeSession(makeUser('a@b.com'))
    mockedAuth.signInWithPassword.mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    })

    renderLogin()
    await user.type(screen.getByLabelText('Email'), 'a@b.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(mockedAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret123',
    })
  })

  it('shows the error message when sign-in fails', async () => {
    const user = userEvent.setup()
    mockedAuth.signInWithPassword.mockRejectedValue(
      makeAuthError('Invalid login credentials'),
    )

    renderLogin()
    await user.type(screen.getByLabelText('Email'), 'a@b.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
  })
})