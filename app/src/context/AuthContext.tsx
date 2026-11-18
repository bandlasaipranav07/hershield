import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured, isDemoModeEnabled } from '../lib/supabase'
import {
  getDemoUser,
  signInAsDemo,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
  type DemoUser,
} from '../lib/auth'

export type AppUser = User | DemoUser

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signInDemo: () => Promise<string | null>
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Seed initial user: persisted demo user (from localStorage) or null
  const [user, setUser] = useState<AppUser | null>(() => getDemoUser())
  // Only show loading spinner when Supabase is configured (need async session check)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    let active = true

    let unsub: (() => void) | undefined

    if (isSupabaseConfigured) {
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!active) return
          if (data.session?.user) {
            setUser(data.session.user)
          } else {
            // No Supabase session — try persisted demo user
            setUser(getDemoUser())
          }
          setLoading(false)
        })
        .catch(() => {
          if (!active) return
          setUser(getDemoUser())
          setLoading(false)
        })

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return
        if (session?.user) {
          setUser(session.user)
        } else {
          setUser(getDemoUser())
        }
        setLoading(false)
      })

      unsub = () => sub.subscription.unsubscribe()
    }

    // Auto sign-in as demo if demo mode is enabled and no user is loaded yet
    // This ensures reload on phone / production build doesn't boot user to login
    if (!isSupabaseConfigured && isDemoModeEnabled && !getDemoUser()) {
      void signInAsDemo()
    }

    // Listen for demo sign-in/out events dispatched by auth.ts
    const onCustomAuth = () => {
      if (!active) return
      const demo = getDemoUser()
      setUser(demo)
      setLoading(false)
    }

    window.addEventListener('hershield_auth_change', onCustomAuth)

    return () => {
      active = false
      unsub?.()
      window.removeEventListener('hershield_auth_change', onCustomAuth)
    }
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    signIn: async (email, password) => (await signInWithEmail(email, password)).error,
    signInDemo: async () => (await signInAsDemo()).error,
    signUp: async (email, password, fullName) =>
      (await signUpWithEmail(email, password, fullName)).error,
    signOut: async () => {
      await signOutUser()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- AuthProvider + useAuth intentionally live together
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
