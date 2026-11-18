import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { canEnableDemoMode, hasSupabaseConfiguration } from './supabaseConfig'

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = hasSupabaseConfiguration(rawUrl, rawKey)
export const isDemoModeEnabled = canEnableDemoMode(
  import.meta.env.DEV,
  isSupabaseConfigured,
  import.meta.env.VITE_DEMO_MODE,
)

const url = rawUrl || 'https://placeholder.supabase.co'
const anonKey = rawKey || 'placeholder-anon-key'

export const supabase: SupabaseClient = createClient(url, anonKey)
