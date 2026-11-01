/**
 * Every indexable route, and the search intent it exists to serve.
 *
 * This is the single source of truth for three things that go wrong the moment
 * they live in separate files: the sitemap, the internal link graph, and the
 * keyword map. A page added here appears in `sitemap.xml` and in the relevant
 * "keep reading" links automatically; a page not here is not indexable and
 * should say so in its own `robots` metadata.
 *
 * `primaryQuery` is deliberately one per page. Two pages chasing one query is
 * cannibalisation, and the fix is always to merge them rather than to write
 * both — which is why there is a `/ai-tutor-for-a-level-maths` and no separate
 * `/a-level-maths`, and why there is no `/pricing`: the prices live on the App Store
 * listing, and a page that can only ever repeat two numbers is a page that
 * competes with the one already ranking for the brand. For the same reason
 * `/how-it-works`, `/ai-handwriting-tutor` and `/ipad-study-app` are gone: each
 * only restated the homepage, and they redirect to it (see next.config.ts).
 */

export interface RouteIntent {
  /** Path, root-relative, no trailing slash (except "/"). */
  path: string;
  /** The one query this page is trying to win. */
  primaryQuery: string;
  /** Queries it should also pick up without a page of their own. */
  secondaryQueries: readonly string[];
  /** What the searcher is actually trying to do. */
  intent: string;
  /** What we want the page to achieve for them. */
  objective: string;
  /** <title>. Kept under ~60 characters so it survives the SERP. */
  title: string;
  /** The single H1. */
  h1: string;
  /** <meta name="description">. Kept under ~155 characters. */
  description: string;
  /** Paths this page should link out to, in descriptive anchor text. */
  linksTo: readonly string[];
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
  /**
   * When the page's words last changed (YYYY-MM-DD), for the sitemap's lastmod. Set it by hand when
   * you change a page, never to the build time: Google learns to ignore a lastmod that always moves.
   */
  lastModified?: string;
}

export const routeIntents: readonly RouteIntent[] = [
  {
    path: "/",
    primaryQuery: "Plumi",
    secondaryQueries: ["Plumi study", "Plumi app", "Plumi AI tutor", "AI study notebook"],
    intent: "Find out what Plumi is and whether it is for me.",
    objective: "Establish the entity and category, then send high-intent visitors to the App Store.",
    // Leads with the brand, because the first job of the homepage title is to
    // win "Plumi". The category follows.
    title: "Plumi: GCSE & A-Level Revision That Marks Your Handwriting",
    h1: "The cosy notebook that marks your work.",
    // The free practice is named too: it is what most visitors from a video came for.
    description:
      "Plumi marks your handwritten GCSE and A-Level answers on iPad, line by line against the mark scheme. Plus free past papers and exam questions by topic.",
    linksTo: ["/practice-papers", "/question-bank", "/past-papers", "/ai-tutor-for-a-level-maths", "/about"],
    changeFrequency: "weekly",
    priority: 1,
    lastModified: "2026-10-23",
  },
  {
    path: "/ai-tutor-for-a-level-maths",
    primaryQuery: "AI tutor for A-Level Maths",
    secondaryQueries: ["A-Level Maths AI tutor", "AI maths tutor A Level", "best AI for A-Level Maths", "AI tutor vs ChatGPT for maths", "AI past paper marking A-Level Maths", "AI predicted grade A-Level Maths", "is there a free AI maths tutor"],
    intent: "Find an AI that can actually help with A-Level Maths working, not just final answers.",
    objective: "Show tutoring happening on real handwritten working, and why that beats retyping into a chatbot.",
    title: "AI Tutor for A-Level Maths That Reads Your Working",
    h1: "An AI tutor for A‑Level Maths that understands your working",
    description:
      "No retyping. Plumi reads the working already on your page, nudges before it answers, and marks your method against the question's own mark scheme.",
    linksTo: ["/goodnotes-alternative-for-students", "/"],
    changeFrequency: "monthly",
    priority: 0.9,
  },
  {
    path: "/practice-papers",
    primaryQuery: "free A-Level practice papers",
    secondaryQueries: ["A-Level Maths practice paper with mark scheme", "OCR A-Level Physics practice questions", "Edexcel A-Level Maths practice paper", "A-Level Physics practice paper free", "A-Level exam practice questions with answers"],
    intent: "Find more full papers to practise on once the past papers run out, with a mark scheme to check them.",
    objective: "Show the student what's in each Plumi pack and get them into the Discord, where the packs are free.",
    title: "Free A-Level Practice Papers With Mark Schemes | Plumi",
    h1: "Practice papers, written by us.",
    description:
      "Free A-Level Maths and Physics practice packs written by Plumi: 30 exam-style questions each, easy to super hard, with full mark schemes. Free in the Plumi Discord.",
    // Each pack's own page (/practice-papers/<slug>) is generated from src/content/practicePacks.ts
    // and added to the sitemap by src/app/sitemap.ts.
    linksTo: ["/past-papers", "/question-bank", "/ai-tutor-for-a-level-maths"],
    changeFrequency: "monthly",
    priority: 0.9,
    lastModified: "2026-10-25",
  },
  {
    path: "/past-papers",
    primaryQuery: "GCSE and A-Level past papers",
    secondaryQueries: ["A-Level past papers", "GCSE past papers", "A-Level Maths past papers", "A-Level Chemistry past papers", "AQA GCSE English Language past papers", "Edexcel GCSE Computer Science past papers", "Edexcel A-Level Economics B past papers", "AQA GCSE Geography past papers", "A-Level English Literature past papers", "AQA GCSE English Literature past papers", "free past papers and mark schemes"],
    intent: "Find the past papers and mark schemes for my subject and exam board, free.",
    objective: "Get the student to their board's papers in two clicks, then give them a reason to sit one in Plumi.",
    title: "Free GCSE & A-Level Past Papers and Mark Schemes | Plumi",
    h1: "Free GCSE & A-Level past papers",
    description:
      "Every Maths, Further Maths, Biology, Chemistry and Physics past paper and mark scheme for AQA, Edexcel, OCR, WJEC, Eduqas and Cambridge. Free, no sign-up.",
    // The subject and board pages under /past-papers are generated from data and
    // added to the sitemap by src/app/sitemap.ts; their metadata is src/lib/pastPaperMeta.ts.
    linksTo: ["/ai-tutor-for-a-level-maths"],
    changeFrequency: "monthly",
    priority: 0.9,
    lastModified: "2026-10-31",
  },
  {
    path: "/question-bank",
    primaryQuery: "A-Level question bank",
    secondaryQueries: ["GCSE question bank", "GCSE Maths questions by topic", "AQA GCSE Maths questions by topic", "Edexcel GCSE Maths questions by topic", "OCR GCSE Maths questions by topic", "AQA GCSE Physics questions by topic", "AQA GCSE Chemistry questions by topic", "AQA GCSE Biology questions by topic", "Edexcel GCSE Combined Science questions by topic", "Edexcel A-Level Maths questions by topic", "AQA A-Level Chemistry questions by topic", "AQA A-Level Biology exam questions by topic", "AQA A-Level Physics questions by topic", "Edexcel A-Level Chemistry questions by topic", "Edexcel A-Level Biology questions by topic", "Edexcel A-Level Physics questions by topic", "Edexcel A-Level Economics A questions by topic", "Edexcel A-Level Economics B questions by topic", "OCR A-Level Economics questions by topic", "OCR A-Level Law questions by topic", "Edexcel A-Level Psychology questions by topic", "Edexcel A-Level Politics questions by topic", "OCR A-Level Computer Science questions by topic", "AQA A-Level Computer Science questions by topic", "Edexcel GCSE Computer Science questions by topic", "AQA A-Level Sociology questions by topic", "AQA A-Level Business questions by topic", "AQA A-Level Geography questions by topic", "OCR A-Level Chemistry questions by topic", "OCR A-Level Biology questions by topic", "OCR A-Level Physics questions by topic", "OCR MEI A-Level Maths questions by topic", "OCR MEI Further Maths questions by topic", "OCR A-Level Maths questions by topic", "CAIE A Level Maths questions by topic", "CAIE A Level Chemistry questions by topic", "CAIE A Level Biology questions by topic", "CAIE A Level Physics questions by topic", "Cambridge International AS & A Level Further Maths questions by topic", "IGCSE Maths questions by topic", "IGCSE Biology questions by topic", "IGCSE Chemistry questions by topic", "IGCSE Physics questions by topic", "Cambridge IGCSE Additional Maths questions by topic", "AQA GCSE English Language questions by topic", "Eduqas GCSE Religious Studies questions by topic", "Eduqas GCSE History questions by topic", "AQA GCSE Geography questions by topic", "Edexcel GCSE Geography B questions by topic", "Edexcel A-Level English Literature questions by topic", "OCR A-Level English Literature questions by topic", "past paper questions by topic"],
    intent: "Practise exam questions on one topic, with the mark scheme to hand.",
    objective: "Get the student to their subject's bank in one click; the bank does the rest.",
    title: "GCSE & A-Level Question Bank: Questions by Topic | Plumi",
    h1: "GCSE and A-Level questions, one at a time",
    description:
      "Every AQA GCSE and A-Level science, Edexcel, OCR and CAIE A-Level science, CAIE IGCSE science and maths, and Edexcel, OCR, OCR MEI and CAIE A-Level Maths exam question, sorted by topic, with its mark scheme and examiner's report. Free, no sign-up.",
    // The subject and topic pages under /question-bank come from data; see src/app/sitemap.ts.
    linksTo: ["/past-papers"],
    changeFrequency: "monthly",
    priority: 0.9,
    lastModified: "2026-10-31",
  },
  {
    path: "/goodnotes-alternative-for-students",
    primaryQuery: "Goodnotes alternative for students",
    secondaryQueries: ["Goodnotes vs Plumi", "free Goodnotes alternative iPad", "Notability alternative students", "note taking app that tutors you"],
    intent: "Compare against the note app I already pay for.",
    objective: "Be scrupulously fair about Goodnotes, and clear about the one thing it does not do.",
    title: "Goodnotes Alternative for Students: Notes That Tutor",
    h1: "A Goodnotes alternative that teaches, not just stores",
    description:
      "Everything you expect from a notes app, from handwriting to folders and PDFs, free. The difference is Plumi reads what you wrote and helps you with it.",
    linksTo: ["/ai-tutor-for-a-level-maths", "/"],
    changeFrequency: "monthly",
    priority: 0.8,
    lastModified: "2026-10-23",
  },
  {
    path: "/about",
    primaryQuery: "what is Plumi",
    secondaryQueries: ["Plumi about", "who makes Plumi", "Plumi study app company"],
    intent: "Work out who is behind this and whether it is credible.",
    objective: "State plainly what Plumi is, who it is for, and why it exists. No invented history.",
    title: "About Plumi: The GCSE and A-Level Revision App",
    h1: "About Plumi",
    description:
      "Plumi is a GCSE and A-Level revision app for iPad that marks your handwritten answers. What it is, who it is for, and why it exists.",
    linksTo: ["/", "/privacy"],
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: "/android",
    primaryQuery: "Plumi for Android",
    secondaryQueries: ["Plumi Android app", "GCSE revision app for Android"],
    intent: "An Android student wants to know whether Plumi is on their phone or tablet.",
    objective: "Say plainly that Plumi is on iPad today, and take an email so they hear when Android is ready.",
    title: "Plumi for Android: Join the Waitlist",
    h1: "Plumi for Android is coming.",
    description:
      "Plumi, the GCSE and A-Level revision app that marks your handwriting, is on iPad now. Join the Android waitlist and we will email you when it arrives.",
    linksTo: ["/", "/about"],
    changeFrequency: "monthly",
    priority: 0.4,
    lastModified: "2026-10-30",
  },
  {
    path: "/parents",
    primaryQuery: "Plumi for parents",
    secondaryQueries: ["is Plumi safe", "is Plumi worth it", "revision app for my child"],
    intent: "A parent whose child asked for Plumi wants to know what it is and whether it is safe.",
    objective: "Show the app marking real work and answer a parent's concerns as tiles, then send them to the App Store.",
    title: "Plumi for Parents: What It Is and Is It Safe",
    h1: "Plumi, explained for parents.",
    description:
      "Your child asked for Plumi, a GCSE and A-Level revision app for iPad that marks handwritten answers. What it does, and whether it is safe.",
    linksTo: ["/", "/privacy"],
    changeFrequency: "monthly",
    priority: 0.5,
    lastModified: "2026-10-23",
  },
  // The legal pages keep their own hand-written metadata and the " · Plumi"
  // title template; they are listed here so the sitemap includes them.
  {
    path: "/privacy",
    primaryQuery: "Plumi privacy policy",
    secondaryQueries: [],
    intent: "Check what happens to my data before I sign up.",
    objective: "Be findable and readable. People do search for these.",
    title: "Privacy",
    h1: "Privacy",
    description: "How Plumi handles your data.",
    linksTo: [],
    changeFrequency: "yearly",
    priority: 0.3,
    lastModified: "2026-10-14",
  },
  {
    path: "/terms",
    primaryQuery: "Plumi terms of service",
    secondaryQueries: [],
    intent: "Check the terms.",
    objective: "Be findable and readable.",
    title: "Terms",
    h1: "Terms",
    description: "The terms you agree to when you use Plumi.",
    linksTo: [],
    changeFrequency: "yearly",
    priority: 0.3,
    lastModified: "2026-10-23",
  },
] as const;

/** Lookup by path. Throws rather than silently rendering a page with no intent. */
export function intentFor(path: string): RouteIntent {
  const match = routeIntents.find((route) => route.path === path);
  if (!match) throw new Error(`No route intent registered for "${path}". Add one to src/config/routes.ts.`);
  return match;
}

/**
 * The variant landings (`/v/decide`, `/v/mirror`) are deliberately absent.
 * They are `noindex` duplicates of the homepage for paid traffic, and a
 * sitemap that lists noindex URLs is a sitemap Search Console complains about.
 */
export const indexableRoutes = routeIntents;
