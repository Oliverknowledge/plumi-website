import { width as handWidth } from "@/lib/hand";

/**
 * Superscripts, for handwriting.
 *
 * Nobody has ever written a caret on paper. `e^x` is how you type an exponent,
 * not how you write one, and a page of maths that renders carets tells a
 * student immediately that they are looking at a string rather than at
 * somebody's working — which is fatal on a site whose whole claim is that it
 * reads handwriting.
 *
 * The ported hand lays out one baseline. This splits a line into runs at each
 * `^`, so the caller can write each run at its own size and its own baseline
 * offset and get `eˣ` rather than `e^x`.
 *
 *     e^x        one raised character
 *     e^{2x}     a braced group
 *     x^2 + y^2  as many as you like
 *
 * Deliberately not a maths typesetter. There are no fractions, no limits on an
 * integral sign and no radicals here, because handwriting a fraction means
 * drawing a bar between two baselines and that is a different feature. Where a
 * fraction is genuinely needed the site sets it in the serif, as printed maths,
 * which is what the app does too.
 */

export interface InkRun {
  text: string;
  /** Em size for this run. */
  size: number;
  /** Baseline offset from the line's baseline. Negative is up. */
  dy: number;
  /** Where this run starts, relative to the start of the line. */
  x: number;
}

/**
 * A superscript is drawn about three fifths the size and raised by a third.
 *
 * The rise is measured against the base size, and a third of it lands the
 * exponent's foot around the base letter's x-height — which is where a hand
 * puts it. Raising it clear of the cap height, which is what a naive
 * `vertical-align: super` does, makes the exponent look like a separate
 * character that happens to be floating nearby.
 */
const SUPERSCRIPT_SCALE = 0.6;
const SUPERSCRIPT_RISE = 0.33;

/**
 * Exponents tuck in. A hand does not leave a full letter-space before an
 * exponent, and the hand's per-glyph tracking is set for full-size neighbours,
 * so without this the `x` in `eˣ` drifts far enough from the `e` to read as its
 * own term.
 */
const SUPERSCRIPT_KERN = 0.1;

export function hasSuperscript(text: string): boolean {
  return text.includes("^");
}

/**
 * Splits a line into positioned runs. Sizes and offsets are absolute, so a
 * caller can hand each run straight to `write()`.
 */
export function inkRuns(source: string, size: number): InkRun[] {
  const runs: InkRun[] = [];
  let buffer = "";
  let pen = 0;

  // The hand splits a line into words and rejoins them with one space, so two
  // consecutive spaces are measured but never drawn. Left alone, every
  // superscript after a double space lands that much too far right — which is
  // exactly how it looked. Collapsing here makes what is measured and what is
  // drawn the same string.
  const text = source.replace(/ {2,}/g, " ");

  const flush = (content: string, runSize: number, dy: number) => {
    if (!content) return;

    // The hand's line breaker trims before it lays out, so a run beginning
    // " dx" would draw as "dx" and the space after an exponent would vanish.
    // The space still has to move the pen, so it is measured here and only the
    // visible part is handed on to be drawn.
    const leading = content.length - content.trimStart().length;
    const visible = content.trimStart();

    if (visible) {
      runs.push({
        text: visible,
        size: runSize,
        dy,
        x: pen + (leading > 0 ? handWidth(" ".repeat(leading), runSize) : 0),
      });
    }

    pen += handWidth(content, runSize);
  };

  const characters = [...text];
  for (let i = 0; i < characters.length; i += 1) {
    const character = characters[i];

    if (character !== "^" || i === characters.length - 1) {
      buffer += character;
      continue;
    }

    flush(buffer, size, 0);
    buffer = "";

    i += 1;
    let raised = "";
    if (characters[i] === "{") {
      i += 1;
      while (i < characters.length && characters[i] !== "}") {
        raised += characters[i];
        i += 1;
      }
    } else {
      raised = characters[i];
    }

    pen -= size * SUPERSCRIPT_KERN;
    flush(raised, size * SUPERSCRIPT_SCALE, -size * SUPERSCRIPT_RISE);
    pen -= size * SUPERSCRIPT_KERN * 0.5;
  }

  flush(buffer, size, 0);
  return runs;
}

/**
 * How wide a line is once its superscripts are set smaller. The plain
 * `width()` from the hand would count the caret and set the exponent
 * full-size, so anything positioned from it — an underline, a margin note —
 * would land in the wrong place.
 */
export function richWidth(text: string, size: number): number {
  if (!hasSuperscript(text)) return handWidth(text, size);
  const runs = inkRuns(text, size);
  const last = runs[runs.length - 1];
  return last ? last.x + handWidth(last.text, last.size) : 0;
}

/**
 * Where a run's block must start vertically for its baseline to sit `dy` from
 * the line's baseline. `write()` positions from the top of a block and the cap
 * height is 0.7em, so this is not simply `y + dy`.
 */
export function runTop(lineTop: number, size: number, run: InkRun): number {
  return lineTop + size * 0.7 + run.dy - run.size * 0.7;
}

const UNICODE_SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  n: "ⁿ",
  x: "ˣ",
  i: "ⁱ",
  "+": "⁺",
  "-": "⁻",
};

/**
 * The same line, for prose — a caption, a screen reader, an alt text.
 *
 * `e^x` is a source notation, not something to show a person. Where a real
 * superscript character exists it is used; where it does not, the caret is
 * simply dropped, which reads better than leaving it in and is honest about
 * being an approximation.
 */
export function inkPlainText(text: string): string {
  return text.replace(/\^\{?([^}\s]+)\}?/g, (_match, raised: string) =>
    [...raised].map((character) => UNICODE_SUPERSCRIPTS[character] ?? character).join(""),
  );
}
