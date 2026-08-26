export interface VoiceOutcome {
  transcript: string
  confidence: number | null
  error: string | null
}

export interface VoiceSession {
  result: Promise<VoiceOutcome>
  stop: () => void
}

interface RecognitionAlternativeLike {
  transcript: string
  confidence: number
}

interface RecognitionResultLike {
  readonly length: number
  isFinal: boolean
  [index: number]: RecognitionAlternativeLike
}

interface RecognitionEventLike {
  resultIndex: number
  results: { readonly length: number; [index: number]: RecognitionResultLike }
}

interface RecognitionErrorEventLike {
  error: string
}

interface RecognitionLike {
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: RecognitionEventLike) => void) | null
  onerror: ((event: RecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

type RecognitionCtor = new () => RecognitionLike

function getRecognitionCtor(): RecognitionCtor | null {
  const scope = globalThis as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

export function isVoiceSupported(): boolean {
  return getRecognitionCtor() !== null
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone permission denied',
  'service-not-allowed': 'Speech service blocked by the browser',
  'no-speech': 'No speech detected',
  'audio-capture': 'No microphone found',
  network: 'Speech service network error',
}

export function startVoiceCapture(): VoiceSession | null {
  const Ctor = getRecognitionCtor()
  if (!Ctor) {
    return null
  }

  const recognition = new Ctor()
  recognition.continuous = false
  recognition.interimResults = true

  let finalText = ''
  let confidence: number | null = null
  let failure: string | null = null
  let settled = false
  let resolveResult!: (outcome: VoiceOutcome) => void
  const result = new Promise<VoiceOutcome>((resolve) => {
    resolveResult = resolve
  })

  function settle() {
    if (settled) return
    settled = true
    resolveResult({ transcript: finalText.trim(), confidence, error: failure })
  }

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const segment = event.results[i]
      if (!segment.isFinal) continue
      for (let j = 0; j < segment.length; j++) {
        finalText += (finalText ? ' ' : '') + segment[j].transcript
      }
      const value = segment[0]?.confidence ?? 0
      confidence = value > 0 ? value : null
    }
  }

  recognition.onerror = (event) => {
    if (event.error === 'aborted') return
    failure = ERROR_MESSAGES[event.error] ?? 'Speech recognition failed'
  }

  recognition.onend = () => settle()

  recognition.start()

  return {
    result,
    stop: () => {
      try {
        recognition.stop()
      } catch {
        return
      }
    },
  }
}
