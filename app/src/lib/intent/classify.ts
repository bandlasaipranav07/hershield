import rawModel from './model.json'

export interface IntentThresholds {
  medium: number
  high: number
}

export interface IntentModel {
  version: number
  classes: string[]
  thresholds: IntentThresholds
  intercept: number
  vocabulary: Record<string, number>
  idf: number[]
  weights: number[]
}

export type IntentLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface IntentResult {
  level: IntentLevel
  emergencyProbability: number
}

export function loadIntentModel(input: unknown): IntentModel {
  const model = input as IntentModel
  const vocabSize = Object.keys(model.vocabulary).length
  if (model.idf.length !== vocabSize || model.weights.length !== vocabSize) {
    throw new Error(
      `Invalid intent model: vocabulary (${vocabSize}), idf (${model.idf.length}) and weights (${model.weights.length}) must be the same length`,
    )
  }
  if (!Number.isFinite(model.intercept)) {
    throw new Error('Invalid intent model: intercept must be a finite number')
  }
  if (!(model.thresholds.medium < model.thresholds.high && model.thresholds.high <= 1)) {
    throw new Error('Invalid intent model: thresholds must satisfy medium < high <= 1')
  }
  return model
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

export function vectorize(
  tokens: string[],
  model: Pick<IntentModel, 'vocabulary' | 'idf'>,
): number[] {
  const vec = new Array<number>(model.idf.length).fill(0)
  for (const token of tokens) {
    const index = model.vocabulary[token]
    if (index === undefined) continue
    vec[index] += 1
  }

  let normSquared = 0
  for (let i = 0; i < vec.length; i++) {
    vec[i] *= model.idf[i]
    normSquared += vec[i] * vec[i]
  }
  const norm = Math.sqrt(normSquared)
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] /= norm
    }
  }
  return vec
}

export function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z))
}

export function emergencyProbability(model: IntentModel, text: string): number {
  const vec = vectorize(tokenize(text), model)
  let z = model.intercept
  for (let i = 0; i < vec.length; i++) {
    z += vec[i] * model.weights[i]
  }
  return sigmoid(z)
}

export function classifyUtterance(model: IntentModel, text: string): IntentResult {
  const probability = emergencyProbability(model, text)
  const level: IntentLevel =
    probability >= model.thresholds.high
      ? 'HIGH'
      : probability >= model.thresholds.medium
        ? 'MEDIUM'
        : 'LOW'
  return { level, emergencyProbability: probability }
}

export const intentModel: IntentModel = loadIntentModel(rawModel)
