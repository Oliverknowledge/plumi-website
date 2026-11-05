import { compareLabels, type QPart } from "./model";

/**
 * A figure that belongs to a question but was cut into one part's picture only. The bank's parts are pictures; a question's figure (a diagram with its scale bar, a graph, a table of
 * data) is in the picture of the part it first appears in, and the later parts that go on about "the diagram" are cut without it, unless the bank marks a stem (`st`) for the whole question.
 * Where that has happened the app offers the earlier picture again, as "See the figure", rather than showing a question about a diagram with no diagram. Pure.
 *
 * Offered only where the question has no stem picture (no part of it has `st`), the part is not the question's first, and its words do not give its own figure ("complete the table
 * below", "the diagram below"). Then by one of two rules:
 *  - SAME LETTER GROUP: a sub-part with a roman number ("23(a)(ii)", "4(b)(iii)") after a tall picture in its own letter group ("23(a)(i)"): the figure belongs to the "(a)" introduction and sits
 *    in the first sub-part's crop, and the sub-part is a line or two of question (under 400 at the usual width). A part that is a letter alone ("5(b)", "2(d)"), or in another letter group, never takes a figure from this rule, and neither does a part with a tall picture of its own.
 *  - ITS WORDS: it mentions a figure ("the diagram", "Figure 2", "photomicrograph", "labelled", "shown", "compound X", "the data"). A part whose own picture is tall carries its own figure, so
 *    only words that point back to one printed above it ("Fig. 3.1", "the diagram above") count for it.
 * The figure shown is the nearest earlier tall picture (in the group first); where none is tall it is the question's first part.
 */
export interface SharedFigure {
  /** The part whose picture holds the figure. */
  from: QPart;
  /** Where it is from, as the question prints it: "(a)(i)", or the whole label ("01.2") where it has no letters. */
  label: string;
}

/** A picture this tall (at the bank's usual 1100 across) is a figure, not a line or two of question. */
export const TALL = 700;
/** A part whose own picture is this tall has its figure in it. */
export const OWN_TALL = 600;
/** The same-letter-group rule offers a figure on the strength of the tall picture alone only to a part that is a line or two of question (under this height); a longer one is likely to be its own question about something else. */
export const SMALL = 400;
const WIDE = 1100;
const across = (p: Pick<QPart, "w" | "h">): number => (p.w > 0 ? (p.h * WIDE) / p.w : 0);
const tall = (p: Pick<QPart, "w" | "h">): boolean => across(p) >= TALL;

/** Words that say a part needs something printed with the question. */
const FIGURE = /\b(?:figures?|fig\.?|diagrams?|graphs?|tables?|photographs?|photos?|micrographs?|photomicrographs?|images?|pictures?|charts?|maps?|sources?|extracts?|shown|labelled|above|the data|the drawing|the sketch)\b/i;
/** "compound X", "substance Y": a letter standing for something drawn or named in the figure (capital letters only). */
const LETTERED = /\b(?:compounds?|substances?|structures?|molecules?) [A-Z]\b/;
export const mentionsFigure = (words: string | undefined): boolean => !!words && (FIGURE.test(words) || LETTERED.test(words));
/** Words that say a part has its own figure to complete or read, printed in its own picture. */
const OWN = /\b(?:table|diagram|figure|graph|chart|grid|axes)\s+(?:below|opposite|that follows)\b|\bcomplete (?:the|this) (?:table|diagram|graph|chart)\b|\b(?:in|on) the (?:space|grid|axes) (?:below|provided)\b/i;
/** Words that point back to a figure printed in an EARLIER part ("the diagram above", "the graph in the previous part"): "Figure 6 shows..." in a part with a tall picture of its own is that picture's own figure. */
const BACK = /\b(?:figure|fig\.?|diagram|graph|table|chart|photograph|micrograph|photomicrograph|image|drawing)(?:\s*\d+(?:\.\d+)?)?s?\s+above\b|\b(?:earlier|previous|first)\s+(?:part|question|figure|diagram|graph|table)\b/i;

/** "23(a)(ii)" is "(a)(ii)"; "01.2" and "3" stay as they are. */
export function shortLabel(l: string): string {
  const m = l.match(/^\d+((?:\([^)]+\))+)$/);
  return m ? m[1] : l;
}
/** The letter groups of a label as the question prints it: "23(a)(ii)" is ["a", "ii"]; null for a label without them ("01.2"). */
const groupsOf = (l: string): string[] | null => {
  const m = l.match(/^\d+((?:\([^)]+\))+)$/);
  return m ? [...m[1].matchAll(/\(([^)]+)\)/g)].map((x) => x[1]) : null;
};

/** `siblings` are the parts of the part's question (any order; the part may be among them). */
export function sharedFigure(part: QPart, siblings: readonly QPart[]): SharedFigure | null {
  if (part.st || siblings.some((s) => s.st)) return null;
  const all = siblings.some((s) => s.id === part.id) ? siblings : [...siblings, part];
  const ordered = all.slice().sort((a, b) => compareLabels(a.l, b.l));
  const at = ordered.findIndex((s) => s.id === part.id);
  if (at <= 0 || (part.x && OWN.test(part.x))) return null;
  const earlier = ordered.slice(0, at);
  const own = across(part) >= OWN_TALL;
  const g = groupsOf(part.l);
  // the same letter group: the sub-part of an introduction whose figure is in the first sub-part's picture
  if (g && g.length >= 2 && !own && across(part) < SMALL) {
    const mine = earlier.filter((e) => { const eg = groupsOf(e.l); return !!eg && eg[0] === g[0]; });
    const figure = [...mine].reverse().find(tall);
    if (figure) return { from: figure, label: shortLabel(figure.l) };
  }
  // its words
  if (!mentionsFigure(part.x)) return null;
  if (own && !BACK.test(part.x ?? "")) return null;
  const from = [...earlier].reverse().find(tall) ?? earlier[0];
  return { from, label: shortLabel(from.l) };
}
