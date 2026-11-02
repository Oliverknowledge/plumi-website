/**
 * The ground, painted per pixel (docs/study/town.md "Ground rendering"). The authored edge pieces only fit straight runs, so paths are cut in code:
 *
 *   material   an 8 px grid (`TownData.mat`, run-length encoded): 0 grass, 1 path, 2 plaza
 *   land       the path/plaza cells blurred (3 x 3), sampled bilinearly per pixel, plus a seeded noise of about 0.55 amplitude, thresholded at 0.5:
 *              ragged, tufty edges that wander about 5 px either side of the cell outline
 *   fill       grass: the atlas's grass tiles (a, flowers in drifts, leaves near trees), flipped by a hash; path: the atlas's dirt tiles lifted
 *              toward the reference's pale tan; plaza: the one clean herringbone tile (`plaza_01`), straight cut
 *   rim        a darker pixel line inside the path edge, grass tufts on the outside (and the odd one two pixels out)
 * `paintChunk` writes one 16 x 16 tile chunk (512 x 512 art px) into an RGBA buffer. It is pure (no DOM): the engine bakes a chunk once and
 * blits it. Seeded: the same data gives the same pixels.
 */
import { edt2 } from "./plan";
import { hash2, valueNoise } from "./rng";
import { CHUNK_TILES, TILE, type TownData } from "./types";

export const MATC = 8;                 // art px per material cell
export const PATH_TAN = [238, 214, 150] as const;
export const PATH_LIFT = 0.55;
export const PLAZA_TAN = [244, 228, 184] as const;
/** The herringbone is the loudest ground on the map, so it is lifted toward pale hard: 0.62 in the middle of a plaza, 0.86 at its edge (it fades toward the dirt apron). */
export const PLAZA_LIFT = 0.62;
export const PLAZA_LIFT_EDGE = 0.86;
const STONE = [190, 168, 124] as const;   // the stone border: a pixel line round the paving
export const WORN = [208, 178, 114] as const;   // worn ground: dirt showing through the grass
const TUFT = [105, 124, 52] as const;  // darker than the grass atlas's (127,140,62): the tuft reads on both greens
const RIM = [196, 150, 92] as const;   // the dirt's own darker tone, lifted a little

export interface GroundAtlas { w: number; h: number; data: Uint8ClampedArray }
export interface GroundCtx {
  d: Pick<TownData, "cols" | "rows" | "seed" | "groundCols" | "tiles">;
  mat: Uint8Array; mc: number; mr: number;       // material cells
  cov: Float32Array;                              // blurred path-or-plaza coverage, per cell
  cov2: Float32Array;                             // blurred plaza coverage, per cell
  pd: Float32Array;                               // per cell: distance (cells) to the nearest non-plaza cell (0 outside), capped at 8
  leaf: Uint8Array;                               // per tile: a tree is near
  wornAt: Map<number, number[]>;                  // per tile (ty * cols + tx): the worn discs [x, y, r, ...] that reach it
}

export function makeGroundCtx(d: GroundCtx["d"] & { mat: { rle: number[] }; worn?: number[] }, trees: { x: number; y: number }[], mat: Uint8Array): GroundCtx {
  const mc = d.cols * (TILE / MATC), mr = d.rows * (TILE / MATC);
  const cov = new Float32Array(mc * mr), cov2 = new Float32Array(mc * mr);
  for (let y = 0; y < mr; y++) for (let x = 0; x < mc; x++) {
    let s = 0, s2 = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= mc || ny >= mr) continue;
      n++; const m = mat[ny * mc + nx]; if (m) s++; if (m === 2) s2++;
    }
    cov[y * mc + x] = s / n; cov2[y * mc + x] = s2 / n;
  }
  const pd2 = new Float64Array(mc * mr);
  for (let i = 0; i < pd2.length; i++) pd2[i] = mat[i] === 2 ? 1e20 : 0;
  edt2(pd2, mc, mr);
  const pd = new Float32Array(mc * mr);
  for (let i = 0; i < pd.length; i++) pd[i] = Math.min(8, Math.sqrt(pd2[i]));
  const wornAt = new Map<number, number[]>();
  const wd = d.worn ?? [];
  for (let i = 0; i + 2 < wd.length; i += 3) {
    const x = wd[i], y = wd[i + 1], r = wd[i + 2];
    for (let ty = Math.floor((y - r - 2) / TILE); ty <= Math.floor((y + r + 2) / TILE); ty++) for (let tx = Math.floor((x - r - 2) / TILE); tx <= Math.floor((x + r + 2) / TILE); tx++) {
      if (tx < 0 || ty < 0 || tx >= d.cols || ty >= d.rows) continue;
      const k = ty * d.cols + tx, l = wornAt.get(k);
      if (l) l.push(x, y, r); else wornAt.set(k, [x, y, r]);
    }
  }
  const leaf = new Uint8Array(d.cols * d.rows);
  for (const t of trees) {
    const cx = t.x / TILE, cy = t.y / TILE;
    for (let y = Math.max(0, Math.floor(cy - 3.2)); y <= Math.min(d.rows - 1, Math.floor(cy + 3.2)); y++) for (let x = Math.max(0, Math.floor(cx - 3.2)); x <= Math.min(d.cols - 1, Math.floor(cx + 3.2)); x++) leaf[y * d.cols + x] = 1;
  }
  return { d, mat, mc, mr, cov, cov2, pd, leaf, wornAt };
}

/** The atlas tile (index) for a grass tile, and its flip flags (128 flipX, 256 flipY, 512 transpose). */
export function grassTile(g: GroundCtx, tx: number, ty: number): number {
  const { seed, tiles } = g.d;
  const pick = (list: number[], salt: number) => list[Math.floor(hash2(seed + salt, tx, ty) * list.length)];
  const fl = valueNoise(seed + 5, tx, ty, 5), lf = valueNoise(seed + 6, tx, ty, 4), roll = hash2(seed + 7, tx, ty);
  const set = fl > 0.62 && roll < 0.55 ? tiles.flower : (g.leaf[ty * g.d.cols + tx] || lf > 0.68) && roll < 0.5 ? tiles.leaves : tiles.grassA;
  const flags = (hash2(seed + 8, tx, ty) < 0.5 ? 128 : 0) | (hash2(seed + 9, tx, ty) < 0.5 ? 256 : 0) | (hash2(seed + 10, tx, ty) < 0.25 ? 512 : 0);
  return pick(set, 4) | flags;
}

/** Reads a pixel of tile `v` (index | flags) at (px, py) in 0..31 into out[0..2]. */
function tilePx(a: GroundAtlas, cols: number, v: number, px: number, py: number, out: number[]) {
  let x = px, y = py;
  if (v & 512) { const t = x; x = y; y = t; }
  if (v & 128) x = TILE - 1 - x;
  if (v & 256) y = TILE - 1 - y;
  const idx = v & 127, sx = (idx % cols) * TILE + x, sy = Math.floor(idx / cols) * TILE + y, o = (sy * a.w + sx) * 4;
  out[0] = a.data[o]; out[1] = a.data[o + 1]; out[2] = a.data[o + 2];
}

const nn: number[] = [0, 0, 0];
const ti2 = (d: { cols: number }, ty: number, tx: number) => ty * d.cols + tx;
const covAt = (g: GroundCtx, x: number, y: number) => (x < 0 || y < 0 || x >= g.mc || y >= g.mr ? 0 : g.cov[y * g.mc + x]);
const covAt2 = (g: GroundCtx, x: number, y: number) => (x < 0 || y < 0 || x >= g.mc || y >= g.mr ? 0 : g.cov2[y * g.mc + x]);
/**
 * Whether the pixel (wx, wy) in the world is path/plaza land: 0 grass, 1 path, 2 plaza. The land edge (any material against grass) and the paving's edge
 * (plaza against path) are both ragged: each is a blurred coverage plus the same seeded noise, thresholded.
 */
export function landAt(g: GroundCtx, wx: number, wy: number): number {
  const fx = (wx + 0.5) / MATC - 0.5, fy = (wy + 0.5) / MATC - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const v = covAt(g, x0, y0) * (1 - tx) * (1 - ty) + covAt(g, x0 + 1, y0) * tx * (1 - ty) + covAt(g, x0, y0 + 1) * (1 - tx) * ty + covAt(g, x0 + 1, y0 + 1) * tx * ty;
  if (v <= 0.02) return 0;
  const cx = Math.min(g.mc - 1, Math.max(0, Math.floor(wx / MATC))), cy = Math.min(g.mr - 1, Math.max(0, Math.floor(wy / MATC)));
  const here = g.mat[cy * g.mc + cx];
  const seed = g.d.seed;
  const n = hash2(seed + 21, wx, wy) * 0.45 + valueNoise(seed + 22, wx, wy, 5) * 0.55 - 0.5;
  if (v + n * 0.7 <= 0.5) return 0;
  const p = covAt2(g, x0, y0) * (1 - tx) * (1 - ty) + covAt2(g, x0 + 1, y0) * tx * (1 - ty) + covAt2(g, x0, y0 + 1) * (1 - tx) * ty + covAt2(g, x0 + 1, y0 + 1) * tx * ty;
  if (p > 0.02 && p + n * 0.8 > 0.5) return 2;
  return here === 1 || here === 2 || nearMat(g, cx, cy, 1) || nearMat(g, cx, cy, 2) ? 1 : 0;
}
function nearMat(g: GroundCtx, cx: number, cy: number, v: number): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < g.mc && y < g.mr && g.mat[y * g.mc + x] === v) return true; }
  return false;
}

/**
 * Paints rows j0 to j1 (default: all 512) of chunk (cx, cy) into `out` (512 x 512 RGBA, opaque). Blocks of 8 x 8 px whose 3 x 3 cells are all grass or
 * all one solid material skip the per pixel test. A chunk can be painted in slabs over several frames (the engine does one slab of 64 rows a frame
 * for the chunks the camera is about to need), each slab reading its 2 px ring of neighbours from the material, so the slabs join exactly.
 */
export function paintChunk(g: GroundCtx, atlas: GroundAtlas, cx: number, cy: number, out: Uint8ClampedArray, scratch?: Uint8Array, j0 = 0, j1 = CHUNK_TILES * TILE) {
  const S = CHUNK_TILES * TILE, P = 2, W = S + 2 * P, B = S / MATC;
  const land = scratch ?? new Uint8Array(W * W);
  const ox = cx * S, oy = cy * S;
  const { d } = g;
  const mw = d.cols * TILE, mh = d.rows * TILE;
  const bx0 = ox / MATC, by0 = oy / MATC;
  // 1. which blocks are decided without noise: all of the 3 x 3 cells round them grass (0) or the same solid material (1 path, 2 plaza)
  const fixedB = new Int8Array(B * B);
  for (let by = 0; by < B; by++) for (let bx = 0; bx < B; bx++) {
    const gx = bx0 + bx, gy = by0 + by;
    let lo = 1, hi = 0, m = -1, same = true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = gx + dx, y = gy + dy, c = covAt(g, x, y), mm = x < 0 || y < 0 || x >= g.mc || y >= g.mr ? 0 : g.mat[y * g.mc + x];
      if (c < lo) lo = c; if (c > hi) hi = c;
      if (m === -1) m = mm; else if (mm !== m) same = false;
    }
    fixedB[by * B + bx] = hi <= 0.02 ? 0 : lo >= 0.98 && same && m > 0 ? m : -1;
  }
  // land for the slab and its 2 px ring
  const r0 = Math.max(-P, j0 - P), r1 = Math.min(S + P, j1 + P);
  for (let j = r0; j < r1; j++) {
    const wy = oy + j, by = Math.floor(j / MATC);
    for (let i = -P; i < S + P; i++) {
      const wx = ox + i;
      let v: number;
      if (wx < 0 || wy < 0 || wx >= mw || wy >= mh) v = 0;
      else { const f = j >= 0 && j < S && i >= 0 && i < S ? fixedB[by * B + Math.floor(i / MATC)] : -1; v = f >= 0 ? f : landAt(g, wx, wy); }
      land[(j + P) * W + i + P] = v;
    }
  }
  // 2. per tile choices, once
  const T = CHUNK_TILES, grassOf = new Int32Array(T * T).fill(-1), dirtOf = new Int32Array(T * T).fill(-1);
  const col = nn;
  for (let j = j0; j < j1; j++) {
    const wy = oy + j, ty = Math.floor(wy / TILE), py = wy - ty * TILE;
    for (let i = 0; i < S; i++) {
      const wx = ox + i, tx = Math.floor(wx / TILE), px = wx - tx * TILE, li = (j + P) * W + i + P, m = land[li], ti = (ty - cy * T) * T + (tx - cx * T);
      let r: number, gg: number, b: number;
      if (tx >= d.cols || ty >= d.rows) { r = 109; gg = 143; b = 60; }
      else if (m === 2) {
        tilePx(atlas, d.groundCols, d.tiles.plaza, px, py, col);
        const cxm = Math.min(g.mc - 1, Math.max(0, Math.floor(wx / MATC))), cym = Math.min(g.mr - 1, Math.max(0, Math.floor(wy / MATC)));
        const fade = Math.min(1, g.pd[cym * g.mc + cxm] / 5), lift = PLAZA_LIFT_EDGE + (PLAZA_LIFT - PLAZA_LIFT_EDGE) * fade;
        r = col[0] + (PLAZA_TAN[0] - col[0]) * lift; gg = col[1] + (PLAZA_TAN[1] - col[1]) * lift; b = col[2] + (PLAZA_TAN[2] - col[2]) * lift;
        // a stone border: the paving's outermost pixel against path or grass
        if (land[li - 1] !== 2 || land[li + 1] !== 2 || land[li - W] !== 2 || land[li + W] !== 2) { r = STONE[0]; gg = STONE[1]; b = STONE[2]; }
      }
      else if (m === 1) {
        if (dirtOf[ti] < 0) dirtOf[ti] = d.tiles.dirt[Math.floor(hash2(d.seed + 2, tx, ty) * d.tiles.dirt.length)];
        tilePx(atlas, d.groundCols, dirtOf[ti], px, py, col);
        r = col[0] + (PATH_TAN[0] - col[0]) * PATH_LIFT; gg = col[1] + (PATH_TAN[1] - col[1]) * PATH_LIFT; b = col[2] + (PATH_TAN[2] - col[2]) * PATH_LIFT;
        // the rim: a path pixel with grass at a 4-neighbour is the dirt's darker tone
        if (land[li - 1] === 0 || land[li + 1] === 0 || land[li - W] === 0 || land[li + W] === 0) { r = RIM[0]; gg = RIM[1]; b = RIM[2]; }
      } else {
        if (grassOf[ti] < 0) grassOf[ti] = grassTile(g, tx, ty);
        tilePx(atlas, d.groundCols, grassOf[ti], px, py, col);
        r = col[0]; gg = col[1]; b = col[2];
        const wl = g.wornAt.get(ti2(d, ty, tx));
        if (wl) {
          let a = 0;
          for (let q = 0; q < wl.length; q += 3) { const dd = Math.hypot(wx - wl[q], (wy - wl[q + 1]) * 1.35) / wl[q + 2]; if (dd < 1) a = Math.max(a, 1 - dd); }
          if (a > 0 && a * 1.25 + (hash2(d.seed + 35, wx, wy) - 0.5) * 0.8 + (valueNoise(d.seed + 36, wx, wy, 4) - 0.5) * 0.5 > 0.42) { r = r * 0.25 + WORN[0] * 0.75; gg = gg * 0.25 + WORN[1] * 0.75; b = b * 0.25 + WORN[2] * 0.75; }
        }
        const touch = land[li - 1] !== 0 || land[li + 1] !== 0 || land[li - W] !== 0 || land[li + W] !== 0;
        if (touch) { if (hash2(d.seed + 31, wx, wy) < 0.7) { r = TUFT[0]; gg = TUFT[1]; b = TUFT[2]; } }
        else if ((land[li - 2] !== 0 || land[li + 2] !== 0 || land[li - 2 * W] !== 0 || land[li + 2 * W] !== 0) && hash2(d.seed + 32, wx, wy) < 0.16) { r = TUFT[0]; gg = TUFT[1]; b = TUFT[2]; }
      }
      const o = (j * S + i) * 4;
      out[o] = r; out[o + 1] = gg; out[o + 2] = b; out[o + 3] = 255;
    }
  }
}
