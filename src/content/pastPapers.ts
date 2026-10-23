/**
 * The past paper library: every Maths, Further Maths, Biology, Chemistry and Physics
 * paper Physics & Maths Tutor lists, at GCSE, IGCSE and A-Level, grouped the way
 * students search for them — level, subject, then board.
 *
 * The data is generated, never hand-edited: `scripts/past-papers/crawl.py` reads
 * physicsandmathstutor.com and `scripts/past-papers/build.py` writes
 * src/content/pastPapers.json. Re-run both after each summer series.
 *
 * AQA A-Level Biology, Chemistry and Physics are served from our own copies of
 * AQA's papers (see ownAqaBoard below). Every other board's files are the copies
 * PMT hosts, linked, and those pages credit and link PMT.
 * What these pages add is the arrangement: a whole board on one page, every
 * session on one row, question paper and mark scheme side by side.
 */
import data from "./pastPapers.json";
import ownFiles from "./questionBank/files.json";
import { papersBase } from "./questionBank";

/** The file kinds a session can have, in the order they are shown. */
export const fileKinds = ["qp", "ms", "er", "ins", "ab", "ma", "vs"] as const;
export type FileKind = (typeof fileKinds)[number];

export const fileKindLabel: Record<FileKind, { short: string; long: string }> = {
  qp: { short: "QP", long: "Question paper" },
  ms: { short: "MS", long: "Mark scheme" },
  er: { short: "ER", long: "Examiner’s report" },
  ins: { short: "Insert", long: "Insert" },
  ab: { short: "Booklet", long: "Answer booklet" },
  ma: { short: "Model", long: "Model answers" },
  vs: { short: "Video", long: "Video solutions" },
};

export interface PaperLink { label: string; href: string }

/** One sitting of one paper: "June 2024", "November 2023 (v2)", "Specimen". */
export interface PaperRow {
  session: string;
  files: Partial<Record<FileKind, string>>;
  /** Anything else from that sitting: practical tasks (T1, TN), errata. */
  more?: PaperLink[];
}

/** One paper or unit of a specification, e.g. AQA A-Level Chemistry Paper 1 (7405/1). */
export interface Paper {
  /** Anchor on the board page. */
  id: string;
  /** "Paper 1", "Unit 2", "Pure 1". */
  name: string;
  /** The full name PMT gives it, which usually carries the component code. */
  title: string;
  /** The PMT page the files are listed on. */
  source: string;
  /** Files that belong to the paper rather than a session: data sheets, formula booklets. */
  extras: PaperLink[];
  rows: PaperRow[];
}

/** A specification (or an era of one) on a board page. */
export interface PaperGroup {
  id: string;
  heading: string;
  /** Legacy specifications are folded away below the current ones. */
  legacy: boolean;
  papers: Paper[];
}

export type Level = "A-Level" | "GCSE";

export interface SubjectHub {
  /** "a-level-chemistry" */
  slug: string;
  level: Level;
  /** "Chemistry", "Further Maths" */
  name: string;
  boards: string[];
}

export interface BoardPapers {
  subject: string;
  /** "aqa", "ocr-mei", "cie-igcse" */
  slug: string;
  /** How the board is written in a heading: "AQA", "OCR MEI", "Cambridge". */
  board: string;
  /** The board on its own, where several share a subject: "Edexcel IGCSE", "CAIE". */
  label: string;
  /** What the qualification is called for this board: "A-Level", "IGCSE", "International A-Level". */
  qualification: string;
  specCodes: string[];
  groups: PaperGroup[];
  firstYear: number;
  lastYear: number;
  fileCount: number;
}

interface PastPaperData {
  generated: string;
  source: string;
  subjects: SubjectHub[];
  boards: BoardPapers[];
}

const pmtLibrary = data as PastPaperData;

/**
 * AQA A-Level Biology, Chemistry and Physics come from our own copies of AQA's
 * papers (scripts/question-bank/fetch_aqa.py), not from PMT: current
 * specifications only, with AQA's examiner's reports alongside.
 */
interface OwnFile { component: string; series: string; kind: string; file: string; title: string }
const ownSubjects: Record<string, { spec: string; as: string }> = {
  "a-level-biology": { spec: "7402", as: "7401" },
  "a-level-chemistry": { spec: "7405", as: "7404" },
  "a-level-physics": { spec: "7408", as: "7407" },
};
const MONTHS: Record<string, string> = { JUN: "June", NOV: "November" };
const OPTION_NAMES: Record<string, string> = { A: "Paper 3 Section A", BA: "Paper 3 Option A: Astrophysics", BB: "Paper 3 Option B: Medical physics", BC: "Paper 3 Option C: Engineering physics", BD: "Paper 3 Option D: Turning points", BE: "Paper 3 Option E: Electronics" };
const seriesName = (s: string) => (s === "SPEC" ? "Specimen" : `${MONTHS[s.slice(0, 3)]} 20${s.slice(3)}`);
const seriesOrder = (s: string) => (s === "SPEC" ? 0 : Number(`20${s.slice(3)}`) * 100 + (s.startsWith("NOV") ? 11 : 6));

function ownAqaBoard(subject: string, base: BoardPapers): BoardPapers {
  const { spec, as } = ownSubjects[subject];
  const files = (ownFiles as OwnFile[]).filter(f => f.component.startsWith(spec) || f.component.startsWith(as));
  const group = (code: string, heading: string): PaperGroup => {
    const comps = [...new Set(files.filter(f => f.component.startsWith(code)).map(f => f.component))].sort();
    return {
      id: slugify(heading), heading, legacy: false,
      papers: comps.map(c => {
        const mine = files.filter(f => f.component === c);
        const rest = c.slice(5);
        const name = rest ? OPTION_NAMES[rest] ?? `Paper 3 ${rest}` : `${code === as ? "AS " : ""}Paper ${c[4]}`;
        const title = mine.find(f => f.kind === "qp" && f.title)?.title.match(/Paper \w+\s+(.*?)\s+-\s/)?.[1];
        const series = [...new Set(mine.map(f => f.series))].sort((a, b) => seriesOrder(b) - seriesOrder(a));
        return {
          id: slugify(name), name, title: `AQA ${name}${title && !rest ? `: ${title}` : ""} (${code}/${c.slice(4)})`,
          source: "",
          // AQA's data booklet is the same each year: one link under the heading, not a column.
          extras: mine.filter(f => f.kind === "db").sort((a, b) => seriesOrder(b.series) - seriesOrder(a.series)).slice(0, 1).map(f => ({ label: "Data booklet", href: f.file })),
          rows: series.map(s => {
            const row: PaperRow = { session: seriesName(s), files: {} };
            for (const f of mine.filter(x => x.series === s && x.kind !== "db")) row.files[f.kind as FileKind] = f.file;
            return row;
          }),
        };
      }),
    };
  };
  const groups = [group(spec, `A-Level (${spec})`), group(as, `AS (${as})`)].filter(g => g.papers.length);
  const years = files.map(f => (f.series === "SPEC" ? 0 : Number(`20${f.series.slice(3)}`))).filter(Boolean);
  return {
    ...base, specCodes: [spec, as], groups,
    firstYear: Math.min(...years), lastYear: Math.max(...years),
    fileCount: groups.reduce((n, g) => n + g.papers.reduce((m, p) => m + p.rows.reduce((k, r) => k + Object.keys(r.files).length + (r.more?.length ?? 0), 0), 0), 0),
  };
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const library: PastPaperData = {
  ...pmtLibrary,
  boards: pmtLibrary.boards.map(b => (b.slug === "aqa" && ownSubjects[b.subject] ? ownAqaBoard(b.subject, b) : b)),
};

/** Where PMT keeps the files. Stored hrefs are relative to it unless they are absolute. */
const fileBase = "https://pmt.physicsandmathstutor.com/download/";
export const fileUrl = (href: string) =>
  href.startsWith("http") ? href
    : href.startsWith("aqa/") ? `${papersBase}/${href}`
      : fileBase + href.split("/").map(encodeURIComponent).join("/");
/** Whether a board page's files are ours rather than linked from PMT. */
export const isOwnBoard = (b: BoardPapers) => b.slug === "aqa" && b.subject in ownSubjects;

export const pastPaperSource = { name: "Physics & Maths Tutor", url: library.source, generated: library.generated };

export const pastPaperSubjects: readonly SubjectHub[] = library.subjects;

export function subjectHub(slug: string): SubjectHub | undefined {
  return library.subjects.find(s => s.slug === slug);
}

export function boardPapers(subject: string, board: string): BoardPapers | undefined {
  return library.boards.find(b => b.subject === subject && b.slug === board);
}

export function boardsFor(subject: string): BoardPapers[] {
  const hub = subjectHub(subject);
  return hub ? hub.boards.map(slug => boardPapers(subject, slug)!).filter(Boolean) : [];
}

export const subjectPath = (subject: string) => `/past-papers/${subject}`;
export const boardPath = (subject: string, board: string) => `/past-papers/${subject}/${board}`;

/** "A-Level Chemistry", "GCSE Maths". The qualification a board uses can differ (IGCSE), so headings use `boardHeading`. */
export const subjectTitle = (hub: SubjectHub) => `${hub.level} ${hub.name}`;

/** "AQA A-Level Chemistry", "Cambridge IGCSE Physics", "Edexcel International A-Level Maths". */
export const boardHeading = (hub: SubjectHub, b: BoardPapers) => `${b.board} ${b.qualification} ${hub.name}`;

/** Heading text with "A-Level" held together, as the rest of the site writes it (U+2011). */
export const display = (text: string) => text.replace(/\b(A|AS)-Level\b/g, "$1\u2011Level");

/** The counterpart at the other level, for "doing A-Level next year?" links. */
export function otherLevel(hub: SubjectHub): SubjectHub | undefined {
  const name = hub.name === "Further Maths" ? "Maths" : hub.name;
  return library.subjects.find(s => s.level !== hub.level && s.name === name);
}

/** The Plumi revision page for a subject, where there is one. */
export function revisionPage(hub: SubjectHub): { label: string; path: string } | undefined {
  if (hub.name === "Physics" || hub.name === "Chemistry" || hub.name === "Biology") return { label: `${hub.name} revision`, path: `/${hub.name.toLowerCase()}-revision` };
  if (hub.level === "GCSE") return { label: "GCSE Maths", path: "/gcse-maths" };
  return { label: "A-Level Maths tutor", path: "/ai-tutor-for-a-level-maths" };
}

/** The subject's share card, where it has its own. */
export function shareImage(hub: SubjectHub): string {
  return hub.name === "Physics" || hub.name === "Chemistry" || hub.name === "Biology" ? `/og-${hub.name.toLowerCase()}.png` : "/og.png";
}

/** Every generated page, for the sitemap. */
export function pastPaperPaths(): string[] {
  return [
    ...library.subjects.map(s => subjectPath(s.slug)),
    ...library.subjects.flatMap(s => s.boards.map(b => boardPath(s.slug, b))),
  ];
}

/** Every sitting of every paper on a board page, for the counts in its copy. */
export const sessionCount = (b: BoardPapers) => b.groups.reduce((n, g) => n + g.papers.reduce((m, p) => m + p.rows.length, 0), 0);
export const hasKind = (b: BoardPapers, kind: FileKind) => b.groups.some(g => g.papers.some(p => p.rows.some(r => r.files[kind])));
