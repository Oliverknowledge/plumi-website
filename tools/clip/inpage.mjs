/*
 * In-page helpers (injected as source after the town has booted, dev build only). They read and drive the REAL town engine
 * (`window.__town`) and the REAL room engine (`window.__plumiLibrary`) through the fields they already have at runtime; nothing
 * here edits engine code, and no engine file is changed.
 */
export function installHelpers() {
  const R = (window.__rec = {});
  const T = () => window.__town;
  const H = () => window.__plumiLibrary;
  R.images = {};

  /* ----- the cast: walking bodies built by the app's own wardrobe on another page, handed over as PNGs ----- */
  R.addCast = async (id, url) => { const im = new Image(); im.src = url; await im.decode(); R.images[id] = im; };
  R.art = (id) => { const im = R.images[id]; return { img: im, sy: 0, fw: Math.round(im.width / 78) }; };
  R.dress = (id) => T().setYou(R.art(id));

  /* ----- the town ----- */
  R.hideSpots = () => { T().data.spots.length = 0; };         // no sit rings or "E Sit" over furniture that is hidden
  R.place = (x, y, dir) => { const t = T(), you = t.you; t.teleport(x, y); you.dir = dir ?? 3; you.still = 0; you.speed = 0; you.stride = 0; t.keys.clear(); };
  /** The route's points joined by the engine's own planner every ~90 px, so a corner of a plaza or a lamp never stops the walker. */
  R.plan = (pts, gap = 90) => {
    const nav = T().world.nav, wp = [pts[0]];
    for (const p of pts) if (Math.hypot(p[0] - wp[wp.length - 1][0], p[1] - wp[wp.length - 1][1]) >= gap) wp.push(p);
    if (wp[wp.length - 1] !== pts[pts.length - 1]) wp.push(pts[pts.length - 1]);
    const out = []; let cur = wp[0];
    for (let i = 1; i < wp.length; i++) { const leg = nav.plan([cur[0], cur[1]], [wp[i][0], wp[i][1]]); if (leg) for (const q of leg) out.push([q[0], q[1]]); cur = wp[i]; }
    return out;
  };
  R.walk = (pts) => { const t = T(); t.setPath(t.you, R.plan(pts)); };
  R.state = () => { const t = T(), y = t.you; return { x: y.x, y: y.y, walking: y.walking, pathN: y.pathN, door: t.doorNow, sitting: y.sitting }; };
  R.key = (code, down = true) => window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, key: code.replace("Key", ""), bubbles: true, cancelable: true }));
  const near = (d, x, y) => { let b = 0, bd = Infinity; d.botNodes.forEach((n, i) => { const q = Math.hypot(n.x - x, n.y - y); if (q < bd) { bd = q; b = i; } }); return b; };
  const faceOf = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 3 : 1); };
  /** specs[i] for bot i: { pts, body?, name?, row? } walks a route; null parks the bot far away. */
  R.bots = (specs) => {
    const t = T(), d = t.data, bots = t.people.slice(1), you = t.you;
    bots.forEach((p, i) => {
      const s = specs[i];
      p.pathN = 0; p.walking = false; p.stride = 0; p.still = 0; p.prev = -1;
      if (s) p.name = s.pill === false ? "" : (s.name ?? p.name);
      if (s?.body) p.art = R.art(s.body); else if (s) p.art = { img: t.o.premade, sy: ((s.row ?? i) % Math.max(1, t.o.premadeRows - 1) + 1) * 32, fw: 16 };
      if (!s) {
        let b = 0, bd = -1; d.botNodes.forEach((n, k) => { const q = Math.hypot(n.x - you.x, n.y - you.y); if (q > bd) { bd = q; b = k; } });
        p.x = d.botNodes[b].x; p.y = d.botNodes[b].y; p.node = b; p.wait = 1e6; return;
      }
      p.x = s.pts[0][0]; p.y = s.pts[0][1]; p.dir = faceOf(s.pts[0], s.pts[Math.min(3, s.pts.length - 1)]);
      t.setPath(p, R.plan(s.pts));
      const end = s.pts[s.pts.length - 1];
      p.node = near(d, s.pts[0][0], s.pts[0][1]); p.target = near(d, end[0], end[1]); p.wait = 0;
    });
  };
  /** The camera's centre, art px, until R.follow(). */
  R.camAt = (cx, cy) => {
    const t = T();
    if (!t.__orig) t.__orig = { tx: t.targetX.bind(t), ty: t.targetY.bind(t), red: t.o.reduced };
    t.targetX = () => cx - t.viewW / 2; t.targetY = () => cy - t.viewH / 2; t.o.reduced = true;
  };
  R.follow = () => { const t = T(); if (!t.__orig) return; t.targetX = t.__orig.tx; t.targetY = t.__orig.ty; t.o.reduced = t.__orig.red; t.__orig = null; };
  R.view = () => { const t = T(); return { w: t.viewW, h: t.viewH, k: t.k }; };

  /* ----- the room behind a door ----- */
  R.roomReady = () => { const h = H(); return !!(h && h.you && h.a && h.people && h.people.length > 1 && document.querySelector("[data-testid=town-interior] canvas")); };
  R.roomInfo = () => { const h = H(); return { k: h.k, view: [h.viewW, h.viewH], room: [h.L.w, h.L.h], door: h.L.door, you: [h.you.x, h.you.y], seated: h.people.filter((p) => p.remote && p.at).length, remotes: h.people.filter((p) => p.remote).length }; };
  /** Draws you as this body, and keeps it (the app dresses you again once its own look has loaded). */
  R.roomDress = (id) => { const h = H(), a = R.art(id); h.dressYou(a.img, false, a.fw === 16 ? undefined : a.fw); h.dressYou = () => {}; };
  /** A free seat by its registry position (the chair's centre `at`); null when taken. */
  R.seat = (at) => { const h = H(); const s = h.spots.find((q) => (q.role === "seat" || q.role === "sofa") && Math.abs(q.x - (at[0] - 8)) <= 2 && Math.abs(q.y - (at[1] - 20)) <= 2); return s ? { free: !s.who, tile: s.tile, stand: h.W.centreOf(s.tile), x: s.x, y: s.y } : null; };
  /**
   * Where to walk so a chair's ring and the E prompt appear BEFORE you sit (tapping the chair itself would walk and sit in one go): the first floor point
   * within the prompt's reach of the chair's standing tile that is outside the chair's tap box, nearest the door. `at` is the chair's centre
   * (tools/art/rooms/*.seats.json); null picks the free chair nearest the door that is 60 to 260 px from it.
   */
  R.approach = (at) => {
    const h = H(), W = h.W, g = h.grid, d = h.L.door;
    let seats = h.ringSeats.filter((s) => !s.who);
    if (at) seats = seats.filter((s) => Math.abs(s.x - (at[0] - 8)) <= 2 && Math.abs(s.y - (at[1] - 20)) <= 2);
    else seats = seats.filter((s) => { const q = Math.hypot(s.x - d.x, s.y - d.y); return q > 60 && q < 260; }).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y));
    for (const s of seats) {
      const [cx, cy] = W.centreOf(s.tile), cands = [];
      for (let r = 6; r <= 18; r += 4) for (let a = 0; a < 16; a++) cands.push([cx + Math.cos((a / 16) * 6.283) * r, cy + Math.sin((a / 16) * 6.283) * r]);
      cands.sort((p, q) => Math.hypot(p[0] - d.x, p[1] - d.y) - Math.hypot(q[0] - d.x, q[1] - d.y));
      const ok = cands.find(([x, y]) => W.fits(g, x, y) && !(x >= s.x - 3 && x < s.x + 19 && y >= s.y + 4 && y < s.y + 36) && Math.hypot(x - cx, y - cy) < 19);
      if (ok) return { approach: ok, x: s.x, y: s.y };
    }
    return null;
  };
  /** Puts you back in the doorway (as if you had just come in), the camera on you. */
  R.roomEnter = () => { const h = H(), p = h.you; p.x = h.L.door.x; p.y = h.L.door.y; p.path = []; p.moving = false; p.doing = "idle"; p.alpha = 1; h.looking = null; h.keysDown.clear(); h.follow(true); };
  R.roomClick = (ax, ay) => {
    const h = H(), cv = document.querySelector("[data-testid=town-interior] canvas"), r = cv.getBoundingClientRect();
    const cx = r.left + ((ax - h.camX) * h.k + h.offX) / h.dpr, cy = r.top + ((ay - h.camY) * h.k + h.offY) / h.dpr;
    cv.dispatchEvent(new MouseEvent("click", { clientX: cx, clientY: cy, bubbles: true }));
  };
  R.roomState = () => { const h = H(), p = h.you; return { x: p.x, y: p.y, moving: p.doing === "walk" || p.doing === "enter" || p.path.length > 0, path: p.path.length, seated: !!h.seated, at: !!p.at, camX: h.camX, camY: h.camY }; };
  /** A speech bubble over the `rank`-th nearest other person (0 is the nearest), so it is always over someone in view. */
  R.bubbleNear = (rank, text, ms) => {
    const h = H(), you = h.you;
    const list = h.people.filter((p) => p.remote && p.id && p.alpha > 0.5).sort((a, b) => Math.hypot(a.x - you.x, a.y - you.y) - Math.hypot(b.x - you.x, b.y - you.y));
    const p = list[Math.min(rank, list.length - 1)];
    return p ? h.bubble(p.id, text, ms) : false;
  };

  /* ----- the end card (drawn in the page so it is pixel exact in both shapes) ----- */
  R.endcard = (a, title, sub) => {
    let el = document.getElementById("clip-end");
    if (!el) {
      el = document.createElement("div"); el.id = "clip-end";
      el.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.4vmin;background:#1c1a16;color:#fff6dc;font-family:Inter,'DejaVu Sans',sans-serif;pointer-events:none;opacity:0";
      el.innerHTML = `<div style="font-weight:700;font-size:12vmin;letter-spacing:-0.02em;line-height:1">${title}</div><div id="clip-end-sub" style="font-weight:500;font-size:3.6vmin;opacity:.82">${sub}</div>`;
      document.body.appendChild(el);
    }
    el.style.opacity = String(a * 0.78);
    el.firstChild.style.opacity = String(Math.max(0, Math.min(1, (a - 0.35) / 0.4)));
    document.getElementById("clip-end-sub").style.opacity = String(0.82 * Math.max(0, Math.min(1, (a - 0.6) / 0.4)));
  };
}

/*
 * The scripted cafe (social cut): the room opened ALONE (`/study/cafe/demo?alone=1`, nobody scripted), and everyone in it is put there by the recorder
 * through the room's own `setRemotes` (the call the app makes with who is on the floor), so each animal, seat, name, tag and walk is chosen, not random.
 * The app's own calls to `setRemotes` are switched off for the recording; the room draws, sorts, seats and animates them exactly as it does for people.
 */
export function installRoomHelpers() {
  const R = (window.__rec = window.__rec || {});
  const H = () => window.__plumiLibrary;
  R.images = R.images || {};
  R.addCast = R.addCast || (async (id, url) => { const im = new Image(); im.src = url; await im.decode(); R.images[id] = im; });
  R.crowd = {}; R.rev = 1; R.labels = {};
  R.roomReady = () => { const h = H(); return !!(h && h.you && h.a && h.L && h.grid && h.byIpad && h.byIpad.size > 0); };
  R.ipadAt = (at) => { const h = H(); for (const [i, s] of h.byIpad) if (Math.abs(s.x - (at[0] - 8)) <= 2 && Math.abs(s.y - (at[1] - 20)) <= 2) return i; return null; };
  R.roomTake = () => {
    const h = H();
    R._set = h.setRemotes.bind(h); h.setRemotes = () => {};
    h.dressYou = () => {};
    h.live.describe = (id) => R.labels[id] || null;
    const y = h.you; y.alpha = 0; y.x = -200; y.y = -200; y.path = []; y.doing = "idle";
  };
  const feet2art = (p) => [p[0] - 8, p[1] - 31];
  R.push = () => {
    const list = Object.values(R.crowd).map((c) => {
      const a = R.images[c.body];
      return { id: c.id, look: 0, pos: c.feet ? feet2art(c.feet) : null, seat: c.seat ?? null, path: (c.path || []).map(feet2art), seated: !!c.seated, sheet: a, phones: false, frameW: Math.round(a.width / 78), rev: c.rev };
    });
    R._set(list);
  };
  /** Adds or changes someone: { id, body, name, tag, feet, path, seat, seated }; every change is a new piece of news about them (`rev`). */
  R.put = (c) => {
    const cur = R.crowd[c.id] || {};
    R.crowd[c.id] = { ...cur, ...c, rev: R.rev++ };
    if (c.nolabel) R.labels[c.id] = null;
    else if (c.name !== undefined || c.tag !== undefined) R.labels[c.id] = { name: R.crowd[c.id].name, tag: R.crowd[c.id].tag ?? null, friend: false, pro: false };
    R.push();
  };
  /** The walk from a feet point to the standing tile of a chair (feet points). */
  R.way = (ipad, from) => { const h = H(), s = h.byIpad.get(ipad); return h.W.plan(h.grid, from, s.tile); };
  R.watch = {};
  /** Call every frame: whoever has walked to their chair sits down (the room snaps them into it). */
  R.tick = () => { for (const [id, ipad] of Object.entries(R.watch)) if (R.arrived(id)) { delete R.watch[id]; R.put({ id, seat: ipad, seated: true, feet: null, path: [] }); } };
  R.person = (id) => { const h = H(); return h.remotes.get(id) || null; };
  R.arrived = (id) => { const p = R.person(id); return !!p && p.path.length === 0 && p.doing !== "walk"; };
  R.say = (id, text, ms) => H().bubble(id, text, ms);
  let camT = [320, 224];
  R.roomCamTo = (cx, cy) => { camT = [cx, cy]; };
  R.roomCam = (cx, cy) => {
    const h = H(); camT = [cx, cy];
    h.follow = (snap = false) => {
      const tx = Math.min(Math.max(camT[0] - h.viewW / 2, 0), h.L.w - h.viewW), ty = Math.min(Math.max(camT[1] - h.viewH / 2, 0), h.L.h - h.viewH);
      h.followLive(tx, ty, snap, false);
    };
    h.follow(true);
  };
  /** The room's zoom as a choice, see forceKTown: any whole `k` at the real density. Calling it again is a cut to another k. */
  R.forceKRoom = (K) => {
    const h = H();
    h.resize = function () {
      const box = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1, W = Math.round(box.width * dpr), H2 = Math.round(box.height * dpr);
      this.dpr = dpr;
      if (this.canvas.width !== W || this.canvas.height !== H2) { this.canvas.width = W; this.canvas.height = H2; }
      this.k = K; this.viewW = Math.min(this.L.w, W / K); this.viewH = Math.min(this.L.h, H2 / K);
      this.offX = Math.max(0, Math.round((W - this.viewW * K) / 2)); this.offY = Math.max(0, Math.round((H2 - this.viewH * K) / 2));
      this.follow(true);
    };
    h.resize();
  };
  R.roomView = () => { const h = H(); return { k: h.k, w: h.viewW, h: h.viewH, camX: h.camX, camY: h.camY, door: h.L.door }; };
}

/*
 * Name tags and speech bubbles over the TOWN's walkers, in the same cream pill and white bubble the room uses (`.lb-nm`, `.lb-bub`), so outdoors and indoors
 * match. The engine's own pills are monospace boxes and it has no bubbles; these are DOM elements placed from the engine's camera every frame.
 */
export function installTownUi() {
  const R = (window.__rec = window.__rec || {});
  const T = () => window.__town;
  const host = document.querySelector(".pa") || document.body;
  const ov = document.createElement("div");
  ov.className = "lb-ov"; ov.id = "clip-ov"; ov.style.cssText = "position:fixed;inset:0;z-index:45;pointer-events:none;overflow:hidden";
  host.appendChild(ov);
  const tags = [], bubs = [];
  /**
   * The engine picks its zoom from the screen (k = round(width / 400), or 240 under 560 css px) and caps the density at 3. For a recording the zoom is a choice:
   * this replaces the engine's `resize` on this instance with one that takes any whole `k` at the browser's real density, so one art pixel is exactly k screenshot pixels.
   */
  R.forceKTown = (K) => {
    const t = T();
    t.resize = function () {
      const cv = this.o.canvas, box = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1, W = Math.round(box.width * dpr), H = Math.round(box.height * dpr);
      this.dpr = dpr; this.k = K; this.W = W; this.H = H; this.viewW = W / K; this.viewH = H / K;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      this.ctx.imageSmoothingEnabled = false;
      this.camX = this.targetX(); this.camY = this.targetY(); this.clampCam();
    };
    t.resize();
  };
  R.tag = (bot, name) => { const el = document.createElement("div"); el.className = "lb-nm"; el.textContent = name; ov.appendChild(el); tags.push({ el, bot }); };
  R.bub = (bot, text, ms, dx) => {
    const el = document.createElement("div"); el.className = "lb-bub"; el.textContent = text; el.style.setProperty("--bub-ms", ms + "ms"); ov.appendChild(el);
    bubs.push({ el, bot, born: performance.now(), ms, dx: dx || 0 });
  };
  /** Place every tag and bubble from this frame's camera (call after a step). */
  R.uiFrame = () => {
    const t = T(); if (!t) return;
    const k = t.k, dpr = t.dpr, cx = t.camPxX, cy = t.camPxY;
    const at = (p, up) => [Math.round(p.x * k - cx) / dpr, Math.round((p.y - up) * k - cy) / dpr];
    for (const g of tags) { const p = t.people[1 + g.bot], [x, y] = at(p, 31); g.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }
    for (let i = bubs.length - 1; i >= 0; i--) {
      const g = bubs[i];
      if (performance.now() - g.born > g.ms + 50) { g.el.remove(); bubs.splice(i, 1); continue; }
      const p = t.people[1 + g.bot], [x, y] = at(p, 31 + 9);
      g.el.style.transform = `translate(${x + (g.dx || 0)}px, ${y}px) translate(-50%, -100%)`;
    }
  };
}
