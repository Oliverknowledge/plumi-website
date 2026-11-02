import { NAV, type Rect } from "./types";
import { CollisionGrid, COARSE } from "./collision";
import { cellIn, centreIn, fits as wfits, pull, route, seen, settle, type Grid, type Pt } from "../studyapp/library/walk";

/**
 * Navigation: A* over a COARSER grid (16 px cells; a cell is open when a person fits at its middle with one pixel to spare), the route then
 * string-pulled over the FINE collision cells (8 px) so a walk is a few straight runs that never cross a blocked cell.
 * Routing and pulling are `walk.ts` (parametric over its metrics); this file only builds the coarse grid and joins the two.
 */
export class Nav {
  readonly grid: Grid;
  readonly cols: number; readonly rows: number;
  private openBits: Uint8Array;

  constructor(readonly coll: CollisionGrid) {
    this.cols = Math.ceil(coll.width / NAV); this.rows = Math.ceil(coll.height / NAV);
    this.openBits = new Uint8Array(this.cols * this.rows);
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) this.openBits[y * this.cols + x] = coll.fits(x * NAV + NAV / 2, y * NAV + NAV / 2, 1) ? 1 : 0;
    this.grid = { cols: this.cols, rows: this.rows, open: (x, y) => x >= 0 && y >= 0 && x < this.cols && y < this.rows && this.openBits[y * this.cols + x] === 1, m: COARSE };
  }

  open(x: number, y: number) { return this.grid.open(x, y); }
  cellOf(x: number, y: number): [number, number] { const c = cellIn(x, y, COARSE); return [c[0], c[1]]; }
  centre(cx: number, cy: number): Pt { return centreIn([cx, cy], COARSE); }

  /** The open navigation cell nearest a point (rings outwards), or null. */
  nearestOpen(x: number, y: number, maxR = 12): [number, number] | null {
    const [cx, cy] = this.cellOf(x, y);
    let best: [number, number] | null = null, bd = Infinity;
    for (let r = 0; r <= maxR; r++) {
      for (let ty = cy - r; ty <= cy + r; ty++) for (let tx = cx - r; tx <= cx + r; tx++) {
        if (Math.max(Math.abs(tx - cx), Math.abs(ty - cy)) !== r || !this.open(tx, ty)) continue;
        const c = this.centre(tx, ty), d = (c[0] - x) ** 2 + (c[1] - y) ** 2;
        if (d < bd) { bd = d; best = [tx, ty]; }
      }
      if (best && r >= 1) break;
    }
    return best;
  }

  /**
   * A walk from a feet point to a feet point: the points to walk to in order (not counting where you are), null when there is no way.
   * A destination that cannot be stood on is moved to the nearest open cell's middle; a start that cannot be stood on first walks to the nearest floor.
   */
  plan(from: Pt, to: Pt): Pt[] | null {
    const f = this.coll.fine;
    const lead: Pt[] = [];
    let origin = from;
    if (!wfits(f, from[0], from[1])) { origin = settle(f, from[0], from[1]); lead.push(origin); }
    const a = this.cellOf(origin[0], origin[1]);
    const startCell: [number, number] | null = this.open(a[0], a[1]) ? a : this.nearestOpen(origin[0], origin[1], 3);
    const goalCell = this.nearestOpen(to[0], to[1]);
    if (!startCell || !goalCell) return null;
    const cells = route(this.grid, startCell, goalCell);
    if (!cells) return null;
    const way: Pt[] = cells.map((c) => this.centre(c[0], c[1]));
    const end: Pt | null = this.coll.fits(to[0], to[1]) && this.cellOf(to[0], to[1]).join() === goalCell.join() ? to : null;
    if (end && way.length) way[way.length - 1] = end;
    else if (end) way.push(end);
    else if (!way.length) { const c = this.centre(goalCell[0], goalCell[1]); if (Math.hypot(c[0] - origin[0], c[1] - origin[1]) > 0.5) way.push(c); }
    return [...lead, ...pull(f, origin, way)];
  }

  /** The walkable cells reachable from a point, as navigation cell keys (y * cols + x). */
  reachable(from: Pt): Set<number> {
    const start = this.nearestOpen(from[0], from[1], 4);
    const out = new Set<number>();
    if (!start) return out;
    const q: number[] = [start[1] * this.cols + start[0]];
    out.add(q[0]);
    for (let i = 0; i < q.length; i++) {
      const x = q[i] % this.cols, y = Math.floor(q[i] / this.cols);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (!this.open(nx, ny)) continue;
        if (dx && dy && !(this.open(x + dx, y) && this.open(x, y + dy))) continue;
        const k = ny * this.cols + nx;
        if (!out.has(k)) { out.add(k); q.push(k); }
      }
    }
    return out;
  }

  /** Every leg of a point list is a clear straight line over the fine cells. */
  clearPath(start: Pt, pts: readonly Pt[]): boolean {
    let at = start;
    for (const p of pts) { if (!seen(this.coll.fine, at, p, 0)) return false; at = p; }
    return true;
  }
}

export type { Rect };
