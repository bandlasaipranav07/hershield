import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}))

vi.mock('./contacts', () => ({
  listContacts: vi.fn(),
}))

import { supabase } from './supabase'
import { listContacts } from './contacts'
import { buildNotificationPayload, simulateNotifications } from './notify'
import type { EmergencyEvent } from './events'
import type { Contact } from './contacts'

const mockedFrom = vi.mocked(supabase.from)
const mockedGetSession = vi.mocked(supabase.auth.getSession)
const mockedListContacts = vi.mocked(listContacts)

function makeEvent(overrides: Partial<EmergencyEvent> = {}): EmergencyEvent {
  return {
    id: 'event-1',
    user_id: 'user-1',
    event_type: 'voice_detected',
    risk_level: 'high',
    intent_level: 'HIGH',
    threat_level: 'MEDIUM',
    safety_mode: 'ACTIVE',
    journey_status: 'NO_JOURNEY',
    transcript: null,
    transcript_summary: 'distress phrase detected',
    trigger_source: 'keyword "help"',
    location_lat: 17.385,
    location_lng: 78.4867,
    location_accuracy: 12.5,
    asr_confidence: 0.87,
    decision_reason: 'intent HIGH(6) -> HIGH',
    resolved_at: null,
    created_at: '2026-08-26T10:00:00.000Z',
    ...overrides,
  }
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'contact-1',
    user_id: 'user-1',
    name: 'Amma',
    phone: '+91 98765 43210',
    email: 'amma@example.com',
    relation: 'mother',
    created_at: '2026-08-20T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildNotificationPayload', () => {
  it('marks the payload simulated and shows exactly what would be sent', () => {
    const payload = buildNotificationPayload(makeEvent(), makeContact()) as Record<
      string,
      Record<string, unknown>
    >

    expect(payload.simulated).toBe(true)
    expect(payload.channel_note).toMatch(/no real message/i)
    expect(payload.to).toEqual({
      name: 'Amma',
      phone: '+91 98765 43210',
      email: 'amma@example.com',
    })
    expect((payload.event as Record<string, unknown>).risk_level).toBe('high')
    expect((payload.event as Record<string, unknown>).transcript_summary).toBe(
      'distress phrase detected',
    )
    expect((payload.event as Record<string, unknown>).location).toEqual({
      lat: 17.385,
      lng: 78.4867,
    })
  })

  it('omits location when the event has none', () => {
    const payload = buildNotificationPayload(
      makeEvent({ location_lat: null, location_lng: null }),
      makeContact(),
    ) as Record<string, Record<string, unknown>>

    expect((payload.event as Record<string, unknown>).location).toBeNull()
  })
})

describe('simulateNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetSession.mockResolvedValue({ data: { session: null }, error: null } as never)
    mockedListContacts.mockResolvedValue({ contacts: [], error: null })
  })

  interface ChainResult {
    data: unknown
    error: { message: string } | null
  }

  interface QueryChain {
    select: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: ChainResult) => unknown) => unknown
  }

  function makeChain(result: Partial<ChainResult>): QueryChain {
    const resolved = { data: result.data ?? null, error: result.error ?? null }
    const chain = {} as QueryChain
    for (
      const method of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single'] as const
    ) {
      chain[method] = vi.fn(() => chain)
    }
    chain.then = (onFulfilled) => onFulfilled(resolved)
    return chain
  }

  it('fails fast when not signed in', async () => {
    const result = await simulateNotifications(makeEvent())

    expect(result).toEqual({ notified: 0, error: 'Not signed in' })
    expect(mockedListContacts).not.toHaveBeenCalled()
  })

  it('propagates contact-loading errors', async () => {
    mockedGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    } as never)
    mockedListContacts.mockResolvedValue({ contacts: [], error: 'permission denied' })

    const result = await simulateNotifications(makeEvent())

    expect(result).toEqual({ notified: 0, error: 'permission denied' })
  })

  it('reports zero notifications without error when there are no contacts', async () => {
    mockedGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    } as never)

    const result = await simulateNotifications(makeEvent())

    expect(result).toEqual({ notified: 0, error: null })
    expect(mockedFrom).not.toHaveBeenCalled()
  })

  it('inserts one SIMULATED row per contact and reports the count', async () => {
    mockedGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    } as never)
    mockedListContacts.mockResolvedValue({
      contacts: [makeContact(), makeContact({ id: 'contact-2', name: 'Dad', relation: 'father' })],
      error: null,
    })
    const chain = makeChain({ data: null, error: null })
    mockedFrom.mockReturnValue(chain as never)

    const result = await simulateNotifications(makeEvent())

    expect(mockedFrom).toHaveBeenCalledWith('notification_log')
    const rows = chain.insert.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.status).toBe('SIMULATED')
      expect(row.channel).toBe('simulated_email')
      expect(row.user_id).toBe('user-1')
      expect(row.event_id).toBe('event-1')
    }
    expect(rows.map((r) => r.contact_id)).toEqual(['contact-1', 'contact-2'])
    expect(result).toEqual({ notified: 2, error: null })
  })

  it('maps database and transport errors to messages', async () => {
    mockedGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    } as never)
    mockedListContacts.mockResolvedValue({ contacts: [makeContact()], error: null })

    mockedFrom.mockReturnValue(makeChain({ error: { message: 'new row violates RLS' } }) as never)
    const blocked = await simulateNotifications(makeEvent())
    expect(blocked).toEqual({ notified: 0, error: 'new row violates RLS' })

    mockedFrom.mockImplementation(() => {
      throw new Error('Failed to fetch')
    })
    const offline = await simulateNotifications(makeEvent())
    expect(offline).toEqual({ notified: 0, error: 'Failed to fetch' })
  })
})
