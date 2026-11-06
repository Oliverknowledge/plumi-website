import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boldRuns, plainText, richRuns, scriptRuns } from "./boldText";

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

const rich = (t: string, o?: { bold?: boolean }) => richRuns(t, o).map((x) => `${x.bold ? "*" : ""}${x.script === "sup" ? "^" : x.script === "sub" ? "_" : ""}[${x.text}]`).join("");

describe("superscripts and subscripts in a maths span", () => {
  it("reads ^ and _ with braces, signed digits, digit runs or one character", () => {
    assert.deepEqual(scriptRuns("10^{8}"), [{ text: "10" }, { text: "8", script: "sup" }]);
    assert.deepEqual(scriptRuns("m s^{-1}"), [{ text: "m s" }, { text: "-1", script: "sup" }]);
    assert.deepEqual(scriptRuns("m s^-1"), [{ text: "m s" }, { text: "-1", script: "sup" }]);
    assert.deepEqual(scriptRuns("SO_4^{2-}"), [{ text: "SO" }, { text: "4", script: "sub" }, { text: "2-", script: "sup" }]);
    assert.deepEqual(scriptRuns("cm^3"), [{ text: "cm" }, { text: "3", script: "sup" }]);
    assert.deepEqual(scriptRuns("Ca^{2+}"), [{ text: "Ca" }, { text: "2+", script: "sup" }]);
    assert.deepEqual(scriptRuns("x_i"), [{ text: "x" }, { text: "i", script: "sub" }]);
    assert.deepEqual(scriptRuns("V^\u221212"), [{ text: "V" }, { text: "\u221212", script: "sup" }]);
  });
  it("draws a card line: the delimiters go, the scripts are runs", () => {
    assert.equal(rich("3.0 \u00D7 $10^{8}$ m s$^{-1}$"), "[3.0 \u00D7 ][10]^[8][ m s]^[-1]");
    assert.equal(rich("$CO_2$ and $H_2O$"), "[CO]_[2][ and ][H]_[2][O]");
    assert.equal(plainText("$CO_2$ gas"), "CO2 gas");
  });
  it("works inside bold, and leaves bold markers out when asked (the bands)", () => {
    assert.equal(rich("**$H_2O$ forms**"), "*[H]*_[2]*[O]*[ forms]");
    assert.equal(rich("an **ion $Ca^{2+}$**", { bold: false }), "[an ][ion ][Ca]^[2+]");
  });
  it("reads only inside a span: plain text and a student's own symbols stay as typed", () => {
    assert.equal(rich("snake_case and 2^3"), "[snake_case and 2^3]");
    assert.equal(rich("costs $5 and x^2"), "[costs $5 and x^2]", "an unclosed $ is not a span");
    assert.equal(rich("$a^$"), "[a^]", "a mark with nothing after it is literal");
    assert.equal(rich("$a**b$ **x**"), "[a**b][ ]*[x]");
  });
  it("never produces markup", () => {
    assert.ok(richRuns("$<b>x</b>^2$").every((r) => !r.text.includes("\u0000")));
    assert.equal(rich("$<b>^2$"), "[<b>]^[2]");
  });
});
