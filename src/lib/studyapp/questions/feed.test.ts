import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CLEARED, feedCounts, feedPills, forOption, leaveOutLatestTwo, NO_EXTRAS, optionCount, pickOption, specSorted, takesOf, tierPaperIds, twinPapers, validOption, type FeedContext, type FeedExtras, deadListening, wholeRecordingNote, hasFeedAnswer, otherCopy, bestState, bandsFor, labelKey, calcWords, cleanFeedFilters, elsewhere, feedActive, feedFilter, feedList, feedMatches, feedOrders, feedProgress, hasCalcChoice, hashSeed, markedIds, mixRows, NO_FEED, practiseRows, progressLine, qStateLine, stateOf, toggleIn, toggleYear, yearGroups, yearState, type FeedFilters, type QState } from "./feed";
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
const ALL_BANDS = bandsFor("Physics", FIX);
/** The question types by marks (the bank also offers "Multiple choice" first where a subject has some and other kinds too). */
const BANDS = ALL_BANDS.filter((b) => !b.choice);
const ctx = { bands: ALL_BANDS };
const f = (o: Partial<FeedFilters>): FeedFilters => ({ ...NO_FEED, ...o });
const ids = (rs: readonly BankRow[]) => rs.map((r) => r.id);

describe("question types", () => {
  test("a science's marks make four bands, and a band names the marks it holds", () => {
    assert.deepEqual(BANDS.map((b) => b.label), ["1\u20132 marks", "4 marks", "6\u20139 marks", "12 marks"]);
  });
  test("Multiple choice leads the types where a subject has some and other kinds, and keeps the parts with a letter key", () => {
    assert.equal(ALL_BANDS[0].label, "Multiple choice");
    assert.deepEqual(ids(feedFilter(FIX, f({ types: [ALL_BANDS[0].id] }), ctx)), ["b-01-1"]);
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


/* ── the public bank's other filters ─────────────────────────────────── */

describe("school year", () => {
  const y13 = new Set(["a-01-3", "a-02-1", "c-02-1"]);
  const ex: FeedExtras = { ...NO_EXTRAS, year13: y13 };
  const c = { ...ctx, extras: ex };
  test("Year 13 is the questions that need second-year content, Year 12 the rest, Both is all", () => {
    assert.deepEqual(ids(feedFilter(FIX, f({ yr: "13" }), c)), ["a-01-3", "a-02-1", "c-02-1"]);
    assert.equal(feedFilter(FIX, f({ yr: "12" }), c).length, FIX.length - 3);
    assert.equal(feedFilter(FIX, f({ yr: "" }), c).length, FIX.length);
  });
  test("a subject with no year file has no year filter: a remembered one does nothing, and the cleaner drops it", () => {
    assert.equal(feedFilter(FIX, f({ yr: "13" }), ctx).length, FIX.length);
    const meta = { topics: [], papers: [], series: [], options: undefined, data: {} };
    assert.equal(cleanFeedFilters(f({ yr: "13" }), meta, [], undefined).yr, "");
    assert.equal(cleanFeedFilters(f({ yr: "13" }), { ...meta, data: { year13: "abc123" } }, [], undefined).yr, "13");
    assert.equal(cleanFeedFilters(f({ yr: "13" }), { ...meta, data: { year13: "abc123" } }, [], NO_EXTRAS).yr, "", "the file did not arrive");
  });
});

describe("practicals", () => {
  const c = { ...ctx, extras: { ...NO_EXTRAS, practicals: new Set(["a-01-2", "b-01-1"]) } };
  test("only these, or leave them out", () => {
    assert.deepEqual(ids(feedFilter(FIX, f({ prac: "only" }), c)), ["a-01-2", "b-01-1"]);
    assert.equal(feedFilter(FIX, f({ prac: "none" }), c).length, FIX.length - 2);
  });
  test("a subject with no practicals file is not filtered", () => assert.equal(feedFilter(FIX, f({ prac: "only" }), ctx).length, FIX.length));
});

describe("both tiers, shown once", () => {
  const rows = [row("f1", { p: "84632F", l: "01.1" }), row("f2", { p: "84632F", l: "01.2" }), row("h1", { p: "84631H", l: "01.1" }), row("h2", { p: "84631H", l: "01.2" }), row("solo", { p: "84632F", l: "02.1" })];
  const twins = new Map([["f1", "h1"], ["f2", "h2"]]);
  const mk = (rs: readonly BankRow[]): FeedContext => ({ ...ctx, extras: { ...NO_EXTRAS, twins }, twinPaper: twinPapers(rs, twins) });
  test("a Foundation part whose Higher twin is in view goes", () => {
    assert.deepEqual(ids(feedFilter(rows, f({ once: true }), mk(rows))), ["h1", "h2", "solo"]);
    assert.equal(feedFilter(rows, f({ once: false }), mk(rows)).length, 5);
  });
  test("it stays when the papers picked leave the Higher paper out", () => {
    assert.deepEqual(ids(feedFilter(rows, f({ once: true, papers: ["84632F"] }), mk(rows))), ["f1", "f2", "solo"]);
    assert.deepEqual(ids(feedFilter(rows, f({ once: true, papers: ["84632F", "84631H"] }), mk(rows))), ["h1", "h2", "solo"]);
  });
  test("it stays when the Higher tier is not among the rows (the student sits Foundation)", () => {
    const fo = rows.filter((r) => r.p === "84632F");
    assert.deepEqual(ids(feedFilter(fo, f({ once: true }), mk(fo))), ["f1", "f2", "solo"]);
  });
  test("twinPapers reads the twin's own paper", () => assert.deepEqual([...twinPapers(rows, twins)], [["f1", "84631h"], ["f2", "84631h"]]));
});

describe("options", () => {
  const options = { label: "Religion", list: [{ id: "a", name: "Christianity" }, { id: "b", name: "Islam" }, { id: "ms", name: "Mechanics and Statistics", takes: ["m", "s"] }] };
  const meta = { options, papers: [{ id: "P1", name: "One", option: "a" }, { id: "P2", name: "Two", option: "b" }, { id: "P3", name: "Three" }, { id: "PM", name: "Mech", option: "m" }, { id: "PS", name: "Stats", option: "s" }] };
  const rows = [row("r1", { p: "P1" }), row("r2", { p: "P2" }), row("r3", { p: "P3" }), row("r4", { p: "PM" }), row("r5", { p: "PS" })];
  const c = { ...ctx, meta };
  test("an option keeps its papers and the ones everyone sits", () => {
    assert.deepEqual(ids(feedFilter(rows, f({ opt: "a" }), c)), ["r1", "r3"]);
    assert.deepEqual(ids(feedFilter(rows, f({ opt: "b" }), c)), ["r2", "r3"]);
    assert.equal(feedFilter(rows, f({ opt: "" }), c).length, 5);
  });
  test("a pair the student takes keeps both", () => {
    assert.deepEqual(ids(feedFilter(rows, f({ opt: "ms" }), c)), ["r3", "r4", "r5"]);
    assert.deepEqual(takesOf(options, "ms"), ["m", "s"]);
    assert.deepEqual(takesOf(options, "a"), ["a"]);
  });
  test("an option the subject does not have is no option", () => {
    assert.equal(validOption(options, "zzz"), "");
    assert.equal(feedFilter(rows, f({ opt: "zzz" }), c).length, 5);
    assert.equal(cleanFeedFilters(f({ opt: "zzz" }), { ...meta, topics: [], series: [], data: {} }, [], undefined).opt, "");
  });
  test("choosing an option drops the papers picked that belong to another", () => {
    assert.deepEqual(pickOption(meta, f({ papers: ["P1", "P2", "P3"] }), "a"), { opt: "a", papers: ["P1", "P3"] });
    assert.deepEqual(pickOption(meta, f({ papers: ["P2"] }), ""), { opt: "", papers: ["P2"] });
  });
  test("a section or a paper with no option is for everyone", () => {
    assert.equal(forOption(options, "a", undefined), true);
    assert.equal(forOption(options, "a", "b"), false);
    assert.equal(forOption(options, "", "b"), true);
  });
});

describe("spec order", () => {
  test("by the first topic as the specification numbers it, a part with no topic last, ties as they were", () => {
    const rs = [row("z", { t: ["4.1.10"] }), row("y", { t: ["4.1.2"] }), row("n", { t: [] }), row("x", { t: ["4.1.2"] }), row("w", { t: ["3.9"] })];
    assert.deepEqual(ids(specSorted(rs)), ["w", "y", "x", "z", "n"]);
  });
  test("by the topic's place in the subject's list, not its code as text: GCSE Maths' Number before Algebra, Edexcel's Pure before Mechanics", () => {
    const gcse = [{ code: "N1" }, { code: "N2" }, { code: "A1" }, { code: "A2" }, { code: "R1" }, { code: "G1" }];
    const rs = [row("a1", { t: ["A1"] }), row("g1", { t: ["G1"] }), row("n2", { t: ["N2"] }), row("a2", { t: ["A2"] }), row("n1", { t: ["N1"] }), row("none", { t: [] }), row("r1", { t: ["R1"] })];
    assert.deepEqual(ids(specSorted(rs, gcse)), ["n1", "n2", "a1", "a2", "r1", "g1", "none"]);
    assert.deepEqual(ids(specSorted(rs)).slice(0, 2), ["a1", "a2"], "(as text, A would come first: that was the fault)");
    const edx = [{ code: "P.1" }, { code: "P.2" }, { code: "S.1" }, { code: "M.1" }, { code: "M.7" }];
    const ed = [row("m7", { t: ["M.7"] }), row("p1", { t: ["P.1"] }), row("m1", { t: ["M.1"] }), row("s1", { t: ["S.1"] }), row("p2", { t: ["P.2"] })];
    assert.deepEqual(ids(specSorted(ed, edx)), ["p1", "p2", "s1", "m1", "m7"]);
  });
  test("ties keep the order given (newest first stays newest first); a topic the list lacks comes after those it has", () => {
    const tl = [{ code: "T1" }, { code: "T2" }];
    const rs = [row("x", { t: ["T2"] }), row("y", { t: ["T1"] }), row("z", { t: ["T2"] }), row("odd", { t: ["ZZ"] }), row("w", { t: ["T1"] })];
    assert.deepEqual(ids(specSorted(rs, tl)), ["y", "w", "x", "z", "odd"]);
  });
  test("feedList sorts by it, after the filter", () => {
    const orders = feedOrders(FIX, SERIES);
    const out = feedList(orders, f({ sort: "spec", calc: "none" }), { ...ctx, meta: { papers: [], topics: [{ code: "4.3.1" }, { code: "4.1.1" }, { code: "4.1.2" }, { code: "4.2.1" }] as never } });
    assert.deepEqual(out.map((r) => r.t[0] ?? ""), out.map((r) => r.t[0] ?? "").slice().sort((a, b) => (a === "" ? 1 : b === "" ? -1 : ["4.3.1", "4.1.1", "4.1.2", "4.2.1"].indexOf(a) - ["4.3.1", "4.1.1", "4.1.2", "4.2.1"].indexOf(b))));
    assert.ok(out.every((r) => !r.calc));
  });
});

describe("quick picks", () => {
  test("Higher only and Foundation only are the papers named so", () => {
    const ps = [{ id: "a", name: "Paper 1 Higher" }, { id: "b", name: "Paper 2 Higher" }, { id: "c", name: "Paper 1 Foundation" }];
    assert.deepEqual(tierPaperIds(ps, "Higher"), ["a", "b"]);
    assert.deepEqual(tierPaperIds(ps, "Foundation"), ["c"]);
  });
  test("leaving out the latest two keeps the older sittings, and is not offered for two or fewer", () => {
    assert.deepEqual(leaveOutLatestTwo(SERIES), ["NOV21"]);
    assert.deepEqual(leaveOutLatestTwo(SERIES.slice(0, 2)), []);
    assert.equal(feedFilter(FIX, f({ series: leaveOutLatestTwo(SERIES) }), ctx).every((r) => r.s === "NOV21"), true);
  });
});

describe("counts", () => {
  const rows = [
    row("a", { p: "P1", s: "JUN25", t: ["t1"], m: 1, calc: 1 }), row("b", { p: "P1", s: "JUN24", t: ["t1", "t2"], m: 4 }),
    row("c", { p: "P2", s: "JUN25", t: ["t2"], m: 4, calc: 1 }), row("d", { p: "P2", s: "JUN24", t: ["t3"], m: 6 }),
  ];
  const bands = bandsFor("Physics", rows);
  const ex: FeedExtras = { practicals: new Set(["a", "c"]), year13: new Set(["d"]), twins: null, forms: null };
  const meta = { papers: [{ id: "P1", name: "1", option: "x" }, { id: "P2", name: "2", option: "y" }, { id: "P3", name: "3" }], options: { label: "O", list: [{ id: "x", name: "X" }, { id: "y", name: "Y" }] } };
  const c: FeedContext = { bands, extras: ex, meta };
  test("each option counts with every other filter kept and its own left out", () => {
    const n = feedCounts(rows, f({ papers: ["P1"], topics: ["t2"] }), c, bands);
    // topics: the paper filter is kept (a, b), the topics filter is not
    assert.equal(n.topics.get("t1"), 2); assert.equal(n.topics.get("t2"), 1); assert.equal(n.topics.get("t3"), undefined);
    // papers: the topic filter is kept (b, c), the paper filter is not
    assert.equal(n.papers.get("p1"), 1); assert.equal(n.papers.get("p2"), 1);
    assert.equal(n.series.get("JUN24"), 1); assert.equal(n.series.get("JUN25") ?? 0, 0);
  });
  test("calculator, practicals and school year count their own two sides", () => {
    const n = feedCounts(rows, f({}), c, bands);
    assert.deepEqual(n.calc, { only: 2, none: 2 });
    assert.deepEqual(n.prac, { only: 2, none: 2 });
    assert.deepEqual(n.yr, { "12": 3, "13": 1 });
    const t = feedCounts(rows, f({ calc: "only" }), c, bands);
    assert.deepEqual(t.calc, { only: 2, none: 2 }, "the calculator filter is left out of its own count");
    assert.deepEqual(t.prac, { only: 2, none: 0 });
  });
  test("an option counts its papers, and the papers everyone sits count under none", () => {
    const n = feedCounts(rows, f({}), { ...c, meta: { ...meta, papers: [...meta.papers] } }, bands);
    assert.equal(n.opt.get("x"), 2); assert.equal(n.opt.get("y"), 2);
    assert.equal(optionCount(n, meta.options, "x"), 2);
    assert.equal(optionCount(null, meta.options, "x"), null);
  });
  test("a thousand rows are counted in a few milliseconds, not seconds", () => {
    const big = Array.from({ length: 3000 }, (_, i) => row(`r${i}`, { p: `P${i % 4}`, s: i % 2 ? "JUN25" : "JUN24", t: [`t${i % 30}`, `t${(i + 7) % 30}`], m: 1 + (i % 9), calc: i % 3 === 0 ? 1 : undefined }));
    const t0 = performance.now();
    feedCounts(big, f({ topics: ["t3"], calc: "only" }), { bands: bandsFor("Physics", big), extras: { practicals: new Set(big.slice(0, 500).map((r) => r.id)), year13: new Set(big.slice(0, 900).map((r) => r.id)), twins: null, forms: null } }, bandsFor("Physics", big));
    assert.ok(performance.now() - t0 < 400, `took ${Math.round(performance.now() - t0)} ms`);
  });
});

describe("pills and clear all", () => {
  const meta = { topics: [], papers: [{ id: "P1", name: "Paper 1" }], series: [{ id: "JUN25", label: "June 2025" }], options: { label: "Religion", list: [{ id: "b", name: "Islam" }] }, calcPapers: undefined };
  const all = f({ opt: "b", yr: "13", prac: "none", once: true, calc: "only", papers: ["P1"], series: ["JUN25"], scheme: true, hideDone: true });
  test("each filter that is on is a pill that says what it is and takes only itself off", () => {
    const ps = feedPills(meta, [], all);
    assert.deepEqual(ps.map((p) => p.label), ["Islam", "Paper 1", "June 2025", "Year 13 content", "Calculation questions only", "No practicals", "Both-tier questions once", "Has a mark scheme", "Marked ones hidden"]);
    const off = (key: string) => ({ ...all, ...ps.find((p) => p.key === key)!.off });
    assert.equal(off("yr").yr, ""); assert.equal(off("opt").opt, ""); assert.equal(off("prac").prac, ""); assert.equal(off("once").once, false);
    assert.equal(off("yr").prac, "none", "the others stay");
  });
  test("clear all turns every filter off and keeps the sort and the seed", () => {
    const cleared = { ...f({ sort: "spec", seed: "ab" }), ...all, ...CLEARED, sort: "spec" as const, seed: "ab" };
    assert.equal(feedActive(cleared), 0);
    assert.equal(feedPills(meta, [], cleared).length, 0);
    assert.equal(cleared.sort, "spec");
  });
  test("the count on the Filters button counts the new filters too", () => assert.equal(feedActive(f({ yr: "12", opt: "b", prac: "only", once: true })), 4));
});

describe("the form filter (Topic analysis)", () => {
  const rows = [row("a", { t: ["t1"] }), row("b", { t: ["t1"] }), row("c", { t: ["t1", "t2"] }), row("d", { t: ["t2"] })];
  const forms = new Map<string, string>([["a", "explain"], ["b", "calculate"], ["c", "explain"]]);
  const withForms: FeedContext = { ...ctx, extras: { ...NO_EXTRAS, forms } };
  test("keeps the parts of the chosen forms, and a part the file does not know is other", () => {
    assert.deepEqual(feedFilter(rows, f({ forms: ["explain"] }), withForms).map((r) => r.id), ["a", "c"]);
    assert.deepEqual(feedFilter(rows, f({ forms: ["explain", "calculate"] }), withForms).map((r) => r.id), ["a", "b", "c"]);
    assert.deepEqual(feedFilter(rows, f({ forms: ["other"] }), withForms).map((r) => r.id), ["d"]);
  });
  test("works with a topic, and leaves the list alone until the file has arrived", () => {
    assert.deepEqual(feedFilter(rows, f({ topics: ["t2"], forms: ["explain"] }), withForms).map((r) => r.id), ["c"]);
    assert.equal(feedFilter(rows, f({ forms: ["explain"] }), ctx).length, 4, "no file yet: nothing is cut (the page says so)");
    assert.equal(feedFilter(rows, f({}), withForms).length, 4, "no form chosen: nothing is cut");
  });
  test("is counted, shown as a chip, taken off by it, and cleared by Clear all", () => {
    const n = feedCounts(rows, f({ forms: ["calculate"] }), withForms, []);
    assert.equal(n.forms.get("explain"), 2, "its own filter is left out of its own count");
    assert.equal(feedActive(f({ forms: ["explain"] })), 1);
    const pill = feedPills({ topics: [], papers: [], series: [], options: undefined, calcPapers: undefined }, [], f({ forms: ["explain", "calculate"] }))[0];
    assert.equal(pill.label, "Explain");
    assert.deepEqual(pill.off, { forms: ["calculate"] });
    assert.deepEqual(CLEARED.forms, []);
  });
  test("a remembered form that is not a form is dropped when the filters are cleaned", () => {
    const meta = { topics: [], papers: [], series: [], options: undefined, data: {} };
    assert.deepEqual(cleanFeedFilters(f({ forms: ["explain", "nonsense"] }), meta, []).forms, ["explain"]);
  });
});
