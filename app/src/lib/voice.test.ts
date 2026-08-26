import { afterEach, describe, expect, it, vi } from 'vitest'
import { isVoiceSupported, startVoiceCapture, type VoiceOutcome } from './voice'

interface FakeRecognition {
  continuous: boolean
  interimResults: boolean
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  abort: ReturnType<typeof vi.fn>
  onresult: ((event: unknown) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

class FakeSpeechRecognition implements FakeRecognition {
  static instances: FakeSpeechRecognition[] = []

  constructor() {
    FakeSpeechRecognition.instances.push(this)
  }

  continuous = false
  interimResults = false
  start = vi.fn()
  stop = vi.fn()
  abort = vi.fn()
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
}

function currentInstance(): FakeSpeechRecognition {
  const instances = FakeSpeechRecognition.instances
  return instances[instances.length - 1]
}

function emitResult(
  instance: FakeRecognition,
  results: Array<{ transcript: string; confidence?: number; isFinal?: boolean }>,
  resultIndex = 0,
) {
  instance.onresult?.({
    resultIndex,
    results: results.map((r) => {
      const alt = { transcript: r.transcript, confidence: r.confidence ?? 0 }
      const segment = { length: 1, isFinal: r.isFinal ?? true, 0: alt }
      return segment
    }),
  })
}

async function settle(session: { result: Promise<VoiceOutcome> }): Promise<VoiceOutcome> {
  const pending = session.result
  currentInstance()?.onend?.()
  return pending
}

describe('voice wrapper', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeSpeechRecognition.instances = []
  })

  it('reports unsupported when no SpeechRecognition exists', () => {
    expect(isVoiceSupported()).toBe(false)
    expect(startVoiceCapture()).toBeNull()
  })

  it('configures a short one-shot capture and reports support', () => {
    vi.stubGlobal('SpeechRecognition', FakeSpeechRecognition)

    expect(isVoiceSupported()).toBe(true)

    const session = startVoiceCapture()!
    expect(session).not.toBeNull()
    expect(currentInstance()?.continuous).toBe(false)
    expect(currentInstance()?.interimResults).toBe(true)
    expect(currentInstance()?.start).toHaveBeenCalledOnce()

    session.stop()
    expect(currentInstance()?.stop).toHaveBeenCalledOnce()
  })

  it('resolves with the final transcript and confidence', async () => {
    vi.stubGlobal('SpeechRecognition', FakeSpeechRecognition)
    const session = startVoiceCapture()!

    emitResult(currentInstance(), [
      { transcript: 'help me', confidence: 0.87, isFinal: true },
    ])

    await expect(settle(session)).resolves.toEqual({
      transcript: 'help me',
      confidence: 0.87,
      error: null,
    })
  })

  it('ignores interim results and joins final segments', async () => {
    vi.stubGlobal('SpeechRecognition', FakeSpeechRecognition)
    const session = startVoiceCapture()!

    emitResult(currentInstance(), [{ transcript: 'somebody', isFinal: false }])
    emitResult(currentInstance(), [{ transcript: 'please help me', confidence: 0.5, isFinal: true }])

    const outcome = await settle(session)

    expect(outcome.transcript).toBe('please help me')
    expect(outcome.confidence).toBe(0.5)
  })

  it('treats a zero confidence as not reported', async () => {
    vi.stubGlobal('SpeechRecognition', FakeSpeechRecognition)
    const session = startVoiceCapture()!

    emitResult(currentInstance(), [{ transcript: 'help', confidence: 0, isFinal: true }])

    await expect(settle(session)).resolves.toEqual({
      transcript: 'help',
      confidence: null,
      error: null,
    })
  })

  it('maps recognizer errors to friendly messages', async () => {
    vi.stubGlobal('SpeechRecognition', FakeSpeechRecognition)
    const session = startVoiceCapture()!

    currentInstance()?.onerror?.({ error: 'not-allowed' })

    await expect(settle(session)).resolves.toEqual({
      transcript: '',
      confidence: null,
      error: 'Microphone permission denied',
    })
  })

  it('treats aborted as a clean stop, not an error', async () => {
    vi.stubGlobal('SpeechRecognition', FakeSpeechRecognition)
    const session = startVoiceCapture()!
    emitResult(currentInstance(), [{ transcript: 'hello there', confidence: 0.4, isFinal: true }])

    session.stop()
    currentInstance()?.onerror?.({ error: 'aborted' })

    await expect(settle(session)).resolves.toEqual({
      transcript: 'hello there',
      confidence: 0.4,
      error: null,
    })
  })
})
