import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { againInput, createSet, EMPTY_QUESTIONS, finishCheck, finishSet, keyOf, markPart, MAX_PAPER_PARTS, MAX_SET_PARTS, sanitiseQuestions, scoreSet, setText, type QuestionsData } from "./model";
import type { BankRow } from "./picker";
import { countsLine, groupPapers, isChoosePaper, paperAria, paperKey, paperSetInput, paperState, byPaperCode, rowLine, splitSeries, stateLine, yearsOf } from "./papers";
import { paperKeeps, tierLine, tierOf, tiersOf, type SubjectMeta } from "./subject";

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

describe("the papers view", () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ year: String(2025 - Math.floor(i / 4)), i }));
  test("papers group by paper code, in the bank's paper order, each paper's sittings newest first", () => {
    const cards = byPaperCode(groupPapers(ROWS, META));
    assert.deepEqual(cards.map((c) => c.code), ["84631h", "84631f", "zz"]);
    assert.deepEqual(cards[0].sessions.map((p) => p.series), ["June 2025", "June 2024", "Specimen"]);
    assert.equal(cards[0].name, "Paper 1 Higher");
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
    assert.equal(rowLine(st(q)), "Not started");
    let d = setText(q, id, "h25-01-1", "kinetic", T0 + 1).q;
    assert.equal(st(d).kind, "started");
    assert.equal(stateLine(st(d)), "Started");
    d = markPart(d, id, "h25-01-1", 2, T0 + 2);
    assert.equal(st(d).kind, "marking");
    assert.equal(stateLine(st(d)), "Started, 1 of 4");
    assert.equal(rowLine(st(d)), "1 of 4 marked");
    assert.equal(st(d).phase, "started");
    assert.equal(st(d).fraction, 0.25);
    d = markPart(d, id, "h25-01-2", 0, T0 + 3);
    d = markPart(d, id, "h25-01-10", 3, T0 + 3);
    d = markPart(d, id, "h25-02-1", 4, T0 + 3);
    // every part marked: done, even before Finish is pressed
    assert.equal(st(d).phase, "done");
    d = finishSet(d, id, T0 + 4);
    const s = st(d);
    assert.equal(s.kind, "done");
    assert.equal(s.phase, "done");
    assert.equal(s.fraction, 1);
    assert.equal(s.got, 9);
    assert.equal(s.total, 10);
    assert.equal(s.pct, 90);
    assert.equal(stateLine(s), "Done, 9 of 10 marks");
  });
  test("honest: finished with under 80% of the parts marked is not Done (no stamp, no verdict), however the student got there", () => {
    const { q, id, papers } = opened();
    // two of four marked and Finish pressed
    let d = markPart(markPart(q, id, "h25-01-1", 2, T0 + 2), id, "h25-01-2", 1, T0 + 3);
    d = finishSet(d, id, T0 + 4);
    let s = paperState(META.slug, papers[0].key, d.sets, d.answers);
    assert.equal(s.phase, "partial");
    assert.equal(s.fraction, 0.5);
    assert.equal(stateLine(s), "Finished, 2 of 4");
    // one of four
    d = finishSet(markPart(q, id, "h25-01-1", 2, T0 + 2), id, T0 + 4);
    s = paperState(META.slug, papers[0].key, d.sets, d.answers);
    assert.equal(s.phase, "partial");
    assert.equal(s.partial, true);
    assert.equal(stateLine(s), "Finished, 1 of 4");
    // nothing marked at all
    s = paperState(META.slug, papers[0].key, finishSet(q, id, T0 + 1).sets, {});
    assert.equal(s.phase, "partial");
    assert.equal(stateLine(s), "Finished");
    assert.equal(s.kind, "done");   // the old field still says finished
  });
  test("four of five marked (80%) and finished is done", () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(`r${i}`, "JUN25", "84631H", `${i + 1}`, 2));
    const p = groupPapers(rows, META)[0];
    const r = createSet(EMPTY_QUESTIONS, paperSetInput(META, p), T0);
    let d = r.q;
    for (let i = 0; i < 4; i++) d = markPart(d, r.id, `r${i}`, 2, T0 + 1);
    d = finishSet(d, r.id, T0 + 2);
    const s = paperState(META.slug, p.key, d.sets, d.answers);
    assert.equal(s.phase, "done");
    assert.equal(stateLine(s), "Done, 8 of 8 marks");
  });
  test("a paper done once and begun again keeps its best finished attempt on the shelf, and says it is attempt 2", () => {
    const first = opened(EMPTY_QUESTIONS, T0);
    const key = first.papers[0].key;
    let d = first.q;
    for (const [id, g] of [["h25-01-1", 2], ["h25-01-2", 1], ["h25-01-10", 3], ["h25-02-1", 3]] as const) d = markPart(d, first.id, id, g, T0 + 1);
    d = finishSet(d, first.id, T0 + 2);
    const again = createSet(d, againInput(d.sets[0])!, T0 + 10);
    const s = paperState(META.slug, key, again.q.sets, again.q.answers);
    assert.equal(s.phase, "new");
    assert.equal(s.attempt, 2);
    assert.equal(s.attempts, 2);
    assert.deepEqual(s.best, { got: 9, total: 10, pct: 90, done: 4, of: 4 });
    // the first attempt on its own: attempt 1, no best (it is itself the one shown)
    const one = paperState(META.slug, key, d.sets, d.answers);
    assert.equal(one.attempt, 1);
    assert.equal(one.best, null);
    // a retry that is itself done is shown, not the old one
    let e = again.q;
    for (const id of ["h25-01-1", "h25-01-2", "h25-01-10", "h25-02-1"]) e = markPart(e, again.id, id, 1, T0 + 11);
    e = finishSet(e, again.id, T0 + 12);
    const two = paperState(META.slug, key, e.sets, e.answers);
    assert.equal(two.phase, "done");
    assert.equal(two.best, null);
    assert.equal(two.attempt, 2);
  });
  test("a finished attempt that was only partly marked is never offered as the best", () => {
    const first = opened(EMPTY_QUESTIONS, T0);
    const d = finishSet(markPart(first.q, first.id, "h25-01-1", 2, T0 + 1), first.id, T0 + 2);
    const again = createSet(d, againInput(d.sets[0])!, T0 + 10);
    assert.equal(paperState(META.slug, first.papers[0].key, again.q.sets, again.q.answers).best, null);
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

describe("cards that tell the truth about the paper", () => {
  const prow = (id: string, s: string, p: string, l: string, m: number | null, o: Partial<BankRow> = {}) => row(id, s, p, l, m, o);
  /** A paper of `n` questions of `m` marks each. */
  const full = (s: string, p: string, n: number, m: number) => Array.from({ length: n }, (_, i) => prow(`${p}-${s}-${i + 1}`, s, p, String(i + 1), m));
  const META2: SubjectMeta = { ...META, papers: [{ id: "84631H", name: "Paper 1 Higher" }], series: ["JUN25", "JUN24", "JUN23", "JUN22"].map((id) => ({ id, label: id })) };
  test("a paper far short of what that paper usually carries says so", () => {
    const rows = [...full("JUN25", "84631H", 10, 10), ...full("JUN24", "84631H", 10, 10), ...full("JUN23", "84631H", 10, 10), ...full("JUN22", "84631H", 4, 10)];
    const ps = groupPapers(rows, META2);
    assert.deepEqual(ps.map((p) => p.partial), [false, false, false, true]);
    assert.equal(ps[3].note, "Part of this paper");
    assert.equal(ps[0].note, null);
    assert.match(paperAria(ps[3], paperState(META.slug, ps[3].key, [], {})), /part of this paper/);
  });
  test("a lone odd total is not 'usual', and fewer than three sittings say nothing", () => {
    const rows = [...full("JUN25", "84631H", 10, 10), ...full("JUN24", "84631H", 4, 10)];
    assert.ok(groupPapers(rows, META2).every((p) => !p.partial));
  });
  test("a paper where many parts print no marks says so; a stray one does not", () => {
    const some = [...full("JUN25", "84631H", 9, 10), prow("x", "JUN25", "84631H", "10", null)];
    assert.equal(groupPapers(some, META2)[0].partial, true);   // 1 of 10 parts
    const stray = [...full("JUN25", "84631H", 19, 10), prow("x", "JUN25", "84631H", "20", null)];
    assert.equal(groupPapers(stray, META2)[0].partial, false);   // 1 of 20
  });
  test("a paper with a choice of questions shows no absurd total: it says to choose, and it counts only what was chosen", () => {
    // 16 set-text questions of 40 marks, each with an either-or second part: 640 marks added up
    const rows: BankRow[] = [];
    for (let i = 1; i <= 16; i++) { rows.push(prow(`e${i}a`, "JUN25", "84631H", `${i}.1`, 40)); rows.push(prow(`e${i}b`, "JUN25", "84631H", `${i}.2`, 40, { or: 1 })); }
    const p = groupPapers(rows, META2)[0];
    assert.equal(p.choose, true);
    assert.equal(p.marks, null);
    assert.equal(p.note, "Choose from 16 questions");
    assert.equal(countsLine(p), "choose from 16 questions");
    const { q, id } = ((): { q: QuestionsData; id: string } => { const r = createSet(EMPTY_QUESTIONS, paperSetInput(META2, p), T0); return { q: r.q, id: r.id }; })();
    assert.equal(q.sets[0].choose, 1);
    // nothing chosen yet: nothing to mark, nothing skipped
    const empty = paperState(META.slug, p.key, q.sets, q.answers);
    assert.equal(empty.of, 0);
    // she writes on Q1.1 and Q3.1 and marks one: two to mark, one marked
    let d = setText(q, id, "e1a", "x", T0 + 1).q;
    d = setText(d, id, "e3a", "y", T0 + 1).q;
    d = markPart(d, id, "e1a", 30, T0 + 2);
    const s = paperState(META.slug, p.key, d.sets, d.answers);
    assert.deepEqual([s.done, s.of], [1, 2]);
    assert.equal(finishCheck(d.sets[0], d.answers).unmarked, 1);
    assert.equal(scoreSet(d.sets[0], d.answers).skipped.length, 0);
    // after Finish, with the one she wrote on marked: done
    d = finishSet(markPart(d, id, "e3a", 20, T0 + 3), id, T0 + 4);
    const done = paperState(META.slug, p.key, d.sets, d.answers);
    assert.equal(done.phase, "done");
    assert.equal(done.line, "Done, 50 of 80 marks");
    // the choice survives a reload and a second go
    assert.equal(sanitiseQuestions(JSON.parse(JSON.stringify(d))).sets[0].choose, 1);
    assert.equal(createSet(d, againInput(d.sets[0])!, T0 + 9).q.sets[0].choose, 1);
  });
  test("a real long paper is not a choice paper, and 250 marks or more is", () => {
    assert.equal(isChoosePaper(120, 30, 0), false);
    assert.equal(isChoosePaper(249, 30, 0), false);
    assert.equal(isChoosePaper(250, 5, 0), true);
    assert.equal(isChoosePaper(205, 20, 12), true);
    assert.equal(isChoosePaper(205, 20, 2), false);
    assert.equal(isChoosePaper(160, 20, 20), false);
  });
});

describe("the tier a paper is sat at", () => {
  test("from the paper's name as the bank writes it", () => {
    assert.equal(tierOf({ name: "Paper 1 Higher" }), "Higher");
    assert.equal(tierOf({ name: "Biology Paper 2 Foundation" }), "Foundation");
    assert.equal(tierOf({ name: "Paper 1 Higher", title: "Calculator" }), "Higher");
    assert.equal(tierOf({ name: "Paper 3 Theory (Core)" }), "Core");
    assert.equal(tierOf({ name: "Paper 2 Extended", title: "x" }), "Extended");
    assert.equal(tierOf({ name: "Paper 4", title: "Extended" }), "Extended");
    assert.equal(tierOf({ name: "Core Pure 1", title: "9FM0/01" }), null);
    assert.equal(tierOf({ name: "AS Paper 1 Core Cellular Biology and Microbiology" }), null);
    assert.equal(tierOf({ name: "Paper 1 [Foundations in Psychology]".replace(/\[.*/, "") }), null);
    assert.equal(tierOf({ name: "Paper 1" }), null);
  });
  test("a subject has a tier choice only with two or more, at GCSE or IGCSE", () => {
    const hf = [{ id: "a", name: "Paper 1 Higher" }, { id: "b", name: "Paper 1 Foundation" }];
    assert.deepEqual(tiersOf(hf, "GCSE"), ["Higher", "Foundation"]);
    assert.deepEqual(tiersOf([...hf].reverse(), "GCSE"), ["Higher", "Foundation"]);
    assert.deepEqual(tiersOf(hf, "A-Level"), []);
    assert.deepEqual(tiersOf([hf[0], { id: "c", name: "Paper 2" }], "GCSE"), []);
    assert.deepEqual(tiersOf([{ id: "a", name: "Paper 1", title: "Core" }, { id: "b", name: "Paper 2", title: "Extended" }], "IGCSE"), ["Extended", "Core"]);
  });
  test("the papers a chosen tier keeps (a paper with no tier is for both)", () => {
    assert.equal(paperKeeps({ name: "Paper 1 Higher" }, ["Higher"]), true);
    assert.equal(paperKeeps({ name: "Paper 1 Foundation" }, ["Higher"]), false);
    assert.equal(paperKeeps({ name: "Paper 2 Speaking" }, ["Higher"]), true);
    assert.equal(paperKeeps({ name: "Paper 1 Foundation" }, undefined), true);
    assert.equal(paperKeeps({ name: "Paper 1 Foundation" }, []), true);
  });
  test("chosen tiers read as a label, or as nothing when they are all of them", () => {
    assert.equal(tierLine(["Higher"]), "Higher");
    assert.equal(tierLine(undefined), null);
    assert.equal(tierLine(["Higher", "Foundation"], ["Higher", "Foundation"]), null);
  });
  test("groupPapers carries the tier", () => {
    const ps = groupPapers(ROWS, META);
    assert.equal(ps.find((p) => p.key === "JUN25|84631f")?.tier, "Foundation");
    assert.equal(ps.find((p) => p.key === "JUN23|zz")?.tier, null);
  });
});

// keep the type import honest
void paperKey;
