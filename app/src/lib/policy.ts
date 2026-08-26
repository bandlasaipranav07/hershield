import { SCORE_THRESHOLDS, type RiskLevel } from './risk/riskEngine'

export const CONFIRMATION_SECONDS = 10

export type RiskAction = 'LOG_ONLY' | 'CONFIRMATION_REQUIRED' | 'ESCALATE'

export interface PolicyDecision {
  action: RiskAction
  countdownSeconds: number | null
  reason: string
}

export type TriggerSource = 'engine' | 'manual_sos'

export function decideAction(riskLevel: RiskLevel, source: TriggerSource): PolicyDecision {
  if (source === 'manual_sos') {
    return {
      action: 'ESCALATE',
      countdownSeconds: null,
      reason: 'Manual SOS bypasses the risk engine and always escalates',
    }
  }

  switch (riskLevel) {
    case 'HIGH':
      return {
        action: 'ESCALATE',
        countdownSeconds: null,
        reason: `Risk HIGH reached engine threshold (${SCORE_THRESHOLDS.high}+) — notifying contacts (SIMULATED)`,
      }
    case 'MEDIUM':
      return {
        action: 'CONFIRMATION_REQUIRED',
        countdownSeconds: CONFIRMATION_SECONDS,
        reason: `Risk MEDIUM — ${CONFIRMATION_SECONDS}s "I'm safe" confirmation before escalation`,
      }
    case 'LOW':
      return {
        action: 'LOG_ONLY',
        countdownSeconds: null,
        reason: 'Risk LOW — logged locally, no contacts notified',
      }
  }
}
