import { IPAD_SEATS } from "./ipadSeats";

/**
 * Where people are in the Grand Library, and how that goes over the wire between this site and the iPad.
 * Pure: no browser, no clock. The iPad's own code is the reference; every constant below names the file and
 * the rule it comes from.
 *
 * TWO LAYERS OF POSITION (as on the iPad, SocialModel.swift lobbyBeat and LibraryPresence.swift)
 *   1. The SERVER holds a coarse tile per student (`lobby_set_position`). On the iPad it is not where you stand
 *      on the floor: it is ONE tile for everybody in the library, `StudyPlaces.shownLibraryTile`, a tile inside
 *      the Grand Library room of the shared world (`LIBRARY_TILE`), so every student is "in the library" to the
 *      world's rooms (StudyPlaces.place(of:)).
 *   2. The PRECISE place travels in the realtime "move" broadcast beside that tile, as `lx, ly` (the sprite's
 *      top left, in room points), `ls` (the seat index) and `lp` (the rest of the walk, flat x, y, ...).
 *
 * UNITS. The iPad's room is 1920 x 1312 points; this site's is 960 x 656 art pixels: exactly half. A person is
 * 32 x 64 points there and 16 x 32 pixels here, their feet at (16, 61) points and (8, 31) pixels. So a point on
 * the wire is two art pixels (`SCALE`), and the two rooms are the same room (the seats and the door agree to the
 * pixel: see `seatTable` and room.test.ts), apart from one point of foot height (61 against 62) that no one sees.
 */

/** Room points to art pixels. */
export const SCALE = 2;
export const ROOM = { w: 960, h: 656 } as const;
/** The sprite's size and the offset to its feet, in art pixels (cafeScene.ts spriteAt: x - 8, y - 31). */
export const SPRITE = { w: 16, h: 32 } as const;
export const FEET = { x: 8, y: 31 } as const;

/**
 * The tile every student in the library sends (`lobby_set_position`'s x and y; `lobby_join`'s too).
 * = StudyPlaces.entryTile("Grand Library"): the walkable tile nearest the middle of the room's lower two thirds
 * that is not a seat's, in the app's Resources/World/world.json (room x 800, y 344, w 480, h 336, tile 16:
 * middle (65, 35), nearest free floor (65, 34)). The iPad falls back to (40, 40) without that file, and any
 * tile outside the world's five named rooms still counts as the library, so a client that sends another tile is
 * still shown; this one sends the iPad's own so the two never differ.
 */
export const LIBRARY_TILE = { x: 65, y: 34 } as const;

/** More than this many waypoints are never read (LibraryPresence.maxPath); the room is nowhere near 6000 points (maxCoordinate). */
export const MAX_PATH = 24;
export const MAX_COORDINATE = 6000;
export const MAX_SEAT = 1000;

export type Pt = readonly [x: number, y: number];

/** Where someone is on the floor, as it goes over the wire: room points, the sprite's top left. */
export interface FloorPresence { x: number; y: number; seat: number | null; path: Pt[] }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** A whole number from a number or a numeric string, as RealtimeJSON.int reads it; null for anything else. */
function whole(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && Math.round(v) === v && Math.abs(v) < 1e15) return v;
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return Number(v);
  return null;
}

/** The keys that go beside a tile's `x` and `y` (LibraryPresence.fields). */
export function presenceFields(p: FloorPresence): Record<string, unknown> {
  const out: Record<string, unknown> = { lx: Math.round(p.x), ly: Math.round(p.y) };
  if (p.seat !== null) out.ls = p.seat;
  if (p.path.length) out.lp = p.path.slice(0, MAX_PATH).flatMap(([x, y]) => [Math.round(x), Math.round(y)]);
  return out;
}

/**
 * The presence in a "move" broadcast or a presence record; null when it carries none (an older app, or a
 * student not in the library). Whatever arrives is untrusted: every number is clamped (LibraryPresence.parse),
 * so a hostile payload can put someone at the edge of the room and no further. A path with anything in it that
 * is not a whole number is dropped whole, as there.
 */
export function parsePresence(payload: unknown): FloorPresence | null {
  if (!payload || typeof payload !== "object") return null;
  const d = payload as Record<string, unknown>;
  const x = whole(d.lx), y = whole(d.ly);
  if (x === null || y === null) return null;
  const c = (n: number) => clamp(n, 0, MAX_COORDINATE);
  const s = whole(d.ls);
  const seat = s !== null && s >= 0 && s <= MAX_SEAT ? s : null;
  const path: Pt[] = [];
  if (Array.isArray(d.lp)) {
    const nums = d.lp.map(whole);
    if (nums.every((n): n is number => n !== null)) {
      for (let i = 0; i + 1 < nums.length && path.length < MAX_PATH; i += 2) path.push([c(nums[i]), c(nums[i + 1])]);
    }
  }
  return { x: c(x), y: c(y), seat, path };
}

/* ── Units ───────────────────────────────────────────────────────────── */

/** A point on the wire to art pixels, held inside the room as LibraryScene.remoteHeard holds it (sprite top left). */
export function toArt([x, y]: Pt): Pt {
  return [clamp(x / SCALE, 0, ROOM.w - SPRITE.w), clamp(y / SCALE, 0, ROOM.h - SPRITE.h)];
}
/** Art pixels (sprite top left) to a point on the wire. */
export const toWire = ([x, y]: Pt): Pt => [Math.round(x * SCALE), Math.round(y * SCALE)];

/**
 * Drops waypoints that add nothing (the walk's own start, repeats, and the middle of a straight run), so a walk
 * over a 16 px grid fits in the wire's 24; if it still does not, the first 24 go, as the iPad would read them
 * (the next beat carries the rest, since it sends where you are and what is left).
 */
export function simplifyPath(from: Pt, path: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  let a: Pt = from;
  for (const p of path) {
    if (Math.abs(p[0] - a[0]) < 0.5 && Math.abs(p[1] - a[1]) < 0.5) continue;
    out.push(p);
    a = p;
  }
  // a middle point of a straight line (same direction in and out) is not needed
  const kept: Pt[] = [];
  let prev: Pt = from;
  for (let i = 0; i < out.length; i++) {
    const p = out[i], next = out[i + 1];
    if (next) {
      const d1x = Math.sign(p[0] - prev[0]), d1y = Math.sign(p[1] - prev[1]);
      const d2x = Math.sign(next[0] - p[0]), d2y = Math.sign(next[1] - p[1]);
      const cross = (p[0] - prev[0]) * (next[1] - p[1]) - (p[1] - prev[1]) * (next[0] - p[0]);
      if (d1x === d2x && d1y === d2y && Math.abs(cross) < 1e-6) { prev = p; continue; }
    }
    kept.push(p);
    prev = p;
  }
  return kept.slice(0, MAX_PATH);
}

/**
 * What you tell the others, from where the room has you (art pixels, the sprite's top left): your place and seat in
 * room points, and the rest of your walk with the straight runs folded away so it fits the wire's 24.
 */
export function floorFromArt(you: { x: number; y: number; seat: number | null; path: readonly Pt[] }): FloorPresence {
  const [x, y] = toWire([you.x, you.y]);
  return { x, y, seat: you.seat, path: simplifyPath([you.x, you.y], you.path).map(toWire) };
}

/* ── Seats ───────────────────────────────────────────────────────────── */

/** A seat of this site's room: where the art has it, and what the iPad calls it. */
export interface SeatDef {
  /** The iPad's seat index (what `ls` counts), or null for a chair that is only here. */
  ipad: number | null;
  /** The index in layout.json's spots, or null for a chair the iPad has and this layout left empty (drawn from the iPad's table). */
  spot: number | null;
  /** The sprite's top left in art pixels. */
  x: number;
  y: number;
  face: "right" | "left" | "back" | "front";
  table: string;
}

/** The slice of a layout.json spot the table needs. */
export interface SpotLike { x: number; y: number; role: string; pose: string; face: string }

const FACES = ["right", "left", "back", "front"] as const;
const face = (v: string): SeatDef["face"] => (FACES as readonly string[]).includes(v) ? (v as SeatDef["face"]) : "front";

/**
 * This room's seats, in the iPad's order, so a seat number means the same chair on both. Every iPad seat is
 * matched to this layout's spot by position (the iPad's x, y over two is this layout's x, y exactly). Eight
 * iPad seats have no spot here: the co-founder's render this layout comes from left them empty, so the layout
 * has no one in them; they are real chairs in the art, and are drawn from the iPad's own coordinates.
 *
 * Only these 76 are seats you can take on this site (the iPad's sittable set); the layout's other 'seat' spots
 * (stools along the upper rail, the sofas) are decoration there, and a student sitting in one would be
 * standing at a bookshelf on every iPad.
 */
export function seatTable(spots: readonly SpotLike[]): SeatDef[] {
  const byPos = new Map<string, number>();
  spots.forEach((s, i) => { if ((s.role === "seat" || s.role === "sofa") && !byPos.has(`${s.x * SCALE},${s.y * SCALE}`)) byPos.set(`${s.x * SCALE},${s.y * SCALE}`, i); });
  return IPAD_SEATS.map(([x, y, view, table], ipad) => {
    const spot = byPos.get(`${x},${y}`) ?? null;
    const [ax, ay] = spot === null ? [x / SCALE, y / SCALE] : [spots[spot].x, spots[spot].y];
    return { ipad, spot, x: ax, y: ay, face: face(view), table };
  });
}

/** How many of the iPad's seats this layout draws a person in, and how many it leaves empty (for the docs and the test). */
export function seatCoverage(spots: readonly SpotLike[]) {
  const t = seatTable(spots);
  return { total: t.length, matched: t.filter((s) => s.spot !== null).length, synthetic: t.filter((s) => s.spot === null).length };
}

/* ── Who looks like what ─────────────────────────────────────────────── */

/** The cast a person may wear here: layout.json's `choose`, the twelve looks a visitor may pick. */
export const LOOKS = 12;

/**
 * A stable look for someone else, from their id (the iPad's `LibraryScene.pick`: djb2 over the UTF-8 bytes, then
 * modulo the number of rows). Both sides pick from their own cast: the iPad's rows are not this site's frames
 * (people.png is restyled and laid out differently), so the SAME student may wear a different look on the
 * other client. That is cosmetic and stated in docs/study/library.md; nothing identifies a student by it.
 */
export function lookFor(id: string, looks = LOOKS): number {
  let h = 5381;
  for (const b of new TextEncoder().encode(id)) h = (Math.imul(h, 33) + b) >>> 0;
  return h % looks;
}
