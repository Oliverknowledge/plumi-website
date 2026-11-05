/**
 * Builds a bank's Topic analysis data: for each topic and each exam series, how many of its parts are asked in each form, and which form each part is.
 *
 *     npm run bank:insights -- ocr-a-level-biology-a            # read the bank's data from R2 (public read), write the file
 *     npm run bank:insights -- ocr-a-level-biology-a --check    # build in memory, say whether the committed file is out of date (writes nothing)
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
import { classifyForm, FORMS, type Form } from "../../src/lib/studyapp/questions/questionForm";
import { resolvePapersBase } from "../../src/config/papers";
import { questionText } from "../../src/lib/studyapp/questions/partText";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const R2 = resolvePapersBase(process.env.NEXT_PUBLIC_PAPERS_URL, "production");

interface Part { id: string; p: string; s: string; l: string; m: number | null; t: string[]; k?: string }
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

export function build(meta: Meta, parts: Part[], text: Record<string, string>): Insights {
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
    const f = form(classifyForm({ text: q.text.toLowerCase(), marks: part.m, key: part.k }));
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
  return {
    v: 1, slug: meta.slug,
    built: Object.fromEntries(Object.entries(meta.data).filter(([k]) => k === "parts" || k === "text").sort(([a], [b]) => (a < b ? -1 : 1))),
    forms, series, cover: Object.fromEntries([...covered].sort(([a], [b]) => a - b).map(([y, c]) => [String(y), c.map((x) => (x ? "1" : "0")).join("")])), parts: ordered.length, questions: questions.size, topics,
    map: Object.fromEntries(Object.keys(map).sort().map((g) => [g, Object.fromEntries(Object.entries(map[g]).sort(([a], [b]) => (a < b ? -1 : 1)))])),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith("--"));
  if (!slug) throw new Error("usage: npm run bank:insights -- <slug> [--check] [--dir <folder>]");
  const check = args.includes("--check");
  const dirAt = args.indexOf("--dir");
  const dir = dirAt >= 0 ? args[dirAt + 1] : null;
  const meta = JSON.parse(readFileSync(join(ROOT, "src", "content", "questionBank", `${slug}.json`), "utf8")) as Meta;
  if (!meta.data?.parts || !meta.data?.text) throw new Error(`${slug}: its meta names no parts or text data file`);
  const parts = (await read(slug, "parts", meta.data.parts, dir)) as Part[];
  const text = (await read(slug, "text", meta.data.text, dir)) as Record<string, string>;
  if (!Array.isArray(parts) || !parts.length || typeof text !== "object") throw new Error("the data files are not what they should be");
  const out = build(meta, parts, text);
  const body = render(out);
  const file = join(ROOT, "src", "content", "questionBankInsights", `${slug}.json`);
  // index.json: each bank that has insights, with the parts hash they were built from. The app reads only this (a few bytes) to know, without loading the file, whether to offer Topic
  // analysis; a bank cut again under a new hash stops offering it until the insights are built again, so a stale file is never shown.
  const indexFile = join(dirname(file), "index.json");
  const index: Record<string, string> = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, "utf8")) : {};
  index[slug] = meta.data.parts;
  const indexBody = JSON.stringify(Object.fromEntries(Object.entries(index).sort(([a], [b]) => (a < b ? -1 : 1))), null, 1) + "\n";
  if (check) {
    const now = existsSync(file) ? readFileSync(file, "utf8") : "";
    const nowIndex = existsSync(indexFile) ? readFileSync(indexFile, "utf8") : "";
    if (now !== body || nowIndex !== indexBody) { console.error(`${slug}: the insights file is out of date. Run npm run bank:insights -- ${slug}`); process.exit(1); }
    console.log(`${slug}: insights are up to date`);
    return;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  writeFileSync(indexFile, indexBody);
  const forms: Record<string, number> = {};
  for (const g of Object.values(out.map)) for (const f of Object.values(g)) forms[out.forms[f]] = (forms[out.forms[f]] ?? 0) + 1;
  console.log(`${slug}: ${out.parts} parts, ${out.questions} questions, ${Object.keys(out.topics).length} topics, ${(body.length / 1024).toFixed(1)} KB, sha ${createHash("sha1").update(body).digest("hex").slice(0, 10)}`);
  console.log(JSON.stringify(forms));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
