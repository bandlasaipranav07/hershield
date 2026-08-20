# HerShield — Competitive Analysis

**Status:** Draft v1 · **Research date:** 2026-08-20
**Rule followed:** Nothing is called "novel" here. If a feature exists, we say it exists. Sources are in [SOURCES.md](./SOURCES.md) and referenced by row number like `[S6]`.

---

## 1. What we compared

We analyzed products and research across the 8 areas you listed:

1. Women-safety applications
2. Voice-triggered safety systems
3. AI distress/detection systems
4. Context-aware emergency systems
5. Multimodal safety research
6. False-alarm reduction approaches
7. Emergency-response architectures
8. Privacy-preserving approaches

Below is the comparison table. It has 15 rows (we exceeded the minimum of 10).

## 2. Comparison table

Legend for "Existing?": **Yes** = the product/paper already contains this capability.

| # | Product / Paper | Feature | Source (row in SOURCES.md) | Existing? | How it works | Limitations | Potential HerShield difference |
|---|---|---|---|---|---|---|---|
| 1 | **bSafe** | Voice-activated SOS, live streaming, auto audio/video recording, fake call, guardian network | [S6] (Google Play listing) | Yes | SOS triggered by touch or voice; on trigger, guardians get live stream + recording + location | Trigger is essentially "activate SOS" — no automated risk assessment of what was said; voice activation is a trigger, not a classifier | We distinguish **trigger** (keyword/wake word) from **intent classification** (is this utterance really an emergency?) |
| 2 | **Hollie Guard** | Hold-button SOS, Meeting Timer, Journey monitoring, evidence capture, privacy control | [S7] (official site) | Yes | Hold 3–6 s; camera+mic record to contacts; journey start/end with arrival alerts | Manual activation; journey is simple start/end, not deviation detection | We add **journey-deviation signal** as a *context input* to the risk engine (PROPOSED) |
| 3 | **Himmat Plus (Delhi Police)** | Shake / power-button SOS, video recording, SMS to contacts, police control-room callback | [S1][S2][S3] (Govt of India) | Yes | Shake or power button x? triggers SMS + video + alert to police portal | A parliamentary committee concluded it "failed to serve its purpose" due to low adoption (complex registration, no Hindi) [S4] | Lesson for us: **simplicity + onboarding matters as much as features**. Not a claim of feature novelty |
| 4 | **Shake2Safety / Chilla** | Shake or power-button (x4) / scream activation | [S5] (Transport Scotland typology) | Yes | Hardware-gesture or scream triggers SOS | Gesture triggers are binary; no contextual verification; screams in TV/music can trigger | Our context-aware confirmation flow is intended to reduce exactly this class of false trigger (PROPOSED; to be tested) |
| 5 | **Apple Emergency SOS (incl. via Satellite)** | Hardware-button SOS, satellite emergency text when off-grid, emergency contacts notification | [S8][S9] | Yes | Hold power+volume → SOS; off-grid → guided satellite text to PSAP/relay with location | Requires iPhone 14+; satellite needs clear sky; user must complete a questionnaire — works when user is *able* to interact | We cannot match satellite hardware; we focus on **automated detection + risk scoring** as an assist, not a replacement for manual SOS |
| 6 | **Apple Crash Detection** | Automatic severe-crash detection → call emergency services | [S10][S11] | Yes | Motion sensors (up to 256 Gs) + barometer + GPS + microphone; 10 s countdown before calling | Well-documented false positives (roller coasters, skiing) [S29]; officials reported ~75% of calls false alarms in one county [S30] | Our **context-aware confirmation** and **explainable risk score** are a response to the false-alarm problem Crash Detection exposed — we will measure, not assume |
| 7 | **Noonlight / Life360 / Kitestring** | Professional monitoring center / family location sharing / SMS check-in | [S31] (3rd-party comparison) | Yes | Human or timed check-in verification | US-focused (Noonlight); privacy trade-off of continuous location sharing; manual check-ins can be forgotten | We evaluate a **privacy-first local processing + minimum-data transmission** posture (PROPOSED) |
| 8 | **E-Sentinel (research)** | Offline-first, on-device context-aware SOS + fall detection + decision engine | [S22] (SoftwareX 2026) | Yes | On-device sensor + voice trigger + context decision engine; 10 s auto-SOS; human-in-the-loop confirmation | English-only keyword set; fall-focused | Its **on-device decision engine + human-in-the-loop** design is the closest published architecture to our proposal; we differentiate by making the **risk score explainable** and by **experimentally comparing intent+context vs keyword-only** (PROPOSED) |
| 9 | **e112 (research)** | Context-aware emergency communication platform with operator dashboard | [S23] (arXiv 2026) | Yes | Smartphone app + cloud backend (Firebase, Twilio, Maps) + operator dashboard | Disaster-emergency focus; cloud-dependent; SOS is user-initiated | We share the **dashboard + cloud backend** pattern, but add **automated voice-intent detection + risk engine** upstream of the SOS (PROPOSED) |
| 10 | **Halilaj et al. (CEUR 2025)** | AI distress detection from speech (transformer-based) | [S14] | Yes | MFCC/spectrogram features → CNN or Wav2Vec2/Whisper classifier on audio; API built; on-device (TFLite) planned | Still research; mobile integration "under development"; single modality (audio) | We use **ASR → text intent classification** (not direct audio emotion) for the MVP because it is simpler and explainable; audio-emotion stays in Future Work |
| 11 | **Noise-Agnostic Multitask Whisper (arXiv 2025)** | Call-for-help detection with reduced false alarms in noise | [S15] | Yes | Fine-tuned Whisper + extra noise-classification head to suppress noise-induced false alarms | Requires model fine-tuning; noise-aware training data needed | Directly validates our core research question (false alarms are a real problem). We test a simpler route first: **ASR + text classifier + context**, with noise as a test condition |
| 12 | **Samsung "To Wake-up or Not to Wake-up"** | Keyword false-alarm reduction via successive refinement | [S20] | Yes | Multi-stage rejection to cut false wake-ups | Focused on wake-word false alarms, not safety intent | Their insight (don't fire on the first match) informs our **two-stage gate**: keyword gate → intent classifier → risk engine (PROPOSED) |
| 13 | **Apple Voice Trigger (Interspeech 2022)** | Personalized voice trigger to cut false rejections | [S21] | Yes | Speaker embeddings from enrollment utterances; similarity scoring | Needs enrollment; reduces FRR (false rejection), different problem from false acceptance | We borrow the lesson that **matching confidence matters**; our risk engine will use classifier confidence, not hard matches (PROPOSED) |
| 14 | **SER with attention (PMC 2023)** | Speech emotion recognition (fear/anger/etc.) at ~90% accuracy on benchmark sets | [S18] | Yes | CNN+LSTM attention on MFCC features | Lab datasets (RAVDESS/SAVEE/TESS); general emotions, not safety intent | We will NOT build audio-emotion for the MVP; documented as Future Work with this paper as starting reference |
| 15 | **Keyword spotting + post-processing (2004)** | Post-processing to cut keyword false alarms by up to ~80% on a baseline without losing detections | [S20-adjacent; note: not fully re-verified] | Yes | Filler models + confidence normalization + anti-word post-processing | Older HMM-era method | Confirms false-alarm reduction is a long-studied problem; our **confidence-threshold + context gating** follows the same philosophy with modern tools (PROPOSED) |

> **Note on row 15:** The "up to 80%" reduction figure comes from a 2004 paper abstract (Smidl & Trmal) summarized in a secondary source. We list it as **reported figure**, not verified-by-us. We will not rely on it in our own claims.

## 3. Honest summary of what exists

Research-backed statements (each maps to a source above):

- **SOS + GPS + emergency contacts + SMS alerts**: exists in basically every app (bSafe, Hollie Guard, Himmat, Shake2Safety...). [S5][S6][S7][S3]
- **Voice-triggered SOS**: exists (bSafe voice activation; Chilla scream). [S5][S6]
- **Crash / fall automatic detection**: exists (Apple Crash Detection; E-Sentinel). [S10][S22]
- **AI distress detection from speech audio**: exists in research (Halilaj et al.; SER literature). [S14][S18]
- **Context-aware emergency platforms**: exist in research (E-Sentinel, e112). [S22][S23]
- **False-alarm reduction**: an active, long-studied problem (Samsung, Apple, multitask Whisper, KWS post-processing). [S20][S21][S15]
- **On-device / privacy-first ASR**: exists (whisper.cpp, Porcupine, E-Sentinel's on-device engine). [S13][S12][S22]

**Conclusion:** None of our individual components is new. Our claim must be about the **combination, the experiment, and honest measurement** — see [NOVELTY_MATRIX.md](./NOVELTY_MATRIX.md).

## 4. Gaps / opportunities we actually see (PROPOSED)

1. **An explainable risk output** shown to the user/responders (a small per-signal breakdown, like the example in RISK_ENGINE.md). We found no consumer safety app that shows "why did you get this score". Cannot confirm there is none, but we found none in our sources.
2. **A head-to-head experiment**: keyword-only vs intent vs intent+context on a held-out labeled set, reported with false-positive/negative rates. Most product pages do not publish this; research papers measure model accuracy but not this exact ablation. This is the core of [EXPERIMENT_PLAN.md](./EXPERIMENT_PLAN.md).
3. **A conservative safety policy layer** that never lets an LLM decide alone (deterministic gates). [S22] uses human-in-the-loop; we formalize this as a written policy.

## 5. Things we could NOT confirm

- Any **consumer women-safety app that performs utterance-level "emergency intent classification"** (as opposed to keyword trigger) and **publishes** its false-positive rate. If you find one, we will add it here.
- Independent verification of vendor benchmark claims (e.g., Picovoice 97.1%). [S12 note]
- Official published accuracy/false-alarm statistics for most safety apps. We will label our own as **OUR EXPERIMENTAL RESULT**.
