import { useState, useEffect, useRef } from 'react'
import type { Contact } from '../lib/contacts'
import {
  composeEmergencyMessage,
  openSmsApp,
  openWhatsAppChat,
  openPhoneDialer,
  sendWebhookSms,
  getCustomWebhookUrl,
} from '../lib/messaging/emergencyMessenger'

interface EmergencyContactDispatchModalProps {
  contacts: Contact[]
  onClose: () => void
  userName?: string
  location?: { lat: number; lng: number } | null
}

export function EmergencyContactDispatchModal({
  contacts,
  onClose,
  userName,
  location,
}: EmergencyContactDispatchModalProps) {
  const [copied, setCopied] = useState(false)
  const [webhookStatuses, setWebhookStatuses] = useState<Record<string, 'sending' | 'sent' | 'error' | 'idle'>>({})
  const message = composeEmergencyMessage(userName, location)
  const webhookUrl = getCustomWebhookUrl()

  const phoneContacts = contacts.filter((c) => Boolean(c.phone && c.phone.trim()))

  const autoDispatchedRef = useRef(false)

  useEffect(() => {
    if (autoDispatchedRef.current) return
    autoDispatchedRef.current = true

    // 1. If an automated SMS webhook/gateway is configured, send in the background
    if (webhookUrl && phoneContacts.length > 0) {
      for (const contact of phoneContacts) {
        setWebhookStatuses((prev) => ({ ...prev, [contact.id]: 'sending' }))
        void sendWebhookSms(contact, message).then((res) => {
          setWebhookStatuses((prev) => ({
            ...prev,
            [contact.id]: res.success ? 'sent' : 'error',
          }))
        })
      }
    } else {
      // 2. Automatically launch the device SMS app with pre-filled distress message & coordinates
      const targetPhone = phoneContacts.length > 0 ? phoneContacts[0].phone! : ''
      openSmsApp(targetPhone, message)
    }
  }, [webhookUrl, message, phoneContacts])

  function handleCopy() {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  function handleSendSms(contact: Contact) {
    if (!contact.phone) return
    openSmsApp(contact.phone, message)
  }

  function handleSendWhatsApp(contact: Contact) {
    if (!contact.phone) return
    openWhatsAppChat(contact.phone, message)
  }

  function handleCall(contact: Contact) {
    if (!contact.phone) return
    openPhoneDialer(contact.phone)
  }

  return (
    <div
      className="emergency-dispatch-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispatch-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="emergency-dispatch-card"
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 25px 50px -12px rgba(225, 29, 72, 0.35)',
          border: '2px solid rgba(244, 63, 94, 0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
            padding: '1.25rem',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
              }}
            >
              🚨
            </span>
            <div>
              <h2 id="dispatch-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                Emergency Alerts
              </h2>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                Send distress alert to your contacts now
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              color: '#ffffff',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Pre-composed alert message snippet */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '0.75rem',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Emergency Alert Message
              </span>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: copied ? '#059669' : '#7c3aed',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copied!' : 'Copy text'}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#1e293b', lineHeight: 1.4, fontStyle: 'italic' }}>
              &ldquo;{message}&rdquo;
            </p>
          </div>

          {/* Contacts List */}
          <div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
              Trusted Contacts ({phoneContacts.length})
            </h3>

            {phoneContacts.length === 0 ? (
              <div
                style={{
                  padding: '1rem',
                  textAlign: 'center',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '12px',
                }}
              >
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#991b1b', fontWeight: 600 }}>
                  No phone numbers found in your contacts.
                </p>
                <p style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.75rem', color: '#b91c1c' }}>
                  Add emergency contact phone numbers in the Contacts tab to send instant 1-tap alerts, or open your SMS app directly below:
                </p>
                <button
                  type="button"
                  onClick={() => openSmsApp('', message)}
                  style={{
                    padding: '0.55rem 1rem',
                    background: '#e11d48',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 4px 12px rgba(225, 29, 72, 0.25)',
                  }}
                >
                  📱 Open SMS App Now (Send to Any Number)
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => handleSendSms(phoneContacts[0])}
                  style={{
                    padding: '0.7rem 1rem',
                    background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 15px rgba(225, 29, 72, 0.35)',
                    marginBottom: '0.25rem',
                  }}
                >
                  🚨 Send SMS Now to {phoneContacts[0].name}
                </button>
                {phoneContacts.map((contact) => (
                  <div
                    key={contact.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{contact.name}</strong>
                        {contact.relation && (
                          <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.4rem' }}>
                            ({contact.relation})
                          </span>
                        )}
                        <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginTop: '0.1rem' }}>
                          📞 {contact.phone}
                        </div>
                      </div>

                      {webhookStatuses[contact.id] && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '9999px',
                            background:
                              webhookStatuses[contact.id] === 'sent'
                                ? '#dcfce7'
                                : webhookStatuses[contact.id] === 'error'
                                  ? '#fee2e2'
                                  : '#fef3c7',
                            color:
                              webhookStatuses[contact.id] === 'sent'
                                ? '#166534'
                                : webhookStatuses[contact.id] === 'error'
                                  ? '#991b1b'
                                  : '#92400e',
                          }}
                        >
                          {webhookStatuses[contact.id] === 'sent'
                            ? '✓ Gateway Sent'
                            : webhookStatuses[contact.id] === 'error'
                              ? 'Gateway Failed'
                              : 'Sending...'}
                        </span>
                      )}
                    </div>

                    {/* Action buttons to dispatch real messages */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => handleSendSms(contact)}
                        style={{
                          padding: '0.45rem',
                          background: '#7c3aed',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '10px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        📱 Send SMS
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendWhatsApp(contact)}
                        style={{
                          padding: '0.45rem',
                          background: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '10px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        💬 WhatsApp
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCall(contact)}
                        style={{
                          padding: '0.45rem',
                          background: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '10px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        📞 Call
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              background: '#475569',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
