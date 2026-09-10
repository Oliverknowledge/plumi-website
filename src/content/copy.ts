/**
 * Every word the site says, in one file.
 *
 * Copy lives here rather than inside components so it can be rewritten without
 * touching layout, and so the three landing variants can be diffed against each
 * other. Section IDs match the anchors in `nav.ts`.
 *
 * House rules, enforced by review rather than by types:
 *   · British English.
 *   · The word "AI" appears in exactly one place on this site — the FAQ answer
 *     that has to use it. Never in a headline.
 *   · Concrete nouns. "Integration by parts", "three marks", "OCR", "under a
 *     clock". Specificity is the only affordable proof when there are no
 *     testimonials, and there are no testimonials.
 *   · No claim here is made that the product cannot do. See
 *     .context/research/product.md §11 for the do-not-claim list.
 */

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────

export interface HeroCopy {
  headline: string;
  /** Split for typesetting: the second line is emphasised. */
  headlineLines: readonly [string, string];
  subhead: string;
  secondaryCta: string;
  supporting: string;
}

/**
 * The three landing variants. `notebook` is the default; the others exist for
 * paid social and organic traffic respectively, selected by `?v=`.
 *
 * `notebook` won on one asymmetry: Alma is a practice-and-marking app and
 * structurally cannot claim to be where a student's everyday schoolwork lives.
 * That frame turns the free notebook from a cost centre into the moat.
 */
export const heroVariants = {
  notebook: {
    headline: "A notebook that knows what you don't know.",
    headlineLines: ["A notebook that knows", "what you don't know."],
    subhead:
      "Write everything on your iPad like normal. Plumi works out what you can actually do, and what to study next.",
    secondaryCta: "See how it works",
    supporting: "Built for iPad + Apple Pencil · GCSE and A-Level",
  },
  decide: {
    headline: "Stop deciding what to revise.",
    headlineLines: ["Stop deciding", "what to revise."],
    subhead:
      "Write on your iPad like normal. Plumi finds the topics you can't do yet, and starts you there.",
    secondaryCta: "See how it works",
    supporting: "Built for iPad + Apple Pencil · GCSE and A-Level",
  },
  mirror: {
    headline: "Seen it isn't the same as can do it.",
    headlineLines: ["Seen it isn't the same", "as can do it."],
    subhead:
      "Plumi only counts work you've actually been marked on. Notes make a topic “seen” and nothing more.",
    secondaryCta: "See what it counts",
    supporting: "Built for iPad + Apple Pencil · GCSE and A-Level",
  },
} as const satisfies Record<string, HeroCopy>;

export type HeroVariant = keyof typeof heroVariants;

export const HERO_VARIANTS = Object.keys(heroVariants) as readonly HeroVariant[];

export function heroFor(variant: string | undefined): HeroCopy {
  return heroVariants[(variant as HeroVariant) in heroVariants ? (variant as HeroVariant) : "notebook"];
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTIONS
//
// Eight surfaces between the hero and the close. Every one shows something the
// one before it could not.
// ─────────────────────────────────────────────────────────────────────────────

export interface SectionCopy {
  id: string;
  eyebrow: string;
  headline: string;
  subhead: string;
}

export const sections = {
  /** Absorbs "Plumi understands my work" and "Plumi teaches where I'm thinking" —
   *  they are one moment, because understanding is only ever evidenced by the
   *  teaching. Splitting them leaves the first with nothing to show but a claim. */
  thePage: {
    id: "the-page",
    eyebrow: "The page",
    headline: "Circle it. It already knows what you're looking at.",
    subhead:
      "No screenshot, no retyping, no explaining the question. Plumi reads your working and the printed question underneath it.",
  },

  /** The honest mirror, placed second so it lands as insight rather than as an
   *  accusation. The rule is stated rather than the outcome: a rule is
   *  falsifiable, and falsifiable statements read as true. */
  whatCounts: {
    id: "what-counts",
    eyebrow: "What counts",
    headline: "Reading your notes proves nothing.",
    subhead:
      "Notes make a topic “seen” and nothing more. Only marked work moves it. And getting there on your own counts differently from getting there after five hints.",
  },

  /** The credibility keystone. An app that removes its own best feature under a
   *  clock is the opposite of what an AI wrapper would build, which is exactly
   *  why it answers "isn't this just another AI app?" better than any argument. */
  underAClock: {
    id: "under-a-clock",
    eyebrow: "Under a clock",
    headline: "Then it takes it all away.",
    // Precisely worded. Exam Mode switches off Plumi's own AI surfaces; it does
    // not lock the iPad, and there is no Guided Access or screenshot blocking
    // anywhere in the app. Claiming otherwise would be false.
    subhead:
      "Start a timed paper and Exam Mode switches off the AI Pen, the hints, the checks and the marking until you submit. Same as the day itself.",
  },

  /** Where the loop pays off: everything above produces one obvious action, and
   *  the student can overrule it. A study app that removes agency gets deleted. */
  whatNow: {
    id: "what-now",
    eyebrow: "What now",
    headline: "One thing to do. Then the next.",
    subhead:
      "Plumi picks it from your own work. Or choose your own topics and it builds the session around your weakest.",
  },

  /** Converts "it knows things" into "it knows my course", by naming the board. */
  yourCourse: {
    id: "your-course",
    eyebrow: "Your course",
    headline: "Every topic on your spec. Where you actually stand.",
    subhead:
      "Your real specification, from your real exam board, banded by evidence from your own work.",
  },

  /** Placed after belief, never before. A pricing-shaped table on a product you
   *  cannot use yet reads as presumptuous. */
  freeAndPro: {
    id: "free-and-pro",
    eyebrow: "Free & Pro",
    headline: "Free is the notebook. Pro is the part that understands you.",
    subhead:
      "Writing, organising and keeping your work is free. The tutoring and the learner model are what Pro pays for.",
  },

  /** A slim band, deliberately. The emotional design is a layer, not the
   *  product — this is the section most at risk of turning Plumi into Duolingo. */
  theHabit: {
    id: "the-habit",
    eyebrow: "Day to day",
    headline: "Thirty minutes. Then it leaves you alone.",
    subhead: "A daily goal, one clear task, and a bird that falls asleep rather than nags you.",
  },

  faq: {
    id: "faq",
    eyebrow: "Questions",
    headline: "The things people actually ask.",
    subhead: "",
  },

  close: {
    id: "waitlist",
    eyebrow: "",
    headline: "Get it when your course is ready.",
    subhead:
      "Tell us what you're studying. We build the topic tree for each course by hand, so it genuinely changes what we build next.",
  },
} as const satisfies Record<string, SectionCopy>;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DETAIL COPY
// ─────────────────────────────────────────────────────────────────────────────

/** The AI Pen's four actions, worded exactly as the app words them. */
export const penActions = [
  { label: "Explain", detail: "What this means, in the light of what you already wrote" },
  { label: "Hint", detail: "The next step and no more, then the one after that" },
  { label: "Check", detail: "Whether the answer holds, and the method if there is one" },
  { label: "Ask", detail: "Anything you like about what you circled" },
] as const;

/**
 * The interactive demonstration.
 *
 * A student drags a loop round a line of working with their finger and gets a
 * hint beside it. It is the only part of the site they can actually use, which
 * is why it is directly beneath the hero: it turns "join a waitlist for
 * something that doesn't exist" into "keep the thing I just did".
 *
 * Two hints per line, and the second is a different KIND of help, not a
 * rephrasing of the first — which is the app's real behaviour. Its tutor
 * records which teaching approaches have already failed and refuses to reuse
 * them, escalating a nudge into a principle, an analogy, an example, and
 * finally a decomposition.
 *
 * Hints are short because Plumi's margin notes are short. The app's own rule:
 * "Short things. 'unit?', 'why?', '+1', 'check sign', 'try u = x', a formula
 * fragment. Never a paragraph — a paragraph in a margin is not annotation, it
 * is clutter."
 */
export const penDemo = {
  question: "Find ∫ x e^x dx",
  marks: "[6 marks]",
  prompt: "Draw a circle round any line. Use your finger, a Pencil or a mouse.",
  readBack: "Plumi read this line",
  reset: "Start again",
  anotherWay: "Try another way",
  /** Reached the end of the ladder for this line. */
  exhausted: "That's as far as a hint goes. The rest is yours.",
  /** Ask needs a keyboard and a conversation; it is not pretended at here. */
  askOnly: "Ask needs somewhere to type. That one is in the app.",

  /**
   * Three of the AI Pen's four actions answer here, per line.
   *
   * They used to be listed and disabled, which was worse than not listing them:
   * a full-strength label with a full description that does nothing when
   * tapped is a broken promise inside the one part of the product a visitor can
   * actually touch. Ask is the exception and says so, because it needs a
   * composer and a conversation rather than a margin note.
   *
   * Every answer is short because Plumi's margin notes are short. The app's own
   * rule: "Short things. 'unit?', 'why?', '+1', 'check sign', 'try u = x', a
   * formula fragment. Never a paragraph."
   */
  lines: [
    {
      text: "Let u = x, dv = e^x dx",
      explain: { kind: "What this is", note: "differentiate u" },
      check: { kind: "Does it hold?", note: "good choice of u" },
      hints: [
        { kind: "A nudge", note: "which is simpler?" },
        { kind: "The principle", note: "d/dx of x is 1" },
      ],
    },
    {
      text: "∫ x e^x dx = x e^x − ∫ e^x dx",
      explain: { kind: "What this is", note: "this is uv − ∫v du" },
      check: { kind: "Does it hold?", note: "parts done right" },
      hints: [
        { kind: "A nudge", note: "do the second ∫" },
        { kind: "The principle", note: "∫ e^x dx = e^x" },
      ],
    },
    {
      text: "= x e^x + e^x + c",
      explain: { kind: "What this is", note: "the final answer" },
      check: { kind: "Does it hold?", note: "sign is wrong" },
      hints: [
        { kind: "A nudge", note: "check the sign" },
        { kind: "The principle", note: "minus, not plus" },
      ],
    },
  ],
} as const;

/**
 * Three pieces of work, and what each did to the same topic.
 *
 * This is the app's real rule, not a simplification. Note-taking evidence is
 * weighted 0.0 and can lift a topic from "Not started" to "Seen" and no
 * further; a right answer reached down the tutor's hint ladder is discounted
 * toward the middle, because "the ladder already knows how much was given
 * away".
 *
 * Band names are the `MasteryBand.title` set, which is what the shipping
 * Progress screen shows.
 */
export const evidenceCases = [
  {
    work: "You wrote notes on it",
    band: "Seen",
    tone: "unseen",
    note: "Nothing moves. Notes are coverage, not proof.",
  },
  {
    work: "You got there, after the tutor talked you through it",
    band: "Developing",
    tone: "developing",
    note: "Counts. For less. Work reached from a hint is a weaker claim.",
  },
  {
    work: "You got it right on your own",
    band: "Secure",
    tone: "secure",
    note: "This is the one that moves it properly.",
  },
] as const;

/**
 * The top band is gated on a success under a clock — and the bar is half marks,
 * not full, "because a six-mark question answered for four marks under a clock
 * is far better evidence than a perfect untimed practice answer."
 * The sentence below is the app's own, with its dash rewritten as a colon.
 */
export const masteredGate = {
  band: "Mastered",
  note: "To go further: Plumi needs to see this under exam conditions.",
} as const;

/**
 * The compounding story, as an accumulation rather than a claim.
 *
 * Weeks are illustrative of the mechanism, not a promise about a timescale —
 * the labels say what KIND of evidence arrived, and the bands follow from the
 * rules stated directly above them in the same section. Nothing here asserts an
 * outcome ("students improve by X"), which is both unprovable and the exact
 * claim structure that gets education advertising into trouble.
 */
export const compounding = {
  lead: "Nothing here is a survey you fill in. It is the work you were doing anyway.",
  steps: [
    { when: "Week one", detail: "Notes, and one marked question." },
    { when: "Week two", detail: "Two more marked, one with the tutor." },
    { when: "Week four", detail: "A timed paper. Now some topics are proven." },
    { when: "Week six", detail: "Enough to be specific about where you stand." },
  ],
  /** Real, and a genuine differentiator: there is no forgetting curve in the app. */
  closing:
    "And it never quietly takes it back. There is no decay curve in Plumi: if it has been a while, it says so, rather than moving your topic down while you weren't looking.",
} as const;

/**
 * The recommendation, and the session a student can build instead.
 *
 * Wording is careful. Plumi's session brief steers the model toward the topics
 * you are weakest at; there is no question bank and no measured-difficulty
 * filter, so the site says the session "follows how you're doing" rather than
 * claiming a difficulty ladder it does not implement.
 */
export const whatNow = {
  homeLabel: "What should I do next?",
  recommendation: {
    duration: "30 min",
    kind: "Fix one thing",
    title: "Integration by parts",
    reason: "You have lost six marks here across two pieces of work, all to the same slip.",
    steps: [
      { label: "Read back where the marks went", detail: "Six marks, one cause.", minutes: "6 min" },
      { label: "The same question type, unaided", detail: "No hints this time.", minutes: "24 min" },
    ],
    cta: "Start this",
  },
  /** The override. A study app that removes agency gets deleted. */
  overrideLabel: "Or choose your own",
  picker: {
    subject: "Calculus",
    duration: "30 min",
    mode: "Adaptive",
    start: "Start",
    topics: [
      { name: "Integration by parts", band: "weak", chosen: true },
      { name: "Integration by substitution", band: "secure", chosen: true },
      { name: "Differential equations", band: "secure", chosen: true },
    ],
  },
  composition: {
    label: "How the session is weighted",
    before: [
      { name: "Integration by parts", share: 34 },
      { name: "Integration by substitution", share: 33 },
      { name: "Differential equations", share: 33 },
    ],
    after: [
      { name: "Integration by parts", share: 62 },
      { name: "Integration by substitution", share: 20 },
      { name: "Differential equations", share: 18 },
    ],
    note: "You picked three topics evenly. Plumi weights them by what your work says, and keeps adjusting while you go.",
  },
  /** The loop closing. Three independent successes retire a recommendation. */
  retire: {
    title: "Three clean runs later",
    detail:
      "The recommendation retires itself and a different one takes its place. That is the whole loop, and it is the only reason any of this compounds.",
  },
} as const;

export const examMode = {
  /** True, and a humane detail: a student mid-sentence at the bell finishes it. */
  footnote: "Overrun is recorded, not enforced. A student mid-sentence at the bell finishes the sentence.",
  /** Time remaining on an OCR H556/01 paper, which is 2h15. */
  clock: "1:47:12",
} as const;

/**
 * The habit band.
 *
 * Three mascot states and a daily goal — nothing more. Two things are
 * deliberately absent:
 *
 *   · Streaks. The streak engine exists, but it could not be confirmed that
 *     marking a paper or sitting an exam turns the day, so the site does not
 *     claim it. An unverified number on a marketing page is a number that gets
 *     found out.
 *   · App blocking. Focus Mode's shield is written, but the Screen Time
 *     entitlement has not been granted by Apple, so on a shipping build today
 *     Focus is a study timer. It is described here as a study timer.
 */
export const habit = {
  poses: [
    { pose: "sleeping", caption: "0 of 30 minutes", detail: "Nothing yet today." },
    { pose: "encouraging", caption: "18 of 30 minutes", detail: "Twelve to go." },
    { pose: "celebrating", caption: "30 of 30 minutes", detail: "Goal met." },
  ],
  focusLine: "Focus Mode protects the time and tells you honestly what you actually did with it.",
  reassurance: "Nothing here punishes you for missing a day.",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// WAITLIST
// ─────────────────────────────────────────────────────────────────────────────

export const waitlist = {
  emailLabel: "Your email",
  emailPlaceholder: "you@school.ac.uk",
  studyingLabel: "What are you studying?",
  studyingHelper: "Pick the closest. You can change it later.",
  subjects: ["Maths", "Physics", "Chemistry", "Biology", "Something else"],
  boards: ["AQA", "OCR", "Edexcel", "WJEC", "Not sure yet"],
  /** Labels for the two pill groups. Both groups are optional, and say so. */
  subjectLabel: "Subject",
  boardLabel: "Exam board",
  optionalHint: "Optional",
  /**
   * The honeypot's visible label. Never seen and never read aloud — it exists
   * only so the field looks like a real one to a bot parsing the markup.
   */
  honeypotLabel: "School",
  submitIdle: "Join the waitlist",
  submitPending: "One second…",
  /** Kills the single biggest unstated objection — "am I going to get spammed?" */
  reassurance: "Two emails. One when your course is ready, one when we launch. That's it.",
  privacy: "Your email, and nothing else. No sharing, no ads, no reselling.",
  /** Shown beside the errors a visitor cannot retry past. */
  emailUsInstead: "Email us instead and we'll add you by hand →",
  successTitle: "You're on the list.",
  successBody: "Two emails. One when your course is ready, one when we launch. Nothing else, ever.",
  /** Shown when the student skipped the subject/board step. */
  successBodyGeneric:
    "We'll start with Maths, Physics, Chemistry and Biology. Yours is on the list to build.",
  /**
   * Shown instead of `successBodyGeneric` when they told us what they study.
   * `{course}` is replaced with what they actually picked, joined by
   * `courseSeparator` — never with a level or a board we were not given, since
   * inventing "A-Level" for a GCSE student is exactly the kind of small lie
   * this page is trying not to tell.
   */
  successBodyCourse:
    "{course}. We build the topic tree for each course by hand, from the board's own specification. So a course being asked for genuinely changes the order we build them in.",
  courseSeparator: " · ",
  errors: {
    empty: "Pop your email in first.",
    invalid: "That doesn't look like an email address. Check it for us?",
    network: "That didn't send. Probably us, not you. Try again?",
    server: "Something broke on our end. Give it a minute and try again.",
    rateLimited: "That's plenty of tries. Give it a minute.",
    /** Never fake a success. If persistence is down, say so. */
    unconfigured:
      "We can't take sign-ups right this second. Try again shortly. We haven't lost anything you typed.",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────────────────────

export interface FaqItem {
  question: string;
  answer: string;
}

export const faq: readonly FaqItem[] = [
  {
    question: "Is this just ChatGPT in a notebook?",
    answer:
      "No, and the difference is easy to check. ChatGPT starts from nothing every time. You photograph the question, retype the context and explain what you've tried. Plumi is already looking at the page: it reads your handwriting and the printed question underneath it, so you circle the line and that's the whole ask. It also won't hand you the answer. Get it wrong four times and you get four genuinely different explanations: the principle, an analogy, a worked example, the problem broken down. Each one starts with what you got right. And it remembers: this week's work changes what it suggests next week.",
  },
  {
    question: "Do I need an iPad?",
    answer:
      "Yes, and an Apple Pencil. Plumi is built around handwriting. The whole point is that you write normally and it reads it, so there isn't a sensible version of this on a laptop or a phone. We know that rules some people out, and we'd rather say so plainly than take your email under false pretences. There's no iPhone, Android or web version planned for launch.",
  },
  {
    question: "When does it launch?",
    answer:
      "We haven't set a public date, and we're not going to invent one. What's left is the work of getting each course properly finished, because we hand-build the topic tree for every specification rather than generating them. That's why we ask which course you're taking when you join. We're releasing course by course, and yours moving up the list is a genuine consequence of people asking for it.",
  },
  {
    question: "Is it free?",
    answer:
      "The notebook is free: writing, pens, highlighter, lasso, notebooks and folders, PDFs, paper styles, search, and keeping all of your work. We think a good digital notebook shouldn't need a subscription. The parts that understand you (the tutor, the marking, the topic map, the adaptive sessions) will be a paid plan called Plumi Pro. We haven't set that price yet. When we do, everyone on the waitlist hears it from us before it goes public. There's no price on this page because there isn't one to put here.",
  },
  {
    question: "Does it work for my exam board?",
    answer:
      "It depends which one, and we'd rather be specific than reassuring. Plumi maps your progress onto your actual specification, with real topic codes from the real board. That means each one is built by hand. We're starting with Maths, Physics, Chemistry and Biology across AQA, OCR and Edexcel, and the boards aren't all at the same stage. Tell us your board and subject when you join and we'll tell you honestly where yours is.",
  },
  {
    question: "What happens to my work and my data?",
    answer:
      "Your notes are yours. We use your work to build your own learner model: which topics you've been marked on, and what you got right unaided. That's what powers the recommendations. It isn't used to train models for anyone else, it isn't sold, and it isn't shared with your school unless you decide to share it. On the waitlist specifically we store your email and the course you told us, and nothing else; we don't put email addresses into our analytics. If you'd like off the list before launch, reply to any email and you're off.",
  },
] as const;
