/**
 * The subject revision pages: one per science, each covering GCSE and A-Level for
 * all three boards. Same truth rules as the homepage (see src/content/home.ts):
 * no counts, no ratings, every image a real capture or a figure from a real bank
 * question, and the units come from the app's own curriculum (src/content/specs.ts).
 */
import { prices } from "@/content/home";

export type SubjectSlug = "physics" | "chemistry" | "biology";

export interface SubjectPageContent {
  slug: SubjectSlug;
  name: "Physics" | "Chemistry" | "Biology";
  path: string;
  tone: string;
  eyebrow: string;
  h1a: string;
  h1b: string;
  sub: string;
  /** The hero line on a phone: one short line, the home page's rule. */
  subShort: string;
  /** The how-it-marks heading. */
  stepsTitle: string;
  /** The hero picture: a marked iPad page for Physics, a real question figure otherwise. */
  hero: { kind: "ipad"; image: string; alt: string } | { kind: "figure"; image: string; alt: string; caption: string };
  figures: readonly { image: string; label: string; alt: string }[];
  steps: readonly { title: string; line: string }[];
  faq: readonly { q: string; a: string }[];
}

const steps = (first: string, second: string, third: string, markedTitle = "Every line, marked.") => [
  { title: "Answer it like the real exam.", line: first },
  { title: markedTitle, line: second },
  { title: "Your gaps, then your next question.", line: third },
] as const;

const commonFaq = (subject: string) => [
  {
    q: `Which ${subject} specifications does Plumi follow?`,
    a: `GCSE and A-Level ${subject} for AQA, OCR and Edexcel. Pick your board and Plumi tracks every unit on that specification, listed on this page.`,
  },
  {
    q: `Are these real ${subject} past paper questions?`,
    a: `Practice questions and mark schemes are written by Plumi in the style of your board. For A‑Level, the Papers tab links to the boards’ own past papers, mark schemes and grade boundaries. Plumi is not affiliated with any exam board.`,
  },
  {
    q: "Are the required practicals covered?",
    a: `The practical skills on your ${subject} specification, including the required or core practicals where your board lists them, are topics on your map, so questions on them are marked and tracked like any other topic.`,
  },
  {
    q: "Is it free?",
    a: `Plumi is free to download, with 10 answers marked, 5 practice questions, 12 AI Pen answers and 1 tutor session every week. Pro makes them unlimited: ${prices.yearly} a year with ${prices.trialDays} days free first, or ${prices.monthly} a month with no trial. iPad only, with iPadOS 17 or later.`,
  },
] as const;

export const subjectPages: Record<SubjectSlug, SubjectPageContent> = {
  physics: {
    slug: "physics",
    name: "Physics",
    path: "/physics-revision",
    tone: "#e8892b",
    eyebrow: "GCSE & A-Level Physics revision app for iPad",
    h1a: "Physics revision",
    h1b: "that marks your working.",
    sub: "Exam-style Physics questions for AQA, OCR and Edexcel. Write your answer with Apple Pencil and see every mark you lost.",
    stepsTitle: "Physics, marked line by line.",
    subShort: "Write it with Apple Pencil. See every Physics mark you lost.",
    hero: { kind: "ipad", image: "/site/shot-mark.webp", alt: "A handwritten A-Level Physics answer about a light sensor circuit, marked 3 out of 5 in Plumi, with the lost method and accuracy marks shown on the page." },
    figures: [
      { image: "/site/diagram-d4b.webp", label: "Resonance", alt: "Resonance curves of amplitude against driving frequency, with a sharp peak at 2 Hz." },
      { image: "/site/diagram-d3b.webp", label: "I-V characteristics", alt: "Current against potential difference for four components, labelled A to D." },
      { image: "/site/diagram-d9b.webp", label: "Circuits", alt: "A circuit with a capacitor, a switch and four resistors." },
    ],
    steps: steps(
      "An exam-style Physics question for your board, with the circuit, graph or field drawn in. You write underneath with Apple Pencil.",
      "Ticks and crosses land on your page: method, accuracy and explanation marks, and the exact line a mark was lost.",
      "Forces, fields or waves: whichever topic loses marks comes back next, picked from your map.",
    ),
    faq: [
      ...commonFaq("Physics"),
      { q: "Does it check units and significant figures?", a: "Plumi marks against the mark scheme for the question, so where the scheme gives a mark for the unit or the final value, that is the mark it awards or withholds, on the line where it was won or lost." },
    ],
  },
  chemistry: {
    slug: "chemistry",
    name: "Chemistry",
    path: "/chemistry-revision",
    tone: "#22a35a",
    eyebrow: "GCSE & A-Level Chemistry revision app for iPad",
    h1a: "Chemistry revision",
    h1b: "that marks your working.",
    sub: "Exam-style Chemistry questions for AQA, OCR and Edexcel. Write your answer with Apple Pencil and see every mark you lost.",
    stepsTitle: "Chemistry, marked line by line.",
    subShort: "Write it with Apple Pencil. See every Chemistry mark you lost.",
    hero: { kind: "figure", image: "/site/diagram-chemb.webp", alt: "A reaction profile from a Plumi Chemistry question: energy against progress of reaction, with the uncatalysed and catalysed routes and the activation energy marked.", caption: "From a Plumi question on reaction profiles, AQA GCSE Chemistry." },
    figures: [
      { image: "/site/diagram-chemb.webp", label: "Energy profile", alt: "A reaction profile with a solid uncatalysed curve, a dashed catalysed curve, and arrows for the activation energy and the overall energy change." },
    ],
    steps: steps(
      "An exam-style Chemistry question for your board, with the reaction profile, apparatus or graph drawn in. You write underneath with Apple Pencil.",
      "Ticks and crosses land on your page, and where the scheme gives a value, your answer is checked by arithmetic.",
      "Moles, rates or organic: whichever topic loses marks comes back next, picked from your map.",
    ),
    faq: [
      ...commonFaq("Chemistry"),
      { q: "Does it understand chemical formulae?", a: "Yes. Plumi reads a formula you write, such as Ca(OH)2, as the atoms it contains rather than as letters, so a correct formula is recognised however it is written. Where it cannot read one for certain, it does not mark you down for it." },
      { q: "Does it check my calculations?", a: "Yes. Where the mark scheme states a value, Plumi checks your answer by arithmetic: the same number in any equivalent unit, at a precision the board accepts. It only takes a mark away when the arithmetic is conclusive." },
    ],
  },
  biology: {
    slug: "biology",
    name: "Biology",
    path: "/biology-revision",
    tone: "#0f9e95",
    eyebrow: "GCSE & A-Level Biology revision app for iPad",
    h1a: "Biology revision",
    h1b: "that marks your answers.",
    sub: "Exam-style Biology questions for AQA, OCR and Edexcel. Write your answer with Apple Pencil and see every mark you lost.",
    stepsTitle: "Biology, marked point by point.",
    subShort: "Write it with Apple Pencil. See every Biology mark you lost.",
    hero: { kind: "figure", image: "/site/diagram-biob.webp", alt: "A woodland food web from a Plumi Biology question: an oak tree feeding a caterpillar, an aphid and an earthworm, up to a sparrowhawk.", caption: "From a Plumi question on communities, AQA GCSE Biology." },
    figures: [
      { image: "/site/diagram-biob.webp", label: "Food web", alt: "A woodland food web: an oak tree feeds a caterpillar, an aphid and an earthworm, which feed blue tits and shrews, which feed a sparrowhawk." },
    ],
    steps: steps(
      "An exam-style Biology question for your board, with the food web, cell or graph drawn in. You write underneath with Apple Pencil.",
      "Longer answers marked point by point, the way the scheme lists them, with the line each point was found on.",
      "Cells, genetics or ecology: whichever topic loses marks comes back next, picked from your map.",
      "Every point, marked.",
    ),
    faq: [
      ...commonFaq("Biology"),
      { q: "Can I practise the AQA A‑Level Biology essay?", a: "Yes. On AQA A‑Level Biology, Plumi sets a 25‑mark essay sitting with two titles of its own, and marks it in the board’s five bands, counting the areas of the specification your essay draws on." },
    ],
  },
};
