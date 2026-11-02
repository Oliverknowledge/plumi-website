import { CollisionGrid } from "./collision";
import { Nav } from "./nav";
import { TILE, type TownData } from "./types";

/** What the data becomes at load: the collision bitset from the objects' blocking rects, and the navigation grid over it. */
export class World {
  readonly coll: CollisionGrid;
  readonly nav: Nav;
  constructor(readonly data: TownData) {
    this.coll = new CollisionGrid(data.cols * TILE, data.rows * TILE, data.bounds);
    // the treeline is decoration along the edge: the bounds already stop walking there
    for (const o of data.objects) if (o.zone !== "treeline") this.coll.addRect(o.block);
    this.nav = new Nav(this.coll);
  }
}
