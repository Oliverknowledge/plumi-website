/**
 * The homepage's words, in one place, so every claim can be checked in one place.
 *
 * Rules (the app's own): a title, at most one short line, the rest shown. No em
 * dashes anywhere a student reads. Every sentence is true of the shipped app today:
 *
 * - No prices, plans, trials, allowances or "Pro" on any page (founder, 23 October 2026):
 *   the site says Plumi is free to download, and the App Store says the rest. So a
 *   sentence that only holds on a paid plan is left out, never reworded to sound free.
 * - Boards and subjects are the courses the app ships: AQA, OCR and Edexcel, GCSE and
 *   A-Level Physics, Maths, Chemistry and Biology.
 * - Every product image on the page is a real capture from the app.
 */

export const appStoreId = "6811389052";

export const hero = {
  eyebrow: "GCSE & A-Level revision app for iPad",
  h1a: "Handwrite your answer.",
  h1b: "See the line that cost you marks.",
  sub: "Answer AQA, OCR or Edexcel style questions with Apple Pencil. Plumi writes each one with its own mark scheme, then marks your working against it.",
  subShort: "Answer with Apple Pencil. Plumi marks your working against the question’s own mark scheme.",
  note: "Free to download on the App Store.",
  device: "Runs on iPad with iPadOS 17 or later. A finger works too, if your Pencil’s gone missing.",
  qr: "Scan with your iPad camera",
  zoom: { image: "/site/loupe-mark4.webp", w: 885, h: 148, alt: "Close up of the handwritten working: Vout = 1500 over 1500 plus 10000, times 9, with M2 crossed, and the final value 1.73 crossed for A1.", caption: "The 10 kΩ belongs on top of the fraction. That cost a method mark and the answer mark." },
  // Where the close-up sits on the full capture, as fractions of its width and height.
  ring: { x: 0.128, y: 0.668, w: 0.45, h: 0.104 },
} as const;

export const pain = {
  eyebrow: "Marking it yourself",
  title: "ChatGPT agreed with you. Your mock didn’t.",
  line: "At home it’s easy to be soft on yourself, and a chatbot is usually softer.",
  // Two honest columns: what asking a chatbot gives a student, and what Plumi does.
  // Row for row: the misreading, the score, the topic map.
  them: {
    label: "Asking a chatbot",
    rows: [
      { title: "Screenshot your working", line: "Then retype the bit it misread." },
      { title: "Its score is a guess", line: "Unless you find the mark scheme and paste it in yourself.", empty: true },
      { title: "No topic map", line: "Nothing shows which topics keep costing you marks." },
    ],
  },
  us: {
    label: "Plumi",
    rows: [
      // "Is this what you wrote?" is asked before marks are drawn (PageMarkingController.swift).
      { title: "Write under the question", line: "By hand. If a misread could cost you a mark, Plumi asks \"Is this what you wrote?\" before it marks." },
      { title: "1 out of 3 on part (a)", line: "1 mark for the method, then 2 lost to one wrong fraction. With both marks on part (b), that’s 3 out of 5.", proof: true },
      { title: "It builds your topic map", line: "Each topic on your spec gets a square, and your marked answers colour it in." },
    ],
  },
} as const;

export const story = {
  eyebrow: "How it marks",
  title: "This answer got 3 out of 5.",
  steps: [
    {
      id: "write",
      kicker: "01 · Write",
      title: "The circuit’s drawn. You do the working.",
      line: "Plumi wrote this A‑Level Physics question and drew the circuit. GCSE questions that need a diagram get one too.",
      image: "/site/question.webp",
      alt: "An exam-style A-Level Physics question about a light-dependent resistor circuit, with its circuit diagram, in Plumi.",
      fit: "contain" as const,
      zoom: { image: "/site/zoom-write.webp", w: 1170, h: 605 },
      loupe: { image: "/site/loupe-write.webp", w: 570, h: 370 },
    },
    {
      id: "marked",
      kicker: "02 · Mark",
      title: "The ticks land on your working.",
      line: "Each mark goes on the line that won or lost it. If Plumi isn’t sure about one, it says so, and that mark stays off your topic map until you’ve checked it.",
      image: "/site/shot-mark.webp",
      alt: "A handwritten explanation for part (b), with both marks, B1 and B2, ticked by Plumi on the lines that earned them.",
      fit: "cover" as const,
      zoom: { image: "/site/zoom-mark-b.webp", w: 1115, h: 160 },
      loupe: { image: "/site/loupe-mark4.webp", w: 885, h: 148 },
    },
    {
      id: "why",
      kicker: "03 · Check",
      title: "Open the mark scheme beside it.",
      line: "See what each mark wanted. If you think you earned one, tap \"I disagree\" and Plumi looks again.",
      image: "/site/shot-scheme.webp",
      alt: "Plumi's mark scheme panel open beside a marked answer, showing which marks were awarded and why.",
      fit: "cover" as const,
      zoom: { image: "/site/zoom-why.webp", w: 960, h: 500 },
      loupe: { image: "/site/loupe-why.webp", w: 450, h: 320 },
    },
    {
      id: "up",
      kicker: "04 · Fix",
      title: "Fix the slip and mark it again.",
      line: "On a different question, the fix took it from 5 out of 7 to 7 out of 7.",
      image: "/site/shot-up.webp",
      alt: "A re-marked answer in Plumi going from 5 out of 7 to 7 out of 7.",
      fit: "cover" as const,
      zoom: { image: "/site/zoom-up.webp", w: 587, h: 260 },
      loupe: { image: "/site/loupe-up2.webp", w: 580, h: 123 },
      caption: "Marked again after the fix.",
    },
  ],
  cta: "Mark one of your own. Your first 10 each week are free.",
} as const;

export const weak = {
  eyebrow: "Your topic map",
  title: "The red squares are where your marks are going.",
  line: "Your whole spec is here, one square per topic, coloured as your answers are marked. One answer isn’t enough to call a topic Strong.",
  next: { image: "/site/zoom-next2.webp", w: 947, h: 226, alt: "Two practice suggestions picked from the topic map: check what you have not used lately, and test what you remember.", caption: "On A‑Level Physics, your topic map also suggests what to practise next.", ring: { x: 0.27, y: 0.18, w: 0.705, h: 0.14 } },
  zoom: { image: "/site/zoom-map3.webp", w: 470, h: 270, alt: "Close up of the topic map: the Forces and motion topics, each a square marked strong, developing or needs attention." },
  legend: [
    // The app's own key (TopicGrid.swift): never colour alone, a glyph on every state.
    { label: "Needs attention", tone: "red", glyph: "alert" },
    { label: "Developing", tone: "amber", glyph: "half" },
    { label: "Rusty", tone: "amber", glyph: "clock" },
    { label: "Strong", tone: "green", glyph: "check" },
    { label: "Too early to tell", tone: "grey", glyph: "none" },
  ],
} as const;

export const questions = {
  eyebrow: "Written by Plumi",
  title: "Plumi draws the diagram the paper would give you.",
  line: "Pick the topic that keeps catching you out, GCSE or A‑Level, and Plumi writes you a question on it. All six were drawn for questions Plumi has set.",
  // Real figures from bank questions, drawn by the app's own diagram renderer.
  diagrams: [
    { id: "chemb", level: "GCSE", subject: "Chemistry", label: "Energy profile", alt: "A reaction profile of energy against progress of reaction, with a solid curve for the uncatalysed route, a lower dashed curve for the catalysed route, and arrows for the activation energy and the overall energy change." },
    { id: "d4b", level: "A‑Level", subject: "Physics", label: "Resonance", alt: "Resonance curves of amplitude against driving frequency, with a sharp peak at 2 Hz." },
    { id: "biob", level: "GCSE", subject: "Biology", label: "Food web", alt: "A woodland food web: an oak tree feeds a caterpillar, an aphid and an earthworm, which feed blue tits and shrews, which feed a sparrowhawk." },
    { id: "mathsb", level: "A‑Level", subject: "Maths", label: "Projectile path", alt: "A ball thrown at angle alpha from the top of a 34 m building, over an 8 m street, landing on the roof of a 14 m building." },
    { id: "d3b", level: "A‑Level", subject: "Physics", label: "I-V characteristics", alt: "Current against potential difference for four components, labelled A to D." },
    { id: "d9b", level: "A‑Level", subject: "Physics", label: "Circuits", alt: "A circuit with a capacitor, a switch and four resistors." },
  ],
} as const;

export const bento = {
  eyebrow: "Also in the notebook",
  title: "Your notes and past papers go in the same notebook.",
  // Papers sits fourth, so the bento opens on tiles that are true for every GCSE
  // student. Desktop rows (home.css): notes 4 + streak 2, focus 2 + papers 4, stats 3 + friends 3.
  tiles: [
    { id: "notes", title: "Handwritten notes become flashcards.", line: "Write them once and Plumi quizzes you on them.", image: "/site/tile-notes.webp", w: 1400, h: 685, alt: "Handwritten astrophysics notes in Plumi with highlighted key terms and a drawn diagram of an elliptical orbit." },
    { id: "streak", title: "A missed day doesn’t have to end your streak.", line: "Miss a day and a streak freeze is spent for you. You can hold two.", image: "/site/tile-streak2.webp", w: 535, h: 585, alt: "Plumi's streak screen showing an 8 day streak and a calendar of days worked." },
    { id: "focus", title: "Pomodoros that block apps.", line: "Plumi stops distracting apps opening while you work.", image: "/site/pomo-card.webp", w: 1088, h: 942, alt: "Plumi's pomodoro planner set to three 25 minute blocks." },
    { id: "papers", title: "Your board’s A‑Level past papers are in the Papers tab.", line: "Their mark schemes and grade boundaries are there too. A PDF from school, GCSE or A‑Level, can go in your notebook to write on like any page.", image: "/site/tile-papers2.webp", w: 1442, h: 550, alt: "Plumi's past papers for OCR A-Level Physics, June 2023: three papers, each with the paper, mark scheme and examiner report." },
    { id: "stats", title: "An hour open isn’t an hour studied.", line: "Set a daily goal. Leaving the app open on your desk doesn’t count towards it.", image: "/site/tile-stats3.webp", w: 1430, h: 610, alt: "Plumi's study time statistics: 1 hour 44 minutes studied today, with the daily goal reached." },
    { id: "friends", title: "Only people you invite can join your group.", line: "Add a friend, or send your mates the group’s link or code.", image: "/site/tile-groups3.webp", w: 1432, h: 640, alt: "Plumi's study groups screen with an Add a friend button and a four member group." },
  ],
} as const;

export const identity = {
  eyebrow: "Your grades",
  title: "Predicted an A? See if your papers agree.",
  line: "Put your predicted grade next to your target, say a 6 aiming for a 7, or an A aiming for an A*.",
  // The app's order and authorship (SubjectStanding.swift): Predicted is the school's,
  // Plumi's own marking never fills Current (SubjectStanding.swift), so the word is not
  // used here. A marked A-Level paper's grade (PaperChart.swift) is a paid feature, so the
  // caption doesn't promise it.
  grades: [
    { label: "Predicted", value: "A", tone: "" },
    { label: "Last paper", value: "B", tone: "" },
    { label: "Goal", value: "A*", tone: "is-goal" },
  ],
  caption: "Your predicted grade and your target, side by side.",
} as const;

/**
 * Written as replies to a message. Spending, as the app does it: a first mark, a re-mark
 * after a fix, and "Check again" after "I disagree" each spend one of the 10 marks;
 * opening "I disagree" to see the scheme's line spends nothing (MarkChallenge.swift,
 * PageMarkingController.swift).
 */
export const faq = [
  {
    q: "Isn’t this just ChatGPT?",
    a: "Plumi uses AI too. It writes each question with its own mark scheme, then marks your answer against that scheme. Each mark you get or lose points to a line in it, and you can open the scheme beside your answer. Where the scheme gives a number, Plumi checks yours by arithmetic. A chatbot only has a mark scheme if you find one and paste it in.",
  },
  {
    q: "Can it read my handwriting?",
    a: "You write with Apple Pencil like you would on paper. If Plumi might have misread a line that would cost you a mark, it shows you its reading and asks \"Is this what you wrote?\" before the marks go on. If it still isn’t sure about a mark, it holds it, labelled \"Plumi isn’t sure\", and keeps it off your topic map until you’ve checked it.",
  },
  {
    q: "What if I think Plumi got a mark wrong?",
    a: "Tap \"I disagree\" on any mark you didn’t get in full. You’ll see the scheme’s line for that mark, the line you wrote and Plumi’s reason, and seeing them is free. Tap \"Check again\" and Plumi looks again, then either corrects the mark or keeps it and tells you why. If you’re still sure, you can give yourself the mark, and it’s labelled self-marked, never counted as Plumi’s.",
  },
  {
    q: "Which exam boards and subjects does Plumi cover?",
    a: "AQA, OCR and Edexcel, for GCSE and A‑Level Physics, Maths, Chemistry and Biology. Pick your board and its topics become the squares on your topic map.",
  },
  {
    q: "Are these real past paper questions?",
    a: "No. Plumi writes its own in your board’s style, and the mark scheme for each. The Papers tab links to your board’s real A‑Level past papers, mark schemes and grade boundaries. A GCSE paper from school can go in your notebook as a PDF to write on. Plumi isn’t affiliated with any exam board.",
  },
  {
    q: "Is it on iPhone or Android?",
    a: "No. Plumi is built for iPad, because exams are handwritten. It needs iPadOS 17 or later.",
  },
  {
    q: "Is my work private?",
    a: "Your notes, drawings, PDFs, marks and progress are stored on your iPad. You don’t need an account, and if you make one you can delete it in Settings. Plumi asks your permission once, before any of your work goes to AI, and then sends only the part of the page it needs. Nothing you upload or write is used to train any AI model. There are no ads in the app, and your work is never sold.",
  },
] as const;

export const faqTitle = "Before you download";

export const close = {
  title: "Try it on the topic you keep losing marks on.",
  line: "Write one answer and see the line that cost you. It’s free on iPad.",
  qr: "Scan with your iPad camera",
} as const;
