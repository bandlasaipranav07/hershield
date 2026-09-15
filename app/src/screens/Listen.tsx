import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { grantVoiceConsent, hasVoiceConsent, revokeVoiceConsent } from '../lib/consent'
import { isVoiceSupported, startVoiceCapture } from '../lib/voice'
import { isMicrophoneCaptureSupported } from '../lib/audio/microphoneCapture'
import { HerShieldRuntime } from '../lib/core/runtime'
import { decideAction } from '../lib/policy'
import type { ArmState } from '../lib/core/armState'
import type { TemporalEvaluationResult } from '../lib/risk/temporalRiskEngine'
import type { MicCaptureError } from '../lib/audio/microphoneCapture'

export type UiThreatStatus =
  | 'DISARMED'
  | 'ACQUIRING MIC'
  | 'ARMED / MONITORING'
  | 'ANALYZING'
  | 'ELEVATED RISK'
  | 'THREAT CONFIRMED'
  | 'CONFIRMATION_REQUIRED'
  | 'SOS / ESCALATED'

export function Listen() {
  const speechSupported = isVoiceSupported()
  const micSupported = isMicrophoneCaptureSupported()

  const [consented, setConsented] = useState(hasVoiceConsent)
  const [armState, setArmState] = useState<ArmState>('DISARMED')
  const [threatStatus, setThreatStatus] = useState<UiThreatStatus>('DISARMED')
  const [latestEval, setLatestEval] = useState<TemporalEvaluationResult | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [micError, setMicError] = useState<string | null>(null)
  /** Latest transcript shown in the UI (from the SpeechRecognition channel). */
  const [lastTranscript, setLastTranscript] = useState<string | null>(null)

  const speechSessionRef = useRef<ReturnType<typeof startVoiceCapture>>(null)
  const speechLoopActiveRef = useRef(false)
  const runtimeRef = useRef<HerShieldRuntime | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Initialise runtime once — stable ref, not re-created on each render
  if (!runtimeRef.current) {
    runtimeRef.current = new HerShieldRuntime({
      onStateChange: (newState) => {
        setArmState(newState)
        if (newState === 'DISARMED') {
          // DISARM: runtime already stopped mic capture and wiped buffers
          stopSpeechLoop()
          setThreatStatus('DISARMED')
          setCountdown(null)
          setMicError(null)
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current)
            countdownTimerRef.current = null
          }
        } else {
          setThreatStatus('ARMED / MONITORING')
        }
      },
      onThreatEvaluated: (evalResult) => {
        setLatestEval(evalResult)
        // Only update status if we're not already in a higher-priority state
        setThreatStatus((prev) => {
          if (prev === 'CONFIRMATION_REQUIRED' || prev === 'SOS / ESCALATED') return prev
          if (evalResult.currentAssessment.level === 'HIGH' || evalResult.escalated) {
            return 'THREAT CONFIRMED'
          }
          if (evalResult.currentAssessment.level === 'MEDIUM') return 'ELEVATED RISK'
          return 'ARMED / MONITORING'
        })
      },
      onThreatConfirmed: () => {
        setThreatStatus('SOS / ESCALATED')
      },
      onMicrophoneStarted: () => {
        setMicError(null)
        setThreatStatus('ARMED / MONITORING')
      },
      onMicrophoneError: (error: MicCaptureError, detail: string) => {
        // Map error codes to user-friendly messages
        const messages: Record<MicCaptureError, string> = {
          PERMISSION_DENIED: 'Microphone permission denied. Grant access in your browser settings and try again.',
          DEVICE_NOT_FOUND: 'No microphone found on this device.',
          BROWSER_UNSUPPORTED: 'This browser does not support the required audio APIs.',
          AUDIO_CONTEXT_FAILED: 'Audio system could not be initialised.',
          STREAM_ENDED: 'Microphone disconnected. Protection may be impaired.',
          UNKNOWN: `Microphone error: ${detail}`,
        }
        setMicError(messages[error] ?? detail)
        // Stay armed — user can retry or manually disarm
        setThreatStatus('ARMED / MONITORING')
      },
    })
  }

  useEffect(() => {
    return () => {
      // Full teardown on unmount
      stopSpeechLoop()
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
      }
      if (runtimeRef.current) {
        void runtimeRef.current.stateMachine.disarm()
      }
    }
  }, [])

  // ── Speech recognition loop ──────────────────────────────────────────────
  // The SpeechRecognition API provides transcript text as a separate channel
  // alongside the acoustic microphone pipeline. Each final transcript is pushed
  // into the runtime via setCurrentTranscript(); the next audio frame from the
  // mic pipeline will then carry that text into the TemporalRiskEngine.
  //
  // Platform note: The browser SpeechRecognition service may process audio
  // through the browser vendor's cloud infrastructure. This is disclosed in
  // the consent screen. It is NOT a private on-device recogniser.

  function startSpeechLoop() {
    if (!speechSupported) return
    speechLoopActiveRef.current = true
    runOneSpeechSession()
  }

  function stopSpeechLoop() {
    speechLoopActiveRef.current = false
    speechSessionRef.current?.stop()
    speechSessionRef.current = null
  }

  function runOneSpeechSession() {
    if (!speechLoopActiveRef.current) return

    const session = startVoiceCapture()
    if (!session) return
    speechSessionRef.current = session

    session.result.then((outcome) => {
      if (!speechLoopActiveRef.current) return

      if (outcome.transcript && !outcome.error) {
        setLastTranscript(outcome.transcript)
        // Push transcript into runtime so next acoustic frame carries it
        runtimeRef.current?.setCurrentTranscript(outcome.transcript, outcome.confidence)
      }

      // Re-start immediately while still armed (continuous monitoring)
      if (speechLoopActiveRef.current) {
        runOneSpeechSession()
      }
    }).catch(() => {
      // On unexpected rejection, attempt to restart speech if still armed
      if (speechLoopActiveRef.current) {
        setTimeout(runOneSpeechSession, 500)
      }
    })
  }

  // ── ARM / DISARM handlers ────────────────────────────────────────────────

  function handleAccept() {
    grantVoiceConsent()
    setConsented(true)
  }

  async function handleArm() {
    setPinError(null)
    setMicError(null)
    const runtime = runtimeRef.current
    if (!runtime) return

    const res = runtime.stateMachine.arm()
    if (!res.success) return

    setArmState(res.currentState)
    setThreatStatus('ACQUIRING MIC')

    // Start real microphone pipeline
    await runtime.startAudioCapture()

    // Start speech recognition loop in parallel (separate channel)
    startSpeechLoop()
  }

  async function handleDisarm() {
    setPinError(null)
    const runtime = runtimeRef.current
    if (!runtime) return

    const res = await runtime.stateMachine.disarm(pinInput || undefined)
    if (!res.success) {
      setPinError(res.error ?? 'Could not disarm')
      return
    }

    // State machine subscriber handles: stopAudioCapture, wipe, reset, UI state
    setPinInput('')
  }

  // ── Confirmation countdown ───────────────────────────────────────────────

  function startConfirmationCountdown(seconds: number) {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    setCountdown(seconds)
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current)
            countdownTimerRef.current = null
          }
          setThreatStatus('SOS / ESCALATED')
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  function handleCancelConfirmation() {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    setCountdown(null)
    setThreatStatus('ARMED / MONITORING')
  }

  // When the evaluation shows MEDIUM risk (CONFIRMATION_REQUIRED territory),
  // check the safety policy and start the countdown if required.
  // This is derived from latestEval so policy logic stays in the core module.
  useEffect(() => {
    if (!latestEval) return
    const decision = decideAction(latestEval.currentAssessment.level, 'engine')
    if (decision.action === 'CONFIRMATION_REQUIRED') {
      setThreatStatus('CONFIRMATION_REQUIRED')
      startConfirmationCountdown(decision.countdownSeconds ?? 10)
    }
  // startConfirmationCountdown is stable (uses refs only); safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestEval])

  function handleRevoke() {
    stopSpeechLoop()
    if (runtimeRef.current) {
      void runtimeRef.current.stateMachine.disarm()
    }
    revokeVoiceConsent()
    setConsented(false)
    setLastTranscript(null)
    setArmState('DISARMED')
    setThreatStatus('DISARMED')
    setMicError(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="listen">
      <p>
        <Link to="/">&larr; Back to home</Link>
      </p>
      <h1>Voice Threat Analysis</h1>

      {!speechSupported ? (
        <p role="alert" className="form-error">
          This browser does not support the Web Speech API. Voice detection needs Chrome or Edge.
        </p>
      ) : !micSupported ? (
        <p role="alert" className="form-error">
          This browser does not support the Web Audio API microphone pipeline. Try Chrome or Edge on a desktop.
        </p>
      ) : !consented ? (
        <section className="consent-card" aria-labelledby="consent-title">
          <h2 id="consent-title">Before we use your microphone</h2>
          <ul className="consent-points">
            <li>
              The microphone is ON only while this page is open and you have pressed ARM. There is
              no background listening.
            </li>
            <li>
              Audio is processed locally in real time. Before any threat is confirmed, raw audio
              exists only in a short in-memory buffer and is never saved anywhere.
            </li>
            <li>
              Your browser&apos;s speech service converts speech to text. That service may process
              audio in the cloud (browser vendor — not us). This is a known limitation of the
              current browser implementation.
            </li>
            <li>
              In DEMO mode every notification is SIMULATED. A HIGH-risk event would notify your
              emergency contacts with a transcript summary and location.
            </li>
          </ul>
          <div className="form-actions">
            <button type="button" onClick={handleAccept}>
              I understand — enable voice detection
            </button>
            <Link to="/" className="button-secondary">
              Not now
            </Link>
          </div>
        </section>
      ) : (
        <section className="listen-panel">
          {/* State / Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 600 }}>System State:</span>
            <span
              className={`risk-badge ${
                threatStatus === 'SOS / ESCALATED' || threatStatus === 'THREAT CONFIRMED'
                  ? 'risk-badge-high'
                  : threatStatus === 'CONFIRMATION_REQUIRED' || threatStatus === 'ELEVATED RISK'
                    ? 'risk-badge-medium'
                    : 'risk-badge-low'
              }`}
            >
              {threatStatus}
            </span>
          </div>

          <p className="subtitle">
            Press <strong>ARM</strong> to start real microphone monitoring. The acoustic pipeline
            analyses audio energy and distress-related cues continuously. Speech is transcribed
            by the browser&apos;s speech service and fed to the intent classifier.
          </p>

          {/* ARM / DISARM Control Panel */}
          <div className="form-actions" style={{ marginBottom: '1rem' }}>
            {armState === 'DISARMED' ? (
              <button type="button" onClick={() => void handleArm()}>
                ARM Monitoring
              </button>
            ) : (
              <button type="button" className="button-danger-text" onClick={() => void handleDisarm()}>
                DISARM
              </button>
            )}

            <button type="button" className="button-danger-text" onClick={handleRevoke}>
              Revoke mic consent
            </button>
          </div>

          {pinError && (
            <p role="alert" className="form-error">
              {pinError}
            </p>
          )}

          {/* Microphone error — stay armed, show warning */}
          {micError && (
            <div
              className="consent-card"
              style={{ borderColor: '#dc6803', background: '#fffbeb', marginTop: '1rem' }}
              role="alert"
            >
              <p style={{ margin: 0, color: '#b54708' }}>
                <strong>Microphone issue:</strong> {micError}
              </p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#92400e' }}>
                Protection may be impaired. DISARM and re-ARM to retry, or check browser permissions.
              </p>
            </div>
          )}

          {/* Confirmation Required Alert Dialog */}
          {threatStatus === 'CONFIRMATION_REQUIRED' && countdown !== null && (
            <div
              className="consent-card"
              style={{ borderColor: '#dc6803', background: '#fffbeb', marginTop: '1rem' }}
            >
              <h2 style={{ color: '#b54708' }}>Confirmation Required ({countdown}s)</h2>
              <p style={{ margin: '0 0 0.75rem' }}>
                Elevated distress cues detected. If you are safe, tap &quot;I&apos;m Safe&quot; to cancel escalation.
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  style={{ background: '#067647', color: '#fff' }}
                  onClick={handleCancelConfirmation}
                >
                  I&apos;m Safe (Cancel)
                </button>
              </div>
            </div>
          )}

          {/* Latest transcript from the SpeechRecognition channel */}
          {lastTranscript && (
            <div className="transcript-card">
              <h2>Latest transcript</h2>
              <blockquote>{lastTranscript}</blockquote>
              <p className="confidence-line" style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                Transcribed by the browser speech service (may use vendor cloud).
              </p>

              {latestEval && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.9rem', fontWeight: 600 }}>
                    Threat Assessment: {latestEval.currentAssessment.level} (Score: {latestEval.aggregatedScore})
                  </p>
                  <p className="confidence-line" style={{ fontSize: '0.85rem' }}>
                    {latestEval.reason}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Acoustic monitoring indicator */}
          {armState !== 'DISARMED' && !micError && (
            <p
              style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '1rem' }}
              aria-live="polite"
            >
              {threatStatus === 'ACQUIRING MIC'
                ? 'Requesting microphone access…'
                : 'Acoustic monitoring active — microphone open, audio processed locally.'}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
