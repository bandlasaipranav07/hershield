/**
 * Privacy-preserving circular audio buffer.
 * 
 * Rules:
 * 1. Before THREAT_CONFIRMED: Audio exists solely in transient, fixed-length in-memory circular buffers.
 * 2. Raw audio is NEVER written to persistent storage (IndexedDB / LocalStorage / Cloud) during normal monitoring.
 * 3. On DISARM: The buffer is explicitly wiped from memory.
 * 4. After THREAT_CONFIRMED: An explicit incident snapshot can be extracted for security capture if needed.
 */
export class AudioPrivacyBuffer {
  private _buffer: Float32Array
  private _writeIndex = 0
  private _isFull = false
  private _sampleRate: number
  private _capacitySamples: number

  constructor(maxDurationSeconds = 5, sampleRate = 16000) {
    this._sampleRate = sampleRate
    this._capacitySamples = Math.floor(maxDurationSeconds * sampleRate)
    this._buffer = new Float32Array(this._capacitySamples)
  }

  public get sampleRate(): number {
    return this._sampleRate
  }

  public get capacitySamples(): number {
    return this._capacitySamples
  }

  public writeSamples(samples: Float32Array): void {
    for (let i = 0; i < samples.length; i++) {
      this._buffer[this._writeIndex] = samples[i]
      this._writeIndex++
      if (this._writeIndex >= this._capacitySamples) {
        this._writeIndex = 0
        this._isFull = true
      }
    }
  }

  /**
   * Explicitly wipe memory upon disarming or discarding unconfirmed monitoring frames.
   */
  public wipe(): void {
    this._buffer.fill(0)
    this._writeIndex = 0
    this._isFull = false
  }

  /**
   * Returns the current transient buffer copy in chronological order.
   */
  public getSnapshot(): Float32Array {
    const size = this._isFull ? this._capacitySamples : this._writeIndex
    const snapshot = new Float32Array(size)

    if (!this._isFull) {
      snapshot.set(this._buffer.subarray(0, this._writeIndex))
    } else {
      const tailLength = this._capacitySamples - this._writeIndex
      snapshot.set(this._buffer.subarray(this._writeIndex, this._capacitySamples), 0)
      snapshot.set(this._buffer.subarray(0, this._writeIndex), tailLength)
    }

    return snapshot
  }
}
