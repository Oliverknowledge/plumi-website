#!/usr/bin/env node
/*
 * The 6 second social cut, v4 (see tools/clip/README.md): two animals walk to the cafe door, a warm fade, the cafe full of animals studying, the two sit down.
 * This records RAW frames (PNG, no grade, no captions) for each of the two scenes at 60 fps from the real engine on the virtual clock (clock.mjs);
 * `grade.py` then grades them (the lofi.town look), adds the pixel font captions, the fade and the wordmark, and encodes the mp4.
 *
 *   node tools/clip/social.mjs [--aspect landscape|vertical|both] [--out DIR] [--base URL] [--config tools/clip/social4.json] [--scene outdoor|indoor]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installClock } from "./clock.mjs";
import { installHelpers, installRoomHelpers, installTownUi } from "./inpage.mjs";
import { loadTown, Town } from "./world.mjs";
import { loadPlaywright, CHROME, sleep, ensureServer, stopServer, stripFurniture, makeCast } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true] : null)).filter(Boolean));
const cfg = JSON.parse(fs.readFileSync(path.resolve(args.config || path.join(here, "social4.json")), "utf8"));
const OUT = path.resolve(args.out || path.join(here, "out", "social4"));
const FPS = cfg.fps || 60;
const MODES = { landscape: { w: 960, h: 540, dpr: 2 }, vertical: { w: 360, h: 640, dpr: 3 } };
const which = args.aspect && args.aspect !== "both" ? [args.aspect] : ["landscape", "vertical"];
const { chromium } = loadPlaywright();
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0).padStart(4)}s]`, ...a);
const town = new Town(loadTown(root));

/** Smooth path through keyframes [{t, x, y}] (smoothstep between each pair): a camera that eases, never snaps. */
function camAt(keys, t) {
  if (t <= keys[0].t) return [keys[0].x, keys[0].y];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i].t) {
    const a = keys[i - 1], b = keys[i], u = (t - a.t) / (b.t - a.t), e = u * u * (3 - 2 * u);
    return [a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e];
  }
  const l = keys[keys.length - 1]; return [l.x, l.y];
}

async function scene(base, cast, mode, name) {
  const M = MODES[mode];
  const dir = path.join(OUT, mode); fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: M.w, height: M.h }, deviceScaleFactor: M.dpr });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => log("page error:", e.message.slice(0, 200)));
  await page.addInitScript(installClock);
  const uiCss = ".pa .lb-nm { font-size: var(--clip-nm, 15px) !important; padding: 1px 9px !important; } .pa .lb-ov > .lb-bub { font-size: var(--clip-bub, 18px) !important; max-width: 300px !important; }";
  const labCss = "html.clip-art .lb-ov, html.clip-art #clip-ov { visibility: hidden !important; } html[class^=clip-lab] body * { visibility: hidden !important; } html[class^=clip-lab] .lb-ov, html[class^=clip-lab] .lb-ov *, html[class^=clip-lab] #clip-ov, html[class^=clip-lab] #clip-ov * { visibility: visible !important; } html[class^=clip-lab], html[class^=clip-lab] body, html[class^=clip-lab] .pa, html[class^=clip-lab] main, html[class^=clip-lab] .lb-full, html[class^=clip-lab] .lb-fstage, html[class^=clip-lab] .lb-room, html[class^=clip-lab] [data-testid=town-interior] { background: var(--clip-bg, #000) !important; }";
  const hide = labCss + " .rp, nextjs-portal, next-route-announcer, .tm-sr, .lb-top, .lb-dock, .lb-drawer, .tw-exit, .lb-nm.is-you, .lb-quiet, .lb-hello { display: none !important; }";
  let n = 0;
  // two pictures a frame: the canvas alone (to be smoothed) and the labels alone on transparency (kept crisp), composited in grade.py
  const shot = async (prefix) => {
    const id = `${prefix}-${String(n++).padStart(4, "0")}`;
    await page.evaluate(() => { document.documentElement.className = "clip-art"; });
    await page.screenshot({ path: path.join(dir, id + ".png"), type: "png" });
    if (cfg.layers !== false) {                      // the same frame without anybody in it: grade.py smooths this world and keeps the sprites of the first picture crisp
      await page.evaluate(() => window.__rec.peopleOff(true));
      await page.screenshot({ path: path.join(dir, id + "c.png"), type: "png" });
      await page.evaluate(() => window.__rec.peopleOff(false));
    }
    const has = await page.evaluate(() => document.querySelectorAll(".lb-ov > *, #clip-ov > *").length > 0);
    if (!has) return;
    // the labels alone: once over black, once over white; grade.py recovers colour and alpha from the pair
    for (const [suffix, bg] of [["k", "#000"], ["w", "#fff"]]) {
      await page.evaluate((bg) => { document.documentElement.className = "clip-lab"; document.documentElement.style.setProperty("--clip-bg", bg); }, bg);
      await page.screenshot({ path: path.join(dir, id + suffix + ".png"), type: "png" });
    }
  };
  const step = (ms = 1000 / 60) => page.evaluate((ms) => window.__clip.step(ms), ms);

  if (name === "outdoor") {
    const C = { ...cfg.outdoor, ...(mode === "vertical" ? cfg.outdoor.vertical : {}) };
    await stripFurniture(page);
    await page.goto(`${base}/study/town/dev?${C.query}`, { waitUntil: "load", timeout: 240000 });
    await page.waitForFunction(() => window.__town && window.__town.stats().frames > 3, null, { timeout: 240000, polling: 100 });
    await page.addStyleTag({ content: hide + uiCss });
    await page.evaluate(installHelpers); await page.evaluate(installTownUi);
    for (const id of Object.keys(cast)) await page.evaluate(([i, u]) => window.__rec.addCast(i, u), [id, cast[id]]);
    await sleep(400);
    await page.evaluate(([seed, K, ui]) => { window.__clip.auto = false; window.__clip.seed(seed); window.__rec.hideSpots(); window.__rec.forceKTown(K); document.documentElement.style.setProperty("--clip-nm", ui.nm + "px"); document.documentElement.style.setProperty("--clip-bub", ui.bub + "px"); }, [C.seed ?? 1, C.k, C.ui ?? cfg.ui]);
    const specs = C.walkers.map((w) => ({ pts: [town.point(w.from), town.point(w.to)], body: w.body, name: w.name, pill: false }));
    while (specs.length < (C.bots ?? 8)) specs.push(null);
    const keys = C.camera.map((k) => { const p = town.point(k.at); return { t: k.t, x: p[0], y: p[1] }; });
    const hideIdx = C.walkers.map((w, i) => (w.hide ? i : -1)).filter((i) => i >= 0);
    await page.evaluate(([specs, c0, walkers]) => {
      const R = window.__rec; R.place(300, 1900, 3); R.bots(specs); R.camAt(c0[0], c0[1]);
      walkers.forEach((w, i) => { if (w.tag) R.tag(i, w.name, w.tagDx ?? 0, w.tagDy ?? 0); });
    }, [specs, [keys[0].x, keys[0].y], C.walkers]);
    for (let i = 0; i < 12; i++) { await page.evaluate(([c]) => { window.__rec.camAt(c[0], c[1]); window.__clip.step(1000 / 60); window.__rec.uiFrame(); }, [[keys[0].x, keys[0].y]]); }
    const frames = Math.round(C.seconds * FPS), bubs = [...C.bubbles].map((b) => ({ ...b, bot: C.walkers.findIndex((w) => w.name === b.who) }));
    for (let f = 0; f < frames; f++) {
      const t = f / FPS, c = camAt(keys, t);
      while (bubs.length && t >= bubs[0].t) { const b = bubs.shift(); await page.evaluate(([bot, text, ms, dx, lift]) => window.__rec.bub(bot, text, ms, dx, lift), [b.bot, b.text, b.ms, b.dx, b.lift ?? 0]); }
      await page.evaluate(([c, hideIdx]) => { const R = window.__rec, t = window.__town; R.camAt(c[0], c[1]); window.__clip.step(1000 / 60); for (const i of hideIdx) { const p = t.people[1 + i]; if (p.pathN === 0 && !p.walking && p.x > 0) p.x = -999; } R.uiFrame(); }, [c, hideIdx]);
      await shot("a");
      if (f % 60 === 0) log(`${mode} outdoor frame ${f}/${frames}`);
    }
  } else {
    const C = { ...cfg.indoor, ...(mode === "vertical" ? cfg.indoor.vertical : {}) };
    await page.goto(`${base}/study/cafe/demo?alone=1`, { waitUntil: "load", timeout: 240000 });
    await page.waitForFunction(() => window.__plumiLibrary && window.__plumiLibrary.byIpad && window.__plumiLibrary.byIpad.size > 0, null, { timeout: 240000, polling: 100 });
    await page.addStyleTag({ content: hide + uiCss });
    await page.evaluate(installRoomHelpers);
    for (const id of Object.keys(cast)) await page.evaluate(([i, u]) => window.__rec.addCast(i, u), [id, cast[id]]);
    await sleep(400);
    await page.evaluate((at) => { window.__clip.auto = false; window.__rec.roomTake(); window.__rec.tagPolicy(at); }, cfg.indoor.tagFrom ?? [250, 120]);
    const reg = JSON.parse(fs.readFileSync(path.join(root, "tools/art/rooms/cafe.seats.json"), "utf8")).seats;
    const ipad = async (id) => { const at = reg.find((q) => q.id === id)?.at; if (!at) throw new Error("no seat " + id); const i = await page.evaluate((a) => window.__rec.ipadAt(a), at); if (i === null) throw new Error("seat not in the room " + id); return i; };
    const idOf = (name) => "p-" + name;
    const shotAt = (t) => C.shots.find((s) => t >= s.t0 && t < s.t1) ?? C.shots[C.shots.length - 1];
    let curShot = null;
    /** Enters a shot: its zoom (a cut between whole k), its label size, then the camera snaps to its first key. */
    const enter = async (sh) => {
      curShot = sh;
      const c = camAt(sh.camera.map((k) => ({ t: k.t, x: k.x, y: k.y })), 0);
      await page.evaluate(([K, ui, c]) => { const R = window.__rec; document.documentElement.style.setProperty("--clip-nm", ui.nm + "px"); document.documentElement.style.setProperty("--clip-bub", ui.bub + "px"); R.roomCam(c[0], c[1]); R.forceKRoom(K); }, [sh.k, sh.ui, c]);
    };
    await enter(C.shots[0]);
    for (const s of C.seated) await page.evaluate(([id, body, name, tag, seat, nolabel]) => window.__rec.put({ id, body, name, tag: tag ?? null, seat, seated: true, nolabel }), [idOf(s.name), s.body, s.name, s.tag ?? null, await ipad(s.seat), s.label === false]);
    // walkers: a start time, or the time they should sit (their start is then worked out from the length of their walk)
    const door = await page.evaluate(() => { const h = window.__plumiLibrary; return [h.L.door.x, h.L.door.y]; });
    const starts = [];
    for (const w of C.walkers) {
      const seat = await ipad(w.seat), from = w.from ?? door;
      let t0 = w.t;
      if (w.arrive !== undefined) { const len = await page.evaluate(([seat, from]) => { const p = window.__rec.way(seat, from); let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }, [seat, from]); t0 = w.arrive - len / 70 - 0.12; log(`${w.name}: walk ${Math.round(len)} px, starts ${t0.toFixed(2)} s`); }
      starts.push({ ...w, t: t0, seat, from });
    }
    starts.sort((a, b) => a.t - b.t);
    const say = [...C.bubbles].sort((a, b) => a.t - b.t);
    const events = async (t) => {
      while (starts.length && t >= starts[0].t) {
        const w = starts.shift();
        await page.evaluate(([id, body, name, seat, from, nolabel, tag]) => { const R = window.__rec; R.put({ id, body, name, tag, feet: from, path: R.way(seat, from), seated: false, nolabel }); R.watch[id] = seat; }, [idOf(w.name), w.body, w.name, w.seat, w.from, w.label === false, w.tag ?? null]);
      }
      while (say.length && t >= say[0].t) { const b = say.shift(); await page.evaluate(([id, text, ms]) => window.__rec.say(id, text, ms), [idOf(b.who), b.text, b.ms]); }
    };
    const camNow = (t) => camAt(shotAt(t).camera.map((k) => ({ t: k.t, x: k.x, y: k.y })), t - shotAt(t).t0);
    const pre = Math.round(C.preroll * 60);
    for (let i = 0; i < pre; i++) {
      await events(-C.preroll + i / 60);
      await page.evaluate(([c]) => { window.__rec.roomCamTo(c[0], c[1]); window.__rec.tick(); window.__rec.noRings(); window.__clip.step(1000 / 60); window.__rec.noRings(); }, [camNow(0)]);
    }
    log("room", JSON.stringify(await page.evaluate(() => window.__rec.roomView())));
    const frames = Math.round(C.seconds * FPS);
    for (let f = 0; f < frames; f++) {
      const t = f / FPS, sh = shotAt(t);
      if (sh !== curShot) await enter(sh);
      await events(t);
      await page.evaluate(([c]) => { window.__rec.roomCamTo(c[0], c[1]); window.__rec.tick(); window.__rec.noRings(); window.__clip.step(1000 / 60); window.__rec.noRings(); }, [camNow(t)]);
      await shot("b");
      if (f % 60 === 0) log(`${mode} indoor frame ${f}/${frames}`);
    }
  }
  await browser.close();
  return n;
}

const base = await ensureServer(args, root, OUT);
try {
  fs.mkdirSync(OUT, { recursive: true });
  const cast = await makeCast(chromium, base, cfg.cast, path.join(OUT, "cast"));
  for (const m of which) {
    if (!args.scene) fs.rmSync(path.join(OUT, m), { recursive: true, force: true });
    const a = !args.scene || args.scene === "outdoor" ? await scene(base, cast, m, "outdoor") : 0;
    const b = !args.scene || args.scene === "indoor" ? await scene(base, cast, m, "indoor") : 0;
    const count = (p) => fs.readdirSync(path.join(OUT, m)).filter((f) => new RegExp(`^${p}-\\d{4}\\.png$`).test(f)).length;
    fs.writeFileSync(path.join(OUT, m, "meta.json"), JSON.stringify({ fps: FPS, a: count("a"), b: count("b") }));
    log(`${m}: ${a} outdoor and ${b} indoor frames in ${path.join(OUT, m)}`);
  }
} finally { stopServer(); }
