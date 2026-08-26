import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}))

import { supabase } from './supabase'
import {
  createEmergencyEvent,
  listEmergencyEvents,
  validateEventInput,
  type EmergencyEventInput,
} from './events'

const mockedFrom = vi.mocked(supabase.from)
const mockedGetSession = vi.mocked(supabase.auth.getSession)

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
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single'] as const) {
    chain[method] = vi.fn(() => chain)
  }
  chain.then = (onFulfilled) => onFulfilled(resolved)
  return chain
}

const baseInput: EmergencyEventInput = {
  eventType: 'voice_detected',
  riskLevel: 'HIGH',
  intentLevel: 'HIGH',
  threatLevel: 'MEDIUM',
  safetyMode: 'ACTIVE',
  journeyStatus: 'NO_JOURNEY',
  transcript: 'please help me',
  transcriptSummary: 'distress phrase detected',
  triggerSource: 'keyword "help"',
  location: { lat: 17.385, lng: 78.4867, accuracy: 12.5 },
  asrConfidence: 0.87,
  decisionReason: 'intent HIGH(6) -> HIGH',
}

describe('validateEventInput', () => {
  it('accepts a well-formed engine event', () => {
    expect(validateEventInput(baseInput)).toBeNull()
  })

  it('rejects unknown event types and risk levels', () => {
    expect(validateEventInput({ ...baseInput, eventType: 'panic' as never })).toMatch(/event type/i)
    expect(
      validateEventInput({ ...baseInput, riskLevel: 'EXTREME' as never }),
    ).toMatch(/risk level/i)
  })
})

describe('createEmergencyEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetSession.mockResolvedValue({ data: { session: null }, error: null } as never)
  })

  it('fails validation without touching the database', async () => {
    const result = await createEmergencyEvent({ ...baseInput, riskLevel: 'NOPE' as never })

    expect(result.error).toMatch(/risk level/i)
    expect(mockedFrom).not.toHaveBeenCalled()
  })

  it('fails fast when not signed in', async () => {
    const result = await createEmergencyEvent(baseInput)

    expect(result.error).toBe('Not signed in')
    expect(mockedFrom).not.toHaveBeenCalled()
  })

  it('maps the input to schema columns with a lowercase risk level', async () => {
    mockedGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    } as never)
    const row = { id: 'event-1' }
    const chain = makeChain({ data: row, error: null })
    mockedFrom.mockReturnValue(chain as never)

    const result = await createEmergencyEvent(baseInput)

    expect(mockedFrom).toHaveBeenCalledWith('emergency_events')
    expect(chain.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      event_type: 'voice_detected',
      risk_level: 'high',
      intent_level: 'HIGH',
      threat_level: 'MEDIUM',
      safety_mode: 'ACTIVE',
      journey_status: 'NO_JOURNEY',
      transcript: 'please help me',
      transcript_summary: 'distress phrase detected',
      trigger_source: 'keyword "help"',
      location_lat: 17.385,
      location_lng: 78.4867,
      location_accuracy: 12.5,
      asr_confidence: 0.87,
      decision_reason: 'intent HIGH(6) -> HIGH',
    })
    expect(result).toEqual({ event: row, error: null })
  })

  it('maps database and transport errors to messages', async () => {
    mockedGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    } as never)

    mockedFrom.mockReturnValue(makeChain({ error: { message: 'new row violates RLS' } }) as never)
    const blocked = await createEmergencyEvent(baseInput)
    expect(blocked.event).toBeNull()
    expect(blocked.error).toBe('new row violates RLS')

    mockedFrom.mockImplementation(() => {
      throw new Error('Failed to fetch')
    })
    const offline = await createEmergencyEvent(baseInput)
    expect(offline.event).toBeNull()
    expect(offline.error).toBe('Failed to fetch')
  })
})

describe('listEmergencyEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns events newest first', async () => {
    const rows = [{ id: 'event-2' }, { id: 'event-1' }]
    const chain = makeChain({ data: rows, error: null })
    mockedFrom.mockReturnValue(chain as never)

    const result = await listEmergencyEvents()

    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result.events.map((e) => e.id)).toEqual(['event-2', 'event-1'])
    expect(result.error).toBeNull()
  })

  it('maps errors instead of throwing', async () => {
    mockedFrom.mockReturnValue(makeChain({ error: { message: 'permission denied' } }) as never)

    const result = await listEmergencyEvents()

    expect(result).toEqual({ events: [], error: 'permission denied' })
  })
})
