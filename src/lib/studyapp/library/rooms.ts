import type { RoomArt } from "@/components/landing/cafeScene";
import { artUrl } from "./art";
import { seatTable, type SeatDef, type SpotLike } from "./room";

/**
 * Which room the engine (src/components/landing/cafeScene.ts, library mode) mounts: its art, its words, and its table of
 * seats. The Grand Library is the default and is exactly what it was; another room is a folder of the four files
 * `tools/art/room_from_image.py` makes (docs/study/cafe.md). Pure: no browser, so the tests can read it.
 */
export interface RoomDef {
  id: string;
  /** What the canvas says to a screen reader. */
  label: string;
  /** Where the art is. Undefined: the Grand Library's (public/library, fingerprinted). */
  art?: RoomArt;
  /** The chairs a student may take, as the engine reads them from this room's layout `spots`. */
  seats(spots: readonly SpotLike[]): SeatDef[];
}

const HOW = "Tap the floor to walk and a free seat to sit. W A S D or the arrow keys walk, E sits down, Enter or Space also sit.";

export const LIBRARY_ROOM: RoomDef = { id: "library", label: `The Grand Library. ${HOW}`, seats: seatTable };

/**
 * The cafe's seats are its layout's `seat` spots in file order, which is the order of `tools/art/rooms/cafe.seats.json`
 * (an append-only registry: a seat that goes keeps its place as a "retired" spot). A seat's number is its place in that
 * order, so it means the same chair for ever. There is no iPad table here: the cafe is web only (nothing on the wire).
 */
export function cafeSeats(spots: readonly (SpotLike & { id?: string })[]): SeatDef[] {
  const out: SeatDef[] = [];
  spots.forEach((s, i) => {
    if (s.role !== "seat") return;
    const face = s.face === "right" || s.face === "left" || s.face === "back" ? s.face : "front";
    out.push({ ipad: i, spot: i, x: s.x, y: s.y, face, table: s.id ?? String(i) });
  });
  return out;
}

const CAFE_DIR = "/rooms/cafe/";
export const CAFE_ROOM: RoomDef = {
  id: "cafe",
  label: `The cafe. ${HOW}`,
  art: { id: "cafe", layout: CAFE_DIR + "layout.json", bg: CAFE_DIR + "bg.png", pieces: CAFE_DIR + "pieces.png", anims: CAFE_DIR + "anims.png", people: artUrl("people.png") },
  seats: cafeSeats,
};
