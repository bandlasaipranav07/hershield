import type { EmergencyEvent } from '../events'
import { getCurrentUserId } from '../session'
import { isSupabaseConfigured } from '../supabase'
import { simulateNotifications, type SimulationResult } from '../notify'
import { localIncidentStore, type LocalIncidentRecord } from '../storage/incidentStore'
import { cloudSyncService } from '../sync/syncService'

export type IncidentDraft = Omit<
  LocalIncidentRecord,
  'userId' | 'localId' | 'cloudId' | 'createdAt' | 'syncStatus' | 'syncRetryCount' | 'lastSyncError'
>

export interface IncidentDispatchResult {
  incident: LocalIncidentRecord | null
  simulation: SimulationResult | null
  error: string | null
}

function incidentToEvent(incident: LocalIncidentRecord): EmergencyEvent {
  return {
    id: incident.cloudId ?? incident.localId,
    user_id: incident.userId,
    event_type: incident.eventType,
    risk_level: incident.riskLevel.toLowerCase() as EmergencyEvent['risk_level'],
    intent_level: incident.intentLevel ?? null,
    threat_level: incident.threatLevel ?? null,
    safety_mode: incident.safetyMode ?? null,
    journey_status: incident.journeyStatus ?? null,
    transcript: incident.transcript ?? null,
    transcript_summary: incident.transcriptSummary ?? null,
    trigger_source: incident.triggerSource ?? null,
    location_lat: incident.location?.lat ?? null,
    location_lng: incident.location?.lng ?? null,
    location_accuracy: incident.location?.accuracy ?? null,
    asr_confidence: incident.asrConfidence ?? null,
    decision_reason: incident.decisionReason ?? null,
    resolved_at: null,
    created_at: incident.createdAt,
  }
}

/** Persist a response locally first, simulate notifications, then attempt sync. */
export async function dispatchIncident(draft: IncidentDraft): Promise<IncidentDispatchResult> {
  let userId: string | null
  try {
    userId = await getCurrentUserId()
  } catch (error) {
    return { incident: null, simulation: null, error: error instanceof Error ? error.message : 'Could not verify signed-in user' }
  }
  if (!userId) return { incident: null, simulation: null, error: 'Not signed in; incident was not saved' }

  let incident: LocalIncidentRecord
  try {
    incident = await localIncidentStore.saveIncident({ ...draft, userId })
  } catch (error) {
    return { incident: null, simulation: null, error: error instanceof Error ? error.message : 'Could not save incident locally' }
  }

  let simulation: SimulationResult
  try {
    simulation = await simulateNotifications(incidentToEvent(incident))
  } catch (error) {
    simulation = {
      notified: 0,
      error: error instanceof Error ? error.message : 'Notification simulation failed',
    }
  }

  if (isSupabaseConfigured) {
    void cloudSyncService.syncPendingIncidents().catch(() => {
      // The owner-tagged local incident remains available for a later retry.
    })
  }

  return { incident, simulation, error: null }
}
