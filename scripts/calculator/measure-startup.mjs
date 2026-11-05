/**
 * Run against two `next start` servers, using an existing Playwright installation:
 * PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/calculator/measure-startup.mjs BEFORE_URL AFTER_URL
 * Does not install packages, modify the app or use a personal browser profile.
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { calculatorThrottleProxy } from './throttle-proxy.mjs';

const [before, after] = process.argv.slice(2);
if (!before || !after) throw new Error('Pass BEFORE_URL and AFTER_URL from production next start servers.');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
// Match Chrome DevTools Slow 4G (including its request-level adjustment factors):
// https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/core/sdk/NetworkManager.ts#L654-L665
const network = { offline: false, downloadThroughput: 180000, uploadThroughput: 84375, latency: 562.5, connectionType: 'cellular4g' };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const beforeProxy = await calculatorThrottleProxy(before, network);
const afterProxy = await calculatorThrottleProxy(after, network);
const results = [];
console.log('Browser:', browser.version());

async function trial(base, sample) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditionsByRule', { matchedNetworkConditions: [{ urlPattern: `${base}/calculator/*`, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, { ...network, urlPattern: '' }] });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // The app owns readiness; the harness only observes click -> validated ready.
  await page.addInitScript(() => {
    window.__calculatorTiming = {};
    document.addEventListener('click', event => {
      if (event.target.closest?.('.qb-calculator-restore')) window.__calculatorTiming = { click: performance.now() };
    }, true);
    window.addEventListener('message', event => {
      if (event.origin === location.origin && event.source === document.querySelector('.qb-calculator-frame')?.contentWindow && event.data?.source === 'plumi-calculator' && event.data.type === 'ready') {
        window.__calculatorTiming.ready = performance.now();
      }
    });
  });
  async function open(kind, lead = 0) {
    const button = page.getByRole('button', { name: 'Calculator', exact: true });
    await button.waitFor();
    if (lead) {
      await button.hover();
      await page.waitForTimeout(lead);
    }
    // Programmatic activation avoids accidentally granting cold trials a hover
    // or focus head start; the DOM click still runs the real React handler.
    await button.evaluate(element => element.click());
    await page.waitForFunction(() => Number.isFinite(window.__calculatorTiming.ready), undefined, { timeout: 30000 });
    const timing = await page.evaluate(() => ({ ms: +(window.__calculatorTiming.ready - window.__calculatorTiming.click).toFixed(1), resources: performance.getEntriesByType('resource').filter(r => r.name.includes('/calculator/')).map(r => ({ url: r.name, duration: r.duration, bytes: r.transferSize, encoded: r.encodedBodySize })) }));
    const workerResources = await Promise.all(page.workers().map(worker => worker.evaluate(() => performance.getEntriesByType('resource').map(r => ({ url: r.name, duration: r.duration, transferred: r.transferSize, encoded: r.encodedBodySize })))));
    const frameResources = await Promise.all(page.frames().filter(frame => frame.url().includes('/calculator/')).map(frame => frame.evaluate(() => performance.getEntriesByType('resource').map(r => ({ url: r.name, duration: r.duration, transferred: r.transferSize, encoded: r.encodedBodySize })))));
    if (kind === 'cold') {
      const roms = [...timing.resources, ...workerResources.flat(), ...frameResources.flat()].filter(resource => resource.url.includes('core.dat'));
      if (!roms.some(rom => rom.duration >= 4000)) throw new Error('ROM was not network-throttled; reject this measurement.');
    }
    return { sample, kind, ...timing, workerResources, frameResources };
  }
  const route = process.env.WARM_BANK ? base + '/question-bank/aqa-gcse-maths' : base;
  await page.goto(route, { waitUntil: 'networkidle', timeout: 60000 });
  if (process.env.WARM_BANK) await page.waitForTimeout(8000);
  const untouched = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.includes('/calculator/')).length);
  const cold = await open('cold');
  await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
  if (process.env.WARM_BANK) await page.waitForTimeout(8000);
  const repeat = await open('repeat visit (HTTP cache retained)');
  await context.close();
  return { untouched, measurements: [cold, repeat] };
}
try {
  for (const [label, base] of [['before', beforeProxy.url], ['after', afterProxy.url]].filter(([label]) => !process.env.ONLY_LABEL || process.env.ONLY_LABEL === label)) {
    for (let sample = 1; sample <= Number(process.env.SAMPLES || 3); sample++) {
      const result = await trial(base, sample);
      results.push({ label, base, ...result });
      console.log(JSON.stringify({ label, sample, preClickCalculatorRequests: result.untouched, timings: result.measurements.map(({ kind, ms }) => ({ kind, ms })) }));
    }
  }
  fs.writeFileSync(process.env.OUTPUT || '/tmp/calculator-startup-results.json', JSON.stringify({ warmBankLeadMs: process.env.WARM_BANK ? 8000 : 0, browser: browser.version(), network, cpuSlowdown: 4, results }, null, 2));
} finally {
  await browser.close();
  await beforeProxy.close();
  await afterProxy.close();
}
