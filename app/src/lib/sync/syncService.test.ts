import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  isDemoModeEnabled: false,
  supabase: { auth: { getSession: vi.fn() }, from: vi.fn() },
}))
vi.mock('../session', () => ({ getCurrentUserId: vi.fn().mockResolvedValue('user-1') }))

import { CloudSyncService } from './syncService'
import { localIncidentStore } from '../storage/incidentStore'
import * as eventsModule from '../events'

describe('CloudSyncService', () => {
  let syncService: CloudSyncService

  beforeEach(() => {
    syncService = new CloudSyncService()
    localIncidentStore.clearMemory()
    vi.restoreAllMocks()
  })

  it('syncs pending records and marks them SYNCED when cloud succeeds', async () => {
    const inc = await localIncidentStore.saveIncident({
      userId: 'user-1',
      eventType: 'voice_detected',
      riskLevel: 'HIGH',
      transcript: 'help me now',
    })

    vi.spyOn(eventsModule, 'createEmergencyEvent').mockResolvedValueOnce({
      event: {
        id: 'supabase-event-777',
        user_id: 'user-1',
        event_type: 'voice_detected',
        risk_level: 'high',
        intent_level: 'HIGH',
        threat_level: 'HIGH',
        safety_mode: 'ACTIVE',
        journey_status: null,
        transcript: 'help me now',
        transcript_summary: null,
        trigger_source: null,
        location_lat: null,
        location_lng: null,
        location_accuracy: null,
        asr_confidence: null,
        decision_reason: null,
        resolved_at: null,
        created_at: new Date().toISOString(),
      },
      error: null,
    })

    const res = await syncService.syncPendingIncidents()
    expect(res.syncedCount).toBe(1)
    expect(res.failedCount).toBe(0)

    const all = await localIncidentStore.listAll('user-1')
    const updated = all.find((r) => r.localId === inc.localId)
    expect(updated?.syncStatus).toBe('SYNCED')
    expect(updated?.cloudId).toBe('supabase-event-777')
  })

  it('handles offline / cloud failures gracefully and marks FAILED without breaking local state', async () => {
    const inc = await localIncidentStore.saveIncident({
      userId: 'user-1',
      eventType: 'manual_sos',
      riskLevel: 'HIGH',
    })

    vi.spyOn(eventsModule, 'createEmergencyEvent').mockResolvedValueOnce({
      event: null,
      error: 'Network connection unavailable',
    })

    const res = await syncService.syncPendingIncidents()
    expect(res.syncedCount).toBe(0)
    expect(res.failedCount).toBe(1)

    const all = await localIncidentStore.listAll('user-1')
    const updated = all.find((r) => r.localId === inc.localId)
    expect(updated?.syncStatus).toBe('FAILED')
    expect(updated?.lastSyncError).toBe('Network connection unavailable')
  })

  it('retries a failed incident with the same cloud event id', async () => {
    const inc = await localIncidentStore.saveIncident({
      userId: 'user-1',
      localId: 'stable-local-incident',
      eventType: 'manual_sos',
      riskLevel: 'HIGH',
    })
    const create = vi.spyOn(eventsModule, 'createEmergencyEvent')
      .mockResolvedValueOnce({ event: null, error: 'Network connection unavailable' })
      .mockResolvedValueOnce({
        event: { id: inc.localId, user_id: 'user-1' } as never,
        error: null,
      })

    await syncService.syncPendingIncidents()
    await syncService.syncPendingIncidents()

    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls.map(([input]) => input.eventId)).toEqual([inc.localId, inc.localId])
    expect(create.mock.calls.every(([, owner]) => owner === 'user-1')).toBe(true)
    expect((await localIncidentStore.listAll('user-1'))[0].syncStatus).toBe('SYNCED')
  })

  it('does not sync incidents owned by another user', async () => {
    await localIncidentStore.saveIncident({ userId: 'user-2', eventType: 'manual_sos', riskLevel: 'HIGH' })
    const create = vi.spyOn(eventsModule, 'createEmergencyEvent')

    const result = await syncService.syncPendingIncidents()

    expect(result.syncedCount).toBe(0)
    expect(create).not.toHaveBeenCalled()
  })
})
