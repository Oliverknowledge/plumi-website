import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFraction, FRACTION_PART_MAX, isFractionShortcut } from "./fraction";
import { symbolsFor } from "./symbols";

const text = (a: string, b: string) => { const r = buildFraction(a, b); assert.ok(r.ok, `${a}/${b}: ${r.ok ? "" : r.hint}`); return r.ok ? r.text : ""; };

test("two whole numbers make a stacked fraction in Unicode, with the fraction slash", () => {
  assert.equal(text("3", "5"), "³⁄₅");
  assert.equal(text("12", "7"), "¹²⁄₇");
  assert.equal(text("0", "4"), "⁰⁄₄");
  assert.equal(text("1234567890", "9"), "¹²³⁴⁵⁶⁷⁸⁹⁰⁄₉");
});
test("one minus is a plain minus in front of the whole fraction (hyphen, minus sign or en dash typed); two stay on their parts", () => {
  assert.equal(text("-3", "5"), "\u2212³⁄₅");
  assert.equal(text("\u22123", "5"), "\u2212³⁄₅");
  assert.equal(text("3", "-5"), "\u2212³⁄₅");
  assert.equal(text("-3", "-5"), "⁻³⁄₋₅");
});
test("a zero bottom is refused with a calm hint, a zero top is fine", () => {
  for (const b of ["0", "00", "-0", " 0 "]) { const r = buildFraction("3", b); assert.equal(r.ok, false); if (!r.ok) assert.equal(r.hint, "The bottom cannot be zero"); }
  assert.equal(text("0", "4"), "⁰⁄₄");
  assert.equal(text("x", "0"), "x/0");   // (letters are not checked)
});
test("spaces round a part are dropped", () => {
  assert.equal(text("  3 ", "\t5  "), "³⁄₅");
});
test("anything else is top/bottom, with brackets round a part that is more than one token", () => {
  assert.equal(text("a+1", "b"), "(a+1)/b");
  assert.equal(text("x", "2"), "x/2");
  assert.equal(text("1.5", "2"), "1.5/2");
  assert.equal(text("x", "y+z"), "x/(y+z)");
  assert.equal(text("(a+1)", "b"), "(a+1)/b");
  assert.equal(text("(a)+(b)", "c"), "((a)+(b))/c");
  assert.equal(text("2 x", "3"), "(2 x)/3");
  assert.equal(text("π", "2"), "π/2");
  assert.equal(text("-x", "2"), "-x/2");
});
test("an empty top or bottom is refused with a calm hint, nothing is built", () => {
  for (const [a, b] of [["", "5"], ["3", ""], ["  ", "5"], ["3", " \t"]]) {
    const r = buildFraction(a, b);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.hint, /^Add a top and a bottom$/);
  }
});
test("a very long part, or one with a line break, is refused", () => {
  const long = "x".repeat(FRACTION_PART_MAX + 1);
  const r = buildFraction(long, "2"); assert.equal(r.ok, false);
  assert.equal(buildFraction("1", "2\n3").ok, false);
  assert.equal(buildFraction("x".repeat(FRACTION_PART_MAX), "2").ok, true);
  // a number too long to stack is written with a slash, not dropped
  const big = buildFraction("1".repeat(20), "3"); assert.ok(big.ok && big.text === `${"1".repeat(20)}/3`);
});
test("what is inserted is spoken back plainly", () => {
  const r = buildFraction("3", "5"); assert.ok(r.ok && r.spoken === "three over five");
  const q = buildFraction("a+1", "b"); assert.ok(q.ok && q.spoken === "a+1 over b");
});
test("Ctrl+/ (Cmd+/ on a Mac) opens the box; other keys do not", () => {
  const k = (o: Partial<{ key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; code: string }>) => isFractionShortcut({ key: "/", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });
  assert.ok(k({ ctrlKey: true })); assert.ok(k({ metaKey: true }));
  assert.ok(!k({})); assert.ok(!k({ ctrlKey: true, altKey: true })); assert.ok(!k({ ctrlKey: true, key: "?" }));
  assert.ok(k({ ctrlKey: true, shiftKey: true }));                            // a layout where "/" is Shift+7
  assert.ok(k({ ctrlKey: true, key: "-", code: "Slash" }));                   // a layout where the key beside the right Shift is something else
  assert.ok(!k({ key: "/", code: "Slash" }));
});
test("the Fraction key is for the subjects that have maths keys or numerals, and no other", () => {
  for (const s of ["aqa-gcse-maths", "edexcel-igcse-further-maths", "aqa-a-level-physics", "aqa-gcse-chemistry", "aqa-gcse-biology", "aqa-gcse-combined-science", "aqa-gcse-geography", "aqa-gcse-economics", "aqa-gcse-business", "aqa-gcse-psychology"]) assert.equal(symbolsFor(s).fraction, true, s);
  for (const s of ["aqa-gcse-english-literature", "aqa-gcse-history", "aqa-gcse-religious-studies", "aqa-gcse-french", "aqa-gcse-spanish", "aqa-gcse-bengali", "edexcel-gcse-computer-science", "aqa-a-level-sociology"]) assert.equal(symbolsFor(s).fraction, false, s);
});
