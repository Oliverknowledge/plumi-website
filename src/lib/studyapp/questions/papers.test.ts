import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { againInput, createSet, EMPTY_QUESTIONS, finishSet, keyOf, markPart, MAX_PAPER_PARTS, MAX_SET_PARTS, sanitiseQuestions, setText, type QuestionsData } from "./model";
import type { BankRow } from "./picker";
import { countsLine, groupPapers, paperAria, paperKey, paperSetInput, paperState, shelfOf, splitSeries, stateLine, yearsOf } from "./papers";
import type { SubjectMeta } from "./subject";

const row = (id: string, s: string, p: string, l: string, m: number | null, o: Partial<BankRow> = {}): BankRow => ({ id, p, s, l, m, t: ["4.1.1"], w: 1086, h: 300, x: "Describe", ...o });
const META: SubjectMeta = {
  slug: "aqa-gcse-physics", title: "AQA GCSE Physics", board: "AQA", level: "GCSE", subject: "Physics", topics: [], sections: [],
  papers: [{ id: "84631H", name: "Paper 1 Higher" }, { id: "84631F", name: "Paper 1 Foundation" }, { id: "9hi01a", name: "Paper 1A", title: "The crusades" }],
  series: [{ id: "JUN25", label: "June 2025" }, { id: "JUN24", label: "June 2024" }, { id: "SPEC", label: "Specimen" }],
};
// rows arrive in any order, from three papers; one paper is missing question 3
const ROWS: BankRow[] = [
  row("h25-02-1", "JUN25", "84631H", "02.1", 4, { ms: 1 }),
  row("h25-01-2", "JUN25", "84631H", "01.2", 1, { ms: 1 }),
  row("h25-01-1", "JUN25", "84631H", "01.1", 2, { ms: 1, st: 1 }),
  row("h25-01-10", "JUN25", "84631H", "01.10", 3),
  row("f25-01-1", "JUN25", "84631F", "01.1", 5, { k: "B" }),
  row("h24-01-1", "JUN24", "84631H", "01.1", 6),
  row("h24-04-1", "JUN24", "84631H", "04.1", null),
  row("sp-01-1", "SPEC", "84631H", "1(a)", 2),
  row("x-1", "JUN23", "zz", "1", 1),
];

describe("grouping rows into papers", () => {
  const papers = groupPapers(ROWS, META);
  test("one paper per series and paper code; newest sitting first, then the bank's paper order", () => {
    assert.deepEqual(papers.map((p) => p.key), ["JUN25|84631h", "JUN25|84631f", "JUN24|84631h", "SPEC|84631h", "JUN23|zz"]);
    assert.deepEqual(papers.map((p) => p.name), ["Paper 1 Higher", "Paper 1 Foundation", "Paper 1 Higher", "Paper 1 Higher", "zz"]);
    assert.deepEqual(papers.map((p) => p.series), ["June 2025", "June 2025", "June 2024", "Specimen", "JUN23"]);
    assert.deepEqual(papers.map((p) => p.year), ["2025", "2025", "2024", "Specimen", "JUN23"]);
  });
  test("rows are in printed order (01.2 before 01.10)", () => {
    assert.deepEqual(papers[0].rows.map((r) => r.id), ["h25-01-1", "h25-01-2", "h25-01-10", "h25-02-1"]);
  });
  test("questions and marks come from the rows", () => {
    assert.equal(papers[0].questions, 2);
    assert.equal(papers[0].marks, 2 + 1 + 3 + 4);
    assert.equal(papers[1].questions, 1);
    assert.equal(papers[1].marks, 5);
    assert.equal(papers[0].schemes, 3);
    assert.equal(papers[1].schemes, 1);
  });
  test("a part with no printed marks adds none; a paper with none printed has null marks", () => {
    assert.equal(papers[2].marks, 6);
    assert.equal(groupPapers([row("n", "JUN25", "84631H", "01.1", null)], META)[0].marks, null);
  });
  test("an either-or choice counts once in a question, and each question is totalled on its own", () => {
    const rs = [
      row("a", "JUN25", "84631H", "1(a)", 2), row("b", "JUN25", "84631H", "1(b)", 6, { or: 1 }), row("c", "JUN25", "84631H", "1(c)", 6, { or: 1 }),
      row("d", "JUN25", "84631H", "2(a)", 4, { or: 1 }), row("e", "JUN25", "84631H", "2(b)", 4, { or: 1 }),
    ];
    const p = groupPapers(rs, META)[0];
    // question 1: 2 only (the either-or parts are left out while a plain part is there); question 2: only either-or parts, so all count
    assert.equal(p.marks, 2 + 8);
    assert.equal(p.questions, 2);
  });
  test("a paper the bank holds only part of (questions 1 and 4) is a shorter paper, with its own totals, and opens", () => {
    const part = papers[2];
    assert.equal(part.key, "JUN24|84631h");
    assert.equal(part.questions, 2);
    assert.equal(part.marks, 6);
    const { q } = createSet(EMPTY_QUESTIONS, paperSetInput(META, part), 1);
    assert.deepEqual(q.sets[0].parts.map((p) => p.id), ["h24-01-1", "h24-04-1"]);
  });
  test("the bank's title for an option paper comes through", () => {
    const p = groupPapers([row("o", "JUN25", "9hi01a", "01", 20)], META)[0];
    assert.equal(p.title, "The crusades");
    assert.equal(p.name, "Paper 1A");
  });
  test("a paper code in another case is one paper", () => {
    const ps = groupPapers([row("a", "JUN25", "84631H", "1", 1), row("b", "JUN25", "84631h", "2", 1)], META);
    assert.equal(ps.length, 1);
    assert.equal(ps[0].questions, 2);
  });
  test("no rows, no papers", () => assert.deepEqual(groupPapers([], META), []));
});

describe("the shelf", () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ year: String(2025 - Math.floor(i / 4)), i }));
  test("the latest ten, and how many more there are", () => {
    const s = shelfOf(many);
    assert.equal(s.shown.length, 10);
    assert.equal(s.more, 15);
    assert.equal(shelfOf(many.slice(0, 4)).more, 0);
    assert.equal(shelfOf(many, 3).shown[2], many[2]);
  });
  test("years in the order they first appear, with their counts", () => {
    assert.deepEqual(yearsOf(many).slice(0, 3), [{ year: "2025", n: 4 }, { year: "2024", n: 4 }, { year: "2023", n: 4 }]);
    assert.equal(yearsOf(many).reduce((n, y) => n + y.n, 0), 25);
  });
  test("a sitting's label splits into month, year and tag", () => {
    assert.deepEqual(splitSeries("June 2025"), { month: "June", year: "2025", tag: "" });
    assert.deepEqual(splitSeries("June 2025 (R)"), { month: "June", year: "2025", tag: "(R)" });
    assert.deepEqual(splitSeries("Specimen"), { month: "", year: "Specimen", tag: "" });
  });
});

const T0 = 1_700_000_000_000;
function opened(q: QuestionsData = EMPTY_QUESTIONS, at = T0) {
  const papers = groupPapers(ROWS, META);
  const r = createSet(q, paperSetInput(META, papers[0]), at);
  return { papers, ...r };
}

describe("a paper opens as a set, and its progress is remembered", () => {
  test("the set holds every part of the paper in order, named for the sitting, with the paper's key", () => {
    const { q, papers } = opened();
    const set = q.sets[0];
    assert.equal(set.paper, "JUN25|84631h");
    assert.equal(set.name, "June 2025 Paper 1 Higher, AQA GCSE Physics");
    assert.deepEqual(set.parts.map((p) => p.id), papers[0].rows.map((r) => r.id));
    assert.equal(set.names["84631H"], "Paper 1 Higher");
  });
  test("a long paper is kept whole (up to the paper cap); a picked set is still capped lower", () => {
    const rows = Array.from({ length: 73 }, (_, i) => row(`r${i}`, "JUN25", "84631H", `${i + 1}`, 1));
    const p = groupPapers(rows, META)[0];
    const { q } = createSet(EMPTY_QUESTIONS, paperSetInput(META, p), T0);
    assert.equal(q.sets[0].parts.length, 73);
    assert.ok(MAX_PAPER_PARTS > 73 && MAX_PAPER_PARTS > MAX_SET_PARTS);
    const back = sanitiseQuestions(JSON.parse(JSON.stringify(q)));
    assert.equal(back.sets[0].parts.length, 73);
    assert.equal(back.sets[0].paper, "JUN25|84631h");
    const picked = createSet(EMPTY_QUESTIONS, { ...paperSetInput(META, p), paper: undefined }, T0).q;
    assert.equal(picked.sets[0].parts.length, MAX_SET_PARTS);
  });
  test("not started, started, n of m marked, done with the score", () => {
    const { q, id, papers } = opened();
    const key = papers[0].key;
    const st = (d: QuestionsData) => paperState(META.slug, key, d.sets, d.answers);
    assert.equal(paperState(META.slug, key, [], {}).kind, "new");
    assert.equal(st(q).kind, "new");
    assert.equal(stateLine(st(q)), "Not started");
    let d = setText(q, id, "h25-01-1", "kinetic", T0 + 1).q;
    assert.equal(st(d).kind, "started");
    assert.equal(stateLine(st(d)), "Started");
    d = markPart(d, id, "h25-01-1", 2, T0 + 2);
    assert.equal(st(d).kind, "marking");
    assert.equal(stateLine(st(d)), "1 of 4 marked");
    d = markPart(d, id, "h25-01-2", 0, T0 + 3);
    d = finishSet(d, id, T0 + 4);
    const s = st(d);
    assert.equal(s.kind, "done");
    assert.equal(s.got, 2);
    assert.equal(s.total, 3);
    assert.equal(s.pct, 67);
    assert.equal(s.partial, false);   // two of four parts marked is half: the score stands
    assert.equal(stateLine(s), "Done, 2 of 3 marks");
  });
  test("finished with most parts unmarked: said plainly, never as a percent", () => {
    const { q, id, papers } = opened();
    let d = markPart(q, id, "h25-01-1", 2, T0 + 2);
    d = finishSet(d, id, T0 + 4);
    const s = paperState(META.slug, papers[0].key, d.sets, d.answers);
    assert.equal(s.partial, true);   // 1 of 4 parts marked
    assert.equal(stateLine(s), "Done, 1 of 4 marked");
  });
  test("a finished paper with nothing marked is just done", () => {
    const { q, id, papers } = opened();
    const s = paperState(META.slug, papers[0].key, finishSet(q, id, T0 + 1).sets, {});
    assert.equal(s.kind, "done");
    assert.equal(stateLine(s), "Done");
  });
  test("another subject's paper with the same key, or a hand-picked set, is not this paper's progress", () => {
    const { q, papers } = opened();
    assert.equal(paperState("edexcel-gcse-physics", papers[0].key, q.sets, q.answers).kind, "new");
    const picked = createSet(EMPTY_QUESTIONS, { ...paperSetInput(META, papers[0]), paper: undefined }, T0).q;
    assert.equal(paperState(META.slug, papers[0].key, picked.sets, picked.answers).set, undefined);
  });
  test("begun again, the newest set is the one shown; the older one is kept", () => {
    const first = opened(EMPTY_QUESTIONS, T0);
    const again = createSet(finishSet(first.q, first.id, T0 + 1), againInput(first.q.sets[0])!, T0 + 10);
    assert.equal(again.q.sets.length, 2);
    const s = paperState(META.slug, first.papers[0].key, again.q.sets, again.q.answers);
    assert.equal(s.set?.id, again.id);
    assert.equal(s.kind, "new");
    assert.equal(againInput({ ...first.q.sets[0], paper: undefined }), null);
  });
  test("the answers of a paper do not move into a second set of it", () => {
    const first = opened();
    const d = setText(first.q, first.id, "h25-01-1", "mine", T0 + 1).q;
    const again = createSet(d, againInput(d.sets[0])!, T0 + 5);
    assert.equal(again.q.answers[keyOf(again.id, "h25-01-1")], undefined);
    assert.equal(again.q.answers[keyOf(first.id, "h25-01-1")]?.text, "mine");
  });
});

describe("what a card says", () => {
  const p = groupPapers(ROWS, META)[0];
  test("counts, and a name a screen reader can use", () => {
    assert.equal(countsLine(p), "2 questions, 10 marks");
    assert.equal(countsLine({ questions: 1, marks: 1 }), "1 question, 1 mark");
    assert.equal(countsLine({ questions: 3, marks: null }), "3 questions");
    assert.equal(paperAria(p, paperState(META.slug, p.key, [], {})), "June 2025 Paper 1 Higher, 2 questions, 10 marks, not started");
  });
});

// keep the type import honest
void paperKey;
