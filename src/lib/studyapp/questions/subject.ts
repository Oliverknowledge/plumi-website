/** What the picker needs of a bank subject: its names and its topic tree. Made on the server (the route in app/study/(app)/questions/subjects), read by the browser. */
export interface SubjectTopic { code: string; ref?: string; title: string; short?: string; section: string; count: number }
export interface SubjectMeta {
  slug: string;
  title: string;
  board: string;
  level: string;
  subject: string;
  cv?: number;
  /** Examiner's reports are keyed by question (Edexcel). */
  rq?: 1;
  /** The bank has no calculator choice to offer (maths: every question is a calculation; criminology: none is). */
  noCalc?: 1;
  /** GCSE Maths and its kind: a part's `calc` says its paper allows a calculator, not that the question asks for a calculation. */
  calcPapers?: 1;
  /** A listening paper's transcript (a PDF, relative to the papers base) by `<paper>-<series>`: `"8658LH-JUN25"`. */
  trs?: Record<string, string>;
  topics: SubjectTopic[];
  sections: { code: string; title: string }[];
  papers: { id: string; name: string; title?: string }[];
  series: { id: string; label: string }[];
}

/** One line of the subject chooser. */
export interface CatalogueSubject {
  slug: string; title: string; board: string; level: string; subject: string; count: number;
  /** The tiers its papers are sat at ("Foundation", "Higher"), only where there are two or more: GCSE Maths and the sciences, some languages, IGCSE Core and Extended. */
  tiers?: string[];
}

/** "3.1.2 Amount of substance", "Momentum": how a topic reads on a chip. */
export const topicLabel = (t: SubjectTopic) => { const ref = t.ref ?? t.code; return ref && ref !== t.title ? `${ref} ${t.short ?? t.title}` : t.short ?? t.title; };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const list = <T,>(v: unknown, ok: (x: unknown) => x is T): T[] => (Array.isArray(v) ? v.filter(ok) : []);
const hasStr = (...keys: string[]) => (x: unknown): x is Record<string, string> => isObj(x) && keys.every((k) => typeof x[k] === "string");

/** A subject's names and topic tree as the browser got it, made safe to draw. Throws when it is not a subject at all. */
export function cleanMeta(raw: unknown): SubjectMeta {
  if (!isObj(raw) || typeof raw.slug !== "string" || typeof raw.title !== "string") throw new Error("not a subject");
  return {
    ...(raw as unknown as SubjectMeta),
    topics: list(raw.topics, hasStr("code", "title", "section")) as unknown as SubjectTopic[],
    sections: list(raw.sections, hasStr("code", "title")) as unknown as SubjectMeta["sections"],
    papers: (list(raw.papers, hasStr("id", "name")) as unknown as SubjectMeta["papers"]).map((p) => (typeof (p as { title?: unknown }).title === "string" ? p : { id: p.id, name: p.name })),
    series: list(raw.series, hasStr("id", "label")) as unknown as SubjectMeta["series"],
  };
}

const FIRST = ["Maths", "Biology", "Chemistry", "Physics", "Combined Science", "Further Maths"];
/** The subjects most students are here for come first; the rest follow alphabetically. */
export const subjectOrder = (subject: string) => { const i = FIRST.indexOf(subject.replace(/ [AB]$/, "")); return i < 0 ? FIRST.length : i; };

/** "Biology A" is Biology (a board's variant letter): the name a student thinks of. */
export const baseSubject = (subject: string) => subject.replace(/ [AB]$/, "");
/** The variant letter of a subject that has one ("Edexcel Biology B" is board "Edexcel", variant "B"). */
export const variantOf = (subject: string) => subject.match(/ ([AB])$/)?.[1] ?? "";
/** How the exam board reads on a chip: "AQA", "Edexcel B". */
export const boardLabel = (c: Pick<CatalogueSubject, "board" | "subject">) => { const v = variantOf(c.subject); return v ? `${c.board} ${v}` : c.board; };

/** The shelf header's tag: board, variant and level apart, so a variant letter never runs into the level ("OCR A \u00b7 A-Level", not "OCR A A-Level"). */
export const shelfTag = (c: Pick<CatalogueSubject, "board" | "subject" | "level">) => `${boardLabel(c)} \u00b7 ${c.level}`;

const TINT: Record<string, string> = {
  Chemistry: "var(--t-chem)", Physics: "var(--t-eng)", Biology: "var(--t-bio)", Maths: "var(--t-maths)", "Further Maths": "var(--t-fm)", "Combined Science": "var(--t-bio)",
  Geography: "var(--t-geo)", History: "var(--t-hist)", "Computer Science": "var(--t-cs)",
};
const SPARE = ["var(--t-geo)", "var(--t-hist)", "var(--t-lang)", "var(--t-cs)", "var(--t-soc)"];
/** Every subject has a tint (the same one each time), so the colour is a landmark and not just decoration. */
export function subjectTint(subject: string): string {
  const name = baseSubject(subject);
  if (TINT[name]) return TINT[name];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SPARE[h % SPARE.length];
}

/* ── tiers ───────────────────────────────────────────────────────────── */

/** The tier a paper is sat at, from its name as the bank writes it ("Paper 1 Higher", "Paper 3 Theory (Core)") or, for Cambridge, its title ("Core"); null if it has none. */
export function tierOf(p: { name: string; title?: string }): string | null {
  const n = p.name;
  if (/\bFoundation\b/.test(n)) return "Foundation";
  if (/\bHigher\b/.test(n)) return "Higher";
  const c = n.match(/\((Core|Extended)\)\s*$/) ?? n.match(/\b(Core|Extended)\s*$/);
  if (c) return c[1];
  if (p.title === "Core" || p.title === "Extended") return p.title;
  return null;
}

/** Order a tier list the way a student reads it: the harder one first. */
const TIER_ORDER = ["Higher", "Foundation", "Extended", "Core"];
export const sortTiers = (t: readonly string[]) => [...t].sort((a, b) => (TIER_ORDER.indexOf(a) + 1 || 9) - (TIER_ORDER.indexOf(b) + 1 || 9));

/** The tiers a subject's papers come in, when there are at least two (one tier alone is just how the subject is, not a choice). */
export function tiersOf(papers: readonly { id?: string; name: string; title?: string }[], level: string): string[] {
  if (!/GCSE$/.test(level)) return [];
  const t = new Set<string>();
  for (const p of papers) { const x = tierOf(p); if (x) t.add(x); }
  return t.size >= 2 ? sortTiers([...t]) : [];
}

/** What a student chose, for a line or a label: "Higher", or null for both. */
export function tierLine(chosen: readonly string[] | undefined, all?: readonly string[]): string | null {
  if (!chosen || !chosen.length) return null;
  if (all && all.length && all.every((a) => chosen.includes(a))) return null;
  return sortTiers(chosen).join(" and ");
}

/** The papers of a subject the chosen tier sits (papers with no tier are always kept: a Speaking paper is for both). */
export function paperKeeps(p: { name: string; title?: string }, chosen: readonly string[] | undefined): boolean {
  if (!chosen || !chosen.length) return true;
  const t = tierOf(p);
  return t === null || chosen.includes(t);
}
