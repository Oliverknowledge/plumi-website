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
import { hash2, valueNoise } from "./rng";
import { CHUNK_TILES, TILE, type TownData } from "./types";

export const MATC = 8;                 // art px per material cell
export const PATH_TAN = [238, 214, 150] as const;
export const PATH_LIFT = 0.55;
export const PLAZA_TAN = [244, 228, 184] as const;
export const PLAZA_LIFT = 0.5;
const TUFT = [105, 124, 52] as const;  // darker than the grass atlas's (127,140,62): the tuft reads on both greens
const RIM = [196, 150, 92] as const;   // the dirt's own darker tone, lifted a little

export interface GroundAtlas { w: number; h: number; data: Uint8ClampedArray }
export interface GroundCtx {
  d: Pick<TownData, "cols" | "rows" | "seed" | "groundCols" | "tiles">;
  mat: Uint8Array; mc: number; mr: number;       // material cells
  cov: Float32Array;                              // blurred path-or-plaza coverage, per cell
  leaf: Uint8Array;                               // per tile: a tree is near
}

export function makeGroundCtx(d: GroundCtx["d"] & { mat: { rle: number[] } }, trees: { x: number; y: number }[], mat: Uint8Array): GroundCtx {
  const mc = d.cols * (TILE / MATC), mr = d.rows * (TILE / MATC);
  const cov = new Float32Array(mc * mr);
  for (let y = 0; y < mr; y++) for (let x = 0; x < mc; x++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= mc || ny >= mr) continue;
      n++; if (mat[ny * mc + nx]) s++;
    }
    cov[y * mc + x] = s / n;
  }
  const leaf = new Uint8Array(d.cols * d.rows);
  for (const t of trees) {
    const cx = t.x / TILE, cy = t.y / TILE;
    for (let y = Math.max(0, Math.floor(cy - 3.2)); y <= Math.min(d.rows - 1, Math.floor(cy + 3.2)); y++) for (let x = Math.max(0, Math.floor(cx - 3.2)); x <= Math.min(d.cols - 1, Math.floor(cx + 3.2)); x++) leaf[y * d.cols + x] = 1;
  }
  return { d, mat, mc, mr, cov, leaf };
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
/** Whether the pixel (wx, wy) in the world is path/plaza land: 0 grass, 1 path, 2 plaza. */
export function landAt(g: GroundCtx, wx: number, wy: number): number {
  const fx = (wx + 0.5) / MATC - 0.5, fy = (wy + 0.5) / MATC - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const c = (x: number, y: number) => (x < 0 || y < 0 || x >= g.mc || y >= g.mr ? 0 : g.cov[y * g.mc + x]);
  const v = c(x0, y0) * (1 - tx) * (1 - ty) + c(x0 + 1, y0) * tx * (1 - ty) + c(x0, y0 + 1) * (1 - tx) * ty + c(x0 + 1, y0 + 1) * tx * ty;
  if (v <= 0.02) return 0;
  const cx = Math.min(g.mc - 1, Math.max(0, Math.floor(wx / MATC))), cy = Math.min(g.mr - 1, Math.max(0, Math.floor(wy / MATC)));
  const here = g.mat[cy * g.mc + cx];
  if (here === 2 && v > 0.45) return 2;                                  // plaza: a straight cut at the cell outline, no noise
  const seed = g.d.seed;
  const n = hash2(seed + 21, wx, wy) * 0.45 + valueNoise(seed + 22, wx, wy, 5) * 0.55 - 0.5;
  if (v + n * 0.7 <= 0.5) return 0;
  return here === 2 ? 2 : g.mat[cy * g.mc + cx] === 1 || nearMat(g, cx, cy, 1) ? 1 : 0;
}
function nearMat(g: GroundCtx, cx: number, cy: number, v: number): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < g.mc && y < g.mr && g.mat[y * g.mc + x] === v) return true; }
  return false;
}

/** Paints chunk (cx, cy) into `out` (512 x 512 RGBA, opaque). */
export function paintChunk(g: GroundCtx, atlas: GroundAtlas, cx: number, cy: number, out: Uint8ClampedArray, scratch?: Uint8Array) {
  const S = CHUNK_TILES * TILE, P = 2, W = S + 2 * P;
  const land = scratch ?? new Uint8Array(W * W);
  const ox = cx * S, oy = cy * S;
  const { d } = g;
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const wx = ox + i - P, wy = oy + j - P;
    land[j * W + i] = wx < 0 || wy < 0 || wx >= d.cols * TILE || wy >= d.rows * TILE ? 0 : landAt(g, wx, wy);
  }
  const col = nn;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const wx = ox + i, wy = oy + j, tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE), px = wx - tx * TILE, py = wy - ty * TILE;
    const m = land[(j + P) * W + i + P];
    let r: number, gg: number, b: number;
    if (tx >= d.cols || ty >= d.rows) { r = 109; gg = 143; b = 60; }
    else if (m === 2) { tilePx(atlas, d.groundCols, d.tiles.plaza, px, py, col); r = col[0] + (PLAZA_TAN[0] - col[0]) * PLAZA_LIFT; gg = col[1] + (PLAZA_TAN[1] - col[1]) * PLAZA_LIFT; b = col[2] + (PLAZA_TAN[2] - col[2]) * PLAZA_LIFT; }
    else if (m === 1) {
      const dv = d.tiles.dirt[Math.floor(hash2(d.seed + 2, tx, ty) * d.tiles.dirt.length)];
      tilePx(atlas, d.groundCols, dv, px, py, col);
      r = col[0] + (PATH_TAN[0] - col[0]) * PATH_LIFT; gg = col[1] + (PATH_TAN[1] - col[1]) * PATH_LIFT; b = col[2] + (PATH_TAN[2] - col[2]) * PATH_LIFT;
      // the rim: a path pixel with grass at a 4-neighbour is the dirt's darker tone
      const li = (j + P) * W + i + P;
      if (land[li - 1] === 0 || land[li + 1] === 0 || land[li - W] === 0 || land[li + W] === 0) { r = RIM[0]; gg = RIM[1]; b = RIM[2]; }
    } else {
      tilePx(atlas, d.groundCols, grassTile(g, Math.min(tx, d.cols - 1), Math.min(ty, d.rows - 1)), px, py, col);
      r = col[0]; gg = col[1]; b = col[2];
      const li = (j + P) * W + i + P;
      const touch = land[li - 1] !== 0 || land[li + 1] !== 0 || land[li - W] !== 0 || land[li + W] !== 0;
      if (touch) { if (hash2(d.seed + 31, wx, wy) < 0.7) { r = TUFT[0]; gg = TUFT[1]; b = TUFT[2]; } }
      else if ((land[li - 2] !== 0 || land[li + 2] !== 0 || land[li - 2 * W] !== 0 || land[li + 2 * W] !== 0) && hash2(d.seed + 32, wx, wy) < 0.16) { r = TUFT[0]; gg = TUFT[1]; b = TUFT[2]; }
    }
    const o = (j * S + i) * 4;
    out[o] = r; out[o + 1] = gg; out[o + 2] = b; out[o + 3] = 255;
  }
}
