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
 * - FAQ answers are home.ts's vetted answers in full, except the ones in `homeAnswers`
 *   below, which say why they differ.
 *
 * No prices, plans, trials or weekly allowances (founder, 23 October 2026: "students are
 * allergic to that before value is sufficiently presented"). The homepage says the app is
 * free to download and the website's practice is free; the plans are on the App Store, the
 * parents page and the subject pages. So nothing here says "with Pro" either: a line that
 * only holds on Pro is rewritten to what holds for everyone, or left out.
 *
 * The page leads with the free practice on this website (the question bank and past
 * papers), because most visitors arrive from a short video on a phone, where the app can't
 * be installed but the practice works. The iPad download stays the first button.
 */
import { faq as vettedFaq } from "@/content/home";

export const cosyHero = {
  eyebrow: "GCSE & A-Level revision · free on iPad",
  h1: "The cosy notebook that",
  h1em: "marks your work.",
  lead: "Handwrite your answer with Apple Pencil. Plumi marks it line by line against the mark scheme and picks what to revise tonight.",
  note: "Free on the App Store. Needs iPadOS 17 or later.",
  freeLabel: "Free on this website, no sign-up:",
  window: "the grand library · 21:40",
  sceneLabel: "A pixel library at night, with a gallery upstairs. Students study at long tables, in glass pods and by the fire. You come in at the entrance; tap the floor to walk, a free seat to sit, or anyone to see what they're studying.",
  hint: "Tap to walk. Tap anyone to see what they’re studying.",
} as const;

/**
 * The hero library's words (CafeHero in LandingClient.tsx). The labels over people's heads are
 * in cafeScene.ts and true to the app: focus ink is 1 a minute and 10 a finished chapter
 * (FocusInk in DeskPlan.swift), and the subjects are the four the app marks.
 */
export const cafe = {
  idle: "Pull up a chair",
  studying: "Studying",
  look: "Your look",
  prev: "Previous look",
  next: "Next look",
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
  sceneLabel: "A pixel library. Maya and Aisha study at a lamp-lit table, Sam has the next one, Josh reads by the fire, and the cat sleeps on the rug.",
  /**
   * The window's chip and jar, drawn after the app's (the new flow's session chip and the group's jar):
   * your 25-minute session counting down, and the week's study time filling the group's jar.
   * The friends' times are an illustration, as their names are; yours counts up while you watch.
   */
  session: { subject: "Chemistry", minutes: 25, left: 18 * 60 + 42 },
  jar: {
    title: "The jar",
    goal: 30 * 60,
    week: 10 * 60 + 9,
    fills: "fills Sunday",
    you: "You",
    members: [
      { name: "Maya", look: 1, today: 72 },
      { name: "Aisha", look: 10, today: 48 },
      { name: "Josh", look: 3, today: 125 },
      { name: "Sam", look: 6, today: 31 },
    ],
  },
  hint: "Tap someone to send a high five.",
  // Each friend's look in the library's cast (FRIENDS in cafeScene.ts): Maya, Aisha, Josh, Sam.
  features: [
    { look: 1, title: "Invite-only groups", soon: false, line: "Add a friend, or share the group’s link or code." },
    { look: 10, title: "Pull up a chair", soon: false, line: "Tap a friend who’s studying to start your own timer in their subject." },
    { look: 3, title: "Fill the jar together", soon: false, line: "Everyone’s study time fills one jar each week." },
    { look: 6, title: "High fives", soon: false, line: "Cheer a friend on with a tap while they work." },
  ],
} as const;

export const habit = {
  eyebrow: "Make it a habit",
  title: "Small sessions that",
  titleEm: "add up.",
  lead: "A daily goal, a streak to protect, and a room of your own to fill.",
  cards: [
    { id: "streak", title: "Keep your streak", soon: false, line: "Study a little every day. Miss one and a streak freeze can keep it alive." },
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
    { title: "Your predicted grade", line: "Put your predicted grade next to your target, so you always know the gap you’re closing." },
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

/**
 * The free practice on the website itself: the question bank (/question-bank) and the past
 * paper library (/past-papers). Both are free and need no account; the question count is
 * read from the bank's data in CosyHome, so it stays true as subjects are added. It comes
 * straight after the hero (23 October 2026), and each card's chips go straight to a subject,
 * so a student from a video is one tap from their own paper.
 *
 * `discord` is the community's daily question (1 App/discord-bot: a real past-paper question
 * from the bank every morning, marked yourself, with streaks and a Sunday leaderboard).
 */
export const practice = {
  eyebrow: "Free exam practice",
  title: "Real exam questions,",
  titleEm: "sorted by topic.",
  lead: "Free on this website, with no sign-up. Works on your phone, laptop or iPad.",
  bank: {
    name: "Question bank",
    hero: "real exam questions by topic",
    line: "Pick a topic and get every exam question on it, each with its mark scheme and the examiner’s report beside it. Build a set and download it as a PDF.",
    cta: "Open the question bank",
    // The card names the boards; every subject is listed once, at the foot of the page, so
    // the card stays short as subjects are added (founder, 25 October 2026).
    boardsLabel: "Pick your exam board",
    allSubjects: "See every subject",
  },
  /** The question bank's subjects at the foot of the page, one column per board. */
  bankIndex: {
    eyebrow: "Every subject in the question bank",
    title: "Find your",
    titleEm: "exam board.",
  },
  papers: {
    name: "Past papers",
    hero: "GCSE & A-Level, every board",
    line: "Every past paper and mark scheme for GCSE and A-Level Maths, Further Maths, Biology, Chemistry and Physics, sorted by board and year.",
    // The libraries students ask for most, straight to the subject's page.
    links: [
      ["GCSE Maths", "/past-papers/gcse-maths"],
      ["GCSE Physics", "/past-papers/gcse-physics"],
      ["GCSE Chemistry", "/past-papers/gcse-chemistry"],
      ["GCSE Biology", "/past-papers/gcse-biology"],
      ["A-Level Maths", "/past-papers/a-level-maths"],
      ["A-Level Physics", "/past-papers/a-level-physics"],
      ["A-Level Chemistry", "/past-papers/a-level-chemistry"],
      ["A-Level Biology", "/past-papers/a-level-biology"],
    ],
    cta: "Browse past papers",
  },
  discord: {
    title: "A past-paper question every morning",
    line: "Our Discord posts a real exam question each day. Mark it yourself, keep your streak, and see the examiner’s comments the next morning.",
  },
  bridge: "Doing them on paper? On iPad, Plumi marks your handwriting for you.",
  bridgeLink: "See how it marks",
} as const;

/**
 * Answers the homepage gives in its own words. home.ts's answer to "a mark wrong" ends on
 * the free plan's allowance, and its "real past paper questions" answer predates the
 * question bank, so "No" would now contradict the section above it. The iPad question is
 * new: it is the first thing a student on a phone wants to know.
 */
const homeAnswers: Record<string, string> = {
  "Do I need an iPad for the question bank and past papers?":
    "No. The question bank and past papers on this website are free, need no account, and work on any phone, laptop or tablet. The Plumi app, which marks your handwritten answers, is for iPad.",
  "What if I think Plumi got a mark wrong?":
    "Tap \"I disagree\" on any mark you didn’t get in full. You’ll see the scheme’s line for that mark, the line you wrote and Plumi’s reason. Tap \"Check again\" and Plumi looks again, then either corrects the mark or keeps it and tells you why. If you’re still sure, you can give yourself the mark, and it’s labelled self-marked, never counted as Plumi’s.",
  "Are these real past paper questions?":
    "On this website, yes. The question bank is cut from AQA’s and Edexcel’s own published papers, each part with its mark scheme, and the past paper library has the whole papers. In the app, Plumi also writes new questions in your board’s style, each with its own mark scheme, and the Papers tab links to your board’s A‑Level past papers and grade boundaries. Plumi isn’t affiliated with any exam board.",
};

/** The design's questions, answered with the vetted answers from home.ts (or `homeAnswers`). */
const questions = [
  "Do I need an iPad for the question bank and past papers?",
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
  if (homeAnswers[q]) return { q, a: homeAnswers[q] };
  const found = vettedFaq.find(f => f.q === q);
  if (!found) throw new Error(`No vetted answer for "${q}" in src/content/home.ts`);
  return found;
});

export const finale = {
  title: "Try it on the topic you",
  titleEm: "keep losing marks on.",
  line: "Write one answer and see the line that cost you. It’s free on iPad.",
} as const;
