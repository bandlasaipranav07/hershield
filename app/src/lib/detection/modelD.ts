/**
 * Model D – Combined Decision Synthesizer
 *
 * Responsibilities:
 * 1. Multi-factor fusion across Model A, Model B, and Model C.
 * 2. Final emergency classification into 4 explicit levels:
 *    - normal_activity
 *    - potential_threat
 *    - high_risk
 *    - confirmed_emergency
 * 3. Enforces Escalation Protocol Safeguards:
 *    - No single sound or loud transient spike can trigger confirmed_emergency.
 *    - Playful banter / normal conversation vetoes escalation even if trigger words match.
 *    - High risk always requires a mandatory confirmation countdown (10s) before dispatch.
 *    - Only manual SOS or multi-factor corroborated distress can transition to confirmed_emergency.
 * 4. Outputs structured explainable decision evidence.
 */

import type { ModelAOutput } from './modelA'
import type { ModelBOutput } from './modelB'
import type { ModelCOutput } from './modelC'

export type FinalClassification =
  | 'normal_activity'
  | 'potential_threat'
  | 'high_risk'
  | 'confirmed_emergency'

export interface ModelDOutput {
  model: 'D_combined'
  classification: FinalClassification
  confidence: number // 0 to 1 calibrated confidence
  requiresConfirmation: boolean
  countdownSeconds: number | null
  explanation: string
  action: 'MONITOR' | 'SUSPECT' | 'CONFIRMATION_REQUIRED' | 'DISPATCH_SOS'
  evidence: {
    modelA: ModelAOutput
    modelB: ModelBOutput
    modelC: ModelCOutput
    isManualSos?: boolean
  }
}

/**
 * Synthesizes Models A, B, and C into a final decision.
 */
export function evaluateModelD(params: {
  modelA: ModelAOutput
  modelB: ModelBOutput
  modelC: ModelCOutput
  isManualSos?: boolean
}): ModelDOutput {
  const { modelA, modelB, modelC, isManualSos } = params

  // 1. Manual SOS Rule: Instant confirmed emergency with highest priority
  if (isManualSos) {
    return {
      model: 'D_combined',
      classification: 'confirmed_emergency',
      confidence: 1.0,
      requiresConfirmation: false,
      countdownSeconds: null,
      explanation: 'Manual SOS explicitly triggered by user.',
      action: 'DISPATCH_SOS',
      evidence: { modelA, modelB, modelC, isManualSos: true },
    }
  }

  // 2. Playful / Conversational Suppression Guard:
  // If Model B detects playful banter or normal conversation, suppress to normal_activity
  if (modelB.intent === 'playful') {
    return {
      model: 'D_combined',
      classification: 'normal_activity',
      confidence: modelB.confidence,
      requiresConfirmation: false,
      countdownSeconds: null,
      explanation: 'Playful banter or laughter detected; distress trigger suppressed.',
      action: 'MONITOR',
      evidence: { modelA, modelB, modelC },
    }
  }

  if (modelB.intent === 'normal_conversation' && modelA.trigger_type !== 'acoustic_scream' && modelA.features.rmsEnergy < 0.85) {
    return {
      model: 'D_combined',
      classification: 'normal_activity',
      confidence: modelB.confidence,
      requiresConfirmation: false,
      countdownSeconds: null,
      explanation: 'Conversational context confirmed; no distress indicator.',
      action: 'MONITOR',
      evidence: { modelA, modelB, modelC },
    }
  }

  // 3. Multi-Factor Corroboration Evaluation:
  const hasKeyword = modelA.trigger_detected && modelA.trigger_type !== 'none'
  const isResistanceOrAuthority =
    modelA.trigger_type === 'resistance_phrase' || modelA.trigger_type === 'authority_alert'
  const hasDistressIntent = modelB.isGenuineDistress
  const hasAcousticScream = modelA.trigger_type === 'acoustic_scream'
  const isSustainedOrEscalating =
    modelC.temporal_pattern === 'sustained_threat' ||
    modelC.temporal_pattern === 'escalating_intensity' ||
    modelC.context_threat_score >= 7

  // Case A: High Risk (Corroborated distress, resistance phrase, panic, or sustained screaming)
  // Requires MANDATORY confirmation countdown (10s) before any SOS dispatch
  if (
    (hasKeyword && hasDistressIntent) ||
    isResistanceOrAuthority ||
    (hasAcousticScream && isSustainedOrEscalating) ||
    (hasDistressIntent && isSustainedOrEscalating) ||
    modelB.intent === 'panic'
  ) {
    const combinedConfidence = Math.min(
      0.96,
      modelA.confidence * 0.35 + modelB.confidence * 0.4 + modelC.confidence * 0.25,
    )

    let reason = 'Corroborated distress signal detected.'
    if (isResistanceOrAuthority) {
      reason = `Resistance/emergency phrase detected: "${modelA.detected_phrase}".`
    } else if (hasKeyword && hasDistressIntent) {
      reason = `Distress phrase "${modelA.detected_phrase}" validated with distress intent.`
    } else if (hasAcousticScream) {
      reason = `Sustained vocal acoustic scream detected across consecutive frames.`
    } else if (modelB.intent === 'panic') {
      reason = 'Severe distress or panic vocalization detected.'
    }

    return {
      model: 'D_combined',
      classification: 'high_risk',
      confidence: Math.round(combinedConfidence * 100) / 100,
      requiresConfirmation: true,
      countdownSeconds: 10,
      explanation: `${reason} Enforcing 10-second confirmation protocol.`,
      action: 'CONFIRMATION_REQUIRED',
      evidence: { modelA, modelB, modelC },
    }
  }

  // Case B: Potential Threat (Single ambiguous trigger, isolated spike, or vocal distress cue)
  if (
    hasKeyword ||
    hasAcousticScream ||
    modelB.intent === 'fear' ||
    modelC.temporal_pattern === 'isolated_spike' ||
    modelA.features.estimatedDistressCue >= 0.7
  ) {
    const reason = hasKeyword
      ? `Keyword "${modelA.detected_phrase}" observed without full distress corroboration.`
      : hasAcousticScream
        ? 'Isolated loud/high-pitch acoustic spike observed.'
        : 'Elevated acoustic or speech anomaly observed.'

    return {
      model: 'D_combined',
      classification: 'potential_threat',
      confidence: 0.72,
      requiresConfirmation: false,
      countdownSeconds: null,
      explanation: `${reason} Monitoring subsequent audio windows.`,
      action: 'SUSPECT',
      evidence: { modelA, modelB, modelC },
    }
  }

  // Case C: Normal Activity
  return {
    model: 'D_combined',
    classification: 'normal_activity',
    confidence: 0.90,
    requiresConfirmation: false,
    countdownSeconds: null,
    explanation: 'Ambient audio within normal parameters; no distress patterns.',
    action: 'MONITOR',
    evidence: { modelA, modelB, modelC },
  }
}
