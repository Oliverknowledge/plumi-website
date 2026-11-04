import assert from "node:assert/strict";
import { test } from "node:test";
import { INTENT_MS, clearFocusIntent, isFresh, peekFocusIntent, setFocusIntent } from "./focusIntent";

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
