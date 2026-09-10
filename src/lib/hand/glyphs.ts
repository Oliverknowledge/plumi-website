/**
 * Plumi's handwriting, as strokes rather than as a font.
 *
 * WHY NOT A FONT
 * --------------
 * A font is an outline: it can fade in, and that is all it can do. It cannot be
 * written. The product's ticks draw themselves, so if its words merely appeared
 * the same page would be speaking in two registers, which reads as two systems.
 * The letters are therefore polylines that go through the same pen as a tick
 * does — which is what makes "Plumi wrote this" true rather than a claim the
 * interface is making about itself.
 *
 * THE HAND
 * --------
 * Single-stroke, near-upright with a five-degree lean, generous x-height, open
 * counters. The hand of a maths teacher writing quickly in a margin: neat and
 * legible first, warm second, never round and never bubbly. Deliberately
 * distinct from the site's sans, so a note on the paper can never be confused
 * with a label in the chrome.
 *
 * Coordinates are on an em box with the baseline at y = 0 and up as negative,
 * the convention every typographer already has in their head:
 *
 *     cap / ascender  -0.70    x-height  -0.46    baseline  0    descender  0.19
 *
 * Because up is negative and SVG's y axis runs down, these coordinates drop
 * into SVG unchanged once scaled and offset by a baseline.
 *
 * Each glyph carries its own advance. A flat advance is the single loudest tell
 * of machine-drawn handwriting: `i` and `m` cannot occupy the same width and
 * still look like they came off one hand.
 *
 * Ported verbatim from PlumiKit's `PlumiHand.swift`. See ./README.md — the
 * coordinates are the app's own and must not be "improved" here, or the website
 * and the product stop being the same hand.
 */

/** A point on the em box: `[x, y]`, baseline at 0, up negative. */
export type HandPoint = readonly [number, number];

/** One character's shape and how far the pen moves on afterwards. */
export interface HandGlyph {
  readonly advance: number;
  /** Pen-down runs, in the order a hand makes them. */
  readonly runs: readonly (readonly HandPoint[])[];
}

/**
 * Each run is written flat as x, y pairs, exactly as in the Swift source —
 * a hundred glyphs of `[x, y]` tuples is both unreadable and slow to check.
 */
function g(advance: number, runs: readonly (readonly number[])[]): HandGlyph {
  return {
    advance,
    runs: runs.map((flat) => {
      const points: HandPoint[] = [];
      for (let i = 0; i + 1 < flat.length; i += 2) points.push([flat[i], flat[i + 1]]);
      return points;
    }),
  };
}

/**
 * Shown for anything with no glyph: a light open box. Visible, obviously a gap,
 * and impossible to mistake for a letter Plumi meant to write.
 */
export const NOTDEF: HandGlyph = g(0.44, [[0.08, -0.50, 0.36, -0.50, 0.36, -0.02, 0.08, -0.02, 0.08, -0.50]]);

const lowercase: Readonly<Record<string, HandGlyph>> = {
  "a": g(0.55, [[0.47, -0.40, 0.36, -0.47, 0.20, -0.44, 0.11, -0.30, 0.13, -0.10, 0.28, -0.01, 0.44, -0.09, 0.47, -0.28],
                [0.47, -0.46, 0.47, -0.04, 0.54, 0.02]]),
  "b": g(0.56, [[0.13, -0.70, 0.13, -0.01],
                [0.13, -0.34, 0.26, -0.45, 0.42, -0.40, 0.48, -0.24, 0.42, -0.06, 0.24, -0.02, 0.13, -0.10]]),
  "c": g(0.50, [[0.45, -0.36, 0.33, -0.46, 0.17, -0.41, 0.10, -0.24, 0.15, -0.06, 0.31, -0.01, 0.46, -0.09]]),
  "d": g(0.56, [[0.44, -0.36, 0.32, -0.46, 0.16, -0.42, 0.10, -0.25, 0.15, -0.06, 0.32, -0.01, 0.44, -0.10],
                [0.44, -0.70, 0.44, -0.03, 0.51, 0.02]]),
  "e": g(0.50, [[0.11, -0.22, 0.45, -0.26, 0.42, -0.41, 0.26, -0.46, 0.12, -0.35, 0.11, -0.16, 0.24, -0.01, 0.45, -0.06]]),
  "f": g(0.42, [[0.40, -0.66, 0.28, -0.71, 0.19, -0.60, 0.18, -0.01], [0.04, -0.44, 0.38, -0.44]]),
  "g": g(0.55, [[0.45, -0.38, 0.32, -0.46, 0.16, -0.41, 0.11, -0.25, 0.18, -0.08, 0.34, -0.05, 0.45, -0.14],
                [0.45, -0.46, 0.44, 0.06, 0.32, 0.18, 0.14, 0.15]]),
  "h": g(0.56, [[0.13, -0.70, 0.13, -0.01], [0.13, -0.32, 0.26, -0.45, 0.42, -0.41, 0.46, -0.28, 0.46, -0.01]]),
  "i": g(0.27, [[0.13, -0.46, 0.13, -0.04, 0.21, 0.02], [0.14, -0.62, 0.145, -0.60]]),
  "j": g(0.27, [[0.15, -0.46, 0.15, 0.08, 0.05, 0.18, -0.03, 0.15], [0.16, -0.62, 0.165, -0.60]]),
  "k": g(0.52, [[0.13, -0.70, 0.13, -0.01], [0.44, -0.44, 0.16, -0.20], [0.26, -0.28, 0.47, -0.01]]),
  "l": g(0.26, [[0.12, -0.70, 0.12, -0.06, 0.21, 0.02]]),
  "m": g(0.84, [[0.10, -0.01, 0.10, -0.45],
                [0.10, -0.34, 0.22, -0.45, 0.35, -0.40, 0.37, -0.28, 0.37, -0.01],
                [0.37, -0.34, 0.50, -0.45, 0.65, -0.40, 0.68, -0.27, 0.68, -0.01]]),
  "n": g(0.56, [[0.12, -0.01, 0.12, -0.45], [0.12, -0.33, 0.26, -0.45, 0.42, -0.40, 0.46, -0.27, 0.46, -0.01]]),
  "o": g(0.55, [[0.28, -0.46, 0.13, -0.37, 0.11, -0.19, 0.24, -0.02, 0.42, -0.06, 0.47, -0.26, 0.36, -0.44, 0.28, -0.46]]),
  "p": g(0.56, [[0.12, -0.44, 0.12, 0.19],
                [0.12, -0.32, 0.26, -0.45, 0.42, -0.41, 0.47, -0.26, 0.40, -0.08, 0.20, -0.05]]),
  "q": g(0.56, [[0.45, -0.38, 0.32, -0.46, 0.16, -0.41, 0.11, -0.24, 0.19, -0.07, 0.36, -0.06, 0.45, -0.16],
                [0.45, -0.46, 0.45, 0.19]]),
  "r": g(0.42, [[0.14, -0.01, 0.14, -0.45], [0.14, -0.32, 0.26, -0.44, 0.40, -0.42]]),
  "s": g(0.46, [[0.42, -0.39, 0.28, -0.46, 0.14, -0.41, 0.16, -0.30, 0.32, -0.24, 0.42, -0.15, 0.34, -0.02, 0.13, -0.06]]),
  "t": g(0.38, [[0.20, -0.63, 0.20, -0.10, 0.33, 0.01], [0.04, -0.46, 0.36, -0.46]]),
  "u": g(0.56, [[0.12, -0.45, 0.12, -0.12, 0.24, -0.02, 0.40, -0.08, 0.46, -0.24],
                [0.46, -0.45, 0.46, -0.03, 0.53, 0.02]]),
  "v": g(0.52, [[0.10, -0.45, 0.28, -0.01, 0.46, -0.45]]),
  "w": g(0.76, [[0.08, -0.45, 0.23, -0.01, 0.36, -0.32, 0.50, -0.01, 0.66, -0.45]]),
  "x": g(0.50, [[0.10, -0.45, 0.42, -0.01], [0.42, -0.45, 0.10, -0.01]]),
  "y": g(0.52, [[0.10, -0.45, 0.27, -0.06], [0.46, -0.45, 0.24, 0.14, 0.07, 0.18]]),
  "z": g(0.48, [[0.10, -0.44, 0.42, -0.44, 0.10, -0.02, 0.44, -0.02]]),
};

const uppercase: Readonly<Record<string, HandGlyph>> = {
  "A": g(0.68, [[0.05, -0.01, 0.34, -0.70, 0.62, -0.01], [0.16, -0.22, 0.52, -0.22]]),
  "B": g(0.62, [[0.12, -0.70, 0.12, -0.01],
                [0.12, -0.70, 0.42, -0.66, 0.48, -0.50, 0.36, -0.38, 0.12, -0.36],
                [0.12, -0.36, 0.46, -0.32, 0.54, -0.16, 0.40, -0.01, 0.12, -0.01]]),
  "C": g(0.62, [[0.55, -0.56, 0.38, -0.70, 0.18, -0.60, 0.10, -0.34, 0.18, -0.09, 0.38, -0.01, 0.56, -0.13]]),
  "D": g(0.64, [[0.12, -0.70, 0.12, -0.01],
                [0.12, -0.70, 0.42, -0.66, 0.55, -0.46, 0.52, -0.18, 0.34, -0.01, 0.12, -0.01]]),
  "E": g(0.56, [[0.50, -0.70, 0.13, -0.70, 0.13, -0.01, 0.50, -0.01], [0.13, -0.36, 0.42, -0.36]]),
  "F": g(0.54, [[0.50, -0.70, 0.13, -0.70, 0.13, -0.01], [0.13, -0.38, 0.42, -0.38]]),
  "G": g(0.66, [[0.56, -0.56, 0.38, -0.70, 0.17, -0.60, 0.10, -0.34, 0.18, -0.09, 0.40, -0.02, 0.57, -0.16, 0.57, -0.32, 0.40, -0.32]]),
  "H": g(0.66, [[0.12, -0.70, 0.12, -0.01], [0.54, -0.70, 0.54, -0.01], [0.12, -0.36, 0.54, -0.36]]),
  "I": g(0.32, [[0.05, -0.70, 0.27, -0.70], [0.16, -0.70, 0.16, -0.01], [0.05, -0.01, 0.27, -0.01]]),
  "J": g(0.48, [[0.40, -0.70, 0.38, -0.13, 0.26, -0.01, 0.12, -0.06, 0.09, -0.18]]),
  "K": g(0.62, [[0.12, -0.70, 0.12, -0.01], [0.54, -0.70, 0.16, -0.30], [0.28, -0.40, 0.58, -0.01]]),
  "L": g(0.52, [[0.13, -0.70, 0.13, -0.01, 0.48, -0.01]]),
  "M": g(0.80, [[0.09, -0.01, 0.11, -0.70, 0.40, -0.20, 0.68, -0.70, 0.70, -0.01]]),
  "N": g(0.68, [[0.12, -0.01, 0.12, -0.70, 0.56, -0.10, 0.56, -0.70]]),
  "O": g(0.70, [[0.36, -0.70, 0.15, -0.58, 0.09, -0.32, 0.20, -0.07, 0.44, -0.02, 0.60, -0.22, 0.55, -0.55, 0.36, -0.70]]),
  "P": g(0.58, [[0.12, -0.70, 0.12, -0.01], [0.12, -0.70, 0.44, -0.66, 0.52, -0.50, 0.40, -0.34, 0.12, -0.32]]),
  "Q": g(0.70, [[0.36, -0.70, 0.15, -0.58, 0.09, -0.32, 0.20, -0.07, 0.44, -0.02, 0.60, -0.22, 0.55, -0.55, 0.36, -0.70],
                [0.42, -0.20, 0.64, 0.07]]),
  "R": g(0.60, [[0.12, -0.70, 0.12, -0.01],
                [0.12, -0.70, 0.44, -0.66, 0.52, -0.52, 0.38, -0.36, 0.12, -0.34],
                [0.30, -0.36, 0.56, -0.01]]),
  "S": g(0.56, [[0.50, -0.60, 0.32, -0.70, 0.14, -0.60, 0.18, -0.44, 0.40, -0.34, 0.50, -0.20, 0.38, -0.02, 0.13, -0.09]]),
  "T": g(0.58, [[0.05, -0.70, 0.52, -0.70], [0.29, -0.70, 0.29, -0.01]]),
  "U": g(0.66, [[0.11, -0.70, 0.11, -0.18, 0.26, -0.02, 0.46, -0.05, 0.55, -0.22, 0.55, -0.70]]),
  "V": g(0.64, [[0.08, -0.70, 0.34, -0.01, 0.58, -0.70]]),
  "W": g(0.88, [[0.06, -0.70, 0.24, -0.01, 0.42, -0.48, 0.60, -0.01, 0.80, -0.70]]),
  "X": g(0.62, [[0.10, -0.70, 0.54, -0.01], [0.54, -0.70, 0.10, -0.01]]),
  "Y": g(0.62, [[0.09, -0.70, 0.32, -0.34, 0.55, -0.70], [0.32, -0.34, 0.32, -0.01]]),
  "Z": g(0.58, [[0.10, -0.70, 0.50, -0.70, 0.10, -0.02, 0.52, -0.02]]),
};

const digits: Readonly<Record<string, HandGlyph>> = {
  "0": g(0.52, [[0.30, -0.70, 0.12, -0.54, 0.10, -0.26, 0.24, -0.03, 0.42, -0.12, 0.45, -0.44, 0.30, -0.70]]),
  "1": g(0.38, [[0.08, -0.56, 0.24, -0.70, 0.24, -0.01]]),
  "2": g(0.52, [[0.11, -0.58, 0.26, -0.70, 0.44, -0.60, 0.38, -0.40, 0.10, -0.02, 0.47, -0.02]]),
  "3": g(0.52, [[0.12, -0.64, 0.34, -0.70, 0.44, -0.56, 0.28, -0.40],
                [0.28, -0.40, 0.46, -0.30, 0.42, -0.06, 0.14, -0.03]]),
  "4": g(0.54, [[0.38, -0.70, 0.07, -0.22, 0.49, -0.22], [0.38, -0.42, 0.38, -0.01]]),
  "5": g(0.52, [[0.45, -0.70, 0.16, -0.70, 0.13, -0.42, 0.34, -0.46, 0.47, -0.30, 0.38, -0.05, 0.13, -0.08]]),
  "6": g(0.52, [[0.43, -0.66, 0.20, -0.54, 0.11, -0.24, 0.24, -0.03, 0.42, -0.12, 0.40, -0.30, 0.17, -0.27]]),
  "7": g(0.50, [[0.09, -0.70, 0.46, -0.70, 0.23, -0.01], [0.18, -0.34, 0.38, -0.36]]),
  "8": g(0.54, [[0.29, -0.38, 0.14, -0.50, 0.26, -0.68, 0.42, -0.56, 0.29, -0.38, 0.13, -0.22, 0.27, -0.02, 0.44, -0.16, 0.29, -0.38]]),
  "9": g(0.52, [[0.44, -0.42, 0.26, -0.36, 0.14, -0.50, 0.26, -0.68, 0.43, -0.60, 0.42, -0.22, 0.23, -0.02]]),
};

const symbols: Readonly<Record<string, HandGlyph>> = {
  " ": g(0.28, []),
  "=": g(0.56, [[0.09, -0.34, 0.48, -0.35], [0.08, -0.17, 0.47, -0.18]]),
  "+": g(0.56, [[0.28, -0.42, 0.28, -0.10], [0.12, -0.26, 0.45, -0.27]]),
  "-": g(0.42, [[0.06, -0.26, 0.36, -0.27]]),
  "×": g(0.50, [[0.12, -0.38, 0.38, -0.14], [0.38, -0.38, 0.12, -0.14]]),
  "·": g(0.26, [[0.12, -0.26, 0.145, -0.24]]),
  "/": g(0.46, [[0.38, -0.72, 0.07, 0.06]]),
  "\\": g(0.46, [[0.07, -0.72, 0.38, 0.06]]),
  "(": g(0.32, [[0.27, -0.72, 0.10, -0.33, 0.27, 0.08]]),
  ")": g(0.32, [[0.07, -0.72, 0.24, -0.33, 0.07, 0.08]]),
  "[": g(0.30, [[0.26, -0.72, 0.10, -0.72, 0.10, 0.08, 0.26, 0.08]]),
  "]": g(0.30, [[0.06, -0.72, 0.22, -0.72, 0.22, 0.08, 0.06, 0.08]]),
  ".": g(0.26, [[0.11, -0.03, 0.135, -0.01]]),
  ",": g(0.26, [[0.14, -0.05, 0.06, 0.13]]),
  ":": g(0.25, [[0.11, -0.36, 0.135, -0.34], [0.11, -0.03, 0.135, -0.01]]),
  ";": g(0.25, [[0.11, -0.36, 0.135, -0.34], [0.13, -0.04, 0.05, 0.13]]),
  "!": g(0.26, [[0.13, -0.70, 0.115, -0.17], [0.11, -0.03, 0.135, -0.01]]),
  "?": g(0.46, [[0.09, -0.58, 0.22, -0.71, 0.38, -0.62, 0.36, -0.46, 0.22, -0.36, 0.21, -0.20],
                [0.19, -0.04, 0.215, -0.02]]),
  "'": g(0.20, [[0.11, -0.70, 0.07, -0.53]]),
  "\"": g(0.32, [[0.11, -0.70, 0.07, -0.53], [0.25, -0.70, 0.21, -0.53]]),
  "²": g(0.34, [[0.07, -0.62, 0.18, -0.71, 0.30, -0.63, 0.24, -0.52, 0.06, -0.38, 0.31, -0.38]]),
  "³": g(0.34, [[0.07, -0.68, 0.20, -0.71, 0.26, -0.62, 0.17, -0.56],
                [0.17, -0.56, 0.29, -0.50, 0.24, -0.38, 0.07, -0.39]]),
  "^": g(0.44, [[0.08, -0.50, 0.22, -0.67, 0.36, -0.50]]),
  "*": g(0.40, [[0.20, -0.70, 0.20, -0.42], [0.08, -0.63, 0.32, -0.49], [0.32, -0.63, 0.08, -0.49]]),
  "°": g(0.32, [[0.16, -0.71, 0.07, -0.62, 0.12, -0.50, 0.23, -0.53, 0.22, -0.66, 0.16, -0.71]]),
  "±": g(0.56, [[0.28, -0.46, 0.28, -0.18], [0.12, -0.32, 0.45, -0.33], [0.12, -0.04, 0.45, -0.05]]),
  "≈": g(0.56, [[0.09, -0.34, 0.19, -0.41, 0.29, -0.30, 0.47, -0.37],
                [0.09, -0.15, 0.19, -0.22, 0.29, -0.11, 0.47, -0.18]]),
  "<": g(0.50, [[0.42, -0.46, 0.10, -0.26, 0.42, -0.06]]),
  ">": g(0.50, [[0.10, -0.46, 0.42, -0.26, 0.10, -0.06]]),
  "≤": g(0.52, [[0.44, -0.52, 0.10, -0.32, 0.44, -0.14], [0.10, -0.01, 0.44, -0.02]]),
  "≥": g(0.52, [[0.10, -0.52, 0.44, -0.32, 0.10, -0.14], [0.10, -0.01, 0.44, -0.02]]),
  "→": g(0.74, [[0.05, -0.28, 0.64, -0.29], [0.64, -0.29, 0.49, -0.41], [0.64, -0.29, 0.49, -0.17]]),
  "_": g(0.52, [[0.04, 0.10, 0.47, 0.10]]),
  "%": g(0.68, [[0.17, -0.71, 0.08, -0.62, 0.13, -0.50, 0.24, -0.53, 0.22, -0.66, 0.17, -0.71],
                [0.56, -0.70, 0.10, -0.01],
                [0.54, -0.20, 0.45, -0.11, 0.50, -0.01, 0.60, -0.05, 0.58, -0.17, 0.54, -0.20]]),
  "√": g(0.64, [[0.04, -0.30, 0.16, -0.21, 0.30, -0.71, 0.62, -0.71]]),
  "π": g(0.60, [[0.06, -0.44, 0.53, -0.45], [0.20, -0.44, 0.17, -0.02], [0.40, -0.44, 0.42, -0.09, 0.52, -0.03]]),
  "Δ": g(0.66, [[0.33, -0.70, 0.06, -0.01, 0.60, -0.01, 0.33, -0.70]]),
  "∴": g(0.44, [[0.20, -0.46, 0.225, -0.44], [0.08, -0.03, 0.105, -0.01], [0.33, -0.03, 0.355, -0.01]]),
  "∫": g(0.36, [[0.05, 0.11, 0.13, 0.02, 0.19, -0.34, 0.25, -0.68, 0.34, -0.72]]),
  "θ": g(0.54, [[0.28, -0.70, 0.12, -0.52, 0.11, -0.20, 0.24, -0.02, 0.41, -0.10, 0.46, -0.44, 0.32, -0.68, 0.28, -0.70],
                [0.13, -0.35, 0.45, -0.36]]),
  "…": g(0.66, [[0.08, -0.03, 0.105, -0.01], [0.30, -0.03, 0.325, -0.01], [0.52, -0.03, 0.545, -0.01]]),
};

/**
 * Characters that are really other characters wearing different codepoints.
 * Left unmapped they would each draw the placeholder box, which is worse than a
 * hyphen. Note the two deltas: U+2206 INCREMENT maps onto U+0394 GREEK CAPITAL
 * LETTER DELTA, which is the one with a shape.
 */
const ALIASES: ReadonlyMap<string, string> = new Map([
  ["–", "-"], ["—", "-"], ["−", "-"], ["‐", "-"], ["’", "'"], ["‘", "'"], ["“", "\""], ["”", "\""],
  ["∙", "·"], ["•", "·"], ["⋅", "·"], ["⇒", "→"], ["⟶", "→"], ["∆", "Δ"], ["≠", "≈"],
]);

/**
 * Every glyph the pen can draw, keyed by character.
 *
 * Exported so a caller can count it or iterate it in a specimen; look glyphs up
 * with `glyph()` rather than here, so aliases and case folding apply.
 */
export const TABLE: ReadonlyMap<string, HandGlyph> = new Map<string, HandGlyph>([
  ...Object.entries(lowercase),
  ...Object.entries(uppercase),
  ...Object.entries(digits),
  ...Object.entries(symbols),
]);

/**
 * The shape for a character, or a visible placeholder.
 *
 * A missing glyph must never be an invisible advance. The stroke font this
 * replaced silently swallowed `×`, `√`, `π`, `%` and every bracket, so
 * "area = πr²" wrote as "area = r" and looked like a confident, wrong statement
 * rather than like a gap.
 */
export function glyph(character: string): HandGlyph {
  const exact = TABLE.get(character);
  if (exact !== undefined) return exact;

  const alias = ALIASES.get(character);
  if (alias !== undefined) {
    const mapped = TABLE.get(alias);
    if (mapped !== undefined) return mapped;
  }

  // Case is only folded as a last resort: the uppercase set is real, and folding
  // first would throw it away.
  const lower = character.toLowerCase();
  if (lower !== character) {
    const mapped = TABLE.get(lower);
    if (mapped !== undefined) return mapped;
  }
  const upper = character.toUpperCase();
  if (upper !== character) {
    const mapped = TABLE.get(upper);
    if (mapped !== undefined) return mapped;
  }

  return NOTDEF;
}

/**
 * Whether this character has a real shape, as opposed to the notdef box.
 *
 * Callers that can choose their notation need this: substituting "gamma" for `γ`
 * is an improvement only if the pen can draw a gamma, and a box in a headline is
 * worse than the word.
 */
export function canDraw(character: string): boolean {
  if (character === " ") return true;
  if (TABLE.has(character)) return true;

  const alias = ALIASES.get(character);
  if (alias !== undefined && TABLE.has(alias)) return true;

  const lower = character.toLowerCase();
  if (lower !== character && TABLE.has(lower)) return true;
  const upper = character.toUpperCase();
  if (upper !== character && TABLE.has(upper)) return true;

  return false;
}
