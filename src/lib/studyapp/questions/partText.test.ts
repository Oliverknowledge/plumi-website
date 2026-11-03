import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { questionText, schemeText } from "./partText";

const AQA = "0 1 figure 1 shows water being heated. eventually the water changed into steam. 0 1 . 3 a mass of 0.063 kg of water was turned into steam. calculate the thermal energy transferred to the water to turn it into steam. [2 marks] energy = j question answers extra information mark ao / spec. ref. 1.3 e = 0.063 × 2 260 000 e = 140 000 (j) a correct answer scores 2 marks";

describe("read as text", () => {
  test("AQA style: the question stops at its marks, and the mark scheme is never in it", () => {
    const r = questionText(AQA, { m: 2, x: "figure 1 shows water" });
    assert.equal(r.whole, true);
    assert.match(r.text, /^Figure 1 shows water being heated/);
    assert.match(r.text, /\[2 marks\]$/);
    assert.ok(!/140 000|extra information|e = 0\.063/.test(r.text), r.text);
  });
  test("it stops at the scheme's heading even where no marks token comes first", () => {
    const raw = "the diagram shows a circuit with a cell and a lamp explain why the lamp is lit. question answers additional comments/guidance mark the circuit is complete 1";
    const r = questionText(raw, { m: 3, x: "the diagram" });
    assert.equal(r.whole, true);
    assert.equal(r.text, "The diagram shows a circuit with a cell and a lamp explain why the lamp is lit.");
  });
  test("Edexcel style: stops after the part's own mark in brackets", () => {
    const raw = "(ii) which of these would improve the technicians’ measurement of the speed of sound? (1) a use a firework banger. 6(a)(ii) c increase the distance (1) ao3 a, b and d are incorrect";
    const r = questionText(raw, { m: 1, x: "(ii) which of these" });
    assert.ok(r.whole);
    assert.match(r.text, /speed of sound\? \(1\)$/);
  });
  test("nothing to cut at: the opening words only, and not the whole page (it would carry the scheme)", () => {
    const raw = "18 carbon nanotubes are new. suggest a reason. covalent bonds are stronger than metallic bonds more energy needed to break them";
    const r = questionText(raw, { m: null, x: "carbon nanotubes are new. suggest a reason" });
    assert.equal(r.whole, false);
    assert.equal(r.text, "Carbon nanotubes are new. suggest a reason");
    assert.ok(!/covalent/.test(r.text));
  });
  test("no text file (it failed to load): the opening words", () => {
    assert.deepEqual(questionText(undefined, { m: 2, x: "work out the speed" }), { text: "Work out the speed", whole: false });
    assert.deepEqual(questionText("", { m: 2, x: "" }), { text: "", whole: false });
  });
  test("a mark token in the first words is not the end of the question", () => {
    const raw = "x (2) is the value of the root. find x. [2 marks] answer mark scheme guidance";
    const r = questionText(raw, { m: 2, x: "x" });
    assert.ok(r.whole);
    assert.match(r.text, /find x\. \[2 marks\]$/);
  });
});

describe("read as text: short questions are whole", () => {
  test("opening words that already reach the marks are the whole question, with nothing to apologise for", () => {
    const r = questionText(undefined, { m: 1, x: "which shop impressed her? [1 mark]" });
    assert.deepEqual(r, { text: "Which shop impressed her? [1 mark]", whole: true });
    // and when the file did load but found nothing to cut at
    assert.equal(questionText("0 1 . 1 which shop impressed her? [1 mark] a b c d", { m: null, x: "which shop impressed her? [1 mark]" }).whole, true);
  });
  test("opening words that stop short are still only the start", () => {
    assert.equal(questionText(undefined, { m: 4, x: "describe the method you would use to" }).whole, false);
  });
});

describe("the mark scheme as text", () => {
  test("AQA: what follows the question, without the table's heading row", () => {
    const r = schemeText(AQA, { m: 2 });
    assert.match(r.text, /^1\.3 e = 0\.063/);
    assert.ok(!/extra information|spec\. ref/i.test(r.text), r.text);
    assert.ok(/a correct answer scores 2 marks/.test(r.text));
    assert.ok(!/figure 1 shows water/i.test(r.text));
  });
  test("Edexcel: after the question's mark, the scheme", () => {
    const raw = "(ii) which would improve the measurement? (1) a use a firework banger. 6(a)(ii) c increase the distance (1) ao3 a, b and d are incorrect";
    assert.match(schemeText(raw, { m: 1 }).text, /6\(a\)\(ii\) c increase the distance \(1\) ao3/);
  });
  test("nothing says where the question ends: no scheme text is invented", () => {
    assert.equal(schemeText("18 carbon nanotubes are new. suggest a reason. covalent bonds are stronger", { m: null }).text, "");
    assert.equal(schemeText(undefined, { m: 2 }).text, "");
    assert.equal(schemeText("what is x? [1 mark]", { m: 1 }).text, "");
  });
  test("a long scheme is cut at a word", () => {
    const raw = `what? [2 marks] question answers mark ${"word ".repeat(600)}`;
    const t = schemeText(raw, { m: 2 }).text;
    assert.ok(t.length < 1900 && t.endsWith("\u2026"));
  });
});
