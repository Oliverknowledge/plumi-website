/**
 * The question bank: every question from the boards' published papers, cut out one at a time, each with its own mark
 * scheme rows and the examiner's report on its question, tagged to the topic of the specification it tests.
 * `npm run bank:status` lists the banks. They're built from the boards' own papers by scripts/question-bank/, in a folder
 * per board and subject, with each bank's notes in docs/question-bank/banks/. The images and PDFs are ours, served from
 * our storage (NEXT_PUBLIC_PAPERS_URL, Cloudflare R2 in production); nothing links out.
 *
 * Each subject is two lots of files: src/content/questionBank/<slug>.json carries the
 * topics, papers and series (read at build time), and the bank's data (the parts list,
 * the search text, the examiner's reports) lives on R2 beside the crops, under its
 * content hash (bankDataUrl). The builders still write the data to public/question-bank/<slug>/,
 * which git ignores; scripts/question-bank/upload_data.py puts it on R2 and records the hashes
 * in the meta's `data`. The browser fetches it only when it needs it; the build reads parts.json
 * for the topic pages.
 */
import { papersBase } from "@/config/papers";

import { bankMetas, type BankSubjectName } from "./questionBank.generated";

/**
 * `year`: 1 for AS content, 2 for A-Level only, 3 for a Paper 3 option (Physics, Psychology), 0 where the bank doesn't split by year (maths, GCSE, IGCSE, the rest of Psychology, English Literature's set texts).
 * `short`: a shorter name for a long specification title, for the page title ("Moles and gas volumes").
 * `ref`: the code as the specification prints it, where that isn't `code` ("6A");
 * empty where the specification gives the topic no code of its own, as with the
 * statement groups in Edexcel Biology A and Physics (`points`: "9–15").
 */
export interface BankTopic { code: string; ref?: string; points?: string; title: string; short?: string; section: string; slug: string; count: number; year: 0 | 1 | 2 | 3 }
/** `option`: the area belongs to one of the bank's `options` (Eduqas Religious Studies: Christianity's topics are Option A's; AQA Law: contract is Paper 3A's). */
export interface BankSection { code: string; title: string; option?: string }
/** `option`: one of the bank's `options` (Eduqas Religious Studies' Component 1B is Option B, Islam); a paper without one is sat by everyone. */
export interface BankPaper { id: string; name: string; title: string; as: boolean; option?: string }
/** `takes`: the options a pick stands for, where a student takes more than one (AQA Further Maths' "Mechanics and Statistics" is M and S); otherwise the pick is its own `id`. */
export interface BankOption { id: string; name: string; takes?: string[] }
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
  /** An alternative to the part before it, "EITHER (d) OR (e)": a whole question's marks count one of them. */
  or?: 1;
  /** Has a setup (the question's stem), a mark scheme crop, an examiner's report. */
  st?: 1;
  ms?: 1;
  er?: 1;
  /** The scheme crop is the whole question's rows, not the part's own (its label didn't read on its own; ms_fallback.py). */
  msq?: 1;
  /** No cropped scheme: the whole paper's mark scheme PDF, relative to the papers base. */
  msf?: string;
  /** Reads the texts in the paper's insert, though its words may not say so (Eduqas English Language: "How does the writer…"). */
  src?: 1;
  /** Has a worked solution, solutions/<id>.json in the bank's data (bankSolutionUrl; scripts/question-bank/solutions). */
  sol?: 1;
  /** A multiple-choice question's answer letter, where the scheme is a key rather than a table. */
  k?: string;
  /** Where its start (`st`) is, when its id doesn't say: a question with no parts showing the start it shares with the one before (GCSE languages: questions 02 to 04 set on question 01's options) has "<its id>-stem.webp". See stemImage. */
  sk?: string;
  /** Asks for a calculation; in a bank with `calcPapers`, sits on a paper that allows a calculator. */
  calc?: 1;
  /** A listening question's recording, relative to the papers base (AQA languages: its tracks joined, scripts/question-bank/aqa_languages/audio_languages.py). */
  au?: string;
  /** `au` is the whole paper's recording, where AQA publishes no tracks (GCSE languages, November 2020). */
  auw?: 1;
  /** The opening words, for alt text and the static topic pages. */
  x: string;
  /** A MadAsMaths question (series MADAS), mixed in by the bank's "Add MadAsMaths questions" switch: its booklet's name. See madasSubject. */
  mm?: string;
  /** Its difficulty, in MadAsMaths' stars as printed ("***+"). */
  mst?: string;
}

/**
 * MadAsMaths questions, cut from its topic booklets (scripts/booklets/cut.py) and tagged to the bank's topics
 * (scripts/booklets/bank.py): a bank with a madas.json among its data has the switch. They're rows like the bank's
 * own, whose "paper" is the booklet (p, "madas-logarithms-exam-questions") and whose "series" is MADAS, so a paper
 * or year filter leaves them out, and their scheme crop is the answers with the worked solution.
 */
export const MADAS_SERIES = "MADAS";
export const isMadas = (p: Pick<BankPart, "s">) => p.s === MADAS_SERIES;
export const bankHasMadas = (s: Pick<BankSubject, "data">) => Boolean(s.data?.madas);
/** The subject as its rows name things once MadAsMaths questions are in: each booklet a "paper", MadAsMaths a "series". */
export const madasSubject = (subject: BankSubject, madas: BankPart[]): BankSubject => ({
  ...subject,
  papers: [...subject.papers, ...[...new Map(madas.map(p => [p.p, p.mm ?? "MadAsMaths"])).entries()].map(([id, name]) => ({ id, name, title: name, as: false }))],
  series: [...subject.series, { id: MADAS_SERIES, label: "MadAsMaths" }],
});

export interface BankSubject {
  slug: string;
  board: "AQA" | "Edexcel" | "OCR" | "OCR MEI" | "CAIE" | "Eduqas" | "WJEC";
  /** "IAL": Pearson Edexcel's International A Level, sat unit by unit and shelved with the A-Levels. "Level 3": a vocational Level 3 qualification, WJEC's Applied Diploma in Criminology, shelved apart from the A-Levels. "Level 2": AQA's Level 2 Certificate in Further Maths, sat beside GCSE and shelved with it. "Level 1/2": OCR's Cambridge National in Engineering Manufacture, a vocational qualification sat beside GCSE and shelved with it. */
  level: "A-Level" | "IAL" | "GCSE" | "IGCSE" | "Level 1/2" | "Level 2" | "Level 3";
  subject: BankSubjectName;
  /** Where the specification's name is longer: "Biology A (Salters-Nuffield)", "Chemistry B (Salters)". */
  fullName?: string;
  specs: string[];
  sections: BankSection[];
  topics: BankTopic[];
  papers: BankPaper[];
  series: BankSeries[];
  /** The whole papers we host for each sitting: { "74051-JUN23": { qp, ms, er } }, and its insert (`ins`) where its questions read sources printed apart (English Language's sources, GCSE Geography's Paper 3 pre-release resources booklet), and the code files (`code`, a zip) a paper sat on screen opens (Edexcel GCSE Computer Science Paper 2), and the transcript (`tr`) of a listening paper's recording (AQA languages). */
  wholes: Record<string, Partial<Record<"qp" | "ms" | "er" | "ins" | "code" | "tr", string>>>;
  /**
   * Papers a student chooses between, one per option (Eduqas Religious Studies: Component 1 is a paper per
   * religion; AQA Religious Studies: Paper 2 is a paper per religion; Eduqas GCSE Religious Studies' Component 3 is a paper per religion; Eduqas GCSE History's
   * sixteen option papers, and Edexcel GCSE History's seventeen, are grouped by kind of study, "Study"; Edexcel GCSE Religious Studies' 36 by specification and religion, "Course"; OCR A-Level History A's unit papers by "Unit group"; Edexcel A-Level History's Paper 1 and 2 options by route, "Route"): the filter by `label` ("Religion") keeps
   * the papers and topics of the option picked, and every paper and topic without one. AQA GCSE Computer
   * Science's Paper 1 is a paper per programming language ("Language").
   */
  options?: { label: string; list: BankOption[] };
  /** Maths: every question is a calculation, so the filter is left out; Criminology: none is, nor all but a few of Engineering Manufacture's. */
  noCalc?: boolean;
  /** GCSE Maths: the calculation filter sorts calculator papers from non-calculator ones instead (a part's `calc`). */
  calcPapers?: boolean;
  /** Edexcel reports are keyed by question id; AQA's by the question its parts share. */
  reportsBy?: "question";
  /** Bumped when the bank's crops are cut again under the same names, so browsers fetch the new ones (partImage). */
  cropVersion?: number;
  /**
   * What the bank covers, where a range of years would mislead: Cambridge publishes only
   * one series (June 2024) and its specimen papers, so CAIE banks say so instead of "2024–2024".
   */
  scope?: string;
  /** What the bank leaves out and why, said after the bank page's opening line (AQA Computer Science's Skeleton Program questions). */
  note?: string;
  count: number;
  firstYear: number;
  lastYear: number;
  /** The newest parts, server-rendered so the page is useful before any script runs. */
  sample: BankPart[];
  /** Each data file's content hash on R2 (bankDataUrl), written by upload_data.py; a file the bank doesn't have is left out. */
  data: Partial<Record<BankDataFile | "solutions", string>>;
}

export type BankDataFile = "parts" | "text" | "reports" | "practicals" | "year13" | "tiers" | "madas";

/** Every bank in src/content/questionBank/, found by scripts/question-bank/bank-registry.mjs: a new meta is all a new bank needs. */
export const bankSubjects = bankMetas as BankSubject[];

export function bankSubject(slug: string): BankSubject | undefined {
  return bankSubjects.find(s => s.slug === slug);
}

export function bankTopic(subject: BankSubject, slug: string): BankTopic | undefined {
  return subject.topics.find(t => t.slug === slug);
}

export const bankPath = (slug: string) => `/question-bank/${slug}`;
export const bankTopicPath = (slug: string, topic: string) => `/question-bank/${slug}/${topic}`;
/**
 * A data file on R2, named by its content hash: "<papers>/bank-data/aqa-a-level-biology/parts.3f9c0a1b2d.json".
 * A new cut is a new name, so the files are cached for a year as immutable and an older deployment still
 * finds its own. Null when the bank has no such file (no practicals.json: the filter stays hidden).
 */
export const bankDataUrl = (s: Pick<BankSubject, "slug" | "data">, file: BankDataFile) =>
  s.data?.[file] ? `${papersBase}/bank-data/${s.slug}/${file}.${s.data[file]}.json` : null;
/** A data file's contents, or null where the bank has no such file (or it isn't there). */
export const fetchBankData = <T,>(s: Pick<BankSubject, "slug" | "data">, file: BankDataFile): Promise<T | null> => {
  const url = bankDataUrl(s, file);
  return url ? fetch(url).then(r => (r.ok ? r.json() : null)) : Promise.resolve(null);
};
/** A worked solution (`sol`): the bank's solutions folder is hashed as a whole. */
export const bankSolutionUrl = (s: Pick<BankSubject, "slug" | "data">, id: string) =>
  s.data?.solutions ? `${papersBase}/bank-data/${s.slug}/solutions.${s.data.solutions}/${id}.json` : null;
/**
 * The sciences have a practicals.json beside their data: the ids of the parts about
 * doing an experiment (scripts/question-bank/practicals.py), for the "Practicals" filter.
 */
/**
 * A bank with a year13.json beside its data has the "Year" filter: the ids of the questions that need second-year
 * content (for maths, scripts/question-bank/maths_years.py). A Year 12 student wants the ones they can already do.
 * Adding the file is all a bank needs: its hash in the meta's `data` turns the filter on.
 */
export const bankHasYears = (s: Pick<BankSubject, "data">) => Boolean(s.data?.year13);
/**
 * A GCSE (or International GCSE) bank with Higher and Foundation papers (by name, "Paper 1 Higher", as the tier links read them) has a
 * tiers.json beside its data (tiers.py): the Foundation parts its Higher paper prints too.
 */
export const bankHasTiers = (s: Pick<BankSubject, "level" | "papers">) =>
  (s.level === "GCSE" || s.level === "IGCSE") && s.papers.some(p => /\bHigher\b/.test(p.name)) && s.papers.some(p => /\bFoundation\b/.test(p.name));
export const bankHasPracticals = (s: Pick<BankSubject, "subject">) => /^(Biology|Chemistry|Physics|Combined Science)\b/.test(s.subject);

/** Where our files live: R2 in production, a local folder in development. */
export { papersBase };
/**
 * A part's crop. Crops are cached for a year as immutable, so a re-cut that replaces them under
 * the same names asks for a new version: every bank's scheme crops for the scheme re-cut of
 * 25 October 2026 (MS_VERSION), and a bank re-cut as a whole for its own `cropVersion`.
 */
const MS_VERSION = 2;
export const partImage = (id: string, kind: "qp" | "ms" | "stem", version?: number) => {
  const v = kind === "ms" ? Math.max(MS_VERSION, version ?? 0) : version;
  return (kind === "stem" ? `${papersBase}/bank/${id.replace(/-[^-]+$/, "")}-stem.webp` : `${papersBase}/bank/${id}-${kind}.webp`) + (v ? `?v=${v}` : "");
};
/** A part's start (`st`): its question's, or the one it shares (`sk`). */
export const stemImage = (p: Pick<BankPart, "id" | "sk">, version?: number) =>
  p.sk ? `${papersBase}/bank/${p.sk}-stem.webp${version ? `?v=${version}` : ""}` : partImage(p.id, "stem", version);
/** The examiner's report covers a whole question: "74051-jun23-01" (AQA parts share it); an Edexcel question is its own key. */
export const reportKey = (subject: Pick<BankSubject, "reportsBy">, id: string) => (subject.reportsBy === "question" ? id : id.split("-").slice(0, 3).join("-"));

/** Who owns the questions, for credits: "AQA", "Pearson Edexcel". */
export const bankOwner = (s: Pick<BankSubject, "board">) =>
  s.board === "Edexcel" ? "Pearson Edexcel" : s.board === "OCR MEI" ? "OCR" : s.board === "CAIE" ? "Cambridge University Press & Assessment" : s.board === "Eduqas" ? "WJEC Eduqas" : s.board === "WJEC" ? "WJEC CBAC Ltd" : s.board;
/** The years a bank's questions come from, or what it covers where that says more: "2016–2025", "June 2024 and the specimen papers". */
export const bankYears = (s: Pick<BankSubject, "scope" | "firstYear" | "lastYear">) => s.scope ?? `${s.firstYear}–${s.lastYear}`;
/** The subject without its specification letter: "Biology" for "Biology A". */
export const baseSubject = (s: Pick<BankSubject, "subject">) => s.subject.replace(/ [AB]$/, "");
/** The whole-paper library page for a bank's subject and board. The library shelves Cambridge and Edexcel and Edexcel IGCSE (Additional Maths too) with GCSE, AQA's Level 2 Further Maths with its GCSE Maths, and Edexcel's Economics A and B (two specifications, not one subject's two papers) apart. */
export const bankPapersPath = (s: Pick<BankSubject, "board" | "level" | "subject">) => s.level === "IAL" ? `/past-papers/a-level-${baseSubject(s).toLowerCase().replace(/\s+/g, "-")}/edexcel-ial`
  : s.level === "IGCSE"
  ? `/past-papers/gcse-${baseSubject(s).replace(/^Additional /, "").toLowerCase()}/${s.board === "CAIE" ? "cie-igcse" : "edexcel-igcse"}`
  : s.level === "Level 2" ? `/past-papers/gcse-maths/${s.board.toLowerCase()}`
  : `/past-papers/${s.level.toLowerCase().replace(/[\s/]+/g, "-")}-${(/^Economics [AB]$/.test(s.subject) ? s.subject : baseSubject(s)).toLowerCase().replace(/\s+/g, "-")}/${s.board === "CAIE" ? "cie" : s.board.toLowerCase().replace(/\s+/g, "-")}`;

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
/** The whole question a part belongs to, across the bank: "74051-JUN23-01". */
export const questionKey = (p: Pick<BankPart, "p" | "s" | "l">) => `${p.p}-${p.s}-${questionOf(p.l)}`;

/** "AQA A-Level Chemistry" */
/** How a bank's level reads: Pearson calls its IGCSE "International GCSE"; Cambridge's stays "IGCSE". Pearson's International A Level (IAL) reads in full. */
export const bankLevel = (s: Pick<BankSubject, "board" | "level">) => (s.board === "Edexcel" && s.level === "IGCSE" ? "International GCSE" : s.level === "IAL" ? "International A Level" : s.level);
export const bankTitle = (s: Pick<BankSubject, "board" | "level" | "subject">) => `${s.board} ${bankLevel(s)} ${s.subject}`;
