import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  evaluateAllFixtures,
  evaluateKeywordBaseline,
  type FixtureEvaluation,
} from '../lib/fixtures/testCases'
import { classifyUtterance, intentModel } from '../lib/intent/classify'
import { assessRisk, type RiskSignals, type SafetyMode, type JourneyStatus, type RiskLevel } from '../lib/risk/riskEngine'
import { decideAction } from '../lib/policy'

export function TestingDashboard() {
  const evaluations: FixtureEvaluation[] = useMemo(() => evaluateAllFixtures(), [])

  const totalFixtures = evaluations.length
  const passedFixtures = evaluations.filter((e) => e.passed).length
  const failedFixtures = totalFixtures - passedFixtures

  // Interactive custom tester state
  const [customText, setCustomText] = useState('')
  const [safetyMode, setSafetyMode] = useState<SafetyMode>('ACTIVE')
  const [journeyStatus, setJourneyStatus] = useState<JourneyStatus>('NO_JOURNEY')
  const [threatLevel, setThreatLevel] = useState<RiskLevel>('LOW')
  const [repeatedTrigger, setRepeatedTrigger] = useState(false)

  const customEvaluation = useMemo(() => {
    if (!customText.trim()) return null

    const keywordRes = evaluateKeywordBaseline(customText)
    const intentRes = classifyUtterance(intentModel, customText)
    
    // In live system, high intent or acoustic distress can elevate threatLevel
    const effectiveThreat = threatLevel !== 'LOW' ? threatLevel : (intentRes.level === 'HIGH' ? 'HIGH' : 'LOW')

    const signals: RiskSignals = {
      intentLevel: intentRes.level,
      threatLevel: effectiveThreat,
      safetyMode,
      journeyStatus,
      repeatedTrigger,
    }

    const riskRes = assessRisk(signals)
    const policyRes = decideAction(riskRes.level, 'engine')

    return {
      keyword: keywordRes,
      intent: intentRes,
      signals,
      risk: riskRes,
      policy: policyRes,
    }
  }, [customText, safetyMode, journeyStatus, threatLevel, repeatedTrigger])

  return (
    <div className="testing-dashboard" style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Testing &amp; Fixtures Dashboard</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>
            Model ablation comparison &amp; automated test fixtures (TESTING.md §2)
          </p>
        </div>
        <Link to="/" style={{ fontSize: '0.9rem', color: '#1849a9' }}>← Home</Link>
      </header>

      {/* Summary Scorecard */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Total Fixtures</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{totalFixtures}</div>
        </div>
        <div style={{ background: '#ecfdf3', border: '1px solid #a6f4c5', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#027a48' }}>Passed</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#027a48' }}>{passedFixtures}</div>
        </div>
        <div style={{ background: failedFixtures > 0 ? '#fef3f2' : '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: failedFixtures > 0 ? '#b42318' : '#666' }}>Failed</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: failedFixtures > 0 ? '#b42318' : '#666' }}>{failedFixtures}</div>
        </div>
      </section>

      {/* Custom Utterance Tester */}
      <section style={{
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '1.25rem',
        marginBottom: '2rem',
      }}>
        <h2 style={{ fontSize: '1.15rem', marginTop: 0, marginBottom: '0.75rem' }}>Interactive Utterance &amp; Pipeline Tester</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="text"
            placeholder="Type any utterance (e.g. 'Help me with my assignment' or 'Someone is following me')..."
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            style={{
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '6px',
              fontSize: '1rem',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Safety Mode:
              <select value={safetyMode} onChange={(e) => setSafetyMode(e.target.value as SafetyMode)}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Journey Status:
              <select value={journeyStatus} onChange={(e) => setJourneyStatus(e.target.value as JourneyStatus)}>
                <option value="NO_JOURNEY">NO_JOURNEY</option>
                <option value="ON_ROUTE">ON_ROUTE</option>
                <option value="DEVIATED">DEVIATED</option>
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Threat Context:
              <select value={threatLevel} onChange={(e) => setThreatLevel(e.target.value as RiskLevel)}>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
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
              background: '#f8f9fa',
              borderRadius: '6px',
              padding: '1rem',
              marginTop: '0.5rem',
              border: '1px solid #e9ecef',
            }}>
              <h3 style={{ fontSize: '0.95rem', marginTop: 0, marginBottom: '0.5rem' }}>Pipeline Evaluation:</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>
                  <strong>Model A (Keyword):</strong><br />
                  Triggered: {customEvaluation.keyword.triggered ? 'YES' : 'NO'}
                  {customEvaluation.keyword.matchedKeyword &&  ("")}
                  <br />
                  Result: <span style={{ fontWeight: 600 }}>{customEvaluation.keyword.level}</span>
                </div>

                <div>
                  <strong>Model B (Intent Classifier):</strong><br />
                  Level: <span style={{ fontWeight: 600 }}>{customEvaluation.intent.level}</span><br />
                  Probability: {(customEvaluation.intent.emergencyProbability * 100).toFixed(1)}%
                </div>

                <div>
                  <strong>Model C (Risk Engine):</strong><br />
                  Risk Level: <span style={{ fontWeight: 600 }}>{customEvaluation.risk.level}</span> (Score: {customEvaluation.risk.score})<br />
                  Action: <span style={{ fontWeight: 600 }}>{customEvaluation.policy.action}</span>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#495057' }}>
                <strong>Explanation:</strong> {customEvaluation.risk.reason}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Automated Fixtures Table */}
      <section style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1.25rem', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '1.15rem', marginTop: 0, marginBottom: '0.75rem' }}>Automated Test Fixtures (14 Cases)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem' }}>#</th>
              <th style={{ padding: '0.5rem' }}>Case</th>
              <th style={{ padding: '0.5rem' }}>Utterance</th>
              <th style={{ padding: '0.5rem' }}>Model A (Keyword)</th>
              <th style={{ padding: '0.5rem' }}>Model B (Intent)</th>
              <th style={{ padding: '0.5rem' }}>Model C (Risk Engine)</th>
              <th style={{ padding: '0.5rem' }}>Expected</th>
              <th style={{ padding: '0.5rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((item) => (
              <tr key={item.fixture.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem', fontWeight: 600 }}>{item.fixture.id}</td>
                <td style={{ padding: '0.5rem' }}>
                  <strong>{item.fixture.name}</strong>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>{item.fixture.description}</div>
                </td>
                <td style={{ padding: '0.5rem', fontStyle: 'italic', maxWidth: '180px' }}>
                  "{item.fixture.utterance}"
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <span style={{
                    color: item.keywordResult.level === 'HIGH' ? '#b42318' : '#666',
                    fontWeight: item.keywordResult.level === 'HIGH' ? 600 : 400,
                  }}>
                    {item.keywordResult.level}
                  </span>
                  {item.keywordResult.matchedKeyword && (
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>[{item.keywordResult.matchedKeyword}]</div>
                  )}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>{item.intentResult.level}</span>
                  <div style={{ fontSize: '0.7rem', color: '#888' }}>
                    {(item.intentResult.emergencyProbability * 100).toFixed(0)}%
                  </div>
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <span style={{
                    fontWeight: 600,
                    color: item.riskAssessment.level === 'HIGH' ? '#b42318' : item.riskAssessment.level === 'MEDIUM' ? '#b54708' : '#027a48',
                  }}>
                    {item.riskAssessment.level}
                  </span>
                  <div style={{ fontSize: '0.7rem', color: '#666' }}>
                    {item.policyDecision.action}
                  </div>
                </td>
                <td style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                  <strong>{item.fixture.expectedLevel}</strong>
                  <div style={{ fontSize: '0.7rem', color: '#666' }}>{item.fixture.expectedAction}</div>
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <span style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: item.passed ? '#ecfdf3' : '#fef3f2',
                    color: item.passed ? '#027a48' : '#b42318',
                  }}>
                    {item.passed ? 'PASS' : 'FAIL'}
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
