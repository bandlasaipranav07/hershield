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

Copy `app/.env.example` to `app/.env` and fill in your Supabase values (needed from Phase 2 onward):

```bash
cp .env.example .env
```

Never commit `.env`.

## Current state

Phase 1 scaffold only: a single page with a DEMO/SIMULATION banner. No features yet.