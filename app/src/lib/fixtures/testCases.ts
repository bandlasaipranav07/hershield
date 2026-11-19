import { classifyUtterance, intentModel, type IntentResult } from '../intent/classify'
import { assessRisk, type RiskAssessment, type RiskLevel, type SafetyMode, type JourneyStatus } from '../risk/riskEngine'
import { decideAction, type PolicyDecision, type RiskAction, type TriggerSource } from '../policy'
import type { FixtureLabel, FixtureModelResult, ModelId } from './evaluationMetrics'

/**
 * Trigger keywords mirroring standard keyword-only baseline SOS systems (Model A).
 * Per EXPERIMENT_PLAN.md: "help", "emergency", "attack", "threaten", "sos", "danger", "save".
 */
export const BASELINE_KEYWORDS = [
  'help',
  'emergency',
  'attack',
  'attacked',
  'threaten',
  'threatened',
  'threat',
  'sos',
  'danger',
  'save',
  'police',
  'ambulance',
  'hurt',
  'bleeding',
  'trapped',
  'scream',
] as const

export interface KeywordBaselineResult {
  triggered: boolean
  matchedKeyword: string | null
  level: RiskLevel
}

export function evaluateKeywordBaseline(text: string): KeywordBaselineResult {
  const normalized = text.toLowerCase()

  for (const keyword of BASELINE_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i')
    if (regex.test(normalized)) {
      return {
        triggered: true,
        matchedKeyword: keyword,
        level: 'HIGH',
      }
    }
  }
  return {
    triggered: false,
    matchedKeyword: null,
    level: 'LOW',
  }
}

export interface FixtureDefinition {
  id: number
  name: string
  description: string
  utterance: string
  expectedOutcome: string
  expectedLevel: RiskLevel
  expectedAction: RiskAction
  label: FixtureLabel
  /** Context parameters for Model C / Risk Engine */
  context: {
    safetyMode: SafetyMode
    journeyStatus: JourneyStatus
    threatLevel?: RiskLevel
    repeatedTrigger?: boolean
    isManualSos?: boolean
    gpsAvailable?: boolean
    networkAvailable?: boolean
    /** Synthetic fixture metadata only; no microphone recording is involved. */
    acousticDistressCue?: number
  }
  notes?: string
}

export interface FixtureEvaluation {
  label: FixtureLabel
  fixture: FixtureDefinition
  models: Record<ModelId, { level: RiskLevel }>
  keywordResult: KeywordBaselineResult
  intentResult: IntentResult
  riskAssessment: RiskAssessment
  policyDecision: PolicyDecision
  passed: boolean
}

/**
 * 14 synthetic text fixtures. Conditions that mention accent, pace, noise,
 * GPS, and network are metadata examples, not actual hardware/network tests.
 * The dataset contains binary labels only where the fixture is unambiguous.
 *
 * Original conditions from docs/TESTING.md §2:
 * 1. Normal speech -> not emergency
 * 2. Emergency speech -> emergency (HIGH)
 * 3. Ambiguous speech -> decided per policy (MEDIUM/confirmation)
 * 4. False emergency phrases (trigger word, benign intent) -> no escalation
 * 5. Background noise -> no emergency / LOW risk
 * 6. Different accents -> consistent distress recognition
 * 7. Different speaking speeds -> consistent distress recognition
 * 8. Poor microphone conditions -> degrade gracefully
 * 9. No GPS -> emergency still escalates with location unknown flag
 * 10. Poor network -> emergency still queues / escalates
 * 11. No internet -> offline handling / documented degradation
 * 12. Repeated trigger -> risk inflation rule / cooldown
 * 13. Accidental trigger -> TV/radio speech with help -> LOW/no escalation
 * 14. Manual SOS -> must always escalate regardless of context
 */
export const FIXTURE_DEFINITIONS: FixtureDefinition[] = [
  {
    id: 1,
    name: 'Normal speech',
    description: 'Casual conversational sentence without trigger words',
    utterance: 'The weather is nice today, let us get lunch.',
    expectedOutcome: 'No emergency (LOW risk, LOG_ONLY)',
    expectedLevel: 'LOW',
    expectedAction: 'LOG_ONLY',
    label: 'NOT_EMERGENCY',
    context: {
      safetyMode: 'INACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'LOW',
      repeatedTrigger: false,
    },
  },
  {
    id: 2,
    name: 'Emergency speech',
    description: 'Direct active threat phrasing',
    utterance: 'Someone is attacking me, please help!',
    expectedOutcome: 'Emergency (HIGH risk, ESCALATE)',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    label: 'EMERGENCY',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'HIGH',
      repeatedTrigger: false,
    },
  },
  {
    id: 3,
    name: 'Ambiguous speech',
    description: 'Isolated distress phrasing without full context',
    utterance: 'I am scared now',
    expectedOutcome: 'Confirmation flow (MEDIUM risk, CONFIRMATION_REQUIRED)',
    expectedLevel: 'MEDIUM',
    expectedAction: 'CONFIRMATION_REQUIRED',
    label: 'AMBIGUOUS',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'LOW',
      repeatedTrigger: false,
    },
  },
  {
    id: 4,
    name: 'False emergency phrases',
    description: 'Contains trigger keyword "help" but intent is completely benign',
    utterance: 'Can you help me with my homework tomorrow?',
    expectedOutcome: 'No escalation (Intent classifier flags benign, LOW risk)',
    expectedLevel: 'LOW',
    expectedAction: 'LOG_ONLY',
    label: 'NOT_EMERGENCY',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'LOW',
      repeatedTrigger: false,
    },
  },
  {
    id: 5,
    name: 'Garbled transcript example (text only)',
    description: 'A short garbled-looking text fixture; no background audio is tested',
    utterance: 'uh um the meeting tomorrow okay',
    expectedOutcome: 'No emergency (LOW risk, LOG_ONLY)',
    expectedLevel: 'LOW',
    expectedAction: 'LOG_ONLY',
    label: 'NOT_EMERGENCY',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'LOW',
      repeatedTrigger: false,
    },
  },
  {
    id: 6,
    name: 'Emergency wording variant (text only)',
    description: 'Emergency wording is represented as text; accent recognition is not tested',
    utterance: 'Please help me someone is following me right now',
    expectedOutcome: 'Emergency (HIGH risk, ESCALATE)',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    label: 'EMERGENCY',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'HIGH',
      repeatedTrigger: false,
    },
  },
  {
    id: 7,
    name: 'Urgent wording variant (text only)',
    description: 'Urgent words are represented as text; speaking speed is not tested',
    utterance: 'Danger danger someone is following me please help save me',
    expectedOutcome: 'Emergency (HIGH risk, ESCALATE)',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    label: 'EMERGENCY',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'HIGH',
      repeatedTrigger: false,
    },
  },
  {
    id: 8,
    name: 'Synthetic acoustic-cue fixture',
    description: 'Text plus a synthetic distress cue; no microphone or noisy recording is tested',
    utterance: 'save me danger',
    expectedOutcome: 'Elevated risk requiring confirmation or escalation',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    label: 'EMERGENCY',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'HIGH',
      repeatedTrigger: false,
      acousticDistressCue: 0.9,
    },
  },
  {
    id: 9,
    name: 'Emergency text with GPS-unavailable metadata',
    description: 'A fixture carries a GPS-unavailable flag; it does not revoke browser location permission',
    utterance: 'Someone is following me please help',
    expectedOutcome: 'Still escalates to HIGH risk (location marked unknown)',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    label: 'EMERGENCY',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'HIGH',
      repeatedTrigger: false,
      gpsAvailable: false,
    },
  },
  {
    id: 10,
    name: 'Emergency text with network-unavailable metadata',
    description: 'A fixture carries a network-unavailable flag; it does not interrupt the network',
    utterance: 'Someone is attacking me please help',
    expectedOutcome: 'Escalates to HIGH risk and queues locally',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    label: 'EMERGENCY',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'HIGH',
      repeatedTrigger: false,
      networkAvailable: false,
    },
  },
  {
    id: 11,
    name: 'Offline-labeled emergency text',
    description: 'The fixture is labeled offline; it does not disable the browser network',
    utterance: 'Help someone is following me',
    expectedOutcome: 'High risk determined on-device, offline fallback logged',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    label: 'EMERGENCY',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'HIGH',
      repeatedTrigger: false,
      networkAvailable: false,
    },
  },
  {
    id: 12,
    name: 'Repeated trigger',
    description: 'Repeated mild trigger within short rolling window inflates risk level',
    utterance: 'I am scared now',
    expectedOutcome: 'Elevated from MEDIUM to HIGH risk via repeat bump rule',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    label: 'AMBIGUOUS',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'LOW',
      repeatedTrigger: true,
    },
  },
  {
    id: 13,
    name: 'Benign trigger phrase (text only)',
    description: 'Benign wording includes "help"; this text fixture does not test TV or background speech',
    utterance: 'Can you help me find my dinner pizza place',
    expectedOutcome: 'No escalation (LOW risk, LOG_ONLY)',
    expectedLevel: 'LOW',
    expectedAction: 'LOG_ONLY',
    label: 'NOT_EMERGENCY',
    context: {
      safetyMode: 'INACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'LOW',
      repeatedTrigger: false,
    },
  },
  {
    id: 14,
    name: 'Manual SOS',
    description: 'User presses manual SOS button — overrides all model scores',
    utterance: '[Manual SOS Triggered]',
    expectedOutcome: 'Always escalates regardless of context or voice score',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    label: null,
    context: {
      safetyMode: 'INACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'LOW',
      repeatedTrigger: false,
      isManualSos: true,
    },
  },
]

export const MULTILINGUAL_FIXTURES: FixtureDefinition[] = [
  {
    id: 15,
    name: 'Telugu emergency speech',
    description: 'Direct active threat phrasing in Telugu (తెలుగు)',
    utterance: 'నన్ను కాపాడండి! ఎవరైనా సహాయం చేయండి!',
    expectedOutcome: 'Emergency (HIGH risk, ESCALATE)',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    label: 'EMERGENCY',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'HIGH',
      repeatedTrigger: false,
    },
  },
  {
    id: 16,
    name: 'Telugu resistance phrasing',
    description: 'Boundary defense and resistance in Telugu',
    utterance: 'నన్ను ముట్టుకోవద్దు! వదిలేయండి!',
    expectedOutcome: 'High risk resistance (HIGH risk, ESCALATE)',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    label: 'EMERGENCY',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'HIGH',
      repeatedTrigger: false,
    },
  },
  {
    id: 17,
    name: 'Hindi emergency speech',
    description: 'Direct active threat phrasing in Hindi (हिंदी)',
    utterance: 'बचाओ मुझे! कोई मदद करो!',
    expectedOutcome: 'Emergency (HIGH risk, ESCALATE)',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    label: 'EMERGENCY',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'HIGH',
      repeatedTrigger: false,
    },
  },
  {
    id: 18,
    name: 'Hindi resistance phrasing',
    description: 'Boundary defense and resistance in Hindi',
    utterance: 'हाथ मत लगाओ! मुझे छोड़ो!',
    expectedOutcome: 'High risk resistance (HIGH risk, ESCALATE)',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    label: 'EMERGENCY',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'HIGH',
      repeatedTrigger: false,
    },
  },
]

export function evaluateFixture(fixture: FixtureDefinition): FixtureEvaluation {
  const keywordResult = evaluateKeywordBaseline(fixture.utterance)
  const intentResult = classifyUtterance(intentModel, fixture.utterance)

  const baseThreatLevel = fixture.context.threatLevel ?? (intentResult.level === 'HIGH' ? 'HIGH' : 'LOW')
  const riskAssessment = assessRisk({
    intentLevel: intentResult.level,
    threatLevel: baseThreatLevel,
    safetyMode: fixture.context.safetyMode,
    journeyStatus: fixture.context.journeyStatus,
    repeatedTrigger: false,
  })

  // D adds only supplied fixture metadata. Acoustic values are synthetic and
  // repeated-trigger is a scenario flag; neither is measured by this evaluator.
  const acousticCue = fixture.context.acousticDistressCue ?? 0
  const acousticThreatLevel: RiskLevel = acousticCue >= 0.75 ? 'HIGH' : acousticCue >= 0.45 ? 'MEDIUM' : 'LOW'
  const threatRank: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 }
  const extraSignalsThreat = threatRank[acousticThreatLevel] > threatRank[baseThreatLevel]
    ? acousticThreatLevel
    : baseThreatLevel
  const modelDRisk = assessRisk({
    intentLevel: intentResult.level,
    threatLevel: extraSignalsThreat,
    safetyMode: fixture.context.safetyMode,
    journeyStatus: fixture.context.journeyStatus,
    repeatedTrigger: fixture.context.repeatedTrigger ?? false,
  })

  const triggerSource: TriggerSource = fixture.context.isManualSos ? 'manual_sos' : 'engine'
  const policyDecision = decideAction(modelDRisk.level, triggerSource)
  const models: FixtureEvaluation['models'] = {
    A: { level: keywordResult.level },
    B: { level: intentResult.level },
    C: { level: riskAssessment.level },
    D: { level: modelDRisk.level },
  }

  const passed =
    fixture.context.isManualSos
      ? policyDecision.action === fixture.expectedAction
      : modelDRisk.level === fixture.expectedLevel &&
        policyDecision.action === fixture.expectedAction

  return {
    label: fixture.label,
    fixture,
    models,
    keywordResult,
    intentResult,
    riskAssessment,
    policyDecision,
    passed,
  }
}

export function evaluateAllFixtures(): FixtureEvaluation[] {
  return FIXTURE_DEFINITIONS.map(evaluateFixture)
}

export function evaluateAllModels(): FixtureModelResult[] {
  return evaluateAllFixtures()
}
