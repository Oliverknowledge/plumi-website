/**
 * Two independent readings of the same part agree when they say the same thing about the scheme. Agreement is the ONLY
 * check that replaces a person reading each pack, so it is strict about everything that decides a mark (the points, their
 * marks, the totals, the caps, the kind) and tolerant only of differences that cannot change a mark:
 *   - case, punctuation and spacing;
 *   - a slash list written as one item or as several ("gp41/gp120" vs "gp41", "gp120");
 *   - examples after "eg" / "e.g." / "ie" / "i.e." (kept in the published reading, ignored when comparing);
 *   - on a part with ONE mark point, a whole-question item (point null) is the same as an item for point 1.
 * It is NOT tolerant of a comment given to different points, or an item one reader has and the other lacks.
 * Agreement is not correctness: two readers can misread the same page the same way. It is a filter, not a proof.
 */
import type { ExtractedPack, PackItem } from "./markpack";

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const EXAMPLE = /\b(?:e\.?\s?g\.?|i\.?\s?e\.?)(?=\s)/i;

/** The comparable atoms of one item: examples cut off, slash alternatives split, normalised. */
export function atoms(text: string): string[] {
  const head = text.split(EXAMPLE)[0];
  return head.split(/\s*\/\s*/).map(norm).filter((a) => a.length > 0);
}

function itemSet(items: PackItem[], singlePoint: boolean): string[] {
  const out: string[] = [];
  for (const it of items) {
    const point = it.point === null && singlePoint ? 1 : it.point;
    for (const a of atoms(it.text)) out.push(`${point ?? "*"}:${a}`);
  }
  return [...new Set(out)].sort();
}

const LEAD = /^\s*(?:any\s+)?(?:one|two|three|four|\d+)\s+(?:answers?\s+)?from\s*[:;,.]?\s+/i;

/**
 * "Any one from a, b, c" written as ONE point, or as three points with a cap of one, is the same scheme. Both forms reduce to the
 * same words and the same effective marks; a reading of any other shape reduces to null and is compared strictly.
 */
function alternativesForm(p: ExtractedPack): { marks: number; words: string } | null {
  const words = (pts: ExtractedPack["points"]) => norm(pts.map((x) => x.text.replace(LEAD, "")).join(" ")).split(" ").sort().join(" ");
  if (p.points.length === 1 && LEAD.test(p.points[0].text) && p.max_marks === null) return { marks: p.points[0].marks, words: words(p.points) };
  if (p.points.length > 1 && p.max_marks !== null && p.points.every((x) => x.marks === p.points[0].marks)) {
    return { marks: p.max_marks, words: words(p.points.map((x) => ({ ...x, text: x.text.replace(LEAD, "") }))) };
  }
  return null;
}

export interface Comparison { agree: boolean; differences: string[] }

export function compareReadings(a: ExtractedPack, b: ExtractedPack): Comparison {
  const d: string[] = [];
  const eq = (name: string, x: unknown, y: unknown) => { if (JSON.stringify(x) !== JSON.stringify(y)) d.push(`${name}: ${JSON.stringify(x)} vs ${JSON.stringify(y)}`); };
  eq("marks_printed", a.marks_printed, b.marks_printed);
  eq("scheme_total", a.scheme_total, b.scheme_total);
  eq("answer_kind", a.answer_kind, b.answer_kind);
  eq("needs_figure_or_table", a.needs_figure_or_table, b.needs_figure_or_table);
  const fa = alternativesForm(a), fb = alternativesForm(b);
  if (fa && fb && a.points.length !== b.points.length) {
    eq("alternatives", fa, fb);   // one reading is "any one from a, b, c" as a single point, the other as separate points with a cap
  } else {
    eq("max_marks", a.max_marks, b.max_marks);
    eq("points", a.points.map((p) => [p.n, norm(p.text), p.marks]), b.points.map((p) => [p.n, norm(p.text), p.marks]));
  }
  const single = a.points.length === 1 && b.points.length === 1;
  for (const k of ["accept", "reject", "ignore"] as const) {
    const x = itemSet(a[k], single), y = itemSet(b[k], single);
    const onlyA = x.filter((v) => !y.includes(v)), onlyB = y.filter((v) => !x.includes(v));
    if (onlyA.length || onlyB.length) d.push(`${k}: only first [${onlyA.join(" | ")}] only second [${onlyB.join(" | ")}]`);
  }
  return { agree: d.length === 0, differences: d };
}

/** The reading to publish when two agree: the one that keeps more of the scheme's own words in accept, reject and ignore. */
export function fuller(a: ExtractedPack, b: ExtractedPack): ExtractedPack {
  const size = (p: ExtractedPack) => [...p.accept, ...p.reject, ...p.ignore].reduce((n, i) => n + i.text.length, 0);
  return size(b) > size(a) ? b : a;
}
