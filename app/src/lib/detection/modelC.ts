/**
 * Model C – Context & Temporal Progression Analysis
 *
 * Responsibilities:
 * 1. Multi-window temporal evaluation:
 *    - Analyzes rolling history (default: 60-second window with exponential half-life decay)
 * 2. Progression Pattern Detection:
 *    - isolated_spike: Single transient loud sound or brief trigger without continuation
 *    - repeated_triggers: Multiple emergency phrases or vocal distress cues in the window
 *    - escalating_intensity: Rising acoustic energy and vocal strain across consecutive frames
 *    - sustained_threat: Continuous high distress cues lasting > 3 seconds
 *    - calm: Normal baseline activity
 * 3. Environmental Context Integration:
 *    - Safety Mode (ACTIVE vs PASSIVE)
 *    - Journey Status (IN_TRANSIT, WALKING_HOME vs NO_JOURNEY)
 *    - Time of day (night hours 10 PM - 5 AM increase baseline vigilance)
 * 4. Outputs structured evidence: ModelCOutput
 */

import type { ModelAOutput } from './modelA'
import type { ModelBOutput } from './modelB'
import type { SafetyMode, JourneyStatus } from '../risk/riskEngine'

export type TemporalPattern =
  | 'isolated_spike'
  | 'repeated_triggers'
  | 'escalating_intensity'
  | 'sustained_threat'
  | 'calm'

export type IntensityTrend = 'falling' | 'stable' | 'rising' | 'sharp_spike'

export interface ContextEventRecord {
  timestamp: number
  modelA: ModelAOutput
  modelB: ModelBOutput
  rmsEnergy: number
  isDistressCandidate: boolean
}

export interface ModelCOutput {
  model: 'C_context'
  temporal_pattern: TemporalPattern
  event_count_window: number
  intensity_trend: IntensityTrend
  sustained_duration_ms: number
  context_threat_score: number // 0 to 10 calibrated score
  confidence: number // 0 to 1 calibrated confidence
  isEscalating: boolean
  environmental_factors: {
    nighttime: boolean
    journeyActive: boolean
    safetyMode: SafetyMode
  }
}

export interface ModelCConfig {
  windowMs: number // default 60,000ms
  decayHalfLifeMs: number // default 30,000ms
  escalationScoreThreshold: number // default 7
  screamSustainThresholdMs: number // default 3,000ms
}

export const DEFAULT_MODEL_C_CONFIG: ModelCConfig = {
  windowMs: 60000,
  decayHalfLifeMs: 30000,
  escalationScoreThreshold: 7,
  screamSustainThresholdMs: 3000,
}

export class ModelCContextAnalyzer {
  private _history: ContextEventRecord[] = []
  private _config: ModelCConfig

  constructor(config: Partial<ModelCConfig> = {}) {
    this._config = { ...DEFAULT_MODEL_C_CONFIG, ...config }
  }

  public reset(): void {
    this._history = []
  }

  public get history(): readonly ContextEventRecord[] {
    return this._history
  }

  private pruneOldEvents(now: number): void {
    const cutoff = now - this._config.windowMs
    this._history = this._history.filter((ev) => ev.timestamp >= cutoff)
  }

  /**
   * Evaluates Model C context using Model A output, Model B output, and environment signals.
   */
  public evaluate(params: {
    modelA: ModelAOutput
    modelB: ModelBOutput
    safetyMode?: SafetyMode
    journeyStatus?: JourneyStatus
    timestamp?: number
  }): ModelCOutput {
    const now = params.timestamp ?? Date.now()
    this.pruneOldEvents(now)

    const safetyMode: SafetyMode = params.safetyMode ?? 'ACTIVE'
    const journeyStatus: JourneyStatus = params.journeyStatus ?? 'NO_JOURNEY'

    // Environmental factors
    const hour = new Date(now).getHours()
    const isNighttime = hour >= 22 || hour < 5
    const isJourneyActive = journeyStatus !== 'NO_JOURNEY'

    const isDistressCandidate =
      params.modelA.trigger_detected ||
      params.modelB.isGenuineDistress ||
      params.modelA.features.estimatedDistressCue >= 0.65

    // Add current event to rolling window
    this._history.push({
      timestamp: now,
      modelA: params.modelA,
      modelB: params.modelB,
      rmsEnergy: params.modelA.features.rmsEnergy,
      isDistressCandidate,
    })

    const windowCount = this._history.length
    const distressEvents = this._history.filter((ev) => ev.isDistressCandidate)

    // Calculate intensity trend across last 3 to 5 frames
    let intensityTrend: IntensityTrend = 'stable'
    if (this._history.length >= 3) {
      const recent = this._history.slice(-4)
      const first = recent[0].rmsEnergy
      const last = recent[recent.length - 1].rmsEnergy
      const diff = last - first

      if (diff > 0.35) {
        intensityTrend = 'sharp_spike'
      } else if (diff > 0.15) {
        intensityTrend = 'rising'
      } else if (diff < -0.15) {
        intensityTrend = 'falling'
      }
    }

    // Measure sustained duration of consecutive distress candidates
    let sustainedDurationMs = 0
    let streakCount = 0
    for (let i = this._history.length - 1; i >= 0; i--) {
      if (this._history[i].isDistressCandidate) {
        streakCount++
        sustainedDurationMs += 1000 // assuming 1000ms frames
      } else {
        break
      }
    }

    // Determine temporal pattern
    let temporalPattern: TemporalPattern = 'calm'

    if (streakCount >= 3 || sustainedDurationMs >= this._config.screamSustainThresholdMs) {
      temporalPattern = 'sustained_threat'
    } else if (intensityTrend === 'rising' && distressEvents.length >= 2) {
      temporalPattern = 'escalating_intensity'
    } else if (distressEvents.length >= 2) {
      temporalPattern = 'repeated_triggers'
    } else if (distressEvents.length === 1 && intensityTrend === 'sharp_spike') {
      temporalPattern = 'isolated_spike'
    } else if (distressEvents.length === 1) {
      temporalPattern = 'isolated_spike'
    }

    // Calculate context threat score (0 to 10)
    let score = 0

    // Base score from temporal pattern
    switch (temporalPattern) {
      case 'sustained_threat':
        score += 6
        break
      case 'escalating_intensity':
        score += 5
        break
      case 'repeated_triggers':
        score += 4
        break
      case 'isolated_spike':
        score += 2
        break
      case 'calm':
        score += 0
        break
    }

    // Weight from Model A keyword trigger type
    if (params.modelA.trigger_detected) {
      if (params.modelA.trigger_type === 'distress_keyword' || params.modelA.trigger_type === 'authority_alert') {
        score += 2
      } else if (params.modelA.trigger_type === 'resistance_phrase') {
        score += 2.5
      } else if (params.modelA.trigger_type === 'acoustic_scream') {
        // Acoustic scream alone gets 2 points, unless sustained
        score += streakCount >= 2 ? 3 : 1.5
      }
    }

    // Weight from Model B Intent
    if (params.modelB.isGenuineDistress) {
      if (params.modelB.severity === 'critical') score += 3
      else if (params.modelB.severity === 'high') score += 2
      else score += 1
    } else if (params.modelB.intent === 'playful' || params.modelB.intent === 'normal_conversation') {
      // Strongly suppress threat score if speech is playful or normal conversation!
      score = Math.max(0, score - 4)
    }

    // Environmental boosts
    if (isJourneyActive) score += 1
    if (isNighttime) score += 0.5
    if (safetyMode === 'ACTIVE') score += 0.5

    const contextThreatScore = Math.min(10, Math.round(score * 10) / 10)
    const isEscalating =
      temporalPattern === 'sustained_threat' ||
      temporalPattern === 'escalating_intensity' ||
      contextThreatScore >= this._config.escalationScoreThreshold

    // Calibrated confidence
    const confidence = Math.min(
      0.95,
      0.5 + Math.min(distressEvents.length, 3) * 0.12 + (isEscalating ? 0.1 : 0),
    )

    return {
      model: 'C_context',
      temporal_pattern: temporalPattern,
      event_count_window: windowCount,
      intensity_trend: intensityTrend,
      sustained_duration_ms: sustainedDurationMs,
      context_threat_score: contextThreatScore,
      confidence: Math.round(confidence * 100) / 100,
      isEscalating,
      environmental_factors: {
        nighttime: isNighttime,
        journeyActive: isJourneyActive,
        safetyMode,
      },
    }
  }
}
