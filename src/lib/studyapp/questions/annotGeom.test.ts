import assert from "node:assert/strict";
import { test } from "node:test";
import { fractionOf, toClient, toUnits, unitsPerPx, type Box } from "./annotGeom";
import { cleanInk, encodeStroke, inkIds, strokesToAdd } from "./ink";
import { hasAnn, resetPart, setAnnMeta, feedHolds } from "./model";

const box = (width: number, aspect = 2): Box => ({ left: 10, top: 20, width, height: width / aspect });
const near = (a: number, b: number, e = 0.01) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);

test("a point on the picture is stored in units across its width and read back at any size", () => {
  const p = toUnits(10 + 200, 20 + 50, box(400));         // half way across, a quarter down a 400 x 200 picture
  near(p.x, 400); near(p.y, 100);
  const again = toClient(p, box(400)); near(again.x, 210); near(again.y, 70);
});
test("resizing the picture keeps a mark on the same printed pixel: the same fraction of it", () => {
  const p = toUnits(10 + 120, 20 + 30, box(400));
  const f = fractionOf(p, 2);
  for (const w of [160, 300, 400, 640, 1180]) {
    const c = toClient(p, box(w));
    const back = { x: (c.x - 10) / w, y: (c.y - 20) / (w / 2) };
    near(back.x, f.x, 1e-9); near(back.y, f.y, 1e-9);
  }
});
test("turning the tablet (the picture wide, then narrow, from another offset) keeps the fraction", () => {
  const p = toUnits(100 + 90, 300 + 45, { left: 100, top: 300, width: 300, height: 150 });
  const landscape: Box = { left: 56, top: 140, width: 900, height: 450 };
  const c = toClient(p, landscape);
  near((c.x - 56) / 900, 90 / 300, 1e-9); near((c.y - 140) / 450, 45 / 150, 1e-9);
});
test("the enlarged picture draws the same marks at its own width", () => {
  near(unitsPerPx(800), 1); near(unitsPerPx(1600), 0.5);
  const p = { x: 200, y: 100 };
  near(toClient(p, { left: 0, top: 0, width: 1600, height: 800 }).x, 400);
});
test("a stroke that leaves the picture runs along its edge, so no mark is kept out of sight", () => {
  const p = toUnits(-50, 9999, box(400));
  assert.equal(p.x, 0); assert.equal(p.y, 200 * 2);
  assert.equal(toUnits(9999, -5, box(400)).x, 800);
});
test("marks from two tabs merge by stroke, and a stroke one tab erased stays erased there", () => {
  const a = encodeStroke([{ x: 1, y: 1, p: 0.5 }, { x: 40, y: 3, p: 0.5 }], 0, 1, true);
  const b = encodeStroke([{ x: 5, y: 50, p: 0.5 }, { x: 90, y: 60, p: 0.5 }], 1, 1, true);
  assert.equal(strokesToAdd([a], [a, b]).length, 1);
  assert.equal(strokesToAdd([a, b], [a, b]).length, 0);
  assert.equal(strokesToAdd([a], [a, b], new Set(inkIds([b]))).length, 0);   // seen and erased here: not brought back
  assert.equal(cleanInk([a, b, "junk"]).length, 2);
});
test("marks on a question are their own count: not an answer, not marked, not cleared by Reset, and a part with them is held", () => {
  const set = { id: "s", parts: [{ id: "p" }] };
  const q = { sets: [set], answers: {}, recent: [] } as never;
  const r = setAnnMeta(q, "s", "p", 3, 400, 1);
  const a = r.answers["s/p"];
  assert.equal(a.ann?.n, 3); assert.equal(a.ink, undefined); assert.equal(a.text, undefined);
  assert.ok(hasAnn(a)); assert.ok(feedHolds(a));
  const reset = resetPart(r, "s", "p", 2) as { answers: Record<string, { ann?: { n: number } }> };
  assert.equal(reset.answers["s/p"].ann?.n, 3);
  const none = setAnnMeta(r, "s", "p", 0, 0, 3) as { answers: Record<string, { ann?: unknown }> };
  assert.equal(none.answers["s/p"].ann, undefined);
});

import { inkBytesOf, inkOfSet, inkTotal } from "./model";
test("the bytes of marks on a question count towards the device's room and a set's size", () => {
  const q = { answers: { "s/p": { at: 1, ink: { n: 2, b: 100 }, ann: { n: 3, b: 40 } }, "s/r": { at: 1, ann: { n: 1, b: 10 } }, "t/p": { at: 1, ink: { n: 1, b: 7 } } } } as never;
  assert.equal(inkBytesOf({ at: 1, ink: { n: 1, b: 5 }, ann: { n: 1, b: 6 } } as never), 11);
  assert.equal(inkTotal(q), 157);
  assert.equal(inkOfSet(q, "s"), 150);
});
