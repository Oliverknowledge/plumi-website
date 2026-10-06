/**
 * Free vs Pro, and the comparison against the alternatives.
 *
 * ── Every claim here is checked ──────────────────────────────────────────────
 * The Free/Pro split is transcribed from the app's own entitlement table
 * (`Sources/PlumiKit/Core/Entitlements.swift:29-53`) and the paywall's benefit
 * list (`Features/Paywall/PaywallView.swift:346-352`). The free allowances are
 * the real numbers the app meters against today (weekly, Monday to Sunday). See
 * .context/research/product.md §7 for citations.
 *
 * ── The prices ──────────────────────────────────────────────────────────────
 * £19.99 a month, or £135.99 a year with the first seven days free (the launch
 * pricing, confirmed 1 October 2026; `PlumiProduct` in PaywallView.swift). The
 * annual plan works out at £11.33 a month, about 43% under paying monthly for a
 * year (£239.88), and the arithmetic is checkable rather than asserted.
 *
 * Only the annual plan carries a trial, deliberately. A free week on a monthly
 * plan converts a £19.99 decision into a £0 decision and then a cancellation
 * seven days later; a free week on an annual plan is the whole of the risk a
 * student is being asked to take, removed.
 *
 * ── The one rule these numbers are under ────────────────────────────────────
 * The app's own comment: "a price the App Store has not confirmed is a price
 * Plumi cannot charge." That still holds. These figures must match App Store
 * Connect exactly. Until 6 October 2026 this file said £79.99 a year and
 * £6.67 a month, which was an earlier plan; the app and App Store say £135.99.
 */

// ─────────────────────────────────────────────────────────────────────────────
// FREE vs PRO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The free tier is stronger than "a demo", and saying so is the whole argument
 * for the notebook-first positioning. Policy, verbatim from the app:
 * "the notebook is free forever and never metered."
 */
export const freePlan = {
  name: "Plumi Free",
  promise: "The notebook, free forever. No trial, no page limit, no counter.",
  /** Things with no gate anywhere in the app. */
  /** Five lines, not seven. Two pairs were one idea each written twice. */
  includes: [
    "Pen, pencil, highlighter, lasso and shape snapping",
    "Notebooks, folders, search and export",
    "Ruled, grid, dotted, Cornell and graph paper",
    "Import a PDF and write straight onto it",
    "Everything you write, kept and readable, always",
  ],
  /**
   * The weekly allowances. Included deliberately: a specific number is the
   * cheapest proof available, and vagueness here would read as a trap.
   * These are the app's current metered values — update them together with
   * Entitlements.swift if they change.
   */
  /** Names the meter openly rather than letting a reader discover it. */
  allowanceLead: "The intelligence is metered on Free. You get a go at all of it, every week:",
  allowances: [
    { feature: "AI Pen", allowance: "12 a week" },
    { feature: "Marking", allowance: "10 a week" },
    { feature: "Practice", allowance: "5 a week" },
    { feature: "Tutor Mode", allowance: "1 a week" },
  ],
  /** True: the first AI Pen answer, tutoring exchange and mark are unmetered. */
  footnote: "Your first AI Pen answer, your first tutoring exchange and your first mark never count against it.",
} as const;

export const proPlan = {
  name: "Plumi Pro",
  promise: "The part that understands you.",
  /**
   * Verbatim from the paywall (`PaywallView.benefits`), in the app's own order,
   * with one row removed and one reworded.
   *
   * **Removed: "Predicted grades."** `PremiumFeature.predictedGrade` has a free
   * allowance of zero, so the table says Pro-only — but the only call to
   * `entitlements.check(.predictedGrade)` anywhere in `Sources/` is inside
   * `SelfTest.swift`. No production surface gates it, so a free user gets it
   * today. Advertising it as a reason to pay would be selling something the
   * product gives away. It goes back on this list the day the gate is wired.
   *
   * **Reworded: "Whole past papers."** The app holds paper *metadata* and links
   * to the boards' own PDFs; it does not hold a library of papers. What is true
   * and shipped is that a paper you sit is marked question by question
   * (`ExamSubmission` → `PaperMarker` → `PaperMarkingProgress`), so that is what
   * this row says.
   */
  includes: [
    { title: "Unlimited AI Pen", detail: "Explain, hint and check anything, as often as you like." },
    { title: "Full marking", detail: "Against the real mark scheme, with challenge and re-marking." },
    { title: "Adaptive practice", detail: "Questions built from the marks you actually lost." },
    { title: "A whole paper, marked", detail: "Sit it timed, then get it back question by question, with where each mark went." },
    { title: "Unlimited tutoring", detail: "On the page, for as long as the idea takes." },
  ],
} as const;

/**
 * The two plans, annual first and annual favoured.
 *
 * Favoured in the composition rather than in the copy: no "best value" badge, no
 * strike-through on the monthly price, no countdown. The annual card is simply
 * shown first, given the accent border and carries the per-month arithmetic;
 * the monthly card is stated plainly beside it and is not made to look like a
 * mistake. A student who wants to pay monthly is not doing anything wrong.
 *
 * `perMonth` is £135.99 ÷ 12 = £11.3325, rounded to the penny it actually works
 * out at. It is never presented as a *price* — nobody can pay £11.33 — which is
 * why the line says "works out at" and the charged figure sits above it in
 * larger type than the equivalent.
 */
export interface ProPlanOption {
  id: "annual" | "monthly";
  label: string;
  price: string;
  period: string;
  /** Only on the annual plan: the monthly equivalent of a yearly charge. */
  perMonth?: string;
  /** What actually happens when they tap. Never softened. */
  terms: string;
  featured: boolean;
}

export const proOptions: readonly ProPlanOption[] = [
  {
    id: "annual",
    label: "Yearly",
    price: "£135.99",
    period: "a year",
    perMonth: "Works out at £11.33 a month",
    terms: "Seven days free, then £135.99 a year. Cancel any time before it renews.",
    featured: true,
  },
  {
    id: "monthly",
    label: "Monthly",
    price: "£19.99",
    period: "a month",
    // Said out loud rather than left as an absence. A trial that exists on one
    // plan and not the other is the sort of thing a student finds out at the
    // till, and finding it out at the till is how a product loses them.
    terms: "No free trial on monthly. Cancel any time.",
    featured: false,
  },
] as const;

/**
 * The anchor, and it is arithmetic rather than a comparison.
 *
 * The obvious anchor is an hour of private tuition, and it is the strongest one
 * available — but a third-party hourly rate is a number this repo cannot check,
 * and an unfootnoted price comparison is exactly the move this site does not
 * make. £135.99 against £239.88 is Plumi's own two prices, and anyone can do it.
 */
export const proAnchor = {
  headline: "A year costs less than seven months.",
  detail: "Paying monthly for a year is £239.88. The yearly plan is £135.99.",
} as const;

/** Where the money is actually taken, and by whom. */
export const proFootnote =
  "Billed through the App Store in pounds. Manage or cancel it in your Apple account, not here.";

/**
 * The sentence the app itself uses, corrected on one point.
 *
 * "Pro is the marking, the practice and the tracking" over-claims: the tracking
 * is not gated. `PremiumFeature` has no case for the learner model and none for
 * Exam Mode, so both are free — they are simply *fed* by marking, which is
 * metered. The deal is a meter, not a wall, and saying so is a better offer
 * than the one it replaces.
 */
export const planSummary =
  "Your notebook is free forever. The intelligence is free every week, in real amounts. Pro removes the meter.";

// ─────────────────────────────────────────────────────────────────────────────
// THE COMPARISON
//
// Lumi's table is a 4×10 grid of categories. It works because it concedes ticks
// to its competitors and lets a "typical cost" row do the killing — but it is
// unreadable on a phone, and it asks a student to care about three alternatives
// they don't use.
//
// This one asks instead: what are you using now? Then it is a head-to-head, two
// columns, which fits 390px without becoming a scroll-sideways table.
//
// The second difference matters more. Every alternative below is given rows it
// genuinely WINS, with a cross against Plumi. Conceding a real loss is the only
// thing that makes the rest of a comparison table believable, and no competitor
// in this category does it.
// ─────────────────────────────────────────────────────────────────────────────

export type Verdict = "yes" | "partly" | "no";

export interface ComparisonRow {
  claim: string;
  them: Verdict;
  plumi: Verdict;
  /** Shown on the row that swings the argument. */
  note?: string;
}

export interface Alternative {
  id: string;
  /** How a student would name it, not how a marketer would. */
  label: string;
  /** Sits under the column head. */
  sublabel: string;
  rows: readonly ComparisonRow[];
  /** The honest cost line. */
  cost: string;
}

export const alternatives: readonly Alternative[] = [
  {
    id: "chatbot",
    // Named as a category rather than as a trademark. It is what a student
    // actually calls it, it cannot go stale when a model is renamed, and it
    // keeps every claim below about a behaviour we can defend.
    label: "A chatbot",
    sublabel: "ChatGPT, Gemini, Claude",
    rows: [
      { claim: "There at 11pm the night before", them: "yes", plumi: "yes" },
      {
        claim: "You don’t have to explain the question first",
        them: "no",
        plumi: "yes",
        note: "Photograph, crop, retype the context. Or circle the line.",
      },
      // The concession, placed after the argument has started rather than as
      // the first thing a reader sees. It is still here, and still unhedged.
      { claim: "Answers questions about anything, not just your subjects", them: "yes", plumi: "no" },
      { claim: "Reads the printed question under your working", them: "partly", plumi: "yes" },
      { claim: "Helps on the page instead of in a chat", them: "no", plumi: "yes" },
      { claim: "Marks against your board’s actual mark scheme", them: "partly", plumi: "yes" },
      {
        claim: "Knows what you got wrong last week",
        them: "partly",
        plumi: "yes",
        note: "Chat memory remembers what you said. Plumi records what you were marked on.",
      },
      { claim: "Won’t just hand you the answer", them: "no", plumi: "yes" },
      { claim: "Turns itself off when you sit a timed paper", them: "no", plumi: "yes" },
    ],
    cost: "Free, or about £20 a month",
  },
  {
    id: "tutor",
    label: "A private tutor",
    sublabel: "One to one, in person",
    rows: [
      { claim: "Can tell when you’re tired rather than stuck", them: "yes", plumi: "no" },
      { claim: "Can teach you something that isn’t on the spec", them: "yes", plumi: "no" },
      { claim: "Reads your handwriting", them: "yes", plumi: "yes" },
      { claim: "Already knows what you’re stuck on", them: "yes", plumi: "yes" },
      { claim: "Won’t just hand you the answer", them: "yes", plumi: "yes" },
      { claim: "Knows what you got wrong last week", them: "yes", plumi: "yes" },
      {
        claim: "There at 11pm the night before",
        them: "no",
        plumi: "yes",
        note: "This is the row that decides it, and it always has been.",
      },
      { claim: "Marks a whole past paper, question by question", them: "partly", plumi: "yes" },
    ],
    cost: "£30–60 an hour",
  },
  {
    id: "revision-sites",
    label: "Revision sites",
    sublabel: "Notes, videos, quizzes",
    rows: [
      { claim: "Covers your whole specification", them: "yes", plumi: "yes" },
      { claim: "Free, or nearly", them: "yes", plumi: "partly" },
      { claim: "Someone else has already made the notes", them: "yes", plumi: "no" },
      { claim: "Reads the work you actually did", them: "no", plumi: "yes" },
      { claim: "Helps you while you’re stuck, not afterwards", them: "no", plumi: "yes" },
      {
        claim: "Knows which topics you can do unaided",
        them: "no",
        plumi: "yes",
        note: "A quiz score is a score. Plumi separates “got it right” from “got it right on your own”.",
      },
      { claim: "Builds tomorrow’s practice from the marks you lost", them: "no", plumi: "yes" },
    ],
    cost: "£0–10 a month",
  },
  {
    id: "note-apps",
    label: "A note-taking app",
    sublabel: "The one you’re writing in now",
    rows: [
      { claim: "Beautiful to write in", them: "yes", plumi: "yes" },
      { claim: "Years of features and templates", them: "yes", plumi: "no" },
      {
        claim: "Keeps everything you write, free",
        them: "partly",
        plumi: "yes",
        // Kept general on purpose: free-tier limits change, and a website that
        // quotes a competitor's cap is a website that is wrong by Christmas.
        note: "Free tiers in this category tend to cap you at a handful of notebooks.",
      },
      { claim: "Reads what you wrote", them: "no", plumi: "yes" },
      { claim: "Knows which topic a page belongs to", them: "no", plumi: "yes" },
      { claim: "Tells you what to open next", them: "no", plumi: "yes" },
    ],
    cost: "Usually a yearly subscription",
  },
  {
    id: "paper",
    label: "Paper and a pen",
    sublabel: "What most people actually use",
    // Interleaved rather than grouped. Listed by outcome, paper's three
    // advantages ran consecutively at the top and the panel read as a list of
    // defeats before it read as a comparison — which is not more honest, just
    // worse at making the point that both are true.
    rows: [
      { claim: "You can find the page from three weeks ago", them: "no", plumi: "yes" },
      { claim: "Never runs out of battery", them: "yes", plumi: "no" },
      { claim: "Tells you when you’ve got it wrong", them: "no", plumi: "yes" },
      {
        claim: "Allowed in the exam",
        them: "yes",
        plumi: "no",
        note: "Which is the point of Exam Mode: it is practice for a room you take a pen into.",
      },
      { claim: "Turns the work you already did into a plan", them: "no", plumi: "yes" },
      { claim: "Costs nothing", them: "yes", plumi: "partly" },
    ],
    cost: "About £3",
  },
] as const;

/**
 * What each mark means in words. The verdicts are drawn as Plumi's own tick,
 * half-tick and cross; these are what a screen reader gets instead, and they
 * are the same three words the app's marking uses.
 */
export const verdictLabels: Record<Verdict, string> = {
  yes: "Yes",
  partly: "Partly",
  no: "No",
};

export const comparison = {
  question: "What are you using now?",
  ourLabel: "Plumi",
  ourSublabel: "iPad and Apple Pencil",
  ourCost: "Free, or £135.99 a year",
  /** The last row of every head-to-head, and the one that does the arguing. */
  costLabel: "What it costs",
  /** Names the claim column for a screen reader; the column head is blank by design. */
  claimLabel: "What you get",
  /** Names the three marks. The audit's complaint about Lumi's table was an
   *  undefined tilde; a drawn half-tick has exactly the same problem. */
  legend: "Yes · Partly · No",
  /** The honesty that makes the rest of the table land. */
  footnote:
    "Rows where the alternative wins are marked against us. A comparison that loses nothing isn’t a comparison.",
} as const;
