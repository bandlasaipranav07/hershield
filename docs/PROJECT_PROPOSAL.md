# HerShield — Project Proposal (23-point first task)

**Status:** PROPOSED — nothing here is implemented.
**Date:** 2026-08-20
**Audience:** HerShield team (3 beginner CSE students)
**Ask:** Review sections 8 (scope), 9 (stack), 19–21 (roadmap & roles). Approve or request changes. We will NOT write application code until you approve.

**Labeling used in this document:**
- **RESEARCH-BACKED** = claim from a source in [SOURCES.md](./SOURCES.md) (referred to as `[S#]`).
- **ASSUMPTION** = our guess / decision, to be tested.
- **PROPOSED** = our design choice.
- **OUR EXPERIMENTAL RESULT** = things we measure ourselves. There are none yet.
- **NOT YET MEASURED** = metrics we haven't run yet.

---

## 1. Executive summary

HerShield is a women-safety emergency assistance system. Instead of the basic "voice says HELP → SOS" model, we propose a **context-aware emergency detection pipeline**:

```
Voice → speech recognition → emergency-intent classification → context analysis
      → explainable risk assessment → deterministic safety policy → response
```

We will **not** claim the system "knows" someone is in danger. It estimates an emergency likelihood and a risk level, and applies a clearly defined, deterministic response policy (with human confirmation where appropriate).

The most important thing we learned in research: **every individual component already exists** — SOS, GPS, voice SOS, crash detection, on-device ASR, context-aware emergency research [S5][S6][S10][S22][S23]. Our defensible contribution is therefore not a new feature; it is a **measured, small-scale comparison** showing whether adding intent classification and context actually reduces false triggers, with transparent metrics and an explainable risk score. We will report what we find, even if context does not help.

---

## 2. Problem definition

- Women's safety is a genuine problem with real consequences (motivation only; not a claim we can measure).
- Existing basic SOS apps trigger on a **keyword** (e.g., "help") or a button. This causes two failure modes:
  1. **False alarms** — "Help me with my assignment" or "Can you help me find my phone" triggers an emergency.
  2. **Missed emergencies** — real distress phrased without the exact keyword is ignored.
- False alarms matter: they drain emergency resources and erode trust. This is a documented, ongoing problem even for sophisticated systems like Apple's Crash Detection, where false positives were widely reported and one county reported ~75% of its crash-detection calls were false alarms (secondary source: officials quoted in [S30]).
- **Our problem statement:** design and measure a pipeline that estimates emergency likelihood from the *full utterance plus context*, with a defined response policy, and compare it against the simple keyword baseline. We do not assume it will be better — we test it.

---

## 3. Existing solutions

RESEARCH-BACKED summary (details + sources in [COMPETITIVE_ANALYSIS.md](./COMPETITIVE_ANALYSIS.md)):

| Category | Exists? | Example(s) |
|---|---|---|
| SOS + GPS + emergency contacts + SMS | Yes | bSafe [S6], Hollie Guard [S7], Himmat (Govt of India) [S1][S3], Shake2Safety [S5] |
| Voice-triggered SOS | Yes | bSafe voice activation [S6], Chilla scream-activation [S5] |
| Automatic crash/fall detection | Yes | Apple Crash Detection [S10][S11], E-Sentinel fall detection [S22] |
| AI distress detection from speech | Yes (research) | Halilaj et al. 2025 [S14], SER literature [S16][S18] |
| Context-aware emergency platforms | Yes (research) | E-Sentinel [S22], e112 [S23] |
| False-alarm reduction techniques | Yes (research) | Samsung successive refinement [S20], Apple metric learning [S21], multitask Whisper [S15] |
| On-device / privacy-first ASR | Yes | whisper.cpp [S13], Porcupine [S12] |

**Bottom line:** our idea is a *combination and evaluation*, not an invention. We will say exactly that in the report.

---

## 4. Competitive analysis

See the full table (15 rows) in **[COMPETITIVE_ANALYSIS.md](./COMPETITIVE_ANALYSIS.md)**. The three most relevant to us:

1. **E-Sentinel** [S22] — the closest published architecture: on-device context-aware emergency decision engine, voice trigger, human-in-the-loop confirmation to avoid false alarms. It does not publish a keyword-vs-intent-vs-context ablation with false-positive metrics.
2. **Noise-Agnostic Multitask Whisper** [S15] — confirms real-world false alarms from noise are a recognized problem; our simpler route (ASR → text classifier + context) is a different, cheaper approach to the same goal.
3. **Apple Crash Detection** [S10][S11][S29][S30] — the clearest real-world example that automatic triggering needs confirmation flows and careful false-alarm handling.

---

## 5. Existing features (we will NOT claim these as ours)

- SOS button/event, GPS, emergency contacts, SMS/email/push notifications — [A-class, NOVELTY_MATRIX.md]
- Voice-triggered SOS — [A-class]
- Speech recognition — [A-class]
- Emergency keyword detection — [A-class]
- Context awareness — [B-class; exists in research]
- On-device speech processing — [B-class]

---

## 6. Potentially differentiated features (honest phrasing)

These are areas where our **sources** did not show a consumer women-safety app doing it. We phrase claims as "not found in the sources we reviewed", never "nobody has done this" (see [NOVELTY_MATRIX.md](./NOVELTY_MATRIX.md) §"What we may claim").

1. **Utterance-level emergency-intent classification** that considers the whole sentence (so "Help me with my assignment" ≠ emergency), rather than keyword matching. [C-class]
2. **Explainable multi-signal risk score** — the system shows the user/responders *why* a risk level was assigned (per-signal breakdown). [C-class]
3. **A reproducible ablation experiment** — keyword-only vs intent vs intent+context, with false-positive/negative metrics on our own labeled dataset. [C-class; the core research contribution]
4. **Deterministic safety policy around the ML decision** — no LLM decides alone; escalation rules are written, testable rules. [B→C-class]

---

## 7. Novelty risks

Honest risks if we claim too much:

1. **Risk: "Context-aware emergency detection is new."** → False. E-Sentinel [S22] and e112 [S23] exist. We will reference them.
2. **Risk: "AI distress detection is new."** → False. Halilaj et al. [S14] and the SER field exist.
3. **Risk: "Voice SOS is new."** → False. bSafe [S6], Chilla [S5] exist.
4. **Risk: "Our accuracy numbers are meaningful."** → Our dataset will be small and team-made. Any accuracy claim must be labeled OUR EXPERIMENTAL RESULT with sample size and limitations stated.
5. **Risk: "Model D is best."** → We must test. More signals may not help on small data; adding weak signals can even hurt.
6. **Risk: "Privacy-preserving local processing"** → Our MVP uses the browser's speech recognizer, which may use the browser vendor's cloud (see [PRIVACY.md](./PRIVACY.md) §5). Overclaiming privacy would be wrong.

**Mitigation:** the "Final novelty statement" in [NOVELTY_MATRIX.md](./NOVELTY_MATRIX.md) is the only novelty claim we will make.

---

## 8. Recommended project scope

### MVP (must work end-to-end)
1. User authentication
2. Emergency contacts
3. Emergency/SOS event
4. GPS/location (with permission, graceful failure)
5. Voice input + speech recognition
6. Emergency-intent classification (full utterance)
7. Context-aware risk assessment
8. Emergency notification **simulation** (no real SMS in MVP)
9. Emergency dashboard
10. Testing/evaluation dashboard
11. The A/B/C/D experiment harness

### Explicitly NOT in MVP
- Real emergency-services integration (would require legal/operational review)
- On-device offline ASR (privacy ideal, but adds heavy complexity — documented in PRIVACY.md)
- Audio-emotion / distress-speech model (D-class)
- Motion/accelerometer signals (D-class)
- Journey deviation (optional; only if time permits)
- Multilingual, wearables, community responders (E/D-class)

### Future work (documented, not built)
Distress-speech model, multilingual, motion signals, journey monitoring, offline fallback (whisper.cpp [S13]), wearable/BLE, advanced route safety, community responders.

---

## 9. Recommended technology stack

### Requirement analysis

| Requirement | Why it matters |
|---|---|
| Microphone access | Voice input |
| GPS | Location |
| Background processing | Ideally always-listening (MVP limitation for web) |
| Database | Contacts, events, users |
| Authentication | Profiles, per-user data |
| Notifications | Emergency alerts |
| Deployment | Easy demo for a college project |
| Security | RLS, secrets handling |
| Beginner-friendliness | 3 beginners, 4 weeks |

### Options compared

| Criterion | A: React+TS+Supabase | B: React+TS+Firebase | C: Native Android+Kotlin | D: Other (e.g., Python backend + React) |
|---|---|---|---|---|
| Difficulty for beginners | Medium (JS + SQL basics) | Low–Medium (JS + NoSQL) | High (Android, Gradle, background services) | Higher (2 systems to wire) |
| Development speed | Fast | Fast | Slow for 3 beginners | Medium |
| Mic access | Easy (Web Speech API [S26]) | Easy (same web) | Native API | Easy (web) |
| GPS | Geolocation API [S27] | Same | Native | Same |
| Background processing | ❌ Limited (tab must be open) | ❌ Limited | ✅ True background | ❌ Limited |
| Database | PostgreSQL (SQL — teaches real DB) | NoSQL Firestore (fewer joins) | Room/SQLite | SQLite/Postgres |
| Auth | Supabase Auth + RLS [S24] | Firebase Auth + rules [S25] | Firebase optional | custom |
| Notifications | Edge functions + email/SMS stub | FCM built-in | FCM | custom |
| Deployment | Vercel/Netlify + Supabase | Firebase Hosting | Play Store | VPS/Heroku |
| Security model | RLS in SQL (clear) | Firestore rules (tricky for beginners) | manual | manual |
| Scalability | Good (Postgres) | Good (Google infra) | Good | Good |
| Cost | Free tier generous | Free tier, pay-as-you-go can surprise | Free | Free/low |

### Recommendation (PROPOSED)

> **Option A: React + TypeScript + Vite + Supabase.** Reason: for a 4-week beginner project we need the fastest path to a working, demoable, secure product. Supabase gives us (a) real SQL/PostgreSQL — matches what college courses teach and what we'll use later, (b) Row-Level Security that is far easier to get right than Firestore rules for beginners, (c) generous free tier [S24], (d) open source. The main sacrifice is true background listening and offline-first, which we document as Future Work.

Why not the others:
- **Firebase** is excellent (offline persistence, FCM) but NoSQL + security rules is a harder teaching path and vendor-locked [S25 comparison; secondary analyses [S31-style comparisons]].
- **Native Android** is the right choice *only* if background mic + offline were the core requirement. They are not for a 4-week MVP, and the learning curve would consume the whole timeline.
- **Custom backend** doubles the moving parts for no benefit at this scale.

**ASSUMPTION:** The demo environment has internet. Offline/background are documented as future work. If your college demo requires offline, tell us now and we will re-evaluate (likely → whisper.cpp on-device, which raises complexity significantly).

---

## 10. Architecture proposal

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the full diagram. In one paragraph:

- **Client** (React + TS): screens + services for voice, intent, context, risk engine, policy, events, notifications, dashboards.
- **Backend** (Supabase): PostgreSQL + Auth + RLS + Edge Functions (notification dispatch, cooldown).
- **AI core**: pure TypeScript modules (intent classifier, risk engine) so the *same logic* runs in the app and in the experiment harness. This makes our metrics reproducible.
- **Notification**: simulated in MVP (email/SMS stub, clearly labeled).

---

## 11. Folder structure proposal

```
HerShield/
├── README.md
├── docs/                      # all documentation (this set)
├── app/                       # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── lib/
│   │   │   ├── auth.ts
│   │   │   ├── voice.ts
│   │   │   ├── intent/        # classifier + vocabulary + tests
│   │   │   ├── context.ts
│   │   │   ├── risk/          # risk engine + tests
│   │   │   ├── policy.ts
│   │   │   ├── events.ts
│   │   │   └── notify.ts
│   │   ├── screens/
│   │   │   ├── Login.tsx
│   │   │   ├── Contacts.tsx
│   │   │   ├── Listen.tsx     # voice UI + consent
│   │   │   ├── Dashboard.tsx
│   │   │   └── Testing.tsx    # experiment/eval dashboard
│   │   └── main.tsx
│   └── package.json
├── supabase/
│   ├── migrations/            # SQL schema + RLS
│   └── functions/             # edge functions
├── experiments/               # Python/TS notebooks for the ablation
│   ├── data/                  # labeled utterances (CSV)
│   ├── model_a_baseline.py
│   ├── model_b_intent.py
│   ├── model_c_context.py
│   ├── model_d_all.py
│   └── results/               # timestamped outputs
└── .gitignore                 # node_modules, .env, secrets
```

---

## 12. Database schema proposal

Tables (SQL, PostgreSQL via Supabase). All tables have RLS. PROPOSED:

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  relation text,
  created_at timestamptz default now()
);

create table emergency_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  event_type text not null check (event_type in ('manual_sos','voice_detected')),
  risk_level text not null check (risk_level in ('low','medium','high')),
  intent_level text,
  threat_level text,
  safety_mode text,
  journey_status text,
  transcript text,
  transcript_summary text,
  location_lat double precision,
  location_lng double precision,
  location_accuracy double precision,
  asr_confidence double precision,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table journeys (            -- optional MVP
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz,
  waypoints jsonb
);
```

Notes:
- `auth.users` is managed by Supabase Auth [S24].
- `emergency_events` stores the **structured** assessment (risk levels, transcript) — this powers the explainability panel and the experiment.
- **No raw audio table.** Per PRIVACY.md.

---

## 13. AI architecture proposal

### Components

| Component | MVP choice (PROPOSED) | Stretch goal |
|---|---|---|
| Speech recognition | Browser SpeechRecognition API [S26] | On-device whisper.cpp [S13] |
| Intent classification | TF-IDF + Logistic Regression | Fine-tuned DistilBERT (small transformer) |
| Risk combination | Rule-based scoring + fixed thresholds | Optional learned weights (documented) |
| Safety policy | Deterministic rules | same |

### Intent classifier inputs/outputs
- **Input:** normalized transcript (lowercased, punctuation stripped).
- **Output:** `P(emergency)` + predicted class (`EMERGENCY` / `NOT_EMERGENCY`) + confidence.
- **Training data:** our own labeled utterance bank (see EXPERIMENT_PLAN.md §5). We found no standard public benchmark for personal-safety emergency intent (SOURCES.md "cannot confirm").
- **Inference:** tiny model — runs in browser/edge instantly.
- **Evaluation:** precision/recall/F1/FPR/FNR on held-out set. NOT YET MEASURED.
- **Failure cases to document:** sarcasm ("Great, thanks for the help"), idiomatic phrases, ASR homophone errors ("help" → "hell"), accented ASR errors.

### No fake AI rule
We add ML only where it earns its place: the intent classifier replaces naive keyword matching and is *measured against it*. Everything else (context, risk engine, policy) is explicit rules. If a rule works better than ML in the ablation, we say so.

---

## 14. Risk-engine proposal

Full design in **[RISK_ENGINE.md](./RISK_ENGINE.md)**. Summary:
- Signals → levels (LOW/MEDIUM/HIGH) → **fixed-weight combination** (weights chosen by reasoning, documented, NOT learned) → risk level → safety policy.
- **Explainability output** shows every signal and the arithmetic (e.g., `intent HIGH(2) + threat HIGH(2) + safety mode ACTIVE(1) = 5 → MEDIUM`). No invented percentages.
- **Safety policy (deterministic):** LOW → nothing; MEDIUM → 10-second confirmation countdown (human-in-the-loop, like E-Sentinel [S22] and Crash Detection [S29]); HIGH → notify contacts + create event; manual SOS always escalates. **No LLM ever decides an emergency.**

---

## 15. Privacy architecture

Full design in **[PRIVACY.md](./PRIVACY.md)**. Summary:
- Normal operation: local buffer; if no emergency → discard; nothing uploaded.
- On escalation: **minimum structured JSON** (risk levels, transcript/summary, location, timestamp). **Raw audio is never stored.**
- Explicit consent screen for mic; clear disclosure that the browser speech service is involved (MVP limitation).
- Retention: events kept for a defined period, user-deletable.
- We explicitly do NOT claim end-to-end encryption or GDPR compliance.

---

## 16. Security risks (and mitigations)

| Risk | Mitigation (PROPOSED) |
|---|---|
| Secrets in frontend / committed to git | Never commit `.env`; only public anon key in client; service-role key stays in Supabase env. Add `.gitignore` first. |
| Users reading others' data | RLS policies on every table; tested with security tests (a second user cannot read the first user's events). |
| Account/API abuse (fake SOS spam) | Notification cooldown + rate limiting; document behavior (TESTING.md case 12). |
| Location privacy | Location used only during journey/SOS; user-gated; shown in consent screen. |
| Audio privacy | Not stored; browser service disclosed. |
| Injection in transcripts | All DB access via parameterized Supabase client; treat transcript as data, never SQL/HTML. |
| Dependency supply chain | Only install what we need; justify each dependency (our rule). |

---

## 17. Testing strategy

Full plan in **[TESTING.md](./TESTING.md)**. Levels: unit (classifier, risk rules, RLS), integration (pipeline), manual E2E (mic + GPS), and the experiment. We cover at least: normal speech, emergency speech, ambiguous speech, false-emergency phrases, background noise, accents, speaking speeds, poor mic, no GPS, poor network, no internet, repeated trigger, accidental trigger. Every result recorded, labeled OUR EXPERIMENTAL RESULT, never "works perfectly".

---

## 18. Experimental methodology

Full plan in **[EXPERIMENT_PLAN.md](./EXPERIMENT_PLAN.md)**. Key points:
- Models A (keyword) / B (+intent) / C (+context) / D (+extra signals) tested on the **same locked test set**.
- Metrics: accuracy, precision, recall, F1, FPR, FNR, latency — with formulas shown and **NOT YET MEASURED** until run.
- Dataset: our own labeled utterance bank (~200–400 items), 3-person majority labels, train/val/test split ~70/15/15, no speaker overlap.
- We test on both gold transcripts and ASR output to see where errors come from.
- Report paired differences (A vs B, B vs C, C vs D). We do not assume D wins.

---

## 19. 4-week development roadmap

| Week | Goal | Deliverable |
|---|---|---|
| **1** | Setup + core plumbing | Repo, Supabase schema + RLS, React app, auth, contacts, location service. Tests: auth + RLS. |
| **2** | Voice + intelligence core | Voice input + consent, ASR wrapper, intent classifier + unit tests, risk engine + policy + tests. |
| **3** | Events + dashboards + dataset | Emergency event + simulated notification, emergency dashboard, **build labeled dataset**, testing dashboard. |
| **4** | Experiment + report | Run A/B/C/D ablation, fill results tables, write conclusion (conservative), demo polish, final commits. |

Each week ends with a demo-able milestone. Buffer: the dataset (week 3) is the most-likely slip — start collecting example utterances in week 1.

---

## 20. Team division (3 beginners, PROPOSED — swap as you like)

We are small, so roles overlap, but each member "owns" one vertical:

| Member | Owns | Builds | Keeps working at the end |
|---|---|---|---|
| **Member 1 — App/Data** | Auth, contacts, Supabase schema + RLS, event storage | The "how data flows safely" story | Dashboard screens + testing dashboard |
| **Member 2 — Voice/ML** | Voice input, ASR wrapper, intent classifier, dataset, experiment scripts | The "does the classifier actually reduce false alarms" story | Results tables + experiment report |
| **Member 3 — Risk/Logic** | Risk engine, context service, policy, notification simulation | The "why did the system decide this" story | Explainability panel + demo |

**Rule:** each member reviews the other two's code once a week (read + ask questions). Understanding > speed.

---

## 21. Learning roadmap (one page each, pick only what you need)

| Topic | Why for HerShield | Where |
|---|---|---|
| Git + GitHub (add/commit/push/branch) | Small commits rule | Week 1 |
| HTML/CSS + React basics (components, state, props) | All UI | Week 1 |
| TypeScript basics (types, functions) | `lib/` modules | Week 1 |
| SQL + PostgreSQL (SELECT/INSERT + JOINs) | Schema + queries | Week 1–2 |
| Supabase Auth + RLS (policies) | Security | Week 1–2 |
| JS Promises/async (await) | Mic + GPS + network | Week 2 |
| Basic NLP (tokenization, TF-IDF, logistic regression intuition) | Intent classifier | Week 2–3 |
| Text classification evaluation (confusion matrix, P/R/F1) | Experiment | Week 3 |
| Clean data hygiene (splits, no leakage) | Valid experiment | Week 3 |

Suggested free references (we will verify links before relying on them): MDN for Web APIs [S26][S27], Supabase docs [S24], a TF-IDF + logistic regression tutorial. We'll pick concrete links when we start each module.

---

## 22. Dependencies we may need (each justified before install)

### Frontend (React + TS + Vite)
- `react`, `react-dom`, `typescript`, `vite` — UI + build tooling (baseline).
- `@supabase/supabase-js` — auth + DB client [S24].
- `react-router-dom` — navigation.
- (Maybe) `@tensorflow/tfjs` or `transformers.js` — **only if** we upgrade the classifier beyond TF-IDF (stretch goal; not in MVP).

### Experiment harness
- `python` + `scikit-learn` (TF-IDF + LogisticRegression + metrics) — the experiment.
- `pandas`/`numpy` — data handling.
- `pytest` — experiment tests.
- `matplotlib` (optional) — charts for the report.

### Testing
- `vitest` — unit tests (frontend logic).
- `supertest`/node test runner — integration tests if needed.

### Backend (Supabase-managed, no local install)
- Supabase Auth, Postgres, Edge Functions (deno), optional storage.

### Explicitly avoided
- No heavy ML framework in MVP; no SMS provider in MVP; no auth library beyond Supabase; no ORM (plain SQL or Supabase client).

---

## 23. Sources (URLs)

Full annotated list in **[SOURCES.md](./SOURCES.md)**. Key ones:

1. Government: Himmat launch (PIB) https://pib.gov.in/newsite/PrintRelease.aspx?relid=114267
2. Government: Himmat Plus features (Delhi Civil Defence) https://civildefence.delhi.gov.in/himmar_plus.php
3. Government: Transport Scotland safety-app typologies https://www.transport.gov.scot/publication/there-s-an-app-for-that-women-s-safety-on-public-transport-in-scotland/mapping-the-typologies-of-personal-safety-apps/
4. Product: bSafe (Play Store) https://play.google.com/store/apps/details?id=com.bipper.app.bsafe
5. Product: Hollie Guard https://hollieguard.com/
6. Apple: Emergency SOS via Satellite https://www.apple.com/government/docs/resources/E_FINAL_Emergency_SOS_via_Satellite_Executive_Overview.pdf
7. Apple: Crash Detection overview https://www.apple.com/government/docs/resources/E_FINAL_Crash_Detection_Executive_Overview.pdf
8. Research: Halilaj et al. 2025 distress detection https://ceur-ws.org/Vol-4044/paper03.pdf
9. Research: Noise-Agnostic Multitask Whisper (false alarms) https://arxiv.org/html/2501.11631v1
10. Research: E-Sentinel (on-device context-aware) https://www.sciencedirect.com/science/article/pii/S2352711026001251
11. Research: e112 context-aware platform https://arxiv.org/html/2604.20342v1
12. Research: Warden Speech Commands dataset https://arxiv.org/abs/1804.03209
13. Research: Apple voice trigger (Interspeech 2022) https://machinelearning.apple.com/research/improving-voice-trigger
14. Tech: whisper.cpp https://github.com/ggml-org/whisper.cpp
15. Tech: Supabase docs https://supabase.com/docs
16. Tech: MDN Web Speech API https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
17. Tech: MDN Geolocation API https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API

---

## STOP — decision required

We have completed the 23-point first task. **No application code has been written.**

Please confirm, in order:
1. Approve the **scope** (§8) and **stack** (§9: React + TS + Supabase)?
2. Approve the **MVP limitation** that voice detection requires the app/tab open and online (offline/background = future work)?
3. Approve the **team division** (§20) and **4-week roadmap** (§19)?

Reply with any changes (e.g., "use Firebase instead", "we need offline in the demo", "swap roles"), and only then will we start implementing — in small, explainable steps.