/**
 * The town's data, as `tools/town/build.ts` writes it (public/town/v1/town.<hash>.json) and the engine reads it.
 * Units: ART PIXELS everywhere unless a name says tiles. World origin top left; x right, y down. A character's position is its FEET.
 */
export const TILE = 32;     // a ground tile, art px (the 32 px atlas: one native pixel per art px)
export const CELL = 8;      // a collision cell: 4 x 4 per ground tile
export const NAV = 16;      // a navigation cell: 2 x 2 collision cells (the A* grid)
export const CHUNK_TILES = 16;   // a baked ground chunk is 16 x 16 tiles = 512 x 512 art px

export interface Rect { x: number; y: number; w: number; h: number }
export type Face = "left" | "right" | "front" | "back";
export type Depth = "behind" | "between" | "front";
export type Pose = "sit" | "read" | "phone" | "stool";
export type AtlasName = "nature" | "cafe" | "cottage" | "props" | "landmark";
/** The doors that can be opened. Only `library` and `cafe` have an interior drawn; the rest answer with a toast. */
export type DoorKind = "library" | "cafe" | "bakery" | "bookshop" | "cottage";

/** One sprite in one of the atlases (rects are from the sprite's top left). */
export interface SpriteDef {
  atlas: AtlasName; x: number; y: number; w: number; h: number; anchorX: number; anchorY: number;
  foot: Rect;                  // the base the object stands on (blocks walking when `block` is absent)
  block?: Rect;                // the ground area it occupies when that is bigger than the base (a building's body)
  solids?: Rect[];             // what really blocks walking when the sprite is not one lump (an arch: two pillars; string lights: two posts), relative to the sprite
  trunk?: Rect; canopy?: Rect; roof?: Rect;
  door?: Rect; step?: Rect; entry?: { x: number; y: number }; trigger?: Rect;
  derived?: boolean;
}

export type ObjectKind = "tree" | "bush" | "log" | "prop" | "building" | "furniture" | "placeholder";

export interface TownObject {
  id: string; kind: ObjectKind;
  sprite: string | null;       // a key of `sprites`; null: a placeholder rectangle (debug view)
  x: number; y: number;        // the anchor, in the world (the sprite's bottom centre of the base)
  sortY: number;               // the depth line: the sprite is drawn after everyone whose feet are above it
  /** The rect that blocks walking (world), and the ground base inside it. */
  block: Rect; foot: Rect;
  /** When the object is not one lump (an arch, string lights): the rects that block walking, world px. `block` is then their bounding box. */
  solids?: Rect[];
  /** Where the sprite's top left is. */
  sx: number; sy: number;
  /** A placeholder's look: its box in the world, the label, a colour, and the cut line (rows from its top) between its back and its front half. */
  ph?: { x: number; y: number; w: number; h: number; label: string; color: string; cut: number; building?: boolean };
  /** A door: scenery or a trigger (the cafe). `entry` is the walkable ground point the door is reached from; `trigger` the world rect where its prompt shows. */
  door?: { kind: DoorKind; rect: Rect; entry: { x: number; y: number }; trigger: Rect; label: string };
  zone?: string;
  type?: string;               // furniture type (blueprint `furnitureTypes`)
}

export interface SitSpot {
  /** The append-only registry id (tools/town/spot-registry.json): stable for ever, so the wire can name it. */
  id: number; key: string;
  object: string;
  /** The body: the sprite's FEET row anchor (as a walker's), x centre. The seated frame is drawn from it. */
  at: { x: number; y: number };
  /** Where to walk to first (feet point, world): the middle of a free navigation cell. */
  stand: { x: number; y: number };
  face: Face; pose: Pose; depth: Depth; zone: string;
}

export interface Zone { id: string; name: string; rect: Rect }
export interface Labelled { id: string; label: string; x: number; y: number }

export interface BotRoute { nodes: { x: number; y: number }[]; links: number[][] }

/** A place the HUD can send you: where to walk to, and a ring of spawn points for the teleport. */
export interface Hub { id: string; label: string; x: number; y: number; spawn: { x: number; y: number }[] }
export interface PathOut { id: string; kind: string; half: number; pts: number[] }
export interface PlazaOut { id: string; rect: Rect }

export interface TownData {
  version: 3; name: string; seed: number;
  cols: number; rows: number;                  // ground tiles
  bounds: Rect;                                // the walkable rectangle, world px
  atlases: Record<AtlasName | "ground", { url: string; w: number; h: number }>;
  /** The premade people (tools/town/people_strip.py): row 0 is you until your own look is built, rows 1 to 8 the bots'. 78 frames of 16 x 32 a row. */
  premade: { url: string; w: number; h: number; rows: number };
  sprites: Record<string, SpriteDef>;
  /** The ground material on an 8 px grid (0 grass, 1 path, 2 plaza), run-length encoded [value, run, ...], row major; `src/lib/town/ground.ts` paints it. */
  mat: { cols: number; rows: number; rle: number[] };
  groundCols: number;
  /** Atlas indices (row * groundCols + col) of the ground tiles the painter uses. */
  tiles: { grassA: number[]; flower: number[]; leaves: number[]; dirt: number[]; plaza: number };
  /** Everything with its own record: buildings, furniture, props, placeholders. Trees, bushes and logs are in `scatter` (objects.ts `allObjects` gives both). */
  objects: TownObject[];
  scatter: { names: string[]; v: number[] };
  spots: SitSpot[];
  zones: Zone[];
  spawn: { x: number; y: number };
  /** The path centre lines (px) and the plazas, for the minimap, the bots and the validator. */
  paths: PathOut[]; plazas: PlazaOut[];
  hubs: Hub[];
  /** Where bots walk: nodes (feet points) and, per node, the nodes it links to. */
  botNodes: { x: number; y: number }[]; botLinks: number[][];
  /** Worn ground (dirt showing through the grass) round doors, benches, signs: [x, y, radius] in art px, flat. */
  worn: number[];
  /** Where a belt closes the way (the hedge rows and walls of trees draw it; this is what blocks): rects, flat [x, y, w, h, ...], world px. A gap is a gate. */
  walls: number[];
  placeholders: Labelled[];                   // art that does not exist yet (debug view)
  stats: Record<string, number>;
}
