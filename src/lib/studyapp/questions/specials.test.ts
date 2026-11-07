import assert from "node:assert/strict";
import test from "node:test";
import { insertKind, needsInsert, paperSpecials, specialsFor, transcriptOf, wholeFiles } from "./specials";

const ins = { "81451AA-JUN22": "aqa/AQA-81451AA-INS-JUN22.pdf" };
const hist = { subject: "History", ins };

test("a History question on the interpretations links the source booklet", () => {
  const f = specialsFor(hist, { p: "81451AA", s: "JUN22", x: "How does Interpretation B differ from Interpretation A about conflict on the Plains?" });
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, "ins");
  assert.match(f[0].label, /^Open the source booklet \(PDF\)$/);
  assert.match(f[0].href, /aqa\/AQA-81451AA-INS-JUN22\.pdf$/);
});

test("a History essay with no sources has no booklet link, and a paper with no booklet never has one", () => {
  assert.deepEqual(specialsFor(hist, { p: "81451AA", s: "JUN22", x: "Write an account of the ways in which the settlers changed the Plains." }), []);
  assert.deepEqual(specialsFor(hist, { p: "81451AA", s: "JUN25", x: "Study Source A." }), []);
});

test("English Language, English Literature and Geography papers with a booklet link it from every question", () => {
  for (const subject of ["English Language", "English Literature A", "Geography"]) assert.ok(needsInsert(subject, { x: "Give one reason." }), subject);
});

test("the booklet's name follows the subject", () => {
  assert.equal(insertKind("Geography").noun, "resource booklet");
  assert.equal(insertKind("French").noun, "reading texts");
  assert.equal(insertKind("Physics B").noun, "insert");
  assert.equal(insertKind("English Language").noun, "source booklet");
});

test("a language question links the reading texts only when the bank says it reads them", () => {
  assert.ok(needsInsert("French", { x: "Lisez le texte", src: 1 }));
  assert.ok(!needsInsert("French", { x: "Quel est votre sport favori ?" }));
});

test("OCR's scientific literacy papers link the insert on every question; other sciences when the words name it", () => {
  assert.ok(needsInsert("Chemistry B", { x: "Explain why." }));
  assert.ok(needsInsert("Biology A", { x: "Use Fig. 17.2 in the insert to answer." }));
  assert.ok(!needsInsert("Biology A", { x: "State two functions of the liver." }));
});

test("code files link on the paper that has them, as a download", () => {
  const f = specialsFor({ subject: "Computer Science", code: { "1cp22-JUN22": "edexcel/EDX-1CP2-02-DATA-JUN22.zip" } }, { p: "1cp22", s: "JUN22", x: "Open the file." });
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, "code");
  assert.ok(f[0].download);
});

test("a transcript is for a question with a recording", () => {
  const m = { subject: "French", trs: { "76521-JUN25": "aqa/AQA-76521-TR-JUN25.pdf" } };
  assert.deepEqual(specialsFor(m, { p: "76521", s: "JUN25", x: "Ecoutez" }).map((f) => f.kind), []);
  assert.deepEqual(specialsFor(m, { p: "76521", s: "JUN25", x: "Ecoutez", au: "aqa/a.mp3" }).map((f) => f.kind), ["tr"]);
  assert.equal(transcriptOf(m.trs, "76521", "JUN25"), "aqa/AQA-76521-TR-JUN25.pdf");
  assert.equal(transcriptOf(m.trs, "76521", "JUN24"), null);
});

test("a paper's header offers every file it has", () => {
  const f = paperSpecials({ subject: "History", ins, trs: { "81451AA-JUN22": "aqa/t.pdf" } }, "81451aa", "JUN22");
  assert.deepEqual(f.map((x) => x.kind), ["ins", "tr"]);
});

test("a path that is not a plain file path is never linked", () => {
  assert.deepEqual(paperSpecials({ subject: "History", ins: { "a-JUN22": "../../etc/passwd" } }, "a", "JUN22"), []);
  assert.deepEqual(paperSpecials({ subject: "History", ins: { "a-JUN22": "javascript:alert(1)" } }, "a", "JUN22"), []);
});

test("an English Language writing task needs no booklet, a reading question does", () => {
  const w = (x: string) => needsInsert("English Language", { x });
  assert.ok(!w("A magazine has asked for contributions for their creative writing section. Either Write a description of a village or Write a story about a journey"));
  assert.ok(!w("Write an article for a magazine with the title ‘My ambitions’."));
  assert.ok(!w("a) Write a story which begins: It was my first day at this school… Or, b) My Finest Hour."));
  assert.ok(w("Look in detail at this extract, from lines 5 to 9 of the source. How does the writer use language to describe the sea?"));
  assert.ok(w("Compare how the two writers convey their different perspectives."));
  assert.ok(w("Analyse how Text B uses language to create meanings and representations."));
});
test("the code files say they are a download, not a new tab", () => {
  const f = specialsFor({ subject: "Computer Science", code: { "1cp22-JUN22": "edexcel/x.zip" } }, { p: "1cp22", s: "JUN22" });
  assert.ok(f[0].download && /zip/.test(f[0].label));
});

test("a 40-mark English Language task with no reading words is a writing task whatever its first words say", () => {
  assert.ok(!needsInsert("English Language", { x: "‘Choosing a future career should be based on helping others and making a positive contribution to society, not on earning money.’", m: 40 }));
  assert.ok(needsInsert("English Language", { x: "Compare how the writers convey their different perspectives on the sea.", m: 16 }));
  assert.ok(needsInsert("English Language", { x: "Analyse how language is used in Text A and Text B to present views.", m: 40 }));
});

test("a sitting's whole paper, scheme and report are links under the papers base, found whatever the case of the paper code", () => {
  const meta = { qps: { "74051-JUN23": "aqa/AQA-74051-QP-JUN23.pdf" }, mss: { "74051-JUN23": "aqa/AQA-74051-MS-JUN23.pdf" } };
  const f = wholeFiles(meta, "74051", "JUN23");
  assert.ok(f.qp?.endsWith("/aqa/AQA-74051-QP-JUN23.pdf") && f.ms?.endsWith("/aqa/AQA-74051-MS-JUN23.pdf") && f.er === undefined);
  assert.deepEqual(wholeFiles(meta, "74051", "JUN22"), {});
  assert.ok(wholeFiles({ qps: { "84631H-JUN25": "aqa/a.pdf" } }, "84631h", "JUN25").qp);
  assert.deepEqual(wholeFiles({ qps: { "74051-JUN23": "../etc/passwd" } }, "74051", "JUN23"), {});
});
