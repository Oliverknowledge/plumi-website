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
  topics: SubjectTopic[];
  sections: { code: string; title: string }[];
  papers: { id: string; name: string; title?: string }[];
  series: { id: string; label: string }[];
}

/** One line of the subject chooser. */
export interface CatalogueSubject { slug: string; title: string; board: string; level: string; subject: string; count: number }

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
