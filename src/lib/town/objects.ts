import type { Rect, TownData, TownObject } from "./types";

/**
 * Trees, bushes and logs are the bulk of the map (about 2300), so the JSON stores them as numbers: `scatter.v` is [name index, x, y, flag] a record
 * (flag 1 = the decoration treeline outside the walkable bounds, which does not block). Everything the engine needs is derived from the sprite
 * definition exactly as the generator's `place()` did: the anchor is the ground line, the sprite's top left is (x - anchorX, y - 1 - anchorY).
 */
const kind = (name: string): TownObject["kind"] => (name.startsWith("tree_") ? "tree" : name.startsWith("bush_") ? "bush" : /^(stump|log|branch)/.test(name) ? "log" : "prop");
/** The scatter's flag: 0 the woods, 1 the decoration treeline (does not block), 2 a belt (hedge row, wall of trees: blocks, exempt from the spacing rules), 3 dressing (a prop). */
export const SCATTER_ZONE = ["wood", "treeline", "hedge", "dress"] as const;
const shift = (r: Rect, dx: number, dy: number): Rect => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h });
const cache = new WeakMap<TownData, TownObject[]>();

export function allObjects(d: TownData): TownObject[] {
  const hit = cache.get(d);
  if (hit) return hit;
  const out = d.objects.slice();
  const { names, v } = d.scatter;
  for (let i = 0; i < v.length; i += 4) {
    const name = names[v[i]], sp = d.sprites[name], x = v[i + 1], y = v[i + 2], sx = x - sp.anchorX, sy = y - 1 - sp.anchorY;
    const foot = shift(sp.foot, sx, sy), o: TownObject = { id: `s${i / 4}`, kind: v[i + 3] === 3 ? "prop" : kind(name), sprite: name, x, y, sortY: y, block: foot, foot, sx, sy, zone: SCATTER_ZONE[v[i + 3]] };
    if (sp.solids) { o.solids = sp.solids.map((r) => shift(r, sx, sy)); o.block = bounds(o.solids); }
    out.push(o);
  }
  cache.set(d, out);
  return out;
}

export function bounds(rs: Rect[]): Rect {
  const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y)), x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The inverse, for the generator: split off the objects that are plain scatter. */
export function packScatter(objects: TownObject[]): { rest: TownObject[]; scatter: TownData["scatter"] } {
  const names: string[] = [], index = new Map<string, number>(), v: number[] = [], rest: TownObject[] = [];
  for (const o of objects) {
    const flag = o.zone ? (SCATTER_ZONE as readonly string[]).indexOf(o.zone) : -1;
    if (flag >= 0 && o.sprite && !o.door && !o.type) {
      let k = index.get(o.sprite);
      if (k === undefined) { k = names.length; names.push(o.sprite); index.set(o.sprite, k); }
      v.push(k, o.x, o.y, flag);
    } else rest.push(o);
  }
  return { rest, scatter: { names, v } };
}
