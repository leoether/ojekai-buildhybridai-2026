// End-to-end smoke test for OjekAI in headless Chromium (Playwright).
// Runs against `vite preview` on http://localhost:4173.
// Verifies: form -> save trip -> on-device summarize (demo) -> daily report.
// Also probes Chrome's Prompt API (LanguageModel.availability) for the
// on-device path. This file is a dev-only test, not shipped in the build.
import { chromium } from 'playwright-core';

const CHROME_PATH = `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  // 1. Prompt API availability (on-device path probe)
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  const lm = await page.evaluate(async () => {
    const w = window;
    if (!w.LanguageModel) return 'LanguageModel undefined';
    try {
      return await w.LanguageModel.availability();
    } catch (e) {
      return `availability() threw: ${e instanceof Error ? e.message : String(e)}`;
    }
  });
  console.log('LanguageModel.availability():', lm);

  // 2. App renders
  const header = await page.textContent('h1');
  console.log('H1:', header);

  // 3. Add a trip
  await page.fill('input[placeholder*="Terminal"]', 'Terminal Sambaliung');
  await page.fill('input[placeholder*="Bandara"]', 'Bandara Kalimarau');
  await page.fill('input[placeholder*="25000"]', '25000');
  await page.fill('input[placeholder*="8.5"]', '12.5');
  await page.fill('input[placeholder*="macet"]', 'macet di lampu merah');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.trip-route', { timeout: 5000 });
  const route = await page.textContent('.trip-route');
  console.log('Trip saved:', route);

  // 4. Summarize (demo mode — no Firebase config)
  await page.click('button.btn.device');
  await page.waitForSelector('.trip-summary p', { timeout: 10000 });
  const summary = await page.textContent('.trip-summary p');
  const badge = await page.textContent('.trip-summary .badge');
  console.log('Summary badge:', badge);
  console.log('Summary text:', summary);

  // 5. Daily report (demo mode)
  await page.click('button.btn.cloud');
  await page.waitForSelector('.report-text', { timeout: 10000 });
  const report = await page.textContent('.report-text');
  const reportBadge = await page.textContent('.report .badge');
  console.log('Report badge:', reportBadge);
  console.log('Report text:', report);

  // 6. localStorage persistence
  const stored = await page.evaluate(
    () => localStorage.getItem('ojekai.trips.v1'),
  );
  console.log('localStorage trips saved:', stored ? JSON.parse(stored).length : 0);

  console.log('Console errors:', errors.length ? errors : 'none');
  await browser.close();
}

main().catch((e) => {
  console.error('SMOKE TEST FAILED:', e);
  process.exit(1);
});
