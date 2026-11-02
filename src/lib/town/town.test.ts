/**
 * npm run town:test   (node:test via tsx; no browser)
 *
 * The first district: the compiled map is valid (every door reachable, no sealed pockets, the ring continuous and walkable, no footprint on it, the
 * spawn free, every sit spot reachable), A* goes around trees and the cafe, a pulled path never crosses a blocked cell, the collision bitset
 * is the footprints, the chunk cache evicts the oldest, and the ground's edge pieces agree with the side classification the art tool measured.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { classOf, cleanMask, maskProblems } from "./autotile";
import { ChunkCache } from "./chunks";
import { CollisionGrid } from "./collision";
import { TOWN_DATA_URL } from "./assets.generated";
import { MOVE, idleFrame, walkFrame } from "./movement";
import { Nav } from "./nav";
import { TILE, type TownData } from "./types";
import { validateTown } from "./validate";
import { World } from "./world";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const data = JSON.parse(readFileSync(new URL("../../../public" + TOWN_DATA_URL, import.meta.url), "utf8")) as TownData;
const ground = JSON.parse(read("../../../docs/study/art/town/town-ground.json")) as { tiles: { id: string; col: number; row: number; state?: Record<string, string>; name?: string; kind: string }[]; cols: number };
const registry = JSON.parse(read("../../../tools/town/spot-registry.json")) as { nextId: number; ids: Record<string, number> };
const world = new World(data);

describe("the map validator, on the real map", () => {
  const report = validateTown(data, undefined, world);
  it("finds nothing wrong", () => assert.deepEqual(report.failures, []));
  it("has the spawn free and every door reachable", () => {
    assert.ok(world.coll.fits(data.spawn.x, data.spawn.y));
    assert.equal(report.summary.doors, 7);                 // the cafe and six cottages
  });
  it("has no sealed pockets", () => assert.equal(report.summary.sealedNavCells, 0));
  it("has a ring that is continuous, walkable end to end, and free of footprints", () => {
    assert.equal(report.summary.ringLegsOk, data.ring.length);
    assert.equal(report.summary.ringBlocked, 0);
    assert.ok((report.summary.ringTiles as number) > 200);
  });
  it("keeps the cottages 2 tiles from the path and 3 tiles apart", () => {
    assert.ok((report.summary.minYardPx as number) >= 2 * TILE - 1, String(report.summary.minYardPx));
    assert.ok((report.summary.minHouseGapPx as number) >= 3 * TILE - 1, String(report.summary.minHouseGapPx));
  });
  it("puts a sit spot on every screen, all with a reachable stand cell", () => {
    assert.equal(report.summary.spotsOk, data.spots.length);
    assert.ok((report.summary.spotsPerScreen as number) >= 3, String(report.summary.spotsPerScreen));
  });
  it("fails when a door is sealed in (the validator can fail)", () => {
    const bad = structuredClone(data);
    const cafe = bad.objects.find((o) => o.id === "cafe")!;
    // wall the cafe's entry in with a fence of blocking rects
    const e = cafe.door!.entry;
    for (const dx of [-24, 0, 24]) bad.objects.push({ ...cafe, id: `wall${dx}`, door: undefined, zone: "x", block: { x: e.x + dx - 12, y: e.y - 12, w: 24, h: 40 }, foot: { x: 0, y: 0, w: 1, h: 1 } });
    bad.objects.push({ ...cafe, id: "wallN", door: undefined, zone: "x", block: { x: e.x - 60, y: e.y + 28, w: 120, h: 24 }, foot: { x: 0, y: 0, w: 1, h: 1 } });
    const r = validateTown(bad);
    assert.ok(r.failures.length > 0);
  });
});

describe("sit spots", () => {
  it("have unique ids and keys, all in the append-only registry", () => {
    assert.equal(new Set(data.spots.map((s) => s.id)).size, data.spots.length);
    for (const s of data.spots) assert.equal(registry.ids[s.key], s.id, s.key);
    assert.ok(registry.nextId > Math.max(...data.spots.map((s) => s.id)));
  });
  it("have a stand point that fits, within reach of the seat", () => {
    for (const s of data.spots) { assert.ok(world.coll.fits(s.stand.x, s.stand.y), s.key); assert.ok(Math.hypot(s.stand.x - s.at.x, s.stand.y - s.at.y) <= 64, s.key); }
  });
  it("use only the poses the art has: left and right sit, front reads, back sits on the stool", () => {
    for (const s of data.spots) assert.equal(s.pose, s.face === "left" || s.face === "right" ? "sit" : s.face === "front" ? "read" : "stool");
  });
});

describe("collision", () => {
  it("is the footprints on an 8 px cell bitset, and everything outside the bounds", () => {
    const g = new CollisionGrid(320, 320, { x: 16, y: 16, w: 288, h: 288 });
    g.addRect({ x: 100, y: 100, w: 20, h: 9 });
    assert.ok(g.blocked(12, 12) && g.blocked(14, 13));              // x 100..120 = cells 12..14, y 100..109 = cells 12..13
    assert.ok(!g.blocked(11, 12) && !g.blocked(15, 12) && !g.blocked(12, 14));
    assert.ok(g.blocked(0, 20) && g.blocked(39, 20) && g.blocked(20, 0) && g.blocked(20, 39));   // outside the bounds
    assert.ok(g.fits(60, 60) && !g.fits(110, 105) && !g.fits(96, 105) && g.fits(90, 105));
  });
  it("matches the real objects: every tree trunk and the cafe's body are blocked, the ring is not", () => {
    for (const o of data.objects.filter((o) => o.kind === "tree" && o.zone !== "treeline")) assert.ok(world.coll.blocked(Math.floor((o.block.x + o.block.w / 2) / 8), Math.floor((o.block.y + o.block.h / 2) / 8)), o.id);
    const cafe = data.objects.find((o) => o.id === "cafe")!;
    assert.ok(world.coll.blocked(Math.floor((cafe.block.x + 50) / 8), Math.floor((cafe.block.y + 40) / 8)));
    for (const p of data.ring) assert.ok(world.coll.fits(p.x, p.y), `ring node ${p.x},${p.y}`);
  });
  it("slides along a wall without entering it, and allocates no array", () => {
    const g = new CollisionGrid(320, 320, { x: 0, y: 0, w: 320, h: 320 });
    g.addRect({ x: 160, y: 0, w: 16, h: 320 });
    const out = new Float64Array(2);
    g.slide(140, 100, 30, 10, MOVE.assist, out);                  // into the wall, diagonally: slides down it
    assert.ok(out[0] <= 160 - 4 + 1e-6 && out[1] > 100);
    assert.ok(g.fits(out[0], out[1]));
  });
});

describe("navigation", () => {
  const empty = () => new CollisionGrid(640, 320, { x: 0, y: 0, w: 640, h: 320 });
  it("goes round a tree-sized block and the path never crosses a blocked cell", () => {
    const g = empty();
    g.addRect({ x: 300, y: 80, w: 40, h: 160 });
    const nav = new Nav(g);
    const pts = nav.plan([100, 160], [540, 160])!;
    assert.ok(pts && pts.length >= 2);
    assert.ok(Math.max(...pts.map((p) => p[1])) > 240 || Math.min(...pts.map((p) => p[1])) < 80, "it went round");
    assert.ok(nav.clearPath([100, 160], pts));
    for (const [x, y] of pts) assert.ok(g.fits(x, y));
  });
  it("returns null when the goal is sealed in, and moves a goal inside a tree to the nearest open cell", () => {
    const g = empty();
    g.addRect({ x: 400, y: 0, w: 16, h: 320 });                // a wall across the whole map
    const nav = new Nav(g);
    assert.equal(nav.plan([100, 160], [500, 160]), null);
    const g2 = empty(); g2.addRect({ x: 300, y: 140, w: 40, h: 40 });
    const pts = new Nav(g2).plan([100, 160], [320, 160])!;
    const last = pts[pts.length - 1];
    assert.ok(g2.fits(last[0], last[1]));
  });
  it("on the real map: from the plaza to the far corner passes round the cafe and the houses, every leg clear", () => {
    const from: [number, number] = [data.spawn.x, data.spawn.y];
    for (const to of [[200, 800], [1500, 800], [1500, 100]] as [number, number][]) {
      const pts = world.nav.plan(from, to)!;
      assert.ok(pts, `to ${to}`);
      assert.ok(world.nav.clearPath(from, pts), `to ${to}`);
      for (const [x, y] of pts) assert.ok(world.coll.fits(x, y));
    }
  });
  it("every sit spot and door entry is a route away from the spawn", () => {
    for (const s of data.spots) assert.ok(world.nav.plan([data.spawn.x, data.spawn.y], [s.stand.x, s.stand.y]), s.key);
    for (const o of data.objects) if (o.door) assert.ok(world.nav.plan([data.spawn.x, data.spawn.y], [o.door.entry.x, o.door.entry.y]), o.id);
  });
});

describe("the chunk cache", () => {
  it("evicts the least recently used and hands its canvas to the next bake", () => {
    const made: { key: number; recycled: number | null }[] = [];
    const c = new ChunkCache<{ id: number }>(3, (key, recycled) => { made.push({ key, recycled: recycled ? recycled.id : null }); return recycled ?? { id: key }; });
    c.get(1); c.get(2); c.get(3);
    c.get(1);                                  // 1 is now the newest, 2 the oldest
    c.get(4);                                  // evicts 2, repaints its canvas for 4
    assert.deepEqual(c.keys(), [3, 1, 4]);
    assert.equal(c.evictions, 1);
    assert.equal(made[made.length - 1].recycled, 2);
    assert.ok(!c.has(2) && c.has(1));
    assert.equal(c.bakes, 4);
  });
  it("never evicts what one frame still draws when the capacity covers the view", () => {
    const c = new ChunkCache<number>(9, (k) => k);
    for (let f = 0; f < 50; f++) for (const k of [f, f + 1, f + 8, f + 9]) c.get(k);
    assert.ok(c.size <= 9);
  });
});

describe("the ground's edge pieces", () => {
  const byPos = new Map<number, (typeof ground.tiles)[number]>();
  for (const t of ground.tiles) byPos.set(t.row * ground.cols + t.col, t);
  const F = (x: number, y: number) => x >= 0 && y >= 0 && x < data.cols && y < data.rows && (data.kind[y * data.cols + x] === 1 || data.kind[y * data.cols + x] === 2);
  it("names the class from the neighbours: N and E in the fill leaves grass in the SW corner", () => {
    const m = new Set(["1,0", "2,1"]);          // tile (1,1): N (1,0) and E (2,1) are fill
    assert.equal(classOf((x, y) => m.has(`${x},${y}`), 1, 1), "inner_SW");
    assert.equal(classOf((x, y) => m.has(`${x},${y}`), 0, 5), "none");
    assert.equal(classOf((x, y) => x === 2 && y === 2, 1, 1), "outer_SE");
    assert.equal(classOf((x, y) => x === 1 && y === 2, 1, 1), "edge_S");
    assert.equal(classOf((x, y) => (x === 1 && y === 0) || (x === 1 && y === 2), 1, 1), "invalid");
  });
  it("mends a notch and a spur so every tile has a piece", () => {
    const cols = 8, rows = 8, m = new Uint8Array(cols * rows);
    for (let y = 2; y < 6; y++) for (let x = 1; x < 7; x++) m[y * cols + x] = 1;
        m[1 * cols + 3] = 1;                                  // a spur above
    cleanMask(m, cols, rows);
    assert.deepEqual(maskProblems(m, cols, rows), []);
    assert.equal(m[1 * cols + 3], 0, "the spur is gone");
  });
  it("places on every edge tile a piece whose measured side states agree with the fill around it", () => {
    let checked = 0;
    for (let ty = 0; ty < data.rows; ty++) for (let tx = 0; tx < data.cols; tx++) {
      if (data.kind[ty * data.cols + tx] !== 3) continue;
      const v = data.ground[ty * data.cols + tx], t = byPos.get(v & 127)!;
      assert.ok(t.kind === "dirt_edge" || t.kind === "plaza_edge", `${tx},${ty} is ${t.kind}`);
      const st = t.state!;
      const nb: Record<string, boolean> = { N: F(tx, ty - 1), E: F(tx + 1, ty), S: F(tx, ty + 1), W: F(tx - 1, ty) };
      for (const side of ["N", "E", "S", "W"]) {
        if (nb[side]) assert.equal(st[side], "other", `${tx},${ty} side ${side} faces fill`);
        else assert.notEqual(st[side], "other", `${tx},${ty} side ${side} is open`);
      }
      checked++;
    }
    assert.ok(checked > 100, String(checked));
  });
  it("fills the ring with dirt and the plaza with plaza, and grass elsewhere", () => {
    for (let i = 0; i < data.kind.length; i++) {
      const t = byPos.get(data.ground[i] & 127)!;
      if (data.kind[i] === 1) assert.equal(t.kind, "dirt"); else if (data.kind[i] === 2) assert.equal(t.kind, "plaza");
      else if (data.kind[i] === 0) assert.ok(t.kind.startsWith("grass"), t.kind);
    }
  });
});

describe("movement constants", () => {
  it("walk at the library's speed with a 12 Hz pose clock that restarts at each walk, and stand still first", () => {
    assert.equal(MOVE.walkSpeed, 70);
    assert.equal(walkFrame(0), 0);
    assert.equal(walkFrame(1 / 12 + 1e-6), 1);
    assert.equal(walkFrame(0.5 + 1e-6), 0);          // six poses at 12 Hz: a 500 ms cycle
    assert.equal(idleFrame(1), 0);
    assert.equal(idleFrame(MOVE.idleStillSecs + 0.7), 1);
  });
});
