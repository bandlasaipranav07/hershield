# HerShield

Women-safety emergency assistance system — a context-aware emergency detection college mini-project by 3 CSE students.

**Status:** The repository contains a working React + TypeScript + Vite application with Supabase integration, safety workflows, local-first incident storage, and a synthetic fixture dashboard. This is a research/demo application, not a production emergency-response service.

## What this project investigates

> Can contextual information reduce false emergency triggers compared with simple voice-keyword detection?

We compare 4 models: keyword-only (A), + intent (B), + context (C), + more signals (D). See [EXPERIMENT_PLAN.md](./docs/EXPERIMENT_PLAN.md).

## Important honesty rules we follow

- We do NOT claim our features are unique — most components exist (SOS, GPS, voice SOS, crash detection, context-aware emergency research). See [COMPETITIVE_ANALYSIS.md](./docs/COMPETITIVE_ANALYSIS.md).
- Every external claim has a source in [SOURCES.md](./docs/SOURCES.md).
- Metrics we haven't measured read **NOT YET MEASURED**.
- Things we measured ourselves are labeled **OUR EXPERIMENTAL RESULT**.

## Current implementation

- Email/password authentication with a development-only demo identity; ordinary login never fabricates an account.
- Owner-scoped contacts/events, browser microphone consent, 1-second audio windows with a 500 ms hop, transcript intent scoring, and a deterministic risk policy.
- Voice escalation and manual SOS use the same owner-tagged local incident path. Cloud sync is optional and retries with the stable local event ID.
- Notifications are simulated. Browser SpeechRecognition may use the browser vendor's speech service. No real SMS or emergency dispatch is performed.
- The A–D dashboard evaluates 14 hand-written fixtures with defined labels and confusion metrics. Those numbers describe only these fixtures and the hand-written seed model, not real-world performance.

## Documentation (start here)

| File | What it is |
|---|---|
| [PROJECT_PROPOSAL.md](./docs/PROJECT_PROPOSAL.md) | The 23-point first task: summary, problem, stack analysis, architecture, roadmap, dependencies, etc. |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Current system boundaries and known limitations |
| [COMPETITIVE_ANALYSIS.md](./docs/COMPETITIVE_ANALYSIS.md) | 15 products/papers compared |
| [NOVELTY_MATRIX.md](./docs/NOVELTY_MATRIX.md) | What is common vs differentiated |
| [EXPERIMENT_PLAN.md](./docs/EXPERIMENT_PLAN.md) | Research question, metrics, dataset, models A–D |
| [RISK_ENGINE.md](./docs/RISK_ENGINE.md) | Explainable risk scoring + safety policy |
| [PRIVACY.md](./docs/PRIVACY.md) | Data inventory, retention, consent |
| [TESTING.md](./docs/TESTING.md) | Automated + manual test plan |
| [DECISIONS.md](./docs/DECISIONS.md) | Decision log (why we chose what) |
| [TODO.md](./docs/TODO.md) | Task list |
| [SOURCES.md](./docs/SOURCES.md) | Every source, what it verifies |

## Run the application

```bash
cd app
npm install
npm run dev
```

To try the local demo identity, leave Supabase unconfigured and keep `VITE_DEMO_MODE=true` in `app/.env`. The demo flag is honored only by the Vite development server. For a real Supabase development project, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; only use the public anon/publishable key in the browser and rely on reviewed RLS policies.

Run the checks from `app/` with `npm test`, `npm run lint`, and `npm run build`. See [app/README.md](./app/README.md) for details and the limitations in [docs/PRIVACY.md](./docs/PRIVACY.md).

## Team

3 beginner CSE students using OpenCode as coding assistant. We want to understand while building.
