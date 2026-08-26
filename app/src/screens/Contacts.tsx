import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  addContact,
  deleteContact,
  listContacts,
  updateContact,
  type Contact,
} from '../lib/contacts'

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

  return (
    <div className="contacts">
      <p>
        <Link to="/">&larr; Back to home</Link>
      </p>
      <h1>Emergency contacts</h1>
      <p className="subtitle">
        These contacts receive SIMULATED notifications when an emergency event is created.
      </p>

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
              <div className="contact-info">
                <strong>{contact.name}</strong>
                {contact.relation && <span className="relation">{contact.relation}</span>}
                {contact.phone && <span>{contact.phone}</span>}
                {contact.email && <span>{contact.email}</span>}
              </div>
              <div className="contact-actions">
                <button
                  type="button"
                  aria-label={`Edit ${contact.name}`}
                  onClick={() => startEdit(contact)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${contact.name}`}
                  onClick={() => void handleDelete(contact.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
