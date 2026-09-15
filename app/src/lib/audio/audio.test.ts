import { describe, it, expect } from 'vitest'
import { AudioPrivacyBuffer } from './audioPrivacyBuffer'
import { computeRmsEnergy, computePeakVolume, analyzeAcousticFrame } from './acousticAnalyzer'

describe('Audio Analysis & Privacy Buffer', () => {
  describe('AudioPrivacyBuffer', () => {
    it('initializes with zeroed capacity and manages circular overwriting', () => {
      const buffer = new AudioPrivacyBuffer(1, 10) // 10 samples
      expect(buffer.capacitySamples).toBe(10)

      const input = new Float32Array([1, 2, 3, 4, 5])
      buffer.writeSamples(input)

      let snap = buffer.getSnapshot()
      expect(Array.from(snap)).toEqual([1, 2, 3, 4, 5])

      // Write 7 more samples, causing wrap-around
      buffer.writeSamples(new Float32Array([6, 7, 8, 9, 10, 11, 12]))
      snap = buffer.getSnapshot()
      expect(snap.length).toBe(10)
      // Oldest dropped (1 and 2 dropped)
      expect(Array.from(snap)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    })

    it('wipes buffer memory securely on demand', () => {
      const buffer = new AudioPrivacyBuffer(1, 10)
      buffer.writeSamples(new Float32Array([1, 2, 3, 4, 5]))
      buffer.wipe()

      const snap = buffer.getSnapshot()
      expect(snap.length).toBe(0)
    })
  })

  describe('acousticAnalyzer', () => {
    it('computes RMS and peak energy properly', () => {
      const samples = new Float32Array([0.5, -0.5, 0.5, -0.5])
      const rms = computeRmsEnergy(samples)
      const peak = computePeakVolume(samples)

      expect(rms).toBeGreaterThan(0)
      expect(peak).toBeCloseTo(0.5)
    })

    it('analyzes acoustic frame and reports speech presence and distress cues', () => {
      const silence = new Float32Array([0, 0, 0, 0])
      const silenceFeats = analyzeAcousticFrame(silence)
      expect(silenceFeats.isSpeechPresent).toBe(false)
      expect(silenceFeats.estimatedDistressCue).toBe(0)

      const loudSamples = new Float32Array([0.9, -0.85, 0.8, -0.95])
      const freq = new Uint8Array([50, 100, 200, 250, 200])
      const loudFeats = analyzeAcousticFrame(loudSamples, freq)
      expect(loudFeats.isSpeechPresent).toBe(true)
      expect(loudFeats.estimatedDistressCue).toBeGreaterThan(0.5)
    })
  })
})
