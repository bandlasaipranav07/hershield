/**
 * Model B – Intent Detection & Speech Semantics
 *
 * Responsibilities:
 * 1. Semantic intent classification:
 *    - distress: "help me", "save me", "bachao", "kapadandi"
 *    - threat_speech: "call the police", "i'm in danger", "police bulao", "pramadham"
 *    - fear: "i'm scared", "someone help", "mujhe darr lag raha hai"
 *    - resistance: "don't touch me", "leave me alone", "let me go", "stop", "haath mat lagao"
 *    - panic: rapid repeated vocal distress / emergency demands
 *    - normal_conversation: "can you help me with dinner / homework / luggage", "thanks for the help"
 *    - playful: "stop it you're tickling me", "help me win this game", "haha", "you are hilarious"
 *    - uncertain: ambiguous or unclassifiable speech
 * 2. Emotion estimation: 'fear' | 'anger' | 'neutral' | 'playful'
 * 3. Severity rating: 'low' | 'medium' | 'high' | 'critical'
 * 4. Multilingual support for English, Telugu, and Hindi transcripts from Sarvam AI.
 * 5. Integrates with existing TF-IDF logistic intent model as a statistical prior.
 */

import { classifyUtterance, intentModel, type IntentResult } from '../intent/classify'

export type SpeechIntent =
  | 'distress'
  | 'threat_speech'
  | 'fear'
  | 'resistance'
  | 'panic'
  | 'normal_conversation'
  | 'playful'
  | 'uncertain'

export type DetectedEmotion = 'fear' | 'anger' | 'neutral' | 'playful'
export type IntentSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ModelBOutput {
  model: 'B_intent'
  intent: SpeechIntent
  emotion: DetectedEmotion
  severity: IntentSeverity
  confidence: number // 0 to 1 calibrated confidence
  emergencyProbability: number
  isGenuineDistress: boolean
}

// Patterns that unambiguously indicate playful or benign context
const PLAYFUL_PATTERNS = [
  /\b(haha|hahaha|hehe|lol|rofl|lmao|hilarious|joking|kidding|tickle|tickling|funny)\b/i,
  /\b(help me win|help me beat this level|help me in game|help with game)\b/i,
  /\b(stop it\s+(haha|you are|ur))\b/i,
  /\b(you're killing me|dying of laughter)\b/i,
  /(హహ|నవ్వు|హాహా)/, // Telugu laughing
  /(हाहा|मजाक|हंस)/, // Hindi joking / laughing
]

// Patterns that indicate normal conversational requests
const CONVERSATIONAL_PATTERNS = [
  /\b(help (me )?(with|to|carry|lift|find|move|fix|clean) (my |the |this |these |a )?(homework|dinner|cooking|groceries|bags?|box|boxes|dishes|laundry|math|code|study|work|project|luggage))\b/i,
  /\b(thanks for (the )?help|thank you for helping|appreciate the help)\b/i,
  /\b(can (someone|anyone|you) help (me )?(carry|lift|with|to|find)?)\b/i,
  /\b(could you help|would you mind helping|need some help with)\b/i,
  /\b(how can i help|what can i help)\b/i,
  /(गृहकार्य|खाना|मदद चाहिए पढ़ने में|धन्यवाद|सामान उठाने में मदद)/, // Hindi conversational
  /(హోంవర్క్|వంట|సహాయం కావాలి చదువుకోవడానికి|ధన్యవాదాలు|సామాను మోయడానికి సహాయం)/, // Telugu conversational
]

// Explicit Resistance / Boundary Violation patterns
const RESISTANCE_PATTERNS = [
  /\b(don'?t touch me|dont touch me|leave me alone|let me go|get away from me|get away|stay back|back off)\b/i,
  /\b(stop touching|touching me|get off me|take your hands off)\b/i,
  /(haath mat lagao|mujhe chodo|chodo mujhe|door raho|jaane do|mat chhuo)/i,
  /(నన్ను ముట్టుకోవద్దు|నన్ను వదిలేయండి|వదిలేయ్|దూరంగా వెళ్ళు)/,
  /(हाथ मत लगाओ|मुझे छोड़ो|छोड़ो मुझे|दूर रहो|जाने दो)/,
]

// Threat / Emergency Police Call patterns
const THREAT_PATTERNS = [
  /\b(call the police|call police|i'?m in danger|i am in danger|someone is following me|he has a weapon|he is following me)\b/i,
  /(police bulao|khatre mein hoon|koi peeche pad raha hai)/i,
  /(పోలీసులకు ఫోన్ చేయండి|పోలీస్|ప్రమాదంలో ఉన్నాను)/,
  /(पुलिस बुलाओ|खतरे में हूँ)/,
]

// Fear patterns
const FEAR_PATTERNS = [
  /\b(i'?m scared|i am scared|i am terrified|please don'?t hurt me|please dont hurt me|somebody please)\b/i,
  /(mujhe darr lag raha hai|bacha lo|chot mat pahunchao)/i,
  /(భయంగా ఉంది|నన్ను కొట్టకండి)/,
  /(मुझे डर लग रहा है|चोट मत पहुँचाओ)/,
]

// Direct Distress keywords
const DISTRESS_PATTERNS = [
  /\b(help me|save me|someone help|please help|sos|emergency|attacked|attack)\b/i,
  /(bachao|mujhe bachao|madad karo|koi madad karo|kapadandi|nannu kapadandi|sahayam cheyandi)/i,
  /(కాపాడండి|సహాయం|నన్ను కాపాడండి)/,
  /(बचाओ|मदद करो|मुझे बचाओ)/,
]

/**
 * Evaluates Model B intent and semantics on a transcript.
 */
export function evaluateModelB(
  transcript: string,
  model = intentModel,
): ModelBOutput {
  const text = transcript.trim()
  if (!text) {
    return {
      model: 'B_intent',
      intent: 'uncertain',
      emotion: 'neutral',
      severity: 'low',
      confidence: 0,
      emergencyProbability: 0,
      isGenuineDistress: false,
    }
  }

  // 1. Calculate base statistical probability from TF-IDF Logistic Regression
  let baseIntentResult: IntentResult
  try {
    baseIntentResult = classifyUtterance(model, text)
  } catch {
    baseIntentResult = { level: 'LOW', emergencyProbability: 0.1 }
  }

  // 2. Check for Playful / Joking speech
  const isPlayful = PLAYFUL_PATTERNS.some((pattern) => pattern.test(text))
  if (isPlayful) {
    return {
      model: 'B_intent',
      intent: 'playful',
      emotion: 'playful',
      severity: 'low',
      confidence: 0.88,
      emergencyProbability: 0.08, // strongly suppressed
      isGenuineDistress: false,
    }
  }

  // 3. Check for Normal Conversational speech
  const isConversational = CONVERSATIONAL_PATTERNS.some((pattern) => pattern.test(text))
  if (isConversational) {
    return {
      model: 'B_intent',
      intent: 'normal_conversation',
      emotion: 'neutral',
      severity: 'low',
      confidence: 0.85,
      emergencyProbability: 0.12, // suppressed
      isGenuineDistress: false,
    }
  }

  // 4. Check for Resistance & Boundary Violation
  const isResistance = RESISTANCE_PATTERNS.some((pattern) => pattern.test(text))
  if (isResistance) {
    return {
      model: 'B_intent',
      intent: 'resistance',
      emotion: 'fear',
      severity: 'high',
      confidence: 0.94,
      emergencyProbability: Math.max(0.88, baseIntentResult.emergencyProbability),
      isGenuineDistress: true,
    }
  }

  // 5. Check for Threat / Police alerts
  const isThreat = THREAT_PATTERNS.some((pattern) => pattern.test(text))
  if (isThreat) {
    return {
      model: 'B_intent',
      intent: 'threat_speech',
      emotion: 'fear',
      severity: 'high',
      confidence: 0.95,
      emergencyProbability: Math.max(0.92, baseIntentResult.emergencyProbability),
      isGenuineDistress: true,
    }
  }

  // 6. Check for Fear
  const isFear = FEAR_PATTERNS.some((pattern) => pattern.test(text))
  if (isFear) {
    return {
      model: 'B_intent',
      intent: 'fear',
      emotion: 'fear',
      severity: 'high',
      confidence: 0.90,
      emergencyProbability: Math.max(0.85, baseIntentResult.emergencyProbability),
      isGenuineDistress: true,
    }
  }

  // 7. Check for Direct Distress
  const isDistress = DISTRESS_PATTERNS.some((pattern) => pattern.test(text))
  if (isDistress) {
    // Check for extreme panic (3+ exclamation marks or ALL-CAPS Latin text)
    const hasPanicExclamation = (text.match(/!/g) || []).length >= 3
    const isAllUpperLatin = /[A-Z]{3,}/.test(text) && !/[a-z]/.test(text)
    const isPanic = hasPanicExclamation || isAllUpperLatin
    return {
      model: 'B_intent',
      intent: isPanic ? 'panic' : 'distress',
      emotion: 'fear',
      severity: isPanic ? 'critical' : 'high',
      confidence: 0.92,
      emergencyProbability: Math.max(0.89, baseIntentResult.emergencyProbability),
      isGenuineDistress: true,
    }
  }

  // 8. Fallback to statistical classifier output
  if (baseIntentResult.level === 'HIGH') {
    return {
      model: 'B_intent',
      intent: 'distress',
      emotion: 'fear',
      severity: 'high',
      confidence: Math.round(baseIntentResult.emergencyProbability * 100) / 100,
      emergencyProbability: baseIntentResult.emergencyProbability,
      isGenuineDistress: true,
    }
  }

  if (baseIntentResult.level === 'MEDIUM') {
    return {
      model: 'B_intent',
      intent: 'uncertain',
      emotion: 'neutral',
      severity: 'medium',
      confidence: Math.round(baseIntentResult.emergencyProbability * 100) / 100,
      emergencyProbability: baseIntentResult.emergencyProbability,
      isGenuineDistress: false,
    }
  }

  return {
    model: 'B_intent',
    intent: 'normal_conversation',
    emotion: 'neutral',
    severity: 'low',
    confidence: 0.80,
    emergencyProbability: baseIntentResult.emergencyProbability,
    isGenuineDistress: false,
  }
}
