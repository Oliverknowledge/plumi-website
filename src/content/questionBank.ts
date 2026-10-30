/**
 * The question bank: every question from AQA's GCSE and A-Level Biology, Chemistry
 * and Physics papers and GCSE Combined Science: Trilogy, Pearson Edexcel's GCSE Biology, Chemistry and Physics and A-Level Maths, Further Maths, Biology A
 * and B, Chemistry and Physics, OCR's and OCR MEI's A-Level sciences and maths, and
 * Cambridge International's (CAIE's) AS & A Level and IGCSE sciences and maths, Eduqas's A-Level
 * sciences and AS/A Level Religious Studies, WJEC's AS/A Level sciences and maths, WJEC's Level 3 Applied Diploma in Criminology, AQA's A-Level Maths, Psychology, Economics, Philosophy, Sociology, Business and Geography,
 * AQA's GCSE English Literature and A-Level English Literature A and B, Pearson Edexcel's A-Level Economics A,
 * Geography, Psychology and Politics, OCR's A-Level Economics and Law, OCR's and AQA's A-Level Computer Science, and AQA's, Pearson Edexcel's and OCR's GCSE Maths
 * (Higher tier), cut out one at a time, each with its own mark scheme
 * rows and the examiner's report on its question, tagged to the topic of the
 * specification it tests.
 *
 * Built from the boards' own published papers by scripts/question-bank/ (AQA:
 * fetch_aqa.py, spec.py, cut.py, build_bank.py; AQA maths: aqa_maths/; AQA economics: aqa_economics/; AQA philosophy: aqa_philosophy/;
 * AQA sociology: aqa_sociology/; AQA business: aqa_business/; AQA geography: aqa_geography/; AQA English Literature: aqa_english_lit/; AQA Combined Science: aqa_trilogy/; Edexcel maths: the *_edexcel.py
 * scripts; Edexcel sciences: edexcel_sciences/; Edexcel GCSE sciences: edexcel_gcse/; Edexcel geography: edexcel_geography/; Edexcel psychology: edexcel_psychology/; Edexcel politics: edexcel_politics/; OCR: ocr/; CAIE: caie/; Eduqas: eduqas/; Eduqas Religious Studies: eduqas_rs/; WJEC: wjec/;
 * Computer Science: computer_science/; OCR economics: ocr_economics/; OCR law: ocr_law/; GCSE Maths: gcse_maths/). The images and PDFs are ours,
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
import psychology from "./questionBank/aqa-a-level-psychology.json";
import aqaEconomics from "./questionBank/aqa-a-level-economics.json";
import aqaPhilosophy from "./questionBank/aqa-a-level-philosophy.json";
import aqaSociology from "./questionBank/aqa-a-level-sociology.json";
import aqaGeography from "./questionBank/aqa-a-level-geography.json";
import aqaBusiness from "./questionBank/aqa-a-level-business.json";
import aqaMaths from "./questionBank/aqa-a-level-maths.json";
import aqaComputerScience from "./questionBank/aqa-a-level-computer-science.json";
import aqaEnglishLiteratureA from "./questionBank/aqa-a-level-english-literature-a.json";
import aqaEnglishLiteratureB from "./questionBank/aqa-a-level-english-literature-b.json";
import maths from "./questionBank/edexcel-a-level-maths.json";
import furtherMaths from "./questionBank/edexcel-a-level-further-maths.json";
import gcseBiology from "./questionBank/aqa-gcse-biology.json";
import gcseChemistry from "./questionBank/aqa-gcse-chemistry.json";
import gcsePhysics from "./questionBank/aqa-gcse-physics.json";
import gcseCombinedScience from "./questionBank/aqa-gcse-combined-science.json";
import gcseEnglishLiterature from "./questionBank/aqa-gcse-english-literature.json";
import edexcelBiologyA from "./questionBank/edexcel-a-level-biology-a.json";
import edexcelBiologyB from "./questionBank/edexcel-a-level-biology-b.json";
import edexcelChemistry from "./questionBank/edexcel-a-level-chemistry.json";
import edexcelPhysics from "./questionBank/edexcel-a-level-physics.json";
import edexcelEconomics from "./questionBank/edexcel-a-level-economics-a.json";
import edexcelPsychology from "./questionBank/edexcel-a-level-psychology.json";
import edexcelGeography from "./questionBank/edexcel-a-level-geography.json";
import edexcelPolitics from "./questionBank/edexcel-a-level-politics.json";
import edexcelGcseBiology from "./questionBank/edexcel-gcse-biology.json";
import edexcelGcseChemistry from "./questionBank/edexcel-gcse-chemistry.json";
import edexcelGcsePhysics from "./questionBank/edexcel-gcse-physics.json";
import ocrBiology from "./questionBank/ocr-a-level-biology-a.json";
import ocrChemistry from "./questionBank/ocr-a-level-chemistry-a.json";
import ocrPhysics from "./questionBank/ocr-a-level-physics-a.json";
import ocrBiologyB from "./questionBank/ocr-a-level-biology-b.json";
import ocrChemistryB from "./questionBank/ocr-a-level-chemistry-b.json";
import ocrPhysicsB from "./questionBank/ocr-a-level-physics-b.json";
import ocrMaths from "./questionBank/ocr-a-level-maths.json";
import ocrFurtherMaths from "./questionBank/ocr-a-level-further-maths.json";
import ocrComputerScience from "./questionBank/ocr-a-level-computer-science.json";
import ocrEconomics from "./questionBank/ocr-a-level-economics.json";
import ocrLaw from "./questionBank/ocr-a-level-law.json";
import meiMaths from "./questionBank/ocr-mei-a-level-maths.json";
import meiFurtherMaths from "./questionBank/ocr-mei-a-level-further-maths.json";
import caieBiology from "./questionBank/caie-a-level-biology.json";
import caieChemistry from "./questionBank/caie-a-level-chemistry.json";
import caiePhysics from "./questionBank/caie-a-level-physics.json";
import caieMaths from "./questionBank/caie-a-level-maths.json";
import caieFurtherMaths from "./questionBank/caie-a-level-further-maths.json";
import caieIgcseBiology from "./questionBank/caie-igcse-biology.json";
import caieIgcseChemistry from "./questionBank/caie-igcse-chemistry.json";
import caieIgcsePhysics from "./questionBank/caie-igcse-physics.json";
import caieIgcseMaths from "./questionBank/caie-igcse-maths.json";
import caieIgcseAdditionalMaths from "./questionBank/caie-igcse-additional-maths.json";
import eduqasPhysics from "./questionBank/eduqas-a-level-physics.json";
import eduqasChemistry from "./questionBank/eduqas-a-level-chemistry.json";
import eduqasBiology from "./questionBank/eduqas-a-level-biology.json";
import eduqasReligiousStudies from "./questionBank/eduqas-a-level-religious-studies.json";
import wjecBiology from "./questionBank/wjec-a-level-biology.json";
import wjecChemistry from "./questionBank/wjec-a-level-chemistry.json";
import wjecPhysics from "./questionBank/wjec-a-level-physics.json";
import wjecMaths from "./questionBank/wjec-a-level-maths.json";
import wjecBusiness from "./questionBank/wjec-a-level-business.json";
import wjecCriminology from "./questionBank/wjec-criminology.json";
import aqaGcseMaths from "./questionBank/aqa-gcse-maths.json";
import edexcelGcseMaths from "./questionBank/edexcel-gcse-maths.json";
import ocrGcseMaths from "./questionBank/ocr-gcse-maths.json";

/**
 * `year`: 1 for AS content, 2 for A-Level only, 3 for a Paper 3 option (Physics, Psychology), 0 where the bank doesn't split by year (maths, GCSE, IGCSE, the rest of Psychology, English Literature's set texts).
 * `short`: a shorter name for a long specification title, for the page title ("Moles and gas volumes").
 * `ref`: the code as the specification prints it, where that isn't `code` ("6A");
 * empty where the specification gives the topic no code of its own, as with the
 * statement groups in Edexcel Biology A and Physics (`points`: "9–15").
 */
export interface BankTopic { code: string; ref?: string; points?: string; title: string; short?: string; section: string; slug: string; count: number; year: 0 | 1 | 2 | 3 }
/** `option`: the area belongs to one of the bank's `options` (Eduqas Religious Studies: Christianity's topics are Option A's). */
export interface BankSection { code: string; title: string; option?: string }
/** `option`: one of the bank's `options` (Eduqas Religious Studies' Component 1B is Option B, Islam); a paper without one is sat by everyone. */
export interface BankPaper { id: string; name: string; title: string; as: boolean; option?: string }
export interface BankOption { id: string; name: string }
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
  /** No cropped scheme: the whole paper's mark scheme PDF, relative to the papers base. */
  msf?: string;
  /** A multiple-choice question's answer letter, where the scheme is a key rather than a table. */
  k?: string;
  /** Asks for a calculation; in a bank with `calcPapers`, sits on a paper that allows a calculator. */
  calc?: 1;
  /** The opening words, for alt text and the static topic pages. */
  x: string;
}

export interface BankSubject {
  slug: string;
  board: "AQA" | "Edexcel" | "OCR" | "OCR MEI" | "CAIE" | "Eduqas" | "WJEC";
  /** "Level 3": a vocational Level 3 qualification, WJEC's Applied Diploma in Criminology, shelved apart from the A-Levels. */
  level: "A-Level" | "GCSE" | "IGCSE" | "Level 3";
  subject: "Biology" | "Biology A" | "Biology B" | "Chemistry" | "Chemistry A" | "Chemistry B" | "Physics" | "Physics A" | "Physics B" | "Maths" | "Further Maths" | "Additional Maths" | "Psychology" | "Economics" | "Economics A" | "Computer Science" | "Combined Science" | "Philosophy" | "Sociology" | "Business" | "English Literature" | "English Literature A" | "Geography" | "Criminology" | "English Literature B" | "Law" | "Politics" | "Religious Studies";
  /** Where the specification's name is longer: "Biology A (Salters-Nuffield)", "Chemistry B (Salters)". */
  fullName?: string;
  specs: string[];
  sections: BankSection[];
  topics: BankTopic[];
  papers: BankPaper[];
  series: BankSeries[];
  /** The whole papers we host for each sitting: { "74051-JUN23": { qp, ms, er } }. */
  wholes: Record<string, Partial<Record<"qp" | "ms" | "er", string>>>;
  /**
   * Papers a student chooses between, one per option (Eduqas Religious Studies: Component 1 is a paper per
   * religion): the filter by `label` ("Religion") keeps the papers and topics of the option picked, and
   * every paper and topic without one.
   */
  options?: { label: string; list: BankOption[] };
  /** Maths: every question is a calculation, so the filter is left out; Criminology: none is. */
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
}

export const bankSubjects = [maths, furtherMaths, aqaMaths, biology, chemistry, physics, psychology, aqaEconomics, aqaSociology, aqaBusiness, aqaGeography, aqaPhilosophy, aqaComputerScience, aqaEnglishLiteratureA, aqaEnglishLiteratureB, edexcelBiologyA, edexcelBiologyB, edexcelChemistry, edexcelPhysics, edexcelEconomics, edexcelGeography, edexcelPsychology, edexcelPolitics, ocrBiology, ocrChemistry, ocrPhysics, ocrBiologyB, ocrChemistryB, ocrPhysicsB, ocrMaths, ocrFurtherMaths, ocrComputerScience, ocrEconomics, ocrLaw, meiMaths, meiFurtherMaths, caieMaths, caieFurtherMaths, caieBiology, caieChemistry, caiePhysics, eduqasPhysics, eduqasChemistry, eduqasBiology, eduqasReligiousStudies, caieIgcseMaths, caieIgcseAdditionalMaths, caieIgcseBiology, caieIgcseChemistry, caieIgcsePhysics, wjecMaths, wjecBiology, wjecChemistry, wjecPhysics, wjecBusiness, wjecCriminology, gcseBiology, gcseChemistry, gcsePhysics, gcseEnglishLiterature, gcseCombinedScience, edexcelGcseBiology, edexcelGcseChemistry, edexcelGcsePhysics, aqaGcseMaths, edexcelGcseMaths, ocrGcseMaths] as BankSubject[];

export function bankSubject(slug: string): BankSubject | undefined {
  return bankSubjects.find(s => s.slug === slug);
}

export function bankTopic(subject: BankSubject, slug: string): BankTopic | undefined {
  return subject.topics.find(t => t.slug === slug);
}

export const bankPath = (slug: string) => `/question-bank/${slug}`;
export const bankTopicPath = (slug: string, topic: string) => `/question-bank/${slug}/${topic}`;
export const bankDataPath = (slug: string, file: "parts" | "text" | "reports" | "practicals" | "year13" | "tiers" | `topic-${string}`) => `/question-bank/${slug}/${file}.json`;
/**
 * The sciences have a practicals.json beside their data: the ids of the parts about
 * doing an experiment (scripts/question-bank/practicals.py), for the "Practicals" filter.
 */
/**
 * A-Level Maths and Further Maths have a year13.json beside their data (Cambridge's Further Maths, with no AS, has none, and no filter): the ids of the questions that need second-year
 * content (scripts/question-bank/maths_years.py), for the "Year" filter. A Year 12 student wants the
 * ones they can already do; maths topics span both years, so the split is by question, not by topic.
 */
export const bankHasYears = (s: Pick<BankSubject, "level" | "subject" | "board">) =>
  s.level === "A-Level" && (s.subject === "Maths" || (s.subject === "Further Maths" && s.board !== "CAIE"));
/** A GCSE bank with Higher and Foundation papers has a tiers.json beside its data (tiers.py): the Foundation parts its Higher paper prints too. */
export const bankHasTiers = (s: Pick<BankSubject, "level" | "papers">) =>
  s.level === "GCSE" && s.papers.some(p => /H$/i.test(p.id)) && s.papers.some(p => /F$/i.test(p.id));
export const bankHasPracticals = (s: Pick<BankSubject, "subject">) => /^(Biology|Chemistry|Physics|Combined Science)\b/.test(s.subject);

/** Where our files live: R2 in production, a local folder in development. */
export const papersBase = (process.env.NEXT_PUBLIC_PAPERS_URL ?? "/papers-local").replace(/\/$/, "");
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
/** The examiner's report covers a whole question: "74051-jun23-01" (AQA parts share it); an Edexcel question is its own key. */
export const reportKey = (subject: Pick<BankSubject, "reportsBy">, id: string) => (subject.reportsBy === "question" ? id : id.split("-").slice(0, 3).join("-"));

/** Who owns the questions, for credits: "AQA", "Pearson Edexcel". */
export const bankOwner = (s: Pick<BankSubject, "board">) =>
  s.board === "Edexcel" ? "Pearson Edexcel" : s.board === "OCR MEI" ? "OCR" : s.board === "CAIE" ? "Cambridge University Press & Assessment" : s.board === "Eduqas" ? "WJEC Eduqas" : s.board === "WJEC" ? "WJEC CBAC Ltd" : s.board;
/** The years a bank's questions come from, or what it covers where that says more: "2016–2025", "June 2024 and the specimen papers". */
export const bankYears = (s: Pick<BankSubject, "scope" | "firstYear" | "lastYear">) => s.scope ?? `${s.firstYear}–${s.lastYear}`;
/** The subject without its specification letter: "Biology" for "Biology A". */
export const baseSubject = (s: Pick<BankSubject, "subject">) => s.subject.replace(/ [AB]$/, "");
/** The whole-paper library page for a bank's subject and board. The library shelves Cambridge IGCSE (Additional Maths too) with GCSE. */
export const bankPapersPath = (s: Pick<BankSubject, "board" | "level" | "subject">) => s.level === "IGCSE"
  ? `/past-papers/gcse-${baseSubject(s).replace(/^Additional /, "").toLowerCase()}/cie-igcse`
  : `/past-papers/${s.level.toLowerCase().replace(/\s+/g, "-")}-${baseSubject(s).toLowerCase().replace(/\s+/g, "-")}/${s.board === "CAIE" ? "cie" : s.board.toLowerCase().replace(/\s+/g, "-")}`;

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
export const bankTitle = (s: Pick<BankSubject, "board" | "level" | "subject">) => `${s.board} ${s.level} ${s.subject}`;
