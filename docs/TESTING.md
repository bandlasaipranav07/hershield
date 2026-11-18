# HerShield — Testing and Evaluation

**Last reviewed:** 2026-10-29

Tests run from `app/`:

```bash
npm test
npm run lint
npm run build
```

Vitest unit/component tests mock Supabase. They exercise local code paths and do not establish that a hosted Supabase project, RLS policy, browser microphone, browser SpeechRecognition service, or real notification provider works.

## Implemented automated coverage

- Auth/configuration: disabled demo and absent Supabase must not create fake credentials; demo identity is restricted to explicit Vite development configuration.
- Data ownership: local contacts/events and IndexedDB incidents are scoped to the current user; owner mismatch cannot update or sync another user's incident.
- Audio/consent path: microphone windows are 1 second with a 500 ms hop; failed microphone acquisition prevents the speech-recognition loop and returns the UI to DISARMED.
- Incident path: one dispatch for repeated high-risk frames; medium confirmation expiry dispatches once; cancellation and disarm dispatch zero times; manual SOS is stored through the same local-first dispatcher.
- Sync: cloud retries use the same local incident ID; configured Supabase and current owner are required.
- Fixture metrics: confusion counts, undefined denominators, excluded labels, distinct A–D signals, and deterministic JSON export are covered with tests.

Current test totals are not written here because they change with the checkout. Use the output from the latest test run when reporting results.

## A–D synthetic fixture evaluation

`app/src/lib/fixtures/testCases.ts` contains 14 hand-written fixture rows. Each row has an explicit label:

- `EMERGENCY`
- `NOT_EMERGENCY`
- `AMBIGUOUS`
- `null` for the manual-SOS control

Models use the same rows: A is keyword-only, B is the seed intent classifier, C adds safety/journey context, and D adds repeated-trigger plus a supplied synthetic acoustic-cue value. A `HIGH` prediction is positive because it automatically escalates. Ambiguous and manual-SOS cases are excluded from binary metrics. A metric with a zero denominator is shown as unavailable.

The examples are synthetic and small. The intent weights are hand-written seed values, not weights trained from a labeled corpus. Accent, pace, microphone/noise, GPS, and network names do not mean those hardware/environment conditions were exercised. The dashboard JSON export records fixture predictions/configuration; it is not a benchmark result.

## Manual verification still needed

Use disposable test accounts and a disposable Supabase project. Review the SQL first; do not reset tables or point tests at production data.

- Verify signup, sign-in, sign-out, and RLS for two distinct real Supabase users.
- Try contacts/events with Supabase configured, and verify local records remain visible during an intentional network failure.
- On a supported desktop browser, explicitly consent and ARM; verify the microphone indicator, denied-permission path, DISARM teardown, and browser SpeechRecognition disclosure.
- Verify simulated notification previews and confirm no real service is contacted.
- Exercise GPS permission denial and a real network interruption. Current fixture rows are not substitutes for these checks.

## Evaluation work not yet done

- Build and independently label a larger utterance set; split train/validation/test by speaker where audio is collected.
- Train/validate a model instead of using the seed model.
- Run the A–D procedure on held-out labeled data and report sample sizes, confusion matrices, confidence intervals, and latency as experimental results.
- Collect actual audio/ASR conditions if making claims about accents, speaking speed, noise, or microphone robustness.
