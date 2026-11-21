// Hybrid inference for OjekAI, built on Firebase AI Logic (Web SDK).
//
// Design (honest hybrid routing, exactly the pattern from the official
// Firebase AI Logic hybrid docs):
//   - Short per-trip summaries -> PREFER_ON_DEVICE. A one-sentence summary is
//     a small, single-turn text task that Gemini Nano handles instantly,
//     offline, for free. Falls back to the cloud model when Nano is absent.
//   - The daily report (long document: totals + all trips + insights) ->
//     PREFER_IN_CLOUD. Long-form reasoning belongs on the cloud model.
// The SDK reports which path actually ran via `response.inferenceSource`
// ('ON_DEVICE' | 'IN_CLOUD', JS SDK v12.5.0+) and the UI shows that badge
// next to every AI result, so the hybrid behaviour is visible and verifiable.
//
// When no Firebase config is present (see firebase.ts) the app runs in DEMO
// mode: a local, deterministic summarizer produces the same shapes of output
// and every result is badged "DEMO". Demo output is never presented as a
// real model call.

import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { InferenceMode } from 'firebase/ai';
import type { GenerativeModel } from 'firebase/ai';
import { getFirebaseApp, isFirebaseConfigured } from './firebase';
import { formatRp } from './trips';
import type { InferenceSource, Trip } from './trips';

export interface AiResult {
  text: string;
  source: InferenceSource;
}

// The hybrid SDK's GenerativeModel already includes initializeDeviceModel();
// it must be called after a user gesture and before the first on-device
// request so Chrome can download/prepare Gemini Nano.
let onDeviceModel: GenerativeModel | undefined;
let cloudModel: GenerativeModel | undefined;
let deviceModelReady = false;

function getModels():
  | { onDevice: GenerativeModel; cloud: GenerativeModel }
  | undefined {
  const app = getFirebaseApp();
  if (!app) return undefined;
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  if (!onDeviceModel) {
    onDeviceModel = getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
    });
  }
  if (!cloudModel) {
    cloudModel = getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_IN_CLOUD,
    });
  }
  return { onDevice: onDeviceModel, cloud: cloudModel };
}

/** Ask Chrome's Prompt API whether Gemini Nano is available on this device. */
export async function checkOnDeviceAvailability(): Promise<string> {
  const lm = (
    window as unknown as {
      LanguageModel?: { availability: () => Promise<string> };
    }
  ).LanguageModel;
  if (!lm || typeof lm.availability !== 'function') return 'unavailable';
  try {
    return await lm.availability();
  } catch {
    return 'unavailable';
  }
}

function readInferenceSource(
  response: unknown,
  fallback: InferenceSource,
): InferenceSource {
  const value = (response as { inferenceSource?: unknown } | null)
    ?.inferenceSource;
  if (value === 'ON_DEVICE' || value === 'IN_CLOUD') return value;
  return fallback;
}

/** Prepare the on-device model after a user gesture (button click). */
async function ensureDeviceModel(model: GenerativeModel): Promise<void> {
  if (deviceModelReady) return;
  try {
    await model.initializeDeviceModel();
    deviceModelReady = true;
  } catch {
    // Model download/prepare failed — the SDK falls back to cloud.
    deviceModelReady = false;
  }
}

/** Short trip summary — prefers the on-device model (Gemini Nano). */
export async function summarizeTrip(trip: Trip): Promise<AiResult> {
  const models = getModels();
  if (!models) return { text: demoTripSummary(trip), source: 'DEMO' };

  await ensureDeviceModel(models.onDevice);
  const prompt =
    `Ringkas trip ojek ini dalam 1-2 kalimat Bahasa Indonesia. ` +
    `Dari ${trip.pickup} ke ${trip.destination}, tarif ${formatRp(trip.fare)}, ` +
    `jarak ${trip.distanceKm} km, jam ${trip.time}.` +
    (trip.note ? ` Catatan driver: ${trip.note}.` : ``) +
    ` Sebutkan apakah tarifnya wajar untuk jaraknya.`;
  const result = await models.onDevice.generateContent(prompt);
  return {
    text: result.response.text(),
    source: readInferenceSource(result.response, 'ROUTED'),
  };
}

/** Daily report — prefers the cloud model (long document, deeper reasoning). */
export async function buildDailyReport(
  trips: Trip[],
  dateLabel: string,
): Promise<AiResult> {
  const models = getModels();
  if (!models) return { text: demoDailyReport(trips, dateLabel), source: 'DEMO' };

  const totalFare = trips.reduce((s, t) => s + t.fare, 0);
  const totalKm = trips.reduce((s, t) => s + t.distanceKm, 0);
  const lines = trips
    .map(
      (t, i) =>
        `${i + 1}. ${t.time} ${t.pickup} -> ${t.destination}, ${formatRp(t.fare)}, ${t.distanceKm} km${t.note ? ` (${t.note})` : ''}`,
    )
    .join('\n');
  const prompt =
    `Buatkan laporan harian driver ojek untuk ${dateLabel} dalam Bahasa Indonesia.\n` +
    `Total: ${trips.length} trip, pemasukan ${formatRp(totalFare)}, jarak ${totalKm.toFixed(1)} km.\n` +
    `Daftar trip:\n${lines}\n\n` +
    `Berikan: (1) ringkasan hari ini dalam 2 kalimat, ` +
    `(2) 3 insight — jam tersibuk, rute paling menguntungkan, dan satu saran praktis untuk besok ` +
    `(hemat BBM / pilih jam / pilih area). Tulis dengan jelas dan ringkas.`;
  const result = await models.cloud.generateContent(prompt);
  return {
    text: result.response.text(),
    source: readInferenceSource(result.response, 'IN_CLOUD'),
  };
}

// ---------------------------------------------------------------------------
// DEMO mode — deterministic local summaries, used only when no Firebase
// config is present. Every demo result is badged DEMO in the UI.
// ---------------------------------------------------------------------------

function demoTripSummary(trip: Trip): string {
  const perKm = trip.distanceKm > 0 ? trip.fare / trip.distanceKm : 0;
  const verdict =
    perKm >= 3000
      ? 'Tarif per km bagus.'
      : perKm >= 2000
        ? 'Tarif per km cukup.'
        : 'Tarif per km rendah — pertimbangkan nego lain kali.';
  return (
    `Trip ${trip.pickup} → ${trip.destination} (${trip.distanceKm} km, ${formatRp(trip.fare)}, ` +
    `${formatRp(Math.round(perKm))}/km). ${verdict}` +
    (trip.note ? ` Catatan: ${trip.note}.` : '')
  );
}

function demoDailyReport(trips: Trip[], dateLabel: string): string {
  if (trips.length === 0) {
    return `Belum ada trip pada ${dateLabel}. Catat trip dulu, lalu buat laporan harian.`;
  }
  const totalFare = trips.reduce((s, t) => s + t.fare, 0);
  const totalKm = trips.reduce((s, t) => s + t.distanceKm, 0);
  const best = [...trips].sort(
    (a, b) =>
      (b.distanceKm > 0 ? b.fare / b.distanceKm : 0) -
      (a.distanceKm > 0 ? a.fare / a.distanceKm : 0),
  )[0];
  const hourCount = new Map<string, number>();
  for (const t of trips) {
    const h = t.time.slice(0, 2);
    hourCount.set(h, (hourCount.get(h) ?? 0) + 1);
  }
  const busiest = [...hourCount.entries()].sort((a, b) => b[1] - a[1])[0];
  return (
    `Laporan ${dateLabel}: ${trips.length} trip, pemasukan ${formatRp(totalFare)}, ` +
    `jarak total ${totalKm.toFixed(1)} km.\n\n` +
    `• Jam tersibuk: pukul ${busiest[0]}.00 (${busiest[1]} trip).\n` +
    `• Rute paling menguntungkan: ${best.pickup} → ${best.destination} ` +
    `(${formatRp(Math.round(best.distanceKm > 0 ? best.fare / best.distanceKm : 0))}/km).\n` +
    `• Saran besok: prioritaskan jam dan area seperti rute terbaik hari ini, ` +
    `dan tolak trip dengan tarif di bawah Rp 2.000/km bila ada pilihan lain.`
  );
}

export function isAiConfigured(): boolean {
  return isFirebaseConfigured();
}
