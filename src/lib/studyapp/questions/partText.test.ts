import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { questionText } from "./partText";

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
