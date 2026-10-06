/**
 * Copy for the search landing pages.
 *
 * Same rule as the homepage: a title, one short line, and the picture. Each
 * section is a heading and a single sentence, and every page ends as soon as
 * it has made its point. British English, no em dashes, and no claim the app
 * cannot meet.
 *
 * Pages that only repeated the homepage (how it works, handwriting, iPad) were
 * removed and redirect to it; see `redirects()` in next.config.ts.
 */

export interface LandingImage {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
}

export interface LandingSection {
  heading: string;
  /** One short line. */
  line: string;
  image?: LandingImage;
}

export interface LandingContent {
  /** Must match a path in src/config/routes.ts. */
  path: string;
  /** Used for analytics placements and test ids. */
  slug: string;
  /** Breadcrumb label for this page, shown after "Home". */
  breadcrumbLabel: string;
  eyebrow: string;
  lead: string;
  sections: readonly LandingSection[];
  closing: string;
}

const tutorCapture: LandingImage = {
  src: "/product/next-question.webp",
  alt: "Plumi Tutor handwriting in the margin beside a student's working: a green tick, the words Now try this one, and a new integral of e to the 3x.",
  caption: "A real Tutor session.",
  width: 1100,
  height: 300,
};

const recommendationCapture: LandingImage = {
  src: "/product/next-move.webp",
  alt: "Plumi Home recommending Electrical circuits, noted as still weak after four pieces of marked work, with a twelve minute four question practice set.",
  caption: "One recommendation, grounded in marked work.",
  width: 1400,
  height: 328,
};

const notebookCapture: LandingImage = {
  src: "/product/notebook.webp",
  alt: "A Plumi squared-paper notebook with the pen, pencil, highlighter, eraser, lasso and AI Pen tools along the bottom.",
  caption: "The notebook is free to write in.",
  width: 1400,
  height: 900,
};

export const aiTutorALevelMaths: LandingContent = {
  path: "/ai-tutor-for-a-level-maths",
  slug: "a-level-maths",
  breadcrumbLabel: "AI tutor for A-Level Maths",
  eyebrow: "A-Level Maths",
  lead: "Plumi reads the working on your page and asks before it tells.",
  sections: [
    {
      heading: "It reads your method",
      line: "Method marks are the point, so that is what Plumi marks.",
      image: tutorCapture,
    },
    {
      heading: "It asks first",
      line: "A question appears in the margin and you keep the pen.",
    },
    {
      heading: "It picks what to practise",
      line: "Every marked answer shapes your next short set.",
      image: recommendationCapture,
    },
    {
      heading: "Pure, Mechanics and Statistics",
      line: "Edexcel 9MA0 first, with other boards added over time.",
    },
  ],
  closing: "Bring your actual working.",
};

export const gcseMaths: LandingContent = {
  path: "/gcse-maths",
  slug: "gcse-maths",
  breadcrumbLabel: "GCSE Maths",
  eyebrow: "GCSE",
  lead: "Plumi marks your working and picks the next topic for you.",
  sections: [
    {
      heading: "Familiar is not secure",
      line: "Notes only count as seen. Marked right makes a topic secure.",
    },
    {
      heading: "One honest recommendation",
      line: "Home names the topic costing you marks, and why.",
      image: recommendationCapture,
    },
    {
      heading: "Short sets, aimed at the gap",
      line: "A handful of questions, answered by hand in the same notebook.",
    },
    {
      heading: "Where it is up to",
      line: "Topic coverage is deepest at A-Level and growing at GCSE.",
    },
  ],
  closing: "Stop guessing what to revise.",
};

export const goodnotesAlternative: LandingContent = {
  path: "/goodnotes-alternative-for-students",
  slug: "goodnotes-alternative",
  breadcrumbLabel: "Goodnotes alternative",
  eyebrow: "Switching from Goodnotes or Notability",
  lead: "A notebook that also reads what you wrote.",
  sections: [
    {
      heading: "Goodnotes is a good notes app",
      line: "If you only need somewhere to write, it does that well.",
    },
    {
      heading: "Plumi reads what you wrote",
      line: "It marks the working and helps in the margin.",
      image: tutorCapture,
    },
    {
      heading: "Writing is free",
      line: "Handwriting, pens, folders and PDFs cost nothing.",
      image: notebookCapture,
    },
  ],
  closing: "Keep the notebook. Add the part that teaches.",
};

export const about: LandingContent = {
  path: "/about",
  slug: "about",
  breadcrumbLabel: "About",
  eyebrow: "What this is",
  lead: "An AI study notebook for students who work things out by hand.",
  sections: [
    {
      heading: "What it is",
      line: "A notebook that reads your handwriting, marks it and plans your practice.",
    },
    {
      heading: "Who it is for",
      line: "GCSE and A-Level STEM students on iPad and Apple Pencil.",
    },
    {
      heading: "Why it exists",
      line: "Notes apps never read your working, and chatbots forget you.",
    },
  ],
  closing: "Come and see it.",
};

export const landingPages: readonly LandingContent[] = [
  aiTutorALevelMaths,
  gcseMaths,
  goodnotesAlternative,
  about,
];
