import { supabase } from './supabase'

export interface AuthResult {
  error: string | null
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    return { error: error?.message ?? null }
  } catch (err) {
    const message = err instanceof Error ? err.message : (err as { message?: string } | null)?.message
    return { error: message ?? 'Sign up failed' }
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    await supabase.auth.signInWithPassword({ email, password })
    return { error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : (err as { message?: string } | null)?.message
    return { error: message ?? 'Sign in failed' }
  }
}

export async function signOutUser(): Promise<AuthResult> {
  const { error } = await supabase.auth.signOut()
  return { error: error?.message ?? null }
}