import { describe, expect, it } from 'vitest'
import { CONFIRMATION_SECONDS, decideAction } from './policy'

describe('decideAction (deterministic safety policy)', () => {
  it('escalates a manual SOS regardless of risk level', () => {
    for (const level of ['LOW', 'MEDIUM', 'HIGH'] as const) {
      const decision = decideAction(level, 'manual_sos')
      expect(decision.action).toBe('ESCALATE')
      expect(decision.countdownSeconds).toBeNull()
      expect(decision.reason).toContain('bypasses the risk engine')
    }
  })

  it('escalates engine HIGH without countdown', () => {
    const decision = decideAction('HIGH', 'engine')

    expect(decision.action).toBe('ESCALATE')
    expect(decision.countdownSeconds).toBeNull()
    expect(decision.reason).toContain('SIMULATED')
  })

  it('requires the confirmation flow for MEDIUM with a countdown', () => {
    const decision = decideAction('MEDIUM', 'engine')

    expect(decision.action).toBe('CONFIRMATION_REQUIRED')
    expect(decision.countdownSeconds).toBe(CONFIRMATION_SECONDS)
    expect(decision.countdownSeconds).toBe(10)
    expect(decision.reason.toLowerCase()).toContain("i'm safe")
  })

  it('only logs LOW risk', () => {
    const decision = decideAction('LOW', 'engine')

    expect(decision.action).toBe('LOG_ONLY')
    expect(decision.countdownSeconds).toBeNull()
  })
})
