/*
 * Runs INSIDE the page (injected by measure.mjs). Two parts:
 *   1. installClock(): a virtual clock, injected before the app boots. requestAnimationFrame and performance.now are
 *      replaced by a queue that only moves when asked, so a run is deterministic: exactly 60 display frames a second,
 *      the way the reference clip was recorded. While `__vt.auto` is true a real-time pump keeps the page alive (boot).
 *   2. installHelpers(): reads the real engine (window.__plumiLibrary, dev only) and drives it with synthetic keys.
 * Nothing here edits engine code. It reads private fields (camX, you.x, frame()) which exist at runtime.
 */

export function installClock() {
  const q = new Map();
  let id = 1, vt = 0;
  const vtApi = { auto: true, frameMs: 1000 / 60 };
  window.__vt = vtApi;
  window.requestAnimationFrame = (cb) => { const i = id++; q.set(i, cb); return i; };
  window.cancelAnimationFrame = (i) => { q.delete(i); };
  const realNow = performance.now.bind(performance);
  performance.now = () => vt;
  vtApi.now = () => vt;
  vtApi.advance = (ms) => {
    vt += ms;
    const cbs = [...q.values()];
    q.clear();
    for (const cb of cbs) { try { cb(vt); } catch (e) { console.error(e); } }
  };
  // real-time pump while booting (the entry door animation, image decode and so on need frames)
  let last = realNow();
  setInterval(() => {
    if (!vtApi.auto) return;
    const n = realNow();
    vtApi.advance(Math.min(100, n - last));
    last = n;
  }, 16);
}

export function installHelpers() {
  const DIRS = ["right", "back", "left", "front"];
  const H = () => window.__plumiLibrary;
  const canvas = () => document.querySelector(".lb-room canvas") || document.querySelector("canvas");
  const people = () => H().people;
  const pick = (who) => who === "you" || who == null ? H().you : people().filter((p) => p.remote)[who];

  const rec = (p) => {
    const h = H(), tick = Math.floor(h.t * h.L.fps);
    const [sx, sy] = h.spriteAt(p);
    return [window.__vt.now(), h.t, p.x, p.y, sx, sy, h.frame(p, tick), DIRS.indexOf(p.dir), p.moving || p.path.length ? 1 : 0, p.path.length, h.camX, h.camY, p.fw || 16];
  };

  const key = (type, code) => {
    const cv = canvas();
    cv.dispatchEvent(new KeyboardEvent(type, { code, key: code.replace("Key", "").replace("Arrow", ""), bubbles: true, cancelable: true }));
  };
  const click = (ax, ay) => {
    const h = H(), cv = canvas(), r = cv.getBoundingClientRect();
    const cx = r.left + ((ax - h.camX) * h.k + h.offX) / h.dpr, cy = r.top + ((ay - h.camY) * h.k + h.offY) / h.dpr;
    cv.dispatchEvent(new MouseEvent("click", { clientX: cx, clientY: cy, bubbles: true }));
  };
  const frames = (n, out, who) => {
    for (let i = 0; i < n; i++) {
      window.__vt.advance(window.__vt.frameMs);
      if (out) out.push(rec(pick(who)));
    }
  };
  const tele = (p, x, y) => {
    const h = H();
    p.x = x; p.y = y; p.path = []; p.moving = false; p.doing = "idle";
    if (p === h.you) { h.looking = null; h.heading = [0, 0]; h.keysDown.clear(); h.follow(true); }
  };

  /** A spec is a list of steps: {n frames, down:[codes], up:[codes], tele:[x,y], click:[ax,ay], path:[[x,y]..]} for `who`. */
  const run = (spec, who) => {
    const out = [];
    const marks = {};
    H().last = window.__vt.now();   // the loop's 30 Hz gate starts from the same phase every run
    for (const s of spec) {
      const p = pick(who);
      if (s.tele) tele(p, s.tele[0], s.tele[1]);
      if (s.path) { p.path = s.path.map(([x, y]) => [x, y]); p.doing = "walk"; p.alpha = 1; p.speed = s.speed ?? p.speed; }
      if (s.mark) marks[s.mark] = window.__vt.now();
      for (const c of s.down || []) key("keydown", c);
      for (const c of s.up || []) key("keyup", c);
      if (s.click) click(s.click[0], s.click[1]);
      frames(s.n || 0, s.rec === false ? null : out, who);
    }
    return { rows: out, marks };
  };

  /** Constants of the view at this moment. */
  const view = () => {
    const h = H();
    return { k: h.k, dpr: h.dpr, offX: h.offX, offY: h.offY, viewW: h.viewW, viewH: h.viewH, roomW: h.L.w, roomH: h.L.h, fps: h.L.fps, fw: h.you.fw || 16, speed: h.you.speed, rows: h.L.people.rows };
  };

  /** Where the camera would settle for a player standing at (x, y): the engine's own follow() maths, no smoothing. */
  const camTarget = (x, y) => {
    const h = H(), p = h.you, fw = p.fw || 16, half = fw / 2;
    const sx = Math.round(x) - 8 - (p.fw ? (p.fw - 16) / 2 : 0), sy = Math.round(y) - 31;
    const cx = sx + half, cy = sy + 18 - h.viewH * 0.2;
    return [Math.min(Math.max(cx - h.viewW / 2, 0), h.L.w - h.viewW), Math.min(Math.max(cy - h.viewH / 2, 0), h.L.h - h.viewH)];
  };

  /**
   * A polyline of straight runs, segs = [[dx, dy, len], ...], from (x, y): every point free to walk (the engine's own
   * `fits`), and the camera never clamped on the way, so the follow lag is visible rather than hidden by a wall.
   */
  const pathOk = (x, y, segs, margin = 24) => {
    const h = H(), W = h.W, g = h.grid;
    let cx = x, cy = y;
    const pts = [];
    for (const [dx, dy, len] of segs) {
      for (let d = 0; d <= len + margin; d += 2) {
        const px = cx + dx * d, py = cy + dy * d;
        if (!W.fits(g, px, py)) return false;
        if (d <= len) pts.push([px, py]);
      }
      cx += dx * len; cy += dy * len;
    }
    for (let i = 0; i < pts.length; i += 10) {
      const [tx, ty] = camTarget(pts[i][0], pts[i][1]);
      if (tx <= 0.5 || tx >= h.L.w - h.viewW - 0.5 || ty <= 0.5 || ty >= h.L.h - h.viewH - 0.5) return false;
    }
    return true;
  };
  const findPath = (segs) => {
    const cands = [];
    for (let y = 150; y <= 560; y += 4) for (let x = 200; x <= 760; x += 4) cands.push([x, y]);
    cands.sort((a, b) => Math.hypot(a[0] - 480, a[1] - 330) - Math.hypot(b[0] - 480, b[1] - 330));
    for (const [x, y] of cands) if (pathOk(x, y, segs)) return [x, y];
    return null;
  };
  const findStart = (dx, dy, len) => findPath([[dx, dy, len]]);

  /** Pixel statistics of a person's sheet: sprite height, shadow, head bob and foot lift per walk frame. */
  const art = (p) => {
    const h = H(), R = h.L.people.rows, fw = p.fw || 16;
    const img = p.sheet ?? h.a.people, sy = p.sheet ? 0 : p.look * 32;
    const cv = document.createElement("canvas");
    cv.width = fw; cv.height = 32;
    const c = cv.getContext("2d", { willReadFrequently: true });
    const stats = (f) => {
      c.clearRect(0, 0, fw, 32);
      c.drawImage(img, f * fw, sy, fw, 32, 0, 0, fw, 32);
      const d = c.getImageData(0, 0, fw, 32).data;
      let top = -1, bot = -1, semi = 0, semiW = 0, semiRows = [];
      const opaqueRows = [];
      for (let y = 0; y < 32; y++) {
        let o = 0, s = 0;
        for (let x = 0; x < fw; x++) {
          const a = d[(y * fw + x) * 4 + 3];
          if (a >= 200) o++; else if (a > 0) s++;
        }
        opaqueRows.push(o);
        if (o > 0) { if (top < 0) top = y; bot = y; }
        if (s > 0) { semi += s; semiRows.push(y); }
      }
      // shadow: semi-transparent pixels (or pixels under the feet) in the lowest rows
      let sw = 0;
      for (let x = 0; x < fw; x++) { let any = false; for (let y = 24; y < 32; y++) { const a = d[(y * fw + x) * 4 + 3]; if (a > 0 && a < 200) any = true; } if (any) sw++; }
      void semiW;
      return { top, bot, rows: bot - top + 1, semi, shadowW: sw, shadowRows: semiRows.length ? [Math.min(...semiRows), Math.max(...semiRows)] : null };
    };
    const out = { fw, idle: [], walk: [] };
    for (let d = 0; d < 4; d++) {
      out.idle.push(stats(R.idle + d * 6));
      out.walk.push([0, 1, 2, 3, 4, 5].map((i) => stats(R.walk + d * 6 + i)));
    }
    return out;
  };


  /**
   * Is there a ground shadow? Render the room with the person and without (alpha 0) and compare the scene canvas under
   * the feet, on pixels the sprite itself does not cover: a darker patch there is a shadow drawn by the engine.
   */
  const shadow = (p) => {
    const h = H(), fw = p.fw || 16, img = p.sheet ?? h.a.people, sy0 = p.sheet ? 0 : p.look * 32;
    const [sx, sy] = h.spriteAt(p), tick = Math.floor(h.t * h.L.fps), f = h.frame(p, tick);
    const x0 = Math.max(0, sx - 8), w = fw + 16, y0 = sy + 22, hgt = 16;
    const sc = h.scene.getContext("2d", { willReadFrequently: true });
    const grab = () => { h.draw(); return sc.getImageData(x0, y0, w, hgt).data; };
    const tmp = document.createElement("canvas"); tmp.width = w; tmp.height = hgt;
    const tc = tmp.getContext("2d", { willReadFrequently: true });
    tc.drawImage(img, f * fw, sy0, fw, 32, sx - x0, -22, fw, 32);
    const m = tc.getImageData(0, 0, w, hgt).data;
    const a1 = grab(); const old = p.alpha; p.alpha = 0; const a0 = grab(); p.alpha = old; h.draw();
    const lum = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    let px = 0, drop = 0, control = 0; const cols = new Set(); const rowsSet = new Set();
    for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (m[i + 3] > 0) { if (Math.abs(lum(a0, i) - lum(a1, i)) > 8) control++; continue; }
      const d = lum(a0, i) - lum(a1, i);
      if (d > 8) { px++; drop += d; cols.add(x); rowsSet.add(y); }
    }
    return { control, px, width: cols.size, height: rowsSet.size, meanDrop: px ? drop / px : 0 };
  };

  const facing = () => H().you.dir;
  const info = () => {
    const h = H();
    return { people: h.people.map((p, i) => ({ i, remote: !!p.remote, you: !!p.you, at: !!p.at, fw: p.fw || 16, x: p.x, y: p.y, hasSheet: !!p.sheet })) };
  };
  window.__mv = { shadow, rec, key, click, frames, tele, run, view, camTarget, pathOk, findPath, findStart, art, facing, info, pick, DIRS };
}
