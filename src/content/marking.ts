/**
 * The marking chapter and the trust chapter.
 *
 * ── Why this file exists ─────────────────────────────────────────────────────
 * Marking is what Plumi is, and until now it appeared nowhere on the site. The
 * hero shows a nudge; section 01 shows a nudge. Neither shows a mark being
 * awarded against a mark scheme with the lost marks named, which is the entire
 * reason to install Plumi and the one thing no competitor can show as well.
 *
 * ── Every claim below is checked against the app, not against a document ─────
 * The question, its working and its six marking points are illustrative — a
 * drawn recreation, captioned as one. What is NOT illustrative is the grammar:
 *
 *   · `MarkKind` (Marking/MarkingModels.swift) models M / A / B / E / R / C / DM,
 *     so M1…M5 and A1 are the app's own notation, not exam-paper cosplay.
 *   · `MarkingTask.mark` rule 2a: "at most one accuracy point per part, and call
 *     it A1. Never invent or output A2, A3." This question has no parts, so it
 *     has exactly one A. That constraint is why the breakdown below reads
 *     M1 M2 M3 M4 M5 A1 rather than the M1 A1 M1 A1 a printed scheme would use.
 *   · `MarkingTask.mark`: "**headline** is six words at most". Every headline
 *     here is six words or fewer, and two of them ("Correct choice of parts",
 *     "Sign error in the second term") are the prompt's own examples.
 *   · `MarkingTask.mark` rule 3 + `applyECF` (MarkingEngine.swift): the model is
 *     asked only "taking the student's own earlier numbers as given, was the
 *     method at this step carried out correctly?", and Swift applies the
 *     carry-forward. That is why the sign slip costs one mark and not four, and
 *     the footnote says exactly that and no more — the accuracy mark is NOT
 *     claimed to follow through.
 *   · `evidence` is "the student's own words, copied exactly as they are written
 *     on the page", and `box` puts the mark on the step rather than the page.
 *     Hence one mark per line of working, in the margin beside that line.
 */

/** A line of the student's working, as they wrote it. */
export interface WorkingLine {
  /** Written in Plumi's ported hand. Superscripts are literal ² ³ glyphs. */
  text: string;
  /** Second column on the same line, for the `u = … dv = …` setting-out. */
  second?: string;
}

export interface MarkPoint {
  /** The app's own notation. One accuracy label per part, always `A1`. */
  code: string;
  /** Index into `working`. The mark is drawn beside that line and no other. */
  line: number;
  awarded: boolean;
  /** Six words at most. The app's rule, not a style preference. */
  headline: string;
  /** Only on a lost mark, and only one sentence. */
  detail?: string;
}

export const theMark = {
  id: "the-mark",
  arc: "It reads you",
  eyebrow: "02",
  eyebrowLabel: "THE MARK",
  headline: "Six marks. You got four.",
  headlineMuted: "Here are the two.",
  lead:
    "Marked against the mark scheme, point by point.",

  paperLabel: "A-LEVEL MATHEMATICS",
  paperRef: "PURE / INTEGRATION",
  /**
   * Printed, in the serif, because on a real script the question is printed and
   * only the working is handwritten. The hand has no fractions and no limits on
   * an integral sign by design, so this half of the page is ordinary type — and
   * the contrast between the two is exactly what a marked page looks like.
   */
  questionNumber: "7.",
  question: "Find the exact value of",
  questionLower: "1",
  questionUpper: "e",
  questionRest: "x² ln x dx",
  /** The whole thing said out loud, because stacked limits read as noise. */
  questionSpoken: "the integral from 1 to e of x squared ln x, with respect to x",
  questionMarks: "[6 marks]",

  /** The student's working, in the order they wrote it. */
  working: [
    { text: "u = ln x", second: "dv = x² dx" },
    { text: "du = 1/x dx", second: "v = x³/3" },
    { text: "= (x³/3) ln x + ∫ (x²/3) dx" },
    { text: "= (x³/3) ln x + x³/9" },
    { text: "= (e³/3 + e³/9) - (0 + 1/9)" },
    { text: "≈ 8.82" },
  ] as const satisfies readonly WorkingLine[],

  /**
   * Six points, four awarded. The two losses are the two the examiner reports
   * name most often on this question type: a sign slip in the parts formula,
   * and an answer given as a decimal where the question demanded an exact value.
   */
  points: [
    { code: "M1", line: 0, awarded: true, headline: "Correct choice of parts" },
    { code: "M2", line: 1, awarded: true, headline: "Both halves correctly found" },
    {
      code: "M3",
      line: 2,
      awarded: false,
      headline: "Sign error in the second term",
      detail: "Integration by parts is uv − ∫v du. You wrote a plus.",
    },
    { code: "M4", line: 3, awarded: true, headline: "Second term integrated correctly" },
    { code: "M5", line: 4, awarded: true, headline: "Limits substituted correctly" },
    {
      code: "A1",
      line: 5,
      awarded: false,
      headline: "An exact value was asked for",
      detail: "8.82 is a rounding of one. The question wanted the value itself.",
    },
  ] as const satisfies readonly MarkPoint[],

  score: { awarded: 4, total: 6 },
  scoreLabel: "MARKED",

  /**
   * The follow-through, in one sentence. `applyECF` is real and deterministic,
   * and it is the single most reassuring thing about the way Plumi marks: one
   * slip does not cascade. Worded to claim method marks only.
   */
  footnote:
    "The sign slip cost one mark, not four. Every method step after it was marked on your own numbers.",
  caption: "Illustrative marking pass · Not an app recording",
  ledgerLabel: "WHERE THE SIX MARKS WENT",
  replay: "Replay ↻",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TRUST
//
// The objection every 2026 student has and no competitor in this category
// addresses. Three panels, plain English, and one honesty line that is worth
// more than the claim it replaces.
// ─────────────────────────────────────────────────────────────────────────────

export const trust = {
  id: "trust",
  eyebrow: "03",
  eyebrowLabel: "WHY YOU CAN TRUST THE MARK",
  /**
   * Four words, negation-defined. A second line was drafted and cut: the lead
   * beneath already says the positive half, and two lines of display type made
   * the strongest sentence on the page take four lines to arrive.
   */
  headline: "Plumi doesn’t guess your mark.",
  lead: "The model works out what you demonstrated. The mark scheme decides what that’s worth.",

  /**
   * Three steps. No architecture, no model names, no "pipeline".
   *
   * Step 1 is `MarkingEngine.Input.answerIsConfirmed` — the engine marks against
   * a confirmed transcription where one exists, and the header comment says why:
   * "a misreading is the student's to correct, not a silent cause of a wrong
   * mark". Step 2 is `MarkingTask.mark` rules 2b and `evidence`. Step 3 is
   * `applyDependencies` / `applyECF` / `validate(_:scheme:)`, all of which are
   * Swift and none of which ask a model.
   */
  steps: [
    {
      n: "01",
      title: "It shows you what it read",
      body:
        "Handwriting recognition fails, and a model that is confident about a wrong reading is worse than one that admits it. Plumi shows you the line it read before it marks it. If it’s wrong you fix it, and your correction is what everything after it is built on.",
    },
    {
      n: "02",
      title: "It works out what you demonstrated",
      body:
        "Not whether the answer looks right. Which step earned which mark, quoted back in your own words, placed beside the line it belongs to.",
    },
    {
      n: "03",
      title: "The mark scheme decides the marks",
      body:
        "Method marks, follow-through and dependencies are rules, and rules belong in code. Plumi works those out itself rather than asking a model what a mark is worth.",
    },
  ],

  /**
   * The honesty line, and it is deliberate.
   *
   * `PhysicsVerifierMode.off` is "the shipped default" and `authoritative` is
   * "not reachable until a benchmark run earns it" (Physics/PhysicsShadowVerifier.swift),
   * with `MarkingEngine.init(physicsVerifier:)` defaulting to `.off` and
   * `ExperimentKey.physicsVerifier.control` set to the same. So the checker is
   * NOT deciding marks today, and this sentence says so rather than implying it.
   * Publishing the limitation alongside the architecture is the whole move; no
   * consumer competitor in this category has the nerve to do it.
   */
  honesty:
    "There is a second checker being built that re-does every calculation itself. Today it runs beside the marking and records where it disagrees. It doesn’t get to change a mark until a benchmark says it’s safer than what it’s checking, and we’ll publish that when it does.",

  /**
   * Three things Plumi does that a student can verify in a minute. All shipped.
   *
   *   · uncertainty — `PromptBuilder.system`: "If a mark could go either way, say
   *     so and explain the ambiguity… never manufacture a confidence number."
   *   · challenge   — `MarkingEngine.reconcile`: on unchanged work each point
   *     keeps the better of the two verdicts, so a re-mark cannot cost a mark.
   *     `MarkingTask.remark` escalates: stronger model, scheme restated,
   *     previous reasoning handed over to be argued against.
   *   · integrity   — Plumi marks; it does not write. True, and load-bearing.
   */
  panels: [
    {
      title: "It tells you when it isn’t sure",
      body:
        "Plumi publishes no confidence percentages anywhere, on purpose. A number to two significant figures is a precision nobody has earned. When a mark could go either way it says so, in words.",
    },
    {
      title: "Disagree with a mark? Say so",
      body:
        "Challenge any mark and Plumi reads the work again from scratch — a stronger model, the mark scheme restated, and its own previous reasoning handed over to be argued against. A re-mark can never cost you a mark you already had.",
    },
    {
      title: "Plumi marks what you wrote",
      body:
        "It doesn’t write your coursework and it isn’t trying to. The work is yours; Plumi is the marker. If your school has a policy on AI, we’d rather you showed them this than hid the app.",
    },
  ],
} as const;
