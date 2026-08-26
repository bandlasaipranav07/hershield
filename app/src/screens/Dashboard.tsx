import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createEmergencyEvent,
  listEmergencyEvents,
  type EmergencyEvent,
} from '../lib/events'
import { simulateNotifications } from '../lib/notify'
import { decideAction } from '../lib/policy'

export function Dashboard() {
  const [events, setEvents] = useState<EmergencyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [armed, setArmed] = useState(false)
  const [sending, setSending] = useState(false)
  const [simSummary, setSimSummary] = useState<string | null>(null)
  const activeRef = useRef(true)

  async function refresh() {
    const result = await listEmergencyEvents()
    if (!activeRef.current) return
    setEvents(result.events)
    setError(result.error)
    setLoading(false)
  }

  useEffect(() => {
    activeRef.current = true
    listEmergencyEvents().then((result) => {
      if (!activeRef.current) return
      setEvents(result.events)
      setError(result.error)
      setLoading(false)
    })
    return () => {
      activeRef.current = false
    }
  }, [])

  async function handleSos() {
    setError(null)
    setSimSummary(null)
    setSending(true)

    const created = await createEmergencyEvent({
      eventType: 'manual_sos',
      riskLevel: 'HIGH',
      triggerSource: 'manual_sos_button',
      decisionReason: decideAction('HIGH', 'manual_sos').reason,
    })
    if (created.error || !created.event) {
      if (activeRef.current) {
        setError(created.error ?? 'Could not create emergency event')
        setSending(false)
      }
      return
    }

    const simulation = await simulateNotifications(created.event)
    if (activeRef.current) {
      setSimSummary(
        simulation.error
          ? `Event saved, but notifications failed: ${simulation.error}`
          : `SIMULATED notifications prepared for ${simulation.notified} contact(s). No real message was sent.`,
      )
      setArmed(false)
      setSending(false)
    }
    await refresh()
  }

  function disarm() {
    setArmed(false)
    setError(null)
  }

  return (
    <div className="dashboard">
      <p>
        <Link to="/">&larr; Back to home</Link>
      </p>
      <h1>Dashboard</h1>

      <section className="sos-section" aria-label="Manual SOS">
        {!armed ? (
          <button type="button" className="sos-button" onClick={() => setArmed(true)}>
            SOS
          </button>
        ) : (
          <div className="sos-confirm">
            <p>Trigger emergency now? This always escalates and notifies contacts (SIMULATED).</p>
            <div className="form-actions">
              <button type="button" className="sos-button-small" disabled={sending} onClick={() => void handleSos()}>
                {sending ? 'Sending…' : 'Yes — trigger SOS'}
              </button>
              <button type="button" className="button-secondary" onClick={disarm} disabled={sending}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {simSummary && (
          <p role="status" className="sim-summary">
            {simSummary}
          </p>
        )}
      </section>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      <h2>Emergency events</h2>
      {loading ? (
        <p>Loading events…</p>
      ) : events.length === 0 ? (
        <p>No emergency events yet. Trigger a test SOS above to see the flow.</p>
      ) : (
        <ul className="event-list">
          {events.map((event) => (
            <li key={event.id} className={`event-card risk-${event.risk_level}`}>
              <div className="event-head">
                <strong>{event.event_type === 'manual_sos' ? 'Manual SOS' : 'Voice detected'}</strong>
                <span className={`risk-badge risk-badge-${event.risk_level}`}>
                  {event.risk_level.toUpperCase()}
                </span>
              </div>
              <time dateTime={event.created_at}>
                {new Date(event.created_at).toLocaleString()}
              </time>
              <dl className="event-details">
                {event.intent_level && (
                  <>
                    <dt>Intent</dt>
                    <dd>{event.intent_level}</dd>
                  </>
                )}
                {event.threat_level && (
                  <>
                    <dt>Threat</dt>
                    <dd>{event.threat_level}</dd>
                  </>
                )}
                {event.safety_mode && (
                  <>
                    <dt>Safety mode</dt>
                    <dd>{event.safety_mode}</dd>
                  </>
                )}
                {event.asr_confidence !== null && (
                  <>
                    <dt>ASR confidence</dt>
                    <dd>{event.asr_confidence.toFixed(2)} (reported only)</dd>
                  </>
                )}
                {event.location_lat !== null && event.location_lng !== null && (
                  <>
                    <dt>Location</dt>
                    <dd>
                      {event.location_lat.toFixed(5)}, {event.location_lng.toFixed(5)}
                    </dd>
                  </>
                )}
              </dl>
              {event.transcript_summary && <blockquote>{event.transcript_summary}</blockquote>}
              {event.decision_reason && <p className="reason-line">{event.decision_reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
