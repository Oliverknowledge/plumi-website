import { compareLabels, type QPart } from "./model";

/**
 * A figure that belongs to a question but was cut into one part's picture only. The bank's parts are pictures; a question's figure (a diagram with its scale bar, a graph, a table of
 * data) is in the picture of the part it first appears in, and the later parts that go on about "the diagram" are cut without it, unless the bank marks a stem (`st`) for the whole question.
 * Where that has happened the app offers the earlier picture again, as "See the figure", rather than showing a question about a diagram with no diagram. Pure.
 *
 * A part is offered one when ALL of these hold:
 *  - the question has no stem picture (no part of it has `st`: the stem is shown already);
 *  - it is not the question's first part, and its own picture is not a tall one (a tall picture is where a figure is, so it has its own);
 *  - it reads as if it needs a figure: its words mention one ("the diagram", "shown", "the data"), or an earlier part's picture is a tall one (a figure) and this one is small (a line or two).
 * The figure shown is the picture of the nearest earlier part that is a tall one; where none is (the words say "diagram" but no picture is tall) it is the question's first part.
 */
export interface SharedFigure {
  /** The part whose picture holds the figure. */
  from: QPart;
  /** Where it is from, as the question prints it: "(a)(i)", or the whole label ("01.2") where it has no letters. */
  label: string;
}

/** A picture this tall (at the bank's usual 1100 across) is a figure, not a line or two of question. */
export const TALL = 700;
/** ... and a picture shorter than this is a line or two of question: only such a part is offered a figure on the strength of an earlier tall picture alone (its words need not say so). */
export const SMALL = 520;
const WIDE = 1100;
const across = (p: Pick<QPart, "w" | "h">): number => (p.w > 0 ? (p.h * WIDE) / p.w : 0);
const tall = (p: Pick<QPart, "w" | "h">): boolean => across(p) >= TALL;

/** Words that say a part needs something printed with the question. */
const FIGURE = /\b(figures?|fig\.?|diagrams?|graphs?|tables?|photographs?|photos?|micrographs?|images?|pictures?|charts?|maps?|sources?|extracts?|shown|above|the data|the results|the information|the drawing|the sketch)\b/i;
export const mentionsFigure = (words: string | undefined): boolean => !!words && FIGURE.test(words);

/** "23(a)(i)" is "(a)(i)"; "01.2" and "3" stay as they are. */
export function shortLabel(l: string): string {
  const m = l.match(/^\d+((?:\([^)]+\))+)$/);
  return m ? m[1] : l;
}

/** `siblings` are the parts of the part's question (any order; the part may be among them). */
export function sharedFigure(part: QPart, siblings: readonly QPart[]): SharedFigure | null {
  if (part.st || siblings.some((s) => s.st)) return null;
  const all = siblings.some((s) => s.id === part.id) ? siblings : [...siblings, part];
  const ordered = all.slice().sort((a, b) => compareLabels(a.l, b.l));
  const at = ordered.findIndex((s) => s.id === part.id);
  if (at <= 0 || tall(part)) return null;
  const earlier = ordered.slice(0, at);
  const figure = [...earlier].reverse().find(tall);
  // (the words alone are enough; a tall picture before it is enough only for a part that is a line or two)
  if (!mentionsFigure(part.x) && !(figure && across(part) < SMALL)) return null;
  const from = figure ?? earlier[0];
  return { from, label: shortLabel(from.l) };
}
