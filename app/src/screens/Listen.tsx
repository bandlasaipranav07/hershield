import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { grantVoiceConsent, hasVoiceConsent, revokeVoiceConsent } from '../lib/consent'
import { isVoiceSupported, startVoiceCapture, type VoiceOutcome } from '../lib/voice'

export function Listen() {
  const supported = isVoiceSupported()
  const [consented, setConsented] = useState(hasVoiceConsent)
  const [listening, setListening] = useState(false)
  const [outcome, setOutcome] = useState<VoiceOutcome | null>(null)
  const sessionRef = useRef<ReturnType<typeof startVoiceCapture>>(null)

  useEffect(() => {
    return () => {
      sessionRef.current?.stop()
    }
  }, [])

  function handleAccept() {
    grantVoiceConsent()
    setConsented(true)
  }

  async function handleStart() {
    setOutcome(null)
    setListening(true)
    const session = startVoiceCapture()
    if (!session) {
      setListening(false)
      setOutcome({ transcript: '', confidence: null, error: 'Voice input not supported in this browser' })
      return
    }
    sessionRef.current = session
    const result = await session.result
    if (sessionRef.current === session) {
      sessionRef.current = null
    }
    setListening(false)
    setOutcome(result)
  }

  function handleStop() {
    sessionRef.current?.stop()
  }

  function handleRevoke() {
    sessionRef.current?.stop()
    sessionRef.current = null
    revokeVoiceConsent()
    setConsented(false)
    setOutcome(null)
  }

  return (
    <div className="listen">
      <p>
        <Link to="/">&larr; Back to home</Link>
      </p>
      <h1>Voice check (demo)</h1>

      {!supported ? (
        <p role="alert" className="form-error">
          This browser does not support the Web Speech API. Voice detection needs Chrome or Edge.
        </p>
      ) : !consented ? (
        <section className="consent-card" aria-labelledby="consent-title">
          <h2 id="consent-title">Before we use your microphone</h2>
          <ul className="consent-points">
            <li>
              The microphone is ON only while this page is open and you started listening. There is
              no background listening.
            </li>
            <li>We never store raw audio anywhere. If no emergency is detected, nothing is kept.</li>
            <li>
              Your browser&apos;s speech service converts speech to text. That service may process
              audio in the cloud (browser vendor — not us).
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
          <p className="subtitle">
            Say something like &quot;help me&quot; and see what the recognizer hears. Nothing is
            saved; the intent classifier arrives in the next phase.
          </p>

          <div className="form-actions">
            <button type="button" onClick={() => void handleStart()} disabled={listening}>
              {listening ? 'Listening…' : 'Start listening'}
            </button>
            {listening && (
              <button type="button" onClick={handleStop}>
                Stop
              </button>
            )}
            <button type="button" className="button-danger-text" onClick={handleRevoke}>
              Revoke mic consent
            </button>
          </div>

          {outcome?.error && (
            <p role="alert" className="form-error">
              {outcome.error}
            </p>
          )}

          {outcome && !outcome.error && (
            <div className="transcript-card">
              <h2>Transcript</h2>
              <blockquote>{outcome.transcript || '(empty)'}</blockquote>
              <p className="confidence-line">
                ASR confidence:{' '}
                {outcome.confidence === null ? 'not reported' : outcome.confidence.toFixed(2)}{' '}
                (reported only — it is not scored in this MVP)
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
