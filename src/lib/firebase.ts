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
import { getToken, initializeAppCheck } from 'firebase/app-check';
import type { AppCheck } from 'firebase/app-check';

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
// Promise for the App Check initialization (resolves to the instance, or
// undefined when no site key is configured). Diagnostics await this so
// they test the real initialized provider instead of racing it.
let appCheckReady: Promise<AppCheck | undefined> | undefined;

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

  // App Check attestation: the console enforces App Check for AI Logic,
  // and ojekai-web is registered with the Fraud Defense (reCAPTCHA
  // Enterprise) provider — so the app MUST use ReCaptchaEnterpriseProvider
  // with the Enterprise site key. (The old reCAPTCHA v3 Classic provider
  // is deprecated and its registration is disabled in the console; a v3
  // token against an Enterprise registration is rejected with 401.)
  const siteKey = import.meta.env
    .VITE_FIREBASE_RECAPTCHA_SITE_KEY as string | undefined;
  if (siteKey) {
    appCheckReady = import('firebase/app-check')
      .then(({ ReCaptchaEnterpriseProvider }) => {
        if (!app) return undefined;
        try {
          return initializeAppCheck(app, {
            provider: new ReCaptchaEnterpriseProvider(siteKey),
            isTokenAutoRefreshEnabled: true,
          });
        } catch {
          // App Check already initialized by another call — no instance
          // is reachable here, so diagnostics report it as uninitialized.
          return undefined;
        }
      })
      .catch(() => undefined);
  } else {
    appCheckReady = Promise.resolve(undefined);
  }

  return app;
}

/**
 * Diagnostic: try to fetch a fresh App Check token and report the outcome.
 * Returns 'OK' when a token is issued, otherwise throws an Error whose
 * message carries the SDK error code (e.g. 'app-check/recaptcha-error').
 * This distinguishes "no token could be obtained in the browser" from
 * "a token was issued but the AI endpoint rejected it (401)".
 */
export async function checkAppCheckToken(): Promise<string> {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return 'tidak dikonfigurasi';
  const appCheck = await (appCheckReady ?? Promise.resolve(undefined));
  if (!appCheck) return 'tidak diinisialisasi (tanpa site key?)';
  const token = await getToken(appCheck, false);
  return token.token ? 'OK' : 'token kosong';
}
