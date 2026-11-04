import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DAYS_KEY, makeDayKeep } from "./dayKeep";
import { createSet, EMPTY_QUESTIONS, keyOf, markPart, setInkMeta, setText, type QPart, type QuestionsData, type SetInput } from "./questions/model";
import { dayChanges, streakNow } from "./streak";

const at = (iso: string, h = 12) => Date.parse(`${iso}T${String(h).padStart(2, "0")}:00:00Z`);
const part = (id: string, m: number | null): QPart => ({ id, p: "84631H", s: "JUN25", l: id, m, t: [], w: 1086, h: 300, ms: 1 });
const INPUT: SetInput = { subject: "aqa-gcse-physics", title: "AQA GCSE Physics", names: {}, topics: {}, parts: [part("q1a", 2), part("q1b", 1)] };
const D1 = "2026-11-03", D2 = "2026-11-04";

function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, raw: () => m.get(DAYS_KEY) ?? null };
}
const stored = (s: ReturnType<typeof fakeStorage>): string[] => JSON.parse(s.raw() ?? "{\"days\":[]}").days;

describe("days are kept where the work is written, whatever page is open", () => {
  test("the repro: typed in the paper sheet on day 1, the same answer extended on day 2, day 1 survives", () => {
    const st = fakeStorage();
    const keep = makeDayKeep(() => st);
    // Day 1: a set, and 22 characters typed (nothing but the store is involved: no Desk, no feed is mounted).
    const made = createSet(EMPTY_QUESTIONS, INPUT, at(D1));
    const typed1 = setText(made.q, made.id, "q1a", "Energy is transferred", at(D1)).q;
    keep.onChange(made.q, typed1, at(D1));
    assert.deepEqual(stored(st), [D1]);
    // Day 2: the page resumes into the sheet and the answer is added to. Its own time is day 2 now.
    const typed2 = setText(typed1, made.id, "q1a", "Energy is transferred by heating", at(D2)).q;
    assert.equal(typed2.answers[keyOf(made.id, "q1a")].at, at(D2));
    keep.onChange(typed1, typed2, at(D2));
    assert.deepEqual(stored(st), [D1, D2]);
    assert.equal(streakNow(keep.snapshot(), null, D2), 2);
  });
  test("an old answer edited without any day recorded for it still gives its first day (the base is looked at too)", () => {
    const st = fakeStorage();
    const keep = makeDayKeep(() => st);
    const made = createSet(EMPTY_QUESTIONS, INPUT, at(D1));
    const typed1 = setText(made.q, made.id, "q1a", "Energy is transferred", at(D1)).q;      // never told to the keep
    const marked2 = markPart(typed1, made.id, "q1a", 1, at(D2));
    keep.onChange(typed1, marked2, at(D2));
    assert.deepEqual(stored(st), [D1, D2]);
  });
  test("what the store holds when it loads is kept too (answers from before days were kept at the store)", () => {
    const st = fakeStorage();
    const keep = makeDayKeep(() => st);
    const made = createSet(EMPTY_QUESTIONS, INPUT, at(D1));
    const q = markPart(setText(made.q, made.id, "q1a", "Energy is transferred", at("2026-11-02")).q, made.id, "q1b", 1, at(D1));
    keep.onLoad(q, at(D2));
    assert.deepEqual(stored(st), ["2026-11-02", D1]);
  });
  test("a day needs real work: one letter, a few strokes, opening the scheme record nothing", () => {
    const st = fakeStorage();
    const keep = makeDayKeep(() => st);
    const made = createSet(EMPTY_QUESTIONS, INPUT, at(D1));
    let q: QuestionsData = setText(made.q, made.id, "q1a", "a", at(D1)).q;
    keep.onChange(made.q, q, at(D1));
    const q2 = setInkMeta(q, made.id, "q1b", 2, 80, at(D1));
    keep.onChange(q, q2, at(D1));
    assert.equal(st.raw(), null);
    q = setInkMeta(q2, made.id, "q1b", 3, 120, at(D1));        // three strokes: a day
    keep.onChange(q2, q, at(D1));
    assert.deepEqual(stored(st), [D1]);
  });
  test("days are only added: undoing the work or resetting the answer takes nothing away", () => {
    const st = fakeStorage();
    const keep = makeDayKeep(() => st);
    const made = createSet(EMPTY_QUESTIONS, INPUT, at(D1));
    const typed = setText(made.q, made.id, "q1a", "Energy is transferred", at(D1)).q;
    keep.onChange(made.q, typed, at(D1));
    const cleared = setText(typed, made.id, "q1a", "", at(D2)).q;
    keep.onChange(typed, cleared, at(D2));
    assert.deepEqual(stored(st), [D1]);
  });
  test("a tab that slept never writes an older list over a newer one", () => {
    const st = fakeStorage({ [DAYS_KEY]: JSON.stringify({ v: 1, days: ["2026-10-30"] }) });
    const keep = makeDayKeep(() => st);
    keep.snapshot();
    st.setItem(DAYS_KEY, JSON.stringify({ v: 1, days: ["2026-10-30", "2026-10-31"] }));   // another tab
    keep.record([D1], D2);
    assert.deepEqual(stored(st), ["2026-10-30", "2026-10-31", D1]);
  });
  test("storage that throws or is missing keeps the days for the visit", () => {
    const keep = makeDayKeep(() => ({ getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } }));
    keep.record([D1], D2);
    assert.deepEqual([...keep.snapshot()], [D1]);
    const none = makeDayKeep(() => null);
    none.record([D1], D2);
    assert.deepEqual([...none.snapshot()], [D1]);
  });
  test("dayChanges looks only at what changed", () => {
    const made = createSet(EMPTY_QUESTIONS, INPUT, at(D1));
    const a = setText(made.q, made.id, "q1a", "Energy is transferred", at(D1)).q;
    assert.deepEqual(dayChanges(a, a), []);
    const b = setText(a, made.id, "q1b", "Particles move faster", at(D2)).q;
    assert.deepEqual(dayChanges(a, b), [D2]);          // q1a is the same object as before: not looked at
  });
});
