/*
 * A virtual clock, injected before the app boots (page.addInitScript). It replaces requestAnimationFrame, performance.now,
 * setTimeout/setInterval and the CSS animations' clock, so a recording is the same every time and independent of how slow
 * the (software rendered) browser is. While `__clip.auto` is true a real-time pump keeps the page alive (boot, loading).
 * Once the recorder takes over it calls `__clip.step(ms)` and takes a screenshot per frame.
 */
export function installClock() {
  const realSetInterval = window.setInterval.bind(window);
  const realNow = performance.now.bind(performance);
  const rafQ = new Map();
  const timers = new Map();
  let rid = 1, tid = 1, vt = 0;
  const api = { auto: true, frameMs: 1000 / 60 };
  window.__clip = api;
  window.requestAnimationFrame = (cb) => { const i = rid++; rafQ.set(i, cb); return i; };
  window.cancelAnimationFrame = (i) => { rafQ.delete(i); };
  performance.now = () => vt;
  window.setTimeout = (cb, ms = 0, ...args) => { const i = tid++; timers.set(i, { due: vt + Math.max(0, +ms || 0), cb: typeof cb === "function" ? cb : () => {}, args, every: 0 }); return i; };
  window.setInterval = (cb, ms = 0, ...args) => { const i = tid++; const e = Math.max(1, +ms || 1); timers.set(i, { due: vt + e, cb: typeof cb === "function" ? cb : () => {}, args, every: e }); return i; };
  window.clearTimeout = window.clearInterval = (i) => { timers.delete(i); };
  api.now = () => vt;
  // Date.now follows the virtual clock (the scripted cafe stamps its students with it); Math.random can be seeded
  const date0 = Date.now(), realDateNow = Date.now.bind(Date);
  Date.now = () => date0 + Math.round(vt);
  api.realDateNow = realDateNow;
  let seed = 1;
  api.seed = (n) => { seed = n >>> 0 || 1; };
  Math.random = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  api.freezeAnim = false;
  let avt = 0;

  // CSS transitions and animations run on the compositor's real clock: drive them from vt instead
  const born = new WeakMap();
  const syncAnimations = () => {
    let list;
    try { list = document.getAnimations(); } catch { return; }
    for (const a of list) {
      if (!born.has(a)) { born.set(a, avt); a.pause(); }
      const t = born.get(a);
      try { a.currentTime = avt - t; } catch { /* finished or detached */ }
    }
  };
  const fireTimers = (to) => {
    for (let guard = 0; guard < 10000; guard++) {
      let best = null, bi = 0;
      for (const [i, t] of timers) if (t.due <= to && (!best || t.due < best.due)) { best = t; bi = i; }
      if (!best) return;
      if (best.every) best.due += best.every; else timers.delete(bi);
      try { best.cb(...best.args); } catch (e) { console.error(e); }
    }
  };
  api.step = (ms) => {
    const to = vt + ms;
    if (!api.freezeAnim) avt += ms;
    fireTimers(vt);
    vt = to;
    fireTimers(vt);
    const cbs = [...rafQ.values()];
    rafQ.clear();
    for (const cb of cbs) { try { cb(vt); } catch (e) { console.error(e); } }
    syncAnimations();
    return vt;
  };
  let last = realNow();
  realSetInterval(() => {
    if (!api.auto) return;
    const n = realNow();
    api.step(Math.min(100, n - last));
    last = n;
  }, 16);
}
