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
export interface PlazaDef {
  id: string; x: number; y: number; w: number; h: number; round: number;
  /** Tiles of worn dirt around the paved shape (default 1.2). 0: none. */
  apron?: number;
  /** How far the paved edge wanders, tiles (default 0.55). The top band (against the building) stays straight. */
  rag?: number;
}
/** Signed distance (tiles) from a point to a rounded rectangle: negative inside. */
export function roundedSd(p: { x: number; y: number; w: number; h: number; round: number }, px: number, py: number): number {
  const r = Math.min(p.round, p.w / 2, p.h / 2), qx = Math.abs(px - (p.x + p.w / 2)) - (p.w / 2 - r), qy = Math.abs(py - (p.y + p.h / 2)) - (p.h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
export interface NodeDef { id: string; x: number; y: number }

export class Planner {
  readonly cols: number; readonly rows: number; readonly cx: number; readonly cy: number;
  readonly blocked: Uint8Array;        // obstacles, tiles
  dist: Float32Array;                  // distance (tiles) from a tile centre to the nearest obstacle tile edge, capped at 8
  readonly mask: Uint8Array;           // material cells
  readonly net: Uint8Array;            // tiles that are on the network
  readonly beltTiles = new Set<number>();   // tiles a belt closes (not its gates)
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
      // a route may join a path anywhere but at the ends of a spur (a door, a lane's mouth)
      if (i % 2 === 0 && !(e.kind === "spur" && (i < 8 || i > e.pts.length - 9))) this.attach.push({ x: e.pts[i][0], y: e.pts[i][1] });
    }
    this.refreshNet();
  }
  /** The paved shape's wander: a smooth noise in [-1, 1] (tiles of `rag` at most). */
  private wander(px: number, py: number) { return (valueNoise(this.seed + 55, px, py, 3.2) - 0.5) * 2; }
  addPlaza(p: PlazaDef) {
    this.plazas.push(p);
    const apron = p.apron ?? 1.2, rag = p.rag ?? 0.55, reach = apron + 1.5;
    const topBand = p.y + 0.9;
    for (let j = Math.floor((p.y - reach) * MC); j < Math.ceil((p.y + p.h + reach) * MC); j++) for (let i = Math.floor((p.x - reach) * MC); i < Math.ceil((p.x + p.w + reach) * MC); i++) {
      if (i < 0 || j < 0 || i >= this.cx || j >= this.cy) continue;
      const px = (i + 0.5) / MC, py = (j + 0.5) / MC;
      const d = roundedSd(p, px, py), w = this.wander(px, py);
      const paved = py < topBand && d < 0 ? true : d < -0.15 + w * rag;
      if (paved) this.mask[j * this.cx + i] = MAT.plaza;
      else if (apron > 0 && py >= p.y - 0.01 && d < apron + w * rag * 0.9 && this.mask[j * this.cx + i] < MAT.path) this.mask[j * this.cx + i] = MAT.path;
    }
    // attach points ON the paved shape (a route ends where the paving begins)
    const n = Math.round(2 * (p.w + p.h));
    for (let t = 0; t < n; t += 1) {
      const f = t / n, a = f * Math.PI * 2;
      const dx = Math.cos(a) * 1000, dy = Math.sin(a) * 1000;
      let x = p.x + p.w / 2 + Math.max(-p.w / 2, Math.min(p.w / 2, dx)), y = p.y + p.h / 2 + Math.max(-p.h / 2, Math.min(p.h / 2, dy));
      const cxm = p.x + p.w / 2, cym = p.y + p.h / 2;
      for (let k = 0; k < 40 && roundedSd(p, x, y) > -0.5; k++) { x += (cxm - x) * 0.06; y += (cym - y) * 0.06; }
      this.attach.push({ x, y });
    }
    this.refreshNet();
  }

  /** Blocks a belt (a polyline, tiles) with `thick` tiles of obstacle, leaving `gateR` tiles open around each gate point. */
  blockBelt(pts: [number, number][], thick: number, gates: [number, number][], gateR: number) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 0.25);
      for (let k = 0; k <= n; k++) {
        const x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n;
        if (gates.some((g) => Math.hypot(g[0] - x, g[1] - y) < gateR)) continue;
        this.block(x - thick / 2, y - thick / 2, x + thick / 2, y + thick / 2);
        for (let ty = Math.floor(y - thick / 2); ty < Math.ceil(y + thick / 2); ty++) for (let tx = Math.floor(x - thick / 2); tx < Math.ceil(x + thick / 2); tx++) if (tx >= 0 && ty >= 0 && tx < this.cols && ty < this.rows) this.beltTiles.add(ty * this.cols + tx);
      }
    }
  }

  /** A belt is closed: any path that ended up on it (a node too close, a path end cap) is cut back, so the only crossings are the gates. Returns the path cells removed. */
  carveBelts(): number {
    let n = 0;
    for (const t of this.beltTiles) {
      const tx = t % this.cols, ty = Math.floor(t / this.cols);
      for (let j = 0; j < MC; j++) for (let i = 0; i < MC; i++) { const k = (ty * MC + j) * this.cx + tx * MC + i; if (this.mask[k] === MAT.path) { this.mask[k] = 0; n++; } }
    }
    this.refreshNet();
    return n;
  }

  /**
   * The distance-field clamp. A junction where routes meet at a shallow angle swells to a blob; every cell of path (not plaza) whose inscribed
   * radius is over `cap` tiles is a fat core. The medial axis (cells not inside a neighbour's disc) is kept and each of its discs is capped at `cap`,
   * so a blob is trimmed to a band `2 * cap` wide that follows its spine, and everything thinner is untouched. Cells within `exempt` tiles of a plaza are left alone.
   */
  clampWidths(cap: number, exempt: number): number {
    const { cx, cy, mask } = this;
    const R = cap * MC;
    // squared exact distance to the nearest non-path cell (plazas count as non-path: a path meeting a plaza has a short distance)
    const INF = 1e20, d2 = new Float64Array(cx * cy);
    for (let i = 0; i < d2.length; i++) d2[i] = mask[i] === MAT.path ? INF : 0;
    edt2(d2, cx, cy);
    const D = new Float32Array(cx * cy);
    for (let i = 0; i < D.length; i++) D[i] = Math.sqrt(d2[i]);
    const ex = new Uint8Array(cx * cy);
    for (const p of this.plazas) {
      const g = exempt;
      for (let j = Math.max(0, Math.floor((p.y - g) * MC)); j < Math.min(cy, Math.ceil((p.y + p.h + g) * MC)); j++) for (let i = Math.max(0, Math.floor((p.x - g) * MC)); i < Math.min(cx, Math.ceil((p.x + p.w + g) * MC)); i++) ex[j * cx + i] = 1;
    }
    const out = new Uint8Array(cx * cy), thick = new Float32Array(cx * cy);       // thick: the radius of the biggest inscribed disc that covers a cell
    for (let i = 0; i < out.length; i++) if (mask[i] === MAT.plaza) out[i] = MAT.plaza;
    let trimmed = 0;
    const stamp = (i: number, j: number, r: number, fn: (k: number) => void) => {
      const r2 = r * r, x0 = Math.max(0, Math.floor(i - r)), x1 = Math.min(cx - 1, Math.ceil(i + r)), y0 = Math.max(0, Math.floor(j - r)), y1 = Math.min(cy - 1, Math.ceil(j + r));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x - i) ** 2 + (y - j) ** 2 <= r2 && mask[y * cx + x] === MAT.path) fn(y * cx + x);
    };
    for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
      const k = j * cx + i, d = D[k];
      if (mask[k] !== MAT.path) continue;
      // on the medial axis (a local maximum of the distance) unless a neighbour is deeper
      let ridge = true;
      for (let dj = -1; dj <= 1 && ridge; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const x = i + di, y = j + dj;
        if (x < 0 || y < 0 || x >= cx || y >= cy) continue;
        if (D[y * cx + x] > d + 0.25) { ridge = false; break; }
      }
      if (!ridge) continue;
      stamp(i, j, d + 0.6, (q) => { if (d > thick[q]) thick[q] = d; });
    }
    // a cell under a disc of radius T (the biggest that covers it) is kept when it is at least T - R deep: the disc is capped at R round its centre
    // (a cell no fat disc covers has T <= R and is kept; a neck that joins a thin path to a blob is deep enough to stay)
    for (let i = 0; i < out.length; i++) if (mask[i] === MAT.path && (ex[i] || D[i] + R + 0.5 >= thick[i])) out[i] = MAT.path;
    for (let i = 0; i < out.length; i++) if (mask[i] === MAT.path && !out[i]) trimmed++;
    mask.set(out);
    // specks: a piece of path or paving of fewer than 14 cells that is not joined to the rest goes
    const seen = new Uint8Array(cx * cy);
    for (let i0 = 0; i0 < mask.length; i0++) {
      if (!mask[i0] || seen[i0]) continue;
      const q = [i0]; seen[i0] = 1;
      for (let a = 0; a < q.length; a++) { const x = q[a] % cx, y = Math.floor(q[a] / cx); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cx || ny >= cy) continue; const k = ny * cx + nx; if (mask[k] && !seen[k]) { seen[k] = 1; q.push(k); } } }
      if (q.length < 14) { for (const k of q) mask[k] = 0; trimmed += q.length; }
    }
    this.refreshNet();
    return trimmed;
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
  connect(id: string, a: [number, number], b: [number, number], kind: PathEdge["kind"], rngSeed: number, half?: number, netCost = 0.45): number {
    // a tight corner of the map (a gate between a house and a belt) may need the obstacles' margin eased
    const r = this.route(a, b, 2.2, netCost) ?? this.route(a, b, 1.5, netCost) ?? this.route(a, b, 1.0, netCost);
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
    const h0 = halfBase ?? (kind === "street" ? 1.2 : 1.05 + 0.25 * hash2(this.seed + 3, seed, 1));
    const A = (kind === "spur" ? 0 : 1.0 + 1.2 * hash2(this.seed + 4, seed, 2)), wl = 12 + 8 * hash2(this.seed + 5, seed, 3), ph = hash2(this.seed + 6, seed, 4) * Math.PI * 2;
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
      const w = kind === "spur" ? h0 : clamp(h0 + 0.1 * Math.sin((2 * Math.PI * s[i]) / 9 + ph * 2), 1.05, 1.35);
      half.push(kind === "trunk" || kind === "street" || kind === "foot" ? Math.max(kind === "foot" ? 1.0 : 1.05, w) : w);
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

/** Squared Euclidean distance transform in place (Felzenszwalb and Huttenlocher): `f` holds 0 at the sources and a huge number elsewhere. */
export function edt2(f: Float64Array, w: number, h: number) {
  const n = Math.max(w, h), v = new Int32Array(n), z = new Float64Array(n + 1), g = new Float64Array(n);
  const pass = (len: number, get: (i: number) => number, set: (i: number, val: number) => void) => {
    for (let i = 0; i < len; i++) g[i] = get(i);
    let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < len; q++) {
      let s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; const p = v[k]; set(q, (q - p) * (q - p) + g[p]); }
  };
  for (let x = 0; x < w; x++) pass(h, (i) => f[i * w + x], (i, val) => { f[i * w + x] = val; });
  for (let y = 0; y < h; y++) pass(w, (i) => f[y * w + i], (i, val) => { f[y * w + i] = val; });
}
