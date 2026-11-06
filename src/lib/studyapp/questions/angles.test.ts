import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { cleanAngles, exampleId, hashId, openingPhrases, phraseText, pickExamples, type Angles } from "./angles";
import { hasAngles } from "./anglesLoad";
import { cleanInsights, formMap } from "./insights";
import { askWords, classifyForm, FORMS, type Form } from "./questionForm";
import { questionText } from "./partText";
import real from "@/content/questionBankInsights/ocr-a-level-biology-a.angles.json";
import realInsights from "@/content/questionBankInsights/ocr-a-level-biology-a.json";
import meta from "@/content/questionBank/ocr-a-level-biology-a.json";

const w = (s: string) => s.split(" ");

describe("the words of the ask", () => {
  test("from the command word to the end of the clause, cut at anything that belongs to the paper", () => {
    assert.deepEqual(askWords("(i) explain why the rate falls. [2]"), w("explain why the rate falls"));
    assert.deepEqual(askWords("using the graph, suggest how the student could improve their method. [2]"), w("suggest how the student could improve their method"));
    assert.deepEqual(askWords("explain how fig. 6.3 supports the theory. [2]"), w("explain how"));
    assert.deepEqual(askWords("describe the pattern in table 2 [3]"), w("describe the pattern in table"));
    assert.deepEqual(askWords("calculate the mean (to 2 significant figures) [2]"), w("calculate the mean"));
  });
  test("nothing safe to read: null", () => {
    assert.equal(askWords(""), null);
    assert.equal(askWords("the polysaccharide is also deposited in the small gaps. [3]"), null);
  });
});

describe("opening phrases", () => {
  test("a phrase needs at least two real questions, and the counts are of questions", () => {
    const asks = [w("explain why the rate falls"), w("explain why it is cooler"), w("explain how it works"), w("explain the effect of heat")];
    assert.deepEqual(openingPhrases(asks), [["explain why", 2]]);
    assert.deepEqual(openingPhrases(asks.slice(0, 1)), []);
    assert.deepEqual(openingPhrases([]), []);
  });
  test("a longer phrase replaces the shorter one it makes up most of; none ends on a joining word", () => {
    const asks = [w("explain the effect of heat"), w("explain the effect of light"), w("explain the effect of ph"), w("explain how it works"), w("explain how it fails")];
    const got = openingPhrases(asks);
    assert.deepEqual(got.map(([p]) => p), ["explain the effect", "explain how"]);
    assert.deepEqual(got.map(([, n]) => n), [3, 2]);
    for (const [p] of got) assert.ok(!/ (the|a|of|in|to|for)$/.test(p));
  });
  test("words with digits or brackets never make a phrase, and at most four are returned", () => {
    assert.deepEqual(openingPhrases([w("state the 3"), w("state the 3")]), []);
    const asks = ["a1", "b1", "c1", "d1", "e1", "f1"].flatMap((x) => [w(`state ${x.replace(/\d/, "")}ish thing`), w(`state ${x.replace(/\d/, "")}ish thing`)]);
    assert.ok(openingPhrases(asks).length <= 4);
  });
  test("capitalised for reading", () => assert.equal(phraseText("explain why"), "Explain why"));
});

describe("examples", () => {
  const c = (id: string, series: string, marks: number | null) => ({ id, series, marks });
  test("spread across exams and marks, the same every time", () => {
    const cands = [c("a", "JUN23", 2), c("b", "JUN23", 2), c("c", "JUN24", 3), c("d", "JUN25", 2), c("e", "JUN24", 1), c("f", "JUN16", 4)];
    const got = pickExamples(cands);
    assert.equal(got.length, 4);
    assert.deepEqual(pickExamples([...cands].reverse()), got, "order of the input does not matter");
    const series = new Set(got.map((id) => cands.find((x) => x.id === id)!.series));
    assert.equal(series.size, 4, "four different exams where there are four");
    assert.deepEqual(pickExamples([]), []);
    assert.equal(pickExamples(cands.slice(0, 2)).length, 2);
  });
  test("a steady hash", () => { assert.equal(hashId("h42001-jun25-01"), hashId("h42001-jun25-01")); assert.notEqual(hashId("a"), hashId("b")); });
});

describe("reading the file", () => {
  const small = (): unknown => ({ v: 1, slug: "x", built: { parts: "abc" }, g: ["p1-jun24", "p1-jun25"], topics: { "1.1": { explain: { p: [["explain why", 3]], e: ["0:01-a", "1:02"] }, choice: { p: [], e: ["1:"] } } } });
  test("a good file; ids are put back together", () => {
    const a = cleanAngles(small())!;
    assert.ok(a);
    assert.equal(exampleId(a, "0:01-a"), "p1-jun24-01-a");
    assert.equal(exampleId(a, "1:"), "p1-jun25");
    assert.equal(exampleId(a, "7:x"), null);
    assert.equal(exampleId(a, "nope"), null);
  });
  test("anything else is nothing", () => {
    for (const b of [null, 5, {}, { ...(small() as object), v: 2 }, { ...(small() as object), g: [1] }, { ...(small() as object), topics: { a: { nonsense: { p: [], e: [] } } } },
      { ...(small() as object), topics: { a: { explain: { p: [["x", -1]], e: [] } } } }, { ...(small() as object), topics: { a: { explain: { p: [], e: ["bad"] } } } }]) assert.equal(cleanAngles(b), null);
  });
  test("offered only for the data it was built from", () => {
    assert.equal(hasAngles("ocr-a-level-biology-a", meta.data.parts), true);
    assert.equal(hasAngles("ocr-a-level-biology-a", "0000000000"), false);
    assert.equal(hasAngles("constructor", "x"), false);
    assert.equal(hasAngles("ocr-a-level-biology-a", undefined), false);
  });
});

describe("the committed Angles for OCR A-level Biology A", () => {
  const a = cleanAngles(real) as Angles;
  const ins = cleanInsights(realInsights)!;
  const forms = formMap(ins);
  test("read, and built from the data the bank names", () => {
    assert.ok(a);
    assert.equal(a.built.parts, meta.data.parts);
    assert.equal(a.built.text, meta.data.text);
    assert.deepEqual(Object.keys(a.topics), meta.topics.map((t) => t.code).sort((x, y) => x.localeCompare(y, "en", { numeric: true })));
  });
  test("every example is a real part, of the form it is listed under, with at most four to a form", () => {
    let n = 0;
    for (const [code, byForm] of Object.entries(a.topics)) {
      for (const [f, x] of Object.entries(byForm)) {
        assert.ok(x.e.length <= 4, `${code} ${f}`);
        assert.equal(new Set(x.e).size, x.e.length, `${code} ${f} repeats an example`);
        for (const e of x.e) {
          const id = exampleId(a, e);
          assert.ok(id, `${code} ${f} ${e}`);
          assert.equal(forms.get(id!), f as Form, `${id} is ${forms.get(id!)}, listed under ${f} for ${code}`);
          assert.ok(ins.topics[code], code);
          n++;
        }
      }
    }
    assert.ok(n > 300, `${n} examples`);
  });
  test("every phrase is at least two real questions, plain words, one case, no number and no dash", () => {
    let n = 0;
    for (const [code, byForm] of Object.entries(a.topics)) {
      for (const [f, x] of Object.entries(byForm)) {
        const t = ins.topics[code], fi = ins.forms.indexOf(f as Form);
        const have = t.c.reduce((s, row) => s + row[fi], 0);
        for (const [p, c] of x.p) {
          assert.ok(c >= 2 && c <= have, `${code} ${f} "${p}" ${c} of ${have}`);
          assert.ok(/^[a-z][a-z'\u2019 -]*$/.test(p), `"${p}"`);
          assert.ok(!/[0-9()[\]—–]/.test(p), `"${p}"`);
          assert.ok(p.split(" ").length >= 2 && p.split(" ").length <= 5, `"${p}"`);
          assert.ok(!/ (the|a|an|of|in|to|for|and|or)$/.test(p), `"${p}" ends on a joining word`);
          n++;
        }
        if (f === "choice" || f === "other") assert.deepEqual(x.p, []);
        assert.ok(FORMS.includes(f as Form));
      }
    }
    assert.ok(n > 60, `${n} phrases`);
  });
  test("the file is small", () => assert.ok(JSON.stringify(real).length < 40_000));
  test("with the bank's own data to hand (BANK_DATA_DIR with parts.json and text.json): examples have a mark scheme picture, are read whole, and the classifier agrees", { skip: !process.env.BANK_DATA_DIR || !existsSync(`${process.env.BANK_DATA_DIR}/parts.json`) }, () => {
    const dir = process.env.BANK_DATA_DIR!;
    const parts = new Map((JSON.parse(readFileSync(`${dir}/parts.json`, "utf8")) as { id: string; ms?: unknown; msq?: unknown; m: number | null; k?: string; x?: string }[]).map((p) => [p.id, p]));
    const text = JSON.parse(readFileSync(`${dir}/text.json`, "utf8")) as Record<string, string>;
    for (const [code, byForm] of Object.entries(a.topics)) for (const [f, x] of Object.entries(byForm)) for (const e of x.e) {
      const id = exampleId(a, e)!;
      const p = parts.get(id);
      assert.ok(p, id);
      assert.ok(p!.ms && !p!.msq, `${id} has no own mark scheme picture`);
      const q = questionText(text[id], { m: p!.m, x: p!.x });
      assert.ok(q.whole, `${id} was not read whole`);
      assert.equal(classifyForm({ text: q.text.toLowerCase(), marks: p!.m, key: p!.k }), f as Form, `${code} ${id}`);
      if (f !== "choice") assert.ok(askWords(q.text.toLowerCase()), `${id} has no ask found`);
    }
  });
});
