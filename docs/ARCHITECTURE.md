# HerShield — Current Architecture

**Status:** Local implementation present; hosted Supabase behavior remains unverified.  
**Last reviewed:** 2026-10-29

HerShield is a browser-based safety-assistance research/demo app built with React, TypeScript, Vite, and Supabase. Its UI and local workflows are implemented. It is not a production emergency-response service.

## Request and data flow

```text
User action (sign in, manage contacts, ARM, or manual SOS)
  ├─ Supabase Auth when configured
  └─ Explicit development-only demo identity when Supabase is absent

ARM + microphone consent
  └─ Browser microphone capture → 1-second PCM window every 500 ms
       ├─ approximate acoustic features (energy, peak, spectral-centroid proxy)
       └─ browser SpeechRecognition transcript (may use vendor cloud)
            ↓
       intent classifier → temporal/rule-based risk → deterministic policy
            ↓
       one dispatch per armed session → owner-tagged IndexedDB incident
            ├─ simulated notification preview/log
            └─ optional owner-checked Supabase sync using stable incident ID

Manual SOS → same local-first incident dispatcher, bypasses model scores
```

## Authentication and ownership

- `VITE_SUPABASE_URL` plus a non-placeholder `VITE_SUPABASE_ANON_KEY` select Supabase Auth and cloud data helpers.
- Demo sign-in is available only when `import.meta.env.DEV` is true, Supabase is not configured, and `VITE_DEMO_MODE=true`. Production builds do not enable it.
- Email/password login and registration return a configuration error when Supabase is unavailable; they do not create fake users.
- Browser contacts and events use per-user keys. Legacy rows are imported only when their `user_id` matches the active identity.
- IndexedDB incidents require an owner ID. List, pending-sync, and status-update operations are owner-scoped; ownerless legacy incidents are not synced.

## Audio, decisions, and incident handling

- Microphone capture requires explicit consent and ARM while the page is open. A capture failure disarms and does not start SpeechRecognition.
- Audio windows are one second long with a 500 ms hop based on the browser AudioContext sample rate. Transient samples are held in memory and wiped on disarm; raw audio is not written to persistent storage.
- Browser SpeechRecognition is a separate service and may transmit audio to the browser vendor. Consent UI discloses this caveat.
- Acoustic features are rough heuristics, not a validated distress model. The app does not implement 64-band Log-Mel features or a trained audio model.
- Risk scoring and the 10-second medium confirmation are deterministic. Runtime owns the timer and cancels it on user confirmation or disarm. A timeout uses the same local-first incident path as high-risk escalation.
- Each armed session has a dispatch latch to avoid repeat incidents from overlapping frames. Manual SOS bypasses model scores and uses that same dispatcher.
- Notifications are simulated. No SMS, email, push message, or emergency-service call is sent.

## Cloud and local persistence

- Supabase tables and RLS policies are defined in `supabase/migrations/0001_init.sql`; the local migration has not been applied or verified against a hosted project by this work.
- Incidents remain visible from owner-tagged IndexedDB during network failure. Sync only runs when Supabase is configured and a current user is available.
- Sync retries `PENDING` and `FAILED` rows for the same owner and upserts using the incident UUID, so a retry does not intentionally create a second cloud row.
- `listEmergencyEvents()` merges cloud rows with current-owner local incidents and prefers cloud rows when the same ID exists.
- Review the SQL migration and verify RLS against a disposable project before connecting sensitive or production data. Unit tests mock Supabase and cannot prove hosted RLS behavior.

## Fixture evaluation

- Four deterministic variants run on the same 14 hand-written fixtures: A keywords, B seed intent classifier, C intent plus safety/journey context, and D adds supplied repeated-trigger and synthetic acoustic-cue metadata.
- Labels are `EMERGENCY`, `NOT_EMERGENCY`, `AMBIGUOUS`, or `null` for manual SOS. Only the first two labels count in binary metrics; HIGH is the positive prediction.
- Fixture metrics and exports describe only these examples and the hand-written seed model. They are not empirical accuracy, real audio tests, or evidence of real-world safety.

## Not implemented or not verified

- Real emergency dispatch, SMS/email/push delivery, background monitoring, native mobile support, on-device ASR, validated distress/audio classification, or a trained intent model.
- Live Supabase login, migrations, RLS isolation, notification logging, and retry behavior against a hosted database.
- A real speaker/accent, speech-speed, noisy microphone, GPS-denial, or network impairment experiment; current fixture rows are synthetic text/metadata only.
