/**
 * Free vs Pro, and the comparison against the alternatives.
 *
 * ── Every claim here is checked ──────────────────────────────────────────────
 * The Free/Pro split is transcribed from the app's own entitlement table
 * (`Sources/PlumiKit/Core/Entitlements.swift:29-53`) and the paywall's benefit
 * list (`Features/Paywall/PaywallView.swift:346-352`). The daily allowances are
 * the real numbers the app meters against today. See
 * .context/research/product.md §7 for citations.
 *
 * ── No prices ───────────────────────────────────────────────────────────────
 * The app's own comment: "a price the App Store has not confirmed is a price
 * Plumi cannot charge." The same holds here. There are numbers in a local
 * StoreKit *test* config; they are not approved, and they are not on this site.
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
  includes: [
    "Writing with pen, pencil and highlighter",
    "Notebooks, folders and search",
    "Ruled, grid, dotted, Cornell and graph paper",
    "Import a PDF and write straight onto it",
    "Lasso, shape snapping and export",
    "Focus Mode",
    "Everything you write, kept and readable, always",
  ],
  /**
   * The daily allowances. Included deliberately: a specific number is the
   * cheapest proof available, and vagueness here would read as a trap.
   * These are the app's current metered values — update them together with
   * Entitlements.swift if they change.
   */
  /** Names the meter openly rather than letting a reader discover it. */
  allowanceLead: "The intelligence is metered on Free. You get a go at all of it, every day:",
  allowances: [
    { feature: "AI Pen", allowance: "12 a day" },
    { feature: "Marking", allowance: "5 a day" },
    { feature: "Practice", allowance: "10 a day" },
    { feature: "Tutor Mode", allowance: "1 a day" },
  ],
  /** True: the first AI Pen answer, tutoring exchange and mark are unmetered. */
  footnote: "Your first AI Pen answer, your first tutoring exchange and your first mark never count against it.",
} as const;

export const proPlan = {
  name: "Plumi Pro",
  promise: "The part that understands you.",
  /** Verbatim from the paywall, in the app's own order. */
  includes: [
    { title: "Unlimited AI Pen", detail: "Explain, hint and check anything, as often as you like." },
    { title: "Full marking", detail: "Against the real mark scheme, with challenge and re-marking." },
    { title: "Adaptive practice", detail: "Questions built from the marks you actually lost." },
    { title: "Whole past papers", detail: "Marked question by question, with where the marks went." },
    { title: "Predicted grades", detail: "From your timed papers, never from guesswork." },
  ],
  priceLine: "No price yet.",
  priceDetail: "Everyone on the waitlist hears it from us before it's public.",
} as const;

/** The sentence the app itself uses. Hard to improve on. */
export const planSummary =
  "Your notebook is free forever. Pro is the marking, the practice and the tracking.";

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
  /** The honest cost line. Ours is always "no price yet". */
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
        claim: "You don't have to explain the question first",
        them: "no",
        plumi: "yes",
        note: "Photograph, crop, retype the context. Or circle the line.",
      },
      // The concession, placed after the argument has started rather than as
      // the first thing a reader sees. It is still here, and still unhedged.
      { claim: "Answers questions about anything, not just your subjects", them: "yes", plumi: "no" },
      { claim: "Reads the printed question under your working", them: "partly", plumi: "yes" },
      { claim: "Helps on the page instead of in a chat", them: "no", plumi: "yes" },
      { claim: "Marks against your board's actual mark scheme", them: "partly", plumi: "yes" },
      {
        claim: "Knows what you got wrong last week",
        them: "partly",
        plumi: "yes",
        note: "Chat memory remembers what you said. Plumi records what you were marked on.",
      },
      { claim: "Won't just hand you the answer", them: "no", plumi: "yes" },
      { claim: "Turns itself off when you sit a timed paper", them: "no", plumi: "yes" },
    ],
    cost: "Free, or about £20 a month",
  },
  {
    id: "tutor",
    label: "A private tutor",
    sublabel: "One to one, in person",
    rows: [
      { claim: "Can tell when you're tired rather than stuck", them: "yes", plumi: "no" },
      { claim: "Can teach you something that isn't on the spec", them: "yes", plumi: "no" },
      { claim: "Reads your handwriting", them: "yes", plumi: "yes" },
      { claim: "Already knows what you're stuck on", them: "yes", plumi: "yes" },
      { claim: "Won't just hand you the answer", them: "yes", plumi: "yes" },
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
      { claim: "Helps you while you're stuck, not afterwards", them: "no", plumi: "yes" },
      {
        claim: "Knows which topics you can do unaided",
        them: "no",
        plumi: "yes",
        note: "A quiz score is a score. Plumi separates “got it right” from “got it right on your own”.",
      },
      { claim: "Builds tomorrow's practice from the marks you lost", them: "no", plumi: "yes" },
    ],
    cost: "£0–10 a month",
  },
  {
    id: "note-apps",
    label: "A note-taking app",
    sublabel: "The one you're writing in now",
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
      { claim: "Tells you when you've got it wrong", them: "no", plumi: "yes" },
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
  ourCost: "No price yet",
  /** The last row of every head-to-head, and the one that does the arguing. */
  costLabel: "What it costs",
  /** Names the claim column for a screen reader; the column head is blank by design. */
  claimLabel: "What you get",
  /** Names the three marks. The audit's complaint about Lumi's table was an
   *  undefined tilde; a drawn half-tick has exactly the same problem. */
  legend: "Yes · Partly · No",
  /** The honesty that makes the rest of the table land. */
  footnote:
    "Rows where the alternative wins are marked against us. A comparison that loses nothing isn't a comparison.",
} as const;
