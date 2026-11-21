// Firebase initialization for OjekAI.
//
// The Firebase web config is PUBLIC client configuration (apiKey etc. are
// identifiers, not secrets) but it is still loaded from environment variables
// so no project-specific values are ever committed to the repo. Copy
// `.env.example` to `.env` and fill it in after creating the Firebase
// project — see FIREBASE_SETUP.md for the exact steps.
//
// When no config is present the app runs in DEMO mode: the UI works
// end-to-end with a local, clearly-labelled demo summarizer, and every AI
// result is badged "DEMO" so nobody mistakes it for a real model call.

import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { initializeAppCheck } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env
    .VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env
    .VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

let app: FirebaseApp | undefined;

export function getFirebaseApp(): FirebaseApp | undefined {
  if (!isFirebaseConfigured()) return undefined;
  if (app) return app;

  // Local development: use the App Check debug provider so the enforced
  // App Check from the AI Logic guided setup does not block localhost.
  // The debug token printed in the browser console must be registered in
  // Firebase console > App Check > Manage debug tokens (see
  // FIREBASE_SETUP.md). This only runs in `vite dev`, never in production.
  if (import.meta.env.DEV) {
    (globalThis as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
      true;
  }

  app = initializeApp(firebaseConfig);

  // App Check attestation is optional here: when the console enforces App
  // Check AND a reCAPTCHA site key is configured, initialize it; otherwise
  // the Firebase AI Logic calls still work while enforcement is off.
  // (The guided AI Logic setup in the console turns enforcement on — at
  // that point set VITE_FIREBASE_RECAPTCHA_SITE_KEY and register the debug
  // token for localhost.)
  const siteKey = import.meta.env
    .VITE_FIREBASE_RECAPTCHA_SITE_KEY as string | undefined;
  if (siteKey) {
    void import('firebase/app-check')
      .then(({ ReCaptchaV3Provider }) => {
        if (app) {
          try {
            initializeAppCheck(app, {
              provider: new ReCaptchaV3Provider(siteKey),
              isTokenAutoRefreshEnabled: true,
            });
          } catch {
            // App Check already initialized or provider rejected — non-fatal.
          }
        }
      })
      .catch(() => {
        // app-check module unavailable — non-fatal for demo/dev.
      });
  }

  return app;
}
