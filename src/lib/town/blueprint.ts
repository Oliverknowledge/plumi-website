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
  plaza: { w: number; h: number; round: number };
}
export interface PlaceholderDef { id: string; label: string; rect: [number, number, number, number]; onPlaza?: boolean; /** where its footpath joins, tiles (default: below the box) */ node?: [number, number] }
export interface Neighbourhood {
  id: string; name: string;
  /** Control points of the street (tiles), west to east; the generator makes it meander. Houses stand NORTH of it (their doors face south). */
  street: [number, number][];
  houses: string[]; gap: number; start: number;
}
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
  /** Dense wood inland: [centre x, centre y, radius x, radius y] tiles. They close the meadows between the paths so the paths are the way. */
  woodPatches: [number, number, number, number][];
  loops: number;
  benches: { everyTiles: number; lampEvery: number; bin: boolean };
  /** Furniture placed on a plaza, relative to its centre (tiles): [type, dx, dy]. */
  plazaFurniture: Record<string, [string, number, number][]>;
  hubsUi: { id: string; label: string; at: string }[];
  spawn: [number, number];
  furnitureTypes: Record<string, FurnitureType>;
}
