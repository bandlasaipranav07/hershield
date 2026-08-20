# HerShield — Experiment Plan

**Status:** Draft v1 · **Date:** 2026-08-20
**Global rule:** Every result row currently reads **NOT YET MEASURED**. We fill them in only after we actually run the experiments. Nothing here is a result.

---

## 1. Core research question

> **Can contextual information reduce false emergency triggers compared with simple voice-keyword detection?**

We compare four models on the SAME test data. We do **not** assume Model D is best. We test, then we report.

## 2. The four models

| Model | Signals used | What it is |
|---|---|---|
| **A — Keyword baseline** | Keyword only | If the transcript contains a trigger word/phrase (e.g., "help", "emergency", "attack", "threaten"), classify as emergency. This mirrors how many basic SOS systems work. |
| **B — Voice + emergency intent** | Keyword + utterance intent | Full transcribed utterance → intent classifier (emergency vs not). Ignores a plain "help" inside a benign sentence. |
| **C — Intent + context** | B + context | Add structured context: safety mode (active/inactive), journey status (on a journey / deviated), location context, time of day. |
| **D — All signals** | C + additional | Add extra signals we actually have (e.g., repeated triggers, prior state within the session, ASR confidence). Motion/audio-emotion only if implemented — see risk matrix. |

## 3. Metrics and why they matter

| Metric | Definition | Why it matters for us |
|---|---|---|
| **Accuracy** | (TP + TN) / total | General health check. Misleading when classes are imbalanced, so we report it but don't rely on it alone. |
| **Precision** | TP / (TP + FP) | "Of the times we raised an emergency, how many were real?" **Low precision = annoying/false alarms** = the exact problem we're attacking. |
| **Recall (sensitivity)** | TP / (TP + FN) | "Of real emergencies, how many did we catch?" **Low recall = missed emergencies** = the worst failure for a safety system. |
| **F1-score** | 2·P·R / (P + R) | Balanced single number when precision and recall trade off. |
| **False-positive rate (FPR)** | FP / (FP + TN) | Fraction of non-emergencies we wrongly escalated. **This is our headline metric** for the research question. |
| **False-negative rate (FNR)** | FN / (FN + TP) | Fraction of real emergencies we missed. Safety-critical. |
| **Detection latency** | time from end of utterance → final risk decision | For "real time" claims. Measured on our test machine; reported as OUR EXPERIMENTAL RESULT, not a product claim. |

Definitions follow standard binary classification (see Wikipedia, "False positives and false negatives" — referenced in [SOURCES.md](./SOURCES.md) notes; this is a general mathematical definition, not a proprietary claim).

## 4. Dataset requirements

Constraints:
- **Small but controlled**: for a college project, ~200–400 labeled utterances is realistic and defensible. Bigger is better but only if quality holds.
- **Class balance**: aim ~50% emergency / 50% non-emergency in the labeled set, so accuracy is meaningful. (ASSUMPTION: balance improves interpretability for a small dataset.)
- **Coverage of confusion cases**: must include many utterances with trigger words that are NOT emergencies ("Help me with my assignment", "Can you help me find my phone?").
- **No standard public dataset found** for personal-safety emergency-intent text classification (see SOURCES.md "cannot confirm" section). Therefore we create our own.

## 5. Data collection plan (PROPOSED)

1. **Utterance bank** (text level, MVP): team writes/collects English utterances grouped by label:
   - `EMERGENCY`: "Help! Someone is following me." / "Please help me, I'm being threatened." / "Someone is attacking me." etc.
   - `NOT_EMERGENCY_TRIGGER_WORD`: "Help me carry this." / "Help me with my assignment." / "Can you help me find my phone?" etc.
   - `NOT_EMERGENCY_CLEAN`: ordinary conversational sentences with no trigger words.
   - `AMBIGUOUS`: "I need help" (alone), "Someone help me, my bag is stuck."
2. **Audio collection** (for the full pipeline): each team member records a subset of these utterances (multiple takes, different accents/pace). We own the recordings; we will disclose that these are recorded by our team, not a professional corpus.
3. **Noise augmentation** (for robustness tests): we may add background noise programmatically (public-domain noise clips) — clearly documented if used. This is our own augmentation, not a claim about external datasets.
4. **Labels**: 3-person majority labeling with disagreements recorded. We keep an agreement log so labeling quality is transparent.

## 6. Splits

- **Training** ~70% of utterances (used to fit the classifier)
- **Validation** ~15% (used to tune thresholds)
- **Test** ~15% (held out, used ONCE, only at the end)

Rules:
- No speaker appears in both train and test for the same class (ASSUMPTION: prevents the model memorizing a voice/team member's phrasing).
- The same procedure for all four models, so comparisons are fair.
- Test set is locked before any tuning. (ASSUMPTION: standard ML hygiene; prevents accidental overfitting.)

## 7. Baselines and proposed models

- **Model A (baseline)**: deterministic keyword rule. Implementation: regex / phrase list over the transcript. This is our "do the simple thing first" baseline.
- **Model B**: TF-IDF + Logistic Regression (simple, fast, explainable) — MVP choice. If time permits, try a small transformer (e.g., fine-tuned DistilBERT) as a comparison. (ASSUMPTION: LR is the right MVP; a transformer is a stretch goal.)
- **Model C**: Model B output + rule-based context features combined in the risk engine (see [RISK_ENGINE.md](./RISK_ENGINE.md)). Context features are deterministic (safety mode, journey deviation, etc.).
- **Model D**: Model C + any additional implemented signals (e.g., repeated utterance within a session, ASR confidence). Added only if we implement them.

Every model outputs a **risk level** (LOW / MEDIUM / HIGH) via a threshold on a score. The threshold is tuned on validation data and reported.

## 8. Evaluation methodology

1. Run each model on the identical test set.
2. Record the full confusion matrix (TP/FP/TN/FN) for each.
3. Compute all metrics in section 3 using the standard formulas (we will show the arithmetic, e.g., `Precision = TP/(TP+FP) = 100/120 = 83.3%`, with actual numbers filled in).
4. Report **paired comparisons**: A vs B shows the value of intent; B vs C shows the value of context; C vs D shows the value of extra signals.
5. Report **per-condition breakdown**: clean speech, noisy, different speakers, etc. (ties to TESTING.md).

## 9. What we will NOT do

- We will not compare against vendor accuracy figures (they use different datasets — unfair).
- We will not report "our model is 95% accurate" unless a full experiment produced it with the arithmetic shown.
- We will not extrapolate our small-dataset results to the real world without saying so.

## 10. Expected risks to validity (honest)

| Risk | Mitigation |
|---|---|
| Small dataset → noisy metrics | Report confidence intervals (simple Wilson interval or bootstrap) or state that sample size is too small; we prefer honesty over precision theater. |
| Team members wrote the examples → optimistic phrasing | Test also with a small held-out set of examples written by people *not* in the team (friends) if possible. |
| ASR errors feeding the classifier | Report metrics on BOTH (a) gold transcripts and (b) ASR output, so we see where errors come from. |
| Threshold tuning on validation overfits | Lock test set; tune only on validation; report both. |

## 11. Result template (fill in after experiments)

```
OUR EXPERIMENTAL RESULT — test set size: ____ (EMERGENCY: ___, NON: ___)

                     A(Keyword)   B(Intent)   C(+Context)   D(+Signals)
Accuracy            NOT YET MEASURED
Precision           NOT YET MEASURED
Recall              NOT YET MEASURED
F1                  NOT YET MEASURED
FPR                 NOT YET MEASURED
FNR                 NOT YET MEASURED
Latency (ms)        NOT YET MEASURED
```
