import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dispatchIncident } from '../lib/core/incidentDispatcher'
import { decideAction } from '../lib/policy'
import { listContacts, type Contact } from '../lib/contacts'
import { isVoiceMonitoringActive, disarmGlobalMonitoring, getGlobalThreatStatus } from './Listen'
import { EmergencyContactDispatchModal } from '../components/EmergencyContactDispatchModal'

export function Home() {
  const [sosArmed, setSosArmed] = useState(false)
  const [sending, setSending] = useState(false)
  const [simSummary, setSimSummary] = useState<string | null>(null)
  const [sosError, setSosError] = useState<string | null>(null)
  const [monitoringActive, setMonitoringActive] = useState(() => isVoiceMonitoringActive())
  const [threatStatus, setThreatStatus] = useState(() => getGlobalThreatStatus())
  const [sosContacts, setSosContacts] = useState<Contact[]>([])
  const [showDispatchModal, setShowDispatchModal] = useState(false)

  useEffect(() => {
    const handleMonitorChange = () => {
      setMonitoringActive(isVoiceMonitoringActive())
      setThreatStatus(getGlobalThreatStatus())
    }
    window.addEventListener('hershield_monitor_change', handleMonitorChange)
    return () => {
      window.removeEventListener('hershield_monitor_change', handleMonitorChange)
    }
  }, [])

  async function handleDisarm() {
    await disarmGlobalMonitoring()
    setMonitoringActive(false)
    setThreatStatus('DISARMED')
  }

  async function handleSos() {
    setSosError(null)
    setSimSummary(null)
    setSending(true)

    const dispatched = await dispatchIncident({
      eventType: 'manual_sos',
      riskLevel: 'HIGH',
      triggerSource: 'manual_sos_button',
      decisionReason: decideAction('HIGH', 'manual_sos').reason,
    })

    if (!dispatched.incident) {
      setSosError(dispatched.error ?? 'Could not save emergency event')
      setSending(false)
      return
    }

    const simulation = dispatched.simulation
    setSimSummary(
      simulation?.error
        ? `SOS saved. Simulated notifications failed: ${simulation.error}`
        : `SOS sent to ${simulation?.notified ?? 0} contact(s). (SIMULATED)`,
    )
    setSosArmed(false)
    setSending(false)

    // Load user's emergency contacts to enable real SMS / WhatsApp dispatch
    try {
      const contactsRes = await listContacts()
      setSosContacts(contactsRes.contacts ?? [])
      setShowDispatchModal(true)
    } catch {
      setSosContacts([])
      setShowDispatchModal(true)
    }
  }

  return (
    <main className="home-hub-page">
      <div className="home-hub-container">
        
        {/* Intro Header */}
        <header className="home-intro">
          <p className="home-eyebrow">YOUR SAFETY SPACE</p>
          <h1>Welcome back</h1>
          <p>Manage your safety tools, trusted contacts, and recent activity.</p>
        </header>

        {/* ── Prominent Emergency Action Hero ────────────────────────────── */}
        <section className="sos-action-hero" aria-label="Emergency SOS">
          <div className="sos-hero-card">
            <div className="sos-hero-top">
              <span className="sos-pulse-dot" aria-hidden="true" />
              <span className="sos-hero-caption">Instant Emergency Trigger</span>
            </div>

            {!sosArmed ? (
              <div className="sos-btn-wrapper">
                <span className="sos-ring-pulse sos-ring-1" aria-hidden="true" />
                <span className="sos-ring-pulse sos-ring-2" aria-hidden="true" />
                <button
                  type="button"
                  className="sos-main-btn"
                  onClick={() => setSosArmed(true)}
                  aria-label="Trigger SOS emergency"
                >
                  <span className="sos-btn-label">SOS</span>
                </button>
              </div>
            ) : (
              <div className="sos-confirm-dialog">
                <p className="sos-confirm-title">Trigger emergency now?</p>
                <p className="sos-confirm-sub">Contacts will be notified (simulated)</p>
                <div className="sos-confirm-buttons">
                  <button
                    type="button"
                    className="sos-btn-confirm"
                    disabled={sending}
                    onClick={() => void handleSos()}
                  >
                    {sending ? 'Sending…' : 'Yes — SOS now'}
                  </button>
                  <button
                    type="button"
                    className="sos-btn-cancel"
                    disabled={sending}
                    onClick={() => { setSosArmed(false); setSosError(null) }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {sosError && (
              <p role="alert" className="sos-alert sos-alert--error">{sosError}</p>
            )}
            {simSummary && (
              <div style={{ width: '100%' }}>
                <p role="status" className="sos-alert sos-alert--success">{simSummary}</p>
                {sosContacts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowDispatchModal(true)}
                    style={{
                      marginTop: '0.5rem',
                      width: '100%',
                      padding: '0.6rem 1rem',
                      background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(225, 29, 72, 0.3)',
                    }}
                  >
                    📱 Send Direct SMS / WhatsApp to Contacts ({sosContacts.length})
                  </button>
                )}
              </div>
            )}

            <p className="sos-hint-text">Tap SOS for immediate simulated emergency escalation</p>
          </div>
        </section>

        {/* ── Voice Check Status Monitor Card ────────────────────────────── */}
        <section className={`monitor-card${monitoringActive ? ' monitor-card--active' : ''}`} aria-labelledby="monitor-heading">
          <div className="monitor-card-copy">
            <p className={`monitor-state${monitoringActive ? ' monitor-state--active' : ''}`}>
              <span className={`monitor-state-dot${monitoringActive ? ' monitor-state-dot--active' : ''}`} aria-hidden="true" />
              {monitoringActive ? 'Monitoring is active' : 'Monitoring is off'}
            </p>
            <h2 id="monitor-heading">Voice check</h2>
            <p>
              {monitoringActive
                ? `Acoustic monitoring active (${threatStatus}) — protection continues across all tabs.`
                : 'HerShield does not listen in the background. Review the microphone details and choose when to start a check.'}
            </p>
            {monitoringActive ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => void handleDisarm()}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '12px',
                    background: '#e11d48',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(225, 29, 72, 0.25)',
                  }}
                >
                  DISARM
                </button>
                <Link to="/listen" className="home-secondary-link" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#7c3aed' }}>
                  Open voice check &rarr;
                </Link>
              </div>
            ) : (
              <Link to="/listen" className="home-primary-link">Review voice check</Link>
            )}
          </div>
          <div className="monitor-card-note">
            <strong>{monitoringActive ? 'Active Protection' : 'You stay in control'}</strong>
            <span>
              {monitoringActive
                ? 'Microphone monitoring is active in the background. Disarm anytime above.'
                : 'Voice monitoring starts only after consent and a deliberate tap on ARM.'}
            </span>
          </div>
        </section>

        {/* ── Safety Tools Grid ─────────────────────────────────────────── */}
        <section className="home-section" aria-labelledby="tools-heading">
          <div className="home-section-heading">
            <div>
              <p className="home-eyebrow">YOUR TOOLS</p>
              <h2 id="tools-heading">What would you like to do?</h2>
            </div>
          </div>

          <div className="hub-grid">
            <Link to="/dashboard" className="hub-card hub-card-sos">
              <div className="hub-card-icon hub-icon-activity" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div className="hub-card-content">
                <strong>Activity &amp; SOS</strong>
                <span>Review events or open the simulated SOS flow.</span>
              </div>
              <span className="hub-card-arrow" aria-hidden="true">→</span>
            </Link>

            <Link to="/contacts" className="hub-card hub-card-contacts">
              <div className="hub-card-icon hub-icon-contacts" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div className="hub-card-content">
                <strong>Emergency contacts</strong>
                <span>Add or update the people listed for simulated notifications.</span>
              </div>
              <span className="hub-card-arrow" aria-hidden="true">→</span>
            </Link>

            <Link to="/testing" className="hub-card hub-card-testing">
              <div className="hub-card-icon hub-icon-lab" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3h6"/>
                  <path d="M10 3v7.4a2 2 0 0 1-.6 1.4L4 17.2A2 2 0 0 0 5.4 21h13.2a2 2 0 0 0 1.4-3.4L14.6 12a2 2 0 0 1-.6-1.4V3"/>
                </svg>
              </div>
              <div className="hub-card-content">
                <strong>Test lab</strong>
                <span>Explore sample cases and the research classifier.</span>
              </div>
              <span className="hub-card-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        {/* ── Demo Disclaimer Note ───────────────────────────────────────── */}
        <aside className="home-demo-note">
          <strong>Demo only</strong>
          <span>
            SOS and contact notifications are simulations. HerShield does not contact emergency
            services.
          </span>
        </aside>
      </div>

      {showDispatchModal && (
        <EmergencyContactDispatchModal
          contacts={sosContacts}
          onClose={() => setShowDispatchModal(false)}
        />
      )}
    </main>
  )
}
