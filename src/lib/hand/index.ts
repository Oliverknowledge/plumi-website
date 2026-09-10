/**
 * Plumi's hand, laid out and turned into SVG paths.
 *
 * Ported from PlumiKit's `PlumiHand.swift` and `PenStroke.swift`. The glyph
 * table lives in ./glyphs.ts; this file is the part that decides where the pen
 * goes and what comes out the other end.
 *
 * The pipeline is the app's, in the app's order:
 *
 *   glyph runs (em box)  →  laid out on a baseline, with per-character drift
 *                        →  resampled at even arc length   (PenStroke.resample)
 *                        →  smoothed into cubic béziers    (strokePath)
 *
 * Zero dependencies and no browser globals, so a Server Component can call
 * `write()` and ship finished `d` strings, and a client component can take the
 * same strokes and animate them with `stroke-dasharray`.
 */

import { glyph, type HandPoint } from "./glyphs";

export { glyph, canDraw, TABLE, NOTDEF, type HandGlyph, type HandPoint } from "./glyphs";

// MARK: Metrics

/**
 * The em box, exactly as in `PlumiHand.swift`. Changing any of these changes the
 * hand, so they are values rather than knobs.
 */
export const metrics = {
  capHeight: 0.7,
  xHeight: 0.46,
  descender: 0.19,
  /** Space between glyphs, in em. */
  tracking: 0.055,
  /** Rightward lean, as x offset per unit of height above the baseline. About 5°. */
  slant: 0.09,
  /**
   * Baseline-to-baseline, in em. Wide, because two cramped lines are harder to
   * read than one line that had to be shortened.
   */
  leading: 1.42,
} as const;

/**
 * The nominal nib width the Swift authored against, and the size it was authored
 * at. A margin note in the app is 15–19pt, so 1.9pt of ink there is a particular
 * ink-to-letter ratio; at a 64px headline a flat 1.9 would be a hairline. The
 * default scales to hold the ratio, which is the thing that was chosen.
 */
const NOMINAL_STROKE_WIDTH = 1.9;
const NOMINAL_SIZE = 16;

// MARK: The seeded pen

const MASK64 = BigInt("0xFFFFFFFFFFFFFFFF");
const GOLDEN = BigInt("0x9E3779B97F4A7C15");
const SPLITMIX_ADD = BigInt("0x2545F4914F6CDD1D");
const SPLITMIX_A = BigInt("0xBF58476D1CE4E5B9");
const SPLITMIX_B = BigInt("0x94D049BB133111EB");
const FNV_OFFSET = BigInt("0xCBF29CE484222325");
const FNV_PRIME = BigInt("0x100000001B3");
const MILLION = BigInt(1_000_000);
const S30 = BigInt(30);
const S27 = BigInt(27);
const S31 = BigInt(31);

/**
 * Deterministic randomness, so writing looks hand-made and still renders
 * identically every time — a snapshot diff has to mean a change, not a reseed.
 *
 * This is SplitMix64 over unsigned 64-bit arithmetic, which is why it is written
 * in `bigint`: `Number` loses the low bits of the multiply and the sequence stops
 * matching the app's. Same seed, same hand, on both platforms.
 */
export class PenRandom {
  private state: bigint;

  constructor(seed: number | bigint = 9) {
    const s = typeof seed === "bigint" ? seed : BigInt(Math.trunc(seed));
    this.state = (s * GOLDEN + SPLITMIX_ADD) & MASK64;
  }

  /**
   * Derives a seed from any string, so an element's identifier is enough to fix
   * its whole appearance. FNV-1a over the UTF-8 bytes — deliberately not the
   * platform's string hash, which is seeded per process, so the same page would
   * have written itself differently on every render.
   */
  static fromIdentifier(identifier: string): PenRandom {
    let hash = FNV_OFFSET;
    for (const byte of utf8Bytes(identifier)) {
      hash = (hash ^ BigInt(byte)) & MASK64;
      hash = (hash * FNV_PRIME) & MASK64;
    }
    return new PenRandom(hash);
  }

  /** The next value in 0…1. */
  unit(): number {
    this.state = (this.state + GOLDEN) & MASK64;
    let z = this.state;
    z = ((z ^ (z >> S30)) * SPLITMIX_A) & MASK64;
    z = ((z ^ (z >> S27)) * SPLITMIX_B) & MASK64;
    z = (z ^ (z >> S31)) & MASK64;
    return Number(z % MILLION) / 1_000_000;
  }

  /** A value in ±`spread`. */
  jitter(spread: number): number {
    return (this.unit() - 0.5) * 2 * spread;
  }
}

/** UTF-8 bytes without `TextEncoder`, so the module has no runtime globals at all. */
function utf8Bytes(text: string): number[] {
  const out: number[] = [];
  for (const character of text) {
    const c = character.codePointAt(0) ?? 0;
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c < 0x10000) {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else {
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
}

// MARK: Strokes

/** One pen-down run, in page coordinates, ready to be drawn. */
export interface HandStroke {
  /** Resampled at even arc length, so index and distance are interchangeable. */
  points: [number, number][];
  /** Nominal nib width for this run. */
  width: number;
}

export interface WriteOptions {
  /** Em size in px. */
  size: number;
  /** Nib width in px. Defaults to the app's 1.9, scaled from its 16px origin. */
  strokeWidth?: number;
  maxLines?: number;
  seed?: number;
  /** Top-left of the block and the width it may fill. Not the baseline. */
  box: { x: number; y: number; width: number };
}

// MARK: Measurement

/** How far the pen moves on after this character, in em. */
export function advance(character: string): number {
  return glyph(character).advance + metrics.tracking;
}

/** Width of a single line, in px. */
export function width(text: string, size: number): number {
  let total = 0;
  for (const character of text) total += advance(character);
  return total * size;
}

/**
 * Breaks a string into at most `maxLines` lines that fit `box`, truncating with
 * an ellipsis rather than overflowing.
 *
 * The truncation is the point. Plumi is allowed to write "check the sign"; it is
 * not allowed to write four lines of reasoning across somebody's working, and
 * the only reliable way to enforce that is to make it impossible.
 */
export function lines(text: string, size: number, box: number, maxLines = 2): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0 || box <= size * 0.6 || maxLines <= 0) return [];

  const out: string[] = [];
  let current = "";
  let overflowed = false;

  for (const word of trimmed.split(" ")) {
    if (word.length === 0) continue;
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (width(candidate, size) <= box) {
      current = candidate;
      continue;
    }
    if (current.length === 0) {
      // One word wider than the whole box. It is cut below rather than allowed
      // to run off the edge.
      current = word;
      overflowed = true;
      break;
    }
    if (out.length + 1 >= maxLines) {
      overflowed = true;
      break;
    }
    out.push(current);
    current = word;
  }
  if (current.length !== 0) out.push(current);
  if (out.length === 0) return [];

  const lastIndex = out.length - 1;
  if (overflowed || width(out[lastIndex], size) > box) {
    const last = Array.from(out[lastIndex]);
    while (last.length > 0 && width(`${last.join("")}…`, size) > box) last.pop();
    out[lastIndex] = `${last.join("")}…`;
  }
  return out;
}

/**
 * The size a block of writing will actually occupy. Measure before animating: a
 * note given a box shorter than the words it contains collides with whatever is
 * under it the moment one line wraps.
 */
export function measure(
  text: string,
  size: number,
  boxWidth: number,
  maxLines = 2,
): { width: number; height: number } {
  const broken = lines(text, size, boxWidth, maxLines);
  if (broken.length === 0) return { width: 0, height: 0 };

  let widest = 0;
  for (const line of broken) widest = Math.max(widest, width(line, size));
  const height =
    size * (metrics.capHeight + metrics.descender) + size * metrics.leading * (broken.length - 1);
  return { width: Math.min(boxWidth, widest), height };
}

// MARK: Writing

/**
 * The strokes for a piece of text, in the order a hand makes them.
 *
 * `box.y` is the top of the block, not the baseline, because every rect in a
 * layout is top-left anchored.
 */
export function write(text: string, options: WriteOptions): HandStroke[] {
  const { size, maxLines = 2, seed = 9, box } = options;
  const strokeWidth = options.strokeWidth ?? (NOMINAL_STROKE_WIDTH * size) / NOMINAL_SIZE;

  const random = new PenRandom(seed);
  const out: HandStroke[] = [];

  const broken = lines(text, size, box.width, maxLines);
  broken.forEach((line, index) => {
    const baseline = box.y + size * metrics.capHeight + index * size * metrics.leading;
    let pen = box.x;

    for (const character of line) {
      const g = glyph(character);
      // Per-character drift. A hand does not sit a word on a ruled line, and
      // without this the writing reads as a font again however good the shapes.
      const dy = (random.unit() - 0.5) * size * 0.03;
      const scale = 1 + (random.unit() - 0.5) * 0.06;

      for (const run of g.runs) {
        if (run.length <= 1) continue;
        const mapped = run.map(([px, py]): [number, number] => {
          const y = py * scale;
          return [pen + (px - metrics.slant * y) * size, baseline + y * size + dy];
        });
        out.push({ points: resample(mapped), width: strokeWidth });
      }
      pen += (g.advance + metrics.tracking) * size;
    }
  });

  return out;
}

/**
 * The same layout as raw polylines, on a baseline rather than in a box and with
 * no wrapping. For callers that want the points themselves — a specimen sheet, a
 * canvas, a test.
 */
export function polylines(
  text: string,
  origin: { x: number; y: number },
  size: number,
  seed = 9,
): [number, number][][] {
  const random = new PenRandom(seed);
  const out: [number, number][][] = [];
  let pen = origin.x;

  for (const character of text) {
    const g = glyph(character);
    const dy = (random.unit() - 0.5) * size * 0.03;
    for (const run of g.runs) {
      if (run.length <= 1) continue;
      out.push(
        run.map(([px, py]): [number, number] => [
          pen + (px - metrics.slant * py) * size,
          origin.y + py * size + dy,
        ]),
      );
    }
    pen += (g.advance + metrics.tracking) * size;
  }
  return out;
}

// MARK: Resampling

/**
 * Even arc-length resampling, ported from `PenStroke.resample`.
 *
 * Two things downstream assume constant spacing and a hand-authored polyline
 * never has it: the Catmull-Rom smoothing below, which bulges wherever the
 * source points bunch up, and `stroke-dasharray`, which advances by distance —
 * so an unevenly sampled stroke draws itself at an uneven speed.
 */
function resample(raw: readonly HandPoint[]): [number, number][] {
  if (raw.length <= 1) return raw.map(([x, y]): [number, number] => [x, y]);

  let total = 0;
  for (let i = 1; i < raw.length; i += 1) total += distance(raw[i - 1], raw[i]);
  if (total <= 0.0001) {
    const [x, y] = raw[0];
    return [
      [x, y],
      [x, y],
    ];
  }

  // Fine enough that a 26px tick has ~30 samples and cheap enough that a page of
  // handwriting stays well under a thousand segments.
  const count = Math.min(140, Math.max(6, Math.round(total / 1.7)));
  const step = total / count;

  const out: [number, number][] = [[raw[0][0], raw[0][1]]];
  let index = 1;
  let carried = 0;
  let cursor: [number, number] = [raw[0][0], raw[0][1]];

  while (out.length <= count && index < raw.length) {
    const next = raw[index];
    const segment = distance(cursor, next);
    if (carried + segment >= step && segment > 0) {
      const f = (step - carried) / segment;
      cursor = [cursor[0] + (next[0] - cursor[0]) * f, cursor[1] + (next[1] - cursor[1]) * f];
      out.push([cursor[0], cursor[1]]);
      carried = 0;
    } else {
      carried += segment;
      cursor = [next[0], next[1]];
      index += 1;
    }
  }
  if (out.length < 2) {
    const last = raw[raw.length - 1];
    out.push([last[0], last[1]]);
  }
  return out;
}

function distance(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Wraps a hand-authored polyline as a stroke, resampled the way the app's pen
 * does. Every stroke this module hands out has been through here, so the marks
 * and the writing behave identically under smoothing and under a dash offset.
 */
export function makeStroke(points: readonly HandPoint[], strokeWidth: number): HandStroke {
  return { points: resample(points), width: strokeWidth };
}

// MARK: SVG

/**
 * One stroke as an SVG path `d`, smoothed.
 *
 * The app rasterises its strokes as short segments with their own ink widths, so
 * it never needs a curve; a browser draws one `<path>` per run, and a polyline
 * of `L` segments reads as machine-drawn the moment the text is bigger than a
 * caption — every sampled point becomes a visible corner. Uniform Catmull-Rom
 * through the resampled points, converted to the equivalent cubics, keeps the
 * curve on the pen's own points while removing the faceting.
 */
export function strokePath(stroke: HandStroke): string {
  const p = stroke.points;
  if (p.length < 2) return "";
  if (p.length === 2) return `M${n(p[0][0])} ${n(p[0][1])} L${n(p[1][0])} ${n(p[1][1])}`;

  let d = `M${n(p[0][0])} ${n(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i += 1) {
    const p0 = p[i === 0 ? 0 : i - 1];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2 < p.length ? i + 2 : i + 1];
    // The sixth is the standard Catmull-Rom-to-Bézier tangent scale: it makes the
    // cubic pass through p1 and p2 with the curve's own tangents.
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(p2[0])} ${n(p2[1])}`;
  }
  return d;
}

/**
 * Total length of a stroke, so a draw-on animation can set `stroke-dasharray`
 * without measuring in the DOM — which a Server Component cannot do anyway.
 *
 * This is the polyline length. After even-arc-length resampling the smoothed
 * path is longer by well under a percent, which is invisible in a dash offset;
 * round up if you need the dash to certainly clear the end.
 */
export function strokeLength(stroke: HandStroke): number {
  let total = 0;
  for (let i = 1; i < stroke.points.length; i += 1) total += distance(stroke.points[i - 1], stroke.points[i]);
  return total;
}

/** The bounding box of a set of strokes, ink width ignored. */
export function bounds(strokes: readonly HandStroke[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (const [x, y] of stroke.points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Two decimals is sub-pixel at any size the site writes at, and halves the markup. */
function n(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}
