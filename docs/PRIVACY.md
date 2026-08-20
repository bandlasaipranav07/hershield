# HerShield — Privacy

**Status:** Draft v1 · **Date:** 2026-08-20

**Golden rule:** We do not claim this design is "perfectly private". We document exactly what data exists, why, where it lives, how long, who can see it, and when it is transmitted. Every choice is a trade-off and we say which trade-off we made.

---

## 1. Privacy goal (PROPOSED)

> Normal operation should avoid continuously uploading raw audio, location history, or personal conversations.
> Audio is processed locally where possible and discarded if no emergency is detected.

**Feasibility note (RESEARCH-BACKED):** on-device processing is realistic — whisper.cpp runs transcription fully locally (no outbound network calls) [S13]; Picovoice Porcupine advertises fully on-device audio processing [S12]; E-Sentinel performs its decision logic on-device for privacy [S22]. So local-first is achievable in principle. BUT our MVP is a web app, which limits how local we can be (see section 5).

## 2. Target architecture (PROPOSED)

```
Device (browser)
  │  user grants microphone permission
  ▼
Local buffer (in-browser, not uploaded during normal operation)
  ▼
Speech recognition (MVP: browser SpeechRecognition API; see section 5)
  ▼
Emergency detected? (intent classifier + risk engine)
   ├─ NO  → discard temporary audio/transcript, keep nothing
   └─ YES → send MINIMUM required info to backend (structured JSON, not raw audio)
                ▼
          Supabase backend (contacts, event, location)
                ▼
          Emergency contacts notified (email/SMS/push - simulated in MVP)
```

## 3. Data inventory (be explicit)

| Data | Collected? | Why | Stored where | Retention | Who can access |
|---|---|---|---|---|---|
| Profile (name, email/phone) | Yes | authentication, contact identity | Supabase (auth + profiles table) | Until account deletion | user + app admins (team) |
| Emergency contacts | Yes | to notify in an emergency | Supabase | Until user edits/deletes | user only (RLS) |
| Location (during SOS or journey) | Only when an event/journey is active | to send help | Supabase event record | Deleted after event closure or N days (see policy) | user, contacts who are notified, team admins |
| Raw audio | No (normal operation) | — | none | n/a | n/a |
| **Transcript** | Only if emergency detected (or user-requested test) | intent classification + explainability | Supabase event record (may store summary only) | Same as event | contacts/responders in an active event |
| ASR confidence / classifier scores | Yes, with the event | explainability + evaluation | Supabase event record | Same as event | team + user |
| User session / trigger history | Minimal in-memory only | repeated-trigger signal | RAM only, not persisted | End of session | n/a |

**Key decision (PROPOSED):** In the MVP we do NOT store raw audio at all. We store transcript text or a short summary only when an emergency event is created.

## 4. When data is transmitted

| Trigger | What goes to the server |
|---|---|
| Normal listening (no keyword) | Nothing. All processing in-browser. |
| Keyword detected, but intent LOW / no escalation | Nothing persisted. In-browser discard. |
| MEDIUM (confirmation flow) | Nothing until the user fails to confirm. |
| HIGH escalation or manual SOS | Structured JSON: user id, event type, risk level, transcript (or summary), location, timestamp. |

**Documented limitation:** "Nothing transmitted" depends on the speech recognizer. The browser SpeechRecognition API performs recognition using the browser's built-in service (per MDN docs [S26]), which for Chrome historically involves Google's cloud service. This is a real privacy leak we must document and show in the UI ("Speech is processed by your browser's speech service"). We will display a one-time consent screen.

## 5. MVP reality vs. privacy goal (honest)

Because the MVP is a **web app**:

1. SpeechRecognition in browsers is a built-in feature; the transcript is produced by the browser, and for Chrome this is cloud-based. **This conflicts with the "never upload audio" ideal** — we disclose it. It does not upload to OUR servers; it may go to the browser vendor. We cannot confirm the exact retention by browser vendors; we will show a consent screen and keep the audio capture window short.
2. A fully private offline design requires on-device ASR (whisper.cpp on-device [S13]) or a native app — this is **Future Work**, not MVP.
3. Because of (1), our **privacy contribution for the MVP is limited to**: never storing raw audio, minimal structured transmission, discard-on-no-emergency, and clear user consent. That is honest but modest.

## 6. Data protection controls (SECURITY-RELEVANT)

| Control | Where | Detail |
|---|---|---|
| Auth | Supabase Auth [S24] | Email/password. No auth = no data access. |
| Row Level Security (RLS) | Supabase | Every table policy written so users only read/write their own rows. Contacts table: user owns their rows. Event table: event owner + authorized responder role. We will write these policies with tests. |
| Secrets | NEVER in frontend code | Supabase anon key is public by design; service-role key stays server-side. No API keys committed to git (see SECURITY section of proposal). |
| Location | Permission-gated | Geolocation only used when a journey/SOS is active; user can revoke. |
| Audio | Not stored | See table above. |
| Deletion | Implemented | User "delete account" removes profile + their events (hard delete after grace period). Retention policy documented and enforced by a background job or manual script (MVP). |
| Abuse prevention | Rate limiting / cooldown | Repeated automated SOS spam: we add a cooldown between notifications (PROPOSED, defined in TESTING.md). |

## 7. Consent and transparency (PROPOSED)

- First-run screen explains: (1) when the microphone is on, (2) that audio is not stored by us, (3) that the browser's speech service may be involved, (4) what happens in a HIGH escalation.
- Settings screen: toggle voice detection ON/OFF, edit contacts, delete account.
- Every escalated event shows the user exactly what was sent (the JSON payload, human-readable).

## 8. What we explicitly DO NOT claim

- "End-to-end encrypted." (Not implemented; we would need to say how, with keys managed where.)
- "Zero data leaves the device." (False for the MVP browser recognizer.)
- "Compliant with GDPR/DPDP." (We aim to document sensible practices; claiming compliance requires a legal review we cannot do.)