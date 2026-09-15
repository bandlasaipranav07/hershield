import { describe, it, expect, vi, beforeEach } from 'vitest'
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

    const all = await localIncidentStore.listAll()
    const updated = all.find((r) => r.localId === inc.localId)
    expect(updated?.syncStatus).toBe('SYNCED')
    expect(updated?.cloudId).toBe('supabase-event-777')
  })

  it('handles offline / cloud failures gracefully and marks FAILED without breaking local state', async () => {
    const inc = await localIncidentStore.saveIncident({
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

    const all = await localIncidentStore.listAll()
    const updated = all.find((r) => r.localId === inc.localId)
    expect(updated?.syncStatus).toBe('FAILED')
    expect(updated?.lastSyncError).toBe('Network connection unavailable')
  })
})
