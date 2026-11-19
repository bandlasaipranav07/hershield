import { ArmStateMachine, type ArmState } from './armState'
import { TemporalRiskEngine, type TemporalEvaluationResult } from '../risk/temporalRiskEngine'
import { intentModel } from '../intent/classify'
import { AudioPrivacyBuffer } from '../audio/audioPrivacyBuffer'
import { analyzeAcousticFrame } from '../audio/acousticAnalyzer'
import {
  MicrophoneCaptureAdapter,
  type MicCaptureConfig,
  type MicCaptureError,
  type MicCaptureFrame,
} from '../audio/microphoneCapture'
import { decideAction, type PolicyDecision } from '../policy'
import type { LocalIncidentRecord } from '../storage/incidentStore'
import { dispatchIncident, type IncidentDraft } from './incidentDispatcher'
import type { SimulationResult } from '../notify'
import type { GeoPoint } from '../geolocation'
import type { SafetyMode, JourneyStatus, RiskLevel } from '../risk/riskEngine'

// Four-Model Architecture Imports
import { evaluateModelA, type ModelAOutput } from '../detection/modelA'
import { evaluateModelB, type ModelBOutput } from '../detection/modelB'
import { ModelCContextAnalyzer, type ModelCOutput } from '../detection/modelC'
import { evaluateModelD, type ModelDOutput } from '../detection/modelD'
import {
  EmergencyStateMachine,
  type EmergencyState,
} from './emergencyStateMachine'

export interface RuntimeEvents {
  onStateChange?: (state: ArmState) => void
  onEmergencyStateChange?: (state: EmergencyState, prev: EmergencyState) => void
  onThreatEvaluated?: (evaluation: TemporalEvaluationResult) => void
  onModelDDecision?: (decision: ModelDOutput) => void
  onThreatConfirmed?: (incident: LocalIncidentRecord) => void
  onSosDispatched?: (simulation: SimulationResult) => void
  onIncidentDispatchError?: (message: string) => void
  onConfirmationRequired?: (expiresAt: number) => void
  onConfirmationCancelled?: () => void
  /** Called when the microphone pipeline starts successfully. */
  onMicrophoneStarted?: () => void
  /**
   * Called when the microphone pipeline encounters an error.
   * The UI should reflect that protection may be impaired.
   */
  onMicrophoneError?: (error: MicCaptureError, detail: string) => void
}

export class HerShieldRuntime {
  private _stateMachine: ArmStateMachine
  private _emergencyStateMachine: EmergencyStateMachine
  private _temporalRisk: TemporalRiskEngine
  private _contextAnalyzer: ModelCContextAnalyzer
  private _audioBuffer: AudioPrivacyBuffer
  private _events: RuntimeEvents = {}
  private _pendingConfirmationTimer: ReturnType<typeof setTimeout> | null = null
  private _pendingConfirmationExpiresAt: number | null = null
  private _incidentDispatched = false
  private _dispatchInFlight: Promise<LocalIncidentRecord | null> | null = null
  private _lastIncident: LocalIncidentRecord | null = null
  private _latestModelD: ModelDOutput | null = null

  /**
   * Active microphone capture adapter. Null when DISARMED or capture not started.
   * Managed by startAudioCapture() / stopAudioCapture().
   */
  private _micCapture: MicrophoneCaptureAdapter | null = null

  /**
   * Most recent transcript from the SpeechRecognition channel or Sarvam voice engine.
   * Updated by setCurrentTranscript() from Listen.tsx so audio frames
   * carry the latest recognised speech alongside real PCM samples.
   */
  private _currentTranscript = ''
  private _currentAsrConfidence: number | null = null
  private _currentSafetyMode: SafetyMode = 'ACTIVE'
  private _currentJourneyStatus: JourneyStatus = 'NO_JOURNEY'
  private _currentLocation: GeoPoint | null = null

  constructor(events: RuntimeEvents = {}) {
    this._stateMachine = new ArmStateMachine('DISARMED')
    this._emergencyStateMachine = new EmergencyStateMachine('DISARMED')
    this._temporalRisk = new TemporalRiskEngine(intentModel)
    this._contextAnalyzer = new ModelCContextAnalyzer()
    this._audioBuffer = new AudioPrivacyBuffer(5, 16000)
    this._events = events

    this._stateMachine.subscribe((state) => {
      if (state === 'DISARMED') {
        this.cancelPendingConfirmation()
        this._incidentDispatched = false
        this._lastIncident = null
        this._latestModelD = null
        this._emergencyStateMachine.disarm()
        // Stop audio capture and wipe transient state on every disarm transition.
        this.stopAudioCapture()
        this._audioBuffer.wipe()
        this._temporalRisk.reset()
        this._contextAnalyzer.reset()
        this._currentTranscript = ''
        this._currentAsrConfidence = null
      } else {
        this._emergencyStateMachine.arm()
      }
      this._events.onStateChange?.(state)
    })

    this._emergencyStateMachine.subscribe((state, prev) => {
      this._events.onEmergencyStateChange?.(state, prev)
    })
  }

  public get stateMachine(): ArmStateMachine {
    return this._stateMachine
  }

  public get emergencyStateMachine(): EmergencyStateMachine {
    return this._emergencyStateMachine
  }

  public get temporalRisk(): TemporalRiskEngine {
    return this._temporalRisk
  }

  public get contextAnalyzer(): ModelCContextAnalyzer {
    return this._contextAnalyzer
  }

  public get audioBuffer(): AudioPrivacyBuffer {
    return this._audioBuffer
  }

  public get latestModelD(): ModelDOutput | null {
    return this._latestModelD
  }

  /** Returns true if the microphone capture pipeline is currently running. */
  public get isCapturing(): boolean {
    return this._micCapture?.isActive ?? false
  }

  public get pendingConfirmationExpiresAt(): number | null {
    return this._pendingConfirmationExpiresAt
  }

  public cancelPendingConfirmation(): void {
    if (!this._pendingConfirmationTimer && this._pendingConfirmationExpiresAt === null) return
    if (this._pendingConfirmationTimer) clearTimeout(this._pendingConfirmationTimer)
    this._pendingConfirmationTimer = null
    this._pendingConfirmationExpiresAt = null
    this._emergencyStateMachine.cancelThreatAnalysis()
    this._events.onConfirmationCancelled?.()
  }

  private scheduleMediumConfirmation(seconds: number, incidentDraft: IncidentDraft): void {
    if (this._pendingConfirmationTimer || this._incidentDispatched) return
    this._pendingConfirmationExpiresAt = Date.now() + seconds * 1000
    this._events.onConfirmationRequired?.(this._pendingConfirmationExpiresAt)
    this._pendingConfirmationTimer = setTimeout(() => {
      this._pendingConfirmationTimer = null
      this._pendingConfirmationExpiresAt = null
      if (this._stateMachine.isArmed) void this.dispatchConfirmedIncident(incidentDraft)
    }, seconds * 1000)
  }

  private async dispatchConfirmedIncident(
    incidentDraft: IncidentDraft,
  ): Promise<LocalIncidentRecord | null> {
    if (this._dispatchInFlight) return this._dispatchInFlight
    if (this._incidentDispatched) return this._lastIncident
    this._incidentDispatched = true

    this._emergencyStateMachine.markDispatching()

    this._dispatchInFlight = dispatchIncident(incidentDraft)
      .then((result) => {
        if (!result.incident) {
          this._emergencyStateMachine.markDispatchFailed(result.error ?? 'Could not save incident')
          this._events.onIncidentDispatchError?.(result.error ?? 'Could not save incident')
          return null
        }
        this._lastIncident = result.incident
        this._emergencyStateMachine.markSosActive()
        this._events.onThreatConfirmed?.(result.incident)
        if (result.simulation) this._events.onSosDispatched?.(result.simulation)
        return result.incident
      })
      .catch((error: unknown) => {
        const errorMsg = error instanceof Error ? error.message : 'Could not dispatch incident'
        this._emergencyStateMachine.markDispatchFailed(errorMsg)
        this._events.onIncidentDispatchError?.(errorMsg)
        return null
      })
      .finally(() => {
        this._dispatchInFlight = null
      })
    return this._dispatchInFlight
  }

  // ── Manual SOS Dispatcher ───────────────────────────────────────────────────

  public async triggerManualSos(location?: GeoPoint): Promise<LocalIncidentRecord | null> {
    const loc = location ?? this._currentLocation
    const incidentDraft: IncidentDraft = {
      eventType: 'manual_sos',
      riskLevel: 'HIGH',
      intentLevel: 'HIGH',
      threatLevel: 'HIGH',
      safetyMode: this._currentSafetyMode,
      journeyStatus: this._currentJourneyStatus,
      transcript: '[MANUAL SOS BUTTON ACTIVATED]',
      transcriptSummary: 'Manual SOS explicitly triggered by user',
      triggerSource: 'manual_sos',
      location: loc,
      decisionReason: 'Explicit manual SOS trigger by user',
    }

    this._emergencyStateMachine.confirmEmergency({ reason: 'Manual SOS' })
    return this.dispatchConfirmedIncident(incidentDraft)
  }

  // ── Transcript / context setters ────────────────────────────────────────────

  public setCurrentTranscript(transcript: string, asrConfidence?: number | null): void {
    this._currentTranscript = transcript
    this._currentAsrConfidence = asrConfidence ?? null
  }

  public setSafetyMode(mode: SafetyMode): void {
    this._currentSafetyMode = mode
  }

  public setJourneyStatus(status: JourneyStatus): void {
    this._currentJourneyStatus = status
  }

  public setLocation(location: GeoPoint | null): void {
    this._currentLocation = location
  }

  // ── Audio capture lifecycle ─────────────────────────────────────────────────

  public async startAudioCapture(config?: MicCaptureConfig): Promise<boolean> {
    if (this._micCapture?.isActive) return true

    this._micCapture = new MicrophoneCaptureAdapter(
      {
        onFrame: (frame: MicCaptureFrame) => {
          void this.processAudioFrame({
            samples: frame.samples,
            frequencyData: frame.frequencyData,
            transcript: this._currentTranscript,
            asrConfidence: this._currentAsrConfidence,
            location: this._currentLocation,
            safetyMode: this._currentSafetyMode,
            journeyStatus: this._currentJourneyStatus,
          }).catch((err: unknown) => {
            console.error('HerShield runtime error in audio frame processing:', err)
          })
        },
        onError: (error: MicCaptureError, detail: string) => {
          this._events.onMicrophoneError?.(error, detail)
        },
      },
      config,
    )

    const success = await this._micCapture.start()
    if (success) {
      this._events.onMicrophoneStarted?.()
    } else {
      this._micCapture = null
    }
    return success
  }

  public stopAudioCapture(): void {
    this._micCapture?.stop()
    this._micCapture = null
  }

  // ── Main Audio & Threat Processing Pipeline ─────────────────────────────────

  /**
   * Main runtime entry point for incoming audio + transcript frame.
   * Runs the complete Four-Model Detection Architecture:
   * Model A (Keyword & Acoustic) -> Model B (Intent) -> Model C (Context) -> Model D (Synthesizer)
   */
  public async processAudioFrame(params: {
    samples: Float32Array
    frequencyData?: Uint8Array
    transcript: string
    asrConfidence?: number | null
    location?: GeoPoint | null
    safetyMode?: SafetyMode
    journeyStatus?: JourneyStatus
  }): Promise<{
    evaluation: TemporalEvaluationResult
    decision: PolicyDecision
    incident?: LocalIncidentRecord
    modelA: ModelAOutput
    modelB: ModelBOutput
    modelC: ModelCOutput
    modelD: ModelDOutput
  }> {
    if (!this._stateMachine.isArmed) {
      throw new Error('Cannot process audio frames while system is DISARMED')
    }

    // 1. Transient in-memory audio buffering (zeroed on disarm, no disk write)
    this._audioBuffer.writeSamples(params.samples)

    // 2. Model A – Keyword & Acoustic Trigger Detection
    const modelA = evaluateModelA({
      samples: params.samples,
      frequencyData: params.frequencyData,
      transcript: params.transcript,
    })

    // 3. Model B – Intent Detection & Speech Semantics
    const modelB = evaluateModelB(params.transcript)

    // 4. Model C – Context & Temporal Progression Analysis
    const modelC = this._contextAnalyzer.evaluate({
      modelA,
      modelB,
      safetyMode: params.safetyMode,
      journeyStatus: params.journeyStatus,
    })

    // 5. Model D – Combined Multi-Model Decision Synthesizer
    const modelD = evaluateModelD({
      modelA,
      modelB,
      modelC,
    })
    this._latestModelD = modelD
    this._events.onModelDDecision?.(modelD)

    // 6. Backward-compatible Temporal Risk evaluation for existing subscribers
    const acousticFeats = analyzeAcousticFrame(params.samples, params.frequencyData)
    const evaluation = this._temporalRisk.evaluate({
      transcript: params.transcript,
      asrConfidence: params.asrConfidence,
      acoustic: {
        energy: acousticFeats.rmsEnergy,
        distressScore: acousticFeats.estimatedDistressCue,
      },
      safetyMode: params.safetyMode,
      journeyStatus: params.journeyStatus,
    })
    this._events.onThreatEvaluated?.(evaluation)

    // 7. Policy decision mapped from Model D (primary authority).
    //
    // Per the 4-model architecture spec:
    //   - Only manual SOS triggers an immediate dispatch (no confirmation required).
    //   - All engine-detected risk must go through the confirmation countdown.
    //   - confirmed_emergency from Model D = multi-factor absolute corroboration (all 4 models + temporal).
    //   - high_risk or potential_threat = MEDIUM → 10s confirmation countdown required.
    //   - normal_activity = LOW → log only.
    //
    // The TemporalRiskEngine is preserved for event subscribers but does NOT override
    // Model D's decision to prevent false-positive immediate SOS dispatch.
    let mappedRiskLevel: RiskLevel = 'LOW'
    if (modelD.classification === 'confirmed_emergency') {
      mappedRiskLevel = 'HIGH'
    } else if (
      modelD.classification === 'high_risk' ||
      modelD.classification === 'potential_threat'
    ) {
      mappedRiskLevel = 'MEDIUM'
    } else if (evaluation.currentAssessment.level === 'MEDIUM') {
      // Temporal engine secondary: applies only when Model D classifies as normal_activity
      // (e.g. very low-confidence transcript with moderate acoustic energy)
      mappedRiskLevel = 'MEDIUM'
    }

    const decision = decideAction(mappedRiskLevel, 'engine')

    const incidentDraft: IncidentDraft = {
      eventType: 'voice_detected',
      riskLevel: mappedRiskLevel,
      intentLevel: modelB.severity === 'critical' || modelB.severity === 'high' ? 'HIGH' : 'LOW',
      threatLevel: mappedRiskLevel,
      safetyMode: params.safetyMode,
      journeyStatus: params.journeyStatus,
      transcript: params.transcript,
      transcriptSummary: params.transcript.slice(0, 100),
      triggerSource: 'runtime_voice_analyzer',
      location: params.location,
      asrConfidence: params.asrConfidence,
      decisionReason: modelD.explanation,
    }

    let incident: LocalIncidentRecord | undefined

    // 8. Enforce Escalation Protocol & State Machine:
    if (decision.action === 'ESCALATE' || modelD.classification === 'confirmed_emergency') {
      // Confirmed emergency: Dispatch immediate SOS
      this.cancelPendingConfirmation()
      this._emergencyStateMachine.confirmEmergency({ reason: modelD.explanation })
      incident = (await this.dispatchConfirmedIncident(incidentDraft)) ?? undefined
    } else if (decision.action === 'CONFIRMATION_REQUIRED' || modelD.classification === 'high_risk') {
      // High risk / Medium risk: MUST run confirmation countdown
      if (!this._pendingConfirmationTimer) {
        this._emergencyStateMachine.startThreatAnalysis(
          decision.countdownSeconds ?? 10,
          () => {
            if (this._stateMachine.isArmed) void this.dispatchConfirmedIncident(incidentDraft)
          },
          { explanation: modelD.explanation },
        )
        this.scheduleMediumConfirmation(decision.countdownSeconds ?? 10, incidentDraft)
      }
    } else if (modelD.classification === 'potential_threat') {
      this._emergencyStateMachine.markSuspicious({ reason: modelD.explanation })
    } else {
      // Normal activity: Return to monitoring if in suspicious state
      this._emergencyStateMachine.returnToMonitoring()
    }

    return {
      evaluation,
      decision,
      incident,
      modelA,
      modelB,
      modelC,
      modelD,
    }
  }
}
