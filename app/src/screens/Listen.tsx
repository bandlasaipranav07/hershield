import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { grantVoiceConsent, hasVoiceConsent, revokeVoiceConsent } from '../lib/consent'
import { isVoiceSupported, startVoiceCapture } from '../lib/voice'
import { isMicrophoneCaptureSupported } from '../lib/audio/microphoneCapture'
import { HerShieldRuntime } from '../lib/core/runtime'
import type { ArmState } from '../lib/core/armState'
import type { TemporalEvaluationResult } from '../lib/risk/temporalRiskEngine'
import type { MicCaptureError } from '../lib/audio/microphoneCapture'
import { listContacts, type Contact } from '../lib/contacts'
import { EmergencyContactDispatchModal } from '../components/EmergencyContactDispatchModal'
import {
  isSarvamConfigured,
  getSarvamApiKey,
  setSarvamApiKey,
  getSarvamLanguage,
  setSarvamLanguage,
} from '../lib/sarvam/sarvamVoice'

export type UiThreatStatus =
  | 'DISARMED'
  | 'ACQUIRING MIC'
  | 'ARMED / MONITORING'
  | 'ANALYZING'
  | 'ELEVATED RISK'
  | 'THREAT CONFIRMED'
  | 'CONFIRMATION_REQUIRED'
  | 'SOS / ESCALATED'

/* ── Persistent Module-Level Monitoring Session State ──────────────────────
 * Retains continuous audio monitoring and speech recognition across screen
 * and tab navigation so protection remains active throughout the application.
 * ──────────────────────────────────────────────────────────────────────── */
let globalRuntime: HerShieldRuntime | null = null
let globalArmState: ArmState = 'DISARMED'
let globalThreatStatus: UiThreatStatus = 'DISARMED'
let globalSpeechSession: ReturnType<typeof startVoiceCapture> | null = null
let globalSpeechLoopActive = false
let globalLatestEval: TemporalEvaluationResult | null = null
let globalLastTranscript: string | null = null
let globalCountdown: number | null = null
let globalMicError: string | null = null
let globalIncidentError: string | null = null
let globalCountdownTimer: ReturnType<typeof setInterval> | null = null

type MonitorListener = () => void
const monitorListeners = new Set<MonitorListener>()

function notifyMonitorListeners(): void {
  for (const listener of monitorListeners) {
    try {
      listener()
    } catch (err) {
      console.error('Error in monitor listener:', err)
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('hershield_monitor_change'))
  }
}

export function isVoiceMonitoringActive(): boolean {
  return globalArmState !== 'DISARMED'
}

export function getGlobalThreatStatus(): UiThreatStatus {
  return globalThreatStatus
}

export function resetGlobalMonitoringForTesting(): void {
  globalSpeechLoopActive = false
  globalSpeechSession?.stop()
  globalSpeechSession = null
  if (globalCountdownTimer) {
    clearInterval(globalCountdownTimer)
    globalCountdownTimer = null
  }
  globalRuntime?.stopAudioCapture()
  globalRuntime = null
  globalArmState = 'DISARMED'
  globalThreatStatus = 'DISARMED'
  globalLatestEval = null
  globalLastTranscript = null
  globalCountdown = null
  globalMicError = null
  globalIncidentError = null
  notifyMonitorListeners()
}

function startGlobalCountdown(expiresAt: number) {
  if (globalCountdownTimer) clearInterval(globalCountdownTimer)
  const remainingSeconds = () => Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
  globalCountdown = remainingSeconds()
  globalCountdownTimer = setInterval(() => {
    const remaining = remainingSeconds()
    globalCountdown = remaining
    if (remaining <= 0 && globalCountdownTimer) {
      clearInterval(globalCountdownTimer)
      globalCountdownTimer = null
    }
    notifyMonitorListeners()
  }, 250)
}

function ensureGlobalRuntime(): HerShieldRuntime {
  if (!globalRuntime) {
    globalRuntime = new HerShieldRuntime({
      onStateChange: (newState) => {
        globalArmState = newState
        if (newState === 'DISARMED') {
          globalSpeechLoopActive = false
          globalSpeechSession?.stop()
          globalSpeechSession = null
          globalThreatStatus = 'DISARMED'
          globalCountdown = null
          if (globalCountdownTimer) {
            clearInterval(globalCountdownTimer)
            globalCountdownTimer = null
          }
        } else {
          globalThreatStatus = 'ARMED / MONITORING'
        }
        notifyMonitorListeners()
      },
      onThreatEvaluated: (evalResult) => {
        globalLatestEval = evalResult
        if (globalThreatStatus !== 'CONFIRMATION_REQUIRED' && globalThreatStatus !== 'SOS / ESCALATED') {
          let next: UiThreatStatus = 'ARMED / MONITORING'
          if (evalResult.currentAssessment.level === 'HIGH' || evalResult.escalated) {
            next = 'THREAT CONFIRMED'
          } else if (evalResult.currentAssessment.level === 'MEDIUM') {
            next = 'ELEVATED RISK'
          }
          globalThreatStatus = next
        }
        notifyMonitorListeners()
      },
      onThreatConfirmed: () => {
        globalThreatStatus = 'SOS / ESCALATED'
        globalCountdown = null
        if (globalCountdownTimer) clearInterval(globalCountdownTimer)
        globalCountdownTimer = null
        notifyMonitorListeners()
      },
      onIncidentDispatchError: (message) => {
        globalIncidentError = message
        notifyMonitorListeners()
      },
      onConfirmationRequired: (expiresAt) => {
        globalThreatStatus = 'CONFIRMATION_REQUIRED'
        startGlobalCountdown(expiresAt)
        notifyMonitorListeners()
      },
      onConfirmationCancelled: () => {
        if (globalCountdownTimer) clearInterval(globalCountdownTimer)
        globalCountdownTimer = null
        globalCountdown = null
        globalThreatStatus = 'ARMED / MONITORING'
        notifyMonitorListeners()
      },
      onMicrophoneStarted: () => {
        globalMicError = null
        globalThreatStatus = 'ARMED / MONITORING'
        notifyMonitorListeners()
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
        globalMicError = messages[error] ?? detail
        globalThreatStatus = 'ARMED / MONITORING'
        notifyMonitorListeners()
      },
    })
  }
  return globalRuntime
}

function startGlobalSpeechLoop() {
  if (!isVoiceSupported()) return
  globalSpeechLoopActive = true
  runOneSpeechSession()
}

function runOneSpeechSession() {
  if (!globalSpeechLoopActive) return

  const session = startVoiceCapture()
  if (!session) return
  globalSpeechSession = session

  session.result
    .then((outcome) => {
      if (!globalSpeechLoopActive) return

      if (outcome.transcript && !outcome.error) {
        globalLastTranscript = outcome.transcript
        globalRuntime?.setCurrentTranscript(outcome.transcript, outcome.confidence)
        notifyMonitorListeners()
      }

      if (globalSpeechLoopActive) {
        runOneSpeechSession()
      }
    })
    .catch(() => {
      if (globalSpeechLoopActive) {
        setTimeout(() => runOneSpeechSession(), 200)
      }
    })
}

export async function disarmGlobalMonitoring(pin?: string): Promise<{ success: boolean; error?: string }> {
  if (!globalRuntime) {
    globalArmState = 'DISARMED'
    globalThreatStatus = 'DISARMED'
    notifyMonitorListeners()
    return { success: true }
  }

  const res = await globalRuntime.stateMachine.disarm(pin)
  if (!res.success) {
    return { success: false, error: res.error ?? 'Could not disarm' }
  }

  globalSpeechLoopActive = false
  globalSpeechSession?.stop()
  globalSpeechSession = null
  globalRuntime.stopAudioCapture()
  globalArmState = 'DISARMED'
  globalThreatStatus = 'DISARMED'
  globalMicError = null
  notifyMonitorListeners()
  return { success: true }
}

export function Listen() {
  const speechSupported = isVoiceSupported()
  const micSupported = isMicrophoneCaptureSupported()

  const [consented, setConsented] = useState(hasVoiceConsent)
  const [armState, setArmState] = useState<ArmState>(() => globalArmState)
  const [threatStatus, setThreatStatus] = useState<UiThreatStatus>(() => globalThreatStatus)
  const [latestEval, setLatestEval] = useState<TemporalEvaluationResult | null>(() => globalLatestEval)
  const [countdown, setCountdown] = useState<number | null>(() => globalCountdown)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [micError, setMicError] = useState<string | null>(() => globalMicError)
  const [incidentError, setIncidentError] = useState<string | null>(() => globalIncidentError)
  const [lastTranscript, setLastTranscript] = useState<string | null>(() => globalLastTranscript)

  // Sarvam configuration state in UI
  const [sarvamKey, setSarvamKey] = useState(() => getSarvamApiKey())
  const [sarvamLang, setSarvamLang] = useState(() => getSarvamLanguage())
  const [showSarvamConfig, setShowSarvamConfig] = useState(false)
  const [sarvamSaveNotice, setSarvamSaveNotice] = useState<string | null>(null)

  // Emergency contact dispatch state
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showDispatchModal, setShowDispatchModal] = useState(false)

  useEffect(() => {
    if (threatStatus === 'SOS / ESCALATED') {
      listContacts()
        .then((res) => {
          setContacts(res.contacts ?? [])
          setShowDispatchModal(true)
        })
        .catch(() => {
          setContacts([])
          setShowDispatchModal(true)
        })
    }
  }, [threatStatus])

  const syncStateFromGlobals = useCallback(() => {
    setArmState(globalArmState)
    setThreatStatus(globalThreatStatus)
    setLatestEval(globalLatestEval)
    setLastTranscript(globalLastTranscript)
    setCountdown(globalCountdown)
    setMicError(globalMicError)
    setIncidentError(globalIncidentError)
  }, [])

  useEffect(() => {
    // If user lacks consent, reset persistent session
    if (!hasVoiceConsent()) {
      resetGlobalMonitoringForTesting()
    } else {
      // Ensure runtime is instantiated
      ensureGlobalRuntime()
    }

    monitorListeners.add(syncStateFromGlobals)
    syncStateFromGlobals()

    return () => {
      monitorListeners.delete(syncStateFromGlobals)
      // When leaving page, only disarm if NOT actively armed
      if (globalArmState === 'DISARMED') {
        globalRuntime = null
      }
    }
  }, [syncStateFromGlobals])

  // ── Arm / Disarm handlers ────────────────────────────────────────────────

  async function handleArm() {
    setMicError(null)
    setIncidentError(null)
    globalMicError = null
    globalIncidentError = null

    const runtime = ensureGlobalRuntime()
    const res = runtime.stateMachine.arm()
    if (!res.success) return

    globalArmState = res.currentState
    globalThreatStatus = 'ACQUIRING MIC'
    setArmState(res.currentState)
    setThreatStatus('ACQUIRING MIC')
    notifyMonitorListeners()

    let captureStarted = false
    try {
      captureStarted = await runtime.startAudioCapture()
    } catch {
      const err = 'Microphone capture could not be started. Check browser permissions and try again.'
      setMicError(err)
      globalMicError = err
    }

    if (!captureStarted) {
      globalSpeechLoopActive = false
      globalSpeechSession?.stop()
      globalSpeechSession = null
      await runtime.stateMachine.disarm()
      globalArmState = 'DISARMED'
      globalThreatStatus = 'DISARMED'
      setArmState('DISARMED')
      setThreatStatus('DISARMED')
      notifyMonitorListeners()
      return
    }

    startGlobalSpeechLoop()
    globalThreatStatus = 'ARMED / MONITORING'
    setThreatStatus('ARMED / MONITORING')
    notifyMonitorListeners()
  }

  async function handleDisarm() {
    setPinError(null)
    const res = await disarmGlobalMonitoring(pinInput || undefined)
    if (!res.success) {
      setPinError(res.error ?? 'Could not disarm')
      return
    }
    setPinInput('')
    syncStateFromGlobals()
  }

  function handleCancelConfirmation() {
    globalRuntime?.cancelPendingConfirmation()
    if (globalCountdownTimer) clearInterval(globalCountdownTimer)
    globalCountdownTimer = null
    globalCountdown = null
    globalThreatStatus = 'ARMED / MONITORING'
    setCountdown(null)
    setThreatStatus('ARMED / MONITORING')
    notifyMonitorListeners()
  }

  function handleRevoke() {
    void disarmGlobalMonitoring()
    revokeVoiceConsent()
    setConsented(false)
    setLastTranscript(null)
    setPinInput('')
    syncStateFromGlobals()
  }

  function handleSaveSarvam() {
    setSarvamApiKey(sarvamKey)
    setSarvamLanguage(sarvamLang)
    setSarvamSaveNotice('Sarvam AI configuration saved!')
    setTimeout(() => setSarvamSaveNotice(null), 3000)
  }

  const sarvamActive = isSarvamConfigured()

  return (
    <div className="listen">
      <p>
        <Link to="/">&larr; Back to home</Link>
      </p>
      <h1>Voice Threat Analysis</h1>

      {/* Sarvam AI Status Pill & Config Toggle */}
      <div className="sarvam-banner-card" style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem', borderRadius: '16px', background: sarvamActive ? 'rgba(238, 242, 255, 0.9)' : 'rgba(255, 255, 255, 0.8)', border: sarvamActive ? '1px solid #c7d2fe' : '1px solid rgba(226, 218, 244, 0.8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>{sarvamActive ? '⚡' : '🎙️'}</span>
            <div>
              <strong style={{ fontSize: '0.85rem', color: sarvamActive ? '#4338ca' : '#5e5774' }}>
                {sarvamActive ? 'Sarvam AI Voice Engine Active (saaras:v4)' : 'Browser Speech Recognition (Default)'}
              </strong>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                {sarvamActive ? 'Indic + English real-time transcription powered by Sarvam AI' : 'Web Speech API. Add Sarvam key for enhanced Indian language accuracy.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="sarvam-config-btn"
            onClick={() => setShowSarvamConfig((prev) => !prev)}
          >
            {showSarvamConfig ? 'Hide Settings' : 'Configure Sarvam'}
          </button>
        </div>

        {showSarvamConfig && (
          <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid #e0e7ff' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="sarvam-key-input" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.25rem' }}>
                Sarvam API Key
              </label>
              <input
                id="sarvam-key-input"
                type="password"
                placeholder="Paste your Sarvam API subscription key"
                value={sarvamKey}
                onChange={(e) => setSarvamKey(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #d1d5db', background: '#ffffff' }}
              />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="sarvam-lang-select" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.25rem' }}>
                Language Mode
              </label>
              <select
                id="sarvam-lang-select"
                value={sarvamLang}
                onChange={(e) => setSarvamLang(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #d1d5db', background: '#ffffff' }}
              >
                <option value="unknown">Auto-detect Indian Language / English</option>
                <option value="en-IN">English (India)</option>
                <option value="hi-IN">Hindi (हिन्दी)</option>
                <option value="ta-IN">Tamil (தமிழ்)</option>
                <option value="te-IN">Telugu (తెలుగు)</option>
                <option value="bn-IN">Bengali (বাংলা)</option>
                <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                <option value="ml-IN">Malayalam (മലയാളം)</option>
                <option value="mr-IN">Marathi (मराठी)</option>
                <option value="gu-IN">Gujarati (ગુજરાતી)</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleSaveSarvam}
                style={{ padding: '0.45rem 1rem', background: '#7c3aed', color: '#ffffff', borderRadius: '8px', border: 'none', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Save Key
              </button>
              {sarvamSaveNotice && (
                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>{sarvamSaveNotice}</span>
              )}
            </div>
          </div>
        )}
      </div>

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
              Your browser&apos;s speech recognition service may process audio through its vendor
              cloud.
            </li>
            <li>
              HIGH-risk events create an emergency incident record and simulate alerts to your
              emergency contacts.
            </li>
          </ul>
          <div className="consent-actions">
            <button
              type="button"
              onClick={() => {
                grantVoiceConsent()
                setConsented(true)
              }}
            >
              I understand &mdash; enable voice detection
            </button>
          </div>
        </section>
      ) : (
        <section className="monitoring-card" aria-labelledby="monitoring-heading">
          <div className="status-row">
            <span
              className={`status-badge status-${armState.toLowerCase()}${
                threatStatus === 'THREAT CONFIRMED' || threatStatus === 'SOS / ESCALATED'
                  ? ' status-threat'
                  : ''
              }`}
            >
              {threatStatus}
            </span>
            <button type="button" className="text-button" onClick={handleRevoke}>
              Revoke mic consent
            </button>
          </div>

          <div className="arm-actions">
            {armState === 'DISARMED' ? (
              <button
                type="button"
                className="arm-btn"
                onClick={() => void handleArm()}
              >
                ARM monitoring
              </button>
            ) : (
              <div className="disarm-row">
                <button
                  type="button"
                  className="disarm-btn"
                  onClick={() => void handleDisarm()}
                >
                  DISARM
                </button>
                {pinError && (
                  <p role="alert" className="form-error">
                    {pinError}
                  </p>
                )}
              </div>
            )}
          </div>

          {incidentError && (
            <p role="alert" className="form-error">
              {incidentError}
            </p>
          )}

          {micError && (
            <div
              role="alert"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                padding: '0.75rem',
                marginTop: '1rem',
              }}
            >
              <p style={{ margin: 0, color: '#fcd34d' }}>
                <strong>Microphone issue:</strong> {micError}
              </p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#fef3c7' }}>
                Protection may be impaired. DISARM and re-ARM to retry, or check browser permissions.
              </p>
            </div>
          )}

          {threatStatus === 'CONFIRMATION_REQUIRED' && countdown !== null && (
            <div
              className="consent-card"
              style={{ borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(217, 119, 6, 0.15)', marginTop: '1rem' }}
            >
              <h2 style={{ color: '#fcd34d' }}>Confirmation Required ({countdown}s)</h2>
              <p style={{ margin: '0 0 0.75rem', color: '#fef3c7' }}>
                Elevated distress cues detected. If you are safe, tap &quot;I&apos;m Safe&quot; to cancel escalation.
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  style={{ background: '#059669', color: '#fff', border: 'none' }}
                  onClick={handleCancelConfirmation}
                >
                  I&apos;m Safe (Cancel)
                </button>
              </div>
            </div>
          )}

          {lastTranscript && (
            <div className="transcript-card">
              <h2>Latest transcript</h2>
              <blockquote>{lastTranscript}</blockquote>
              <p className="confidence-line" style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                {sarvamActive
                  ? 'Transcribed securely via Sarvam AI saaras:v4 (Indic voice engine).'
                  : 'Transcribed by the browser speech service (may use vendor cloud).'}
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

          {threatStatus === 'SOS / ESCALATED' && (
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  listContacts()
                    .then((res) => {
                      setContacts(res.contacts ?? [])
                      setShowDispatchModal(true)
                    })
                    .catch(() => {
                      setContacts([])
                      setShowDispatchModal(true)
                    })
                }}
                style={{
                  width: '100%',
                  padding: '0.85rem 1rem',
                  background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  borderRadius: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(225, 29, 72, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                🚨 Send Emergency SMS / WhatsApp to Contacts
              </button>
            </div>
          )}

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

      {showDispatchModal && (
        <EmergencyContactDispatchModal
          contacts={contacts}
          onClose={() => setShowDispatchModal(false)}
        />
      )}
    </div>
  )
}
