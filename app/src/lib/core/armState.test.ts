import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ArmStateMachine, createPinAuthenticator } from './armState'

describe('ArmStateMachine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in DISARMED state by default', () => {
    const sm = new ArmStateMachine()
    expect(sm.state).toBe('DISARMED')
    expect(sm.isArmed).toBe(false)
    expect(sm.expiresAt).toBeNull()
  })

  it('transitions to ARMED and notifies listeners', () => {
    const sm = new ArmStateMachine()
    const listener = vi.fn()
    sm.subscribe(listener)

    const res = sm.arm()
    expect(res.success).toBe(true)
    expect(res.previousState).toBe('DISARMED')
    expect(res.currentState).toBe('ARMED')
    expect(sm.state).toBe('ARMED')
    expect(sm.isArmed).toBe(true)
    expect(listener).toHaveBeenCalledWith('ARMED', 'DISARMED')
  })

  it('transitions to GUARDIAN_WATCH', () => {
    const sm = new ArmStateMachine()
    const res = sm.armGuardianWatch()
    expect(res.success).toBe(true)
    expect(sm.state).toBe('GUARDIAN_WATCH')
    expect(sm.isArmed).toBe(true)
  })

  it('supports TIMED_ARM and automatically disarms after timeout', () => {
    const sm = new ArmStateMachine()
    const listener = vi.fn()
    sm.subscribe(listener)

    const res = sm.armTimed({ durationMs: 5000 })
    expect(res.success).toBe(true)
    expect(sm.state).toBe('TIMED_ARM')
    expect(sm.isArmed).toBe(true)
    expect(sm.expiresAt).toBeGreaterThan(Date.now())

    vi.advanceTimersByTime(5000)

    expect(sm.state).toBe('DISARMED')
    expect(sm.isArmed).toBe(false)
    expect(sm.expiresAt).toBeNull()
    expect(listener).toHaveBeenCalledWith('DISARMED', 'TIMED_ARM')
  })

  it('rejects invalid timed arm durations', () => {
    const sm = new ArmStateMachine()
    const res = sm.armTimed({ durationMs: 0 })
    expect(res.success).toBe(false)
    expect(res.error).toBeDefined()
    expect(sm.state).toBe('DISARMED')
  })

  it('disarms without PIN if no authenticator is configured', async () => {
    const sm = new ArmStateMachine('ARMED')
    const res = await sm.disarm()
    expect(res.success).toBe(true)
    expect(sm.state).toBe('DISARMED')
  })

  it('requires PIN and validates when authenticator is set', async () => {
    const auth = createPinAuthenticator('1234')
    const sm = new ArmStateMachine('ARMED', auth)

    const noPin = await sm.disarm()
    expect(noPin.success).toBe(false)
    expect(noPin.error).toMatch(/PIN required/)
    expect(sm.state).toBe('ARMED')

    const wrongPin = await sm.disarm('9999')
    expect(wrongPin.success).toBe(false)
    expect(wrongPin.error).toMatch(/Invalid disarm PIN/)
    expect(sm.state).toBe('ARMED')

    const rightPin = await sm.disarm('1234')
    expect(rightPin.success).toBe(true)
    expect(sm.state).toBe('DISARMED')
  })
})
