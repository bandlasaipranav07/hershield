# HerShield — Project Status and TODO

**Last reviewed:** 2026-10-29

## Implemented in the current checkout

- [x] React + TypeScript + Vite application with login, contacts, Listen, Dashboard, and Testing screens.
- [x] Supabase Auth/data helpers and an explicit development-only demo identity.
- [x] Per-user browser contact/event storage and owner-tagged IndexedDB incident records.
- [x] Consent-gated microphone capture, sliding 1-second/500-ms audio windows, and capture-failure disarm behavior.
- [x] Intent/risk/policy pipeline, local-first voice/manual incident dispatch, medium confirmation expiry/cancel, and duplicate-dispatch guard.
- [x] Owner-filtered cloud sync with stable incident IDs for retries; current-owner local/cloud event merge.
- [x] Four-model synthetic fixture evaluation, explicit labels, confusion metrics, and JSON export.
- [x] Documentation that distinguishes implemented code, simulation, and unverified live behavior.

## Still required before a live Supabase integration is trusted

- [ ] Review `supabase/migrations/0001_init.sql` and each RLS policy against the intended threat model.
- [ ] Apply migrations only to an explicitly selected disposable/development project after review; no hosted project was changed by this work.
- [ ] Verify sign-up/sign-in, owner isolation, incident retry, and notification log behavior using two test users in that project.
- [ ] Add an isolated Supabase integration test environment and CI checks. Existing unit tests mock Supabase.

## Research and product work remaining

- [ ] Build and independently label a larger utterance dataset; train a model rather than relying on seed weights.
- [ ] Run A–D evaluation on held-out data and report confusion counts, confidence intervals, and latency as experimental results.
- [ ] Run actual microphone, browser SpeechRecognition, GPS-denial, and network interruption checks on supported devices.
- [ ] Consider on-device ASR, validated acoustic distress detection, native mobile/background support, or real notification delivery only with separate design, privacy, operational, and safety reviews.
- [ ] Complete keyboard, screen-reader, contrast, and small-screen accessibility review.

## Not part of this local implementation pass

- No dependency installation, hosted database operation, destructive reset, deployment, staging, or commit was performed.
- Notifications remain simulated; this project is not an emergency service.
