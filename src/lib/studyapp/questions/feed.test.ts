import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { deadListening, wholeRecordingNote, hasFeedAnswer, otherCopy, bestState, bandsFor, labelKey, calcWords, cleanFeedFilters, elsewhere, feedActive, feedFilter, feedList, feedMatches, feedOrders, feedProgress, hasCalcChoice, hashSeed, markedIds, mixRows, NO_FEED, practiseRows, progressLine, qStateLine, stateOf, toggleIn, toggleYear, yearGroups, yearState, type FeedFilters, type QState } from "./feed";
import { compareLabels, EMPTY_QUESTIONS, feedId, feedTouch, markPart, MAX_SET_PARTS, setText, type QPart, type QuestionsData } from "./model";
import { sortRows, type BankRow } from "./picker";

const row = (id: string, o: Partial<BankRow> = {}): BankRow => ({ id, p: "84631H", s: "JUN25", l: "01.1", m: 2, t: ["4.1.1"], w: 1086, h: 400, x: "Describe the difference", ...o });
const FIX: BankRow[] = [
  row("a-01-1", { l: "01.1", m: 1, t: ["4.1.1"], ms: 1 }),
  row("a-01-2", { l: "01.2", m: 2, t: ["4.1.2"], calc: 1 }),
  row("a-01-3", { l: "01.3", m: 4, t: ["4.3.1"], ms: 1, x: "Calculate the volume of seawater" }),
  row("a-02-1", { l: "02.1", m: 6, t: ["4.1.1"], ms: 1 }),
  row("b-01-1", { p: "84632F", s: "JUN24", l: "01.1", m: 4, t: ["4.2.1"], k: "B", calc: 1 }),
  row("c-01-1", { s: "NOV21", l: "01.1", m: null, t: ["4.2.1"] }),
  row("c-01-9", { s: "NOV21", l: "01.10", m: 9, t: [] }),
  row("c-02-1", { s: "NOV21", l: "02.1", m: 12, t: ["4.1.1"] }),
];
const SERIES = [{ id: "JUN25", label: "June 2025" }, { id: "JUN24", label: "June 2024" }, { id: "NOV21", label: "November 2021" }];
const BANDS = bandsFor("Physics", FIX);
const ctx = { bands: BANDS };
const f = (o: Partial<FeedFilters>): FeedFilters => ({ ...NO_FEED, ...o });
const ids = (rs: readonly BankRow[]) => rs.map((r) => r.id);

describe("question types", () => {
  test("a science's marks make four bands, and a band names the marks it holds", () => {
    assert.deepEqual(BANDS.map((b) => b.label), ["1\u20132 marks", "4 marks", "6\u20139 marks", "12 marks"]);
  });
  test("a chosen type keeps its marks, both ends, and leaves out a part that prints none", () => {
    const [small, , six] = BANDS.map((b) => b.id);
    assert.deepEqual(ids(feedFilter(FIX, f({ types: [small] }), ctx)), ["a-01-1", "a-01-2"]);
    assert.deepEqual(ids(feedFilter(FIX, f({ types: [six] }), ctx)), ["a-02-1", "c-01-9"]);
    assert.equal(feedMatches(FIX.find((r) => r.id === "c-01-1")!, f({ types: BANDS.map((b) => b.id) }), ctx), false);
  });
  test("two types are either", () => {
    const a = BANDS[0].id, b = BANDS[BANDS.length - 1].id;
    assert.deepEqual(ids(feedFilter(FIX, f({ types: [a, b] }), ctx)), ["a-01-1", "a-01-2", "c-02-1"]);
  });
});

describe("the other filters", () => {
  test("papers are several at once, case-insensitive", () => {
    assert.deepEqual(ids(feedFilter(FIX, f({ papers: ["84632f"] }), ctx)), ["b-01-1"]);
    assert.equal(feedFilter(FIX, f({ papers: ["84632f", "84631h"] }), ctx).length, FIX.length);
  });
  test("exam sittings are several at once", () => {
    assert.deepEqual(ids(feedFilter(FIX, f({ series: ["JUN24", "JUN25"] }), ctx)), ["a-01-1", "a-01-2", "a-01-3", "a-02-1", "b-01-1"]);
  });
  test("calculator: allowed keeps the flagged ones, not allowed the rest, either is all", () => {
    assert.deepEqual(ids(feedFilter(FIX, f({ calc: "only" }), ctx)), ["a-01-2", "b-01-1"]);
    assert.equal(feedFilter(FIX, f({ calc: "none" }), ctx).length, FIX.length - 2);
    assert.equal(feedFilter(FIX, f({ calc: "" }), ctx).length, FIX.length);
  });
  test("topics, mark scheme and words are the picker's rules", () => {
    assert.deepEqual(ids(feedFilter(FIX, f({ topics: ["4.1.1"] }), ctx)), ["a-01-1", "a-02-1", "c-02-1"]);
    assert.deepEqual(ids(feedFilter(FIX, f({ scheme: true }), ctx)), ["a-01-1", "a-01-3", "a-02-1", "b-01-1"]);
    assert.deepEqual(ids(feedFilter(FIX, f({ q: "volume" }), ctx)), ["a-01-3"]);
  });
  test("filters add up: all of them must hold", () => {
    assert.deepEqual(ids(feedFilter(FIX, f({ series: ["JUN25"], scheme: true, types: [BANDS[0].id] }), ctx)), ["a-01-1"]);
  });
  test("hide the ones marked: a snapshot, only while switched on", () => {
    const done = new Set(["a-01-1"]);
    assert.equal(feedMatches(FIX[0], f({ hideDone: true }), { ...ctx, done }), false);
    assert.equal(feedMatches(FIX[0], f({ hideDone: false }), { ...ctx, done }), true);
  });
  test("how many filters are on counts each topic, paper, sitting and type once, not the words or the sort", () => {
    assert.equal(feedActive(NO_FEED), 0);
    assert.equal(feedActive(f({ topics: ["a", "b"], papers: ["p"], series: ["JUN25", "JUN24"], types: ["1-2"], calc: "only", scheme: true, q: "x", sort: "mix" })), 8);
  });
  test("the calculator choice is only offered where there is something to sort", () => {
    assert.equal(hasCalcChoice({}, FIX), true);
    assert.equal(hasCalcChoice({ noCalc: 1 }, FIX), false);
    assert.equal(hasCalcChoice({}, FIX.filter((r) => !r.calc)), false);
    assert.equal(calcWords({ calcPapers: 1 }).only, "Allowed");
    assert.equal(calcWords({}).only, "Only");
    assert.equal(calcWords({}).label, "Calculation questions");
  });
});

describe("years", () => {
  const S = [{ id: "JUN25", label: "June 2025" }, { id: "NOV24", label: "November 2024" }, { id: "JUN24", label: "June 2024" }, { id: "SAM", label: "Specimen" }];
  test("a year is its sittings, newest first, and a sitting with no year is its own", () => {
    assert.deepEqual(yearGroups(S), [{ year: "2025", ids: ["JUN25"] }, { year: "2024", ids: ["NOV24", "JUN24"] }, { year: "Specimen", ids: ["SAM"] }]);
  });
  test("tapping a year picks all its sittings; tapping it again takes them off; other years stay", () => {
    const y24 = ["NOV24", "JUN24"];
    let c = toggleYear([], y24);
    assert.deepEqual(c, ["NOV24", "JUN24"]);
    assert.equal(yearState(c, y24), "all");
    c = toggleYear([...c, "JUN25"], y24);
    assert.deepEqual(c, ["JUN25"]);
    assert.equal(yearState(["JUN24"], y24), "some");
    assert.deepEqual(toggleYear(["JUN24"], y24), ["JUN24", "NOV24"]);
  });
  test("toggleIn adds and removes", () => { assert.deepEqual(toggleIn(["a"], "b"), ["a", "b"]); assert.deepEqual(toggleIn(["a", "b"], "a"), ["b"]); });
  test("a year filter gives the same rows as its sittings", () => {
    const rows = feedFilter(FIX, f({ series: toggleYear([], ["JUN25"]) }), ctx);
    assert.deepEqual(ids(rows), ["a-01-1", "a-01-2", "a-01-3", "a-02-1"]);
  });
});

describe("order, sort and mix", () => {
  const orders = feedOrders(FIX, SERIES);
  test("newest first keeps a paper's questions as printed", () => {
    assert.deepEqual(ids(feedList(orders, NO_FEED, ctx)).slice(0, 5), ["a-01-1", "a-01-2", "a-01-3", "a-02-1", "b-01-1"]);
    assert.deepEqual(ids(orders.new.filter((r) => r.s === "NOV21")), ["c-01-1", "c-01-9", "c-02-1"]);
  });
  test("oldest first runs the sittings the other way but each paper still reads 1, 2, 3", () => {
    const o = ids(feedList(orders, f({ sort: "old" }), ctx));
    assert.deepEqual(o.slice(0, 3), ["c-01-1", "c-01-9", "c-02-1"]);
    assert.deepEqual(o.slice(-4), ["a-01-1", "a-01-2", "a-01-3", "a-02-1"]);
  });
  test("most and fewest marks; a part with no marks goes last either way", () => {
    assert.deepEqual(feedList(orders, f({ sort: "most" }), ctx).map((r) => r.m).slice(0, 3), [12, 9, 6]);
    assert.equal(feedList(orders, f({ sort: "most" }), ctx).at(-1)?.m, null);
    assert.deepEqual(feedList(orders, f({ sort: "least" }), ctx).map((r) => r.m).slice(0, 3), [1, 2, 4]);
    assert.equal(feedList(orders, f({ sort: "least" }), ctx).at(-1)?.m, null);
  });
  test("a mix has every row once, is the same for the same seed and different for another, and spreads topics early", () => {
    const m1 = mixRows(FIX, "abc"), m2 = mixRows(FIX, "abc"), m3 = mixRows(FIX, "xyz");
    assert.deepEqual(ids(m1), ids(m2));
    assert.deepEqual([...ids(m1)].sort(), [...ids(FIX)].sort());
    assert.notDeepEqual(ids(m1), ids(m3));
    const topics = new Set(FIX.flatMap((r) => r.t.slice(0, 1)).concat(""));
    assert.equal(new Set(m1.slice(0, topics.size).map((r) => r.t[0] ?? "")).size, topics.size);
  });
  test("a mix of one topic spreads over the sittings instead", () => {
    const one = FIX.map((r) => ({ ...r, t: ["x"] }));
    const m = mixRows(one, "s");
    assert.equal(new Set(m.slice(0, 3).map((r) => r.s)).size, 3);
  });
  test("a mix through the list keeps the filter", () => {
    const m = feedList(orders, f({ sort: "mix", seed: "q", series: ["NOV21"] }), ctx);
    assert.deepEqual([...ids(m)].sort(), ["c-01-1", "c-01-9", "c-02-1"]);
  });
  test("the label key sorts the way a person reads a label, as compareLabels does", () => {
    const L = ["01.10", "01.2", "01.1", "3(b)(i)", "3(a)", "3(b)", "10", "2", "02.1", "1", "4(a)(ii)", "4(a)(i)", "Section A", "(b)", "12.3"];
    const byKey = L.slice().sort((a, b) => (labelKey(a) < labelKey(b) ? -1 : labelKey(a) > labelKey(b) ? 1 : 0));
    assert.deepEqual(byKey, L.slice().sort(compareLabels));
  });
  test("the two orders are the picker's order and its mirror by sitting", () => {
    const o = feedOrders(FIX, SERIES);
    assert.deepEqual(ids(o.new), ids(sortRows(FIX, SERIES.map((s) => s.id), compareLabels)));
    assert.deepEqual(ids(o.old).slice(0, 3), ["c-01-1", "c-01-9", "c-02-1"]);
  });
  test("a seed as text is a steady number", () => { assert.equal(hashSeed("abc"), hashSeed("abc")); assert.notEqual(hashSeed("abc"), hashSeed("abd")); });
});

describe("what a saved filter may keep", () => {
  const meta = { topics: [{ code: "4.1.1", title: "a", section: "s", count: 1 }], papers: [{ id: "84631H", name: "P1" }], series: SERIES };
  test("an id the subject no longer has is dropped; the rest stay", () => {
    const c = cleanFeedFilters(f({ topics: ["4.1.1", "9.9"], papers: ["84631h", "zzz"], series: ["JUN25", "OLD"], types: [BANDS[0].id, "99-"], q: "x" }), meta, BANDS);
    assert.deepEqual(c.topics, ["4.1.1"]);
    assert.deepEqual(c.papers, ["84631h"]);
    assert.deepEqual(c.series, ["JUN25"]);
    assert.deepEqual(c.types, [BANDS[0].id]);
    assert.equal(c.q, "x");
  });
});

describe("how a question stands", () => {
  const PART: QPart = { id: "a-01-2", p: "84631H", s: "JUN25", l: "01.2", m: 3, t: ["4.1.2"], w: 1086, h: 300 };
  const INFO = { subject: "aqa-gcse-physics", title: "AQA GCSE Physics" };
  const touched = (q: QuestionsData = EMPTY_QUESTIONS, p: QPart = PART) => feedTouch(q, INFO, p, { JUN25: "June 2025" }, { "4.1.2": "Waves" }, 1000).q;
  test("the lines are honest: nothing, written, marked n of m", () => {
    assert.equal(qStateLine(stateOf(undefined, 3)), "Not started");
    assert.equal(qStateLine(stateOf({ text: "x", at: 1 }, 3)), "Written");
    assert.equal(qStateLine(stateOf({ got: 2, at: 1 }, 3)), "Marked 2 of 3");
    assert.equal(qStateLine(stateOf({ got: 0, at: 1 }, 3)), "Marked 0 of 3");
    assert.equal(qStateLine(stateOf({ got: 9, at: 1 }, 3)), "Marked 3 of 3");
  });
  test("a part with no printed marks that is written is just written", () => {
    assert.equal(qStateLine(stateOf({ text: "x", at: 1 }, null)), "Written");
  });
  test("progress counts the feed's marked and written, and a question once", () => {
    let q = touched();
    q = setText(q, feedId(INFO.subject), PART.id, "hello", 2000).q;
    const rows = new Set([PART.id, "other", "third"]);
    assert.deepEqual(feedProgress(q, INFO.subject, rows), { total: 3, marked: 0, written: 1 });
    q = markPart(q, feedId(INFO.subject), PART.id, 2, 3000);
    assert.deepEqual(feedProgress(q, INFO.subject, rows), { total: 3, marked: 1, written: 0 });
  });
  test("progress counts work done in a paper too, and the better of the two for a question in both", () => {
    const set = { id: "qs_paper", name: "June 2025 Paper 1", subject: INFO.subject, title: INFO.title, names: {}, createdAt: 1, updatedAt: 1, parts: [PART, { ...PART, id: "other", l: "01.3" }], topics: {}, at: 0 };
    let q: QuestionsData = { ...EMPTY_QUESTIONS, sets: [set], answers: { "qs_paper/a-01-2": { got: 3, at: 5 }, "qs_paper/other": { text: "x", at: 5 } } };
    const rows = new Set(["a-01-2", "other", "third"]);
    const other = elsewhere(q, INFO.subject);
    assert.equal(qStateLine(other.get("a-01-2")!), "Marked 3 of 3 in a set");
    assert.equal(qStateLine(other.get("other")!), "Written in a set");
    assert.deepEqual(feedProgress(q, INFO.subject, rows, other), { total: 3, marked: 1, written: 1 });
    q = touched(q);
    q = setText(q, feedId(INFO.subject), PART.id, "again", 6000).q;
    assert.deepEqual(feedProgress(q, INFO.subject, rows, elsewhere(q, INFO.subject)), { total: 3, marked: 1, written: 1 });
  });
  test("other subjects' sets and the feed's own are not 'elsewhere'", () => {
    const q = touched();
    assert.equal(elsewhere(setText(q, feedId(INFO.subject), PART.id, "x", 5).q, INFO.subject).size, 0);
  });
  test("the line is only there once something is true to say, and never a celebration", () => {
    assert.equal(progressLine({ total: 2666, marked: 0, written: 0 }), null);
    assert.equal(progressLine({ total: 2666, marked: 128, written: 0 }), "128 of 2,666 marked");
    assert.equal(progressLine({ total: 2666, marked: 128, written: 5 }), "128 of 2,666 marked · 5 written");
    assert.equal(progressLine({ total: 2666, marked: 0, written: 5 }), "5 written");
  });
  test("marked ids come from the feed and from papers, of that subject only", () => {
    let q = touched();
    q = markPart(q, feedId(INFO.subject), PART.id, 1, 5000);
    assert.deepEqual([...markedIds(q, INFO.subject)], [PART.id]);
    assert.equal(markedIds(q, "another-subject").size, 0);
  });
});

describe("the better of the feed and a paper", () => {
  const set = (state: "written" | "marked"): QState => ({ state, of: 3, got: state === "marked" ? 2 : undefined, from: "set", where: "June 2025 Paper 1", setId: "qs_1" });
  const own = (state: "new" | "written" | "marked"): QState => ({ state, of: 3, got: state === "marked" ? 1 : undefined, from: "feed" });
  test("marked beats written beats nothing, the feed's own wins a tie", () => {
    assert.equal(bestState(own("new"), set("marked")).state, "marked");
    assert.equal(bestState(own("written"), set("marked")).from, "set");
    assert.equal(bestState(own("marked"), set("written")).from, "feed");
    assert.equal(bestState(own("written"), set("written")).from, "feed");
    assert.equal(bestState(own("new"), undefined).state, "new");
  });
  test("work in a paper is named for what it is, not by a long set name", () => {
    assert.equal(qStateLine({ ...set("written"), kind: "paper" }), "Written in a paper");
    assert.equal(qStateLine({ ...set("marked"), kind: "paper" }), "Marked 2 of 3 in a paper");
    assert.equal(qStateLine({ ...set("written"), kind: "set" }), "Written in a set");
  });
  test("the other copy is offered only where this box is empty and the other holds writing or typing", () => {
    const withText: QState = { ...set("written"), answer: { text: "hello", at: 1 } };
    const withInk: QState = { ...set("written"), answer: { ink: { n: 3, b: 100 }, at: 1 } };
    const markOnly: QState = { ...set("marked"), answer: { got: 2, at: 1 } };
    assert.equal(otherCopy(undefined, withText), withText);
    assert.equal(otherCopy({ at: 1, mode: "ink" }, withInk), withInk);
    assert.equal(otherCopy({ text: "mine", at: 1 }, withText), null);
    assert.equal(otherCopy(undefined, markOnly), null);
    assert.equal(otherCopy(undefined, undefined), null);
  });
});

describe("the write-here cue", () => {
  test("goes once a real answer exists in a feed, not a peek at a scheme or a drag on the grip", () => {
    assert.equal(hasFeedAnswer({}), false);
    assert.equal(hasFeedAnswer({ "qs_1/a": { text: "x", at: 1 } }), false);
    assert.equal(hasFeedAnswer({ "feed-x/b": { chk: 1, at: 1 } }), false);
    assert.equal(hasFeedAnswer({ "feed-x/b": { mode: "type", h: 300, at: 1 } }), false);
    assert.equal(hasFeedAnswer({ "feed-x/b": { text: "x", at: 1 } }), true);
    assert.equal(hasFeedAnswer({ "feed-x/b": { got: 1, at: 1 } }), true);
  });
});

describe("listening questions", () => {
  const L = (id: string, l: string, au?: string): BankRow => ({ ...row(id, { l, p: "8658LH", s: "JUN25", t: ["2.1"] }), ...(au ? { au } : {}) });
  test("a part without a recording whose question has one is a hole; whole questions without any recording are not", () => {
    const rows = [L("a1", "01.1", "aqa/audio/a.mp3"), L("a2", "01.2"), L("b1", "02.1"), row("c", { l: "03" })];
    assert.deepEqual([...deadListening(rows)], ["a2"]);
    assert.equal(deadListening([row("x", { l: "01" })]).size, 0);
  });
  test("holes come after everything that works, in the newest and the oldest order; nothing is lost", () => {
    const rows = [L("a1", "01.1", "aqa/audio/a.mp3"), L("a2", "01.2"), L("a3", "01.3", "aqa/audio/a.mp3")];
    for (const sort of ["new", "old"] as const) {
      const l = feedList(feedOrders(rows, SERIES), f({ sort }), ctx);
      assert.deepEqual(l.map((r) => r.id), ["a1", "a3", "a2"]);
    }
  });
  test("the whole-paper note names the question", () => assert.match(wholeRecordingNote("04.2"), /question 04 starts/));
});

describe("practise these", () => {
  test("up to a set's worth, in the order shown, and says how many were left", () => {
    const list = Array.from({ length: 140 }, (_, i) => i);
    const r = practiseRows(list);
    assert.equal(r.rows.length, MAX_SET_PARTS);
    assert.equal(r.left, 80);
    assert.deepEqual(r.rows.slice(0, 3), [0, 1, 2]);
    assert.deepEqual(practiseRows([1, 2]), { rows: [1, 2], left: 0 });
  });
});
