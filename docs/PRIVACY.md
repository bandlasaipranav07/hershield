# HerShield — Privacy and Data Boundaries

**Last reviewed:** 2026-10-29

HerShield is a browser research/demo application. This document describes the current code path; it is not a privacy certification or a promise of production suitability.

## What the browser handles

| Data | Current handling | Boundary |
|---|---|---|
| Supabase account | Email/password session through Supabase Auth when configured | Hosted authentication and policies have not been live-verified in this checkout. |
| Demo identity | Fixed demo user stored in browser local storage | Enabled only in Vite development, with no valid Supabase configuration and `VITE_DEMO_MODE=true`. |
| Contacts and browser events | Supabase when configured; otherwise owner-scoped browser storage | Browser storage is local to a browser profile/device and can be cleared outside the app. |
| Incident record | Owner-tagged IndexedDB record first; includes incident type, risk, transcript, context, optional location, and timestamps | Remains on the device when offline. No account-level deletion/retention workflow is implemented. |
| Microphone samples | Short-lived in-memory audio buffers while armed | Raw samples are not written to localStorage, IndexedDB, or the database. Buffers are wiped on disarm. |
| Speech transcript | Passed to the classifier; included in a confirmed incident record | Browser SpeechRecognition may process audio through the browser vendor's service. Vendor handling is outside this app. |
| Notification preview | Always simulated; may create a `notification_log` row when Supabase is configured | No SMS, email, push, or emergency call is sent. Simulation payload can include a contact's name, phone/email, transcript summary, and event location. |
| Fixture export | Static fixture text, model/config identifiers, labels, and deterministic predictions | Does not include microphone recordings or personal incident data. |

## Microphone and transcription

- The Listen screen requires explicit consent, then the user must press ARM. Capture is not a background service and stops on DISARM or capture failure.
- Audio analysis uses in-memory 1-second windows with a 500 ms hop and approximate energy/peak/spectral-centroid heuristics. The app does not save audio samples and does not implement a validated acoustic distress detector.
- SpeechRecognition is a separate browser service. Depending on the browser and settings, audio may leave the device for vendor processing. The UI discloses this; HerShield does not control the vendor's storage or retention.
- A confirmed event includes transcript text in local storage and may sync it to Supabase. Do not enter sensitive test phrases into the demo unless you intend them to remain in browser storage or, when configured, be sent to your Supabase project.

## Supabase, identity, and offline sync

- Only the public anon/publishable key belongs in browser configuration. Never put a service-role key in `VITE_*` variables or commit `.env`.
- Local contacts/events use per-user storage keys. IndexedDB incident reads, writes, and sync updates require the current owner ID. Ownerless legacy rows are not eligible for sync.
- Cloud incident sync runs only when Supabase is configured and an authenticated user is present. It targets the active owner's incidents and uses the local UUID for idempotent upsert retries.
- The repository has a migration with RLS policies, but this work did not apply it to or verify it against any hosted project. Review the SQL and test two users against a disposable project before storing sensitive data.
- Browser storage and any Supabase records are retained until cleared/deleted by the relevant browser or project operator. The app does not currently provide a complete account/data deletion flow or a retention job.

## Explicitly unclaimed

- No claim that zero data leaves the device, that browser speech is on-device, or that the system is end-to-end encrypted.
- No claim of GDPR/DPDP or other legal compliance.
- No claim that emergency services or real contacts are notified.
- No claim that fixture metrics predict real-world performance or safety.
