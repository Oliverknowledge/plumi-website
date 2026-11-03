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
 * long line costs a handful of points and a page of working a few tens of kilobytes. The simplified points are
 * for STORAGE only: before a stroke is drawn (live, committed, reloaded or exported) it is resampled to at most
 * `MAX_GAP` units between points (`densify`), so a sharp corner is drawn where the pen put it and the line on the
 * screen does not change shape when the pen lifts.
 *
 * Width: a pen's stroke has the pen's own pressure; a mouse or finger stroke (`sp: 1`) is one even width. Nothing is
 * simulated from speed, so the width cannot change between the live line and the stored one.
 */

export const REF_W = 800;
export const INK_COLOURS = ["#22262e", "#2b57c9", "#1d7a47"] as const;
export const INK_COLOUR_NAMES = ["Black", "Blue", "Green"] as const;
/** Pen widths in logical units (about css pixels in a zone 800 wide). */
export const INK_WIDTHS = [2.1, 3.4, 5.6] as const;
export const INK_WIDTH_NAMES = ["Fine", "Medium", "Bold"] as const;
/** The eraser's reach in logical units (plus half the pen width of the stroke it meets). Small enough to take one line of an equals sign. */
export const ERASER_RADIUS = 8;
/** perfect-freehand's lag behind the pen: low, so a corner is reached (the tip trails by about a quarter of the gap between points). */
export const STREAMLINE = 0.25;
/** The most space between two points handed to the outline, in logical units. */
export const MAX_GAP = 2;

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
  if (!Array.isArray(r.d) || r.d.length < 3 || r.d.length % 3 !== 0 || r.d.length > MAX_STROKE_NUMBERS) return null;
  for (const n of r.d) if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const c = typeof r.c === "number" ? clamp(Math.round(r.c), 0, INK_COLOURS.length - 1) : 0;
  const w = typeof r.w === "number" ? clamp(Math.round(r.w), 0, INK_WIDTHS.length - 1) : 1;
  const s: Stroke = { c, w, d: r.d as number[] };
  if (r.sp) s.sp = 1;
  return s;
}

/**
 * What a part's ink may hold, set so that nothing the 400 KB cap lets a student write is ever dropped on the way back
 * (a dot is about 42 bytes, so the cap allows under 10 000 strokes; a number is at least 2 bytes, so a single stroke
 * under the cap has under 200 000 of them). Only data that no version of the app wrote is refused.
 */
export const MAX_STROKE_NUMBERS = 200_000;
export const MAX_STROKES = 12_000;

export function cleanInk(raw: unknown, max = MAX_STROKES): Stroke[] {
  if (!Array.isArray(raw)) return [];
  const out: Stroke[] = [];
  for (const s of raw) {
    const c = cleanStroke(s);
    if (c) out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

const sizes = new WeakMap<Stroke, number>();
function numLen(v: number): number {
  if (!Number.isInteger(v)) return String(v).length;
  let a = Math.abs(v), n = v < 0 ? 2 : 1;
  while (a >= 10) { a = Math.floor(a / 10); n++; }
  return n;
}
/** Bytes one stroke takes, counted as the JSON it is stored as (worked out once). */
export function strokeBytes(s: Stroke): number {
  let n = sizes.get(s);
  if (n === undefined) {
    n = 28;
    for (const v of s.d) n += numLen(v) + 1;
    sizes.set(s, n);
  }
  return n;
}

/** Bytes a part's ink takes, counted as the JSON it is stored as. */
export function inkBytes(ink: Ink): number {
  let n = 2;
  for (const s of ink) n += strokeBytes(s);
  return n;
}

/** One answer may hold this much ink; the whole device this much (the sheet warns, then offers to clear old sets). */
export const INK_PART_CAP = 400_000;
export const INK_TOTAL_CAP = 20_000_000;

/* ── geometry and the eraser ─────────────────────────────────────────── */

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

export interface Rect { x0: number; y0: number; x1: number; y1: number }

/** Where a stroke's ink can be, in logical units: its points plus the widest a line of its pen gets. */
export function strokeBounds(s: Stroke): Rect {
  const [x0, y0, x1, y1] = box(s);
  const pad = INK_WIDTHS[s.w] * 0.8 + 1;
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

/** Where all of an answer's ink is, or null if there is none. */
export function inkBounds(ink: Ink): Rect | null {
  let r: Rect | null = null;
  for (const s of ink) {
    const b = strokeBounds(s);
    r = r ? { x0: Math.min(r.x0, b.x0), y0: Math.min(r.y0, b.y0), x1: Math.max(r.x1, b.x1), y1: Math.max(r.y1, b.y1) } : b;
  }
  return r;
}

export const rectsMeet = (a: Rect, b: Rect) => a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
export const rectUnion = (a: Rect | null, b: Rect | null): Rect | null => (a && b ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : a ?? b);

function segPointDist2(ax: number, ay: number, bx: number, by: number, x: number, y: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((x - ax) * dx + (y - ay) * dy) / len2, 0, 1);
  return sq(ax + t * dx - x) + sq(ay + t * dy - y);
}

const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

/** Squared distance between two segments (0 if they cross). */
function segSegDist2(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  const o1 = orient(ax, ay, bx, by, cx, cy), o2 = orient(ax, ay, bx, by, dx, dy), o3 = orient(cx, cy, dx, dy, ax, ay), o4 = orient(cx, cy, dx, dy, bx, by);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return 0;
  return Math.min(segPointDist2(ax, ay, bx, by, cx, cy), segPointDist2(ax, ay, bx, by, dx, dy), segPointDist2(cx, cy, dx, dy, ax, ay), segPointDist2(cx, cy, dx, dy, bx, by));
}

/**
 * Does a round eraser of `radius` touch the stroke (its centre line, thickened by half its pen width)? The eraser
 * is at (x, y); if `from` is given it came from there in a straight line, so everything on the way counts (a fast
 * scrub across a thin line does not slip between two samples).
 */
export function touches(s: Stroke, x: number, y: number, radius = ERASER_RADIUS, from?: { x: number; y: number }): boolean {
  const reach = radius + INK_WIDTHS[s.w] / 2;
  const fx = from?.x ?? x, fy = from?.y ?? y;
  const [x0, y0, x1, y1] = box(s);
  if (Math.max(x, fx) < x0 - reach || Math.min(x, fx) > x1 + reach || Math.max(y, fy) < y0 - reach || Math.min(y, fy) > y1 + reach) return false;
  const pts = decodeStroke(s);
  const r2 = reach * reach;
  const still = fx === x && fy === y;
  if (pts.length === 1) return segPointDist2(fx, fy, x, y, pts[0].x, pts[0].y) <= r2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (still ? segPointDist2(a.x, a.y, b.x, b.y, x, y) <= r2 : segSegDist2(a.x, a.y, b.x, b.y, fx, fy, x, y) <= r2) return true;
  }
  return false;
}

/** Indexes of the strokes under the eraser (and along the way from `from`). */
export function strokesAt(ink: Ink, x: number, y: number, radius = ERASER_RADIUS, from?: { x: number; y: number }): number[] {
  const out: number[] = [];
  for (let i = 0; i < ink.length; i++) if (touches(ink[i], x, y, radius, from)) out.push(i);
  return out;
}

/** The bottom edge of the lowest stroke, in logical units: how tall a zone must be to show all of it. */
export function inkBottom(ink: Ink): number {
  let m = 0;
  for (const s of ink) m = Math.max(m, box(s)[3] + INK_WIDTHS[s.w]);
  return m;
}

/* ── two tabs, one answer ────────────────────────────────────────────── */

const hashes = new WeakMap<Stroke, string>();
/** A stroke's identity: a hash of what is in it, so the same stroke in two tabs (or two loads) is the same stroke. */
export function strokeHash(s: Stroke): string {
  let h = hashes.get(s);
  if (!h) {
    let a = 0x811c9dc5, b = 0x01000193 ^ s.d.length;
    const mix = (n: number) => { a = Math.imul(a ^ (n | 0), 0x01000193); b = Math.imul(b + (n | 0) + 0x9e3779b9, 0x85ebca6b); b ^= b >>> 13; };
    mix(s.c); mix(s.w); mix(s.sp ? 1 : 0);
    for (const v of s.d) mix(v);
    h = ((a >>> 0).toString(36) + (b >>> 0).toString(36));
    hashes.set(s, h);
  }
  return h;
}

/** Ids of the strokes in an answer: the hash, and for an identical stroke drawn twice, a count after it. */
export function inkIds(ink: Ink): string[] {
  const n = new Map<string, number>();
  return ink.map((s) => {
    const h = strokeHash(s);
    const k = n.get(h) ?? 0;
    n.set(h, k + 1);
    return k ? `${h}#${k}` : h;
  });
}

/**
 * The strokes in `theirs` that `ours` does not have and has never seen (`seen` is every id this tab has held for the
 * answer): what another tab added. One we erased stays erased; one they erased and we still hold, we keep. Nothing
 * a student wrote is lost to a merge.
 */
export function strokesToAdd(ours: Ink, theirs: Ink, seen: ReadonlySet<string> = new Set()): Stroke[] {
  if (!theirs.length) return [];
  const have = new Set(inkIds(ours));
  const ids = inkIds(theirs);
  const add: Stroke[] = [];
  theirs.forEach((s, i) => { if (!have.has(ids[i]) && !seen.has(ids[i])) add.push(s); });
  return add;
}

/* ── outline ─────────────────────────────────────────────────────────── */

/** Points as [x, y, pressure] with no gap wider than `maxGap` (linear in all three), so the outline follows a corner instead of cutting it. */
export function densify(points: readonly Pt[], maxGap = MAX_GAP, flat = false): number[][] {
  const n = points.length;
  const out: number[][] = [];
  if (!n) return out;
  const pr = (p: Pt) => (flat ? 0.5 : p.p);
  let len = 0;
  for (let i = 1; i < n; i++) len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  const gap = Math.max(maxGap, len / 40_000);   // a runaway stroke stays bounded
  out.push([points[0].x, points[0].y, pr(points[0])]);
  for (let i = 1; i < n; i++) {
    const a = points[i - 1], b = points[i];
    const k = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / gap);
    for (let j = 1; j < k; j++) { const t = j / k; out.push([a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, pr(a) + (pr(b) - pr(a)) * t]); }
    out.push([b.x, b.y, pr(b)]);
  }
  return out;
}

/**
 * The polygon of a stroke's ink (perfect-freehand). The one place a line's shape is decided: live, committed, reloaded
 * and exported strokes all come through here, so they look the same. `flat` is one even width (a mouse or a finger).
 */
export function strokeOutline(points: readonly Pt[], width: number, flat: boolean): number[][] {
  if (points.length === 0) return [];
  return getStroke(densify(points, MAX_GAP, flat), {
    size: width, thinning: flat ? 0 : 0.55, smoothing: 0.55, streamline: STREAMLINE, simulatePressure: false, last: true,
  });
}

/** A tap leaves a mark even where perfect-freehand gives no outline. */
export function dotOutline(p: Pt, width: number): number[][] {
  const r = Math.max(0.6, width / 2);
  return Array.from({ length: 16 }, (_, i) => [p.x + r * Math.cos((i / 16) * Math.PI * 2), p.y + r * Math.sin((i / 16) * Math.PI * 2)]);
}

/** The outline as an SVG path (quadratic curves through the midpoints). Logical units. */
export function outlinePath(points: readonly Pt[], width: number, flat: boolean): string {
  if (points.length === 0) return "";
  let outline = strokeOutline(points, width, flat);
  if (outline.length < 2) outline = dotOutline(points[0], width);
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
