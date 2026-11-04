import assert from "node:assert/strict";
import { test } from "node:test";
import { earnsDay, mergeDays, MAX_DAYS, questionDays, questionsToday, serverStreak, streakNow, streakOf, todayLine } from "./streak";
import { addDays } from "./time";
import type { QAnswer } from "./questions/model";

const at = (iso: string, h = 12) => Date.parse(`${iso}T${String(h).padStart(2, "0")}:00:00Z`);
const mk = (iso: string, h = 12): QAnswer => ({ at: at(iso, h), got: 1 });

test("a day needs real work: a mark, a few words, a few strokes. Opening the app, one letter, one stroke, a focus session: no", () => {
  assert.ok(earnsDay({ at: 1, got: 0 }));
  assert.ok(earnsDay({ at: 1, text: "Energy is transferred" }));
  assert.ok(earnsDay({ at: 1, ink: { n: 3, b: 100 } }));
  assert.ok(!earnsDay({ at: 1, text: "a" }));
  assert.ok(!earnsDay({ at: 1, ink: { n: 1, b: 10 } }));
  assert.ok(!earnsDay({ at: 1, chk: 1 }));
  assert.ok(!earnsDay(undefined));
});
test("the run of days ending today, or yesterday while today is not earned yet", () => {
  const days = ["2026-11-01", "2026-11-02", "2026-11-03"];
  assert.equal(streakOf(days, "2026-11-03"), 3);
  assert.equal(streakOf(days, "2026-11-04"), 3);          // today not yet: still alive
  assert.equal(streakOf(days, "2026-11-05"), 0);          // a whole day missed
  assert.equal(streakOf([], "2026-11-05"), 0);
  assert.equal(streakOf(["2026-11-03", "2026-11-01"], "2026-11-03"), 1);   // a gap ends the run
});
test("it counts across a month and a year end, and across the clocks changing", () => {
  assert.equal(streakOf(["2026-12-30", "2026-12-31", "2027-01-01"], "2027-01-01"), 3);
  assert.equal(streakOf(["2026-10-24", "2026-10-25", "2026-10-26"], "2026-10-26"), 3);   // 25 October 2026: the clocks go back
  assert.equal(streakOf(["2027-03-27", "2027-03-28", "2027-03-29"], "2027-03-29"), 3);   // 28 March 2027: they go forward
});
test("days are London days: work at 23:30 UK time is that day, work just after midnight is the next", () => {
  const q = { answers: { a: mk("2026-07-01", 22) /* 23:00 BST */, b: { at: Date.parse("2026-07-01T23:30:00Z"), got: 1 } /* 00:30 on the 2nd */ }, recent: [] };
  assert.deepEqual(questionDays(q), ["2026-07-01", "2026-07-02"]);
  assert.equal(questionsToday(q, "2026-07-02"), 1);
});
test("work across midnight is two days", () => {
  const q = { answers: { a: { at: Date.parse("2026-11-03T23:59:00Z"), got: 1 }, b: { at: Date.parse("2026-11-04T00:01:00Z"), got: 1 } }, recent: [] };
  assert.deepEqual(questionDays(q), ["2026-11-03", "2026-11-04"]);
});
test("the days of marks recorded as done lately count too, and an answer edited later does not lose its first day once it is kept", () => {
  const q = { answers: { a: mk("2026-11-04") }, recent: [{ id: "x", at: at("2026-11-02") }, { id: "y", at: 0 }] };
  assert.deepEqual(questionDays(q), ["2026-11-02", "2026-11-04"]);
  const kept = mergeDays(["2026-11-01", "2026-11-03"], questionDays(q), "2026-11-04");
  assert.deepEqual(kept, ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]);
});
test("kept days are tidy: no repeats, no junk, none in the future, the newest 400", () => {
  assert.deepEqual(mergeDays(["2026-11-03", "2026-11-03", "nope", 5, "2026-11-09", "2026-13-40x"], ["2026-11-02"], "2026-11-04"), ["2026-11-02", "2026-11-03"]);
  const many = Array.from({ length: 500 }, (_, i) => addDays("2025-01-01", i));
  const out = mergeDays(many, [], "2030-01-01");
  assert.equal(out.length, MAX_DAYS); assert.equal(out[out.length - 1], many[many.length - 1]);
});
test("the server's streak counts while its day is today or yesterday", () => {
  assert.equal(serverStreak({ streak: 9, streakDay: "2026-11-04" }, "2026-11-04"), 9);
  assert.equal(serverStreak({ streak: 9, streakDay: "2026-11-03" }, "2026-11-04"), 9);
  assert.equal(serverStreak({ streak: 9, streakDay: "2026-11-02" }, "2026-11-04"), 0);
  assert.equal(serverStreak({ streak: 0, streakDay: "2026-11-04" }, "2026-11-04"), 0);
  assert.equal(serverStreak(null, "2026-11-04"), 0);
});
test("the shown number: the server's carried forward by a day earned here, never less than the web's own run", () => {
  const today = "2026-11-04";
  assert.equal(streakNow([], null, today), 0);
  assert.equal(streakNow(["2026-11-03", today], null, today), 2);
  assert.equal(streakNow([], { streak: 9, streakDay: "2026-11-03" }, today), 9);                  // the iPad's, today not earned yet
  assert.equal(streakNow([today], { streak: 9, streakDay: "2026-11-03" }, today), 10);            // earned here today on top of the iPad's nine
  assert.equal(streakNow([today], { streak: 9, streakDay: today }, today), 9);                     // the iPad counted today already
  assert.equal(streakNow(["2026-11-01", "2026-11-02", "2026-11-03", today], { streak: 2, streakDay: "2026-11-03" }, today), 4);   // the web's own run is longer
});
test("the today line: minutes and questions, quietly, and nothing while there is nothing", () => {
  assert.equal(todayLine(24 * 60_000 + 5000, 8), "Today: 24 min, 8 questions");
  assert.equal(todayLine(0, 1), "Today: 1 question");
  assert.equal(todayLine(59_000, 0), null);
  assert.equal(todayLine(90 * 60_000, 0), "Today: 1 h 30 min");
  assert.equal(todayLine(120 * 60_000, 3), "Today: 2 h, 3 questions");
});
