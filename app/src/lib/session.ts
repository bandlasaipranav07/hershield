import { supabase } from './supabase'

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}
