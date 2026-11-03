import assert from "node:assert/strict";
import { test } from "node:test";
import { insertAt, SYMBOLS, toSub, toSup } from "./symbols";

test("superscripts and subscripts, and what cannot be converted stays", () => {
  assert.equal(toSup("2"), "²");
  assert.equal(toSup("-1"), "⁻¹");
  assert.equal(toSup("n+1"), "ⁿ⁺¹");
  assert.equal(toSup("q"), "q");
  assert.equal(toSub("H2O".slice(1, 2)), "₂");
  assert.equal(toSub("max"), "mₐₓ");
});
test("insertion replaces the selection and places the cursor after it", () => {
  assert.deepEqual(insertAt("v = 3", 4, 5, "√"), { value: "v = √", caret: 5 });
  assert.deepEqual(insertAt("ab", null, null, "π"), { value: "abπ", caret: 3 });
  assert.deepEqual(insertAt("ab", 1, 1, "²"), { value: "a²b", caret: 2 });
});
test("every symbol has a name a screen reader can say", () => {
  assert.ok(SYMBOLS.every((s) => s.ch && s.name));
  assert.equal(new Set(SYMBOLS.map((s) => s.ch)).size, SYMBOLS.length);
});
