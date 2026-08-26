import { supabase } from './supabase'
import { getCurrentUserId } from './session'
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

export async function createEmergencyEvent(
  input: EmergencyEventInput,
): Promise<{ event: EmergencyEvent | null; error: string | null }> {
  const invalid = validateEventInput(input)
  if (invalid) {
    return { event: null, error: invalid }
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    return { event: null, error: 'Not signed in' }
  }

  try {
    const { data, error } = await supabase
      .from('emergency_events')
      .insert(toRow(input, userId))
      .select(COLUMNS)
      .single()
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
  try {
    const { data, error } = await supabase
      .from('emergency_events')
      .select(COLUMNS)
      .order('created_at', { ascending: false })
    if (error) {
      return { events: [], error: error.message }
    }
    return { events: ((data ?? []) as Record<string, unknown>[]).map(toEvent), error: null }
  } catch (err) {
    return { events: [], error: toErrorMessage(err, 'Could not load emergency events') }
  }
}
