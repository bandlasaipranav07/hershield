import type { RiskLevel } from '../risk/riskEngine'

export type FixtureLabel = 'EMERGENCY' | 'NOT_EMERGENCY' | 'AMBIGUOUS' | null
export type ModelId = 'A' | 'B' | 'C' | 'D'

export interface BinaryMetrics {
  truePositive: number
  falsePositive: number
  trueNegative: number
  falseNegative: number
  evaluatedCount: number
  precision: number | null
  recall: number | null
  f1: number | null
  falsePositiveRate: number | null
  falseNegativeRate: number | null
  accuracy: number | null
}

export interface FixtureModelResult {
  fixture: { id: number; name: string; utterance: string }
  label: FixtureLabel
  models: Record<ModelId, { level: RiskLevel }>
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

/** HIGH is the positive class because it is the level that automatically escalates. */
export function computeBinaryMetrics(
  labels: readonly FixtureLabel[],
  predictions: readonly (RiskLevel | boolean)[],
): BinaryMetrics {
  if (labels.length !== predictions.length) {
    throw new Error('Labels and predictions must have the same length')
  }

  let truePositive = 0
  let falsePositive = 0
  let trueNegative = 0
  let falseNegative = 0

  labels.forEach((label, index) => {
    if (label !== 'EMERGENCY' && label !== 'NOT_EMERGENCY') return
    const predictedPositive = typeof predictions[index] === 'boolean'
      ? predictions[index] === true
      : predictions[index] === 'HIGH'
    if (label === 'EMERGENCY' && predictedPositive) truePositive++
    else if (label === 'EMERGENCY') falseNegative++
    else if (predictedPositive) falsePositive++
    else trueNegative++
  })

  const evaluatedCount = truePositive + falsePositive + trueNegative + falseNegative
  const precision = ratio(truePositive, truePositive + falsePositive)
  const recall = ratio(truePositive, truePositive + falseNegative)
  return {
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative,
    evaluatedCount,
    precision,
    recall,
    f1: ratio(2 * truePositive, 2 * truePositive + falsePositive + falseNegative),
    falsePositiveRate: ratio(falsePositive, falsePositive + trueNegative),
    falseNegativeRate: ratio(falseNegative, falseNegative + truePositive),
    accuracy: ratio(truePositive + trueNegative, evaluatedCount),
  }
}

export interface EvaluationExport {
  generatedAt: string
  evaluationVersion: string
  dataset: {
    name: 'hershield-synthetic-fixtures'
    fixtureCount: number
    emergencyCount: number
    notEmergencyCount: number
    excludedCount: number
  }
  models: Record<ModelId, { name: string; config: string; metrics: BinaryMetrics }>
  predictions: Array<{
    fixtureId: number
    fixtureName: string
    utterance: string
    label: FixtureLabel
    excludedFromBinaryMetrics: boolean
    A: RiskLevel
    B: RiskLevel
    C: RiskLevel
    D: RiskLevel
  }>
}

const MODEL_DETAILS: Record<ModelId, { name: string; config: string }> = {
  A: { name: 'Keyword baseline', config: 'keyword-list-v1' },
  B: { name: 'Intent classifier', config: 'seed-intent-model-v1' },
  C: { name: 'Intent + safety/journey context', config: 'risk-engine-context-v1' },
  D: { name: 'Context + synthetic acoustic/repeat cues', config: 'risk-engine-extra-signals-v1' },
}

export function buildEvaluationExport(
  results: readonly FixtureModelResult[],
  timestamp = new Date().toISOString(),
): EvaluationExport {
  const labels = results.map((result) => result.label)
  const models = Object.fromEntries(
    (['A', 'B', 'C', 'D'] as const).map((modelId) => [
      modelId,
      {
        ...MODEL_DETAILS[modelId],
        metrics: computeBinaryMetrics(labels, results.map((result) => result.models[modelId].level)),
      },
    ]),
  ) as EvaluationExport['models']

  return {
    generatedAt: timestamp,
    evaluationVersion: 'hershield-fixture-evaluation-v1',
    dataset: {
      name: 'hershield-synthetic-fixtures',
      fixtureCount: results.length,
      emergencyCount: labels.filter((label) => label === 'EMERGENCY').length,
      notEmergencyCount: labels.filter((label) => label === 'NOT_EMERGENCY').length,
      excludedCount: labels.filter((label) => label === 'AMBIGUOUS' || label === null).length,
    },
    models,
    predictions: results.map((result) => ({
      fixtureId: result.fixture.id,
      fixtureName: result.fixture.name,
      utterance: result.fixture.utterance,
      label: result.label,
      excludedFromBinaryMetrics: result.label === 'AMBIGUOUS' || result.label === null,
      A: result.models.A.level,
      B: result.models.B.level,
      C: result.models.C.level,
      D: result.models.D.level,
    })),
  }
}
