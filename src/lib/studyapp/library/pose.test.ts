/** The walk's pose clock (walk.ts `poseSlot`): at 60 Hz the slots are 5 frames, whatever the frame jitter (movement-verify.md risk 2). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slotLengths } from "./poseSim";
import { POSE_HZ, poseSlot } from "./walk";

describe("the walk's pose slots", () => {
  const frames = (slot: (s: number) => number, jitter: number) => { const l = slotLengths(slot, 60, 30, jitter); return { l, five: l.filter((n) => n === 5).length / l.length }; };
  it("are exactly 5 frames at 60 Hz in at least 90 percent of slots, clean and with 3 ms of jitter", () => {
    assert.equal(POSE_HZ, 12);
    for (const jitter of [0, 1, 3]) { const { l, five } = frames(poseSlot, jitter); assert.ok(l.length > 300 && five >= 0.9, `jitter ${jitter} ms: ${(five * 100).toFixed(0)} percent of ${l.length}`); }
  });
  it("were NOT with the old unbiased clock (the test can fail)", () => {
    const { five } = frames((s) => Math.floor(s * 12), 3);
    assert.ok(five < 0.9, `${(five * 100).toFixed(0)} percent`);
  });
  it("start at slot 0 and count in 12ths of a second", () => {
    assert.equal(poseSlot(0), 0);
    assert.equal(poseSlot(1 / 12 - 0.2 / 12), 0);
    assert.equal(poseSlot(1 / 12), 1);
    assert.equal(poseSlot(1), 12);
  });
});
