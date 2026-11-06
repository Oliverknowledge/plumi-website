import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildSubject, capitalise, render, verifyShape, type DefinitionsFile, type PremadeSubject, type SpecInput } from "./premadeBuild";

const tree = (rows: [string, string | null, string][]) => ({ topics: rows.map(([code, parent_code, title]) => ({ code, parent_code, title })) });
const A: SpecInput = { id: "AQA-1", label: "AQA", code: "1", tree: tree([["1", null, "Cells"], ["1.1", "1", "Membranes"], ["2", null, "Exchange"], ["2.1", "2", "Lungs"], ["3", null, "Empty module"]]) };
const O: SpecInput = { id: "OCR-1", label: "OCR", code: "1", tree: tree([["A", null, "Foundations"], ["A.1", "A", "Cells"]]) };
const file: DefinitionsFile = {
  sign_off: [{ id: "X.HELD" }],
  definitions: [
    { id: "X.ONE", prompt: "What is one?", answer: "the first number", topics: { "AQA-1": ["1.1"], "OCR-1": ["A.1"] } },
    { id: "X.TWO", prompt: "What is two?", answer: "pH is acidity", topics: { "AQA-1": ["2.1", "1.1"] } },
    { id: "X.HELD", prompt: "Held?", answer: "held back", topics: { "AQA-1": ["1.1"] } },
    { id: "X.LOST", prompt: "Nowhere?", answer: "on no board", topics: { "AQA-1": ["9.9"], "OCR-1": ["Z"] } },
    { id: "X.THREE", prompt: "What is three?", answer: "a third", topics: { "AQA-1": ["1"] } },
  ],
};
const build = (f = file) => buildSubject({ subject: "Biology", file: f, specs: [A, O], hashes: { "b.json": "h" } });

describe("premade deck builder", () => {
  it("groups cards into one deck per module of each board, in the tree's order, by the first topic code", () => {
    const { data } = build();
    const aqa = data.specs[0];
    assert.deepEqual(aqa.mods.map((m) => [m.c, m.t]), [["1", "Cells"], ["2", "Exchange"]], "empty modules are left out");
    assert.deepEqual(aqa.mods[0].k.map((i) => data.cards[i][0]), ["X.ONE", "X.THREE"], "source order inside a module");
    assert.deepEqual(aqa.mods[1].k.map((i) => data.cards[i][0]), ["X.TWO"], "filed under the first code (2.1), not the second");
  });
  it("gives a board only the cards that board lists", () => {
    const { data, report } = build();
    const ocr = data.specs[1];
    assert.deepEqual(ocr.mods.map((m) => m.t), ["Foundations"]);
    assert.deepEqual(ocr.mods[0].k.map((i) => data.cards[i][0]), ["X.ONE"], "X.TWO and X.THREE are not on OCR");
    assert.equal(report.notTaught["OCR-1"], 2);
    assert.deepEqual(report.noModule["OCR-1"], ["X.LOST"], "a code in no module is reported, not guessed");
  });
  it("holds back the sign-off cards, and skips and lists a card no board can place", () => {
    const { data } = build();
    assert.ok(!data.cards.some((c) => c[0] === "X.HELD"));
    assert.deepEqual(data.held, ["X.HELD"]);
    assert.deepEqual(data.unmapped, ["X.LOST"]);
    assert.ok(!data.cards.some((c) => c[0] === "X.LOST"));
    assert.equal(data.cards.length, 3);
  });
  it("carries the prompt as written and capitalises only the first letter of the answer", () => {
    const { data } = build();
    const c = Object.fromEntries(data.cards.map((x) => [x[0], x]));
    assert.deepEqual(c["X.ONE"], ["X.ONE", "What is one?", "The first number"]);
    assert.equal(c["X.TWO"][2], "PH is acidity", "as the iPad does: no cleverness");
    assert.equal(capitalise(""), "");
    assert.equal(capitalise("1s, 2s"), "1s, 2s");
  });
  it("refuses an em dash anywhere a student reads, and an over-long deck name or a repeated id", () => {
    const bad = (answer: string) => ({ ...file, definitions: [{ id: "X.ONE", prompt: "Q?", answer, topics: { "AQA-1": ["1"] } }] });
    assert.throws(() => build(bad("a — b")), /em dash/);
    assert.throws(() => buildSubject({ subject: "B", file: bad("ok"), specs: [{ ...A, tree: tree([["1", null, "x".repeat(51)]]) }], hashes: {} }), /over 50/);
    assert.throws(() => build({ definitions: [file.definitions[0], file.definitions[0]] }), /duplicate/);
  });
  it("is deterministic and records the source hashes", () => {
    assert.equal(render(build().data), render(build().data));
    assert.deepEqual(build().data.src, { "b.json": "h" });
    assert.ok(!/\d{4}-\d\d-\d\d/.test(render(build().data)), "no dates");
  });
  it("renders data that verifies, and verification catches a broken file", () => {
    const d = JSON.parse(render(build().data)) as PremadeSubject;
    assert.deepEqual(verifyShape(d), []);
    assert.ok(verifyShape({ ...d, held: ["X.ONE"] }).some((m) => /held-back/.test(m)));
    assert.ok(verifyShape({ ...d, cards: [...d.cards, ["X.NEW", "Q", "A—B"]] }).some((m) => /em dash|no deck/.test(m)));
    d.specs[0].mods[0].k.push(99);
    assert.ok(verifyShape(d).some((m) => /index 99/.test(m)));
  });
});

describe("the committed premade decks", () => {
  const dir = join(import.meta.dirname, "..", "..", "content", "premadeDecks");
  const HELD = ["BIO.RHODOPSIN", "BIO.CRITICAL_PERIOD", "BIO.DEPRESSION", "BIO.CANCER_OESTROGEN", "BIO.CYSTIC_FIBROSIS", "BIO.EXERCISE_IMMUNITY", "CHEM.IDEAL_GAS", "CHEM.ARRHENIUS", "CHEM.LATTICE_ENTHALPY"];
  for (const slug of ["biology", "chemistry", "physics"]) {
    it(`${slug}: sound, free of em dashes and without a held-back card`, { skip: !existsSync(join(dir, `${slug}.json`)) && "not built" }, () => {
      const text = readFileSync(join(dir, `${slug}.json`), "utf8");
      const d = JSON.parse(text) as PremadeSubject;
      assert.deepEqual(verifyShape(d), []);
      assert.ok(!text.includes("—"));
      for (const id of HELD) assert.ok(!d.cards.some((c) => c[0] === id), id);
      assert.ok(d.cards.length > 100 && d.specs.length >= 3);
      assert.ok(Object.values(d.src).every((h) => /^[0-9a-f]{64}$/.test(h)));
    });
  }
});
