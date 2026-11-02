/**
 * The town's ambient life (src/components/town/ambient.ts): the hour's tint, the leaves (0 to 30, none under reduced motion), the chimneys and lamps found in the map,
 * and that a frame of it allocates nothing (the loop must not).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { Ambient, MAX_LEAVES, TINT } from "../../components/town/ambient";
import { TOWN_DATA_URL } from "./assets.generated";
import { allObjects } from "./objects";
import type { TownData } from "./types";

const data = JSON.parse(readFileSync(new URL("../../../public" + TOWN_DATA_URL, import.meta.url), "utf8")) as TownData;
const objs = allObjects(data);
const view = { x: 1000, y: 600, w: 427, h: 267 };

describe("ambient", () => {
  it("has a tint for dawn, evening and night and none by day (the library's hours)", () => {
    assert.equal(TINT.day, null);
    for (const t of ["dawn", "evening", "night"] as const) assert.ok(TINT[t] && TINT[t]!.glow > 0);
    assert.ok(TINT.night!.glow > TINT.evening!.glow && TINT.evening!.glow > TINT.dawn!.glow);
  });
  it("finds a chimney on every cottage and the bakery, and the lamps, in the real map", () => {
    const a = new Ambient(objs, data.sprites, false, "day");
    assert.equal(a.chimneys.length / 2, 18 + 1);
    assert.ok(a.lamps.length / 2 >= 20);
  });
  it("keeps 8 to 30 leaves in view, none when motion is reduced, and a leaf is recycled when it leaves the bottom", () => {
    const a = new Ambient(objs, data.sprites, false, "day"), r = new Ambient(objs, data.sprites, true, "day");
    assert.ok(a.targetLeaves(view) >= 8 && a.targetLeaves(view) <= MAX_LEAVES);
    assert.equal(a.targetLeaves({ x: 0, y: 0, w: 5000, h: 5000 }), MAX_LEAVES);
    assert.equal(r.targetLeaves(view), 0);
    for (let i = 0; i < 600; i++) a.update(1 / 60, view);           // ten seconds: they fall and come back
    let alive = 0; const L = (a as unknown as { leaves: Float32Array }).leaves, n = (a as unknown as { nLeaves: number }).nLeaves;
    for (let i = 0; i < n; i++) if (L[i * 6 + 1] > view.y - 90 && L[i * 6 + 1] < view.y + view.h + 8) alive++;
    assert.equal(alive, n);
  });
  it("draws a frame of smoke and leaves without allocating, and under reduced motion draws nothing", () => {
    let calls = 0;
    const ctx = new Proxy({}, { get: (_t, k) => (k === "fillRect" ? () => { calls++; } : undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    const a = new Ambient(objs, data.sprites, false, "day");
    const house = objs.find((o) => o.sprite?.startsWith("cottage_"))!;
    const v = { x: house.sx - 100, y: house.sy - 100, w: 427, h: 267 };
    a.update(0.5, v);
    for (let i = 0; i < 100; i++) { a.update(1 / 60, v); a.drawMotion(ctx, 3, 0, 0, v); }       // warm
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 2000; i++) { a.update(1 / 60, v); a.drawMotion(ctx, 3, 0, 0, v); }
    const grew = process.memoryUsage().heapUsed - before;
    assert.ok(calls > 2000, `${calls} fillRects`);
    assert.ok(grew < 4_000_000, `heap grew ${grew} B over 2000 frames`);
    const r = new Ambient(objs, data.sprites, true, "day"); calls = 0; r.update(1, v); r.drawMotion(ctx, 3, 0, 0, v);
    assert.equal(calls, 0);
  });
});
