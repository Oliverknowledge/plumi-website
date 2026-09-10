"use client";

import { write, strokePath, strokeLength, measure, type HandStroke } from "@/lib/hand";
import { hasSuperscript, inkRuns, runTop } from "./richInk";

/**
 * Handwriting, written rather than displayed.
 *
 * Every word of ink on this site comes through here, and none of it is a font.
 * The letterforms are PlumiHand — the app's own stroke-based hand, ported in
 * `src/lib/hand` — so what a visitor reads on the website is drawn from the same
 * coordinates as what Plumi writes in the margin of a real page.
 *
 * ── How it draws itself ──────────────────────────────────────────────────────
 * Each stroke is a path with `stroke-dasharray` set to its own length and
 * `stroke-dashoffset` animated from that length to zero. The strokes are given
 * staggered delays proportional to the ink before them, so the pen appears to
 * move through the sentence at a constant speed rather than every letter
 * starting at once.
 *
 * This is deliberately pure CSS. There is no JavaScript on the animation path at
 * all: no rAF loop, no scroll listener, no hydration required. The hero animates
 * on a mid-range phone at 60fps because nothing is being computed while it runs.
 *
 * ── Reduced motion ───────────────────────────────────────────────────────────
 * `prefers-reduced-motion` collapses every duration to ~0 in globals.css, which
 * lands the ink in its finished state instantly. The writing is legible either
 * way; the animation is a flourish, never the message.
 *
 * ── Why "use client" for something that never uses a hook ────────────────────
 * It is still server-rendered, and it still ships no behaviour. The directive
 * is here for payload size, and the saving is large.
 *
 * A Server Component's output is serialised twice: once as HTML, and again into
 * the RSC flight payload that React needs to reconcile the tree. A page of
 * handwriting is roughly 120 kB of `d` attributes, so paying for it twice cost
 * about as much as the entire JavaScript bundle. Marking this boundary
 * `"use client"` means the flight payload carries only this component's props —
 * a string, four numbers — and the paths appear exactly once, in the HTML.
 *
 * The cost is the glyph table travelling to the browser. That is a fair trade:
 * it is a few kB gzipped against roughly 25 kB gzipped of duplicated markup,
 * and it is what makes the interactive demo possible at all.
 */

export type InkTone = "student" | "tutor" | "correct" | "partial" | "incorrect";

const tones: Record<InkTone, string> = {
  /** The student's own pen. The app's default ink: a blue-black, not a black. */
  student: "var(--color-pen-ink)",
  /** Plumi's annotations. Indigo — not the student's ink, and not a grade colour. */
  tutor: "var(--color-tutor)",
  correct: "var(--color-correct)",
  partial: "var(--color-partial)",
  incorrect: "var(--color-incorrect)",
};

interface InkProps {
  text: string;
  /** Top-left of the block, in the parent SVG's coordinates. */
  x: number;
  y: number;
  /** Em size. A margin note in the app is 15–19; a hero line is 40–64. */
  size: number;
  /** How wide the block may run before it wraps. */
  width?: number;
  tone?: InkTone;
  maxLines?: number;
  /** Changing the seed gives the same text a different hand. */
  seed?: number;
  /** Seconds before the first stroke starts. */
  delay?: number;
  /**
   * Roughly how fast the pen moves, in px of path per second. The app writes at
   * a fixed speed rather than fitting a duration, which is why a long note takes
   * longer than a short one — as it should.
   */
  speed?: number;
  /** Renders finished, with no animation. For static contexts and fallbacks. */
  still?: boolean;
  className?: string;
}

export function Ink({
  text,
  x,
  y,
  size,
  width = 600,
  tone = "student",
  maxLines = 2,
  seed = 9,
  delay = 0,
  speed = 420,
  still = false,
  className = "",
}: InkProps) {
  const strokes = layOut(text, { x, y, size, width, maxLines, seed });

  // Each stroke's path, its length, and when the pen reaches it.
  //
  // Delays accumulate along the ink already drawn, so the pen crosses the line
  // at a steady speed. A flat per-stroke delay makes `m` and `i` take the same
  // time, which is the same tell as a flat advance. Built up front rather than
  // by mutating a counter inside the map — the render has to stay pure.
  const timeline = strokes.reduce<{ travelled: number; items: DrawnStroke[] }>(
    (acc, stroke) => {
      const length = strokeLength(stroke);
      acc.items.push({
        d: strokePath(stroke),
        width: stroke.width,
        length,
        start: delay + acc.travelled / speed,
        duration: length / speed,
      });
      return { travelled: acc.travelled + length, items: acc.items };
    },
    { travelled: 0, items: [] },
  ).items;

  return (
    <g className={className} fill="none" stroke={tones[tone]} strokeLinecap="round" strokeLinejoin="round">
      {timeline.map((stroke, index) => (
        <path
          key={index}
          d={stroke.d}
          strokeWidth={stroke.width}
          style={
            still
              ? undefined
              : {
                  strokeDasharray: stroke.length,
                  strokeDashoffset: stroke.length,
                  animation: `ink-draw ${stroke.duration.toFixed(3)}s linear ${stroke.start.toFixed(3)}s forwards`,
                }
          }
        />
      ))}
    </g>
  );
}

interface DrawnStroke {
  d: string;
  width: number;
  length: number;
  start: number;
  duration: number;
}

/**
 * The strokes for a line, with superscripts set smaller and raised.
 *
 * Text with no `^` goes straight through the ported layout, wrapping and all.
 * Text with one is laid out as runs on a single line — wrapping a line that
 * changes size partway through would need the hand's line breaker to know
 * about runs, and no line on this site both wraps and carries an exponent.
 */
function layOut(
  text: string,
  {
    x,
    y,
    size,
    width,
    maxLines,
    seed,
  }: { x: number; y: number; size: number; width: number; maxLines: number; seed: number },
): HandStroke[] {
  if (!hasSuperscript(text)) {
    return write(text, { size, box: { x, y, width }, maxLines, seed });
  }

  return inkRuns(text, size).flatMap((run) =>
    write(run.text, {
      size: run.size,
      box: { x: x + run.x, y: runTop(y, size, run), width },
      maxLines: 1,
      // Each run keeps its own seed so the drift does not restart identically
      // on every exponent, which would be a visible repeat at this size.
      seed: seed + Math.round(run.x),
    }),
  );
}


export { measure as measureInk };
