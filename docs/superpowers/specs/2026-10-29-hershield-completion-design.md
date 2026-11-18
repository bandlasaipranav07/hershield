# HerShield Completion and Hardening Design

**Date:** 2026-10-29  
**Status:** Approved by the user's request to build HerShield from the supplied project specification.  
**Scope:** Complete and harden the existing React/Vite app in this checkout; do not replace or erase the existing project.

## Intent

HerShield is a browser-based safety-assistance and research demo. It lets a signed-in user manage emergency contacts, explicitly arm microphone monitoring, review emergency events, trigger a manual SOS, and compare deterministic threat-detection variants. It must remain clear that notifications are simulated and that the app is not a substitute for emergency services.

## Goals

- Preserve the existing app, documentation, uncommitted user edits, and React + TypeScript + Vite + Supabase stack.
- Keep real Supabase authentication authoritative. Permit a clearly marked demo identity only in local development when an explicit demo flag is enabled; demo mode must not become a production authentication bypass.
- Keep local demo records scoped to the active identity. Keep voice incidents locally available while offline and sync only records owned by the current user.
- Make one audio analysis window one second long with a 500 ms hop, preserve explicit microphone consent, stop capture on disarm, and avoid repeated incident dispatch for one active threat.
- Make the medium-risk confirmation timer dispatch the same local-first incident flow on expiry; allow the user to cancel it.
- Make manual SOS independent of AI scores and use the same durable incident path as voice escalation.
- Compare Models A–D on one labeled synthetic fixture set, define the reported denominators, show confusion counts and metrics, and label the output as fixture-only rather than real-world accuracy.
- Refresh the repository documentation to describe what is actually implemented and what remains simulated, unverified, or future work.

## Non-goals

- Real SMS, email, emergency-service dispatch, background monitoring, native mobile support, on-device speech recognition, or claims of production readiness.
- Training a new intent model or reporting empirical performance from the hand-written seed weights.
- Applying migrations to a hosted Supabase project, deleting/resetting hosted data, publishing, or deploying.
- Changing the framework, adding dependencies, or discarding current local changes.

## Approaches considered

1. **Replace the app with a clean-slate implementation.** Rejected because the repository already contains the feature set and 13 tracked files plus user-owned untracked files have pending edits. A rewrite would risk losing working behavior and user work.
2. **Keep the current architecture and close verified correctness, security, and evaluation gaps.** Selected. The current source already contains the UI, state machine, audio capture, classifier, risk engine, offline incident store, Supabase access, and tests. Focused fixes preserve that investment and give each safety-critical change a testable boundary.
3. **Turn the demo into a live emergency-response product now.** Rejected because the repository intentionally simulates notifications, uses browser speech recognition that may use vendor cloud services, and lacks validated real-world model results and production operations.

## Architecture and behavior

- **Authentication:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` select the real Supabase path. `VITE_DEMO_MODE=true` may enable a fixed demo identity in development only when Supabase is not configured. Normal sign-in and registration never silently create a fake account. Production builds ignore the demo flag.
- **Local data:** Demo contacts and event records use identity-specific storage keys. IndexedDB incidents carry an owner ID. Sync filters by the authenticated owner and uses the incident's stable ID so retrying an ambiguous request cannot create another event.
- **Audio:** Web Audio keeps the existing browser capture path, but emits sliding one-second windows at 500 ms intervals. The current features remain RMS energy, peak level, and a spectral-centroid heuristic; they are not a validated distress model and do not implement 64-band Log-Mel features. Browser SpeechRecognition may transmit audio to the browser vendor, as already disclosed by consent UI. No raw audio is persisted.
- **Decision and response:** Runtime owns one pending confirmation timer and one dispatch latch per armed session. Medium risk starts one timer; user cancellation clears it; timeout or high risk writes one local incident, simulates notifications, and attempts owner-scoped cloud sync. Manual SOS uses the same incident path without consulting the classifier. A failed microphone start does not launch a second speech-recognition capture or leave the UI claiming monitoring is active.
- **Evaluation:** A is keyword-only; B is the intent classifier; C adds safety/journey context; D adds the implemented acoustic and repeated-trigger heuristics to C. Binary fixture metrics count only clearly labeled utterances and treat HIGH risk (automatic escalation) as positive; ambiguous and manual-SOS cases are excluded from those metrics. The dashboard displays confusion counts and null for undefined metric denominators. Exports contain only fixture text and configuration, never microphone recordings or personal data.

## Constraints and acceptance criteria

- Existing uncommitted changes remain present; no staging, commit, dependency installation, hosted database operation, or deploy.
- No demo session grants access to a real Supabase account or production deployment.
- Local records for one identity are invisible to another identity; incidents without a verified owner do not sync.
- A single confirmed risk produces at most one incident and one notification simulation per armed session; a cancelled medium confirmation produces none.
- No microphone capture continues after disarm or failed acquisition.
- Window tests prove the first output occurs after 1.0 seconds and the next after 0.5 additional seconds.
- Model A–D metrics are derived from the same labeled fixtures and are visibly labeled synthetic/seed-model outputs, not measured performance.
- Baseline and post-change tests, build, lint, and whitespace checks are reported separately. Existing failures are distinguished from new ones.

## Builder calls

- The user's “from scratch” request is applied to the project outcome, while preserving and extending the existing repository as the supplied project specification requires.
- The browser remains a research/demo surface. Where a capability is absent (for example true 16 kHz resampling, Log-Mel features, real notifications, or live Supabase verification), the UI and docs must say so rather than imply it exists.
- No live Supabase changes will be made because no hosted migration target or specific operation is needed for this local completion pass.
