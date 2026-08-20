# HerShield — Sources

**Status:** Draft v1
**Date of research:** 2026-08-20
**Research by:** HerShield team with OpenCode assistant

This file lists every external claim used anywhere in the HerShield documentation.

## How to read this file

- Every row = one verifiable claim.
- "Claim supported" tells you exactly what the source verifies.
- If a claim has no row here, treat it as **ASSUMPTION** or **PROPOSED**, not as verified fact.
- All numbers reported by other people are **reported figures from a source**, NOT our experimental results. Our own results (once we run experiments) will be labeled **OUR EXPERIMENTAL RESULT**.

---

## A. Government / official sources

| # | Title | Organization | Date | URL | Claim supported |
|---|-------|--------------|------|-----|-----------------|
| 1 | Union Home Minister launches Delhi Police' women's safety mobile app 'Himmat' | Press Information Bureau, Ministry of Home Affairs, Government of India | 2015-01-01 | https://pib.gov.in/newsite/PrintRelease.aspx?relid=114267 | Himmat app launched 1 Jan 2015; app connects women to police; police control room can call back; SMS alerts sent to registered contacts. |
| 2 | Himmat Plus portal | Delhi Police | n.d. (portal) | http://himmat.delhipolice.nic.in/ | Official download portal for Himmat/Himmat Plus on Android, iOS, Windows. |
| 3 | Himmat Plus features | Directorate of Civil Defence, Govt. of NCT of Delhi | n.d. | https://civildefence.delhi.gov.in/himmar_plus.php | Feature list: shake-to-alert, power-button alert, soft-button alert, police control room callback, video recording, SMS alerts to family/friends, location+time alert on phone and portal. |
| 4 | Himmat App for women safety failed to serve purpose: parliamentary panel | The Hindu (reporting a Parliamentary Standing Committee finding) | 2018 | https://www.thehindu.com/news/cities/Delhi/himmat-app-for-women-safety-failed-to-serve-purpose-parliamentary-panel/article23039353.ece | An official committee concluded the app "failed to serve the purpose"; low adoption was linked to a complex registration process and lack of Hindi. |
| 5 | There's an App for That: Women's Safety on Public Transport in Scotland — Mapping the typologies of personal safety apps | Transport Scotland (Scottish Government transport agency) | 2023 (page; sources within dated 2023) | https://www.transport.gov.scot/publication/there-s-an-app-for-that-women-s-safety-on-public-transport-in-scotland/mapping-the-typologies-of-personal-safety-apps/ | Activation methods across apps: shaking, screaming, power button presses, going off a planned route (e.g., Shake2Safety = power button x4; Chilla = scream-activated; bSafe = voice activation incl. screaming with auto live-stream; Hollie Guard = shake). Alerts go to friends/family, volunteers, control rooms, or emergency services. |

## B. Product / vendor official pages

| # | Title | Organization | Date | URL | Claim supported |
|---|-------|--------------|------|-----|-----------------|
| 6 | bSafe — Never Walk Alone (Google Play listing) | bSafe / Bipper | n.d. (listing current as of research date) | https://play.google.com/store/apps/details?id=com.bipper.app.bsafe | bSafe features: voice activation (SOS alarm by touch or voice), live streaming to guardians, automatic audio/video recording on SOS, fake call, guardians list. |
| 7 | Hollie Guard — Personal Safety App (official site) | Hollie Guard | site current 2022-08-02 snapshot | https://hollieguard.com/ | Hold button 3–6 s triggers alert + camera recording to contacts; Meeting Timer; Evidence Gathering; Journey monitoring with arrival alerts; user privacy control over location sharing. |
| 8 | Emergency SOS via Satellite Executive Overview (PDF) | Apple Inc. | n.d. (feature launched 2022) | https://www.apple.com/government/docs/resources/E_FINAL_Emergency_SOS_via_Satellite_Executive_Overview.pdf | Emergency SOS via Satellite: works when off-grid; text to PSAP or relay center; location provided; message-length-dependent send time. |
| 9 | Use Emergency SOS via satellite on your iPhone | Apple Support | 2026-07-22 | https://support.apple.com/en-us/101573 | Feature available on iPhone 14 or later; text emergency services when off the grid. |
| 10 | Crash Detection Executive Overview (PDF) | Apple Inc. | n.d. (feature launched 2022) | https://www.apple.com/government/docs/resources/E_FINAL_Crash_Detection_Executive_Overview.pdf | Crash Detection uses motion sensors (up to 256 Gs), barometer, GPS, and microphone; validated on real-world and simulated crashes; designed to detect severe crashes. |
| 11 | Use Crash Detection on iPhone or Apple Watch to call for help | Apple Support | n.d. | https://support.apple.com/en-us/104959 | Crash Detection works on iPhone 14+ / Watch Series 8+; designed for severe front/side/rear collisions and rollovers. |
| 12 | Porcupine Wake Word: On-Device Keyword Spotting | Picovoice | n.d. (vendor page) | https://picovoice.ai/products/voice/wake-word/ | On-device keyword spotting; benchmark claims 97.1% detection at 1 false alarm per 10 hours at 10 dB SNR (vendor-reported); claims audio never leaves device; tunable sensitivity. NOTE: vendor benchmark, not independent. |
| 13 | whisper.cpp | ggml-org (GitHub) | n.d. (repo current) | https://github.com/ggml-org/whisper.cpp | Local/offline Whisper port in C/C++; supports iOS/Android/WebAssembly/Linux/Windows/macOS; MIT-licensed; runs without network calls. |

## C. Research papers

| # | Title | Authors / Venue | Date | URL | Claim supported |
|---|-------|--------------|------|-----|-----------------|
| 14 | AI-Driven Real-Time Distress Detection Through Speech Recognition for Emergency Response Systems | M. Halilaj, E. Myrto, A.F. Dragoni — CEUR Workshop Proceedings Vol-4044 (RTA-CSIT 2025) | 2025-09-23 | https://ceur-ws.org/Vol-4044/paper03.pdf | Research on AI distress detection from speech; compares MFCC vs spectrogram features and CNN vs Wav2Vec2/Whisper; reports transformer models outperform CNNs, especially in noise and multilingual speech; plans on-device deployment via TensorFlow Lite for privacy and low latency. |
| 15 | Noise-Agnostic Multitask Whisper Training for Reducing False Alarm Errors in Call-for-Help Detection | arXiv:2501.11631 | 2025 (posted) | https://arxiv.org/html/2501.11631v1 | Call-for-help detection using off-the-shelf ASR (Whisper); real-world deployments saw increased false alarms due to noise; proposes multitask noise-classification head to reduce false alarms; validated with recruited participants. |
| 16 | Detecting Clinically Relevant Emotional Distress and Functional Impairment in Children and Adolescents: Protocol for an Automated Speech Analysis Algorithm Development Study | JMIR Research Protocols 12, DOI 10.2196/46970 (via NSF PAR) | 2023 | https://par.nsf.gov/biblio/10437974 | Transformer-based emotion model reached 86% precision / 79% recall for binary (high/low) emotional intensity on test set; CNN generalized across 4 emotions reached 83% precision and recall. Context: clinical distress, not personal-safety. |
| 17 | Multiscale Contextual Learning for Speech Emotion Recognition in Emergency Call Center Conversations | arXiv:2308.14894 | 2023 | https://ar5iv.labs.arxiv.org/html/2308.14894 | Uses French CEMO corpus (real emergency call-center conversations) to integrate conversation context into SER; shows context helps in emergency conversations. |
| 18 | Speech Emotion Recognition Using Attention Model | PMC10049636 (peer-reviewed journal) | 2014 (article); repository snapshot | https://pmc.ncbi.nlm.nih.gov/articles/PMC10049636 | Attention-based CNN-LSTM model reached ~90% average test accuracy on a custom RAVDESS+SAVEE+TESS dataset (8 emotion classes). Context: general SER, not safety. |
| 19 | Speech Commands: A Dataset for Limited-Vocabulary Speech Recognition | Pete Warden, Google — arXiv:1804.03209 | 2018 | https://arxiv.org/abs/1804.03209 | Google Speech Commands dataset: ~105,829 single-word utterances (v0.02), 35 word classes, CC BY 4.0, for keyword spotting with low false-positive goals. |
| 20 | To Wake-up or Not to Wake-up: Reducing Keyword False Alarm by Successive Refinement | Samsung Research / ICASSP-adjacent paper | 2023 | https://research.samsung.com/research-papers/To-Wake-up-or-Not-to-Wake-up-Keyword-False-Alarm-reduction-by-Succesive-Refinement | Keyword spotting false alarms are a recognized hard problem; proposes successive refinement to reduce false alarms. |
| 21 | Improving Voice Trigger Detection with Metric Learning | Apple Machine Learning Research (Interspeech 2022) | 2022 | https://machinelearning.apple.com/research/improving-voice-trigger | Voice-trigger false rejection reduced by 38% (relative) using personalized embeddings vs speaker-independent baseline. On-device voice triggers must balance privacy, latency, accuracy, power. |
| 22 | E-Sentinel: A context-aware emergency response platform with offline SOS support and neutrosophic fall detection | H. Patel, J. Edward, I. Kandasamy — SoftwareX (open access, Elsevier) | 2026-06 | https://www.sciencedirect.com/science/article/pii/S2352711026001251 | On-device, offline-first emergency platform: fall detection + voice-triggered SOS + context-aware decision engine; auto-SOS after 10 s if no user response; human-in-the-loop confirmation to avoid false escalations; claims interpretable, no pre-training, privacy-sensitive on-device decision logic. |
| 23 | e112: A Context-Aware Mobile Emergency Communication Platform Leveraging Smartphone Sensing and Cloud Services | K. Ioannidou, M.D. Dikaiakos, A. Stassopoulou — arXiv:2604.20342 (IDRC 2025) | 2026-04-22 | https://arxiv.org/html/2604.20342v1 | Research prototype: cross-platform app + cloud backend (Firebase, Twilio, Google Maps) + operator dashboard for context-aware emergency communication (SOS, incident reports, alerts). |

## D. Technical documentation (stack / API decisions)

| # | Title | Organization | Date | URL | Claim supported |
|---|-------|--------------|------|-----|-----------------|
| 24 | Supabase documentation (Auth, PostgreSQL, Row Level Security) | Supabase | n.d. (docs current) | https://supabase.com/docs | Supabase = open-source Postgres backend with auth and RLS; SQL relational model; can be self-hosted. |
| 25 | Firebase documentation (Auth, Firestore/Realtime DB, Security Rules, Offline) | Google Firebase | n.d. (docs current) | https://firebase.google.com/docs | Firebase = Google BaaS; NoSQL Firestore + Realtime Database; security rules; built-in offline persistence; FCM notifications. |
| 26 | Web Speech API | MDN Web Docs (Mozilla) | n.d. (docs current) | https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API | Browser speech recognition (SpeechRecognition) API exists; recognition is performed by the browser's underlying service. |
| 27 | Geolocation API | MDN Web Docs (Mozilla) | n.d. (docs current) | https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API | Browser Geolocation API for GPS/position in web apps; requires user permission. |
| 28 | OpenAI Whisper (model + paper) | OpenAI | 2022 | https://github.com/openai/whisper | Whisper open-source ASR model, MIT license, trained on 680,000 hours of multilingual audio. |

## E. Context / analysis sources (used with caution)

| # | Title | Organization | Date | URL | Claim supported |
|---|-------|--------------|------|-----|-----------------|
| 29 | Apple's Crash Detection causing too many false positives? | Intego blog | 2023-01-12 | https://www.intego.com/mac-security-blog/is-apples-crash-detection-causing-too-many-false-positives/ | Media-reported false positives (roller coasters, skiing) for Crash Detection; describes 10 s countdown + sound design. Secondary source. |
| 30 | Apple's Crash Detection feature again praised by first responders despite false alarms | 9to5Mac | 2024-01-03 | https://9to5mac.com/2024/01/03/apple-crash-detection-praise-false-alarms/ | Reports Maury County (TN) officials stating Crash Detection calls were false alarms "about 75% of the time" in their experience; first responders still prefer false calls over missed emergencies. Secondary source (officials quoted). |
| 31 | Best Personal Safety Apps 2026 comparison | CallSafe blog | 2026-04-02 | https://callsafe.app/blog/best-personal-safety-apps-2026 | Third-party comparison of Hollie Guard / bSafe / Noonlight / Life360 / Kitestring / CallSafe with pricing and positioning. Secondary source for feature positioning only. |

---

## Notes on reliability

- Rows 1–13: primary / official sources.
- Rows 14–23: peer-reviewed or arXiv research.
- Rows 24–28: official technical documentation.
- Rows 29–31: secondary sources — used only to support qualitative claims (e.g., "false alarms are a real, reported problem"), never to support specific accuracy numbers we rely on.

## Things we could NOT verify

- **"A public standard dataset for 'emergency intent' text classification"** — we did not find a widely used public benchmark dataset specifically for personal-safety emergency-intent classification of spoken utterances. We therefore plan to build our own small labeled dataset. If you can point us to one, we will cite it.
- **Independent, third-party verification of Picovoice's 97.1% benchmark figure** — the figure is vendor-reported on their own page (row 12). We treat it as a vendor claim, not independent fact.
- **Official published false-alarm statistics for most women-safety SOS apps** — most vendors do not publish these. We will measure our own with **OUR EXPERIMENTAL RESULT** labels.
