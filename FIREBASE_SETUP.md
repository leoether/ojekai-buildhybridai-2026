# Firebase setup for OjekAI (needed for real AI — 10 minutes, free)

The app works without this (DEMO mode), but real hybrid inference needs a
Firebase project. Everything below is **free** — the Gemini Developer API
backend needs no billing and no card. Do NOT create anything paid.

## Step 1 — Create a Firebase project

1. Open https://console.firebase.google.com/ and sign in with Leo's Google
   account (the same one used for Devpost).
2. Click **Add project** (or **Create a project**), name it e.g. `ojekai`.
3. When asked about Google Analytics: **disable it** (not needed for AI
   Logic).
4. Wait for the project to be created.

## Step 2 — Enable Firebase AI Logic (guided setup)

1. In the Firebase console, go to **AI Services → AI Logic** (left menu).
2. Click **Get started**. The guided workflow sets up the required APIs.
3. When asked for a **Gemini API provider**, choose **Gemini Developer
   API** (free to start; Vertex AI would require billing — do NOT choose
   it).
4. Finish the workflow. This stage **automatically enforces Firebase App
   Check for AI Logic** — that is expected; Step 4 below covers local
   development.

## Step 3 — Register the web app and copy the config

1. In the Firebase console: **Project settings → Your apps → Add app →
   Web** (`</>`).
2. Nickname: `ojekai-web`. (Firebase Hosting setup is NOT required.)
3. Copy the `firebaseConfig` values shown.
4. In the repo, copy `.env.example` to `.env` and paste the values:

```bash
cp .env.example .env
```

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

`.env` is git-ignored — it never gets committed. (The web apiKey is a
public client identifier, not a secret, but keeping it in `.env` keeps the
repo project-agnostic.)

## Step 4 — App Check debug token (for localhost only)

Because the AI Logic setup enforces App Check, local development needs a
debug token:

1. Run `npm run dev` and open the app at http://localhost:5173.
2. Open the browser DevTools console. You will see a line like:

```
AppCheck debug token: "123a4567-b89c-12d3-e456-789012345678".
You will need to safelist it in the Firebase console for it to work.
```

3. In the Firebase console: **Security → App Check → Apps tab** → find
   `ojekai-web` → overflow menu (⋮) → **Manage debug tokens** → add the
   token from the console.
4. Reload the app. AI calls from localhost now pass App Check.

(The app sets `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` automatically
in dev builds only — see `src/lib/firebase.ts`.)

## Step 5 — Enable Gemini Nano in Chrome (for the on-device path)

On-device inference needs Chrome on Desktop v139+:

1. Update Chrome (chrome://settings/help).
2. Open `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and
   set it to **Enabled**, then restart Chrome.
3. Optional: pre-download the model — open DevTools console and run
   `await LanguageModel.availability()` (expect `available`,
   `downloading`, or `downloadable`), then `await LanguageModel.create()`
   if it says `downloadable`.

If Nano is not available on a machine, the app still works: the Firebase
AI Logic SDK falls back to the cloud model automatically, and the badge
shows `Cloud · Gemini`.

## Step 6 — Verify

1. `npm run dev`, log a trip, click **Rangkum (on-device)** — the badge
   should read **On-device · Gemini Nano** (or **Cloud · Gemini** if Nano
   is absent).
2. Click **Buat laporan harian (cloud)** — the badge should read
   **Cloud · Gemini**.
3. `npm run build` must pass before submitting.

## Costs

- Firebase AI Logic with the Gemini Developer API: text inference is free
  within the free-tier usage limits (per the hackathon page). No billing
  account, no card.
- If you ever need more quota (e.g. image models), the contest offers a
  **Google Account Quota** request form — Sprint 3 (final) closes Wed
  Nov 25, 10:00 AM PT. Not needed for OjekAI's text-only features.
