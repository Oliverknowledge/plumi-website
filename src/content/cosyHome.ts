/**
 * The cosy homepage's words (the founder's design, 19 October 2026), in one place so
 * every claim can be checked in one place. Same rules as src/content/home.ts: no em
 * dashes anywhere a student reads, and every sentence true of the released app today.
 * The study room, the study hall, ink, outfits, high fives and the group jar are out
 * (founder, 19 October: "these aren't coming soon now"), so nothing on this page says "soon".
 *
 * Where the design's draft said something the app or the vetted copy (home.ts) does not
 * support, the true version is here instead:
 *
 * - The worked example's stamp read 8/9 on a question worth (3) + (3). The marks shown
 *   are 2 of 3 and 3 of 3, so it reads 5/6. The stem now says where P is and that O is
 *   on the ground, which part (b) needs, and part (b)'s three marks are M1 M1 A1.
 * - The topic map's empty square is "Too early to tell" (TopicState.notEnoughEvidence),
 *   not "Not tried": a topic answered once can still be an empty square.
 * - Plumi asks "Is this what you wrote?" when a misread could cost a mark, not whenever
 *   it is unsure of any word (PageMarkingController.swift).
 * - High fives are not released, so the "love" mood no longer says a friend sent one.
 *   "Starstruck" claimed a topic changed band from one answer, which home.ts warns
 *   against ("One answer isn't enough to call a topic Strong"); it now names the
 *   re-mark after a fix (5 to 7 out of 7), which home.ts vouches for.
 * - The habit line said the room "fills up as your marks improve" as if it were here;
 *   the room was not out then; it is now (19 October).
 * - The study-with-friends line said you "study side by side", which is the unreleased
 *   study hall. Groups, invites by link or code and invite-only are released.
 * - Prices, the trial and the weekly allowances are home.ts's, which are the app's
 *   (PaywallView.swift, Entitlements.swift). The auto-renewal line is restored.
 * - FAQ answers are home.ts's vetted answers in full.
 */
import { faq as vettedFaq, prices } from "@/content/home";

export const cosyHero = {
  eyebrow: "GCSE & A-Level revision · for iPad",
  h1: "The cosy notebook that",
  h1em: "marks your work.",
  lead: "Handwrite your answer with Apple Pencil. Plumi marks it line by line against the question’s own mark scheme, picks what to study tonight, and keeps you company while you do it.",
  note: "Free to download, with 10 answers marked free every week. Needs iPadOS 17 or later.",
  window: "your room · 21:40",
  sceneLabel: "A pixel study room at night. Plumi sits at the desk, writing, while a cat naps on the rug.",
  studying: "Studying projectiles",
  hint: "Tap the floor to walk about.",
  // Physics true to the worked example below (g = 9.8).
  tips: [
    ["Tip:", "tan θ = v", "y", " ÷ v", "x"],
    ["Tip:", "time of flight is when y = 0 again"],
    ["Plumi:", "2 more questions, then you’re done"],
    ["Tip:", "max height is when v", "y", " = 0"],
  ] as readonly (readonly string[])[],
} as const;

export const moods = [
  { id: "happy", label: "Happy", say: "Ready when you are. Fancy 10 minutes on projectiles?" },
  { id: "thinking", label: "Thinking", say: "Hmm. That’s the angle from the vertical, not the horizontal." },
  { id: "starstruck", label: "Starstruck", say: "7 out of 7! That fix got you the last 2 marks." },
  { id: "love", label: "Love", say: "8 days in a row. Your streak is looking lovely." },
  { id: "cool", label: "Cool", say: "Pomodoro on. Distracting apps are shut for 25 minutes." },
  { id: "sleepy", label: "Sleepy", say: "Missed a day? I used your streak freeze. See you tomorrow." },
] as const;

export const meet = {
  eyebrow: "Meet Plumi",
  title: "A little quill who lives in your",
  titleEm: "notebook.",
  lead: "Plumi reads your handwriting, marks it, and remembers every topic you’ve struggled with, so you don’t have to work out what to revise next.",
  traits: [
    { glyph: "✗", tone: "var(--lp-red)", text: "Shows you the exact line that cost you a mark, and why." },
    { glyph: "★", tone: "var(--lp-gold)", text: "Picks tonight’s topic from the marks you’ve lost." },
    { glyph: "✎", tone: "var(--lp-teal)", text: "Writes new exam-style questions on your gaps, diagrams included." },
    { glyph: "❄", tone: "var(--lp-blue-soft)", text: "Saves your streak with a freeze when you miss a day." },
  ],
} as const;

export const marking = {
  eyebrow: "An intelligent notebook",
  title: "Handwrite it.",
  titleEm: "Plumi marks it.",
  lead: "Every question comes with its own mark scheme. The ticks land on your working, line by line, the way an examiner would mark it.",
  pageLabel: "A handwritten projectiles answer marked by Plumi: 5 out of 6, with one angle mark lost.",
  stamp: "5/6",
  steps: [
    { num: "01 · Write", title: "Answer under the question", line: "With Apple Pencil, like on paper. If a misread could cost you a mark, Plumi asks before it marks." },
    { num: "02 · Mark", title: "See the line that cost you", line: "Each mark sits on the line that won or lost it. Open the mark scheme beside your answer." },
    { num: "03 · Fix", title: "Fix the slip, mark it again", line: "Think Plumi got one wrong? Tap \"I disagree\" and it looks again." },
  ],
  mapTitle: "Your topic map fills in as you go",
  mapLine: "Every topic on your spec gets a square. Your marked answers colour it in, so the red squares show where your marks are going.",
  legend: [
    { label: "Too early to tell", fill: "#fff" },
    { label: "Needs attention", fill: "var(--lp-needs)" },
    { label: "Rusty", fill: "var(--lp-rusty)" },
    { label: "Developing", fill: "var(--lp-dev)" },
    { label: "Strong", fill: "var(--lp-strong)" },
  ],
} as const;

export const friends = {
  eyebrow: "Study with friends",
  title: "Revision is better",
  titleEm: "with your friends.",
  lead: "Make a group and invite your mates with a link or code. Only people you invite can join.",
  window: "chem crew’s study hall",
  sceneLabel: "A pixel study hall. Maya and Aisha study at a lamp-lit table, Josh gets a hot chocolate, and Sam naps on the sofa.",
  dialog: "Maya started a 25-min session",
  dialogTip: ["Aisha joined.", "Pull up a chair to study with them."],
  hint: "Tap someone to send a high five.",
  features: [
    { av: "maya", title: "Invite-only groups", soon: false, line: "Add a friend, or share the group’s link or code." },
    { av: "aisha", title: "Pull up a chair", soon: false, line: "Tap a friend who’s studying to start your own timer in their subject." },
    { av: "josh", title: "Fill the jar together", soon: false, line: "Everyone’s study time fills one jar each week." },
    { av: "sam", title: "High fives", soon: false, line: "Cheer a friend on with a tap while they work." },
  ],
} as const;

export const habit = {
  eyebrow: "Make it a habit",
  title: "Small sessions that",
  titleEm: "add up.",
  lead: "A daily goal, a streak to protect, and a room of your own to fill.",
  cards: [
    { id: "streak", title: "Keep your streak", soon: false, line: "Sit a whole A-Level paper with Pro to earn a streak freeze. Miss a day and it’s spent for you." },
    { id: "pomo", title: "Pomodoros that block apps", soon: false, line: "Distracting apps stay shut while you work. An hour open isn’t an hour studied, so only real study counts towards your goal." },
    { id: "room", title: "Earn your room", soon: false, line: "Marked answers earn ink. Spend it on lamps, plants, outfits and a cat called Biscuit." },
  ],
} as const;

export const more = {
  eyebrow: "Also in the notebook",
  title: "Everything for revision,",
  titleEm: "on one page.",
  notes: [
    { title: "Questions on your gaps", line: "Pick the topic that keeps catching you out and Plumi writes a question on it, with the diagram the paper would give you." },
    { title: "Notes into flashcards", line: "Write your notes once. Plumi turns them into flashcards and quizzes you on them." },
    { title: "Past papers, one tap away", line: "Your board’s A-Level past papers, mark schemes and grade boundaries are in the Papers tab." },
    { title: "Your predicted grade", line: "Put your predicted grade next to your target. With Pro, each A-Level paper Plumi marks gets a grade." },
    { title: "Bring your school PDFs", line: "Drop in a worksheet or a GCSE paper and write on it like any other page." },
    { title: "Your work stays yours", line: "Notes and marks live on your iPad. Nothing you write is used to train AI, and there are no ads." },
  ],
} as const;

export const shelf = {
  eyebrow: "Subjects",
  title: "Physics, Maths, Chemistry",
  titleEm: "and Biology.",
  lead: "GCSE and A-Level, in the style of your exam board.",
  books: [
    { name: "Physics", detail: "Circuits, forces, fields", href: "/physics-revision", colour: "#f2c96b", height: 190 },
    { name: "Maths", detail: "Pure, stats, mechanics", href: "/gcse-maths", colour: "#6a9bd0", height: 178 },
    { name: "Chemistry", detail: "Moles, energetics, organic", href: "/chemistry-revision", colour: "#8fd0a0", height: 184 },
    { name: "Biology", detail: "Cells, genetics, ecology", href: "/biology-revision", colour: "#eaa99a", height: 172 },
  ],
  boards: ["AQA", "OCR", "Edexcel"],
} as const;

export const plans = {
  eyebrow: "Pricing",
  title: "Start free.",
  titleEm: "Pro if you need more.",
  free: {
    name: "Free",
    price: "£0",
    period: "to start",
    lead: "Start with the notebook and a weekly allowance of marking.",
    items: ["Handwriting, folders, PDFs, search and export", "10 answers marked a week", "3 practice sessions a week", "12 AI Pen answers a week", "1 AI tutor session a week"],
  },
  pro: {
    tag: `${prices.trialDays} days free`,
    name: "Pro",
    price: prices.yearlyPerMonth,
    period: "a month, billed yearly",
    lead: "For the run-up to mocks, when 10 answers a week runs out by Tuesday.",
    items: ["Unlimited marking and practice questions", "Unlimited AI Pen and AI tutor sessions", "Whole A-Level past papers marked and graded", "App blocking in all your focus sessions"],
    fine: `Billed ${prices.yearly} a year after ${prices.trialDays} days free, or ${prices.monthly} a month with no trial. Cancel any time in Settings. Subscriptions renew automatically unless you cancel at least 24 hours before renewal. Needs an iPad with iPadOS 17 or later.`,
  },
} as const;

/** The design's seven questions, answered with the vetted answers from home.ts. */
const questions = [
  "Isn’t this just ChatGPT?",
  "Can it read my handwriting?",
  "What if I think Plumi got a mark wrong?",
  "Which exam boards and subjects does Plumi cover?",
  "Are these real past paper questions?",
  "Is it on iPhone or Android?",
  "Is my work private?",
];
export const faqEyebrow = "Before you download";
export const faqTitle = "Questions";
export const cosyFaq = questions.map(q => {
  const found = vettedFaq.find(f => f.q === q);
  if (!found) throw new Error(`No vetted answer for "${q}" in src/content/home.ts`);
  return found;
});

export const finale = {
  title: "Try it on the topic you",
  titleEm: "keep losing marks on.",
  line: "Write one answer and see the line that cost you. It’s free on iPad.",
} as const;
