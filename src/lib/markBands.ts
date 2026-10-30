import type { BankPart, BankSubject } from "@/content/questionBank";

/**
 * "Question type": the bank by the marks a question is worth, because in an essay subject
 * the marks are the kind of question. AQA Philosophy asks 3, 5, 12 and 25-mark questions
 * and nothing else, and a student revises one kind at a time ("the 3-mark definitions
 * tonight"), not a paper at a time (the founder, 30 October 2026).
 *
 * Worked out from the bank's own parts, so it fits every bank without a table:
 *   - essay subjects with a handful of values (up to 8): a chip for each value. Philosophy,
 *     Politics, Law, Religious Studies, English Literature, Economics, Sociology.
 *   - essay subjects with more: 1–2, 3–5, 6–9, 10–15 and 16+ marks (Psychology, Business).
 *   - sciences and Computer Science, whose marks run 1, 2, 3… with no gaps: 1–2, 3–5, 6–9
 *     and 10+, so the 6-markers are one tap and AQA Biology's 25-mark essay stands alone.
 *   - maths, with few short questions: up to 5, 6–9, 10+.
 * A band's label names the marks it actually holds ("6 marks" where only 6s exist). One
 * value in the whole bank (English Literature A is all 25-markers) and there's no filter.
 */
export interface MarkBand { id: string; label: string; lo: number; hi: number }

const SCIENCE: [number, number][] = [[1, 2], [3, 5], [6, 9], [10, Infinity]];
const MATHS: [number, number][] = [[1, 5], [6, 9], [10, Infinity]];
const ESSAY: [number, number][] = [[1, 2], [3, 5], [6, 9], [10, 15], [16, Infinity]];

export function markBands(subject: Pick<BankSubject, "subject">, parts: BankPart[]): MarkBand[] {
  const values = [...new Set(parts.map(p => p.m).filter((m): m is number => m != null && m > 0))].sort((a, b) => a - b);
  if (values.length <= 1) return [];
  const marks = (lo: number, hi: number) => (lo === hi ? `${lo} ${lo === 1 ? "mark" : "marks"}` : `${lo}–${hi} marks`);
  const maths = /Maths/.test(subject.subject);
  const science = /^(Biology|Chemistry|Physics|Combined Science|Computer Science)/.test(subject.subject);
  if (!maths && !science && values.length <= 8) {
    return values.map(v => ({ id: String(v), label: marks(v, v), lo: v, hi: v }));
  }
  const bounds = maths ? MATHS : science ? SCIENCE : ESSAY;
  return bounds.flatMap(([lo, hi]) => {
    const inside = values.filter(v => v >= lo && v <= hi);
    if (!inside.length) return [];
    return [{ id: `${lo}-${hi === Infinity ? "" : hi}`, label: marks(inside[0], inside[inside.length - 1]), lo, hi }];
  });
}

export const inBand = (m: number | null, band: MarkBand) => m != null && m >= band.lo && m <= band.hi;
