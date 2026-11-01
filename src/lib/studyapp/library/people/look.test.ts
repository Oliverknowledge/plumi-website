/**
 * npm run library:test
 *
 * The iPad's rules for who a student is drawn as (RoomAvatar.person, PeopleArt.known, PersonLook.derived), ported:
 * the hash, the nearest part, the legacy keys, and hostile input.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { STARTER, SPECIES, derived, hexColour, known, legacyLook, lookKey, personOf, speciesOf, stableHash, type PeopleCatalogue } from "./look";

const cat = JSON.parse(readFileSync(new URL("../../../../../public/library/people-layers.json", import.meta.url), "utf8")) as PeopleCatalogue;
const has = (look: ReturnType<typeof personOf>) => {
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
  assert.ok(ids(cat.parts.bodies).includes(look.body), "body " + look.body);
  assert.ok(ids(cat.parts.eyes).includes(look.eyes), "eyes " + look.eyes);
  assert.ok(ids(cat.parts.outfits).includes(look.outfit), "outfit " + look.outfit);
  assert.ok(ids(cat.parts.hair).includes(look.hair), "hair " + look.hair);
  assert.ok(look.accessory === null || ids(cat.parts.accessories).includes(look.accessory));
  assert.ok(look.phones === null || Object.keys(cat.headphones).includes(look.phones));
};

describe("the hash (PixelPeople.swift stableHash)", () => {
  it("is FNV-1a, 32 bits: the app's own test vector", () => {
    assert.equal(stableHash("a"), 0xe40c292c);
    assert.equal(stableHash(""), 2_166_136_261);
    assert.equal(stableHash("é"), stableHash("é"));
  });
});

describe("colours", () => {
  it("reads #rrggbb as PixelColor does, and anything unreadable as black", () => {
    assert.deepEqual(hexColour("#6a9bd0"), [0x6a, 0x9b, 0xd0]);
    assert.deepEqual(hexColour(" 6a9bd0 "), [0x6a, 0x9b, 0xd0]);
    assert.deepEqual(hexColour("#zzzzzz"), [0, 0, 0]);
    assert.deepEqual(hexColour("#123456789abc"), [0, 0, 0]);
    assert.deepEqual(hexColour(""), [0, 0, 0]);
  });
});

describe("known: a part this catalogue lacks becomes the nearest it has", () => {
  it("keeps what exists", () => assert.deepEqual(known(cat, STARTER), STARTER));
  it("takes the same style in another colour, else the first", () => {
    const l = known(cat, { ...STARTER, hair: "05_99", outfit: "99_01", body: "42", eyes: "x" });
    assert.ok(l.hair.startsWith("05_"));
    assert.equal(l.outfit, cat.parts.outfits[0].id);
    assert.equal(l.body, cat.parts.bodies[0].id);
    assert.equal(l.eyes, cat.parts.eyes[0].id);
  });
  it("drops an accessory it does not know and reds an unknown headphone colour", () => {
    const l = known(cat, { ...STARTER, accessory: "99_hat", phones: "neon" });
    assert.equal(l.accessory, null);
    assert.equal(l.phones, "red");
  });
  it("does not trust prototype keys as headphone colours", () => assert.equal(known(cat, { ...STARTER, phones: "constructor" }).phones, "red"));
});

describe("personOf (RoomAvatar.person)", () => {
  it("draws the person an avatar names", () => {
    const p = personOf(cat, { body: "04", eyes: "03", outfit: "12_03", hair: "09_04", acc: "none", phones: "lilac", pro: "1" }, 3, "u1");
    assert.deepEqual(p, { body: "04", eyes: "03", outfit: "12_03", hair: "09_04", accessory: null, phones: "lilac" });
  });
  it("reads acc and phones 'none' as nothing, and glasses as the accessory", () => {
    const p = personOf(cat, { body: "01", eyes: "01", outfit: "12_03", hair: "09_04", acc: "15_glasses_01", phones: "none" }, 0, "u1");
    assert.equal(p.accessory, "15_glasses_01");
    assert.equal(p.phones, null);
  });
  it("is the same person for the same id every time, whatever the avatar lacks", () => {
    const a = personOf(cat, null, 2, "5f0e3b5c-1111-4222-8333-944455556666");
    assert.deepEqual(a, personOf(cat, {}, 2, "5f0e3b5c-1111-4222-8333-944455556666"));
    assert.deepEqual(a, personOf(cat, { pro: "1" }, 2, "5f0e3b5c-1111-4222-8333-944455556666"));
    has(a);
  });
  it("is a different person for a different id, over a crowd", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(lookKey(personOf(cat, null, i % 16, `student-${i}`)));
    assert.ok(seen.size > 100, `only ${seen.size} different people in 200`);
  });
  it("an old avatar (no person keys) becomes the person nearest the Plumi they dressed", () => {
    const blue = legacyLook(cat, { feather: "blue", top: "hoodie", colour: "#7cc6c2", hat: "headphones", hat_colour: "#e0605a", glasses: "round" }, 0, "u9");
    assert.equal(blue.phones, "red");
    assert.equal(blue.accessory, "15_glasses_01");
    const bare = legacyLook(cat, { feather: "pink", top: "hoodie", hat: "none", glasses: "none" }, 0, "u9");
    assert.equal(bare.phones, null);
    assert.equal(bare.accessory, null);
    assert.equal(bare.body, blue.body, "skin and eyes come from the id alone");
    assert.equal(bare.eyes, blue.eyes);
    assert.notEqual(bare.hair, blue.hair, "the hair's colour follows the feather");
    assert.equal(bare.hair.slice(0, 2), blue.hair.slice(0, 2), "the hairstyle comes from the id");
  });
  it("derived: headphones in the colour nearest, outfit nearest the top", () => {
    const d = derived(cat, "x", "#6a9bd0", "#805e8e", "#aa96d2", false);
    assert.equal(d.phones, "lilac");
    assert.equal(d.outfit, "01_01", "the outfit whose colour is exactly that");
    assert.equal(derived(cat, "x", "#6a9bd0", null, null, false).phones, null);
  });
  it("never throws and always yields parts that exist, for hostile avatars", () => {
    const hostile: Record<string, string>[] = [
      { outfit: "", hair: "", body: "../../etc", eyes: "\u0000", acc: "<script>", phones: "__proto__" },
      { __proto__: "x", constructor: "y", outfit: "99_99", hair: "99_99" } as unknown as Record<string, string>,
      { feather: "constructor", top: "none", colour: "javascript:alert(1)", hat: "headphones", hat_colour: "red", glasses: "round" },
      { outfit: "7".repeat(100_000), hair: "x".repeat(100_000) },
    ];
    for (const av of hostile) for (const colour of [0, -1, 15, 99, Number.NaN]) has(personOf(cat, av, colour, "id"));
  });
});

describe("an animal (body: \"fox\")", () => {
  const person = { body: "03", eyes: "02", outfit: "12_03", hair: "29_04", acc: "none", phones: "red" };
  it("names the species only for a species id, never for a skin or an invented value", () => {
    assert.deepEqual(SPECIES, ["fox"]);
    assert.equal(speciesOf("fox"), "fox");
    for (const v of ["03", "01", "", "Fox", "wolf", undefined, null]) assert.equal(speciesOf(v as string), null, String(v));
  });
  it("is the fox for you and everyone, with or without the person keys, and the person behind it is the nearest one", () => {
    const a = personOf(cat, { ...person, body: "fox" }, 3, "u1");
    assert.equal(a.species, "fox");
    has(a);                                                       // a fox still carries a person every iPad could draw
    assert.deepEqual({ ...a, species: undefined }, { ...personOf(cat, { ...person, body: "03" }, 3, "u1"), body: a.body, species: undefined } as never, "the person keys are read as they were");
    const bare = personOf(cat, { body: "fox" }, 3, "u1");
    assert.equal(bare.species, "fox");
    has(bare);
    assert.deepEqual({ ...bare, species: undefined }, { ...legacyLook(cat, { body: "fox" }, 3, "u1"), species: undefined } as never, "no person keys: the person the id makes");
  });
  it("is checked before the iPad's nearest-part mapping: an unknown body that is not an animal is mapped as before", () => {
    const wolf = personOf(cat, { ...person, body: "wolf" }, 3, "u1");
    assert.equal(wolf.species, undefined);
    assert.equal(wolf.body, known(cat, { ...STARTER, body: "wolf" }).body);
    has(wolf);
    assert.equal(personOf(cat, { ...person, body: "05" }, 3, "u1").species, undefined);
    assert.equal("species" in personOf(cat, person, 3, "u1"), false, "a person has no species key at all");
  });
  it("is its own row whatever person is behind it, and a person's key is unchanged", () => {
    const a = personOf(cat, { ...person, body: "fox" }, 3, "u1"), b = personOf(cat, { body: "fox", hair: "01_01", outfit: "02_01" }, 1, "u2");
    assert.equal(lookKey(a), lookKey(b));
    assert.notEqual(lookKey(a), lookKey(personOf(cat, person, 3, "u1")));
    assert.equal(lookKey(STARTER), [STARTER.body, STARTER.eyes, STARTER.outfit, STARTER.hair, "-", STARTER.phones].join("|"));
  });
  it("survives `known` (the species is not a part to be mapped)", () => {
    assert.equal(known(cat, { ...STARTER, species: "fox" }).species, "fox");
  });
});
