const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const [base, pool, out] = process.argv.slice(2);
const files = fs.readdirSync(pool).filter(f => /\.(webp|png)$/.test(f)).map(f => path.join(pool, f));
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await c.addInitScript(() => localStorage.setItem("plumi-theme", "dark"));
  await c.route("**/papers-local/**", r => { const m = /\/bank\/(.+)-(qp|ms|stem)\.webp$/.exec(new URL(r.request().url()).pathname); if (!m) return r.fulfill({ status: 404, body: "" }); const f = files[[...m[1]].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % files.length]; r.fulfill({ status: 200, contentType: f.endsWith(".png") ? "image/png" : "image/webp", body: fs.readFileSync(f) }); });
  const p = await c.newPage(); await p.goto(base + "/question-bank/aqa-a-level-physics", { waitUntil: "networkidle" });
  if (process.env.CSS) await p.addStyleTag({ content: process.env.CSS });
  await p.waitForSelector(".qb-img"); await p.waitForTimeout(2000);
  const cdp = await c.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await b.startTracing(p, { path: out, categories: ["devtools.timeline", "disabled-by-default-devtools.timeline"] });
  for (let y = 0; y < 8000; y += 160) { await p.evaluate(v => window.scrollTo(0, v), y); await p.waitForTimeout(40); }
  await p.waitForTimeout(2500); await b.stopTracing(); await b.close();
  const ev = JSON.parse(fs.readFileSync(out)).traceEvents;
  const main = ev.find(e => e.name === "thread_name" && e.args?.name === "CrRendererMain");
  const mine = ev.filter(e => e.pid === main.pid && e.tid === main.tid && e.ph === "X");
  const tasks = mine.filter(e => e.name === "RunTask" && e.dur > 50000).sort((a, b) => b.dur - a.dur).slice(0, 8);
  for (const t of tasks) {
    const kids = mine.filter(e => e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e !== t && e.name !== "RunTask");
    const agg = {}; for (const k of kids) agg[k.name] = Math.max(agg[k.name] || 0, k.dur);
    console.log(Math.round(t.dur / 1000) + "ms", Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, d]) => `${n}:${Math.round(d / 1000)}`).join(" "));
  }
})();
