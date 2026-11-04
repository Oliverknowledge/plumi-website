import assert from "node:assert/strict";
import { test } from "node:test";
import { focusLine } from "./focusLine";

test("the line says what they are on and the clock, and nothing when no session is running", () => {
  assert.equal(focusLine("work", "Physics", "12:34"), "Focusing on Physics, 12:34");
  assert.equal(focusLine("work", null, "1h05"), "Focusing, 1h05");
  assert.equal(focusLine("paused", "Maths", "3:00"), "Paused on Maths, 3:00");
  assert.equal(focusLine("break", "Maths", "4:59"), "On a break, 4:59");
  assert.equal(focusLine("setup", "Maths", "0:00"), null);
  assert.equal(focusLine("over", "Maths", "0:00"), null);
});
test("no em dashes in anything a student reads", () => {
  for (const v of ["work", "paused", "break"] as const) assert.doesNotMatch(focusLine(v, "Physics", "1:00")!, /[–—]/);
});
