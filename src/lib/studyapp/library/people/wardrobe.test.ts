/**
 * npm run library:test
 *
 * The web wardrobe: only the iPad's free starter set is offered (and the list is held to the Swift source when the
 * app repo is beside this one), a save keeps every key it did not mean to change, and a part dressed on the iPad
 * outside the set stays on until another is chosen in its slot.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { STARTER, personOf, type PeopleCatalogue, type PersonLook } from "./look";
import {
  AVATAR_KEYS, CHARACTERS, FREE_ITEMS, SLOTS, STARTER_LOOK, asCharacter, characterOf, currentOutsideFree, isWorn, itemsIn, mergeAvatar, randomLook, validAvatarValue, variants, withVariant, worn, type Item,
} from "./wardrobe";

const cat = JSON.parse(readFileSync(new URL("../../../../../public/library/people-layers.json", import.meta.url), "utf8")) as PeopleCatalogue;
const SWIFT = new URL("../../../../../../plumi/Sources/PlumiKit/Features/StudyRoom/RoomStore.swift", import.meta.url);

/** Reads WardrobeItem.all out of the Swift source: the items with price 0 and no unlock. */
function swiftFree(src: string): Item[] {
  const start = src.indexOf("public static let all: [WardrobeItem]");
  const end = src.indexOf("}()", start);
  const body = src.slice(start, end);
  const out: Item[] = [];
  const skins = /let skins = \[([^\]]+)\]/.exec(body)![1].match(/"([^"]+)"/g)!.map((s) => s.slice(1, -1));
  skins.forEach((t, i) => out.push({ slot: "skin", value: String(i + 1).padStart(2, "0"), title: t }));
  assert.match(body, /for i in 1\.\.\.7 \{ items\.append\(make\(\.eyes, String\(format: "%02d", i\), "Eyes \\\(i\)"\)\) \}/);
  for (let i = 1; i <= 7; i++) out.push({ slot: "eyes", value: String(i).padStart(2, "0"), title: `Eyes ${i}` });
  for (const [name, slot] of [["hair", "hair"], ["outfits", "outfit"]] as const) {
    const block = new RegExp(`let ${name}: \\[\\(String, String, Rarity, Int, Unlock\\?\\)\\] = \\[([\\s\\S]*?)\\n        \\]`).exec(body)![1];
    for (const m of block.matchAll(/\("(\d\d)", "([^"]+)", \.(\w+), (\d+), (nil|\.\w+\(\d+\))\)/g)) {
      if (Number(m[4]) === 0 && m[5] === "nil") out.push({ slot, value: m[1], title: m[2] });
    }
  }
  for (const m of body.matchAll(/items\.append\(make\(\.(glasses|phones), "([^"]+)", "([^"]+)"(?:, \.(\w+), (\d+))?\)\)/g)) {
    if (m[5] === undefined || Number(m[5]) === 0) out.push({ slot: m[1] as Item["slot"], value: m[2], title: m[3] });
  }
  return out;
}

describe("the free set", () => {
  it("is the iPad's starter items, with its titles, exactly", { skip: !existsSync(SWIFT) && "the app repo is not beside this one" }, () => {
    const swift = swiftFree(readFileSync(SWIFT, "utf8"));
    assert.ok(swift.length > 20, "the Swift source was read");
    const key = (i: Item) => `${i.slot}:${i.value}:${i.title}`;
    assert.deepEqual([...FREE_ITEMS].map(key).sort(), swift.map(key).sort());
  });

  it("is what the iPad says it is: 7 skins, 7 eyes, 6 hairstyles, 5 outfits, no glasses, no headphones, teal, red", () => {
    assert.deepEqual(["skin", "eyes", "hair", "outfit", "glasses", "phones"].map((s) => itemsIn(s as Item["slot"]).length), [7, 7, 6, 5, 1, 3]);
    assert.deepEqual(itemsIn("hair").map((i) => i.value), ["01", "03", "04", "05", "06", "12"]);
    assert.deepEqual(itemsIn("outfit").map((i) => i.value), ["01", "02", "04", "10", "12"]);
    assert.equal(FREE_ITEMS.some((i) => i.value === "15_glasses_01"), false, "glasses cost ink on the iPad");
    assert.equal(FREE_ITEMS.some((i) => ["lilac", "cream", "black"].includes(i.value)), false);
  });

  it("names only parts that exist in the art, each hairstyle and outfit in at least one colour", () => {
    const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
    for (const i of FREE_ITEMS) {
      switch (i.slot) {
        case "skin": assert.ok(ids(cat.parts.bodies).includes(i.value), i.value); break;
        case "eyes": assert.ok(ids(cat.parts.eyes).includes(i.value), i.value); break;
        case "hair": assert.ok(ids(cat.parts.hair).some((h) => h.startsWith(i.value + "_")), i.value); break;
        case "outfit": assert.ok(ids(cat.parts.outfits).some((h) => h.startsWith(i.value + "_")), i.value); break;
        case "phones": assert.ok(i.value === "none" || Object.keys(cat.headphones).includes(i.value), i.value); break;
        case "glasses": assert.equal(i.value, "none");
      }
    }
    assert.ok(ids(cat.parts.accessories).includes("15_glasses_01"));
    assert.equal(SLOTS.length, 6);
  });

  it("every value it can ever send is one the server accepts", () => {
    for (const i of FREE_ITEMS) assert.ok(validAvatarValue(i.value), i.value);
    for (const p of [...cat.parts.hair, ...cat.parts.outfits, ...cat.parts.bodies, ...cat.parts.eyes]) assert.ok(validAvatarValue(p.id), p.id);
    assert.ok(validAvatarValue("15_glasses_01"));
  });
});

describe("putting things on (WardrobeItem.worn)", () => {
  const start: PersonLook = { body: "03", eyes: "02", outfit: "12_03", hair: "09_04", accessory: null, phones: "teal" };
  it("keeps the colour worn where the new style comes in it, else its first", () => {
    const hair = worn(cat, start, itemsIn("hair").find((i) => i.value === "05")!);
    assert.ok(hair.hair.startsWith("05_"));
    const same = "05_" + start.hair.slice(3);
    assert.equal(hair.hair, cat.parts.hair.some((h) => h.id === same) ? same : "05_01");
    assert.equal(hair.body, "03", "nothing else changes");
  });
  it("sets skin, eyes, glasses and headphones", () => {
    let l = worn(cat, start, itemsIn("skin")[6]);
    assert.equal(l.body, "07");
    l = worn(cat, l, itemsIn("eyes")[4]); assert.equal(l.eyes, "05");
    l = worn(cat, l, itemsIn("phones").find((i) => i.value === "none")!); assert.equal(l.phones, null);
    l = worn(cat, l, itemsIn("phones").find((i) => i.value === "red")!); assert.equal(l.phones, "red");
  });
  it("knows what is worn", () => {
    assert.ok(isWorn(itemsIn("outfit").find((i) => i.value === "12")!, start));
    assert.ok(!isWorn(itemsIn("outfit").find((i) => i.value === "10")!, start));
    assert.ok(isWorn(itemsIn("glasses")[0], start), "no glasses is worn by someone with none");
  });
  it("changes colours freely, within the style worn only", () => {
    const vs = variants(cat, start, "hair");
    assert.ok(vs.length > 1 && vs.every((v) => v.id.startsWith("09_")));
    assert.equal(withVariant(cat, start, "hair", vs[0].id).hair, vs[0].id);
    assert.equal(withVariant(cat, start, "hair", "05_01").hair, start.hair, "another style is not a colour");
  });
  it("a random look is always from the free set", () => {
    let n = 0;
    const rnd = () => { n = (n * 1103515245 + 12345) % 2147483648; return n / 2147483648; };
    for (let i = 0; i < 200; i++) {
      const l = randomLook(cat, rnd);
      for (const slot of ["skin", "eyes", "hair", "outfit", "glasses", "phones"] as const) assert.ok(itemsIn(slot).some((it) => isWorn(it, l)), `${slot} of ${JSON.stringify(l)}`);
    }
  });
});

describe("what is dressed on the iPad stays on", () => {
  const iPad: PersonLook = { body: "04", eyes: "03", outfit: "24_02", hair: "17_05", accessory: "15_glasses_01", phones: "lilac" };
  it("shows a part outside the free set as Current, and nothing for a part inside it", () => {
    assert.equal(currentOutsideFree(iPad, "hair")?.title, "Current");
    assert.equal(currentOutsideFree(iPad, "outfit")?.title, "Current");
    assert.equal(currentOutsideFree(iPad, "glasses")?.value, "15_glasses_01");
    assert.equal(currentOutsideFree(iPad, "phones")?.value, "lilac");
    assert.equal(currentOutsideFree(iPad, "skin"), null);
    assert.equal(currentOutsideFree(STARTER_LOOK, "hair"), null);
    assert.equal(currentOutsideFree(STARTER_LOOK, "phones"), null);
  });
  it("is replaced only in the slot another is chosen in", () => {
    const l = worn(cat, iPad, itemsIn("hair")[0]);
    assert.ok(l.hair.startsWith("01_"));
    assert.equal(l.outfit, "24_02");
    assert.equal(l.accessory, "15_glasses_01");
    assert.equal(l.phones, "lilac");
  });
});

describe("the avatar that is saved (set_avatar replaces it whole)", () => {
  const current: Record<string, string> = { body: "01", eyes: "01", outfit: "10_01", hair: "05_01", acc: "none", phones: "teal", pro: "1", feather: "blue", top: "hoodie", colour: "#7cc6c2", hat: "headphones", hat_colour: "#5aa6a4", glasses: "none" };
  const look = personOf(cat, current, 0, "u1");
  it("changes only the person's keys and keeps pro and every older key", () => {
    const next = mergeAvatar(current, { ...look, hair: "03_02", accessory: null, phones: null });
    const want: Record<string, string> = { ...current, hair: "03_02", phones: "none", acc: "none" };
    assert.deepEqual(next, want);
    assert.equal(next.pro, "1");
    for (const k of ["feather", "top", "colour", "hat", "hat_colour", "glasses"]) assert.equal(next[k], current[k], k);
  });
  it("writes acc and phones as 'none' when empty, and the ids when not", () => {
    const next = mergeAvatar(current, { ...look, accessory: "15_glasses_01", phones: "red" });
    assert.equal(next.acc, "15_glasses_01");
    assert.equal(next.phones, "red");
    const bare = mergeAvatar(current, { ...look, accessory: null, phones: null });
    assert.deepEqual([bare.acc, bare.phones], ["none", "none"]);
  });
  it("starts from nothing for a student who has never saved: the six person keys and no others", () => {
    assert.deepEqual(Object.keys(mergeAvatar(null, STARTER)).sort(), ["acc", "body", "eyes", "hair", "outfit", "phones"]);
    assert.deepEqual(Object.keys(mergeAvatar({}, STARTER)).sort(), ["acc", "body", "eyes", "hair", "outfit", "phones"]);
  });
  it("never sends a key or a value the server would refuse, so one odd old key cannot fail the save", () => {
    const next = mergeAvatar({ pro: "1", sneaky: "x", feather: "Blue!", top: "hoodie", scarf: "#e0605a", shade: "A".repeat(30) } as Record<string, string>, STARTER);
    assert.deepEqual(Object.keys(next).sort(), ["acc", "body", "eyes", "hair", "outfit", "phones", "pro", "scarf", "top"]);
    for (const [k, v] of Object.entries(next)) { assert.ok(AVATAR_KEYS.has(k), k); assert.ok(validAvatarValue(v), `${k}=${v}`); }
  });
  it("is small enough (the server refuses over 1024 bytes)", () => {
    assert.ok(JSON.stringify(mergeAvatar(current, look)).length < 400);
  });
  it("a save then a read gives the same person back", () => {
    const l: PersonLook = { body: "05", eyes: "04", outfit: "04_02", hair: "12_03", accessory: null, phones: "red" };
    assert.deepEqual(personOf(cat, mergeAvatar(current, l), 0, "u1"), l);
  });
});

describe("the character: person or fox", () => {
  const current: Record<string, string> = { body: "01", eyes: "01", outfit: "10_01", hair: "05_01", acc: "none", phones: "teal", pro: "1", feather: "blue", top: "hoodie", colour: "#7cc6c2", hat: "headphones", hat_colour: "#5aa6a4", glasses: "none" };
  const look = personOf(cat, current, 0, "u1");
  it("offers two characters, both free", () => {
    assert.deepEqual(CHARACTERS.map((c) => c.id), ["person", "fox"]);
    assert.deepEqual(CHARACTERS.map((c) => c.title), ["Person", "Fox"]);
    assert.ok(CHARACTERS.every((c) => !/\u2014/.test(c.title)));
  });
  it("a fox changes body and nothing else: pro, the older keys and the person keys stay", () => {
    const next = mergeAvatar(current, asCharacter(look, "fox"));
    assert.deepEqual(next, { ...current, body: "fox" });
    assert.equal(validAvatarValue(next.body), true, "the server accepts it (^[a-z0-9_-]{1,24}$)");
    for (const [k, v] of Object.entries(next)) { assert.ok(AVATAR_KEYS.has(k), k); assert.ok(validAvatarValue(v), `${k}=${v}`); }
  });
  it("a fox for a student who never dressed adds only body: no key is invented", () => {
    assert.deepEqual(mergeAvatar(null, asCharacter(STARTER_LOOK, "fox")), { body: "fox" });
    assert.deepEqual(mergeAvatar({ pro: "1" }, asCharacter(STARTER_LOOK, "fox")), { pro: "1", body: "fox" });
  });
  it("is read back as the fox, and a refused value around it does not stop the save", () => {
    const saved = mergeAvatar({ ...current, sneaky: "x" } as Record<string, string>, asCharacter(look, "fox"));
    assert.equal("sneaky" in saved, false);
    assert.equal(personOf(cat, saved, 0, "u1").species, "fox");
    assert.equal(characterOf(personOf(cat, saved, 0, "u1")), "fox");
  });
  it("choosing Person again puts back the person that was being dressed (the look keeps it behind the fox)", () => {
    const dressed: PersonLook = { ...look, hair: "03_02", outfit: "02_01" };
    const fox = asCharacter(dressed, "fox");
    assert.equal(characterOf(fox), "fox");
    assert.deepEqual(asCharacter(fox, "person"), dressed);
    assert.equal(mergeAvatar(current, asCharacter(fox, "person")).hair, "03_02");
    assert.equal(mergeAvatar(current, asCharacter(fox, "person")).body, dressed.body, "the skin comes back");
  });
  it("from a saved fox, Person writes the whole person over body: fox", () => {
    const saved = mergeAvatar(current, asCharacter(look, "fox"));
    const back = mergeAvatar(saved, asCharacter(personOf(cat, saved, 0, "u1"), "person"));
    assert.notEqual(back.body, "fox");
    assert.equal(characterOf(personOf(cat, back, 0, "u1")), "person");
    assert.equal(back.pro, "1");
  });
  it("reset and random are people, and they replace a saved fox", () => {
    assert.equal(characterOf(STARTER_LOOK), "person");
    assert.equal(characterOf(randomLook(cat)), "person");
    const saved = mergeAvatar(current, asCharacter(look, "fox"));
    assert.equal(mergeAvatar(saved, STARTER_LOOK).body, STARTER_LOOK.body);
    assert.notEqual(mergeAvatar(saved, randomLook(cat)).body, "fox");
  });
});
