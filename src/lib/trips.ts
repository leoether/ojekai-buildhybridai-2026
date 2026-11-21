// Trip log data model for OjekAI.
// Trips are stored locally in the browser (localStorage) so the app keeps
// working fully offline — a real requirement for drivers on the road.

export type InferenceSource = 'ON_DEVICE' | 'IN_CLOUD' | 'DEMO' | 'ROUTED';

export interface Trip {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24h) */
  time: string;
  pickup: string;
  destination: string;
  /** fare in Indonesian Rupiah */
  fare: number;
  distanceKm: number;
  note: string;
  summary?: string;
  summarySource?: InferenceSource;
}

const STORAGE_KEY = 'ojekai.trips.v1';

export function loadTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Trip[];
  } catch {
    return [];
  }
}

export function saveTrips(trips: Trip[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  } catch {
    // Storage full / private mode — the in-memory list still works.
  }
}

export function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowTimeString(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export function newTripId(): string {
  return `trip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
