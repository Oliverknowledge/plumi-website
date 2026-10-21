import { prices } from "@/content/home";

/**
 * The /parents page's words (src/app/parents/page.tsx). Students send a parent here from
 * the app to ask for Plumi Pro, so the page answers what a parent asks: what is it, what
 * does it cost, how is it bought, and is it safe.
 *
 * Same rules as every other page: a title, at most one short line, the rest drawn. British
 * English, no em dashes, and nothing the app cannot do today. Where each claim comes from,
 * in the app repo (Sources/PlumiKit/...) unless it says otherwise:
 *
 * - Prices and trial: `PlumiProduct` in Features/Paywall/PaywallView.swift (£14.99 a month,
 *   £135.99 a year, 7 days free on the yearly plan only). The £99.99 launch arm and its end
 *   date: `AnnualPriceArm` in Analytics/Experiments.swift and `PlumiProduct.launchOfferEnds`.
 * - Free allowances: `PremiumFeature.freeAllowance` in Core/Entitlements.swift (practice 3
 *   sessions, marking 10, Tutor Mode 1, AI Pen 12, all weekly) with the row names of
 *   Core/AllowanceUsage.swift. The notebook is never metered (the same file's header).
 * - Ask to Buy: a purchase can come back `.pending` (Core/StoreKitBridge.swift); cancelling
 *   in Settings › your name › Subscriptions is the paywall's own terms line (PaywallCopy.swift).
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

export const parentsHero = {
  eyebrow: "For parents and carers",
  lead: "Your child writes exam answers by hand on iPad. Plumi marks each line against the question’s own mark scheme.",
  chips: ["iPad app", "GCSE and A-Level", "Free to start"],
  image: {
    src: "/site/shot-mark-hero.webp", w: 2000, h: 1388,
    alt: "A handwritten A-Level Physics answer in Plumi, marked 3 out of 5: ticks and crosses on the lines of working, and a marking panel listing each mark awarded or not awarded.",
  },
  zoom: {
    src: "/site/zoom-mark.webp", w: 1130, h: 275,
    alt: "Close up of the handwritten working: M1 ticked on the first line, M2 crossed on the wrong fraction, and A1 crossed on the final value.",
    caption: "Each mark lands on the line that won or lost it.",
  },
} as const;

export const parentsSteps = {
  eyebrow: "What it does",
  title: "Question, answer, mark, next.",
  steps: [
    { n: "01", title: "Plumi sets a question", line: "In the style of their exam board, with its diagram.", image: "/site/loupe-write.webp", w: 570, h: 370, fit: "contain", alt: "The circuit diagram Plumi drew for an A-Level Physics question: a light-dependent resistor in series with a fixed resistor R." },
    { n: "02", title: "They answer by hand", line: "With Apple Pencil, and Plumi marks the working.", image: "/site/zoom-mark.webp", w: 1130, h: 275, fit: "cover", pos: "31% 60%", alt: "Handwritten working for a voltage calculation, with the M2 method mark crossed beside the wrong fraction." },
    { n: "03", title: "They see why", line: "The mark scheme opens beside the answer.", image: "/site/loupe-why.webp", w: 450, h: 320, fit: "cover", pos: "50% 0%", alt: "Plumi's mark scheme for the M2 and A1 marks: use the divider with the 10 kilohm resistance on top, and Vout = 7.8 V." },
    { n: "04", title: "It shows what’s next", line: "Each topic’s square is coloured by their marks.", image: "/site/zoom-map3.webp", w: 470, h: 270, fit: "contain", alt: "A topic map for Forces and motion: squares marked strong, developing or needs attention." },
  ],
} as const;

export const parentsPrice = {
  eyebrow: "What it costs",
  title: "Free to start. Pro if they need more.",
  free: {
    name: "Free",
    price: "£0",
    note: "The notebook is never limited.",
    tiles: [
      ["3", "practice sessions"],
      ["10", "answers marked"],
      ["1", "tutor session"],
      ["12", "AI Pen answers"],
    ],
    tilesLabel: "Free every week",
  },
  pro: {
    name: "Plumi Pro",
    monthly: { price: prices.monthly, period: "a month" },
    yearly: { price: prices.yearly, period: "a year", tag: `First ${prices.trialDays} days free` },
    items: ["Unlimited marking", "Unlimited practice", "Unlimited tutor and AI Pen"],
  },
  launch: "Some students are offered the yearly plan at £99.99 until 31 January 2027.",
} as const;

export const parentsBuying = {
  title: "Billed by Apple. Cancel any time.",
  steps: [
    { id: "tap", title: "They choose Pro", line: "On the iPad, inside Plumi." },
    { id: "ask", title: "You approve it", line: "With Ask to Buy on in Family Sharing, the request comes to you." },
    { id: "cancel", title: "Cancel any time", line: "Settings › your name › Subscriptions." },
  ],
  fine: "Subscriptions renew automatically unless cancelled at least 24 hours before renewal, or before the free days end.",
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
  tutor: {
    src: "/product/tutor-2-mobile.webp", w: 1000, h: 727,
    alt: "Plumi's tutor writing a question back in the margin beside a student's integral: What is the derivative of e to the 2x?",
  },
} as const;

/** FAQ structured data: the tiles' questions with fuller answers, every word as true as the tiles. */
export const parentsFaq = [
  { q: "What is Plumi?", a: "Plumi is a GCSE and A-Level revision app for iPad. Your child answers exam-style questions by hand with Apple Pencil, and Plumi marks the working against each question’s own mark scheme." },
  { q: "How much does Plumi Pro cost?", a: `Plumi is free to download, with 3 practice sessions, 10 answers marked, 1 tutor session and 12 AI Pen answers each week. Plumi Pro is ${prices.monthly} a month, or ${prices.yearly} a year with the first ${prices.trialDays} days free. It is billed by Apple and can be cancelled any time in Settings, under your name, then Subscriptions.` },
  { q: "Is the marking accurate?", a: "Every answer is marked against the mark scheme written for that question. If Plumi cannot be sure the scheme belongs to that question, it does not mark it, and your child’s work is saved." },
  { q: "Which exam boards does Plumi cover?", a: "AQA, OCR and Edexcel at GCSE and A-Level, and Edexcel International A Level, for Maths, Physics, Chemistry and Biology. Plumi is not affiliated with any exam board." },
  { q: "Who can my child talk to in Plumi?", a: "Friends and groups are off until your child signs in and turns them on. Friends are added only with a private code. Group chat refuses links, contact details and swearing, and anyone can be reported or blocked." },
  { q: "What happens to my child’s work?", a: "Notes, handwriting, marks and progress stay on the iPad. Plumi asks before any work goes to AI, sends only the page being marked or tutored, and never uses it to train any AI model. Everything can be deleted from Settings." },
  { q: "Are there ads in Plumi?", a: "No. The app shows no adverts, never reads the iPad’s advertising identifier and never sells your child’s work." },
] as const;

export const parentsContact = {
  title: "Still have a question?",
  line: "Write to us.",
} as const;

export const parentsClose = {
  title: "See Plumi on the App Store.",
} as const;
