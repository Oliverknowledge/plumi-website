import { test } from "node:test";
import assert from "node:assert/strict";
import { readChoice, markChoice, CHOICE_LINE } from "./choice";
import { parseMarkReply } from "./api";

test("one option letter is read however it is written", () => {
  for (const w of ["C", "c", " c ", "(C)", "C.", "C)", "(c).", "Answer: C", "answer c", "The answer is C", "option C", "Ans = c", "“C”"]) {
    assert.deepEqual(readChoice(w), { kind: "letter", letter: "C" }, w);
  }
});

test("two options is several, and a sentence or nothing is none: nothing is guessed", () => {
  for (const w of ["B or C", "B, C", "A/D", "b and d", "BC"]) assert.notDeepEqual(readChoice(w).kind, "letter", w);
  assert.equal(readChoice("B or C").kind, "several");
  assert.equal(readChoice("B, C").kind, "several");
  for (const w of ["", "   ", "(", "I think C", "it is the second one", "A dog", "1", "Z"]) assert.equal(readChoice(w).kind, "none", JSON.stringify(w));
});

test("the right letter earns the mark, a wrong one earns none and says the answer", () => {
  const yes = markChoice("C", 1, "c");
  assert.equal(yes.marks, 1); assert.equal(yes.outOf, 1); assert.equal(yes.anyHeld, false);
  assert.equal(yes.points[0].status, "awarded"); assert.equal(yes.points[0].evidence, "C");
  const no = markChoice("C", 1, "B");
  assert.equal(no.marks, 0); assert.equal(no.points[0].status, "not_awarded"); assert.equal(no.points[0].evidence, null);
  assert.match(no.points[0].reason, /answer is C/);
});

test("the key is compared without regard to case or spaces", () => {
  assert.equal(markChoice(" b ", 1, "B").marks, 1);
  assert.equal(markChoice("B", 1, "b").marks, 1);
});

test("the reply is in exactly the shape the result card and the server contract accept", () => {
  assert.ok(parseMarkReply(markChoice("A", 1, "A")));
  assert.ok(parseMarkReply(markChoice("A", 1, "D")));
});

test("student-facing copy has no em dash", () => {
  const texts = [CHOICE_LINE, markChoice("A", 1, "A").points[0].reason, markChoice("A", 1, "B").points[0].reason];
  for (const t of texts) assert.ok(!t.includes("—") && !t.includes("–"), t);
});
