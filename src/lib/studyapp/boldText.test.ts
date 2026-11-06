import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boldRuns, plainText, richRuns } from "./boldText";

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

describe("superscripts and subscripts: the iPad data's ^{..} and _{..} (real strings from the iPad's report)", () => {
  it("the founder's card: 3.0 x 10^{8} with the unit bold and its exponent bold too", () => {
    assert.equal(rich("Both travel at the same speed / speed of light/ 3.0 \u00D7 10^{8} **m s^{-1}**"), "[Both travel at the same speed / speed of light/ 3.0 \u00D7 10]^[8][ ]*[m s]*^[-1]");
  });
  it("units, formulae, ions, isotopes, particles, powers, as the handoff table draws them", () => {
    assert.equal(rich("0.100 mol dm^{-3}"), "[0.100 mol dm]^[-3]");
    assert.equal(rich("C_{6}H_{12}O_{6}"), "[C]_[6][H]_[12][O]_[6]");
    assert.equal(rich("SO_{4}^{2-}"), "[SO]_[4]^[2-]");
    assert.equal(rich("[Cu(H_{2}O)_{6}]^{2+}"), "[[Cu(H]_[2][O)]_[6][]]^[2+]");
    assert.equal(rich("^{12}C and ^{185}Re^{+}"), "^[12][C and ]^[185][Re]^[+]");
    assert.equal(rich("e^{-}"), "[e]^[-]");
    assert.equal(rich("GeV/c^{2}, n_{1}sin\u03B8_{1}"), "[GeV/c]^[2][, n]_[1][sin\u03B8]_[1]");
    assert.equal(rich("p(H_{2})^{2} and [NO]^{2}"), "[p(H]_[2][)]^[2][ and [NO]]^[2]");
  });
  it("trims a body (PO_{4}^{ 3-} is the board's printed 'PO4 3-' with the charge raised)", () => {
    assert.equal(rich("Pi/PO_{4}^{ 3-}"), "[Pi/PO]_[4]^[3-]");
    assert.equal(plainText("Fe^{ 2+}"), "Fe2+");
  });
  it("works inside a bold run and is bold with it; bands (bold off) keep the scripts", () => {
    assert.equal(rich("**no net emissions of CO_{2} to the atmosphere**"), "*[no net emissions of CO]*_[2]*[ to the atmosphere]");
    assert.equal(rich("an **ion Ca^{2+}**", { bold: false }), "[an ][ion Ca]^[2+]");
  });
  it("never straddles a bold marker: bold is read first", () => {
    assert.equal(rich("**x^{**y}"), "*[x^{][y}]");
  });
  it("an unclosed brace, a bare mark, an empty or nested body are ordinary text, and so is plain typing", () => {
    assert.equal(rich("x^{2 and y_{3"), "[x^{2 and y_{3]");
    assert.equal(rich("2^3 and snake_case and a^ b"), "[2^3 and snake_case and a^ b]");
    assert.equal(rich("a^{} b_{  } c"), "[a^{} b_{  } c]");
    assert.equal(rich("a^{b^{c}}"), "[a^{b]^[c][}]", "no nesting: the inner pair is the script, the rest is text");
    assert.equal(rich("line^{a\nb}"), "[line^{a\nb}]", "no line break inside");
  });
  it("flattened text is what it says: no braces or marks (sizing, screen readers)", () => {
    assert.equal(plainText("3.0 \u00D7 10^{8} **m s^{-1}**"), "3.0 \u00D7 108 m s-1");
    assert.equal(plainText("H_{2}O"), "H2O");
  });
  it("never produces markup: angle brackets and dollar signs stay text", () => {
    assert.equal(rich("<b>x^{2}</b> costs $5"), "[<b>x]^[2][</b> costs $5]");
  });
});
