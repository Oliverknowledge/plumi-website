/* Shared by the social cut's recorder: Playwright, the dev server, the cast (the app's own animals), the map edit. */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function loadPlaywright(here) {
  for (const base of [import.meta.url, "file:///opt/node-tools/node_modules/", "file:///usr/local/lib/node_modules_global/"]) {
    try { return createRequire(base)("playwright"); } catch { /* next */ }
  }
  throw new Error("playwright not found: npm i -D playwright (or put it on NODE_PATH)");
}
export const CHROME = ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) => fs.existsSync(p));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function up(base) { try { return (await fetch(base + "/study/town/dev")).status < 500; } catch { return false; } }
let group = null;
export async function ensureServer(args, root, out) {
  if (args.base) { if (!(await up(args.base))) throw new Error(`nothing answers at ${args.base}`); return args.base; }
  const port = +(args.port || 3978), base = `http://localhost:${port}`;
  if (await up(base)) return base;
  fs.mkdirSync(out, { recursive: true });
  console.log("starting next dev on", port);
  const child = spawn("npx", ["next", "dev", "-p", String(port)], { cwd: root, detached: true, stdio: ["ignore", fs.openSync(path.join(out, "dev.log"), "w"), "inherit"] });
  fs.writeFileSync(path.join(out, "dev.pid"), String(child.pid));
  group = child.pid;
  for (let i = 0; i < 120; i++) { await sleep(1000); if (await up(base)) return base; }
  throw new Error("dev server did not start");
}
export function stopServer() { if (group) { try { process.kill(-group); } catch { /* gone */ } group = null; } }

/** The town loaded without its labelled placeholder boxes (and their colliders and sit spots): the response is edited in flight. */
export async function stripFurniture(page) {
  await page.route(/\/town\/v1\/town\.[0-9a-f]+\.json$/, async (route) => {
    const res = await route.fetch(); const d = await res.json();
    d.objects = d.objects.filter((o) => !o.ph); d.spots = [];
    await route.fulfill({ response: res, json: d });
  });
}

/** Each animal's 78 frame row, as the app's wardrobe draws it, cached as PNG files in `dir`. */
export async function makeCast(chromium, base, ids, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 800, height: 450 } });
  const out = {};
  const need = ids.filter((id) => !fs.existsSync(path.join(dir, id + ".png")));
  await Promise.all(need.map(async (id) => {
    const pg = await ctx.newPage();
    await pg.goto(`${base}/study/town/dev?body=${id}&bots=0&map=0&furniture=0`, { waitUntil: "load", timeout: 240000 });
    await pg.waitForFunction(() => window.__town && window.__town.you.art.img instanceof HTMLCanvasElement, null, { timeout: 120000, polling: 200 });
    const u = await pg.evaluate(() => window.__town.you.art.img.toDataURL("image/png"));
    fs.writeFileSync(path.join(dir, id + ".png"), Buffer.from(u.split(",")[1], "base64"));
    await pg.close();
  }));
  await b.close();
  for (const id of ids) out[id] = "data:image/png;base64," + fs.readFileSync(path.join(dir, id + ".png")).toString("base64");
  return out;
}
