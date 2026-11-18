import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HerShieldRuntime } from './runtime'
import * as notifyModule from '../notify'
import { localIncidentStore } from '../storage/incidentStore'
import { CONFIRMATION_SECONDS } from '../policy'

vi.mock('../session', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue('user-1'),
}))

describe('HerShieldRuntime Coordinator', () => {
  let runtime: HerShieldRuntime

  beforeEach(() => {
    runtime = new HerShieldRuntime()
    vi.restoreAllMocks()
    vi.spyOn(notifyModule, 'simulateNotifications').mockResolvedValue({
      notified: 1,
      error: null,
    })
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

  it('creates at most one incident for repeated high-risk frames in one armed session', async () => {
    const saveIncident = vi.spyOn(localIncidentStore, 'saveIncident').mockResolvedValue({
      localId: 'incident-once',
      userId: 'user-1',
      eventType: 'voice_detected',
      riskLevel: 'HIGH',
      createdAt: new Date().toISOString(),
    } as never)
    vi.spyOn(notifyModule, 'simulateNotifications').mockResolvedValue({ notified: 0, error: null })
    runtime.stateMachine.arm()

    const frame = {
      samples: new Float32Array([0.9, 0.95, -0.9]),
      transcript: 'someone is attacking me please help',
      safetyMode: 'ACTIVE' as const,
    }
    await runtime.processAudioFrame(frame)
    await runtime.processAudioFrame(frame)

    expect(saveIncident).toHaveBeenCalledOnce()
  })

  it('escalates one medium-risk incident when confirmation expires', async () => {
    vi.useFakeTimers()
    const saveIncident = vi.spyOn(localIncidentStore, 'saveIncident').mockResolvedValue({
      localId: 'incident-after-timeout',
      userId: 'user-1',
      eventType: 'voice_detected',
      riskLevel: 'MEDIUM',
      createdAt: new Date().toISOString(),
    } as never)
    vi.spyOn(notifyModule, 'simulateNotifications').mockResolvedValue({ notified: 0, error: null })
    const onThreatConfirmed = vi.fn()
    runtime = new HerShieldRuntime({ onThreatConfirmed })
    runtime.stateMachine.arm()

    const result = await runtime.processAudioFrame({
      samples: new Float32Array(0),
      transcript: 'I am scared now',
      safetyMode: 'ACTIVE',
    })
    expect(result.decision.action).toBe('CONFIRMATION_REQUIRED')
    expect(saveIncident).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(CONFIRMATION_SECONDS * 1000)

    expect(saveIncident).toHaveBeenCalledOnce()
    expect(onThreatConfirmed).toHaveBeenCalledOnce()
    await runtime.stateMachine.disarm()
    vi.useRealTimers()
  })

  it('cancels a pending medium confirmation without dispatching', async () => {
    vi.useFakeTimers()
    const saveIncident = vi.spyOn(localIncidentStore, 'saveIncident')
    vi.spyOn(notifyModule, 'simulateNotifications').mockResolvedValue({ notified: 0, error: null })
    runtime.stateMachine.arm()

    await runtime.processAudioFrame({ samples: new Float32Array(0), transcript: 'I am scared now' })
    expect(runtime.pendingConfirmationExpiresAt).not.toBeNull()
    runtime.cancelPendingConfirmation()
    await vi.advanceTimersByTimeAsync(CONFIRMATION_SECONDS * 1000)

    expect(saveIncident).not.toHaveBeenCalled()
    expect(runtime.pendingConfirmationExpiresAt).toBeNull()
    vi.useRealTimers()
  })

  it('cancels a pending medium confirmation when disarmed', async () => {
    vi.useFakeTimers()
    const saveIncident = vi.spyOn(localIncidentStore, 'saveIncident')
    vi.spyOn(notifyModule, 'simulateNotifications').mockResolvedValue({ notified: 0, error: null })
    runtime.stateMachine.arm()

    await runtime.processAudioFrame({ samples: new Float32Array(0), transcript: 'I am scared now' })
    await runtime.stateMachine.disarm()
    await vi.advanceTimersByTimeAsync(CONFIRMATION_SECONDS * 1000)

    expect(saveIncident).not.toHaveBeenCalled()
    expect(runtime.pendingConfirmationExpiresAt).toBeNull()
    vi.useRealTimers()
  })
})
