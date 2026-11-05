import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cleanInsights, examsText, formMap, formMix, marksText, sortedTopics, stripMax, topicStat, type Insights } from "./insights";
import { hasInsights } from "./insightsLoad";
import { FORMS } from "./questionForm";
import real from "@/content/questionBankInsights/ocr-a-level-biology-a.json";
import meta from "@/content/questionBank/ocr-a-level-biology-a.json";

const FORM3 = ["recall", "explain", "other"];
const small = (): unknown => ({
  v: 1, slug: "x", built: { parts: "abc" }, forms: FORM3, series: ["JUN24", "JUN25", "NOV25"], cover: { "1": "111", "2": "011" }, parts: 4, questions: 3,
  topics: {
    "1.1": { y: 1, p: 3, m: 5, q: 2, c: [[1, 0, 0], [1, 1, 0], [0, 0, 0]], fm: [3, 2, 0] },
    "1.10": { y: 2, p: 1, m: 3, q: 1, c: [[0, 0, 0], [0, 0, 0], [0, 1, 0]], fm: [0, 3, 0] },
    "1.2": { y: 2, p: 0, m: 0, q: 0, c: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], fm: [0, 0, 0] },
  },
  map: { "p1-jun24": { "01": 0, "02-a": 1 }, "p1-jun25": { "01": 0 }, "solo": { "": 2 } },
});

describe("reading the file", () => {
  test("a good file is read, and its part ids are put back together", () => {
    const ins = cleanInsights(small())!;
    assert.ok(ins);
    assert.deepEqual([...formMap(ins)], [["p1-jun24-01", "recall"], ["p1-jun24-02-a", "explain"], ["p1-jun25-01", "recall"], ["solo", "other"]]);
  });
  test("anything that is not what it should be is nothing, never a crash", () => {
    const bad: unknown[] = [null, 5, "x", [], {}, { ...(small() as object), v: 2 }, { ...(small() as object), forms: ["recall", "nope"] }, { ...(small() as object), forms: ["recall", "recall"] },
      { ...(small() as object), series: [] }, { ...(small() as object), map: { g: { a: 9 } } }, { ...(small() as object), map: { g: 5 } },
      { ...(small() as object), topics: { a: { y: 1, p: 1, m: 1, q: 1, c: [[1, 0, 0]], fm: [0, 0, 0] } } },
      { ...(small() as object), topics: { a: { y: 1, p: -1, m: 1, q: 1, c: [[1, 0, 0], [0, 0, 0], [0, 0, 0]], fm: [0, 0, 0] } } }];
    for (const b of bad) assert.equal(cleanInsights(b), null);
  });
});

describe("what a topic shows", () => {
  const ins = cleanInsights(small())!;
  test("a gap is an exam with papers for the topic's year and none of the topic; none is an exam with no papers of that year", () => {
    const a = topicStat(ins, "1.1")!;
    assert.deepEqual(a.strip.map((c) => [c.id, c.n, c.state]), [["JUN24", 1, "in"], ["JUN25", 2, "in"], ["NOV25", 0, "gap"]]);
    assert.equal(a.seriesIn, 2); assert.equal(a.open, 3);
    const b = topicStat(ins, "1.10")!;
    assert.deepEqual(b.strip.map((c) => c.state), ["none", "gap", "in"]);
    assert.equal(b.open, 2);
    assert.equal(examsText(b), "1 of 2 exams");
    assert.equal(topicStat(ins, "9.9"), null);
  });
  test("the order: most, least, spec (by number, not by letters), ties by spec", () => {
    const codes = ["1.2", "1.10", "1.1"];
    assert.deepEqual(sortedTopics(ins, "spec", codes).map((s) => s.code), ["1.1", "1.2", "1.10"]);
    assert.deepEqual(sortedTopics(ins, "most", codes).map((s) => s.code), ["1.1", "1.10", "1.2"]);
    assert.deepEqual(sortedTopics(ins, "least", codes).map((s) => s.code), ["1.2", "1.10", "1.1"]);
    assert.deepEqual(sortedTopics(ins, "most", ["1.1", "nope"]).map((s) => s.code), ["1.1"]);
  });
  test("how it is asked: forms that have parts, the most first, other last, with the marks they carry", () => {
    assert.deepEqual(formMix(ins, "1.1"), [{ form: "recall", parts: 2, marks: 3, avg: 1.5 }, { form: "explain", parts: 1, marks: 2, avg: 2 }]);
    assert.deepEqual(formMix(ins, "nope"), []);
    assert.equal(stripMax(topicStat(ins, "1.1")!), 2);
    assert.equal(marksText(2), "2"); assert.equal(marksText(1.5), "1.5");
  });
});

describe("the committed file for OCR A-level Biology A", () => {
  const ins = cleanInsights(real) as Insights;
  test("reads, and says which bank data it was built from", () => {
    assert.ok(ins);
    assert.equal(ins.slug, "ocr-a-level-biology-a");
    assert.equal(ins.built.parts, meta.data.parts);
    assert.equal(ins.built.text, meta.data.text);
    assert.deepEqual(ins.series, [...meta.series].reverse().map((s) => s.id));
    assert.deepEqual(ins.forms, [...FORMS]);
  });
  test("its numbers agree with each other and with the bank's topic counts", () => {
    assert.equal(formMap(ins).size, ins.parts);
    assert.equal(ins.parts, meta.count);
    for (const t of meta.topics) {
      const x = ins.topics[t.code];
      assert.ok(x, t.code);
      assert.equal(x.p, t.count, `${t.code} parts`);
      assert.equal(x.c.flat().reduce((a, b) => a + b, 0), x.p);
      assert.equal(x.fm.reduce((a, b) => a + b, 0), x.m);
      assert.ok(x.q <= x.p && x.q > 0);
      assert.equal(x.y, t.year);
    }
    assert.equal(Object.keys(ins.topics).length, meta.topics.length);
  });
  test("the file is small", () => assert.ok(JSON.stringify(real).length < 100_000));
  test("an analysis is offered only for the data it was built from", () => {
    assert.equal(hasInsights("ocr-a-level-biology-a", meta.data.parts), true);
    assert.equal(hasInsights("ocr-a-level-biology-a", "0000000000"), false);
    assert.equal(hasInsights("ocr-a-level-biology-a", undefined), false);
    assert.equal(hasInsights("aqa-gcse-physics", "7a9c85373f"), false);
    assert.equal(hasInsights("constructor", "x"), false);
  });
});
