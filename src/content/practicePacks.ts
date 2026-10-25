import { papersBase } from "./questionBank";

/**
 * Plumi Practice Packs: whole practice papers written by Plumi, each a question paper and
 * a full mark scheme, free to download with no sign-up (founder, 25 October 2026: "a really
 * important aspect of our website"). Shown on the homepage's free practice section, at
 * /practice-papers and /practice-papers/<slug>, and beside the matching past papers.
 *
 * Every fact here is printed in the pack itself: the totals and sections on the question
 * paper's cover, the question table on the mark scheme's first page, and the checking
 * line at the foot of that table. A pack is "OCR-style" or "Edexcel-style", never the
 * board's own: the disclaimer goes wherever a pack is shown.
 *
 * Adding a pack: scripts/practice-packs/build.sh renders its cover and two sample pages
 * into public/practice-papers/<slug>/ and copies the PDFs for R2 (packs/<slug>-v<n>-*.pdf);
 * then add its entry below. A corrected pack gets a new `version`, since R2 serves the
 * files with a year-long immutable cache.
 */

export type PackLevel = "Easy" | "Medium" | "Hard" | "Super hard";

export interface PackQuestion {
  n: number;
  /** The section's letter: A, B or C. */
  section: string;
  level: PackLevel;
  topic: string;
  /** Specification references, where the scheme gives them (the OCR-style pack does). */
  spec?: string;
  marks: number;
}

export interface PracticePack {
  slug: string;
  /** "A-Level Physics A": how a student says it. */
  title: string;
  subject: "Physics" | "Maths";
  level: "A-Level";
  /** The board whose papers it is written like, and that board's specification code. */
  board: "OCR" | "Edexcel";
  spec: string;
  /** "OCR-style practice written by Plumi. Not produced or endorsed by OCR." */
  disclaimer: string;
  marks: number;
  hours: number;
  sections: { letter: string; name: string; content: string; marks: number }[];
  /** What you need beside you, from the cover. */
  equipment: string;
  /** How the mark scheme's answers were checked, from the foot of its first page. */
  checked: string;
  colour: string;
  /** Bumped when the PDFs change, with `updated`: R2 keeps a version's files forever. */
  version: number;
  updated: string;
  /** Pages of the PDFs shown as samples (rendered by build.sh). */
  samples: { question: string; scheme: string };
  questions: PackQuestion[];
  /** The past paper and bank pages it sits beside. */
  pastPapers: string;
  bank: string;
}

const q = (n: number, section: string, level: PackLevel, topic: string, marks: number, spec?: string): PackQuestion => ({ n, section, level, topic, marks, spec });

export const practicePacks: PracticePack[] = [
  {
    slug: "a-level-maths-edexcel",
    title: "A-Level Maths",
    subject: "Maths",
    level: "A-Level",
    board: "Edexcel",
    spec: "9MA0",
    disclaimer: "Edexcel-style practice written by Plumi. Not produced or endorsed by Pearson Edexcel.",
    marks: 298,
    hours: 6,
    sections: [
      { letter: "A", name: "Pure Mathematics", content: "Logs, calculus, numerical methods, trigonometry, parametrics, differential equations and proof", marks: 106 },
      { letter: "B", name: "Statistics", content: "Binomial and normal distributions, hypothesis tests, regression and probability", marks: 95 },
      { letter: "C", name: "Mechanics", content: "Vectors, kinematics, connected particles, moments, friction, projectiles and statics", marks: 97 },
    ],
    equipment: "Mathematical Formulae and Statistical Tables, and a calculator",
    checked: "Every numerical answer and every printed result in the mark scheme was checked by computer algebra or exact probability calculation.",
    colour: "#6a9bd0",
    version: 1,
    updated: "2026-10-25",
    samples: { question: "Question 2: integration by substitution, with its figure", scheme: "The mark scheme for Questions 1 and 2, with the notes on each mark" },
    questions: [
      q(1, "A", "Easy", "Laws of logarithms", 5),
      q(2, "A", "Medium", "Integration by substitution", 8),
      q(3, "A", "Medium", "Numerical methods: Newton-Raphson", 9),
      q(4, "A", "Medium", "Harmonic form R sin(x − α)", 11),
      q(5, "A", "Hard", "Connected rates of change", 11),
      q(6, "A", "Hard", "Parametric equations: tangents and area", 11),
      q(7, "A", "Hard", "Differential equations and modelling", 12),
      q(8, "A", "Super hard", "Tangents, integration by parts, a parameter", 13),
      q(9, "A", "Super hard", "Differential equations: draining a cone", 12),
      q(10, "A", "Super hard", "Trigonometric identities, cubic equations, proof", 14),
      q(11, "B", "Easy", "Binomial distribution", 5),
      q(12, "B", "Medium", "The normal distribution", 9),
      q(13, "B", "Medium", "Hypothesis testing: binomial", 9),
      q(14, "B", "Medium", "Regression and correlation", 7),
      q(15, "B", "Hard", "Probability: Venn diagrams, independence", 11),
      q(16, "B", "Hard", "Hypothesis testing: normal mean", 10),
      q(17, "B", "Hard", "The normal distribution: quartiles and independence", 10),
      q(18, "B", "Super hard", "Calculus, the normal distribution and a binomial test", 12),
      q(19, "B", "Super hard", "Conditional probability with normal distributions", 11),
      q(20, "B", "Super hard", "Discrete distributions and a binomial test", 11),
      q(21, "C", "Easy", "Vectors: velocity and position", 5),
      q(22, "C", "Medium", "Constant acceleration: vertical motion", 8),
      q(23, "C", "Medium", "Connected particles: Newton’s laws", 7),
      q(24, "C", "Medium", "Moments", 7),
      q(25, "C", "Hard", "Friction on an inclined plane", 10),
      q(26, "C", "Hard", "Connected particles on a rough plane", 11),
      q(27, "C", "Hard", "Projectiles: a range of possible speeds", 12),
      q(28, "C", "Super hard", "Statics: ladder with friction at both ends", 13),
      q(29, "C", "Super hard", "Variable acceleration: distance and displacement", 11),
      q(30, "C", "Super hard", "Connected particles: rough slope, slack string", 13),
    ],
    pastPapers: "/past-papers/a-level-maths/edexcel",
    bank: "/question-bank/edexcel-a-level-maths",
  },
  {
    slug: "a-level-physics-ocr",
    title: "A-Level Physics A",
    subject: "Physics",
    level: "A-Level",
    board: "OCR",
    spec: "H556",
    disclaimer: "OCR-style practice written by Plumi. Not produced or endorsed by OCR.",
    marks: 362,
    hours: 8,
    sections: [
      { letter: "A", name: "Modelling Physics", content: "Modules 3 and 5, with practical skills", marks: 124 },
      { letter: "B", name: "Exploring Physics", content: "Modules 4 and 6, with practical skills", marks: 120 },
      { letter: "C", name: "Unified Physics", content: "Synoptic questions across all modules, with practical skills and data analysis", marks: 118 },
    ],
    equipment: "the Data, Formulae and Relationships Booklet (the data are also on page 2), a calculator and a ruler",
    checked: "Every numerical answer, show-that, unit and significant-figure judgement in the mark scheme was checked by computer: exact and numerical calculation, dimensional analysis and simulation.",
    colour: "#f2c96b",
    version: 1,
    updated: "2026-10-25",
    samples: { question: "Question 1: projectile motion from a cliff top, with its figure", scheme: "The mark scheme for Question 2, with its guidance and notes on the common slips" },
    questions: [
      q(1, "A", "Easy", "Projectile motion", 11, "3.1.5, 3.3.2"),
      q(2, "A", "Medium", "Upthrust and the ideal gas: a hot-air balloon", 11, "3.2.5, 5.1.3"),
      q(3, "A", "Medium", "Moments and equilibrium: a hinged beam", 9, "3.2.4, 2.3.2, 3.2.3"),
      q(4, "A", "Medium", "Circular orbits: the moons of Saturn", 11, "5.4.3, 5.2.2, 2.1.2"),
      q(5, "A", "Hard", "Gravitational orbits and signal timing: a GPS satellite", 11, "5.4.3, 5.4.4, 4.4.1"),
      q(6, "A", "Hard", "Oscillations practical: mass on a spring", 14, "5.3.1, 5.3.3, 1.1.4, 2.2.3"),
      q(7, "A", "Hard", "Momentum and impulse: an air-track collision", 16, "3.5.1, 3.5.2, 3.5.3, 3.5.4"),
      q(8, "A", "Super hard", "Circular motion and energy: a loop-the-loop", 13, "5.2.2, 3.3.2, 3.3.3"),
      q(9, "A", "Super hard", "Ideal gases practical: determining absolute zero", 15, "5.1.1, 5.1.3, 1.1.1, 1.1.4, 2.2.2"),
      q(10, "A", "Super hard", "Doppler shift and orbits: detecting an exoplanet", 13, "5.5.3, 5.4.3, 5.2.2, 3.5.2"),
      q(11, "B", "Easy", "Potential dividers: a light sensor", 8, "4.3.4, 4.2.2"),
      q(12, "B", "Medium", "Capacitor discharge: a clock back-up", 11, "6.1.3, 6.1.4, 6.1.2"),
      q(13, "B", "Medium", "Wave-particle duality: electron diffraction", 10, "4.5.3, 4.4.4"),
      q(14, "B", "Medium", "Medical imaging: X-ray production and attenuation", 9, "6.5.1, 6.5.2, 4.5.1"),
      q(15, "B", "Hard", "Uniform electric fields: separating plastics", 12, "6.2.3, 6.2.1, 3.1.3"),
      q(16, "B", "Hard", "Stationary waves: microwaves and a metal plate", 14, "4.4.6, 4.4.4, 2.2.3"),
      q(17, "B", "Hard", "The photoelectric effect: stopping potential", 15, "4.5.2, 4.5.1, 4.1.1"),
      q(18, "B", "Super hard", "Charged particles in fields: separating isotopes", 12, "6.3.2, 6.2.4, 6.4.1"),
      q(19, "B", "Super hard", "Capacitors practical: discharge through a voltmeter", 15, "6.1.3, 6.1.4, 1.1.1, 1.1.4, 2.2.3"),
      q(20, "B", "Super hard", "Annihilation and PET scanning", 14, "6.5.4, 6.4.1, 6.4.4, 4.5.1"),
      q(21, "C", "Easy", "Practical skills: the resistivity of a wire", 8, "4.2.4, 1.1.3, 1.1.4, 2.2.3, 2.2.4"),
      q(22, "C", "Medium", "Energy and electromagnetic induction: a hydroelectric generator", 12, "3.3.3, 3.3.4, 6.3.3, 6.3.4"),
      q(23, "C", "Medium", "Gravitational fields and kinematics: a lunar mass driver", 12, "5.4.2, 5.4.4, 3.1.3, 3.3.4"),
      q(24, "C", "Medium", "Thermal and electrical energy: an electric shower", 11, "5.1.2, 4.2.5, 4.2.4"),
      q(25, "C", "Hard", "Data analysis: a power law for the pendulum", 13, "5.3.1, 1.1.4, 2.2.3"),
      q(26, "C", "Hard", "Radioactivity and current: a smoke alarm", 10, "6.4.4, 6.4.2, 4.1.1"),
      q(27, "C", "Hard", "Stellar radiation: the radius of a star", 12, "5.5.2, 5.5.3, 4.4.1, 4.5.1"),
      q(28, "C", "Super hard", "Practical skills: the Planck constant from LEDs", 14, "4.5.1, 4.2.3, 1.1.1, 1.1.4, 2.2.3"),
      q(29, "C", "Super hard", "Stationary waves and materials: a guitar string", 13, "4.4.6, 4.4.1, 3.4.3, 3.4.5"),
      q(30, "C", "Super hard", "Momentum, energy and electricity: a hovering drone", 13, "3.5.1, 3.5.3, 3.3.4, 4.2.5, 4.1.1"),
    ],
    pastPapers: "/past-papers/a-level-physics/ocr",
    bank: "/question-bank/ocr-a-level-physics-a",
  },
];

export const packLevels: PackLevel[] = ["Easy", "Medium", "Hard", "Super hard"];
export const packPath = (slug: string) => `/practice-papers/${slug}`;
export const practicePack = (slug: string) => practicePacks.find(p => p.slug === slug);
/** The pack's PDFs on R2: packs/a-level-physics-ocr-v1-questions.pdf. */
export const packFile = (p: PracticePack, file: "questions" | "mark-scheme") => `${papersBase}/packs/${p.slug}-v${p.version}-${file}.pdf`;
/** What the browser saves it as: "Plumi Practice Pack - A-Level Physics A (OCR-style) - Mark scheme.pdf". */
export const packFileName = (p: PracticePack, file: "questions" | "mark-scheme") =>
  `Plumi Practice Pack - ${p.title} (${p.board}-style) - ${file === "questions" ? "Questions" : "Mark scheme"}.pdf`;
export const packImage = (p: PracticePack, image: "cover" | "question" | "scheme") => `/practice-packs/${p.slug}/${image}.webp`;
/** Its 1200x630 share card, made by scripts/practice-packs/og.ts. */
export const packShareImage = (p: PracticePack) => `/practice-packs/${p.slug}/og.png`;
/** "OCR-style A-Level Physics A (H556)". */
export const packName = (p: PracticePack) => `${p.board}-style ${p.title} (${p.spec})`;
/** The pack written like this board's papers in this subject, for the past paper and bank pages. */
export const packFor = (path: string) => practicePacks.find(p => p.pastPapers === path || p.bank === path || path === p.pastPapers.replace(/\/[^/]+$/, ""));

/** Totals across every pack, for the homepage and the hub. */
export const packTotals = {
  questions: practicePacks.reduce((n, p) => n + p.questions.length, 0),
  marks: practicePacks.reduce((n, p) => n + p.marks, 0),
};

/**
 * The hub's and each pack page's words. The comparison is against a generic "typical paid
 * pack", never a named one, and says only what a pack visibly has or lacks (founder, 25
 * October 2026, asked for "better than paid packs").
 */
export const packCopy = {
  eyebrow: "Made by Plumi · free",
  section: "Practice papers",
  hubTitle: "Practice papers,",
  hubTitleEm: "written by us.",
  hubLead: "Each pack is 30 exam-style questions in your board’s style, climbing from easy to super hard, with a full mark scheme written the way examiners write them. Print it, sit it, mark it. Free, with no sign-up.",
  download: { questions: "Questions PDF", scheme: "Mark scheme PDF" },
  proof: [
    { title: "Every answer checked by computer", line: "Each numerical answer in the mark schemes was checked by computer, not just by eye." },
    { title: "Mark schemes like the real ones", line: "M1, A1 and B1 marks, what to allow, error carried forward, and a note on the slip most students make." },
    { title: "Easy to super hard", line: "Each section climbs from a warm-up to three stretch-and-challenge questions, like the end of a real paper." },
  ],
  compare: {
    title: "How a Plumi pack",
    titleEm: "compares",
    lead: "What you get in a Plumi pack, beside what a typical paid practice pack gives you.",
    rows: [
      ["Price", "Free, no sign-up", "Usually paid"],
      ["Questions", "30, across every part of the course", "Often one paper’s worth"],
      ["Mark scheme", "Every mark, with what to allow and error carried forward", "Often answers only"],
      ["Common slips", "A note on each question saying where marks are lost", "Rarely"],
      ["Answers checked by computer", "Every numerical answer", "Rarely"],
      ["Difficulty", "Labelled Easy to Super hard, question by question", "Rarely labelled"],
    ] as [string, string, string][],
  },
  // The card after the packs, into the boards' own papers (founder, 25 October 2026: past
  // papers sit inside practice papers, "at the bottom have a card saying: want to do past papers?").
  pastPapers: {
    eyebrow: "Past papers",
    title: "Want to sit the real thing too?",
    line: "Every past paper and mark scheme from the exam boards, sorted by board and year, free.",
    cta: "Browse past papers",
  },
  faq: [
    { q: "Are these real past papers?", a: "No. Plumi wrote every question in the style of the board’s papers, to its specification, with a mark scheme in the board’s style. They are not produced or endorsed by the exam board. For the board’s own papers, see our past papers pages." },
    { q: "Are they really free?", a: "Yes. Download the questions and the mark scheme, print them or write on them on a tablet. There is nothing to sign up for." },
    { q: "How should I use a pack?", a: "Sit one section at a time, timed and by hand. Mark it with the scheme, read the note on each question you dropped, and come back to those a week later. Each section takes about two to three hours." },
    { q: "Can Plumi mark my answers?", a: "On iPad, yes: Plumi marks handwritten answers to questions like these against each question’s own mark scheme. The packs themselves are for marking by hand, and the scheme tells you everything you need." },
  ],
} as const;
