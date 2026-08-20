# HerShield

Women-safety emergency assistance system — a context-aware emergency detection college mini-project by 3 CSE students.

**Status:** Design / research phase. **No application code has been written yet.** We are waiting for team approval of the proposal before implementing anything.

## What this project investigates

> Can contextual information reduce false emergency triggers compared with simple voice-keyword detection?

We compare 4 models: keyword-only (A), + intent (B), + context (C), + more signals (D). See [EXPERIMENT_PLAN.md](./docs/EXPERIMENT_PLAN.md).

## Important honesty rules we follow

- We do NOT claim our features are unique — most components exist (SOS, GPS, voice SOS, crash detection, context-aware emergency research). See [COMPETITIVE_ANALYSIS.md](./docs/COMPETITIVE_ANALYSIS.md).
- Every external claim has a source in [SOURCES.md](./docs/SOURCES.md).
- Metrics we haven't measured read **NOT YET MEASURED**.
- Things we measured ourselves are labeled **OUR EXPERIMENTAL RESULT**.

## Documentation (start here)

| File | What it is |
|---|---|
| [PROJECT_PROPOSAL.md](./docs/PROJECT_PROPOSAL.md) | The 23-point first task: summary, problem, stack analysis, architecture, roadmap, dependencies, etc. |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design (proposed) |
| [COMPETITIVE_ANALYSIS.md](./docs/COMPETITIVE_ANALYSIS.md) | 15 products/papers compared |
| [NOVELTY_MATRIX.md](./docs/NOVELTY_MATRIX.md) | What is common vs differentiated |
| [EXPERIMENT_PLAN.md](./docs/EXPERIMENT_PLAN.md) | Research question, metrics, dataset, models A–D |
| [RISK_ENGINE.md](./docs/RISK_ENGINE.md) | Explainable risk scoring + safety policy |
| [PRIVACY.md](./docs/PRIVACY.md) | Data inventory, retention, consent |
| [TESTING.md](./docs/TESTING.md) | Automated + manual test plan |
| [DECISIONS.md](./docs/DECISIONS.md) | Decision log (why we chose what) |
| [TODO.md](./docs/TODO.md) | Task list |
| [SOURCES.md](./docs/SOURCES.md) | Every source, what it verifies |

## How to use this repo (once approved)

We will build in small pieces with small git commits (per our Git rules). No giant commits. Before every dependency install we will explain why.

## Team

3 beginner CSE students using OpenCode as coding assistant. We want to understand while building.