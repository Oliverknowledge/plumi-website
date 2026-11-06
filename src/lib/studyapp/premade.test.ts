import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addPremade, editCard, EMPTY } from "./model";
import { boardFor, deckTitle, entriesOf, isPremadeKey, MS_BOARDS, msKey, orderSpecs, premadeKey, toAdd, TASTER_MIN } from "./premade";
import type { PremadeSubject } from "./premadeBuild";
import biology from "../../content/premadeDecks/biology.json";
import msBio from "../../content/premadeDecks/markscheme-aqa-7402.json";
import msGcse from "../../content/premadeDecks/markscheme-aqa-8463.json";

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
    assert.equal(d.decks[0].title, `Key wording \u00B7 ${aqa.mods[0].t}`);
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

describe("mark scheme decks in the catalogue", () => {
  const ms = msBio as unknown as PremadeSubject;
  const spec = ms.specs[0];
  it("are titled and keyed apart from the key wording decks", () => {
    const e = entriesOf(ms, spec);
    assert.equal(e[0].key, msKey("AQA-7402", spec.mods[0].c));
    assert.ok(e[0].key.startsWith("pm:ms:") && isPremadeKey(e[0].key));
    assert.equal(e[0].title, `Mark scheme \u00B7 ${spec.mods[0].t}`);
    assert.equal(deckTitle("kw", "Cells"), "Key wording \u00B7 Cells");
    assert.ok(e.every((x) => x.title.length <= 64), "fits a catalogue deck name");
    assert.equal(e.filter((x) => x.free).length, 1, "one taster a board, as for key wording");
  });
  it("adds with the board's wording intact and is never added twice", () => {
    const e = entriesOf(ms, spec)[0];
    let d = addPremade(EMPTY, toAdd(ms, e), T);
    assert.equal(d.cards.length, e.count);
    assert.equal(d.cards[0].front, ms.cards[e.mod.k[0]][1]);
    assert.equal(d.cards[0].back, ms.cards[e.mod.k[0]][2]);
    d = addPremade(d, toAdd(ms, e), T + 1);
    assert.equal(d.decks.length, 1);
  });
  it("keeps the few cards that run past 400 and 800 characters whole, and whole when edited", () => {
    const all = [...(msBio as unknown as PremadeSubject).cards, ...(msGcse as unknown as PremadeSubject).cards];
    const longest = all.reduce((a, c) => (c[2].length > a[2].length ? c : a));
    assert.ok(longest[2].length <= 1200);
    const ocr = ms.specs[0];
    const entry = entriesOf(ms, ocr).find((x) => x.mod.k.some((i) => ms.cards[i][2].length > 400))!;
    const d = addPremade(EMPTY, toAdd(ms, entry), T);
    const c = d.cards.find((x) => x.back.length > 400)!;
    const edited = editCard(d, c.id, c.front, c.back + " x");
    assert.equal(edited.cards.find((x) => x.id === c.id)!.back, c.back + " x", "edit does not cut a long board answer");
  });
  it("opens a GCSE student on the mark scheme boards only, and lists every board with cards", () => {
    assert.equal(boardFor("biology", ["aqa-gcse-biology"], [], "ms"), "AQA-8461");
    assert.equal(boardFor("biology", ["aqa-gcse-biology"], [], "kw"), null, "no key wording below A-level");
    assert.equal(boardFor("physics", ["edexcel-a-level-physics"], [], "ms"), "EDEXCEL-9PH0");
    assert.equal(boardFor("chemistry", ["ocr-a-level-chemistry-b"], [], "ms"), null, "no mark scheme cards for OCR B");
    assert.deepEqual(MS_BOARDS.physics.map((b) => b.id), ["AQA-7408", "OCR-H556", "EDEXCEL-9PH0", "AQA-8463"]);
  });
});
