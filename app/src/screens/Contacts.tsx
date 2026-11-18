import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  addContact,
  deleteContact,
  listContacts,
  updateContact,
  type Contact,
} from '../lib/contacts'
import {
  openSmsApp,
  openWhatsAppChat,
  openPhoneDialer,
  composeEmergencyMessage,
  getCustomWebhookUrl,
  setCustomWebhookUrl,
} from '../lib/messaging/emergencyMessenger'

export function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [relation, setRelation] = useState('')

  // SMS Gateway Webhook state
  const [webhookUrl, setWebhookUrlInput] = useState(() => getCustomWebhookUrl())
  const [showWebhookConfig, setShowWebhookConfig] = useState(false)
  const [webhookSavedNotice, setWebhookSavedNotice] = useState<string | null>(null)

  async function refresh() {
    const result = await listContacts()
    setContacts(result.contacts)
    setError(result.error)
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    listContacts().then((result) => {
      if (!active) return
      setContacts(result.contacts)
      setError(result.error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  function resetForm() {
    setName('')
    setPhone('')
    setEmail('')
    setRelation('')
    setEditing(null)
  }

  function startEdit(contact: Contact) {
    setEditing(contact)
    setName(contact.name)
    setPhone(contact.phone ?? '')
    setEmail(contact.email ?? '')
    setRelation(contact.relation ?? '')
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const input = { name, phone, email, relation }
    const result = editing ? await updateContact(editing.id, input) : await addContact(input)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    resetForm()
    await refresh()
  }

  async function handleDelete(id: string) {
    setError(null)
    const result = await deleteContact(id)
    if (result.error) {
      setError(result.error)
      return
    }
    await refresh()
  }

  function handleSaveWebhook() {
    setCustomWebhookUrl(webhookUrl)
    setWebhookSavedNotice('SMS Gateway webhook saved!')
    setTimeout(() => setWebhookSavedNotice(null), 3000)
  }

  return (
    <div className="contacts">
      <p>
        <Link to="/">&larr; Back to home</Link>
      </p>
      <h1>Emergency contacts</h1>
      <p className="subtitle">
        These contacts receive real distress alerts (via SMS / WhatsApp) and emergency notification records.
      </p>

      {/* SMS Gateway & Dispatch Settings */}
      <div
        className="sms-gateway-card"
        style={{
          marginBottom: '1.25rem',
          padding: '0.85rem 1rem',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.85)',
          border: '1px solid rgba(226, 218, 244, 0.8)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>📱</span>
            <div>
              <strong style={{ fontSize: '0.85rem', color: '#1b172a' }}>Direct Phone &amp; SMS Dispatch</strong>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#5e5774' }}>
                SOS opens native SMS &amp; WhatsApp directly to each contact number.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="config-toggle-btn"
            onClick={() => setShowWebhookConfig((prev) => !prev)}
          >
            {showWebhookConfig ? 'Hide Gateway' : 'Optional SMS Gateway'}
          </button>
        </div>

        {showWebhookConfig && (
          <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid #e0e7ff' }}>
            <label htmlFor="sms-webhook-input" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.25rem' }}>
              Automated SMS Gateway / Webhook URL (Twilio / Fast2SMS / Custom HTTP)
            </label>
            <input
              id="sms-webhook-input"
              type="url"
              placeholder="https://api.your-gateway.com/send-sms"
              value={webhookUrl}
              onChange={(e) => setWebhookUrlInput(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #d1d5db', background: '#ffffff', marginBottom: '0.5rem' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleSaveWebhook}
                style={{ padding: '0.45rem 1rem', background: '#7c3aed', color: '#ffffff', borderRadius: '8px', border: 'none', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Save Gateway
              </button>
              {webhookSavedNotice && (
                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>{webhookSavedNotice}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <form className="contact-form" onSubmit={handleSubmit}>
        <h2>{editing ? `Edit ${editing.name}` : 'Add contact'}</h2>

        <label htmlFor="contact-name">Name</label>
        <input
          id="contact-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label htmlFor="contact-phone">Phone</label>
        <input
          id="contact-phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <label htmlFor="contact-email">Email</label>
        <input
          id="contact-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="contact-relation">Relation</label>
        <input
          id="contact-relation"
          type="text"
          placeholder="e.g. mother, friend"
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
        />

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add contact'}
          </button>
          {editing && (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p>Loading contacts…</p>
      ) : contacts.length === 0 ? (
        <p>No contacts yet. Add your first emergency contact above.</p>
      ) : (
        <ul className="contact-list">
          {contacts.map((contact) => (
            <li key={contact.id} className="contact-card">
              <div className="contact-main">
                <div className="contact-avatar-badge" aria-hidden="true">
                  {contact.name.charAt(0).toUpperCase()}
                </div>
                <div className="contact-info">
                  <div className="contact-title-row">
                    <strong>{contact.name}</strong>
                    {contact.relation && <span className="relation">{contact.relation}</span>}
                  </div>
                  {contact.phone && (
                    <div className="contact-detail-row">
                      <span className="contact-field-icon" aria-hidden="true">📞</span>
                      <span>{contact.phone}</span>
                    </div>
                  )}
                  {contact.email && (
                    <div className="contact-detail-row">
                      <span className="contact-field-icon" aria-hidden="true">✉️</span>
                      <span>{contact.email}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="contact-actions">
                {contact.phone && (
                  <div className="contact-quick-dispatch">
                    <button
                      type="button"
                      className="contact-dispatch-btn btn-sms"
                      onClick={() => openSmsApp(contact.phone!, composeEmergencyMessage())}
                      title="Open default SMS app with distress message"
                    >
                      📱 SMS
                    </button>
                    <button
                      type="button"
                      className="contact-dispatch-btn btn-whatsapp"
                      onClick={() => openWhatsAppChat(contact.phone!, composeEmergencyMessage())}
                      title="Open WhatsApp chat with distress message"
                    >
                      💬 WhatsApp
                    </button>
                    <button
                      type="button"
                      className="contact-dispatch-btn btn-call"
                      onClick={() => openPhoneDialer(contact.phone!)}
                      title="Call emergency contact"
                    >
                      📞 Call
                    </button>
                  </div>
                )}
                <div className="contact-manage-btns">
                  <button
                    type="button"
                    className="btn-edit"
                    aria-label={`Edit ${contact.name}`}
                    onClick={() => startEdit(contact)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-delete"
                    aria-label={`Delete ${contact.name}`}
                    onClick={() => void handleDelete(contact.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
