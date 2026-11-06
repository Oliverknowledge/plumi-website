import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addPremade, EMPTY } from "./model";
import { boardFor, entriesOf, isPremadeKey, orderSpecs, premadeKey, toAdd, TASTER_MIN } from "./premade";
import type { PremadeSubject } from "./premadeBuild";
import biology from "../../content/premadeDecks/biology.json";

const T = 1_700_000_000_000;
const data = biology as unknown as PremadeSubject;
const aqa = data.specs.find((s) => s.id === "AQA-7402")!;

describe("the catalogue", () => {
  it("lists a board's decks with stable ids and counts", () => {
    const e = entriesOf(data, aqa);
    assert.equal(e.length, aqa.mods.length);
    assert.equal(e[0].key, premadeKey("biology", "AQA-7402", aqa.mods[0].c));
    assert.ok(e.every((x) => isPremadeKey(x.key) && x.count === x.mod.k.length));
    assert.equal(new Set(e.map((x) => x.key)).size, e.length);
    assert.equal(isPremadeKey("chem-carbonyls"), false);
    assert.equal(isPremadeKey(null), false);
  });
  it("keeps exactly one taster per board: the first deck with enough cards", () => {
    for (const spec of data.specs) {
      const e = entriesOf(data, spec);
      assert.equal(e.filter((x) => x.free).length, 1);
      const free = e.find((x) => x.free)!;
      assert.ok(free.count >= TASTER_MIN);
      assert.ok(e.slice(0, e.indexOf(free)).every((x) => x.count < TASTER_MIN));
    }
    const ocr = entriesOf(data, data.specs.find((s) => s.id === "OCR-H420")!);
    assert.equal(ocr[0].free, false, "OCR's first module is six practical cards: not a taste");
    assert.equal(ocr[1].free, true);
  });
  it("opens on the student's own board, from their subjects, and never guesses one", () => {
    assert.equal(boardFor("biology", ["aqa-a-level-chemistry", "ocr-a-level-biology-a"]), "OCR-H420");
    assert.equal(boardFor("chemistry", ["aqa-a-level-chemistry", "ocr-a-level-biology-a"]), "AQA-7405");
    assert.equal(boardFor("chemistry", ["ocr-a-level-chemistry-b"]), "OCR-H433");
    assert.equal(boardFor("physics", ["aqa-gcse-physics", "ocr-a-level-biology-b"]), null, "a level or variant with no definitions is not a board here");
    assert.equal(boardFor("biology", undefined, ["edexcel-a-level-biology-a"]), "EDEXCEL-9BN0", "else the board of a set they worked on");
    assert.equal(boardFor("biology", undefined), null);
    assert.deepEqual(orderSpecs(data.specs, "EDEXCEL-9BN0").map((s) => s.id)[0], "EDEXCEL-9BN0");
  });
});

describe("adding a catalogue deck", () => {
  const entry = entriesOf(data, aqa)[0];
  it("makes the deck with every card, its key on it and its subject set", () => {
    const d = addPremade(EMPTY, toAdd(data, entry), T);
    assert.equal(d.decks.length, 1);
    assert.equal(d.decks[0].starter, entry.key);
    assert.equal(d.decks[0].subject, "Biology");
    assert.equal(d.decks[0].title, aqa.mods[0].t);
    assert.equal(d.cards.length, entry.count);
    const first = data.cards[entry.mod.k[0]];
    assert.equal(d.cards[0].front, first[1]);
    assert.equal(d.cards[0].back, first[2]);
    assert.ok(d.cards.every((c) => c.deckId === d.decks[0].id && c.sch));
  });
  it("never adds the same deck twice, but adds the same module of another board", () => {
    let d = addPremade(EMPTY, toAdd(data, entry), T);
    d = addPremade(d, toAdd(data, entry), T + 5);
    assert.equal(d.decks.length, 1);
    assert.equal(d.cards.length, entry.count);
    const other = entriesOf(data, data.specs.find((s) => s.id === "OCR-H420")!)[1];
    d = addPremade(d, toAdd(data, other), T + 9);
    assert.equal(d.decks.length, 2);
  });
  it("lets the student edit and still not get it again", () => {
    let d = addPremade(EMPTY, toAdd(data, entry), T);
    d = { ...d, decks: d.decks.map((x) => ({ ...x, title: "My renamed deck" })) };
    assert.equal(addPremade(d, toAdd(data, entry), T + 1).decks.length, 1);
  });
});
