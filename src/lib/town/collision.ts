import { CELL, NAV, type Rect } from "./types";
import type { Grid, Metrics } from "../studyapp/library/walk";

/** Metrics for `walk.ts` over this town: 8 px collision cells and 16 px navigation cells; feet are a box 8 wide, 6 deep (the library's), cells start at y = 0. */
export const FINE: Metrics = { tile: CELL, rowTop: 0, halfW: 4, halfH: 3, clear: 1, assist: 5 };
export const COARSE: Metrics = { tile: NAV, rowTop: 0, halfW: 4, halfH: 3, clear: 1, assist: 5 };

/**
 * Collision on an 8 px cell bitset (one bit a cell). A cell is blocked when any object's blocking rect touches it or it lies outside the walkable
 * bounds. `fits` asks whether a person's feet box (8 x 6 art px) can stand at a point; `slide` is the library's sliding step without the
 * arrays it returns (the frame loop must not allocate).
 */
export class CollisionGrid {
  readonly cols: number; readonly rows: number;
  private bits: Uint32Array;
  /** The same data as a `walk.ts` Grid (8 px cells), for routing and string pulling. */
  readonly fine: Grid;

  constructor(readonly width: number, readonly height: number, bounds: Rect) {
    this.cols = Math.ceil(width / CELL); this.rows = Math.ceil(height / CELL);
    this.bits = new Uint32Array(Math.ceil((this.cols * this.rows) / 32));
    // everything outside the bounds is blocked
    const bx0 = Math.ceil(bounds.x / CELL), by0 = Math.ceil(bounds.y / CELL), bx1 = Math.floor((bounds.x + bounds.w) / CELL), by1 = Math.floor((bounds.y + bounds.h) / CELL);
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) if (x < bx0 || x >= bx1 || y < by0 || y >= by1) this.set(x, y);
    this.fine = { cols: this.cols, rows: this.rows, open: (tx, ty) => !this.blocked(tx, ty), m: FINE };
  }

  private set(x: number, y: number) { const i = y * this.cols + x; this.bits[i >> 5] |= 1 << (i & 31); }
  blocked(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return true;
    const i = y * this.cols + x;
    return (this.bits[i >> 5] & (1 << (i & 31))) !== 0;
  }

  /** Blocks every cell the rect touches. */
  addRect(r: Rect) {
    const x0 = Math.max(0, Math.floor(r.x / CELL)), x1 = Math.min(this.cols - 1, Math.ceil((r.x + r.w) / CELL) - 1);
    const y0 = Math.max(0, Math.floor(r.y / CELL)), y1 = Math.min(this.rows - 1, Math.ceil((r.y + r.h) / CELL) - 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y);
  }

  /** Whether a person's feet box (grown by `grow`) can stand at (x, y). */
  fits(x: number, y: number, grow = 0): boolean {
    const hw = 4 + grow, hh = 3 + grow, e = 1e-6;
    const x0 = Math.floor((x - hw) / CELL), x1 = Math.floor((x + hw - e) / CELL), y0 = Math.floor((y - hh) / CELL), y1 = Math.floor((y + hh - e) / CELL);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.blocked(tx, ty)) return false;
    return true;
  }

  /** The count of blocked cells (for stats and tests). */
  count(): number { let n = 0; for (let i = 0; i < this.cols * this.rows; i++) if (this.blocked(i % this.cols, Math.floor(i / this.cols))) n++; return n; }

  /**
   * One step of free movement from (x, y) by (dx, dy), in sub-steps of at most 1.5 px, written to `out[0..1]`: along a wall rather than stopping
   * dead, a straight push at a corner within `assist` px of the way on is eased sideways. Never into blocked space. (walk.ts `slide`, no allocation.)
   */
  slide(x: number, y: number, dx: number, dy: number, assist: number, out: Float64Array) {
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) { out[0] = x; out[1] = y; return; }
    const n = Math.max(1, Math.ceil(len / 1.5)), sx = dx / n, sy = dy / n, step = Math.sqrt(sx * sx + sy * sy);
    for (let i = 0; i < n; i++) {
      if (this.fits(x + sx, y + sy)) { x += sx; y += sy; continue; }
      if (sx !== 0 && sy !== 0) {
        if (this.fits(x + sx, y)) { x += sx; continue; }
        if (this.fits(x, y + sy)) { y += sy; continue; }
        break;
      }
      let nudged = false;
      for (let o = 1; o <= assist && !nudged; o++) {
        for (let k = 0; k < 2; k++) {
          const s = k === 0 ? 1 : -1, ox = sx === 0 ? s * o : 0, oy = sy === 0 ? s * o : 0;
          if (!this.fits(x + ox, y + oy) || !this.fits(x + ox + sx, y + oy + sy)) continue;
          const m = Math.min(step, o);
          if (this.fits(x + (ox ? s * m : 0), y + (oy ? s * m : 0))) { x += ox ? s * m : 0; y += oy ? s * m : 0; nudged = true; }
          break;
        }
      }
      if (!nudged) break;
    }
    out[0] = x; out[1] = y;
  }
}
