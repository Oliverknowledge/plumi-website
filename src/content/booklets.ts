import { papersBase } from "@/config/papers";

import data from "./booklets.json";

/**
 * Maths booklets: MadAsMaths' topic booklets, hosted here with permission (6 November 2026), free and open, no
 * sign-up. Each is a set of questions on one topic, every question with its difficulty in stars, its answer and a
 * worked solution; some also come as questions only. Shown at /maths-booklets and /maths-booklets/<group>.
 *
 * The pages say the booklets are from MadAsMaths and link to its site (`source`), and name nobody else.
 *
 * booklets.json is written by scripts/booklets/build.py from the shared Drive folder (scripts/booklets/fetch.py),
 * and the files are on R2 under booklets/madasmaths/<group>/ (scripts/booklets/upload.py). R2 serves them for a
 * year as immutable, so a changed booklet goes up under a new slug.
 */

export interface Booklet {
  slug: string;
  title: string;
  /** "Exam questions" or "Practice", where the booklet's name says which. */
  kind?: string;
  /** Mechanics: the modules it was written for, as MadAsMaths names them ("M1", "M2"). */
  modules?: string[];
  pages: number;
  questions: number;
  bytes: number;
  /** The easiest and hardest question, in MadAsMaths' stars (1 to 5, sometimes 6). */
  stars?: [number, number];
  /** The preview's size: the first page of questions. */
  preview: [number, number];
  /** The questions-only version, where MadAsMaths published one. */
  questionsOnly?: { pages: number; bytes: number };
}

export interface BookletShelf { name: string; booklets: Booklet[] }

export type BookletGroupSlug = "elementary" | "basic" | "standard" | "further" | "mechanics" | "statistics" | "advanced";

export interface BookletGroup { slug: BookletGroupSlug; name: string; shelves: BookletShelf[] }

/**
 * What each group is for, in a student's words. `heading` is what the group's page is called ("Year 13 pure maths"):
 * MadAsMaths' own names for them ("Standard topics") don't say who they're for, so they're the kicker.
 */
export const groupCopy: Record<BookletGroupSlug, { heading: string; level: string; blurb: string }> = {
  elementary: { heading: "Elementary maths", level: "Before A-Level", blurb: "The algebra and arithmetic everything else is built on: skills, equations and quadratics." },
  basic: { heading: "Year 12 pure maths", level: "Year 12", blurb: "First-year pure maths: indices, surds, quadratics, coordinate geometry, series, logarithms and first calculus." },
  standard: { heading: "Year 13 pure maths", level: "Year 13", blurb: "Second-year pure maths: functions, trigonometry, differentiation, every method of integration and differential equations." },
  further: { heading: "Further Maths", level: "Further Maths", blurb: "Complex numbers, matrices, vectors, polar coordinates, hyperbolic functions, proof and differential equations." },
  mechanics: { heading: "Mechanics", level: "A-Level and Further Maths", blurb: "From kinematics and forces to circular motion, collisions, rotation and variable mass." },
  statistics: { heading: "Statistics", level: "A-Level and Further Maths", blurb: "Probability, distributions, hypothesis testing, correlation, goodness of fit and more." },
  advanced: { heading: "University maths", level: "Beyond A-Level", blurb: "For the keen: Fourier and Laplace transforms, vector calculus, PDEs, complex variables and more." },
};

/** The words on the pages. The credit says where the booklets are from, and names nobody (6 November 2026). */
export const bookletCopy = {
  section: "Maths booklets",
  eyebrow: "Free · no sign‑up",
  hubTitle: "Maths booklets,",
  hubTitleEm: "every answer worked.",
  credit: "These booklets are from MadAsMaths.",
  creditLink: "Visit madasmaths.com",
  solutions: "Every question has its answer and a worked solution beside it.",
  open: "Open booklet",
  questionsOnly: "Questions only",
  questionsOnlyNote: "Questions only: the same questions without the answers, to print and try first.",
};

const raw = data as unknown as { source: string; prefix: string; groups: BookletGroup[] };

export const bookletSource = raw.source;
export const bookletGroups = raw.groups;
export const allBooklets = bookletGroups.flatMap(g => g.shelves.flatMap(s => s.booklets.map(b => ({ ...b, group: g.slug }))));
export const bookletTotals = {
  booklets: allBooklets.length,
  questions: allBooklets.reduce((n, b) => n + b.questions, 0),
  groups: bookletGroups.length,
};

export const bookletsPath = "/maths-booklets";
export const bookletGroupPath = (group: string) => `${bookletsPath}/${group}`;
export const bookletGroup = (slug: string) => bookletGroups.find(g => g.slug === slug);
export const groupCount = (g: BookletGroup) => g.shelves.reduce((n, s) => n + s.booklets.length, 0);

const file = (group: string, name: string) => `${papersBase}/${raw.prefix}/${group}/${name}`;
/** The booklet, with its answers and worked solutions. */
export const bookletPdf = (group: string, b: Pick<Booklet, "slug">) => file(group, `${b.slug}.pdf`);
/** Its questions-only version. */
export const bookletQuestionsPdf = (group: string, b: Pick<Booklet, "slug">) => file(group, `${b.slug}-questions.pdf`);
export const bookletPreview = (group: string, b: Pick<Booklet, "slug">) => file(group, `${b.slug}-preview.webp`);

/** "3.4 MB", "820 KB". */
export const fileSize = (bytes: number) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(bytes >= 1e7 ? 0 : 1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`);
/** "★★ to ★★★★★", or one run of stars where every question is as hard. */
export const starRange = ([lo, hi]: [number, number]) => (lo === hi ? "★".repeat(lo) : `${"★".repeat(lo)} to ${"★".repeat(hi)}`);
