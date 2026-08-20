# HerShield — TODO

**Status:** Draft v1 · **Date:** 2026-08-20

All items are pending. Checkmarks appear only when a task is actually done.

## Phase 0 — Research & approval (current)
- [x] Research existing women-safety apps
- [x] Research voice-triggered / AI distress-detection systems
- [x] Research context-aware systems + false-alarm reduction
- [x] Research privacy/on-device approaches
- [x] Write SOURCES.md, COMPETITIVE_ANALYSIS.md, NOVELTY_MATRIX.md
- [x] Write EXPERIMENT_PLAN.md, RISK_ENGINE.md, PRIVACY.md, TESTING.md, ARCHITECTURE.md, DECISIONS.md
- [x] Write PROJECT_PROPOSAL.md (23-point first task)
- [x] **Team approved proposal** (stack, MVP limits, A/B/C experiment, DEMO mode)
- [x] Write PHASE_0_DESIGN.md (final architecture, schema, RLS, env, git, Phase 1 plan)
- [ ] **Team approves Phase 0 design → begin Phase 1** ← we are waiting here

## Phase 1 — Project setup (after approval)
- [ ] git init, .gitignore (never commit secrets), initial docs commit
- [ ] Scaffold React + TypeScript + Vite app in app/
- [ ] Strip boilerplate, add DEMO/SIMULATION placeholder
- [ ] Add Vitest + React Testing Library, smoke test
- [ ] .env.example, README run instructions
- [ ] Small commit + update TODO/DECISIONS

## Phase 2 — MVP features (in order)
- [ ] Auth (login/register, protected routes)
- [ ] Emergency contacts CRUD
- [ ] Location service (geolocation wrapper)
- [ ] Voice input + ASR wrapper + consent screen
- [ ] Intent classifier (TF-IDF + LR) + unit tests
- [ ] Risk engine + policy + unit tests
- [ ] Emergency event creation + notification simulation
- [ ] Emergency dashboard
- [ ] Testing dashboard (fixtures + metrics table)

## Phase 3 — Experiment & testing
- [ ] Build labeled dataset (see EXPERIMENT_PLAN.md)
- [ ] Run Model A/B/C/D ablation
- [ ] Fill results tables (TESTING.md + EXPERIMENT_PLAN.md) with OUR EXPERIMENTAL RESULT
- [ ] Write report conclusion (conservative)

## Phase 4 — Polish
- [ ] Privacy consent text finalized
- [ ] Error states (no GPS, no network) verified
- [ ] Final demo checklist
- [ ] Commit log tidy (small, descriptive commits)

## Future work (NOT MVP — see PROPOSAL §12)
- On-device ASR (whisper.cpp) for privacy/offline
- Distress speech (emotion) model
- Motion signals, journey deviation
- Real SMS/emergency-service integration
- Multilingual support
- Wearable/BLE