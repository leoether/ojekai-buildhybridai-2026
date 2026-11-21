import { useEffect, useMemo, useState } from 'react';
import {
  buildDailyReport,
  checkOnDeviceAvailability,
  isAiConfigured,
  summarizeTrip,
} from './lib/ai';
import type { AiResult } from './lib/ai';
import { checkAppCheckToken } from './lib/firebase';
import {
  formatRp,
  loadTrips,
  newTripId,
  nowTimeString,
  saveTrips,
  todayString,
} from './lib/trips';
import type { InferenceSource, Trip } from './lib/trips';
import './App.css';

function sourceLabel(source: InferenceSource): string {
  switch (source) {
    case 'ON_DEVICE':
      return 'On-device · Gemini Nano';
    case 'IN_CLOUD':
      return 'Cloud · Gemini';
    case 'DEMO':
      return 'Demo (tanpa Firebase)';
    case 'ROUTED':
      return 'Hybrid (dipilih SDK)';
  }
}

function SourceBadge({ source }: { source: InferenceSource }) {
  return <span className={`badge badge-${source.toLowerCase()}`}>{sourceLabel(source)}</span>;
}

export default function App() {
  const [trips, setTrips] = useState<Trip[]>(() => loadTrips());
  const [date, setDate] = useState(todayString());
  const [time, setTime] = useState(nowTimeString());
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [fare, setFare] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [note, setNote] = useState('');
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [report, setReport] = useState<AiResult | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [error, setError] = useState('');
  const [deviceStatus, setDeviceStatus] = useState('mengecek…');
  const [appCheckStatus, setAppCheckStatus] = useState('mengecek…');

  const configured = isAiConfigured();
  const today = todayString();
  const todayTrips = useMemo(
    () => trips.filter((t) => t.date === today),
    [trips, today],
  );
  const todayFare = todayTrips.reduce((s, t) => s + t.fare, 0);
  const todayKm = todayTrips.reduce((s, t) => s + t.distanceKm, 0);
  const sortedTrips = useMemo(
    () =>
      [...trips].sort((a, b) =>
        `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
      ),
    [trips],
  );

  useEffect(() => {
    let alive = true;
    checkOnDeviceAvailability().then((status) => {
      if (alive) setDeviceStatus(status);
    });
    if (configured) {
      checkAppCheckToken()
        .then((status) => {
          if (alive) setAppCheckStatus(status);
        })
        .catch((err: unknown) => {
          if (alive)
            setAppCheckStatus(
              `gagal: ${err instanceof Error ? err.message : 'error tidak diketahui'}`,
            );
        });
    } else {
      setAppCheckStatus('mode demo');
    }
    return () => {
      alive = false;
    };
  }, [configured]);

  useEffect(() => {
    saveTrips(trips);
  }, [trips]);

  function addTrip(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const fareNum = Number(fare);
    const kmNum = Number(distanceKm);
    if (!pickup.trim() || !destination.trim()) {
      setError('Isi titik jemput dan tujuan dulu.');
      return;
    }
    if (!Number.isFinite(fareNum) || fareNum <= 0) {
      setError('Tarif harus angka lebih dari 0.');
      return;
    }
    if (!Number.isFinite(kmNum) || kmNum <= 0) {
      setError('Jarak harus angka lebih dari 0 km.');
      return;
    }
    const trip: Trip = {
      id: newTripId(),
      date,
      time,
      pickup: pickup.trim(),
      destination: destination.trim(),
      fare: Math.round(fareNum),
      distanceKm: kmNum,
      note: note.trim(),
    };
    setTrips((prev) => [trip, ...prev]);
    setPickup('');
    setDestination('');
    setFare('');
    setDistanceKm('');
    setNote('');
    setTime(nowTimeString());
  }

  async function handleSummarize(trip: Trip) {
    setError('');
    setSummarizingId(trip.id);
    try {
      const result = await summarizeTrip(trip);
      setTrips((prev) =>
        prev.map((t) =>
          t.id === trip.id
            ? { ...t, summary: result.text, summarySource: result.source }
            : t,
        ),
      );
    } catch (err) {
      setError(
        `Gagal merangkum trip: ${err instanceof Error ? err.message : 'error tidak diketahui'}`,
      );
    } finally {
      setSummarizingId(null);
    }
  }

  async function handleDailyReport() {
    setError('');
    setReportBusy(true);
    try {
      const result = await buildDailyReport(todayTrips, today);
      setReport(result);
    } catch (err) {
      setError(
        `Gagal membuat laporan: ${err instanceof Error ? err.message : 'error tidak diketahui'}`,
      );
    } finally {
      setReportBusy(false);
    }
  }

  function deleteTrip(id: string) {
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="app">
      <header className="header">
        <h1>OjekAI</h1>
        <p className="subtitle">
          Asisten harian driver ojek — ringkasan trip instan di perangkat,
          laporan harian di cloud.
        </p>
        <p className="subtitle-en">
          Daily AI assistant for ride-hailing drivers. Hybrid inference with
          Firebase AI Logic: Gemini Nano on-device for instant trip summaries,
          cloud Gemini for the daily report.
        </p>
        <div className="status-row">
          <span className={`pill ${configured ? 'pill-ok' : 'pill-warn'}`}>
            Firebase: {configured ? 'terhubung' : 'mode demo'}
          </span>
          <span className="pill">On-device (Gemini Nano): {deviceStatus}</span>
          <span className="pill">App Check: {appCheckStatus}</span>
        </div>
        {!configured && (
          <p className="demo-note">
            Mode demo: belum ada konfigurasi Firebase, jadi ringkasan dibuat
            oleh peringkas lokal dan diberi label DEMO. Ikuti{' '}
            <code>FIREBASE_SETUP.md</code> untuk mengaktifkan AI sungguhan.
          </p>
        )}
      </header>

      {error && <div className="error">{error}</div>}

      <main>
        <section className="card">
          <h2>Catat trip</h2>
          <form onSubmit={addTrip} className="trip-form">
            <label>
              Tanggal
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <label>
              Jam
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </label>
            <label>
              Titik jemput
              <input
                type="text"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                placeholder="cth: Terminal Sambaliung"
                required
              />
            </label>
            <label>
              Tujuan
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="cth: Bandara Kalimarau"
                required
              />
            </label>
            <label>
              Tarif (Rp)
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={fare}
                onChange={(e) => setFare(e.target.value)}
                placeholder="cth: 25000"
                required
              />
            </label>
            <label>
              Jarak (km)
              <input
                type="number"
                min="0.1"
                step="0.1"
                inputMode="decimal"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="cth: 8.5"
                required
              />
            </label>
            <label className="full">
              Catatan (opsional)
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="cth: macet di lampu merah, penumpang bawa koper besar"
              />
            </label>
            <button type="submit" className="btn primary full">
              Simpan trip
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Hari ini ({today})</h2>
          <div className="stats">
            <div>
              <strong>{todayTrips.length}</strong>
              <span>trip</span>
            </div>
            <div>
              <strong>{formatRp(todayFare)}</strong>
              <span>pemasukan</span>
            </div>
            <div>
              <strong>{todayKm.toFixed(1)} km</strong>
              <span>jarak tempuh</span>
            </div>
          </div>
          <button
            type="button"
            className="btn cloud"
            onClick={handleDailyReport}
            disabled={reportBusy || todayTrips.length === 0}
          >
            {reportBusy ? 'Membuat laporan…' : 'Buat laporan harian (cloud)'}
          </button>
          {report && (
            <div className="report">
              <div className="report-head">
                <strong>Laporan harian</strong>
                <SourceBadge source={report.source} />
              </div>
              <p className="report-text">{report.text}</p>
            </div>
          )}
          {todayTrips.length === 0 && (
            <p className="muted">Belum ada trip hari ini.</p>
          )}
        </section>

        <section className="card">
          <h2>Semua trip ({trips.length})</h2>
          {sortedTrips.length === 0 ? (
            <p className="muted">
              Belum ada trip. Catat trip pertamamu di atas — data tersimpan di
              perangkat, tetap bisa dicatat saat offline.
            </p>
          ) : (
            <ul className="trip-list">
              {sortedTrips.map((trip) => (
                <li key={trip.id} className="trip">
                  <div className="trip-main">
                    <div className="trip-route">
                      {trip.pickup} → {trip.destination}
                    </div>
                    <div className="trip-meta">
                      {trip.date} · {trip.time} · {trip.distanceKm} km ·{' '}
                      {formatRp(trip.fare)}
                      {trip.note ? ` · ${trip.note}` : ''}
                    </div>
                    {trip.summary && (
                      <div className="trip-summary">
                        <SourceBadge
                          source={trip.summarySource ?? 'ROUTED'}
                        />
                        <p>{trip.summary}</p>
                      </div>
                    )}
                  </div>
                  <div className="trip-actions">
                    <button
                      type="button"
                      className="btn device"
                      onClick={() => handleSummarize(trip)}
                      disabled={summarizingId === trip.id}
                    >
                      {summarizingId === trip.id
                        ? 'Merangkum…'
                        : 'Rangkum (on-device)'}
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => deleteTrip(trip.id)}
                    >
                      Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card how">
          <h2>Cara kerja hybrid-nya</h2>
          <ol>
            <li>
              <strong>Rangkum trip → on-device.</strong> Prompt pendek, sekali
              jalan, ideal untuk Gemini Nano di Chrome. Cepat, gratis, dan
              jalan walau offline. Kalau Nano tidak tersedia, SDK otomatis
              fallback ke cloud.
            </li>
            <li>
              <strong>Laporan harian → cloud.</strong> Dokumen panjang dengan
              semua trip + insight butuh penalaran lebih dalam, jadi dipakai
              model cloud Gemini.
            </li>
            <li>
              Setiap hasil AI menampilkan badge sumbernya (
              <em>On-device</em>, <em>Cloud</em>, atau <em>Demo</em>) dari
              properti <code>response.inferenceSource</code> milik Firebase AI
              Logic — bukan tebakan.
            </li>
          </ol>
        </section>
      </main>

      <footer className="footer">
        OjekAI — #BuildHybridAI 2026 · Firebase AI Logic hybrid inference ·
        data trip tersimpan lokal di perangkat.
      </footer>
    </div>
  );
}
