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
    h1: "Handwrite your answer. See the line that cost you marks.",
    description:
      "Answer GCSE and A-Level questions for AQA, OCR or Edexcel with Apple Pencil. Plumi marks your working against each question's own mark scheme.",
    linksTo: ["/physics-revision", "/chemistry-revision", "/biology-revision", "/ai-tutor-for-a-level-maths", "/gcse-maths", "/about"],
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/ai-tutor-for-a-level-maths",
    primaryQuery: "AI tutor for A-Level Maths",
    secondaryQueries: ["A-Level Maths AI tutor", "AI maths tutor A Level", "best AI for A-Level Maths", "AI tutor vs ChatGPT for maths", "AI past paper marking A-Level Maths", "AI predicted grade A-Level Maths", "is there a free AI maths tutor"],
    intent: "Find an AI that can actually help with A-Level Maths working, not just final answers.",
    objective: "Show tutoring happening on real handwritten working, and why that beats retyping into a chatbot.",
    title: "AI Tutor for A-Level Maths That Reads Your Working",
    h1: "An AI tutor for A-Level Maths that understands your working",
    description:
      "Most AI maths help starts with retyping the question. Plumi reads the working already on your page, nudges before it answers, and practises what you got wrong.",
    linksTo: ["/gcse-maths", "/goodnotes-alternative-for-students", "/"],
    changeFrequency: "monthly",
    priority: 0.9,
  },
  {
    path: "/gcse-maths",
    primaryQuery: "AI study app for GCSE",
    secondaryQueries: ["GCSE maths AI tutor", "AI revision app GCSE", "GCSE maths revision iPad"],
    intent: "Find a revision tool for GCSE that shows what to work on next.",
    objective: "Speak to GCSE specifically, and be honest about which specs are covered.",
    title: "AI Study App for GCSE Maths Revision | Plumi",
    h1: "GCSE revision that knows what you should do next",
    description:
      "Plumi marks your handwritten GCSE maths, spots the topics costing you marks, and turns them into short targeted practice. Built for iPad and Apple Pencil.",
    linksTo: ["/ai-tutor-for-a-level-maths", "/"],
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/physics-revision",
    primaryQuery: "physics revision app",
    secondaryQueries: ["A-Level Physics revision app", "GCSE Physics revision", "AQA Physics revision", "OCR Physics revision", "Edexcel Physics revision", "Physics exam questions marked"],
    intent: "Find a Physics revision tool for my board that marks exam answers and shows what to revise next.",
    objective: "Show Physics questions marked line by line, and list every unit of every Physics specification Plumi tracks.",
    title: "GCSE & A-Level Physics Revision App for iPad | Plumi",
    h1: "Physics questions, marked on your working.",
    description:
      "GCSE and A-Level Physics questions in AQA, OCR or Edexcel style. Show your working on iPad and each mark lands on the line that won or lost it.",
    linksTo: ["/", "/chemistry-revision", "/biology-revision"],
    changeFrequency: "monthly",
    priority: 0.9,
  },
  {
    path: "/chemistry-revision",
    primaryQuery: "chemistry revision app",
    secondaryQueries: ["A-Level Chemistry revision app", "GCSE Chemistry revision", "AQA Chemistry revision", "OCR Chemistry revision", "Edexcel Chemistry revision"],
    intent: "Find a Chemistry revision tool for my board that marks exam answers and shows what to revise next.",
    objective: "Show Chemistry questions marked line by line, and list every unit of every Chemistry specification Plumi tracks.",
    title: "GCSE & A-Level Chemistry Revision App for iPad | Plumi",
    h1: "Write 57.1 kJ where the scheme says 57,100 J. You still get the mark.",
    description:
      "GCSE and A-Level Chemistry in AQA, OCR or Edexcel style. Handwrite the working on iPad. Where the scheme gives a value, Plumi checks yours by arithmetic.",
    linksTo: ["/", "/physics-revision", "/biology-revision"],
    changeFrequency: "monthly",
    priority: 0.9,
  },
  {
    path: "/biology-revision",
    primaryQuery: "biology revision app",
    secondaryQueries: ["A-Level Biology revision app", "GCSE Biology revision", "AQA Biology revision", "OCR Biology revision", "Edexcel Biology revision"],
    intent: "Find a Biology revision tool for my board that marks exam answers and shows what to revise next.",
    objective: "Show Biology questions marked line by line, and list every unit of every Biology specification Plumi tracks.",
    title: "GCSE & A-Level Biology Revision App for iPad | Plumi",
    h1: "A Biology notebook that marks your 6-markers too.",
    description:
      "GCSE and A-Level Biology questions in AQA, OCR or Edexcel style. Short answers marked point by point, 6-markers in levels where your board uses them.",
    linksTo: ["/", "/physics-revision", "/chemistry-revision"],
    changeFrequency: "monthly",
    priority: 0.9,
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
      "Plumi is an AI study notebook built for students who work things out by hand. What it is, who it is for, and why we are building it.",
    linksTo: ["/", "/privacy"],
    changeFrequency: "monthly",
    priority: 0.6,
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
