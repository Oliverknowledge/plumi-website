import assert from "node:assert/strict";
import { test } from "node:test";
import { startSubject, subjectWord } from "./subject";

test("Start focus always has a subject to start with", () => {
  assert.equal(startSubject(undefined), null, "never chosen: no subject, not an invented one");
  assert.equal(startSubject("physics"), "physics", "the last choice stays");
  assert.equal(startSubject(null), null, "Other is a choice");
});

test("the word on the card", () => {
  assert.equal(subjectWord(undefined), "Focus");
  assert.equal(subjectWord("maths"), "Maths");
  assert.equal(subjectWord(null), "Other");
  assert.equal(subjectWord("latin"), "Focus");
});
