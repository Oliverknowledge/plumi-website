/**
 * The page's measurements, with no React attached.
 *
 * Separated from `Paper.tsx` so that build scripts — the social image
 * generator, in particular — can lay ink onto the same rules the website uses
 * without importing a component tree.
 *
 * The numbers are the app's, from `Features/Notebook/PaperBackground.swift`,
 * which took them from real exam stationery.
 */
export const PAGE = {
  /** Rule pitch. Everything vertical is a multiple of this. */
  rule: 36,
  topMargin: 88,
  insetLeft: 64,
  insetRight: 48,
  marginRuleX: 96,
  ruleColour: "#DEDCD9",
  /** "The red-ish margin rule that makes a page read as school stationery." */
  marginColour: "#D98A8A",
} as const;

/** The baseline of the nth rule, counting from 0. */
export function ruleAt(n: number): number {
  return PAGE.topMargin + n * PAGE.rule;
}

/**
 * Where a block of handwriting must start for its baseline to land on a rule.
 * `Ink` positions from the top of the block and the cap height is 0.7em, so
 * writing placed at the rule itself floats above it by a fifth of a line — a
 * small error that reads immediately as "text box", not "notebook".
 */
export function inkTopForRule(n: number, size: number): number {
  return ruleAt(n) - size * 0.7;
}
