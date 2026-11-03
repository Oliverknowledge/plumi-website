/**
 * Screenshots of the question bank with crops served from local folders (no crops are kept in the repo's public/).
 *   node scripts/dark-questions/shoot.js <base url> <theme: light|dark> <out prefix> [--path /question-bank/...] [--phone] [--pool dir,dir]
 * Every /papers-local/bank/<id>-<kind>.webp the page asks for is answered from the pool, picked by a hash of the id, so a page of
 * parts shows a spread of real and synthetic layouts. `kinds` of requests: qp, ms, stem.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const [base, theme, out] = args;
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const phone = args.includes("--phone");
const pageUrl = opt("--path", "/question-bank/aqa-a-level-physics/particles");
const dirs = (opt("--pool", "") || "").split(",").filter(Boolean);
const msDirs = (opt("--mspool", "") || "").split(",").filter(Boolean);
const list = ds => ds.flatMap(d => fs.readdirSync(d).filter(f => /\.(webp|png)$/.test(f) && !f.startsWith("sheet")).sort().map(f => path.join(d, f)));
const qp = list(dirs), ms = list(msDirs.length ? msDirs : dirs);
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, deviceScaleFactor: phone ? 2 : 1, hasTouch: phone, reducedMotion: args.includes("--reduced") ? "reduce" : "no-preference" });
  await ctx.addInitScript(t => { try { localStorage.setItem("plumi-theme", t); } catch {} }, theme);
  await ctx.route("**/papers-local/**", route => {
    // --nocors: a page that may not read the picture (a preview, a build off tryplumi.app): its CORS fetches fail
    if (args.includes("--nocors") && route.request().resourceType() === "fetch") return route.abort();
    const url = new URL(route.request().url());
    const m = /\/bank\/(.+)-(qp|ms|stem)\.webp$/.exec(url.pathname);
    if (!m) return route.fulfill({ status: 404, body: "" });
    const pool = m[2] === "ms" ? ms : qp;
    const f = pool[hash(m[1]) % pool.length];
    route.fulfill({ status: 200, contentType: f.endsWith(".png") ? "image/png" : "image/webp", body: fs.readFileSync(f), headers: { "cache-control": "no-store" } });
  });
  const page = await ctx.newPage();
  const logs = [];
  let workers = 0; page.on("worker", () => workers++);
  page.on("console", m => { if (["error", "warning"].includes(m.type())) logs.push(m.type() + ": " + m.text()); });
  page.on("pageerror", e => logs.push("pageerror: " + e.message));
  await page.goto(base + pageUrl, { waitUntil: "networkidle" });
  const scrollTo = opt("--scroll", null);
  await page.waitForSelector(".qb-img", { timeout: 20000 });
  await page.getByRole("button", { name: "No thanks" }).click({ timeout: 2000 }).catch(() => {});
  await page.evaluate(() => { const r = document.querySelector(".qb-row"); if (r) window.scrollTo(0, r.getBoundingClientRect().top + window.scrollY - 90); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}-top.png` });
  await page.evaluate(() => window.scrollBy(0, 700)); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}-mid.png` });
  const states = await page.evaluate(() => [...document.querySelectorAll(".qb-img")].map(i => i.dataset.dq || "-").join(","));
  console.log("dq states:", states);
  if (args.includes("--zoom")) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => { const r = document.querySelector(".qb-row"); if (r) window.scrollTo(0, r.getBoundingClientRect().top + window.scrollY - 90); });
    await page.locator(".qb-zoomable").first().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}-zoom.png` });
    const tab = page.locator(".qb-zoom-tabs button").nth(1);
    if (await tab.count()) { await tab.click(); await page.waitForTimeout(2500); await page.screenshot({ path: `${out}-zoom-ms.png` }); }
    console.log("zoom dq:", await page.evaluate(() => [...document.querySelectorAll(".qb-zoom img")].map(i => i.dataset.dq || "-").join(",")));
    await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  }
  if (args.includes("--ms")) {
    await page.evaluate(() => { const r = document.querySelector(".qb-row"); if (r) window.scrollTo(0, r.getBoundingClientRect().top + window.scrollY - 90); });
    await page.locator(".qb-keys .qb-key", { hasText: /Mark scheme|Answer/ }).first().click();
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelector(".qb-reveal-ms, .qb-answer")?.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}-ms.png` });
  }
  if (args.includes("--toggle")) {
    // dark, then light, then dark again: what the <img>s do
    const read = () => page.evaluate(() => [...document.querySelectorAll(".qb-img")].slice(0, 6).map(i => (i.dataset.dq || "-") + ":" + (i.src.startsWith("blob:") ? "blob" : "orig")).join(" "));
    const flip = () => page.evaluate(() => document.querySelector(".lp-themeswitch, .lp-themebtn")?.click());
    console.log("start     ", await read());
    await flip(); await page.waitForTimeout(1500); console.log("after flip", await read(), await page.evaluate(() => document.documentElement.dataset.theme));
    await page.screenshot({ path: `${out}-toggled.png` });
    await flip(); await page.waitForTimeout(2500); console.log("flip back ", await read(), await page.evaluate(() => document.documentElement.dataset.theme));
  }
  if (args.includes("--perf")) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.evaluate(() => { window.scrollTo(0, 0); window.__long = []; window.__frames = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push(Math.round(e.duration)))).observe({ entryTypes: ["longtask"] }); let last = performance.now(); const tick = t => { window.__frames.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    // reload the page's crops fresh under throttling by scrolling the whole list slowly
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < Math.min(h, 14000); y += 160) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(40); }
    await page.waitForTimeout(3000);
    const r = await page.evaluate(() => { const f = window.__frames.slice(5).sort((a, b) => a - b); const n = f.length; return { frames: n, p50: f[(n * .5) | 0], p95: f[(n * .95) | 0], max: f[n - 1], over50: f.filter(x => x > 50).length, long: window.__long, dq: [...document.querySelectorAll(".qb-img")].reduce((a, i) => (a[i.dataset.dq || "-"] = (a[i.dataset.dq || "-"] || 0) + 1, a), {}) }; });
    console.log("perf", JSON.stringify(r), "workers", workers);
  }
  if (logs.length) console.log(logs.slice(0, 8).join("\n"));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
