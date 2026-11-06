import type { PremadeToAdd } from "./model";
import type { PremadeModule, PremadeSpec, PremadeSubject } from "./premadeBuild";

/**
 * The ready-made decks catalogue, as the Flashcards page reads it. The data (src/content/premadeDecks, built from the iPad's definition
 * files by `npm run decks:build`) is fetched only when a student opens the catalogue: `loadPremade` is a dynamic import, so none of it
 * is in the study app's first load. Everything else here is pure and tested (premade.test.ts).
 */

export const PREMADE_SUBJECTS = [
  { slug: "biology", name: "Biology" },
  { slug: "chemistry", name: "Chemistry" },
  { slug: "physics", name: "Physics" },
] as const;
export type PremadeSlug = (typeof PREMADE_SUBJECTS)[number]["slug"];

/** The two kinds of module deck, as the iPad names them: "Key wording · <module>" (Plumi's own definitions) and "Mark scheme · <module>" (the board's own wording). */
export type PremadeGroup = "kw" | "ms";
export const GROUPS: { id: PremadeGroup; name: string }[] = [{ id: "kw", name: "Key wording" }, { id: "ms", name: "Mark scheme" }];
export const deckTitle = (group: PremadeGroup, module: string) => `${group === "ms" ? "Mark scheme" : "Key wording"} \u00B7 ${module}`;

/** The boards that have mark scheme cards, known before any data is fetched (so their chips show at once). */
export interface MsBoard { id: string; label: string; code: string }
export const MS_BOARDS: Record<PremadeSlug, MsBoard[]> = {
  biology: [{ id: "AQA-7402", label: "AQA", code: "7402" }, { id: "OCR-H420", label: "OCR", code: "H420" }, { id: "AQA-8461", label: "AQA GCSE", code: "8461" }],
  chemistry: [{ id: "AQA-7405", label: "AQA", code: "7405" }, { id: "OCR-H432", label: "OCR A", code: "H432" }, { id: "AQA-8462", label: "AQA GCSE", code: "8462" }],
  physics: [{ id: "AQA-7408", label: "AQA", code: "7408" }, { id: "OCR-H556", label: "OCR", code: "H556" }, { id: "EDEXCEL-9PH0", label: "Edexcel", code: "9PH0" }, { id: "AQA-8463", label: "AQA GCSE", code: "8463" }],
};
const MS_IDS = new Set(Object.values(MS_BOARDS).flat().map((b) => b.id));
const GCSE_IDS = new Set(Object.values(MS_BOARDS).flat().filter((b) => b.label.endsWith("GCSE")).map((b) => b.id));

const cache = new Map<PremadeSlug, Promise<PremadeSubject>>();

/** One subject's data. Each file is its own chunk; a failed fetch is forgotten so the next try asks again. */
export function loadPremade(slug: PremadeSlug): Promise<PremadeSubject> {
  let p = cache.get(slug);
  if (!p) {
    const load =
      slug === "biology" ? import("@/content/premadeDecks/biology.json")
      : slug === "chemistry" ? import("@/content/premadeDecks/chemistry.json")
      : import("@/content/premadeDecks/physics.json");
    p = load.then((m) => (m.default ?? m) as unknown as PremadeSubject);
    p.catch(() => cache.delete(slug));
    cache.set(slug, p);
  }
  return p;
}

/** The mark scheme decks every student may see: modules and card counts per specification, with no card text (src/content/premadeDecks/markscheme-index.json). */
export interface MsIndexSpec { id: string; subject: string; label: string; code: string; mods: { c: string; t: string; n: number }[] }
let indexLoad: Promise<MsIndexSpec[]> | null = null;
export function loadMarkSchemeIndex(): Promise<MsIndexSpec[]> {
  indexLoad ??= import("@/content/premadeDecks/markscheme-index.json").then((m) => ((m.default ?? m) as unknown as { specs: MsIndexSpec[] }).specs);
  indexLoad.catch(() => { indexLoad = null; });
  return indexLoad;
}

/** Why the cards did not come: the server would not (not Pro), or could not. The student sees the Pro panel for the first, "didn't open" for the second. */
export class MarkSchemeDenied extends Error {}

/**
 * One specification's cards, from the server, with the student's own access token. Only a Pro account gets them (403 otherwise). Kept in memory for the
 * visit, never written anywhere else.
 */
const msCache = new Map<string, PremadeSubject>();
export async function loadMarkScheme(specId: string, token: string): Promise<PremadeSubject> {
  const hit = msCache.get(specId);
  if (hit) return hit;
  const res = await fetch(`/api/premade/markscheme/${encodeURIComponent(specId.toLowerCase())}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (res.status === 401 || res.status === 403) throw new MarkSchemeDenied();
  if (!res.ok) throw new Error(`mark scheme ${res.status}`);
  const data = (await res.json()) as PremadeSubject;
  msCache.set(specId, data);
  return data;
}

/** A deck's stable id, kept on the student's deck as `starter`: a deck is added once. Mark scheme decks are `pm:ms:<spec>:<module>`. */
export const premadeKey = (slug: string, specId: string, moduleCode: string) => `pm:${slug}:${specId}:${moduleCode}`;
export const msKey = (specId: string, moduleCode: string) => premadeKey("ms", specId, moduleCode);
export const isPremadeKey = (starter: string | null | undefined) => !!starter && starter.startsWith("pm:");

/** A module deck as the catalogue lists it. Light: the cards are only cut out when the deck is added (`cardsOf`). */
export interface PremadeEntry { key: string; title: string; /** The module's own name: what a tile shows (the deck is titled with its kind in front). */ module: string; count: number; mod: PremadeModule }

/** A board's decks in the specification's own module order. */
export function entriesOf(data: PremadeSubject, spec: PremadeSpec): PremadeEntry[] {
  const ms = data.kind === "markscheme";
  const slug = data.subject.toLowerCase();
  return spec.mods.map((mod) => ({
    key: ms ? msKey(spec.id, mod.c) : premadeKey(slug, spec.id, mod.c), title: deckTitle(ms ? "ms" : "kw", mod.t),
    module: mod.t, count: mod.k.length, mod,
  }));
}

/** The tiles of one board's mark scheme decks, from the public index (names and counts: no card text, no card id). `mod.k` is empty until the cards are fetched. */
export function msEntriesFromIndex(spec: MsIndexSpec): PremadeEntry[] {
  return spec.mods.map((m) => ({ key: msKey(spec.id, m.c), title: deckTitle("ms", m.t), module: m.t, count: m.n, mod: { c: m.c, t: m.t, k: [] } }));
}

/** The deck, ready for `actions.addPremade`. */
export function toAdd(data: PremadeSubject, entry: PremadeEntry): PremadeToAdd {
  return { key: entry.key, title: entry.title, subject: data.subject, cards: entry.mod.k.map((i) => [data.cards[i][1], data.cards[i][2]] as const) };
}

/**
 * Which specification a student's question-bank subject is, for the three subjects here. The bank's slug names the level and the board;
 * a board or variant the iPad has no definitions for (OCR Biology B, Edexcel Biology B, AQA GCSE, CIE, WJEC...) maps to nothing, so a
 * student on one is offered the boards' lists with none chosen for them, never a board that is not theirs.
 */
const SPEC_OF_SLUG: Record<string, { slug: PremadeSlug; spec: string }> = {
  // AQA GCSE: mark scheme cards only (the iPad has no key-wording definitions below A-level).
  "aqa-gcse-biology": { slug: "biology", spec: "AQA-8461" },
  "aqa-gcse-chemistry": { slug: "chemistry", spec: "AQA-8462" },
  "aqa-gcse-physics": { slug: "physics", spec: "AQA-8463" },
  "aqa-a-level-biology": { slug: "biology", spec: "AQA-7402" },
  "ocr-a-level-biology-a": { slug: "biology", spec: "OCR-H420" },
  "edexcel-a-level-biology-a": { slug: "biology", spec: "EDEXCEL-9BN0" },
  "aqa-a-level-chemistry": { slug: "chemistry", spec: "AQA-7405" },
  "ocr-a-level-chemistry-a": { slug: "chemistry", spec: "OCR-H432" },
  "ocr-a-level-chemistry-b": { slug: "chemistry", spec: "OCR-H433" },
  "edexcel-a-level-chemistry": { slug: "chemistry", spec: "EDEXCEL-9CH0" },
  "aqa-a-level-physics": { slug: "physics", spec: "AQA-7408" },
  "ocr-a-level-physics-a": { slug: "physics", spec: "OCR-H556" },
  "edexcel-a-level-physics": { slug: "physics", spec: "EDEXCEL-9PH0" },
};

/**
 * The specification to open a subject's tab on: the first of the student's subjects (their order) that is this subject, else the board
 * of a set they worked on for it (`recent`, newest first), else null. How it was decided is the student's own choice in the Questions setup:
 * nothing is guessed from anywhere else.
 */
export function boardFor(slug: PremadeSlug, mine: readonly string[] | undefined, recent: readonly string[] = [], group: PremadeGroup = "kw"): string | null {
  for (const s of [...(mine ?? []), ...recent]) {
    const hit = SPEC_OF_SLUG[s];
    // The GCSE specs have no key wording; every spec with a mark scheme file has mark scheme cards.
    if (hit && hit.slug === slug && (group === "ms" ? MS_IDS.has(hit.spec) : !GCSE_IDS.has(hit.spec))) return hit.spec;
  }
  return null;
}

/** The specs to list, the student's own board first. */
export function orderSpecs(specs: readonly PremadeSpec[], own: string | null): PremadeSpec[] {
  return [...specs].sort((a, b) => Number(b.id === own) - Number(a.id === own));
}
