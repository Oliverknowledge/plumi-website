/**
 * An examiner's report covers a whole question. Split it into the paragraphs that name this part ("01.4", "In 01.4...")
 * and the rest; Pearson's science reports head each part's comments ("Question 3(b)(i)"), and everything under this
 * part's heading is its own. The same rule as the bank's own page (components/questionBank/QuestionRow.tsx).
 */
export const questionOf = (label: string) => label.match(/^\d+/)?.[0] ?? label;

export function splitReport(report: string, label: string): { mine: string[]; rest: string[] } {
  const paras = report.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (label === questionOf(label)) return { mine: [], rest: paras.filter((p) => !/^Question \d\S*$/.test(p)) };
  const names = (p: string) => new RegExp(`(^|[^\\d])${label.replace(/[.()]/g, (m) => `\\${m}`)}(?![\\d(])`).test(p);
  const mine: string[] = [];
  const rest: string[] = [];
  let under: boolean | null = null;
  for (const p of paras) {
    const head = p.match(/^Question (\S+)$/);
    if (head) {
      under = head[1] === label;
      if (!under) rest.push(p);
      continue;
    }
    (under ?? names(p) ? mine : rest).push(p);
  }
  return { mine, rest };
}
