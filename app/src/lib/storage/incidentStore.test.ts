import { describe, it, expect, beforeEach } from 'vitest'
import { LocalIncidentStore } from './incidentStore'

describe('LocalIncidentStore', () => {
  let store: LocalIncidentStore

  beforeEach(() => {
    store = new LocalIncidentStore()
  })

  it('saves incident offline and marks it PENDING', async () => {
    const record = await store.saveIncident({
      userId: 'user-1',
      eventType: 'voice_detected',
      riskLevel: 'HIGH',
      transcript: 'help me',
      decisionReason: 'Emergency Intent HIGH',
    })

    expect(record.localId).toBeDefined()
    expect(record.syncStatus).toBe('PENDING')
    expect(record.syncRetryCount).toBe(0)

    const pending = await store.getPendingIncidents('user-1')
    expect(pending.some((p) => p.localId === record.localId)).toBe(true)
  })

  it('updates sync status properly upon cloud sync success or error', async () => {
    const record = await store.saveIncident({
      userId: 'user-1',
      eventType: 'manual_sos',
      riskLevel: 'HIGH',
    })

    await store.updateSyncStatus(record.localId, 'user-1', 'SYNCED', 'supabase-uuid-123')
    const all = await store.listAll('user-1')
    const found = all.find((r) => r.localId === record.localId)
    expect(found?.syncStatus).toBe('SYNCED')
    expect(found?.cloudId).toBe('supabase-uuid-123')

    const pending = await store.getPendingIncidents('user-1')
    expect(pending.some((p) => p.localId === record.localId)).toBe(false)
  })

  it('keeps incidents and pending work isolated by owner', async () => {
    const first = await store.saveIncident({ userId: 'user-1', eventType: 'manual_sos', riskLevel: 'HIGH' })
    const second = await store.saveIncident({ userId: 'user-2', eventType: 'manual_sos', riskLevel: 'HIGH' })

    expect((await store.listAll('user-1')).map((record) => record.localId)).toEqual([first.localId])
    expect((await store.getPendingIncidents('user-2')).map((record) => record.localId)).toEqual([second.localId])
    expect(await store.listAll('unknown-user')).toEqual([])
  })

  it('does not update a record through a different owner identity', async () => {
    const record = await store.saveIncident({ userId: 'user-1', eventType: 'manual_sos', riskLevel: 'HIGH' })

    await store.updateSyncStatus(record.localId, 'user-2', 'SYNCED', 'cloud-event')

    expect((await store.listAll('user-1'))[0].syncStatus).toBe('PENDING')
  })
})
