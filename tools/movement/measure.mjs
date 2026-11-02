#!/usr/bin/env node
/*
 * Movement-feel harness for the web Grand Library. See tools/movement/README.md.
 *
 *   node tools/movement/measure.mjs [--base http://localhost:3960] [--room cafe] [--me fox] [--zoo] [--json out.json]
 *                                   [--series series.json] [--target tools/movement/target.json]
 *                                   [--width 1512 --height 949 --dpr 1] [--no-fail]
 *
 * It opens the dev-only demo page (/study/library/demo, no Supabase), replaces requestAnimationFrame and performance.now
 * with a virtual clock (exactly 60 display frames a second, deterministic), drives the REAL engine (cafeScene.ts) with
 * synthetic key presses and a click, records what it would draw each display frame (sprite position, frame index,
 * camera), and prints the same metrics that were measured from the reference clip, then PASS / FAIL against target.json.
 * No model calls, no network beyond the local dev server. Takes about 30 to 60 s.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { installClock, installHelpers } from "./inpage.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true] : null)).filter(Boolean));
const BASE = args.base || process.env.MOVE_BASE || "http://localhost:3960";
const WIDTH = +(args.width || 1512), HEIGHT = +(args.height || 949), DPR = +(args.dpr || 1);
const TARGET = resolve(args.target || resolve(here, "target.json"));

function loadPlaywright() {
  for (const base of [import.meta.url, "file:///opt/node-tools/node_modules/", "file:///usr/local/lib/node_modules_global/"]) {
    try { return createRequire(base)("playwright"); } catch { /* next */ }
  }
  throw new Error("playwright not found: npm i -D playwright (or set NODE_PATH)");
}
const { chromium } = loadPlaywright();

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function session() {
  const uid = crypto.randomUUID(), exp = Math.floor(Date.now() / 1000) + 86400 * 365;
  return { access_token: `${b64({ alg: "HS256" })}.${b64({ sub: uid, role: "authenticated", exp })}.s`, refresh_token: "r", expires_in: 1e7, expires_at: exp, token_type: "bearer", user: { id: uid, aud: "authenticated", email: "x@y.z", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
}

/* ---------- small maths ---------- */
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const median = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function fit(xs, ys) {
  const n = xs.length; if (n < 2) return { slope: NaN, icpt: NaN };
  const mx = mean(xs), my = mean(ys); let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  const slope = sxy / sxx; return { slope, icpt: my - slope * mx };
}
const R = (v, d = 2) => (typeof v === "number" && isFinite(v) ? +v.toFixed(d) : v);

/* row: [vt, t, px, py, sx, sy, f, d, moving, plen, camX, camY, fw] */
const C = { vt: 0, t: 1, px: 2, py: 3, sx: 4, sy: 5, f: 6, d: 7, mv: 8, plen: 9, cx: 10, cy: 11, fw: 12 };
const feetX = (r) => r[C.sx] + r[C.fw] / 2, feetY = (r) => r[C.sy] + 31;

function runs(seq) { const out = []; let s = 0; for (let i = 1; i <= seq.length; i++) if (i === seq.length || seq[i] !== seq[s]) { out.push([seq[s], s, i - 1]); s = i; } return out; }
function period(seq) { for (let p = 1; p <= seq.length >> 1; p++) { let ok = true; for (let i = 0; i + p < seq.length; i++) if (seq[i] !== seq[i + p]) { ok = false; break; } if (ok) return p; } return seq.length; }

/** One held-key run: speed, start and stop, update rate, quantum, pose cadence, camera lag. */
function analyseHold(rows, marks, axis, V, spriteRows) {
  const [ax, ay] = axis, T0 = marks.press, T1 = marks.release;
  const proj = (r) => feetX(r) * ax + feetY(r) * ay;
  const camProj = (r) => r[C.cx] * ax + r[C.cy] * ay;
  const steady = rows.filter((r) => r[C.vt] >= T0 + 500 && r[C.vt] <= T1);
  const f = fit(steady.map((r) => (r[C.vt] - T0) / 1000), steady.map(proj));
  const v = f.slope; // art px a second
  const base = rows.filter((r) => r[C.vt] < T0).slice(-10);
  const p0 = mean(base.map(proj));
  const tStart = (p0 - f.icpt) / v; // seconds after the press at which the fitted line leaves the start
  const after = rows.filter((r) => r[C.vt] >= T1);
  const last = after[after.length - 1];
  const expected = v * ((T1 - T0) / 1000 - tStart);
  const dFinal = proj(last) - p0;
  const stopExcessMs = ((dFinal - expected) / v) * 1000;
  // last displayed change after the release
  let lastChange = T1;
  for (let i = 1; i < after.length; i++) if (proj(after[i]) !== proj(after[i - 1])) lastChange = after[i][C.vt];
  // display updates while walking: a row where anything visible changed
  const win = rows.filter((r) => r[C.vt] >= T0 + 300 && r[C.vt] <= T1);
  let upd = 0, spriteUpd = 0; const steps = [];
  for (let i = 1; i < win.length; i++) {
    const a = win[i - 1], b = win[i];
    const dx = Math.abs(proj(b) - proj(a));
    if (b[C.sx] !== a[C.sx] || b[C.sy] !== a[C.sy]) { spriteUpd++; steps.push(dx); }
    if (b[C.sx] !== a[C.sx] || b[C.sy] !== a[C.sy] || b[C.cx] !== a[C.cx] || b[C.cy] !== a[C.cy] || b[C.f] !== a[C.f]) upd++;
  }
  const dur = (win[win.length - 1][C.vt] - win[0][C.vt]) / 1000;
  // the coarsest grid (art px) every drawn sprite position sits on; 0 = continuous (the browser rounds to device pixels)
  const grids = [1, 0.5, 1 / 3, 0.25, 1 / 6, 0.125, 1 / 8, 1 / 16];
  const onGrid = (g) => win.every((r) => [r[C.sx], r[C.sy]].every((v) => Math.abs(v / g - Math.round(v / g)) < 1e-6));
  const posQuantumArt = grids.find(onGrid) ?? 0;
  const stepArt = mean(steps.filter((s) => s > 0));
  // pose slots (frame index runs), first and last run dropped (cut by the window)
  const pw = rows.filter((r) => r[C.vt] >= T0 + 80 && r[C.vt] <= T1 - 40);
  const rr = runs(pw.map((r) => r[C.f])).slice(1);
  const slotMs = rr.slice(0, -1).map((x, i) => pw[rr[i + 1][1]][C.vt] - pw[x[1]][C.vt]);   // start to start: no bias from where the window ends
  const slotMean = mean(slotMs);
  const seq = rr.slice(0, -1).map((x) => x[0]);
  const per = seq.length >= 4 ? period(seq) : NaN;
  // camera: distance of the player from where the camera holds him when still
  const off = (r) => (proj(r) - camProj(r)) ;
  const o0 = mean(base.map(off));
  const lag = (r) => (off(r) - o0) * (V.k / V.dpr); // css px the player has slid from his lock point
  const lagSteady = mean(rows.filter((r) => r[C.vt] >= T0 + 1200 && r[C.vt] <= T1).map(lag));
  const lagMax = Math.max(...rows.filter((r) => r[C.vt] <= T1 + 20).map((r) => Math.abs(lag(r))));
  let settle = null;
  for (const r of after) if (Math.abs(lag(r)) <= Math.max(1, V.k / V.dpr)) { settle = r[C.vt] - T1; break; }
  // facing and frame at the first moving row
  const firstMove = rows.find((r) => r[C.vt] > T0 && proj(r) !== p0) || rows[0];
  return {
    speedArt: R(Math.abs(v), 2), speedHs: R(Math.abs(v) / spriteRows, 3), startDelayMs: R(tStart * 1000, 0), stopExcessMs: R(stopExcessMs, 0), stopMs: R(lastChange - T1, 0),
    firstMoveMs: R(firstMove[C.vt] - T0, 0), updateHz: R(upd / dur, 1), spriteUpdateHz: R(spriteUpd / dur, 1), posQuantumCss: R(posQuantumArt * (V.k / V.dpr), 2), stepCss: R(stepArt * (V.k / V.dpr), 2),
    poseHz: R(1000 / slotMean, 2), poseMs: R(slotMean, 1), poseDistHs: R((Math.abs(v) * slotMean / 1000) / spriteRows, 3), distinctPoses: new Set(seq).size, cycleSlots: per, cycleMs: R(per * slotMean, 0),
    firstFrame: firstMove[C.f], camLagSteadyCss: R(lagSteady, 1), camLagMaxCss: R(lagMax, 1), camSettleMs: settle == null ? null : R(settle, 0), lockOffX: R(o0, 2),
    seq: seq.slice(0, 14),
  };
}

/** A synthetic player that moves exactly like the reference clip, run through the same analysis: the PASS rows must pass. */
function selftest(target) {
  const V = { k: 3, dpr: 1, viewW: 504, viewH: 316 }, rows = [], H = 40, v = 2.24 * H; // art px/s
  const T0 = 1000, T1 = 2500; let x = 300;
  for (let i = 0; i < 400; i++) {
    const vt = 500 + i * (1000 / 60), moving = vt >= T0 && vt <= T1;
    if (moving) x += v / 60;
    const fx = Math.round(x * 3) / 3;
    const f = moving ? 24 + (Math.floor((vt - T0) / (1000 / 12)) % 6) : 0;
    rows.push([vt, vt / 1000, x, 300, fx - 8, 300 - 31, f, 0, moving ? 1 : 0, 0, fx - V.viewW / 2, 100, 16]);
  }
  const h = analyseHold(rows, { press: T0, release: T1 }, [1, 0], V, H);
  const m = { speed_hs_axis: h.speedHs, start_delay_ms: h.startDelayMs, stop_excess_ms: h.stopExcessMs, display_update_hz: h.updateHz, pos_quantum_css: h.posQuantumCss, step_css: h.stepCss, pose_rate_hz: h.poseHz, pose_dist_hs: h.poseDistHs, cam_lag_steady_css: Math.abs(h.camLagSteadyCss), cam_settle_ms: h.camSettleMs ?? 9999 };
  let bad = 0;
  for (const [k, v2] of Object.entries(m)) {
    const sp = target.metrics[k]; if (!sp) continue;
    const ok = sp.min !== undefined || sp.max !== undefined ? (sp.min === undefined || v2 >= sp.min) && (sp.max === undefined || v2 <= sp.max) : Math.abs(v2 - sp.target) <= (sp.tolAbs ?? Math.abs(sp.target) * (sp.tolRel ?? 0.1));
    console.log(k.padEnd(24), String(v2).padEnd(10), ok ? "PASS" : "FAIL"); if (!ok) bad++;
  }
  console.log(bad ? "selftest FAIL: the analysis does not recognise reference-like movement" : "selftest PASS: reference-like synthetic movement passes every checked metric");
  process.exit(bad ? 1 : 0);
}

async function main() {
  const t0 = Date.now();
  const target = JSON.parse(readFileSync(TARGET, "utf8"));
  if (args.selftest) selftest(target);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: DPR });
  await ctx.addInitScript((s) => localStorage.setItem("plumi-auth", JSON.stringify(s)), session());
  await ctx.addInitScript(`(${installClock.toString()})()`);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  const qs = [args.me && args.me !== true ? `me=${args.me}` : "", args.zoo ? "zoo=1" : ""].filter(Boolean).join("&");
  const ROOM = args.room === "cafe" ? "cafe" : "library";
  await page.goto(`${BASE}/study/${ROOM}/demo${qs ? "?" + qs : ""}`, { waitUntil: "load", timeout: 240000 });
  await page.waitForSelector(".lb-room[data-ready]", { timeout: 240000 });
  await page.waitForFunction(() => window.__plumiLibrary && window.__plumiLibrary.youNow(), null, { timeout: 120000 });
  await page.evaluate(`(${installHelpers.toString()})()`);
  // let the room settle for a moment of real time (bots arrive), then freeze the clock
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__vt.auto = false; window.__mv.pinGovernor(); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const V = await ev(() => window.__mv.view());
  const art = await ev(() => window.__mv.art(window.__plumiLibrary.you));
  const spriteRows = art.idle[3].rows; // body rows of the idle front frame
  const out = { meta: { base: BASE, me: args.me || "person", viewport: [WIDTH, HEIGHT, DPR], k: V.k, spriteRows, spriteFw: V.fw, speedArtPerS: V.speed }, hold: {}, diag: {} };
  const series = {};

  /* ---- art facts: head bob, shadow, idle ---- */
  const bob = art.walk.map((d) => Math.max(...d.map((s) => s.top)) - Math.min(...d.map((s) => s.top)));
  const lift = art.walk.map((d) => Math.max(...d.map((s) => s.bot)) - Math.min(...d.map((s) => s.bot)));
  out.art = { bobRowsByDir: bob, footRowsByDir: lift, shadowPx: art.idle[3].semi, shadowW: art.idle[3].shadowW, rows: spriteRows };

  // a run of 150 art px (a key held 1.5 s walks 105 and the rest is margin); a room too small for that (the cafe) gets 115
  const findRun = async (dx, dy) => { for (const len of [150, 115]) { const st = await ev(([dx, dy, len]) => window.__mv.findStart(dx, dy, len), [dx, dy, len]); if (st) return st; } return null; };
  /* ---- four axes, held 1.5 s ---- */
  const AX = { right: [1, 0, "KeyD"], left: [-1, 0, "KeyA"], down: [0, 1, "KeyS"], up: [0, -1, "KeyW"] };
  for (const [name, [dx, dy, code]] of Object.entries(AX)) {
    const st = await findRun(dx, dy);
    if (!st) { out.hold[name] = { error: "no clear run" }; continue; }
    const r = await ev(([st, code]) => window.__mv.run([{ tele: st, n: 30 }, { mark: "press", down: [code], n: 90 }, { mark: "release", up: [code], n: 200 }]), [st, code]);
    series[`hold_${name}`] = r;
    out.hold[name] = analyseHold(r.rows, r.marks, [dx, dy], V, spriteRows);
  }
  /* ---- diagonals ---- */
  const DG = { downRight: [1, 1, ["KeyD", "KeyS"]], upLeft: [-1, -1, ["KeyA", "KeyW"]], downLeft: [-1, 1, ["KeyA", "KeyS"]], upRight: [1, -1, ["KeyD", "KeyW"]] };
  for (const [name, [dx, dy, codes]] of Object.entries(DG)) {
    const n = Math.SQRT1_2, st = await findRun(dx * n, dy * n);
    if (!st) { out.diag[name] = { error: "no clear run" }; continue; }
    const r = await ev(([st, codes]) => window.__mv.run([{ tele: st, n: 30 }, { mark: "press", down: codes, n: 90 }, { mark: "release", up: codes, n: 200 }]), [st, codes]);
    series[`diag_${name}`] = r;
    out.diag[name] = analyseHold(r.rows, r.marks, [dx * Math.SQRT1_2, dy * Math.SQRT1_2], V, spriteRows);
    const dirs = r.rows.filter((x) => x[C.vt] > r.marks.press + 100 && x[C.vt] < r.marks.release).map((x) => x[C.d]);
    out.diag[name].faceChanges = runs(dirs).length - 1;
    out.diag[name].face = [...new Set(dirs)].map((i) => ["right", "back", "left", "front"][i]).join("/");
  }

  /* ---- turning: right, add down (diagonal), release right (down only), release ---- */
  {
    const st = await ev(() => window.__mv.findPath([[1, 0, 60], [0.7071, 0.7071, 50], [0, 1, 60]]));
    const r = await ev((st) => window.__mv.run([{ tele: st, n: 20 }, { mark: "a", down: ["KeyD"], n: 40 }, { mark: "b", down: ["KeyS"], n: 40 }, { mark: "c", up: ["KeyD"], n: 40 }, { mark: "d", up: ["KeyS"], n: 30 }]), st);
    series.turn = r;
    const D = ["right", "back", "left", "front"];
    const seg = (a, b) => [...new Set(r.rows.filter((x) => x[C.vt] > r.marks[a] + 60 && x[C.vt] <= r.marks[b]).map((x) => D[x[C.d]]))].join("/");
    const firstAfterC = r.rows.find((x) => x[C.vt] > r.marks.c && D[x[C.d]] === "front");
    out.turn = { facingRight: seg("a", "b"), facingDiag: seg("b", "c"), facingAfterReleaseRight: seg("c", "d"), turnLatencyMs: firstAfterC ? R(firstAfterC[C.vt] - r.marks.c, 0) : null };
  }
  /* ---- pushing a wall: face it, do not move ---- */
  {
    const wall = await ev(() => {
      const h = window.__plumiLibrary, W = h.W, g = h.grid;
      const big = h.L.w >= 900, [x0, x1, y0, y1] = big ? [140, 820, 160, 540] : [16, h.L.w - 16, 16, h.L.h - 16];
      for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) if (W.fits(g, x, y) && !W.fits(g, x + 3, y) && !W.fits(g, x + 6, y)) return [x, y];
      return null;
    });
    if (wall) {
      const r = await ev((w) => window.__mv.run([{ tele: w, n: 20 }, { mark: "a", down: ["KeyS"], n: 12 }, { up: ["KeyS"], n: 12 }, { mark: "b", down: ["KeyD"], n: 30 }, { up: ["KeyD"], n: 10 }]), wall);
      const D = ["right", "back", "left", "front"];
      const rb = r.rows.filter((x) => x[C.vt] > r.marks.b);
      out.wall = { facedWall: D[rb[rb.length - 1][C.d]] === "right" || D[rb[Math.floor(rb.length / 2)][C.d]] === "right", moved: R(Math.hypot(feetX(rb[rb.length - 1]) - feetX(rb[0]), feetY(rb[rb.length - 1]) - feetY(rb[0])), 1) };
    }
  }
  /* ---- ground shadow, standing still on open floor ---- */
  {
    const st = await ev(() => window.__mv.findStart(1, 0, 40));
    const sh = await ev((st) => { window.__mv.run([{ tele: st, n: 12, rec: false }]); return window.__mv.shadow(window.__plumiLibrary.you); }, st);
    out.shadow = sh;
  }
  /* ---- idle: does the standing pose animate? ---- */
  {
    const st = await ev(() => window.__mv.findStart(1, 0, 60));
    const r = await ev((st) => window.__mv.run([{ tele: st, n: 10, rec: false }, { n: 180 }]), st);
    const fs = r.rows.map((x) => x[C.f]);
    const first = r.rows.filter((x) => x[C.vt] <= r.rows[0][C.vt] + 1250).map((x) => x[C.f]);
    out.idle = { changesIn3s: runs(fs).length - 1, changesIn1250ms: runs(first).length - 1, frames: [...new Set(fs)].length };
  }
  /* ---- tap (100 ms): the smallest step a short press makes ---- */
  {
    const st = await ev(() => window.__mv.findStart(1, 0, 60));
    const r = await ev((st) => window.__mv.run([{ tele: st, n: 20 }, { mark: "press", down: ["KeyD"], n: 6 }, { mark: "release", up: ["KeyD"], n: 40 }]), st);
    out.tap = { travelArt: R(feetX(r.rows[r.rows.length - 1]) - feetX(r.rows[0]), 1), pressMs: 100, ideal: R(V.speed * 0.1, 1) };
  }
  /* ---- click to walk: a 100 art px diagonal route ---- */
  {
    // the Grand Library has a run of 140; a small room (the cafe) may only have a shorter one: the route is scaled to it
    let len = 140, st = null;
    for (const l of [140, 100, 70, 50]) { len = l; st = await ev((l) => window.__mv.findStart(0.9, 0.4, l), l); if (st) break; }
    if (!st) { out.click = { error: "no clear run" }; } else {
    const r = await ev(([st, len]) => { const [x, y] = st; return window.__mv.run([{ tele: st, n: 20 }, { mark: "click", click: [x + 100 * len / 140, y + 45 * len / 140], n: 200 }]); }, [st, len]);
    series.click = r;
    const mv = r.rows.filter((x) => x[C.plen] > 0);
    if (mv.length > 20) {
      let len = 0; const cum = mv.map((x, i) => (i ? (len += Math.hypot(feetX(x) - feetX(mv[i - 1]), feetY(x) - feetY(mv[i - 1]))) : 0));
      const f = fit(mv.map((x) => x[C.vt] / 1000), cum);
      // arrival: speed in the last 200 ms of the path versus the middle
      const tEnd = mv[mv.length - 1][C.vt];
      const lastW = r.rows.filter((x) => x[C.vt] > tEnd - 200 && x[C.vt] <= tEnd + 17);
      const endV = Math.hypot(feetX(lastW[lastW.length - 1]) - feetX(lastW[0]), feetY(lastW[lastW.length - 1]) - feetY(lastW[0])) / ((lastW[lastW.length - 1][C.vt] - lastW[0][C.vt]) / 1000);
      out.click = { speedHs: R(Math.abs(f.slope) / spriteRows, 3), endSpeedRatio: R(endV / Math.abs(f.slope), 2), durationMs: R(tEnd - mv[0][C.vt], 0), distanceArt: R(len, 1) };
    } else out.click = { error: "no path" };
    }
  }

  /* ---- other walkers (what everyone else in the room does): same maths, a path set directly ---- */
  const info = await ev(() => window.__mv.info());
  const remotes = info.people.filter((p) => p.remote);
  const npcOf = async (idx) => {
    const st = await ev(() => window.__mv.findStart(1, 0, 150));
    const rr = await ev(([idx, st]) => {
      const p = window.__mv.pick(idx);
      const a = window.__mv.art(p);
      const run = window.__mv.run([{ tele: st, n: 5, rec: false }, { mark: "press", path: [[st[0] + 150, st[1]]], n: 160 }], idx);
      return { run, rows: a.idle[3].rows, fw: a.fw, walkTop: a.walk.map((d) => d.map((s) => s.top)) };
    }, [idx, st]);
    const rows = rr.run.rows.filter((x) => x[C.plen] > 0);
    const T0 = rr.run.marks.press;
    const steady = rows.filter((x) => x[C.vt] > T0 + 300);
    const f = fit(steady.map((x) => x[C.vt] / 1000), steady.map(feetX));
    const rr2 = runs(steady.map((x) => x[C.f])).slice(1, -1);
    const ms = rr2.map(([, s, e]) => steady[e][C.vt] - steady[s][C.vt] + 1000 / 60);
    return { fw: rr.fw, spriteRows: rr.rows, speedArt: R(f.slope, 1), speedHs: R(f.slope / rr.rows, 3), poseHz: R(1000 / median(ms), 2), distinct: new Set(rr2.map((x) => x[0])).size };
  };
  const npcs = [];
  if (args.zoo) { for (const p of remotes.filter((q) => q.fw > 16)) npcs.push({ idx: remotes.indexOf(p), ...(await npcOf(remotes.indexOf(p))) }); }
  else if (remotes.length) { const i = remotes.findIndex((p) => p.fw === 16 && !p.at) ; if (i >= 0) npcs.push({ idx: i, ...(await npcOf(i)) }); }
  out.npc = npcs;

  /* ---- summary: the scored metrics ---- */
  const hold = Object.values(out.hold).filter((h) => !h.error), diag = Object.values(out.diag).filter((h) => !h.error);
  const m = {};
  m.sprite_rows = spriteRows;
  m.speed_hs_axis = R(mean(hold.map((h) => h.speedHs)), 3);
  m.speed_art_per_s = R(mean(hold.map((h) => h.speedArt)), 1);
  m.speed_hs_spread = R(Math.max(...hold.map((h) => h.speedHs)) / Math.min(...hold.map((h) => h.speedHs)), 3);
  m.speed_diag_ratio = R(mean(diag.map((h) => h.speedArt)) / mean(hold.map((h) => h.speedArt)), 3);
  m.start_delay_ms = R(mean([...hold, ...diag].map((h) => h.startDelayMs)), 0);
  m.stop_excess_ms = R(mean([...hold, ...diag].map((h) => h.stopExcessMs)), 0);
  m.stop_settle_ms = R(Math.max(...hold.map((h) => h.stopMs)), 0);
  m.display_update_hz = R(mean(hold.map((h) => h.updateHz)), 1);
  m.pos_quantum_css = R(Math.min(...hold.map((h) => h.posQuantumCss)), 2);
  m.step_css = R(mean(hold.map((h) => h.stepCss)), 2);
  m.pose_rate_hz = R(mean(hold.map((h) => h.poseHz)), 2);
  m.pose_dist_hs = R(mean(hold.map((h) => h.poseDistHs)), 3);
  m.cycle_ms = R(mean(hold.map((h) => h.cycleMs)), 0);
  m.distinct_poses = Math.max(...hold.map((h) => h.distinctPoses));
  m.head_bob_rows = Math.max(...bob);
  m.ground_shadow_w_hs = R((out.shadow.width || 0) / spriteRows, 3);
  m.ground_shadow_px = out.shadow.px;
  m.sprite_vh_pct = R(spriteRows * (V.k / V.dpr) / HEIGHT * 100, 1);
  m.idle_changes_1250ms = out.idle.changesIn1250ms;
  m.cam_lag_steady_css = R(Math.max(...hold.map((h) => Math.abs(h.camLagSteadyCss))), 1);
  m.cam_settle_ms = R(Math.max(...hold.map((h) => h.camSettleMs ?? 9999)), 0);
  m.lock_off_x_pct = R(((out.hold.right.lockOffX ?? NaN) - V.viewW / 2) / V.viewW * 100, 1);
  m.lock_off_y_pct = R(((out.hold.down.lockOffX ?? NaN) - V.viewH / 2) / V.viewH * 100, 1);
  m.diag_keeps_face = out.turn.facingDiag === out.turn.facingRight ? 1 : 0;
  m.turn_latency_ms = out.turn.turnLatencyMs;
  m.wall_turns_and_stays = out.wall && out.wall.facedWall && out.wall.moved < 0.5 ? 1 : 0;
  m.click_speed_ratio = out.click.speedHs ? R(out.click.speedHs / m.speed_hs_axis, 3) : null;
  if (npcs.length && !args.zoo) { m.npc_speed_ratio = R(npcs[0].speedHs / m.speed_hs_axis, 3); m.npc_pose_rate_hz = npcs[0].poseHz; }
  if (args.zoo && npcs.length) {
    const ok = npcs.filter((n) => n.speedArt > 20);
    m.zoo_pose_rate_min = Math.min(...ok.map((n) => n.poseHz)); m.zoo_pose_rate_max = Math.max(...ok.map((n) => n.poseHz));
    m.zoo_speed_hs_max = Math.max(...ok.map((n) => n.speedHs)); m.zoo_speed_hs_min = Math.min(...ok.map((n) => n.speedHs));
  }
  out.metrics = m;

  /* ---- compare with the target ---- */
  const rows = [];
  let fails = 0;
  for (const [key, spec] of Object.entries(target.metrics)) {
    const v = m[key];
    let verdict = "n/a";
    if (v == null || Number.isNaN(v)) verdict = "n/a";
    else if (spec.min !== undefined || spec.max !== undefined) verdict = (spec.min === undefined || v >= spec.min) && (spec.max === undefined || v <= spec.max) ? "PASS" : "FAIL";
    else if (spec.target !== undefined) { const tol = spec.tolAbs ?? Math.abs(spec.target) * (spec.tolRel ?? 0.1); verdict = Math.abs(v - spec.target) <= tol ? "PASS" : "FAIL"; }
    if (spec.info && verdict === "FAIL") verdict = "info";
    if (verdict === "FAIL") fails++;
    const want = spec.min !== undefined || spec.max !== undefined ? `${spec.min ?? ""}..${spec.max ?? ""}` : `${spec.target} ±${spec.tolAbs ?? R(Math.abs(spec.target) * (spec.tolRel ?? 0.1), 3)}`;
    rows.push({ key, ours: v, want, unit: spec.unit || "", ref: spec.ref ?? "", verdict, note: spec.note || "" });
  }
  out.table = rows;
  out.fails = fails;
  out.errors = errs;
  out.seconds = R((Date.now() - t0) / 1000, 1);

  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\nMovement harness: ${out.meta.me}, viewport ${WIDTH}x${HEIGHT}@${DPR} (art scale k=${V.k}), sprite ${spriteRows} rows, ${out.seconds}s\n`);
  console.log(pad("metric", 24) + pad("ours", 10) + pad("target (reference clip)", 24) + pad("unit", 10) + "verdict");
  for (const r of rows) console.log(pad(r.key, 24) + pad(r.ours ?? "-", 10) + pad(r.want, 24) + pad(r.unit, 10) + r.verdict);
  if (args.zoo) { console.log("\nAnimals (walking an open run at the room's walk speed):"); for (const n of npcs.filter((q) => q.speedArt > 20)) console.log(`  #${n.idx} frame ${n.fw} wide, ${n.spriteRows} rows: ${n.speedHs} sprite-heights/s, ${n.poseHz} poses/s, ${n.distinct} distinct`); }
  console.log(`\n${fails ? "FAIL" : "PASS"}: ${fails} scored metric(s) outside tolerance. Page errors: ${errs.length}`);
  if (args.json) writeFileSync(resolve(args.json === true ? "movement-ours.json" : args.json), JSON.stringify(out, null, 1));
  if (args.series) writeFileSync(resolve(args.series === true ? "movement-series.json" : args.series), JSON.stringify(series));
  await browser.close();
  if (fails && !args["no-fail"]) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(2); });
