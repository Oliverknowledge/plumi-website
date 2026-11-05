import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { QPart } from "./model";
import { mentionsFigure, shortLabel, sharedFigure, TALL } from "./sharedFigure";

const part = (l: string, h: number, x = "", o: Partial<QPart> = {}): QPart => ({ id: `h02001-jun25-${l.replace(/[()]/g, "")}`, p: "H02001", s: "JUN25", l, m: 2, t: [], w: 1134, h, x, ...o });

/** OCR A-Level Biology A, June 2025 Paper 1, question 23: the cell diagram with its scale bar is in 23(a)(i)'s picture only (the bank's parts file, h02001-jun25-23-*). */
const Q23 = [
  part("23(a)(i)", 1141, "Calculate the surface area to volume ratio (SA:V) of the plasma cell. Assume the plasma cell is spherical."),
  part("23(a)(ii)", 385, "Calculate the magnification of the B lymphocyte. Give your answer to 2 significant figures. Magnification = [2]"),
  part("23(a)(iii)", 556, "Using the diagram and your own knowledge, explain why plasma cells are usually larger than B lymphocytes. [3]"),
  part("23(b)(i)", 638, "Name the type of T lymphocyte shown in the diagram. [1]"),
  part("23(b)(ii)", 357, "Describe the role of process X in producing cell Y to fight future infections by the same pathogen. [2]"),
  part("23(c)(i)", 1180, "Some students choose to carry out a Student’s t-test to analyse the data for the drug treatment. With reference to the data, suggest whether a Student’s t-test"),
  part("23(c)(ii)", 385, "The students conclude that CYC is the most effective drug in reducing plasma cell numbers. Identify two reasons why the conclusion might not be supported."),
];
const at = (l: string) => Q23.find((p) => p.l === l)!;

describe("a figure cut into the first part's picture only", () => {
  test("23(a)(ii), which asks for a magnification with no figure of its own, is offered 23(a)(i)'s picture", () => {
    const f = sharedFigure(at("23(a)(ii)"), Q23);
    assert.equal(f?.from.l, "23(a)(i)");
    assert.equal(f?.label, "(a)(i)");
  });
  test("so are the later parts that go on about the diagram, from the same picture", () => {
    for (const l of ["23(a)(iii)", "23(b)(i)", "23(b)(ii)"]) assert.equal(sharedFigure(at(l), Q23)?.label, "(a)(i)", l);
  });
  test("a part with a tall picture of its own has its figure; the parts after it use that one", () => {
    assert.equal(sharedFigure(at("23(c)(i)"), Q23), null);
    assert.equal(sharedFigure(at("23(c)(ii)"), Q23)?.label, "(c)(i)");
  });
  test("the first part is never offered one", () => assert.equal(sharedFigure(at("23(a)(i)"), Q23), null));
  test("the order the parts are given in does not matter, and the part need not be among them", () => {
    assert.equal(sharedFigure(at("23(a)(ii)"), [...Q23].reverse())?.label, "(a)(i)");
    assert.equal(sharedFigure(at("23(a)(ii)"), Q23.filter((p) => p.l !== "23(a)(ii)"))?.label, "(a)(i)");
  });
});

describe("where a figure is not missing", () => {
  const aqa = [part("01.1", 400, "Which of these is a unit of energy?", { st: 1 }), part("01.2", 300, "Use the diagram to calculate the speed."), part("01.3", 800, "Draw a graph.")];
  test("a question with a stem has its figure shown already, whatever the words say", () => {
    assert.equal(sharedFigure(aqa[1], aqa), null);
    assert.equal(sharedFigure(aqa[2], aqa), null);
  });
  test("a stem on any part of the question counts", () => {
    const q = [part("3(a)", 900), part("3(b)", 300, "the diagram"), part("3(c)", 300, "Explain", { st: 1 })];
    assert.equal(sharedFigure(q[1], q), null);
  });
  test("a question with one part has nothing to share", () => assert.equal(sharedFigure(part("5", 900), [part("5", 900)]), null));
  test("small parts that mention nothing figure-like, after small parts, are left alone", () => {
    const q = [part("2(a)", 300, "State one function of the nucleus."), part("2(b)", 280, "Name the organelle that makes ATP."), part("2(c)", 250, "Explain your answer to (b).")];
    for (const p of q) assert.equal(sharedFigure(p, q), null, p.l);
  });
  test("words that mention a figure are enough when no earlier picture is tall: the first part's picture is offered", () => {
    const q = [part("4(a)", 300, "Look at the table."), part("4(b)", 250, "Use the table to find the mean.")];
    assert.equal(sharedFigure(q[1], q)?.from.l, "4(a)");
  });
  test("a tall earlier picture is enough with no words about a figure, but only for a small part", () => {
    const q = [part("6(a)", 1000, "Calculate."), part("6(b)", 300, "Calculate the gradient."), part("6(c)", 900, "Sketch")];
    assert.equal(sharedFigure(q[1], q)?.from.l, "6(a)");
    assert.equal(sharedFigure(q[2], q), null);
  });
  test("a picture's height counts at the bank's usual width, so a narrower crop is not taller than it is", () => {
    const narrow = [part("7(a)", 560, "Calculate.", { w: 800 }), part("7(b)", 200, "Calculate.", { w: 800 })];
    assert.ok(560 * 1100 / 800 >= TALL);
    assert.equal(sharedFigure(narrow[1], narrow)?.from.l, "7(a)");
    const short = [part("8(a)", 500, "Calculate.", { w: 1086 }), part("8(b)", 200, "Calculate.", { w: 1086 })];
    assert.equal(sharedFigure(short[1], short), null);
  });
});

describe("the words", () => {
  test("a figure, a diagram, a graph, a table, a source, shown, above, the data", () => {
    for (const w of ["the diagram", "Figure 3", "this graph", "the table", "Source B", "the process shown", "the equation above", "With reference to the data"]) assert.ok(mentionsFigure(w), w);
  });
  test("ordinary questions do not", () => {
    for (const w of ["State two uses of insulin.", "Calculate the mass of one mole", "", undefined]) assert.ok(!mentionsFigure(w), String(w));
  });
  test("a label as the question prints it", () => {
    assert.equal(shortLabel("23(a)(i)"), "(a)(i)");
    assert.equal(shortLabel("3(b)"), "(b)");
    assert.equal(shortLabel("01.2"), "01.2");
    assert.equal(shortLabel("5"), "5");
  });
});
