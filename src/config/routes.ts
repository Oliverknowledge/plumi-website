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
 * `/a-level-maths`, and why there is no `/pricing`: the prices live in chapter 12 of the
 * homepage, and a page that can only ever repeat two numbers is a page that
 * competes with the one already ranking for the brand.
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
    // win "Plumi". The category follows. "Handwriting" is deliberately left to
    // /ai-handwriting-tutor rather than repeated here — two pages chasing the
    // same phrase is how you end up ranking neither.
    title: "Plumi — AI Study Notebook for A-Level & GCSE STEM",
    h1: "Your handwriting. Read, understood, visualised.",
    description:
      "Plumi is an AI study notebook for STEM at A-Level and GCSE: Maths, Physics, Chemistry and Biology. Write on your iPad, get tutored on the page, and practise exactly what your work reveals.",
    linksTo: ["/how-it-works", "/ai-tutor-for-a-level-maths", "/ai-handwriting-tutor", "/about"],
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/how-it-works",
    primaryQuery: "how does Plumi work",
    secondaryQueries: ["AI that reads handwriting", "how AI tutoring on iPad works", "handwriting AI tutor how it works"],
    intent: "Understand the actual mechanism before trusting it with my revision.",
    objective: "Explain the four steps honestly, including what it cannot do yet.",
    title: "How Plumi Works — Write, Get Tutored, Practise",
    h1: "How Plumi works",
    description:
      "Write on your iPad and Plumi reads the working, tutors you in the margin, records what the work proves, then picks your next question. Here is each step.",
    linksTo: ["/ai-tutor-for-a-level-maths", "/ai-handwriting-tutor", "/ipad-study-app", "/"],
    changeFrequency: "monthly",
    priority: 0.9,
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
    linksTo: ["/how-it-works", "/ai-handwriting-tutor", "/ipad-study-app", "/gcse-maths"],
    changeFrequency: "monthly",
    priority: 0.9,
  },
  {
    path: "/ai-handwriting-tutor",
    primaryQuery: "AI handwriting tutor",
    secondaryQueries: ["AI that reads handwritten maths", "handwriting recognition maths AI", "AI notebook for students"],
    intent: "Find AI that works from handwriting rather than typed text.",
    objective: "Own the capability itself — reading handwritten working — as the thing Plumi is for.",
    title: "AI Handwriting Tutor — Marks Your Written Working",
    h1: "An AI tutor that reads handwriting, not just typing",
    description:
      "Plumi reads handwritten maths and physics working on iPad — symbols, fractions, crossings-out — and tutors you in the margin without you retyping a thing.",
    linksTo: ["/how-it-works", "/ai-tutor-for-a-level-maths", "/ipad-study-app", "/about"],
    changeFrequency: "monthly",
    priority: 0.8,
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
    linksTo: ["/how-it-works", "/ai-tutor-for-a-level-maths", "/ipad-study-app", "/"],
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/ipad-study-app",
    primaryQuery: "iPad study app for A-Level Maths",
    secondaryQueries: ["best iPad app for A-Level Maths", "Apple Pencil maths revision", "iPad revision app students"],
    intent: "Set up the best possible study workflow on an iPad I already own.",
    objective: "Win the device-led search, then show why notes and tutoring in one app beats three apps.",
    title: "iPad Study App for A-Level Maths & Apple Pencil",
    h1: "The iPad study app that does more than hold your notes",
    description:
      "Notes, tutoring and practice in one iPad app. Write with Apple Pencil, get help in the margin, and let Plumi pick what to revise next. Free to write in.",
    linksTo: ["/goodnotes-alternative-for-students", "/ai-tutor-for-a-level-maths", "/how-it-works", "/"],
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/goodnotes-alternative-for-students",
    primaryQuery: "Goodnotes alternative for students",
    secondaryQueries: ["Goodnotes vs Plumi", "free Goodnotes alternative iPad", "Notability alternative students", "note taking app that tutors you"],
    intent: "Compare against the note app I already pay for.",
    objective: "Be scrupulously fair about Goodnotes, and clear about the one thing it does not do.",
    title: "Goodnotes Alternative for Students — Notes That Tutor",
    h1: "A Goodnotes alternative that teaches, not just stores",
    description:
      "Everything you expect from a notes app — handwriting, folders, PDFs — free. The difference is Plumi reads what you wrote and helps you with it.",
    linksTo: ["/ipad-study-app", "/how-it-works", "/ai-tutor-for-a-level-maths", "/"],
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/about",
    primaryQuery: "what is Plumi",
    secondaryQueries: ["Plumi about", "who makes Plumi", "Plumi study app company"],
    intent: "Work out who is behind this and whether it is credible.",
    objective: "State plainly what Plumi is, who it is for, and why it exists. No invented history.",
    title: "About Plumi — The AI Study Notebook",
    h1: "About Plumi",
    description:
      "Plumi is an AI study notebook built for students who work things out by hand. What it is, who it is for, and why we are building it.",
    linksTo: ["/how-it-works", "/", "/privacy"],
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
