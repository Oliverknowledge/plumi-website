/**
 * The /parents page's words (src/app/parents/page.tsx). The page answers what a parent asks:
 * what is it, why this one, and is it safe. No prices, plans or "Pro" (founder, 23 October 2026).
 *
 * Same rules as every other page: a title, at most one short line, the rest drawn. British
 * English, no em dashes, and nothing the app cannot do today. Where each claim comes from,
 * in the app repo (Sources/PlumiKit/...) unless it says otherwise:
 *
 * - Marking: each answer is marked against its own question's scheme, and refused rather
 *   than guessed when the scheme does not match (`MarkingRefusal`,
 *   Physics/Generate/QuestionLifecycle.swift; "Fail closed" in the app's CLAUDE.md). "Is this
 *   what you wrote?" is Features/Marking/MarkingPageRules.swift.
 * - Boards: the seeded specifications (Exam/SeedContent.swift, Resources/topics_*.json):
 *   AQA, OCR and Edexcel at GCSE and A-Level, and Pearson Edexcel International A Level
 *   (Exam/InternationalALevel.swift).
 * - Tutor: nudges first, three rungs before it offers to show (Tutor/TutorHelpLadder.swift);
 *   work done with help is capped at "developing", never "strong" (same file).
 * - Friends: off until the student signs in and turns it on (Social/SocialOptIn.swift);
 *   friends and groups only by an 8-character code (Social/FriendCode.swift); chat refuses
 *   links, contact details and swearing (Social/ChatRules.swift); Report and Block on every
 *   other person (Features/Social/PersonSheet.swift, GroupChatPanel.swift).
 * - Data: notes, handwriting, marks and progress stay on the iPad; only the page being marked
 *   or tutored is sent, never used to train any AI model; everything can be deleted from
 *   Settings (`Safeguarding.parentNote`, `LegalStrings.uploadPrivacy`, Core/AIConsent.swift,
 *   Account/StudentDataEraser.swift).
 * - Ads: `LegalStrings.advertising` in Core/LegalStrings.swift, and the website's own privacy
 *   notice ("The app shows no adverts ... and never sells your work", src/content/legal.ts).
 * - Crisis signpost: Tutor/CrisisSignpost.swift (Childline, Samaritans, Shout).
 * - Device: iPad only (TARGETED_DEVICE_FAMILY 2 in project.yml), iPadOS 17 or later
 *   (Package.swift), Pencil only unless "Draw with finger" is switched on in Settings
 *   (`DrawWithFinger`, Core/Appearance.swift).
 * - Age: asked once, and under-18s are asked to show a parent or carer what Plumi keeps
 *   (Account/Safeguarding.swift). It is the student's confirmation, never described as consent.
 */

/**
 * The pictures. The `capture` ones are the App Store set's captures of the app (19 October
 * 2026, `1 App/App Store screenshots/captures`); the `flow` ones are the new-flow prototype
 * the founder shared on 23 October as the current UI (the Desk's to-do list, Insights,
 * flashcards, the session panel and the Grand Library), rendered at 2x. Both are 1600 wide.
 */
const shot = (name: string, alt: string, h = 1177) => ({ src: `/parents/${name}.webp`, w: 1600, h, alt });

export const parentsHero = {
  eyebrow: "For parents and carers",
  title: "The all‑in‑one revision app,",
  titleEm: "explained for parents.",
  lead: "Plumi is where your child revises for GCSEs and A-Levels on iPad: their notes, a to-do list, exam questions marked line by line, flashcards and past papers, in one calm place.",
  chips: ["iPad app", "GCSE and A-Level", "AQA, OCR, Edexcel", "Free to download"],
  screen: shot("desk", "Plumi's Desk on iPad: a good-morning greeting, today's to-do list with homework and revision tagged by subject, their subjects as books on a shelf, and four ways to revise.", 1200),
  marked: { src: "/parents/marked-hand.webp", w: 1000, h: 337, alt: "Handwritten working for a projectiles question, marked by Plumi: red ticks for M1 and A1 beside the speed, and a cross for A0 under the angle line." },
  markedLabel: "Marked by Plumi",
} as const;

/** What revision usually takes, against what Plumi puts in one place. Every row is a shipped feature. */
export const parentsStack = {
  eyebrow: "Why one app",
  title: "Instead of five apps",
  titleEm: "and a pile of paper.",
  beforeLabel: "Revision, usually",
  before: ["Notes in three notebooks", "A planner nobody opens", "Flashcards in another app", "Past papers in a folder", "A week’s wait for marking", "A phone buzzing beside them"],
  afterLabel: "Revision, in Plumi",
  after: [
    { title: "Notes", line: "Handwritten with Apple Pencil, one notebook a subject, searchable." },
    { title: "A to-do list", line: "Homework and revision on one list, tagged by subject." },
    { title: "Exam questions", line: "In their board’s style, marked line by line." },
    { title: "Flashcards", line: "Made from their own notes." },
    { title: "Past papers", line: "Their board’s papers and mark schemes." },
    { title: "Focus timer", line: "Distracting apps stay shut while they work." },
  ],
} as const;

/** The three things Plumi does that nothing else in the pile does, each with its picture. */
export const parentsFeatures = [
  {
    id: "mark",
    eyebrow: "Marking",
    title: "It marks their handwriting,",
    titleEm: "line by line.",
    line: "They answer with Apple Pencil, like on paper. Each mark lands on the line that won or lost it, and the mark scheme opens beside the answer.",
    points: ["Against each question’s own mark scheme", "Asks first if a misread could cost a mark", "Won’t mark if it can’t be sure"],
    image: shot("scheme", "A marked answer in Plumi beside its mark breakdown: 8 out of 9 marks, each mark listed with whether it was awarded, and why the angle mark was lost."),
  },
  {
    id: "map",
    eyebrow: "Progress",
    title: "It knows what they",
    titleEm: "don’t know yet.",
    line: "Every topic on their specification gets a square, coloured by their marked answers. The weak spots are plain to see, for them and for you.",
    points: ["Their exam board’s own specification", "Predicted grade beside their goal", "Weak spots, practised in one tap"],
    image: shot("map", "Plumi's topic map for A-Level Maths: a square for each of 122 topics, coloured strong, developing, rusty or needs attention, with their weak spots listed beside it."),
  },
  {
    id: "plan",
    eyebrow: "Planning",
    title: "It turns ‘I should revise’",
    titleEm: "into a plan.",
    line: "Plumi picks tonight’s topic from the marks they’ve lost, and lays out the week from their marked work.",
    points: ["Tonight’s topic, picked for them", "10, 25 or 45 minutes", "A plan for the week, from their marked work"],
    image: shot("tonight", "Plumi's Desk in the evening: tonight's session on projectiles with a choice of 10, 25 or 45 minutes, today's study time, the week by subject, and a plan for each day."),
  },
] as const;

/** The rest of revision, smaller. */
export const parentsMore = {
  eyebrow: "And everything else",
  title: "The rest of revision,",
  titleEm: "in the same place.",
  items: [
    { id: "cards", title: "Flashcards from their notes", line: "Plumi turns what they’ve written into cards, and brings each one back just before they’d forget it.", image: shot("cards", "Plumi's flashcards: a chemistry card asking why the C=O bond is polar, with Again, Hard, Good and Easy buttons, and their decks listed beside it.", 1200) },
    { id: "focus", title: "Focus sessions that block apps", line: "They choose a topic and a length. Distracting apps stay shut until the timer ends.", image: shot("session", "Plumi's session panel: a 25 minute timer on an alarm clock, the topic they're working on, and who can see them studying.", 1200) },
    { id: "insights", title: "The effort, in numbers", line: "Time studied, answers marked and cards reviewed, day by day. Ask them to show you.", image: shot("insights", "Plumi's Insights: 18 hours 56 minutes studied over 28 days, time by subject, marks scored, a bar for each day and a calendar of the month.", 1200) },
    { id: "study", title: "Company, without the chat", line: "A quiet pixel library to study in alongside others. Talking is only with friends they add by private code.", image: shot("study", "Plumi's Grand Library: students studying at tables in a pixel library, a list of rooms, and the student's own seat and timer.", 1200) },
  ],
} as const;

export type ConcernId = "marking" | "boards" | "work" | "friends" | "data" | "ads" | "wellbeing" | "device" | "age";

export const parentsConcerns = {
  eyebrow: "What parents ask",
  title: "The honest answers.",
  items: [
    { id: "marking", q: "Is the marking accurate?", a: "Each answer is marked against the scheme written for its question. If Plumi can’t be sure they match, it won’t mark." },
    { id: "boards", q: "Which exam boards?", a: "GCSE and A-Level Maths, Physics, Chemistry and Biology." },
    { id: "work", q: "Will it do the work for them?", a: "The tutor nudges first, with a question back. Work done with help never counts as mastered." },
    { id: "friends", q: "Who can they talk to?", a: "Friends are off until they turn them on, and added only by a private code." },
    { id: "data", q: "What happens to their work?", a: "Notes and marks stay on the iPad. Only the page being marked is sent, after they agree." },
    { id: "ads", q: "Are there ads?", a: "No adverts in the app, and their work is never sold." },
    { id: "wellbeing", q: "What if they’re struggling?", a: "If they write that they’re not safe, the tutor stops and shows them who to call." },
    { id: "device", q: "What do they need?", a: "An iPad with iPadOS 17 or later. Apple Pencil works best." },
    { id: "age", q: "Do you know they’re under 18?", a: "Plumi asks their age, and asks under-18s to show you what it keeps." },
  ] as const satisfies readonly { id: ConcernId; q: string; a: string }[],
  boards: ["AQA", "OCR", "Edexcel", "Edexcel International A Level"],
  friends: { code: "ABCD-EFGH", chips: ["No links", "No phone numbers", "No swearing", "Report", "Block"] },
  data: ["Stays on the iPad", "Asks first", "Never trains AI", "Delete any time"],
  helplines: [
    { name: "Childline", detail: "0800 1111" },
    { name: "Samaritans", detail: "116 123" },
    { name: "Shout", detail: "Text SHOUT to 85258" },
  ],
  device: "Another stylus or a finger works with one switch in Settings.",
  // Drawn on the page (ConcernArt in page.tsx), in the same hand as the hero's marked card.
  tutor: {
    alt: "A student's handwritten working. They integrate e to the 2x as e to the 2x plus C, underlined in red. Plumi writes back, What's the derivative of e to the 2x? They write 2e to the 2x, ticked. Plumi asks, So what undoes that 2? They write a half e to the 2x plus C, ticked.",
  },
} as const;

/** FAQ structured data: the tiles' questions with fuller answers, every word as true as the tiles. */
export const parentsFaq = [
  { q: "What is Plumi?", a: "Plumi is a GCSE and A-Level revision app for iPad. Your child answers exam-style questions by hand with Apple Pencil, and Plumi marks the working against each question’s own mark scheme." },
  { q: "Is the marking accurate?", a: "Every answer is marked against the mark scheme written for that question. If Plumi cannot be sure the scheme belongs to that question, it does not mark it, and your child’s work is saved." },
  { q: "Which exam boards does Plumi cover?", a: "AQA, OCR and Edexcel at GCSE and A-Level, and Edexcel International A Level, for Maths, Physics, Chemistry and Biology. Plumi is not affiliated with any exam board." },
  { q: "Who can my child talk to in Plumi?", a: "Friends and groups are off until your child signs in and turns them on. Friends are added only with a private code. Group chat refuses links, contact details and swearing, and anyone can be reported or blocked." },
  { q: "What happens to my child’s work?", a: "Notes, handwriting, marks and progress stay on the iPad. Plumi asks before any work goes to AI, sends only the page being marked or tutored, and never uses it to train any AI model. Everything can be deleted from Settings." },
  { q: "Are there ads in Plumi?", a: "No. The app shows no adverts, never reads the iPad’s advertising identifier and never sells your child’s work." },
] as const;

export const parentsClose = {
  title: "Give them a calmer",
  titleEm: "run-up to exams.",
  line: "Free to download on the App Store, for iPad.",
  ask: "Still have a question? Write to us.",
} as const;
