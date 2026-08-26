import { describe, it, expect, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

import { supabase } from './supabase'
import { signInWithEmail, signOutUser, signUpWithEmail } from './auth'
import { makeAuthError } from '../test/factories'

const mockedAuth = vi.mocked(supabase.auth)

describe('auth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signUpWithEmail passes full name in user metadata', async () => {
    mockedAuth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    })

    const result = await signUpWithEmail('a@b.com', 'secret123', 'Aarav Sharma')

    expect(mockedAuth.signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret123',
      options: { data: { full_name: 'Aarav Sharma' } },
    })
    expect(result.error).toBeNull()
  })

  it('signUpWithEmail maps an error to its message', async () => {
    mockedAuth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: makeAuthError('Email already registered'),
    })

    const result = await signUpWithEmail('a@b.com', 'secret123', 'Aarav Sharma')

    expect(result.error).toBe('Email already registered')
  })

  it('signUpWithEmail returns a message when sign-up throws (e.g. offline)', async () => {
    mockedAuth.signUp.mockRejectedValue(new Error('Failed to fetch'))

    const result = await signUpWithEmail('a@b.com', 'secret123', 'Aarav Sharma')

    expect(result.error).toBe('Failed to fetch')
  })

  it('signInWithEmail calls signInWithPassword with the credentials', async () => {
    mockedAuth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    } as never)

    const result = await signInWithEmail('a@b.com', 'secret123')

    expect(mockedAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret123',
    })
    expect(result.error).toBeNull()
  })

  it('signInWithEmail returns the message when sign-in throws', async () => {
    mockedAuth.signInWithPassword.mockRejectedValue(
      makeAuthError('Invalid login credentials'),
    )

    const result = await signInWithEmail('a@b.com', 'wrong')

    expect(result.error).toBe('Invalid login credentials')
  })

  it('signOutUser calls auth.signOut', async () => {
    mockedAuth.signOut.mockResolvedValue({ error: null })

    const result = await signOutUser()

    expect(mockedAuth.signOut).toHaveBeenCalledOnce()
    expect(result.error).toBeNull()
  })
})