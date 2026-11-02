/**
 * The path planner (docs/study/town.md "The generator"). Pure and deterministic: the same seed and landmarks always give the same paths.
 *
 *   obstacles   buildings, placeholders, house rows (tile grid), dilated so a centre line keeps clear of them
 *   routing     A* over the 1 tile grid, 8 neighbours, with a noise cost (the route wanders) and a cheap cost on existing path (it merges)
 *   cutting     a route that runs along the existing network is cut: only the off-network stretches become new edges, each starting and ending ON
 *               the network (a clean T), so two paths never run side by side
 *   shaping     decimate, Catmull-Rom, then a sine meander across the line (amplitude 0.6 to 1.3 tiles, wavelength 11 to 17, tapered at the ends,
 *               switched off where it would touch an obstacle): gentle S-curves and no long straight run
 *   material    every sample stamps a disc (the half width varies slowly) into an 8 px material grid; plazas are rounded rectangles stamped last
 * Units here: TILES (a tile is 32 art px) unless a name says cells (a cell is 8 px, 4 to a tile).
 */
import { hash2, valueNoise } from "./rng";

export const MC = 4;               // material cells per tile along one axis (8 art px each)
export const MAT = { grass: 0, path: 1, plaza: 2 } as const;

export interface PathEdge {
  id: string; kind: "trunk" | "street" | "spur" | "foot";
  /** Centre line samples, tiles. */
  pts: [number, number][];
  /** Half width in tiles at each sample. */
  half: number[];
  /** The two ends are on the network (or are a dead end): ids of the nodes if known. */
  a?: string; b?: string;
}
export interface PlazaDef { id: string; x: number; y: number; w: number; h: number; round: number }
export interface NodeDef { id: string; x: number; y: number }

export class Planner {
  readonly cols: number; readonly rows: number; readonly cx: number; readonly cy: number;
  readonly blocked: Uint8Array;        // obstacles, tiles
  dist: Float32Array;                  // distance (tiles) from a tile centre to the nearest obstacle tile edge, capped at 8
  readonly mask: Uint8Array;           // material cells
  readonly net: Uint8Array;            // tiles that are on the network
  readonly edges: PathEdge[] = [];
  readonly attach: { x: number; y: number }[] = [];
  readonly plazas: PlazaDef[] = [];
  constructor(cols: number, rows: number, readonly seed: number, readonly noiseAmp = 1.6) {
    this.cols = cols; this.rows = rows; this.cx = cols * MC; this.cy = rows * MC;
    this.blocked = new Uint8Array(cols * rows); this.dist = new Float32Array(cols * rows).fill(8);
    this.mask = new Uint8Array(this.cx * this.cy); this.net = new Uint8Array(cols * rows);
  }

  /* ---------- obstacles ---------- */
  block(x0: number, y0: number, x1: number, y1: number) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.rows, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.cols, Math.ceil(x1)); x++) this.blocked[y * this.cols + x] = 1;
  }
  /** Distance transform of the obstacles (call after the last `block`). The map edge counts: `margin` tiles of it are blocked. */
  finishObstacles(margin: number) {
    const { cols, rows } = this;
    this.block(0, 0, cols, margin); this.block(0, rows - margin, cols, rows); this.block(0, 0, margin, rows); this.block(cols - margin, 0, cols, rows);
    const R = 8, d = this.dist; d.fill(R);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (this.blocked[y * cols + x]) {
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const v = Math.max(0, Math.hypot(dx, dy) - 0.5);       // from the centre of that tile to the edge of the blocked one
        if (v < d[ny * cols + nx]) d[ny * cols + nx] = v;
      }
    }
  }
  clearance(x: number, y: number): number {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return 0;
    return this.dist[ty * this.cols + tx];
  }

  /* ---------- material ---------- */
  private stampDisc(x: number, y: number, r: number, v: number) {
    const x0 = Math.max(0, Math.floor((x - r) * MC)), x1 = Math.min(this.cx - 1, Math.ceil((x + r) * MC)), y0 = Math.max(0, Math.floor((y - r) * MC)), y1 = Math.min(this.cy - 1, Math.ceil((y + r) * MC));
    const r2 = r * r;
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const dx = (i + 0.5) / MC - x, dy = (j + 0.5) / MC - y;
      if (dx * dx + dy * dy <= r2 && this.mask[j * this.cx + i] < v) this.mask[j * this.cx + i] = v;
    }
  }
  private refreshNet() {
    for (let ty = 0; ty < this.rows; ty++) for (let tx = 0; tx < this.cols; tx++) {
      let n = 0;
      for (let j = 0; j < MC; j++) for (let i = 0; i < MC; i++) if (this.mask[(ty * MC + j) * this.cx + tx * MC + i]) n++;
      this.net[ty * this.cols + tx] = n >= 6 ? 1 : 0;
    }
  }
  stampEdge(e: PathEdge) {
    this.edges.push(e);
    for (let i = 0; i < e.pts.length; i++) {
      this.stampDisc(e.pts[i][0], e.pts[i][1], e.half[i], MAT.path);
      if (i % 2 === 0) this.attach.push({ x: e.pts[i][0], y: e.pts[i][1] });
    }
    this.refreshNet();
  }
  addPlaza(p: PlazaDef) {
    this.plazas.push(p);
    for (let j = Math.floor(p.y * MC); j < Math.ceil((p.y + p.h) * MC); j++) for (let i = Math.floor(p.x * MC); i < Math.ceil((p.x + p.w) * MC); i++) {
      if (i < 0 || j < 0 || i >= this.cx || j >= this.cy) continue;
      // rounded corners: the corner disc of radius `round` tiles
      const px = (i + 0.5) / MC, py = (j + 0.5) / MC, r = p.round;
      const qx = Math.max(p.x + r - px, 0, px - (p.x + p.w - r)), qy = Math.max(p.y + r - py, 0, py - (p.y + p.h - r));
      if (qx * qx + qy * qy <= r * r) this.mask[j * this.cx + i] = MAT.plaza;
    }
    for (let t = 0; t < 2 * (p.w + p.h); t += 1) {
      const u = t < p.w ? [p.x + t, p.y] : t < p.w + p.h ? [p.x + p.w, p.y + t - p.w] : t < 2 * p.w + p.h ? [p.x + p.w - (t - p.w - p.h), p.y + p.h] : [p.x, p.y + p.h - (t - 2 * p.w - p.h)];
      this.attach.push({ x: u[0], y: u[1] });
    }
    this.refreshNet();
  }

  /* ---------- routing ---------- */
  private noise(x: number, y: number) { return valueNoise(this.seed + 11, x, y, 6) * 0.65 + valueNoise(this.seed + 12, x, y, 2.5) * 0.35; }
  /** A* from tile a to tile b: tile indices, or null. Existing network is cheap, obstacles (dilated by `keep` tiles) are closed. */
  route(a: [number, number], b: [number, number], keep = 2.2, netCost = 0.45): number[] | null {
    const { cols, rows } = this;
    const ia = Math.floor(a[1]) * cols + Math.floor(a[0]), ib = Math.floor(b[1]) * cols + Math.floor(b[0]);
    const g = new Float32Array(cols * rows).fill(Infinity), from = new Int32Array(cols * rows).fill(-1), done = new Uint8Array(cols * rows);
    const heap: [number, number][] = [];
    const push = (f: number, i: number) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    g[ia] = 0; push(0, ia);
    const bx = ib % cols, by = Math.floor(ib / cols);
    while (heap.length) {
      const [, i] = pop();
      if (done[i]) continue;
      done[i] = 1;
      if (i === ib) break;
      const x = i % cols, y = Math.floor(i / cols);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = ny * cols + nx;
        if (done[j]) continue;
        const k = Math.hypot(nx - a[0], ny - a[1]) < 3.6 || Math.hypot(nx - bx, ny - by) < 3.6 ? 0.9 : keep;
        if (this.dist[j] < k && j !== ib && !this.net[j]) continue;
        if (dx && dy && (this.dist[y * cols + nx] < k * 0.6 || this.dist[ny * cols + x] < k * 0.6) && !this.net[j]) continue;
        const len = dx && dy ? Math.SQRT2 : 1;
        const w = this.net[j] ? netCost : 1 + this.noiseAmp * this.noise(nx, ny);
        const ng = g[i] + len * w;
        if (ng < g[j]) { g[j] = ng; from[j] = i; push(ng + Math.hypot(nx - bx, ny - by) * 0.45, j); }
      }
    }
    if (!done[ib]) return null;
    const out: number[] = [];
    for (let i = ib; i !== -1; i = from[i]) out.push(i);
    return out.reverse();
  }

  nearestAttach(x: number, y: number, maxD = 4): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null, bd = maxD * maxD;
    for (const p of this.attach) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  }

  /** Route a -> b and add the off-network stretches as edges. Returns the new edges' total length in tiles. */
  connect(id: string, a: [number, number], b: [number, number], kind: PathEdge["kind"], rngSeed: number, half?: number): number {
    const r = this.route(a, b);
    if (!r) return -1;
    const pts = r.map((i) => [(i % this.cols) + 0.5, Math.floor(i / this.cols) + 0.5] as [number, number]);
    const on = r.map((i) => this.net[i] === 1);
    let total = 0, part = 0;
    for (let i = 0; i < pts.length;) {
      if (on[i]) { i++; continue; }
      let j = i;
      while (j + 1 < pts.length && !on[j + 1]) j++;
      // the stretch i..j is off the network; extend by the neighbours that are on it
      const line: [number, number][] = [];
      const s0 = i > 0 ? this.nearestAttach(pts[i - 1][0], pts[i - 1][1], 3.5) : null;
      const s1 = j < pts.length - 1 ? this.nearestAttach(pts[j + 1][0], pts[j + 1][1], 3.5) : null;
      if (s0) line.push([s0.x, s0.y]);
      for (let k = i; k <= j; k++) line.push(pts[k]);
      if (s1) line.push([s1.x, s1.y]);
      const e = this.shape(`${id}.${part++}`, line, kind, rngSeed + part * 31, half, !!s0, !!s1);
      if (e) { this.stampEdge(e); total += e.pts.length / 4; }
      i = j + 1;
    }
    return total;
  }

  /** Decimate, spline, meander and widen a tile polyline into an edge. */
  shape(id: string, line: [number, number][], kind: PathEdge["kind"], seed: number, halfBase?: number, headOn = true, tailOn = true, decimate = true): PathEdge | null {
    if (line.length < 2) return null;
    const dec: [number, number][] = [line[0]];
    if (decimate) { for (let i = 3; i < line.length - 1; i += 3) dec.push(line[i]); } else for (let i = 1; i < line.length - 1; i++) dec.push(line[i]);
    dec.push(line[line.length - 1]);
    const sp = catmull(dec, 0.25);
    if (sp.length < 2) return null;
    // arc length
    const s: number[] = [0];
    for (let i = 1; i < sp.length; i++) s.push(s[i - 1] + Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]));
    const L = s[s.length - 1];
    const h0 = halfBase ?? (kind === "street" ? 1.25 : 1.1 + 0.45 * hash2(this.seed + 3, seed, 1));
    const A = (kind === "spur" ? 0 : 0.8 + 1.0 * hash2(this.seed + 4, seed, 2)), wl = 12 + 8 * hash2(this.seed + 5, seed, 3), ph = hash2(this.seed + 6, seed, 4) * Math.PI * 2;
    const out: [number, number][] = [], half: number[] = [];
    const scale = new Float32Array(sp.length).fill(1);
    const disp = (i: number, f: number): [number, number] => {
      const i0 = Math.max(0, i - 1), i1 = Math.min(sp.length - 1, i + 1);
      let tx = sp[i1][0] - sp[i0][0], ty = sp[i1][1] - sp[i0][1]; const n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;
      const taper = Math.min(1, headOn ? s[i] / 4 : 1, tailOn ? (L - s[i]) / 4 : 1);
      const o = A * Math.sin((2 * Math.PI * s[i]) / wl + ph) * taper * f;
      return [sp[i][0] - ty * o, sp[i][1] + tx * o];
    };
    const need = () => h0 + 0.35;
    for (let i = 0; i < sp.length; i++) {
      const [x, y] = disp(i, 1);
      const free = (p: [number, number]) => this.clearance(p[0], p[1]) >= need() || this.net[Math.floor(p[1]) * this.cols + Math.floor(p[0])] === 1;
      if (!free([x, y])) scale[i] = 0;
    }
    // smooth the on/off switch so the line does not kink
    for (let pass = 0; pass < 6; pass++) for (let i = 1; i < sp.length - 1; i++) scale[i] = Math.min(scale[i], (scale[i - 1] + scale[i] + scale[i + 1]) / 3);
    for (let pass = 0; pass < 4; pass++) for (let i = 1; i < sp.length - 1; i++) scale[i] = (scale[i - 1] + 2 * scale[i] + scale[i + 1]) / 4;
    for (let i = 0; i < sp.length; i++) {
      out.push(disp(i, scale[i]));
      const w = kind === "spur" ? h0 : clamp(h0 + 0.14 * Math.sin((2 * Math.PI * s[i]) / 9 + ph * 2), 1.1, 1.6);
      half.push(kind === "trunk" || kind === "street" || kind === "foot" ? Math.max(kind === "foot" ? 1.0 : 1.1, w) : w);
    }
    return { id, kind, pts: out, half };
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Catmull-Rom through the points, sampled every `step` tiles of chord. */
export function catmull(p: [number, number][], step: number): [number, number][] {
  if (p.length < 2) return p.slice();
  const out: [number, number][] = [];
  const P = (i: number) => p[Math.max(0, Math.min(p.length - 1, i))];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(p[p.length - 1]);
  return out;
}

/** Run-length encode a byte grid: [value, run, value, run, ...]. */
export function rle(a: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < a.length;) { let j = i; while (j < a.length && a[j] === a[i]) j++; out.push(a[i], j - i); i = j; }
  return out;
}
export function unrle(r: readonly number[], n: number): Uint8Array {
  const a = new Uint8Array(n); let k = 0;
  for (let i = 0; i < r.length; i += 2) { a.fill(r[i], k, k + r[i + 1]); k += r[i + 1]; }
  return a;
}
