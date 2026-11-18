import { describe, expect, it } from 'vitest'
import { buildEvaluationExport, computeBinaryMetrics } from './evaluationMetrics'
import { evaluateAllModels } from './testCases'

describe('binary fixture metrics', () => {
  it('computes confusion counts and rates while excluding ambiguous and manual rows', () => {
    const result = computeBinaryMetrics(
      ['EMERGENCY', 'NOT_EMERGENCY', 'AMBIGUOUS', null, 'EMERGENCY'],
      ['HIGH', 'HIGH', 'LOW', 'HIGH', 'LOW'],
    )

    expect(result).toEqual({
      truePositive: 1,
      falsePositive: 1,
      trueNegative: 0,
      falseNegative: 1,
      evaluatedCount: 3,
      precision: 0.5,
      recall: 0.5,
      f1: 0.5,
      falsePositiveRate: 1,
      falseNegativeRate: 0.5,
      accuracy: 1 / 3,
    })
  })

  it('returns null for undefined denominators and empty binary samples', () => {
    expect(computeBinaryMetrics(['EMERGENCY'], ['LOW'])).toEqual({
      truePositive: 0,
      falsePositive: 0,
      trueNegative: 0,
      falseNegative: 1,
      evaluatedCount: 1,
      precision: null,
      recall: 0,
      f1: 0,
      falsePositiveRate: null,
      falseNegativeRate: 1,
      accuracy: 0,
    })
    expect(computeBinaryMetrics(['AMBIGUOUS', null], ['HIGH', 'LOW']).accuracy).toBeNull()
  })

  it('rejects label and prediction arrays with different lengths', () => {
    expect(() => computeBinaryMetrics(['EMERGENCY'], [])).toThrow(/same length/i)
  })
})

describe('A-D model fixture export', () => {
  it('separates keyword, intent, context, and extra-signal predictions', () => {
    const results = evaluateAllModels()
    const benignKeyword = results.find((item) => item.fixture.name === 'False emergency phrases')!
    const repeated = results.find((item) => item.fixture.name === 'Repeated trigger')!

    expect(benignKeyword.models.A.level).toBe('HIGH')
    expect(benignKeyword.models.B.level).toBe('LOW')
    expect(repeated.models.D.level).toBe('HIGH')
    expect(repeated.models.D.level).not.toBe(repeated.models.C.level)
  })

  it('exports deterministic fixture metadata and metric values', () => {
    const results = evaluateAllModels()
    const exported = buildEvaluationExport(results, '2026-10-29T00:00:00.000Z')

    expect(exported.generatedAt).toBe('2026-10-29T00:00:00.000Z')
    expect(exported.dataset).toMatchObject({ name: 'hershield-synthetic-fixtures', fixtureCount: 14 })
    expect(Object.keys(exported.models).sort()).toEqual(['A', 'B', 'C', 'D'])
    expect(exported.models.A.metrics).toHaveProperty('truePositive')
    expect(exported.predictions).toHaveLength(14)
    expect(exported.predictions.find((row) => row.label === null)?.excludedFromBinaryMetrics).toBe(true)
  })
})
