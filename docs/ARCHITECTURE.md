# HerShield — Architecture

**Status:** Implementation Active · **Date:** 2026-08-27
**Status label:** CORE RUNTIME & THREAT ENGINE IMPLEMENTED

---

## Status Legend
- **[IMPLEMENTED]**: Fully implemented, tested in the codebase.
- **[PARTIALLY IMPLEMENTED]**: Operational client logic, simulated or stubbed backend/hardware layer.
- **[PLANNED / FUTURE]**: Documented for post-MVP / native platforms.

---

## 1. High-level Architecture

```
USER
  │ (ARM / DISARM / SOS)
  ▼
[IMPLEMENTED] ArmStateMachine (DISARMED | ARMED | GUARDIAN_WATCH | TIMED_ARM)
  │
  ▼
[IMPLEMENTED] HerShieldRuntime Coordinator
  │
  ├─► [IMPLEMENTED] Transient AudioPrivacyBuffer (in-memory circular buffer, wiped on DISARM)
  ├─► [IMPLEMENTED] Acoustic Signal Analyzer (energy, peak volume, spectral centroid & distress cues)
  ├─► [IMPLEMENTED] Seed Intent Classifier (TF-IDF + Logistic Regression)
  │
  ▼
[IMPLEMENTED] TemporalRiskEngine (Rolling window, time decay, repeat trigger bump, confidence weighting)
  │
  ▼
[IMPLEMENTED] Safety Policy (LOG_ONLY | CONFIRMATION_REQUIRED | ESCALATE)
  │
  ▼
[IMPLEMENTED] LocalIncidentStore (Offline-first IndexedDB storage + sync queue)
  │
  ├─► [PARTIALLY IMPLEMENTED] Simulated Notification Engine (DEMO mode simulation)
  └─► [IMPLEMENTED] CloudSyncService (Idempotent Supabase sync queue with retry & offline resilience)
```

## 2. Component Implementation Status

| Module / Component | Status | Key Files |
|---|---|---|
| **Arm / Disarm State Machine** | **IMPLEMENTED** | [`app/src/lib/core/armState.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/core/armState.ts), [`armState.test.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/core/armState.test.ts) |
| **HerShield Runtime Coordinator** | **IMPLEMENTED** | [`app/src/lib/core/runtime.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/core/runtime.ts), [`runtime.test.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/core/runtime.test.ts) |
| **Privacy Audio Buffer** | **IMPLEMENTED** | [`app/src/lib/audio/audioPrivacyBuffer.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/audio/audioPrivacyBuffer.ts), [`audio.test.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/audio/audio.test.ts) |
| **Acoustic Signal Extraction** | **IMPLEMENTED** | [`app/src/lib/audio/acousticAnalyzer.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/audio/acousticAnalyzer.ts), [`audio.test.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/audio/audio.test.ts) |
| **Intent Classifier** | **IMPLEMENTED** | [`app/src/lib/intent/classify.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/intent/classify.ts), [`classify.test.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/intent/classify.test.ts) |
| **Explainable Risk Engine** | **IMPLEMENTED** | [`app/src/lib/risk/riskEngine.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/risk/riskEngine.ts), [`riskEngine.test.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/risk/riskEngine.test.ts) |
| **Temporal Risk Engine** | **IMPLEMENTED** | [`app/src/lib/risk/temporalRiskEngine.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/risk/temporalRiskEngine.ts), [`temporalRiskEngine.test.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/risk/temporalRiskEngine.test.ts) |
| **Safety Policy & Escalation** | **IMPLEMENTED** | [`app/src/lib/policy.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/policy.ts), [`policy.test.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/policy.test.ts) |
| **Offline Incident Storage** | **IMPLEMENTED** | [`app/src/lib/storage/incidentStore.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/storage/incidentStore.ts), [`incidentStore.test.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/storage/incidentStore.test.ts) |
| **Cloud Sync Layer (Supabase)** | **IMPLEMENTED** | [`app/src/lib/sync/syncService.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/sync/syncService.ts), [`syncService.test.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/sync/syncService.test.ts) |
| **Platform Capabilities** | **IMPLEMENTED** | [`app/src/lib/platform/capabilities.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/platform/capabilities.ts) |
| **Notification Dispatch** | **PARTIALLY IMPLEMENTED** (SIMULATED) | [`app/src/lib/notify.ts`](file:///C:/Users/slaye/HerShield/app/src/lib/notify.ts) (Real SMS = Future) |
| **On-device Speech Recognition** | **PLANNED / FUTURE** | Whisper.cpp / on-device ASR |
| **Native Power Management** | **PLANNED / FUTURE** | OS-level battery saving via Native mobile bridge |

## 3. Privacy & Security Principles (Implemented)
1. **Transient Audio Only**: Raw audio is kept strictly in an in-memory circular buffer while armed; never persisted unless threat is confirmed.
2. **Buffer Zeroing**: On DISARM, buffer memory is explicitly wiped.
3. **Decoupled Local Incident Storage**: Core threat detection and incident logging work 100% offline via IndexedDB.
4. **Resilient Sync**: Supabase sync is optional, idempotent, and uses row-level security (RLS).
5. **Platform Honesty**: Emergency power management reports unsupported capabilities within browser sandboxes rather than making false claims.