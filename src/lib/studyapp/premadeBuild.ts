/**
 * The ready-made decks, built from the iPad app's definition files. Pure: no files, no network, so every rule is tested
 * (premadeBuild.test.ts). `scripts/premade-decks/build.ts` reads the iPad's JSON and calls this; the website itself only
 * ever reads the committed output (src/content/premadeDecks/<subject>.json), never the iPad repository.
 *
 * What it mirrors from the iPad (Features/Flashcards/SubjectDefinitions.swift, KeyWordingSets.swift, Physics/Concepts/KeyWording.swift):
 *   - one deck per module of a specification, where a card is filed under the root of the topic its FIRST topic code names on that board
 *     (Physics: the first topic its skill maps to on that board, canonical_skills_physics.json);
 *   - a board that does not list a card does not get it;
 *   - the card's back is the answer with its required words in `**bold**` and its first letter capitalised, and nothing else added;
 *   - module names are the specification topic trees' own (topics_*.json), never invented here.
 * What it leaves out, on purpose: the cards each file lists in `sign_off` (held back until a teacher has looked), and any card that no
 * board's tree can place (counted, never guessed).
 */

import { writeBack, writeFront } from "./markscheme";

export interface Definition {
  id: string;
  prompt: string;
  answer: string;
  /** The words the answer cannot lose, each one word-for-word in it: drawn bold on the card (see `bolded`). */
  required?: string[];
  /** Physics only: the canonical skill, which maps to each board's topic. */
  skill?: string;
  /** Biology and Chemistry: specification id to that board's topic codes; the first is where the card is filed. */
  topics?: Record<string, string[]>;
}
export interface DefinitionsFile { subject?: string; sign_off?: { id: string }[]; definitions: Definition[] }
export interface TopicTree { topics: { code: string; parent_code: string | null; title: string }[] }
export interface SkillsFile { skills: { code: string; maps: { specification: string; topic_code?: string | null }[] }[] }

export interface SpecInput {
  /** "AQA-7402": the id the definitions' `topics` use. */
  id: string;
  /** How a student's board is named on a chip ("AQA", "OCR A", "OCR B", "Edexcel"). */
  label: string;
  /** The specification's own code ("7402"). */
  code: string;
  tree: TopicTree;
}

/** One module of one specification, and its cards (indexes into `cards`, in the order the iPad writes them). */
export interface PremadeModule { c: string; t: string; k: number[] }
export interface PremadeSpec { id: string; label: string; code: string; mods: PremadeModule[] }
export interface PremadeSubject {
  v: 1;
  /** Absent for the key-wording decks; "markscheme" for the boards' own mark scheme cards (one specification a file). */
  kind?: "markscheme";
  subject: string;
  /** SHA-256 of each source file this was built from, by file name. */
  src: Record<string, string>;
  /** Cards held back (the file's `sign_off`), by id: not in `cards`. */
  held: string[];
  /** Cards no board's tree could place, by id: not in `cards`. */
  unmapped: string[];
  specs: PremadeSpec[];
  /** [id, front, back]: the iPad's id, its prompt, its answer with its key words in `**bold**` and a capital. */
  cards: [string, string, string][];
}

/** The longest a module name can be: a deck is "Key wording · <module>" or "Mark scheme · <module>", and `addDeck` keeps 64 characters for a catalogue deck (model.ts `PREMADE_LIMITS`). */
export const MAX_TITLE = 50;
const EM_DASH = "—";

/**
 * The first letter in capitals, as the iPad does (`KeyWording.capitalised`): the first character that is not a `*`, so a bold run at the start
 * is capitalised inside its markers.
 */
export function capitalise(text: string): string {
  const chars = [...text];
  const at = chars.findIndex((c) => c !== "*");
  if (at < 0) return text;
  chars[at] = chars[at].toUpperCase();
  return chars.join("");
}

/** The first case-insensitive occurrence of `phrase` that is not inside `**...**` (`KeyWording.unwrappedRange`): the text before it holds an even number of markers. */
function unwrappedRange(text: string, phrase: string): [number, number] | null {
  const lower = text.toLowerCase(), needle = phrase.toLowerCase();
  if (lower.length !== text.length || needle.length !== phrase.length || !needle) throw new Error(`case folding changes the length of ${JSON.stringify(text.slice(0, 40))}`);
  let from = 0;
  for (;;) {
    const at = lower.indexOf(needle, from);
    if (at < 0) return null;
    if ((text.slice(0, at).split("**").length - 1) % 2 === 0) return [at, at + phrase.length];
    from = at + phrase.length;
  }
}

/**
 * `text` with each required phrase wrapped in `**` at its first occurrence, ignoring case: the iPad's `KeyWording.bolded`, step for step.
 * Longest first, and never inside a phrase already wrapped, so "per unit charge" is bolded whole rather than "charge" alone. A phrase the
 * text does not contain at all is added as "Key words: ..." after it, as the iPad does (the iPad's tests hold that no definition needs this).
 * The `accept` map plays no part: it is only for marking a typed answer.
 */
export function bolded(text: string, required: readonly string[]): string {
  let result = text;
  const missing: string[] = [];
  for (const phrase of [...required].sort((a, b) => [...b].length - [...a].length)) {
    const r = unwrappedRange(result, phrase);
    if (!r) {
      if (!result.toLowerCase().includes(phrase.toLowerCase())) missing.push(phrase);
      continue;
    }
    result = `${result.slice(0, r[0])}**${result.slice(r[0], r[1])}**${result.slice(r[1])}`;
  }
  return missing.length ? `${result}\nKey words: ${missing.map((m) => `**${m}**`).join(", ")}` : result;
}

/** The back of a card: bold first, then the capital (`KeyWording.back`, with no board term). */
export const cardBack = (answer: string, required: readonly string[] = []): string => capitalise(bolded(answer, required));

/** A text a student reads must not hold an em dash (founder's rule). */
export function noEmDash(label: string, text: string): void {
  if (text.includes(EM_DASH)) throw new Error(`em dash in ${label}: ${JSON.stringify(text.slice(0, 80))}`);
}

/** The root (module) title and code of a topic code in a tree, or null if the tree has no such code. */
function moduleOf(tree: TopicTree, code: string): { c: string; t: string } | null {
  const byCode = new Map(tree.topics.map((t) => [t.code, t]));
  let cur = byCode.get(code);
  for (let i = 0; cur && cur.parent_code !== null && i < 16; i++) cur = byCode.get(cur.parent_code);
  return cur && cur.parent_code === null ? { c: cur.code, t: cur.title } : null;
}

/** Where a Physics skill sits on one board: the first mapping that names a topic (`KeyWording.skillMaps`). */
function skillCodes(skills: SkillsFile): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  for (const s of skills.skills) {
    const bySpec = new Map<string, string>();
    for (const m of s.maps) if (!bySpec.has(m.specification) && m.topic_code) bySpec.set(m.specification, m.topic_code);
    out.set(s.code, bySpec);
  }
  return out;
}

export interface BuildInput {
  subject: string;
  file: DefinitionsFile;
  specs: SpecInput[];
  /** Physics' definitions place themselves through skills. */
  skills?: SkillsFile;
  /** SHA-256 by source file name, written to `src`. */
  hashes: Record<string, string>;
}
export interface BuildReport {
  /** Cards a board lists but whose code is in no module of its tree (a data fault to tell the iPad's author). */
  noModule: Record<string, string[]>;
  /** How many cards each board has no entry for (it does not teach them: not a fault). */
  notTaught: Record<string, number>;
}

export function buildSubject(input: BuildInput): { data: PremadeSubject; report: BuildReport } {
  const { file, specs } = input;
  const held = new Set((file.sign_off ?? []).map((s) => s.id));
  const codes = input.skills ? skillCodes(input.skills) : null;
  const report: BuildReport = { noModule: {}, notTaught: {} };

  // Place every card on every board first, so the cards array holds only cards that reach a deck.
  const placed = new Map<string, Map<string, { c: string; t: string }>>(); // card id -> spec id -> module
  const seen = new Set<string>();
  for (const d of file.definitions) {
    if (seen.has(d.id)) throw new Error(`duplicate card id ${d.id}`);
    seen.add(d.id);
    if (held.has(d.id)) continue;
    const bySpec = new Map<string, { c: string; t: string }>();
    for (const spec of specs) {
      const code = codes ? codes.get(d.skill ?? "")?.get(spec.id) : d.topics?.[spec.id]?.[0];
      if (!code) { report.notTaught[spec.id] = (report.notTaught[spec.id] ?? 0) + 1; continue; }
      const mod = moduleOf(spec.tree, code);
      if (!mod) { (report.noModule[spec.id] ??= []).push(d.id); continue; }
      bySpec.set(spec.id, mod);
    }
    if (bySpec.size > 0) placed.set(d.id, bySpec);
  }

  const cards: [string, string, string][] = [];
  const index = new Map<string, number>();
  const unmapped: string[] = [];
  for (const d of file.definitions) {
    if (held.has(d.id)) continue;
    if (!placed.has(d.id)) { unmapped.push(d.id); continue; }
    noEmDash(`${d.id} prompt`, d.prompt);
    noEmDash(`${d.id} answer`, d.answer);
    index.set(d.id, cards.length);
    cards.push([d.id, d.prompt, cardBack(d.answer, d.required)]);
  }

  const out: PremadeSpec[] = specs.map((spec) => {
    const mods = new Map<string, PremadeModule>();
    for (const d of file.definitions) {
      const mod = placed.get(d.id)?.get(spec.id);
      if (!mod) continue;
      const m = mods.get(mod.c) ?? { c: mod.c, t: mod.t, k: [] };
      m.k.push(index.get(d.id)!);
      mods.set(mod.c, m);
    }
    // The tree's own order of its modules (the iPad's `moduleOrder`), the empty ones left out.
    const order = spec.tree.topics.filter((t) => t.parent_code === null).map((t) => t.code);
    const list = order.map((c) => mods.get(c)).filter((m): m is PremadeModule => !!m);
    for (const m of list) {
      noEmDash(`${spec.id} module ${m.c}`, m.t);
      if (m.t.length > MAX_TITLE) throw new Error(`${spec.id} module title over ${MAX_TITLE} characters: ${m.t}`);
    }
    return { id: spec.id, label: spec.label, code: spec.code, mods: list };
  });

  return {
    data: { v: 1, subject: input.subject, src: sortKeys(input.hashes), held: [...held].sort(), unmapped, specs: out, cards },
    report,
  };
}

function sortKeys(o: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
}

/** The file's text as the build writes it: one card and one module per line so a change reads as a diff, no dates, a fixed order. */
export function render(d: PremadeSubject): string {
  const specs = d.specs.map((s) => `  {"id":${JSON.stringify(s.id)},"label":${JSON.stringify(s.label)},"code":${JSON.stringify(s.code)},"mods":[\n${s.mods.map((m) => `    ${JSON.stringify(m)}`).join(",\n")}\n  ]}`).join(",\n");
  const cards = d.cards.map((c) => `  ${JSON.stringify(c)}`).join(",\n");
  return `{\n"v":${d.v},\n${d.kind ? `"kind":${JSON.stringify(d.kind)},\n` : ""}"subject":${JSON.stringify(d.subject)},\n"src":${JSON.stringify(d.src)},\n"held":${JSON.stringify(d.held)},\n"unmapped":${JSON.stringify(d.unmapped)},\n"specs":[\n${specs}\n],\n"cards":[\n${cards}\n]\n}\n`;
}

/**
 * What can be said of committed data without the iPad's files (CI has none): the shape, every index in range, no em dash, every deck
 * name fits, and no held-back card present. Returns the faults, none if sound.
 */
export function verifyShape(d: unknown): string[] {
  const ms = (d as { kind?: unknown } | null)?.kind === "markscheme";
  const bad: string[] = [];
  const o = d as Partial<PremadeSubject> | null;
  if (!o || o.v !== 1 || typeof o.subject !== "string" || !Array.isArray(o.specs) || !Array.isArray(o.cards) || !Array.isArray(o.held)) return ["not the premade deck shape"];
  const ids = new Set<string>();
  o.cards.forEach((c, i) => {
    if (!Array.isArray(c) || c.length !== 3 || c.some((x) => typeof x !== "string" || !x.trim())) { bad.push(`card ${i} is not [id, front, back]`); return; }
    if (ids.has(c[0])) bad.push(`duplicate card ${c[0]}`);
    ids.add(c[0]);
    if (c[0] && o.held!.includes(c[0])) bad.push(`held-back card ${c[0]} is in the data`);
    if (c[1].includes(EM_DASH) || c[2].includes(EM_DASH)) bad.push(`em dash in ${c[0]}`);
    const lead = [...c[2]].find((ch) => ch !== "*") ?? "";
    if (!ms && lead !== lead.toUpperCase()) bad.push(`${c[0]} back is not capitalised`);
    if (ms && ((c[1] + c[2]).match(/[\^_]\{/g) ?? []).length !== ((c[1] + c[2]).match(/[\^_]\{[^{}\n]*\}/g) ?? []).length) bad.push(`${c[0]} has an unclosed script brace`);
    if ((c[2].split("**").length - 1) % 2 !== 0) bad.push(`${c[0]} has an unbalanced bold marker`);
    if (c[1].length > (ms ? 700 : 400) || c[2].length > (ms ? 1200 : 800)) bad.push(`${c[0]} is longer than a card can hold`);
  });
  const used = new Set<number>();
  for (const s of o.specs) {
    for (const m of s.mods) {
      if (m.t.length > MAX_TITLE || m.t.includes(EM_DASH)) bad.push(`${s.id} ${m.c}: title`);
      if (m.k.length === 0) bad.push(`${s.id} ${m.c}: empty module`);
      for (const k of m.k) { if (!Number.isInteger(k) || k < 0 || k >= o.cards.length) bad.push(`${s.id} ${m.c}: index ${k}`); else used.add(k); }
    }
  }
  for (let i = 0; i < o.cards.length; i++) if (!used.has(i)) bad.push(`card ${o.cards[i][0]} is in no deck`);
  return bad;
}

/* ── Mark scheme cards ─────────────────────────────────────────────────── */

/** One card of the iPad's `markscheme_cards_<spec>.json`. The web keeps what the review shows: id, question, marks, answer and the board's own lines. */
export interface MarkSchemeFileCard {
  id: string; prompt: string; marks: number; answer: string;
  allow: string[]; not: string[]; ignore: string[]; notes: string[];
  topics: string[];
}

/**
 * The codes to try for a bank topic code, as the iPad does (`MarkSchemeDecks.candidates`): the bank numbers some boards' topics a level deeper than
 * the app's tree (AQA GCSE "4.6.4" where the tree stops at "4.6") or without the app's prefix (Edexcel Physics "2.3" for "PH.2.3"), so each code is
 * tried with and without "PH." and then one level up at a time.
 */
export function candidatesForCode(code: string): string[] {
  const out: string[] = [];
  const parts = code.split(".");
  while (parts.length > 0) {
    const joined = parts.join(".");
    out.push(joined, `PH.${joined}`);
    parts.pop();
  }
  return out;
}

export interface MarkSchemeInput {
  subject: string;
  /** The file's cards. */
  cards: MarkSchemeFileCard[];
  spec: SpecInput;
  hashes: Record<string, string>;
}

/**
 * One specification's mark scheme cards, as decks of its modules ("Mark scheme · <module>"): a card is filed under the first of its topic codes that
 * names a module of the board's tree (the iPad's `MarkSchemeDecks.groups`). The text is carried verbatim: front and back are written as the iPad writes
 * them (markscheme.ts), the bold `**` markers are the board's own. A card no topic code can place is skipped and listed.
 */
export function buildMarkScheme(input: MarkSchemeInput): { data: PremadeSubject; report: { noModule: string[] } } {
  const { spec } = input;
  const cards: [string, string, string][] = [];
  const unmapped: string[] = [];
  const byModule = new Map<string, { c: string; t: string; k: number[] }>();
  const seen = new Set<string>();
  for (const c of input.cards) {
    if (seen.has(c.id)) throw new Error(`duplicate card id ${c.id}`);
    seen.add(c.id);
    let mod: { c: string; t: string } | null = null;
    for (const code of c.topics) {
      for (const cand of candidatesForCode(code)) { mod = moduleOf(spec.tree, cand); if (mod) break; }
      if (mod) break;
    }
    if (!mod) { unmapped.push(c.id); continue; }
    const front = writeFront(c.prompt, c.marks), back = writeBack(c);
    noEmDash(`${c.id} front`, front);
    noEmDash(`${c.id} back`, back);
    const m = byModule.get(mod.c) ?? { c: mod.c, t: mod.t, k: [] };
    m.k.push(cards.length);
    byModule.set(mod.c, m);
    cards.push([c.id, front, back]);
  }
  const order = spec.tree.topics.filter((t) => t.parent_code === null).map((t) => t.code);
  const mods = order.map((code) => byModule.get(code)).filter((m): m is PremadeModule => !!m);
  for (const m of mods) {
    noEmDash(`${spec.id} module ${m.c}`, m.t);
    if (m.t.length > MAX_TITLE) throw new Error(`${spec.id} module title over ${MAX_TITLE} characters: ${m.t}`);
  }
  return {
    data: { v: 1, kind: "markscheme", subject: input.subject, src: sortKeys(input.hashes), held: [], unmapped, specs: [{ id: spec.id, label: spec.label, code: spec.code, mods }], cards },
    report: { noModule: unmapped },
  };
}

/* ── The public index of the mark scheme decks ─────────────────────────── */

/**
 * What every student may see of the mark scheme decks: for each specification its modules, and how many cards each holds. No card text and no card id:
 * the cards themselves are served only to a Pro account (src/app/api/premade/markscheme, lib/studyapp/proServer.ts). Derived from the full files, so it can
 * be checked against them without the iPad's files.
 */
export interface MarkSchemeIndex { v: 1; kind: "markscheme-index"; specs: { id: string; subject: string; label: string; code: string; mods: { c: string; t: string; n: number }[] }[] }

export function buildMarkSchemeIndex(files: PremadeSubject[]): MarkSchemeIndex {
  return {
    v: 1, kind: "markscheme-index",
    specs: files.map((d) => ({ id: d.specs[0].id, subject: d.subject, label: d.specs[0].label, code: d.specs[0].code, mods: d.specs[0].mods.map((m) => ({ c: m.c, t: m.t, n: m.k.length })) })),
  };
}

export function renderIndex(x: MarkSchemeIndex): string {
  const specs = x.specs.map((s) => `  {"id":${JSON.stringify(s.id)},"subject":${JSON.stringify(s.subject)},"label":${JSON.stringify(s.label)},"code":${JSON.stringify(s.code)},"mods":${JSON.stringify(s.mods)}}`).join(",\n");
  return `{\n"v":1,\n"kind":"markscheme-index",\n"specs":[\n${specs}\n]\n}\n`;
}

/** Faults in an index: its shape, and that it holds nothing but names and counts. */
export function verifyIndex(d: unknown): string[] {
  const o = d as Partial<MarkSchemeIndex> | null;
  if (!o || o.v !== 1 || o.kind !== "markscheme-index" || !Array.isArray(o.specs)) return ["not the mark scheme index shape"];
  const bad: string[] = [];
  for (const s of o.specs) {
    if (typeof s.id !== "string" || !Array.isArray(s.mods) || s.mods.length === 0) { bad.push(`index ${String(s.id)}: no modules`); continue; }
    for (const m of s.mods) {
      if (typeof m.c !== "string" || typeof m.t !== "string" || !Number.isInteger(m.n) || m.n < 1 || Object.keys(m).length !== 3) bad.push(`index ${s.id} ${m.c}: not a name and a count`);
      else if (m.t.length > MAX_TITLE || m.t.includes(EM_DASH)) bad.push(`index ${s.id} ${m.c}: title`);
    }
  }
  return bad;
}
