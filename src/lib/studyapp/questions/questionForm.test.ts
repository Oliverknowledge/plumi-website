import test from "node:test";
import assert from "node:assert/strict";
import { classifyForm, clauses, FORMS, FORM_NAMES, isForm, type Form } from "./questionForm";
import fixture from "./__fixtures__/questionForm.ocr-biology-a.json";

const f = (text: string, marks = 2, key: string | null = null): Form => classifyForm({ text, marks, key });

test("a multiple-choice key is the only way to be choice, and the words never are", () => {
  assert.equal(f("4 which option describes the structure of biological molecules? a x b y c z d w your answer [1]", 1, "A"), "choice");
  assert.equal(f("which option describes the structure of biological molecules? a x b y", 1, null), "recall");
  assert.equal(f("explain why", 1, "x"), "explain");
});

test("each command word is its form", () => {
  assert.equal(f("(i) state the type of reaction that is catalysed by pfk. [1]", 1), "recall");
  assert.equal(f("(ii) name the type of circulatory system shown in fig. 2.1. [1]", 1), "recall");
  assert.equal(f("(c) describe how you would use the same equipment to test this. [2]"), "describe");
  assert.equal(f("explain why the control experiment is carried out. [1]", 1), "explain");
  assert.equal(f("(i) calculate the percentage increase in the wolf population. percentage increase = [2]"), "calculate");
  assert.equal(f("suggest why high levels of ck indicate that a person may have had a heart attack. [1]", 1), "suggest");
  assert.equal(f("justify your answer. [2]"), "suggest");
  assert.equal(f("(c) compare prophase in mitosis with prophase in meiosis. [4]", 4), "evaluate");
  assert.equal(f("evaluate this conclusion. [3]", 3), "evaluate");
  assert.equal(f("(i) complete the table below about microscopes and their images. [2]"), "draw");
  assert.equal(f("sketch a graph of the results in table 4. [2]"), "draw");
});

test("the more demanding command word wins", () => {
  assert.equal(f("state two enzymes and describe their functions. [4]", 4), "describe");
  assert.equal(f("describe and explain the pattern of the melting points. [2]"), "explain");
  assert.equal(f("explain why the rate falls and calculate the rate at 20 s. [3]", 3), "calculate");
  assert.equal(f("complete the table and calculate the mean. [3]", 3), "calculate");
  assert.equal(f("suggest how and explain why the student chose this. [3]", 3), "suggest");
});

test("a command word counts where an examiner puts it, not in the middle of the setup", () => {
  assert.equal(f("the student could describe the pattern. the graph shows the results. [1]", 1), "other");
  assert.equal(f("the results suggest that the enzyme is denatured. the table shows the data. [1]", 1), "other");
  assert.equal(f("the scientists wanted to calculate the rate. fig. 1 shows the apparatus. [1]", 1), "other");
  // after a lead-in, a label, a caption or a run of diagram letters, the ask is found
  assert.equal(f("using the information provided, suggest how the scientists could compare the pollution. [3]", 3), "suggest");
  assert.equal(f("use the chromatogram to calculate the rf value of valine. rf = [2]"), "calculate");
  assert.equal(f("stage r stage s (i) state the names of stages r and s. stage r stage s [1]", 1), "recall");
  assert.equal(f("fig. 6.3 explain how fig. 6.3 supports the theory. [2]"), "explain");
  assert.equal(f("roots of plants. a b name the cells labelled a and b in the photomicrograph. a b [2]"), "recall");
});

test("how to write the answer is not the ask", () => {
  assert.equal(f("(ii) calculate the percentage decrease. give your answer to 3 significant figures. percentage decrease = % [3]", 3), "calculate");
  assert.equal(f("the mass is 4 g. give your answer in standard form. [1]", 1), "other");
  assert.equal(f("draw a conclusion from the result. [2]"), "suggest");
});

test("six marks or more is an extended response, unless it is a calculation or a drawing", () => {
  assert.equal(f("(c)* compare and contrast the mechanism of expiration. [6]", 6), "extended");
  assert.equal(f("describe how the nervous system responds. [9]", 9), "extended");
  assert.equal(f("calculate the cardiac output. [6]", 6), "calculate");
  assert.equal(f("plot the results as a graph. [6]", 6), "draw");
  assert.equal(f("explain this. [5]", 5), "explain");
});

test("unsure is other, never a guess", () => {
  assert.equal(f("the polysaccharide is also deposited in the small gaps between cells. these gaps are known as . [3]", 3), "other");
  assert.equal(f("", 1), "other");
  assert.equal(f("use the graph to estimate the concentration of sucrose. [2]"), "other");
  assert.equal(classifyForm({ text: "describe it", marks: null }), "describe");
});

test("clauses never throw on odd text", () => {
  for (const t of ["", "[3]", "((((", "a b c d e f g", "fig. fig. fig.", "“”", "(i)(ii)(iii)", "x ".repeat(5000)]) assert.ok(Array.isArray(clauses(t)));
});

test("every form has a name a student can read, and no em dash", () => {
  for (const x of FORMS) { assert.ok(FORM_NAMES[x].length > 2); assert.ok(!FORM_NAMES[x].includes(String.fromCharCode(0x2014))); assert.ok(isForm(x)); }
  assert.equal(isForm("nope"), false);
});

/**
 * The accuracy gate, on 100 real OCR A-level Biology A parts read and labelled by hand. The first 50 were used while the rules were written; the other 50 were labelled after
 * the rules were frozen and never used to change them, and that half is the number that is reported. Precision is over the parts the classifier committed to (not "other").
 */
const score = (split: string) => {
  const rows = fixture.rows.filter((r) => r.split === split);
  let said = 0, right = 0;
  const wrong: string[] = [];
  for (const r of rows) {
    const got = classifyForm({ text: r.text, marks: r.marks, key: r.key });
    if (got === "other") continue;
    said++;
    if (got === r.label) right++; else wrong.push(`${r.id}: said ${got}, read as ${r.label}`);
  }
  return { n: rows.length, said, right, wrong, precision: said ? right / said : 0, coverage: said / rows.length };
};

test("accuracy gate: held-out half, 90% or better on the parts it commits to", () => {
  const s = score("held");
  assert.equal(s.n, 50);
  assert.ok(s.precision >= 0.9, `precision ${(s.precision * 100).toFixed(1)}% (${s.right}/${s.said}); wrong: ${s.wrong.join("; ")}`);
  assert.ok(s.coverage >= 0.75, `coverage ${(s.coverage * 100).toFixed(0)}%`);
});

test("accuracy gate: development half", () => {
  const s = score("dev");
  assert.equal(s.n, 50);
  assert.ok(s.precision >= 0.9, `precision ${(s.precision * 100).toFixed(1)}%; wrong: ${s.wrong.join("; ")}`);
});
