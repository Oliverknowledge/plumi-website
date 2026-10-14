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
    headline: "A notebook that knows what you don’t know.",
    headlineLines: ["A notebook that knows", "what you don’t know."],
    subhead:
      "Write everything on your iPad like normal. Plumi works out what you can actually do, and what to study next.",
    secondaryCta: "See how it works",
    supporting: "Built for iPad + Apple Pencil · STEM for A-Level and GCSE",
  },
  decide: {
    headline: "Stop deciding what to revise.",
    headlineLines: ["Stop deciding", "what to revise."],
    subhead:
      "Write on your iPad like normal. Plumi finds the topics you can’t do yet, and starts you there.",
    secondaryCta: "See how it works",
    supporting: "Built for iPad + Apple Pencil · STEM for A-Level and GCSE",
  },
  mirror: {
    headline: "Seen it isn’t the same as can do it.",
    headlineLines: ["Seen it isn’t the same", "as can do it."],
    subhead:
      "Plumi only counts work you’ve actually been marked on. Notes make a topic “seen” and nothing more.",
    secondaryCta: "See what it counts",
    supporting: "Built for iPad + Apple Pencil · STEM for A-Level and GCSE",
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
    headline: "Circle it. It already knows what you’re looking at.",
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
    subhead: "A daily goal, one clear task, and a quill that rests rather than nags you.",
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
      "Tell us what you’re studying. We build the topic tree for each course by hand, so it genuinely changes what we build next.",
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
  exhausted: "That’s as far as a hint goes. The rest is yours.",
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
 * The fourth rung, and the one that makes the other three mean something.
 *
 * `LearnerModel.band(estimate:uncertainty:evidenceCount:examSuccesses:)` will not
 * return `.mastered` unless `examSuccesses >= 1`, and `EvidenceKind.weight` puts
 * `.examQuestion` at 1.0 with the comment "timed, unaided — the strongest signal
 * there is". Ordinary practice can carry a topic all the way to `.secure` and no
 * further, which is exactly what the note below says and no more.
 */
export const examCase = {
  work: "You did it under a clock",
  band: masteredGate.band,
  tone: "mastered",
  note: "The strongest evidence there is. Untimed practice cannot reach this band.",
} as const;

/**
 * The bars beside each rung: how far this kind of work is allowed to move an
 * estimate, as a shape rather than as a figure.
 *
 * The real weights are `EvidenceKind.weight` — notes 0.0, a hinted answer 0.15,
 * marked work 0.8, a timed question 1.0. They are drawn rather than printed
 * because printing them would put a number on a page whose own rule is that
 * Plumi publishes no confidence figures, and because the ordering is the point.
 */
export const evidenceWeight = { unseen: 0, developing: 1, secure: 3, mastered: 4 } as const;

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
    "And it never quietly takes it back. There is no decay curve in Plumi: if it has been a while, it says so, rather than moving your topic down while you weren’t looking.",
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
  /**
   * The weighting, as a diagram rather than as a screen.
   *
   * Two honesty constraints shape this, both from the audit of the app:
   *
   *   · The adaptation is real. The session brief steers toward the topics your
   *     marked work says you are weakest at, and the session engine keeps
   *     adjusting as you go. What the app does NOT do is render a bar chart of
   *     it, so the copy describes the behaviour and never implies a surface.
   *   · The percentages are gone. Plumi publishes no confidence numbers
   *     anywhere, on purpose, and "62%" is a precision nobody has earned. The
   *     bars carry relative weight, which is the whole point, without inventing
   *     a figure to two significant figures.
   */
  composition: {
    label: "What the session gets built from",
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
    note: "You picked three topics evenly. The session is not even. It is weighted toward whichever of them your marked work says you are weakest at, and it keeps adjusting as you go.",
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
  reassurance: "Two emails. One when your course is ready, one when we launch. That’s it.",
  privacy: "Your email, and nothing else. No sharing, no ads, no reselling.",
  /** Shown beside the errors a visitor cannot retry past. */
  emailUsInstead: "Email us instead and we’ll add you by hand →",
  successTitle: "You’re on the list.",
  successBody: "Two emails. One when your course is ready, one when we launch. Nothing else, ever.",
  /** Shown when the student skipped the subject/board step. */
  successBodyGeneric:
    "We’ll start with Maths, Physics, Chemistry and Biology. Yours is on the list to build.",
  /**
   * Shown instead of `successBodyGeneric` when they told us what they study.
   * `{course}` is replaced with what they actually picked, joined by
   * `courseSeparator` — never with a level or a board we were not given, since
   * inventing "A-Level" for a GCSE student is exactly the kind of small lie
   * this page is trying not to tell.
   */
  successBodyCourse:
    "{course}. We build the topic tree for each course by hand, from the board’s own specification. So a course being asked for genuinely changes the order we build them in.",
  courseSeparator: " · ",
  errors: {
    empty: "Pop your email in first.",
    invalid: "That doesn’t look like an email address. Check it for us?",
    network: "That didn’t send. Probably us, not you. Try again?",
    server: "Something broke on our end. Give it a minute and try again.",
    rateLimited: "That’s plenty of tries. Give it a minute.",
    /** Never fake a success. If persistence is down, say so. */
    unconfigured:
      "We can’t take sign-ups right this second. Try again shortly. We haven’t lost anything you typed.",
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
      "No, and the difference is easy to check. ChatGPT starts from nothing every time. You photograph the question, retype the context and explain what you’ve tried. Plumi is already looking at the page: it reads your handwriting and the printed question underneath it, so you circle the line and that’s the whole ask. It also won’t hand you the answer. Get it wrong four times and you get four genuinely different explanations: the principle, an analogy, a worked example, the problem broken down. Each one starts with what you got right. And it remembers: this week’s work changes what it suggests next week.",
  },
  {
    /**
     * The objection the trust chapter answers visually. Written to be checkable
     * rather than reassuring, and it says the part that is not finished — the
     * deterministic checker runs in shadow mode (`PhysicsVerifierMode.off` is the
     * shipped default) and is described as exactly that.
     */
    question: "Can I trust the marking?",
    answer:
      "Trust it the way you’d trust a good teacher rather than a calculator. Plumi shows you the line it read before it marks it, so a misreading is yours to correct rather than a silent cause of a wrong mark. It works out which step earned which mark and quotes your own words back as the evidence, and the rules, method marks, follow-through, dependencies, are worked out in code rather than asked of a model. It will tell you when a mark could go either way instead of pretending, and it publishes no confidence percentages anywhere, because a number to two significant figures is a precision nobody has earned. If you disagree, challenge it: it re-reads the work from scratch, and a re-mark can never cost you a mark you already had.",
  },
  {
    question: "Is using Plumi cheating?",
    answer:
      "No, and the distinction matters. Plumi marks work you wrote yourself; it doesn’t write it for you. Exam boards care about work submitted for assessment being your own, and a marker reading your handwriting and telling you which marks you lost is the opposite of that problem. Exam Mode goes further and switches Plumi’s own intelligence off entirely while you sit a timed paper. If your school has a policy on AI, we’d rather you showed them this page than hid the app.",
  },
  {
    question: "Which subjects and exam boards does it cover?",
    answer:
      "A-Level, and we’d rather be specific than reassuring. Plumi carries hand-built topic trees for twelve A-Level specifications: Maths, Physics, Chemistry and Biology across AQA, OCR and Pearson Edexcel. They are not all at the same depth, Edexcel Biology is currently topic-level only, and the trees are deliberately ragged where a specification does not name its own sub-topics. There are no GCSE specifications in Plumi yet, so a GCSE student gets the notebook, the AI Pen and marking on subject knowledge, but not their own spec mapped out. We build each one by hand from the board’s published specification, which is why it takes as long as it does. Plumi is not affiliated with, endorsed by or licensed by any exam board.",
  },
  {
    question: "Do I need an iPad?",
    answer:
      "Yes, and an Apple Pencil. Plumi is built around handwriting. The whole point is that you write normally and it reads it, so there isn’t a sensible version of this on a laptop or a phone. We know that rules some people out, and we’d rather say so plainly than take your email under false pretences. There’s no iPhone, Android or web version planned for launch.",
  },
  {
    question: "Is it free?",
    answer:
      "The notebook is free forever and never metered: writing, pens, highlighter, lasso, notebooks and folders, PDFs, paper styles, search, and keeping all of your work. We think a good digital notebook shouldn’t need a subscription. The intelligence is metered rather than walled off. Every week, free, you get ten markings, five practice questions, twelve AI Pen answers and a tutor session, and your first go at each never counts against it. Plumi Pro removes the meter: £135.99 a year with the first seven days free, which works out at £11.33 a month, or £14.99 a month with no trial. Paying monthly for a year would be £179.88, so the yearly plan is the one we would take. It is billed through the App Store and you cancel it in your Apple account rather than here.",
  },
  {
    question: "What happens to my work and my data?",
    answer:
      "Your notes are yours. We use your work to build your own learner model: which topics you’ve been marked on, and what you got right unaided. That’s what powers the recommendations. It isn’t used to train models for anyone else, it isn’t sold, and it isn’t shared with your school unless you decide to share it. Nothing you write reaches our analytics, this website measures which sections were read and which buttons were pressed, and nothing else. If you join the launch list we store your email and the course you told us, and if you’d like off it before launch, reply to any email and you’re off.",
  },
] as const;
