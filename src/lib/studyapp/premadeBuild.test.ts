import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import { bolded, buildMarkScheme, buildSubject, candidatesForCode, capitalise, cardBack, render, verifyShape, type DefinitionsFile, type PremadeSubject, type SpecInput } from "./premadeBuild";

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
    assert.equal(capitalise("**a** b"), "**A** b");
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

describe("bold key words (the iPad's KeyWording.bolded and capitalised, step for step)", () => {
  it("bolds each required word and capitalises after the marker (real iPad cards)", () => {
    assert.equal(cardBack("a smaller unit that can join with many others to form a polymer", ["join", "polymer"]), "A smaller unit that can **join** with many others to form a **polymer**");
    assert.equal(cardBack("the total number of protons and neutrons in the nucleus of an atom", ["protons and neutrons"]), "The total number of **protons and neutrons** in the nucleus of an atom");
  });
  it("a phrase with spaces is one run, and the first word is capitalised inside its markers", () => {
    assert.equal(cardBack("per unit charge of a source", ["per unit charge"]), "**Per unit charge** of a source");
  });
  it("bolds only the first occurrence of a repeated word", () => {
    assert.equal(bolded("join the join", ["join"]), "**join** the join");
  });
  it("longest first, and never inside a run already bold", () => {
    assert.equal(bolded("energy transferred per unit charge", ["charge", "per unit charge"]), "energy transferred **per unit charge**");
  });
  it("matches ignoring case and keeps the text's own letters", () => {
    assert.equal(bolded("a polymer", ["Polymer"]), "a **polymer**");
  });
  it("leaves maths and symbols alone around the bold", () => {
    assert.equal(cardBack("the ionic product, Kw = [H\u207A][OH\u207B]", ["ionic product"]), "The **ionic product**, Kw = [H\u207A][OH\u207B]");
  });
  it("the accept map plays no part: an alternative that is the one present does not stand in (the iPad adds a Key words line)", () => {
    const f: DefinitionsFile = { definitions: [{ id: "X.A", prompt: "Q?", answer: "a unit that can bond", required: ["join"], topics: { "AQA-1": ["1"] }, accept: { join: ["bond"] } } as never] };
    const { data } = build(f);
    assert.equal(data.cards[0][2], "A unit that can bond\nKey words: **join**");
  });
  it("an answer that already holds ** is read: a word inside an existing run is skipped, one outside is bolded", () => {
    assert.equal(bolded("a **big** word", ["word", "big"]), "a **big** **word**");
    assert.equal(cardBack("**big** word", []), "**Big** word");
  });
  it("the build writes it into the card back, and leaves the prompt alone", () => {
    const f: DefinitionsFile = { definitions: [{ id: "X.A", prompt: "What is a **monomer**?", answer: "a smaller unit that can join", required: ["join"], topics: { "AQA-1": ["1"] } }] };
    const { data } = build(f);
    assert.deepEqual(data.cards[0], ["X.A", "What is a **monomer**?", "A smaller unit that can **join**"]);
  });
});

describe("mark scheme cards", () => {
  const T = tree([["1", null, "Cells"], ["1.1", "1", "Membranes"], ["PH.2", null, "Mechanics"], ["PH.2.3", "PH.2", "Forces"], ["3", null, "Empty"]]);
  const spec: SpecInput = { id: "X-1", label: "X", code: "1", tree: T };
  const card = (id: string, topics: string[], extra: Record<string, unknown> = {}) => ({ id, prompt: "Define locus.", marks: 1, answer: "(Fixed) position of a gene", allow: [], not: [], ignore: [], notes: [], topics, ...extra }) as never;
  it("tries each code with and without the PH. prefix and then one level up, as the iPad does", () => {
    assert.deepEqual(candidatesForCode("4.6.4"), ["4.6.4", "PH.4.6.4", "4.6", "PH.4.6", "4", "PH.4"]);
  });
  it("files a card under the first of its topic codes that finds a module, in the tree's module order", () => {
    const { data, report } = buildMarkScheme({ subject: "Biology", spec, hashes: { "f.json": "h" }, cards: [
      card("X.A", ["9.9", "1.1.7"]), card("X.B", ["2.3"]), card("X.C", ["1"]), card("X.D", ["7.7"]),
    ] });
    assert.equal(data.kind, "markscheme");
    assert.deepEqual(data.specs[0].mods.map((m) => [m.c, m.t, m.k.length]), [["1", "Cells", 2], ["PH.2", "Mechanics", 1]], "empty modules left out");
    assert.deepEqual(data.unmapped, ["X.D"]);
    assert.deepEqual(report.noModule, ["X.D"]);
    assert.deepEqual(data.cards.map((c) => c[0]), ["X.A", "X.B", "X.C"]);
  });
  it("carries the card verbatim: the question with its marks, the answer as points, and the board's own lines with their leads", () => {
    const { data } = buildMarkScheme({ subject: "Physics", spec, hashes: {}, cards: [card("X.A", ["1"], { prompt: "Explain **why**.", marks: 2, answer: "first **point**\nsecond point", allow: ["a"], not: ["n"], ignore: ["i"], notes: ["State symbols"] })] });
    assert.deepEqual(data.cards[0], ["X.A", "Explain **why**.\n\n[2 marks]", "\u2022 first **point**\n\u2022 second point\nAlso accept: a\nNot accepted: n\nIgnore: i\nNote: State symbols"]);
    assert.deepEqual(verifyShape(JSON.parse(render(data))), []);
  });
  it("refuses an em dash rather than change the board's words, and a repeated id", () => {
    assert.throws(() => buildMarkScheme({ subject: "B", spec, hashes: {}, cards: [card("X.A", ["1"], { answer: "a \u2014 b" })] }), /em dash/);
    assert.throws(() => buildMarkScheme({ subject: "B", spec, hashes: {}, cards: [card("X.A", ["1"]), card("X.A", ["1"])] }), /duplicate/);
  });
});

describe("the committed mark scheme decks", () => {
  const dir = join(import.meta.dirname, "..", "..", "content", "premadeDecks");
  const SPECS = ["aqa-7402", "aqa-7405", "aqa-7408", "aqa-8461", "aqa-8462", "aqa-8463", "edexcel-9ph0", "ocr-h420", "ocr-h432", "ocr-h556"];
  const files = SPECS.map((s) => join(dir, `markscheme-${s}.json`));
  it("are all there, sound, and in budget", { skip: !files.every(existsSync) && "not built" }, () => {
    let cards = 0, gz = 0, raw = 0;
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      const d = JSON.parse(text) as PremadeSubject;
      assert.equal(d.kind, "markscheme");
      assert.deepEqual(verifyShape(d), [], f);
      assert.equal(d.specs.length, 1);
      assert.ok(d.cards.every((c) => /\n\n\[\d+ marks?\]$/.test(c[1])), "every front ends with its marks");
      assert.ok(!text.includes("\u2014"));
      cards += d.cards.length; raw += text.length; gz += gzipSync(text).length;
    }
    assert.equal(cards, 1166, "all the iPad's cards are placed");
    assert.ok(gz < 350 * 1024, `gzip ${gz}`);
    assert.ok(raw < 700 * 1024, `raw ${raw}`);
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
