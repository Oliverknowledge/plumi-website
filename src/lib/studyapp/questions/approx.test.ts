import assert from "node:assert/strict";
import { test } from "node:test";
import { lostLayout, mathsLike } from "./approx";

test("maths and science subjects are the ones whose texts can lose a fraction", () => {
  assert.ok(mathsLike("aqa-gcse-maths") && mathsLike("aqa-a-level-physics"));
  assert.ok(!mathsLike("aqa-gcse-history") && !mathsLike("aqa-gcse-french"));
});
test("a flattened fraction is spotted, a number written in thousands is not", () => {
  assert.ok(lostLayout("aqa-gcse-maths", "some students went from 2x = 3 to x = 2 3 instead of the correct answer of x = 3 2"));
  assert.ok(lostLayout("edexcel-gcse-maths", "many gave 8 10 or cancelled this down to 4 5 ."));
  assert.ok(!lostLayout("ocr-gcse-maths", "the correct answer of 16 500 and a few gave 650 000"));
  assert.ok(!lostLayout("aqa-gcse-physics", "an answer of 14 000 J was seen"));
});
test("nothing is said about an essay subject", () => {
  assert.ok(!lostLayout("aqa-gcse-history", "in 1 2 sources"));
});
