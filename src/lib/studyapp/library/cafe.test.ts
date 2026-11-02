/**
 * npm run library:test   (node:test via tsx; no browser)
 *
 * The cafe interior (public/rooms/cafe, made by tools/art/room_from_image.py from tools/art/rooms/cafe.json): its layout is
 * the engine's, every open tile can be walked to from the door (no sealed pocket), every seat has a standing tile that is
 * open, reachable and near the chair, seat ids are an append-only registry, and the scripted demo's routes are walkable.
 * The Grand Library is checked by walk.test.ts and room.test.ts and is untouched by any of this.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cafeDemoDriver, rng, wayIn, wayOut, type CafeLayout } from "./cafeDemo";
import { CAFE_ROOM, LIBRARY_ROOM, cafeSeats } from "./rooms";
import { TILE, centreOf, fits, gridOf, isOpen, reach } from "./walk";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../../../${p}`, import.meta.url), "utf8"));
interface Spot { role: string; pose: string; face: string; x: number; y: number; sort: number; tile: [number, number]; id?: string }
const L = read("public/rooms/cafe/layout.json") as CafeLayout & { w: number; h: number; tile: number; cols: number; rows: number; wallH: number; pieces: { x: number; y: number; w: number; h: number; z: number; ax: number; ay: number }[]; lights: { x: number; y: number; r: number; k: number; rgb: number[]; sq: number; fire: boolean }[]; people: { staff: Record<string, number>; frames: number }; spots: Spot[] };
const registry = read("tools/art/rooms/cafe.seats.json") as { seats: { id: string; retired?: boolean; face: string; pose: string; side?: string; table?: string; at: number[] }[] };
const g = gridOf(L.walk, L.cols);

/** The seat ids as they were first published. APPEND ONLY: a new seat goes on the end of the registry and of this list; nothing here is ever edited or reordered. */
const LOCKED_IDS = [
  "long-n1", "long-n2", "long-n3", "long-s1", "long-s2", "long-s3", "long-w", "long-e",
  "rl-w", "rl-e", "rl-s", "rr-w", "rr-e", "rr-s",
  "nb1-n", "nb1-w", "nb1-e", "nb2-n", "nb2-w", "nb2-e", "nr-w", "nr-e",
  "sun-sofa1", "sun-sofa2", "sun-sofa3", "st1-w", "st1-e", "st1-s", "st2-w", "st2-e", "st2-s", "sr-w", "sr-e",
  "lounge-l1", "lounge-l2", "lounge-l3", "lounge-r1", "lounge-r2", "lounge-r3", "arm-l", "arm-r",
  "bA-n", "bA-w", "bA-e", "bB-n", "bB-w", "bB-e",
];

describe("the cafe's layout", () => {
  it("is the engine's shape: 640 x 432 art pixels, 16 px tiles, a door on an open tile", () => {
    assert.equal(L.w, 640); assert.equal(L.h, 432); assert.equal(L.tile, TILE);
    assert.equal(L.cols * TILE, L.w); assert.equal(L.rows * TILE, L.h);
    assert.equal(L.walk.length, L.rows);
    for (const r of L.walk) assert.equal(r.length, L.cols);
    assert.ok(isOpen(g, ...L.door.tile));
    assert.ok(L.door.y > 380 && L.door.y < L.h, "the door is at the bottom of the room");
  });

  it("has no sealed pocket: every open tile can be walked to from the door", () => {
    const open: number[] = [];
    for (let ty = 0; ty < L.rows; ty++) for (let tx = 0; tx < L.cols; tx++) if (isOpen(g, tx, ty)) open.push(ty * L.cols + tx);
    const here = new Set(reach(g, L.door.tile));
    assert.deepEqual(open.filter((k) => !here.has(k)), []);
    assert.ok(open.length > 150, `a room one can walk about in (${open.length} tiles)`);
  });

  it("has pieces that name a depth and sit inside the room and its atlas", () => {
    assert.ok(L.pieces.length >= 10);
    for (const p of L.pieces) {
      assert.ok(p.w > 0 && p.h > 0 && p.x >= 0 && p.y >= 0 && p.x + p.w <= L.w && p.y + p.h <= L.h);
      assert.ok(Number.isFinite(p.z) && p.z >= p.y && p.z <= p.y + p.h + 40, `z ${p.z} is where the thing stands`);
      assert.ok(p.ax >= 0 && p.ay >= 0);
    }
  });

  it("gives the engine the library's people block (the room shares people.png) and light that can be drawn", () => {
    assert.equal(L.people.frames, 78);
    assert.ok("butler" in L.people.staff);
    assert.ok(L.lights.some((l) => l.fire), "a fire");
    for (const l of L.lights) assert.ok(l.r > 0 && l.k > 0 && l.k < 1 && l.sq >= 1 && l.x >= 0 && l.x < L.w && l.y >= 0 && l.y < L.h);
  });
});

describe("the cafe's seats", () => {
  const seats = (L.spots as Spot[]).filter((s) => s.role === "seat");
  it("are an append-only registry: the ids are the published ones in the published order", () => {
    assert.deepEqual(registry.seats.slice(0, LOCKED_IDS.length).map((s) => s.id), LOCKED_IDS);
    assert.equal(new Set(registry.seats.map((s) => s.id)).size, registry.seats.length, "no id twice");
    // the layout lists the registry's seats first, in order, retired ones kept as placeholders, so a seat's number is its place in the registry
    registry.seats.forEach((s, i) => assert.equal(L.spots[i].id, s.id));
    assert.ok(L.spots.slice(registry.seats.length).every((s) => s.role === "barista"), "staff come after every seat");
  });

  it("have the shape the engine and the table read, and a sensible face for each pose", () => {
    assert.equal(seats.length, registry.seats.filter((s) => !s.retired).length);
    assert.ok(seats.length >= 40);
    for (const s of seats) {
      assert.ok(["sit", "read", "chairback"].includes(s.pose), s.id);
      if (s.pose === "sit") assert.ok(s.face === "left" || s.face === "right", `${s.id}: a sitting person faces left or right`);
      if (s.pose === "read") assert.equal(s.face, "front", s.id);
      if (s.pose === "chairback") assert.equal(s.face, "back", s.id);
      assert.ok(s.x >= 0 && s.x + 16 <= L.w && s.y >= 0 && s.y + 32 <= L.h, `${s.id} is inside the room`);
      assert.ok(Number.isFinite((s as Spot).sort));
    }
    const table = cafeSeats(L.spots);
    assert.equal(table.length, seats.length);
    for (const d of table) { assert.equal(d.ipad, d.spot); assert.equal(L.spots[d.spot!].x, d.x); assert.ok(d.face); }
    assert.equal(new Set(table.map((d) => d.ipad)).size, table.length);
    assert.equal(CAFE_ROOM.seats, cafeSeats);
  });

  it("each have a standing tile that is open, reachable and near the chair (so a person can walk to it first)", () => {
    const here = new Set(reach(g, L.door.tile));
    for (const s of seats) {
      assert.ok(isOpen(g, ...s.tile), `${s.id}: standing tile ${s.tile} is floor`);
      assert.ok(here.has(s.tile[1] * L.cols + s.tile[0]), `${s.id}: reachable from the door`);
      const [cx, cy] = centreOf(s.tile);
      assert.ok(Math.hypot(cx - (s.x + 8), cy - (s.y + 31)) <= 56, `${s.id}: its standing tile is close`);
    }
  });

  it("do not share a place, and a chair's sprite does not overlap another's by more than a few pixels (two people never sit on each other)", () => {
    for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) {
      const a = seats[i], b = seats[j];
      const ox = Math.min(a.x, b.x) + 16 - Math.max(a.x, b.x), oy = Math.min(a.y, b.y) + 32 - Math.max(a.y, b.y);
      assert.ok(!(ox > 12 && oy > 24), `${a.id} sits on ${b.id}`);
    }
  });

  it("flag the front and back seats (the animals have no front or back sit frames of their own: read and chairback are the fallback)", () => {
    const flagged = registry.seats.filter((s) => s.pose !== "sit");
    assert.ok(flagged.length > 0);
    for (const s of flagged) assert.ok((s as { flag?: string }).flag, `${s.id} says it is a front or back seat`);
  });
});

describe("the cafe's script and room defs", () => {
  it("lets the Grand Library stay the default room (its table, no art of its own)", () => {
    assert.equal(LIBRARY_ROOM.art, undefined);
    assert.equal(CAFE_ROOM.art?.id, "cafe");
    assert.ok(CAFE_ROOM.art!.layout.endsWith("/rooms/cafe/layout.json"));
  });

  it("walks every bot in and out along floor: each route is free of walls and ends at the chair or the door", () => {
    const seats = cafeSeats(L.spots);
    for (const d of seats) {
      const inn = wayIn(g, L, d), out = wayOut(g, L, d);
      assert.ok(inn && out, `${L.spots[d.spot!].id}: a way in and a way out`);
      for (const p of inn!.slice(0, -1)) assert.ok(fits(g, p[0], p[1]), `${L.spots[d.spot!].id}: a way-in point on the floor ${p}`);
      assert.deepEqual(inn![inn!.length - 1], [d.x + 8, d.y + 31]);
      assert.deepEqual(out![out!.length - 1], [L.door.x, L.door.y]);
      assert.ok(inn!.length <= 20 && out!.length <= 20, "short enough to go over the wire in one message");
    }
  });

  it("is a script that can be repeated (a seeded random) and builds a driver without a browser", () => {
    const a = rng(7), b = rng(7);
    assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
    const d = cafeDemoDriver({ alone: true });
    assert.equal(typeof d.scene, "function");
    const stop = d.scene!();
    if (stop) stop();
  });
});

describe("the tool that made the cafe", () => {
  it("passes its own checks on the committed config (no pocket, every seat reachable) and agrees with the committed layout", { skip: !(() => { try { execFileSync("python3", ["-c", "import PIL, numpy"]); return true; } catch { return false; } })() }, () => {
    const out = execFileSync("python3", [new URL("../../../../tools/art/room_from_image.py", import.meta.url).pathname, new URL("../../../../tools/art/rooms/cafe.json", import.meta.url).pathname, "--check"], { encoding: "utf8" });
    assert.match(out, /cafe: \d+ open tiles, (\d+) seats/);
    const open = L.walk.join("").split("").filter((c) => c === ".").length;
    assert.equal(Number(/(\d+) open tiles/.exec(out)![1]), open, "the layout on disk is what the tool makes from the config");
  });
});
