import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cardEstimate, FEED_WIDE, indexAt, offsetsOf, rangeOf, withPinned } from "./virtual";

describe("offsets", () => {
  const off = offsetsOf([100, 200, 50, 300]);
  test("prefix sums with the end", () => assert.deepEqual([...off], [0, 100, 300, 350, 650]));
  test("a position falls in the item that holds it", () => {
    assert.equal(indexAt(off, 0), 0);
    assert.equal(indexAt(off, 99.9), 0);
    assert.equal(indexAt(off, 100), 1);
    assert.equal(indexAt(off, 349), 2);
    assert.equal(indexAt(off, 350), 3);
  });
  test("above the list is the first, below it the last, an empty list is none", () => {
    assert.equal(indexAt(off, -50), 0);
    assert.equal(indexAt(off, 9999), 3);
    assert.equal(indexAt(offsetsOf([]), 10), -1);
  });
  test("a span gives the items that touch it, to one past", () => {
    assert.deepEqual(rangeOf(off, 0, 100), { from: 0, to: 1 });
    assert.deepEqual(rangeOf(off, 50, 120), { from: 0, to: 2 });
    assert.deepEqual(rangeOf(off, 300, 340), { from: 2, to: 3 });
    assert.deepEqual(rangeOf(off, 340, 9999), { from: 2, to: 4 });
  });
  test("a span past the end still holds the last item; above the top starts at 0", () => {
    assert.deepEqual(rangeOf(off, 5000, 6000), { from: 3, to: 4 });
    assert.deepEqual(rangeOf(off, -500, 10), { from: 0, to: 1 });
    assert.deepEqual(rangeOf(offsetsOf([]), 0, 100), { from: 0, to: 0 });
  });
  test("a long list is found by search, and each lookup agrees with a scan", () => {
    const h = Array.from({ length: 2666 }, (_, i) => 300 + (i % 7) * 40);
    const o = offsetsOf(h);
    for (const y of [0, 1, 12345, 500000, o[2666] - 1]) {
      let k = 0;
      while (k + 1 < 2666 && o[k + 1] <= y) k++;
      assert.equal(indexAt(o, y), k);
    }
  });
});

describe("an item with the keyboard stays drawn", () => {
  const r = { from: 20, to: 30 };
  test("inside or far away: the range is as it was", () => {
    assert.deepEqual(withPinned(r, 25, 100), r);
    assert.deepEqual(withPinned(r, null, 100), r);
    assert.deepEqual(withPinned(r, 80, 100), r);
    assert.deepEqual(withPinned(r, 2, 100), r);
  });
  test("just outside: the range stretches to it", () => {
    assert.deepEqual(withPinned(r, 15, 100), { from: 15, to: 30 });
    assert.deepEqual(withPinned(r, 33, 100), { from: 20, to: 34 });
  });
});

describe("a card's height before it has been drawn", () => {
  const p = { w: 1086, h: 400, m: 3, k: undefined, er: undefined };
  test("taller for a taller picture, and for a mouse's Write on the question button", () => {
    assert.ok(cardEstimate({ ...p, h: 800 }, 1180) > cardEstimate(p, 1180));
    assert.equal(cardEstimate(p, 1180, false, true) - cardEstimate(p, 1180, false, false), 54);
  });
  test("a closed card shows two buttons, not a space sized to the marks: the marks do not change it", () => {
    assert.equal(cardEstimate({ ...p, m: 8 }, 1180), cardEstimate(p, 1180));
    assert.equal(cardEstimate({ ...p, k: "B" }, 1180), cardEstimate(p, 1180));
  });
  test("the layouts add up as they were measured on drawn cards (AQA GCSE Maths: the card is the picture plus 266 wide with a mouse, plus 212 + 206 + 52 upright, plus 212 + 229 + 52 on a phone)", () => {
    const m = { w: 1000, h: 400, m: 1, er: 1 as const };
    const pic = (listW: number) => (listW - 38) * 0.4;
    assert.equal(cardEstimate(m, 820), Math.round(pic(820) + 212 + 206 + 52));
    assert.equal(cardEstimate(m, 390), Math.round(pic(390) + 212 + 229 + 52));
    assert.equal(cardEstimate(m, 1184, false, true), Math.round(Math.max(330, (1184 - 468 - 38) * 0.4 + 266)));
  });
  test("a narrow list folds the meta above the picture, so it is taller than the same card wide", () => {
    assert.ok(cardEstimate(p, FEED_WIDE - 1) > cardEstimate(p, FEED_WIDE + 200));
  });
  test("never nonsense for a part with no size", () => {
    const n = cardEstimate({ w: 0, h: 0, m: null }, 390);
    assert.ok(n > 200 && n < 2000);
  });
});
