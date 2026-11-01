/**
 * The past paper library: Maths, Further Maths, Biology, Chemistry and Physics papers
 * at GCSE, IGCSE and A-Level, AQA GCSE English Language and Geography, English Literature (AQA GCSE, and AQA, Edexcel and OCR A-Level), Edexcel GCSE Computer Science and Edexcel A-Level Economics B, grouped the way students search for them — level,
 * subject, then board.
 *
 * Every file is our own copy of the board's published paper, fetched from the board's
 * own website and served from our storage (papersBase); nothing links to another site.
 * The data is generated, never hand-edited: scripts/past-papers/boards/<board>.py
 * fetches each board's papers and scripts/past-papers/build.py writes
 * src/content/pastPapers.json (see scripts/past-papers/boards/README.md). Re-run them
 * after each series.
 *
 * AQA A-Level Biology, Chemistry and Physics, and Edexcel A-Level Maths, Further
 * Maths, Biology, Chemistry and Physics, come from the question bank's own file lists
 * instead (ownAqaBoard, ownEdexcelBoard and ownEdexcelScienceBoard below).
 * What these pages add is the arrangement: a whole board on one page, every
 * session on one row, question paper and mark scheme side by side.
 */
import data from "./pastPapers.json";
import ownFiles from "./questionBank/files.json";
import ownEdexcelFiles from "./questionBank/files-edexcel.json";
import ownEdexcelScienceFiles from "./questionBank/files-edexcel-sciences.json";
import { bankSubject, papersBase } from "./questionBank";

/** The file kinds a session can have, in the order they are shown. */
export const fileKinds = ["qp", "ms", "er", "ins", "gt"] as const;
export type FileKind = (typeof fileKinds)[number];

export const fileKindLabel: Record<FileKind, { short: string; long: string }> = {
  qp: { short: "QP", long: "Question paper" },
  ms: { short: "MS", long: "Mark scheme" },
  er: { short: "ER", long: "Examiner’s report" },
  ins: { short: "Insert", long: "Insert" },
  gt: { short: "GT", long: "Grade thresholds" },
};

export interface PaperLink { label: string; href: string }

/** One sitting of one paper: "June 2024", "November 2023 (v2)", "Specimen". */
export interface PaperRow {
  session: string;
  files: Partial<Record<FileKind, string>>;
  /** Anything else from that sitting: practical tasks (T1, TN), errata, a Computer Science paper's code files (a zip). */
  more?: PaperLink[];
}

/** One paper or unit of a specification, e.g. AQA A-Level Chemistry Paper 1 (7405/1). */
export interface Paper {
  /** Anchor on the board page. */
  id: string;
  /** "Paper 1", "Unit 2", "Pure 1". */
  name: string;
  /** The full name, with the board's title and component code. */
  title: string;
  /** Unused: every file is ours. Kept so older data still type-checks. */
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
  /** What the board keeps from the public, said plainly (scripts/past-papers/build.py). */
  note?: string;
}

interface PastPaperData {
  generated: string;
  subjects: SubjectHub[];
  boards: BoardPapers[];
}

const ownLibrary = data as PastPaperData;

/**
 * AQA A-Level Biology, Chemistry and Physics come from our own copies of AQA's
 * papers (scripts/question-bank/fetch_aqa.py): current
 * specifications only, with AQA's examiner's reports alongside.
 */
interface OwnFile { component: string; series: string; kind: string; file: string; title: string }
const ownSubjects: Record<string, { spec: string; as: string }> = {
  "a-level-biology": { spec: "7402", as: "7401" },
  "a-level-chemistry": { spec: "7405", as: "7404" },
  "a-level-physics": { spec: "7408", as: "7407" },
};
const MONTHS: Record<string, string> = { JUN: "June", OCT: "October", NOV: "November" };
const OPTION_NAMES: Record<string, string> = { A: "Paper 3 Section A", BA: "Paper 3 Option A: Astrophysics", BB: "Paper 3 Option B: Medical physics", BC: "Paper 3 Option C: Engineering physics", BD: "Paper 3 Option D: Turning points", BE: "Paper 3 Option E: Electronics" };
const seriesName = (s: string) => (s === "SPEC" ? "Specimen" : `${MONTHS[s.slice(0, 3)]} 20${s.slice(3)}`);
const seriesOrder = (s: string) => (s === "SPEC" ? 0 : Number(`20${s.slice(3)}`) * 100 + (s.startsWith("NOV") ? 11 : s.startsWith("OCT") ? 10 : 6));

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

/**
 * Edexcel A-Level Maths and Further Maths, likewise from our own copies of
 * Pearson's papers (scripts/question-bank/fetch_edexcel.py): the current
 * specifications only, A-Level and AS.
 */
const ownEdexcel: Record<string, { bank: string; spec: string; as: string }> = {
  "a-level-maths": { bank: "edexcel-a-level-maths", spec: "9MA0", as: "8MA0" },
  "a-level-further-maths": { bank: "edexcel-a-level-further-maths", spec: "9FM0", as: "8FM0" },
};

function ownEdexcelBoard(subject: string, base: BoardPapers): BoardPapers {
  const { bank, spec, as } = ownEdexcel[subject];
  const papers = bankSubject(bank)?.papers ?? [];
  const comps = new Set(papers.map(p => p.id));
  const files = (ownEdexcelFiles as OwnFile[]).filter(f => comps.has(f.component));
  const paperFor = (c: string): Paper => {
    const mine = files.filter(f => f.component === c);
    const meta = papers.find(p => p.id === c);
    const series = [...new Set(mine.map(f => f.series))].sort((a, b) => seriesOrder(b) - seriesOrder(a));
    const name = meta?.name ?? c;
    return {
      id: slugify(name), name, title: `Edexcel ${name} (${meta?.title ?? c})`, source: "", extras: [],
      rows: series.map(s => {
        const row: PaperRow = { session: seriesName(s), files: {} };
        for (const f of mine.filter(x => x.series === s)) row.files[f.kind as FileKind] = f.file;
        return row;
      }),
    };
  };
  const group = (match: (c: string) => boolean, heading: string): PaperGroup => ({
    id: slugify(heading), heading, legacy: false, papers: papers.map(p => p.id).filter(match).map(paperFor).filter(p => p.rows.length),
  });
  const groups = [
    group(c => c.startsWith(spec), `A-Level (${spec})`),
    group(c => c.startsWith(as), `AS (${as})`),
  ].filter(g => g.papers.length);
  const years = files.map(f => Number(`20${f.series.slice(3)}`));
  return {
    ...base, specCodes: [spec, as], groups,
    firstYear: Math.min(...years), lastYear: Math.max(...years),
    fileCount: groups.reduce((n, g) => n + g.papers.reduce((m, p) => m + p.rows.reduce((k, r) => k + Object.keys(r.files).length, 0), 0), 0),
  };
}

/**
 * Edexcel A-Level Biology A and B, Chemistry and Physics, likewise from our own
 * copies of Pearson's papers (scripts/question-bank/edexcel_sciences/): every
 * series of the 2015 specifications, with Pearson's examiner's reports and, for
 * Biology Paper 3, the pre-release scientific article. Biology's two
 * specifications share one board page.
 */
const ownEdexcelSciences: Record<string, { name: string; spec: string; as: string; titles: Record<string, string> }[]> = {
  "a-level-biology": [
    { name: "Biology A (Salters-Nuffield)", spec: "9BN0", as: "8BN0", titles: { "9bn001": "The Natural Environment and Species Survival", "9bn002": "Energy, Exercise and Co-ordination", "9bn003": "General and Practical Applications in Biology", "8bn001": "Lifestyle, Transport, Genes and Health", "8bn002": "Development, Plants and the Environment" } },
    { name: "Biology B", spec: "9BI0", as: "8BI0", titles: { "9bi001": "Advanced Biochemistry, Microbiology and Genetics", "9bi002": "Advanced Physiology, Evolution and Ecology", "9bi003": "General and Practical Principles in Biology", "8bi001": "Core Cellular Biology and Microbiology", "8bi002": "Core Physiology and Ecology" } },
  ],
  "a-level-chemistry": [
    { name: "", spec: "9CH0", as: "8CH0", titles: { "9ch001": "Advanced Inorganic and Physical Chemistry", "9ch002": "Advanced Organic and Physical Chemistry", "9ch003": "General and Practical Principles in Chemistry", "8ch001": "Core Inorganic and Physical Chemistry", "8ch002": "Core Organic and Physical Chemistry" } },
  ],
  "a-level-physics": [
    { name: "", spec: "9PH0", as: "8PH0", titles: { "9ph001": "Advanced Physics I", "9ph002": "Advanced Physics II", "9ph003": "General and Practical Principles in Physics", "8ph001": "Core Physics I", "8ph002": "Core Physics II" } },
  ],
};

function ownEdexcelScienceBoard(subject: string, base: BoardPapers): BoardPapers {
  const files = ownEdexcelScienceFiles as OwnFile[];
  const specs = ownEdexcelSciences[subject];
  const group = (code: string, heading: string, titles: Record<string, string>): PaperGroup => {
    const comps = [...new Set(files.filter(f => f.component.startsWith(code.toLowerCase())).map(f => f.component))].sort();
    return {
      id: slugify(heading), heading, legacy: false,
      papers: comps.map(c => {
        const mine = files.filter(f => f.component === c);
        const name = `${code.startsWith("8") ? "AS " : ""}Paper ${Number(c.slice(4))}`;
        const series = [...new Set(mine.map(f => f.series))].sort((a, b) => seriesOrder(b) - seriesOrder(a));
        return {
          id: slugify(`${heading} ${name}`), name, title: `Edexcel ${name}${titles[c] ? `: ${titles[c]}` : ""} (${code}/${c.slice(4)})`,
          source: "", extras: [],
          rows: series.map(s => {
            const row: PaperRow = { session: seriesName(s), files: {} };
            for (const f of mine.filter(x => x.series === s)) row.files[f.kind as FileKind] = f.file;
            return row;
          }),
        };
      }),
    };
  };
  const groups = [
    ...specs.map(sp => group(sp.spec, sp.name ? `${sp.name} · A-Level (${sp.spec})` : `A-Level (${sp.spec})`, sp.titles)),
    ...specs.map(sp => group(sp.as, sp.name ? `${sp.name} · AS (${sp.as})` : `AS (${sp.as})`, sp.titles)),
  ].filter(g => g.papers.length);
  const mine = files.filter(f => specs.some(sp => [sp.spec, sp.as].some(c => f.component.startsWith(c.toLowerCase()))));
  const years = mine.map(f => Number(`20${f.series.slice(3)}`));
  return {
    ...base, specCodes: specs.flatMap(sp => [sp.spec, sp.as]), groups,
    firstYear: Math.min(...years), lastYear: Math.max(...years),
    fileCount: groups.reduce((n, g) => n + g.papers.reduce((m, p) => m + p.rows.reduce((k, r) => k + Object.keys(r.files).length, 0), 0), 0),
  };
}

/**
 * Pearson publishes GCSE Maths' June and November 2017 and 2018 series only as zips, which the
 * library's fetch (scripts/past-papers/boards/edexcel.py) passes over; the GCSE Maths question bank
 * unpacked both tiers' papers onto our storage (edexcel/1ma1-1h-qp-jun18.pdf, 1ma1-1f-qp-jun18.pdf).
 * Those sittings join the library's rows for each tier from the bank's own list.
 */
function withBankGcseMaths(base: BoardPapers): BoardPapers {
  const wholes = bankSubject("edexcel-gcse-maths")?.wholes ?? {};
  let added = 0;
  const groups = base.groups.map(g => ({
    ...g,
    papers: g.papers.map(p => {
      const code = p.title.match(/\(1MA1\/(\d[FH])\)/);
      if (!code) return p;
      const have = new Set(p.rows.map(r => r.session));
      const extra: PaperRow[] = Object.entries(wholes)
        .filter(([k]) => k.startsWith(`1ma1${code[1].toLowerCase()}-`) && !have.has(seriesName(k.split("-")[1])))
        .map(([k, files]) => ({ session: seriesName(k.split("-")[1]), files: { qp: files.qp, ms: files.ms, er: files.er } }));
      added += extra.reduce((n, r) => n + Object.values(r.files).filter(Boolean).length, 0);
      const order = (r: PaperRow) => {
        const [month, year] = r.session.split(" ");
        return Number(year) * 100 + (month === "November" ? 11 : month === "October" ? 10 : 6);
      };
      return extra.length ? { ...p, rows: [...p.rows, ...extra].sort((a, b) => order(b) - order(a)) } : p;
    }),
  }));
  const years = groups.flatMap(g => g.papers.flatMap(p => p.rows.map(r => Number(r.session.split(" ")[1])))).filter(Boolean);
  return { ...base, groups, firstYear: Math.min(base.firstYear, ...years), fileCount: base.fileCount + added };
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const library: PastPaperData = {
  ...ownLibrary,
  boards: ownLibrary.boards.map(b =>
    b.slug === "aqa" && ownSubjects[b.subject] ? ownAqaBoard(b.subject, b)
      : b.slug === "edexcel" && ownEdexcel[b.subject] ? ownEdexcelBoard(b.subject, b)
        : b.slug === "edexcel" && ownEdexcelSciences[b.subject] ? ownEdexcelScienceBoard(b.subject, b)
        : b.slug === "edexcel" && b.subject === "gcse-maths" ? withBankGcseMaths(b)
        : b),
};

/** Every stored href is a key in our bucket ("ocr/OCR-H240-01-QP-JUN23.pdf"). */
export const fileUrl = (href: string) => `${papersBase}/${href.split("/").map(encodeURIComponent).join("/")}`;

/** Whose papers they are, for the credit line. */
const OWNERS: Record<string, string> = {
  aqa: "AQA", edexcel: "Pearson Edexcel", "edexcel-ial": "Pearson Edexcel", "edexcel-igcse": "Pearson Edexcel",
  ocr: "OCR", "ocr-mei": "OCR and MEI", wjec: "WJEC", eduqas: "WJEC Eduqas", cie: "Cambridge University Press & Assessment", "cie-igcse": "Cambridge University Press & Assessment",
};
export const boardOwner = (b: BoardPapers) => OWNERS[b.slug] ?? b.board;

/** The question bank(s) for a board page's subject, where we have them. */
export function bankFor(b: BoardPapers): { slug: string; name: string }[] {
  const exact = bankSubject(`${b.slug}-${b.subject}`);
  if (exact) return [{ slug: exact.slug, name: exact.subject }];
  return ["a", "b"].map(v => bankSubject(`${b.slug}-${b.subject}-${v}`)).filter(s => s !== undefined).map(s => ({ slug: s.slug, name: s.subject }));
}

/** When the library was last built, for the sitemap. */
export const pastPapersGenerated = library.generated;

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
