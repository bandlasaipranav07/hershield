import {
  assessRisk,
  type RiskSignals,
  type RiskAssessment,
  type RiskLevel,
  type SafetyMode,
  type JourneyStatus,
} from './riskEngine'
import { classifyUtterance, type IntentModel, type IntentResult } from '../intent/classify'

export interface AcousticSignals {
  energy: number // 0 to 1
  distressScore: number // 0 to 1 estimated distress cues
  highPitchDetected?: boolean
}

export interface TemporalEventInput {
  timestamp?: number
  transcript: string
  asrConfidence?: number | null
  acoustic?: AcousticSignals | null
  safetyMode?: SafetyMode
  journeyStatus?: JourneyStatus
}

export interface TemporalEvaluationResult {
  currentAssessment: RiskAssessment
  intentResult: IntentResult
  acousticDistressScore: number
  aggregatedScore: number
  escalated: boolean
  recentEventCount: number
  reason: string
}

export interface TemporalRiskConfig {
  windowMs: number // e.g. 60,000ms (1 minute rolling window)
  decayHalfLifeMs: number // e.g. 30,000ms
  escalationThreshold: number // score threshold e.g. 6
  acousticWeight: number // e.g. 2
  repeatThresholdCount: number // e.g. 2 triggers in window
}

export const DEFAULT_TEMPORAL_CONFIG: TemporalRiskConfig = {
  windowMs: 60000,
  decayHalfLifeMs: 30000,
  escalationThreshold: 6,
  acousticWeight: 2,
  repeatThresholdCount: 2,
}

interface StoredTemporalEvent {
  timestamp: number
  intentResult: IntentResult
  threatLevel: RiskLevel
  acoustic: AcousticSignals | null
  safetyMode: SafetyMode
  journeyStatus: JourneyStatus
}

export class TemporalRiskEngine {
  private _history: StoredTemporalEvent[] = []
  private _config: TemporalRiskConfig
  private _intentModel: IntentModel

  constructor(intentModel: IntentModel, config: Partial<TemporalRiskConfig> = {}) {
    this._intentModel = intentModel
    this._config = { ...DEFAULT_TEMPORAL_CONFIG, ...config }
  }

  public reset(): void {
    this._history = []
  }

  public get history(): readonly StoredTemporalEvent[] {
    return this._history
  }

  private pruneOldEvents(now: number): void {
    const cutoff = now - this._config.windowMs
    this._history = this._history.filter((ev) => ev.timestamp >= cutoff)
  }

  public evaluate(input: TemporalEventInput): TemporalEvaluationResult {
    const now = input.timestamp ?? Date.now()
    this.pruneOldEvents(now)

    // 1. Run standard intent classifier
    const intentResult = classifyUtterance(this._intentModel, input.transcript)

    // 2. Assess acoustic cues
    const acoustic = input.acoustic ?? null
    const acousticDistress = acoustic ? acoustic.distressScore : 0

    // Derive threat level from acoustic distress and pitch
    let threatLevel: RiskLevel = 'LOW'
    if (acousticDistress >= 0.7 || (acoustic?.energy ?? 0) >= 0.85) {
      threatLevel = 'HIGH'
    } else if (acousticDistress >= 0.4 || (acoustic?.energy ?? 0) >= 0.6) {
      threatLevel = 'MEDIUM'
    }

    const safetyMode: SafetyMode = input.safetyMode ?? 'ACTIVE'
    const journeyStatus: JourneyStatus = input.journeyStatus ?? 'NO_JOURNEY'

    // Check if repeated triggers occurred in the active window
    const suspiciousPastEvents = this._history.filter(
      (ev) => ev.intentResult.level !== 'LOW' || ev.threatLevel !== 'LOW',
    )
    const repeatedTrigger = suspiciousPastEvents.length >= (this._config.repeatThresholdCount - 1) &&
      (intentResult.level !== 'LOW' || threatLevel !== 'LOW')

    const signals: RiskSignals = {
      intentLevel: intentResult.level,
      threatLevel,
      safetyMode,
      journeyStatus,
      repeatedTrigger,
    }

    // 3. Evaluate using existing Explainable Risk Engine
    const currentAssessment = assessRisk(signals)

    // Store this event into rolling window
    this._history.push({
      timestamp: now,
      intentResult,
      threatLevel,
      acoustic,
      safetyMode,
      journeyStatus,
    })

    // 4. Calculate temporal aggregated score with decay
    let temporalSum = 0
    for (const ev of this._history) {
      const ageMs = Math.max(0, now - ev.timestamp)
      const decayFactor = Math.pow(0.5, ageMs / this._config.decayHalfLifeMs)
      
      const evScore = assessRisk({
        intentLevel: ev.intentResult.level,
        threatLevel: ev.threatLevel,
        safetyMode: ev.safetyMode,
        journeyStatus: ev.journeyStatus,
        repeatedTrigger: false,
      }).score

      temporalSum += evScore * decayFactor
    }

    // If repeated trigger bump applied or high current score
    const aggregatedScore = Math.max(currentAssessment.score, Math.round(temporalSum * 10) / 10)
    const escalated = currentAssessment.level === 'HIGH' || aggregatedScore >= this._config.escalationThreshold

    return {
      currentAssessment,
      intentResult,
      acousticDistressScore: acousticDistress,
      aggregatedScore,
      escalated,
      recentEventCount: this._history.length,
      reason: `${currentAssessment.reason} | Temporal Window: ${this._history.length} events, Aggregated Score: ${aggregatedScore}`,
    }
  }
}
