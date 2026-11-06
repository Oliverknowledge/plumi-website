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

/** A deck's stable id, kept on the student's deck as `starter`: a deck is added once. */
export const premadeKey = (slug: string, specId: string, moduleCode: string) => `pm:${slug}:${specId}:${moduleCode}`;
export const isPremadeKey = (starter: string | null | undefined) => !!starter && starter.startsWith("pm:");

/** The fewest cards a deck needs to be the free taster: a module of five is not a taste of anything. */
export const TASTER_MIN = 10;

/** A module deck as the catalogue lists it. Light: the cards are only cut out when the deck is added (`cardsOf`). */
export interface PremadeEntry { key: string; title: string; count: number; free: boolean; mod: PremadeModule }

/**
 * A board's decks in the specification's own module order. `free`: the taster each subject keeps open when Pro is required
 * (see pro.ts): the first deck on the board with at least `TASTER_MIN` cards.
 */
export function entriesOf(data: PremadeSubject, spec: PremadeSpec): PremadeEntry[] {
  const slug = data.subject.toLowerCase();
  const taster = spec.mods.findIndex((m) => m.k.length >= TASTER_MIN);
  return spec.mods.map((mod, i) => ({ key: premadeKey(slug, spec.id, mod.c), title: mod.t, count: mod.k.length, free: i === (taster < 0 ? 0 : taster), mod }));
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
export function boardFor(slug: PremadeSlug, mine: readonly string[] | undefined, recent: readonly string[] = []): string | null {
  for (const s of [...(mine ?? []), ...recent]) {
    const hit = SPEC_OF_SLUG[s];
    if (hit && hit.slug === slug) return hit.spec;
  }
  return null;
}

/** The specs to list, the student's own board first. */
export function orderSpecs(specs: readonly PremadeSpec[], own: string | null): PremadeSpec[] {
  return [...specs].sort((a, b) => Number(b.id === own) - Number(a.id === own));
}
