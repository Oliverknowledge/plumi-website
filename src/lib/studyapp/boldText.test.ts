import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boldRuns, plainText } from "./boldText";

const r = (t: string) => boldRuns(t).map((x) => (x.bold ? `[${x.text}]` : x.text)).join("");

describe("bold runs", () => {
  it("a card with no markers is its own text, untouched", () => {
    assert.deepEqual(boldRuns("Plain text, 2 * 3 = 6"), [{ text: "Plain text, 2 * 3 = 6", bold: false }]);
    assert.deepEqual(boldRuns(""), []);
  });
  it("bolds a balanced pair, a phrase with spaces, and several pairs", () => {
    assert.equal(r("A unit that can **join** to form a **polymer**"), "A unit that can [join] to form a [polymer]");
    assert.equal(r("**per unit charge** of a source"), "[per unit charge] of a source");
  });
  it("leaves an unbalanced marker as literal text", () => {
    assert.equal(r("A **lonely marker"), "A **lonely marker");
    assert.equal(r("**a** and **b"), "[a] and **b");
    assert.equal(plainText("**a** and **b"), "a and **b");
  });
  it("leaves an empty pair as typed", () => {
    assert.equal(r("keep **** this"), "keep **** this");
    assert.equal(r("**** **a**"), "**** [a]", "an empty pair, then a real one");
  });
  it("adjacent pairs make one bold run, and pairs apart make two", () => {
    assert.equal(r("**a****b**"), "[ab]");
    assert.deepEqual(boldRuns("**a** **b**").map((x) => x.bold), [true, false, true]);
  });
  it("reads nesting left to right as the iPad does: it never nests", () => {
    assert.equal(r("**a **b** c**"), "[a ]b[ c]");
  });
  it("does not read a marker inside a maths span", () => {
    assert.equal(r("rate = $k**2$ and **x**"), "rate = $k**2$ and [x]");
    assert.equal(r("**$a**b$** c"), "[$a**b$] c");
    assert.equal(r("costs 5 **now**"), "costs 5 [now]");
  });
  it("an answer that already holds markers is read, not doubled", () => {
    assert.equal(plainText("The **join** of **two** things"), "The join of two things");
  });
  it("never produces markup: angle brackets stay text", () => {
    assert.equal(r("<b>**x**</b>"), "<b>[x]</b>");
  });
});
