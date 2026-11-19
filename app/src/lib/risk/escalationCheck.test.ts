import { describe, it, expect } from 'vitest'
import { evaluateAllFixtures } from '../fixtures/testCases'
import { computeBinaryMetrics, type ModelId } from '../fixtures/evaluationMetrics'
import { TemporalRiskEngine } from './temporalRiskEngine'
import { intentModel } from '../intent/classify'
import { HerShieldRuntime } from '../core/runtime'

describe('Current Emergency System Audit & Escalation Analysis', () => {
  it('measures baseline performance of Models A, B, C, D on 20 fixtures', () => {
    const evaluations = evaluateAllFixtures()
    const modelIds: ModelId[] = ['A', 'B', 'C', 'D']
    
    console.log('\n================ FIXTURE EVALUATION METRICS ================')
    for (const id of modelIds) {
      const m = computeBinaryMetrics(
        evaluations.map((e) => e.label),
        evaluations.map((e) => e.models[id].level),
      )
      console.log(`\nModel ${id}:`)
      console.log(`  Accuracy:            ${((m.accuracy ?? 0) * 100).toFixed(1)}%`)
      console.log(`  Precision:           ${((m.precision ?? 0) * 100).toFixed(1)}%`)
      console.log(`  Recall:              ${((m.recall ?? 0) * 100).toFixed(1)}%`)
      console.log(`  F1 Score:            ${((m.f1 ?? 0) * 100).toFixed(1)}%`)
      console.log(`  False Positive Rate: ${((m.falsePositiveRate ?? 0) * 100).toFixed(1)}% (${m.falsePositive}/${m.falsePositive + m.trueNegative})`)
      console.log(`  False Negative Rate: ${((m.falseNegativeRate ?? 0) * 100).toFixed(1)}% (${m.falseNegative}/${m.falseNegative + m.truePositive})`)
    }
    console.log('============================================================\n')
  })

  it('tests how easily TemporalRiskEngine escalates on various scenarios', () => {
    const engine = new TemporalRiskEngine(intentModel)
    
    console.log('\n================ ESCALATION TRIGGER SENSITIVITY TEST ================')
    
    // Scenario 1: Pure loud sound (door slam / dropped object), NO words
    engine.reset()
    const loudSound = engine.evaluate({
      transcript: '',
      acoustic: { energy: 0.9, distressScore: 0.8 },
      safetyMode: 'ACTIVE',
    })
    console.log('1. Pure Loud Sound (door slam / dropping phone, energy 0.9):')
    console.log(`   ThreatLevel: ${loudSound.currentAssessment.level}, Score: ${loudSound.currentAssessment.score}, AggregatedScore: ${loudSound.aggregatedScore}`)
    console.log(`   ESCALATED: ${loudSound.escalated} (Reason: ${loudSound.reason})`)

    // Scenario 2: Casual conversational use of 'help'
    engine.reset()
    const casualHelp = engine.evaluate({
      transcript: 'Can you help me with dinner tonight?',
      acoustic: { energy: 0.3, distressScore: 0.1 },
      safetyMode: 'ACTIVE',
    })
    console.log('\n2. Casual conversation ("help me with dinner", energy 0.3):')
    console.log(`   Intent: ${casualHelp.intentResult.level} (${(casualHelp.intentResult.emergencyProbability * 100).toFixed(1)}%), ThreatLevel: ${casualHelp.currentAssessment.level}, Score: ${casualHelp.currentAssessment.score}`)
    console.log(`   ESCALATED: ${casualHelp.escalated}`)

    // Scenario 3: Joking / laughing ("Stop it! Help me haha!")
    engine.reset()
    const joking = engine.evaluate({
      transcript: 'Stop it, help me, you are hilarious haha',
      acoustic: { energy: 0.75, distressScore: 0.5 },
      safetyMode: 'ACTIVE',
    })
    console.log('\n3. Playful / joking ("Stop it, help me, you are hilarious haha", energy 0.75):')
    console.log(`   Intent: ${joking.intentResult.level} (${(joking.intentResult.emergencyProbability * 100).toFixed(1)}%), Score: ${joking.currentAssessment.score}, AggregatedScore: ${joking.aggregatedScore}`)
    console.log(`   ESCALATED: ${joking.escalated}`)

    // Scenario 4: Two consecutive normal utterances in 10 seconds
    engine.reset()
    const firstUtterance = engine.evaluate({
      timestamp: 1000,
      transcript: 'Can someone help carry this bag?',
      acoustic: { energy: 0.4, distressScore: 0.2 },
      safetyMode: 'ACTIVE',
    })
    const secondUtterance = engine.evaluate({
      timestamp: 6000,
      transcript: 'Thanks for the help',
      acoustic: { energy: 0.4, distressScore: 0.2 },
      safetyMode: 'ACTIVE',
    })
    console.log('\n4. Consecutive everyday phrases with "help" within 5 seconds:')
    console.log(`   Event 1 - Score: ${firstUtterance.currentAssessment.score}, Escalated: ${firstUtterance.escalated}`)
    console.log(`   Event 2 - Score: ${secondUtterance.currentAssessment.score}, AggregatedScore: ${secondUtterance.aggregatedScore}`)
    console.log(`   ESCALATED: ${secondUtterance.escalated}`)
    expect(secondUtterance.escalated).toBe(true)

    // Scenario 5: Genuine distress phrase ("Help me! Someone please help!")
    engine.reset()
    const genuine = engine.evaluate({
      transcript: 'Help me! Someone please help me!',
      acoustic: { energy: 0.7, distressScore: 0.7 },
      safetyMode: 'ACTIVE',
    })
    console.log('\n5. Genuine distress ("Help me! Someone please help me!", energy 0.7):')
    console.log(`   Intent: ${genuine.intentResult.level} (${(genuine.intentResult.emergencyProbability * 100).toFixed(1)}%), Score: ${genuine.currentAssessment.score}`)
    console.log(`   ESCALATED: ${genuine.escalated}`)

    console.log('=====================================================================\n')
  })

  it('tests runtime confirmation protocol bypass', async () => {
    let confirmationTriggered = false
    let threatConfirmed = false

    const runtime = new HerShieldRuntime({
      onConfirmationRequired: () => {
        confirmationTriggered = true
      },
      onThreatConfirmed: () => {
        threatConfirmed = true
      },
    })
    runtime.stateMachine.arm()

    // Simulate 1 second audio frame with high acoustic energy (e.g. dropped plate or traffic honk)
    const samples = new Float32Array(16000).fill(0.9) // loud noise
    const res = await runtime.processAudioFrame({
      samples,
      transcript: '',
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
    })

    console.log('\n================ RUNTIME PROTOCOL VERIFICATION ================')
    console.log(`Acoustic frame evaluated: Escalated = ${res.evaluation.escalated}, Action = ${res.decision.action}`)
    console.log(`Confirmation Required Fired: ${confirmationTriggered}`)
    console.log(`Immediate SOS Fired: ${threatConfirmed}`)

    // Now test with the playful utterance: "Stop it, help me, you are hilarious haha"
    confirmationTriggered = false
    threatConfirmed = false

    const playfulRes = await runtime.processAudioFrame({
      samples,
      transcript: 'Stop it, help me, you are hilarious haha',
      safetyMode: 'ACTIVE',
      journeyStatus: 'NO_JOURNEY',
    })

    console.log('\nPlayful utterance test ("Stop it, help me, you are hilarious haha"):')
    console.log(`   Evaluation Escalated: ${playfulRes.evaluation.escalated}`)
    console.log(`   Policy Decision Action: ${playfulRes.decision.action}`)
    console.log(`   Immediate SOS Dispatched (No Countdown): ${threatConfirmed}`)
    console.log('===============================================================\n')

    await runtime.stateMachine.disarm()
  })
})
