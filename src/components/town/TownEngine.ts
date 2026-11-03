import { MOVE, approach, idleFrame, walkFrame } from "@/lib/town/movement";
import { ChunkCache } from "@/lib/town/chunks";
import { allObjects } from "@/lib/town/objects";
import { makeGroundCtx, paintChunk, type GroundAtlas, type GroundCtx } from "@/lib/town/ground";
import { unrle } from "@/lib/town/plan";
import { CHUNK_TILES, TILE, type AtlasName, type DoorKind, type SitSpot, type TownData, type TownObject } from "@/lib/town/types";
import { World } from "@/lib/town/world";
import { facing, type Face as WFace } from "@/lib/studyapp/library/walk";
import type { TimeOfDay } from "@/lib/studyapp/library/entry";
import { Ambient } from "./ambient";

/**
 * The town engine (docs/study/town.md). A NEW engine, not cafeScene.ts: it draws straight to the screen canvas at an INTEGER scale `k`
 * (one art pixel = k device pixels, exactly; imageSmoothingEnabled = false), the camera and every sprite placed at whole DEVICE pixels, so
 * a walker moves in steps of one device pixel while the art stays crisp (the reference game's way: movement-gap.md G1).
 *
 *   ground      baked in chunks of 16 x 16 tiles (512 x 512 art px) into pooled canvases with a small LRU (`ChunkCache`), blitted scaled
 *   objects     sorted by their base line `sortY`; a walker is sorted by his feet y, so a canopy, a roof or a wall covers whoever is behind it
 *   people      the library's frames (16 wide people, 34 wide animals, feet at row 31), a soft shadow under each, a 12 Hz per-walker pose clock
 *   camera      locked to the walker while he walks; eased for pans, sitting and standing
 *   labels      one overlay canvas (prompts, bot names, the debug HUD and placeholder labels)
 *   frame()     allocates nothing: the draw items are pooled and insertion-sorted in place (`items`), no arrays or closures are made
 *
 * Units: art px for the world, device px for the screen. Movement numbers: src/lib/town/movement.ts.
 */

const DIRS: readonly WFace[] = ["right", "back", "left", "front"];
const DIR_OF: Record<string, number> = { right: 0, back: 1, left: 2, front: 3 };
const POSE = { idle: 0, walk: 24, sit: 48, phone: 60, read: 66, stool: 72 } as const;
const NEAR_SPOT = 6 * TILE;          // rings show for seats within about 6 tiles
const SIT_REACH = 30;                // E sits in a seat whose stand point or seat is this close
const PATH_CAP = 400;                // points in a walk (x, y pairs: 2 floats each): a walk across the whole map is a few dozen straight runs
const RING_VIEW = 6 * TILE;
const QUIET_MS = 3000;               // lateness and slow frames are not judged for this long after the page, a tab or the window changed

/** `img2`: the same frames at 2x in each direction (an animal's @2x strip): drawn over the same box when k is an even number, so a pixel of it is k / 2 whole device pixels. */
export interface PlayerArt { img: CanvasImageSource; sy: number; fw: number; img2?: CanvasImageSource }
export interface TownEvent { kind: "enter" | "knock" | "sit" | "stand"; id: string; door?: DoorKind }
export interface TownOptions {
  canvas: HTMLCanvasElement; overlay: HTMLCanvasElement;
  data: TownData; images: Record<AtlasName | "ground", CanvasImageSource>;
  /** The premade strip (data.premade): row 0 is your first look, the others the bots'. */
  premade: CanvasImageSource; premadeRows: number;
  bots: number; debug: boolean; placeholders: boolean; reduced: boolean;
  onEvent?: (e: TownEvent) => void;
  /** Where you start (feet) and which way you face (0 right, 1 back, 2 left, 3 front); the spawn when absent. */
  start?: { x: number; y: number; dir?: number };
  /** `30`, `60` or `auto` (the page's `?hz=`; absent: the `plumi-hz` storage key, else auto). Read once. */
  hz?: string;
  /** Reads the font family for labels (a CSS font stack). */
  font?: string;
  /** The backing scale to start at (the page's `?backing=0.5..1`; the governor lowers it by itself when the screen cannot be filled fast enough). */
  backing?: number;
  /** Pins the hour's tint (the page's `?tod=dawn|day|evening|night`); absent: the student's own clock. */
  tod?: TimeOfDay;
}
export interface TownStats {
  fps: number; targetFps: number; p50: number; p95: number; frames: number; chunks: number; evictions: number; bakes: number;
  k: number; viewW: number; viewH: number; firstFrameMs: number; items: number; heapMB: number;
}

class Person {
  x = 0; y = 0; dir = 3; walking = false; stride = 0; still = 0; phase = 0;
  path = new Float64Array(PATH_CAP * 2); pathN = 0; pathI = 0;
  art: PlayerArt = { img: null as unknown as CanvasImageSource, sy: 0, fw: 16 };
  sitting = false; spot: SitSpot | null = null; pending: SitSpot | null = null;
  bot = false; name = ""; wait = 0; node = 0; target = -1; prev = -1;
  vx = 0; vy = 0; speed = 0; blockedFor = 0;
}

interface Item {
  z: number; kind: number;          // 1 sprite, 2 person, 3 shadow, 4 placeholder half, 5 ring
  img: CanvasImageSource | null;
  sx: number; sy: number; sw: number; sh: number; dx: number; dy: number;   // source rect; dest top left in WORLD art px (floats for people)
  p: Person | null; o: TownObject | null; f: number; half: number; flag: number;
}

export class TownEngine {
  private ctx: CanvasRenderingContext2D;
  /** Labels draw on the one canvas (a second full size layer was a compositor cost for a few pills). */
  private lab: CanvasRenderingContext2D;
  private amb: Ambient;
  readonly world: World;
  private d: TownData;
  private o: TownOptions;
  // view
  k = 3; private dpr = 1; backing = 1; private rasterSlow = 0; private W = 0; private H = 0; viewW = 0; viewH = 0;
  private camX = 0; private camY = 0; private camPxX = 0; private camPxY = 0;
  // state
  private t = 0;
  private you = new Person();
  private people: Person[] = [];
  private objects: TownObject[];
  private sprites: Record<string, TownData["sprites"][string]>;
  private doors: TownObject[] = [];
  private maxW = 0; private maxH = 0;
  private ground: GroundCtx; private atlasData: GroundAtlas; private chunkBuf: ImageData; private slabBuf: ImageData; private slab: { key: number; row: number } | null = null; slabs = 0; private scratch = new Uint8Array((CHUNK_TILES * TILE + 4) ** 2);
  private pendingDoor: TownObject | null = null;
  private doorNow = -1;
  keys = new Set<string>();
  private chunks: ChunkCache<HTMLCanvasElement>;
  private chunksX: number;
  private items: Item[] = []; private pool: Item[] = []; private itemN = 0;
  private ringImg: HTMLCanvasElement[] = [];
  private shadowImg: HTMLCanvasElement;
  private spotsNear: SitSpot[] = [];
  private nearNow: SitSpot | null = null;
  private out = new Float64Array(2);
  private spotObj = new Map<number, TownObject>();
  // loop
  private raf = 0; private last = 0; private acc = 0; private running = false; private dead = false;
  private targetFps: number = MOVE.fps;
  private hzMode: "auto" | "30" | "60" = "auto"; private quietUntil = 0; private hzSaid = false;
  private ms = new Float32Array(240); private msN = 0; private msI = 0; private lastFpsT = 0; private fpsFrames = 0; fps = 0;
  private slowSince = 0; private fastSince = 0; private p50 = 0; private p95 = 0; frames = 0; firstFrameMs = 0;
  private cleanup: (() => void)[] = [];
  private fontFamily: string;
  // bots
  private legs = new Map<number, Float64Array>(); private links: number[][] = []; private nodes: { x: number; y: number }[] = [];
  private legsReady = false;
  private visible = true;

  constructor(opts: TownOptions) {
    this.o = opts; this.d = opts.data;
    if (opts.backing && opts.backing >= 0.4 && opts.backing <= 1) this.backing = opts.backing;
    this.ctx = opts.canvas.getContext("2d", { alpha: false })!;
    this.lab = this.ctx;
    this.world = new World(this.d);
    this.sprites = this.d.sprites;
    // objects sorted by depth once; the frame loop only culls them
    this.objects = [...allObjects(this.d)].sort((a, b) => a.sortY - b.sortY);
    for (const sp of Object.values(this.d.sprites)) { this.maxW = Math.max(this.maxW, sp.w); this.maxH = Math.max(this.maxH, sp.h); }
    this.doors = this.objects.filter((o) => o.door);
    this.amb = new Ambient(this.objects, this.sprites, opts.reduced, opts.tod);
    if (opts.tod) this.amb.fixedTod = true;
    const byId = new Map(this.d.objects.map((o) => [o.id, o]));
    for (const s of this.d.spots) { const ob = byId.get(s.object); if (ob) this.spotObj.set(s.id, ob); }
    this.chunksX = Math.ceil(this.d.cols / CHUNK_TILES);
    this.ground = makeGroundCtx(this.d, this.objects.filter((o) => o.kind === "tree").map((o) => ({ x: o.x, y: o.y })), unrle(this.d.mat.rle, this.d.mat.cols * this.d.mat.rows));
    { const im = opts.images.ground as HTMLImageElement, cv = document.createElement("canvas"); cv.width = im.naturalWidth || im.width; cv.height = im.naturalHeight || im.height; const c = cv.getContext("2d")!; c.drawImage(im, 0, 0); const id = c.getImageData(0, 0, cv.width, cv.height); this.atlasData = { w: cv.width, h: cv.height, data: id.data }; }
    this.chunkBuf = new ImageData(CHUNK_TILES * TILE, CHUNK_TILES * TILE); this.slabBuf = new ImageData(CHUNK_TILES * TILE, CHUNK_TILES * TILE);
    this.chunks = new ChunkCache<HTMLCanvasElement>(12, (key, recycled) => this.bake(key, recycled));
    this.fontFamily = opts.font ?? "ui-monospace, monospace";
    { let v = opts.hz ?? null; if (v === null) { try { v = localStorage.getItem("plumi-hz"); } catch { v = null; } } this.hzMode = v === "30" || v === "60" ? v : "auto"; }
    if (this.hzMode === "30") this.targetFps = MOVE.fallbackFps;
    opts.canvas.dataset.hz = String(this.targetFps); opts.canvas.dataset.hzWhy = this.hzMode === "auto" ? "auto" : `forced ${this.hzMode}`;
    this.quietUntil = performance.now() + QUIET_MS;
    this.shadowImg = this.makeShadow();
    this.ringImg = [this.makeRing(false), this.makeRing(true)];
    // you
    const y = this.you;
    y.x = opts.start?.x ?? this.d.spawn.x; y.y = opts.start?.y ?? this.d.spawn.y; y.dir = opts.start?.dir ?? 3;
    y.art = { img: opts.premade, sy: 0, fw: 16 };
    this.people.push(y);
    this.resize();
    this.camX = this.targetX(); this.camY = this.targetY(); this.clampCam();
    this.bind();
    if (opts.bots > 0) this.makeBots(opts.bots);
  }

  /* ---------- public ---------- */
  setYou(art: PlayerArt) { this.you.art = art; }
  start() { if (this.running || this.dead) return; this.running = true; this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.raf = 0; }
  dispose() { this.stop(); this.dead = true; for (const c of this.cleanup) c(); this.cleanup.length = 0; }
  /** Draws one frame now (also what the loop calls). Exposed for tests and the reduced-motion path. */
  renderNow() { this.frame(0); }
  /** Where the bots are (feet), for the minimap. */
  botPositions(): { x: number; y: number }[] { const out: { x: number; y: number }[] = []; for (let i = 1; i < this.people.length; i++) out.push({ x: this.people[i].x, y: this.people[i].y }); return out; }
  /** The world rectangle on screen, art px. */
  viewRect() { return { x: this.camX, y: this.camY, w: this.viewW, h: this.viewH }; }
  get data() { return this.d; }
  youPos() { return { x: this.you.x, y: this.you.y, sitting: this.you.sitting, walking: this.you.walking, dir: DIRS[this.you.dir] }; }
  /** For the browser checks: teleport (feet) and walk to a point. */
  teleport(x: number, y: number) { const p = this.you; p.x = x; p.y = y; p.pathN = 0; p.walking = false; this.camX = this.targetX(); this.camY = this.targetY(); this.clampCam(); }
  walkTo(x: number, y: number): boolean { this.pendingDoor = null; return this.planFor(this.you, x, y, null); }
  press(code: string, down: boolean) { if (down) this.keys.add(code); else this.keys.delete(code); }
  sitAt(spotId: number) { const s = this.d.spots.find((q) => q.id === spotId); if (s) this.goSit(s); }
  stats(): TownStats {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return {
      fps: this.fps, targetFps: this.targetFps, p50: this.p50, p95: this.p95, frames: this.frames, chunks: this.chunks.size, evictions: this.chunks.evictions,
      bakes: this.chunks.bakes, k: this.k, viewW: this.viewW, viewH: this.viewH, firstFrameMs: this.firstFrameMs, items: this.itemN, heapMB: mem ? mem.usedJSHeapSize / 1048576 : 0,
    };
  }
  /** The raw draw-ms ring buffer (most recent `n`), for the performance checks. */
  drawTimes(): number[] { const n = Math.min(this.msN, this.ms.length), out: number[] = []; for (let i = 0; i < n; i++) out.push(this.ms[i]); return out; }

  /** The whole map in one canvas at `scale` (ground chunks, then every object in depth order; no people, no labels): for the overview and the minimap. */
  overview(scale: number, withObjects = true, treeline = true): HTMLCanvasElement {
    const S = CHUNK_TILES * TILE, w = this.d.cols * TILE, h = this.d.rows * TILE;
    const cv = document.createElement("canvas");
    cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
    const c = cv.getContext("2d")!;
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#6d8f3c"; c.fillRect(0, 0, cv.width, cv.height);
    const cy = Math.ceil(this.d.rows / CHUNK_TILES);
    for (let j = 0; j < cy; j++) for (let i = 0; i < this.chunksX; i++) {
      const tmp = document.createElement("canvas"); tmp.width = S; tmp.height = S;
      paintChunk(this.ground, this.atlasData, i, j, this.chunkBuf.data, this.scratch);
      tmp.getContext("2d")!.putImageData(this.chunkBuf, 0, 0);
      c.drawImage(tmp, 0, 0, S, S, Math.round(i * S * scale), Math.round(j * S * scale), Math.ceil(S * scale), Math.ceil(S * scale));
    }
    if (withObjects) for (const o of this.objects) {
      if (!o.sprite || (!treeline && o.zone === "treeline")) continue;
      const sp = this.sprites[o.sprite];
      c.drawImage(this.o.images[sp.atlas], sp.x, sp.y, sp.w, sp.h, Math.round(o.sx * scale), Math.round(o.sy * scale), Math.max(1, Math.round(sp.w * scale)), Math.max(1, Math.round(sp.h * scale)));
    }
    return cv;
  }

  /* ---------- zoom: the library's rule (cafeScene.ts resize), integer scale only ---------- */
  resize() {
    const box = this.o.canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    let dpr = Math.min(3, window.devicePixelRatio || 1) * this.backing;
    let W = Math.round(box.width * dpr), H = Math.round(box.height * dpr);
    // the library's window onto the room: 400 art px across (240 on a phone), so a person is the size he is in the library at that viewport
    const want = box.width < 560 ? 240 : 400;
    let k = Math.max(1, Math.round(W / want));
    // past the pixel budget fewer device pixels go to each art pixel, and the density drops with it
    const BUDGET = 6_000_000;
    if (W * H > BUDGET) {
      const k2 = Math.max(1, Math.floor(k * Math.sqrt(BUDGET / (W * H))));
      if (k2 < k) { dpr = (dpr * k2) / k; W = Math.round(box.width * dpr); H = Math.round(box.height * dpr); k = k2; }
    }
    this.dpr = dpr; this.k = k;
    const cv = this.o.canvas, ov = this.o.overlay;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    if (ov.width !== 1) { ov.width = 1; ov.height = 1; }          // the overlay canvas is no longer drawn on
    this.W = W; this.H = H; this.viewW = W / k; this.viewH = H / k;
    this.ctx.imageSmoothingEnabled = false;
    this.camX = this.targetX(); this.camY = this.targetY(); this.clampCam();
  }

  /* ---------- ground chunks ---------- */
  private bake(key: number, recycled: HTMLCanvasElement | null): HTMLCanvasElement {
    const S = CHUNK_TILES * TILE;
    const cv = recycled ?? document.createElement("canvas");
    if (cv.width !== S) { cv.width = S; cv.height = S; }
    paintChunk(this.ground, this.atlasData, key % this.chunksX, Math.floor(key / this.chunksX), this.chunkBuf.data, this.scratch);
    cv.getContext("2d")!.putImageData(this.chunkBuf, 0, 0);
    return cv;
  }

  /**
   * Ground that the camera is about to need is painted ahead, one slab of 64 rows a frame (about 3 ms; a whole chunk is 25 to 40 ms and would be a visible
   * hitch at the edge of a chunk). Chunks within 192 art px of the view, nearest first; the view's own chunks are painted at once by `get` when missing
   * (after a teleport, behind the fade).
   */
  private prebake() {
    const S = CHUNK_TILES * TILE, M = 192, cy1 = Math.ceil(this.d.rows / CHUNK_TILES) - 1;
    if (!this.slab) {
      const x0 = Math.max(0, Math.floor((this.camX - M) / S)), x1 = Math.min(this.chunksX - 1, Math.floor((this.camX + this.viewW + M) / S));
      const y0 = Math.max(0, Math.floor((this.camY - M) / S)), y1 = Math.min(cy1, Math.floor((this.camY + this.viewH + M) / S));
      let best = -1, bd = Infinity;
      for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
        const k = j * this.chunksX + i;
        if (this.chunks.has(k)) continue;
        const dd = Math.hypot((i + 0.5) * S - (this.camX + this.viewW / 2), (j + 0.5) * S - (this.camY + this.viewH / 2));
        if (dd < bd) { bd = dd; best = k; }
      }
      if (best < 0) return;
      this.slab = { key: best, row: 0 };
    }
    const s = this.slab, rows = 64;
    paintChunk(this.ground, this.atlasData, s.key % this.chunksX, Math.floor(s.key / this.chunksX), this.slabBuf.data, this.scratch, s.row, s.row + rows);
    s.row += rows; this.slabs++;
    if (s.row >= CHUNK_TILES * TILE) {
      const cv = this.chunks.recycle() ?? document.createElement("canvas");
      if (cv.width !== s.row) { cv.width = s.row; cv.height = s.row; }
      cv.getContext("2d")!.putImageData(this.slabBuf, 0, 0);
      this.chunks.insert(s.key, cv);
      this.slab = null;
    }
  }

  private makeShadow(): HTMLCanvasElement {
    const { w, h, r, g, b, a } = MOVE.shadow, cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const c = cv.getContext("2d")!, img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2), ny = (y + 0.5 - h / 2) / (h / 2);
      if (nx * nx + ny * ny <= 1) { const i = (y * w + x) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = Math.round(a * 255); }
    }
    c.putImageData(img, 0, 0);
    return cv;
  }
  private makeRing(near: boolean): HTMLCanvasElement {
    const w = 16, h = 8, cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const c = cv.getContext("2d")!;
    c.fillStyle = near ? "#fff8d6" : "rgba(255,255,255,0.78)";
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2), ny = (y + 0.5 - h / 2) / (h / 2), r = nx * nx + ny * ny;
      if (r <= 1 && r > (near ? 0.5 : 0.56)) c.fillRect(x, y, 1, 1);
    }
    return cv;
  }

  /* ---------- the loop ---------- */
  private loop = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const gap = 1000 / this.targetFps;
    if (now - this.last < gap - 2.5) return;      // 60 Hz displays call at 16.7 ms: -2.5 keeps a 33.3 ms cap honest without dropping frames
    const dt = Math.min(MOVE.maxDt, (now - this.last) / 1000);
    this.last = now;
    this.frame(dt);
  };

  private frame(dt: number) {
    const t0 = performance.now();
    this.t += dt;
    this.step(dt);
    this.draw();
    this.prebake();
    this.afterDraw(t0);
  }

  private afterDraw(t0: number) {
    const now = performance.now(), ms = now - t0;
    this.ms[this.msI] = ms; this.msI = (this.msI + 1) % this.ms.length; this.msN++;
    this.frames++; this.fpsFrames++;
    if (this.frames === 1) this.firstFrameMs = now;
    if (now - this.lastFpsT >= 1000) {
      this.fps = (this.fpsFrames * 1000) / (now - this.lastFpsT); this.fpsFrames = 0; this.lastFpsT = now;
      // raster bound: the frames arrive well under the rate we ask for while our own draw time is small (the cost is the browser filling the pixels). Then fewer device pixels
      // go to each art pixel (k drops, the canvas is stretched, `pixelated`): 0.75 a step, down to half. Judged only after the quiet period and never when the rate is pinned.
      if (this.frames > 240 && now > this.quietUntil && this.hzMode === "auto" && this.backing > 0.5) {
        if (this.fps > 0 && this.fps < this.targetFps * 0.62 && this.p95 < MOVE.fallbackMs) {
          if (++this.rasterSlow >= 3) {
            this.rasterSlow = 0; this.backing = Math.max(0.5, this.backing * 0.75); this.quietUntil = now + QUIET_MS; this.resize();
            this.o.canvas.dataset.backing = this.backing.toFixed(2);
            console.info(`[town] raster bound (${this.fps.toFixed(0)} fps, draw p95 ${this.p95.toFixed(1)} ms): backing scale ${this.backing.toFixed(2)}, k ${this.k}`);
          }
        } else this.rasterSlow = 0;
      }
    }
    if ((this.frames & 31) === 0) {
      this.percentiles();
      if (this.frames < 240 || now < this.quietUntil || this.hzMode !== "auto") return;      // the first seconds (compiling, baking the first chunks) say nothing about the device; a pinned rate is only watched
      // adaptive: 60 Hz unless the p95 draw time says the device cannot keep it. The town places every sprite the same way at both rates, so a switch cannot pop.
      const cv = this.o.canvas;
      if (this.targetFps === MOVE.fps && this.p95 > MOVE.fallbackMs) {
        this.slowSince += 1;
        if (this.slowSince >= 2) {
          this.targetFps = MOVE.fallbackFps; this.slowSince = 0; cv.dataset.hz = "30"; cv.dataset.hzWhy = `fell: draw p95 ${this.p95.toFixed(1)} ms over ${MOVE.fallbackMs}`;
          if (!this.hzSaid) { this.hzSaid = true; console.info(`[town] 60 Hz fell back to 30: ${cv.dataset.hzWhy}. Pin it with ?hz=60 or localStorage plumi-hz.`); }
        }
      } else this.slowSince = 0;
      if (this.targetFps === MOVE.fallbackFps && this.p95 < MOVE.recoverMs) { this.fastSince += 1; if (this.fastSince >= 8) { this.targetFps = MOVE.fps; this.fastSince = 0; cv.dataset.hz = "60"; cv.dataset.hzWhy = "back to 60: draw time is low again"; } } else this.fastSince = 0;
    }
  }

  private sorted = new Float32Array(240);
  private percentiles() {
    const n = Math.min(this.msN, this.ms.length);
    for (let i = 0; i < n; i++) this.sorted[i] = this.ms[i];
    const a = this.sorted;
    for (let i = 1; i < n; i++) { const v = a[i]; let j = i - 1; while (j >= 0 && a[j] > v) { a[j + 1] = a[j]; j--; } a[j + 1] = v; }
    this.p50 = n ? a[Math.floor(n * 0.5)] : 0; this.p95 = n ? a[Math.min(n - 1, Math.floor(n * 0.95))] : 0;
  }

  /* ---------- simulation ---------- */
  private targetX() { return this.you.x - this.viewW / 2; }
  private targetY() { return this.you.y - 16 - this.viewH * (0.5 - MOVE.cameraLift); }
  private clampCam() {
    const w = this.d.cols * TILE, h = this.d.rows * TILE;
    this.camX = this.viewW >= w ? (w - this.viewW) / 2 : Math.min(Math.max(this.camX, 0), w - this.viewW);
    this.camY = this.viewH >= h ? (h - this.viewH) / 2 : Math.min(Math.max(this.camY, 0), h - this.viewH);
  }

  private step(dt: number) {
    const you = this.you;
    this.stepYou(you, dt);
    for (let i = 1; i < this.people.length; i++) this.stepBot(this.people[i], dt);
    // camera: locked while walking, eased otherwise
    const tx = this.targetX(), ty = this.targetY();
    const gx = tx - this.camX, gy = ty - this.camY;
    if (this.o.reduced || (MOVE.cameraLock && you.walking && Math.abs(gx) <= MOVE.lockGap && Math.abs(gy) <= MOVE.lockGap)) { this.camX = tx; this.camY = ty; }
    else { const s = 1 - Math.exp(-dt / MOVE.cameraTau); this.camX += gx * s; this.camY += gy * s; }
    this.clampCam();
    this.camPxX = Math.round(this.camX * this.k); this.camPxY = Math.round(this.camY * this.k);
    this.amb.update(dt, { x: this.camX, y: this.camY, w: this.viewW, h: this.viewH });
    this.doorCheck();
  }

  private stepYou(p: Person, dt: number) {
    const keyed = this.keyAxes();
    if (p.sitting) {
      if (keyed) this.standUp();
      else { p.still += dt; return; }
    }
    const kx = this.axes[0], ky = this.axes[1];
    const any = kx !== 0 || ky !== 0;
    let moved = false;
    if (any) {
      p.pathN = 0; p.pending = null; this.pendingDoor = null;
      const hl = MOVE.normaliseDiagonal ? Math.sqrt(kx * kx + ky * ky) : 1, hx = kx / hl, hy = ky / hl;
      const want = approach(p.speed, MOVE.walkSpeed, dt);
      p.speed = want;
      this.world.coll.slide(p.x, p.y, hx * want * dt, hy * want * dt, MOVE.assist, this.out);
      const dx = this.out[0] - p.x, dy = this.out[1] - p.y;
      p.dir = DIR_OF[facing(hx, hy, DIRS[p.dir])];     // a blocked key still turns the sprite
      if (Math.abs(dx) + Math.abs(dy) > 1e-6) { p.x = this.out[0]; p.y = this.out[1]; moved = true; }
    } else if (p.pathN > 0) {
      moved = this.followPath(p, dt);
    } else p.speed = approach(p.speed, 0, dt);
    this.setWalking(p, moved, dt);
  }

  private axes = [0, 0];
  private keyAxes(): boolean {
    const k = this.keys;
    const l = k.has("ArrowLeft") || k.has("KeyA"), r = k.has("ArrowRight") || k.has("KeyD"), u = k.has("ArrowUp") || k.has("KeyW"), dn = k.has("ArrowDown") || k.has("KeyS");
    this.axes[0] = (r ? 1 : 0) - (l ? 1 : 0); this.axes[1] = (dn ? 1 : 0) - (u ? 1 : 0);
    return this.axes[0] !== 0 || this.axes[1] !== 0;
  }

  private setWalking(p: Person, moved: boolean, dt: number) {
    if (moved) { if (!p.walking) { p.walking = true; p.stride = 0; } p.stride += dt; p.still = 0; }
    else { if (p.walking) { p.walking = false; p.still = 0; } p.still += dt; }
  }

  /** Walks along the planned points; true when it moved. */
  private followPath(p: Person, dt: number): boolean {
    let left = MOVE.walkSpeed * dt, moved = false;
    while (left > 0 && p.pathI < p.pathN) {
      const tx = p.path[p.pathI * 2], ty = p.path[p.pathI * 2 + 1], dx = tx - p.x, dy = ty - p.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d <= MOVE.arrive) { p.pathI++; continue; }
      const s = Math.min(left, d), hx = dx / d, hy = dy / d;
      this.world.coll.slide(p.x, p.y, hx * s, hy * s, MOVE.assist, this.out);
      const ox = p.x, oy = p.y;
      p.x = this.out[0]; p.y = this.out[1];
      const m = Math.sqrt((p.x - ox) * (p.x - ox) + (p.y - oy) * (p.y - oy));
      p.dir = DIR_OF[facing(hx, hy, DIRS[p.dir])];
      if (m < s * 0.3) { p.blockedFor += dt; if (p.blockedFor > 0.4) { p.pathN = 0; p.pending = null; p.blockedFor = 0; } break; }
      p.blockedFor = 0; moved = true; left -= s;
      if (s >= d - 1e-6) p.pathI++;
    }
    if (p.pathI >= p.pathN && p.pathN > 0) {
      p.pathN = 0;
      if (p === this.you && this.pendingDoor) { const o = this.pendingDoor; this.pendingDoor = null; if (this.doorNow >= 0 && this.doors[this.doorNow] === o) this.openDoor(o); }
      if (p.pending && !p.bot) this.sitDown(p.pending);
    }
    return moved;
  }

  private setPath(p: Person, pts: readonly (readonly [number, number])[]) {
    const n = Math.min(PATH_CAP, pts.length);
    for (let i = 0; i < n; i++) { p.path[i * 2] = pts[i][0]; p.path[i * 2 + 1] = pts[i][1]; }
    p.pathN = n; p.pathI = 0; p.blockedFor = 0;
  }

  private planFor(p: Person, x: number, y: number, spot: SitSpot | null): boolean {
    if (p.sitting) this.standUp();
    const pts = this.world.nav.plan([p.x, p.y], [x, y]);
    if (!pts) return false;
    p.pending = spot;
    this.setPath(p, pts);
    if (!pts.length && spot) this.sitDown(spot);
    return true;
  }

  /* ---------- sitting ---------- */
  private goSit(s: SitSpot) { this.planFor(this.you, s.stand.x, s.stand.y, s); }
  private sitDown(s: SitSpot) {
    const p = this.you;
    p.sitting = true; p.spot = s; p.pending = null; p.x = s.at.x; p.y = s.at.y; p.pathN = 0; p.walking = false; p.dir = DIR_OF[s.face]; p.still = 0;
    this.o.onEvent?.({ kind: "sit", id: s.key });
  }
  private standUp() {
    const p = this.you, s = p.spot;
    if (s) { p.x = s.stand.x; p.y = s.stand.y; }
    p.sitting = false; p.spot = null; p.still = 0;
    this.o.onEvent?.({ kind: "stand", id: s ? s.key : "" });
  }
  private nearestSpot(): SitSpot | null {
    const p = this.you;
    let best: SitSpot | null = null, bd = SIT_REACH * SIT_REACH;
    const spots = this.d.spots;
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i], ax = s.stand.x - p.x, ay = s.stand.y - p.y, bx = s.at.x - p.x, by = s.at.y - p.y;
      const d = Math.min(ax * ax + ay * ay, bx * bx + by * by);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /** E, Enter, Space: stand if seated; the door if at one; else sit in the seat that is near. */
  interact() {
    const p = this.you;
    if (p.sitting) { this.standUp(); return; }
    if (this.doorNow >= 0) { this.openDoor(this.doors[this.doorNow]); return; }
    const s = this.nearestSpot();
    if (s) this.sitDown(s);
  }

  /* ---------- doors ---------- */
  private openDoor(o: TownObject) { this.o.onEvent?.({ kind: o.door!.kind === "cottage" ? "knock" : "enter", id: o.id, door: o.door!.kind }); }
  /** Where the town puts you when you come out of a door: its entry point. */
  doorEntry(id: string): { x: number; y: number } | null { const o = this.doors.find((q) => q.id === id); return o ? { x: o.door!.entry.x, y: o.door!.entry.y + 10 } : null; }
  private doorCheck() {
    const p = this.you;
    let now = -1;
    if (!p.sitting) for (let i = 0; i < this.doors.length; i++) {
      const t = this.doors[i].door!.trigger;
      if (p.x >= t.x && p.y >= t.y && p.x < t.x + t.w && p.y < t.y + t.h) { now = i; break; }
    }
    if (now !== this.doorNow) {
      this.doorNow = now;
    }
  }

  /* ---------- bots ---------- */
  private makeBots(n: number) {
    this.nodes = this.d.botNodes; this.links = this.d.botLinks;
    const R = this.nodes.length;
    if (!R) return;
    const names = ["Maya", "Leo", "Priya", "Sam", "Zara", "Noah", "Ines", "Kofi"];
    for (let b = 0; b < n; b++) {
      const p = new Person();
      p.bot = true; p.name = names[b % names.length];
      p.node = Math.floor(((b + 0.5) / n) * R) % R;
      p.x = this.nodes[p.node].x; p.y = this.nodes[p.node].y; p.dir = 3; p.phase = b;
      p.art = { img: this.o.premade, sy: (1 + (b % Math.max(1, this.o.premadeRows - 1))) * 32, fw: 16 };
      p.wait = 0.5 + b * 0.7;
      this.people.push(p);
    }
    this.legsReady = true;
  }

  /** The leg between two linked bot nodes, planned the first time a bot needs it and kept. */
  private legOf(a: number, b: number): Float64Array | null {
    const key = a * 4096 + b;
    const hit = this.legs.get(key);
    if (hit) return hit;
    const pts = this.world.nav.plan([this.nodes[a].x, this.nodes[a].y], [this.nodes[b].x, this.nodes[b].y]);
    if (!pts) return null;
    const f = new Float64Array(Math.min(PATH_CAP, pts.length) * 2);
    for (let i = 0; i < f.length / 2; i++) { f[i * 2] = pts[i][0]; f[i * 2 + 1] = pts[i][1]; }
    this.legs.set(key, f);
    return f;
  }

  private stepBot(p: Person, dt: number) {
    if (!this.legsReady) return;
    if (p.pathN === 0) {
      p.wait -= dt;
      this.setWalking(p, false, dt);
      if (p.wait > 0) return;
      const ls = this.links[p.node];
      if (!ls.length) { p.wait = 2; return; }
      // keep going the way it was going most of the time (the first link is the next along its own path), now and then turn aside
      const fwd = ls.filter((q) => q !== p.prev), pool = fwd.length ? fwd : ls, next = pool[Math.floor(Math.random() * pool.length)];
      const leg = this.legOf(p.node, next);
      if (!leg) { p.wait = 1; return; }
      p.path.set(leg); p.pathN = leg.length / 2; p.pathI = 0; p.target = next;
      return;
    }
    const moved = this.followPath(p, dt);
    this.setWalking(p, moved, dt);
    if (p.pathN === 0) { p.prev = p.node; p.node = p.target; p.wait = 0.4 + Math.random() * 3; }
  }

  /* ---------- input ---------- */
  private bind() {
    const cv = this.o.canvas;
    const on = (el: EventTarget, ev: string, fn: (e: never) => void, opt?: AddEventListenerOptions) => { el.addEventListener(ev, fn as EventListener, opt); this.cleanup.push(() => el.removeEventListener(ev, fn as EventListener)); };
    const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    const MOVES = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"]);
    on(window, "keydown", (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      if (MOVES.has(e.code)) { e.preventDefault(); this.keys.add(e.code); }
      else if (e.code === "KeyE" || e.code === "Enter" || e.code === "Space") { if (e.repeat) return; e.preventDefault(); this.interact(); }
    });
    on(window, "keyup", (e: KeyboardEvent) => { this.keys.delete(e.code); });
    on(window, "blur", () => this.keys.clear());
    on(cv, "pointerup", (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const wx = ((e.clientX - r.left) * this.dpr + this.camPxX) / this.k, wy = ((e.clientY - r.top) * this.dpr + this.camPxY) / this.k;
      this.tap(wx, wy);
    });
    const ro = new ResizeObserver(() => { this.quietUntil = performance.now() + QUIET_MS; this.resize(); });
    ro.observe(cv);
    this.cleanup.push(() => ro.disconnect());
    const io = new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; if (this.visible) this.start(); else this.stop(); });
    io.observe(cv);
    this.cleanup.push(() => io.disconnect());
    on(document, "visibilitychange", () => { if (document.hidden) this.stop(); else { this.quietUntil = performance.now() + QUIET_MS; if (this.visible) this.start(); } });
  }

  private tap(wx: number, wy: number) {
    // a ring: walk there and sit
    let best: SitSpot | null = null, bd = 14;
    for (const s of this.spotsNear) { const d = Math.hypot(s.at.x - wx, s.at.y - 3 - wy); if (d < bd) { bd = d; best = s; } }
    if (best) { this.goSit(best); return; }
    // a door: walk to where it is reached from
    for (const o of this.doors) {
      const d = o.door!;
      if (wx >= d.rect.x - 4 && wx < d.rect.x + d.rect.w + 4 && wy >= d.rect.y && wy < d.rect.y + d.rect.h + 6) {
        if (this.doorNow >= 0 && this.doors[this.doorNow] === o) { this.openDoor(o); return; }
        if (this.planFor(this.you, d.entry.x, d.entry.y + 8, null)) this.pendingDoor = o;
        return;
      }
    }
    this.planFor(this.you, wx, wy, null);
  }

  /* ---------- drawing ---------- */
  private item(z: number, kind: number): Item {
    let it = this.pool[this.itemN];
    if (!it) { it = { z: 0, kind: 0, img: null, sx: 0, sy: 0, sw: 0, sh: 0, dx: 0, dy: 0, p: null, o: null, f: 0, half: 0, flag: 0 }; this.pool.push(it); }
    this.itemN++;
    it.z = z; it.kind = kind;
    return it;
  }

  /** The frame (0 to 77) a person is drawn with. */
  private frameOf(p: Person): number {
    if (p.sitting && p.spot) {
      const f = p.spot.face, anim = Math.floor(p.still * MOVE.sitHz + p.phase) % 6;
      return f === "right" ? POSE.sit + anim : f === "left" ? POSE.sit + 6 + anim : f === "front" ? POSE.read + anim : POSE.stool + anim;
    }
    if (p.walking) return POSE.walk + p.dir * 6 + walkFrame(p.stride);
    return POSE.idle + p.dir * 6 + idleFrame(p.still);
  }

  private draw() {
    const { ctx, k } = this, W = this.W, H = this.H, cx = this.camPxX, cy = this.camPxY;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#6d8f3c";
    // ground chunks (art-px chunk canvases, drawn at k)
    const S = CHUNK_TILES * TILE, x0 = this.camX, y0 = this.camY;
    const cx0 = Math.max(0, Math.floor(x0 / S)), cx1 = Math.min(this.chunksX - 1, Math.floor((x0 + this.viewW) / S));
    const cy0 = Math.max(0, Math.floor(y0 / S)), cy1 = Math.min(Math.ceil(this.d.rows / CHUNK_TILES) - 1, Math.floor((y0 + this.viewH) / S));
    if (this.viewW > this.d.cols * TILE || this.viewH > this.d.rows * TILE) ctx.fillRect(0, 0, W, H);      // the chunks cover the view unless the map is smaller than the screen
    for (let j = cy0; j <= cy1; j++) for (let i = cx0; i <= cx1; i++) {
      const ch = this.chunks.get(j * this.chunksX + i);
      ctx.drawImage(ch, 0, 0, S, S, i * S * k - cx, j * S * k - cy, S * k, S * k);
    }
    // items
    this.itemN = 0;
    const items = this.items;
    items.length = 0;
    const vx0 = x0 - 64, vy0 = y0 - 64, vx1 = x0 + this.viewW + 64, vy1 = y0 + this.viewH + 64;
    const objs = this.objects, placeholders = this.o.placeholders || this.o.debug, mw = this.maxW / 2 + 8, mh = this.maxH + 8;
    // objects are sorted by sortY: binary search the first one whose base is not above the view, stop when sprites could no longer reach down into it
    let lo = 0, hi = objs.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (objs[mid].sortY < vy0) lo = mid + 1; else hi = mid; }
    for (let i = lo; i < objs.length; i++) {
      const o = objs[i];
      if (o.sortY - mh > vy1) break;
      if (o.x < vx0 - mw || o.x > vx1 + mw) continue;
      if (o.sprite) {
        const s = this.sprites[o.sprite], it = this.item(o.sortY, 1);
        it.img = this.o.images[s.atlas]; it.sx = s.x; it.sy = s.y; it.sw = s.w; it.sh = s.h; it.dx = o.sx; it.dy = o.sy; it.o = o;
        // a tree or a roof that covers someone BEHIND it: nothing to do, the sort does it
      } else if (o.ph && placeholders && (!o.ph.building || this.o.debug)) {
        const a = this.item(o.sortY - 0.02, 4); a.o = o; a.half = 0;
        const b = this.item(o.sortY + 0.02, 4); b.o = o; b.half = 1;
      }
    }
    // spots in range: rings
    this.spotsNear.length = 0;
    const you = this.you;
    this.nearNow = you.sitting ? null : this.nearestSpot();
    const spots = this.d.spots;
    if (!you.sitting) for (let si = 0; si < spots.length; si++) {
      const s = spots[si];
      if (Math.abs(s.at.x - you.x) > RING_VIEW + 40 || Math.abs(s.at.y - you.y) > RING_VIEW + 40) continue;
      if (s.at.x < vx0 || s.at.x > vx1 || s.at.y < vy0 || s.at.y > vy1) continue;
      { const ex = s.at.x - you.x, ey = s.at.y - you.y; if (ex * ex + ey * ey > NEAR_SPOT * NEAR_SPOT) continue; }
      this.spotsNear.push(s);
      const it = this.item(this.spotObj.get(s.id)!.sortY + 0.05, 5);
      it.dx = s.at.x - 8; it.dy = s.at.y - 7; it.f = s === this.nearNow ? 1 : 0;
    }
    for (let i = 0; i < this.people.length; i++) {
      const p = this.people[i];
      if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1 + 40) continue;
      let z = p.y, depthOff = 0;
      if (p.sitting && p.spot) { const ob = this.spotObj.get(p.spot.id); z = ob ? ob.sortY : p.y; depthOff = p.spot.depth === "behind" ? -0.05 : p.spot.depth === "front" ? 0.05 : 0; }
      if (!(p.sitting)) { const sh = this.item(z - 0.02, 3); sh.dx = p.x - MOVE.shadow.w / 2; sh.dy = p.y - MOVE.shadow.lift - MOVE.shadow.h / 2; }
      const it = this.item(z + depthOff, 2);
      it.p = p; it.f = this.frameOf(p);
      it.dx = p.x - p.art.fw / 2; it.dy = p.y - 32;
      if (p === this.you) this.youItem = it;
    }
    // collect into `items` in the order made, then insertion sort (nearly sorted: objects are already in depth order)
    for (let i = 0; i < this.itemN; i++) items.push(this.pool[i]);
    for (let i = 1; i < items.length; i++) {
      const a = items[i];
      let j = i - 1;
      while (j >= 0 && items[j].z > a.z) { items[j + 1] = items[j]; j--; }
      items[j + 1] = a;
    }
    for (let i = 0; i < items.length; i++) this.drawItem(items[i], cx, cy);
    ctx.globalAlpha = 1;
    this.drawGhost(items, cx, cy);
    const vw = { x: this.camX, y: this.camY, w: this.viewW, h: this.viewH };
    this.amb.drawMotion(ctx, k, cx, cy, vw);
    this.amb.drawLight(ctx, k, cx, cy, vw, W, H);
    if (this.o.debug) this.drawDebug(cx, cy);
    this.drawLabels(cx, cy);
  }

  /** Behind a roof, a wall or a canopy you would vanish: a see-through copy of you is drawn on top of whatever covers you (nothing changes where you are not covered). */
  private youItem: Item | null = null;
  private drawGhost(items: Item[], cx: number, cy: number) {
    const y = this.youItem;
    if (!y || y.p !== this.you || this.you.sitting) return;
    const x0 = y.dx, y0 = y.dy, x1 = x0 + 16, y1 = y0 + 32;
    let covered = false;
    for (let i = items.length - 1; i >= 0 && !covered; i--) {
      const it = items[i];
      if (it === y) break;
      if (it.kind === 1 && it.dx < x1 && it.dx + it.sw > x0 && it.dy < y1 && it.dy + it.sh > y0) covered = true;
    }
    if (!covered) return;
    this.ctx.globalAlpha = 0.42;
    this.drawItem(y, cx, cy);
    this.ctx.globalAlpha = 1;
  }

  private drawItem(it: Item, cx: number, cy: number) {
    const { ctx, k } = this;
    switch (it.kind) {
      case 1: ctx.drawImage(it.img!, it.sx, it.sy, it.sw, it.sh, it.dx * k - cx, it.dy * k - cy, it.sw * k, it.sh * k); break;
      case 2: {
        const p = it.p!, fw = p.art.fw, hi = p.art.img2 && k >= 2 && Number.isInteger(k / 2), ps = hi ? 2 : 1;
        ctx.drawImage(hi ? p.art.img2! : p.art.img, it.f * fw * ps, p.art.sy * ps, fw * ps, 32 * ps, Math.round(it.dx * k) - cx, Math.round(it.dy * k) - cy, fw * k, 32 * k);
        break;
      }
      case 3: ctx.drawImage(this.shadowImg, Math.round(it.dx * k) - cx, Math.round(it.dy * k) - cy, MOVE.shadow.w * k, MOVE.shadow.h * k); break;
      case 4: {
        const ph = it.o!.ph!, y0 = it.half === 0 ? 0 : ph.cut, y1 = it.half === 0 ? ph.cut : ph.h;
        ctx.fillStyle = ph.color;
        ctx.fillRect(ph.x * k - cx, (ph.y + y0) * k - cy, ph.w * k, (y1 - y0) * k);
        ctx.strokeStyle = it.half === 0 ? "rgba(60,30,10,0.6)" : "rgba(40,20,5,0.9)";
        ctx.lineWidth = Math.max(1, k * 0.5);
        ctx.strokeRect(ph.x * k - cx, (ph.y + y0) * k - cy, ph.w * k, (y1 - y0) * k);
        break;
      }
      case 5: ctx.drawImage(this.ringImg[it.f], it.dx * k - cx, it.dy * k - cy, 16 * k, 8 * k); break;
    }
  }

  private drawDebug(cx: number, cy: number) {
    const { ctx, k } = this, c = this.world.coll;
    const gx0 = Math.max(0, Math.floor(this.camX / 8)), gx1 = Math.min(c.cols - 1, Math.floor((this.camX + this.viewW) / 8));
    const gy0 = Math.max(0, Math.floor(this.camY / 8)), gy1 = Math.min(c.rows - 1, Math.floor((this.camY + this.viewH) / 8));
    ctx.fillStyle = "rgba(255,40,40,0.28)";
    for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) if (c.blocked(x, y)) ctx.fillRect(x * 8 * k - cx, y * 8 * k - cy, 8 * k, 8 * k);
    // nav grid: closed 16 px cells outlined in blue (open ones are the rest)
    const nv = this.world.nav;
    ctx.strokeStyle = "rgba(60,120,255,0.35)"; ctx.lineWidth = 1;
    for (let y = Math.floor(this.camY / 16); y <= Math.floor((this.camY + this.viewH) / 16); y++) for (let x = Math.floor(this.camX / 16); x <= Math.floor((this.camX + this.viewW) / 16); x++) if (nv.open(x, y)) ctx.strokeRect(x * 16 * k - cx + 0.5, y * 16 * k - cy + 0.5, 16 * k, 16 * k);
    // door triggers, entries; stand points; seats
    ctx.strokeStyle = "#ff00ff"; ctx.lineWidth = 2;
    for (const o of this.doors) { const t = o.door!.trigger; ctx.strokeRect(t.x * k - cx, t.y * k - cy, t.w * k, t.h * k); const e = o.door!.entry; ctx.fillStyle = "#ff00ff"; ctx.fillRect(e.x * k - cx - 3, e.y * k - cy - 3, 6, 6); }
    for (const s of this.d.spots) {
      if (Math.abs(s.at.x - this.you.x) > 400 || Math.abs(s.at.y - this.you.y) > 300) continue;
      ctx.fillStyle = "#ffd400"; ctx.fillRect(s.stand.x * k - cx - 3, s.stand.y * k - cy - 3, 6, 6);
      ctx.fillStyle = s.face === "front" || s.face === "back" ? "#ff7a00" : "#00d0a0"; ctx.fillRect(s.at.x * k - cx - 3, s.at.y * k - cy - 3, 6, 6);
    }
    // paths
    ctx.strokeStyle = "#00ffff"; ctx.lineWidth = 2;
    for (const p of this.people) if (p.pathN > 0) { ctx.beginPath(); ctx.moveTo(p.x * k - cx, p.y * k - cy); for (let i = p.pathI; i < p.pathN; i++) ctx.lineTo(p.path[i * 2] * k - cx, p.path[i * 2 + 1] * k - cy); ctx.stroke(); }
    // feet box of you
    ctx.strokeStyle = "#ffffff"; ctx.strokeRect((this.you.x - 4) * k - cx, (this.you.y - 3) * k - cy, 8 * k, 6 * k);
  }

  private fontPx = 0; private fontCss = ""; private widths = new Map<string, number>();
  /** A label pill: widths are measured once per text (measureText makes an object), the rest draws without allocating. */
  private pill = (text: string, x: number, y: number, fill: string, ink: string) => {
    const L = this.lab, px = this.fontPx;
    let tw = this.widths.get(text);
    if (tw === undefined) { tw = L.measureText(text).width; this.widths.set(text, tw); }
    const w = tw + px * 1.1, h = px * 1.7;
    // a pill from three rects (no path object): the ends are a pixel row short, which reads as round at this size
    const x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2), W = Math.round(w), H = Math.round(h), e = Math.max(1, Math.round(H / 5));
    L.fillStyle = fill;
    L.fillRect(x0 + e, y0, W - 2 * e, H); L.fillRect(x0, y0 + e, W, H - 2 * e);
    L.fillStyle = ink; L.fillText(text, x, y + 1);
  };
  private drawLabels(cx: number, cy: number) {
    const L = this.lab, k = this.k, dpr = this.dpr;
    L.save();
    const px = Math.round(11 * dpr);
    if (this.fontPx !== px) { this.fontPx = px; this.fontCss = `${px}px ${this.fontFamily}`; this.widths.clear(); }
    L.font = this.fontCss;
    L.textBaseline = "middle"; L.textAlign = "center";
    const pill = this.pill;
    const you = this.you;
    if (this.doorNow >= 0 && !you.sitting) {
      const o = this.doors[this.doorNow], d = o.door!;
      pill("E  Enter", (d.rect.x + d.rect.w / 2) * k - cx, (d.rect.y - 4) * k - cy, "rgba(40,30,25,0.82)", "#fff6dc");
    }
    const near = you.sitting ? null : this.nearestSpot();
    if (near) pill("E  Sit", near.at.x * k - cx, (near.at.y - 40) * k - cy, "rgba(40,30,25,0.82)", "#fff6dc");
    if (you.sitting) pill("E  Stand up", you.x * k - cx, (you.y - 40) * k - cy, "rgba(40,30,25,0.82)", "#fff6dc");
    for (let i = 1; i < this.people.length; i++) { const p = this.people[i]; if (p.name) pill(p.name, p.x * k - cx, (p.y - 38) * k - cy, "rgba(255,255,255,0.78)", "#3a2a22"); }
    if (this.o.debug) {
      L.textAlign = "left";
      for (const ob of this.objects) {
        if (!ob.ph) continue;
        const sx = ob.ph.x * k - cx, sy = ob.ph.y * k - cy;
        if (sx < -200 || sy < -100 || sx > this.W || sy > this.H) continue;
        L.fillStyle = "rgba(255,255,255,0.9)"; L.fillText(ob.ph.label, sx + 2, sy - px * 0.4);
      }
      const hud = `${this.fps.toFixed(0)} fps (cap ${this.targetFps})  draw p50 ${this.p50.toFixed(2)} p95 ${this.p95.toFixed(2)} ms  k${k}  chunks ${this.chunks.size} (${this.chunks.bakes} baked, ${this.chunks.evictions} evicted)  items ${this.itemN}`;
      L.fillStyle = "rgba(0,0,0,0.65)"; L.fillRect(8, 8, L.measureText(hud).width + 16, px * 1.9);
      L.fillStyle = "#9dff9d"; L.fillText(hud, 16, 8 + px * 0.95);
    }
    L.restore();
  }
}
