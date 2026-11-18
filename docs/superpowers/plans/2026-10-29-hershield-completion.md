# HerShield Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete and harden the existing HerShield demo so authentication, microphone monitoring, incident handling, and fixture evaluation behave honestly and safely.

**Architecture:** Extend the current React/Vite/Supabase app. Keep demo mode local and development-only; attach owner identity to local data; route manual and automatic incidents through the existing offline store and sync service; make runtime own confirmation and duplicate prevention; compute A–D fixture metrics from explicitly labeled samples.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Supabase JS, Vitest, React Testing Library.

**Spec:** [2026-10-29-hershield-completion-design.md](../specs/2026-10-29-hershield-completion-design.md)

## Global Constraints

- Keep the existing React + TypeScript + Vite + Supabase stack.
- Never claim a feature works because a component, function, table, or screen exists; verify the execution path.
- Do not weaken authentication to make a demo work.
- Do not expose service-role credentials or store raw audio.
- All emergency notifications remain simulated; do not contact real services.
- Preserve every existing user change and do not run destructive database operations.
- Model targets and historical test totals are not current results.
- Do not install dependencies, change hosted Supabase, deploy, stage, or commit as part of this plan.

## Review Focus

1. A stale demo identity or production build must not bypass Supabase authentication. Test demo login disabled outside explicitly enabled local development.
2. Switching local demo identities must not expose another identity's contacts or events. Test two separate identities against the same browser storage.
3. Microphone permission failure must not start SpeechRecognition or leave monitoring armed. Test failed capture prevents the speech loop.
4. Overlapping windows, repeated frames, and confirmation timeouts must not duplicate dispatch. Test 1.0 s / 0.5 s windows, one incident per threat, timeout dispatch once, cancel dispatch zero.
5. Ambiguous or manual fixtures must not inflate binary metrics; undefined denominators must be represented as unavailable. Test counts and metric values with hand-calculated inputs.

---

### Task 1: Secure demo authentication and local records

**Files:**
- Modify: `app/src/lib/supabase.ts`
- Modify: `app/src/lib/auth.ts`
- Modify: `app/src/context/AuthContext.tsx`
- Modify: `app/src/screens/Login.tsx`
- Modify: `app/src/lib/contacts.ts`
- Modify: `app/src/lib/events.ts`
- Modify: `app/.env.example`
- Test: `app/src/lib/auth.test.ts`
- Test: `app/src/lib/authNoConfig.test.ts`
- Test: `app/src/lib/supabaseConfig.test.ts`
- Test: `app/src/lib/localDataIsolation.test.ts`
- Test: `app/src/context/AuthContext.test.tsx`
- Test: `app/src/lib/contacts.test.ts`
- Test: `app/src/lib/events.test.ts`
- Test: `app/src/screens/Login.test.tsx`

**Interfaces:**
- `isSupabaseConfigured: boolean` describes complete non-placeholder Supabase configuration.
- `isDemoModeEnabled: boolean` is true only when `import.meta.env.DEV`, Supabase is not configured, and `VITE_DEMO_MODE === 'true'`.
- Demo sign-in returns an error when disabled; email/password sign-in and sign-up return a clear configuration error when Supabase is absent.
- Local storage keys include the verified active `userId`; absent identity returns an error/empty result rather than a shared fallback.

- [x] Add failing tests for production/disabled demo rejection, no fake fallback from normal sign-in, and identity-scoped local contact/event data.
- [x] Run the focused tests with one Vitest worker and workspace-local `TEMP`/`TMP`; verify they fail for the missing protections.
- [x] Implement the explicit dev-only flag, gate the demo button, and remove synchronous state updates from AuthContext initialization.
- [x] Scope local contacts/events by owner while leaving existing legacy keys intact; import only rows whose stored `user_id` matches the active user.
- [x] Run focused tests and the auth/contact/event component suites.

### Task 2: Correct microphone windows and capture failure behavior

**Files:**
- Create: `app/src/lib/audio/slidingAudioWindowBuffer.ts`
- Modify: `app/src/lib/audio/microphoneCapture.ts`
- Modify: `app/src/screens/Listen.tsx`
- Test: `app/src/lib/audio/microphoneCapture.test.ts` (covers the sliding window buffer through capture)
- Test: `app/src/screens/Listen.test.tsx`

**Interfaces:**
- `SlidingAudioWindowBuffer(windowSamples: number, hopSamples: number)` exposes `push(Float32Array): Float32Array[]` and `clear(): void`.
- Capture defaults to `windowMs: 1000`, `hopMs: 500`; sample counts derive from the actual `AudioContext.sampleRate`.
- `handleArm` starts SpeechRecognition only after audio capture succeeds; failed capture stops/disarms the monitoring session and leaves a visible microphone error.

- [x] Add a failing capture test that verifies 1-second windows with a 500 ms overlap.
- [x] Run the focused microphone test and verify the expected missing behavior.
- [x] Implement a bounded sliding buffer and wire it into microphone frame delivery; clear it on stop.
- [x] Add a failing UI test that denied microphone acquisition does not start the speech loop and does not claim monitoring is active.
- [x] Implement the failed-acquisition handling and keep the error visible until a new attempt or explicit dismissal.
- [x] Run audio and Listen tests.

### Task 3: Unify incident dispatch and protect temporal escalation

**Files:**
- Modify: `app/src/lib/core/runtime.ts`
- Create: `app/src/lib/core/incidentDispatcher.ts`
- Modify: `app/src/lib/storage/incidentStore.ts`
- Modify: `app/src/lib/sync/syncService.ts`
- Modify: `app/src/lib/events.ts`
- Modify: `app/src/screens/Listen.tsx`
- Modify: `app/src/screens/Dashboard.tsx`
- Test: `app/src/lib/core/runtime.test.ts`
- Test: `app/src/lib/storage/incidentStore.test.ts`
- Test: `app/src/lib/sync/syncService.test.ts`
- Test: `app/src/lib/events.test.ts`
- Test: `app/src/screens/Listen.test.tsx`
- Test: `app/src/screens/Dashboard.test.tsx`

**Interfaces:**
- Local incidents require `userId`; IndexedDB indexes incidents by `(userId, syncStatus)` and list/pending methods accept a user ID.
- Runtime exposes one pending medium confirmation with an expiry timestamp and `cancelPendingConfirmation()`; expiry/high-risk dispatch uses one idempotent local-first flow.
- Cloud sync requires the current user, ignores other owners and unowned legacy rows, and does nothing while Supabase is unconfigured.
- Cloud upsert uses the stable local incident UUID as the emergency event ID.
- Dashboard merges current-user IndexedDB incidents with cloud events and uses the same local-first dispatcher for manual SOS.

- [x] Add failing tests for one dispatch across repeated high frames; medium confirmation fires once at expiry; cancellation fires none; disarm cancels pending timers.
- [x] Add failing tests that pending incidents cannot sync under a different owner and a repeated cloud retry uses the same event ID.
- [x] Add a failing dashboard test that manual SOS uses the local-first dispatcher and remains visible.
- [x] Run these tests and verify the missing behavior.
- [x] Implement owner-tagged local persistence, deduplicated response orchestration, timer callbacks, and owner-filtered idempotent sync.
- [x] Merge local and cloud event views without duplicate display and route manual SOS through the same response path.
- [x] Run runtime, storage, sync, events, and dashboard tests.

### Task 4: Make A–D fixture comparisons and metrics reproducible

**Files:**
- Create: `app/src/lib/fixtures/evaluationMetrics.ts`
- Modify: `app/src/lib/fixtures/testCases.ts`
- Modify: `app/src/screens/TestingDashboard.tsx`
- Test: `app/src/lib/fixtures/evaluationMetrics.test.ts`
- Test: `app/src/lib/fixtures/testCases.test.ts`
- Test: `app/src/screens/TestingDashboard.test.tsx`

**Interfaces:**
- Fixture labels are `EMERGENCY`, `NOT_EMERGENCY`, `AMBIGUOUS`, or `null` for manual SOS; ambiguous/manual rows are excluded from binary metrics.
- `computeBinaryMetrics(labels, predictions)` returns TP/FP/TN/FN and nullable precision, recall, F1, FPR, FNR, and accuracy. HIGH risk is the positive prediction (automatic escalation).
- `evaluateAllModels()` returns A keyword, B intent, C intent plus safety/journey context, and D C plus acoustic/repeated-trigger heuristics for each fixture.
- `buildEvaluationExport(results, timestamp)` returns timestamped JSON metadata, model/config identifiers, sample counts, metrics, and fixture predictions.

- [x] Add failing literal tests for hand-calculated confusion counts, zero denominators, ambiguous exclusion, and distinct A–D signal inputs.
- [x] Run focused tests and confirm they fail for the missing metric/model contracts.
- [x] Implement pure metric calculation and A–D fixture evaluation; rename text-only “accent/speed/microphone” claims so fixtures do not imply audio validation.
- [x] Add dashboard metrics with a clear synthetic-fixture/seed-model label and a JSON export action.
- [x] Run metric, fixture, and dashboard tests.

### Task 5: Align documentation and verify the completed checkout

**Files:**
- Modify: `README.md`
- Modify: `app/README.md`
- Modify: `supabase/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/TESTING.md`
- Modify: `docs/PRIVACY.md`
- Modify: `docs/TODO.md`
- Modify: `docs/DECISIONS.md`

- [x] Replace obsolete “no app code / scaffold only” statements with the verified implementation status and remaining limitations.
- [x] Remove reset-all-data advice; describe additive migration review and explicitly state that no hosted project was changed.
- [x] Document the browser SpeechRecognition cloud caveat, approximate audio features, dev-only demo mode, incident sync boundary, synthetic fixture metrics, and unverified live Supabase behavior.
- [ ] Run the complete test suite, lint, type-check/build, and `git diff --check`; direct build outputs to a fresh ignored path so existing `app/dist` is preserved.
- [ ] Inspect the final diff and compare each check with the recorded task-start baseline; report remaining failures and risks.
