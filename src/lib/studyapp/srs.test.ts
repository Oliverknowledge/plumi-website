/** npm run app:test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EASY_DAYS, LEARNING_STEPS, MIN_EASE, newSchedule, previewLabel, queue, schedule, type Grade, type Queueable, type Schedule } from "./srs";

const MIN = 60_000, DAY = 86_400_000, T = Date.UTC(2026, 10, 1, 9, 0, 0);
const review = (over: Partial<Schedule> = {}): Schedule => ({ ...newSchedule(T), state: "review", interval: 10, reps: 3, ...over });

describe("learning a new card", () => {
  it("steps up on Good, then graduates to a day", () => {
    const a = schedule(newSchedule(T), 3, T);
    assert.deepEqual([a.state, a.step, a.due - T], ["learning", 1, LEARNING_STEPS[1]]);
    const b = schedule(a, 3, T + 10 * MIN);
    assert.deepEqual([b.state, b.interval, b.due - (T + 10 * MIN), b.reps], ["review", 1, DAY, 1]);
  });
  it("graduates at once on Easy, to four days", () => {
    const s = schedule(newSchedule(T), 4, T);
    assert.deepEqual([s.state, s.interval, s.due - T], ["review", EASY_DAYS, EASY_DAYS * DAY]);
  });
  it("goes back to the first step on Again, a minute away", () => {
    const s = schedule(schedule(newSchedule(T), 3, T), 1, T);
    assert.deepEqual([s.state, s.step, s.due - T], ["learning", 0, MIN]);
  });
  it("repeats the step on Hard, a little longer on the first", () => {
    assert.equal(schedule(newSchedule(T), 2, T).due - T, 6 * MIN);
    assert.equal(schedule(schedule(newSchedule(T), 3, T), 2, T).due - T, 10 * MIN);
  });
});

describe("reviewing a graduated card", () => {
  const base = review({ interval: 10, ease: 2.5 });
  it("grows by the ease on Good", () => {
    const s = schedule(base, 3, T);
    assert.deepEqual([s.interval, s.ease, s.due - T, s.reps], [25, 2.5, 25 * DAY, 4]);
  });
  it("grows slowly on Hard and lowers the ease", () => {
    const s = schedule(base, 2, T);
    assert.deepEqual([s.interval, s.ease], [12, 2.35]);
  });
  it("grows fastest on Easy and raises the ease", () => {
    const s = schedule(base, 4, T);
    assert.deepEqual([s.interval, s.ease], [33, 2.65]);
  });
  it("always moves on by at least a day (two on Easy)", () => {
    const one = review({ interval: 1 });
    assert.equal(schedule(one, 2, T).interval, 2);
    assert.equal(schedule(one, 3, T).interval, 3);
    assert.equal(schedule(one, 4, T).interval, 3);
  });
  it("lapses on Again: relearns in ten minutes, then restarts at half", () => {
    const lapsed = schedule(review({ interval: 20 }), 1, T);
    assert.deepEqual([lapsed.state, lapsed.due - T, lapsed.lapses, lapsed.ease, lapsed.relearnTo], ["learning", 10 * MIN, 1, 2.3, 10]);
    const back = schedule(lapsed, 3, T + 10 * MIN);
    assert.deepEqual([back.state, back.interval, back.relearnTo], ["review", 10, null]);
    assert.equal(schedule(lapsed, 4, T).interval, 10, "Easy does not skip the relearning interval");
  });
  it("restarts at least a day after a lapse, however small the interval was", () => {
    const back = schedule(schedule(review({ interval: 1 }), 1, T), 3, T);
    assert.equal(back.interval, 1);
  });
  it("never lets the ease fall under 1.3", () => {
    let s = review({ ease: 1.4 });
    for (let i = 0; i < 6; i++) s = schedule(schedule(s, 2, T), 3, T);
    assert.ok(s.ease >= MIN_EASE);
    assert.equal(schedule(review({ ease: 1.3 }), 1, T).ease, MIN_EASE);
  });
});

describe("the scheduler as a whole", () => {
  it("is deterministic and never mutates", () => {
    const s = review();
    const frozen = JSON.stringify(s);
    const grades: Grade[] = [1, 2, 3, 4];
    for (const g of grades) assert.deepEqual(schedule(s, g, T), schedule(s, g, T));
    assert.equal(JSON.stringify(s), frozen);
  });
  it("labels the buttons truthfully", () => {
    assert.deepEqual([1, 2, 3, 4].map((g) => previewLabel(newSchedule(T), g as Grade, T)), ["1m", "6m", "10m", "4d"]);
    assert.deepEqual([1, 2, 3, 4].map((g) => previewLabel(review(), g as Grade, T)), ["10m", "12d", "25d", "1.1mo"]);
    assert.equal(previewLabel(review({ interval: 400 }), 3, T), "2.7y");
    assert.equal(previewLabel(review({ interval: 60 }), 3, T), "4.9mo");
  });
  it("a long run of Good grades climbs steadily and a card is never due in the past", () => {
    let s = newSchedule(T), now = T;
    const gaps: number[] = [];
    for (let i = 0; i < 8; i++) { s = schedule(s, 3, now); assert.ok(s.due > now); gaps.push(Math.round((s.due - now) / DAY * 1000) / 1000); now = s.due; }
    for (let i = 3; i < gaps.length; i++) assert.ok(gaps[i] > gaps[i - 1], gaps.join(","));
  });
});

describe("the queue", () => {
  const card = (id: string, sch: Schedule, deckId = "d1", createdAt = 0): Queueable => ({ id, deckId, sch, createdAt });
  const due = (ago: number) => review({ due: T - ago });
  it("shows due cards oldest first, then new cards, and leaves out what is not due yet", () => {
    const cards = [
      card("later", review({ due: T + DAY })), card("new1", newSchedule(T), "d1", 1), card("old", due(2 * DAY)),
      card("recent", due(1 * MIN)), card("new2", newSchedule(T), "d1", 2),
    ];
    const q = queue(cards, T, 0);
    assert.deepEqual(q.ids, ["old", "recent", "new1", "new2"]);
    assert.deepEqual([q.due, q.fresh, q.nextAt], [2, 2, null]);
  });
  it("caps new cards a day, counting those already started today", () => {
    const cards = Array.from({ length: 30 }, (_, i) => card(`n${i}`, newSchedule(T), "d1", i));
    assert.equal(queue(cards, T, 0).fresh, 10);
    assert.equal(queue(cards, T, 7).fresh, 3);
    assert.equal(queue(cards, T, 12).fresh, 0);
    assert.equal(queue(cards, T, 0, 20).fresh, 20);
  });
  it("says when to come back if only a learning card is waiting", () => {
    const wait = card("w", { ...newSchedule(T), state: "learning", due: T + 7 * MIN, step: 1 });
    const q = queue([wait], T, 0);
    assert.deepEqual([q.ids, q.nextAt], [[], T + 7 * MIN]);
  });
  it("can be limited to one deck", () => {
    const cards = [card("a", due(MIN), "d1"), card("b", due(MIN), "d2")];
    assert.deepEqual(queue(cards, T, 0, 10, "d2").ids, ["b"]);
  });
});
