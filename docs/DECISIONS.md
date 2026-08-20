# HerShield — Decisions Log

**Status:** Draft v1 · **Date:** 2026-08-20

Every important decision gets a row: what we decided, why, what we gave up, and when it can be revisited. This is how we stay honest and reversible.

| # | Date | Decision | Why | Trade-off / risk | Status |
|---|---|---|---|---|---|
| 1 | 2026-08-20 | Research + documentation before any application code | User requirement; prevents blind coding | Slower start | ✅ Done (this document set) |
| 2 | 2026-08-20 | NOT claiming feature novelty; claim = measured comparison | Sources show all components exist (E-Sentinel, bSafe, etc.) | We must let results speak | ✅ Decided |
| 3 | 2026-08-20 | Web app (React + TS) + Supabase, not native Android | Beginner-friendly, fast MVP, good for demo (see PROPOSAL §9) | No true background mic / offline-first | PENDING APPROVAL |
| 4 | 2026-08-20 | Browser SpeechRecognition API for MVP ASR | Free, no server, fast to build | Privacy caveat (browser cloud service) | PENDING APPROVAL |
| 5 | 2026-08-20 | TF-IDF + Logistic Regression for MVP intent classifier | Explainable, small, fast; fits experiment plan | Lower ceiling than transformers | PENDING APPROVAL |
| 6 | 2026-08-20 | Rule-based risk engine with manually justified weights | No invented "learned" numbers; explainable | Weights are assumptions until tested | PENDING APPROVAL |
| 7 | 2026-08-20 | Deterministic safety policy; no LLM decision-maker | Safety-critical; E-Sentinel precedent [S22] | Less "AI wow factor" | PENDING APPROVAL |
| 8 | 2026-08-20 | Notifications simulated in MVP | No real SMS provider needed for demo | Not a real emergency service | PENDING APPROVAL |
| 9 | 2026-08-20 | No raw audio stored anywhere | Privacy stance (PRIVACY.md) | Can't do post-hoc audio analysis | PENDING APPROVAL |
| 10 | 2026-08-20 | TEAM APPROVED: stack = React + TS + Vite + Supabase | Team decision | Fixed unless concrete blocker (then STOP) | ✅ Approved |
| 11 | 2026-08-20 | TEAM APPROVED: MVP limitation (app open + online; background/offline = Future Work) | Team decision | Never simulate/falsely claim background/offline | ✅ Approved |
| 12 | 2026-08-20 | TEAM APPROVED: Models A/B/C comparison is core feature | Team decision | No fabricated metrics; use NOT YET MEASURED | ✅ Approved |
| 13 | 2026-08-20 | TEAM APPROVED: DEMO/SIMULATION mode; no real emergency services | Team decision | All simulated actions labeled SIMULATION | ✅ Approved |
| 14 | 2026-08-20 | Phase 0 design finalized in PHASE_0_DESIGN.md (architecture, schema, RLS, env, git, Phase 1 plan) | Design work | Awaiting team approval of Phase 1 start | PENDING APPROVAL |
| 15 | 2026-08-20 | Scoring pipeline shared across app + experiment harness via exported model.json + cross-check tests | Keeps app and experiment results consistent | Two runtimes must stay in sync (mitigated by cross-check test) | PROPOSED |
| 16 | 2026-08-20 | experiment_results/test_utterances: no client writes; service-role only | Prevents users faking metrics | Requires server-side write path (harness) | PROPOSED |
| 17 | 2026-08-20 | PHASE 1 DONE: git init, Vite React-TS scaffold, Vitest + RTL, .env.example, DEMO/SIMULATION placeholder | Approved Phase 1 plan | — | ✅ Done |
| 18 | 2026-08-20 | Repo-local git identity set to placeholder "HerShield Team <hersheild-team@example.com>" | No git identity existed; user chose repo-local; team can override anytime with `git config user.name "Real Name"` | Commits attributed to placeholder until changed | ✅ Done (override per team) |
| 19 | 2026-08-20 | Add react-router-dom for client routing | Multiple screens (login/register/home, later contacts/dashboard); matches PHASE_0_DESIGN App.tsx "routes + banner" | Single extra dep | ✅ Done |
| 20 | 2026-08-20 | `lib/supabase.ts` throws on missing env vars (fail fast) | Without keys the app can't talk to Supabase; clear message beats silent 404s | App won't render until `.env` filled | ✅ Done |
| 21 | 2026-08-20 | `signInWithEmail` catches thrown AuthError | supabase-js v2.112 throws (not returns) on invalid login credentials | — | ✅ Done |
| 22 | 2026-08-20 | RLS verification shipped as manual SQL + browser checklist in supabase/README.md; automated RLS integration test deferred to CI/test-DB phase | No test database exists yet; manual proof is honest and doable now | RLS verified manually, not automated | ✅ Deferred (documented) |

## Rules for future entries

- Record the date, the reason, and the alternative rejected.
- If a test contradicts a decision (e.g., context doesn't help), log it here and update the affected document.
- Never delete a row; append a "superseded by #N" note instead.