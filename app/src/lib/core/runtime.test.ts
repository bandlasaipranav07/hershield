import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HerShieldRuntime } from './runtime'
import * as notifyModule from '../notify'

describe('HerShieldRuntime Coordinator', () => {
  let runtime: HerShieldRuntime

  beforeEach(() => {
    runtime = new HerShieldRuntime()
    vi.restoreAllMocks()
  })

  it('rejects processing audio when DISARMED', async () => {
    const dummySamples = new Float32Array(100)
    await expect(
      runtime.processAudioFrame({
        samples: dummySamples,
        transcript: 'hello',
      }),
    ).rejects.toThrow(/DISARMED/)
  })

  it('clears audio buffer and temporal history on disarm', async () => {
    runtime.stateMachine.arm()
    const dummySamples = new Float32Array([0.5, 0.5])
    await runtime.processAudioFrame({
      samples: dummySamples,
      transcript: 'help me',
    })

    expect(runtime.temporalRisk.history.length).toBeGreaterThan(0)
    expect(runtime.audioBuffer.getSnapshot().length).toBeGreaterThan(0)

    await runtime.stateMachine.disarm()

    expect(runtime.temporalRisk.history.length).toBe(0)
    expect(runtime.audioBuffer.getSnapshot().length).toBe(0)
  })

  it('coordinates pipeline on threat confirmation and triggers escalation', async () => {
    vi.spyOn(notifyModule, 'simulateNotifications').mockResolvedValueOnce({
      notified: 2,
      error: null,
    })

    const onThreatConfirmed = vi.fn()
    const onSosDispatched = vi.fn()

    runtime = new HerShieldRuntime({
      onThreatConfirmed,
      onSosDispatched,
    })

    runtime.stateMachine.arm()

    const loudSamples = new Float32Array([0.9, 0.95, -0.9])
    const res = await runtime.processAudioFrame({
      samples: loudSamples,
      transcript: 'somebody help me emergency',
      safetyMode: 'ACTIVE',
    })

    expect(res.evaluation.escalated).toBe(true)
    expect(res.decision.action).toBe('ESCALATE')
    expect(res.incident).toBeDefined()
    expect(onThreatConfirmed).toHaveBeenCalled()
    expect(onSosDispatched).toHaveBeenCalled()
  })
})
