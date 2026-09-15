import { describe, it, expect, beforeEach } from 'vitest'
import { TemporalRiskEngine } from './temporalRiskEngine'
import { intentModel } from '../intent/classify'

describe('TemporalRiskEngine', () => {
  let engine: TemporalRiskEngine

  beforeEach(() => {
    engine = new TemporalRiskEngine(intentModel, {
      windowMs: 60000,
      decayHalfLifeMs: 30000,
      escalationThreshold: 6,
      repeatThresholdCount: 2,
    })
  })

  it('evaluates isolated benign event as LOW and unescalated', () => {
    const result = engine.evaluate({
      timestamp: 1000,
      transcript: 'hello how are you doing today',
      safetyMode: 'ACTIVE',
    })

    expect(result.intentResult.level).toBe('LOW')
    expect(result.currentAssessment.level).toBe('LOW')
    expect(result.escalated).toBe(false)
    expect(result.recentEventCount).toBe(1)
  })

  it('evaluates isolated suspicious event without immediate threshold breach if below threshold', () => {
    const result = engine.evaluate({
      timestamp: 1000,
      transcript: 'someone is following me',
      safetyMode: 'ACTIVE',
    })

    expect(result.intentResult.level).toBe('HIGH')
    // Emergency intent HIGH gives 2 * 3 = 6 points => HIGH
    expect(result.currentAssessment.level).toBe('HIGH')
    expect(result.escalated).toBe(true)
  })

  it('escalates on repeated suspicious events within the time window', () => {
    const t0 = 1000
    // Event 1: Moderate acoustic distress + casual phrase (threatLevel MEDIUM, intent LOW -> score 2 < 3 -> level LOW)
    const res1 = engine.evaluate({
      timestamp: t0,
      transcript: 'thanks for the pizza it was great',
      acoustic: { energy: 0.6, distressScore: 0.4 },
      safetyMode: 'INACTIVE',
    })

    expect(res1.intentResult.level).toBe('LOW')
    expect(res1.currentAssessment.repeatBumpApplied).toBe(false)

    // Event 2: 5 seconds later, another trigger (threatLevel MEDIUM, intent LOW -> base score = 2 + 1(repeat) = 3 -> level MEDIUM)
    // repeatBumpApplied bumps MEDIUM to HIGH
    const res2 = engine.evaluate({
      timestamp: t0 + 5000,
      transcript: 'thanks for the pizza it was great',
      acoustic: { energy: 0.6, distressScore: 0.4 },
      safetyMode: 'ACTIVE',
    })

    expect(res2.intentResult.level).toBe('LOW')
    expect(res2.currentAssessment.repeatBumpApplied).toBe(true)
    expect(res2.recentEventCount).toBe(2)
  })

  it('applies risk decay over time', () => {
    const t0 = 1000
    // Event 1 at t0
    const res1 = engine.evaluate({
      timestamp: t0,
      transcript: 'please help me someone is following me',
      safetyMode: 'ACTIVE',
    })

    expect(res1.aggregatedScore).toBeGreaterThanOrEqual(6)

    // Event 2 at t0 + 70s (outside the 60s window)
    const res2 = engine.evaluate({
      timestamp: t0 + 70000,
      transcript: 'thanks for the pizza it was great',
      safetyMode: 'ACTIVE',
    })

    // The old emergency event pruned from the 60s window
    expect(res2.recentEventCount).toBe(1)
    expect(res2.intentResult.level).toBe('LOW')
    expect(res2.escalated).toBe(false)
  })

  it('resets history upon disarm/explicit reset', () => {
    engine.evaluate({
      timestamp: 1000,
      transcript: 'please help me someone is following me',
      safetyMode: 'ACTIVE',
    })
    expect(engine.history.length).toBe(1)

    engine.reset()
    expect(engine.history.length).toBe(0)
  })
})
