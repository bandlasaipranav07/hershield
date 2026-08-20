# HerShield — Phase 0 Design (FINAL, awaiting approval)

**Status:** PROPOSED → pending team approval
**Date:** 2026-08-20
**Supersedes:** the earlier proposals in PROJECT_PROPOSAL.md / ARCHITECTURE.md where they differ. This document is the working source of truth for implementation.

**Approved constraints (from team):**
- Stack: React + TypeScript + Vite + Supabase. No stack change unless a concrete blocker is proven; if so, STOP and explain.
- MVP limitation: voice detection requires the app open; internet required; background mic + offline = Future Work. Never simulate/falsely claim them.
- Experiment (Models A/B/C) is a CORE feature. No fabricated metrics; use **NOT YET MEASURED** until real.
- DEMO/SIMULATION MODE: no real emergency services ever contacted; all simulated actions labeled SIMULATION.
- Implement in small phases; stop for approval after each major phase.

---

## 1. Final architecture

```
┌────────────────────────── Browser — React + TypeScript + Vite (app/) ──────────────────────────┐
│                                                                                                 │
│  Screens            │  lib/ services (pure TS, testable)                                        │
│  Login/Register     │  auth.ts        → Supabase Auth + session                                  │
│  Contacts           │  voice.ts       → mic capture + SpeechRecognition wrapper                  │
│  Listen (demo)      │  intent/        → intent classifier (TF-IDF + LR inference from model.json)│
│  Dashboard          │  context.ts     → safety mode, journey, geolocation                        │
│  Testing            │  risk/          → risk engine (signals → risk + explanation)               │
│                     │  policy.ts      → deterministic safety policy                              │
│                     │  events.ts      → create/read emergency events                             │
│                     │  notify.ts      → SIMULATED notification + audit log                       │
└──────────────────────────────┬───────────────────────────────────────────────────────────────────┘
                               │ Supabase client (anon key + JWT; every query passes RLS)
                               ▼
┌────────────────────────────── Supabase (backend-as-a-service) ──────────────────────────────────┐
│  Auth (email/password)   │  PostgreSQL schema (§3) with RLS policies (§4)                       │
│  Edge Functions (future) │  Storage (unused in MVP — no raw audio)                              │
└──────────────────────────────▲───────────────────────────────────────────────────────────────────┘
                               │ service-role writes (server-side only)
┌──────────────────────────────┴──── experiments/ harness (Python + scikit-learn) ────────────────┐
│  data/ labeled_utterances.csv      → seeds supabase test_utterances                             │
│  train.py            → trains TF-IDF + LR → exports app/src/lib/intent/model.json              │
│  evaluate_models.py  → runs A/B/C on locked test split → writes experiment_results (metrics)   │
│  results/            → timestamped JSON/CSV (auditable)                                         │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Key properties:
- **One scoring pipeline, two runtimes.** The intent classifier, risk engine, and policy are pure TypeScript. The Python harness uses the *same exported model artifact* (`model.json`) and the *same rules* (re-implemented identically, cross-checked by unit tests) so the app and the experiment agree. We will add a cross-check test that runs the same utterances through both and asserts equal outcomes.
- **DEMO MODE.** A prominent `DEMO / SIMULATION` banner is shown in the UI. `notify.ts` only ever writes to `notification_log` with `status = 'SIMULATED'`. There is no code path that can contact real emergency services.
- **Experiment metrics are computed by the harness from our locked test data and stored in `experiment_results`.** The Testing dashboard displays stored results; it does not invent them.

## 2. Final folder structure

```
HerShield/
├── README.md
├── docs/                        # all documentation
│   ├── PHASE_0_DESIGN.md        # ← this file
│   ├── PROJECT_PROPOSAL.md
│   ├── ARCHITECTURE.md
│   ├── COMPETITIVE_ANALYSIS.md
│   ├── NOVELTY_MATRIX.md
│   ├── EXPERIMENT_PLAN.md
│   ├── RISK_ENGINE.md
│   ├── PRIVACY.md
│   ├── TESTING.md
│   ├── DECISIONS.md
│   ├── TODO.md
│   └── SOURCES.md
├── app/                         # React + TypeScript + Vite frontend
│   ├── .env.example             # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (no secrets in git)
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx              # routes + DEMO/SIMULATION banner
│       ├── lib/
│       │   ├── auth.ts
│       │   ├── voice.ts
│       │   ├── context.ts
│       │   ├── events.ts
│       │   ├── notify.ts
│       │   ├── policy.ts
│       │   ├── intent/
│       │   │   ├── classify.ts  # inference (vectorize → predict)
│       │   │   ├── model.json   # exported from experiments (vocab + idf + weights)
│       │   │   └── classify.test.ts
│       │   └── risk/
│       │       ├── riskEngine.ts
│       │       └── riskEngine.test.ts
│       ├── screens/
│       │   ├── Login.tsx
│       │   ├── Register.tsx
│       │   ├── Contacts.tsx
│       │   ├── Listen.tsx       # voice demo screen (mic + consent)
│       │   ├── Dashboard.tsx    # emergency events + risk explanation
│       │   └── Testing.tsx      # experiment/dashboard (reads experiment_results)
│       └── styles/
├── supabase/
│   ├── migrations/
│   │   └── 0001_init.sql        # full schema (§3) + RLS (§4)
│   └── README.md                # how to apply migrations
├── experiments/
│   ├── README.md
│   ├── requirements.txt
│   ├── data/
│   │   └── labeled_utterances.csv   # train/val/test splits + labels (locked test set)
│   ├── train.py
│   ├── evaluate_models.py
│   ├── export_model.py
│   ├── src/                     # shared rule logic (mirror of app/src/lib/risk + policy)
│   └── results/                 # timestamped metric outputs (gitignored except README)
└── .gitignore                   # node_modules, .env, dist, __pycache__, results/, service keys
```

## 3. Supabase schema (migration `0001_init.sql`)

```sql
-- 1. PROFILES: one row per auth user
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- auto-create profile on signup
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.phone);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. CONTACTS
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  relation text,
  created_at timestamptz not null default now()
);

-- 3. EMERGENCY EVENTS
create table public.emergency_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('manual_sos', 'voice_detected')),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  intent_level text,
  threat_level text,
  safety_mode text,
  journey_status text,
  transcript text,
  transcript_summary text,
  trigger_source text,
  location_lat double precision,
  location_lng double precision,
  location_accuracy double precision,
  asr_confidence double precision,
  decision_reason text,        -- explainability: e.g. "intent HIGH + threat HIGH + safety ACTIVE = 5 -> MEDIUM"
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index emergency_events_user_created_idx on public.emergency_events(user_id, created_at desc);

-- 4. NOTIFICATION LOG (SIMULATION AUDIT TRAIL)
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.emergency_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  channel text not null default 'simulated_email',
  status text not null default 'SIMULATED' check (status in ('SIMULATED')),
  payload jsonb,
  created_at timestamptz not null default now()
);

-- 5. TEST UTTERANCES (locked evaluation data; seeded by experiments harness only)
create table public.test_utterances (
  id uuid primary key default gen_random_uuid(),
  utterance text not null,
  label text not null check (label in ('EMERGENCY', 'NOT_EMERGENCY', 'AMBIGUOUS')),
  category text not null,        -- e.g. 'false_trigger', 'clean', 'emergency_phrasing'
  split text not null check (split in ('train', 'val', 'test')),
  source text,
  created_at timestamptz not null default now()
);

-- 6. EXPERIMENT RESULTS (written only by the harness with service role)
create table public.experiment_results (
  id uuid primary key default gen_random_uuid(),
  model_name text not null check (model_name in ('A_keyword', 'B_intent', 'C_context', 'D_all')),
  split text not null default 'test',
  run_date timestamptz not null default now(),
  metrics jsonb not null,        -- {accuracy, precision, recall, f1, fpr, fnr, latency_ms}
  details jsonb,                 -- per-item predictions, thresholds, config (audit trail)
  notes text
);
```

Design notes:
- No raw audio anywhere (PRIVACY.md).
- `test_utterances` + `experiment_results` exist so the **Testing dashboard can display metrics computed automatically from our locked test data** — fulfilling the "metrics calculated automatically" requirement. Values stay **NOT YET MEASURED** until the harness runs.

## 4. RLS / security design

Principle: the **client (anon key + user JWT) may only touch the user's own rows**. The service-role key (server-side only) bypasses RLS for seeding the experiment tables. Documented in [PRIVACY.md](./PRIVACY.md) and each migration.

```sql
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.emergency_events enable row level security;
alter table public.notification_log enable row level security;
alter table public.test_utterances enable row level security;
alter table public.experiment_results enable row level security;

-- PROFILES: user manages own row; trigger handles insert on signup
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());

-- CONTACTS: owner-only CRUD
create policy contacts_all_own on public.contacts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- EVENTS: owner can insert/select/update (resolve); no client delete
create policy events_insert_own on public.emergency_events
  for insert with check (user_id = auth.uid());
create policy events_select_own on public.emergency_events
  for select using (user_id = auth.uid());
create policy events_update_own on public.emergency_events
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- NOTIFICATION LOG: owner can read; app creates SIMULATED rows for own events
create policy notif_select_own on public.notification_log
  for select using (user_id = auth.uid());
create policy notif_insert_own on public.notification_log
  for insert with check (user_id = auth.uid());

-- TEST UTTERANCES: readable by any authenticated user (team/dev); no client writes
create policy test_utterances_read_auth on public.test_utterances
  for select using (auth.role() = 'authenticated');

-- EXPERIMENT RESULTS: readable by any authenticated user; no client writes
create policy experiment_results_read_auth on public.experiment_results
  for select using (auth.role() = 'authenticated');
```

Security decisions (to be logged in DECISIONS.md):
1. **Service-role key** lives only in Supabase project env / experiment config, never in frontend, never committed.
2. **Anon key** is public by design (Supabase model) — it is safe in the client because RLS enforces real authorization.
3. `experiment_results` and `test_utterances` have no client insert/update/delete policies — only service-role can write them, preventing users from faking metrics.
4. We will write **RLS unit tests** (second user cannot read first user's events) as part of Phase 2/4.

## 5. Environment variables

Frontend (`app/.env`, gitignored; template in `app/.env.example`):
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key from Supabase dashboard>
```

Supabase Edge Functions (future) / experiments (`experiments/.env`, gitignored):
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key — NEVER in frontend>
```

Rule: if a variable is prefixed `VITE_` it is exposed to the browser. Nothing else goes in the client.

## 6. Git branch strategy

- Single repo `HerShield/`. `main` is always demoable/stable.
- One short-lived branch per phase feature:
  `feat/setup`, `feat/auth`, `feat/contacts`, `feat/events`, `feat/location`, `feat/sos`, `feat/voice`, `feat/keyword-baseline`, `feat/intent`, `feat/risk-engine`, `feat/experiment`, `feat/dashboard`.
- Small commits, conventional messages: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
- Another team member reviews before merge to `main` (pair review).
- `.gitignore` committed FIRST; no secrets ever. If a secret is committed accidentally: rotate it, remove from history (instructions in docs/README note), log in DECISIONS.md.
- Documentation updates ride along with the phase that produced them (not dumped at the end).

## 7. Phase 1 implementation plan (setup only — no feature code)

**Goal:** a clean, versioned repo that runs an empty React + TS app with a test runner wired up.

| Step | Action | Verification |
|---|---|---|
| 1.1 | `git init` in `HerShield/`, create `.gitignore` (node_modules, .env, dist, __pycache__, results/, OS junk), initial commit with docs/ + README | `git log --oneline` |
| 1.2 | Scaffold Vite React-TS app in `app/` (`npm create vite@latest app -- --template react-ts`) | `npm run dev` opens app |
| 1.3 | Strip Vite boilerplate: minimal `App.tsx` with a heading + DEMO/SIMULATION placeholder note; keep clean structure | app renders heading |
| 1.4 | Add Vitest + React Testing Library, one trivial smoke test (e.g., App renders heading) | `npm test` passes |
| 1.5 | `app/.env.example` created (values empty), `.gitignore` covers `.env` | no `.env` in git status |
| 1.6 | README "How to run" section (install, dev server, test) | steps work from clean clone |
| 1.7 | Commit `feat: initial project setup` (small), update TODO.md / DECISIONS.md | commit log clean |

**Explicitly NOT in Phase 1:** Supabase, auth, contacts, voice, classifier, risk engine, dashboards, experiment harness. Those start in Phase 2+.

**Dependencies added in Phase 1:** `react`, `react-dom`, `typescript`, `vite`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`. (Justified: scaffolding + the test runner we committed to.)

**Out of scope for Phase 1:** lint config beyond what Vite ships; prettier (add later only if team wants it).

## 8. What happens after Phase 1 approval

Phase 2 (Supabase auth) will: create the Supabase project, apply `0001_init.sql`, wire `auth.ts`, add Login/Register screens, and add RLS read tests. We stop again after Phase 2 for review.