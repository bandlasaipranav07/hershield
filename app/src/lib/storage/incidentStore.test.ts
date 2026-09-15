import { describe, it, expect, beforeEach } from 'vitest'
import { LocalIncidentStore } from './incidentStore'

describe('LocalIncidentStore', () => {
  let store: LocalIncidentStore

  beforeEach(() => {
    store = new LocalIncidentStore()
  })

  it('saves incident offline and marks it PENDING', async () => {
    const record = await store.saveIncident({
      eventType: 'voice_detected',
      riskLevel: 'HIGH',
      transcript: 'help me',
      decisionReason: 'Emergency Intent HIGH',
    })

    expect(record.localId).toBeDefined()
    expect(record.syncStatus).toBe('PENDING')
    expect(record.syncRetryCount).toBe(0)

    const pending = await store.getPendingIncidents()
    expect(pending.some((p) => p.localId === record.localId)).toBe(true)
  })

  it('updates sync status properly upon cloud sync success or error', async () => {
    const record = await store.saveIncident({
      eventType: 'manual_sos',
      riskLevel: 'HIGH',
    })

    await store.updateSyncStatus(record.localId, 'SYNCED', 'supabase-uuid-123')
    const all = await store.listAll()
    const found = all.find((r) => r.localId === record.localId)
    expect(found?.syncStatus).toBe('SYNCED')
    expect(found?.cloudId).toBe('supabase-uuid-123')

    const pending = await store.getPendingIncidents()
    expect(pending.some((p) => p.localId === record.localId)).toBe(false)
  })
})
