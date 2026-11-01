import { known, lookKey, personOf, speciesOf, type AvatarKeys, type PeopleCatalogue, type PersonLook } from "./look";

/**
 * The web wardrobe's data and rules: what a student may put on here, and how a choice becomes the avatar that is saved.
 *
 * OWNERSHIP. On the iPad most parts are bought with ink earned by studying (and a few are unlocked by a streak or by
 * focus hours); what a student owns is kept on the device and the server does not check it (`set_avatar` only checks
 * keys and values). The web has no ink and must not walk around that economy. So it offers ONLY what the iPad gives
 * from the first day: the items with `price == 0 and unlock == nil` in RoomStore.swift's `WardrobeItem.all`, and the
 * colours of a hairstyle or outfit (changing a colour is free there: `RoomStore.setVariant`). Anything else a student
 * is already wearing (dressed on the iPad) stays on, shown as "Current", and goes only if they pick something else
 * in that slot. wardrobe.test.ts compares this list with the Swift source when the app repo is beside this one.
 *
 * SAVING. `set_avatar` REPLACES the whole avatar (migration 0120: UPDATE social_profile SET avatar = $1), and accepts
 * only these keys, each a short identifier or a #rrggbb colour. So a save starts from the avatar the student has now
 * and changes only body, eyes, outfit, hair, acc and phones ("none" when empty, as RoomAvatar.avatar writes them):
 * `pro` and every older key stay as they were, and no key is ever invented. A fox changes `body` alone.
 */

export type Slot = "skin" | "eyes" | "hair" | "outfit" | "glasses" | "phones";
export interface Item { slot: Slot; value: string; title: string }

const item = (slot: Slot, value: string, title: string): Item => ({ slot, value, title });

/** RoomStore.swift WardrobeItem.all, the items that are free and have no unlock. Titles are the iPad's. */
export const FREE_ITEMS: readonly Item[] = [
  ...["Fair", "Rose", "Peach", "Tan", "Olive", "Pale", "Honey"].map((t, i) => item("skin", String(i + 1).padStart(2, "0"), t)),
  ...[1, 2, 3, 4, 5, 6, 7].map((i) => item("eyes", String(i).padStart(2, "0"), `Eyes ${i}`)),
  item("hair", "01", "Crop"), item("hair", "03", "Tuft"), item("hair", "04", "Bob"), item("hair", "05", "Spiky"),
  item("hair", "06", "Side part"), item("hair", "12", "Short"),
  item("outfit", "01", "Scarf jumper"), item("outfit", "02", "Flannel"), item("outfit", "04", "Green jumper"),
  item("outfit", "10", "Hoodie"), item("outfit", "12", "Shirt"),
  item("glasses", "none", "No glasses"),
  item("phones", "none", "No headphones"), item("phones", "teal", "Teal headphones"), item("phones", "red", "Red headphones"),
];

export const SLOTS: readonly { slot: Slot; title: string }[] = [
  { slot: "skin", title: "Skin" }, { slot: "hair", title: "Hair" }, { slot: "outfit", title: "Outfit" },
  { slot: "eyes", title: "Eyes" }, { slot: "glasses", title: "Glasses" }, { slot: "phones", title: "Headphones" },
];

export const itemsIn = (slot: Slot) => FREE_ITEMS.filter((i) => i.slot === slot);

/**
 * THE CHARACTER. A student is a Person (the layered wardrobe above) or a Fox. A fox is one animal as it is drawn (no skin,
 * hair or outfit yet: nothing to choose), written as `body: "fox"` (the server takes any identifier there) beside every
 * key the avatar already has, so an iPad, which does not know the fox, draws the person those keys make. Both are free:
 * the web has no ink. The look keeps the person fields while the fox is chosen, so choosing Person again puts back the
 * person that was being dressed (the `body` the server kept is gone once the fox is saved: after that the person is the
 * one the other keys, or the id, make).
 */
export type Character = "person" | "fox";
export const CHARACTERS: readonly { id: Character; title: string }[] = [{ id: "person", title: "Person" }, { id: "fox", title: "Fox" }];
export const characterOf = (look: PersonLook): Character => (speciesOf(look.species) === "fox" ? "fox" : "person");
/** The look as this character, keeping the person fields behind it. */
export function asCharacter(look: PersonLook, c: Character): PersonLook {
  const { species: _gone, ...person } = look;
  void _gone;
  return c === "fox" ? { ...person, species: "fox" } : person;
}

/** Everyone's first look (PersonLook.starter): what Reset goes back to. */
export const STARTER_LOOK: PersonLook = { body: "02", eyes: "01", outfit: "10_01", hair: "05_01", accessory: null, phones: "teal" };

/** The colour of a hairstyle or outfit worn now, "09_04" -> "04"; the first colour when it has none (`WardrobeItem.worn`'s `styled`). */
const colourOf = (id: string) => (id.length > 3 ? id.slice(-2) : "01");

/** The look with this item put on (`WardrobeItem.worn`): a hairstyle or outfit keeps the colour worn now where it comes in that colour, else its first. */
export function worn(cat: PeopleCatalogue, look: PersonLook, it: Item): PersonLook {
  const l = { ...look };
  const styled = (current: string, all: { id: string }[]) => {
    const same = `${it.value}_${colourOf(current)}`;
    if (all.length === 0 || all.some((a) => a.id === same)) return same;
    return all.find((a) => a.id.startsWith(it.value + "_"))?.id ?? same;
  };
  switch (it.slot) {
    case "skin": l.body = it.value; break;
    case "eyes": l.eyes = it.value; break;
    case "hair": l.hair = styled(look.hair, cat.parts.hair); break;
    case "outfit": l.outfit = styled(look.outfit, cat.parts.outfits); break;
    case "glasses": l.accessory = it.value === "none" ? null : it.value; break;
    case "phones": l.phones = it.value === "none" ? null : it.value; break;
  }
  return known(cat, l);
}

/** Whether a person is wearing this item (`WardrobeItem.isWorn`). */
export function isWorn(it: Item, look: PersonLook): boolean {
  switch (it.slot) {
    case "skin": return look.body === it.value;
    case "eyes": return look.eyes === it.value;
    case "hair": return look.hair.startsWith(it.value + "_");
    case "outfit": return look.outfit.startsWith(it.value + "_");
    case "glasses": return (look.accessory ?? "none") === it.value;
    case "phones": return (look.phones ?? "none") === it.value;
  }
}

/** What a person wears in a slot that the free set does not offer (dressed on the iPad): shown as "Current". Null when the free set has it. */
export function currentOutsideFree(look: PersonLook, slot: Slot): Item | null {
  if (itemsIn(slot).some((i) => isWorn(i, look))) return null;
  switch (slot) {
    case "hair": return item("hair", look.hair.slice(0, 2), "Current");
    case "outfit": return item("outfit", look.outfit.slice(0, 2), "Current");
    case "glasses": return item("glasses", look.accessory ?? "none", "Current");
    case "phones": return item("phones", look.phones ?? "none", "Current");
    default: return null;
  }
}

/** The colours the hairstyle or outfit worn now comes in: free to change (`RoomStore.variants`). */
export function variants(cat: PeopleCatalogue, look: PersonLook, slot: "hair" | "outfit"): { id: string; colour: string }[] {
  const all = slot === "hair" ? cat.parts.hair : cat.parts.outfits;
  const worn = slot === "hair" ? look.hair : look.outfit;
  return all.filter((p) => p.id.slice(0, 3) === worn.slice(0, 3)).map((p) => ({ id: p.id, colour: p.colour ?? "#808080" }));
}

/** A colour of the hairstyle or outfit worn now (`RoomStore.setVariant`: the same style only). */
export function withVariant(cat: PeopleCatalogue, look: PersonLook, slot: "hair" | "outfit", id: string): PersonLook {
  const cur = slot === "hair" ? look.hair : look.outfit;
  if (id.slice(0, 3) !== cur.slice(0, 3) || !variants(cat, look, slot).some((v) => v.id === id)) return look;
  return slot === "hair" ? { ...look, hair: id } : { ...look, outfit: id };
}

/** A person put together from the free set, by chance: any skin, eyes, free hairstyle and outfit in any of their colours, no glasses, headphones or none. */
export function randomLook(cat: PeopleCatalogue, rnd: () => number = Math.random): PersonLook {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rnd() * xs.length))];
  let look = { ...STARTER_LOOK, phones: pick<string | null>([null, "teal", "red"]) };
  for (const slot of ["skin", "eyes", "hair", "outfit"] as const) look = worn(cat, look, pick(itemsIn(slot)));
  for (const slot of ["hair", "outfit"] as const) look = withVariant(cat, look, slot, pick(variants(cat, look, slot)).id);
  return look;
}

/* ── The avatar that is saved ─────────────────────────────────────────── */

/** The keys `set_avatar` accepts (migration 0120). */
export const AVATAR_KEYS: ReadonlySet<string> = new Set([
  "feather", "top", "colour", "shade", "accent", "legs", "shoe", "hat", "hat_colour", "scarf", "glasses",
  "body", "eyes", "outfit", "hair", "acc", "phones", "pro",
]);
/** A value the server accepts: a short identifier or a #rrggbb colour. */
export const validAvatarValue = (v: unknown): v is string => typeof v === "string" && (/^[a-z0-9_-]{1,24}$/.test(v) || /^#[0-9a-f]{6}$/.test(v));

/**
 * The avatar to send: the one the student has now, with only the person's keys changed. Anything in it the server
 * would refuse (a key it does not know, a value it does not like) is left out, so one odd old key cannot make a save fail.
 */
export function mergeAvatar(current: AvatarKeys | null | undefined, look: PersonLook): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(current ?? {})) if (AVATAR_KEYS.has(k) && validAvatarValue(v)) out[k] = v;
  // A fox changes `body` and nothing else: every other key stays exactly as it is (the person keys too, so an iPad draws that person).
  const fox = speciesOf(look.species);
  if (fox) { out.body = fox; return out; }
  out.body = look.body; out.eyes = look.eyes; out.outfit = look.outfit; out.hair = look.hair;
  out.acc = look.accessory ?? "none"; out.phones = look.phones ?? "none";
  return out;
}

/** Whether two looks are the same person. */
export const sameLook = (a: PersonLook, b: PersonLook) => lookKey(a) === lookKey(b);

/** The person a student is now, for the wardrobe to start from. */
export const lookNow = (cat: PeopleCatalogue, avatar: AvatarKeys | null | undefined, colour: number, id: string) => personOf(cat, avatar, colour, id);

/** The one short line after a save that did not go: the student's words, never a code or a rule. The choice stays on screen. */
export function saveLine(failure: { kind: string; reason?: string }): string {
  return failure.kind === "offline" ? "No connection. Try again in a moment" : "That didn\u2019t save. Try again in a moment";
}
