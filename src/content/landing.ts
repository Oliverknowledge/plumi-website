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
  /** Widest the figure is shown, in CSS pixels. For small captures and tall figures. */
  maxWidth?: number;
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

const projectileFigure: LandingImage = {
  src: "/site/diagram-mathsb.webp",
  alt: "A ball thrown at angle alpha from the top of a 34 m building, over an 8 m street, landing on the roof of a 14 m building.",
  caption: "A projectile question Plumi wrote, with its diagram drawn in.",
  width: 1200,
  height: 900,
  maxWidth: 640,
};

const topicMapZoom: LandingImage = {
  src: "/site/zoom-map3.webp",
  alt: "A close-up of a Plumi topic map: topic squares marked strong, developing or needs attention.",
  caption: "Your topic map: each square is a topic, coloured by your marked answers.",
  width: 470,
  height: 270,
  maxWidth: 520,
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
      heading: "Pick the topic, get a question",
      line: "Choose what keeps catching you out and Plumi writes you a question on it, with its own mark scheme.",
      image: projectileFigure,
    },
    {
      heading: "Pure, Mechanics and Statistics",
      line: "AQA, OCR and Edexcel, with your board's topics on your topic map.",
    },
  ],
  closing: "Bring your actual working.",
};

export const gcseMaths: LandingContent = {
  path: "/gcse-maths",
  slug: "gcse-maths",
  breadcrumbLabel: "GCSE Maths",
  eyebrow: "GCSE",
  lead: "Plumi marks your working, method marks included, against the question's own mark scheme.",
  sections: [
    {
      heading: "One answer isn't enough",
      line: "A topic turns Strong after more than one marked answer. Notes don't move it.",
    },
    {
      heading: "Your topic map",
      line: "Each topic on your spec gets a square, and your marked answers colour it in.",
      image: topicMapZoom,
    },
    {
      heading: "Pick a topic, get a question",
      line: "Plumi writes it in your board's style, and you answer by hand in the same notebook.",
    },
    {
      heading: "Your board",
      line: "AQA, OCR and Edexcel GCSE Maths, each with its own topic map.",
    },
  ],
  closing: "Write one answer and see where the marks went.",
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
      line: "A notebook that reads your handwriting and marks it against each question's own mark scheme.",
    },
    {
      heading: "Who it is for",
      line: "GCSE and A-Level students of Maths, Physics, Chemistry and Biology, on iPad.",
    },
    {
      heading: "Why it exists",
      line: "Notes apps keep your working. Plumi marks it.",
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
