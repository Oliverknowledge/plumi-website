/**
 * A real specification tree.
 *
 * Every code and title below is transcribed from
 * `Sources/PlumiKit/Resources/topics_edexcel_maths_9ma0.json` (123 nodes, four
 * levels) — not invented, not paraphrased. A generic "Calculus → Integration"
 * diagram is something any developer could hardcode in an afternoon, and a
 * sceptical student knows that. Real board codes are the proof.
 *
 * The fourth level is the interesting one, and it is Plumi's, not the board's.
 * The file's own justification: "A fourth level of Plumi-authored skills sits
 * under the spec points and topics where the board's granularity is coarser
 * than the thing a student is actually weak at." Edexcel says "Integration by
 * substitution and by parts"; a student is weak at one of those, not both.
 */

export type Band = "not-started" | "seen" | "weak" | "developing" | "secure" | "mastered";

export const bandLabels: Record<Band, string> = {
  "not-started": "Not started",
  seen: "Seen",
  weak: "Weak",
  developing: "Developing",
  secure: "Secure",
  mastered: "Mastered",
};

export const bandColours: Record<Band, string> = {
  "not-started": "var(--color-mastery-unseen)",
  seen: "var(--color-mastery-unseen)",
  weak: "var(--color-mastery-weak)",
  developing: "var(--color-mastery-developing)",
  secure: "var(--color-mastery-secure)",
  mastered: "var(--color-mastery-mastered)",
};

export interface TopicNode {
  /** The board's own code, or Plumi's for the fourth level. */
  code: string;
  title: string;
  band?: Band;
  /** How many pieces of evidence sit behind the band. */
  evidence?: number;
  children?: readonly TopicNode[];
}

export const course = {
  subject: "Mathematics",
  level: "A-Level",
  board: "Pearson Edexcel",
  specCode: "9MA0",
  /** True: 123 nodes in the shipped tree. */
  nodeCount: 123,
} as const;

export const courseTree: readonly TopicNode[] = [
  {
    code: "PURE",
    title: "Pure Mathematics",
    band: "developing",
    children: [
      {
        code: "PURE.CALC",
        title: "Calculus",
        band: "developing",
        children: [
          {
            code: "PURE.8",
            title: "Integration",
            band: "developing",
            children: [
              {
                code: "PURE.8.5.SUBST",
                title: "Integration by substitution",
                band: "secure",
                evidence: 6,
              },
              {
                code: "PURE.8.5.PARTS",
                title: "Integration by parts",
                band: "weak",
                evidence: 3,
              },
              {
                code: "PURE.8.6.DIFFEQ",
                title: "Differential equations",
                band: "secure",
                evidence: 4,
              },
            ],
          },
          {
            code: "PURE.7",
            title: "Differentiation",
            band: "mastered",
            children: [
              {
                code: "PURE.7.4.IMPLICIT",
                title: "Implicit differentiation",
                band: "mastered",
                evidence: 7,
              },
              {
                code: "PURE.7.1",
                title: "First principles and the second derivative",
                band: "secure",
                evidence: 5,
              },
            ],
          },
        ],
      },
      {
        code: "PURE.REASON",
        title: "Proof and numerical methods",
        band: "weak",
        children: [
          { code: "PURE.1.1.CONTRA", title: "Proof by contradiction", band: "weak", evidence: 2 },
          { code: "PURE.9.3", title: "The Newton-Raphson method", band: "seen", evidence: 1 },
          { code: "PURE.9.CHANGE", title: "Locating roots by change of sign", band: "not-started" },
        ],
      },
      {
        code: "PURE.GEOM",
        title: "Geometry and trigonometry",
        band: "secure",
        children: [
          {
            code: "PURE.5.6.HARMONIC",
            title: "The harmonic form R sin(x ± α)",
            band: "secure",
            evidence: 4,
          },
          { code: "PURE.10", title: "Vectors", band: "developing", evidence: 3 },
        ],
      },
    ],
  },
  {
    code: "STAT",
    title: "Statistics",
    band: "seen",
    children: [
      {
        code: "STAT.DATA",
        title: "Data and distributions",
        band: "seen",
        children: [
          { code: "STAT.4.2", title: "The Normal distribution", band: "seen", evidence: 1 },
          {
            code: "STAT.4.2.APPROX",
            title: "Normal approximation to the binomial",
            band: "not-started",
          },
          { code: "STAT.2.LDS", title: "Interpreting the large data set", band: "not-started" },
        ],
      },
    ],
  },
  {
    code: "MECH",
    title: "Mechanics",
    band: "not-started",
    children: [
      {
        code: "MECH.MOTION",
        title: "Motion",
        band: "not-started",
        children: [
          { code: "MECH.7.SUVAT", title: "Constant acceleration formulae", band: "not-started" },
          { code: "MECH.7.5", title: "Projectiles", band: "not-started" },
        ],
      },
    ],
  },
] as const;

/**
 * The header of the tree. Composed from `course` rather than typed out, so the
 * board and the spec code on the page can only ever be the ones above.
 */
export const courseHeading = {
  /** "A-Level Mathematics" — the course as a student would name it. */
  course: `${course.level} ${course.subject}`,
  /** "Pearson Edexcel 9MA0" — the board's own name and its own spec code. */
  spec: `${course.board} ${course.specCode}`,
  /**
   * "123 entries", not "123 topics". The shipped tree has 123 NODES, and those
   * include the sections and groupings above the topics themselves — so
   * "topics" would be a small, checkable overclaim, which is the only kind
   * that matters.
   */
  nodes: `${course.nodeCount} entries, four levels deep`,
} as const;

/**
 * The branch that is open before anyone touches anything: Pure → Calculus →
 * Integration. The point of the section is the fourth level, and a student who
 * has to click three times to reach it will not click three times.
 */
export const defaultOpenCodes: readonly string[] = ["PURE", "PURE.CALC", "PURE.8"];

/** Labels for the tree's controls. Kept here so no string lives in the markup. */
export const treeCopy = {
  /** Names the list itself, for anyone arriving on it out of context. */
  listLabel: "Topics on your specification",
  expandHint: "Show what's underneath",
  collapseHint: "Hide what's underneath",
} as const;

/** "3 pieces of evidence" — the count behind a band, never a percentage. */
export function evidenceLabel(count: number): string {
  return count === 1 ? "1 piece of evidence" : `${count} pieces of evidence`;
}

/**
 * The fourth level, said out loud.
 *
 * This is the one thing in the tree that is Plumi's rather than the board's,
 * and it is the whole argument for hand-building each specification: the board
 * writes one spec point where a student has two separate problems. Quoting
 * Edexcel's own wording beside Plumi's split is the proof — it is checkable
 * against the specification in about ten seconds.
 */
export const granularityNote = {
  eyebrow: "The fourth level",
  /** Verbatim from spec point 8.5 of Edexcel 9MA0. */
  boardWording: "Integration by substitution and by parts",
  body:
    "That is one line on the specification. It is two different problems, and a student is weak at one of them, not both — so Plumi splits it, and bands each half on its own evidence.",
} as const;

/**
 * Boards the app actually catalogues. WJEC and CCEA are deliberately absent:
 * they exist in the catalogue with no specifications beneath them, and a pill a
 * student can tap that leads nowhere is worse than one that isn't there.
 */
export const boards = ["AQA", "Pearson Edexcel", "OCR"] as const;

/** The four subjects with real specifications behind them. */
export const subjects = ["Maths", "Physics", "Chemistry", "Biology"] as const;

/**
 * Honest, and it does more good than harm: a student who sees their own board
 * named alongside an admission of uneven coverage trusts the rest of the page.
 */
export const coverageNote =
  "Maths, Physics, Chemistry and Biology, across AQA, Edexcel and OCR. The trees are hand-built, so they aren't all at the same stage — tell us your course and we'll tell you honestly where yours is.";
