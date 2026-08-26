import { supabase } from './supabase'

export interface Contact {
  id: string
  user_id: string
  name: string
  phone: string | null
  email: string | null
  relation: string | null
  created_at: string
}

export interface ContactInput {
  name: string
  phone: string
  email: string
  relation: string
}

const COLUMNS = 'id, user_id, name, phone, email, relation, created_at'

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  const message = (err as { message?: string } | null)?.message
  return message ?? fallback
}

function toPayload(input: ContactInput) {
  return {
    name: input.name.trim(),
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    relation: input.relation.trim() || null,
  }
}

export function validateContactInput(input: ContactInput): string | null {
  if (!input.name.trim()) {
    return 'Name is required'
  }
  return null
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export async function listContacts(): Promise<{ contacts: Contact[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select(COLUMNS)
      .order('created_at', { ascending: true })
    if (error) {
      return { contacts: [], error: error.message }
    }
    return { contacts: (data ?? []) as Contact[], error: null }
  } catch (err) {
    return { contacts: [], error: toErrorMessage(err, 'Could not load contacts') }
  }
}

export async function addContact(
  input: ContactInput,
): Promise<{ contact: Contact | null; error: string | null }> {
  const invalid = validateContactInput(input)
  if (invalid) {
    return { contact: null, error: invalid }
  }

  const userId = await getUserId()
  if (!userId) {
    return { contact: null, error: 'Not signed in' }
  }

  const payload = { ...toPayload(input), user_id: userId }
  try {
    const { data, error } = await supabase
      .from('contacts')
      .insert(payload)
      .select(COLUMNS)
      .single()
    if (error) {
      return { contact: null, error: error.message }
    }
    return { contact: data as Contact, error: null }
  } catch (err) {
    return { contact: null, error: toErrorMessage(err, 'Could not add contact') }
  }
}

export async function updateContact(
  id: string,
  input: ContactInput,
): Promise<{ error: string | null }> {
  const invalid = validateContactInput(input)
  if (invalid) {
    return { error: invalid }
  }

  const userId = await getUserId()
  if (!userId) {
    return { error: 'Not signed in' }
  }

  try {
    const { error } = await supabase
      .from('contacts')
      .update(toPayload(input))
      .eq('id', id)
      .eq('user_id', userId)
    return { error: error?.message ?? null }
  } catch (err) {
    return { error: toErrorMessage(err, 'Could not update contact') }
  }
}

export async function deleteContact(id: string): Promise<{ error: string | null }> {
  const userId = await getUserId()
  if (!userId) {
    return { error: 'Not signed in' }
  }

  try {
    const { error } = await supabase.from('contacts').delete().eq('id', id).eq('user_id', userId)
    return { error: error?.message ?? null }
  } catch (err) {
    return { error: toErrorMessage(err, 'Could not delete contact') }
  }
}
