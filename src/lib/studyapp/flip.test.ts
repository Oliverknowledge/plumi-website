import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { afterGrade, canGrade, FRESH, isShown, keyAction, show, toggle, turnBack } from "./flip";

describe("turning a card over and back", () => {
  it("toggles freely between question and answer until it is graded", () => {
    let s = FRESH;
    assert.equal(isShown(s, "c1"), false, "a card starts on its question");
    for (let i = 0; i < 5; i++) {
      s = toggle(s, "c1");
      assert.equal(isShown(s, "c1"), true);
      s = toggle(s, "c1");
      assert.equal(isShown(s, "c1"), false);
    }
  });
  it("turning back keeps the card on the desk and changes nothing else", () => {
    const shown = show(FRESH, "c1");
    const back = turnBack(shown, "c1");
    assert.deepEqual(back, { pinned: "c1", shownId: null });
    assert.equal(turnBack(back, "c1"), back, "turning back twice is a no-op");
    assert.equal(turnBack(shown, "c2"), shown, "a stale card id changes nothing");
  });
  it("only an answer that is showing can be graded, also after turning back", () => {
    assert.equal(canGrade(FRESH, "c1"), false);
    const shown = show(FRESH, "c1");
    assert.equal(canGrade(shown, "c1"), true);
    assert.equal(canGrade(turnBack(shown, "c1"), "c1"), false);
    assert.equal(canGrade(shown, "c2"), false, "not another card");
    assert.equal(canGrade(shown, null), false);
  });
  it("grading resets: the next card starts on its question", () => {
    const next = afterGrade();
    assert.equal(isShown(next, "c2"), false);
    assert.equal(isShown(next, "c1"), false);
    assert.equal(next.pinned, null);
  });
});

describe("keys on the desk", () => {
  const ctx = (o: Partial<{ hasCard: boolean; shown: boolean; repeat: boolean; onButton: boolean }> = {}) => ({ hasCard: true, shown: false, repeat: false, onButton: false, ...o });
  it("Space and Enter turn the card over, and back", () => {
    for (const key of [" ", "Enter"]) {
      assert.deepEqual(keyAction(key, ctx()), { kind: "flip" });
      assert.deepEqual(keyAction(key, ctx({ shown: true })), { kind: "flip" }, "also from the answer");
    }
  });
  it("not when held down, with no card, or on a focused button (which presses itself)", () => {
    assert.equal(keyAction(" ", ctx({ repeat: true })), null);
    assert.equal(keyAction(" ", ctx({ hasCard: false })), null);
    assert.equal(keyAction("Enter", ctx({ onButton: true, shown: true })), null);
  });
  it("1 to 4 grade only while the answer shows", () => {
    assert.equal(keyAction("3", ctx()), null);
    assert.deepEqual(keyAction("3", ctx({ shown: true })), { kind: "grade", grade: 3 });
    assert.deepEqual(keyAction("1", ctx({ shown: true })), { kind: "grade", grade: 1 });
    assert.equal(keyAction("5", ctx({ shown: true })), null);
    assert.equal(keyAction("a", ctx({ shown: true })), null);
  });
});
