/**
 * How people move about the Grand Library, as pure maths over a walkable mask: no DOM, no clock.
 *
 * The room (public/library/layout.json) has a 16 px grid of tiles, each walkable or not, and everyone's FEET stand
 * on it: tile (tx, ty) holds feet whose x is in [16 tx, 16 tx + 16) and whose y is in [16 ty + 4, 16 ty + 20)
 * (cafeScene.ts `feet` and `tileOf`: the tile's middle is (16 tx + 8, 16 ty + 12)). This module is that grid made
 * free:
 *
 *   - `route`   an 8-connected route over tiles (diagonals allowed, never cutting a corner through a wall),
 *   - `pull`    string pulling: the route's waypoints thinned to the few straight runs a person can really walk,
 *   - `slide`   one step of free movement with a small box at the feet: along a wall or a table rather than stopping
 *               dead, a little help round a corner, never into blocked space,
 *   - `facing`  which way to face for a direction of travel, with hysteresis so a diagonal does not flicker.
 *
 * It is used by the library mode of the room engine only (src/components/landing/cafeScene.ts): the homepage's
 * café keeps its tile steps. Positions are art pixels, the units of the wire's `lx, ly` over two (room.ts).
 */

export type Pt = readonly [x: number, y: number];
export type Tile = readonly [tx: number, ty: number];
export type Face = "right" | "back" | "left" | "front";

/** The walkable mask: `open(tx, ty)` is true where feet may stand. It need not bounds-check; `cols` and `rows` do. */
export interface Grid { cols: number; rows: number; open(tx: number, ty: number): boolean }

export const TILE = 16;
/** The feet-y at which a tile's row begins: a tile's row is [16 ty + 4, 16 ty + 20). */
export const ROW_TOP = 4;
/** The footprint: a box 8 px wide and 6 px deep round the feet. A one-tile corridor (16 px) takes it with room to spare. */
export const HALF_W = 4;
export const HALF_H = 3;
/** Walking clearance asked of a planned line, beyond the footprint, so a route does not graze a corner. */
const CLEAR = 1;
/** How far a corner may nudge you sideways to find the way on (px). */
export const ASSIST = 5;

export const cellOf = (x: number, y: number): Tile => [Math.floor(x / TILE), Math.floor((y - ROW_TOP) / TILE)];
export const centreOf = ([tx, ty]: Tile): Pt => [tx * TILE + TILE / 2, ty * TILE + ROW_TOP + TILE / 2];

export const isOpen = (g: Grid, tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < g.cols && ty < g.rows && g.open(tx, ty);

/** Builds a grid from layout.json's `walk` rows ("." walkable). */
export function gridOf(walk: readonly string[], cols = walk[0]?.length ?? 0): Grid {
  return { cols, rows: walk.length, open: (tx, ty) => walk[ty]?.[tx] === "." };
}

/** Whether a person's footprint (grown by `grow` px) can stand with its feet at (x, y): every tile it touches is walkable. */
export function fits(g: Grid, x: number, y: number, grow = 0): boolean {
  const hw = HALF_W + grow, hh = HALF_H + grow, e = 1e-6;
  const x0 = Math.floor((x - hw) / TILE), x1 = Math.floor((x + hw - e) / TILE);
  const y0 = Math.floor((y - hh - ROW_TOP) / TILE), y1 = Math.floor((y + hh - e - ROW_TOP) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (!isOpen(g, tx, ty)) return false;
  return true;
}

const SQRT2 = Math.SQRT2;
const STEPS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

/** The tiles one step from (tx, ty), diagonals only where both tiles beside them are open (no cutting a corner). */
function around(g: Grid, tx: number, ty: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const [dx, dy, c] of STEPS) {
    const nx = tx + dx, ny = ty + dy;
    if (!isOpen(g, nx, ny)) continue;
    if (dx !== 0 && dy !== 0 && !(isOpen(g, tx + dx, ty) && isOpen(g, tx, ty + dy))) continue;
    out.push([nx, ny, c]);
  }
  return out;
}

/** The shortest 8-connected route over open tiles: from (exclusive) to to (inclusive), [] when already there, null when there is none. */
export function route(g: Grid, from: Tile, to: Tile): Tile[] | null {
  if (!isOpen(g, to[0], to[1])) return null;
  const { cols, rows } = g, key = (x: number, y: number) => y * cols + x;
  if (from[0] < 0 || from[1] < 0 || from[0] >= cols || from[1] >= rows) return null;
  const best = new Float64Array(cols * rows).fill(Infinity), prev = new Int32Array(cols * rows).fill(-1);
  const h = (x: number, y: number) => { const dx = Math.abs(x - to[0]), dy = Math.abs(y - to[1]); return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy); };
  // a binary heap of [f, x, y]
  const heap: [number, number, number][] = [];
  const push = (n: [number, number, number]) => {
    heap.push(n);
    for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  best[key(...from)] = 0;
  push([h(...from), from[0], from[1]]);
  while (heap.length) {
    const [f, x, y] = pop();
    const g0 = best[key(x, y)];
    if (f > g0 + h(x, y) + 1e-9) continue;     // a stale entry
    if (x === to[0] && y === to[1]) {
      const out: Tile[] = [];
      for (let k = key(x, y); k !== key(...from); k = prev[k]) out.push([k % cols, Math.floor(k / cols)]);
      return out.reverse();
    }
    for (const [nx, ny, c] of around(g, x, y)) {
      const k = key(nx, ny), cost = g0 + c;
      if (cost < best[k] - 1e-9) { best[k] = cost; prev[k] = key(x, y); push([cost + h(nx, ny), nx, ny]); }
    }
  }
  return null;
}

/** Every tile one can walk to from `from` (8-connected as `route`), keyed y * cols + x, in the order found. */
export function reach(g: Grid, from: Tile): number[] {
  const { cols } = g, seen = new Set<number>([from[1] * cols + from[0]]), q: Tile[] = [from], out: number[] = [];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    out.push(y * cols + x);
    for (const [nx, ny] of around(g, x, y)) {
      const k = ny * cols + nx;
      if (!seen.has(k)) { seen.add(k); q.push([nx, ny]); }
    }
  }
  return out;
}

/** The reachable tile whose middle is nearest a point (ties: the one found first). */
export function nearestTile(g: Grid, from: Tile, x: number, y: number): Tile | null {
  let best: Tile | null = null, bd = Infinity;
  for (const k of reach(g, from)) {
    const t: Tile = [k % g.cols, Math.floor(k / g.cols)], [cx, cy] = centreOf(t), d = (cx - x) ** 2 + (cy - y) ** 2;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

/** Where to stand if (x, y) is not somewhere one can: the middle of the nearest open tile (within a few tiles), else the point itself. */
export function settle(g: Grid, x: number, y: number): Pt {
  if (fits(g, x, y)) return [x, y];
  const [cx, cy] = cellOf(x, y);
  let best: Pt | null = null, bd = Infinity;
  for (let r = 1; r <= 6 && !best; r++) {
    for (let ty = cy - r; ty <= cy + r; ty++) for (let tx = cx - r; tx <= cx + r; tx++) {
      if (!isOpen(g, tx, ty)) continue;
      const c = centreOf([tx, ty]), d = (c[0] - x) ** 2 + (c[1] - y) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
  }
  return best ?? [x, y];
}

/** Whether one can walk the straight line a to b: the footprint (and its clearance) stands everywhere along it. */
export function seen(g: Grid, a: Pt, b: Pt, grow = CLEAR): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 0; i <= n; i++) if (!fits(g, a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, grow)) return false;
  return true;
}

/**
 * String pulling: from `start`, walk to the furthest waypoint in sight, then again from there. The waypoints of a tile
 * route become the few straight runs (diagonals included) a person can walk. Each leg is one `seen` line, so a walk
 * never leaves the floor; a waypoint that cannot be seen (it always can, from the tile beside it) is taken as it is.
 */
export function pull(g: Grid, start: Pt, pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  let at = start, i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !seen(g, at, pts[j])) j--;
    out.push(pts[j]);
    at = pts[j];
    i = j + 1;
  }
  return out;
}

/**
 * A walk from a point to a tile (and on to `dest`, a point inside it, if given): the points to walk to, in order, not
 * counting where you are. Null when the tile cannot be reached. A start that is not somewhere one can stand (a seat's
 * own spot, or a place heard from another device) first walks to the nearest floor.
 */
export function plan(g: Grid, from: Pt, to: Tile, dest?: Pt): Pt[] | null {
  const lead: Pt[] = [];
  let origin = from;
  if (!fits(g, from[0], from[1])) { origin = settle(g, from[0], from[1]); lead.push(origin); }
  const tiles = route(g, cellOf(origin[0], origin[1]), to);
  if (!tiles) return null;
  const way = tiles.map(centreOf);
  const end = dest && fits(g, dest[0], dest[1]) ? dest : null;
  if (end && way.length) way[way.length - 1] = end;
  else if (end) way.push(end);
  else if (!way.length) { const c = centreOf(to); if (Math.hypot(c[0] - origin[0], c[1] - origin[1]) > 0.5) way.push(c); }
  return [...lead, ...pull(g, origin, way)];
}

/**
 * One step of free movement: from (x, y) by (dx, dy), in sub-steps no longer than 1.5 px. A blocked step slides along
 * the wall (the part of the move that is free is kept); a straight push at a corner within `ASSIST` px of the way on
 * is eased sideways, so a doorway or a one-tile gap is never missed by a pixel. The footprint is never in blocked space.
 */
export function slide(g: Grid, x: number, y: number, dx: number, dy: number): Pt {
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return [x, y];
  const n = Math.max(1, Math.ceil(len / 1.5)), sx = dx / n, sy = dy / n, step = Math.hypot(sx, sy);
  for (let i = 0; i < n; i++) {
    if (fits(g, x + sx, y + sy)) { x += sx; y += sy; continue; }
    if (sx !== 0 && sy !== 0) {
      if (fits(g, x + sx, y)) { x += sx; continue; }
      if (fits(g, x, y + sy)) { y += sy; continue; }
      break;
    }
    // a straight push that is blocked: find the nearest sideways offset from which it is not, and move that way
    let nudged = false;
    for (let o = 1; o <= ASSIST && !nudged; o++) for (const s of [1, -1]) {
      const ox = sx === 0 ? s * o : 0, oy = sy === 0 ? s * o : 0;
      if (!fits(g, x + ox, y + oy) || !fits(g, x + ox + sx, y + oy + sy)) continue;
      const m = Math.min(step, o);
      if (fits(g, x + (ox ? s * m : 0), y + (oy ? s * m : 0))) { x += ox ? s * m : 0; y += oy ? s * m : 0; nudged = true; }
      break;
    }
    if (!nudged) break;
  }
  return [x, y];
}

/** Where a person would be after `seconds` more of holding the same direction at `speed` px a second (blocked space respected). */
export function ahead(g: Grid, x: number, y: number, vx: number, vy: number, speed: number, seconds: readonly number[]): Pt[] {
  const out: Pt[] = [];
  let at: Pt = [x, y], t0 = 0;
  for (const t of seconds) {
    const next = slide(g, at[0], at[1], vx * speed * (t - t0), vy * speed * (t - t0));
    t0 = t;
    const last = out[out.length - 1] ?? [x, y];
    at = next;
    if (Math.hypot(next[0] - last[0], next[1] - last[1]) >= 1) out.push(next);
  }
  return out;
}

/** The unit direction for held keys (x: -1 left, 1 right; y: -1 up, 1 down): two keys are a diagonal at the same speed. */
export function heading(kx: number, ky: number): Pt {
  const len = Math.hypot(kx, ky);
  return len === 0 ? [0, 0] : [kx / len, ky / len];
}

/**
 * Which way to face for a direction of travel. The sprite has four faces; a diagonal keeps the face it had until the
 * other axis clearly wins (by a third), so it does not flicker between two while heading along a diagonal.
 */
export function facing(dx: number, dy: number, prev: Face): Face {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < 1e-6 && ay < 1e-6) return prev;
  const wasSide = prev === "left" || prev === "right";
  const side = wasSide ? !(ay > ax * 1.35) : ax > ay * 1.35;
  return side ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "front" : "back");
}
