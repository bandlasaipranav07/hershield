import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  evaluateAllFixtures,
  evaluateKeywordBaseline,
  type FixtureEvaluation,
} from '../lib/fixtures/testCases'
import {
  buildEvaluationExport,
  computeBinaryMetrics,
  type ModelId,
} from '../lib/fixtures/evaluationMetrics'
import { classifyUtterance, intentModel } from '../lib/intent/classify'
import { assessRisk, type RiskSignals, type SafetyMode, type JourneyStatus, type RiskLevel } from '../lib/risk/riskEngine'
import { decideAction } from '../lib/policy'
import { evaluateModelA } from '../lib/detection/modelA'
import { evaluateModelB } from '../lib/detection/modelB'
import { ModelCContextAnalyzer } from '../lib/detection/modelC'
import { evaluateModelD } from '../lib/detection/modelD'

function formatMetric(value: number | null): string {
  return value === null ? 'Unavailable' : `${(value * 100).toFixed(1)}%`
}

export function TestingDashboard() {
  const evaluations: FixtureEvaluation[] = useMemo(() => evaluateAllFixtures(), [])

  const totalFixtures = evaluations.length
  const passedFixtures = evaluations.filter((e) => e.passed).length
  const failedFixtures = totalFixtures - passedFixtures
  const modelIds: ModelId[] = ['A', 'B', 'C', 'D']
  const modelMetrics = Object.fromEntries(modelIds.map((modelId) => [
    modelId,
    computeBinaryMetrics(
      evaluations.map((item) => item.label),
      evaluations.map((item) => item.models[modelId].level),
    ),
  ])) as Record<ModelId, ReturnType<typeof computeBinaryMetrics>>

  // Interactive custom tester state
  const [customText, setCustomText] = useState('')
  const [safetyMode, setSafetyMode] = useState<SafetyMode>('ACTIVE')
  const [journeyStatus, setJourneyStatus] = useState<JourneyStatus>('NO_JOURNEY')
  const [threatLevel, setThreatLevel] = useState<RiskLevel>('LOW')
  const [repeatedTrigger, setRepeatedTrigger] = useState(false)

  const customEvaluation = useMemo(() => {
    if (!customText.trim()) return null

    // Run Four-Model Architecture
    const fourModelA = evaluateModelA({
      samples: new Float32Array(16000),
      transcript: customText,
    })
    const fourModelB = evaluateModelB(customText)
    const contextAnalyzer = new ModelCContextAnalyzer()
    const fourModelC = contextAnalyzer.evaluate({
      modelA: fourModelA,
      modelB: fourModelB,
      safetyMode,
      journeyStatus,
    })
    const fourModelD = evaluateModelD({
      modelA: fourModelA,
      modelB: fourModelB,
      modelC: fourModelC,
    })

    const keywordRes = evaluateKeywordBaseline(customText)
    const intentRes = classifyUtterance(intentModel, customText)
    
    // In live system, high intent or acoustic distress can elevate threatLevel
    const effectiveThreat = threatLevel !== 'LOW' ? threatLevel : (intentRes.level === 'HIGH' ? 'HIGH' : 'LOW')

    const signals: RiskSignals = {
      intentLevel: intentRes.level,
      threatLevel: effectiveThreat,
      safetyMode,
      journeyStatus,
      repeatedTrigger: false,
    }

    const riskRes = assessRisk(signals)
    const policyRes = decideAction(riskRes.level, 'engine')
    const riskD = assessRisk({ ...signals, repeatedTrigger })
    const policyD = decideAction(riskD.level, 'engine')

    return {
      keyword: keywordRes,
      intent: intentRes,
      signals,
      risk: riskRes,
      policy: policyRes,
      riskD,
      policyD,
      fourModelA,
      fourModelB,
      fourModelC,
      fourModelD,
    }
  }, [customText, safetyMode, journeyStatus, threatLevel, repeatedTrigger])

  function exportFixtureResults() {
    const exportData = buildEvaluationExport(evaluations)
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `hershield-fixture-results-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="testing-dashboard" style={{ padding: '1.5rem 1rem', maxWidth: '960px', margin: '0 auto' }}>
      <header style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#f8fafc' }}>Testing &amp; Fixtures Dashboard</h1>
          <p style={{ margin: '0.35rem 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
            Synthetic fixture comparison — seed-model outputs, not real-world evaluation
          </p>
        </div>
        <Link to="/" style={{ fontSize: '0.9rem', color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}>&larr; Home</Link>
      </header>

      <p role="note" style={{ background: 'rgba(30, 41, 59, 0.75)', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: '10px', padding: '0.85rem 1rem', color: '#cbd5e1', lineHeight: 1.55 }}>
        These are deterministic results from 14 hand-written synthetic fixtures and a seed intent model. They are not measured real-world accuracy or audio tests. Only clearly labeled EMERGENCY and NOT_EMERGENCY examples count toward binary metrics; ambiguous and manual SOS cases are excluded.
      </p>

      {/* Summary Scorecard */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '12px', padding: '1.25rem', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Fixtures</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem', color: '#f8fafc' }}>{totalFixtures}</div>
        </div>
        <div style={{ background: 'rgba(6, 118, 71, 0.18)', border: '1px solid rgba(52, 211, 153, 0.35)', borderRadius: '12px', padding: '1.25rem', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
          <div style={{ fontSize: '0.8rem', color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Matches expected</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem', color: '#34d399' }}>{passedFixtures}</div>
        </div>
        <div style={{ background: failedFixtures > 0 ? 'rgba(239, 68, 68, 0.18)' : 'rgba(15, 23, 42, 0.7)', border: failedFixtures > 0 ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '12px', padding: '1.25rem', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
          <div style={{ fontSize: '0.8rem', color: failedFixtures > 0 ? '#fca5a5' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Differs from expected</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem', color: failedFixtures > 0 ? '#f87171' : '#64748b' }}>{failedFixtures}</div>
        </div>
      </section>

      <section aria-label="A-D fixture metrics" style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '14px', padding: '1.5rem', marginBottom: '2rem', overflowX: 'auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#f8fafc' }}>Synthetic fixture metrics</h2>
            <p style={{ margin: '0.35rem 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>Positive prediction = HIGH risk (automatic escalation). Undefined denominators show as unavailable.</p>
          </div>
          <button type="button" onClick={exportFixtureResults}>Download fixture results (JSON)</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', color: '#cbd5e1', minWidth: '740px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', textAlign: 'left', color: '#94a3b8' }}>
              <th style={{ padding: '0.5rem' }}>Model</th><th style={{ padding: '0.5rem' }}>N</th>
              <th style={{ padding: '0.5rem' }}>TP</th><th style={{ padding: '0.5rem' }}>FP</th>
              <th style={{ padding: '0.5rem' }}>TN</th><th style={{ padding: '0.5rem' }}>FN</th>
              <th style={{ padding: '0.5rem' }}>Precision</th><th style={{ padding: '0.5rem' }}>Recall</th>
              <th style={{ padding: '0.5rem' }}>F1</th><th style={{ padding: '0.5rem' }}>FPR</th>
              <th style={{ padding: '0.5rem' }}>FNR</th><th style={{ padding: '0.5rem' }}>Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {modelIds.map((modelId) => {
              const metrics = modelMetrics[modelId]
              const descriptions: Record<ModelId, string> = {
                A: 'Keyword baseline',
                B: 'Seed intent classifier',
                C: 'Intent + safety/journey context',
                D: 'C + synthetic acoustic/repeat cues',
              }
              return (
                <tr key={modelId} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '0.5rem' }}><strong>{modelId}</strong><div style={{ color: '#94a3b8' }}>{descriptions[modelId]}</div></td>
                  <td style={{ padding: '0.5rem' }}>{metrics.evaluatedCount}</td>
                  <td style={{ padding: '0.5rem' }}>{metrics.truePositive}</td><td style={{ padding: '0.5rem' }}>{metrics.falsePositive}</td>
                  <td style={{ padding: '0.5rem' }}>{metrics.trueNegative}</td><td style={{ padding: '0.5rem' }}>{metrics.falseNegative}</td>
                  <td style={{ padding: '0.5rem' }}>{formatMetric(metrics.precision)}</td><td style={{ padding: '0.5rem' }}>{formatMetric(metrics.recall)}</td>
                  <td style={{ padding: '0.5rem' }}>{formatMetric(metrics.f1)}</td><td style={{ padding: '0.5rem' }}>{formatMetric(metrics.falsePositiveRate)}</td>
                  <td style={{ padding: '0.5rem' }}>{formatMetric(metrics.falseNegativeRate)}</td><td style={{ padding: '0.5rem' }}>{formatMetric(metrics.accuracy)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {/* Custom Utterance Tester */}
      <section style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '14px',
        padding: '1.5rem',
        marginBottom: '2rem',
        backdropFilter: 'blur(12px)',
      }}>
        <h2 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '0.85rem', color: '#f8fafc' }}>Interactive Utterance &amp; Pipeline Tester</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <input
            type="text"
            placeholder="Type any utterance in English, Telugu (తెలుగు), or Hindi (हिंदी)..."
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            style={{
              padding: '0.85rem 1rem',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '8px',
              fontSize: '1rem',
              color: '#f8fafc',
              width: '100%',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />

          {/* Quick preset test phrases */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Quick Test:</span>
            {[
              { label: 'English Distress', text: 'Someone help me! Please save me!' },
              { label: 'Telugu Distress', text: 'నన్ను కాపాడండి! ఎవరైనా సహాయం చేయండి!' },
              { label: 'Telugu Resistance', text: 'నన్ను ముట్టుకోవద్దు! వదిలేయండి!' },
              { label: 'Hindi Distress', text: 'बचाओ मुझे! कोई मदद करो!' },
              { label: 'Hindi Resistance', text: 'हाथ मत लगाओ! मुझे छोड़ो!' },
              { label: 'Playful Laughter', text: 'Stop it, help me, you are hilarious haha' },
              { label: 'Casual Conversation', text: 'Can someone help carry this bag?' },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setCustomText(preset.text)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  color: '#e2e8f0',
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.65rem',
                  cursor: 'pointer',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.88rem', color: '#cbd5e1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Safety Mode:
              <select
                value={safetyMode}
                onChange={(e) => setSafetyMode(e.target.value as SafetyMode)}
                style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', padding: '0.35rem 0.5rem' }}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Journey Status:
              <select
                value={journeyStatus}
                onChange={(e) => setJourneyStatus(e.target.value as JourneyStatus)}
                style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', padding: '0.35rem 0.5rem' }}
              >
                <option value="NO_JOURNEY">NO_JOURNEY</option>
                <option value="ON_ROUTE">ON_ROUTE</option>
                <option value="DEVIATED">DEVIATED</option>
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Threat Context:
              <select
                value={threatLevel}
                onChange={(e) => setThreatLevel(e.target.value as RiskLevel)}
                style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', padding: '0.35rem 0.5rem' }}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={repeatedTrigger}
                onChange={(e) => setRepeatedTrigger(e.target.checked)}
              />
              Repeated Trigger (short window)
            </label>
          </div>

          {customEvaluation && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)',
              borderRadius: '8px',
              padding: '1.25rem',
              marginTop: '0.5rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '0.75rem', color: '#c7d2fe' }}>Pipeline Evaluation:</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', fontSize: '0.88rem' }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <strong style={{ color: '#818cf8' }}>Model A (Keyword):</strong><br />
                  Triggered: <span style={{ fontWeight: 700, color: customEvaluation.keyword.triggered ? '#f87171' : '#34d399' }}>{customEvaluation.keyword.triggered ? 'YES' : 'NO'}</span><br />
                  Matched: <strong style={{ color: '#e0e7ff' }}>{customEvaluation.keyword.matchedKeyword ?? 'None'}</strong><br />
                  Level: {customEvaluation.keyword.level}
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <strong style={{ color: '#818cf8' }}>Model B (Intent Classifier):</strong><br />
                  Level: <span style={{ fontWeight: 700, color: customEvaluation.intent.level === 'HIGH' ? '#f87171' : customEvaluation.intent.level === 'MEDIUM' ? '#fbbf24' : '#34d399' }}>{customEvaluation.intent.level}</span><br />
                  Emergency Prob: {(customEvaluation.intent.emergencyProbability * 100).toFixed(1)}%<br />
                  Model: Logistic Regression (TF-IDF)
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <strong style={{ color: '#818cf8' }}>Model C (Risk Engine):</strong><br />
                  Risk Level: <span style={{ fontWeight: 700, color: customEvaluation.risk.level === 'HIGH' ? '#f87171' : customEvaluation.risk.level === 'MEDIUM' ? '#fbbf24' : '#34d399' }}>{customEvaluation.risk.level}</span> (Score: {customEvaluation.risk.score})<br />
                  Action: <span style={{ fontWeight: 700, color: customEvaluation.policy.action === 'ESCALATE' ? '#f87171' : customEvaluation.policy.action === 'CONFIRMATION_REQUIRED' ? '#fbbf24' : '#34d399' }}>{customEvaluation.policy.action}</span>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <strong style={{ color: '#818cf8' }}>Model D (Extra Signals):</strong><br />
                  Risk Level: <span style={{ fontWeight: 700, color: customEvaluation.riskD.level === 'HIGH' ? '#f87171' : customEvaluation.riskD.level === 'MEDIUM' ? '#fbbf24' : '#34d399' }}>{customEvaluation.riskD.level}</span> (Score: {customEvaluation.riskD.score})<br />
                  Action: <span style={{ fontWeight: 700, color: customEvaluation.policyD.action === 'ESCALATE' ? '#f87171' : customEvaluation.policyD.action === 'CONFIRMATION_REQUIRED' ? '#fbbf24' : '#34d399' }}>{customEvaluation.policyD.action}</span>
                  <div style={{ marginTop: '0.35rem', color: '#94a3b8', fontSize: '0.75rem' }}>Uses the repeat toggle; no acoustic sample is supplied by this text tester.</div>
                </div>
              </div>

              {/* Advanced Multilingual 4-Model Pipeline Breakdown */}
              <h4 style={{ fontSize: '0.9rem', marginTop: '1.25rem', marginBottom: '0.5rem', color: '#a5b4fc' }}>
                Multilingual 4-Model Detection Engine (English, Telugu, Hindi):
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <strong style={{ color: '#38bdf8' }}>4-Model A:</strong> {customEvaluation.fourModelA.trigger_detected ? `Triggered (${customEvaluation.fourModelA.matched_language.toUpperCase()})` : 'None'}<br />
                  Type: {customEvaluation.fourModelA.trigger_type}
                </div>
                <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <strong style={{ color: '#38bdf8' }}>4-Model B:</strong> {customEvaluation.fourModelB.intent} ({customEvaluation.fourModelB.severity})<br />
                  Emotion: {customEvaluation.fourModelB.emotion}
                </div>
                <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <strong style={{ color: '#38bdf8' }}>4-Model C:</strong> {customEvaluation.fourModelC.temporal_pattern}<br />
                  Context Score: {customEvaluation.fourModelC.context_threat_score}/10
                </div>
                <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <strong style={{ color: '#38bdf8' }}>4-Model D:</strong> <span style={{ fontWeight: 700, color: customEvaluation.fourModelD.classification === 'normal_activity' ? '#34d399' : '#f87171' }}>{customEvaluation.fourModelD.classification}</span><br />
                  Action: {customEvaluation.fourModelD.action}
                </div>
              </div>

              <div style={{ marginTop: '0.85rem', fontSize: '0.82rem', color: '#94a3b8' }}>
                <strong style={{ color: '#cbd5e1' }}>Explanation:</strong> {customEvaluation.risk.reason}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Automated Fixtures Table */}
      <section style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '14px', padding: '1.5rem', overflowX: 'auto', backdropFilter: 'blur(12px)' }}>
        <h2 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '0.85rem', color: '#f8fafc' }}>Synthetic Test Fixtures (14 Cases)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#cbd5e1' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)', textAlign: 'left', color: '#94a3b8' }}>
              <th style={{ padding: '0.65rem' }}>#</th>
              <th style={{ padding: '0.65rem' }}>Case</th>
              <th style={{ padding: '0.65rem' }}>Utterance</th>
              <th style={{ padding: '0.65rem' }}>Gold label</th>
              <th style={{ padding: '0.65rem' }}>Model A (Keyword)</th>
              <th style={{ padding: '0.65rem' }}>Model B (Intent)</th>
              <th style={{ padding: '0.65rem' }}>Model C (Context)</th>
              <th style={{ padding: '0.65rem' }}>Model D (Extra signals)</th>
              <th style={{ padding: '0.65rem' }}>Expected</th>
              <th style={{ padding: '0.65rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((item) => (
              <tr key={item.fixture.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <td style={{ padding: '0.65rem', fontWeight: 700, color: '#f8fafc' }}>{item.fixture.id}</td>
                <td style={{ padding: '0.65rem' }}>
                  <strong style={{ color: '#f8fafc' }}>{item.fixture.name}</strong>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.fixture.description}</div>
                </td>
                <td style={{ padding: '0.65rem', fontStyle: 'italic', maxWidth: '200px', color: '#cbd5e1' }}>
                  &quot;{item.fixture.utterance}&quot;
                </td>
                <td style={{ padding: '0.65rem' }}>{item.label ?? 'MANUAL / excluded'}</td>
                <td style={{ padding: '0.65rem' }}>
                  <span style={{
                    color: item.keywordResult.level === 'HIGH' ? '#f87171' : '#94a3b8',
                    fontWeight: item.keywordResult.level === 'HIGH' ? 700 : 400,
                  }}>
                    {item.keywordResult.level}
                  </span>
                  {item.keywordResult.matchedKeyword && (
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>[{item.keywordResult.matchedKeyword}]</div>
                  )}
                </td>
                <td style={{ padding: '0.65rem' }}>
                  <span style={{ fontWeight: 700, color: item.intentResult.level === 'HIGH' ? '#f87171' : item.intentResult.level === 'MEDIUM' ? '#fbbf24' : '#34d399' }}>
                    {item.intentResult.level}
                  </span>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    {(item.intentResult.emergencyProbability * 100).toFixed(0)}%
                  </div>
                </td>
                <td style={{ padding: '0.65rem' }}>
                  <span style={{
                    fontWeight: 700,
                    color: item.models.C.level === 'HIGH' ? '#f87171' : item.models.C.level === 'MEDIUM' ? '#fbbf24' : '#34d399',
                  }}>
                    {item.models.C.level}
                  </span>
                </td>
                <td style={{ padding: '0.65rem' }}>
                  <span style={{ fontWeight: 700, color: item.models.D.level === 'HIGH' ? '#f87171' : item.models.D.level === 'MEDIUM' ? '#fbbf24' : '#34d399' }}>
                    {item.models.D.level}
                  </span>
                </td>
                <td style={{ padding: '0.65rem', fontSize: '0.8rem' }}>
                  <strong style={{ color: '#f8fafc' }}>{item.fixture.expectedLevel}</strong>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{item.fixture.expectedAction}</div>
                </td>
                <td style={{ padding: '0.65rem' }}>
                  <span style={{
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: item.passed ? 'rgba(6, 118, 71, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                    color: item.passed ? '#34d399' : '#f87171',
                    border: item.passed ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                  }}>
                    {item.passed ? 'MATCH' : 'MISMATCH'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
