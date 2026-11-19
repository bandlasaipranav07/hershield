/**
 * Model A – Keyword & Acoustic Trigger Detection
 *
 * Responsibilities:
 * 1. Multilingual Emergency Keyword & Phrase Detection:
 *    - English
 *    - Telugu (తెలుగు) - Native script + Romanized transliteration
 *    - Hindi (हिंदी) - Native script + Romanized transliteration
 *    - Tamil & Kannada (extensible)
 * 2. Resistance and Boundary Phrase Recognition ("don't touch me", "leave me alone", etc.)
 * 3. Acoustic Vocal Trigger Analysis:
 *    - High-pitch screaming cues (spectral centroid + RMS volume)
 *    - Acoustic distress cues
 * 4. Ambient Noise Rejection Heuristics:
 *    - Suppresses isolated mechanical noise, dropped objects, and clapping from claiming vocal distress.
 * 5. Returns calibrated structured evidence.
 */

import {
  analyzeAcousticFrame,
  type AcousticFeatures,
} from '../audio/acousticAnalyzer'

export type ModelATriggerType =
  | 'distress_keyword'
  | 'resistance_phrase'
  | 'authority_alert'
  | 'acoustic_scream'
  | 'vocal_distress'
  | 'none'

export type SupportedLanguage = 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'acoustic' | 'none'

export interface ModelAOutput {
  model: 'A_keyword'
  trigger_detected: boolean
  trigger_type: ModelATriggerType
  detected_phrase: string | null
  matched_language: SupportedLanguage
  confidence: number // 0 to 1 calibrated confidence
  timestamp: number
  features: AcousticFeatures
  category: 'distress' | 'resistance' | 'authority' | 'acoustic' | 'none'
}

export interface KeywordDefinition {
  phrase: string
  language: SupportedLanguage
  category: 'distress' | 'resistance' | 'authority'
  weight: number // 0.5 to 1.0
  isRegex?: boolean
}

/**
 * Multilingual Emergency Dictionary supporting:
 * - English
 * - Telugu (తెలుగు - Native & Romanized)
 * - Hindi (हिंदी - Native & Romanized)
 */
export const MULTILINGUAL_DICTIONARY: KeywordDefinition[] = [
  // ── ENGLISH (Distress) ──────────────────────────────────────────────────────
  { phrase: 'help', language: 'en', category: 'distress', weight: 0.85 },
  { phrase: 'help me', language: 'en', category: 'distress', weight: 0.95 },
  { phrase: 'someone help', language: 'en', category: 'distress', weight: 0.95 },
  { phrase: 'save me', language: 'en', category: 'distress', weight: 0.95 },
  { phrase: 'please help', language: 'en', category: 'distress', weight: 0.92 },
  { phrase: 'sos', language: 'en', category: 'distress', weight: 0.98 },
  { phrase: 'emergency', language: 'en', category: 'distress', weight: 0.90 },
  { phrase: 'i am in danger', language: 'en', category: 'distress', weight: 0.95 },
  { phrase: "i'm in danger", language: 'en', category: 'distress', weight: 0.95 },
  { phrase: 'attack', language: 'en', category: 'distress', weight: 0.88 },
  { phrase: 'attacked', language: 'en', category: 'distress', weight: 0.90 },

  // ── ENGLISH (Resistance & Boundaries) ──────────────────────────────────────
  { phrase: 'stop', language: 'en', category: 'resistance', weight: 0.75 },
  { phrase: 'leave me alone', language: 'en', category: 'resistance', weight: 0.95 },
  { phrase: "don't touch me", language: 'en', category: 'resistance', weight: 0.96 },
  { phrase: 'dont touch me', language: 'en', category: 'resistance', weight: 0.96 },
  { phrase: 'get away', language: 'en', category: 'resistance', weight: 0.90 },
  { phrase: 'let me go', language: 'en', category: 'resistance', weight: 0.95 },
  { phrase: 'stay back', language: 'en', category: 'resistance', weight: 0.88 },

  // ── ENGLISH (Authority Alert) ──────────────────────────────────────────────
  { phrase: 'call the police', language: 'en', category: 'authority', weight: 0.95 },
  { phrase: 'call police', language: 'en', category: 'authority', weight: 0.95 },
  { phrase: 'police', language: 'en', category: 'authority', weight: 0.80 },
  { phrase: 'ambulance', language: 'en', category: 'authority', weight: 0.85 },

  // ── TELUGU (తెలుగు - Native Script) ─────────────────────────────────────────
  { phrase: 'కాపాడండి', language: 'te', category: 'distress', weight: 0.98 }, // Kapadandi (Save me/help)
  { phrase: 'నన్ను కాపాడండి', language: 'te', category: 'distress', weight: 0.99 }, // Nannu kapadandi
  { phrase: 'సహాయం', language: 'te', category: 'distress', weight: 0.90 }, // Sahayam (Help)
  { phrase: 'ఎవరైనా సహాయం చేయండి', language: 'te', category: 'distress', weight: 0.98 }, // Evaraina sahayam cheyandi
  { phrase: 'నన్ను వదిలేయండి', language: 'te', category: 'resistance', weight: 0.96 }, // Nannu vadileyandi (Leave me)
  { phrase: 'వదిలేయ్', language: 'te', category: 'resistance', weight: 0.92 }, // Vadileyi (Let go)
  { phrase: 'నన్ను ముట్టుకోవద్దు', language: 'te', category: 'resistance', weight: 0.98 }, // Nannu muttukovaddu (Don't touch me)
  { phrase: 'ఆగండి', language: 'te', category: 'resistance', weight: 0.80 }, // Aagandi (Stop)
  { phrase: 'దూరంగా వెళ్ళు', language: 'te', category: 'resistance', weight: 0.92 }, // Dooranga vellu (Get away)
  { phrase: 'పోలీసులకు ఫోన్ చేయండి', language: 'te', category: 'authority', weight: 0.98 }, // Police laku phone cheyandi
  { phrase: 'పోలీస్', language: 'te', category: 'authority', weight: 0.85 }, // Police
  { phrase: 'నేను ప్రమాదంలో ఉన్నాను', language: 'te', category: 'distress', weight: 0.98 }, // Nenu pramadham lo unnanu (I'm in danger)

  // ── TELUGU (Romanized / Transliterated for Sarvam STT) ──────────────────────
  { phrase: 'kapadandi', language: 'te', category: 'distress', weight: 0.98 },
  { phrase: 'nannu kapadandi', language: 'te', category: 'distress', weight: 0.99 },
  { phrase: 'sahayam', language: 'te', category: 'distress', weight: 0.90 },
  { phrase: 'sahayam cheyandi', language: 'te', category: 'distress', weight: 0.95 },
  { phrase: 'vadileyandi', language: 'te', category: 'resistance', weight: 0.95 },
  { phrase: 'vadileyi', language: 'te', category: 'resistance', weight: 0.92 },
  { phrase: 'nannu muttukoku', language: 'te', category: 'resistance', weight: 0.98 },
  { phrase: 'nannu muttukokandi', language: 'te', category: 'resistance', weight: 0.98 },
  { phrase: 'dooramga po', language: 'te', category: 'resistance', weight: 0.90 },
  { phrase: 'pramadham', language: 'te', category: 'distress', weight: 0.88 },
  { phrase: 'pramadham lo unnanu', language: 'te', category: 'distress', weight: 0.98 },

  // ── HINDI (हिंदी - Native Script) ───────────────────────────────────────────
  { phrase: 'बचाओ', language: 'hi', category: 'distress', weight: 0.98 }, // Bachao (Save/Help)
  { phrase: 'मुझे बचाओ', language: 'hi', category: 'distress', weight: 0.99 }, // Mujhe bachao
  { phrase: 'मदद करो', language: 'hi', category: 'distress', weight: 0.96 }, // Madad karo
  { phrase: 'कोई मदद करो', language: 'hi', category: 'distress', weight: 0.98 }, // Koi madad karo
  { phrase: 'मदद', language: 'hi', category: 'distress', weight: 0.88 }, // Madad
  { phrase: 'मुझे छोड़ो', language: 'hi', category: 'resistance', weight: 0.96 }, // Mujhe chodo (Leave me)
  { phrase: 'छोड़ो मुझे', language: 'hi', category: 'resistance', weight: 0.96 }, // Chodo mujhe
  { phrase: 'हाथ मत लगाओ', language: 'hi', category: 'resistance', weight: 0.98 }, // Haath mat lagao (Don't touch me)
  { phrase: 'दूर रहो', language: 'hi', category: 'resistance', weight: 0.92 }, // Door raho (Stay away)
  { phrase: 'रुको', language: 'hi', category: 'resistance', weight: 0.80 }, // Ruko (Stop)
  { phrase: 'पुलिस बुलाओ', language: 'hi', category: 'authority', weight: 0.98 }, // Police bulao
  { phrase: 'पुलिस को फोन करो', language: 'hi', category: 'authority', weight: 0.98 }, // Police ko phone karo
  { phrase: 'मैं खतरे में हूँ', language: 'hi', category: 'distress', weight: 0.98 }, // Main khatre mein hoon
  { phrase: 'जाने दो', language: 'hi', category: 'resistance', weight: 0.92 }, // Jaane do (Let me go)

  // ── HINDI (Romanized / Transliterated for Sarvam STT) ────────────────────────
  { phrase: 'bachao', language: 'hi', category: 'distress', weight: 0.98 },
  { phrase: 'mujhe bachao', language: 'hi', category: 'distress', weight: 0.99 },
  { phrase: 'madad karo', language: 'hi', category: 'distress', weight: 0.96 },
  { phrase: 'koi madad karo', language: 'hi', category: 'distress', weight: 0.98 },
  { phrase: 'madad', language: 'hi', category: 'distress', weight: 0.88 },
  { phrase: 'chodo mujhe', language: 'hi', category: 'resistance', weight: 0.96 },
  { phrase: 'mujhe chodo', language: 'hi', category: 'resistance', weight: 0.96 },
  { phrase: 'haath mat lagao', language: 'hi', category: 'resistance', weight: 0.98 },
  { phrase: 'door raho', language: 'hi', category: 'resistance', weight: 0.92 },
  { phrase: 'police bulao', language: 'hi', category: 'authority', weight: 0.98 },
  { phrase: 'khatre mein hoon', language: 'hi', category: 'distress', weight: 0.98 },
  { phrase: 'khatra', language: 'hi', category: 'distress', weight: 0.85 },
  { phrase: 'jaane do', language: 'hi', category: 'resistance', weight: 0.92 },
]

/**
 * Normalizes input text for multi-script and romanized matching.
 */
function normalizeTranscript(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Detect keywords from text across supported languages.
 */
export function detectKeywordsInTranscript(text: string): {
  matched: boolean
  definition: KeywordDefinition | null
  confidence: number
} {
  if (!text || !text.trim()) {
    return { matched: false, definition: null, confidence: 0 }
  }

  const normalized = normalizeTranscript(text)

  // Sort phrases by length descending to match longest specific phrases first ("help me" before "help")
  const sortedDict = [...MULTILINGUAL_DICTIONARY].sort(
    (a, b) => b.phrase.length - a.phrase.length,
  )

  for (const def of sortedDict) {
    const phraseNorm = def.phrase.toLowerCase()
    // For English / Latin characters, use word boundary; for Indic scripts (Devanagari, Telugu), check substring
    const isLatin = /^[a-z0-9\s']+$/i.test(phraseNorm)
    
    let isMatch = false
    if (isLatin) {
      const regex = new RegExp(`(^|\\s)${phraseNorm}(\\s|$)`, 'i')
      isMatch = regex.test(normalized)
    } else {
      isMatch = normalized.includes(phraseNorm)
    }

    if (isMatch) {
      return {
        matched: true,
        definition: def,
        confidence: def.weight,
      }
    }
  }

  return { matched: false, definition: null, confidence: 0 }
}

/**
 * Evaluates Model A on an incoming audio window and transcript.
 */
export function evaluateModelA(params: {
  samples: Float32Array
  frequencyData?: Uint8Array
  transcript?: string
  timestamp?: number
}): ModelAOutput {
  const now = params.timestamp ?? Date.now()
  const transcript = params.transcript ?? ''

  // 1. Feature extraction from audio
  const features = analyzeAcousticFrame(params.samples, params.frequencyData)

  // 2. Keyword detection
  const kwResult = detectKeywordsInTranscript(transcript)

  // 3. Acoustic distress evaluation:
  // Screaming typically has:
  // - High RMS Energy (>= 0.65)
  // - High Peak Volume (>= 0.8)
  // - Elevated Spectral Centroid (high frequency harmonic presence >= 0.5)
  const isAcousticScream =
    features.rmsEnergy >= 0.65 &&
    features.peakVolume >= 0.8 &&
    features.spectralCentroidNorm >= 0.45

  const hasModerateVocalDistress =
    features.estimatedDistressCue >= 0.65 && features.isSpeechPresent

  // Determine trigger type and confidence
  if (kwResult.matched && kwResult.definition) {
    const triggerType: ModelATriggerType =
      kwResult.definition.category === 'distress'
        ? 'distress_keyword'
        : kwResult.definition.category === 'resistance'
          ? 'resistance_phrase'
          : 'authority_alert'

    // If both keyword AND acoustic scream match, confidence is boosted
    const boost = isAcousticScream ? 0.05 : 0
    const confidence = Math.min(0.99, kwResult.confidence + boost)

    return {
      model: 'A_keyword',
      trigger_detected: true,
      trigger_type: triggerType,
      detected_phrase: kwResult.definition.phrase,
      matched_language: kwResult.definition.language,
      confidence,
      timestamp: now,
      features,
      category: kwResult.definition.category,
    }
  }

  if (isAcousticScream) {
    // Acoustic scream without detected words (non-verbal distress or screaming)
    const screamConfidence = Math.min(
      0.92,
      features.rmsEnergy * 0.4 +
        features.peakVolume * 0.3 +
        features.spectralCentroidNorm * 0.3,
    )
    return {
      model: 'A_keyword',
      trigger_detected: true,
      trigger_type: 'acoustic_scream',
      detected_phrase: '[non-verbal scream/screaming]',
      matched_language: 'acoustic',
      confidence: Math.round(screamConfidence * 100) / 100,
      timestamp: now,
      features,
      category: 'acoustic',
    }
  }

  if (hasModerateVocalDistress) {
    return {
      model: 'A_keyword',
      trigger_detected: true,
      trigger_type: 'vocal_distress',
      detected_phrase: null,
      matched_language: 'acoustic',
      confidence: Math.round(features.estimatedDistressCue * 100) / 100,
      timestamp: now,
      features,
      category: 'acoustic',
    }
  }

  return {
    model: 'A_keyword',
    trigger_detected: false,
    trigger_type: 'none',
    detected_phrase: null,
    matched_language: 'none',
    confidence: 0,
    timestamp: now,
    features,
    category: 'none',
  }
}
