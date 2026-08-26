import { supabase } from './supabase'
import { getCurrentUserId } from './session'
import { listContacts } from './contacts'
import type { EmergencyEvent } from './events'

export const SIMULATED_STATUS = 'SIMULATED' as const
export const SIMULATED_CHANNEL = 'simulated_email' as const

export interface NotificationLogRow {
  id: string
  event_id: string
  user_id: string
  contact_id: string | null
  channel: string
  status: typeof SIMULATED_STATUS
  payload: Record<string, unknown> | null
  created_at: string
}

export interface SimulationResult {
  notified: number
  error: string | null
}

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  const message = (err as { message?: string } | null)?.message
  return message ?? fallback
}

export function buildNotificationPayload(
  event: EmergencyEvent,
  contact: { id: string; name: string; phone: string | null; email: string | null },
): Record<string, unknown> {
  return {
    simulated: true,
    channel_note: 'DEMO MODE — no real message was sent',
    to: { name: contact.name, phone: contact.phone, email: contact.email },
    event: {
      id: event.id,
      event_type: event.event_type,
      risk_level: event.risk_level,
      decision_reason: event.decision_reason,
      transcript_summary: event.transcript_summary,
      occurred_at: event.created_at,
      location:
        event.location_lat !== null && event.location_lng !== null
          ? { lat: event.location_lat, lng: event.location_lng }
          : null,
    },
  }
}

export async function simulateNotifications(
  event: EmergencyEvent,
): Promise<SimulationResult> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { notified: 0, error: 'Not signed in' }
  }

  const contactsResult = await listContacts()
  if (contactsResult.error) {
    return { notified: 0, error: contactsResult.error }
  }
  if (contactsResult.contacts.length === 0) {
    return { notified: 0, error: null }
  }

  const rows = contactsResult.contacts.map((contact) => ({
    event_id: event.id,
    user_id: userId,
    contact_id: contact.id,
    channel: SIMULATED_CHANNEL,
    status: SIMULATED_STATUS,
    payload: buildNotificationPayload(event, contact),
  }))

  try {
    const { error } = await supabase.from('notification_log').insert(rows)
    if (error) {
      return { notified: 0, error: error.message }
    }
    return { notified: rows.length, error: null }
  } catch (err) {
    return { notified: 0, error: toErrorMessage(err, 'Could not record notifications') }
  }
}
