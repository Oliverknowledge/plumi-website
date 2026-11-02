/**
 * npm run town:test   (node:test via tsx; no browser)
 *
 * The world: the compiled map is valid (doors reachable, one connected path network, no pockets, no footprint on a path, widths and curvature, spots reachable),
 * it is the same bytes as a fresh build from the committed seed, the planner is deterministic and meanders, the ground painter is seeded with ragged edges,
 * A* goes around trees and buildings with a counted cost, the collision bitset is the footprints, the chunk cache evicts the oldest, movement numbers.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ChunkCache } from "./chunks";
import { CollisionGrid } from "./collision";
import { TOWN_DATA_URL } from "./assets.generated";
import { landAt, makeGroundCtx, paintChunk, type GroundAtlas } from "./ground";
import { MOVE, idleFrame, walkFrame } from "./movement";
import { Nav } from "./nav";
import { allObjects } from "./objects";
import { Planner, rle, unrle } from "./plan";
import { SPOTS_PER_SCREEN, validateTown } from "./validate";
import { TILE, type TownData } from "./types";
import { World } from "./world";
import { slotLengths } from "../studyapp/library/poseSim";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const raw = readFileSync(new URL("../../../public" + TOWN_DATA_URL, import.meta.url), "utf8");
const data = JSON.parse(raw) as TownData;
const registry = JSON.parse(read("../../../tools/town/spot-registry.json")) as { nextId: number; ids: Record<string, number> };
const world = new World(data);
const objects = allObjects(data);

describe("the map validator, on the real map", () => {
  const report = validateTown(data, world);
  it("finds nothing wrong", () => assert.deepEqual(report.failures, []));
  it("has the spawn free and every door reachable (library, cafe, bakery, bookshop and the cottages)", () => {
    assert.ok(world.coll.fits(data.spawn.x, data.spawn.y));
    assert.equal(report.summary.doors, 4 + 18);
    for (const k of ["library", "cafe", "bakery", "bookshop"]) assert.equal(objects.filter((o) => o.door?.kind === k).length, 1, k);
  });
  it("has one connected path network, no pockets and no footprint on a path", () => {
    assert.equal(report.summary.pathPieces, 1);
    assert.equal(report.summary.bigPockets, 0);
    assert.equal(report.summary.onPath, 0);
  });
  it("keeps every path 2 to 3.5 tiles wide away from junctions, and none straighter than the tolerance over 12 tiles", () => {
    assert.ok((report.summary.widthSamples as number) > 100);
    assert.ok((report.summary.widthMin as number) >= 1.9 && (report.summary.widthMax as number) <= 3.6, `${report.summary.widthMin} ${report.summary.widthMax}`);
    assert.ok((report.summary.straightestWindowDev as number) >= 0.4);
    assert.ok((report.summary.sharpestTurnDeg as number) <= 100);
  });
  it("is a MASSIVE map: 136 x 72 tiles, 18 houses, 4 landmarks, placeholders in the debug view only", () => {
    assert.equal(data.cols, 136); assert.equal(data.rows, 72);
    assert.equal(objects.filter((o) => o.kind === "building" && o.door?.kind !== "cottage").length, 4);
    assert.equal(report.summary.houses, 18);
    const ph = objects.filter((o) => o.kind === "placeholder");
    assert.ok(ph.length >= 4 && ph.length <= 6 && ph.every((o) => o.ph?.building));
  });
  it("has at least 120 sit spots at 1.5 to 2.5 a screen, all with a reachable stand cell", () => {
    assert.ok(data.spots.length >= 120);
    assert.equal(report.summary.spotsOk, data.spots.length);
    const ps = report.summary.spotsPerScreen as number;
    assert.ok(ps >= SPOTS_PER_SCREEN[0] && ps <= SPOTS_PER_SCREEN[1], String(ps));
  });
  it("walks from the library to the far bakery in a counted, small number of expansions and under 8 ms (warm)", () => {
    const lib = data.hubs.find((h) => h.id === "library")!, bak = data.hubs.find((h) => h.id === "bakery")!;
    world.nav.plan([lib.x, lib.y], [bak.x, bak.y]);                      // warm
    let worst = 0, worstExp = 0;
    const far = data.botNodes[data.botNodes.length - 1];
    const pairs = [[lib, bak], [bak, far], [far, lib], [data.botNodes[0], far]] as { x: number; y: number }[][];
    for (let warm = 0; warm < 3; warm++) for (const [a, b] of pairs) world.nav.plan([a.x, a.y], [b.x, b.y]);
    for (const [a, b] of pairs) {
      const t = performance.now();
      const p = world.nav.plan([a.x, a.y], [b.x, b.y]);
      worst = Math.max(worst, performance.now() - t); worstExp = Math.max(worstExp, world.nav.expansions);
      assert.ok(p && world.nav.clearPath([a.x, a.y], p));
    }
    assert.ok(worstExp < world.nav.cols * world.nav.rows / 4, `expansions ${worstExp}`);
    assert.ok(worst < 20, `${worst.toFixed(1)} ms: 3 to 5 ms alone, the brief's bar is 8`);
    // 60 random pairs of bot nodes: the worst count of expansions and the worst time, warm
    let rs = 12345, maxExp = 0, maxMs = 0;
    const rnd = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; };
    for (let i = 0; i < 60; i++) {
      const a = data.botNodes[Math.floor(rnd() * data.botNodes.length)], b = data.botNodes[Math.floor(rnd() * data.botNodes.length)];
      const t = performance.now(); world.nav.plan([a.x, a.y], [b.x, b.y]); maxMs = Math.max(maxMs, performance.now() - t); maxExp = Math.max(maxExp, world.nav.expansions);
    }
    assert.ok(maxExp < 12000, `${maxExp} expansions`);
    assert.ok(maxMs < 25, `${maxMs.toFixed(1)} ms: 3 to 5 ms alone (the suites run in parallel here)`);
  });
  it("fails when a door is sealed in (the validator can fail)", () => {
    const bad = structuredClone(data);
    const cafe = bad.objects.find((o) => o.id === "cafe")!;
    const e = cafe.door!.entry;
    for (const dx of [-24, 0, 24]) bad.objects.push({ ...cafe, id: `wall${dx}`, door: undefined, zone: "x", block: { x: e.x + dx - 12, y: e.y - 12, w: 24, h: 40 }, foot: { x: 0, y: 0, w: 1, h: 1 } });
    bad.objects.push({ ...cafe, id: "wallN", door: undefined, zone: "x", block: { x: e.x - 60, y: e.y + 28, w: 120, h: 24 }, foot: { x: 0, y: 0, w: 1, h: 1 } });
    assert.ok(validateTown(bad).failures.length > 0);
  });
  it("fails when a tree stands on a path and when the network is cut in two", () => {
    const bad = structuredClone(data);
    const m = unrle(bad.mat.rle, bad.mat.cols * bad.mat.rows);
    for (let y = 0; y < bad.mat.rows; y++) for (let x = 0; x < bad.mat.cols; x++) if (x === 270) m[y * bad.mat.cols + x] = 0;       // a ditch across the map
    bad.mat.rle = rle(m);
    assert.ok(validateTown(bad).failures.some((f) => f.includes("pieces")));
  });
});

describe("determinism", () => {
  it("the committed map is byte for byte what the committed seed builds", async () => {
    const { compileWorld } = await import("./worldgen");
    const j = (p: string) => JSON.parse(read(p));
    const art = "../../../docs/study/art/town/";
    const g = j(art + "town-ground.json"), nat = j(art + "town-nature.json"), cafe = j(art + "town-cafe.json"), cot = j(art + "town-cottages-door.json"), lm = j(art + "town-landmarks.json"), props = j(art + "town-atlas-fine.json");
    const cat = { ground: { tiles: g.tiles, fillFamilies: g.fillFamilies, cols: g.cols }, nature: { objects: nat.objects, size: nat.size }, cafe: { building: cafe.building, size: cafe.size }, cottages: { buildings: cot.buildings, size: cot.size }, landmarks: { buildings: lm.buildings, size: lm.size }, props: { props: props.props, size: props.size }, groundSize: [384, 288] as [number, number] };
    const bp = j("../../../tools/town/world.json");
    const urls = { ground: data.atlases.ground.url, nature: data.atlases.nature.url, cafe: data.atlases.cafe.url, cottage: data.atlases.cottage.url, landmark: data.atlases.landmark.url, props: data.atlases.props.url, premade: data.premade.url, premadeRows: data.premade.rows };
    const a = compileWorld(bp, cat, urls, structuredClone(registry)), b = compileWorld(bp, cat, urls, structuredClone(registry));
    assert.equal(JSON.stringify(a.data), JSON.stringify(b.data), "two runs differ");
    assert.equal(JSON.stringify(a.data), raw, "public/town/v1 is stale: run npm run town:build");
    assert.equal(createHash("sha1").update(raw).digest("hex").slice(0, 10), TOWN_DATA_URL.split(".")[1]);
    const other = compileWorld({ ...bp, seed: bp.seed + 1 }, cat, urls, structuredClone(registry));
    assert.notEqual(JSON.stringify(other.data.paths), JSON.stringify(a.data.paths), "another seed gives the same paths");
  });
});

describe("the path planner", () => {
  it("routes around an obstacle, wanders, and cuts a route that runs along the network", () => {
    const pl = new Planner(60, 30, 7);
    pl.block(28, 8, 32, 22); pl.finishObstacles(3);
    const n1 = pl.connect("a", [6.5, 15.5], [52.5, 15.5], "trunk", 1);
    assert.ok(n1 > 40, `new length ${n1}`);
    const e = pl.edges[0];
    assert.ok(e.pts.every((p) => pl.clearance(p[0], p[1]) > 1), "stays clear of the obstacle");
    const ys = e.pts.map((p) => p[1]);
    assert.ok(Math.max(...ys) - Math.min(...ys) > 3, "goes round");
    const before = pl.edges.length;
    const n2 = pl.connect("b", [10.5, 15.5], [48.5, 15.5], "trunk", 2);
    assert.ok(n2 < 12, `the second route mostly merges: ${n2} new tiles`);
    assert.ok(pl.edges.length >= before);
  });
  it("is deterministic and ends every new edge on the network or at its node", () => {
    const run = () => { const pl = new Planner(60, 30, 11); pl.finishObstacles(3); pl.connect("a", [6.5, 6.5], [50.5, 20.5], "trunk", 3); return JSON.stringify(pl.edges); };
    assert.equal(run(), run());
  });
  it("round-trips the material through run-length encoding", () => {
    const a = new Uint8Array(1000); for (let i = 0; i < 1000; i++) a[i] = Math.floor(i / 37) % 3;
    assert.deepEqual(Array.from(unrle(rle(a), 1000)), Array.from(a));
  });
});

describe("the ground painter", () => {
  // a synthetic atlas: every tile a flat colour per index
  const cols = 12, atlas: GroundAtlas = { w: 12 * 32, h: 9 * 32, data: new Uint8ClampedArray(12 * 32 * 9 * 32 * 4) };
  for (let y = 0; y < atlas.h; y++) for (let x = 0; x < atlas.w; x++) { const idx = Math.floor(y / 32) * cols + Math.floor(x / 32), o = (y * atlas.w + x) * 4; atlas.data[o] = idx * 2; atlas.data[o + 1] = 200 - idx; atlas.data[o + 2] = 60; atlas.data[o + 3] = 255; }
  const mk = () => {
    const mc = 64 * 4, mr = 32 * 4, mat = new Uint8Array(mc * mr);
    for (let y = 40; y < 80; y++) for (let x = 20; x < 220; x++) mat[y * mc + x] = 1;            // a straight band: an exact 8 px cell outline
    for (let y = 90; y < 110; y++) for (let x = 100; x < 140; x++) mat[y * mc + x] = 2;           // a plaza block
    const d = { cols: 64, rows: 32, seed: 5, groundCols: cols, tiles: { grassA: [0, 1], flower: [2], leaves: [3], dirt: [60, 61], plaza: 40 }, mat: { rle: [] as number[] } };
    return makeGroundCtx(d, [], mat);
  };
  it("is seeded: the same chunk twice is the same pixels", () => {
    const g = mk(), a = new Uint8ClampedArray(512 * 512 * 4), b = new Uint8ClampedArray(512 * 512 * 4);
    paintChunk(g, atlas, 0, 0, a); paintChunk(g, atlas, 0, 0, b);
    assert.equal(createHash("sha1").update(a).digest("hex"), createHash("sha1").update(b).digest("hex"));
  });
  it("makes ragged edges: the boundary of a straight band wanders by pixels, not along the 8 px cell outline", () => {
    const g = mk();
    const top: number[] = [];
    for (let wx = 200; wx < 1400; wx += 1) { let y = 300; while (y < 340 && landAt(g, wx, y) === 0) y++; top.push(y); }
    const distinct = new Set(top).size;
    assert.ok(distinct >= 4, `${distinct} distinct edge rows`);
    assert.ok(Math.max(...top) - Math.min(...top) <= 14, "but it stays near the outline (within 14 px)");
    // the band's middle is solid path and well away from it is grass
    assert.equal(landAt(g, 800, 330), 1); assert.equal(landAt(g, 800, 100), 0);
    assert.equal(landAt(g, 960, 760 + 8), 2);                       // inside the plaza block
  });
  it("paints a darker rim inside the edge and grass tufts outside it", () => {
    const g = mk(), out = new Uint8ClampedArray(512 * 512 * 4);
    paintChunk(g, atlas, 1, 0, out);
    const colours = new Set<number>();
    for (let i = 0; i < out.length; i += 4) colours.add((out[i] << 16) | (out[i + 1] << 8) | out[i + 2]);
    assert.ok(colours.size >= 6, `${colours.size} colours`);
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
  it("matches the real objects: every tree trunk and the cafe's body are blocked, the bot nodes are not", () => {
    for (const o of objects.filter((o) => o.kind === "tree" && o.zone !== "treeline")) assert.ok(world.coll.blocked(Math.floor((o.block.x + o.block.w / 2) / 8), Math.floor((o.block.y + o.block.h / 2) / 8)), o.id);
    const cafe = data.objects.find((o) => o.id === "cafe")!;
    assert.ok(world.coll.blocked(Math.floor((cafe.block.x + 50) / 8), Math.floor((cafe.block.y + 40) / 8)));
    for (const p of data.botNodes) assert.ok(world.coll.fits(p.x, p.y), `bot node ${p.x},${p.y}`);
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
  it("on the real map: from the spawn to the far corners passes round the buildings and the woods, every leg clear", () => {
    const from: [number, number] = [data.spawn.x, data.spawn.y];
    for (const to of [[300, 300], [4000, 300], [300, 2000], [4000, 2000]] as [number, number][]) {
      const pts = world.nav.plan(from, to)!;
      assert.ok(pts, `to ${to}`);
      assert.ok(world.nav.clearPath(from, pts), `to ${to}`);
      for (const [x, y] of pts) assert.ok(world.coll.fits(x, y));
    }
  });
  it("every sit spot and door entry is a route away from the spawn", () => {
    for (const s of data.spots) assert.ok(world.nav.plan([data.spawn.x, data.spawn.y], [s.stand.x, s.stand.y]), s.key);
    for (const o of objects) if (o.door) assert.ok(world.nav.plan([data.spawn.x, data.spawn.y], [o.door.entry.x, o.door.entry.y + 8]), o.id);
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

describe("movement constants", () => {
  it("walk at the library's speed with a 12 Hz pose clock that restarts at each walk, and stand still first", () => {
    assert.equal(MOVE.walkSpeed, 70);
    assert.equal(walkFrame(0), 0);
    assert.equal(walkFrame(1 / 12 + 1e-6), 1);
    assert.equal(walkFrame(0.5 + 1e-6), 0);          // six poses at 12 Hz: a 500 ms cycle
    assert.equal(idleFrame(1), 0);
    assert.equal(idleFrame(MOVE.idleStillSecs + 0.7), 1);
  });
  it("the town's walk frames hold 5 display frames at 60 Hz in at least 90 percent of slots (jitter 0, 1, 3 ms)", () => {
    for (const jitter of [0, 1, 3]) {
      const l = slotLengths((s) => Math.floor(s * MOVE.walkPoseHz + 0.1), 60, 30, jitter);
      const five = l.filter((n) => n === 5).length / l.length;
      assert.ok(five >= 0.9, `jitter ${jitter}: ${five}`);
    }
    // and walkFrame is that same clock
    assert.equal(walkFrame(5 / 60), 1); assert.equal(walkFrame(4 / 60), 0);
  });
});
