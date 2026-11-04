import assert from "node:assert/strict";
import { test } from "node:test";
import { makeToastQueue } from "./toastQueue";

test("lines said together arrive as one message, in order", () => {
  const out: string[] = []; const later: (() => void)[] = [];
  const say = makeToastQueue((m) => out.push(m), (f) => later.push(f));
  say("An old set was removed to make room."); say("First 60 questions");
  assert.equal(out.length, 0);
  later.forEach((f) => f());
  assert.deepEqual(out, ["An old set was removed to make room. First 60 questions"]);
});
test("a line said twice is said once, and a later line is its own message", () => {
  const out: string[] = []; const later: (() => void)[] = [];
  const say = makeToastQueue((m) => out.push(m), (f) => later.push(f));
  say("Saved"); say("Saved"); later.splice(0).forEach((f) => f());
  say("Next"); later.splice(0).forEach((f) => f());
  assert.deepEqual(out, ["Saved", "Next"]);
});
