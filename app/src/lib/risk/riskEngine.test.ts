import { describe, expect, it } from 'vitest'
import {
  assessRisk,
  RISK_WEIGHTS,
  SCORE_THRESHOLDS,
  type RiskSignals,
} from './riskEngine'

const P = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const

function signals(overrides: Partial<RiskSignals> = {}): RiskSignals {
  return {
    intentLevel: 'LOW',
    threatLevel: 'LOW',
    safetyMode: 'INACTIVE',
    journeyStatus: 'NO_JOURNEY',
    repeatedTrigger: false,
    ...overrides,
  }
}

describe('assessRisk scoring', () => {
  it('scores an all-quiet situation as LOW with zero points', () => {
    const result = assessRisk(signals())

    expect(result.level).toBe('LOW')
    expect(result.score).toBe(0)
    expect(result.gateApplied).toBe(false)
    expect(result.repeatBumpApplied).toBe(false)
  })

  it('applies the documented weights to intent and threat levels', () => {
    const result = assessRisk(signals({ intentLevel: 'MEDIUM', threatLevel: 'HIGH' }))

    expect(result.score).toBe(P.MEDIUM * RISK_WEIGHTS.intent + P.HIGH * RISK_WEIGHTS.threat)
    expect(result.level).toBe('HIGH')
  })

  it('adds one point each for ACTIVE safety mode and DEVIATED journey', () => {
    const result = assessRisk(signals({ safetyMode: 'ACTIVE', journeyStatus: 'DEVIATED' }))

    expect(result.score).toBe(RISK_WEIGHTS.safetyActive + RISK_WEIGHTS.journeyDeviated)
    expect(result.level).toBe('LOW')
    expect(result.contributions[2]).toMatchObject({ value: 'ACTIVE', points: 1 })
    expect(result.contributions[3]).toMatchObject({ value: 'DEVIATED', points: 1 })
  })

  it('respects the documented score thresholds at both boundaries', () => {
    expect(SCORE_THRESHOLDS).toEqual({ medium: 3, high: 6 })

    const justBelowMedium = assessRisk(signals({ safetyMode: 'ACTIVE', journeyStatus: 'ON_ROUTE' }))
    expect(justBelowMedium.score).toBeLessThan(SCORE_THRESHOLDS.medium)
    expect(justBelowMedium.level).toBe('LOW')

    const exactlyHigh = assessRisk(signals({ intentLevel: 'MEDIUM', threatLevel: 'HIGH' }))
    expect(exactlyHigh.score).toBe(P.MEDIUM * 3 + P.HIGH * 2)
    expect(exactlyHigh.score).toBeGreaterThanOrEqual(SCORE_THRESHOLDS.high)
    expect(exactlyHigh.level).toBe('HIGH')
  })
})

describe('safety-mode gate', () => {
  it('caps a would-be HIGH to MEDIUM when safety mode is INACTIVE without strong signals', () => {
    const result = assessRisk(
      signals({
        intentLevel: 'MEDIUM',
        threatLevel: 'MEDIUM',
        journeyStatus: 'DEVIATED',
        repeatedTrigger: true,
      }),
    )

    expect(result.score).toBe(P.MEDIUM * RISK_WEIGHTS.intent + P.MEDIUM * RISK_WEIGHTS.threat + 2)
    expect(result.score).toBeGreaterThanOrEqual(SCORE_THRESHOLDS.high)
    expect(result.gateApplied).toBe(true)
    expect(result.level).toBe('MEDIUM')
    expect(result.reason).toContain('capped HIGH to MEDIUM')
  })

  it('allows HIGH while INACTIVE when intent alone is HIGH', () => {
    const result = assessRisk(signals({ intentLevel: 'HIGH' }))

    expect(result.level).toBe('HIGH')
    expect(result.gateApplied).toBe(false)
  })

  it('treats intent/threat HIGH only as a necessary condition, never a booster', () => {
    const threatOnly = assessRisk(signals({ threatLevel: 'HIGH' }))

    expect(threatOnly.score).toBe(P.HIGH * RISK_WEIGHTS.threat)
    expect(threatOnly.level).toBe('MEDIUM')
    expect(threatOnly.gateApplied).toBe(false)
  })
})

describe('repeated-trigger bump', () => {
  it('raises LOW one level on repetition', () => {
    const result = assessRisk(signals({ repeatedTrigger: true }))

    expect(result.repeatBumpApplied).toBe(true)
    expect(result.level).toBe('MEDIUM')
  })

  it('raises MEDIUM to HIGH on repetition when safety mode is ACTIVE', () => {
    const result = assessRisk(
      signals({ intentLevel: 'MEDIUM', repeatedTrigger: true, safetyMode: 'ACTIVE' }),
    )

    expect(result.score).toBe(P.MEDIUM * RISK_WEIGHTS.intent + 2)
    expect(result.repeatBumpApplied).toBe(true)
    expect(result.gateApplied).toBe(false)
    expect(result.level).toBe('HIGH')
  })

  it('never jumps LOW straight to HIGH from repetition alone', () => {
    const inactive = assessRisk(signals({ repeatedTrigger: true }))
    const active = assessRisk(signals({ repeatedTrigger: true, safetyMode: 'ACTIVE' }))

    expect(inactive.repeatBumpApplied).toBe(true)
    expect(active.repeatBumpApplied).toBe(true)
    expect(inactive.level).toBe('MEDIUM')
    expect(active.level).toBe('MEDIUM')
  })

  it('does not double-bump an already-HIGH result', () => {
    const result = assessRisk(signals({ intentLevel: 'HIGH', repeatedTrigger: true }))

    expect(result.repeatBumpApplied).toBe(false)
    expect(result.level).toBe('HIGH')
  })

  it('gate wins over bump so INACTIVE never ends HIGH without strong signals', () => {
    const result = assessRisk(
      signals({ intentLevel: 'MEDIUM', repeatedTrigger: true }),
    )

    expect(result.repeatBumpApplied).toBe(true)
    expect(result.gateApplied).toBe(true)
    expect(result.level).toBe('MEDIUM')
  })
})

describe('explainability output', () => {
  it('lists every signal with its value and points plus the arithmetic', () => {
    const result = assessRisk(
      signals({
        intentLevel: 'HIGH',
        threatLevel: 'MEDIUM',
        safetyMode: 'ACTIVE',
        journeyStatus: 'DEVIATED',
        repeatedTrigger: true,
      }),
    )

    expect(result.contributions.map((c) => c.signal)).toEqual([
      'Emergency intent',
      'Threat context',
      'Safety mode',
      'Journey',
      'Repeated trigger',
    ])
    expect(result.reason).toContain('Emergency intent HIGH(6)')
    expect(result.reason).toContain('Threat context MEDIUM(2)')
    expect(result.reason).toContain('Safety mode ACTIVE(1)')
    expect(result.reason).toContain(`= ${result.score}`)
    expect(result.reason.endsWith(`-> ${result.level}`)).toBe(true)
  })
})
