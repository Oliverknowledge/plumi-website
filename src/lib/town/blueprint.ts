import type { Face, Depth, Pose } from "./types";

/** The hand-authored map (tools/town/blueprint.json). Tile coordinates are fractional where useful; a tile (i, j)'s middle is (i + .5, j + .5). */
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
export interface PlacedObject { id?: string; sprite: string; at: [number, number]; zone?: string; door?: "cafe" | "cottage" }
export interface Cluster {
  id: string; center: [number, number]; rx: number; ry: number; n: number; seed: number;
  /** sprite name -> weight */
  mix: Record<string, number>;
  /** a bench for this grove: furniture type and offset from the centre (tiles) */
  bench?: { type: string; at: [number, number] };
}
export interface Scatter { id: string; rects: [number, number, number, number][]; sprites: string[]; spacing: number; seed: number; tries: number; gap?: number; decoration?: boolean }
export interface FurniturePlace { id?: string; type: string; at: [number, number]; zone?: string }
export interface Blueprint {
  name: string; seed: number; cols: number; rows: number;
  /** Walkable tile rectangle: x, y, w, h. */
  bounds: [number, number, number, number];
  ring: { halfWidth: number; points: [number, number][] };
  plazas: { id: string; rect: [number, number, number, number] }[];
  plazaFill: "mixed" | "single";
  zones: { id: string; name: string; rect: [number, number, number, number] }[];
  objects: PlacedObject[];
  clusters: Cluster[];
  scatter: Scatter[];
  lamps: { sprite: string; everyTiles: number; startTiles: number; offsetTiles: number; withBench: boolean; benchGapPx: number };
  ringBenches: { everyTiles: number; startTiles: number; longEvery: number };
  furnitureTypes: Record<string, FurnitureType>;
  furniture: FurniturePlace[];
  spawn: [number, number];
  plazaStands: [number, number][];
  botNodesEveryTiles: number;
}
