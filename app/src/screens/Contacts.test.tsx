import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Contacts } from './Contacts'
import type { Contact } from '../lib/contacts'

vi.mock('../lib/contacts', () => ({
  listContacts: vi.fn(),
  addContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
}))

import {
  addContact,
  deleteContact,
  listContacts,
  updateContact,
} from '../lib/contacts'

const mockedAdd = vi.mocked(addContact)
const mockedDelete = vi.mocked(deleteContact)
const mockedList = vi.mocked(listContacts)
const mockedUpdate = vi.mocked(updateContact)

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'contact-1',
    user_id: 'user-1',
    name: 'Amma',
    phone: '+91 98765 43210',
    email: 'amma@example.com',
    relation: 'mother',
    created_at: '2026-08-26T00:00:00.000Z',
    ...overrides,
  }
}

function renderContacts() {
  return render(
    <MemoryRouter>
      <Contacts />
    </MemoryRouter>,
  )
}

describe('Contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedList.mockResolvedValue({ contacts: [], error: null })
  })

  it('renders the form and an empty-state message', async () => {
    renderContacts()

    expect(screen.getByRole('heading', { name: /emergency contacts/i })).toBeInTheDocument()
    expect(await screen.findByText(/no contacts yet/i)).toBeInTheDocument()
  })

  it('lists existing contacts with their details', async () => {
    mockedList.mockResolvedValue({ contacts: [makeContact()], error: null })

    renderContacts()

    expect(await screen.findByText('Amma')).toBeInTheDocument()
    expect(screen.getByText('+91 98765 43210')).toBeInTheDocument()
    expect(screen.getByLabelText('Edit Amma')).toBeInTheDocument()
    expect(screen.getByLabelText('Delete Amma')).toBeInTheDocument()
  })

  it('shows an alert when loading contacts fails', async () => {
    mockedList.mockResolvedValue({ contacts: [], error: 'permission denied' })

    renderContacts()

    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied')
  })

  it('adds a contact from the form and refreshes the list', async () => {
    const user = userEvent.setup()
    mockedAdd.mockResolvedValue({ contact: makeContact(), error: null })

    renderContacts()
    await screen.findByText(/no contacts yet/i)

    await user.type(screen.getByLabelText('Name'), 'Amma')
    await user.type(screen.getByLabelText('Phone'), '+91 98765 43210')
    await user.type(screen.getByLabelText('Relation'), 'mother')
    await user.click(screen.getByRole('button', { name: 'Add contact' }))

    await waitFor(() =>
      expect(mockedAdd).toHaveBeenCalledWith({
        name: 'Amma',
        phone: '+91 98765 43210',
        email: '',
        relation: 'mother',
      }),
    )
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
  })

  it('shows the submit error as an alert', async () => {
    const user = userEvent.setup()
    mockedAdd.mockResolvedValue({ contact: null, error: 'Not signed in' })

    renderContacts()
    await screen.findByText(/no contacts yet/i)

    await user.type(screen.getByLabelText('Name'), 'Amma')
    await user.click(screen.getByRole('button', { name: 'Add contact' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Not signed in')
  })

  it('populates the form for editing and submits an update', async () => {
    const user = userEvent.setup()
    mockedList.mockResolvedValue({ contacts: [makeContact()], error: null })
    mockedUpdate.mockResolvedValue({ error: null })

    renderContacts()
    await screen.findByText('Amma')

    await user.click(screen.getByLabelText('Edit Amma'))
    expect(screen.getByRole('heading', { name: /edit amma/i })).toBeInTheDocument()

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    expect(nameInput.value).toBe('Amma')

    await user.clear(nameInput)
    await user.type(nameInput, 'Dad')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(
        'contact-1',
        expect.objectContaining({ name: 'Dad' }),
      ),
    )
  })

  it('cancels editing and resets the form', async () => {
    const user = userEvent.setup()
    mockedList.mockResolvedValue({ contacts: [makeContact()], error: null })

    renderContacts()
    await screen.findByText('Amma')

    await user.click(screen.getByLabelText('Edit Amma'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('heading', { name: 'Add contact' })).toBeInTheDocument()
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    expect(nameInput.value).toBe('')
  })

  it('deletes a contact and refreshes the list', async () => {
    const user = userEvent.setup()
    mockedList.mockResolvedValue({ contacts: [makeContact()], error: null })
    mockedDelete.mockResolvedValue({ error: null })

    renderContacts()
    await screen.findByText('Amma')

    await user.click(screen.getByLabelText('Delete Amma'))

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('contact-1'))
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
  })
})
