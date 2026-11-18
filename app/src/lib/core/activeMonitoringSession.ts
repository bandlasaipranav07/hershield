import { HerShieldRuntime } from './runtime'
import type { ArmState } from './armState'
import type { TemporalEvaluationResult } from '../risk/temporalRiskEngine'
import type { MicCaptureError } from '../audio/microphoneCapture'
import { isVoiceSupported, startVoiceCapture } from '../voice'

export type UiThreatStatus =
  | 'DISARMED'
  | 'ACQUIRING MIC'
  | 'ARMED / MONITORING'
  | 'ANALYZING'
  | 'ELEVATED RISK'
  | 'THREAT CONFIRMED'
  | 'CONFIRMATION_REQUIRED'
  | 'SOS / ESCALATED'

export interface MonitoringSnapshot {
  armState: ArmState
  threatStatus: UiThreatStatus
  latestEval: TemporalEvaluationResult | null
  lastTranscript: string | null
  countdown: number | null
  micError: string | null
  incidentError: string | null
}

type Listener = () => void

class ActiveMonitoringSessionManager {
  private _runtime: HerShieldRuntime | null = null
  private _armState: ArmState = 'DISARMED'
  private _threatStatus: UiThreatStatus = 'DISARMED'
  private _latestEval: TemporalEvaluationResult | null = null
  private _lastTranscript: string | null = null
  private _countdown: number | null = null
  private _micError: string | null = null
  private _incidentError: string | null = null

  private _speechSession: ReturnType<typeof startVoiceCapture> | null = null
  private _speechLoopActive = false
  private _countdownTimer: ReturnType<typeof setInterval> | null = null
  private _listeners: Set<Listener> = new Set()

  public getSnapshot(): MonitoringSnapshot {
    return {
      armState: this._armState,
      threatStatus: this._threatStatus,
      latestEval: this._latestEval,
      lastTranscript: this._lastTranscript,
      countdown: this._countdown,
      micError: this._micError,
      incidentError: this._incidentError,
    }
  }

  public subscribe(listener: Listener): () => void {
    this._listeners.add(listener)
    return () => {
      this._listeners.delete(listener)
    }
  }

  private notify(): void {
    for (const listener of this._listeners) {
      try {
        listener()
      } catch (err) {
        console.error('Error in monitoring session listener:', err)
      }
    }
  }

  public getRuntime(): HerShieldRuntime {
    if (!this._runtime) {
      this._initRuntime()
    }
    return this._runtime!
  }

  private _initRuntime(): void {
    const runtime = new HerShieldRuntime({
      onStateChange: (newState) => {
        this._armState = newState
        if (newState === 'DISARMED') {
          this.stopSpeechLoop()
          this._threatStatus = 'DISARMED'
          this._countdown = null
          if (this._countdownTimer) {
            clearInterval(this._countdownTimer)
            this._countdownTimer = null
          }
        } else {
          this._threatStatus = 'ARMED / MONITORING'
        }
        this.notify()
      },
      onThreatEvaluated: (evalResult) => {
        this._latestEval = evalResult
        if (this._threatStatus !== 'CONFIRMATION_REQUIRED' && this._threatStatus !== 'SOS / ESCALATED') {
          if (evalResult.currentAssessment.level === 'HIGH' || evalResult.escalated) {
            this._threatStatus = 'THREAT CONFIRMED'
          } else if (evalResult.currentAssessment.level === 'MEDIUM') {
            this._threatStatus = 'ELEVATED RISK'
          } else {
            this._threatStatus = 'ARMED / MONITORING'
          }
        }
        this.notify()
      },
      onThreatConfirmed: () => {
        this._threatStatus = 'SOS / ESCALATED'
        this._countdown = null
        if (this._countdownTimer) clearInterval(this._countdownTimer)
        this._countdownTimer = null
        this.notify()
      },
      onIncidentDispatchError: (msg) => {
        this._incidentError = msg
        this.notify()
      },
      onConfirmationRequired: (expiresAt) => {
        this._threatStatus = 'CONFIRMATION_REQUIRED'
        this._startConfirmationCountdown(expiresAt)
        this.notify()
      },
      onConfirmationCancelled: () => {
        if (this._countdownTimer) clearInterval(this._countdownTimer)
        this._countdownTimer = null
        this._countdown = null
        this._threatStatus = 'ARMED / MONITORING'
        this.notify()
      },
      onMicrophoneStarted: () => {
        this._micError = null
        this._threatStatus = 'ARMED / MONITORING'
        this.notify()
      },
      onMicrophoneError: (error: MicCaptureError, detail: string) => {
        const messages: Record<MicCaptureError, string> = {
          PERMISSION_DENIED: 'Microphone permission denied. Grant access in your browser settings and try again.',
          DEVICE_NOT_FOUND: 'No microphone found on this device.',
          BROWSER_UNSUPPORTED: 'This browser does not support the required audio APIs.',
          AUDIO_CONTEXT_FAILED: 'Audio system could not be initialised.',
          STREAM_ENDED: 'Microphone disconnected. Protection may be impaired.',
          UNKNOWN: `Microphone error: ${detail}`,
        }
        this._micError = messages[error] ?? detail
        this._threatStatus = 'ARMED / MONITORING'
        this.notify()
      },
    })

    this._runtime = runtime
  }

  private _startConfirmationCountdown(expiresAt: number): void {
    if (this._countdownTimer) clearInterval(this._countdownTimer)
    const remainingSeconds = () => Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
    this._countdown = remainingSeconds()
    this._countdownTimer = setInterval(() => {
      const remaining = remainingSeconds()
      this._countdown = remaining
      if (remaining <= 0 && this._countdownTimer) {
        clearInterval(this._countdownTimer)
        this._countdownTimer = null
      }
      this.notify()
    }, 250)
  }

  public startSpeechLoop(): void {
    if (!isVoiceSupported()) return
    this._speechLoopActive = true
    this._runOneSpeechSession()
  }

  public stopSpeechLoop(): void {
    this._speechLoopActive = false
    this._speechSession?.stop()
    this._speechSession = null
  }

  private _runOneSpeechSession(): void {
    if (!this._speechLoopActive) return
    const session = startVoiceCapture()
    if (!session) return
    this._speechSession = session

    session.result
      .then((outcome) => {
        if (!this._speechLoopActive) return
        if (outcome.transcript && !outcome.error) {
          this._lastTranscript = outcome.transcript
          this._runtime?.setCurrentTranscript(outcome.transcript, outcome.confidence)
          this.notify()
        }
        if (this._speechLoopActive) {
          this._runOneSpeechSession()
        }
      })
      .catch(() => {
        if (this._speechLoopActive) {
          setTimeout(() => this._runOneSpeechSession(), 200)
        }
      })
  }

  public async arm(): Promise<boolean> {
    this._micError = null
    this._incidentError = null
    const runtime = this.getRuntime()
    const res = runtime.stateMachine.arm()
    if (!res.success) return false

    this._armState = res.currentState
    this._threatStatus = 'ACQUIRING MIC'
    this.notify()

    let captureStarted = false
    try {
      captureStarted = await runtime.startAudioCapture()
    } catch {
      this._micError = 'Microphone capture could not be started. Check browser permissions and try again.'
    }

    if (!captureStarted) {
      this.stopSpeechLoop()
      await runtime.stateMachine.disarm()
      this._armState = 'DISARMED'
      this._threatStatus = 'DISARMED'
      this.notify()
      return false
    }

    this.startSpeechLoop()
    this.notify()
    return true
  }

  public async disarm(pin?: string): Promise<{ success: boolean; error?: string }> {
    const runtime = this.getRuntime()
    const res = await runtime.stateMachine.disarm(pin)
    if (!res.success) {
      return { success: false, error: res.error ?? 'Could not disarm' }
    }
    this.stopSpeechLoop()
    this._micError = null
    this.notify()
    return { success: true }
  }

  public cancelConfirmation(): void {
    this._runtime?.cancelPendingConfirmation()
  }

  public clearMicError(): void {
    this._micError = null
    this.notify()
  }

  public resetForTesting(): void {
    this.stopSpeechLoop()
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer)
      this._countdownTimer = null
    }
    this._runtime = null
    this._armState = 'DISARMED'
    this._threatStatus = 'DISARMED'
    this._latestEval = null
    this._lastTranscript = null
    this._countdown = null
    this._micError = null
    this._incidentError = null
    this.notify()
  }
}

export const activeMonitoringSession = new ActiveMonitoringSessionManager()
