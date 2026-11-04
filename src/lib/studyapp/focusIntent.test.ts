import assert from "node:assert/strict";
import { test } from "node:test";
import { INTENT_MS, SEAT_KEY, clearFocusIntent, clearFromSeat, isFresh, markFromSeat, peekFocusIntent, seatNoteStands, setFocusIntent, tidySeatNote } from "./focusIntent";

test("an intent is fresh for a minute, never from the future, and null is nothing", () => {
  assert.ok(isFresh({ subject: "physics", at: 1000 }, 1000));
  assert.ok(isFresh({ subject: null, at: 1000 }, 1000 + INTENT_MS));
  assert.ok(!isFresh({ subject: "physics", at: 1000 }, 1001 + INTENT_MS));
  assert.ok(!isFresh({ subject: "physics", at: 1000 }, 999));
  assert.ok(!isFresh(null, 5));
});
test("it is looked at without being taken, until it is cleared or a minute has gone", () => {
  setFocusIntent("maths", 10_000);
  assert.equal(peekFocusIntent(10_500)?.subject, "maths");
  assert.equal(peekFocusIntent(10_600)?.subject, "maths");           // a page that builds twice still finds it
  assert.equal(peekFocusIntent(10_000 + INTENT_MS + 1), null);
  setFocusIntent(null, 20_000);
  assert.deepEqual(peekFocusIntent(20_001), { subject: null, at: 20_000 });   // "Focus" with no subject is an intent too
  clearFocusIntent();
  assert.equal(peekFocusIntent(20_002), null);
});

test("a seat note stands only for the session it was made for: none, stopped, finished or another session and it does not", () => {
  assert.ok(seatNoteStands("t_1", { id: "t_1", isOver: false }));
  assert.ok(!seatNoteStands("t_1", { id: "t_1", isOver: true }));      // stopped or finished
  assert.ok(!seatNoteStands("t_1", { id: "t_2", isOver: false }));     // a new session started elsewhere
  assert.ok(!seatNoteStands("t_1", null));                             // no session
  assert.ok(!seatNoteStands(null, { id: "t_1", isOver: false }));      // no note
});
test("the note is forgotten when the session stops and when the session changes, and kept while it is the same one running", () => {
  const store = new Map<string, string>();
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = { sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } } };
  try {
    markFromSeat("t_1");
    tidySeatNote({ id: "t_1", isOver: false });
    assert.equal(store.get(SEAT_KEY), "t_1");                          // same session still running: kept
    tidySeatNote({ id: "t_1", isOver: true });                         // Stop
    assert.equal(store.has(SEAT_KEY), false);
    markFromSeat("t_1");
    tidySeatNote({ id: "t_2", isOver: false });                        // started again from the Desk chip: a different session
    assert.equal(store.has(SEAT_KEY), false);
    markFromSeat("t_3");
    tidySeatNote(null);                                                // the session was put away
    assert.equal(store.has(SEAT_KEY), false);
    clearFromSeat();
  } finally { delete g.window; }
});
