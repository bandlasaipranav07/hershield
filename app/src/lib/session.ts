import { supabase, isSupabaseConfigured } from './supabase'
import { getDemoUser } from './auth'

export async function getCurrentUserId(): Promise<string | null> {
  const demo = getDemoUser()
  if (demo?.id) return demo.id

  if (!isSupabaseConfigured) return null

  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

