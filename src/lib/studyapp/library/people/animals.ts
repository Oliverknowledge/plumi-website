import registry from "./animals.json";

/**
 * The animals a student can be (instead of a layered person): who they are, as `tools/art/animal_sheet.py` writes it to
 * `animals.json` beside this file (that tool is the one place an animal is configured: its id, name, the colours of the jumper it
 * wears and where its tail swishes). The ART is not here: each animal's strip is public/library/characters/<id>.png, fetched
 * only when someone in the room or the wardrobe is that animal (never with the page's first load); only this small list is bundled.
 *
 * THE ID is the avatar's `body` value, so it must pass what the server takes there (see docs/study/library.md, "Characters"):
 * lower case letters, 3 to 12 of them. `animals.test.ts` holds every id to that.
 */

/** The four directions of an animal's strip, as the sheet draws them. */
export type StripDir = "down" | "left" | "up" | "right";

export interface Animal {
  id: string;
  /** What the wardrobe calls it. */
  title: string;
  /** The hex colours (as drawn into the strip) of the jumper or scarf: the torso, whose centre is where the feet are, and the neck line the head ends at. */
  jumper: readonly string[];
  /** The swish of the idle: how many columns past the torso's centre the tail starts, per direction (null: it does not swish). */
  tail: Readonly<Record<StripDir, number | null>>;
  /** "drawn": its seated frames (sit right and left, phone, read, stool: strip frames 48 to 77) are art drawn for sitting (tools/art/animal_sit.py), not the standing art made to sit. Absent: the stand-in. */
  seated?: "drawn";
}

export const ANIMALS: readonly Animal[] = registry as readonly Animal[];
export const ANIMAL_IDS: readonly string[] = ANIMALS.map((a) => a.id);
/** The animal an id names, or null. */
export const animalOf = (id: string | null | undefined): Animal | null => (typeof id === "string" ? ANIMALS.find((a) => a.id === id) ?? null : null);
/** Where an animal's strip is. */
export const animalUrl = (id: string) => `/library/characters/${id}.png`;
/** The same animal at 2x (see animal.ts `HI`). */
export const animalHiUrl = (id: string) => `/library/characters/${id}@2x.png`;
