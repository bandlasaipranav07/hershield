import type { IntentLevel } from '../intent/classify'

export type RiskLevel = IntentLevel
export type SafetyMode = 'INACTIVE' | 'ACTIVE'
export type JourneyStatus = 'NO_JOURNEY' | 'ON_ROUTE' | 'DEVIATED'

export const RISK_WEIGHTS = {
  intent: 3,
  threat: 2,
  safetyActive: 1,
  journeyDeviated: 1,
  repeatedTrigger: 1,
} as const

export const SCORE_THRESHOLDS = { medium: 3, high: 6 } as const

const LEVEL_POINTS: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 }

export interface RiskSignals {
  intentLevel: RiskLevel
  threatLevel: RiskLevel
  safetyMode: SafetyMode
  journeyStatus: JourneyStatus
  repeatedTrigger: boolean
}

export interface SignalContribution {
  signal: string
  value: string
  points: number
}

export interface RiskAssessment {
  level: RiskLevel
  score: number
  contributions: SignalContribution[]
  gateApplied: boolean
  repeatBumpApplied: boolean
  reason: string
}

function baseScore(signals: RiskSignals): number {
  return (
    LEVEL_POINTS[signals.intentLevel] * RISK_WEIGHTS.intent +
    LEVEL_POINTS[signals.threatLevel] * RISK_WEIGHTS.threat +
    (signals.safetyMode === 'ACTIVE' ? RISK_WEIGHTS.safetyActive : 0) +
    (signals.journeyStatus === 'DEVIATED' ? RISK_WEIGHTS.journeyDeviated : 0) +
    (signals.repeatedTrigger ? RISK_WEIGHTS.repeatedTrigger : 0)
  )
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= SCORE_THRESHOLDS.high) return 'HIGH'
  if (score >= SCORE_THRESHOLDS.medium) return 'MEDIUM'
  return 'LOW'
}

function bumpOneLevel(level: RiskLevel): RiskLevel {
  if (level === 'LOW') return 'MEDIUM'
  if (level === 'MEDIUM') return 'HIGH'
  return level
}

export function assessRisk(signals: RiskSignals): RiskAssessment {
  let score = baseScore(signals)
  const contributions: SignalContribution[] = [
    {
      signal: 'Emergency intent',
      value: signals.intentLevel,
      points: LEVEL_POINTS[signals.intentLevel] * RISK_WEIGHTS.intent,
    },
    {
      signal: 'Threat context',
      value: signals.threatLevel,
      points: LEVEL_POINTS[signals.threatLevel] * RISK_WEIGHTS.threat,
    },
    {
      signal: 'Safety mode',
      value: signals.safetyMode,
      points: signals.safetyMode === 'ACTIVE' ? RISK_WEIGHTS.safetyActive : 0,
    },
    {
      signal: 'Journey',
      value: signals.journeyStatus,
      points:
        signals.journeyStatus === 'DEVIATED' ? RISK_WEIGHTS.journeyDeviated : 0,
    },
    {
      signal: 'Repeated trigger',
      value: signals.repeatedTrigger ? 'REPEATED' : 'NONE',
      points: signals.repeatedTrigger ? RISK_WEIGHTS.repeatedTrigger : 0,
    },
  ]

  let repeatBumpApplied = false
  let level = scoreToLevel(score)
  if (signals.repeatedTrigger && level !== 'HIGH') {
    level = bumpOneLevel(level)
    repeatBumpApplied = true
  }

  let gateApplied = false
  if (
    signals.safetyMode === 'INACTIVE' &&
    level === 'HIGH' &&
    signals.intentLevel !== 'HIGH' &&
    signals.threatLevel !== 'HIGH'
  ) {
    level = 'MEDIUM'
    gateApplied = true
  }

  const reason =
    contributions.map((c) => `${c.signal} ${c.value}(${c.points})`).join(' + ') +
    ` = ${score}` +
    (repeatBumpApplied ? ' + repeated trigger bump (+1 level)' : '') +
    ` -> ${level}` +
    (gateApplied ? ' (safety mode INACTIVE capped HIGH to MEDIUM)' : '')

  return { level, score, contributions, gateApplied, repeatBumpApplied, reason }
}
