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
  /** Three steps, each page with its own titles: no shared skeleton across subjects. */
  steps: readonly { title: string; line: string }[];
  faq: readonly { q: string; a: string }[];
}

const commonFaq = (subject: string) => [
  {
    q: `Which ${subject} specifications does Plumi follow?`,
    a: `GCSE and A‑Level ${subject} for AQA, OCR and Edexcel. The units for each are listed on this page, and the topics in your board’s units become the squares on your topic map.`,
  },
  {
    q: `Are these real ${subject} past paper questions?`,
    a: "No. Plumi writes its own in your board’s style, and the mark scheme for each. For the real thing, the Papers tab links to the boards’ A‑Level past papers, mark schemes and grade boundaries. Plumi isn’t affiliated with any exam board.",
  },
  {
    q: "Are the required practicals covered?",
    a: `On most boards, yes. Where your board’s practicals are on your ${subject} topic map, Plumi sets and marks practical questions like any other.`,
  },
  {
    q: "Is it free?",
    a: `Free to download. Each week you get 10 answers marked, 3 practice sessions, 12 AI Pen answers and 1 AI tutor session. Pro makes them unlimited for ${prices.yearlyPerMonth} a month, billed as ${prices.yearly} a year after a ${prices.trialDays}-day free trial, or ${prices.monthly} paid monthly, which has no trial. Cancel any time in Settings.`,
  },
] as const;

export const subjectPages: Record<SubjectSlug, SubjectPageContent> = {
  physics: {
    slug: "physics",
    name: "Physics",
    path: "/physics-revision",
    tone: "#e8892b",
    eyebrow: "GCSE & A-Level Physics revision app for iPad",
    h1a: "Physics questions,",
    h1b: "marked on your working.",
    sub: "Plumi draws the circuit into an AQA, OCR or Edexcel style question. You show your working with Apple Pencil, and each mark lands on the line that won or lost it.",
    stepsTitle: "Your working earns marks of its own.",
    subShort: "Each mark lands on the line that won or lost it.",
    hero: { kind: "ipad", image: "/site/shot-mark.webp", alt: "A handwritten A-Level Physics answer about a light sensor circuit, marked 3 out of 5 in Plumi, with the lost method and accuracy marks shown on the page." },
    figures: [
      { image: "/site/diagram-d4b.webp", label: "Resonance", alt: "Resonance curves of amplitude against driving frequency, with a sharp peak at 2 Hz." },
      { image: "/site/diagram-d3b.webp", label: "I-V characteristics", alt: "Current against potential difference for four components, labelled A to D." },
      { image: "/site/diagram-d9b.webp", label: "Circuits", alt: "A circuit with a capacitor, a switch and four resistors." },
    ],
    steps: [
      { title: "Pick a topic, get a page to write on.", line: "Plumi writes the question in your board’s style and draws the circuit or graph in, so the page looks like the paper." },
      { title: "Method marks go on the method.", line: "In the answer above, the right formula kept its mark. The wrong resistor in the fraction cost the next method mark and the answer." },
      { title: "Lose marks on a topic and its square shows it.", line: "Keep dropping them on potential dividers and that square turns red. On A‑Level Physics, Plumi then suggests your next practice from the map." },
    ],
    faq: [
      ...commonFaq("Physics"),
      { q: "Does it check units and significant figures?", a: "Where the mark scheme gives a mark for the unit or the final value, Plumi gives or withholds that mark on the line you wrote it. At A‑Level, AQA, OCR and Edexcel each treat a missing unit differently, and Plumi follows your board’s rule. If the scheme gives a mark for significant figures, Plumi treats that mark the same way." },
    ],
  },
  chemistry: {
    slug: "chemistry",
    name: "Chemistry",
    path: "/chemistry-revision",
    tone: "#22a35a",
    eyebrow: "GCSE & A-Level Chemistry revision app for iPad",
    // A worked example as the headline: ChemistryMarkCheck agrees -57100 J mol-1 with
    // -57.1 kJ mol-1 (ChemistryMarkCheckTests.swift). Non-breaking spaces keep each unit on its number.
    h1a: "Write 57,100 J where the scheme says 57.1 kJ.",
    h1b: "You still get the mark.",
    sub: "Write the calculation by hand, the way you would in the exam. Where Plumi’s mark scheme gives a value, Plumi checks yours by arithmetic.",
    stepsTitle: "Your numbers are checked, not just read.",
    subShort: "Write the calculation by hand, the way you would in the exam.",
    hero: { kind: "figure", image: "/site/diagram-chemb.webp", alt: "A reaction profile from a Plumi Chemistry question: energy against progress of reaction, with the uncatalysed and catalysed routes and the activation energy marked.", caption: "Drawn by Plumi for an AQA GCSE question on reaction profiles." },
    figures: [
      { image: "/site/diagram-chemb.webp", label: "Energy profile", alt: "A reaction profile with a solid uncatalysed curve, a dashed catalysed curve, and arrows for the activation energy and the overall energy change." },
    ],
    steps: [
      { title: "The curve comes already drawn.", line: "The reaction profile above came with an AQA GCSE question. Your answer goes on the page under it." },
      { title: "Fewer figures can still count.", line: "Where the scheme gives a value, Plumi checks yours by arithmetic. If the question doesn’t ask for a precision, it uses your board’s rule on how many figures will do." },
      { title: "Moles gets a square of its own.", line: "Its colour on your topic map comes from how your marked moles answers went, so you can see when it’s time to go back to it." },
    ],
    faq: [
      ...commonFaq("Chemistry"),
      { q: "Does it understand chemical formulae?", a: "Yes. It reads Ca(OH)2 as one calcium, two oxygens and two hydrogens, so a right formula counts however your handwriting spaces it. If Plumi isn’t sure about a mark, it says so, and that mark stays off your topic map until you’ve checked it." },
      { q: "Does it check my calculations?", a: "Yes. Where the mark scheme states a value, Plumi checks yours by arithmetic. If you think it missed a mark you earned, tap \"I disagree\" and it looks again." },
    ],
  },
  biology: {
    slug: "biology",
    name: "Biology",
    path: "/biology-revision",
    tone: "#0f9e95",
    eyebrow: "GCSE & A-Level Biology revision app for iPad",
    // Levels only where the board marks in levels: AQA A-Level (7402) levels-marks only the
    // 25-mark essay, and its 4 to 6 mark explain parts are point-marked.
    h1a: "A Biology notebook",
    h1b: "that marks your 6‑markers too.",
    sub: "Write your answer by hand. Short answers are marked point by point, and 6‑markers in levels where your board uses them.",
    stepsTitle: "Points or levels, whichever your board uses.",
    subShort: "Short answers are marked point by point, and 6‑markers in levels where your board uses them.",
    hero: { kind: "figure", image: "/site/diagram-biob.webp", alt: "A woodland food web from a Plumi Biology question: an oak tree feeding a caterpillar, an aphid and an earthworm, up to a sparrowhawk.", caption: "Drawn by Plumi for an AQA GCSE question on communities." },
    figures: [
      { image: "/site/diagram-biob.webp", label: "Food web", alt: "A woodland food web: an oak tree feeds a caterpillar, an aphid and an earthworm, which feed blue tits and shrews, which feed a sparrowhawk." },
    ],
    steps: [
      { title: "Start from the food web.", line: "Plumi drew the web above for a GCSE question on communities. You write your answer straight beneath it." },
      { title: "Points get ticked where you made them.", line: "On a short answer, each scheme point you made is ticked on the line you wrote it. Where your board marks a 6‑marker in levels, it gets one level for the whole answer." },
      { title: "Inheritance needs more than one good answer.", line: "After one, its square on your topic map still says Too early to tell. Keep getting them right and it turns green." },
    ],
    faq: [
      ...commonFaq("Biology"),
      { q: "Can I practise the AQA A‑Level Biology essay?", a: "Yes. On AQA A‑Level Biology, Plumi sets a 25‑mark essay with two titles of its own and marks it in the board’s five bands. It also counts the areas of the spec your essay draws on." },
    ],
  },
};
