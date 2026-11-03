import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { compareLabels, questionKeyOf } from "./model";
import { buildSetInput, filterRows, fold, matches, mix, NO_FILTERS, partsByQuestion, seeded, sortRows, windowOf, words, type BankRow, type Filters } from "./picker";

const row = (id: string, o: Partial<BankRow> = {}): BankRow => ({ id, p: "84631H", s: "JUN25", l: "01.1", m: 2, t: ["4.1.1"], w: 1086, h: 400, x: "Describe the difference between renewable resources", ...o });
const FIX: BankRow[] = [
  row("a-01-1", { l: "01.1", m: 2, t: ["4.1.1"], ms: 1 }),
  row("a-01-2", { l: "01.2", m: 1, t: ["4.1.2"], x: "Write down the equation which links density mass and volume" }),
  row("a-01-3", { l: "01.3", m: 3, t: ["4.3.1"], ms: 1, x: "Calculate the volume of seawater passing through the turbine" }),
  row("a-02-1", { l: "02.1", m: 6, t: ["4.1.1"], ms: 1 }),
  row("b-01-1", { id: "b-01-1", p: "84632F", s: "JUN24", l: "01.1", m: 4, t: ["4.2.1"], k: "B", x: "Which circuit symbol is a diode?" }),
  row("c-01-1", { id: "c-01-1", s: "NOV21", l: "01.1", m: null, t: ["4.2.1"], x: "Résumé of the Diagram" }),
  row("c-01-9", { id: "c-01-9", s: "NOV21", l: "01.10", m: 8, t: [], x: "Evaluate" }),
];
const f = (o: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...o });
const ids = (rs: readonly BankRow[]) => rs.map((r) => r.id);

describe("filters", () => {
  test("no filters keeps every part", () => assert.equal(filterRows(FIX, NO_FILTERS).length, FIX.length));
  test("topics: any chosen topic matches", () => {
    assert.deepEqual(ids(filterRows(FIX, f({ topics: ["4.1.1"] }))), ["a-01-1", "a-02-1"]);
    assert.deepEqual(ids(filterRows(FIX, f({ topics: ["4.1.2", "4.3.1"] }))), ["a-01-2", "a-01-3"]);
  });
  test("paper and series, case-insensitive paper", () => {
    assert.deepEqual(ids(filterRows(FIX, f({ paper: "84632f" }))), ["b-01-1"]);
    assert.deepEqual(ids(filterRows(FIX, f({ series: "NOV21" }))), ["c-01-1", "c-01-9"]);
  });
  test("marks bands include their ends and leave out parts with no marks", () => {
    assert.deepEqual(ids(filterRows(FIX, f({ band: "1-2" }))), ["a-01-1", "a-01-2"]);
    assert.deepEqual(ids(filterRows(FIX, f({ band: "3-4" }))), ["a-01-3", "b-01-1"]);
    assert.deepEqual(ids(filterRows(FIX, f({ band: "5-6" }))), ["a-02-1"]);
    assert.deepEqual(ids(filterRows(FIX, f({ band: "7+" }))), ["c-01-9"]);
  });
  test("has a mark scheme: a crop or a multiple-choice key", () => {
    assert.deepEqual(ids(filterRows(FIX, f({ scheme: true }))), ["a-01-1", "a-01-3", "a-02-1", "b-01-1"]);
  });
  test("search: every word, any case, accents ignored, quoted phrases whole", () => {
    assert.deepEqual(ids(filterRows(FIX, f({ q: "VOLUME turbine" }))), ["a-01-3"]);
    assert.deepEqual(ids(filterRows(FIX, f({ q: "resume diagram" }))), ["c-01-1"]);
    assert.deepEqual(ids(filterRows(FIX, f({ q: "\"mass and volume\"" }))), ["a-01-2"]);
    assert.deepEqual(ids(filterRows(FIX, f({ q: "\"volume and mass\"" }))), []);
    assert.deepEqual(words("a \"b c\" D"), ["a", "b c", "d"]);
  });
  test("search also reads the paper's full text when it has loaded, and the label", () => {
    const text = { "a-02-1": fold("The Bunsen burner flame is blue") };
    assert.deepEqual(ids(filterRows(FIX, f({ q: "bunsen" }), text)), ["a-02-1"]);
    assert.deepEqual(ids(filterRows(FIX, f({ q: "bunsen" }))), []);
    assert.equal(matches(FIX[1], f({ q: "01.2" })), true);
  });
  test("filters combine", () => assert.deepEqual(ids(filterRows(FIX, f({ topics: ["4.1.1"], band: "5-6", scheme: true }))), ["a-02-1"]));
});

describe("order", () => {
  test("newest series first, then paper, then labels as a person reads them", () => {
    const sorted = sortRows(FIX, ["JUN25", "JUN24", "NOV21"], compareLabels);
    assert.deepEqual(ids(sorted), ["a-01-1", "a-01-2", "a-01-3", "a-02-1", "b-01-1", "c-01-1", "c-01-9"]);
    assert.ok(compareLabels("01.2", "01.10") < 0);
    assert.ok(compareLabels("3(a)", "3(b)") < 0);
    assert.ok(compareLabels("3(b)(ii)", "3(b)(i)") > 0);
  });
  test("parts group by question", () => {
    const by = partsByQuestion(FIX);
    assert.equal(by.get(questionKeyOf(FIX[0]))!.length, 3);
    assert.equal(by.get(questionKeyOf(FIX[3]))!.length, 1);
  });
});

/** A larger pool: 3 topics, 12 questions of 3 parts, to see a mix spread. */
const pool: BankRow[] = Array.from({ length: 36 }, (_, i) => row(`p${i}`, { s: "JUN25", l: `${String(Math.floor(i / 3) + 1).padStart(2, "0")}.${(i % 3) + 1}`, t: [["T1", "T2", "T3"][Math.floor(i / 3) % 3]], m: 1 + (i % 4) }));

describe("mix for me", () => {
  test("gives n parts, no repeats, same seed same mix", () => {
    const a = mix(pool, 10, { recent: new Set(), rng: seeded(7) });
    const b = mix(pool, 10, { recent: new Set(), rng: seeded(7) });
    assert.equal(a.length, 10);
    assert.equal(new Set(ids(a)).size, 10);
    assert.deepEqual(ids(a), ids(b));
    assert.notDeepEqual(ids(a), ids(mix(pool, 10, { recent: new Set(), rng: seeded(8) })));
  });
  test("spreads across the chosen topics", () => {
    const m = mix(pool, 9, { recent: new Set(), rng: seeded(3), topics: ["T1", "T2", "T3"] });
    const by = (t: string) => m.filter((p) => p.t[0] === t).length;
    assert.deepEqual([by("T1"), by("T2"), by("T3")], [3, 3, 3]);
  });
  test("avoids parts done lately while there are others", () => {
    const recent = new Set(pool.slice(0, 20).map((p) => p.id));
    const m = mix(pool, 15, { recent, rng: seeded(1) });
    assert.equal(m.length, 15);
    assert.ok(m.every((p) => !recent.has(p.id)));
  });
  test("when it must, it tops up from the recent ones rather than fall short", () => {
    const recent = new Set(pool.slice(0, 30).map((p) => p.id));
    const m = mix(pool, 10, { recent, rng: seeded(1) });
    assert.equal(m.length, 10);
    assert.equal(m.filter((p) => !recent.has(p.id)).length, 6);
  });
  test("prefers different questions", () => {
    const m = mix(pool, 12, { recent: new Set(), rng: seeded(5) });
    assert.equal(new Set(m.map(questionKeyOf)).size, 12);
  });
  test("a small pool gives what there is; parts with no marks are left out when there is enough without", () => {
    assert.equal(mix(pool.slice(0, 4), 10, { recent: new Set(), rng: seeded(1) }).length, 4);
    const withNull = [...pool, row("n1", { m: null, l: "30.1" })];
    assert.ok(mix(withNull, 36, { recent: new Set(), rng: seeded(2) }).every((p) => p.m != null));
    assert.equal(mix([row("n1", { m: null })], 5, { recent: new Set(), rng: seeded(2) }).length, 1);
  });
  test("empty pool", () => assert.deepEqual(mix([], 5, { recent: new Set(), rng: seeded(1) }), []));
});

describe("window", () => {
  test("only the rows in view, plus a little either side", () => {
    assert.deepEqual(windowOf(6400, 90, 0, 720), { from: 0, to: 14 });
    assert.deepEqual(windowOf(6400, 90, 9000, 720), { from: 94, to: 114 });
    assert.deepEqual(windowOf(5, 90, 0, 720), { from: 0, to: 5 });
  });
});

describe("making a set from rows", () => {
  const meta = {
    slug: "aqa-gcse-physics", title: "AQA GCSE Physics", board: "AQA", level: "GCSE", subject: "Physics", cv: 2,
    topics: [{ code: "4.1.1", title: "Energy changes in a system, and the ways energy is stored", short: "Energy stores", section: "4.1", count: 10 }, { code: "4.2.1", title: "Current", section: "4.2", count: 4 }],
    sections: [], papers: [{ id: "84631H", name: "Paper 1 Higher" }, { id: "84632F", name: "Paper 2 Foundation" }], series: [{ id: "JUN25", label: "June 2025" }, { id: "JUN24", label: "June 2024" }],
  };
  test("keeps what the sheet needs, trims the rest, and names things", () => {
    const input = buildSetInput(meta, [FIX[0], FIX[4], { ...FIX[1], x: "y".repeat(500), calc: 1 }]);
    assert.equal(input.subject, "aqa-gcse-physics");
    assert.equal(input.cv, 2);
    assert.deepEqual(input.names, { "84631H": "Paper 1 Higher", JUN25: "June 2025", "84632F": "Paper 2 Foundation", JUN24: "June 2024" });
    assert.deepEqual(input.topics, { "4.1.1": "Energy stores", "4.2.1": "Current" });   // 4.1.2 is not in the subject's tree: left out
    assert.equal(input.parts[2].x!.length, 140);
    assert.equal("calc" in input.parts[2], false);
    assert.equal(input.parts[1].k, "B");
    assert.equal(input.parts[0].ms, 1);
  });
});
