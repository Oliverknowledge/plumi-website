/**
 * Who a student is drawn as: the iPad's `PersonLook`, `RoomAvatar.person(of:colour:id:)`, `PeopleArt.known` and
 * `PersonLook.derived`, ported rule for rule (Sources/PlumiKit/Features/StudyRoom/RoomAvatar.swift and
 * PixelWorld/PixelPeople.swift in the app repo). Pure: no browser, no art, only the parts catalogue
 * (public/library/people-layers.json, the app's lz_people.json).
 *
 * The hash is the iPad's (FNV-1a over the UTF-8 bytes, 32 bits), so a student whose avatar names no person is the
 * same derived person here as on every iPad. Anything a friend's app sent that this catalogue does not have becomes
 * the nearest part it does; nothing a friend sends can stop them being drawn.
 */

export interface PersonLook {
  /** "01" to "07". */
  body: string;
  /** "01" to "07". */
  eyes: string;
  /** A casual outfit and its colour, "12_03". */
  outfit: string;
  /** A hairstyle and its colour, "05_02". */
  hair: string;
  /** "15_glasses_01", or null for none. */
  accessory: string | null;
  /** "red", "cream", "black", "teal", "lilac", or null for no headphones. */
  phones: string | null;
  /**
   * An animal instead of a person ("fox", see `SPECIES`). Set when the avatar's `body` names one. The rest of the look
   * is still the person the student would be (the nearest person for an iPad that does not know the animal, the
   * wardrobe's Person tab, the avatar keys that are kept), but the room draws the animal.
   */
  species?: string | null;
}

/**
 * The values of an avatar's `body` that are an animal, not a skin ("01" to "07"). The server takes any identifier in
 * `body` (`set_avatar`: `^[a-z0-9_-]{1,24}$`), so no migration: the web writes `body: "fox"` and the person keys stay,
 * and an iPad that does not know the animal falls back to the person (`known` maps an unknown body to the first one).
 */
export const SPECIES: readonly string[] = ["fox"];
/** The animal a `body` value names, or null for a skin or anything else (an unknown value is treated as before: `known` maps it to a skin). */
export const speciesOf = (body: string | null | undefined): string | null => (typeof body === "string" && SPECIES.includes(body) ? body : null);

export interface CataloguePart { id: string; colour?: string }
/** lz_people.json, the parts of it a browser needs. */
export interface PeopleCatalogue {
  frame: [number, number];
  sheet: [number, number];
  stretch: number;
  headphones: Record<string, [string, string]>;
  band: string;
  parts: { bodies: CataloguePart[]; eyes: CataloguePart[]; outfits: CataloguePart[]; hair: CataloguePart[]; accessories: CataloguePart[]; books: CataloguePart[] };
  index: Record<string, [number, number]>;
}

/** What the server keeps in `social_profile.avatar`: string keys to string values. */
export type AvatarKeys = Readonly<Record<string, string>>;

/** Everyone's first look before they choose one (PersonLook.starter). */
export const STARTER: PersonLook = { body: "02", eyes: "01", outfit: "10_01", hair: "05_01", accessory: null, phones: "teal" };

/** FNV-1a, 32 bits (PixelPeople.swift `stableHash`): the same on every device. */
export function stableHash(s: string): number {
  let h = 2_166_136_261;
  for (const b of new TextEncoder().encode(s)) h = Math.imul(h ^ b, 16_777_619) >>> 0;
  return h;
}

/** PixelColor(css) for the "#rrggbb" forms avatars carry; anything else is black, as there. */
export function hexColour(css: string): [number, number, number] {
  const s = css.replace(/^[ \t]+|[ \t]+$/g, "");
  const hex = s.startsWith("#") ? s.slice(1) : s;
  const v = /^\+?[0-9a-fA-F]{1,8}$/.test(hex) ? parseInt(hex.replace("+", ""), 16) : 0;
  const n = v > 0xffffffff ? 0 : v;
  return [(n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const get = (a: AvatarKeys | null | undefined, k: string): string | undefined => (a && has(a, k) && typeof a[k] === "string" ? a[k] : undefined);

const ids = (xs: CataloguePart[]) => xs.map((x) => x.id);

/** The look with every part one this catalogue has: an unknown part becomes the nearest known one of its kind (the same style in another colour, else the first). */
export function known(cat: PeopleCatalogue, look: PersonLook): PersonLook {
  const pick = (id: string, all: string[]) => {
    if (all.includes(id)) return id;
    const style = id.slice(0, 2);
    return all.find((a) => a.startsWith(style)) ?? all[0] ?? id;
  };
  const l = { ...look };
  l.body = pick(l.body, ids(cat.parts.bodies)); l.eyes = pick(l.eyes, ids(cat.parts.eyes));
  l.outfit = pick(l.outfit, ids(cat.parts.outfits)); l.hair = pick(l.hair, ids(cat.parts.hair));
  if (l.accessory !== null && !ids(cat.parts.accessories).includes(l.accessory)) l.accessory = null;
  if (l.phones !== null && !has(cat.headphones, l.phones)) l.phones = "red";
  return l;
}

const distance = (a: readonly number[], b: readonly number[]) => {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
};

/** The part nearest a colour; a tie goes to the smaller id (PersonLook.derived `nearest`). */
function nearest(pool: CataloguePart[], to: readonly number[]): string | null {
  let best: CataloguePart | null = null, bd = 0;
  for (const p of pool) {
    const d = distance(hexColour(p.colour ?? "#808080"), to);
    if (best === null || d < bd || (d === bd && p.id < best.id)) { best = p; bd = d; }
  }
  return best?.id ?? null;
}

/**
 * A look worked out from what a student chose for the old Plumi, so a friend is the same person on every iPad
 * (PersonLook.derived): hair colour nearest the feather's, the outfit nearest the top's colour, headphones in the
 * colour nearest theirs, glasses if any; skin, eyes and the hairstyle from the id.
 */
export function derived(cat: PeopleCatalogue, seed: string, feather: string, top: string | null, headphones: string | null, glasses: boolean): PersonLook {
  const h = stableHash(seed);
  const bodies = ids(cat.parts.bodies), eyes = ids(cat.parts.eyes);
  const styles = [...new Set(cat.parts.hair.map((p) => p.id.slice(0, 2)))].sort();
  const body = bodies.length ? bodies[h % bodies.length] : "01";
  const eye = eyes.length ? eyes[Math.floor(h / 7) % eyes.length] : "01";
  const style = styles.length ? styles[Math.floor(h / 49) % styles.length] : "01";
  const hair = nearest(cat.parts.hair.filter((p) => p.id.startsWith(style)), hexColour(feather)) ?? cat.parts.hair[0]?.id ?? "01_01";
  const outfit = top !== null
    ? nearest(cat.parts.outfits, hexColour(top)) ?? "10_01"
    : cat.parts.outfits.length ? cat.parts.outfits[Math.floor(h / 1_421) % cat.parts.outfits.length].id : "10_01";
  let phones: string | null = null;
  if (headphones !== null) {
    const want = hexColour(headphones);
    let bestKey: string | null = null, bd = 0;
    for (const [key, cols] of Object.entries(cat.headphones)) {
      const d = distance(hexColour(cols[0] ?? "#000000"), want);
      if (bestKey === null || d < bd || (d === bd && key < bestKey)) { bestKey = key; bd = d; }
    }
    phones = bestKey;
  }
  const accessory = glasses ? cat.parts.accessories.find((p) => p.id.includes("glasses"))?.id ?? null : null;
  return { body, eyes: eye, outfit, hair, accessory, phones };
}

/** The old wardrobe's feathers, by the key friends were sent and by the raw value saves kept (LegacyWardrobe.featherColours). */
const FEATHERS: [string, string, string][] = [
  ["blue", "", "#6a9bd0"], ["pink", "-pink", "#e48f9f"], ["gold", "-gold", "#e3a53c"], ["lilac", "-lilac", "#9b84c9"],
  ["green", "-green", "#6fae6a"], ["mint", "-mint", "#6cc4a4"], ["sunset", "-sunset", "#f08a5d"], ["midnight", "-midnight", "#3a4677"],
  ["galaxy", "-galaxy", "#5b3f9e"], ["aurora", "-aurora", "#3fb8a2"], ["starlight", "-starlight", "#e9e4f4"],
];
const featherColour = new Map<string, string>(FEATHERS.flatMap(([name, raw, hex]) => [[name, hex], [raw, hex]] as [string, string][]));

/** A friend's Plumi before they dressed it, by their profile colour (LegacyWardrobe.friendDefault): feather, top colour, headphones. */
function friendDefault(colour: number): { feather: string; top: string; headphones: string | null } {
  const feathers = ["#e48f9f", "#e3a53c", "#9b84c9", "#6fae6a", "#6a9bd0"];
  const tops: [string, string | null][] = [["#c8925a", null], ["#e3b04b", null], ["#5a86bf", "#f2c96b"], ["#e8dfcc", null]];
  const f = feathers[((colour % 5) + 5) % 5], t = tops[((colour % 4) + 4) % 4];
  return { feather: f, top: t[0], headphones: t[1] };
}

/** A friend on an app not yet updated: the person nearest the Plumi they dressed, the rest from their id (RoomAvatar.legacyLook). */
export function legacyLook(cat: PeopleCatalogue, avatar: AvatarKeys | null | undefined, colour: number, id: string): PersonLook {
  const base = friendDefault(Number.isFinite(colour) ? Math.trunc(colour) : 0);
  let feather = base.feather, top: string | null = base.top, headphones = base.headphones, glasses = false;
  if (avatar) {
    const f = get(avatar, "feather");
    if (f !== undefined && featherColour.has(f)) feather = featherColour.get(f)!;
    const t = get(avatar, "top");
    if (t !== undefined) top = t === "none" ? null : (top ?? base.top);
    const c = get(avatar, "colour");
    if (c !== undefined && c.startsWith("#") && top !== null) top = c;
    const hat = get(avatar, "hat");
    if (hat !== undefined) {
      const hc = get(avatar, "hat_colour");
      headphones = hat.startsWith("headphones") ? (hc !== undefined && hc.startsWith("#") ? hc : "#e0605a") : null;
    }
    const g = get(avatar, "glasses");
    if (g !== undefined) glasses = g !== "none";
  }
  return derived(cat, id, feather, top, headphones, glasses);
}

/**
 * The person a student is, from what their app sent (either kind) and their id (RoomAvatar.person). An avatar with
 * no person keys, or none at all, is the person worked out from the old keys and the id.
 */
export function personOf(cat: PeopleCatalogue, avatar: AvatarKeys | null | undefined, colour: number, id: string): PersonLook {
  const legacy = legacyLook(cat, avatar, colour, id);
  // THE SPECIES CHECK comes before `known` (the iPad's nearest-part mapping): "fox" is not a skin to be mapped to the first one.
  const species = speciesOf(get(avatar, "body"));
  if (!avatar || (get(avatar, "outfit") === undefined && get(avatar, "hair") === undefined)) return species ? { ...legacy, species } : legacy;
  const look = { ...legacy };
  const v = (k: string) => get(avatar, k);
  if (v("body") !== undefined && species === null) look.body = v("body")!;
  if (v("eyes") !== undefined) look.eyes = v("eyes")!;
  if (v("outfit") !== undefined) look.outfit = v("outfit")!;
  if (v("hair") !== undefined) look.hair = v("hair")!;
  if (v("acc") !== undefined) look.accessory = v("acc") === "none" ? null : v("acc")!;
  if (v("phones") !== undefined) look.phones = v("phones") === "none" ? null : v("phones")!;
  const person = known(cat, look);
  return species ? { ...person, species } : person;
}

/** A key for caching a drawn row: the same look is the same row. An animal is its own row whatever person is behind it. */
export const lookKey = (l: PersonLook) => (l.species ? `~${l.species}` : [l.body, l.eyes, l.outfit, l.hair, l.accessory ?? "-", l.phones ?? "-"].join("|"));
