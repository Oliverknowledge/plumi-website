// Real development captures only. The animation is not a live AI session.
// To replace the still sequence, put the final recording in public/product and set
// videoMp4/videoWebm. The same media container, pause control and poster remain.
export const tutorMedia: { videoMp4: string | null; videoWebm: string | null; poster: string } = {
  videoMp4: null, videoWebm: null, poster: "/product/tutor-5.webp",
};
export const tutorFrames = [
  { title: "Write naturally", detail: "Your handwriting. Your usual notebook.", alt: "Real Plumi notebook: the student writes the integral of e to the 2x, missing the factor one half." },
  { title: "Get a little nudge", detail: "A question, written right beside your work.", alt: "Plumi Tutor writes: What is the derivative of e to the 2x?" },
  { title: "Work it out together", detail: "You keep the pen. Plumi guides the next step.", alt: "The student writes 2e to the 2x in response to the Tutor’s question." },
  { title: "Understand the why", detail: "A hint that helps the idea click.", alt: "Plumi confirms the derivative and asks what factor would undo it." },
  { title: "Make it stick", detail: "Then try another, while the idea is fresh.", alt: "The student answers one half. Plumi ticks it and offers another integral: e to the 3x." },
];
export const notebookViews = [
  { id: "library", label: "Your notebooks", image: "library", alt: "Real Plumi Library showing Maths exam and Untitled notebook, with subject navigation." },
  { id: "folders", label: "Your subjects", image: "folders", alt: "Real Plumi Physics folder containing Notes and Past papers." },
  { id: "notebook", label: "Your tools", image: "notebook", alt: "Real Plumi squared-paper notebook with pen, pencil, highlighter, eraser, lasso and AI Pen tools." },
];
/**
 * The specifications the app actually carries hand-built topic trees for.
 *
 * Read off `Sources/PlumiKit/Resources/` and `SeedContent.swift`, which seeds
 * twelve files: AQA 7357/7402/7405/7408, Edexcel 9MA0/9BN0/9CH0/9PH0 and OCR
 * H240/H420/H432/H556. Every one of them is A-level. There are **no GCSE
 * specifications in the app**, which is why nothing on this page claims a GCSE
 * spec — `StudyProfile.qualificationsOffered()` reads the qualifications out of
 * the seeded corpus for exactly that reason, with the comment "offering GCSE on
 * a build with no GCSE mark schemes is a promise the app cannot keep."
 *
 * Coverage is uneven and the chips say so. Four are shown because twelve chips
 * is a list rather than a claim; `specificationCount` carries the real number
 * and `specificationNote` carries the unevenness.
 */
export const specifications = [
  "Edexcel Maths 9MA0",
  "OCR Physics H556",
  "AQA Chemistry 7405",
  "OCR Biology H420",
];
export const specificationCount = 12;
/** The strip under the scenes: what Plumi is for, and whose papers. */
export const subjects = ["Physics", "Maths", "Chemistry", "Biology"] as const;
export const boards = ["AQA", "OCR", "Edexcel"] as const;
export const specificationsMore = "+ 8 more A-Level specs";
/** Edexcel Biology 9BN0 is eight topics with no level beneath them, and says so. */
export const specificationNote =
  "Twelve A-Level specifications across AQA, OCR and Edexcel, built by hand from the boards' own documents. Depth varies by board. No GCSE specifications yet.";

export type Mark = { ok: boolean; note?: string };
const yes: Mark = { ok: true };
const no = (note?: string): Mark => ({ ok: false, note });
/**
 * Four ways to get help with a question you cannot do.
 *
 * ── Why it is still a table ─────────────────────────────────────────────────
 * At the point in the page where a reader is doing due diligence, legibility
 * beats delight. A table full of reasoned crosses reads as confidence; an
 * animated column reveal reads as a sales deck.
 *
 * ── Why the crosses carry reasons ───────────────────────────────────────────
 * "✕" is a scoreboard. "✕ — only what you paste in" is an argument. The note is
 * surfaced on hover and, more importantly, in the `aria-label`, so the reason is
 * not a mouse-only feature.
 *
 * ── Why the tutor wins rows ─────────────────────────────────────────────────
 * Because they do. A private tutor beats or matches Plumi on five of the seven
 * capability rows, and conceding that is the only thing that makes the two rows
 * they lose believable. A comparison that loses nothing is not a comparison.
 *
 * ── Why only Plumi's own price appears in the cost row ──────────────────────
 * A third-party hourly rate is a number this repo cannot check, and an
 * unfootnoted price comparison is the one move this site does not make. Plumi's
 * own figure is checkable; the others are the structural fact — one is paid by
 * the hour and the others are not — which is the part of the argument that
 * actually does the work.
 */
export const comparison = {
  alternatives: ["A chatbot", "A private tutor", "A notes app"],
  rows: [
    { label: "Sees the work you actually did", plumi: yes, others: [no("Only what you paste in"), yes, no("Stores it. Never reads it.")] },
    { label: "Marks it against your board’s mark scheme", plumi: yes, others: [no("Marks on general knowledge"), yes, no()] },
    { label: "Knows your specification", plumi: yes, others: [no("Usually general, not board-specific"), yes, no()] },
    { label: "Remembers every piece of work, not every conversation", plumi: yes, others: [no("Varies; often per conversation"), yes, no()] },
    { label: "Keeps a map of the topics your marks show you need", plumi: yes, others: [yes, yes, no()] },
    { label: "There at eleven the night before", plumi: yes, others: [yes, no("Booked sessions"), yes] },
    { label: "Is also your notebook", plumi: yes, others: [no(), no(), yes] },
  ],
  /** Prose, not ticks. The last row, and the one that reframes everything above it. */
  cost: {
    label: "What it costs",
    plumi: "Free, or £135.99 a year",
    others: ["Free, or a monthly plan", "Paid by the hour", "Usually a yearly plan"],
  },
};
