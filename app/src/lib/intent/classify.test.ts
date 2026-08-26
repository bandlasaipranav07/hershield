import { describe, expect, it } from 'vitest'
import {
  classifyUtterance,
  emergencyProbability,
  intentModel,
  loadIntentModel,
  sigmoid,
  tokenize,
  vectorize,
  type IntentModel,
} from './classify'

function tinyModel(overrides: Partial<IntentModel> = {}): IntentModel {
  return {
    version: 1,
    classes: ['NOT_EMERGENCY', 'EMERGENCY'],
    thresholds: { medium: 0.4, high: 0.75 },
    intercept: 0,
    vocabulary: { a: 0, b: 1 },
    idf: [1, 2],
    weights: [1, -1],
    ...overrides,
  }
}

describe('tokenize', () => {
  it('lowercases and strips punctuation', () => {
    expect(tokenize('Help! ME, NOW...')).toEqual(['help', 'me', 'now'])
  })

  it('keeps apostrophes inside words', () => {
    expect(tokenize("I can't find my friend's place")).toEqual([
      'i',
      "can't",
      'find',
      'my',
      "friend's",
      'place',
    ])
  })

  it('returns an empty array for punctuation-only input', () => {
    expect(tokenize('!!! ???')).toEqual([])
  })
})

describe('vectorize (TF-IDF with L2 normalization)', () => {
  it('counts known tokens, scales by idf, and normalizes to unit length', () => {
    const vec = vectorize(['a', 'b'], tinyModel())
    expect(vec[0]).toBeCloseTo(1 / Math.sqrt(5), 12)
    expect(vec[1]).toBeCloseTo(2 / Math.sqrt(5), 12)
  })

  it('counts repeated tokens before scaling', () => {
    const vec = vectorize(['b', 'b'], tinyModel())
    expect(vec[0]).toBeCloseTo(0, 12)
    expect(vec[1]).toBeCloseTo(1, 12)
  })

  it('ignores out-of-vocabulary words', () => {
    const vec = vectorize(['a', 'zzz'], tinyModel())
    expect(vec[0]).toBeCloseTo(1, 12)
    expect(vec[1]).toBeCloseTo(0, 12)
  })

  it('returns an all-zero vector for unknown-only text', () => {
    expect(vectorize(['zzz'], tinyModel())).toEqual([0, 0])
  })
})

describe('sigmoid + probability', () => {
  it('has known anchor values', () => {
    expect(sigmoid(0)).toBe(0.5)
    expect(sigmoid(2)).toBeCloseTo(1 / (1 + Math.exp(-2)), 12)
  })

  it('uses the intercept alone for empty/unknown text', () => {
    const model = tinyModel({ intercept: -0.5 })
    expect(emergencyProbability(model, '')).toBeCloseTo(sigmoid(-0.5), 12)
    expect(emergencyProbability(model, 'zzz qqq')).toBeCloseTo(sigmoid(-0.5), 12)
  })

  it('computes the dot product of normalized features and weights', () => {
    const model = tinyModel()
    const expected = sigmoid((1 / Math.sqrt(5)) * 1 + (2 / Math.sqrt(5)) * -1)
    expect(emergencyProbability(model, 'a b')).toBeCloseTo(expected, 12)
  })
})

describe('classifyUtterance levels', () => {
  it('maps probability bands LOW < medium <= MEDIUM < high <= HIGH', () => {
    expect(classifyUtterance(tinyModel({ intercept: -4 }), 'x').level).toBe('LOW')
    expect(classifyUtterance(tinyModel({ intercept: 0 }), 'x').level).toBe('MEDIUM')
    expect(classifyUtterance(tinyModel({ intercept: 3 }), 'x').level).toBe('HIGH')
  })
})

describe('loadIntentModel validation', () => {
  it('accepts a consistent model', () => {
    expect(() => loadIntentModel(tinyModel())).not.toThrow()
  })

  it('rejects mismatched idf/weights lengths', () => {
    const model = tinyModel({ idf: [1] })
    expect(() => loadIntentModel(model)).toThrow(/same length/)
  })

  it('rejects inverted or out-of-range thresholds', () => {
    expect(() => loadIntentModel(tinyModel({ thresholds: { medium: 0.8, high: 0.5 } }))).toThrow(
      /thresholds/,
    )
    expect(() => loadIntentModel(tinyModel({ thresholds: { medium: 0.5, high: 1.2 } }))).toThrow(
      /thresholds/,
    )
  })
})

describe('seed model sanity checks (placeholder until harness-trained export)', () => {
  it('loads the bundled model.json without errors', () => {
    expect(intentModel.version).toBe(1)
    expect(Object.keys(intentModel.vocabulary).length).toBe(intentModel.idf.length)
  })

  it('classifies a clear distress sentence as HIGH', () => {
    const result = classifyUtterance(
      intentModel,
      'please help me someone is following me',
    )
    expect(result.level).toBe('HIGH')
    expect(result.emergencyProbability).toBeGreaterThan(0.75)
  })

  it('classifies casual conversation as LOW', () => {
    const result = classifyUtterance(intentModel, 'thanks for the pizza it was great')
    expect(result.level).toBe('LOW')
    expect(result.emergencyProbability).toBeLessThan(0.4)
  })

  it('places worried phrasing in MEDIUM for confirmation-style handling', () => {
    const result = classifyUtterance(intentModel, 'i am scared now')
    expect(result.level).toBe('MEDIUM')
  })

  it('treats an empty transcript as LOW', () => {
    expect(classifyUtterance(intentModel, '').level).toBe('LOW')
  })
})
