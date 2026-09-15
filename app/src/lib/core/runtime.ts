import { ArmStateMachine, type ArmState } from './armState'
import { TemporalRiskEngine, type TemporalEvaluationResult } from '../risk/temporalRiskEngine'
import { intentModel } from '../intent/classify'
import { AudioPrivacyBuffer } from '../audio/audioPrivacyBuffer'
import { analyzeAcousticFrame } from '../audio/acousticAnalyzer'
import {
  MicrophoneCaptureAdapter,
  type MicCaptureConfig,
  type MicCaptureError,
} from '../audio/microphoneCapture'
import { decideAction, type PolicyDecision } from '../policy'
import { localIncidentStore, type LocalIncidentRecord } from '../storage/incidentStore'
import { simulateNotifications, type SimulationResult } from '../notify'
import { cloudSyncService } from '../sync/syncService'
import type { GeoPoint } from '../geolocation'
import type { SafetyMode, JourneyStatus } from '../risk/riskEngine'

export interface RuntimeEvents {
  onStateChange?: (state: ArmState) => void
  onThreatEvaluated?: (evaluation: TemporalEvaluationResult) => void
  onThreatConfirmed?: (incident: LocalIncidentRecord) => void
  onSosDispatched?: (simulation: SimulationResult) => void
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
  private _temporalRisk: TemporalRiskEngine
  private _audioBuffer: AudioPrivacyBuffer
  private _events: RuntimeEvents = {}

  /**
   * Active microphone capture adapter. Null when DISARMED or capture not started.
   * Managed by startAudioCapture() / stopAudioCapture().
   */
  private _micCapture: MicrophoneCaptureAdapter | null = null

  /**
   * Most recent transcript from the SpeechRecognition channel.
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
    this._temporalRisk = new TemporalRiskEngine(intentModel)
    this._audioBuffer = new AudioPrivacyBuffer(5, 16000)
    this._events = events

    this._stateMachine.subscribe((state) => {
      if (state === 'DISARMED') {
        // Stop audio capture and wipe transient state on every disarm transition.
        this.stopAudioCapture()
        this._audioBuffer.wipe()
        this._temporalRisk.reset()
        this._currentTranscript = ''
        this._currentAsrConfidence = null
      }
      this._events.onStateChange?.(state)
    })
  }

  public get stateMachine(): ArmStateMachine {
    return this._stateMachine
  }

  public get temporalRisk(): TemporalRiskEngine {
    return this._temporalRisk
  }

  public get audioBuffer(): AudioPrivacyBuffer {
    return this._audioBuffer
  }

  /** Returns true if the microphone capture pipeline is currently running. */
  public get isCapturing(): boolean {
    return this._micCapture?.isActive ?? false
  }

  // ── Transcript / context setters ────────────────────────────────────────────

  /**
   * Update the current speech transcript from the SpeechRecognition channel.
   * Called by Listen.tsx whenever a new final transcript arrives.
   * The next audio frame will carry this transcript into the risk pipeline.
   */
  public setCurrentTranscript(
    transcript: string,
    asrConfidence: number | null = null,
  ): void {
    this._currentTranscript = transcript
    this._currentAsrConfidence = asrConfidence
  }

  /** Update context signals used by the risk engine on every frame. */
  public setContext(params: {
    safetyMode?: SafetyMode
    journeyStatus?: JourneyStatus
    location?: GeoPoint | null
  }): void {
    if (params.safetyMode !== undefined) this._currentSafetyMode = params.safetyMode
    if (params.journeyStatus !== undefined) this._currentJourneyStatus = params.journeyStatus
    if (params.location !== undefined) this._currentLocation = params.location
  }

  // ── Microphone capture lifecycle ────────────────────────────────────────────

  /**
   * Start the real microphone capture pipeline.
   * Must only be called while ARMED (state machine enforces this).
   *
   * @param config  Optional MicCaptureConfig overrides (useful for testing).
   * @returns true if capture started successfully; false if an error occurred
   *          (error already reported via onMicrophoneError).
   */
  public async startAudioCapture(config?: MicCaptureConfig): Promise<boolean> {
    if (!this._stateMachine.isArmed) return false

    // Stop any previously running capture before starting a new one.
    this.stopAudioCapture()

    this._micCapture = new MicrophoneCaptureAdapter(
      {
        onFrame: (frame) => {
          // Only process frames while still armed; drop silently after disarm.
          if (!this._stateMachine.isArmed) return

          // Fire-and-forget: processAudioFrame is async but we do not await
          // here to avoid back-pressure in the audio processing thread.
          void this.processAudioFrame({
            samples: frame.samples,
            frequencyData: frame.frequencyData,
            transcript: this._currentTranscript,
            asrConfidence: this._currentAsrConfidence,
            safetyMode: this._currentSafetyMode,
            journeyStatus: this._currentJourneyStatus,
            location: this._currentLocation,
          }).catch(() => {
            // Silently absorb per-frame errors; they must not crash the audio thread.
          })
        },
        onError: (error, detail) => {
          this._events.onMicrophoneError?.(error, detail)
        },
      },
      config,
    )

    const success = await this._micCapture.start()
    if (success) {
      this._events.onMicrophoneStarted?.()
    } else {
      // Adapter already reported error via onError; release ref.
      this._micCapture = null
    }
    return success
  }

  /**
   * Stop the microphone capture pipeline.
   * Safe to call at any time, including when not capturing.
   * Also called automatically on every DISARM transition.
   */
  public stopAudioCapture(): void {
    this._micCapture?.stop()
    this._micCapture = null
  }

  /**
   * Main runtime entry point for incoming audio + transcript frame.
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
  }> {
    if (!this._stateMachine.isArmed) {
      throw new Error('Cannot process audio frames while system is DISARMED')
    }

    // 1. Transient in-memory audio buffering
    this._audioBuffer.writeSamples(params.samples)

    // 2. Acoustic signal extraction
    const acousticFeats = analyzeAcousticFrame(params.samples, params.frequencyData)

    // 3. Temporal Risk Engine evaluation
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

    // 4. Policy decision
    const decision = decideAction(evaluation.currentAssessment.level, 'engine')

    let incident: LocalIncidentRecord | undefined

    // 5. Threat confirmed / escalation handling
    if (evaluation.escalated || decision.action === 'ESCALATE') {
      incident = await localIncidentStore.saveIncident({
        eventType: 'voice_detected',
        riskLevel: evaluation.currentAssessment.level,
        intentLevel: evaluation.intentResult.level,
        threatLevel: evaluation.currentAssessment.level,
        safetyMode: params.safetyMode,
        journeyStatus: params.journeyStatus,
        transcript: params.transcript,
        transcriptSummary: params.transcript.slice(0, 100),
        triggerSource: 'runtime_voice_analyzer',
        location: params.location,
        asrConfidence: params.asrConfidence,
        decisionReason: evaluation.reason,
      })

      this._events.onThreatConfirmed?.(incident)

      // Trigger simulated notifications
      const sim = await simulateNotifications({
        id: incident.localId,
        user_id: incident.userId ?? 'local-user',
        event_type: incident.eventType,
        risk_level: incident.riskLevel.toLowerCase() as 'low' | 'medium' | 'high',
        intent_level: incident.intentLevel ?? null,
        threat_level: incident.threatLevel ?? null,
        safety_mode: incident.safetyMode ?? null,
        journey_status: incident.journeyStatus ?? null,
        transcript: incident.transcript ?? null,
        transcript_summary: incident.transcriptSummary ?? null,
        trigger_source: incident.triggerSource ?? null,
        location_lat: incident.location?.lat ?? null,
        location_lng: incident.location?.lng ?? null,
        location_accuracy: incident.location?.accuracy ?? null,
        asr_confidence: incident.asrConfidence ?? null,
        decision_reason: incident.decisionReason ?? null,
        resolved_at: null,
        created_at: incident.createdAt,
      })

      this._events.onSosDispatched?.(sim)

      // Trigger asynchronous cloud sync attempt (offline-safe)
      void cloudSyncService.syncPendingIncidents().catch(() => {
        // Silently preserve local record if offline
      })
    }

    return { evaluation, decision, incident }
  }
}
