/**
 * npm run library:test
 *
 * `personOf` was made fast (memoised, palette read once, legacy look skipped when the avatar names every part). This
 * holds it to the old implementation, kept below verbatim as the oracle: the same person for thousands of random
 * avatars, hostile ones included, asked repeatedly so the memo is exercised too.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { hexColour, known, personOf, stableHash, type AvatarKeys, type CataloguePart, type PeopleCatalogue, type PersonLook } from "./look";

const cat = JSON.parse(readFileSync(new URL("../../../../../public/library/people-layers.json", import.meta.url), "utf8")) as PeopleCatalogue;

// ---- the oracle: the implementation before the change, unchanged apart from names ----
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const get = (a: AvatarKeys | null | undefined, k: string): string | undefined => (a && has(a, k) && typeof a[k] === "string" ? a[k] : undefined);
const ids = (xs: CataloguePart[]) => xs.map((x) => x.id);

const distance = (a: readonly number[], b: readonly number[]) => {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
};

/** The part nearest a colour; a tie goes to the smaller id (PersonLook.derived `nearest`). */
function nearestOld(pool: CataloguePart[], to: readonly number[]): string | null {
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
function derivedOld(cat: PeopleCatalogue, seed: string, feather: string, top: string | null, headphones: string | null, glasses: boolean): PersonLook {
  const h = stableHash(seed);
  const bodies = ids(cat.parts.bodies), eyes = ids(cat.parts.eyes);
  const styles = [...new Set(cat.parts.hair.map((p) => p.id.slice(0, 2)))].sort();
  const body = bodies.length ? bodies[h % bodies.length] : "01";
  const eye = eyes.length ? eyes[Math.floor(h / 7) % eyes.length] : "01";
  const style = styles.length ? styles[Math.floor(h / 49) % styles.length] : "01";
  const hair = nearestOld(cat.parts.hair.filter((p) => p.id.startsWith(style)), hexColour(feather)) ?? cat.parts.hair[0]?.id ?? "01_01";
  const outfit = top !== null
    ? nearestOld(cat.parts.outfits, hexColour(top)) ?? "10_01"
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
function legacyLookOld(cat: PeopleCatalogue, avatar: AvatarKeys | null | undefined, colour: number, id: string): PersonLook {
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
  return derivedOld(cat, id, feather, top, headphones, glasses);
}

/**
 * The person a student is, from what their app sent (either kind) and their id (RoomAvatar.person). An avatar with
 * no person keys, or none at all, is the person worked out from the old keys and the id.
 */
function personOfOld(cat: PeopleCatalogue, avatar: AvatarKeys | null | undefined, colour: number, id: string): PersonLook {
  const legacy = legacyLookOld(cat, avatar, colour, id);
  if (!avatar || (get(avatar, "outfit") === undefined && get(avatar, "hair") === undefined)) return legacy;
  const look = { ...legacy };
  const v = (k: string) => get(avatar, k);
  if (v("body") !== undefined) look.body = v("body")!;
  if (v("eyes") !== undefined) look.eyes = v("eyes")!;
  if (v("outfit") !== undefined) look.outfit = v("outfit")!;
  if (v("hair") !== undefined) look.hair = v("hair")!;
  if (v("acc") !== undefined) look.accessory = v("acc") === "none" ? null : v("acc")!;
  if (v("phones") !== undefined) look.phones = v("phones") === "none" ? null : v("phones")!;
  return known(cat, look);
}


// ---- the test ----
let seed = 0x5eed1234;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const hexes = () => "#" + Math.floor(rnd() * 0x1000000).toString(16).padStart(6, "0");

const all = {
  body: ids(cat.parts.bodies), eyes: ids(cat.parts.eyes), outfit: ids(cat.parts.outfits), hair: ids(cat.parts.hair),
  acc: ids(cat.parts.accessories), phones: Object.keys(cat.headphones),
};
const junk = ["", "none", "99", "99_99", "05_99", "x", "#12", "__proto__", "constructor", "\u00e9", "red", "cream", " "];
const value = (k: keyof typeof all): string => {
  const r = rnd();
  if (r < 0.55) return pick(all[k].length ? all[k] : junk);
  if (r < 0.7) return "none";
  if (r < 0.85) return pick(junk);
  // the same style in a colour the catalogue may not have
  const base = pick(all[k].length ? all[k] : ["01_01"]);
  return base.slice(0, 2) + "_" + String(Math.floor(rnd() * 30)).padStart(2, "0");
};
const feathers = ["blue", "pink", "gold", "lilac", "green", "mint", "sunset", "midnight", "galaxy", "aurora", "starlight", "-pink", "-gold", "-galaxy", "-lilac", "unknown"];

function randomAvatar(): AvatarKeys | null | undefined {
  const r = rnd();
  if (r < 0.04) return null;
  if (r < 0.07) return undefined;
  const a: Record<string, string> = {};
  const some = (p: number) => rnd() < p;
  if (some(0.5)) a.feather = pick(feathers);
  if (some(0.5)) a.top = some(0.2) ? "none" : pick(["shirt", "hoodie", "tee"]);
  if (some(0.5)) a.colour = some(0.8) ? hexes() : pick(["red", "#xyz", "#12345678901", "+ff00aa"]);
  if (some(0.4)) a.hat = pick(["headphones", "headphones_big", "cap", "none", "beanie"]);
  if (some(0.4)) a.hat_colour = some(0.8) ? hexes() : pick(["red", "none"]);
  if (some(0.3)) a.glasses = pick(["none", "round", "square"]);
  const person = rnd();
  const keys = ["body", "eyes", "outfit", "hair", "acc", "phones"] as const;
  if (person < 0.2) { /* old keys only */ }
  else if (person < 0.5) for (const k of keys) a[k] = value(k); // names every part: the legacy look is skipped
  else for (const k of keys) if (some(0.5)) a[k] = value(k);
  if (some(0.05)) a.extra = "whatever";
  return a;
}
const randomId = () => rnd() < 0.1 ? pick(["", "a", "\u00e9\u4e2d", "00000000-0000-0000-0000-000000000000"]) : Array.from({ length: 36 }, () => "0123456789abcdef-"[Math.floor(rnd() * 17)]).join("");
const randomColour = () => rnd() < 0.1 ? pick([NaN, Infinity, -Infinity, -3, 1.9, 7, 1e9]) : Math.floor(rnd() * 12) - 2;

describe("personOf, fast, against the implementation it replaced", () => {
  it("is the same person for 6000 random avatars, asked cold and then from the memo", () => {
    const cases = Array.from({ length: 6000 }, () => ({ a: randomAvatar(), c: randomColour(), id: randomId() }));
    for (const { a, c, id } of cases) {
      const want = personOfOld(cat, a, c, id);
      assert.deepEqual(personOf(cat, a, c, id), want, JSON.stringify({ a, c, id }));
    }
    // again, in a different order: most are now answered from the memo, or evicted and recomputed
    for (const { a, c, id } of [...cases].reverse()) assert.deepEqual(personOf(cat, a, c, id), personOfOld(cat, a, c, id));
    // and hammered: the 256 most recent stay hot
    for (let i = 0; i < 2000; i++) { const { a, c, id } = cases[5900 + (i % 100)]; assert.deepEqual(personOf(cat, a, c, id), personOfOld(cat, a, c, id)); }
  });

  it("derives the same person from the id alone for 4000 ids (the hash, nearest and the style pick)", () => {
    for (let i = 0; i < 4000; i++) { const id = randomId() + i; assert.deepEqual(personOf(cat, null, i % 9, id), personOfOld(cat, null, i % 9, id)); }
  });

  it("hands each caller its own copy, so editing one answer cannot change the next", () => {
    const a = { outfit: "10_01", hair: "05_01" };
    const first = personOf(cat, a, 0, "same");
    first.outfit = "tampered";
    assert.notEqual(personOf(cat, a, 0, "same").outfit, "tampered");
    assert.deepEqual(personOf(cat, a, 0, "same"), personOfOld(cat, a, 0, "same"));
  });

  it("keeps apart avatars that differ only in a key, a colour or an id", () => {
    const base = { outfit: "10_01", hair: "05_01", body: "02" };
    assert.notDeepEqual(personOf(cat, base, 0, "x"), personOf(cat, { ...base, hair: "01_01" }, 0, "x"));
    assert.deepEqual(personOf(cat, { feather: "pink" }, 1, "x"), personOfOld(cat, { feather: "pink" }, 1, "x"));
    assert.deepEqual(personOf(cat, { feather: "pink" }, 2, "x"), personOfOld(cat, { feather: "pink" }, 2, "x"));
    assert.deepEqual(personOf(cat, { feather: "pink" }, 2, "y"), personOfOld(cat, { feather: "pink" }, 2, "y"));
  });

  it("is quicker than the oracle on a crowd it has seen before", () => {
    const crowd = Array.from({ length: 50 }, (_, i) => ({ a: { feather: pick(feathers), colour: hexes(), hat: "headphones", hat_colour: hexes() }, c: i % 5, id: "p" + i }));
    for (const p of crowd) personOf(cat, p.a, p.c, p.id);
    const time = (f: () => void) => { const t = performance.now(); for (let n = 0; n < 400; n++) f(); return performance.now() - t; };
    const fast = time(() => { for (const p of crowd) personOf(cat, p.a, p.c, p.id); });
    const slow = time(() => { for (const p of crowd) personOfOld(cat, p.a, p.c, p.id); });
    console.log(`personOf x50 x400: ${fast.toFixed(1)} ms, old ${slow.toFixed(1)} ms`);
    assert.ok(fast < slow);
  });
});
