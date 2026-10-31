/**
 * Ask for a subject in the Discord (founder, 31 October 2026: "Many people are always asking me to add more subjects").
 * The card sits where a student finds their subject is missing: under the question bank's shelves, under the past papers'
 * books, and in the bank's "No bank for … yet" search. Every line below is something the server really does
 * (1 App/discord-bot/README.md): the Request a subject button in #📚・question-bank DMs the team, and DMs the member when a
 * website subject they asked for arrives; new subjects are posted there; the daily question is at 7 in #🧮・daily-questions;
 * the help forums, #📖・resources (the packs) and the 🎧 lofi study room are in layout.toml. Study events are the founder's
 * plan, so they're "on the way", not promised for a date.
 */
export const askForSubject = {
  id: "ask-for-a-subject",
  eyebrow: "Missing a subject?",
  title: "Ask for it in",
  titleEm: "our Discord.",
  line: "Join, tap Request a subject in the #question-bank channel and tell us your board and subject. We add the ones you ask for, and message you when yours is on the site.",
  cta: "Join and ask",
  note: "Free to join. A friendly bunch of students revising for the same exams as you.",
  moreTitle: "What else happens there",
  more: [
    { icon: "🧮", title: "A question every morning.", line: "A real past-paper question at 7, the mark scheme the next morning, and a streak to keep." },
    { icon: "📚", title: "New subjects first.", line: "Each one is posted as soon as it’s on the site." },
    { icon: "📐", title: "Help when you’re stuck.", line: "Ask in the maths, further maths, physics, chemistry and biology help rooms." },
    { icon: "📖", title: "Our practice packs, free.", line: "Every pack, with its mark scheme, for members." },
    { icon: "🎧", title: "Study together.", line: "A lofi study room to work in, with study events on the way." },
  ],
  hint: "Subject missing?",
  hintLink: "Ask for it in our Discord",
  // The bank's search, when nothing matches what the student typed.
  none: "Still missing? Ask for it in our Discord and we’ll message you when it’s here.",
  noneCta: "Ask for it on Discord",
} as const;
