/* eslint-disable prefer-const */
import assert from "node:assert/strict";
import { EMPTY, sanitise } from "../model";
import { describe, test } from "node:test";
import {
  blockScore, blocks, catchUpInput, checkPart, createSet, cutWords, droppedLine, finishCheck, nameOf, partAlt, deleteSet, EMPTY_QUESTIONS, finishSet, inkOfSet, inkTotal, isAnswered, keyOf, markPart, marksOf, answerHint, MAX_PAPER_PARTS, MAX_SET_PARTS, MAX_SETS, openSet, partDots, setTiers, summaryView, ZONE_MCQ_H,
  progress, redoInput, resetPart, sanitiseQuestions, scoreSet, setHeight, setInkMeta, setMode, setText, TEXT_PART_CAP, TEXT_TOTAL_CAP, zoneHeight,
  type QPart, type QuestionsData, type SetInput,
} from "./model";

const part = (id: string, l: string, m: number | null, t: string[], o: Partial<QPart> = {}): QPart => ({ id, p: "84631H", s: "JUN25", l, m, t, w: 1086, h: 300, ...o });
const PARTS = [
  part("q1a", "01.1", 2, ["4.1.1"], { st: 1, ms: 1 }),
  part("q1b", "01.2", 1, ["4.1.2"], { ms: 1 }),
  part("q1c", "01.3", 3, ["4.1.1"], { ms: 1 }),
  part("q2a", "02.1", 4, ["4.3.1"], { ms: 1 }),
  part("q3a", "03.1", null, ["4.3.1"]),
];
const INPUT: SetInput = { subject: "aqa-gcse-physics", title: "AQA GCSE Physics", names: { "84631H": "Paper 1 Higher", JUN25: "June 2025" }, topics: { "4.1.1": "Energy stores", "4.1.2": "Conservation", "4.3.1": "Particles" }, parts: PARTS };
const T0 = 1_700_000_000_000;
const make = (q: QuestionsData = EMPTY_QUESTIONS, input: SetInput = INPUT) => createSet(q, input, T0);

describe("making a set", () => {
  test("groups parts into questions in the order chosen, parts in printed order", () => {
    const shuffled = [PARTS[3], PARTS[2], PARTS[0], PARTS[4], PARTS[1]];
    const { q, id } = make(EMPTY_QUESTIONS, { ...INPUT, parts: shuffled });
    const set = q.sets[0];
    assert.equal(set.id, id);
    assert.equal(q.open, id);
    assert.deepEqual(set.parts.map((p) => p.id), ["q2a", "q1a", "q1b", "q1c", "q3a"]);
    const bs = blocks(set.parts);
    assert.deepEqual(bs.map((b) => [b.n, b.parts.length, b.marks]), [[1, 1, 4], [2, 3, 6], [3, 1, null]]);
    assert.equal(bs[1].stem?.id, "q1a");
    assert.equal(bs[0].stem, null);
  });
  test("a part is in a set once, a set holds at most 60, and the name says what it is", () => {
    const dup = make(EMPTY_QUESTIONS, { ...INPUT, parts: [PARTS[0], PARTS[0], PARTS[1]] });
    assert.equal(dup.q.sets[0].parts.length, 2);
    assert.equal(dup.q.sets[0].name, "AQA GCSE Physics, 1 question");
    const many = Array.from({ length: 90 }, (_, i) => part(`x${i}`, `${i + 1}.1`, 1, []));
    assert.equal(make(EMPTY_QUESTIONS, { ...INPUT, parts: many }).q.sets[0].parts.length, MAX_SET_PARTS);
  });
  test("keeps the newest 40 sets, dropping a finished one first, and its answers go with it", () => {
    let q = EMPTY_QUESTIONS;
    const ids: string[] = [];
    for (let i = 0; i < MAX_SETS; i++) { const r = createSet(q, { ...INPUT, parts: [part(`s${i}`, "1.1", 1, [])] }, T0 + i); q = r.q; ids.push(r.id); }
    q = finishSet(q, ids[10], T0 + 99);
    q = markPart(q, ids[10], "s10", 1, T0 + 100);
    q = markPart(q, ids[0], "s0", 1, T0 + 100);
    const r = createSet(q, { ...INPUT, parts: [part("fresh", "1.1", 1, [])] }, T0 + 200);
    assert.equal(r.q.sets.length, MAX_SETS);
    assert.deepEqual(r.dropped, [ids[10]]);
    assert.equal(r.q.answers[keyOf(ids[10], "s10")], undefined);
    assert.ok(r.q.answers[keyOf(ids[0], "s0")]);
    const r2 = createSet(r.q, { ...INPUT, parts: [part("fresh2", "1.1", 1, [])] }, T0 + 300);
    assert.deepEqual(r2.dropped, [ids[0]]);
  });
  test("a set pushed out is never silent: the line the page shows for it is calm, plain and has no dash", () => {
    assert.equal(droppedLine(1), "An old set was removed to make room.");
    assert.equal(droppedLine(3), "3 old sets were removed to make room.");
    assert.ok(!/\u2014|\u2013/.test(droppedLine(1) + droppedLine(2)));
  });
});

describe("marks of a question", () => {
  test("EITHER ... OR counts once, and nothing printed is null", () => {
    assert.equal(marksOf([part("a", "1(a)", 3, []), part("b", "1(b)", 9, [], { or: 1 }), part("c", "1(c)", 9, [], { or: 1 })]), 3);
    assert.equal(marksOf([part("b", "1(b)", 9, [], { or: 1 }), part("c", "1(c)", 9, [], { or: 1 })]), 18);
    assert.equal(marksOf([part("a", "1", null, [])]), null);
  });
});

describe("self-marking", () => {
  const setup = () => { const r = make(); return { q: r.q, id: r.id }; };
  test("marks are the student's own, clamped to the marks there are", () => {
    let { q, id } = setup();
    q = markPart(q, id, "q1a", 2, T0);
    q = markPart(q, id, "q1b", 5, T0);
    q = markPart(q, id, "q1c", -3, T0);
    assert.equal(q.answers[keyOf(id, "q1a")].got, 2);
    assert.equal(q.answers[keyOf(id, "q1b")].got, 1);
    assert.equal(q.answers[keyOf(id, "q1c")].got, 0);
    q = markPart(q, id, "q1c", null, T0);
    assert.equal(q.answers[keyOf(id, "q1c")].got, undefined);
  });
  test("a part with no printed marks cannot be marked", () => {
    const { q, id } = setup();
    assert.equal(markPart(q, id, "q3a", 1, T0), q);
  });
  test("nothing is awarded on its own, and nothing unmarked is a zero: no marks given, no score", () => {
    const { q } = setup();
    const s = scoreSet(q.sets[0], q.answers);
    assert.deepEqual([s.got, s.total, s.pct, s.marked, s.printed, s.markable], [0, 0, null, 0, 10, 4]);
    assert.equal(s.unmarked.length, 4);   // the part with no printed marks has nothing to mark
    assert.deepEqual(s.perTopic, []);
  });
  test("only the parts marked are scored: 2 of 2 marked, two never marked, is 2/2 and 100%, not 2/10", () => {
    let { q, id } = setup();
    q = markPart(q, id, "q1a", 2, T0);
    q = setText(q, id, "q2a", "typed, never marked", T0).q;
    const s = scoreSet(q.sets[0], q.answers);
    assert.deepEqual([s.got, s.total, s.pct, s.marked, s.printed], [2, 2, 100, 1, 10]);
    assert.deepEqual(s.perTopic.map((t) => [t.code, t.got, t.total]), [["4.1.1", 2, 2]]);   // 4.3.1 was not marked: not a topic at 0
    assert.deepEqual(s.dropped, []);
    assert.deepEqual(s.skipped.map((p) => p.id), ["q1b", "q1c", "q3a"]);   // not q2a: it was answered, only not marked
  });
  test("a skipped part is skipped, and a catch-up set holds exactly those, with no answers carried over", () => {
    let { q, id } = setup();
    q = markPart(q, id, "q1a", 1, T0);
    q = setText(q, id, "q1b", "x", T0).q;
    const s = scoreSet(q.sets[0], q.answers);
    assert.deepEqual(s.skipped.map((p) => p.id).sort(), ["q1c", "q2a", "q3a"]);
    const input = catchUpInput(q.sets[0], q.answers)!;
    assert.deepEqual(input.parts.map((p) => p.id).sort(), ["q1c", "q2a", "q3a"]);
    assert.equal(input.redoOf, id);
    assert.match(input.name!, /^Skipped: /);
    const r = createSet(q, input, T0 + 5);
    assert.equal(Object.keys(r.q.answers).filter((k) => k.startsWith(r.id)).length, 0);
    q = markPart(markPart(markPart(q, id, "q1c", 0, T0), id, "q2a", 0, T0), id, "q3a", null, T0);
    assert.equal(catchUpInput(q.sets[0], q.answers)!.parts.map((p) => p.id).join(), "q3a");   // a part with no marks stays skipped until something is written
  });
  test("before finishing: how many are not marked, and how many of those are blank", () => {
    let { q, id } = setup();
    assert.deepEqual(finishCheck(q.sets[0], q.answers), { unmarked: 4, blank: 4 });
    q = setText(q, id, "q1b", "x", T0).q;
    q = markPart(q, id, "q1a", 2, T0);
    assert.deepEqual(finishCheck(q.sets[0], q.answers), { unmarked: 3, blank: 2 });
    for (const p of ["q1b", "q1c", "q2a"]) q = markPart(q, id, p, 0, T0);
    assert.deepEqual(finishCheck(q.sets[0], q.answers), { unmarked: 0, blank: 0 });
  });
  test("totals, percent, per topic, dropped and skipped", () => {
    let { q, id } = setup();
    const set = q.sets[0];
    // question order in the set: 01 (q1a,b,c) then 02 then 03
    q = markPart(q, id, "q1a", 2, T0);   // full
    q = markPart(q, id, "q1b", 0, T0);   // dropped
    q = markPart(q, id, "q1c", 2, T0);   // dropped (of 3)
    q = setText(q, id, "q2a", "kinetic", T0).q;   // answered, not marked
    const s = scoreSet(set, q.answers);
    assert.equal(s.got, 4);
    assert.equal(s.total, 6);   // the marks printed on the three parts marked
    assert.equal(s.printed, 10);
    assert.equal(s.pct, 67);
    assert.deepEqual(s.dropped.map((p) => p.id), ["q1b", "q1c"]);
    assert.deepEqual(s.skipped.map((p) => p.id), ["q3a"]);
    assert.equal(s.marked, 3);
    const t = Object.fromEntries(s.perTopic.map((x) => [x.code, [x.got, x.total, x.title]]));
    assert.deepEqual(t["4.1.1"], [4, 5, "Energy stores"]);
    assert.deepEqual(t["4.1.2"], [0, 1, "Conservation"]);
    assert.equal(t["4.3.1"], undefined);   // nothing marked in it
    const b = blocks(set.parts)[0];
    assert.deepEqual(blockScore(set, b, q.answers), { got: 4, total: 6, marked: 3 });
    assert.deepEqual(progress(set, q.answers), { done: 3, of: 4 });   // the part with no marks is not one to mark
  });
  test("a part marked with nothing written is not skipped; a written one is not skipped unmarked", () => {
    let { q, id } = setup();
    q = markPart(q, id, "q2a", 0, T0);
    assert.ok(!scoreSet(q.sets[0], q.answers).skipped.some((p) => p.id === "q2a"));
  });
  test("redo: only the parts that dropped marks, in a new set with no answers", () => {
    let { q, id } = setup();
    q = markPart(q, id, "q1a", 2, T0);
    q = markPart(q, id, "q1b", 0, T0);
    q = setText(q, id, "q1b", "my try", T0).q;
    const input = redoInput(q.sets[0], q.answers)!;
    assert.deepEqual(input.parts.map((p) => p.id), ["q1b"]);
    assert.equal(input.redoOf, id);
    const r = createSet(q, input, T0 + 5);
    assert.equal(r.q.sets[0].redoOf, id);
    assert.equal(r.q.answers[keyOf(r.id, "q1b")], undefined);
    // all marks gained: nothing to redo
    q = markPart(q, id, "q1b", 1, T0);
    assert.equal(redoInput(q.sets[0], q.answers), null);
  });
  test("finishing a set notes the parts done, so a mix avoids them", () => {
    let { q, id } = setup();
    q = setText(q, id, "q2a", "x", T0).q;
    q = markPart(q, id, "q1a", 1, T0);
    q = finishSet(q, id, T0 + 10);
    assert.equal(q.sets[0].finishedAt, T0 + 10);
    assert.deepEqual(q.recent.map((r) => r.id).sort(), ["q1a", "q2a"]);
  });
});

describe("answers", () => {
  test("zone height: 90 a mark, at least 140, bigger if the student made it so", () => {
    assert.equal(zoneHeight({ m: 1 }), 140);
    assert.equal(zoneHeight({ m: 4 }), 360);
    assert.equal(zoneHeight({ m: null }), 140);
    assert.equal(zoneHeight({ m: 2 }, { at: 0, h: 500 }), 500);
    assert.equal(zoneHeight({ m: 6 }, { at: 0, h: 200 }), 540);
  });
  test("ink, type and mode are remembered separately; both can hold content", () => {
    let { q, id } = make();
    q = setMode(q, id, "q1a", "type", T0);
    q = setText(q, id, "q1a", "kinetic energy", T0).q;
    q = setInkMeta(q, id, "q1a", 12, 3400, T0);
    const a = q.answers[keyOf(id, "q1a")];
    assert.deepEqual([a.mode, a.text, a.ink], ["type", "kinetic energy", { n: 12, b: 3400 }]);
    assert.ok(isAnswered(a));
    q = setInkMeta(q, id, "q1a", 0, 0, T0);
    assert.equal(q.answers[keyOf(id, "q1a")].ink, undefined);
  });
  test("reset clears the writing and the mark, not the zone's size or mode", () => {
    let { q, id } = make();
    q = setMode(q, id, "q1a", "ink", T0);
    q = setHeight(q, id, "q1a", 600, T0);
    q = setText(q, id, "q1a", "abc", T0).q;
    q = setInkMeta(q, id, "q1a", 3, 100, T0);
    q = markPart(q, id, "q1a", 2, T0);
    q = checkPart(q, id, "q1a", T0);
    q = resetPart(q, id, "q1a", T0);
    const a = q.answers[keyOf(id, "q1a")];
    assert.deepEqual([a.mode, a.h, a.text, a.ink, a.got, a.chk], ["ink", 600, undefined, undefined, undefined, undefined]);
  });
  test("typed answers are capped per part and across the device, and say so", () => {
    let { q, id } = make();
    const long = "x".repeat(TEXT_PART_CAP + 500);
    const r = setText(q, id, "q1a", long, T0);
    assert.equal(r.q.answers[keyOf(id, "q1a")].text!.length, TEXT_PART_CAP);
    assert.equal(r.ok, false);
    // fill the device: other sets' answers
    q = r.q;
    const full: QuestionsData = { ...q, answers: { ...q.answers, [keyOf(id, "q1b")]: { at: 0, text: "y".repeat(TEXT_TOTAL_CAP - TEXT_PART_CAP) } } };
    const over = setText(full, id, "q1c", "more", T0);
    assert.equal(over.ok, false);
    assert.equal(over.q.answers[keyOf(id, "q1c")], undefined);
    // editing what is there (shorter) still works when full
    assert.equal(setText(full, id, "q1a", "short", T0).ok, true);
  });
  test("ink totals per set and overall", () => {
    let { q, id } = make();
    q = setInkMeta(q, id, "q1a", 2, 1000, T0);
    q = setInkMeta(q, id, "q2a", 2, 500, T0);
    assert.equal(inkOfSet(q, id), 1500);
    assert.equal(inkTotal(q), 1500);
  });
  test("a deleted set takes its answers and its place on the desk with it", () => {
    let { q, id } = make();
    q = setText(q, id, "q1a", "abc", T0).q;
    assert.equal(q.open, id);
    q = deleteSet(q, id);
    assert.deepEqual([q.sets.length, Object.keys(q.answers).length, q.open], [0, 0, null]);
    const m = make();
    assert.equal(openSet(m.q, "nope").open, m.id);
    assert.equal(openSet(m.q, null).open, null);
  });
});

describe("reading storage", () => {
  test("a good document survives a JSON round trip unchanged", () => {
    let { q, id } = make();
    q = setText(q, id, "q1a", "abc", T0).q;
    q = markPart(q, id, "q1a", 2, T0);
    q = setInkMeta(q, id, "q2a", 4, 900, T0);
    const stored = JSON.parse(JSON.stringify(q));
    assert.deepEqual(JSON.parse(JSON.stringify(sanitiseQuestions(stored))), stored);
  });
  test("rubbish becomes empty, and nothing throws", () => {
    for (const bad of [null, undefined, 5, "x", [], { sets: 4 }, { sets: [null, 3, {}], answers: [] }]) {
      const s = sanitiseQuestions(bad);
      assert.deepEqual([s.sets.length, Object.keys(s.answers).length, s.open], [0, 0, null]);
    }
  });
  test("answers for a set or part that is not there are dropped; marks are clamped to the part's marks", () => {
    const { q, id } = make();
    const raw = JSON.parse(JSON.stringify(q));
    raw.answers = {
      [keyOf(id, "q1a")]: { at: 1, got: 99, mode: "ink", text: 5 },
      [keyOf(id, "nope")]: { at: 1, text: "ghost" },
      [keyOf("qs_gone", "q1a")]: { at: 1, text: "ghost" },
      [keyOf(id, "q3a")]: { at: 1, got: 1 },     // no marks printed: no mark
      [keyOf(id, "q1b")]: { at: 1, text: "ok", ink: { n: -4, b: 1 }, h: 99999, mode: "weird" },
    };
    const s = sanitiseQuestions(raw);
    assert.deepEqual(Object.keys(s.answers).sort(), [keyOf(id, "q1a"), keyOf(id, "q1b"), keyOf(id, "q3a")].sort());
    assert.equal(s.answers[keyOf(id, "q1a")].got, 2);
    assert.equal(s.answers[keyOf(id, "q1a")].text, undefined);
    assert.equal(s.answers[keyOf(id, "q3a")].got, undefined);
    assert.equal(s.answers[keyOf(id, "q1b")].ink, undefined);
    assert.equal(s.answers[keyOf(id, "q1b")].h, 2400);
    assert.equal(s.answers[keyOf(id, "q1b")].mode, undefined);
  });
  test("caps hold on load: sets, parts per set, typed characters", () => {
    const { q } = make();
    const raw = JSON.parse(JSON.stringify(q));
    raw.sets = Array.from({ length: 60 }, (_, i) => ({ ...raw.sets[0], id: `qs_${i}`, parts: Array.from({ length: 100 }, (_, j) => ({ ...raw.sets[0].parts[0], id: `p${j}` })) }));
    raw.answers = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [keyOf("qs_0", `p${i}`), { at: 1, text: "z".repeat(TEXT_PART_CAP) }]));
    const s = sanitiseQuestions(raw);
    assert.equal(s.sets.length, MAX_SETS);
    assert.equal(s.sets[0].parts.length, MAX_SET_PARTS);
    assert.ok(Object.values(s.answers).reduce((n, a) => n + (a.text?.length ?? 0), 0) <= TEXT_TOTAL_CAP);
  });
  test("a set that points at nothing, and a bad open id, are tidied", () => {
    const { q } = make();
    const raw = JSON.parse(JSON.stringify(q));
    raw.open = "qs_other";
    raw.sets[0].at = 99;
    raw.sets.push({ id: "qs_empty", subject: "x", parts: [] });
    const s = sanitiseQuestions(raw);
    assert.equal(s.open, null);
    assert.equal(s.sets.length, 1);
    assert.equal(s.sets[0].at, 2);   // 3 questions: the last index
  });
  test("preferences: unknown values fall back, valid ones stay", () => {
    const s = sanitiseQuestions({ prefs: { bg: "tartan", tool: "laser", colour: 9, width: -1, fingerScrolls: false, hand: "yes", keys: "no", alwaysType: 1, typeSize: "huge" } });
    assert.deepEqual(s.prefs, { bg: "plain", tool: "pen", colour: 2, width: 0, fingerScrolls: false });
    const t = sanitiseQuestions({ prefs: { keys: false, alwaysType: true, typeSize: "large" } });
    assert.deepEqual([t.prefs.keys, t.prefs.alwaysType, t.prefs.typeSize], [false, true, "large"]);
  });
});

describe("in the app's one document", () => {
  test("a save from before Questions existed reads as no sets, and nothing else changes", () => {
    const old = JSON.parse(JSON.stringify(EMPTY));
    delete old.questions;
    const d = sanitise(old);
    assert.equal(d.v, 1);
    assert.deepEqual(d.questions.sets, []);
    assert.equal(d.questions.open, null);
  });
  test("Questions rides along: sets and answers survive the document's own sanitiser", () => {
    let { q, id } = make();
    q = setText(q, id, "q1a", "kinetic", T0).q;
    q = markPart(q, id, "q1a", 2, T0);
    const d = sanitise(JSON.parse(JSON.stringify({ ...EMPTY, questions: q })));
    assert.equal(d.questions.sets.length, 1);
    assert.equal(d.questions.answers[keyOf(id, "q1a")].got, 2);
    assert.equal(d.questions.answers[keyOf(id, "q1a")].text, "kinetic");
  });
  test("a damaged questions field costs only the questions", () => {
    const d = sanitise({ ...JSON.parse(JSON.stringify(EMPTY)), tasks: [], questions: { sets: "no" } });
    assert.deepEqual(d.questions.sets, []);
    assert.equal(d.v, 1);
  });
});

describe("words for the picture", () => {
  test("a part's alt text never cuts a word and never passes a cut off as the whole question", () => {
    const x = "Describe the difference between renewable energy resources and non-renewable energy resources. [2 marks] Figure 1 shows a new design of tidal turbine to generat";
    const alt = partAlt({ l: "01.1", m: 2, x });
    assert.match(alt, /^Question 01\.1 \(2 marks\)\. It starts: Describe the difference/);
    assert.match(alt, /That is only the start\. Open Read as text/);
    assert.ok(!/generat\b/.test(alt), alt);
    const quoted = alt.match(/It starts: (.*?)\u2026/)![1];
    assert.ok(x.startsWith(quoted.trimEnd()), "the quoted words are the real opening, ending on a whole word");
    assert.ok(/\s/.test(x[quoted.trimEnd().length]) , "the next character in the source is a space: no word was cut");
  });
  test("a short question that ends on its own marks is given whole; one with nothing is pointed to the text", () => {
    assert.equal(partAlt({ l: "3(b)", m: 1, x: "Name the unit of power. [1 mark]" }), "Question 3(b) (1 mark): Name the unit of power. [1 mark]");
    assert.match(partAlt({ l: "4", m: null, x: "" }), /^Question 4\. A picture of the question\. Open Read as text/);
  });
  test("cutWords stops on a word and says it cut", () => {
    assert.deepEqual(cutWords("one two three", 20), { text: "one two three", cut: false });
    assert.deepEqual(cutWords("alpha beta gamma delta", 12), { text: "alpha beta\u2026", cut: true });
    assert.equal(cutWords("supercalifragilistic", 8).text, "supercal\u2026");
  });
  test("a name from a set's table is only ever the set's own", () => {
    assert.equal(nameOf({ JUN25: "June 2025" }, "JUN25"), "June 2025");
    assert.equal(nameOf({}, "constructor"), undefined);
    assert.equal(nameOf({}, "__proto__"), undefined);
  });
});

describe("round 3: long papers, tiers, multiple choice", () => {
  const many = (n: number): QPart[] => Array.from({ length: n }, (_, i) => part(`p${i}`, String(i + 1), 1, ["4.1.1"], { ms: 1 }));
  test("Redo and Do the skipped ones keep every part of a long paper (not the picked-set cap)", () => {
    const all = many(73);
    const base = createSet(EMPTY_QUESTIONS, { ...INPUT, parts: all, paper: "JUN25|84631h", name: "Paper" }, T0);
    assert.equal(base.q.sets[0].parts.length, 73);
    // nothing written: every part is skipped
    const skip = catchUpInput(base.q.sets[0], base.q.answers)!;
    assert.equal(skip.parts.length, 73);
    const made = createSet(base.q, skip, T0 + 1);
    assert.equal(made.q.sets[0].parts.length, 73);   // before: cut to 60
    const back = sanitiseQuestions(JSON.parse(JSON.stringify(made.q)));
    assert.equal(back.sets[0].parts.length, 73);     // and kept on reload
    // and every part dropped marks on
    let d = base.q;
    for (const p of all) d = markPart(d, base.id, p.id, 0, T0 + 2);
    const redo = redoInput(d.sets[0], d.answers)!;
    assert.equal(redo.parts.length, 73);
    assert.equal(createSet(d, redo, T0 + 3).q.sets[0].parts.length, 73);
    assert.ok(MAX_PAPER_PARTS >= 73);
  });
  test("a picked set stays capped", () => {
    assert.equal(createSet(EMPTY_QUESTIONS, { ...INPUT, parts: many(90) }, T0).q.sets[0].parts.length, MAX_SET_PARTS);
  });
  test("a multiple-choice part is a short strip; a bigger one the student made is respected", () => {
    assert.equal(zoneHeight({ m: 1, k: "B" }), ZONE_MCQ_H);
    assert.ok(ZONE_MCQ_H < 140);
    assert.equal(zoneHeight({ m: 1 }), 140);
    assert.equal(zoneHeight({ m: 1, k: "B" }, { at: 0, h: 300 }), 300);
    assert.equal(zoneHeight({ m: 4 }), 360);
  });
  test("the tier chosen in a subject is kept, and choosing every tier is the same as nothing", () => {
    let q = setTiers(EMPTY_QUESTIONS, "aqa-gcse-maths", ["Higher"], ["Higher", "Foundation"]);
    assert.deepEqual(q.tiers, { "aqa-gcse-maths": ["Higher"] });
    assert.equal(setTiers(q, "aqa-gcse-maths", ["Higher"], ["Higher", "Foundation"]), q);   // unchanged: the same object
    q = setTiers(q, "aqa-gcse-physics", ["Foundation"], ["Higher", "Foundation"]);
    assert.deepEqual(Object.keys(q.tiers ?? {}), ["aqa-gcse-maths", "aqa-gcse-physics"]);
    q = setTiers(q, "aqa-gcse-maths", ["Higher", "Foundation"], ["Higher", "Foundation"]);
    assert.deepEqual(q.tiers, { "aqa-gcse-physics": ["Foundation"] });
    q = setTiers(q, "aqa-gcse-physics", [], ["Higher", "Foundation"]);
    assert.equal("tiers" in q, false);
  });
  test("tiers survive storage, and junk in them does not", () => {
    const q = setTiers(EMPTY_QUESTIONS, "aqa-gcse-maths", ["Higher"]);
    assert.deepEqual(sanitiseQuestions(JSON.parse(JSON.stringify(q))).tiers, { "aqa-gcse-maths": ["Higher"] });
    const junk = sanitiseQuestions({ ...q, tiers: { a: "Higher", b: [1, null, "Foundation"], c: [], d: ["x".repeat(99)] } });
    assert.deepEqual(junk.tiers, { b: ["Foundation"], d: ["x".repeat(20)] });
    assert.equal(sanitiseQuestions({ tiers: [1] }).tiers, undefined);
  });
  test("a paper chosen from: untouched alternatives are neither unmarked nor skipped, and Finish does not ask about them", () => {
    const parts = [part("a", "1", 10, []), part("b", "2", 10, []), part("c", "3", 10, [])];
    const r = createSet(EMPTY_QUESTIONS, { ...INPUT, parts, paper: "k", choose: 1 }, T0);
    const set = r.q.sets[0];
    assert.deepEqual(progress(set, r.q.answers), { done: 0, of: 0 });
    let d = setText(r.q, r.id, "b", "essay", T0 + 1).q;
    assert.deepEqual(progress(d.sets[0], d.answers), { done: 0, of: 1 });
    assert.deepEqual(finishCheck(d.sets[0], d.answers), { unmarked: 1, blank: 0 });
    d = markPart(d, r.id, "b", 7, T0 + 2);
    assert.deepEqual(finishCheck(d.sets[0], d.answers), { unmarked: 0, blank: 0 });
    const sc = scoreSet(d.sets[0], d.answers);
    assert.deepEqual([sc.got, sc.total, sc.marked, sc.markable, sc.skipped.length, sc.unmarked.length], [7, 10, 1, 1, 0, 0]);
    // an ordinary set still counts every part
    const plain = createSet(EMPTY_QUESTIONS, { ...INPUT, parts, paper: "k" }, T0);
    assert.deepEqual(progress(plain.q.sets[0], plain.q.answers), { done: 0, of: 3 });
    assert.equal(finishCheck(plain.q.sets[0], plain.q.answers).unmarked, 3);
  });
});

describe("the end of a set is honest about how much was done", () => {
  const sc = (marked: number, markable: number, got: number, total: number) => ({ marked, markable, total, pct: total > 0 ? Math.round((got / total) * 100) : null });
  test("3 of 25 marked: leads with coverage, no score, encouraging, no celebration", () => {
    const v = summaryView(sc(3, 25, 3, 3));
    assert.equal(v.title, "3 of 25 marked");
    assert.equal(v.showScore, false);
    assert.equal(v.mascot, "plumi-encouraging");
    assert.equal(v.tone, "");
  });
  test("a perfect score on a few parts is still not celebrated", () => {
    const v = summaryView(sc(5, 25, 20, 20));
    assert.equal(v.showScore, false);
    assert.notEqual(v.mascot, "plumi-celebrating");
  });
  test("under half marked has a calm mascot and no score; half marked shows the score small", () => {
    assert.equal(summaryView(sc(8, 25, 8, 8)).mascot, "plumi-lofi-cozy");
    const half = summaryView(sc(13, 25, 10, 13));
    assert.equal(half.showScore, true);
    assert.equal(half.title, "13 of 25 marked");
    assert.equal(half.mascot, "plumi-proud");
    assert.notEqual(half.mascot, "plumi-celebrating");
  });
  test("celebrating needs most parts marked and a good score; most marked reads as Set done", () => {
    const v = summaryView(sc(22, 25, 40, 44));
    assert.deepEqual([v.title, v.showScore, v.mascot, v.tone], ["Set done", true, "plumi-celebrating", "full"]);
    assert.equal(summaryView(sc(22, 25, 10, 44)).mascot, "plumi-encouraging");
  });
  test("nothing marked says so once, and a set with no printed marks is just done", () => {
    assert.equal(summaryView(sc(0, 12, 0, 0)).title, "Nothing marked yet");
    assert.equal(summaryView(sc(0, 12, 0, 0)).showScore, false);
    assert.equal(summaryView(sc(0, 0, 0, 0)).title, "Set done");
  });
  test("one dot per part, grouped by question, with its state", () => {
    const parts = [part("a", "1", 2, []), part("b", "2", 2, []), part("c", "3", 2, [])];
    const r = createSet(EMPTY_QUESTIONS, { ...INPUT, parts }, T0);
    let d = setText(r.q, r.id, "b", "x", T0 + 1).q;
    d = markPart(d, r.id, "a", 2, T0 + 2);
    const dots = partDots(d.sets[0], d.answers);
    assert.deepEqual(dots.map((x) => [x.part.id, x.question, x.state, x.tone]), [["a", 1, "marked", "full"], ["b", 2, "written", ""], ["c", 3, "blank", ""]]);
    const ch = partDots({ ...d.sets[0], choose: 1 }, d.answers);
    assert.equal(ch[2].state, "unchosen");
  });
  test("finishing twice (a double tap) changes nothing", () => {
    const r = createSet(EMPTY_QUESTIONS, INPUT, T0);
    const once = finishSet(r.q, r.id, T0 + 1);
    assert.equal(finishSet(once, r.id, T0 + 2), once);
    assert.equal(once.sets[0].finishedAt, T0 + 1);
  });
});

describe("what an empty answer space can say", () => {
  test("a table to fill in, something to draw, something to label; prose and multiple choice say nothing", () => {
    assert.equal(answerHint({ x: "Complete the table below. Particle Mass Charge" }), "Write the numbers here");
    assert.equal(answerHint({ x: "(a) Fill in the table to show the number of protons" }), "Write the numbers here");
    assert.equal(answerHint({ x: "Draw a line of best fit on the graph." }), "Draw it here");
    assert.equal(answerHint({ x: "Label the diagram using words from the box." }), "Write the labels here");
    assert.equal(answerHint({ x: "Explain why the car slows down." }), null);
    assert.equal(answerHint({ x: "Which is the table? Draw", k: "B" }), null);
    assert.equal(answerHint({ x: "" }), null);
  });
});
