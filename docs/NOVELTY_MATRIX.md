# HerShield — Novelty Matrix

**Status:** Draft v1 · **Date:** 2026-08-20

**Purpose:** Classify every proposed feature honestly. Nothing is "novel" unless evidence supports it. We track which of our claims are safe to make in our report/presentation.

## Classification categories

| Class | Meaning |
|---|---|
| **A — Common / already established** | Exists widely. Claiming it is ours = wrong. |
| **B — Existing but can be improved** | Exists somewhere; we can do it differently/better *for our context*. |
| **C — Potentially differentiated** | We found no direct equivalent in our sources; needs care and honest phrasing ("we did not find X in the sources we reviewed", not "nobody has done X"). |
| **D — Research-level / difficult** | Possible but hard for 3 beginners in 4 weeks. |
| **E — Too risky / unrealistic** | Don't attempt in MVP; list as Future Work or drop. |

---

## Matrix

### 1. Core system features

| # | Feature | Class | Evidence / reasoning |
|---|---|---|---|
| 1.1 | SOS button/event with emergency contacts | **A** | Every app we reviewed (bSafe, Hollie Guard, Himmat, Shake2Safety) [S3][S5][S6][S7]. |
| 1.2 | GPS / location sharing | **A** | Ubiquitous [S5][S6][S7][S8]. |
| 1.3 | Emergency notification via SMS/email/push | **A** | bSafe, Himmat, Hollie Guard [S3][S6][S7]. |
| 1.4 | User authentication | **A** | Standard (Supabase/Firebase auth) [S24][S25]. |
| 1.5 | Dashboard (emergency + testing) | **A** | e112 has an operator dashboard [S23]. Our dashboard is an MVP simplification, not novel. |
| 1.6 | Voice input + speech recognition | **B** | bSafe has voice activation [S6]; on-device ASR exists (whisper.cpp) [S13]. We improve by deciding *where* to transcribe (privacy) and what to do with the text. |

### 2. Intelligence pipeline

| # | Feature | Class | Evidence / reasoning |
|---|---|---|---|
| 2.1 | Keyword / wake-word detection | **A** | Porcupine, wake-word KWS everywhere [S12]; Warden dataset [S19]. |
| 2.2 | Emergency-intent classification of the **full utterance** (not just "help") | **C (potentially differentiated for consumer apps)** | We found research on call-for-help detection [S15] and SER [S14][S18], but **no consumer women-safety app** that publishes utterance-level intent classification with measured false-positive rates. Phrase it as "we did not find in our review", NOT "nobody has done this". |
| 2.3 | Context-aware risk assessment (safety mode, journey status, location, time) | **B** | Research platforms (E-Sentinel, e112) are context-aware [S22][S23]; consumer apps use simple context (Hollie Journey) [S7]. Improvement: **structured, explainable multi-signal risk score**. |
| 2.4 | Distress speech characteristics (emotion/urgency in the voice) | **D** | Halilaj et al. [S14], SER papers [S18][S16] show it works in research but needs datasets/training — Future Work for us, not MVP. |
| 2.5 | Motion / accelerometer signals | **D** | Apple Crash Detection [S10] and E-Sentinel [S22] show feasibility; needs native hardware access we don't have in a web MVP. Future Work. |
| 2.6 | Explainable risk output (per-signal breakdown) | **C** | No consumer safety app we found shows a per-signal risk breakdown. State as "not found in sources reviewed". |
| 2.7 | Deterministic safety policy around the ML decision | **B→C** | E-Sentinel uses human-in-the-loop confirmation [S22]; we formalize a written, deterministic policy so no LLM decides alone. |

### 3. False-alarm reduction

| # | Feature | Class | Evidence / reasoning |
|---|---|---|---|
| 3.1 | Confidence threshold instead of binary match | **A** | Standard KWS practice [S20][S21]. |
| 3.2 | Utterance-level intent before trigger | **C** | See 2.2. |
| 3.3 | Context gating (don't escalate in low-risk context) | **B** | E-Sentinel's human-in-the-loop [S22]; Crash Detection false-alarm fixes [S29][S30]. |
| 3.4 | **Measured false-positive / false-negative rates on a held-out set** | **C** | We found research measuring model accuracy, but not this specific keyword vs intent vs intent+context ablation for personal safety. This is our main experimental contribution. |

### 4. Privacy / security

| # | Feature | Class | Evidence / reasoning |
|---|---|---|---|
| 4.1 | Local processing with discard-if-no-emergency | **B** | whisper.cpp on-device [S13]; Porcupine on-device [S12]; E-Sentinel on-device [S22]. We implement a practical version (client-side first pass + server fallback), documented honestly. |
| 4.2 | Minimum-information emergency transmission | **B** | Apple sends structured emergency info [S8][S9]. We do the same, smaller. |
| 4.3 | Data deletion / retention limits | **A** | Standard practice; we document ours. Not novel. |
| 4.4 | Secret management (env vars, never in frontend) | **A** | Standard security practice. Mandatory, not a differentiator. |

### 5. Scope / experimental

| # | Feature | Class | Evidence / reasoning |
|---|---|---|---|
| 5.1 | Build our own labeled emergency-intent dataset | **C / D** | We found no standard public benchmark for personal-safety emergency intent. Collecting + labeling our own (few hundred utterances) is doable but must be done carefully to avoid bias. Class **C** for dataset novelty (uncommon), **D** for effort. |
| 5.2 | Ablation: A (keyword) vs B (intent) vs C (intent+context) vs D (+signals) | **C** | The research question itself is our differentiator. We must NOT assume D wins. |
| 5.3 | LLM as the emergency decision maker | **E** | Rejected by design (safety policy). Deterministic rules around any model. |
| 5.4 | Multilingual distress detection | **E / D** | Whisper is multilingual [S28][S14] but intent classifier would need multilingual training data. Future Work. |
| 5.5 | Wearable / BLE integration | **E** | Requires native app + hardware. Future Work. |
| 5.6 | Offline-first full app | **D** | whisper.cpp + on-device inference [S13][S22] prove feasibility but add significant complexity. MVP = online web app with documented offline limitations; offline fallback = Future Work. |

---

## What we may and may not claim (for the report)

**We MAY claim:**
- "Based on the sources we reviewed, we did not find a consumer women-safety app that combines (a) utterance-level emergency-intent classification, (b) an explainable multi-signal risk score, and (c) published false-positive/negative measurements from a keyword-vs-intent-vs-context ablation."
- "Our project contributes an open, reproducible evaluation of context-aware false-alarm reduction for voice-triggered emergency detection." (after experiments)

**We MAY NOT claim:**
- "Nobody has ever built a context-aware emergency detection system." (False — E-Sentinel, e112 exist [S22][S23].)
- "We invented voice SOS." (False — bSafe, Chilla, Crash Detection [S5][S6][S10].)
- "Our system is 95% accurate." (Untrue until measured; use **NOT YET MEASURED**.)
- "AI distress detection is new." (False — Halilaj et al. [S14].)

---

## Final novelty statement (conservative, defensible) — PROPOSED

> "HerShield does not claim to invent a new safety feature. Each individual component (SOS, GPS, voice trigger, speech recognition, context awareness) already exists. Our contribution is an **open, small-scale, measured comparison** of a full-pipeline design — keyword detection → utterance-level emergency-intent classification → context-aware explainable risk scoring → deterministic safety policy — with explicit false-alarm/false-miss metrics on our own labeled dataset. All results will be labeled as OUR EXPERIMENTAL RESULT, and every limitation will be reported."
