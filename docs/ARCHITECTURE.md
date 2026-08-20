# HerShield — Architecture

**Status:** Draft v1 · **Date:** 2026-08-20
**Status label:** PROPOSED (not yet implemented, pending approval)

---

## 1. High-level view

```
┌──────────────────────────── Browser / Web App (React + TypeScript) ───────────────────────────┐
│                                                                                                │
│  UI Screens            │   Client services                                                    │
│  ─ Login / Register    │   VoiceService (mic → ASR transcript)                                 │
│  ─ Contacts            │   IntentClassifier (client-side first pass, optional)                 │
│  ─ Safety / Listen     │   ContextService (safety mode, journey, location)                     │
│  ─ Emergency Dashboard │   RiskEngine (rules → risk level + explanation)                       │
│  ─ Testing Dashboard   │   EventService (create event, notify)                                 │
└──────────────────────────────────┬─────────────────────────────────────────────────────────────┘
                                   │ HTTPS (Supabase client SDK, anon key, RLS-enforced)
                                   ▼
┌──────────────────────────── Supabase (Backend-as-a-Service) ──────────────────────────────────┐
│  Auth (email/password)  │  PostgreSQL (profiles, contacts, emergency_events, journeys)        │
│  RLS policies           │  Edge Functions (notification dispatch, cooldown checks)            │
│  Storage (future: none for audio)                                                              │
└──────────────────────────────────┬─────────────────────────────────────────────────────────────┘
                                   ▼
                       Notification simulation (email/SMS stub or Twilio in later phase)
```

- The **AI core** (intent classifier + risk engine) is designed to be portable: it runs as pure TypeScript functions so it can run client-side, in a Supabase Edge Function, or in a local Python experiment. The experiment harness uses the same scoring logic.
- MVP is **online-first**. Offline behavior is documented as degraded (see PRIVACY.md / TESTING.md).

## 2. Data flow for one voice trigger

1. User enables "Listen" (mic permission granted; consent screen shown).
2. `VoiceService` captures audio; ASR produces a transcript (browser SpeechRecognition API in MVP [S26]).
3. Keyword gate (lightweight, in-browser): if no trigger phrase → discard transcript, continue.
4. If trigger phrase: full transcript → `IntentClassifier` → intent score.
5. `ContextService` collects: safety mode, journey status (if any), location, ASR confidence, repeat counter.
6. `RiskEngine` combines signals → risk level + explanation object.
7. `SafetyPolicy` decides: LOW (nothing) / MEDIUM (confirmation countdown) / HIGH (create event + notify contacts) / ManualSOS (always escalate).
8. `EventService` writes `emergency_events` row (minimal fields per PRIVACY.md), triggers notification (simulated in MVP).

## 3. Module responsibilities

| Module | Responsibility | Key files (PROPOSED) |
|---|---|---|
| Auth | signup/login, session | `src/lib/auth.ts` |
| Contacts | CRUD + validation | `src/lib/contacts.ts` |
| Voice | mic capture, ASR wrapper | `src/lib/voice.ts` |
| Intent | classifier (TF-IDF + LR MVP) | `src/lib/intent/` (classifier + vocabulary) |
| Context | safety mode, journey, geolocation | `src/lib/context.ts` |
| Risk engine | scoring + explanation | `src/lib/risk/` |
| Policy | escalation decision rules | `src/lib/policy.ts` |
| Events | create/read emergency events | `src/lib/events.ts` |
| Notification | simulated notify + cooldown | `src/lib/notify.ts` |
| Dashboard | lists events, shows risk explanation | `src/screens/Dashboard.tsx` |
| Testing dashboard | runs fixtures, shows metrics | `src/screens/Testing.tsx` |

## 4. Database schema (PROPOSED) — see the full SQL in PROJECT_PROPOSAL.md §12

Tables: `profiles`, `contacts`, `emergency_events`, `journeys` (optional MVP). All RLS-enabled; users access only their own rows.

## 5. AI pipeline detail (PROPOSED)

```
transcript ──► text normalization (lowercase, strip punctuation)
            ──► keyword gate (trigger phrase list)
            ──► [MVP] TF-IDF vectorization + Logistic Regression → P(emergency)
            ──► [stretch] fine-tuned DistilBERT
score ──► thresholds (tuned on validation) → intent level LOW/MED/HIGH
```

Why TF-IDF + LR first (see NO FAKE AI section): explainable, tiny, fast, no GPU, and good enough to answer the research question. We will compare against keyword baseline in the experiment, and only add a transformer if the MVP works.

## 6. Deployment (PROPOSED)

- Frontend: Vercel / Netlify / Supabase hosting (static).
- Backend: Supabase project (managed Postgres + auth + edge functions).
- No custom server needed for MVP. This keeps ops near-zero for beginners.
- Secrets: only `SUPABASE_URL` + `SUPABASE_ANON_KEY` in the frontend (public by design); `SERVICE_ROLE`/`EDGE` secrets in Supabase env, never in git.

## 7. Known trade-offs (honest)

- Browser ASR is not fully private (see PRIVACY.md §5). Documented, consented.
- Web app can't do true background mic monitoring when tab is closed. MVP requires the app open. Native app = Future Work.
- Simulated notifications are not real SMS; the policy says so.