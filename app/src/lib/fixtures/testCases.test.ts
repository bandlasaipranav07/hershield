import { describe, expect, it } from 'vitest'
import {
  FIXTURE_DEFINITIONS,
  evaluateAllFixtures,
  evaluateKeywordBaseline,
} from './testCases'

describe('Keyword baseline (Model A)', () => {
  it('detects primary trigger words', () => {
    expect(evaluateKeywordBaseline('Please help me now')).toEqual({
      triggered: true,
      matchedKeyword: 'help',
      level: 'HIGH',
    })
    expect(evaluateKeywordBaseline('There is danger')).toEqual({
      triggered: true,
      matchedKeyword: 'danger',
      level: 'HIGH',
    })
  })

  it('triggers on benign sentences containing trigger keywords (the core false positive problem)', () => {
    const result = evaluateKeywordBaseline('Can you help me with my homework?')
    expect(result.triggered).toBe(true)
    expect(result.matchedKeyword).toBe('help')
    expect(result.level).toBe('HIGH')
  })

  it('returns LOW when no trigger keywords exist', () => {
    const result = evaluateKeywordBaseline('The weather is nice today')
    expect(result.triggered).toBe(false)
    expect(result.matchedKeyword).toBeNull()
    expect(result.level).toBe('LOW')
  })
})

describe('14 Automated Fixtures (TESTING.md §2)', () => {
  it('defines exactly 14 test cases matching TESTING.md', () => {
    expect(FIXTURE_DEFINITIONS).toHaveLength(14)
    expect(FIXTURE_DEFINITIONS.map((f) => f.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ])
  })

  it('evaluates all 14 fixtures successfully with expected outcomes', () => {
    const results = evaluateAllFixtures()
    expect(results).toHaveLength(14)

    // Case 1: Normal speech -> not emergency
    expect(results[0].passed).toBe(true)
    expect(results[0].riskAssessment.level).toBe('LOW')
    expect(results[0].policyDecision.action).toBe('LOG_ONLY')

    // Case 2: Emergency speech -> emergency
    expect(results[1].passed).toBe(true)
    expect(results[1].riskAssessment.level).toBe('HIGH')
    expect(results[1].policyDecision.action).toBe('ESCALATE')

    // Case 3: Ambiguous speech -> confirmation required
    expect(results[2].passed).toBe(true)
    expect(results[2].riskAssessment.level).toBe('MEDIUM')
    expect(results[2].policyDecision.action).toBe('CONFIRMATION_REQUIRED')

    // Case 4: False emergency phrase ("help me with my homework") -> Model A triggers HIGH, but Model B/C logs LOW
    expect(results[3].keywordResult.level).toBe('HIGH')
    expect(results[3].intentResult.level).toBe('LOW')
    expect(results[3].riskAssessment.level).toBe('LOW')
    expect(results[3].passed).toBe(true)

    // Case 12: Repeated trigger -> bumps to HIGH
    expect(results[11].riskAssessment.repeatBumpApplied).toBe(true)
    expect(results[11].riskAssessment.level).toBe('HIGH')
    expect(results[11].passed).toBe(true)

    // Case 14: Manual SOS -> overrides all to ESCALATE
    expect(results[13].policyDecision.action).toBe('ESCALATE')
    expect(results[13].passed).toBe(true)
  })
})
