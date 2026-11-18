import { supabase, isDemoModeEnabled, isSupabaseConfigured } from './supabase'

export interface AuthResult {
  error: string | null
}

export interface DemoUser {
  id: string
  email: string
  user_metadata: { full_name: string }
}

const DEMO_USER_KEY = 'hershield_demo_user'
const DEMO_USER_ID = 'demo-user-1'
const SUPABASE_SETUP_ERROR =
  'Supabase is not configured. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or enable local demo mode for development.'

export function getDemoUser(): DemoUser | null {
  if (!isDemoModeEnabled) return null
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(DEMO_USER_KEY) : null
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('id' in parsed) ||
      !('email' in parsed) ||
      !('user_metadata' in parsed)
    ) return null
    const candidate = parsed as DemoUser
    return candidate.id === DEMO_USER_ID && typeof candidate.email === 'string' ? candidate : null
  } catch {
    return null
  }
}

export function setDemoUser(user: DemoUser | null): void {
  try {
    if (typeof window === 'undefined') return
    if (user && isDemoModeEnabled) {
      window.localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user))
    } else {
      window.localStorage.removeItem(DEMO_USER_KEY)
    }
  } catch {
    // Ignore storage issues
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
): Promise<AuthResult> {
  // If Supabase isn't configured but demo mode is on, treat sign-up as demo login
  if (!isSupabaseConfigured) {
    if (isDemoModeEnabled) {
      return signInAsDemo(email)
    }
    return { error: SUPABASE_SETUP_ERROR }
  }

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
  // If Supabase isn't configured but demo mode is on, treat any sign-in as demo login
  if (!isSupabaseConfigured) {
    if (isDemoModeEnabled) {
      return signInAsDemo(email)
    }
    return { error: SUPABASE_SETUP_ERROR }
  }

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { error: error.message }
    }
    return { error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : (err as { message?: string } | null)?.message
    return { error: message ?? 'Sign in failed' }
  }
}

export async function signInAsDemo(customEmail?: string): Promise<AuthResult> {
  if (!isDemoModeEnabled) {
    return { error: 'Demo mode is disabled. Enable VITE_DEMO_MODE=true in a local development environment.' }
  }

  const demo: DemoUser = {
    id: DEMO_USER_ID,
    email: customEmail?.trim() || 'demo@hershield.org',
    user_metadata: { full_name: 'HerShield Demo Researcher' },
  }
  setDemoUser(demo)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('hershield_auth_change'))
  return { error: null }
}

export async function signOutUser(): Promise<AuthResult> {
  setDemoUser(null)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('hershield_auth_change'))
  if (!isSupabaseConfigured) return { error: null }
  try {
    const { error } = await supabase.auth.signOut()
    return { error: error?.message ?? null }
  } catch (err) {
    const message = err instanceof Error ? err.message : (err as { message?: string } | null)?.message
    return { error: message ?? 'Sign out failed' }
  }
}
