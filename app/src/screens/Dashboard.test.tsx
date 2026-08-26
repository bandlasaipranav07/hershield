import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from './Dashboard'
import type { EmergencyEvent } from '../lib/events'

vi.mock('../lib/events', () => ({
  createEmergencyEvent: vi.fn(),
  listEmergencyEvents: vi.fn(),
}))

vi.mock('../lib/notify', () => ({
  simulateNotifications: vi.fn(),
}))

import { createEmergencyEvent, listEmergencyEvents } from '../lib/events'
import { simulateNotifications } from '../lib/notify'

const mockedCreate = vi.mocked(createEmergencyEvent)
const mockedList = vi.mocked(listEmergencyEvents)
const mockedSimulate = vi.mocked(simulateNotifications)

function makeEvent(overrides: Partial<EmergencyEvent> = {}): EmergencyEvent {
  return {
    id: 'event-1',
    user_id: 'user-1',
    event_type: 'manual_sos',
    risk_level: 'high',
    intent_level: null,
    threat_level: null,
    safety_mode: null,
    journey_status: null,
    transcript: null,
    transcript_summary: null,
    trigger_source: 'manual_sos_button',
    location_lat: 17.385,
    location_lng: 78.4867,
    location_accuracy: 12.5,
    asr_confidence: null,
    decision_reason: 'Manual SOS bypasses the risk engine and always escalates',
    resolved_at: null,
    created_at: '2026-08-26T10:00:00.000Z',
    ...overrides,
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedList.mockResolvedValue({ events: [], error: null })
  })

  it('shows the SOS button and an empty state when no events exist', async () => {
    renderDashboard()

    expect(screen.getByRole('button', { name: 'SOS' })).toBeInTheDocument()
    expect(await screen.findByText(/no emergency events yet/i)).toBeInTheDocument()
  })

  it('renders past events with risk badge, details and explanation', async () => {
    mockedList.mockResolvedValue({
      events: [
        makeEvent(),
        makeEvent({
          id: 'event-2',
          event_type: 'voice_detected',
          risk_level: 'medium',
          intent_level: 'MEDIUM',
          asr_confidence: 0.4,
          location_lat: null,
          location_lng: null,
          transcript_summary: 'worried phrasing',
          decision_reason: 'intent MEDIUM(3) -> MEDIUM',
        }),
      ],
      error: null,
    })

    renderDashboard()

    expect(await screen.findByText('Manual SOS')).toBeInTheDocument()
    expect(screen.getByText('Voice detected')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(
      screen.getByText('Manual SOS bypasses the risk engine and always escalates'),
    ).toBeInTheDocument()
    expect(screen.getByText('intent MEDIUM(3) -> MEDIUM').className).toBe('reason-line')
    expect(screen.getByText('17.38500, 78.48670')).toBeInTheDocument()
    const mediumBadge = screen.getAllByText('MEDIUM')
    expect(mediumBadge.length).toBeGreaterThanOrEqual(1)
  })

  it('shows a load error as an alert', async () => {
    mockedList.mockResolvedValue({ events: [], error: 'permission denied' })

    renderDashboard()

    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied')
  })

  it('requires a second confirmation tap before triggering the SOS', async () => {
    const user = userEvent.setup()

    renderDashboard()
    await user.click(screen.getByRole('button', { name: 'SOS' }))

    expect(screen.getByText(/trigger emergency now/i)).toBeInTheDocument()
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('creates a manual SOS event, simulates notifications, and refreshes', async () => {
    const user = userEvent.setup()
    const saved = makeEvent()
    mockedCreate.mockResolvedValue({ event: saved, error: null })
    mockedSimulate.mockResolvedValue({ notified: 2, error: null })
    let calls = 0
    mockedList.mockImplementation(async () => {
      calls += 1
      return { events: calls >= 2 ? [saved] : [], error: null }
    })

    renderDashboard()
    await screen.findByText(/no emergency events yet/i)

    await user.click(screen.getByRole('button', { name: 'SOS' }))
    await user.click(screen.getByRole('button', { name: /yes — trigger sos/i }))

    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledWith({
        eventType: 'manual_sos',
        riskLevel: 'HIGH',
        triggerSource: 'manual_sos_button',
        decisionReason: expect.stringContaining('bypasses the risk engine'),
      }),
    )
    expect(mockedSimulate).toHaveBeenCalledWith(saved)
    expect(
      await screen.findByText(/simulated notifications prepared for 2 contact/i),
    ).toBeInTheDocument()
    expect(await screen.findByText('Manual SOS')).toBeInTheDocument()
  })

  it('shows a creation error and keeps the confirm state for retry', async () => {
    const user = userEvent.setup()
    mockedCreate.mockResolvedValue({ event: null, error: 'new row violates RLS' })

    renderDashboard()
    await user.click(screen.getByRole('button', { name: 'SOS' }))
    await user.click(screen.getByRole('button', { name: /yes — trigger sos/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('new row violates RLS')
    expect(screen.getByRole('button', { name: /yes — trigger sos/i })).toBeInTheDocument()
  })

  it('surfaces notification failures separately from event creation', async () => {
    const user = userEvent.setup()
    mockedCreate.mockResolvedValue({ event: makeEvent(), error: null })
    mockedSimulate.mockResolvedValue({ notified: 0, error: 'Failed to fetch' })

    renderDashboard()
    await screen.findByText(/no emergency events yet/i)

    await user.click(screen.getByRole('button', { name: 'SOS' }))
    await user.click(screen.getByRole('button', { name: /yes — trigger sos/i }))

    expect(
      await screen.findByText(/notifications failed: Failed to fetch/i),
    ).toBeInTheDocument()
  })
})
