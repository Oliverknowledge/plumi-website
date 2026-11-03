import { getStroke } from "perfect-freehand";

/**
 * Handwriting as vectors (the Questions tab's answer zones).
 *
 * Ink lives in LOGICAL units: a zone is `REF_W` units wide whatever its size on screen, and y uses the same unit, so
 * a stroke re-renders at any width (an iPad turned round, a phone) exactly where it was written, and thickness
 * scales with it. Nothing here touches the browser except `outlinePath` returning an SVG path string; the canvas
 * code (components/studyapp/questions/InkCanvas.tsx) draws it.
 *
 * Storage form of a stroke (what is in IndexedDB, what `getAnswerImage` reads):
 *   { c: colour index, w: width index, sp?: 1 (pressure was simulated: a mouse or a finger), d: [x0, y0, p0, dx, dy, p, ...] }
 * `d` is whole numbers: x and y in tenths of a logical unit, pressure 0 to 100, every point after the first as a
 * difference from the one before it. A stroke is simplified (Ramer-Douglas-Peucker) before it is encoded, so a
 * long line costs a handful of points and a page of working a few tens of kilobytes.
 */

export const REF_W = 800;
export const INK_COLOURS = ["#22262e", "#2b57c9", "#1d7a47"] as const;
export const INK_COLOUR_NAMES = ["Black", "Blue", "Green"] as const;
/** Pen widths in logical units (about css pixels in a zone 800 wide). */
export const INK_WIDTHS = [2.1, 3.4, 5.6] as const;
export const INK_WIDTH_NAMES = ["Fine", "Medium", "Bold"] as const;
export const ERASER_RADIUS = 11;

export interface Pt { x: number; y: number; p: number }
export interface Stroke { c: number; w: number; sp?: 1; d: number[] }

/** One answer's ink: strokes in order, drawn bottom to top. */
export type Ink = readonly Stroke[];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const sq = (n: number) => n * n;

/* ── simplify ────────────────────────────────────────────────────────── */

/** Pressure counts as this many logical units per whole step, so a press that changes shape of the line is kept. */
const P_WEIGHT = 7;

function segDist3(a: Pt, b: Pt, q: Pt): number {
  const ax = a.x, ay = a.y, ap = a.p * P_WEIGHT;
  const bx = b.x - ax, by = b.y - ay, bp = b.p * P_WEIGHT - ap;
  const qx = q.x - ax, qy = q.y - ay, qp = q.p * P_WEIGHT - ap;
  const len2 = bx * bx + by * by + bp * bp;
  if (len2 === 0) return Math.hypot(qx, qy, qp);
  const t = clamp((qx * bx + qy * by + qp * bp) / len2, 0, 1);
  return Math.hypot(qx - t * bx, qy - t * by, qp - t * bp);
}

/** Ramer-Douglas-Peucker over x, y and (weighted) pressure. Keeps the first and last point. Iterative, so a long stroke cannot overflow the stack. */
export function simplify(points: readonly Pt[], tolerance = 0.45): Pt[] {
  const n = points.length;
  if (n <= 2) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    let worst = -1, at = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = segDist3(points[lo], points[hi], points[i]);
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tolerance && at > 0) { keep[at] = 1; stack.push([lo, at], [at, hi]); }
  }
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}

/* ── encode / decode ─────────────────────────────────────────────────── */

export function encodeStroke(points: readonly Pt[], c: number, w: number, simulatePressure: boolean): Stroke {
  const pts = simplify(points);
  const d: number[] = [];
  let px = 0, py = 0, pp = 0;
  pts.forEach((pt, i) => {
    const x = Math.round(pt.x * 10), y = Math.round(pt.y * 10), p = Math.round(clamp(pt.p, 0, 1) * 100);
    if (i === 0) d.push(x, y, p);
    else d.push(x - px, y - py, p - pp);
    px = x; py = y; pp = p;
  });
  const s: Stroke = { c: clamp(Math.round(c), 0, INK_COLOURS.length - 1), w: clamp(Math.round(w), 0, INK_WIDTHS.length - 1), d };
  if (simulatePressure) s.sp = 1;
  return s;
}

const decoded = new WeakMap<Stroke, Pt[]>();

export function decodeStroke(s: Stroke): Pt[] {
  const hit = decoded.get(s);
  if (hit) return hit;
  const out: Pt[] = [];
  let x = 0, y = 0, p = 0;
  for (let i = 0; i + 2 < s.d.length; i += 3) {
    if (i === 0) { x = s.d[0]; y = s.d[1]; p = s.d[2]; } else { x += s.d[i]; y += s.d[i + 1]; p += s.d[i + 2]; }
    out.push({ x: x / 10, y: y / 10, p: p / 100 });
  }
  decoded.set(s, out);
  return out;
}

/* ── storage hygiene ─────────────────────────────────────────────────── */

/** A stroke read back from storage, or null if it is not one. Numbers only, and not absurdly many. */
export function cleanStroke(raw: unknown): Stroke | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Stroke>;
  if (!Array.isArray(r.d) || r.d.length < 3 || r.d.length % 3 !== 0 || r.d.length > 60_000) return null;
  for (const n of r.d) if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const c = typeof r.c === "number" ? clamp(Math.round(r.c), 0, INK_COLOURS.length - 1) : 0;
  const w = typeof r.w === "number" ? clamp(Math.round(r.w), 0, INK_WIDTHS.length - 1) : 1;
  const s: Stroke = { c, w, d: r.d as number[] };
  if (r.sp) s.sp = 1;
  return s;
}

export function cleanInk(raw: unknown, max = 4000): Stroke[] {
  if (!Array.isArray(raw)) return [];
  const out: Stroke[] = [];
  for (const s of raw) {
    const c = cleanStroke(s);
    if (c) out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

/** Bytes a part's ink takes, counted as the JSON it is stored as. */
export function inkBytes(ink: Ink): number {
  let n = 2;
  for (const s of ink) n += 28 + s.d.reduce((sum, v) => sum + String(v).length + 1, 0);
  return n;
}

/** One answer may hold this much ink; the whole device this much (the sheet warns, then offers to clear old sets). */
export const INK_PART_CAP = 400_000;
export const INK_TOTAL_CAP = 20_000_000;

/* ── eraser ──────────────────────────────────────────────────────────── */

const boxes = new WeakMap<Stroke, [number, number, number, number]>();
function box(s: Stroke): [number, number, number, number] {
  let b = boxes.get(s);
  if (!b) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of decodeStroke(s)) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    b = [x0, y0, x1, y1];
    boxes.set(s, b);
  }
  return b;
}

function segPointDist2(ax: number, ay: number, bx: number, by: number, x: number, y: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((x - ax) * dx + (y - ay) * dy) / len2, 0, 1);
  return sq(ax + t * dx - x) + sq(ay + t * dy - y);
}

/** Does a round eraser of `radius` at (x, y) touch the stroke (its centre line, thickened by half its pen width)? */
export function touches(s: Stroke, x: number, y: number, radius = ERASER_RADIUS): boolean {
  const reach = radius + INK_WIDTHS[s.w] / 2;
  const [x0, y0, x1, y1] = box(s);
  if (x < x0 - reach || x > x1 + reach || y < y0 - reach || y > y1 + reach) return false;
  const pts = decodeStroke(s);
  if (pts.length === 1) return sq(pts[0].x - x) + sq(pts[0].y - y) <= reach * reach;
  for (let i = 1; i < pts.length; i++) if (segPointDist2(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, x, y) <= reach * reach) return true;
  return false;
}

/** Indexes of the strokes under the eraser. */
export function strokesAt(ink: Ink, x: number, y: number, radius = ERASER_RADIUS): number[] {
  const out: number[] = [];
  for (let i = 0; i < ink.length; i++) if (touches(ink[i], x, y, radius)) out.push(i);
  return out;
}

/** The bottom edge of the lowest stroke, in logical units: how tall a zone must be to show all of it. */
export function inkBottom(ink: Ink): number {
  let m = 0;
  for (const s of ink) m = Math.max(m, box(s)[3] + INK_WIDTHS[s.w]);
  return m;
}

/* ── outline ─────────────────────────────────────────────────────────── */

/** perfect-freehand's outline for a stroke as an SVG path (quadratic curves through the midpoints). Logical units. */
export function outlinePath(points: readonly Pt[], width: number, simulatePressure: boolean, complete = true): string {
  if (points.length === 0) return "";
  const outline = getStroke(points.map((p) => [p.x, p.y, p.p]), {
    size: width, thinning: simulatePressure ? 0.35 : 0.55, smoothing: 0.55, streamline: 0.45,
    simulatePressure, last: complete,
  });
  if (outline.length < 2) {
    // a dot: perfect-freehand returns a small ring for a single point; a bare tap with no outline still leaves a mark
    const p = points[0];
    const r = Math.max(0.6, width / 2);
    return `M ${p.x - r} ${p.y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
  }
  const f = (n: number) => Math.round(n * 100) / 100;
  let d = `M ${f(outline[0][0])} ${f(outline[0][1])} Q`;
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    d += ` ${f(x0)} ${f(y0)} ${f((x0 + x1) / 2)} ${f((y0 + y1) / 2)}`;
  }
  return `${d} Z`;
}

/** The path for a stored stroke, drawn the same way every time. */
export function strokePath(s: Stroke): string {
  return outlinePath(decodeStroke(s), INK_WIDTHS[s.w], !!s.sp);
}

/* ── undo ────────────────────────────────────────────────────────────── */

/** Undo and redo over whole states (an `Ink` is immutable, so a state is just a reference): cheap, and every action is one step. */
export interface History { past: Ink[]; future: Ink[] }
export const NO_HISTORY: History = { past: [], future: [] };
const HISTORY_MAX = 120;

export function pushHistory(h: History, before: Ink): History {
  return { past: [...h.past, before].slice(-HISTORY_MAX), future: [] };
}
export function undo(h: History, now: Ink): { h: History; ink: Ink } | null {
  const prev = h.past[h.past.length - 1];
  if (!prev) return null;
  return { h: { past: h.past.slice(0, -1), future: [...h.future, now] }, ink: prev };
}
export function redo(h: History, now: Ink): { h: History; ink: Ink } | null {
  const next = h.future[h.future.length - 1];
  if (!next) return null;
  return { h: { past: [...h.past, now], future: h.future.slice(0, -1) }, ink: next };
}
