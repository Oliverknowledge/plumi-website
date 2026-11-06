/**
 * Builds a bank's Topic analysis data: for each topic and each exam series, how many of its parts are asked in each form, and which form each part is.
 *
 *     npm run bank:insights -- ocr-a-level-biology-a            # read the bank's data from R2 (public read), write the file
 *     npm run bank:insights -- ocr-a-level-biology-a --check    # build in memory, say whether the committed file is out of date (writes nothing)
 *     npm run bank:insights -- --check                          # every bank that has insights: are they built from the bank's current data? (no network; this is what CI runs)
 *     npm run bank:insights -- ocr-a-level-biology-a --dir /tmp/x   # read parts.json and text.json from a folder instead (for offline runs)
 *
 * It reads the bank's `parts` and `text` data files by the hashes in the bank's meta (src/content/questionBank/<slug>.json), cuts each part's question out of its page text
 * (questionText, the same cut "Read as text" uses), classifies it (questionForm.ts: deterministic, no model, no network beyond the read), and writes
 * src/content/questionBankInsights/<slug>.json. The output has no dates and its keys and lists are in a fixed order, so building twice from the same data gives the same bytes.
 * It writes nothing to R2 or any database. The file is small and is loaded only when a student opens Topic analysis (insightsLoad.ts).
 *
 * What is counted. A PART is one lettered part of an exam question (the unit the feed lists and counts, "12(b)(ii)"): `p`. A QUESTION is the numbered question its parts share
 * (paper, series and number): `q`. A part that is tagged with two topics counts once under each, so topic totals can add up to more than the bank's parts.
 * Marks are the parts' marks, again once under each topic the part is tagged with.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { askWords, classifyForm, FORMS, type Form } from "../../src/lib/studyapp/questions/questionForm";
import { openingPhrases, pickExamples, type Angles, type FormAngles } from "../../src/lib/studyapp/questions/angles";
import { resolvePapersBase } from "../../src/config/papers";
import { questionText } from "../../src/lib/studyapp/questions/partText";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const R2 = resolvePapersBase(process.env.NEXT_PUBLIC_PAPERS_URL, "production");

interface Part { id: string; p: string; s: string; l: string; m: number | null; t: string[]; k?: string; ms?: number | string; msq?: unknown }
interface Meta { slug: string; topics: { code: string; title: string; year?: number }[]; series: { id: string; label: string }[]; data: Record<string, string> }

/** The numbered question a part belongs to ("12(b)(ii)" is question 12). */
const questionOf = (l: string): string => l.match(/^\d+/)?.[0] ?? l;

async function read(slug: string, file: "parts" | "text", hash: string, dir: string | null): Promise<unknown> {
  if (dir) return JSON.parse(readFileSync(join(dir, `${file}.json`), "utf8"));
  const res = await fetch(`${R2}/bank-data/${slug}/${file}.${hash}.json`, { headers: { "user-agent": "plumi-bank-insights" } });
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  return res.json();
}

/** The data file's text, as the build writes it: fixed key order, one topic per line so a change reads as a diff. */
function render(out: Insights): string {
  const topics = Object.entries(out.topics).map(([code, t]) => `  ${JSON.stringify(code)}: ${JSON.stringify(t)}`).join(",\n");
  const map = Object.entries(out.map).map(([group, ids]) => `  ${JSON.stringify(group)}: ${JSON.stringify(ids)}`).join(",\n");
  return `{\n"v": ${out.v},\n"slug": ${JSON.stringify(out.slug)},\n"built": ${JSON.stringify(out.built)},\n"forms": ${JSON.stringify(out.forms)},\n"series": ${JSON.stringify(out.series)},\n"cover": ${JSON.stringify(out.cover)},\n"parts": ${out.parts},\n"questions": ${out.questions},\n"topics": {\n${topics}\n},\n"map": {\n${map}\n}\n}\n`;
}

interface Topic {
  /** The course year the specification puts the topic in (1 or 2; 0 where the bank has no such split). */
  y: number;
  /** Parts, marks, distinct numbered questions. */
  p: number; m: number; q: number;
  /** By series (in `series` order), the parts in each form (in `forms` order): `c[series][form]`. */
  c: number[][];
  /** By form (in `forms` order), the marks those parts carry. */
  fm: number[];
}
interface Insights {
  v: 1; slug: string;
  /** The hashes of the bank data this was built from. */
  built: Record<string, string>;
  forms: Form[];
  /** Series ids, oldest first. */
  series: string[];
  /** By course year ("1", "2"), a string with a "1" for each series (in `series` order) that has any part of that year in the bank: a series with none (a sitting whose A-level papers are not in the bank) is not a gap for a topic of that year. */
  cover: Record<string, string>;
  parts: number; questions: number;
  topics: Record<string, Topic>;
  /** Part id to form (an index into `forms`), grouped by the part id's first two words ("h42001-jun25": {"01": 1, "02-a": 3}) to keep the file small. */
  map: Record<string, Record<string, number>>;
}

/** A question that leans on another part ("explain your answer to part (i)", "the information in 4(b)(ii)") is a poor stand-alone example, so it is never one. */
const DEPENDS = /\bparts?\s*\(|\bparts?\s+\d|\bquestions?\s+\d|\b(?:your|the)\s+answers?\s+to\b|\bin\s+\d+\s*\([a-z]+\)|\bprevious\b|\babove\b/;

/** What Angles needs of each part, found once while the forms are decided. */
interface Record1 { id: string; form: Form; marks: number | null; series: string; topics: string[]; ask: string[] | null; whole: boolean; ms: boolean; alone: boolean }

export function build(meta: Meta, parts: Part[], text: Record<string, string>): Insights { return buildAll(meta, parts, text).insights; }

export function buildAll(meta: Meta, parts: Part[], text: Record<string, string>): { insights: Insights; angles: Angles } {
  const records: Record1[] = [];
  const forms = [...FORMS];
  const form = (id: string) => forms.indexOf(id as Form);
  // oldest first, from the meta's own list (which is newest first)
  const series = meta.series.map((s) => s.id).reverse();
  const at = new Map(series.map((s, i) => [s, i]));
  const topics: Record<string, Topic> = {};
  for (const t of [...meta.topics].sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }))) topics[t.code] = { y: t.year ?? 0, p: 0, m: 0, q: 0, c: series.map(() => forms.map(() => 0)), fm: forms.map(() => 0) };
  const seen = new Map<string, Set<string>>();
  const map: Record<string, Record<string, number>> = {};
  const ordered = [...parts].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const questions = new Set<string>();
  const covered = new Map<number, boolean[]>();
  for (const part of ordered) {
    const raw = text[part.id];
    const q = questionText(raw, { m: part.m, x: (part as { x?: string }).x });
    const lower = q.text.toLowerCase();
    const formId = classifyForm({ text: lower, marks: part.m, key: part.k });
    const f = form(formId);
    records.push({ id: part.id, form: formId, marks: part.m, series: part.s, topics: [...new Set(part.t)], ask: askWords(lower), whole: q.whole, ms: !!part.ms && !part.msq, alone: !DEPENDS.test(lower) });
    const si = at.get(part.s);
    if (si === undefined) throw new Error(`${part.id}: series ${part.s} is not in the meta`);
    const dash = part.id.indexOf("-", part.id.indexOf("-") + 1);
    const group = dash > 0 ? part.id.slice(0, dash) : part.id;
    (map[group] ??= {})[dash > 0 ? part.id.slice(dash + 1) : ""] = f;
    const qk = `${part.p}-${part.s}-${questionOf(part.l)}`;
    questions.add(qk);
    for (const code of new Set(part.t)) {
      const t = topics[code];
      if (!t) throw new Error(`${part.id}: topic ${code} is not in the meta`);
      const cov = covered.get(t.y) ?? series.map(() => false);
      cov[si] = true;
      covered.set(t.y, cov);
      t.p++;
      t.m += part.m ?? 0;
      t.c[si][f]++;
      t.fm[f] += part.m ?? 0;
      const s = seen.get(code) ?? new Set<string>();
      if (!s.has(qk)) { s.add(qk); t.q++; }
      seen.set(code, s);
    }
  }
  const built = Object.fromEntries(Object.entries(meta.data).filter(([k]) => k === "parts" || k === "text").sort(([a], [b]) => (a < b ? -1 : 1)));
  const insights: Insights = {
    v: 1, slug: meta.slug,
    built,
    forms, series, cover: Object.fromEntries([...covered].sort(([a], [b]) => a - b).map(([y, c]) => [String(y), c.map((x) => (x ? "1" : "0")).join("")])), parts: ordered.length, questions: questions.size, topics,
    map: Object.fromEntries(Object.keys(map).sort().map((g) => [g, Object.fromEntries(Object.entries(map[g]).sort(([a], [b]) => (a < b ? -1 : 1)))])),
  };
  return { insights, angles: buildAngles(meta, records, built, Object.keys(topics)) };
}

/**
 * Angles, per topic and form (not "other"): the opening phrases (at least two real questions each, from the words of the ask) and up to four examples. An example is a part of that form on
 * that topic whose own mark scheme picture exists (not a whole-question scheme), whose question text was read whole, and whose ask was found at the start of a clause (so the form is
 * not a guess from a line of diagram labels); a multiple-choice part counts by its key. The build stops if an example breaks those rules.
 */
function buildAngles(meta: Meta, records: Record1[], built: Record<string, string>, codes: string[]): Angles {
  const groupOf = (id: string) => { const d = id.indexOf("-", id.indexOf("-") + 1); return d > 0 ? [id.slice(0, d), id.slice(d + 1)] as const : [id, ""] as const; };
  const used = new Set<string>();
  const topics: Angles["topics"] = {};
  const byId = new Map(records.map((r) => [r.id, r]));
  for (const code of codes) {
    const forTopic = records.filter((r) => r.topics.includes(code));
    const out: Partial<Record<Form, FormAngles>> = {};
    for (const f of FORMS) {
      if (f === "other") continue;
      const same = forTopic.filter((r) => r.form === f);
      if (!same.length) continue;
      const p = f === "choice" ? [] : openingPhrases(same.flatMap((r) => (r.ask ? [r.ask] : [])));
      const ok = same.filter((r) => r.ms && r.whole && r.alone && (f === "choice" || r.ask));
      const e = pickExamples(ok.map((r) => ({ id: r.id, series: r.series, marks: r.marks })));
      for (const id of e) { const r = byId.get(id)!; if (!r.ms || r.form !== f || !r.topics.includes(code)) throw new Error(`${id}: not a valid ${f} example for ${code}`); used.add(groupOf(id)[0]); }
      if (p.length || e.length) out[f] = { p, e: e };
    }
    topics[code] = out;
  }
  const g = [...used].sort();
  const at = new Map(g.map((x, i) => [x, i]));
  for (const forms of Object.values(topics)) for (const a of Object.values(forms)) a.e = a.e.map((id) => { const [grp, rest] = groupOf(id); return `${at.get(grp)}:${rest}`; });
  void meta;
  return { v: 1, slug: meta.slug, built, g, topics };
}

/** The angles file's text: one topic per line so a change reads as a diff. */
function renderAngles(a: Angles): string {
  const topics = Object.entries(a.topics).map(([code, t]) => `  ${JSON.stringify(code)}: ${JSON.stringify(t)}`).join(",\n");
  return `{\n"v": ${a.v},\n"slug": ${JSON.stringify(a.slug)},\n"built": ${JSON.stringify(a.built)},\n"g": ${JSON.stringify(a.g)},\n"topics": {\n${topics}\n}\n}\n`;
}

/**
 * `--check` with no bank: for each bank in insights/index.json, is the file built from the data hashes in the bank's meta now? A bank cut again gets new hashes, so its insights are
 * stale and the app would stop offering Topic analysis; this makes that fail loudly (in CI) instead. Reads only files in the checkout, so it needs no network.
 */
function checkAll(): never {
  const dir = join(ROOT, "src", "content", "questionBankInsights");
  const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8")) as Record<string, string>;
  const problems: string[] = [];
  for (const [slug, parts] of Object.entries(index)) {
    const metaFile = join(ROOT, "src", "content", "questionBank", `${slug}.json`);
    if (!existsSync(metaFile)) { problems.push(`${slug}: has insights but no bank meta`); continue; }
    const meta = JSON.parse(readFileSync(metaFile, "utf8")) as Meta;
    const file = join(dir, `${slug}.json`);
    if (!existsSync(file)) { problems.push(`${slug}: listed in index.json but ${slug}.json is missing`); continue; }
    const built = (JSON.parse(readFileSync(file, "utf8")) as { built?: Record<string, string> }).built ?? {};
    if (parts !== meta.data?.parts) problems.push(`${slug}: index.json says parts ${parts}, the bank's meta now says ${meta.data?.parts}`);
    for (const f of ["parts", "text"]) if (built[f] !== meta.data?.[f]) problems.push(`${slug}: insights were built from ${f} ${built[f]}, the bank's meta now says ${meta.data?.[f]}`);
  }
  // Angles (the Pro layer on Topic analysis): its own file and its own index, built from the same data
  const anglesIndexFile = join(dir, "angles.json");
  const anglesIndex = existsSync(anglesIndexFile) ? (JSON.parse(readFileSync(anglesIndexFile, "utf8")) as Record<string, string>) : {};
  for (const [slug, parts] of Object.entries(anglesIndex)) {
    const metaFile = join(ROOT, "src", "content", "questionBank", `${slug}.json`);
    const file = join(dir, `${slug}.angles.json`);
    if (!existsSync(metaFile) || !existsSync(file)) { problems.push(`${slug}: listed in angles.json but its meta or ${slug}.angles.json is missing`); continue; }
    const meta = JSON.parse(readFileSync(metaFile, "utf8")) as Meta;
    const built = (JSON.parse(readFileSync(file, "utf8")) as { built?: Record<string, string> }).built ?? {};
    if (parts !== meta.data?.parts) problems.push(`${slug}: angles.json says parts ${parts}, the bank's meta now says ${meta.data?.parts}`);
    for (const f of ["parts", "text"]) if (built[f] !== meta.data?.[f]) problems.push(`${slug}: Angles were built from ${f} ${built[f]}, the bank's meta now says ${meta.data?.[f]}`);
  }
  if (problems.length) {
    console.error(problems.join("\n"));
    console.error("The bank was cut again, so its Topic analysis and Angles are out of date and the app has stopped offering them. Run: npm run bank:insights -- <slug>");
    process.exit(1);
  }
  console.log(`insights: ${Object.keys(index).length} bank(s) up to date with their data`);
  process.exit(0);
}

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith("--"));
  if (!slug && args.includes("--check")) checkAll();
  if (!slug) throw new Error("usage: npm run bank:insights -- <slug> [--check] [--dir <folder>]");
  const check = args.includes("--check");
  const dirAt = args.indexOf("--dir");
  const dir = dirAt >= 0 ? args[dirAt + 1] : null;
  const meta = JSON.parse(readFileSync(join(ROOT, "src", "content", "questionBank", `${slug}.json`), "utf8")) as Meta;
  if (!meta.data?.parts || !meta.data?.text) throw new Error(`${slug}: its meta names no parts or text data file`);
  const parts = (await read(slug, "parts", meta.data.parts, dir)) as Part[];
  const text = (await read(slug, "text", meta.data.text, dir)) as Record<string, string>;
  if (!Array.isArray(parts) || !parts.length || typeof text !== "object") throw new Error("the data files are not what they should be");
  const { insights: out, angles } = buildAll(meta, parts, text);
  const body = render(out);
  const anglesBody = renderAngles(angles);
  const file = join(ROOT, "src", "content", "questionBankInsights", `${slug}.json`);
  // index.json: each bank that has insights, with the parts hash they were built from. The app reads only this (a few bytes) to know, without loading the file, whether to offer Topic
  // analysis; a bank cut again under a new hash stops offering it until the insights are built again, so a stale file is never shown.
  const indexFile = join(dirname(file), "index.json");
  const index: Record<string, string> = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, "utf8")) : {};
  index[slug] = meta.data.parts;
  const indexBody = JSON.stringify(Object.fromEntries(Object.entries(index).sort(([a], [b]) => (a < b ? -1 : 1))), null, 1) + "\n";
  const anglesFile = join(dirname(file), `${slug}.angles.json`);
  const anglesIndexFile = join(dirname(file), "angles.json");
  const aIndex: Record<string, string> = existsSync(anglesIndexFile) ? JSON.parse(readFileSync(anglesIndexFile, "utf8")) : {};
  aIndex[slug] = meta.data.parts;
  const anglesIndexBody = JSON.stringify(Object.fromEntries(Object.entries(aIndex).sort(([a], [b]) => (a < b ? -1 : 1))), null, 1) + "\n";
  if (check) {
    const now = existsSync(file) ? readFileSync(file, "utf8") : "";
    const nowIndex = existsSync(indexFile) ? readFileSync(indexFile, "utf8") : "";
    const nowAngles = existsSync(anglesFile) ? readFileSync(anglesFile, "utf8") : "";
    const nowAIndex = existsSync(anglesIndexFile) ? readFileSync(anglesIndexFile, "utf8") : "";
    if (now !== body || nowIndex !== indexBody || nowAngles !== anglesBody || nowAIndex !== anglesIndexBody) { console.error(`${slug}: the insights file is out of date. Run npm run bank:insights -- ${slug}`); process.exit(1); }
    console.log(`${slug}: insights are up to date`);
    return;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  writeFileSync(indexFile, indexBody);
  writeFileSync(anglesFile, anglesBody);
  writeFileSync(anglesIndexFile, anglesIndexBody);
  console.log(`${slug}: angles ${(anglesBody.length / 1024).toFixed(1)} KB`);
  const forms: Record<string, number> = {};
  for (const g of Object.values(out.map)) for (const f of Object.values(g)) forms[out.forms[f]] = (forms[out.forms[f]] ?? 0) + 1;
  console.log(`${slug}: ${out.parts} parts, ${out.questions} questions, ${Object.keys(out.topics).length} topics, ${(body.length / 1024).toFixed(1)} KB, sha ${createHash("sha1").update(body).digest("hex").slice(0, 10)}`);
  console.log(JSON.stringify(forms));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
