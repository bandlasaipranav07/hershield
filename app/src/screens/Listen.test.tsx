import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Listen } from './Listen'

vi.mock('../lib/consent', () => ({
  hasVoiceConsent: vi.fn(),
  grantVoiceConsent: vi.fn(),
  revokeVoiceConsent: vi.fn(),
}))

vi.mock('../lib/voice', () => ({
  isVoiceSupported: vi.fn(),
  startVoiceCapture: vi.fn(),
}))

import { grantVoiceConsent, hasVoiceConsent, revokeVoiceConsent } from '../lib/consent'
import { isVoiceSupported, startVoiceCapture, type VoiceOutcome } from '../lib/voice'

const mockedGrant = vi.mocked(grantVoiceConsent)
const mockedHasConsent = vi.mocked(hasVoiceConsent)
const mockedRevoke = vi.mocked(revokeVoiceConsent)
const mockedSupported = vi.mocked(isVoiceSupported)
const mockedStart = vi.mocked(startVoiceCapture)

function renderListen() {
  return render(
    <MemoryRouter>
      <Listen />
    </MemoryRouter>,
  )
}

describe('Listen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedHasConsent.mockReturnValue(false)
    mockedSupported.mockReturnValue(true)
  })

  it('shows the unsupported notice when the browser lacks the Web Speech API', () => {
    mockedSupported.mockReturnValue(false)

    renderListen()

    expect(screen.getByRole('alert')).toHaveTextContent(/does not support/i)
    expect(screen.queryByRole('button', { name: /start listening/i })).not.toBeInTheDocument()
  })

  it('shows the consent panel before any mic use', () => {
    renderListen()

    expect(screen.getByRole('heading', { name: /before we use your microphone/i })).toBeInTheDocument()
    expect(screen.getByText(/browser.*speech service/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /i understand — enable voice detection/i })).toBeInTheDocument()
  })

  it('grants and persists consent when accepted', async () => {
    const user = userEvent.setup()

    renderListen()
    await user.click(screen.getByRole('button', { name: /i understand — enable voice detection/i }))

    expect(mockedGrant).toHaveBeenCalledOnce()
  })

  it('starts a capture session and shows the transcript with confidence', async () => {
    const user = userEvent.setup()
    mockedHasConsent.mockReturnValue(true)
    let resolveResult!: (value: VoiceOutcome) => void
    const result = new Promise<VoiceOutcome>((resolve) => {
      resolveResult = resolve
    })
    mockedStart.mockReturnValue({
      result,
      stop: vi.fn(),
    })

    renderListen()
    await user.click(screen.getByRole('button', { name: 'Start listening' }))
    expect(mockedStart).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()

    resolveResult({ transcript: 'please help me', confidence: 0.91, error: null })
    expect(await screen.findByText('please help me')).toBeInTheDocument()
    expect(screen.getByText(/0\.91/)).toBeInTheDocument()
    expect(screen.getByText(/reported only/i)).toBeInTheDocument()
  })

  it('shows a recognizer error as an alert', async () => {
    const user = userEvent.setup()
    mockedHasConsent.mockReturnValue(true)
    mockedStart.mockReturnValue({
      result: Promise.resolve({ transcript: '', confidence: null, error: 'Microphone permission denied' }),
      stop: vi.fn(),
    })

    renderListen()
    await user.click(screen.getByRole('button', { name: 'Start listening' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone permission denied')
  })

  it('revokes consent and returns to the consent panel', async () => {
    const user = userEvent.setup()
    mockedHasConsent.mockReturnValue(true)

    renderListen()
    await user.click(screen.getByRole('button', { name: /revoke mic consent/i }))

    expect(mockedRevoke).toHaveBeenCalledOnce()
    expect(await screen.findByRole('heading', { name: /before we use your microphone/i })).toBeInTheDocument()
  })

  it('stops an active capture when Stop is clicked', async () => {
    const user = userEvent.setup()
    mockedHasConsent.mockReturnValue(true)
    const stop = vi.fn()
    mockedStart.mockReturnValue({ result: new Promise(() => {}), stop })

    renderListen()
    await user.click(screen.getByRole('button', { name: 'Start listening' }))
    await user.click(screen.getByRole('button', { name: 'Stop' }))

    await waitFor(() => expect(stop).toHaveBeenCalledOnce())
  })

  it('stops an active capture when consent is revoked mid-listen', async () => {
    const user = userEvent.setup()
    mockedHasConsent.mockReturnValue(true)
    const stop = vi.fn()
    mockedStart.mockReturnValue({ result: new Promise(() => {}), stop })

    renderListen()
    await user.click(screen.getByRole('button', { name: 'Start listening' }))
    await user.click(screen.getByRole('button', { name: /revoke mic consent/i }))

    expect(stop).toHaveBeenCalledOnce()
    expect(mockedRevoke).toHaveBeenCalledOnce()
    expect(
      await screen.findByRole('heading', { name: /before we use your microphone/i }),
    ).toBeInTheDocument()
  })
})
