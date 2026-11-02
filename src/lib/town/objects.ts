import type { Rect, TownData, TownObject } from "./types";

/**
 * Trees, bushes and logs are the bulk of the map (about 2300), so the JSON stores them as numbers: `scatter.v` is [name index, x, y, flag] a record
 * (flag 1 = the decoration treeline outside the walkable bounds, which does not block). Everything the engine needs is derived from the sprite
 * definition exactly as the generator's `place()` did: the anchor is the ground line, the sprite's top left is (x - anchorX, y - 1 - anchorY).
 */
const kind = (name: string): TownObject["kind"] => (name.startsWith("tree_") ? "tree" : name.startsWith("bush_") ? "bush" : "log");
const shift = (r: Rect, dx: number, dy: number): Rect => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h });
const cache = new WeakMap<TownData, TownObject[]>();

export function allObjects(d: TownData): TownObject[] {
  const hit = cache.get(d);
  if (hit) return hit;
  const out = d.objects.slice();
  const { names, v } = d.scatter;
  for (let i = 0; i < v.length; i += 4) {
    const name = names[v[i]], sp = d.sprites[name], x = v[i + 1], y = v[i + 2], sx = x - sp.anchorX, sy = y - 1 - sp.anchorY;
    const foot = shift(sp.foot, sx, sy);
    out.push({ id: `s${i / 4}`, kind: kind(name), sprite: name, x, y, sortY: y, block: foot, foot, sx, sy, zone: v[i + 3] === 1 ? "treeline" : "wood" });
  }
  cache.set(d, out);
  return out;
}

/** The inverse, for the generator: split off the objects that are plain scatter. */
export function packScatter(objects: TownObject[]): { rest: TownObject[]; scatter: TownData["scatter"] } {
  const names: string[] = [], index = new Map<string, number>(), v: number[] = [], rest: TownObject[] = [];
  for (const o of objects) {
    if ((o.kind === "tree" || o.kind === "bush" || o.kind === "log") && (o.zone === "wood" || o.zone === "treeline") && o.sprite) {
      let k = index.get(o.sprite);
      if (k === undefined) { k = names.length; names.push(o.sprite); index.set(o.sprite, k); }
      v.push(k, o.x, o.y, o.zone === "treeline" ? 1 : 0);
    } else rest.push(o);
  }
  return { rest, scatter: { names, v } };
}
