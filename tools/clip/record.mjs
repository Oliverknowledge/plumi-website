#!/usr/bin/env node
/*
 * Records a short gameplay clip of the town from the REAL engine, deterministically. See tools/clip/README.md.
 *
 *   node tools/clip/record.mjs [--story tools/clip/storyboard.json] [--aspect landscape|vertical|both] [--fps 60|30]
 *                              [--out DIR] [--base http://localhost:3977] [--only take-name] [--samples N]
 *
 * The browser's clock is virtual (clock.mjs): time advances in exact 1/60 s steps, a PNG is taken after every step (60 fps) or
 * every second step (30 fps) and piped into ffmpeg, so the result is smooth however slow the (software rendered) browser is.
 * Positions come from the map data (world.mjs), not from numbers in this file.
 */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installClock } from "./clock.mjs";
import { installHelpers } from "./inpage.mjs";
import { loadTown, Town } from "./world.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true] : null)).filter(Boolean));
const story = JSON.parse(fs.readFileSync(path.resolve(args.story || path.join(here, "storyboard.json")), "utf8"));
const FPS = +(args.fps || story.fps || 60);
const SUB = Math.round(60 / FPS);                     // clock steps (of 1/60 s) per video frame
const OUT = path.resolve(args.out || path.join(here, "out"));
const SAMPLE_EVERY = +(args.samples || 90);
const MODES = { landscape: { w: 960, h: 540, dpr: 2, file: "plumi-town-1080p.mp4" }, vertical: { w: 360, h: 640, dpr: 3, file: "plumi-town-vertical.mp4" } };
const which = args.aspect && args.aspect !== "both" ? [args.aspect] : ["landscape", "vertical"];

function loadPlaywright() {
  for (const base of [import.meta.url, "file:///opt/node-tools/node_modules/", "file:///usr/local/lib/node_modules_global/"]) {
    try { return createRequire(base)("playwright"); } catch { /* next */ }
  }
  throw new Error("playwright not found: npm i -D playwright (or put it on NODE_PATH)");
}
const { chromium } = loadPlaywright();
const CHROME = ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) => fs.existsSync(p));
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0).padStart(4)}s]`, ...a);
const T0 = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- the dev server ---------- */
let serverGroup = null;
async function up(base) { try { return (await fetch(base + "/study/town/dev")).status < 500; } catch { return false; } }
async function ensureServer() {
  if (args.base) { if (!(await up(args.base))) throw new Error(`nothing answers at ${args.base}`); return args.base; }
  const port = +(args.port || 3978), base = `http://localhost:${port}`;
  if (await up(base)) return base;
  fs.mkdirSync(OUT, { recursive: true });
  log("starting next dev on", port);
  const child = spawn("npx", ["next", "dev", "-p", String(port)], { cwd: root, detached: true, stdio: ["ignore", fs.openSync(path.join(OUT, "dev.log"), "w"), "inherit"] });
  fs.writeFileSync(path.join(OUT, "dev.pid"), String(child.pid));
  serverGroup = child.pid;
  for (let i = 0; i < 120; i++) { await sleep(1000); if (await up(base)) return base; }
  throw new Error("dev server did not start");
}
function stopServer() { if (serverGroup) { try { process.kill(-serverGroup); } catch { /* gone */ } serverGroup = null; } }

/* ---------- geometry along routes ---------- */
const town = new Town(loadTown(root));
const routeCache = new Map();
function namedRoute(name) {
  if (!routeCache.has(name)) {
    const anchors = typeof name === "string" ? story.routes[name] : name;
    if (!anchors) throw new Error("no route " + name);
    routeCache.set(name, town.route(anchors));
  }
  return routeCache.get(name);
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** The part of a polyline between two fractions of its length (from > to walks it backwards), `side` px to one side. */
function slice(pts, from = 0, to = 1, side = 0) {
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const L = cum[cum.length - 1], a = Math.min(from, to) * L, b = Math.max(from, to) * L;
  const at = (s) => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; };
  let out = [at(a)];
  for (let i = 0; i < pts.length; i++) if (cum[i] > a && cum[i] < b) out.push(pts[i]);
  out.push(at(b));
  if (from > to) out.reverse();
  if (side) out = out.map((p, i) => { const q = out[Math.min(out.length - 1, i + 1)], r = out[Math.max(0, i - 1)]; const dx = q[0] - r[0], dy = q[1] - r[1], l = Math.hypot(dx, dy) || 1; return [p[0] - (dy / l) * side, p[1] + (dx / l) * side]; });
  return out;
}
/**
 * A position along a named route as a fraction: a number, `{ near: anchor, back: px }` (where the route comes closest to a map anchor, `back` px earlier),
 * or `{ fromEnd: px }` (that far before the end). Keeps the storyboard independent of where a polished map puts things.
 */
function frac(routeName, spec, dflt) {
  if (spec === undefined) return dflt;
  if (typeof spec === "number") return spec;
  const pts = namedRoute(routeName);
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const L = cum[cum.length - 1];
  if (spec.px !== undefined) return Math.max(0, Math.min(1, spec.px / L));
  if (spec.fromEnd !== undefined) return Math.max(0, Math.min(1, (L - spec.fromEnd) / L));
  const a = town.point(spec.near);
  let bi = 0, bd = Infinity; pts.forEach((p, i) => { const q = dist(p, a); if (q < bd) { bd = q; bi = i; } });
  return Math.max(0, Math.min(1, (cum[bi] - (spec.back ?? 0)) / L));   // `back` may be negative: that far past it
}
const botSpecs = (list = [], count) => Array.from({ length: count }, (_, i) => {
  const b = list[i]; if (!b) return null;
  return { pts: slice(namedRoute(b.route), frac(b.route, b.from, 0), frac(b.route, b.to, 1), b.side ?? 0), body: b.body ?? null, name: b.name, row: b.row };
});

/**
 * The town's benches, lamps' neighbours and tables are labelled boxes until the furniture art exists (`?furniture=0` hides them, but their colliders and
 * sit spots stay, so walkers would steer around nothing). The recording loads the map WITHOUT them: the data is edited on its way to the page, no file changes.
 */
async function stripFurniture(page) {
  if (story.keepFurniture) return;
  await page.route(/\/town\/v1\/town\.[0-9a-f]+\.json$/, async (route) => {
    const res = await route.fetch(); const d = await res.json();
    d.objects = d.objects.filter((o) => !o.ph); d.spots = [];
    await route.fulfill({ response: res, json: d });
  });
}

/* ---------- one clip ---------- */
async function makeCast(base, ids) {
  const b = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 800, height: 450 } });
  const out = {};
  await Promise.all(ids.map(async (id) => {
    const pg = await ctx.newPage();
    await stripFurniture(pg);
    await pg.goto(`${base}/study/town/dev?body=${id}&bots=0&map=0&furniture=0`, { waitUntil: "load", timeout: 240000 });
    await pg.waitForFunction(() => window.__town && window.__town.you.art.img instanceof HTMLCanvasElement, null, { timeout: 120000, polling: 200 });
    out[id] = await pg.evaluate(() => window.__town.you.art.img.toDataURL("image/png"));
    await pg.close();
  }));
  await b.close();
  return out;
}

async function record(base, mode, cast) {
  const M = MODES[mode];
  fs.mkdirSync(path.join(OUT, "samples"), { recursive: true });
  const file = path.join(OUT, M.file);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", String(args.crf || 18), "-pix_fmt", "yuv420p", "-movflags", "+faststart", file], { stdio: ["pipe", "inherit", "inherit"] });
  const ffDone = new Promise((res) => ff.on("close", res));
  let nframe = 0;
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const outPng = (buf) => new Promise((res) => { if (ff.stdin.write(buf)) res(); else ff.stdin.once("drain", res); });

  for (const take of story.takes) {
    if (args.only && args.only !== take.name) continue;
    log(`${mode}: take "${take.name}"`);
    const ctx = await browser.newContext({ viewport: { width: M.w, height: M.h }, deviceScaleFactor: M.dpr });
    const page = await ctx.newPage();
    await page.addInitScript(installClock);
    await stripFurniture(page);
    page.on("pageerror", (e) => log("page error:", e.message.slice(0, 200)));
    await page.goto(`${base}/study/town/dev?${take.query}`, { waitUntil: "load", timeout: 240000 });
    await page.waitForFunction(() => window.__town && window.__town.stats().frames > 3, null, { timeout: 240000, polling: 100 });
    await page.addStyleTag({ content: story.hideCss });
    await page.evaluate(installHelpers);
    for (const id of Object.keys(cast)) await page.evaluate(([i, u]) => window.__rec.addCast(i, u), [id, cast[id]]);
    await sleep(500);
    await page.evaluate((seed) => { window.__clip.auto = false; window.__clip.seed(seed); window.__rec.hideSpots(); }, take.seed ?? 1);

    const adv = (n = 1, cam) => page.evaluate(([n, cam]) => { let s = null; for (let i = 0; i < n; i++) { if (cam) window.__rec.camAt(cam[0], cam[1]); window.__clip.step(1000 / 60); } try { s = window.__rec.state(); } catch { /* in a room */ } return s; }, [n, cam]);
    /** One video frame: advance, then screenshot into the encoder. */
    const frame = async (cam) => {
      const st = await adv(SUB, cam);
      const buf = await page.screenshot({ type: "png" });
      if (nframe % SAMPLE_EVERY === 0) fs.writeFileSync(path.join(OUT, "samples", `${mode}-${String(nframe).padStart(5, "0")}.png`), buf);
      await outPng(buf); nframe++;
      return st;
    };
    const secs = (s) => Math.round(s * FPS);

    for (const shot of take.shots) {
      const s0 = nframe;
      if (shot.type === "walk") {
        const pts = slice(namedRoute(shot.route), frac(shot.route, shot.start, 0), frac(shot.route, shot.end, 1));
        await page.evaluate(([s, pts, bots]) => { const R = window.__rec; R.follow(); R.dress(s.body); R.place(pts[0][0], pts[0][1], 3); R.bots(bots); }, [shot, pts, botSpecs(shot.bots, 7)]);
        await adv(6);
        for (let i = 0; i < secs(shot.lead ?? 0.25); i++) await frame();
        await page.evaluate((pts) => window.__rec.walk(pts), pts);
        let still = 0;
        for (let i = 0; i < secs(shot.seconds); i++) {
          const st = await frame();
          if (args.debug && i % 15 === 0) log('walk', i, JSON.stringify(st));
          if (st && st.pathN === 0 && !st.walking) { if (++still > secs(shot.holdAfter ?? 0.4)) break; } else still = 0;
        }
      } else if (shot.type === "pan") {
        const rect = await page.evaluate((id) => { const t = window.__town, o = t.data.objects.find((q) => q.id === id), sp = t.data.sprites[o.sprite]; return { x: o.sx, y: o.sy, w: sp.w, h: sp.h }; }, shot.building);
        const P = (f) => [rect.x + f.rx * rect.w, rect.y + f.ry * rect.h];
        const a = P(shot.from), b = P(shot.to), at = town.point(shot.at);
        await page.evaluate(([s, at, bots]) => { const R = window.__rec; R.follow(); R.dress(s.body); R.place(at[0], at[1], 1); R.bots(bots); }, [shot, at, botSpecs(shot.bots, 7)]);
        await adv(6, a);
        // the walkers cross the plaza while the camera climbs the facade
        for (let i = 0; i < secs(shot.lead ?? 0.4); i++) await frame(a);
        const n = secs(shot.seconds);
        for (let i = 0; i < n; i++) { const u = (i + 1) / n, e = u * u * (3 - 2 * u); await frame([a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e]); }
        for (let i = 0; i < secs(shot.tail ?? 0.3); i++) await frame(b);
        await page.evaluate(() => window.__rec.follow());
      } else if (shot.type === "enter") {
        // at the door: the prompt, E, the 0.35 s fade; the room loads behind the dark; it fills up (unrecorded); then it fades in
        for (let i = 0; i < secs(shot.hold ?? 0.8); i++) await frame();
        await page.evaluate(() => { window.__rec.key("KeyE", true); window.__rec.key("KeyE", false); });
        for (let i = 0; i < secs(0.42); i++) await frame();                       // the veil closes
        await page.evaluate(() => { window.__clip.freezeAnim = true; });          // it stays closed while the room loads
        await page.evaluate(() => { window.__clip.auto = true; });
        await page.waitForFunction(() => window.__rec.roomReady(), null, { timeout: 120000, polling: 100 });
        await page.evaluate(() => { window.__clip.auto = false; });
        for (let i = 0; i < Math.round((shot.fastForward ?? 30) * 60); i++) { await adv(1); if (i % 60 === 0) await sleep(5); }
        const info = await page.evaluate(() => window.__rec.roomInfo());
        log("room ready", JSON.stringify(info));
        await page.evaluate((b) => { const R = window.__rec; R.roomDress(b); R.roomEnter(); }, shot.body);
        await adv(3);
        await page.evaluate(() => { window.__clip.freezeAnim = false; });
        for (let i = 0; i < secs(0.45); i++) await frame();                       // the veil opens
      } else if (shot.type === "room") {
        const reg = JSON.parse(fs.readFileSync(path.join(root, "tools/art/rooms/cafe.seats.json"), "utf8")).seats;
        let target = null;
        const want = Array.isArray(shot.seats) ? shot.seats : [null];
        for (const id of want) {
          const at = id ? reg.find((q) => q.id === id)?.at : null;
          const ap = await page.evaluate((at) => window.__rec.approach(at), at);
          if (ap) { target = { id: id ?? "auto", ap }; break; }
        }
        if (!target) throw new Error("no free seat among " + want);
        log("approaching", target.id);
        await page.evaluate((p) => window.__rec.roomClick(p[0], p[1]), target.ap.approach);
        const bubbles = [...(shot.bubbles ?? [])];
        let tt = 0;
        const tickBubbles = async () => { while (bubbles.length && tt >= bubbles[0].t) { const b = bubbles.shift(); await page.evaluate(([n, t]) => window.__rec.bubbleNear(n, t, 3200), [b.near ?? 0, b.text]); } };
        let arrived = 0, guard = 0;
        for (;;) {
          const st = await frame(); tt += 1 / FPS; await tickBubbles();
          const rs = await page.evaluate(() => window.__rec.roomState());
          if (!rs.moving) { if (++arrived > secs(shot.arriveHold ?? 0.8)) break; } else arrived = 0;
          if (++guard > secs(25)) throw new Error("never arrived at the seat");
        }
        await page.evaluate(() => { window.__rec.key("KeyE", true); window.__rec.key("KeyE", false); });
        for (let i = 0; i < secs(shot.sitHold ?? 3); i++) { await frame(); tt += 1 / FPS; await tickBubbles(); }
        log("seated:", JSON.stringify(await page.evaluate(() => window.__rec.roomState())));
      } else if (shot.type === "endcard") {
        const n = secs(shot.seconds);
        for (let i = 0; i < n; i++) { const a = Math.min(1, (i / FPS) / 0.8); await page.evaluate(([a, t, s]) => window.__rec.endcard(a, t, s), [a, story.title, story.subtitle]); await frame(); }
      } else throw new Error("unknown shot " + shot.type);
      log(`${mode}: shot "${shot.name ?? shot.type}" ${((nframe - s0) / FPS).toFixed(1)} s (frame ${nframe})`);
    }
    await ctx.close();
  }
  ff.stdin.end(); await ffDone; await browser.close();
  const bytes = fs.statSync(file).size;
  if (!args["no-extras"]) await extras(file, mode);
  log(`${mode}: ${file} ${(bytes / 1048576).toFixed(1)} MB, ${nframe} frames, ${(nframe / FPS).toFixed(1)} s at ${FPS} fps`);
}

/** A 720p preview and a 5 s looping GIF (the opening walk) next to the full clip. */
async function extras(file, mode) {
  const run = (a) => new Promise((res) => spawn("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: "inherit" }).on("close", res));
  const base = file.replace(/\.mp4$/, "");
  const h = mode === "vertical" ? "scale=406:720:flags=lanczos" : "scale=1280:720:flags=lanczos";
  await run(["-i", file, "-vf", h, "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", base + "-720p.mp4"]);
  const w = mode === "vertical" ? 270 : 540;
  await run(["-t", "5", "-i", file, "-vf", `fps=15,scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, "-loop", "0", base + "-loop.gif"]);
}

const base = await ensureServer();
try {
  fs.mkdirSync(OUT, { recursive: true });
  log("building the cast (the app's own wardrobe)");
  const cast = await makeCast(base, story.cast);
  for (const m of which) await record(base, m, cast);
} finally { stopServer(); }
