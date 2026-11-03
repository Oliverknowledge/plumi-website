/**
 * The plain-English key to the shorthand on a mark scheme, for a student who has never been told what "M1 A1 oe ft" mean. What it says is
 * what the boards' schemes in the bank actually use (counted over the bank's text, not assumed): M, A, B, P and C marks and oe, ft, cao,
 * isw, dep in the maths schemes; allow, accept, ignore, reject, ecf and AO in the science schemes; AO and levels in essay subjects.
 * Short on purpose: a phrase each, no paragraph.
 */
export interface MarkKeyEntry { term: string; means: string }
export interface MarkKeyContent { summary: string; entries: MarkKeyEntry[] }

const MATHS: MarkKeyContent = {
  summary: "What do M, A and B mean?",
  entries: [
    { term: "M", means: "method mark: you used the right method, even if the answer is wrong" },
    { term: "A", means: "accuracy mark: the answer is right (you usually need the method mark first)" },
    { term: "B", means: "independent mark: a correct fact or step that stands on its own" },
    { term: "P", means: "process mark: a step towards solving the problem" },
    { term: "C", means: "communication mark: you explain or conclude clearly" },
    { term: "oe", means: "or equivalent: another correct way of writing it" },
    { term: "ft", means: "follow through: right using your own earlier answer, even if that was wrong" },
    { term: "cao", means: "correct answer only" },
    { term: "isw", means: "ignore subsequent working: later extra working does not lose the mark" },
    { term: "dep", means: "depends on the mark before it" },
  ],
};

const SCIENCE: MarkKeyContent = {
  summary: "What do allow and ignore mean?",
  entries: [
    { term: "Allow, accept", means: "this answer also earns the mark" },
    { term: "Ignore", means: "a wrong or extra bit that does not lose you the mark" },
    { term: "Do not allow, reject", means: "this answer earns no mark" },
    { term: "ecf", means: "error carried forward: right using your own earlier answer, even if that was wrong" },
    { term: "oe", means: "or equivalent: another correct way of saying it" },
    { term: "M, A, B", means: "method, accuracy and independent marks in a calculation" },
    { term: "AO1, AO2, AO3", means: "the skill the mark tests: recall, apply, analyse" },
  ],
};

const ESSAY: MarkKeyContent = {
  summary: "What do the levels mean?",
  entries: [
    { term: "Level", means: "find the description that best fits your whole answer, then pick the mark within it" },
    { term: "AO1, AO2, AO3, AO4", means: "the skills being marked: knowledge, application, analysis, and other skills the subject names" },
    { term: "Allow, accept", means: "this also earns credit" },
    { term: "Ignore", means: "does not lose or gain a mark" },
  ],
};


const ESSAY_SUBJECTS = /english|history|geography|religious|philosophy|politics|sociology|psychology|business|economics|law|criminology|islamic/;

/** The key for a bank subject's slug ("aqa-gcse-maths"). */
export function markKeyFor(slug: string): MarkKeyContent {
  if (/maths/.test(slug)) return MATHS;
  if (ESSAY_SUBJECTS.test(slug)) return ESSAY;
  return SCIENCE;
}
