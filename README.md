# OjekAI — Daily AI Assistant for Ojek (Ride-Hailing) Drivers

**#BuildHybridAI 2026 — Google / Devpost hackathon entry (Web / Chrome)**

OjekAI helps Indonesian ojek drivers keep track of every trip and understand
their day. Trips are logged offline, each trip gets an instant one-sentence
summary, and the day ends with a full report plus practical insights.

## Why hybrid inference fits this app

The two AI features have opposite shapes, so each one uses the compute that
suits it — that is the honest hybrid story:

| Feature | Prompt shape | Inference mode | Why |
|---|---|---|---|
| Per-trip summary | Short, single-turn text | `PREFER_ON_DEVICE` | Gemini Nano answers instantly, offline, for free. Falls back to cloud when Nano is unavailable. |
| Daily report | Long document (all trips + totals + insights) | `PREFER_IN_CLOUD` | Long-form reasoning belongs on the cloud Gemini model. |

Every AI result in the UI carries a badge showing which path actually ran —
`On-device · Gemini Nano`, `Cloud · Gemini`, or `Demo` — read from the
Firebase AI Logic property `response.inferenceSource` (JS SDK v12.5.0+),
never guessed.

## Features

- **Log trips offline** — date, time, pickup, destination, fare (Rp),
  distance (km), notes. Stored in `localStorage`, so logging works with no
  connection at all.
- **Summarize a trip (on-device)** — one click, one or two sentences in
  Bahasa Indonesia, including whether the fare was fair for the distance.
- **Daily report (cloud)** — totals plus three insights: busiest hour, most
  profitable route, and one practical tip for tomorrow.
- **Visible hybrid status** — the header shows Firebase connection state and
  the on-device model availability (`LanguageModel.availability()`).

## Tech stack

- Vite 8 + React 19 + TypeScript
- Firebase JS SDK 13 (`firebase/ai` — Firebase AI Logic, Gemini Developer
  API backend, no billing required)
- No backend of our own; no paid services.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc + vite build
npm run preview    # serve the production build
```

Without Firebase config the app runs in clearly-labelled **DEMO mode**: the
full UI flow works end-to-end with a local deterministic summarizer, and
every AI result is badged `DEMO`. To enable real AI, follow
[FIREBASE_SETUP.md](FIREBASE_SETUP.md) (create a free Firebase project,
enable AI Logic with the Gemini Developer API, copy the web config into
`.env`).

## Project structure

```
src/
  App.tsx          # UI: trip form, trip list, daily report, status
  App.css
  lib/
    trips.ts       # Trip model + localStorage persistence
    firebase.ts    # Firebase init from env (+ App Check debug in dev)
    ai.ts          # Hybrid inference: on-device summary, cloud report, demo fallback
```

## License

Apache-2.0 — see [LICENSE](LICENSE).
