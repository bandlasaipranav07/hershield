import { describe, it, expect } from 'vitest'
import { evaluateModelA, detectKeywordsInTranscript } from './modelA'
import { evaluateModelB } from './modelB'
import { ModelCContextAnalyzer } from './modelC'
import { evaluateModelD } from './modelD'
import { HerShieldRuntime } from '../core/runtime'

describe('HerShield Four-Model Detection Architecture', () => {
  describe('Model A – Multilingual Keyword & Acoustic Detection', () => {
    it('detects English emergency & resistance phrases', () => {
      const r1 = detectKeywordsInTranscript('Help me someone!')
      expect(r1.matched).toBe(true)
      expect(r1.definition?.phrase).toBe('help me')
      expect(r1.definition?.language).toBe('en')

      const r2 = detectKeywordsInTranscript("Don't touch me! Leave me alone!")
      expect(r2.matched).toBe(true)
      expect(r2.definition?.category).toBe('resistance')
    })

    it('detects Telugu emergency phrases (Native & Romanized)', () => {
      // Native script
      const r1 = detectKeywordsInTranscript('నన్ను కాపాడండి! ఎవరైనా సహాయం చేయండి!')
      expect(r1.matched).toBe(true)
      expect(r1.definition?.language).toBe('te')
      expect(r1.definition?.category).toBe('distress')

      const r2 = detectKeywordsInTranscript('నన్ను ముట్టుకోవద్దు వదిలేయ్!')
      expect(r2.matched).toBe(true)
      expect(r2.definition?.category).toBe('resistance')

      // Romanized
      const r3 = detectKeywordsInTranscript('nannu kapadandi please')
      expect(r3.matched).toBe(true)
      expect(r3.definition?.phrase).toBe('nannu kapadandi')
      expect(r3.definition?.language).toBe('te')

      const r4 = detectKeywordsInTranscript('nannu muttukoku vadileyi')
      expect(r4.matched).toBe(true)
      expect(r4.definition?.category).toBe('resistance')
    })

    it('detects Hindi emergency phrases (Native & Romanized)', () => {
      // Native script
      const r1 = detectKeywordsInTranscript('बचाओ मुझे कोई मदद करो!')
      expect(r1.matched).toBe(true)
      expect(r1.definition?.language).toBe('hi')
      expect(r1.definition?.category).toBe('distress')

      const r2 = detectKeywordsInTranscript('हाथ मत लगाओ मुझे छोड़ो!')
      expect(r2.matched).toBe(true)
      expect(r2.definition?.category).toBe('resistance')

      // Romanized
      const r3 = detectKeywordsInTranscript('bachao mujhe bachao!')
      expect(r3.matched).toBe(true)
      expect(r3.definition?.phrase).toBe('mujhe bachao')
      expect(r3.definition?.language).toBe('hi')

      const r4 = detectKeywordsInTranscript('chodo mujhe door raho')
      expect(r4.matched).toBe(true)
      expect(r4.definition?.category).toBe('resistance')
    })

    it('identifies acoustic screaming vs silent or ambient audio', () => {
      // Mock loud scream audio: high energy + high centroid frequency
      const screamSamples = new Float32Array(16000).fill(0.85)
      const freqData = new Uint8Array(256)
      for (let i = 100; i < 250; i++) freqData[i] = 200 // high frequencies present

      const output = evaluateModelA({
        samples: screamSamples,
        frequencyData: freqData,
        transcript: '',
      })

      expect(output.trigger_detected).toBe(true)
      expect(output.trigger_type).toBe('acoustic_scream')
      expect(output.confidence).toBeGreaterThanOrEqual(0.7)
    })
  })

  describe('Model B – Speech Intent & Semantics', () => {
    it('correctly classifies genuine distress', () => {
      const res = evaluateModelB('Help me! Please save me!')
      expect(res.intent).toBe('distress')
      expect(res.isGenuineDistress).toBe(true)
      expect(res.emergencyProbability).toBeGreaterThan(0.8)
    })

    it('suppresses playful banter and laughter containing trigger words', () => {
      const res = evaluateModelB('Stop it, help me, you are hilarious haha')
      expect(res.intent).toBe('playful')
      expect(res.isGenuineDistress).toBe(false)
      expect(res.emergencyProbability).toBeLessThan(0.2)
    })

    it('suppresses normal conversational requests containing "help"', () => {
      const res = evaluateModelB('Can you help me with dinner tonight?')
      expect(res.intent).toBe('normal_conversation')
      expect(res.isGenuineDistress).toBe(false)
      expect(res.emergencyProbability).toBeLessThan(0.25)
    })

    it('classifies resistance phrases with high severity', () => {
      const res = evaluateModelB("Don't touch me! Leave me alone!")
      expect(res.intent).toBe('resistance')
      expect(res.severity).toBe('high')
      expect(res.isGenuineDistress).toBe(true)
    })

    it('classifies Hindi & Telugu resistance and distress', () => {
      const hiRes = evaluateModelB('हाथ मत लगाओ मुझे छोड़ो!')
      expect(hiRes.intent).toBe('resistance')
      expect(hiRes.isGenuineDistress).toBe(true)

      const teRes = evaluateModelB('కాపాడండి సహాయం చేయండి!')
      expect(teRes.intent).toBe('distress')
      expect(teRes.isGenuineDistress).toBe(true)
    })
  })

  describe('Model C – Context & Temporal Progression', () => {
    it('distinguishes an isolated spike from sustained threat', () => {
      const analyzer = new ModelCContextAnalyzer()

      // Frame 1: Isolated loud sound
      const emptySamples = new Float32Array(16000)
      const modelA1 = evaluateModelA({ samples: emptySamples, transcript: '' })
      const modelB1 = evaluateModelB('')
      const out1 = analyzer.evaluate({ modelA: modelA1, modelB: modelB1 })

      expect(out1.temporal_pattern).toBe('calm')
      expect(out1.isEscalating).toBe(false)

      // Feed 3 consecutive distress frames
      const distressA = evaluateModelA({ samples: emptySamples, transcript: 'Help me!' })
      const distressB = evaluateModelB('Help me!')

      analyzer.evaluate({ modelA: distressA, modelB: distressB })
      analyzer.evaluate({ modelA: distressA, modelB: distressB })
      const outSustained = analyzer.evaluate({ modelA: distressA, modelB: distressB })

      expect(outSustained.temporal_pattern).toBe('sustained_threat')
      expect(outSustained.isEscalating).toBe(true)
      expect(outSustained.context_threat_score).toBeGreaterThanOrEqual(7)
    })
  })

  describe('Model D – Combined Decision Synthesizer', () => {
    it('suppresses playful banter even with keyword match', () => {
      const samples = new Float32Array(16000)
      const transcript = 'Stop it haha help me lol'
      const modelA = evaluateModelA({ samples, transcript })
      const modelB = evaluateModelB(transcript)
      const analyzer = new ModelCContextAnalyzer()
      const modelC = analyzer.evaluate({ modelA, modelB })

      const modelD = evaluateModelD({ modelA, modelB, modelC })

      expect(modelD.classification).toBe('normal_activity')
      expect(modelD.action).toBe('MONITOR')
      expect(modelD.requiresConfirmation).toBe(false)
    })

    it('requires 10s confirmation countdown on corroborated high risk', () => {
      const samples = new Float32Array(16000)
      const transcript = 'Leave me alone! Don\'t touch me!'
      const modelA = evaluateModelA({ samples, transcript })
      const modelB = evaluateModelB(transcript)
      const analyzer = new ModelCContextAnalyzer()
      const modelC = analyzer.evaluate({ modelA, modelB })

      const modelD = evaluateModelD({ modelA, modelB, modelC })

      expect(modelD.classification).toBe('high_risk')
      expect(modelD.action).toBe('CONFIRMATION_REQUIRED')
      expect(modelD.requiresConfirmation).toBe(true)
      expect(modelD.countdownSeconds).toBe(10)
    })

    it('immediately dispatches SOS on Manual SOS', () => {
      const samples = new Float32Array(16000)
      const modelA = evaluateModelA({ samples, transcript: '' })
      const modelB = evaluateModelB('')
      const analyzer = new ModelCContextAnalyzer()
      const modelC = analyzer.evaluate({ modelA, modelB })

      const modelD = evaluateModelD({ modelA, modelB, modelC, isManualSos: true })

      expect(modelD.classification).toBe('confirmed_emergency')
      expect(modelD.action).toBe('DISPATCH_SOS')
      expect(modelD.requiresConfirmation).toBe(false)
    })
  })

  describe('HerShieldRuntime Integration & Escalation Protocol', () => {
    it('enforces confirmation countdown on high risk and allows cancellation', async () => {
      let confirmationFired = false
      let confirmationCancelled = false
      let emergencyState = 'DISARMED'

      const runtime = new HerShieldRuntime({
        onConfirmationRequired: () => {
          confirmationFired = true
        },
        onConfirmationCancelled: () => {
          confirmationCancelled = true
        },
        onEmergencyStateChange: (state) => {
          emergencyState = state
        },
      })

      runtime.stateMachine.arm()
      expect(emergencyState).toBe('ARMED_MONITORING')

      // Process a frame with distress keyword + intent
      const samples = new Float32Array(16000)
      const res = await runtime.processAudioFrame({
        samples,
        transcript: "Someone help me! Please save me!",
        safetyMode: 'ACTIVE',
      })

      expect(res.modelD.classification).toBe('high_risk')
      expect(confirmationFired).toBe(true)
      expect(runtime.emergencyStateMachine.state).toBe('THREAT_ANALYSIS')
      expect(runtime.emergencyStateMachine.isCountdownActive).toBe(true)

      // User cancels the false alarm
      runtime.cancelPendingConfirmation()
      expect(confirmationCancelled).toBe(true)
      expect(runtime.emergencyStateMachine.state).toBe('ARMED_MONITORING')
      expect(runtime.emergencyStateMachine.isCountdownActive).toBe(false)

      await runtime.stateMachine.disarm()
      expect(runtime.emergencyStateMachine.state).toBe('DISARMED')
    })
  })
})
