/** Bounded PCM window assembler with a configurable overlap between windows. */
export class SlidingAudioWindowBuffer {
  private readonly _buffer: Float32Array
  private readonly _windowSamples: number
  private readonly _hopSamples: number
  private _writeIndex = 0
  private _bufferedSamples = 0
  private _samplesUntilWindow: number

  constructor(windowSamples: number, hopSamples: number) {
    if (!Number.isInteger(windowSamples) || windowSamples <= 0) {
      throw new Error('Audio window size must be a positive integer')
    }
    if (!Number.isInteger(hopSamples) || hopSamples <= 0 || hopSamples > windowSamples) {
      throw new Error('Audio hop size must be a positive integer no larger than the window')
    }

    this._windowSamples = windowSamples
    this._hopSamples = hopSamples
    this._buffer = new Float32Array(windowSamples)
    this._samplesUntilWindow = windowSamples
  }

  public push(samples: Float32Array): Float32Array[] {
    const windows: Float32Array[] = []
    for (const sample of samples) {
      this._buffer[this._writeIndex] = sample
      this._writeIndex = (this._writeIndex + 1) % this._windowSamples
      if (this._bufferedSamples < this._windowSamples) this._bufferedSamples++
      this._samplesUntilWindow--

      if (this._bufferedSamples === this._windowSamples && this._samplesUntilWindow === 0) {
        windows.push(this.snapshot())
        this._samplesUntilWindow = this._hopSamples
      }
    }
    return windows
  }

  public clear(): void {
    this._buffer.fill(0)
    this._writeIndex = 0
    this._bufferedSamples = 0
    this._samplesUntilWindow = this._windowSamples
  }

  private snapshot(): Float32Array {
    const result = new Float32Array(this._windowSamples)
    const tailLength = this._windowSamples - this._writeIndex
    result.set(this._buffer.subarray(this._writeIndex), 0)
    result.set(this._buffer.subarray(0, this._writeIndex), tailLength)
    return result
  }
}
