import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listEmergencyEvents,
  type EmergencyEvent,
} from '../lib/events'
import { dispatchIncident } from '../lib/core/incidentDispatcher'
import { decideAction } from '../lib/policy'
import { listContacts, type Contact } from '../lib/contacts'
import { EmergencyContactDispatchModal } from '../components/EmergencyContactDispatchModal'

export function Dashboard() {
  const [events, setEvents] = useState<EmergencyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [armed, setArmed] = useState(false)
  const [sending, setSending] = useState(false)
  const [simSummary, setSimSummary] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showDispatchModal, setShowDispatchModal] = useState(false)
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

    const dispatched = await dispatchIncident({
      eventType: 'manual_sos',
      riskLevel: 'HIGH',
      triggerSource: 'manual_sos_button',
      decisionReason: decideAction('HIGH', 'manual_sos').reason,
    })
    if (!dispatched.incident) {
      if (activeRef.current) {
        setError(dispatched.error ?? 'Could not save emergency event')
        setSending(false)
      }
      return
    }

    const simulation = dispatched.simulation
    if (activeRef.current) {
      setSimSummary(
        simulation?.error
          ? `SOS saved locally; simulated notifications failed: ${simulation.error}`
          : `SOS saved locally. SIMULATED notifications prepared for ${simulation?.notified ?? 0} contact(s). No real message was sent.`,
      )
      setArmed(false)
      setSending(false)
    }

    try {
      const contactsRes = await listContacts()
      if (contactsRes.contacts && contactsRes.contacts.length > 0 && activeRef.current) {
        setContacts(contactsRes.contacts)
        setShowDispatchModal(true)
      }
    } catch {
      // Ignore background load error
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
          <div>
            <p role="status" className="sim-summary">
              {simSummary}
            </p>
            {contacts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDispatchModal(true)}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(225, 29, 72, 0.25)',
                }}
              >
                📱 Send Direct SMS / WhatsApp to Contacts ({contacts.length})
              </button>
            )}
          </div>
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

      {showDispatchModal && (
        <EmergencyContactDispatchModal
          contacts={contacts}
          onClose={() => setShowDispatchModal(false)}
        />
      )}
    </div>
  )
}
