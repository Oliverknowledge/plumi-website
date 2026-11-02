import type { DoorKind, Face, Depth, Pose } from "./types";

/**
 * The authored world (tools/town/world.json). Landmark positions are decisions; the paths, the houses along a street, the trees and the
 * benches are generated from them by `worldgen.ts`, deterministically from `seed`. Tile coordinates are fractional where useful.
 */
export interface FurnitureSpotDef {
  /** The sitter's feet anchor, relative to the object's anchor (bottom centre of its base), art px. */
  at: [number, number];
  /** Where to walk to first, relative to the anchor (snapped to the nearest open navigation cell). */
  stand: [number, number];
  face: Face; pose: Pose; depth: Depth;
}
export interface FurnitureType {
  label: string; color: string;
  /** Box drawn for the placeholder (centred on the anchor, ending at it): w x h art px, and the row from its top where the front half begins. */
  w: number; h: number; cut: number;
  /** What blocks walking: the base, centred on the anchor and ending at it. */
  base: [number, number];
  /** The art that replaces the placeholder later: a sprite name in an atlas, or null (placeholder). Swapping this and `cut` is all a real sprite needs. */
  sprite: string | null;
  spots: FurnitureSpotDef[];
}
export interface Landmark {
  id: string; sprite: string; /** the anchor: bottom centre of the front wall, tiles */ at: [number, number]; door: DoorKind; label: string;
  /** The paved square in front of the door: w x h tiles, centred on the door, its top edge at the sprite's bottom. */
  plaza: { w: number; h: number; round: number; apron?: number; rag?: number };
}
export interface PlaceholderDef { id: string; label: string; rect: [number, number, number, number]; onPlaza?: boolean; /** where its footpath joins, tiles (default: below the box) */ node?: [number, number] }
/**
 * One house of a street. `x` is where its centre stands along the street (tiles); without it the house follows the one before by `gap` tiles
 * (the neighbourhood's `gap` when absent). `lead` is the front yard in tiles, the length of its spur to the street (default 1.0, 0.2 to 4 reads as
 * a yard on the path, a set-back house, a house on a lane). `lane` bends the spur sideways [dx tiles, length tiles]: a house on a short side lane.
 * `garden` fences its front and sides.
 */
export interface HouseSpec { s: string; x?: number; gap?: number; lead?: number; lane?: [number, number]; garden?: boolean }
export interface Neighbourhood {
  id: string; name: string;
  /** Control points of the street (tiles), west to east; the generator makes it meander. Houses stand NORTH of it (their doors face south). */
  street: [number, number][];
  houses: (string | HouseSpec)[]; gap: number; start: number;
}
/** Three houses around a tiny courtyard with a well: two flank it, one stands behind. All doors face south. `at` is the middle of the front lane. */
export interface Courtyard { id: string; name: string; at: [number, number]; houses: [string, string, string] }
/** A single house tucked away (in a grove, on a hill): its spur is routed to the nearest path after the network is made. */
export interface Single { id: string; s: string; at: [number, number]; garden?: boolean }
/**
 * A belt: a hedge row, a wall of trees or a mixture, from one end (on the map edge, or on another belt or a building) to the other, with openings only
 * at its `gates` (where a path crosses). The planner treats it as an obstacle, so paths cross only at the gates, and it is continuous for walking, so
 * the meadows between districts cannot be crossed. `kind`: hedge (bushes, a few trees), wood (trees over bushes), mixed.
 */
export interface Belt { id: string; kind: "hedge" | "wood" | "mixed"; pts: [number, number][]; gates: [number, number][] }
/** A named bit of dressing at a place: the generator moves it to the nearest free grass. */
export interface Dress { s: string; at: [number, number]; id?: string }
export interface Grove { id: string; name: string; center: [number, number]; plaza: [number, number]; tables: number }
export interface World {
  name: string; seed: number; cols: number; rows: number;
  /** Walkable tile rectangle: x, y, w, h. */
  bounds: [number, number, number, number];
  landmarks: Landmark[];
  placeholders: PlaceholderDef[];
  neighbourhoods: Neighbourhood[];
  groves: Grove[];
  viewpoints: [number, number][];
  hubs: [number, number][];
  belts: Belt[];
  courtyards: Courtyard[];
  singles: Single[];
  /** The woods: a belt of `belt` tiles at the very edge, thinning to nothing by `fade` tiles; `inland` is the density of the inland clumps; `decoRows` are the rows (tiles outside the bounds) of the decoration treeline, spaced `decoStep` tiles with `decoSkip` of them left out. */
  forest: { scale: number; belt: number; fade: number; inland: number; tries: number; logs: number; decoStep: number; decoRows: number[]; decoSkip: number };
  /** Props on a plaza: [sprite, dx, dy] tiles from the door's entry (a building) or the clearing's middle (a grove). */
  plazaDress: Record<string, [string, number, number][]>;
  /** Hand placed dressing (noticeboards at junctions, wells, the apple cart, signposts): [sprite, tile position]. */
  dress: Dress[];
  /** Dense wood inland: [centre x, centre y, radius x, radius y] tiles. They close the meadows between the paths so the paths are the way. */
  woodPatches: [number, number, number, number][];
  loops: number;
  /** A hub pair (not separated by a belt) whose path is more than this many times the crow flies gets a direct path (default 1.4). */
  directness: number;
  /** Half of the widest a path may be, tiles: the distance-field clamp trims every junction blob to a band this wide on each side of its spine (1.65: about 3.3 tiles across). */
  widthCap: number;
  /** How many junctions get a noticeboard and a signpost. */
  junctionBoards: number;
  benches: { everyTiles: number; lampEvery: number; bin: boolean };
  /** Furniture placed on a plaza, relative to its centre (tiles): [type, dx, dy]. */
  plazaFurniture: Record<string, [string, number, number][]>;
  hubsUi: { id: string; label: string; at: string }[];
  spawn: [number, number];
  furnitureTypes: Record<string, FurnitureType>;
}
