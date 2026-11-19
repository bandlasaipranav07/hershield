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

  it('initiates confirmation countdown on high-risk transcript and dispatches after expiry', async () => {
    vi.useFakeTimers()
    vi.spyOn(notifyModule, 'simulateNotifications').mockResolvedValueOnce({
      notified: 2,
      error: null,
    })

    const onThreatConfirmed = vi.fn()
    const onSosDispatched = vi.fn()
    const onConfirmationRequired = vi.fn()

    runtime = new HerShieldRuntime({
      onThreatConfirmed,
      onSosDispatched,
      onConfirmationRequired,
    })

    runtime.stateMachine.arm()

    const loudSamples = new Float32Array([0.9, 0.95, -0.9])
    const res = await runtime.processAudioFrame({
      samples: loudSamples,
      transcript: 'somebody help me emergency',
      safetyMode: 'ACTIVE',
    })

    // Per 4-model protocol: single-frame detection triggers confirmation countdown, NOT immediate dispatch
    expect(res.evaluation.escalated).toBe(true)
    expect(res.decision.action).toBe('CONFIRMATION_REQUIRED')
    expect(res.incident).toBeUndefined()
    expect(onConfirmationRequired).toHaveBeenCalled()

    // After countdown expires, incident is dispatched
    await vi.advanceTimersByTimeAsync(CONFIRMATION_SECONDS * 1000)
    expect(onThreatConfirmed).toHaveBeenCalled()
    expect(onSosDispatched).toHaveBeenCalled()

    await runtime.stateMachine.disarm()
    vi.useRealTimers()
  })

  it('creates at most one incident for repeated manual SOS triggers in one armed session', async () => {
    const saveIncident = vi.spyOn(localIncidentStore, 'saveIncident').mockResolvedValue({
      localId: 'incident-once',
      userId: 'user-1',
      eventType: 'manual_sos',
      riskLevel: 'HIGH',
      createdAt: new Date().toISOString(),
    } as never)
    vi.spyOn(notifyModule, 'simulateNotifications').mockResolvedValue({ notified: 0, error: null })
    runtime.stateMachine.arm()

    // Manual SOS dispatches immediately; second call must be a no-op (idempotency guard)
    await runtime.triggerManualSos()
    await runtime.triggerManualSos()

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
