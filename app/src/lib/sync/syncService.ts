import { createEmergencyEvent } from '../events'
import { localIncidentStore } from '../storage/incidentStore'

export interface SyncResult {
  syncedCount: number
  failedCount: number
  errors: string[]
}

export class CloudSyncService {
  private _isSyncing = false

  public async syncPendingIncidents(): Promise<SyncResult> {
    if (this._isSyncing) {
      return { syncedCount: 0, failedCount: 0, errors: ['Sync already in progress'] }
    }

    this._isSyncing = true
    const result: SyncResult = { syncedCount: 0, failedCount: 0, errors: [] }

    try {
      const pending = await localIncidentStore.getPendingIncidents()

      for (const incident of pending) {
        // Attempt pushing to Supabase emergency_events table
        const res = await createEmergencyEvent({
          eventType: incident.eventType,
          riskLevel: incident.riskLevel,
          intentLevel: incident.intentLevel,
          threatLevel: incident.threatLevel,
          safetyMode: incident.safetyMode,
          journeyStatus: incident.journeyStatus,
          transcript: incident.transcript,
          transcriptSummary: incident.transcriptSummary,
          triggerSource: incident.triggerSource ?? incident.localId,
          location: incident.location,
          asrConfidence: incident.asrConfidence,
          decisionReason: incident.decisionReason,
        })

        if (res.error || !res.event) {
          result.failedCount++
          result.errors.push(res.error ?? 'Unknown cloud error')
          await localIncidentStore.updateSyncStatus(
            incident.localId,
            'FAILED',
            null,
            res.error ?? 'Cloud sync failed',
          )
        } else {
          result.syncedCount++
          await localIncidentStore.updateSyncStatus(incident.localId, 'SYNCED', res.event.id)
        }
      }
    } finally {
      this._isSyncing = false
    }

    return result
  }
}

export const cloudSyncService = new CloudSyncService()
