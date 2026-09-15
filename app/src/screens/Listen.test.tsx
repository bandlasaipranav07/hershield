import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Listen } from './Listen'

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock('../lib/consent', () => ({
  hasVoiceConsent: vi.fn(),
  grantVoiceConsent: vi.fn(),
  revokeVoiceConsent: vi.fn(),
}))

vi.mock('../lib/voice', () => ({
  isVoiceSupported: vi.fn(),
  startVoiceCapture: vi.fn(),
}))

// Mock the microphone capture support check so tests don't depend on the
// browser Web Audio API being present in jsdom.
vi.mock('../lib/audio/microphoneCapture', () => ({
  isMicrophoneCaptureSupported: vi.fn(),
  MicrophoneCaptureAdapter: vi.fn(),
}))

// Mock the runtime so ARM/DISARM calls are tracked without real audio I/O.
vi.mock('../lib/core/runtime', () => {
  const arm = vi.fn().mockReturnValue({ success: true, previousState: 'DISARMED', currentState: 'ARMED' })
  const disarm = vi.fn().mockResolvedValue({ success: true, previousState: 'ARMED', currentState: 'DISARMED' })
  const isArmedGetter = vi.fn().mockReturnValue(false)
  const subscribe = vi.fn().mockReturnValue(() => {})
  const stateMachine = {
    arm,
    disarm,
    get isArmed() { return isArmedGetter() },
    subscribe,
  }
  const startAudioCapture = vi.fn().mockResolvedValue(true)
  const stopAudioCapture = vi.fn()
  const setCurrentTranscript = vi.fn()

  // Must use a regular function (not arrow) so `new HerShieldRuntime(...)` works.
  // oxlint-disable-next-line react/no-this-in-sfc
  function HerShieldRuntime(this: Record<string, unknown>) {
    // oxlint-disable-next-line react/no-this-in-sfc
    this.stateMachine = stateMachine
    // oxlint-disable-next-line react/no-this-in-sfc
    this.startAudioCapture = startAudioCapture
    // oxlint-disable-next-line react/no-this-in-sfc
    this.stopAudioCapture = stopAudioCapture
    // oxlint-disable-next-line react/no-this-in-sfc
    this.setCurrentTranscript = setCurrentTranscript
  }

  return { HerShieldRuntime }
})

import { grantVoiceConsent, hasVoiceConsent, revokeVoiceConsent } from '../lib/consent'
import { isVoiceSupported } from '../lib/voice'
import { isMicrophoneCaptureSupported } from '../lib/audio/microphoneCapture'

const mockedGrant = vi.mocked(grantVoiceConsent)
const mockedHasConsent = vi.mocked(hasVoiceConsent)
const mockedRevoke = vi.mocked(revokeVoiceConsent)
const mockedSpeechSupported = vi.mocked(isVoiceSupported)
const mockedMicSupported = vi.mocked(isMicrophoneCaptureSupported)

function renderListen() {
  return render(
    <MemoryRouter>
      <Listen />
    </MemoryRouter>,
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Listen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedHasConsent.mockReturnValue(false)
    mockedSpeechSupported.mockReturnValue(true)
    mockedMicSupported.mockReturnValue(true)
  })

  it('shows the unsupported notice when the browser lacks the Web Speech API', () => {
    mockedSpeechSupported.mockReturnValue(false)

    renderListen()

    expect(screen.getByRole('alert')).toHaveTextContent(/does not support/i)
    expect(screen.queryByRole('button', { name: /arm monitoring/i })).not.toBeInTheDocument()
  })

  it('shows the unsupported notice when the browser lacks the Web Audio API', () => {
    mockedMicSupported.mockReturnValue(false)

    renderListen()

    expect(screen.getByRole('alert')).toHaveTextContent(/does not support the web audio api/i)
    expect(screen.queryByRole('button', { name: /arm monitoring/i })).not.toBeInTheDocument()
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

  it('shows the ARM button after consent is granted', () => {
    mockedHasConsent.mockReturnValue(true)

    renderListen()

    expect(screen.getByRole('button', { name: /arm monitoring/i })).toBeInTheDocument()
    expect(screen.getByText(/disarmed/i)).toBeInTheDocument()
  })

  it('revokes consent and returns to the consent panel', async () => {
    const user = userEvent.setup()
    mockedHasConsent.mockReturnValue(true)

    renderListen()
    await user.click(screen.getByRole('button', { name: /revoke mic consent/i }))

    expect(mockedRevoke).toHaveBeenCalledOnce()
    expect(await screen.findByRole('heading', { name: /before we use your microphone/i })).toBeInTheDocument()
  })

  it('shows DISARM button after arming', async () => {
    const user = userEvent.setup()
    mockedHasConsent.mockReturnValue(true)

    renderListen()
    await user.click(screen.getByRole('button', { name: /arm monitoring/i }))

    expect(await screen.findByRole('button', { name: /disarm/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /arm monitoring/i })).not.toBeInTheDocument()
  })
})
