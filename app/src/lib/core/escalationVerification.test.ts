import { describe, it, expect } from 'vitest'
import { HerShieldRuntime } from './runtime'

describe('HerShield Escalation Protocol Verification', () => {
  it('suppresses playful banter and does not escalate', async () => {
    let confirmationTriggered = false
    let threatConfirmed = false

    const runtime = new HerShieldRuntime({
      onConfirmationRequired: () => {
        confirmationTriggered = true
      },
      onThreatConfirmed: () => {
        threatConfirmed = true
      },
    })
    runtime.stateMachine.arm()

    const samples = new Float32Array(16000).fill(0.7) // energetic laughter/talking
    const res = await runtime.processAudioFrame({
      samples,
      transcript: 'Stop it, help me, you are hilarious haha',
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
    })

    expect(res.modelD.classification).toBe('normal_activity')
    expect(res.modelD.action).toBe('MONITOR')
    expect(confirmationTriggered).toBe(false)
    expect(threatConfirmed).toBe(false)
    expect(runtime.emergencyStateMachine.state).toBe('ARMED_MONITORING')

    await runtime.stateMachine.disarm()
  })

  it('suppresses casual conversational help and does not escalate', async () => {
    let confirmationTriggered = false

    const runtime = new HerShieldRuntime({
      onConfirmationRequired: () => {
        confirmationTriggered = true
      },
    })
    runtime.stateMachine.arm()

    const samples = new Float32Array(16000).fill(0.05)
    const res1 = await runtime.processAudioFrame({
      samples,
      transcript: 'Can someone help carry this bag?',
      safetyMode: 'ACTIVE',
    })
    expect(res1.modelD.classification).toBe('normal_activity')

    const res2 = await runtime.processAudioFrame({
      samples,
      transcript: 'Thanks for the help',
      safetyMode: 'ACTIVE',
    })
    expect(res2.modelD.classification).toBe('normal_activity')
    expect(confirmationTriggered).toBe(false)

    await runtime.stateMachine.disarm()
  })

  it('triggers 10s confirmation on genuine distress and enforces cancellation protocol', async () => {
    let confirmationTriggered = false
    let cancelled = false

    const runtime = new HerShieldRuntime({
      onConfirmationRequired: () => {
        confirmationTriggered = true
      },
      onConfirmationCancelled: () => {
        cancelled = true
      },
    })
    runtime.stateMachine.arm()

    const samples = new Float32Array(16000).fill(0.6)
    const res = await runtime.processAudioFrame({
      samples,
      transcript: 'Help me! Someone please help me!',
      safetyMode: 'ACTIVE',
    })

    expect(res.modelD.classification).toBe('high_risk')
    expect(res.modelD.requiresConfirmation).toBe(true)
    expect(confirmationTriggered).toBe(true)
    expect(runtime.emergencyStateMachine.state).toBe('THREAT_ANALYSIS')
    expect(runtime.emergencyStateMachine.isCountdownActive).toBe(true)

    // User cancels the alarm
    runtime.cancelPendingConfirmation()
    expect(cancelled).toBe(true)
    expect(runtime.emergencyStateMachine.state).toBe('ARMED_MONITORING')
    expect(runtime.emergencyStateMachine.isCountdownActive).toBe(false)

    await runtime.stateMachine.disarm()
  })

  it('triggers emergency confirmation on Telugu and Hindi distress signals', async () => {
    let confirmationTriggered = false

    const runtime = new HerShieldRuntime({
      onConfirmationRequired: () => {
        confirmationTriggered = true
      },
    })
    runtime.stateMachine.arm()

    const samples = new Float32Array(16000).fill(0.6)
    
    // Telugu
    const teRes = await runtime.processAudioFrame({
      samples,
      transcript: 'నన్ను కాపాడండి! సహాయం చేయండి!',
      safetyMode: 'ACTIVE',
    })
    expect(teRes.modelA.matched_language).toBe('te')
    expect(teRes.modelD.classification).toBe('high_risk')
    expect(confirmationTriggered).toBe(true)

    runtime.cancelPendingConfirmation()

    // Hindi
    const hiRes = await runtime.processAudioFrame({
      samples,
      transcript: 'मुझे बचाओ! कोई मदद करो!',
      safetyMode: 'ACTIVE',
    })
    expect(hiRes.modelA.matched_language).toBe('hi')
    expect(hiRes.modelD.classification).toBe('high_risk')

    await runtime.stateMachine.disarm()
  })
})
