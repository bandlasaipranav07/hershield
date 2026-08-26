import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}))

import { supabase } from './supabase'
import { addContact, deleteContact, listContacts, updateContact } from './contacts'

const mockedFrom = vi.mocked(supabase.from)
const mockedGetSession = vi.mocked(supabase.auth.getSession)

interface ChainResult {
  data: unknown
  error: { message: string } | null
}

interface QueryChain {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  then: (onFulfilled: (value: ChainResult) => unknown) => unknown
}

function makeChain(result: Partial<ChainResult>): QueryChain {
  const resolved = { data: result.data ?? null, error: result.error ?? null }
  const chain = {} as QueryChain
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single'] as const) {
    chain[method] = vi.fn(() => chain)
  }
  chain.then = (onFulfilled) => onFulfilled(resolved)
  return chain
}

function makeContact(overrides: Record<string, unknown> = {}) {
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

describe('contacts helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    } as never)
  })

  describe('listContacts', () => {
    it('returns rows ordered by created_at ascending', async () => {
      const contact = makeContact()
      const chain = makeChain({ data: [contact], error: null })
      mockedFrom.mockReturnValue(chain as never)

      const result = await listContacts()

      expect(mockedFrom).toHaveBeenCalledWith('contacts')
      expect(chain.select).toHaveBeenCalledWith(
        'id, user_id, name, phone, email, relation, created_at',
      )
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true })
      expect(result).toEqual({ contacts: [contact], error: null })
    })

    it('maps a database error to its message', async () => {
      mockedFrom.mockReturnValue(makeChain({ error: { message: 'permission denied' } }) as never)

      const result = await listContacts()

      expect(result).toEqual({ contacts: [], error: 'permission denied' })
    })
  })

  describe('addContact', () => {
    const input = { name: '  Amma ', phone: ' +91 98765 43210 ', email: '', relation: ' mother ' }

    it('rejects an empty name without touching the database', async () => {
      const result = await addContact({ ...input, name: '   ' })

      expect(result.error).toBe('Name is required')
      expect(mockedFrom).not.toHaveBeenCalled()
    })

    it('fails fast when there is no signed-in user', async () => {
      const result = await addContact(input)

      expect(result.error).toBe('Not signed in')
      expect(mockedFrom).not.toHaveBeenCalled()
    })

    it('inserts trimmed fields with the session user id and returns the row', async () => {
      mockedGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      } as never)
      const row = makeContact()
      const chain = makeChain({ data: row, error: null })
      mockedFrom.mockReturnValue(chain as never)

      const result = await addContact(input)

      expect(chain.insert).toHaveBeenCalledWith({
        name: 'Amma',
        phone: '+91 98765 43210',
        email: null,
        relation: 'mother',
        user_id: 'user-1',
      })
      expect(chain.single).toHaveBeenCalledOnce()
      expect(result).toEqual({ contact: row, error: null })
    })

    it('maps an insert error to its message', async () => {
      mockedGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      } as never)
      mockedFrom.mockReturnValue(makeChain({ error: { message: 'new row violates RLS' } }) as never)

      const result = await addContact(input)

      expect(result.contact).toBeNull()
      expect(result.error).toBe('new row violates RLS')
    })
  })

  describe('updateContact', () => {
    const input = { name: 'Amma', phone: '', email: '', relation: '' }

    it('rejects an empty name', async () => {
      const result = await updateContact('contact-1', { ...input, name: '' })

      expect(result.error).toBe('Name is required')
      expect(mockedFrom).not.toHaveBeenCalled()
    })

    it('scopes the update to the row id and owner', async () => {
      mockedGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      } as never)
      const chain = makeChain({ data: null, error: null })
      mockedFrom.mockReturnValue(chain as never)

      const result = await updateContact('contact-1', input)

      expect(chain.update).toHaveBeenCalledWith({
        name: 'Amma',
        phone: null,
        email: null,
        relation: null,
      })
      expect(chain.eq).toHaveBeenCalledWith('id', 'contact-1')
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
      expect(result.error).toBeNull()
    })

    it('fails fast when not signed in', async () => {
      const result = await updateContact('contact-1', input)

      expect(result.error).toBe('Not signed in')
    })
  })

  describe('deleteContact', () => {
    it('scopes the delete to the row id and owner', async () => {
      mockedGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      } as never)
      const chain = makeChain({ data: null, error: null })
      mockedFrom.mockReturnValue(chain as never)

      const result = await deleteContact('contact-1')

      expect(mockedFrom).toHaveBeenCalledWith('contacts')
      expect(chain.delete).toHaveBeenCalledOnce()
      expect(chain.eq).toHaveBeenCalledWith('id', 'contact-1')
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
      expect(result.error).toBeNull()
    })

    it('fails fast when not signed in', async () => {
      const result = await deleteContact('contact-1')

      expect(result.error).toBe('Not signed in')
      expect(mockedFrom).not.toHaveBeenCalled()
    })
  })
})
