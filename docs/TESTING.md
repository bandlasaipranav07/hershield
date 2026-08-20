# HerShield — Testing

**Status:** Draft v1 · **Date:** 2026-08-20
**Rule:** We never write "the system works perfectly". We run tests, record real outcomes, and report them as **OUR EXPERIMENTAL RESULT**.

---

## 1. Test levels

| Level | What | Tooling (PROPOSED) | When |
|---|---|---|---|
| Unit | Classifier functions, risk engine rules, RLS policies | Vitest (JS) / pytest (Python for experiments) | Continuously |
| Integration | Full pipeline: text → intent → risk → event → notification | Node test runner + Supabase local/dev | Each feature done |
| End-to-end (manual) | Real browser, real mic, real GPS | Manual checklist below | Before demo |
| Experiment | The A/B/C/D comparison | see EXPERIMENT_PLAN.md | Final week |

## 2. Automated test cases (must cover)

Write explicit test fixtures (a JSON array of `{utterance, expected}`) and assert the classifier output. Cases:

1. **Normal speech** → not emergency. e.g., "The weather is nice today."
2. **Emergency speech** → emergency. e.g., "Someone is attacking me, please help!"
3. **Ambiguous speech** → decided per policy (record expected decision). e.g., "I need help." (alone)
4. **False emergency phrases** (trigger word, benign intent). e.g., "Help me with my assignment." / "Can you help me find my phone?" / "Help me carry this."
5. **Background noise** → ASR may garble; record what happens (expect: no emergency, or LOW risk).
6. **Different accents** → team members with different accents record the same utterances; compare.
7. **Different speaking speeds** → fast and slow reads of the same sentence.
8. **Poor microphone conditions** → cover mic / distance; record ASR confidence and output.
9. **No GPS** → emergency should still escalate with "location unknown" flag, not crash.
10. **Poor network** → emergency should still attempt to queue event locally; record failure mode.
11. **No internet** → same as above; document behavior (MVP is online-first, so we document degradation honestly).
12. **Repeated trigger** → 3 "help" triggers in 10 s; check cooldown behavior and risk inflation rule.
13. **Accidental trigger** → TV/radio speech with "help" while phone near; check LOW/no-escalation.
14. **Manual SOS** → must always escalate, regardless of context. Test this hard.

Each case gets a row in the results table (below) after we run it.

## 3. Manual end-to-end checklist (for demo day)

- [ ] Create account, log in.
- [ ] Add emergency contacts (2).
- [ ] Start voice listening.
- [ ] Say a normal sentence → no event created.
- [ ] Say "Help! Someone is following me." → HIGH risk, contact(s) notified (simulated), event in dashboard.
- [ ] Say "Help me with my assignment." → NOT escalated (intent filter works).
- [ ] Trigger manual SOS → event created even when risk engine says LOW.
- [ ] Revoke location permission → still works, location marked unavailable.
- [ ] Check the testing dashboard shows per-model metrics (once implemented).

## 4. Results table (fill after running)

| # | Test case | Expected | Actual | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 1 | Normal speech | no event | NOT YET MEASURED | — | |
| 2 | Emergency speech | HIGH | NOT YET MEASURED | — | |
| 3 | Ambiguous speech | per policy | NOT YET MEASURED | — | |
| 4 | False emergency phrases | no escalation | NOT YET MEASURED | — | |
| 5 | Background noise | no/LOW | NOT YET MEASURED | — | |
| 6 | Different accents | consistent | NOT YET MEASURED | — | |
| 7 | Speaking speed | consistent | NOT YET MEASURED | — | |
| 8 | Poor mic | degrade gracefully | NOT YET MEASURED | — | |
| 9 | No GPS | location=unknown | NOT YET MEASURED | — | |
| 10 | Poor network | queued/retry | NOT YET MEASURED | — | |
| 11 | No internet | documented failure | NOT YET MEASURED | — | |
| 12 | Repeated trigger | cooldown | NOT YET MEASURED | — | |
| 13 | Accidental trigger | no escalation | NOT YET MEASURED | — | |
| 14 | Manual SOS | always escalates | NOT YET MEASURED | — | |

## 5. How we will run it

- Scripts: one command per test batch, output in a structured table (e.g., `npm run test:classifier`).
- Experiments: a notebook/script reproducing the ablation and printing all metrics.
- All raw results stored under `results/` with date stamps so claims are auditable.

## 6. What a "Pass" means

A test passes only when the **actual** outcome matches the **expected** outcome we wrote BEFORE running. If behavior surprises us, we update the expectation only with a written reason in DECISIONS.md — never silently.