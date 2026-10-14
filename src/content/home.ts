/**
 * The homepage's words, in one place, so every claim can be checked in one place.
 *
 * Rules (the app's own): a title, at most one short line, the rest shown. No em
 * dashes anywhere a student reads. Every sentence is true of the shipped app today:
 *
 * - Prices and the trial are `PlumiProduct` in the app (PaywallView.swift): £14.99 a
 *   month, £135.99 a year, 7 days free on the yearly plan only. The £99.99 launch
 *   price is an A/B arm shown to half of new students until 31 January 2027, so the
 *   site states the standard price and never promises the launch one.
 * - The free allowances are weekly, from `PremiumFeature.freeAllowance` in
 *   Entitlements.swift: AI Pen 12, marking 10, practice 5, Tutor Mode 1.
 * - Boards and subjects are the courses the app ships: AQA, OCR and Edexcel, GCSE and
 *   A-Level Physics, Maths, Chemistry and Biology.
 * - Every product image on the page is a real capture from the app.
 */

export const appStoreId = "6811389052";

export const prices = {
  monthly: "£14.99",
  yearly: "£135.99",
  yearlyPerMonth: "£11.33",
  trialDays: 7,
} as const;

export const hero = {
  eyebrow: "GCSE & A-Level · Physics, Maths, Chemistry, Biology",
  h1a: "Handwrite it.",
  h1b: "Plumi marks it.",
  sub: "Exam-style questions for AQA, OCR and Edexcel. Answer with Apple Pencil and see every mark, line by line.",
  note: "Free to download. Pro free for 7 days.",
} as const;

export const pain = {
  eyebrow: "Sound familiar?",
  lines: [
    "You do past papers on your iPad.",
    "Screenshot the question. Paste it into AI.",
    "Then another. And another.",
    "By the end, what were you even weak at?",
  ],
  answer: "Plumi is the clean version of all that.",
} as const;

export const story = {
  eyebrow: "How it marks",
  title: "From your handwriting to your next mark.",
  steps: [
    {
      id: "write",
      kicker: "01 · Write",
      title: "Answer it like the real exam.",
      line: "A question for your board, with the diagram the paper would have. You write underneath, in your own hand.",
      image: "/site/question.webp",
      alt: "An exam-style A-Level Physics question about a light-dependent resistor circuit, with its circuit diagram, in Plumi.",
      fit: "contain" as const,
    },
    {
      id: "marked",
      kicker: "02 · Marked",
      title: "Every line, marked.",
      line: "Ticks and crosses land on your page: method marks, accuracy marks, and the exact line a mark was lost.",
      image: "/site/shot-mark.webp",
      alt: "A handwritten answer marked 3 out of 5 by Plumi, with a red cross on the line where an accuracy mark was lost.",
      fit: "cover" as const,
    },
    {
      id: "why",
      kicker: "03 · Why",
      title: "See exactly why.",
      line: "Open the mark scheme beside your answer. Every point quotes the line of yours it was given for.",
      image: "/site/shot-scheme.webp",
      alt: "Plumi's mark scheme panel open beside a marked answer, showing which marks were awarded and why.",
      fit: "cover" as const,
    },
    {
      id: "up",
      kicker: "04 · Better",
      title: "Fix it. Watch it go up.",
      line: "Correct the slip, re-mark it, and see 5/7 become 7/7.",
      image: "/site/shot-up.webp",
      alt: "A re-marked answer in Plumi going from 5 out of 7 to 7 out of 7.",
      fit: "cover" as const,
    },
  ],
} as const;

export const weak = {
  eyebrow: "Knows your gaps",
  title: "It knows what you’re weak at.",
  line: "Every topic on your specification, tracked as you practise. You never have to guess what to revise next.",
  legend: [
    { label: "Needs attention", tone: "red" },
    { label: "Rusty", tone: "amber" },
    { label: "Developing", tone: "amber" },
    { label: "Strong", tone: "green" },
  ],
} as const;

export const questions = {
  eyebrow: "Written for you",
  title: "Questions on your gaps. Diagrams included.",
  line: "Original exam-style questions for your board, with the figure the real paper would draw.",
  diagrams: [
    { id: "d4", label: "Resonance" },
    { id: "d1", label: "Cyclotron" },
    { id: "d3", label: "I-V characteristics" },
    { id: "d6", label: "Refraction" },
    { id: "d9", label: "Circuits" },
    { id: "d7", label: "Projectiles" },
    { id: "d5", label: "Micrometer" },
    { id: "d8", label: "Orbits" },
    { id: "d10", label: "Kinetic theory" },
  ],
} as const;

export const bento = {
  eyebrow: "And everything around it",
  title: "Everything else you need to revise.",
  tiles: [
    { id: "notes", title: "Notes that become flashcards.", line: "Handwrite it once. Plumi quizzes you on it.", image: "/site/tile-notes.webp", w: 1400, h: 685, alt: "Handwritten astrophysics notes in Plumi with highlighted key terms and a drawn diagram of an elliptical orbit." },
    { id: "streak", title: "Keep your streak.", line: "Study a little every day. A freeze covers a missed one.", image: "/site/tile-streak2.webp", w: 535, h: 585, alt: "Plumi's streak screen showing an 8 day streak and a calendar of days worked." },
    { id: "stats", title: "Every minute counted.", line: "A daily goal, and where your study time actually goes.", image: "/site/tile-stats2.webp", w: 1344, h: 580, alt: "Plumi's study time statistics: 1 hour 44 minutes studied today, with the daily goal reached." },
    { id: "friends", title: "Study with friends.", line: "Add a friend or start a group, and revise side by side.", image: "/site/tile-groups2.webp", w: 1270, h: 590, alt: "Plumi's study groups screen with an Add a friend button and a four member group." },
    { id: "focus", title: "Lock in with Focus.", line: "Pomodoros that can block distracting apps.", image: "/site/pomo-card.webp", w: 1088, h: 942, alt: "Plumi's pomodoro planner set to three 25 minute blocks." },
    { id: "papers", title: "Every past paper, one tap away.", line: "Papers, mark schemes and grade boundaries for your board.", image: "/site/tile-papers.webp", w: 1400, h: 952, alt: "Plumi's past papers screen for OCR Physics, with paper, mark scheme and report links for each paper." },
  ],
} as const;

export const identity = {
  eyebrow: "The habit",
  title: "Become the student who gets the A*.",
  line: "Streaks, study time and a daily goal build the habit. Plumi shows the grade it’s building towards.",
} as const;

export const subjects = {
  title: "Built for your exams.",
  line: "GCSE and A-Level, for the three biggest boards.",
  list: [
    { name: "Physics", detail: "Circuits, forces, waves, fields" },
    { name: "Maths", detail: "Pure, statistics, mechanics" },
    { name: "Chemistry", detail: "Moles, energetics, organic" },
    { name: "Biology", detail: "Cells, genetics, ecology" },
  ],
  boards: ["AQA", "OCR", "Edexcel"],
  // The app's own subject colours.
  tones: { Physics: "#e8892b", Maths: "#2158d4", Chemistry: "#22a35a", Biology: "#0f9e95" } as Record<string, string>,
} as const;

export const pricing = {
  eyebrow: "Pricing",
  title: "Free to start. Pro when you’re ready.",
  free: {
    name: "Free",
    price: "£0",
    period: "forever",
    lead: "The whole notebook, with no limits on writing.",
    items: [
      "Handwriting, folders, PDFs, search and export",
      "10 answers marked a week",
      "5 practice questions a week",
      "12 AI Pen answers and 1 tutor session a week",
    ],
  },
  pro: {
    name: "Pro",
    price: prices.yearlyPerMonth,
    period: "a month, billed yearly",
    billing: `${prices.trialDays} days free, then ${prices.yearly} a year. Or ${prices.monthly} a month.`,
    lead: "Everything unlimited, for the run-up to your exams.",
    items: [
      "Unlimited marking, line by line",
      "Unlimited practice on your weak topics",
      "Unlimited AI Pen and tutoring on the page",
      "A whole paper, sat timed and marked",
    ],
  },
  small: "Subscriptions renew automatically. Cancel any time in Settings, at least 24 hours before renewal.",
} as const;

export const faq = [
  {
    q: "Which exam boards and subjects does Plumi cover?",
    a: "GCSE and A-Level Physics, Maths, Chemistry and Biology, for AQA, OCR and Edexcel. Pick your board and Plumi tracks every topic on that specification.",
  },
  {
    q: "Does it really mark my handwriting?",
    a: "Yes. Write your answer with Apple Pencil, the way you would on paper. Plumi reads your working, marks each line against the mark scheme, and shows which mark was lost and why.",
  },
  {
    q: "Are these real past paper questions?",
    a: "Practice questions and mark schemes are written by Plumi in the style of your board, on the topics you need. The Papers tab links to the boards’ own past papers, mark schemes and grade boundaries. Plumi is not affiliated with any exam board.",
  },
  {
    q: "Is Plumi free?",
    a: `The notebook is free forever. Marking, practice, AI Pen and tutoring come with a free weekly allowance. Pro makes them unlimited: ${prices.trialDays} days free, then ${prices.yearly} a year, or ${prices.monthly} a month.`,
  },
  {
    q: "Is it on iPhone or Android?",
    a: "Not yet. Plumi is made for iPad and Apple Pencil, because exam answers are handwritten. It needs iPadOS 17 or later, and also works with your finger.",
  },
  {
    q: "How is it different from asking ChatGPT?",
    a: "Plumi marks your own handwritten working against a mark scheme, on the page, then remembers what you got wrong and sets your next question from it. No screenshots, no copy and paste, and a record of every topic.",
  },
  {
    q: "Is my work private?",
    a: "Your notebook is yours. Plumi asks for your consent before sending any of your work to be marked or explained.",
  },
] as const;

export const close = {
  title: "Your next mark starts here.",
  line: "Free on the App Store for iPad.",
  qr: "Scan with your iPad camera",
} as const;
