# HerShield — app (React + TypeScript + Vite)

Frontend for the HerShield women-safety emergency assistance system.

## Requirements

- Node.js 18+ (developed with Node 24)
- npm

## Setup

```bash
cd app
npm install
```

## Run

```bash
npm run dev
```

Open the URL Vite prints (default http://localhost:5173).

## Test

```bash
npm test          # run once
npm run test:watch  # watch mode
```

## Build / lint

```bash
npm run build   # type-check + production build
npm run lint    # oxlint
```

## Environment variables

Copy `.env.example` to `.env` inside `app/` and set values for your chosen mode:

```bash
cp .env.example .env
```

Never commit `.env`. `VITE_DEMO_MODE=true` is accepted only when Vite is running in development and valid Supabase configuration is absent. Production builds do not enable the demo identity. Email/password login requires valid Supabase URL and anon key values.

## Current state

The app includes login/register, contacts, Home, Listen, Dashboard, and Testing screens; risk scoring, browser microphone capture, a seed intent classifier, local incident storage, Supabase data helpers, and A–D fixture comparisons.

## Boundaries and limitations

- Emergency contacts are never contacted by this app; notification rows and UI results are simulations.
- The microphone runs only after consent and explicit ARM while the page is open. Browser SpeechRecognition may process audio through the browser vendor's service.
- Audio analysis uses approximate energy/peak/spectral-centroid heuristics. It is not a validated distress detector and does not implement Log-Mel features.
- The fixture dashboard uses 14 hand-written synthetic examples and a hand-written seed model. Its metrics are not real-world accuracy or a trained-model evaluation.
- Local incidents are tagged to the active user and remain visible offline. Supabase sync is attempted only for the signed-in owner when Supabase is configured. Live cloud behavior has not been verified in this checkout.
- Check the root `docs/PRIVACY.md` and `docs/ARCHITECTURE.md` before treating the demo as suitable for sensitive or real emergency use.
