/**
 * npm run library:test   (node:test via tsx; no network, no browser)
 *
 * What it holds: the wire format of the library's floor (what the iPad sends and reads), the units between the
 * iPad's room and this one, the seat table that makes a seat number mean the same chair on both, and the walk.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { IPAD_SEATS } from "./ipadSeats";
import {
  LIBRARY_TILE, LOOKS, MAX_COORDINATE, MAX_PATH, floorFromArt, lookFor, parsePresence, presenceFields, seatCoverage, seatTable, simplifyPath,
  toArt, toWire, type Pt,
} from "./room";

const layout = JSON.parse(readFileSync(new URL("../../../../public/library/layout.json", import.meta.url), "utf8")) as {
  w: number; h: number; spots: { x: number; y: number; role: string; pose: string; face: string }[]; door: { x: number; y: number };
  walk: string[]; tile: number;
};

describe("the floor on the wire (LibraryPresence.swift)", () => {
  it("writes lx, ly, ls and a flat lp, and reads them back", () => {
    const f = { x: 944, y: 1248, seat: 12, path: [[950, 1200], [960, 1100]] as Pt[] };
    assert.deepEqual(presenceFields(f), { lx: 944, ly: 1248, ls: 12, lp: [950, 1200, 960, 1100] });
    assert.deepEqual(parsePresence(presenceFields(f)), f);
  });
  it("leaves out ls and lp when there is no seat and no walk", () => {
    assert.deepEqual(presenceFields({ x: 10, y: 20, seat: null, path: [] }), { lx: 10, ly: 20 });
    assert.deepEqual(parsePresence({ x: 65, y: 34 }), null, "a tile alone (an older app) carries no floor");
    assert.deepEqual(parsePresence(null), null);
    assert.deepEqual(parsePresence("lx"), null);
  });
  it("sends at most 24 waypoints", () => {
    const path = Array.from({ length: 40 }, (_, i) => [i * 4, i * 4] as Pt);
    assert.equal((presenceFields({ x: 0, y: 0, seat: null, path }).lp as number[]).length, 48);
    assert.equal(parsePresence({ lx: 0, ly: 0, lp: path.flat() })!.path.length, MAX_PATH);
  });
  it("treats whatever arrives as untrusted: clamped, dropped, never thrown", () => {
    assert.deepEqual(parsePresence({ lx: 99999, ly: -50 }), { x: MAX_COORDINATE, y: 0, seat: null, path: [] });
    assert.equal(parsePresence({ lx: 10, ly: 10, ls: 1001 })!.seat, null, "a seat past 1000 is not a seat");
    assert.equal(parsePresence({ lx: 10, ly: 10, ls: -1 })!.seat, null);
    assert.equal(parsePresence({ lx: 10, ly: 10, ls: 0 })!.seat, 0);
    assert.deepEqual(parsePresence({ lx: 10, ly: 10, lp: [1, 2, "x", 4] })!.path, [], "one bad number drops the whole walk");
    assert.deepEqual(parsePresence({ lx: 10, ly: 10, lp: [1, 2, 3] })!.path, [[1, 2]], "an odd last number is ignored");
    assert.deepEqual(parsePresence({ lx: 1.5, ly: 2 }), null, "a fraction is not a point (RealtimeJSON.int)");
    assert.deepEqual(parsePresence({ lx: "40", ly: "50" }), { x: 40, y: 50, seat: null, path: [] }, "a numeric string reads as a number");
    assert.deepEqual(parsePresence({ lx: 10, ly: 10, lp: "nope" })!.path, []);
    assert.deepEqual(parsePresence({ lx: Number.NaN, ly: 3 }), null);
  });
});

describe("units: the iPad's room is this one at twice the size", () => {
  it("is exactly twice (1920 x 1312 against 960 x 656)", () => {
    assert.equal(layout.w * 2, 1920);
    assert.equal(layout.h * 2, 1312);
  });
  it("converts a point both ways and holds a hostile one inside the room (LibraryScene.remoteHeard: width - 32, height - 64)", () => {
    assert.deepEqual(toArt([944, 1248]), [472, 624]);
    assert.deepEqual(toWire([472, 624]), [944, 1248]);
    assert.deepEqual(toArt([6000, 6000]), [944, 624], "the room's far corner for a sprite: (960 - 16, 656 - 32)");
    assert.deepEqual(toArt([0, 0]), [0, 0]);
  });
  it("agrees on the door: the iPad's door (944, 1248) is this layout's door feet (480, 654) less the sprite's feet offset, doubled", () => {
    // iPad: the door is the sprite's top left (x 944, y 1248), feet at +(16, 61) = (960, 1309).
    // Here: layout.door is the feet in art pixels, the sprite's top left is feet - (8, 31).
    assert.equal((layout.door.x - 8) * 2, 944);
    assert.ok(Math.abs((layout.door.y - 31) * 2 - 1248) <= 2, `${(layout.door.y - 31) * 2} against 1248`);
  });
  it("floorFromArt folds a grid walk into a few waypoints and sends your seat", () => {
    const you = { x: 100, y: 200, seat: null, path: [[116, 200], [132, 200], [148, 200], [148, 216], [148, 232], [164, 232]] as Pt[] };
    assert.deepEqual(floorFromArt(you), { x: 200, y: 400, seat: null, path: [[296, 400], [296, 464], [328, 464]] });
    assert.deepEqual(floorFromArt({ x: 364, y: 354, seat: 9, path: [] }), { x: 728, y: 708, seat: 9, path: [] });
  });
});

describe("simplifyPath", () => {
  it("drops repeats, the walk's own start, and the middle of a straight run", () => {
    assert.deepEqual(simplifyPath([0, 0], [[0, 0], [16, 0], [32, 0], [32, 0], [32, 16]]), [[32, 0], [32, 16]]);
    assert.deepEqual(simplifyPath([0, 0], []), []);
  });
  it("keeps a diagonal's corners and never exceeds the wire's 24", () => {
    const zig: Pt[] = Array.from({ length: 60 }, (_, i) => [(i + 1) * 16, i % 2 ? 16 : 0] as Pt);
    assert.equal(simplifyPath([0, 0], zig).length, MAX_PATH);
    assert.deepEqual(simplifyPath([0, 0], [[16, 16], [32, 32]]), [[32, 32]], "a diagonal straight run is one segment");
  });
});

describe("seats: a seat number is the same chair here and on the iPad", () => {
  it("lists the iPad's 75 seats and the study pod, in the iPad's order", () => {
    assert.equal(IPAD_SEATS.length, 76);
    assert.deepEqual(IPAD_SEATS[75].slice(2), ["back", "pod"], "the pod is appended last (LibraryWorld.init)");
    assert.deepEqual([...IPAD_SEATS[9]], [728, 708, "left", "A"]);
  });
  it("finds every iPad seat but eight in this layout, at exactly twice the coordinates, facing the same way", () => {
    const table = seatTable(layout.spots);
    assert.deepEqual(seatCoverage(layout.spots), { total: 76, matched: 68, synthetic: 8 });
    for (const s of table.filter((x) => x.spot !== null)) {
      const spot = layout.spots[s.spot!];
      assert.deepEqual([spot.x * 2, spot.y * 2], [IPAD_SEATS[s.ipad!][0], IPAD_SEATS[s.ipad!][1]]);
      assert.equal(spot.face, IPAD_SEATS[s.ipad!][2], `seat ${s.ipad} faces ${IPAD_SEATS[s.ipad!][2]} on the iPad`);
    }
    assert.ok(table.every((s, i) => s.ipad === i));
  });
  it("draws the eight the layout left empty from the iPad's own coordinates, left or right facing, at chair height", () => {
    const missing = seatTable(layout.spots).filter((s) => s.spot === null);
    assert.deepEqual(missing.map((s) => s.ipad), [10, 16, 28, 34, 40, 52, 60, 66]);
    for (const s of missing) assert.ok(s.face === "left" || s.face === "right");
    // each sits one chair (22 art pixels) below a seat the layout does have, at the same table
    for (const s of missing.slice(0, 6)) assert.ok(layout.spots.some((o) => Math.abs(o.x - s.x) <= 1 && Math.abs(o.y - (s.y - 22)) <= 1), `seat ${s.ipad} has a sibling above it`);
  });
  it("leaves the layout's decoration out: the stools along the rail and the sofas are not seats on the iPad", () => {
    const table = seatTable(layout.spots);
    const taken = new Set(table.map((s) => s.spot));
    const decorative = layout.spots.map((s, i) => [s, i] as const).filter(([s, i]) => (s.role === "seat" || s.role === "sofa") && !taken.has(i));
    assert.ok(decorative.length >= 10, "the layout has seats the iPad does not");
    for (const [s] of decorative) assert.ok(s.pose === "stool" || s.role === "sofa" || s.pose === "sit");
  });
});

describe("the library's tile", () => {
  it("is the iPad's: StudyPlaces.entryTile(Grand Library), worked out again from the app's world.json when the app repo is beside this one", (t) => {
    const path = new URL("../../../../../plumi/Sources/PlumiKit/Resources/World/world.json", import.meta.url);
    if (!existsSync(path)) return t.skip("the app repo is not beside this one");
    const W = JSON.parse(readFileSync(path, "utf8")) as { tile: number; cols: number; rooms: { name: string; x: number; y: number; w: number; h: number }[]; doors: { x: number; y: number; w: number; h: number; joins: string[] }[]; walk: string[]; seats: { tile: number[] }[] };
    const t16 = W.tile, r = W.rooms.find((x) => x.name === "Grand Library")!;
    const roomAt = (px: number, py: number) => {
      const q = W.rooms.find((x) => px >= x.x && px < x.x + x.w && py >= x.y && py < x.y + x.h);
      if (q) return q.name;
      const d = W.doors.find((x) => px >= x.x && px < x.x + x.w && py >= x.y && py < x.y + x.h);
      return d ? d.joins.find((j) => j !== "Outside") ?? d.joins[0] : "Outside";
    };
    const seatTiles = new Set(W.seats.filter((s) => s.tile.length === 2).map((s) => s.tile[1] * W.cols + s.tile[0]));
    const mid = { x: Math.floor((r.x + Math.floor(r.w / 2)) / t16), y: Math.floor((r.y + Math.floor((r.h * 2) / 3)) / t16) };
    let best: [number, number] | null = null, bd = Infinity;
    for (let y = Math.floor(r.y / t16); y < Math.floor((r.y + r.h) / t16); y++) for (let x = Math.floor(r.x / t16); x < Math.floor((r.x + r.w) / t16); x++) {
      if (W.walk[y][x] !== "." || seatTiles.has(y * W.cols + x) || roomAt(x * t16 + Math.floor(t16 / 2), y * t16 + Math.floor((t16 * 3) / 4)) !== "Grand Library") continue;
      const d = (x - mid.x) ** 2 + (y - mid.y) ** 2;
      if (d < bd) { bd = d; best = [x, y]; }
    }
    assert.deepEqual(best, [LIBRARY_TILE.x, LIBRARY_TILE.y]);
  });
});

describe("looks", () => {
  it("are stable per id, within the twelve a visitor may pick, and spread", () => {
    assert.equal(lookFor("abc"), lookFor("abc"));
    assert.ok(lookFor("0b9f1a52-6b6e-4d0c-9c0a-1d6a3f8e7a11") < LOOKS);
    const seen = new Set(Array.from({ length: 200 }, (_, i) => lookFor(`student-${i}`)));
    assert.equal(seen.size, LOOKS);
  });
  it("is LibraryScene.pick's hash (djb2 over UTF-8, 32-bit): 'a' is 5381 * 33 + 97 = 177670; modulo 12 is 10", () => {
    assert.equal(lookFor("a"), 177670 % 12);
    assert.equal(lookFor("é"), ((((5381 * 33 + 0xc3) >>> 0) * 33 + 0xa9) >>> 0) % 12);
  });
});
