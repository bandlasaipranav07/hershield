import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  isSupabaseConfigured: false,
  isDemoModeEnabled: false,
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

import { getDemoUser, signInWithEmail, signUpWithEmail } from './auth'

describe('authentication without Supabase configuration', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('does not turn an ordinary email sign-in into an unauthenticated demo session', async () => {
    const result = await signInWithEmail('person@example.com', 'password123')

    expect(result.error).toEqual(expect.stringMatching(/supabase is not configured/i))
    expect(window.localStorage.getItem('hershield_demo_user')).toBeNull()
  })

  it('does not create an account by silently falling back to a local identity', async () => {
    const result = await signUpWithEmail('person@example.com', 'password123', 'Person')

    expect(result.error).toEqual(expect.stringMatching(/supabase is not configured/i))
    expect(window.localStorage.getItem('hershield_demo_user')).toBeNull()
  })

  it('ignores a demo identity persisted by an older build when demo mode is disabled', () => {
    window.localStorage.setItem(
      'hershield_demo_user',
      JSON.stringify({ id: 'demo-user-1', email: 'demo@example.com', user_metadata: { full_name: 'Demo' } }),
    )

    expect(getDemoUser()).toBeNull()
  })
})
