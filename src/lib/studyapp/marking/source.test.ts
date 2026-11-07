import { test } from "node:test";
import assert from "node:assert/strict";
import { markSource } from "./source";
import type { QAnswer } from "@/lib/studyapp/questions/model";

const A = (o: Partial<QAnswer>): QAnswer => ({ at: 1, ...o });
const INK = { n: 3, b: 100 };

test("nothing written anywhere: nothing to mark", () => {
  assert.equal(markSource(undefined), null);
  assert.equal(markSource(A({})), null);
  assert.equal(markSource(A({ text: "   " })), null);
});
test("the tab in front of the student decides when both have something", () => {
  assert.equal(markSource(A({ mode: "type", text: "typed", ink: INK })), "text");
  assert.equal(markSource(A({ mode: "ink", text: "typed", ink: INK })), "ink");
});
test("with no tab chosen yet, typed words win over a drawing", () => {
  assert.equal(markSource(A({ text: "typed", ink: INK })), "text");
  assert.equal(markSource(A({ ink: INK })), "ink");
});
test("writing on the question counts when the tab in front is empty, even if the other tab holds something hidden", () => {
  assert.equal(markSource(A({ mode: "type", ann: INK })), "ann");
  assert.equal(markSource(A({ mode: "ink", ann: INK })), "ann");
  assert.equal(markSource(A({ mode: "type", ink: INK, ann: INK })), "ann", "a drawing in the tab nobody is looking at does not outrank what is on the page");
  assert.equal(markSource(A({ ann: INK })), "ann");
});
test("writing on the question never outranks what is in the tab in front", () => {
  assert.equal(markSource(A({ mode: "type", text: "typed", ann: INK })), "text");
  assert.equal(markSource(A({ mode: "ink", ink: INK, ann: INK })), "ink");
});
test("an empty annotation count is not an answer; a hidden tab is the last resort", () => {
  assert.equal(markSource(A({ mode: "type", ann: { n: 0, b: 0 } })), null);
  assert.equal(markSource(A({ mode: "type", ink: INK })), "ink");
  assert.equal(markSource(A({ mode: "ink", text: "typed" })), "text");
});
