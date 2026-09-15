export interface AcousticFeatures {
  rmsEnergy: number // 0 to 1
  peakVolume: number // 0 to 1
  spectralCentroidNorm: number // normalized proxy for high pitch/screaming
  estimatedDistressCue: number // 0 to 1 composite heuristic
  isSpeechPresent: boolean
}

export function computeRmsEnergy(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i]
  }
  const rms = Math.sqrt(sum / samples.length)
  // Clamp & normalize roughly to [0, 1] assuming standard 32-bit audio [-1, 1]
  return Math.min(1, Math.max(0, rms * 3))
}

export function computePeakVolume(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i])
    if (abs > peak) peak = abs
  }
  return Math.min(1, peak)
}

/**
 * Lightweight heuristic analyzer for acoustic features and estimated distress cues.
 * Note: This does NOT claim perfect emotion classification, only estimated acoustic distress cues.
 */
export function analyzeAcousticFrame(
  samples: Float32Array,
  frequencyData?: Uint8Array,
): AcousticFeatures {
  const rmsEnergy = computeRmsEnergy(samples)
  const peakVolume = computePeakVolume(samples)

  let spectralCentroidNorm = 0
  if (frequencyData && frequencyData.length > 0) {
    let num = 0
    let den = 0
    for (let i = 0; i < frequencyData.length; i++) {
      const mag = frequencyData[i]
      num += i * mag
      den += mag
    }
    if (den > 0) {
      spectralCentroidNorm = Math.min(1, (num / den) / (frequencyData.length * 0.75))
    }
  }

  // Speech presence heuristic: moderate energy, above silence floor
  const isSpeechPresent = rmsEnergy > 0.05

  // Distress cue estimate: combinations of high volume + elevated spectral centroid (shouting/screaming)
  let estimatedDistressCue = 0
  if (isSpeechPresent) {
    estimatedDistressCue = Math.min(
      1,
      rmsEnergy * 0.5 + peakVolume * 0.3 + spectralCentroidNorm * 0.2,
    )
  }

  return {
    rmsEnergy,
    peakVolume,
    spectralCentroidNorm,
    estimatedDistressCue,
    isSpeechPresent,
  }
}
