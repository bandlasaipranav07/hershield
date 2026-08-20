import type { AuthError, Session, User } from '@supabase/supabase-js'

export function makeUser(email: string, id = 'user-1'): User {
  return {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

export function makeSession(user: User): Session {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    expires_at: 4102444800,
    token_type: 'bearer',
    user,
  }
}

export function makeAuthError(message: string): AuthError {
  return { name: 'AuthError', message } as AuthError
}

export function makeSubscription() {
  return {
    id: 'test-subscription',
    callback: () => {},
    unsubscribe: () => {},
  }
}