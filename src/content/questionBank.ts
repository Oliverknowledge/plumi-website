/**
 * The question bank: every question from AQA's A-Level Biology, Chemistry and
 * Physics papers since 2017, cut out one part at a time, each with its own mark
 * scheme rows and the examiner's report on its question, tagged to the topic of
 * the specification it tests.
 *
 * Built from AQA's own published papers by scripts/question-bank/ (fetch_aqa.py,
 * spec.py, cut.py, build_bank.py). The images and PDFs are ours, served from our
 * storage (NEXT_PUBLIC_PAPERS_URL, Cloudflare R2 in production); nothing links out.
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

/** `year`: 1 for AS content, 2 for A-Level only, 3 for a Physics Paper 3 option, 0 where the bank doesn't split by year (maths). */
export interface BankTopic { code: string; title: string; section: string; slug: string; count: number; year: 0 | 1 | 2 | 3 }
export interface BankSection { code: string; title: string }
export interface BankPaper { id: string; name: string; title: string; as: boolean }
export interface BankSeries { id: string; label: string }

/** One question part, as listed. Short keys: the subject's list is fetched whole. */
export interface BankPart {
  id: string;
  /** Paper (component code), e.g. "74051". */
  p: string;
  /** Series, e.g. "JUN23". */
  s: string;
  /** Label as printed, e.g. "01.4". */
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
  board: "AQA" | "Edexcel";
  level: "A-Level";
  subject: "Biology" | "Chemistry" | "Physics" | "Maths" | "Further Maths";
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
  count: number;
  firstYear: number;
  lastYear: number;
  /** The newest parts, server-rendered so the page is useful before any script runs. */
  sample: BankPart[];
}

export const bankSubjects = [maths, furtherMaths, biology, chemistry, physics] as BankSubject[];

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
export const bankOwner = (s: Pick<BankSubject, "board">) => (s.board === "Edexcel" ? "Pearson Edexcel" : "AQA");
/** The whole-paper library page for a bank's subject and board. */
export const bankPapersPath = (s: Pick<BankSubject, "board" | "subject">) =>
  `/past-papers/a-level-${s.subject.toLowerCase().replace(/\s+/g, "-")}/${s.board.toLowerCase()}`;

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

/** "AQA A-Level Chemistry" */
export const bankTitle = (s: Pick<BankSubject, "board" | "level" | "subject">) => `${s.board} ${s.level} ${s.subject}`;
