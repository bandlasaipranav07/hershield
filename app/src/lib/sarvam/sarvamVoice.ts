/**
 * Sarvam AI Speech-to-Text Voice Integration for HerShield
 * Uses Sarvam's Indic-specialised `saaras:v4` model to transcribe
 * voice audio across English and 22 Indian languages.
 */

import type { VoiceOutcome, VoiceSession } from '../voice'

const SARVAM_STORAGE_KEY = 'hershield_sarvam_api_key'
const SARVAM_LANG_KEY = 'hershield_sarvam_language'
const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text'

export interface SarvamConfig {
  apiKey: string
  languageCode: string
  model: string
}

export function getSarvamApiKey(): string {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(SARVAM_STORAGE_KEY)
    if (stored && stored.trim()) return stored.trim()
  }
  const envKey = import.meta.env.VITE_SARVAM_API_KEY
  return typeof envKey === 'string' ? envKey.trim() : ''
}

export function setSarvamApiKey(key: string): void {
  if (typeof window === 'undefined') return
  if (key && key.trim()) {
    window.localStorage.setItem(SARVAM_STORAGE_KEY, key.trim())
  } else {
    window.localStorage.removeItem(SARVAM_STORAGE_KEY)
  }
}

export function getSarvamLanguage(): string {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(SARVAM_LANG_KEY)
    if (stored) return stored
  }
  return 'unknown' // Auto-detection by default
}

export function setSarvamLanguage(lang: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SARVAM_LANG_KEY, lang)
}

export function isSarvamConfigured(): boolean {
  return Boolean(getSarvamApiKey())
}

/**
 * Transcribe an audio Blob using Sarvam AI REST API
 */
export async function transcribeWithSarvam(
  audioBlob: Blob,
  apiKey?: string,
  languageCode?: string,
): Promise<{ transcript: string; confidence: number | null; languageCode: string | null }> {
  const key = apiKey || getSarvamApiKey()
  if (!key) {
    throw new Error('Sarvam API key is not configured.')
  }

  const lang = languageCode || getSarvamLanguage()

  const formData = new FormData()
  const filename = audioBlob.type.includes('wav') ? 'audio.wav' : 'audio.webm'
  formData.append('file', audioBlob, filename)
  formData.append('model', 'saaras:v4')
  formData.append('mode', 'transcribe')
  if (lang && lang !== 'unknown') {
    formData.append('language_code', lang)
  }

  const response = await fetch(SARVAM_STT_URL, {
    method: 'POST',
    headers: {
      'api-subscription-key': key,
    },
    body: formData,
  })

  if (!response.ok) {
    let errorDetail = ''
    try {
      const errJson = await response.json()
      errorDetail = errJson.message || errJson.error || JSON.stringify(errJson)
    } catch {
      errorDetail = await response.text()
    }
    throw new Error(`Sarvam STT failed (${response.status}): ${errorDetail}`)
  }

  const data = await response.json()
  const transcript: string = (data.transcript || '').trim()
  const confidence: number | null =
    typeof data.language_probability === 'number'
      ? data.language_probability
      : transcript.length > 0
        ? 0.95
        : null

  return {
    transcript,
    confidence,
    languageCode: data.language_code || null,
  }
}

/**
 * Capture microphone audio via MediaRecorder for 4 seconds,
 * then send to Sarvam AI STT for transcription.
 */
export function startSarvamVoiceCapture(): VoiceSession | null {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof MediaRecorder === 'undefined'
  ) {
    return null
  }

  let mediaStream: MediaStream | null = null
  let recorder: MediaRecorder | null = null
  let stopped = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  let resolveResult!: (outcome: VoiceOutcome) => void
  const result = new Promise<VoiceOutcome>((resolve) => {
    resolveResult = resolve
  })

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (mediaStream) {
      for (const track of mediaStream.getTracks()) {
        try {
          track.stop()
        } catch {
          // Ignore track stop error
        }
      }
      mediaStream = null
    }
  }

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      if (stopped) {
        for (const track of stream.getTracks()) track.stop()
        resolveResult({ transcript: '', confidence: null, error: null })
        return
      }

      mediaStream = stream
      const chunks: Blob[] = []

      // Pick best supported mimeType
      let mimeType = 'audio/webm'
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4'
        else if (MediaRecorder.isTypeSupported('audio/aac')) mimeType = 'audio/aac'
        else mimeType = ''
      }

      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      } catch {
        recorder = new MediaRecorder(stream)
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      recorder.onstop = async () => {
        cleanup()
        if (chunks.length === 0) {
          resolveResult({ transcript: '', confidence: null, error: null })
          return
        }

        const audioBlob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' })

        // Don't transcribe tiny empty bursts (< 500 bytes)
        if (audioBlob.size < 500) {
          resolveResult({ transcript: '', confidence: null, error: null })
          return
        }

        try {
          const res = await transcribeWithSarvam(audioBlob)
          resolveResult({
            transcript: res.transcript,
            confidence: res.confidence,
            error: null,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Sarvam STT failed'
          resolveResult({
            transcript: '',
            confidence: null,
            error: msg,
          })
        }
      }

      recorder.start()

      // Record for 4.2 seconds chunks for responsive real-time threat detection
      timeoutId = setTimeout(() => {
        if (recorder && recorder.state === 'recording') {
          recorder.stop()
        }
      }, 4200)
    })
    .catch((err) => {
      cleanup()
      const msg = err instanceof Error ? err.message : 'Microphone access denied'
      resolveResult({
        transcript: '',
        confidence: null,
        error: msg,
      })
    })

  return {
    result,
    stop: () => {
      stopped = true
      if (recorder && recorder.state === 'recording') {
        try {
          recorder.stop()
        } catch {
          // Ignore stop errors
        }
      } else {
        cleanup()
        resolveResult({ transcript: '', confidence: null, error: null })
      }
    },
  }
}
