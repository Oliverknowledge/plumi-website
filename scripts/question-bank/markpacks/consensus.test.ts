import { test } from "node:test";
import assert from "node:assert/strict";
import { compareReadings, atoms, fuller } from "./consensus";
import type { ExtractedPack } from "./markpack";

const base = (): ExtractedPack => ({
  question_label: "01.1", scheme_label: "01.1", question_text: "q", marks_printed: 2, scheme_total: 2, needs_figure_or_table: false,
  answer_kind: "points", points: [{ n: 1, text: "Uses a ruler;", marks: 1 }, { n: 2, text: "Reads to 0.5 mm", marks: 1 }],
  max_marks: null, accept: [{ point: 1, text: "gp41/gp120" }], reject: [{ point: 2, text: "meiosis" }], ignore: [],
  rules: [], other_guidance: [], issues: [],
});
const clone = (p: ExtractedPack): ExtractedPack => JSON.parse(JSON.stringify(p));

test("identical readings agree", () => assert.equal(compareReadings(base(), base()).agree, true));
test("case, punctuation and spacing are ignored", () => {
  const b = clone(base()); b.points[0].text = "uses  a RULER"; assert.equal(compareReadings(base(), b).agree, true);
});
test("a slash list as one item or several is the same", () => {
  const b = clone(base()); b.accept = [{ point: 1, text: "gp41" }, { point: 1, text: "gp120" }]; assert.equal(compareReadings(base(), b).agree, true);
});
test("examples after eg / e.g. / ie are ignored", () => {
  const a = clone(base()), b = clone(base());
  a.accept = [{ point: 1, text: "phonetic spelling" }]; b.accept = [{ point: 1, text: "phonetic spelling eg moltose/maltosse" }];
  assert.equal(compareReadings(a, b).agree, true);
  b.accept = [{ point: 1, text: "phonetic spelling e.g. moltose" }]; assert.equal(compareReadings(a, b).agree, true);
});
test("a changed mark value disagrees", () => {
  const b = clone(base()); b.points[0].marks = 2; assert.equal(compareReadings(base(), b).agree, false);
});
test("a changed point word disagrees", () => {
  const b = clone(base()); b.points[1].text = "Reads to 1 mm"; assert.equal(compareReadings(base(), b).agree, false);
});
test("a different cap, total or kind disagrees", () => {
  for (const f of [(p: ExtractedPack) => { p.max_marks = 1; }, (p: ExtractedPack) => { p.scheme_total = 3; }, (p: ExtractedPack) => { p.answer_kind = "numeric"; }, (p: ExtractedPack) => { p.needs_figure_or_table = true; }]) {
    const b = clone(base()); f(b); assert.equal(compareReadings(base(), b).agree, false);
  }
});
test("a reject word one reader lacks disagrees", () => {
  const b = clone(base()); b.reject = []; assert.equal(compareReadings(base(), b).agree, false);
});
test("an item given to a different point disagrees on a multi-point part", () => {
  const b = clone(base()); b.reject = [{ point: null, text: "meiosis" }]; assert.equal(compareReadings(base(), b).agree, false);
  const c = clone(base()); c.reject = [{ point: 1, text: "meiosis" }]; assert.equal(compareReadings(base(), c).agree, false);
});
test("on a one-point part, whole-question and point 1 are the same", () => {
  const a = clone(base()), b = clone(base());
  for (const p of [a, b]) { p.points = [{ n: 1, text: "Maltose;", marks: 1 }]; p.marks_printed = 1; p.scheme_total = 1; }
  a.reject = [{ point: null, text: "maltase" }]; b.reject = [{ point: 1, text: "maltase" }];
  assert.equal(compareReadings(a, b).agree, true);
});
test("an extra point disagrees", () => {
  const b = clone(base()); b.points.push({ n: 3, text: "extra", marks: 0 }); assert.equal(compareReadings(base(), b).agree, false);
});
test("atoms", () => assert.deepEqual(atoms("Ligase/ primase/ DNA gyrase"), ["ligase", "primase", "dna gyrase"]));
test("fuller keeps the reading with more accept, reject and ignore words", () => {
  const a = clone(base()), b = clone(base()); b.accept = [{ point: 1, text: "gp41/gp120 eg more words here" }];
  assert.equal(fuller(a, b), b); assert.equal(fuller(b, a), b);
});
