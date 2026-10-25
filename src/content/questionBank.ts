/**
 * The question bank: every question from AQA's GCSE and A-Level Biology, Chemistry
 * and Physics papers and Pearson Edexcel's A-Level Maths, Further Maths, Biology A
 * and B, Chemistry and Physics, OCR's and OCR MEI's A-Level sciences and maths, and
Cambridge International's (CAIE's) AS & A Level sciences and maths, cut out one at a time, each with its own mark scheme
 * rows and the examiner's report on its question, tagged to the topic of the
 * specification it tests.
 *
 * Built from the boards' own published papers by scripts/question-bank/ (AQA:
 * fetch_aqa.py, spec.py, cut.py, build_bank.py; Edexcel maths: the *_edexcel.py
 * scripts; Edexcel sciences: edexcel_sciences/; OCR: ocr/; CAIE: caie/). The images and PDFs are ours,
 * served from our storage (NEXT_PUBLIC_PAPERS_URL, Cloudflare R2 in production);
 * nothing links out.
 *
 * Each subject is two files: src/content/questionBank/<slug>.json carries the
 * topics, papers and series (read at build time), and public/question-bank/<slug>/
 * carries the parts list, the search text and the examiner's reports, which the
 * browser fetches only when it needs them.
 */
import biology from "./questionBank/aqa-a-level-biology.json";
import chemistry from "./questionBank/aqa-a-level-chemistry.json";
import physics from "./questionBank/aqa-a-level-physics.json";
import maths from "./questionBank/edexcel-a-level-maths.json";
import furtherMaths from "./questionBank/edexcel-a-level-further-maths.json";
import gcseBiology from "./questionBank/aqa-gcse-biology.json";
import gcseChemistry from "./questionBank/aqa-gcse-chemistry.json";
import gcsePhysics from "./questionBank/aqa-gcse-physics.json";
import edexcelBiologyA from "./questionBank/edexcel-a-level-biology-a.json";
import edexcelBiologyB from "./questionBank/edexcel-a-level-biology-b.json";
import edexcelChemistry from "./questionBank/edexcel-a-level-chemistry.json";
import edexcelPhysics from "./questionBank/edexcel-a-level-physics.json";
import ocrBiology from "./questionBank/ocr-a-level-biology-a.json";
import ocrChemistry from "./questionBank/ocr-a-level-chemistry-a.json";
import ocrPhysics from "./questionBank/ocr-a-level-physics-a.json";
import ocrMaths from "./questionBank/ocr-a-level-maths.json";
import ocrFurtherMaths from "./questionBank/ocr-a-level-further-maths.json";
import meiMaths from "./questionBank/ocr-mei-a-level-maths.json";
import meiFurtherMaths from "./questionBank/ocr-mei-a-level-further-maths.json";
import caieBiology from "./questionBank/caie-a-level-biology.json";
import caieChemistry from "./questionBank/caie-a-level-chemistry.json";
import caiePhysics from "./questionBank/caie-a-level-physics.json";
import caieMaths from "./questionBank/caie-a-level-maths.json";
import caieFurtherMaths from "./questionBank/caie-a-level-further-maths.json";

/**
 * `year`: 1 for AS content, 2 for A-Level only, 3 for a Physics Paper 3 option, 0 where the bank doesn't split by year (maths, GCSE).
 * `short`: a shorter name for a long specification title, for the page title ("Moles and gas volumes").
 * `ref`: the code as the specification prints it, where that isn't `code` ("6A");
 * empty where the specification gives the topic no code of its own, as with the
 * statement groups in Edexcel Biology A and Physics (`points`: "9–15").
 */
export interface BankTopic { code: string; ref?: string; points?: string; title: string; short?: string; section: string; slug: string; count: number; year: 0 | 1 | 2 | 3 }
export interface BankSection { code: string; title: string }
export interface BankPaper { id: string; name: string; title: string; as: boolean }
export interface BankSeries { id: string; label: string }

/** One question part, as listed. Short keys: the subject's list is fetched whole. */
export interface BankPart {
  id: string;
  /** Paper (component code), e.g. "74051", "9ch001". */
  p: string;
  /** Series, e.g. "JUN23". */
  s: string;
  /** Label as printed, e.g. "01.4", "3(b)(i)". */
  l: string;
  /** Marks, where the paper prints them. */
  m: number | null;
  /** Topic codes. */
  t: string[];
  /** Image size, so the card reserves its space. */
  w: number;
  h: number;
  /** Has a setup (the question's stem), a mark scheme crop, an examiner's report. */
  st?: 1;
  ms?: 1;
  er?: 1;
  /** No cropped scheme: the whole paper's mark scheme PDF, relative to the papers base. */
  msf?: string;
  /** A multiple-choice question's answer letter, where the scheme is a key rather than a table. */
  k?: string;
  /** Asks for a calculation. */
  calc?: 1;
  /** The opening words, for alt text and the static topic pages. */
  x: string;
}

export interface BankSubject {
  slug: string;
  board: "AQA" | "Edexcel" | "OCR" | "OCR MEI" | "CAIE";
  level: "A-Level" | "GCSE";
  subject: "Biology" | "Biology A" | "Biology B" | "Chemistry" | "Chemistry A" | "Physics" | "Physics A" | "Maths" | "Further Maths";
  /** Where the specification's name is longer: "Biology A (Salters-Nuffield)". */
  fullName?: string;
  specs: string[];
  sections: BankSection[];
  topics: BankTopic[];
  papers: BankPaper[];
  series: BankSeries[];
  /** The whole papers we host for each sitting: { "74051-JUN23": { qp, ms, er } }. */
  wholes: Record<string, Partial<Record<"qp" | "ms" | "er", string>>>;
  /** Maths: every question is a calculation, so the filter is left out. */
  noCalc?: boolean;
  /** Edexcel reports are keyed by question id; AQA's by the question its parts share. */
  reportsBy?: "question";
  /**
   * What the bank covers, where a range of years would mislead: Cambridge publishes only
   * one series (June 2024) and its specimen papers, so CAIE banks say so instead of "2024–2024".
   */
  scope?: string;
  count: number;
  firstYear: number;
  lastYear: number;
  /** The newest parts, server-rendered so the page is useful before any script runs. */
  sample: BankPart[];
}

export const bankSubjects = [maths, furtherMaths, biology, chemistry, physics, edexcelBiologyA, edexcelBiologyB, edexcelChemistry, edexcelPhysics, ocrBiology, ocrChemistry, ocrPhysics, ocrMaths, ocrFurtherMaths, meiMaths, meiFurtherMaths, caieMaths, caieFurtherMaths, caieBiology, caieChemistry, caiePhysics, gcseBiology, gcseChemistry, gcsePhysics] as BankSubject[];

export function bankSubject(slug: string): BankSubject | undefined {
  return bankSubjects.find(s => s.slug === slug);
}

export function bankTopic(subject: BankSubject, slug: string): BankTopic | undefined {
  return subject.topics.find(t => t.slug === slug);
}

export const bankPath = (slug: string) => `/question-bank/${slug}`;
export const bankTopicPath = (slug: string, topic: string) => `/question-bank/${slug}/${topic}`;
export const bankDataPath = (slug: string, file: "parts" | "text" | "reports" | `topic-${string}`) => `/question-bank/${slug}/${file}.json`;

/** Where our files live: R2 in production, a local folder in development. */
export const papersBase = (process.env.NEXT_PUBLIC_PAPERS_URL ?? "/papers-local").replace(/\/$/, "");
export const partImage = (id: string, kind: "qp" | "ms" | "stem") =>
  kind === "stem" ? `${papersBase}/bank/${id.replace(/-[^-]+$/, "")}-stem.webp` : `${papersBase}/bank/${id}-${kind}.webp`;
/** The examiner's report covers a whole question: "74051-jun23-01" (AQA parts share it); an Edexcel question is its own key. */
export const reportKey = (subject: Pick<BankSubject, "reportsBy">, id: string) => (subject.reportsBy === "question" ? id : id.split("-").slice(0, 3).join("-"));

/** Who owns the questions, for credits: "AQA", "Pearson Edexcel". */
export const bankOwner = (s: Pick<BankSubject, "board">) =>
  s.board === "Edexcel" ? "Pearson Edexcel" : s.board === "OCR MEI" ? "OCR" : s.board === "CAIE" ? "Cambridge University Press & Assessment" : s.board;
/** The years a bank's questions come from, or what it covers where that says more: "2016–2025", "June 2024 and the specimen papers". */
export const bankYears = (s: Pick<BankSubject, "scope" | "firstYear" | "lastYear">) => s.scope ?? `${s.firstYear}–${s.lastYear}`;
/** The subject without its specification letter: "Biology" for "Biology A". */
export const baseSubject = (s: Pick<BankSubject, "subject">) => s.subject.replace(/ [AB]$/, "");
/** The whole-paper library page for a bank's subject and board. */
export const bankPapersPath = (s: Pick<BankSubject, "board" | "level" | "subject">) =>
  `/past-papers/${s.level.toLowerCase()}-${baseSubject(s).toLowerCase().replace(/\s+/g, "-")}/${s.board === "CAIE" ? "cie" : s.board.toLowerCase().replace(/\s+/g, "-")}`;
/** The subject's share card, where it has its own. */
export const bankShareImage = (s: Pick<BankSubject, "subject">) =>
  ["Biology", "Chemistry", "Physics"].includes(baseSubject(s)) ? `/og-${baseSubject(s).toLowerCase()}.png` : "/og.png";

export function paperName(subject: BankSubject, id: string) {
  const p = subject.papers.find(x => x.id === id);
  return p ? p.name : id;
}
export function seriesLabel(subject: BankSubject, id: string) {
  return subject.series.find(x => x.id === id)?.label ?? id;
}
export function topicTitle(subject: BankSubject, code: string) {
  return subject.topics.find(t => t.code === code)?.title ?? code;
}
/** The code a student would know the topic by: "3.1.2", "6A", or none. */
export const topicRef = (t: BankTopic) => t.ref ?? t.code;
/** "3.1.2 Amount of substance", "6A Introduction to organic chemistry", "Momentum". */
export const topicName = (t: BankTopic) => (topicRef(t) ? `${topicRef(t)} ${t.title}` : t.title);
/** The question number a part belongs to: "01" of "01.4", "3" of "3(b)(i)". */
export const questionOf = (label: string) => label.match(/^\d+/)?.[0] ?? label;

/** "AQA A-Level Chemistry" */
export const bankTitle = (s: Pick<BankSubject, "board" | "level" | "subject">) => `${s.board} ${s.level} ${s.subject}`;
