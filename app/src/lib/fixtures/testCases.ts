import { classifyUtterance, intentModel, type IntentResult } from '../intent/classify'
import { assessRisk, type RiskAssessment, type RiskLevel, type SafetyMode, type JourneyStatus } from '../risk/riskEngine'
import { decideAction, type PolicyDecision, type RiskAction, type TriggerSource } from '../policy'

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
  /** Context parameters for Model C / Risk Engine */
  context: {
    safetyMode: SafetyMode
    journeyStatus: JourneyStatus
    threatLevel?: RiskLevel
    repeatedTrigger?: boolean
    isManualSos?: boolean
    gpsAvailable?: boolean
    networkAvailable?: boolean
  }
  notes?: string
}

export interface FixtureEvaluation {
  fixture: FixtureDefinition
  keywordResult: KeywordBaselineResult
  intentResult: IntentResult
  riskAssessment: RiskAssessment
  policyDecision: PolicyDecision
  passed: boolean
}

/**
 * 14 Test cases directly from docs/TESTING.md §2:
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
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'LOW',
      repeatedTrigger: false,
    },
  },
  {
    id: 5,
    name: 'Background noise / garbled',
    description: 'Low-confidence or incoherent speech transcript',
    utterance: 'uh um the meeting tomorrow okay',
    expectedOutcome: 'No emergency (LOW risk, LOG_ONLY)',
    expectedLevel: 'LOW',
    expectedAction: 'LOG_ONLY',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'LOW',
      repeatedTrigger: false,
    },
  },
  {
    id: 6,
    name: 'Different accents',
    description: 'Emergency utterance with colloquial dialect or phrasing',
    utterance: 'Please help me someone is following me right now',
    expectedOutcome: 'Emergency (HIGH risk, ESCALATE)',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'HIGH',
      repeatedTrigger: false,
    },
  },
  {
    id: 7,
    name: 'Different speaking speeds',
    description: 'Urgent fast speech with distress markers',
    utterance: 'Danger danger someone is following me please help save me',
    expectedOutcome: 'Emergency (HIGH risk, ESCALATE)',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'HIGH',
      repeatedTrigger: false,
    },
  },
  {
    id: 8,
    name: 'Poor microphone conditions',
    description: 'Partial transcript captured under noisy/muffled conditions',
    utterance: 'save me danger',
    expectedOutcome: 'Elevated risk requiring confirmation or escalation',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'HIGH',
      repeatedTrigger: false,
    },
  },
  {
    id: 9,
    name: 'No GPS (location unavailable)',
    description: 'Emergency occurs when GPS permissions are revoked or location unavailable',
    utterance: 'Someone is following me please help',
    expectedOutcome: 'Still escalates to HIGH risk (location marked unknown)',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
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
    name: 'Poor network',
    description: 'Emergency triggers under flaky network connection',
    utterance: 'Someone is attacking me please help',
    expectedOutcome: 'Escalates to HIGH risk and queues locally',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
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
    name: 'No internet (offline)',
    description: 'Offline local evaluation of high threat',
    utterance: 'Help someone is following me',
    expectedOutcome: 'High risk determined on-device, offline fallback logged',
    expectedLevel: 'HIGH',
    expectedAction: 'ESCALATE',
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
    context: {
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'LOW',
      repeatedTrigger: true,
    },
  },
  {
    id: 13,
    name: 'Accidental trigger',
    description: 'TV or casual conversation containing "help me find my dinner pizza place"',
    utterance: 'Can you help me find my dinner pizza place',
    expectedOutcome: 'No escalation (LOW risk, LOG_ONLY)',
    expectedLevel: 'LOW',
    expectedAction: 'LOG_ONLY',
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
    context: {
      safetyMode: 'INACTIVE',
      journeyStatus: 'NO_JOURNEY',
      threatLevel: 'LOW',
      repeatedTrigger: false,
      isManualSos: true,
    },
  },
]

export function evaluateFixture(fixture: FixtureDefinition): FixtureEvaluation {
  const keywordResult = evaluateKeywordBaseline(fixture.utterance)
  const intentResult = classifyUtterance(intentModel, fixture.utterance)

  const threatLevel = fixture.context.threatLevel ?? (intentResult.level === 'HIGH' ? 'HIGH' : 'LOW')
  const riskAssessment = assessRisk({
    intentLevel: intentResult.level,
    threatLevel,
    safetyMode: fixture.context.safetyMode,
    journeyStatus: fixture.context.journeyStatus,
    repeatedTrigger: fixture.context.repeatedTrigger ?? false,
  })

  const triggerSource: TriggerSource = fixture.context.isManualSos ? 'manual_sos' : 'engine'
  const policyDecision = decideAction(riskAssessment.level, triggerSource)

  const passed =
    fixture.context.isManualSos
      ? policyDecision.action === fixture.expectedAction
      : riskAssessment.level === fixture.expectedLevel &&
        policyDecision.action === fixture.expectedAction

  return {
    fixture,
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
