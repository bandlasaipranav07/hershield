import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSession = vi.hoisted(() => ({ userId: 'user-a' }))

vi.mock('./supabase', () => ({
  isSupabaseConfigured: false,
  isDemoModeEnabled: true,
  supabase: { auth: {}, from: vi.fn() },
}))

vi.mock('./session', () => ({
  getCurrentUserId: vi.fn(async () => mockSession.userId),
}))

import { addContact, listContacts } from './contacts'
import { createEmergencyEvent, listEmergencyEvents } from './events'

describe('local demo data ownership', () => {
  beforeEach(() => {
    localStorage.clear()
    mockSession.userId = 'user-a'
  })

  it('keeps contacts and events separated when the browser switches users', async () => {
    await addContact({ name: 'A contact', phone: '', email: '', relation: '' })
    await createEmergencyEvent({ eventType: 'manual_sos', riskLevel: 'HIGH' })

    mockSession.userId = 'user-b'
    expect((await listContacts()).contacts).toEqual([])
    expect((await listEmergencyEvents()).events).toEqual([])
    await addContact({ name: 'B contact', phone: '', email: '', relation: '' })

    mockSession.userId = 'user-a'
    expect((await listContacts()).contacts.map((contact) => contact.name)).toEqual(['A contact'])
    expect((await listEmergencyEvents()).events).toHaveLength(1)

    mockSession.userId = 'user-b'
    expect((await listContacts()).contacts.map((contact) => contact.name)).toEqual(['B contact'])
    expect((await listEmergencyEvents()).events).toEqual([])
  })
})
