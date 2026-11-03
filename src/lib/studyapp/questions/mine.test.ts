import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createSet, EMPTY_QUESTIONS, sanitiseQuestions, setMine, setPick, MAX_MINE, type QPart, type QuestionsData } from "./model";
import { readQuestions, serialise } from "./persist";
import { choicesAt, draftKey, draftOf, draftSlugs, effectiveMine, levelsOf, tickSubject } from "./mine";
import { baseSubject, boardLabel, subjectTint, type CatalogueSubject } from "./subject";

const c = (slug: string, board: string, level: string, subject: string, count = 100): CatalogueSubject => ({ slug, title: `${board} ${level} ${subject}`, board, level, subject, count });
const CAT: CatalogueSubject[] = [
  c("aqa-gcse-physics", "AQA", "GCSE", "Physics"), c("edexcel-gcse-physics", "Edexcel", "GCSE", "Physics"), c("ocr-gcse-physics-a", "OCR", "GCSE", "Physics A"),
  c("aqa-gcse-chemistry", "AQA", "GCSE", "Chemistry"), c("aqa-gcse-maths", "AQA", "GCSE", "Maths"), c("edexcel-gcse-maths", "Edexcel", "GCSE", "Maths"),
  c("aqa-gcse-bengali", "AQA", "GCSE", "Bengali"),
  c("edexcel-a-level-biology-a", "Edexcel", "A-Level", "Biology A"), c("edexcel-a-level-biology-b", "Edexcel", "A-Level", "Biology B"), c("aqa-a-level-biology", "AQA", "A-Level", "Biology"),
  c("edexcel-igcse-maths", "Edexcel", "IGCSE", "Maths"),
];
const KNOWN = new Set(CAT.map((x) => x.slug));
const part = (id: string): QPart => ({ id, p: "P", s: "JUN25", l: "01.1", m: 1, t: [], w: 1, h: 1 });
const withSet = (q: QuestionsData, subject: string, at: number) => createSet(q, { subject, title: subject, names: {}, topics: {}, parts: [part(`${subject}-p`)] }, at).q;

describe("my subjects, remembered", () => {
  test("a new student has none, so the setup shows", () => assert.deepEqual(effectiveMine(EMPTY_QUESTIONS, KNOWN), []));
  test("their choice is kept in order, unknown subjects dropped, repeats merged", () => {
    const q = setMine(EMPTY_QUESTIONS, ["aqa-gcse-chemistry", "gone-subject", "aqa-gcse-physics", "aqa-gcse-chemistry"]);
    assert.deepEqual(q.mine, ["aqa-gcse-chemistry", "gone-subject", "aqa-gcse-physics"]);
    assert.deepEqual(effectiveMine(q, KNOWN), ["aqa-gcse-chemistry", "aqa-gcse-physics"]);
  });
  test("an empty choice stays empty (they took every subject off): it is not re-derived from old sets", () => {
    const q = setMine(withSet(EMPTY_QUESTIONS, "aqa-gcse-maths", 5), []);
    assert.deepEqual(effectiveMine(q, KNOWN), []);
  });
  test("data from before this existed: the last subject and the subjects of their sets are theirs, newest first, and no set is touched", () => {
    let q = withSet(EMPTY_QUESTIONS, "aqa-gcse-maths", 1000);
    q = withSet(q, "aqa-gcse-chemistry", 2000);
    q = setPick(q, "aqa-gcse-physics", ["4.1.1"]);
    assert.equal(q.mine, undefined);
    assert.deepEqual(effectiveMine(q, KNOWN), ["aqa-gcse-physics", "aqa-gcse-chemistry", "aqa-gcse-maths"]);
    assert.equal(q.sets.length, 2);
  });
  test("an old document round trips through storage with every set and no `mine`, then takes one", () => {
    let q = withSet(withSet(EMPTY_QUESTIONS, "aqa-gcse-maths", 1000), "aqa-gcse-chemistry", 2000);
    q = setPick(q, "aqa-gcse-maths", []);
    const raw = serialise(q);
    assert.equal(JSON.parse(raw).q.mine, undefined);
    const read = readQuestions(raw, null).data;
    assert.equal(read.sets.length, 2);
    assert.deepEqual(effectiveMine(read, KNOWN), ["aqa-gcse-maths", "aqa-gcse-chemistry"]);
    const next = setMine(read, ["aqa-gcse-maths"]);
    const again = readQuestions(serialise(next), null).data;
    assert.deepEqual(again.mine, ["aqa-gcse-maths"]);
    assert.equal(again.sets.length, 2);
    assert.deepEqual(again.sets.map((s) => s.id), read.sets.map((s) => s.id));
  });
  test("a stored list is cleaned: strings only, no repeats, capped", () => {
    const raw = { sets: [], answers: {}, mine: ["a", 5, "", "a", null, "b", ...Array.from({ length: 60 }, (_, i) => `s${i}`)] };
    const q = sanitiseQuestions(raw);
    assert.equal(q.mine![0], "a");
    assert.equal(q.mine![1], "b");
    assert.equal(q.mine!.length, MAX_MINE);
    assert.equal(sanitiseQuestions({ mine: "nope" }).mine, undefined);
  });
  test("the cap on their subjects is enforced on write", () => assert.equal(setMine(EMPTY_QUESTIONS, Array.from({ length: 100 }, (_, i) => `s${i}`)).mine!.length, MAX_MINE));
});

describe("choosing subjects and boards", () => {
  test("a subject at a level lists only the boards the bank has for it", () => {
    const gcse = choicesAt(CAT, "GCSE");
    const phys = gcse.find((x) => x.base === "Physics")!;
    assert.deepEqual(phys.boards.map((b) => b.label), ["AQA", "Edexcel", "OCR A"]);   // OCR's "Physics A" is Physics, board "OCR A"
    assert.deepEqual(gcse.find((x) => x.base === "Bengali")!.boards.map((b) => b.slug), ["aqa-gcse-bengali"]);
    assert.deepEqual(gcse.find((x) => x.base === "Chemistry")!.boards.map((b) => b.label), ["AQA"]);
  });
  test("a board's variant letter is on its chip when the subject has one", () => {
    const bio = choicesAt(CAT, "A-Level").find((x) => x.base === "Biology")!;
    assert.deepEqual(bio.boards.map((b) => b.label), ["AQA", "Edexcel A", "Edexcel B"]);
    assert.equal(boardLabel(CAT[7]), "Edexcel A");
    assert.equal(baseSubject("Biology B"), "Biology");
  });
  test("the main subjects come first, then the rest alphabetically; each level has its own", () => {
    assert.deepEqual(choicesAt(CAT, "GCSE").map((x) => x.base), ["Maths", "Chemistry", "Physics", "Bengali"]);
    assert.deepEqual(choicesAt(CAT, "IGCSE").map((x) => x.base), ["Maths"]);
    assert.deepEqual(choicesAt(CAT, "A-Level 3"), []);
  });
  test("levels: GCSE and A-Level first, the rest under more", () => assert.deepEqual(levelsOf(CAT), { main: ["GCSE", "A-Level"], other: ["IGCSE"] }));
  test("ticking a subject with one board picks it; with several it follows the board already chosen at that level", () => {
    const gcse = choicesAt(CAT, "GCSE");
    const by = (b: string) => gcse.find((x) => x.base === b)!;
    let d = new Map<string, string>();
    d = tickSubject(d, "GCSE", by("Chemistry"), CAT);
    assert.equal(d.get(draftKey("GCSE", "Chemistry")), "aqa-gcse-chemistry");
    d = tickSubject(d, "GCSE", by("Physics"), CAT);
    assert.equal(d.get(draftKey("GCSE", "Physics")), "aqa-gcse-physics");   // AQA chosen for Chemistry, so AQA here
    d = tickSubject(d, "GCSE", by("Maths"), CAT);
    assert.equal(d.get(draftKey("GCSE", "Maths")), "aqa-gcse-maths");
  });
  test("with nothing chosen to follow, a subject with several boards is left for the student to choose", () => {
    const d = tickSubject(new Map(), "GCSE", choicesAt(CAT, "GCSE").find((x) => x.base === "Physics")!, CAT);
    assert.equal(d.get(draftKey("GCSE", "Physics")), "");
    assert.deepEqual(draftSlugs(d), []);
    const mixed = tickSubject(tickSubject(new Map(), "GCSE", choicesAt(CAT, "GCSE").find((x) => x.base === "Chemistry")!, CAT), "A-Level", choicesAt(CAT, "A-Level").find((x) => x.base === "Biology")!, CAT);
    assert.equal(mixed.get(draftKey("A-Level", "Biology")), "", "a GCSE board does not decide an A-Level one");
  });
  test("a draft is made from their subjects and gives them back in order", () => {
    const d = draftOf(["aqa-gcse-chemistry", "edexcel-a-level-biology-b", "nope"], CAT);
    assert.deepEqual(draftSlugs(d), ["aqa-gcse-chemistry", "edexcel-a-level-biology-b"]);
    assert.equal(d.get(draftKey("A-Level", "Biology")), "edexcel-a-level-biology-b");
  });
  test("every subject has a tint, the same each time, and the variant letter does not change it", () => {
    assert.equal(subjectTint("Biology A"), subjectTint("Biology"));
    assert.equal(subjectTint("Bengali"), subjectTint("Bengali"));
    assert.match(subjectTint("Physics"), /^var\(--t-/);
  });
});
