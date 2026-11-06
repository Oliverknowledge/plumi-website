import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerLength, isStructured, parseBack, parseFront, writeBack, writeFront } from "./markscheme";

const base = { allow: [] as string[], not: [] as string[], ignore: [] as string[], notes: [] as string[] };

describe("mark scheme card text (the iPad's MarkSchemeText)", () => {
  it("writes the front: the question, a blank line, the marks", () => {
    assert.equal(writeFront("Define locus.", 1), "Define locus.\n\n[1 mark]");
    assert.equal(writeFront("Explain why.", 3), "Explain why.\n\n[3 marks]");
  });
  it("a one-line answer is written as it is; several lines become points, except a line ending in a colon", () => {
    assert.equal(writeBack({ ...base, answer: "(Fixed) position of a gene" }), "(Fixed) position of a gene");
    assert.equal(writeBack({ ...base, answer: "Any two from:\nfirst point\nsecond **point**" }), "Any two from:\n• first point\n• second **point**");
  });
  it("then one line for each of the board's own lines, in the order accept, not, ignore, note", () => {
    const b = writeBack({ answer: "a\nb", allow: ["x", "y"], not: ["n"], ignore: ["i"], notes: ["Comparisons needed"] });
    assert.equal(b, "• a\n• b\nAlso accept: x\nAlso accept: y\nNot accepted: n\nIgnore: i\nNote: Comparisons needed");
  });
  it("reads a back into points, an 'or', and the three bands plus notes", () => {
    const a = parseBack("Either:\n• one\n• **or**\n• two\nAlso accept: ok\nNot accepted: no\nIgnore: meh\nNote: n");
    assert.deepEqual(a.rows, [{ kind: "lead", text: "Either:" }, { kind: "point", text: "one" }, { kind: "either" }, { kind: "point", text: "two" }]);
    assert.deepEqual([a.accepted, a.rejected, a.ignored, a.notes], [["ok"], ["no"], ["meh"], ["n"]]);
  });
  it("write then read round-trips", () => {
    const c = { answer: "p1\np2", allow: ["a1", "a2"], not: ["n1"], ignore: ["i1"], notes: ["m"] };
    const a = parseBack(writeBack(c));
    assert.deepEqual(a.rows.map((r) => (r.kind === "point" ? r.text : r.kind)), ["p1", "p2"]);
    assert.deepEqual(a.accepted, c.allow);
  });
  it("tells a structured back from a plain one, so a student's own card is read the ordinary way", () => {
    assert.equal(isStructured("A smaller unit that can **join** with others"), false);
    assert.equal(isStructured("• a point"), true);
    assert.equal(isStructured("one line\nIgnore: that"), true);
    assert.equal(isStructured(""), false);
  });
  it("an edited card is still read: the leads are plain text", () => {
    const a = parseBack("• edited point\nAlso accept: my own");
    assert.deepEqual(a.accepted, ["my own"]);
  });
  it("reads a front's marks, and leaves anything else alone", () => {
    assert.deepEqual(parseFront("Define locus.\n\n[1 mark]"), { question: "Define locus.", marks: "1 mark" });
    assert.deepEqual(parseFront("Q\n\n[12 marks]"), { question: "Q", marks: "12 marks" });
    assert.deepEqual(parseFront("What is [x] here?"), { question: "What is [x] here?", marks: null });
    assert.deepEqual(parseFront("[3 marks]"), { question: "[3 marks]", marks: "3 marks" }, "never an empty question");
    assert.deepEqual(parseFront("Q [3 mark sets]"), { question: "Q [3 mark sets]", marks: null });
  });
  it("measures the answer for its size", () => {
    assert.equal(answerLength(parseBack("• abc\n• or\nIgnore: de")), 3 + 2);
  });
});
