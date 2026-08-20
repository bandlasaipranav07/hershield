# HerShield — Risk Engine

**Status:** Draft v1 · **Date:** 2026-08-20

**Purpose:** Define how we turn several imperfect signals into one **explainable** risk level — without pretending the numbers are "learned" or "scientifically calibrated" when they are not.

---

## 1. Design principle

> The risk engine must be **deterministic, explainable, and overridable**.
> It is a scoring layer, NOT a black box, and NOT an LLM.

Input signals → normalized per-signal levels → combine → risk level (LOW / MEDIUM / HIGH) → safety policy (see section 5).

## 2. Signals (MVP)

| Signal | Source | Possible values (PROPOSED) | How it's measured |
|---|---|---|---|
| **Emergency intent** | Intent classifier (Model B in EXPERIMENT_PLAN.md) | LOW / MEDIUM / HIGH | Classifier score after thresholding (e.g., probability of class `EMERGENCY`) |
| **Threat context (text)** | Extracted from transcript (structured info: presence of threat words, following/attacking/threatened phrasing) | LOW / MEDIUM / HIGH | Rule-based extraction + intent score (PROPOSED) |
| **Safety mode** | User setting | INACTIVE / ACTIVE | Boolean from app state |
| **Journey status** | User started a journey? deviation from route? | NO_JOURNEY / ON_ROUTE / DEVIATED | GPS distance from expected path (MVP: optional, may be OFF) |
| **Distress signal** | Voice characteristics (pitch/energy/urgency) | NOT_AVAILABLE in MVP | NOT IMPLEMENTED in MVP — documented as Future Work |
| **ASR confidence** | Speech recognizer | 0–1 | Reported by the recognizer if available |
| **Session state** | Did this trigger repeat within a short window? | NONE / REPEATED | App-level counter |

## 3. Combining signals

**IMPORTANT — no invented weights.** We will use the simplest honest method first: **explicit rules + a small fixed scoring table**, with weights we write down and justify manually. This is a MANUAL / rule-based combination, not a learned model.

### Proposed combination (PROPOSED — to be reviewed before implementation)

1. Each signal maps to a level: LOW=0, MEDIUM=1, HIGH=2. (ASSUMPTION: equal spacing is a modeling choice, not a fact.)
2. Base score = a **weighted sum**:
   - `weight(intent) = 3` — intent is our strongest evidence (justified: our research question centers on it).
   - `weight(threat context) = 2` — second strongest.
   - `weight(safety mode) = 1` — boosts/caps but never triggers alone.
   - `weight(journey deviation) = 1` — only meaningful if a journey is active.
   - `weight(distress) = 0 in MVP` (not available).
   - `weight(ASR confidence) = 0 in MVP` (reported but not scored).
   - `weight(repeated trigger) = 1` — only in combination.
3. Score → risk level using **fixed thresholds** (to be tuned on validation data, then locked):
   - 0–2 → LOW
   - 3–5 → MEDIUM
   - 6+ → HIGH
   (Numbers are illustrative PROPOSED starting points, NOT final. Thresholds get tuned on validation and reported in EXPERIMENT_PLAN.md.)

### Why these weights (transparency)

- We **chose** them by reasoning, not by data. Intent is weighted highest because the experiment plan assumes classifier quality matters most — we will TEST this assumption, and if the ablation shows context matters more, we change the weights **with a written note in DECISIONS.md**.
- They are **not learned**. If we later fit weights to data, that becomes "learned weights" and we will document the training process, data, and evaluation.

## 4. Explainability output (what the user/responder sees)

Example (PROPOSED output format):

```
Emergency assessment
────────────────────
Emergency intent:      HIGH
Threat context:        HIGH
Safety mode:           ACTIVE
Journey deviation:     LOW
Distress signal:       NOT AVAILABLE
ASR confidence:        0.87 (reported only)

Overall risk:          HIGH
Reason: intent HIGH + threat context HIGH + safety mode ACTIVE reached threshold 6+.
Trigger phrase: "help"
Transcript: "Help! Someone is following me."
```

Rules for the explainability text:
- Show every signal that went into the score.
- Never show a made-up percentage. Show the level and, when relevant, the threshold arithmetic (`2+2+1 = 5 → MEDIUM`).
- Show what triggered the evaluation (e.g., "keyword 'help' detected in transcript").

## 5. Safety policy (deterministic, LLM-independent)

The final decision is made by rules, not by the intent model alone and never by an LLM.

| Risk level | Policy (PROPOSED) |
|---|---|
| **LOW** | No escalation. Log locally. No contact notified. |
| **MEDIUM** | **Confirmation flow**: show the user a 10-second countdown with a "I'm safe" button. If no response → escalate to HIGH action. (Human-in-the-loop, following the same pattern used by E-Sentinel [S22] and Apple's Crash Detection countdown [S29].) |
| **HIGH** | Send emergency notification to configured contacts + create an EmergencyEvent record with location + transcript (or a summary, per privacy policy). In a real product this would call emergency services; in our MVP we **simulate** the notification (documented in PRIVACY.md / TESTING.md). |
| **Manual SOS** | Any user-initiated SOS bypasses the engine and always escalates. The engine can never block a manual SOS. |

Additional deterministic rules:
- **Manual SOS overrides everything** (safety-critical).
- **No emergency decision is made by an LLM.** If we ever use an LLM, it is for summarization or optional explanation only, with clear labels.
- **Repeated triggers** in a short window can raise one level but never from LOW straight to HIGH in one step. (ASSUMPTION: prevents panic-mashing from spamming contacts while still being sensitive.)
- **Safety mode ACTIVE** acts as a gate: if safety mode is INACTIVE, HIGH requires either intent=HIGH or threat=HIGH alone. (PROPOSED, to be tested.)

## 6. Evaluation of the risk engine itself

The risk engine's job is to map signals to risk. We evaluate it in two ways:

1. **End-to-end with the experiment**: the engine is part of Models C and D; its contribution shows up in the ablation (see EXPERIMENT_PLAN.md).
2. **Ablation of the rules**: we will run a small sensitivity check — e.g., "does removing journey deviation change decisions on the test set?" — and report the count of changed decisions. This tells us which signals matter for OUR data (OUR EXPERIMENTAL RESULT once run).

## 7. What we must never do

- Never invent weights and call them "ML-tuned".
- Never let a single signal alone (other than manual SOS) produce HIGH without the confirmation flow for MEDIUM inputs.
- Never hide a signal's value from the explainability panel.
