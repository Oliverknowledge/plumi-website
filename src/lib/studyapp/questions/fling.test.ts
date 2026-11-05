import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addSample, coastStep, flingSpeed, type FlingSample } from "./fling";

/** A finger going up the screen: `n` moves of `step` px, `gap` ms apart. */
const drag = (n: number, step: number, gap: number, from = 500, at = 0) => {
  const s: FlingSample[] = [];
  addSample(s, from, at);
  for (let i = 1; i <= n; i++) addSample(s, from - i * step, at + i * gap);
  return s;
};
/** How far a coast from this speed goes in all, at this frame length. */
const distance = (speed: number, frame: number) => {
  let v = speed, total = 0;
  for (let i = 0; i < 2000 && Math.abs(v) > 0.001; i++) { const c = coastStep(v, frame); total += c.move; v = c.speed; }
  return total;
};
const lastT = (s: FlingSample[]) => s[s.length - 1].t;

describe("the speed of a flick", () => {
  test("is the finger's own: 20 px every 16 ms is 1.25 px/ms", () => {
    const s = drag(8, 20, 16);
    assert.ok(Math.abs(flingSpeed(s, lastT(s) + 8) - 1.25) < 0.01);
  });
  test("moves delivered together don't read as an enormous speed", () => {
    const s = drag(8, 20, 1);
    assert.ok(flingSpeed(s, lastT(s) + 1) <= 4);
  });
  test("a finger that stopped before lifting doesn't coast", () => {
    const s = drag(8, 20, 16);
    assert.equal(flingSpeed(s, lastT(s) + 400), 0);
  });
  test("is read from the end of the drag: a fast start and a slow finish is slow", () => {
    const s = drag(10, 40, 16);
    const y = s[s.length - 1].y, t = lastT(s);
    for (let i = 1; i <= 12; i++) addSample(s, y - i, t + i * 16);
    assert.ok(flingSpeed(s, lastT(s) + 8) < 0.2);
  });
  test("goes the other way up the page too, and is capped both ways", () => {
    const s = drag(8, -200, 16);
    assert.equal(flingSpeed(s, lastT(s) + 8), -4);
  });
  test("a touch with no movement doesn't coast", () => {
    assert.equal(flingSpeed([], 10), 0);
    assert.equal(flingSpeed([{ y: 10, t: 0 }], 1), 0);
  });
});

describe("the coast", () => {
  test("the hardest flick travels about a screen, not the whole paper", () => {
    assert.ok(distance(4, 16) < 1000);
  });
  test("goes the same distance at 60 Hz and 120 Hz", () => {
    const a = distance(2, 1000 / 60), b = distance(2, 1000 / 120);
    assert.ok(Math.abs(a - b) < 1);
  });
  test("a long frame moves no further than a 50 ms one", () => {
    assert.equal(coastStep(2, 5000).move, coastStep(2, 50).move);
  });
});
