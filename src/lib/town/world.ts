import { CollisionGrid } from "./collision";
import { Nav } from "./nav";
import { allObjects } from "./objects";
import { TILE, type TownData } from "./types";

/** What the data becomes at load: the collision bitset from the objects' blocking rects, and the navigation grid over it. */
export class World {
  readonly coll: CollisionGrid;
  readonly nav: Nav;
  constructor(readonly data: TownData) {
    this.coll = new CollisionGrid(data.cols * TILE, data.rows * TILE, data.bounds);
    // the treeline is decoration along the edge: the bounds already stop walking there
    for (const o of allObjects(data)) if (o.zone !== "treeline") { if (o.solids) for (const r of o.solids) this.coll.addRect(r); else this.coll.addRect(o.block); }
    for (let i = 0; i + 3 < data.walls.length; i += 4) this.coll.addRect({ x: data.walls[i], y: data.walls[i + 1], w: data.walls[i + 2], h: data.walls[i + 3] });
    this.nav = new Nav(this.coll);
  }
}
