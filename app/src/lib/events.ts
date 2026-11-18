import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentUserId } from './session'
import { readOwnedRows, writeOwnedRows } from './storage/ownerScopedLocalData'
import { localIncidentStore, type LocalIncidentRecord } from './storage/incidentStore'
import type { GeoPoint } from './geolocation'
import type { RiskLevel, SafetyMode, JourneyStatus } from './risk/riskEngine'

export type EmergencyEventType = 'manual_sos' | 'voice_detected'

export interface EmergencyEvent {
  id: string
  user_id: string
  event_type: EmergencyEventType
  risk_level: 'low' | 'medium' | 'high'
  intent_level: string | null
  threat_level: string | null
  safety_mode: string | null
  journey_status: string | null
  transcript: string | null
  transcript_summary: string | null
  trigger_source: string | null
  location_lat: number | null
  location_lng: number | null
  location_accuracy: number | null
  asr_confidence: number | null
  decision_reason: string | null
  resolved_at: string | null
  created_at: string
}

export interface EmergencyEventInput {
  /** Stable UUID used to make local incident retries idempotent in Supabase. */
  eventId?: string
  eventType: EmergencyEventType
  riskLevel: RiskLevel
  intentLevel?: string | null
  threatLevel?: string | null
  safetyMode?: SafetyMode | null
  journeyStatus?: JourneyStatus | null
  transcript?: string | null
  transcriptSummary?: string | null
  triggerSource?: string | null
  location?: GeoPoint | null
  asrConfidence?: number | null
  decisionReason?: string | null
}

const COLUMNS =
  'id, user_id, event_type, risk_level, intent_level, threat_level, safety_mode, journey_status, transcript, transcript_summary, trigger_source, location_lat, location_lng, location_accuracy, asr_confidence, decision_reason, resolved_at, created_at'

const LOCAL_EVENTS_KEY = 'hershield_events'

function localLoadEvents(userId: string): EmergencyEvent[] {
  return readOwnedRows<EmergencyEvent>(LOCAL_EVENTS_KEY, userId)
}

function localSaveEvents(userId: string, events: EmergencyEvent[]): void {
  writeOwnedRows(LOCAL_EVENTS_KEY, userId, events)
}

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  const message = (err as { message?: string } | null)?.message
  return message ?? fallback
}

function toRow(input: EmergencyEventInput, userId: string) {
  return {
    user_id: userId,
    event_type: input.eventType,
    risk_level: input.riskLevel.toLowerCase(),
    intent_level: input.intentLevel ?? null,
    threat_level: input.threatLevel ?? null,
    safety_mode: input.safetyMode ?? null,
    journey_status: input.journeyStatus ?? null,
    transcript: input.transcript ?? null,
    transcript_summary: input.transcriptSummary ?? null,
    trigger_source: input.triggerSource ?? null,
    location_lat: input.location?.lat ?? null,
    location_lng: input.location?.lng ?? null,
    location_accuracy: input.location?.accuracy ?? null,
    asr_confidence: input.asrConfidence ?? null,
    decision_reason: input.decisionReason ?? null,
  }
}

function toEvent(row: Record<string, unknown>): EmergencyEvent {
  return row as unknown as EmergencyEvent
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

function mergeIncidentEvents(
  cloudEvents: EmergencyEvent[],
  localIncidents: LocalIncidentRecord[],
): EmergencyEvent[] {
  const merged = new Map(cloudEvents.map((event) => [event.id, event]))
  for (const incident of localIncidents) {
    const event = incidentToEvent(incident)
    if (!merged.has(event.id)) merged.set(event.id, event)
  }
  return Array.from(merged.values()).sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  )
}

export async function createEmergencyEvent(
  input: EmergencyEventInput,
  expectedUserId?: string,
): Promise<{ event: EmergencyEvent | null; error: string | null }> {
  const invalid = validateEventInput(input)
  if (invalid) {
    return { event: null, error: invalid }
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    return { event: null, error: 'Not signed in' }
  }
  if (expectedUserId && userId !== expectedUserId) {
    return { event: null, error: 'Signed-in user changed before incident sync' }
  }

  if (!isSupabaseConfigured) {
    const newEvent: EmergencyEvent = {
      id: input.eventId ?? `local-evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      user_id: userId,
      event_type: input.eventType,
      risk_level: input.riskLevel.toLowerCase() as EmergencyEvent['risk_level'],
      intent_level: input.intentLevel ?? null,
      threat_level: input.threatLevel ?? null,
      safety_mode: input.safetyMode ?? null,
      journey_status: input.journeyStatus ?? null,
      transcript: input.transcript ?? null,
      transcript_summary: input.transcriptSummary ?? null,
      trigger_source: input.triggerSource ?? null,
      location_lat: input.location?.lat ?? null,
      location_lng: input.location?.lng ?? null,
      location_accuracy: input.location?.accuracy ?? null,
      asr_confidence: input.asrConfidence ?? null,
      decision_reason: input.decisionReason ?? null,
      resolved_at: null,
      created_at: new Date().toISOString(),
    }
    const all = localLoadEvents(userId)
    localSaveEvents(userId, [newEvent, ...all.filter((event) => event.id !== newEvent.id)])
    return { event: newEvent, error: null }
  }

  try {
    const baseQuery = supabase.from('emergency_events')
    const writeQuery = input.eventId
      ? baseQuery.upsert({ ...toRow(input, userId), id: input.eventId }, { onConflict: 'id' })
      : baseQuery.insert(toRow(input, userId))
    const { data, error } = await writeQuery.select(COLUMNS).single()
    if (error) {
      return { event: null, error: error.message }
    }
    return { event: toEvent(data as Record<string, unknown>), error: null }
  } catch (err) {
    return { event: null, error: toErrorMessage(err, 'Could not create emergency event') }
  }
}

export function validateEventInput(input: EmergencyEventInput): string | null {
  if (input.eventType !== 'manual_sos' && input.eventType !== 'voice_detected') {
    return 'Event type must be manual_sos or voice_detected'
  }
  if (!['LOW', 'MEDIUM', 'HIGH'].includes(input.riskLevel)) {
    return 'Risk level must be LOW, MEDIUM or HIGH'
  }
  return null
}

export async function listEmergencyEvents(): Promise<{
  events: EmergencyEvent[]
  error: string | null
}> {
  const userId = await getCurrentUserId()
  if (!userId) return { events: [], error: 'Not signed in' }

  const localIncidents = await localIncidentStore.listAll(userId)
  if (!isSupabaseConfigured) {
    return {
      events: mergeIncidentEvents(localLoadEvents(userId), localIncidents),
      error: null,
    }
  }
  try {
    const { data, error } = await supabase
      .from('emergency_events')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) {
      return { events: mergeIncidentEvents([], localIncidents), error: error.message }
    }
    return {
      events: mergeIncidentEvents(((data ?? []) as Record<string, unknown>[]).map(toEvent), localIncidents),
      error: null,
    }
  } catch (err) {
    return {
      events: mergeIncidentEvents([], localIncidents),
      error: toErrorMessage(err, 'Could not load emergency events'),
    }
  }
}
