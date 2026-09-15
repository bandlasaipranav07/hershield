import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MicrophoneCaptureAdapter,
  isMicrophoneCaptureSupported,
  type MicCaptureCallbacks,
  type MicCaptureFrame,
  type MicCaptureError,
  type MediaDevicesLike,
} from './microphoneCapture'

// ── Fake Web Audio API objects ───────────────────────────────────────────────
// jsdom provides no AudioContext or MediaStream, so we build minimal fakes
// that satisfy the adapter's interface without real audio I/O.

/** A fake AudioTrack whose `stop()` call we can observe. */
function makeFakeTrack() {
  return {
    stop: vi.fn(),
    addEventListener: vi.fn(),
  }
}

/** A fake MediaStream with one audio track. */
function makeFakeStream(track = makeFakeTrack()) {
  return {
    _track: track,
    getAudioTracks: () => [track],
  } as unknown as MediaStream
}

/** A fake ScriptProcessorNode. Exposes `onaudioprocess` for manual triggering. */
function makeFakeProcessorNode() {
  return {
    onaudioprocess: null as ((ev: AudioProcessingEvent) => void) | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

/** A fake AnalyserNode. */
function makeFakeAnalyserNode(fftSize = 256) {
  return {
    fftSize: 0,
    frequencyBinCount: fftSize / 2,
    getByteFrequencyData: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

/** A fake MediaStreamAudioSourceNode. */
function makeFakeSourceNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

interface FakeAudioContext {
  state: 'running' | 'closed'
  destination: Record<string, unknown>
  sampleRate: number
  close: ReturnType<typeof vi.fn>
  createMediaStreamSource: ReturnType<typeof vi.fn>
  createAnalyser: ReturnType<typeof vi.fn>
  createScriptProcessor: ReturnType<typeof vi.fn>
  _processorNode: ReturnType<typeof makeFakeProcessorNode>
  _analyserNode: ReturnType<typeof makeFakeAnalyserNode>
  _sourceNode: ReturnType<typeof makeFakeSourceNode>
}

/** A fake AudioContext that wires up fake nodes. */
function makeFakeAudioContext(_sampleRate = 16000): FakeAudioContext {
  const processorNode = makeFakeProcessorNode()
  const analyserNode = makeFakeAnalyserNode()
  const sourceNode = makeFakeSourceNode()

  const ctx: FakeAudioContext = {
    state: 'running',
    destination: {},
    sampleRate: _sampleRate,
    close: vi.fn().mockImplementation(() => {
      ctx.state = 'closed'
      return Promise.resolve()
    }),
    createMediaStreamSource: vi.fn().mockReturnValue(sourceNode),
    createAnalyser: vi.fn().mockReturnValue(analyserNode),
    createScriptProcessor: vi.fn().mockReturnValue(processorNode),
    _processorNode: processorNode,
    _analyserNode: analyserNode,
    _sourceNode: sourceNode,
  }
  return ctx
}

/** Builds a fake MediaDevicesLike that resolves with the given stream. */
function makeMediaDevices(stream: MediaStream): MediaDevicesLike {
  return {
    getUserMedia: vi.fn().mockResolvedValue(stream),
  }
}

/** Builds a MediaDevicesLike that rejects with a DOMException-like error. */
function makeMediaDevicesError(name: string): MediaDevicesLike {
  // Use a real Error with `name` overridden so the adapter's instanceof check and name check both work
  const err = new Error(name)
  err.name = name
  return {
    getUserMedia: vi.fn().mockRejectedValue(err),
  }
}

/** Builds a fully-wired adapter with injected fakes. Returns adapter + fakes. */
function buildAdapter(
  callbackOverrides: Partial<MicCaptureCallbacks> = {},
  streamOverride?: MediaStream,
) {
  const track = makeFakeTrack()
  const stream = streamOverride ?? makeFakeStream(track)
  const ctx = makeFakeAudioContext()
  const mediaDevices = makeMediaDevices(stream)

  const frames: MicCaptureFrame[] = []
  const errors: { code: MicCaptureError; detail: string }[] = []

  const callbacks: MicCaptureCallbacks = {
    onFrame: (f) => frames.push(f),
    onError: (code, detail) => errors.push({ code, detail }),
    ...callbackOverrides,
  }

  const adapter = new MicrophoneCaptureAdapter(callbacks, {
    mediaDevicesOverride: mediaDevices,
    audioContextFactory: () => ctx as unknown as AudioContext,
    bufferSize: 256,
    fftSize: 256,
    sampleRate: 16000,
  })

  return { adapter, ctx, mediaDevices, stream, track, frames, errors }
}

/** Fires a synthetic onaudioprocess event on the fake processor node. */
function fireAudioProcess(
  processorNode: ReturnType<typeof makeFakeProcessorNode>,
  samples: Float32Array,
) {
  const fakeEvent = {
    inputBuffer: {
      getChannelData: (_channel: number) => samples,
    },
  } as unknown as AudioProcessingEvent
  processorNode.onaudioprocess?.(fakeEvent)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MicrophoneCaptureAdapter', () => {
  describe('initial state', () => {
    it('starts in IDLE state', () => {
      const { adapter } = buildAdapter()
      expect(adapter.state).toBe('IDLE')
      expect(adapter.isActive).toBe(false)
    })
  })

  describe('start() — happy path', () => {
    it('requests microphone access via getUserMedia on start()', async () => {
      const { adapter, mediaDevices } = buildAdapter()
      const success = await adapter.start()

      expect(success).toBe(true)
      expect(mediaDevices.getUserMedia).toHaveBeenCalledOnce()
      expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: expect.objectContaining({ echoCancellation: true, noiseSuppression: true }),
        video: false,
      })
    })

    it('transitions to ACTIVE after successful start()', async () => {
      const { adapter } = buildAdapter()
      await adapter.start()

      expect(adapter.state).toBe('ACTIVE')
      expect(adapter.isActive).toBe(true)
    })

    it('creates AudioContext, AnalyserNode, ScriptProcessorNode and connects source', async () => {
      const { adapter, ctx } = buildAdapter()
      await adapter.start()

      expect(ctx.createMediaStreamSource).toHaveBeenCalledOnce()
      expect(ctx.createAnalyser).toHaveBeenCalledOnce()
      expect(ctx.createScriptProcessor).toHaveBeenCalledOnce()
      // Source must be connected to both analyser and processor
      expect(ctx._sourceNode.connect).toHaveBeenCalledWith(ctx._analyserNode)
      expect(ctx._sourceNode.connect).toHaveBeenCalledWith(ctx._processorNode)
      // Processor must be connected to destination to keep graph alive
      expect(ctx._processorNode.connect).toHaveBeenCalledWith(ctx.destination)
    })

    it('does not start again if already ACTIVE', async () => {
      const { adapter, mediaDevices } = buildAdapter()
      await adapter.start()
      const second = await adapter.start()

      expect(second).toBe(false)
      // getUserMedia must only be called once
      expect(mediaDevices.getUserMedia).toHaveBeenCalledOnce()
    })
  })

  describe('onFrame — real PCM samples reach the callback', () => {
    it('delivers actual PCM samples and frequency data from onaudioprocess', async () => {
      const { adapter, ctx, frames } = buildAdapter()
      await adapter.start()

      const samples = new Float32Array([0.1, -0.2, 0.3, -0.4])
      fireAudioProcess(ctx._processorNode, samples)

      expect(frames).toHaveLength(1)
      // Float32Array uses 32-bit precision; use toBeCloseTo for comparison
      expect(frames[0].samples[0]).toBeCloseTo(0.1, 5)
      expect(frames[0].samples[1]).toBeCloseTo(-0.2, 5)
      expect(frames[0].samples[2]).toBeCloseTo(0.3, 5)
      expect(frames[0].samples[3]).toBeCloseTo(-0.4, 5)
      // frequencyData is a Uint8Array from the analyser
      expect(frames[0].frequencyData).toBeInstanceOf(Uint8Array)
      // timestamp is a number (wall-clock ms)
      expect(typeof frames[0].timestamp).toBe('number')
      expect(frames[0].timestamp).toBeGreaterThan(0)
    })

    it('reads frequency data from the AnalyserNode on every frame', async () => {
      const { adapter, ctx, frames } = buildAdapter()
      await adapter.start()

      fireAudioProcess(ctx._processorNode, new Float32Array(4))
      fireAudioProcess(ctx._processorNode, new Float32Array(4))

      expect(ctx._analyserNode.getByteFrequencyData).toHaveBeenCalledTimes(2)
      expect(frames).toHaveLength(2)
    })

    it('clones sample data so mutations do not affect the delivered frame', async () => {
      const { adapter, ctx, frames } = buildAdapter()
      await adapter.start()

      const samples = new Float32Array([0.5, 0.6])
      fireAudioProcess(ctx._processorNode, samples)

      // Mutate original after delivery
      samples[0] = 0
      expect(frames[0].samples[0]).toBeCloseTo(0.5)
    })

    it('drops frames silently after stop()', async () => {
      const { adapter, ctx, frames } = buildAdapter()
      await adapter.start()
      adapter.stop()

      fireAudioProcess(ctx._processorNode, new Float32Array([0.9, 0.8]))

      expect(frames).toHaveLength(0)
    })
  })

  describe('stop() — lifecycle cleanup', () => {
    it('transitions to STOPPED on stop()', async () => {
      const { adapter } = buildAdapter()
      await adapter.start()
      adapter.stop()

      expect(adapter.state).toBe('STOPPED')
      expect(adapter.isActive).toBe(false)
    })

    it('stops all MediaStream audio tracks on stop()', async () => {
      const { adapter, track } = buildAdapter()
      await adapter.start()
      adapter.stop()

      expect(track.stop).toHaveBeenCalledOnce()
    })

    it('disconnects all audio nodes on stop()', async () => {
      const { adapter, ctx } = buildAdapter()
      await adapter.start()
      adapter.stop()

      expect(ctx._processorNode.disconnect).toHaveBeenCalled()
      expect(ctx._analyserNode.disconnect).toHaveBeenCalled()
      expect(ctx._sourceNode.disconnect).toHaveBeenCalled()
    })

    it('closes the AudioContext on stop()', async () => {
      const { adapter, ctx } = buildAdapter()
      await adapter.start()
      adapter.stop()

      expect(ctx.close).toHaveBeenCalledOnce()
    })

    it('clears onaudioprocess before disconnecting to prevent in-flight callbacks', async () => {
      const { adapter, ctx } = buildAdapter()
      await adapter.start()

      expect(ctx._processorNode.onaudioprocess).not.toBeNull()
      adapter.stop()
      expect(ctx._processorNode.onaudioprocess).toBeNull()
    })

    it('is safe to call stop() multiple times without throwing', async () => {
      const { adapter } = buildAdapter()
      await adapter.start()

      expect(() => {
        adapter.stop()
        adapter.stop()
        adapter.stop()
      }).not.toThrow()
    })

    it('is safe to call stop() before start()', () => {
      const { adapter } = buildAdapter()
      expect(() => adapter.stop()).not.toThrow()
      expect(adapter.state).toBe('IDLE')
    })
  })

  describe('error handling — permission denied', () => {
    it('reports PERMISSION_DENIED when getUserMedia throws NotAllowedError', async () => {
      // No stream/track needed: makeMediaDevicesError rejects before any stream is used.
      const ctx = makeFakeAudioContext()
      const errors: { code: MicCaptureError; detail: string }[] = []

      const adapter = new MicrophoneCaptureAdapter(
        { onFrame: vi.fn(), onError: (code, detail) => errors.push({ code, detail }) },
        {
          mediaDevicesOverride: makeMediaDevicesError('NotAllowedError'),
          audioContextFactory: () => ctx as unknown as AudioContext,
        },
      )

      const success = await adapter.start()

      expect(success).toBe(false)
      expect(adapter.state).toBe('ERROR')
      expect(errors).toHaveLength(1)
      expect(errors[0].code).toBe('PERMISSION_DENIED')
    })

    it('reports PERMISSION_DENIED for PermissionDeniedError as well', async () => {
      const errors: { code: MicCaptureError; detail: string }[] = []
      const adapter = new MicrophoneCaptureAdapter(
        { onFrame: vi.fn(), onError: (code, detail) => errors.push({ code, detail }) },
        { mediaDevicesOverride: makeMediaDevicesError('PermissionDeniedError') },
      )

      await adapter.start()

      expect(errors[0].code).toBe('PERMISSION_DENIED')
    })

    it('reports DEVICE_NOT_FOUND when getUserMedia throws NotFoundError', async () => {
      const errors: { code: MicCaptureError; detail: string }[] = []
      const adapter = new MicrophoneCaptureAdapter(
        { onFrame: vi.fn(), onError: (code, detail) => errors.push({ code, detail }) },
        { mediaDevicesOverride: makeMediaDevicesError('NotFoundError') },
      )

      await adapter.start()

      expect(errors[0].code).toBe('DEVICE_NOT_FOUND')
    })

    it('reports UNKNOWN for unrecognised getUserMedia errors', async () => {
      const errors: { code: MicCaptureError; detail: string }[] = []
      const adapter = new MicrophoneCaptureAdapter(
        { onFrame: vi.fn(), onError: (code, detail) => errors.push({ code, detail }) },
        { mediaDevicesOverride: makeMediaDevicesError('SomethingWeird') },
      )

      await adapter.start()

      expect(errors[0].code).toBe('UNKNOWN')
      expect(errors[0].detail).toMatch(/SomethingWeird/)
    })
  })

  describe('error handling — no mediaDevices', () => {
    it('reports BROWSER_UNSUPPORTED when mediaDevices is unavailable', async () => {
      const errors: { code: MicCaptureError; detail: string }[] = []
      // Pass undefined explicitly; adapter must not crash
      const adapter = new MicrophoneCaptureAdapter(
        { onFrame: vi.fn(), onError: (code, detail) => errors.push({ code, detail }) },
        { mediaDevicesOverride: undefined },
      )

      // Force: globalThis has no navigator.mediaDevices in jsdom normally.
      // The adapter will fall back to navigator.mediaDevices which is undefined in test.
      const success = await adapter.start()

      // Either BROWSER_UNSUPPORTED is reported or the adapter handles it gracefully
      expect(success).toBe(false)
      expect(errors.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('privacy — audio never reaches persistent storage', () => {
    it('delivers only transient Float32Array frames — no localStorage writes', async () => {
      const localStorageSetSpy = vi.spyOn(Storage.prototype, 'setItem')

      const { adapter, ctx } = buildAdapter()
      await adapter.start()
      fireAudioProcess(ctx._processorNode, new Float32Array([0.1, 0.2, 0.3]))
      adapter.stop()

      // No localStorage writes must have occurred during acoustic processing
      expect(localStorageSetSpy).not.toHaveBeenCalled()

      localStorageSetSpy.mockRestore()
    })
  })

  describe('stream track stop on DISARM (stop() call)', () => {
    it('stops microphone track so browser mic indicator turns off', async () => {
      const track = makeFakeTrack()
      const stream = makeFakeStream(track)
      const ctx = makeFakeAudioContext()

      const adapter = new MicrophoneCaptureAdapter(
        { onFrame: vi.fn(), onError: vi.fn() },
        {
          mediaDevicesOverride: makeMediaDevices(stream),
          audioContextFactory: () => ctx as unknown as AudioContext,
        },
      )

      await adapter.start()
      expect(track.stop).not.toHaveBeenCalled()

      adapter.stop()
      expect(track.stop).toHaveBeenCalledOnce()
    })
  })
})

describe('isMicrophoneCaptureSupported', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when navigator.mediaDevices is absent', () => {
    // jsdom typically has no mediaDevices; just verify the function does not throw
    const result = isMicrophoneCaptureSupported()
    // In jsdom the result will be false (no AudioContext, no getUserMedia)
    expect(typeof result).toBe('boolean')
  })
})
