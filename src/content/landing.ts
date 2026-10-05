/**
 * Copy for the search landing pages.
 *
 * House rules, inherited from src/content/copy.ts and still binding:
 *   · British English.
 *   · Concrete nouns. "Integration by parts", "three marks", "OCR". Specificity
 *     is the only affordable proof when there are no testimonials.
 *   · No claim here is made that the product cannot do.
 *
 * One rule is deliberately relaxed. copy.ts says the word "AI" appears in
 * exactly one place on the site and never in a headline — a good rule for a
 * premium brand surface, and the wrong rule for a page whose entire job is to
 * be found by someone who typed "AI tutor for A-Level Maths" into Google. A
 * page that refuses to use the words its reader used cannot rank for them. So:
 * the homepage hero keeps its restraint, and these pages say "AI" where the
 * searcher did. That is a considered trade, not an oversight.
 *
 * On honesty. Plumi has not launched. Every screen is a real development
 * capture, spec coverage is genuinely uneven, and none of these pages may imply
 * otherwise — the credibility of a pre-launch site is the only asset it has.
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
  body: readonly string[];
  bullets?: readonly string[];
  image?: LandingImage;
}

export interface LandingFaq {
  question: string;
  answer: string;
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
  faqs?: readonly LandingFaq[];
  closing: string;
}

const tutorCapture: LandingImage = {
  src: "/product/next-question.webp",
  alt: "Plumi Tutor handwriting in the margin beside a student's working: a green tick, the words Now try this one, and a new integral of e to the 3x.",
  caption: "A real Tutor session. Plumi answers in handwriting, in the margin.",
  width: 1100,
  height: 300,
};

const recommendationCapture: LandingImage = {
  src: "/product/next-move.webp",
  alt: "Plumi Home recommending Electrical circuits, noted as still weak after four pieces of marked work, with a twelve minute four question practice set.",
  caption: "One recommendation, grounded in work Plumi has actually marked.",
  width: 1400,
  height: 328,
};

const notebookCapture: LandingImage = {
  src: "/product/notebook.webp",
  alt: "A Plumi squared-paper notebook with the pen, pencil, highlighter, eraser, lasso and AI Pen tools along the bottom.",
  caption: "The notebook half: handwriting, folders and PDFs, free to use.",
  width: 1400,
  height: 900,
};

export const howItWorks: LandingContent = {
  path: "/how-it-works",
  slug: "how-it-works",
  breadcrumbLabel: "How it works",
  eyebrow: "The mechanism, start to finish",
  lead: "Four steps, and none of them involve typing your question into a chat box. Here is what actually happens between you writing a line of working and Plumi knowing what you should revise.",
  sections: [
    {
      heading: "1. You write, exactly as you already do",
      body: [
        "Plumi is a notebook first. You open it, pick a pen, and write on ruled or squared paper with your Apple Pencil — the same way you would in Goodnotes or Notability, or on paper.",
        "There is no separate “ask the tutor” mode to switch into, and nothing to photograph. The work you would have done anyway is the input.",
      ],
      image: notebookCapture,
    },
    {
      heading: "2. Plumi reads the working, not just the answer",
      body: [
        "Handwritten maths is not handwritten prose. A line of working carries fractions, indices, integral signs, substitutions and crossings-out, and the order they were written in matters as much as the symbols themselves.",
        "Plumi reads that structure. It is looking at the method you used to get somewhere, which is the part a photograph of a final answer throws away — and the part your exam marks actually come from.",
      ],
    },
    {
      heading: "3. The tutoring happens in the margin",
      body: [
        "When you get stuck, Plumi writes beside your work rather than replacing it. Its first move is a question, not a solution: on the capture below it asks what the derivative of e to the 2x is, because the student had dropped the factor of one half.",
        "You keep the pen. You answer in your own handwriting, and Plumi responds to what you wrote. If you want the answer outright you can have it, but that is not where it starts — being handed a worked solution is how you end up recognising a method without being able to produce one.",
      ],
      image: tutorCapture,
    },
    {
      heading: "4. What the work proves becomes what you practise",
      body: [
        "Every piece of marked work updates a picture of your course: which topics you have demonstrated, which you have only read about, and which keep costing you marks.",
        "Notes alone do not count. Writing a page on electrical circuits makes the topic seen; getting circuit questions right is what makes it secure. That distinction is the whole point — it is why Plumi can open on one honest recommendation instead of a list of everything you have ever touched.",
      ],
      bullets: [
        "Topics you have proved you can do are left alone.",
        "Topics you got wrong come back as short, targeted sets.",
        "Start a Focus session and the apps that usually win go quiet until you are done.",
      ],
      image: recommendationCapture,
    },
  ],
  faqs: [
    {
      question: "Does Plumi need me to type anything?",
      answer:
        "No. You write with an Apple Pencil and Plumi reads the handwriting directly. There is no prompt box to fill in and no photograph to upload.",
    },
    {
      question: "Which subjects and exam boards does it know?",
      answer:
        "Plumi carries topic data for specific specifications, currently including Edexcel Maths 9MA0, OCR Physics H556 and AQA Chemistry 7405, with more being added. Coverage is uneven by design rather than universal, so check your own specification before relying on it.",
    },
    {
      question: "Can I use it just as a notebook?",
      answer:
        "Yes, and for free. Handwriting, folders, PDF annotation and the full set of pens are free to use and intended to stay that way. The tutoring is the part that becomes paid.",
    },
  ],
  closing: "See it before anyone else.",
};

export const aiTutorALevelMaths: LandingContent = {
  path: "/ai-tutor-for-a-level-maths",
  slug: "a-level-maths",
  breadcrumbLabel: "AI tutor for A-Level Maths",
  eyebrow: "A-Level Maths",
  lead: "Most AI maths help begins with you retyping a question you have already written out by hand. Plumi starts from the working that is on your page — including the line where it went wrong.",
  sections: [
    {
      heading: "The problem with asking a chatbot for maths help",
      body: [
        "To get help from a general chatbot you first have to describe your problem to it: retype the question, explain the method you were told to use, and somehow convey four lines of algebra that contain a fraction and an integral sign. By the time you have done that, you have spent longer on transcription than on maths.",
        "Then it hands you a complete, confident solution. That is genuinely useful for checking an answer and close to useless for learning a method, because reading a correct solution feels identical to being able to produce one right up until the moment you sit an exam.",
      ],
    },
    {
      heading: "What Plumi does instead",
      body: [
        "Your working is already on the page, so there is nothing to describe. Plumi reads it, finds the step that broke, and writes a question in the margin next to it.",
        "In the capture below the student has integrated e to the 2x and lost the factor of one half. Plumi does not write the correct answer. It asks what the derivative of e to the 2x is, waits for the student to write 2e to the 2x, and lets them work out what would undo it.",
      ],
      image: tutorCapture,
    },
    {
      heading: "Method marks are the point",
      body: [
        "A-Level Maths does not mark answers, it marks method. You can arrive at the wrong number and keep most of the marks, or write the right number with nothing to justify it and lose them.",
        "Because Plumi works from your written method rather than your final answer, that is the thing it can see and comment on. A tool that only ever sees the number at the bottom of the page structurally cannot tell you why you dropped two marks.",
      ],
      bullets: [
        "Reads fractions, indices, integrals and substitutions as structure, not as a picture.",
        "Nudges with a question before it offers a solution.",
        "Records what your working demonstrated, so the next practice set is not random.",
      ],
    },
    {
      heading: "Then it picks what you do next",
      body: [
        "Every marked piece of work updates a model of your specification. The topic you keep getting wrong stops being a vague worry and becomes a named branch with evidence behind it.",
        "Plumi then generates practice against that specific weakness — the same idea, one twist — rather than another mixed paper where you spend most of the time on things you can already do.",
      ],
      image: recommendationCapture,
    },
    {
      // The page ranked for "A-Level Maths tutor AI" while never naming a
      // single thing on the A-Level Maths course — no Pure, no Mechanics, no
      // Statistics, no past papers, no grades. A page about the mechanism is
      // not the same as a page about the subject, and a reader deciding whether
      // this covers *their* course had nothing to go on.
      heading: "What it covers: Pure, Mechanics and Statistics",
      body: [
        "A-Level Maths is two Pure papers and one split between Statistics and Mechanics, and Plumi works from the specification rather than from a generic idea of “maths”. Edexcel 9MA0 is the board it carries the most topic data for today.",
        "In Pure that means the things that actually cost marks: differentiation and integration, integration by parts and by substitution, trigonometric identities, exponentials and logarithms, sequences and series, proof, vectors and parametric equations. In Mechanics, kinematics, forces, moments and projectiles. In Statistics, probability, distributions, sampling and hypothesis testing.",
        "Coverage is genuinely uneven across boards, and saying otherwise would be the easiest lie on this page. Check your own specification before you rely on it.",
      ],
      bullets: [
        "Whole past papers marked question by question, with where the marks went.",
        "Marking against your board's actual mark scheme, with the option to challenge a mark and have it re-marked.",
        "Predicted grades built from your timed papers, never from guesswork.",
        "Exam Mode turns the help off when you sit a timed paper, because that is the room you are practising for.",
      ],
    },
    {
      heading: "What it costs",
      body: [
        "The notebook is free forever and never metered: writing, notebooks, folders, search, ruled, grid, dotted, Cornell and graph paper, importing a PDF and writing straight onto it, and Focus Mode.",
        "The intelligence is metered rather than locked on the free tier, so you get a go at all of it every day — 12 AI Pen answers, 5 marks, 10 practice questions and one Tutor Mode session. Your first AI Pen answer, your first tutoring exchange and your first mark never count against it.",
        "Plumi Pro removes the meter and adds full mark-scheme marking, adaptive practice and a whole paper marked question by question. It is £79.99 a year with the first seven days free — £6.67 a month — or £19.99 a month with no trial. Billed through the App Store; cancel it in your Apple account.",
      ],
    },
  ],
  faqs: [
    {
      question: "Is Plumi free?",
      answer:
        "The notebook is free forever and never metered. The tutoring is metered rather than locked: on the free tier you get 12 AI Pen answers, 5 marks, 10 practice questions and one Tutor Mode session a day. Plumi Pro removes the meter: £79.99 a year with seven days free, or £19.99 a month.",
    },
    {
      question: "Can it mark a whole past paper?",
      answer:
        "Yes, question by question, against your exam board's actual mark scheme, showing where the marks went rather than just a total. If you think a mark is wrong you can challenge it and have it re-marked. This is a Plumi Pro feature.",
    },
    {
      question: "Can it predict my grade?",
      answer:
        "It predicts from timed papers you have actually sat in the app, never from guesswork or from how much you have revised. A prediction built from anything other than your own marked work would not be worth having.",
    },
    {
      question: "Is this better than ChatGPT for A-Level Maths?",
      answer:
        "It is built for a different job. A general chatbot is excellent at explaining a concept you can describe in words. Plumi is built to read the handwritten working you have already done, find the step that broke, and remember the result — which is the part a chat window starts from scratch on every time.",
    },
    {
      question: "Which A-Level Maths specification does it cover?",
      answer:
        "Edexcel Maths 9MA0 is the specification Plumi carries the most topic data for today, with others being added. Coverage is genuinely uneven, so check yours rather than assuming every board is supported.",
    },
    {
      question: "Does it do Further Maths and Physics too?",
      answer:
        "Physics is supported, with OCR Physics H556 among the specifications Plumi knows. Further Maths coverage is thinner at this stage. The community is the fastest way to find out where your own course stands.",
    },
    {
      question: "Do I need an iPad?",
      answer:
        "Yes. Plumi is built around handwriting with an Apple Pencil on iPad, and that is the only way to use it at launch.",
    },
  ],
  closing: "Bring your actual working. That is the whole idea.",
};

export const aiHandwritingTutor: LandingContent = {
  path: "/ai-handwriting-tutor",
  slug: "handwriting-tutor",
  breadcrumbLabel: "AI handwriting tutor",
  eyebrow: "Reading what you wrote",
  lead: "Nearly every AI study tool wants typed text or a photograph of a finished answer. Plumi is built the other way round: handwriting is the input, and the working is the interesting part.",
  sections: [
    {
      heading: "Why handwriting is the hard case",
      body: [
        "Reading handwritten prose is a solved-enough problem. Reading handwritten maths and physics is not, because the meaning is in the layout as much as the characters — a number sitting above a line is a numerator, the same number half a size smaller and raised is an index, and a bracket three lines tall changes what all of it applies to.",
        "Add the things a real page has and a clean transcription model has not seen: a crossing-out, an arrow to the margin, a substitution written above a term, a step abandoned halfway.",
      ],
    },
    {
      heading: "What Plumi reads",
      body: [
        "Plumi reads that structure rather than flattening the page into a line of text, which is what lets it point at a specific step rather than commenting on the page as a whole.",
        "It matters because the step is where the teaching is. “This is wrong” helps nobody; “the substitution on line three is fine, but you have not changed the limits” is a lesson.",
      ],
      bullets: [
        "Fractions, indices, integrals, vectors and bracket scope read as structure.",
        "Crossings-out and abandoned steps treated as what they are, not as errors.",
        "Your own handwriting stays on the page — Plumi writes beside it, never over it.",
      ],
      image: tutorCapture,
    },
    {
      heading: "Writing it out is not an inconvenience",
      body: [
        "There is a decent argument that handwriting is the point rather than an obstacle to be automated away. Working something out by hand is slower than typing, and the slowness is doing something: it is where you notice that a step does not follow.",
        "So Plumi is not trying to get you to stop writing. It is trying to be useful while you do — which is why the tutoring appears in the margin, in handwriting, and why you keep the pen throughout.",
      ],
    },
  ],
  faqs: [
    {
      question: "Does my handwriting have to be neat?",
      answer:
        "It has to be legible to a person. Plumi is built for the way students actually write under time pressure, including crossings-out and cramped working, rather than for a fair copy.",
    },
    {
      question: "Does it work on a photo of paper?",
      answer:
        "No. Plumi reads what you write in the app on iPad, which is what lets it see the order steps were written in and respond while you are still working, rather than after the fact.",
    },
  ],
  closing: "Write it out. Plumi reads the working.",
};

export const gcseMaths: LandingContent = {
  path: "/gcse-maths",
  slug: "gcse-maths",
  breadcrumbLabel: "GCSE Maths",
  eyebrow: "GCSE",
  lead: "The hardest part of GCSE revision is not the maths. It is working out which of forty topics is the one currently costing you marks, when everything in your notes looks equally familiar.",
  sections: [
    {
      heading: "Familiar is not the same as secure",
      body: [
        "Reading your notes on circle theorems makes them feel known. That feeling is recognition, and it disappears the moment you are looking at a blank page under a clock.",
        "Plumi separates the two on purpose. A topic you have written notes on is marked as seen, and nothing more. It only becomes secure when you have been marked right on questions about it.",
      ],
    },
    {
      heading: "Your marked work decides what comes next",
      body: [
        "You write your GCSE maths in Plumi as normal. It marks the working, and each result updates a picture of your course rather than disappearing into a page you will never reopen.",
        "So Home has one recommendation on it, with the reason attached — the topic, how many pieces of marked work it is based on, and roughly how long the practice will take.",
      ],
      image: recommendationCapture,
    },
    {
      heading: "Short sets, aimed at the gap",
      body: [
        "When Plumi finds a weakness it builds practice against that specific idea, usually a handful of questions rather than a full paper. The point is to fix the thing and get back to work, not to fill an afternoon.",
        "You answer by hand, in the same notebook, and Plumi marks it the same way — so the practice is itself evidence, and the picture gets sharper each time.",
      ],
      bullets: [
        "Short targeted sets instead of another mixed paper.",
        "Answered in handwriting, marked the same way as your notes.",
        "Focus sessions quiet the apps that usually win, for as long as you asked.",
      ],
    },
  ],
  faqs: [
    {
      question: "Is Plumi only for A-Level?",
      answer:
        "No, it is built for GCSE and A-Level. Topic coverage is deepest where a specification has been added, and those currently skew towards A-Level Maths and Physics, so check your own board before relying on it.",
    },
    {
      question: "Is it free?",
      answer:
        "The notebook is free and intended to stay free: handwriting, folders, PDF annotation and the full set of pens. The tutoring and practice are the paid part. Plumi launches on 25 September 2026.",
    },
  ],
  closing: "Stop guessing what to revise.",
};

export const ipadStudyApp: LandingContent = {
  path: "/ipad-study-app",
  slug: "ipad-study-app",
  breadcrumbLabel: "iPad study app",
  eyebrow: "iPad and Apple Pencil",
  lead: "The usual iPad setup is three apps: one to write in, one to ask for help, and one to drill with. Nothing you write in the first is visible to the other two, so you become the integration layer.",
  sections: [
    {
      heading: "The three-app problem",
      body: [
        "It works, in the sense that each app does its job. The cost is that you spend your revision moving information between them by hand: retyping a question into a chatbot, deciding for yourself which topic to drill, keeping the whole picture of what you can and cannot do in your head.",
        "That last part is the expensive one. Nothing in the setup remembers last Tuesday, so the decision about what to revise falls to you every time, and it is the decision you are least equipped to make.",
      ],
    },
    {
      heading: "One notebook that notices",
      body: [
        "Plumi puts the three in one place, and the joins are where the value is. You write with Apple Pencil the way you already do. When you get stuck, help appears in the margin. What the work proves is recorded, and what it reveals becomes your next practice set.",
        "The notebook itself is a real notebook: pens, pencil, highlighter, eraser, lasso, folders per subject, PDFs you can annotate.",
      ],
      image: notebookCapture,
    },
    {
      heading: "Made for the Pencil, not adapted to it",
      body: [
        "Handwriting is the input, so latency and palm rejection are not polish, they are the product. Plumi is built for iPad and Apple Pencil specifically rather than shipped as a tablet version of a web app.",
        "There is no phone version and no browser version at launch, for the same reason: you cannot do four lines of algebra with your thumbs.",
      ],
      bullets: [
        "Requires iPadOS 17 or later and an Apple Pencil.",
        "Free to write in — the notebook is not the thing being sold.",
        "Focus sessions hold other apps shut until your session ends.",
      ],
    },
  ],
  faqs: [
    {
      question: "What do I need to run it?",
      answer: "An iPad running iPadOS 17 or later, and an Apple Pencil. Plumi launches on 25 September 2026.",
    },
    {
      question: "Is there an iPhone or web version?",
      answer:
        "Not at launch. Plumi is built around handwriting with a Pencil, which does not translate to a phone screen or a trackpad.",
    },
  ],
  closing: "One app instead of three.",
};

export const goodnotesAlternative: LandingContent = {
  path: "/goodnotes-alternative-for-students",
  slug: "goodnotes-alternative",
  breadcrumbLabel: "Goodnotes alternative",
  eyebrow: "Switching from Goodnotes or Notability",
  lead: "Goodnotes is a genuinely good notes app. This page is not going to pretend otherwise — the question worth asking is what a notebook should do once it can read what you wrote.",
  sections: [
    {
      heading: "What Goodnotes and Notability already do well",
      body: [
        "They are mature, fast, reliable handwriting apps with years of polish in them. If all you need is somewhere to write, organise and annotate PDFs, they do that well and Plumi is not claiming to do it better on day one.",
        "Being straight about that matters, because the honest difference is not “ours is a nicer notebook”.",
      ],
    },
    {
      heading: "The difference is what happens after you write",
      body: [
        "In any normal notes app, a page of working is stored and that is the end of it. The app does not know whether the integration on page four was right, and could not tell you what to revise if you asked.",
        "Plumi reads it. It marks the working, helps in the margin when you are stuck, and keeps a picture of which topics you have actually demonstrated. The notebook stops being a filing cabinet and starts being the thing that notices.",
      ],
      image: tutorCapture,
    },
    {
      heading: "And the writing part is free",
      body: [
        "Everything you would use a notes app for — handwriting, the full set of pens, folders per subject, PDF annotation — is free in Plumi and intended to stay free. If you know Goodnotes or Notability, you already know how it works.",
        "The paid part is the tutoring and the practice, which is the part no notes app offers at any price.",
      ],
      bullets: [
        "Free: handwriting, pens, folders, PDF annotation.",
        "Paid: on-page tutoring, marking, and practice built from your own work.",
        "Not yet: the years of polish those apps have. Plumi launches on 25 September 2026.",
      ],
      image: notebookCapture,
    },
  ],
  faqs: [
    {
      question: "Can I import my existing Goodnotes notebooks?",
      answer:
        "You can bring PDFs in and annotate them. A direct Goodnotes notebook import is not available at launch — worth raising in the community if it is what would decide it for you.",
    },
    {
      question: "Do I have to pay to take notes?",
      answer:
        "No. The notebook is free, and that is deliberate: the writing is not the part being sold.",
    },
    {
      question: "Is Plumi as polished as Goodnotes?",
      answer:
        "Not yet, and it would be strange to claim so before launch. Goodnotes has had years of refinement. What Plumi has is a notebook that can read what you wrote and do something useful with it.",
    },
  ],
  closing: "Keep the notebook. Add the part that teaches.",
};

export const about: LandingContent = {
  path: "/about",
  slug: "about",
  breadcrumbLabel: "About",
  eyebrow: "What this is",
  lead: "Plumi is an AI study notebook built for students who work things out by hand. It is made for STEM at A-Level and GCSE (Maths, Physics, Chemistry and Biology), and it runs on iPad and Apple Pencil.",
  sections: [
    {
      heading: "What Plumi does",
      body: [
        "You write in it the way you would write in any notebook — handwriting, folders per subject, PDFs you can annotate. That part is free and intended to stay free.",
        "The difference is that Plumi can read what you wrote. It marks your working, helps in the margin when you get stuck, keeps track of which topics you have actually demonstrated rather than merely read about, and turns the gaps into short practice sets.",
      ],
    },
    {
      heading: "Who it is for",
      body: [
        "GCSE and A-Level students in the UK, particularly ones doing Maths, Further Maths and Physics on an iPad. If your revision involves working problems out on a page rather than reading a textbook, that is the case Plumi is built around.",
        "Specification coverage is real but uneven — Edexcel Maths 9MA0, OCR Physics H556 and AQA Chemistry 7405 are among the specifications Plumi carries topic data for, with more being added. We would rather say that plainly than claim every board.",
      ],
    },
    {
      heading: "Why it exists",
      body: [
        "The tools a student has are good at separate things and bad at the join. A notes app stores your working and never reads it. A chatbot will help, but only with what you can be bothered to retype, and it forgets you between conversations. A tutor does all of it and costs more per hour than most families can spend every week.",
        "The gap is a notebook that notices. Not one that answers faster, but one that can see the method you actually used, remember it, and know on Tuesday what you got wrong on Sunday. That is the thing we are building.",
      ],
    },
    {
      heading: "Where it is up to",
      body: [
        "Plumi has not launched. Every screen on this website is a real development capture rather than a mockup, and nothing here is claimed that the app cannot do — but it is pre-launch software and should be read that way.",
        "The community is where the build is happening in the open. It is the fastest way to see it working, ask whether your specification is covered, and shape what gets built next.",
      ],
    },
  ],
  closing: "Come and see it being built.",
};

export const landingPages: readonly LandingContent[] = [
  howItWorks,
  aiTutorALevelMaths,
  aiHandwritingTutor,
  gcseMaths,
  ipadStudyApp,
  goodnotesAlternative,
  about,
];
