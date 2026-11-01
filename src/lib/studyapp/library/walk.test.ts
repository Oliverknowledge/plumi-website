/**
 * npm run library:test   (node:test via tsx; no browser)
 *
 * Free movement in the Grand Library, over the REAL walkable mask (public/library/layout.json, the same rows the
 * room engine reads): the 8-connected route, string pulling, the sliding step, facing, and that every seat can be
 * reached from the door.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { seatTable } from "./room";
import {
  ASSIST, TILE, ahead, cellOf, centreOf, facing, fits, gridOf, heading, isOpen, nearestTile, plan, pull, reach, route, seen, settle, slide,
  type Grid, type Pt, type Tile,
} from "./walk";

const layout = JSON.parse(readFileSync(new URL("../../../../public/library/layout.json", import.meta.url), "utf8")) as {
  tile: number; cols: number; rows: number; walk: string[]; door: { x: number; y: number; tile: [number, number] };
  spots: { x: number; y: number; role: string; pose: string; face: string; tile: [number, number] }[];
};
const g: Grid = gridOf(layout.walk, layout.cols);
const open: Tile[] = [];
for (let ty = 0; ty < layout.rows; ty++) for (let tx = 0; tx < layout.cols; tx++) if (isOpen(g, tx, ty)) open.push([tx, ty]);

/** A small seeded generator, so a failure can be reproduced. */
function rng(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; }

/** The engine's old route (4-neighbour breadth first), for comparison: how many corners the staircase had. */
function staircase(from: Tile, to: Tile): Tile[] | null {
  const { cols, rows } = g, key = (x: number, y: number) => y * cols + x;
  const prev = new Int32Array(cols * rows).fill(-2);
  const q: Tile[] = [from];
  prev[key(...from)] = -1;
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    if (x === to[0] && y === to[1]) {
      const out: Tile[] = [];
      for (let k = key(x, y); k !== key(...from); k = prev[k]) out.push([k % cols, Math.floor(k / cols)]);
      return out.reverse();
    }
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as Tile[]) if (isOpen(g, nx, ny) && prev[key(nx, ny)] === -2) { prev[key(nx, ny)] = key(x, y); q.push([nx, ny]); }
  }
  return null;
}
/** Direction changes along a list of points starting at `from`. */
function turns(from: Pt, pts: readonly Pt[]): number {
  const angles: number[] = [];
  let a = from;
  for (const p of pts) { if (Math.hypot(p[0] - a[0], p[1] - a[1]) > 1e-6) angles.push(Math.atan2(p[1] - a[1], p[0] - a[0])); a = p; }
  let n = 0;
  for (let i = 1; i < angles.length; i++) if (Math.abs(angles[i] - angles[i - 1]) > 1e-6) n++;
  return n;
}

describe("the floor", () => {
  it("is the engine's: 60 x 41 tiles of 16 px, with the door inside it", () => {
    assert.equal(layout.tile, TILE);
    assert.equal(g.cols, 60);
    assert.equal(g.rows, 41);
    assert.ok(isOpen(g, ...layout.door.tile));
    const [dx, dy] = cellOf(layout.door.x, layout.door.y);
    assert.ok(isOpen(g, dx, dy) && dy === layout.door.tile[1], "the door's feet stand on the floor in the door's row");
  });
  it("cellOf is the engine's tileOf (floor of x, the rounded row)", () => {
    for (const [x, y] of [[0, 0], [8, 12], [15.9, 19.9], [16, 4], [100.5, 333.3], [479, 653]]) {
      assert.deepEqual(cellOf(x, y), [Math.floor(x / 16), Math.round((y - 12) / 16) + 0]);
    }
  });
  it("a person fits at the middle of every walkable tile, and nowhere in a wall", () => {
    for (const t of open) { const [x, y] = centreOf(t); assert.ok(fits(g, x, y), `tile ${t}`); }
    assert.equal(fits(g, 8, 12), false, "the corner of the room is wall");
    assert.equal(fits(g, -3, 100), false, "outside the room");
  });
});

describe("the 8-connected route", () => {
  it("steps to neighbours only, over open tiles, never cutting a corner through a wall", () => {
    const r = rng(7);
    for (let n = 0; n < 150; n++) {
      const a = open[Math.floor(r() * open.length)], b = open[Math.floor(r() * open.length)];
      const path = route(g, a, b);
      if (!path) continue;
      let at = a;
      for (const t of path) {
        const dx = t[0] - at[0], dy = t[1] - at[1];
        assert.ok(Math.max(Math.abs(dx), Math.abs(dy)) === 1, "one tile at a time");
        assert.ok(isOpen(g, t[0], t[1]));
        if (dx !== 0 && dy !== 0) assert.ok(isOpen(g, at[0] + dx, at[1]) && isOpen(g, at[0], at[1] + dy), "a diagonal needs both tiles beside it open");
        at = t;
      }
      assert.deepEqual(at, b);
    }
  });
  it("is never longer in steps than the old 4-neighbour route, and is empty to where you already are", () => {
    const r = rng(11);
    for (let n = 0; n < 100; n++) {
      const a = open[Math.floor(r() * open.length)], b = open[Math.floor(r() * open.length)];
      const old = staircase(a, b), now = route(g, a, b);
      assert.equal(now === null, old === null, "reachability agrees");
      if (old && now) assert.ok(now.length <= old.length);
    }
    assert.deepEqual(route(g, open[0], open[0]), []);
  });
  it("finds nothing to a wall, or off the map", () => {
    assert.equal(route(g, layout.door.tile as Tile, [0, 0]), null);
    assert.equal(route(g, layout.door.tile as Tile, [200, 200]), null);
  });
  it("reach and nearestTile agree with it", () => {
    const from = layout.door.tile as Tile, tiles = new Set(reach(g, from));
    assert.ok(tiles.size > 800, "the room is one big floor");
    const t = nearestTile(g, from, 480, 300)!;
    assert.ok(tiles.has(t[1] * g.cols + t[0]));
    assert.ok(route(g, from, t));
  });
  it("reaches every seat's tile (and the engine's own seat tiles) from the door", () => {
    const here = new Set(reach(g, layout.door.tile as Tile));
    const seats = seatTable(layout.spots);
    assert.equal(seats.length, 76);
    for (const s of seats) {
      const tile = s.spot !== null ? layout.spots[s.spot].tile : nearestTile(g, layout.door.tile as Tile, s.x + 8, s.y + 31)!;
      assert.ok(here.has(tile[1] * g.cols + tile[0]), `seat ${s.ipad} at tile ${tile}`);
    }
  });
});

describe("string pulling", () => {
  it("every leg of a planned walk is a line one can walk, and the walk ends where asked", () => {
    const r = rng(3), from = layout.door.tile as Tile;
    for (let n = 0; n < 120; n++) {
      const b = open[Math.floor(r() * open.length)];
      const p0 = centreOf(from), path = plan(g, p0, b);
      assert.ok(path && path.length > 0 || (b[0] === from[0] && b[1] === from[1]));
      let at: Pt = p0;
      for (const p of path ?? []) { assert.ok(seen(g, at, p, 0), `${at} to ${p}`); at = p; }
      if (path && path.length) assert.deepEqual(at, centreOf(b));
    }
  });
  it("a long walk through the tables is a few straight lines, fewer corners than the old staircase", () => {
    const r = rng(5);
    let worst = 0, worstOld = 0, total = 0, totalOld = 0, n = 0;
    for (let i = 0; i < 400; i++) {
      const a = open[Math.floor(r() * open.length)], b = open[Math.floor(r() * open.length)];
      const old = staircase(a, b);
      if (!old || old.length < 25) continue;                       // a long walk: 25 tiles or more
      const start = centreOf(a), path = plan(g, start, b)!;
      const now = turns(start, path), then = turns(start, old.map(centreOf));
      assert.ok(path.length <= old.length / 2, "far fewer legs than tiles");
      worst = Math.max(worst, now); worstOld = Math.max(worstOld, then);
      total += now; totalOld += then; n++;
    }
    assert.ok(n > 40, `${n} long walks sampled`);
    assert.ok(total / n < totalOld / n, `${(total / n).toFixed(1)} turns against the staircase's ${(totalOld / n).toFixed(1)}`);
    assert.ok(worst < worstOld, `worst ${worst} against ${worstOld}`);
    assert.ok(worst <= 14, "never a wandering walk");
  });
  it("wherever the floor is clear a walk is ONE straight line (diagonals included), where the old route turned many times", () => {
    const r = rng(17);
    let clear = 0, oldTurned = 0;
    for (let i = 0; i < 6000 && clear < 120; i++) {
      const a = open[Math.floor(r() * open.length)], b = open[Math.floor(r() * open.length)];
      const A = centreOf(a), B = centreOf(b);
      if (Math.hypot(A[0] - B[0], A[1] - B[1]) < 100 || !seen(g, A, B)) continue;
      const path = plan(g, A, b)!;
      assert.equal(path.length, 1, `${a} to ${b}`);
      assert.deepEqual(path[0], B);
      clear++;
      const old = staircase(a, b)!;
      if (turns(A, old.map(centreOf)) >= 1) oldTurned++;
    }
    assert.ok(clear >= 50, `${clear} clear lines found`);
    assert.ok(oldTurned > clear * 0.5, `${oldTurned} of ${clear} were turns in the old route`);
  });
  it("an open run is one diagonal, not a staircase", () => {
    // the open floor in the middle of the room: from one corner of a clear block to the opposite one
    const a: Tile = [36, 34], b: Tile = [44, 40 - 3];
    const path = plan(g, centreOf(a), b)!;
    assert.ok(path.length <= 2, `${path.length} legs`);
  });
  it("a start that is not floor (a seat's own spot) first walks to the nearest floor", () => {
    const wall: Pt = [8, 12];
    assert.equal(fits(g, ...wall), false);
    const path = plan(g, wall, layout.door.tile as Tile)!;
    assert.ok(path.length >= 1);
    const first = path[0];
    assert.ok(fits(g, ...first), "the first stop is on the floor");
  });
  it("pull of nothing is nothing", () => assert.deepEqual(pull(g, [100, 100], []), []));
});

describe("the sliding step", () => {
  it("moves exactly the distance asked in open floor, and a diagonal is the same speed as a straight line", () => {
    const [x0, y0] = centreOf([38, 20]);
    const straight = slide(g, x0, y0, 20, 0), diag = slide(g, x0, y0, ...heading(1, 1).map((v) => v * 20) as [number, number]);
    assert.ok(Math.abs(Math.hypot(straight[0] - x0, straight[1] - y0) - 20) < 1e-6);
    assert.ok(Math.abs(Math.hypot(diag[0] - x0, diag[1] - y0) - 20) < 1e-6, "20 px along the diagonal");
    assert.ok(diag[0] > x0 && diag[1] > y0, "both axes change");
    const [hx, hy] = heading(1, -1);
    assert.ok(Math.abs(Math.hypot(hx, hy) - 1) < 1e-12);
  });
  it("slides along a wall rather than stopping dead", () => {
    // the bottom wall: row 40 is wall except the door; walk down-right along row 39
    const [x0, y0] = centreOf([8, 39]);
    const [x, y] = slide(g, x0, y0, 30, 30);
    assert.ok(x > x0 + 20, "kept moving along the wall");
    assert.ok(fits(g, x, y));
    assert.ok(y <= 40 * 16 + 4, "and did not go into it");
  });
  it("never ends in blocked space, whatever is pressed (500,000 random steps from every kind of place)", () => {
    const r = rng(99);
    let x: number, y: number;
    for (let start = 0; start < 60; start++) {
      [x, y] = centreOf(open[Math.floor(r() * open.length)]);
      let kx = 0, ky = 0;
      for (let i = 0; i < 8000; i++) {
        if (i % 40 === 0) { kx = Math.floor(r() * 3) - 1; ky = Math.floor(r() * 3) - 1; }       // mash the keys
        const [hx, hy] = heading(kx, ky), dt = r() < 0.2 ? 0.1 : 1 / 32;
        [x, y] = slide(g, x, y, hx * 70 * dt, hy * 70 * dt);
        assert.ok(fits(g, x, y), `start ${start} step ${i}: (${x.toFixed(2)}, ${y.toFixed(2)})`);
      }
    }
  });
  it("never sticks: from any tile, some direction always moves, and each held direction gets somewhere or is a true dead end", () => {
    // from the middle of every tile, a full second in each of 8 directions: at least one moves, and no direction ends in a wall
    for (const t of open) {
      const [x, y] = centreOf(t);
      let moved = 0;
      for (const [kx, ky] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const [hx, hy] = heading(kx, ky);
        let p: Pt = [x, y];
        for (let i = 0; i < 32; i++) p = slide(g, p[0], p[1], hx * 70 / 32, hy * 70 / 32);
        assert.ok(fits(g, ...p));
        if (Math.hypot(p[0] - x, p[1] - y) > 1) moved++;
      }
      assert.ok(moved >= 2, `tile ${t} moves in ${moved} of 8 directions`);
    }
  });
  it("finds a one-tile gap even when the approach is a few pixels off (the corridor at column 3)", () => {
    // rows 12 to 15 are walls but for column 3 (x 48 to 63): walk straight up it from row 17, offset by up to the assist
    for (const off of [-ASSIST + 1, -3, -1, 0, 1, 3, ASSIST - 1]) {
      let p: Pt = [centreOf([3, 17])[0] + off, centreOf([3, 17])[1]];
      assert.ok(fits(g, ...p), `offset ${off} starts on the floor`);
      for (let i = 0; i < 260; i++) p = slide(g, p[0], p[1], 0, -70 / 32);
      assert.ok(p[1] < centreOf([3, 11])[1] + 2, `offset ${off} got through: y ${p[1].toFixed(1)}`);
    }
  });
  it("settle moves a point that is not floor to the nearest floor, and leaves one that is", () => {
    const here = centreOf([30, 20]);
    assert.deepEqual(settle(g, ...here), here);
    const s = settle(g, 8, 12);
    assert.ok(fits(g, ...s));
  });
  it("ahead looks where a held key leads, and not through a wall", () => {
    const [x, y] = centreOf([36, 36]);
    const pts = ahead(g, x, y, 1, 0, 70, [0.25, 0.5]);
    assert.ok(pts.length >= 1 && pts.length <= 2);
    assert.ok(pts[pts.length - 1][0] > x + 15);
    const wall = centreOf([8, 39]);
    const into = ahead(g, wall[0], wall[1], 0, 1, 70, [0.25, 0.5]);
    for (const p of into) assert.ok(fits(g, ...p));
    assert.ok(into.length <= 1 && (into[0]?.[1] ?? wall[1]) <= 40 * 16 + 4 - 3 + 1e-6, "pushing into a wall leads only to the wall");
  });
});

describe("facing", () => {
  it("follows the dominant axis", () => {
    assert.equal(facing(1, 0, "front"), "right");
    assert.equal(facing(-1, 0, "front"), "left");
    assert.equal(facing(0, 1, "right"), "front");
    assert.equal(facing(0, -1, "right"), "back");
  });
  it("keeps its face on a true diagonal, and flips only when the other axis clearly wins", () => {
    assert.equal(facing(0.7071, 0.7071, "right"), "right");
    assert.equal(facing(0.7071, 0.7071, "front"), "front");
    assert.equal(facing(0.7071, -0.7071, "left"), "right", "a diagonal going right while facing left turns to the right");
    assert.equal(facing(1, 1.2, "right"), "right", "not enough to flip");
    assert.equal(facing(1, 1.5, "right"), "front");
    assert.equal(facing(1.2, 1, "front"), "front");
    assert.equal(facing(1.5, 1, "front"), "right");
  });
  it("does not flicker along a walk with a bit of jitter around the diagonal", () => {
    let face = "front" as ReturnType<typeof facing>, changes = 0;
    const r = rng(2);
    for (let i = 0; i < 300; i++) {
      const next = facing(1 + (r() - 0.5) * 0.2, 1 + (r() - 0.5) * 0.2, face);
      if (next !== face) changes++;
      face = next;
    }
    assert.equal(changes, 0);
  });
  it("a remote's diagonal path faces by each leg", () => {
    // right then up-left then down: the face follows the leg's own direction
    let face = facing(10, 0, "front");
    assert.equal(face, "right");
    face = facing(-20, -40, face);
    assert.equal(face, "back");
    face = facing(-40, 5, face);
    assert.equal(face, "left");
  });
});

describe("the wire carries a diagonal walk", () => {
  it("a free walk's few points survive simplification and stay under the wire's 24", async () => {
    const { floorFromArt, MAX_PATH } = await import("./room");
    const start = centreOf(layout.door.tile as Tile), far: Tile = [56, 7];
    const path = plan(g, start, far)!;
    const wire = floorFromArt({ x: start[0] - 8, y: start[1] - 31, seat: null, path: path.map(([x, y]) => [x - 8, y - 31] as Pt) });
    assert.ok(wire.path.length <= MAX_PATH);
    assert.ok(wire.path.length <= path.length);
    // and diagonal legs are not folded into a staircase: 2 points make a diagonal
    const diag = floorFromArt({ x: 100, y: 100, seat: null, path: [[130, 130], [160, 160]] });
    assert.equal(diag.path.length, 1, "a straight diagonal run folds to its end");
  });
});
