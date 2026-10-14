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
  eyebrow: "GCSE & A-Level revision app for iPad",
  h1a: "Handwrite it.",
  h1b: "Plumi marks it.",
  sub: "Exam-style questions for AQA, OCR and Edexcel. Write your answer with Apple Pencil and see which marks you got, and which you lost.",
  note: "Free to download. 7 days of Pro free on the yearly plan.",
  zoom: { image: "/site/zoom-mark.webp", w: 1130, h: 275, alt: "Close up of the handwritten working: M1 ticked, M2 crossed, and the final value 1.73 crossed for A1.", caption: "Method mark got. Accuracy mark lost on the final value." },
} as const;

export const pain = {
  eyebrow: "Sound familiar?",
  lines: [
    "You do past papers on your iPad.",
    "Screenshot the question. Paste it into AI.",
    "It never tells you which mark you lost.",
    "And by the end, what were you even weak at?",
  ],
  answer: "Plumi marks the answer you wrote, against the mark scheme, and remembers every mark you drop.",
  contrast: [
    { title: "Your handwriting.", line: "No screenshots. No retyping." },
    { title: "Marked like the exam.", line: "Method, accuracy and explanation marks, line by line." },
    { title: "Never forgotten.", line: "Every dropped mark sets your next question." },
  ],
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
      zoom: { image: "/site/zoom-write.webp", w: 1170, h: 605 },
    },
    {
      id: "marked",
      kicker: "02 · Marked",
      title: "Every line, marked.",
      line: "Ticks and crosses land on your page: method marks, accuracy marks, and the exact line a mark was lost.",
      image: "/site/shot-mark.webp",
      alt: "A handwritten answer marked 3 out of 5 by Plumi, with a red cross on the line where an accuracy mark was lost.",
      fit: "cover" as const,
      zoom: { image: "/site/zoom-mark.webp", w: 1130, h: 275 },
    },
    {
      id: "why",
      kicker: "03 · Why",
      title: "See exactly why.",
      line: "Open the mark scheme beside your answer and see what each mark needed.",
      image: "/site/shot-scheme.webp",
      alt: "Plumi's mark scheme panel open beside a marked answer, showing which marks were awarded and why.",
      fit: "cover" as const,
      zoom: { image: "/site/zoom-why.webp", w: 960, h: 500 },
    },
    {
      id: "up",
      kicker: "04 · Better",
      title: "Fix it. Watch it go up.",
      line: "Correct the slip on any question, re-mark it, and watch the score go up.",
      image: "/site/shot-up.webp",
      alt: "A re-marked answer in Plumi going from 5 out of 7 to 7 out of 7.",
      fit: "cover" as const,
      zoom: { image: "/site/zoom-up.webp", w: 587, h: 260 },
    },
  ],
  cta: "10 answers marked free, every week.",
} as const;

export const weak = {
  eyebrow: "Knows your gaps",
  title: "It knows what you’re weak at.",
  line: "Every topic on your AQA, OCR or Edexcel specification, tracked as you practise. You never have to guess what to revise next.",
  legend: [
    { label: "Needs attention", tone: "red" },
    { label: "Rusty", tone: "orange" },
    { label: "Developing", tone: "amber" },
    { label: "Strong", tone: "green" },
    { label: "Too early to tell", tone: "grey" },
  ],
} as const;

export const questions = {
  eyebrow: "Written for you",
  title: "Questions on your gaps. Diagrams included.",
  line: "Original exam-style questions for your board, with the figure the real paper would draw.",
  diagrams: [
    { id: "d4", label: "Resonance", alt: "Resonance curves of amplitude against driving frequency, with a sharp peak at 2 Hz." },
    { id: "d1", label: "Cyclotron", alt: "A cyclotron: two dees in a magnetic field with a spiral particle path from the source S." },
    { id: "d3", label: "I-V characteristics", alt: "Current against potential difference for four components, labelled A to D." },
    { id: "d6", label: "Refraction", alt: "A ray of light refracting through a glass block, with the angles of incidence and refraction marked." },
    { id: "d9", label: "Circuits", alt: "A circuit with a capacitor, a switch and four resistors." },
    { id: "d7", label: "Projectiles", alt: "A projectile launched at 35 degrees from the top of a cliff." },
    { id: "d5", label: "Micrometer", alt: "A micrometer screw gauge with the anvil, spindle, sleeve and thimble labelled." },
    { id: "d8", label: "Orbits", alt: "Circular orbits around a planet, with points P, Q, U and V and a 250 km gap marked." },
    { id: "d10", label: "Kinetic theory", alt: "Gas particles moving at random in a cylinder sealed by a piston." },
  ],
} as const;

export const bento = {
  eyebrow: "And the rest of revision",
  title: "Everything around the marking.",
  tiles: [
    { id: "papers", title: "Every past paper, one tap away.", line: "Papers, mark schemes and grade boundaries for your board.", image: "/site/tile-papers2.webp", w: 1442, h: 550, alt: "Plumi's past papers for OCR A-Level Physics, June 2023: three papers, each with the paper, mark scheme and examiner report." },
    { id: "streak", title: "Keep your streak.", line: "Study a little every day. A freeze covers a missed one.", image: "/site/tile-streak2.webp", w: 535, h: 585, alt: "Plumi's streak screen showing an 8 day streak and a calendar of days worked." },
    { id: "notes", title: "Notes that become flashcards.", line: "Handwrite it once. Plumi quizzes you on it.", image: "/site/tile-notes.webp", w: 1400, h: 685, alt: "Handwritten astrophysics notes in Plumi with highlighted key terms and a drawn diagram of an elliptical orbit." },
    { id: "focus", title: "Lock in with Focus.", line: "Pomodoros that can block distracting apps.", image: "/site/pomo-card.webp", w: 1088, h: 942, alt: "Plumi's pomodoro planner set to three 25 minute blocks." },
    { id: "stats", title: "Every minute counted.", line: "A daily goal, and where your study time actually goes.", image: "/site/tile-stats2.webp", w: 1344, h: 580, alt: "Plumi's study time statistics: 1 hour 44 minutes studied today, with the daily goal reached." },
    { id: "friends", title: "Study with friends.", line: "Add a friend or start a group, and revise side by side.", image: "/site/tile-groups2.webp", w: 1270, h: 590, alt: "Plumi's study groups screen with an Add a friend button and a four member group." },
  ],
} as const;

export const identity = {
  eyebrow: "The habit",
  title: "Make revision a habit.",
  line: "Streaks, study time and a daily goal keep you coming back. Set the grade you’re aiming for and see where you stand.",
  // The app's order and authorship (SubjectStanding.swift): Predicted is the school's,
  // Current comes only from board papers Plumi has marked, Goal is the student's.
  grades: [
    { label: "Predicted", value: "A", tone: "" },
    { label: "Current", value: "B", tone: "is-muted" },
    { label: "Goal", value: "A*", tone: "is-goal" },
  ],
  caption: "An example. Predicted is your school’s, Current comes from board papers Plumi has marked, Goal is yours.",
} as const;

export const subjects = {
  eyebrow: "GCSE and A-Level revision",
  title: "Built for your exams.",
  line: "Physics, Maths, Chemistry and Biology, for AQA, OCR and Edexcel.",
  list: [
    { name: "Physics", detail: "Circuits, forces, waves, fields" },
    { name: "Maths", detail: "Pure, statistics, mechanics", links: [{ label: "GCSE Maths", href: "/gcse-maths" }, { label: "A-Level Maths", href: "/ai-tutor-for-a-level-maths" }] },
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
    billing: `${prices.trialDays} days free, then ${prices.yearly} a year.`,
    billing2: `Or ${prices.monthly} a month, no trial.`,
    lead: "Everything unlimited, for the run-up to your exams.",
    items: [
      "Unlimited marking, line by line",
      "Unlimited practice on your weak topics",
      "Unlimited AI Pen and tutoring on the page",
      "Block distracting apps in every Focus session",
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
    a: "Plumi marks your own handwritten working against a mark scheme, on the page, and shows the exact mark you lost. Then it remembers what you got wrong and sets your next question from it. No screenshots, no copy and paste, and a record of every topic.",
  },
  {
    q: "Is my work private?",
    a: "Your notebook is yours. Plumi asks for your consent before sending any of your work to be marked or explained.",
  },
] as const;

export const faqTitle = "Plumi questions, answered.";

export const close = {
  title: "Your next mark is one answer away.",
  line: "Free on the App Store for iPad.",
  qr: "Scan with your iPad camera",
} as const;
