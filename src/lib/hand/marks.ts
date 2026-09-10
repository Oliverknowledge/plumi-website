/**
 * The marks the same pen makes: tick, cross, half, ring, underline, arrow.
 *
 * Ported from PlumiKit's `PenMark.swift` (`PlumiMarkGeometry`) and the static
 * silhouettes in `MarkShapes.swift`. A tick beside a feature in a pricing list is
 * not marking — nothing was read and nothing was judged — but it must be *the
 * same silhouette* as the tick a student gets on their page, or the website is
 * advertising a product it does not resemble.
 *
 * The geometry is deliberately not symmetrical and not axis-aligned. Symmetry is
 * what makes a drawn mark read as printed.
 *
 * Every function returns runs in the order the hand makes them, with a lift
 * between them: a cross is two runs, an arrow is a shaft and then two barbs.
 * Rendering them as one path would let a draw-on animation interpolate straight
 * across the lift, which is a pen that teleports.
 */

import { makeStroke, PenRandom, type HandStroke, type HandPoint } from "./index";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MarkOptions {
  /**
   * Defaults to 41 — the fixed seed the app uses for its static shapes, so a
   * tick on this site is the exact tick in the app's paywall list. The variance
   * that makes ten ticks look hand-made belongs on a page, where each mark has
   * an identity to seed from; a decorative tick has none.
   */
  seed?: number;
  /**
   * Nib width in px. The defaults are the app's, authored against a page at
   * roughly 16px text; a mark blown up for a hero wants this passed explicitly.
   */
  strokeWidth?: number;
}

const minX = (r: Rect) => r.x;
const minY = (r: Rect) => r.y;
const maxX = (r: Rect) => r.x + r.width;
const maxY = (r: Rect) => r.y + r.height;

function inset(rect: Rect, dx: number, dy: number): Rect {
  return { x: rect.x + dx, y: rect.y + dy, width: rect.width - dx * 2, height: rect.height - dy * 2 };
}

/** A straight-ish line bowed perpendicular to itself by `amount`. */
export function bow(
  a: HandPoint,
  b: HandPoint,
  amount: number,
  samples: number,
): [number, number][] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const steps = Math.max(1, samples);
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const off = Math.sin(t * Math.PI) * amount;
    out.push([a[0] + dx * t + nx * off, a[1] + dy * t + ny * off]);
  }
  return out;
}

/**
 * A tick: a short lead down-right, a corner, and a long fast tail that overshoots
 * the box. The tail is roughly twice the lead, which is what makes it read as a
 * flick rather than as a check box.
 */
export function tickRuns(rect: Rect, random: PenRandom): [number, number][][] {
  const w = rect.width;
  const h = rect.height;
  // Where the pen turns. A hand does not put it in the same place twice.
  const cornerX = 0.3 + random.unit() * 0.1;
  const cornerY = 0.84 + random.unit() * 0.09;
  const tailX = 1.0 + random.unit() * 0.14;
  const tailY = -0.14 + random.unit() * 0.12;
  const corner: HandPoint = [minX(rect) + w * cornerX, minY(rect) + h * cornerY];
  const lead: HandPoint = [minX(rect) + w * (0.03 + random.unit() * 0.06), minY(rect) + h * 0.48];
  const tail: HandPoint = [minX(rect) + w * tailX, minY(rect) + h * tailY];
  // Both legs bow very slightly outwards, the way a wrist pivots.
  const run = bow(lead, corner, h * 0.035, 5);
  run.push(...bow(corner, tail, -h * 0.05, 9).slice(1));
  return [run];
}

/** Two strokes, both drawn top-to-bottom, deliberately off-square. */
export function crossRuns(rect: Rect, random: PenRandom): [number, number][][] {
  const i = rect.width * 0.12;
  const a = bow(
    [minX(rect) + i, minY(rect) + i * (0.9 + random.unit() * 0.4)],
    [maxX(rect) - i * 0.5, maxY(rect) - i],
    rect.width * 0.03,
    6,
  );
  const b = bow(
    [maxX(rect) - i, minY(rect) + i * 0.75],
    [minX(rect) + i * (0.7 + random.unit() * 0.5), maxY(rect) - i],
    -rect.width * 0.025,
    6,
  );
  return [a, b];
}

/**
 * Partial credit as it is actually written: a tick with a bar struck through it,
 * the bar second because that is the order the hand makes them.
 *
 * The bar is held dead level. The tail is the only part of a tick that rises, so
 * a bar with any rise of its own sits nearly parallel to it and the pair reads as
 * a scribble instead of as something struck through.
 */
export function halfRuns(rect: Rect, random: PenRandom): [number, number][][] {
  const inner = inset(rect, rect.width * 0.07, rect.height * 0.07);
  const runs = tickRuns(inner, random);
  const y = minY(rect) + rect.height * (0.46 + random.jitter(0.04));
  // Kept inside its own box: the bar used to overrun to the right, and where a
  // line carries two verdicts it ran into the mark beside it and the pair read
  // as a crossing-out.
  runs.push(
    bow([minX(rect) + rect.width * 0.3, y], [maxX(rect) - rect.width * 0.04, y], rect.height * 0.012, 5),
  );
  return runs;
}

/**
 * A ring, left slightly open and slightly out of round, with the radius growing a
 * few percent through the sweep — a hand cannot close a circle exactly on itself.
 */
export function ringRuns(rect: Rect, random: PenRandom): [number, number][][] {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const rx = rect.width / 2;
  const ry = rect.height / 2;
  const from = -1.15 + random.jitter(0.2);
  const sweep = 6.55 + random.unit() * 0.35;
  const squash = 1 + random.jitter(0.05);
  const steps = 44;
  const run: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = from + sweep * t;
    const grow = 1 + 0.05 * t;
    run.push([cx + Math.cos(angle) * rx * grow, cy + Math.sin(angle) * ry * grow * squash]);
  }
  return [run];
}

/**
 * An underline that waves. A perfectly straight rule reads as a text decoration
 * applied by software; a hand drawing under a line of working never gets it flat.
 */
export function underlineRuns(rect: Rect, random: PenRandom): [number, number][][] {
  const y = maxY(rect) - 1;
  const waves = Math.max(1.5, rect.width / 46);
  const amplitude = 1.6 + random.unit() * 1.0;
  const drop = random.jitter(1.4);
  const steps = Math.max(10, Math.trunc(rect.width / 4));
  const run: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    // Fades in and out at the ends, so it starts and finishes on the line.
    const envelope = Math.sin(t * Math.PI);
    run.push([
      minX(rect) + rect.width * t,
      y + Math.sin(t * waves * 2 * Math.PI) * amplitude * envelope + drop * t,
    ]);
  }
  return [run];
}

/**
 * An arrow from a note back to the thing it is about. Shaft first, then the two
 * barbs — three runs, two lifts, exactly as it is drawn.
 */
export function arrowRuns(tail: HandPoint, head: HandPoint, random: PenRandom): [number, number][][] {
  const dx = head[0] - tail[0];
  const dy = head[1] - tail[1];
  const length = Math.max(1, Math.hypot(dx, dy));
  // Bowed away from the straight line, always the same side relative to travel,
  // which is what a wrist does.
  const bowAmount = Math.min(13, length * 0.07) * (0.7 + random.unit() * 0.6);
  const shaft = bow(tail, head, bowAmount, 14);
  const approach = shaft.length > 1 ? shaft[shaft.length - 2] : tail;
  const angle = Math.atan2(head[1] - approach[1], head[0] - approach[0]);
  const barb = Math.min(13, length * 0.24);
  const one: [number, number] = [
    head[0] - Math.cos(angle - 0.42) * barb,
    head[1] - Math.sin(angle - 0.42) * barb,
  ];
  const two: [number, number] = [
    head[0] - Math.cos(angle + 0.52) * barb * 0.92,
    head[1] - Math.sin(angle + 0.52) * barb * 0.92,
  ];
  return [shaft, [[head[0], head[1]], one], [[head[0], head[1]], two]];
}

// MARK: Strokes
//
// The nib widths are `PenMark.make`'s: a tick is the heaviest mark on a page and
// an arrow the lightest, which is a judgement about how loudly each one should
// speak, not an accident of the geometry.

function strokes(runs: readonly (readonly HandPoint[])[], strokeWidth: number): HandStroke[] {
  return runs.filter((run) => run.length > 1).map((run) => makeStroke(run, strokeWidth));
}

export function tick(rect: Rect, options: MarkOptions = {}): HandStroke[] {
  const random = new PenRandom(options.seed ?? 41);
  return strokes(tickRuns(rect, random), options.strokeWidth ?? 2.6);
}

export function cross(rect: Rect, options: MarkOptions = {}): HandStroke[] {
  const random = new PenRandom(options.seed ?? 41);
  return strokes(crossRuns(rect, random), options.strokeWidth ?? 2.6);
}

export function half(rect: Rect, options: MarkOptions = {}): HandStroke[] {
  const random = new PenRandom(options.seed ?? 41);
  return strokes(halfRuns(rect, random), options.strokeWidth ?? 2.4);
}

/** A ring around something. Inset by a point, as `CircleMarkShape` is. */
export function circle(rect: Rect, options: MarkOptions = {}): HandStroke[] {
  const random = new PenRandom(options.seed ?? 41);
  return strokes(ringRuns(inset(rect, 1, 1), random), options.strokeWidth ?? 2.1);
}

export function underline(rect: Rect, options: MarkOptions = {}): HandStroke[] {
  const random = new PenRandom(options.seed ?? 41);
  return strokes(underlineRuns(rect, random), options.strokeWidth ?? 2.0);
}

export function arrow(from: HandPoint, to: HandPoint, options: MarkOptions = {}): HandStroke[] {
  const random = new PenRandom(options.seed ?? 41);
  return strokes(arrowRuns(from, to, random), options.strokeWidth ?? 1.9);
}
