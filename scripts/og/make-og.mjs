#!/usr/bin/env node
/* Renders assets/og.png — the link-preview card — by running the site's own
   reaction-diffusion simulation and screenshotting a frame of it.
   The card is therefore a real state of the page, not an illustration of one.

   Needs Playwright and a local server:
     python3 -m http.server 8777 &
     node scripts/og/make-og.mjs [--port 8777] [--out assets/og.png]
*/
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : d; };
const port = arg('--port', '8777');
const out = join(ROOT, arg('--out', 'assets/og.png'));

const exe = process.env.PLAYWRIGHT_CHROMIUM ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});

await page.goto(`http://localhost:${port}/scripts/og/template.html`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ogReady === true, { timeout: 30000 });
await page.screenshot({ path: out, type: 'png' });
await browser.close();
console.log(`wrote ${out}`);
