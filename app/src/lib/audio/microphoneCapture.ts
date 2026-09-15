/**
 * MicrophoneCaptureAdapter
 *
 * Manages the Web Audio API microphone pipeline:
 *   getUserMedia → AudioContext → MediaStreamSourceNode
 *   → ScriptProcessorNode → Float32 PCM samples → onFrame callback
 *
 * Design principles:
 * - Isolation: purely responsible for audio capture and PCM extraction.
 *   No risk logic, no incident handling, no storage.
 * - Privacy: samples are delivered as transient Float32Array frames only.
 *   This adapter never writes audio to any persistent storage.
 * - Lifecycle safety: stop() fully releases the MediaStream, disconnects all
 *   nodes, and closes the AudioContext. Must be called on DISARM.
 *
 * Platform notes:
 * - Requires navigator.mediaDevices.getUserMedia (HTTPS or localhost).
 * - ScriptProcessorNode is used for broad browser compatibility. It is
 *   deprecated in the Web Audio spec but remains widely supported. An
 *   AudioWorklet upgrade path is documented as future work.
 * - The browser's SpeechRecognition API (voice.ts) is a separate channel
 *   for transcript generation and is NOT provided by this adapter.
 */

/** Possible states of the microphone capture lifecycle. */
export type MicCaptureState =
  | 'IDLE'
  | 'REQUESTING'
  | 'ACTIVE'
  | 'STOPPED'
  | 'ERROR'

/** Error codes that can be reported by the adapter. */
export type MicCaptureError =
  | 'PERMISSION_DENIED'
  | 'DEVICE_NOT_FOUND'
  | 'BROWSER_UNSUPPORTED'
  | 'AUDIO_CONTEXT_FAILED'
  | 'STREAM_ENDED'
  | 'UNKNOWN'

export interface MicCaptureFrame {
  /** PCM samples from the current processing frame (genuine microphone input). */
  samples: Float32Array
  /**
   * Frequency-domain magnitude data (0–255 per bin) from an AnalyserNode.
   * Used by the AcousticAnalyzer for spectral centroid computation.
   */
  frequencyData: Uint8Array
  /** Wall-clock timestamp of this frame (ms). */
  timestamp: number
}

export interface MicCaptureCallbacks {
  /** Called for every audio processing frame while ACTIVE. */
  onFrame: (frame: MicCaptureFrame) => void
  /** Called once when the adapter transitions to ERROR or the stream ends unexpectedly. */
  onError: (error: MicCaptureError, detail: string) => void
}

/**
 * Internal interface that wraps the getUserMedia dependency so the adapter
 * can be unit-tested without a real browser microphone.
 */
export interface MediaDevicesLike {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>
}

/** Configuration for the capture pipeline. */
export interface MicCaptureConfig {
  /** ScriptProcessorNode buffer size. Must be a power of 2 in [256, 16384]. Default 4096. */
  bufferSize?: number
  /** Number of FFT bins for the AnalyserNode. Power of 2. Default 256. */
  fftSize?: number
  /** Audio sample rate hint. Browsers may ignore or round this. Default 16000. */
  sampleRate?: number
  /**
   * Override the mediaDevices implementation. Used in tests to inject a fake.
   * Defaults to navigator.mediaDevices.
   */
  mediaDevicesOverride?: MediaDevicesLike
  /**
   * Override AudioContext constructor. Used in tests.
   * Defaults to window.AudioContext.
   */
  audioContextFactory?: (sampleRate: number) => AudioContext
}

const DEFAULT_BUFFER_SIZE = 4096
const DEFAULT_FFT_SIZE = 256
const DEFAULT_SAMPLE_RATE = 16000

export class MicrophoneCaptureAdapter {
  private _state: MicCaptureState = 'IDLE'
  private _stream: MediaStream | null = null
  private _context: AudioContext | null = null
  private _sourceNode: MediaStreamAudioSourceNode | null = null
  private _processorNode: ScriptProcessorNode | null = null
  private _analyserNode: AnalyserNode | null = null

  private readonly _bufferSize: number
  private readonly _fftSize: number
  private readonly _sampleRate: number
  private readonly _mediaDevicesOverride: MediaDevicesLike | undefined
  private readonly _audioContextFactory: ((sampleRate: number) => AudioContext) | undefined
  private readonly _callbacks: MicCaptureCallbacks

  constructor(callbacks: MicCaptureCallbacks, config: MicCaptureConfig = {}) {
    this._callbacks = callbacks
    this._bufferSize = config.bufferSize ?? DEFAULT_BUFFER_SIZE
    this._fftSize = config.fftSize ?? DEFAULT_FFT_SIZE
    this._sampleRate = config.sampleRate ?? DEFAULT_SAMPLE_RATE
    this._mediaDevicesOverride = config.mediaDevicesOverride
    this._audioContextFactory = config.audioContextFactory
  }

  public get state(): MicCaptureState {
    return this._state
  }

  public get isActive(): boolean {
    return this._state === 'ACTIVE'
  }

  /**
   * Start microphone capture.
   * Resolves to true on success, false on failure (error already reported via onError).
   */
  public async start(): Promise<boolean> {
    if (this._state === 'ACTIVE' || this._state === 'REQUESTING') return false

    // Browser support check
    const mediaDevices =
      this._mediaDevicesOverride ??
      (typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined)

    if (!mediaDevices) {
      this._reportError('BROWSER_UNSUPPORTED', 'navigator.mediaDevices is not available')
      return false
    }

    this._state = 'REQUESTING'

    // 1. Request microphone access
    let stream: MediaStream
    try {
      stream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
        video: false,
      })
    } catch (err) {
      this._state = 'ERROR'
      // Extract error name from both real Error instances and DOMException-like plain objects
      const msg =
        err instanceof Error
          ? err.name
          : typeof err === 'object' && err !== null && 'name' in err
            ? String((err as { name: unknown }).name)
            : String(err)
      if (msg === 'NotAllowedError' || msg === 'PermissionDeniedError') {
        this._callbacks.onError(
          'PERMISSION_DENIED',
          'Microphone permission denied by user or browser policy',
        )
      } else if (msg === 'NotFoundError' || msg === 'DevicesNotFoundError') {
        this._callbacks.onError('DEVICE_NOT_FOUND', 'No microphone device found')
      } else {
        this._callbacks.onError('UNKNOWN', `getUserMedia failed: ${msg}`)
      }
      return false
    }

    // 2. Create AudioContext
    let context: AudioContext
    try {
      if (this._audioContextFactory) {
        context = this._audioContextFactory(this._sampleRate)
      } else {
        const AudioContextCtor =
          (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
          (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioContextCtor) {
          this._stopStream(stream)
          this._state = 'ERROR'
          this._callbacks.onError(
            'BROWSER_UNSUPPORTED',
            'AudioContext is not available in this browser',
          )
          return false
        }
        context = new AudioContextCtor({ sampleRate: this._sampleRate })
      }
    } catch (err) {
      this._stopStream(stream)
      this._state = 'ERROR'
      this._callbacks.onError(
        'AUDIO_CONTEXT_FAILED',
        `AudioContext creation failed: ${String(err)}`,
      )
      return false
    }

    // 3. Wire up audio graph:
    //    MediaStream → Source → Analyser  (frequency data for spectral centroid)
    //                         → Processor → destination (keeps graph alive)
    //                                     → onFrame(samples, frequencyData)
    const sourceNode = context.createMediaStreamSource(stream)
    const analyserNode = context.createAnalyser()
    analyserNode.fftSize = this._fftSize
    const processorNode = context.createScriptProcessor(this._bufferSize, 1, 1)
    const frequencyBin = new Uint8Array(analyserNode.frequencyBinCount)

    sourceNode.connect(analyserNode)
    sourceNode.connect(processorNode)
    // Connect processor to destination to keep graph alive (required by some browsers).
    // Audio is NOT played back because we use the input channel only.
    processorNode.connect(context.destination)

    processorNode.onaudioprocess = (event) => {
      if (this._state !== 'ACTIVE') return

      // Copy channel data — getChannelData returns a live view; clone for safety
      const channelData = event.inputBuffer.getChannelData(0)
      const samples = new Float32Array(channelData.length)
      samples.set(channelData)

      // Read latest frequency magnitudes from the analyser
      analyserNode.getByteFrequencyData(frequencyBin)
      const freqSnapshot = new Uint8Array(frequencyBin)

      this._callbacks.onFrame({
        samples,
        frequencyData: freqSnapshot,
        timestamp: Date.now(),
      })
    }

    // Handle unexpected track ending (device disconnected, etc.)
    for (const track of stream.getAudioTracks()) {
      track.addEventListener('ended', () => {
        if (this._state === 'ACTIVE') {
          this._state = 'ERROR'
          this._callbacks.onError(
            'STREAM_ENDED',
            'Microphone stream ended unexpectedly (device disconnected?)',
          )
        }
      })
    }

    // Persist refs for stop()
    this._stream = stream
    this._context = context
    this._sourceNode = sourceNode
    this._processorNode = processorNode
    this._analyserNode = analyserNode
    this._state = 'ACTIVE'

    return true
  }

  /**
   * Stop capture, disconnect all audio nodes, stop MediaStream tracks, and
   * close the AudioContext.  Safe to call multiple times.
   */
  public stop(): void {
    if (this._state === 'IDLE' || this._state === 'STOPPED') return

    this._state = 'STOPPED'

    // Clear onaudioprocess first to prevent in-flight callbacks after stop
    if (this._processorNode) {
      this._processorNode.onaudioprocess = null
    }

    // Disconnect audio graph
    try { this._processorNode?.disconnect() } catch { /* ignore */ }
    try { this._analyserNode?.disconnect() } catch { /* ignore */ }
    try { this._sourceNode?.disconnect() } catch { /* ignore */ }

    // Stop all MediaStream tracks (releases browser microphone indicator)
    if (this._stream) {
      this._stopStream(this._stream)
    }

    // Close AudioContext
    if (this._context && this._context.state !== 'closed') {
      this._context.close().catch(() => { /* ignore close errors */ })
    }

    // Release all refs
    this._processorNode = null
    this._analyserNode = null
    this._sourceNode = null
    this._stream = null
    this._context = null
  }

  // ── private helpers ──────────────────────────────────────────────────────

  private _stopStream(stream: MediaStream): void {
    for (const track of stream.getAudioTracks()) {
      try { track.stop() } catch { /* ignore */ }
    }
  }

  private _reportError(code: MicCaptureError, detail: string): void {
    this._state = 'ERROR'
    this._callbacks.onError(code, detail)
  }
}

/** Returns true if the browser has the minimum APIs for microphone capture. */
export function isMicrophoneCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    !!(
      (globalThis as unknown as { AudioContext?: unknown }).AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: unknown }).webkitAudioContext
    )
  )
}
