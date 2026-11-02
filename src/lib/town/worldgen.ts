/**
 * The world generator (docs/study/town.md). `compileWorld(blueprint, art catalogues, urls, registry)` -> `TownData`, deterministic from `blueprint.seed`.
 *
 *   1  landmarks (library, cafe, bakery, bookshop) and placeholder boxes are placed; each landmark gets a plaza in front of its door
 *   2  each neighbourhood: a meandering street, then houses standing NORTH of it (doors face south) with a spur from every door to the street
 *   3  groves get a clearing; the path network: a minimum spanning tree over the plazas, street ends, groves, placeholders and free junctions,
 *      then loops (the pairs that are furthest apart on the network relative to the crow), then dead-end footpaths to viewpoints (`plan.ts`)
 *   4  furniture: plaza sets, benches along every path, a lamp with a bench every 15 tiles, door benches, picnic clusters in the groves
 *   5  trees: a forest density that is full at the map border and clumps inland, trees along the paths; bushes and logs; a decoration treeline outside
 *   6  collision and navigation (for stand points), sealed pockets healed by removing the tree that closes them, sit spots with registry ids
 *   7  hubs, bot routes, the material grid (run-length encoded) and the stats
 */
import type { World as Blueprint, FurnitureType } from "./blueprint";
import { CollisionGrid } from "./collision";
import { Nav } from "./nav";
import { MC, MAT, Planner, rle, type PathEdge, type PlazaDef } from "./plan";
import { packScatter } from "./objects";
import { hash2, rng, valueNoise } from "./rng";
import { TILE, type AtlasName, type DoorKind, type Face, type Hub, type Rect, type SitSpot, type SpriteDef, type TownData, type TownObject, type Zone } from "./types";

/* ---------- the art catalogues (the JSON the art tools wrote), only the fields used ---------- */
interface GroundTile { id: string; col: number; row: number; usable?: boolean }
export interface GroundManifest { tiles: GroundTile[]; fillFamilies: Record<string, string[]>; cols: number }
interface NatureObj { name: string; x: number; y: number; w: number; h: number; anchorX: number; anchorY: number; footprint: Rect; trunkRect?: Rect; canopyRect?: Rect | null }
interface Building {
  name: string; x: number; y: number; w: number; h: number; anchorX: number; anchorY: number; footprint: Rect; blockRect?: Rect; roofRect?: Rect;
  door?: Rect; doorRect?: Rect; step?: Rect; entry?: { x: number; y: number }; doorTrigger?: Rect; derived?: boolean;
}
interface PropObj { name: string; x: number; y: number; w: number; h: number; anchorX: number; anchorY: number }
export interface Catalog {
  ground: GroundManifest;
  nature: { objects: NatureObj[]; size: [number, number] };
  cafe: { building: Building; size: [number, number] };
  cottages: { buildings: Building[]; size: [number, number] };
  landmarks: { buildings: Building[]; size: [number, number] };
  props: { props: PropObj[]; size: [number, number] };
  groundSize: [number, number];
}
export interface Registry { nextId: number; ids: Record<string, number> }
export interface Urls { ground: string; nature: string; cafe: string; cottage: string; landmark: string; props: string; premade: string; premadeRows: number }

const PROP_BASE: Record<string, [number, number]> = {
  "lamp-post-small": [6, 4], "lamp-post-ornate": [6, 4], "lamp-post-double": [8, 4], well: [30, 12], "cart-apples": [34, 10],
  "planter-flowers": [30, 8], "planter-pumpkins": [30, 8], bin: [12, 6], barrel: [18, 8], crates: [32, 10], noticeboard: [30, 8],
  "signpost-single": [8, 4], "signpost-double": [8, 4], mailbox: [8, 4],
};

const shift = (r: Rect, dx: number, dy: number): Rect => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h });
const grow = (r: Rect, g: number): Rect => ({ x: r.x - g, y: r.y - g, w: r.w + 2 * g, h: r.h + 2 * g });
export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export function gap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w))), dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return Math.hypot(dx, dy);
}
const inRect = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

export interface Compiled { data: TownData; registry: Registry; problems: string[]; notes: Record<string, number | string> }

function spritesFrom(cat: Catalog) {
  const out: Record<string, SpriteDef> = {};
  for (const o of cat.nature.objects) {
    const isTree = o.name.startsWith("tree_");
    out[o.name] = { atlas: "nature", x: o.x, y: o.y, w: o.w, h: o.h, anchorX: o.anchorX, anchorY: o.anchorY, foot: o.footprint, ...(isTree ? { trunk: o.trunkRect, canopy: o.canopyRect ?? undefined } : {}) };
  }
  const c = cat.cafe.building;
  out.cafe = {
    atlas: "cafe", x: c.x, y: c.y, w: c.w, h: c.h, anchorX: c.anchorX, anchorY: c.anchorY, foot: c.footprint,
    block: { x: 0, y: 40, w: c.w, h: c.anchorY - 39 },
    roof: c.roofRect, door: c.door, entry: c.entry, trigger: { x: (c.door as Rect).x - 6, y: c.anchorY - 8, w: (c.door as Rect).w + 12, h: 36 },
  };
  for (const b of cat.cottages.buildings) {
    out[b.name] = {
      atlas: "cottage", x: b.x, y: b.y, w: b.w, h: b.h, anchorX: b.anchorX, anchorY: b.anchorY, foot: b.footprint, block: b.blockRect, roof: b.roofRect,
      door: b.doorRect, step: b.step, entry: b.entry, trigger: b.doorTrigger ? { ...b.doorTrigger, h: b.doorTrigger.h + 20 } : undefined, derived: b.derived,
    };
  }
  for (const b of cat.landmarks.buildings) {
    out[b.name] = {
      atlas: "landmark", x: b.x, y: b.y, w: b.w, h: b.h, anchorX: b.anchorX, anchorY: b.anchorY, foot: b.footprint, block: b.blockRect, roof: b.roofRect,
      door: b.doorRect, step: b.step, entry: b.entry, trigger: b.doorTrigger ? { ...b.doorTrigger, h: b.doorTrigger.h + 14 } : undefined,
    };
  }
  for (const p of cat.props.props) {
    const [bw, bd] = PROP_BASE[p.name] ?? [Math.round(p.w * 0.6), 6];
    out[p.name] = { atlas: "props", x: p.x, y: p.y, w: p.w, h: p.h, anchorX: p.anchorX, anchorY: p.anchorY, foot: { x: p.anchorX - Math.floor(bw / 2), y: p.anchorY - bd + 1, w: bw, h: bd } };
  }
  return out;
}

const kindOfObject = (name: string): TownObject["kind"] =>
  name.startsWith("tree_") ? "tree" : name.startsWith("bush_") ? "bush" : /^(stump|log|branch)/.test(name) ? "log"
    : name === "cafe" || name === "grand_library" || name === "bookshop" || name === "bakery" || name.startsWith("cottage_") ? "building" : "prop";

/** A uniform bucket grid of rects, for the spacing tests (a map of 2000 objects). */
class Buckets {
  private cells = new Map<number, Rect[]>();
  constructor(private size = 128) {}
  private keys(r: Rect, g: number): number[] {
    const out: number[] = [];
    for (let y = Math.floor((r.y - g) / this.size); y <= Math.floor((r.y + r.h + g) / this.size); y++) for (let x = Math.floor((r.x - g) / this.size); x <= Math.floor((r.x + r.w + g) / this.size); x++) out.push(y * 4096 + x);
    return out;
  }
  add(r: Rect) { for (const k of this.keys(r, 0)) { const l = this.cells.get(k); if (l) l.push(r); else this.cells.set(k, [r]); } }
  remove(r: Rect) { for (const k of this.keys(r, 0)) { const l = this.cells.get(k); if (l) { const i = l.indexOf(r); if (i >= 0) l.splice(i, 1); } } }
  /** Every rect within `g` of r is at least `g` away. */
  clear(r: Rect, g: number): boolean {
    for (const k of this.keys(r, g)) { const l = this.cells.get(k); if (l) for (const b of l) if (gap(r, b) < g) return false; }
    return true;
  }
}

export function compileWorld(bp: Blueprint, cat: Catalog, urls: Urls, registry: Registry): Compiled {
  const { cols, rows } = bp;
  const T = TILE, W = cols * T, H = rows * T;
  const problems: string[] = [];
  const sprites = spritesFrom(cat);
  const seed = bp.seed;
  const pl = new Planner(cols, rows, seed);
  const objects: TownObject[] = [];
  const bucket = new Buckets();
  const add = (o: TownObject) => { objects.push(o); bucket.add(o.block); };
  const bounds: Rect = { x: bp.bounds[0] * T, y: bp.bounds[1] * T, w: bp.bounds[2] * T, h: bp.bounds[3] * T };

  const place = (spriteKey: string, tx: number, ty: number, id: string, extra: Partial<TownObject> = {}, doorKind?: DoorKind, label = ""): TownObject => {
    const sp = sprites[spriteKey];
    if (!sp) throw new Error(`unknown sprite ${spriteKey}`);
    const x = Math.round(tx * T), y = Math.round(ty * T), sx = x - sp.anchorX, sy = y - 1 - sp.anchorY;
    const foot = shift(sp.foot, sx, sy), block = shift(sp.block ?? sp.foot, sx, sy);
    const o: TownObject = { id, kind: kindOfObject(spriteKey), sprite: spriteKey, x, y, sortY: y, block, foot, sx, sy, ...extra };
    if (doorKind && sp.entry && sp.trigger) o.door = { kind: doorKind, rect: shift(sp.door as Rect, sx, sy), entry: { x: sx + sp.entry.x, y: sy + sp.entry.y }, trigger: shift(sp.trigger, sx, sy), label };
    return o;
  };
  const blockPlanner = (r: Rect, g = 0) => pl.block((r.x - g) / T, (r.y - g) / T, (r.x + r.w + g) / T, (r.y + r.h + g) / T);

  /* ---- 1. landmarks and placeholders ---- */
  const plazaDefs: PlazaDef[] = [];
  const nodes: { id: string; x: number; y: number }[] = [];
  const zones: Zone[] = [];
  for (const L of bp.landmarks) {
    const o = place(L.sprite, L.at[0], L.at[1], L.id, { zone: L.id }, L.door, L.label);
    add(o); blockPlanner(o.block, 2);
    const e = (o.door as NonNullable<TownObject["door"]>).entry;
    const p: PlazaDef = { id: `${L.id}-plaza`, x: Math.round((e.x / T - L.plaza.w / 2) * MC) / MC, y: Math.ceil((e.y / T) * MC) / MC, w: L.plaza.w, h: L.plaza.h, round: L.plaza.round };
    plazaDefs.push(p);
    nodes.push({ id: L.id, x: p.x + p.w / 2, y: p.y + p.h / 2 });
    zones.push({ id: L.id, name: L.label, rect: { x: p.x * T, y: p.y * T, w: p.w * T, h: p.h * T } });
  }
  const placeholderOut: { id: string; label: string; x: number; y: number }[] = [];
  for (const P of bp.placeholders) {
    const [rx, ry, rw, rh] = P.rect;
    const r: Rect = { x: Math.round(rx * T), y: Math.round(ry * T), w: Math.round(rw * T), h: Math.round(rh * T) };
    const o: TownObject = {
      id: `ph-${P.id}`, kind: "placeholder", sprite: null, x: r.x + r.w / 2, y: r.y + r.h, sortY: r.y + r.h, block: r, foot: r, sx: r.x, sy: r.y, zone: P.id,
      ph: { ...r, label: P.label, color: "#9a86c4", cut: Math.round(r.h * 0.55), building: true },
    };
    add(o); blockPlanner(r, 1);
    placeholderOut.push({ id: o.id, label: P.label, x: o.x, y: o.y });
    if (!P.onPlaza) nodes.push({ id: `ph-${P.id}`, x: P.node ? P.node[0] : rx + rw / 2, y: P.node ? P.node[1] : ry + rh + 2.8 });
  }
  pl.finishObstacles(6);
  for (const p of plazaDefs) pl.addPlaza(p);

  /* ---- 2. neighbourhoods ---- */
  const unions: [string, string][] = [];
  const houseObjs: TownObject[] = [];
  const nbZones: { nb: string; houses: TownObject[]; street: PathEdge }[] = [];
  bp.neighbourhoods.forEach((N, ni) => {
    const street = pl.shape(`${N.id}-street`, N.street, "street", seed + ni * 101, 1.25, false, false, false);
    if (!street) { problems.push(`neighbourhood ${N.id}: no street`); return; }
    pl.stampEdge(street);
    const houses: TownObject[] = [];
    let cursor = N.street[0][0] + N.start;
    N.houses.forEach((hs, hi) => {
      const sp = sprites[hs];
      const w = sp.foot.w / T;
      const x = cursor + w / 2;
      cursor += w + N.gap;
      let bi = 0, bd = Infinity;
      street.pts.forEach((p, i) => { const d = Math.abs(p[0] - x); if (d < bd) { bd = d; bi = i; } });
      const sy = street.pts[bi][1], jitter = (hash2(seed + 61, ni, hi) - 0.5) * 0.4;
      const ay = sy - street.half[bi] - 2.1 + jitter;
      const o = place(hs, x, ay, `${N.id}-house-${hi + 1}`, { zone: N.id }, "cottage", "Cottage");
      add(o); houses.push(o); houseObjs.push(o);
      blockPlanner(o.block, 1);
      // the spur from the door to the street
      const e = (o.door as NonNullable<TownObject["door"]>).entry;
      const spur = pl.shape(`${N.id}-spur-${hi + 1}`, [[e.x / T, e.y / T + 0.95], [e.x / T, sy]], "spur", seed + hi, 0.8, false, false, false);
      if (spur) pl.stampEdge(spur);
    });
    nodes.push({ id: `${N.id}-a`, x: street.pts[0][0], y: street.pts[0][1] }, { id: `${N.id}-b`, x: street.pts[street.pts.length - 1][0], y: street.pts[street.pts.length - 1][1] });
    unions.push([`${N.id}-a`, `${N.id}-b`]);
    nbZones.push({ nb: N.id, houses, street });
  });
  pl.finishObstacles(6);

  /* ---- 3. groves, the network ---- */
  for (const G of bp.groves) {
    const p: PlazaDef = { id: `${G.id}-clearing`, x: Math.round((G.center[0] - G.plaza[0] / 2) * MC) / MC, y: Math.round((G.center[1] - G.plaza[1] / 2) * MC) / MC, w: G.plaza[0], h: G.plaza[1], round: 1.4 };
    pl.addPlaza(p); plazaDefs.push(p);
    nodes.push({ id: G.id, x: G.center[0], y: G.center[1] });
    zones.push({ id: G.id, name: G.name, rect: { x: (p.x - 3) * T, y: (p.y - 3) * T, w: (p.w + 6) * T, h: (p.h + 6) * T } });
  }
  bp.hubs.forEach((h, i) => nodes.push({ id: `hub${i}`, x: h[0], y: h[1] }));
  const parent = nodes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const byId = new Map(nodes.map((n, i) => [n.id, i]));
  const link: [number, number, number][] = [];       // abstract graph: a, b, length
  for (const [a, b] of unions) { const ia = byId.get(a) as number, ib = byId.get(b) as number; parent[find(ia)] = find(ib); link.push([ia, ib, Math.hypot(nodes[ia].x - nodes[ib].x, nodes[ia].y - nodes[ib].y) * 1.1]); }
  const cand: { a: number; b: number; d: number; w: number }[] = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
    if (d < 52) cand.push({ a: i, b: j, d, w: d * (1 + 0.35 * hash2(seed + 71, i, j)) });
  }
  cand.sort((p, q) => p.w - q.w);
  let ek = 0;
  for (const c of cand) {
    if (find(c.a) === find(c.b)) continue;
    const added = pl.connect(`p${ek}`, [nodes[c.a].x, nodes[c.a].y], [nodes[c.b].x, nodes[c.b].y], "trunk", seed + ek * 17);
    ek++;
    if (added < 0) { problems.push(`no route between ${nodes[c.a].id} and ${nodes[c.b].id}`); continue; }
    parent[find(c.a)] = find(c.b); link.push([c.a, c.b, c.d * 1.3]);
  }
  const roots = new Set(nodes.map((_, i) => find(i)));
  if (roots.size > 1) problems.push(`the network has ${roots.size} pieces`);
  // loops: the pairs whose network distance is longest relative to the crow flies
  const N = nodes.length, INF = 1e9;
  const fw = () => {
    const d: number[][] = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j): number => (i === j ? 0 : INF)));
    for (const [a, b, l] of link) { d[a][b] = Math.min(d[a][b], l); d[b][a] = Math.min(d[b][a], l); }
    for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
    return d;
  };
  const tried = new Set<string>();
  let loops = 0;
  while (loops < bp.loops) {
    const d = fw();
    let best: { a: number; b: number; ratio: number } | null = null;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const e = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (e < 10 || e > 44 || tried.has(`${i},${j}`) || d[i][j] >= INF) continue;
      const ratio = d[i][j] / e;
      if (ratio > 1.4 && (!best || ratio > best.ratio)) best = { a: i, b: j, ratio };
    }
    if (!best) break;
    tried.add(`${best.a},${best.b}`);
    const added = pl.connect(`loop${loops}`, [nodes[best.a].x, nodes[best.a].y], [nodes[best.b].x, nodes[best.b].y], "trunk", seed + 900 + loops * 13);
    if (added >= 6) { link.push([best.a, best.b, added + 4]); loops++; }
  }
  // dead-end footpaths to viewpoints
  const viewpoints: { x: number; y: number; from: { x: number; y: number } }[] = [];
  bp.viewpoints.forEach((v, i) => {
    let t: { x: number; y: number } | null = null, td = Infinity;
    for (const a of pl.attach) { const d = Math.hypot(a.x - v[0], a.y - v[1]); if (d >= 7 && d < td) { td = d; t = a; } }
    if (!t) return;
    const added = pl.connect(`view${i}`, [v[0], v[1]], [t.x, t.y], "foot", seed + 500 + i, 1.0);
    if (added < 0) problems.push(`no route to viewpoint ${i}`); else viewpoints.push({ x: v[0], y: v[1], from: t });
  });
  // the footpath's last point is the viewpoint: make it a dead end
  const mask = pl.mask;
  const cx = pl.cx, cy = pl.cy;

  /* ---- material distance (cells) for placement ---- */
  const dmat = new Float32Array(cx * cy).fill(99);
  for (let i = 0; i < mask.length; i++) if (mask[i]) dmat[i] = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < cy; y++) for (let x = 0; x < cx; x++) {
      const i = y * cx + x; let v = dmat[i];
      if (x > 0) v = Math.min(v, dmat[i - 1] + 1);
      if (y > 0) { v = Math.min(v, dmat[i - cx] + 1); if (x > 0) v = Math.min(v, dmat[i - cx - 1] + 1.41); if (x < cx - 1) v = Math.min(v, dmat[i - cx + 1] + 1.41); }
      dmat[i] = v;
    }
    for (let y = cy - 1; y >= 0; y--) for (let x = cx - 1; x >= 0; x--) {
      const i = y * cx + x; let v = dmat[i];
      if (x < cx - 1) v = Math.min(v, dmat[i + 1] + 1);
      if (y < cy - 1) { v = Math.min(v, dmat[i + cx] + 1); if (x < cx - 1) v = Math.min(v, dmat[i + cx + 1] + 1.41); if (x > 0) v = Math.min(v, dmat[i + cx - 1] + 1.41); }
      dmat[i] = v;
    }
  }
  const CELL_PX = T / MC;
  /** Distance in px from a world point to the nearest path or plaza cell edge (0 when on it). */
  const matDist = (x: number, y: number) => { const i = Math.floor(x / CELL_PX), j = Math.floor(y / CELL_PX); return i < 0 || j < 0 || i >= cx || j >= cy ? 99 * CELL_PX : dmat[j * cx + i] * CELL_PX; };
  const onMat = (r: Rect, g = 0): boolean => {
    for (let j = Math.floor((r.y - g) / CELL_PX); j <= Math.floor((r.y + r.h + g - 1) / CELL_PX); j++) for (let i = Math.floor((r.x - g) / CELL_PX); i <= Math.floor((r.x + r.w + g - 1) / CELL_PX); i++) {
      if (i >= 0 && j >= 0 && i < cx && j < cy && mask[j * cx + i]) return true;
    }
    return false;
  };

  /* ---- 4. furniture ---- */
  const bx0 = bounds.x + 14, by0 = bounds.y + 14, bx1 = bounds.x + bounds.w - 14, by1 = bounds.y + bounds.h - 14;
  const nearBounds = (r: Rect) => r.x < bx0 || r.y < by0 || r.x + r.w > bx1 || r.y + r.h > by1;
  const doors = () => objects.filter((o) => o.door);
  let doorList: TownObject[] = [];
  const nearDoor = (r: Rect, g: number) => doorList.some((o) => gap(r, (o.door as NonNullable<TownObject["door"]>).trigger) < g);
  const furnObj = (id: string, type: string, ax: number, ay: number, zone?: string): TownObject => {
    const t = bp.furnitureTypes[type] as FurnitureType;
    if (!t) throw new Error(`unknown furniture type ${type}`);
    const [bw, bd] = t.base;
    const block: Rect = { x: Math.round(ax - bw / 2), y: Math.round(ay - bd), w: bw, h: bd };
    return {
      id, kind: "furniture", sprite: t.sprite, type, x: Math.round(ax), y: Math.round(ay), sortY: Math.round(ay), block, foot: block,
      sx: Math.round(ax - t.w / 2), sy: Math.round(ay - t.h), zone,
      ph: { x: Math.round(ax - t.w / 2), y: Math.round(ay - t.h), w: t.w, h: t.h, label: t.label, color: t.color, cut: t.cut },
    };
  };
  doorList = doors();
  /** Furniture off the paths (its base on no path or plaza cell), clear of others, inside the bounds, not in front of a door. */
  const addFurn = (id: string, type: string, ax: number, ay: number, zone?: string, opt: { free?: boolean; gap?: number } = {}): boolean => {
    const o = furnObj(id, type, ax, ay, zone);
    if (nearBounds(o.block)) return false;
    if (!opt.free && onMat(o.block, 2)) return false;
    if (!bucket.clear(o.block, opt.gap ?? 6)) return false;
    if (nearDoor(o.block, 16)) return false;
    add(o); return true;
  };
  const addProp = (id: string, sprite: string, ax: number, ay: number, zone?: string, free = false): TownObject | null => {
    const o = place(sprite, ax / T, ay / T, id, { zone });
    if (nearBounds(o.block) || (!free && onMat(o.block, 2)) || !bucket.clear(o.block, 6) || nearDoor(o.block, 16)) return null;
    add(o); return o;
  };
  const zoneAt = (x: number, y: number) => zones.find((z) => inRect(z.rect, x, y))?.id ?? "paths";
  /** The bench type for a bench at (ax, ay) whose sitter should face (tx, ty). */
  const benchToward = (ax: number, ay: number, tx: number, ty: number): string => {
    const dx = tx - ax, dy = ty - ay;
    return Math.abs(dy) >= Math.abs(dx) ? (dy > 0 ? "bench_front" : "bench_back") : dx > 0 ? "bench_right" : "bench_left";
  };

  // plaza sets, from the blueprint (relative to the plaza's centre)
  for (const p of plazaDefs) {
    const key = p.id.replace(/-plaza$|-clearing$/, "");
    const set = bp.plazaFurniture[key] ?? [];
    set.forEach(([type, dx, dy], i) => {
      if (!addFurn(`${key}-set-${i}`, type, (p.x + p.w / 2 + dx) * T, (p.y + p.h / 2 + dy) * T, key, { free: true })) problems.push(`plaza set ${key} #${i} (${type}) did not fit`);
    });
  }
  // plaza edges: benches facing in, a lamp at the corners, a bin
  for (const p of plazaDefs) {
    const key = p.id.replace(/-plaza$|-clearing$/, "");
    const isGrove = p.id.endsWith("-clearing");
    const L = bp.landmarks.find((l) => l.id === key);
    const doorX = L ? ((objects.find((o) => o.id === L.id)?.door as NonNullable<TownObject["door"]>).entry.x) / T : p.x + p.w / 2;
    let n = 0;
    const put = (type: string, x: number, y: number) => { if (addFurn(`${key}-edge-${n}`, type, x * T, y * T, key, { free: true })) n++; };
    const step = isGrove ? 3.4 : 5.2;
    for (let x = p.x + 2.5; x <= p.x + p.w - 2.5; x += step) {
      if (!L || Math.abs(x - doorX) > (L.door === "library" ? 5.6 : 3.2)) put("bench_front", x, p.y + 1.15);     // along the building, facing the plaza
      put("bench_back", x, p.y + p.h - 0.55);
    }
    for (let y = p.y + 2.2; y <= p.y + p.h - 1.6; y += 3.4) { put("bench_right", p.x + 0.9, y + 0.4); put("bench_left", p.x + p.w - 0.9, y + 0.4); }
    for (const [lx, ly] of [[p.x + 0.8, p.y + 0.9], [p.x + p.w - 0.8, p.y + 0.9], [p.x + 0.8, p.y + p.h - 0.5], [p.x + p.w - 0.8, p.y + p.h - 0.5]]) addProp(`${key}-lamp-${n++}`, isGrove ? "lamp-post-small" : "lamp-post-ornate", lx * T, ly * T, key, true);
    if (bp.benches.bin) addProp(`${key}-bin`, "bin", (p.x + 1.6) * T, (p.y + p.h - 1.2) * T, key, true);
  }
  // groves: picnic tables (the plaza set may already have them), a log, a bush
  // benches and lamps along the paths
  let benchN = 0, lampN = 0;
  for (const e of pl.edges) {
    if (e.kind === "spur") continue;
    const stepS = Math.round(bp.benches.everyTiles * MC);
    const lampS = Math.round(bp.benches.lampEvery * MC);
    const ph = Math.floor(hash2(seed + 81, e.id.length, e.pts.length) * stepS);
    let side = hash2(seed + 82, e.pts.length, e.id.charCodeAt(1) || 0) < 0.5 ? 1 : -1;
    const tangent = (i: number) => { const a = e.pts[Math.max(0, i - 1)], b = e.pts[Math.min(e.pts.length - 1, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    for (let i = 8 + ph; i < e.pts.length - 8; i += stepS) {
      const [tx, ty] = tangent(i), nx = -ty, ny = tx;
      let done = false;
      for (const s of [side, -side]) {
        if (done) break;
        for (let k = 0; k < 6 && !done; k++) {
          const off = (e.half[i] + 0.8) * T + k * 4;
          const ax = e.pts[i][0] * T + nx * s * off, ay = e.pts[i][1] * T + ny * s * off;
          const type = benchToward(ax, ay, e.pts[i][0] * T, e.pts[i][1] * T);
          if (addFurn(`bench-${e.id}-${benchN}`, type, ax, ay, zoneAt(ax, ay))) { benchN++; done = true; }
        }
      }
      side = -side;
    }
    if (e.kind === "trunk" || e.kind === "street") for (let i = 14 + Math.floor(ph / 2); i < e.pts.length - 10; i += lampS) {
      const [tx, ty] = tangent(i), nx = -ty, ny = tx;
      for (const s of [1, -1]) {
        const off = (e.half[i] + 0.65) * T, ax = e.pts[i][0] * T + nx * s * off, ay = e.pts[i][1] * T + ny * s * off;
        const lamp = addProp(`lamp-${e.id}-${lampN}`, "lamp-post-small", ax, ay, zoneAt(ax, ay));
        if (!lamp) continue;
        lampN++;
        // a bench at the lamp, along the path
        const bxx = ax + tx * 30, byy = ay + ty * 30;
        addFurn(`bench-lamp-${e.id}-${lampN}`, benchToward(bxx, byy, e.pts[i][0] * T + tx * 30, e.pts[i][1] * T + ty * 30), bxx, byy, zoneAt(ax, ay));
        break;
      }
    }
  }
  // door benches: beside every door on its plaza or yard
  for (const o of objects.filter((q) => q.door && q.door.kind === "cottage")) {
    const d = o.door as NonNullable<TownObject["door"]>;
    const w = sprites[o.sprite as string].foot.w;
    for (const s of [1, -1]) if (addFurn(`bench-door-${o.id}`, "bench_front", d.entry.x + s * (w / 2 + 40), d.entry.y - 2, o.zone)) break;
    addProp(`planter-${o.id}`, "planter-flowers", d.entry.x - 46, d.entry.y + 3, o.zone);
    addProp(`lamp-${o.id}`, "lamp-post-small", d.entry.x + 47, d.entry.y - 2, o.zone);
  }
  for (const v of viewpoints) {
    const dx = v.x - v.from.x, dy = v.y - v.from.y;
    addFurn(`bench-view-${Math.round(v.x)}-${Math.round(v.y)}`, benchToward(v.x * T, v.y * T, v.x * T - dx * 3, v.y * T - dy * 3), v.x * T, v.y * T + 2, "view", { free: true });
    addFurn(`bench-view2-${Math.round(v.x)}-${Math.round(v.y)}`, benchToward(v.x * T + 36, v.y * T, v.x * T - dx * 3, v.y * T - dy * 3), v.x * T + 36, v.y * T + 2, "view", { free: true });
  }

  /* ---- 5. trees, bushes, logs ---- */
  const treeNames = cat.nature.objects.filter((o) => o.name.startsWith("tree_")).map((o) => o.name);
  const bushNames = cat.nature.objects.filter((o) => o.name.startsWith("bush_")).map((o) => o.name);
  const logNames = cat.nature.objects.filter((o) => /^(stump|log|branch)/.test(o.name)).map((o) => o.name);
  const buildings = objects.filter((o) => o.kind === "building");
  const spriteBoxes = buildings.map((o) => ({ x: o.sx, y: o.sy, w: sprites[o.sprite as string].w, h: sprites[o.sprite as string].h }));
  const edgeDist = (x: number, y: number) => Math.min(x - bounds.x, y - bounds.y, bounds.x + bounds.w - x, bounds.y + bounds.h - y) / T;
  const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const density = (x: number, y: number) => {
    const border = Math.pow(Math.max(0, 1 - edgeDist(x, y) / 13), 0.8) * 0.95;
    const clump = smooth(0.6, 0.76, valueNoise(seed + 40, x / T, y / T, 8));
    let patch = 0;
    for (const [px, py, rx, ry] of bp.woodPatches) { const q = Math.hypot((x / T - px) / rx, (y / T - py) / ry); patch = Math.max(patch, 0.85 * (1 - smooth(0.55, 1.1, q))); }
    return Math.max(border, patch, 0.012 + 0.34 * clump);
  };
  const tryTree = (key: string, x: number, y: number, id: string, g: number, pathMin: number): boolean => {
    const o = place(key, x / T, y / T, id, { zone: "wood" });
    if (nearBounds(grow(o.block, 4))) return false;
    if (matDist(o.x, o.y - 3) < pathMin || onMat(o.block, 4)) return false;
    if (!bucket.clear(o.block, g)) return false;
    for (const b of buildings) if (gap(o.block, b.foot) < 74 || gap(o.block, b.block) < 26) return false;
    for (const sb of spriteBoxes) if (overlaps(o.block, grow(sb, 20))) return false;
    for (const d of doorList) if (gap(grow(o.block, 20), (d.door as NonNullable<TownObject["door"]>).trigger) < 28) return false;
    for (const p of bp.placeholders) { const r = { x: p.rect[0] * T, y: p.rect[1] * T, w: p.rect[2] * T, h: p.rect[3] * T }; if (gap(o.block, r) < 22) return false; }
    add(o); return true;
  };
  const pickTree = (r: number) => treeNames[Math.floor(r * treeNames.length)];
  const rt = rng(seed + 91);
  // trees along the paths: sparse, golden, a little back from the edge
  let pathTrees = 0;
  for (const e of pl.edges) {
    if (e.kind === "spur") continue;
    for (let i = 10; i < e.pts.length - 10; i += 10 + Math.floor(rt() * 12)) {
      const a = e.pts[Math.max(0, i - 1)], b = e.pts[Math.min(e.pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l, s = rt() < 0.5 ? 1 : -1, off = (e.half[i] + 1.6 + rt() * 2.4) * T;
      if (tryTree(pickTree(rt()), e.pts[i][0] * T + nx * s * off, e.pts[i][1] * T + ny * s * off, `pt-${pathTrees}`, 30, 40)) pathTrees++;
    }
  }
  // the forest
  let wood = 0;
  for (let tries = 0; tries < 60000; tries++) {
    const x = rt() * W, y = rt() * H, r = rt(), key = rt();
    if (rt() > density(x, y)) continue;
    const border = edgeDist(x, y) < 12;
    const name = key < 0.14 ? bushNames[Math.floor(rt() * bushNames.length)] : pickTree(r);
    if (tryTree(name, x, y, `wood-${wood}`, border ? 26 : 34, 34)) wood++;
  }
  // bushes and logs along path edges, and behind the houses
  let bushN = 0;
  for (const h of houseObjs) {
    for (const dx of [-1, 1]) { const nm = bushNames[Math.floor(rt() * bushNames.length)]; if (tryTree(nm, h.x + dx * (sprites[h.sprite as string].foot.w / 2 + 26), h.y - 30, `hb-${bushN++}`, 24, 10)) break; }
    for (let k = 0; k < 6; k++) { if (tryTree(pickTree(rt()), h.x + (rt() - 0.5) * 140, h.y - 120 - rt() * 60, `ht-${bushN++}`, 34, 30)) break; }
  }
  let logN = 0;
  for (let tries = 0; tries < 4000 && logN < 70; tries++) {
    const x = rt() * W, y = rt() * H;
    const d = matDist(x, y);
    if (d < 36 || d > 150 || edgeDist(x, y) < 3) continue;
    const key = rt() < 0.55 ? logNames[Math.floor(rt() * logNames.length)] : bushNames[Math.floor(rt() * bushNames.length)];
    if (tryTree(key, x, y, `ln-${logN}`, 30, 30)) logN++;
  }
  // the decoration treeline outside the bounds
  let deco = 0;
  for (let tries = 0; tries < 9000; tries++) {
    const x = rt() * W, y = rt() * H;
    if (x > bounds.x - 4 && y > bounds.y - 4 && x < bounds.x + bounds.w + 4 && y < bounds.y + bounds.h + 4) continue;
    if (Math.min(x, y, W - x, H - y) > 5.2 * T) continue;
    const o = place(pickTree(rt()), x / T, y / T, `edge-${deco}`, { zone: "treeline" });
    if (objects.some((q) => q.zone === "treeline" && Math.abs(q.x - o.x) < 26 && Math.abs(q.y - o.y) < 18)) continue;
    objects.push(o); deco++;
  }

  /* ---- 6. collision, navigation, healing, spots ---- */
  const buildColl = () => {
    const coll = new CollisionGrid(W, H, bounds);
    for (const o of objects) if (o.zone !== "treeline") coll.addRect(o.block);
    return coll;
  };
  let coll = buildColl(), nav = new Nav(coll);
  const spawnWant: [number, number] = [bp.spawn[0] * T, bp.spawn[1] * T];
  const sealedList = (): number[] => {
    const start = nav.nearestOpen(spawnWant[0], spawnWant[1], 6) as [number, number];
    const reach = nav.reachable(nav.centre(start[0], start[1]));
    const out: number[] = [];
    for (let y = 0; y < nav.rows; y++) for (let x = 0; x < nav.cols; x++) if (nav.open(x, y) && !reach.has(y * nav.cols + x)) out.push(y * nav.cols + x);
    return out;
  };
  let healed = 0;
  for (let round = 0; round < 40; round++) {
    const sealed = sealedList();
    if (!sealed.length) break;
    const pts = sealed.map((k) => [(k % nav.cols) * 16 + 8, Math.floor(k / nav.cols) * 16 + 8]);
    // remove a tree, bush or log that touches the pocket
    const victims = objects.filter((o) => (o.kind === "tree" || o.kind === "bush" || o.kind === "log") && o.zone !== "treeline" && pts.some((p) => gap(o.block, { x: p[0] - 8, y: p[1] - 8, w: 16, h: 16 }) < 18));
    if (!victims.length) { problems.push(`${sealed.length} sealed cells that no tree explains`); break; }
    for (const v of victims) { objects.splice(objects.indexOf(v), 1); bucket.remove(v.block); healed++; }
    coll = buildColl(); nav = new Nav(coll);
  }
  const spots: SitSpot[] = [];
  const reg: Registry = { nextId: registry.nextId, ids: { ...registry.ids } };
  for (const o of objects) {
    if (o.kind !== "furniture") continue;
    const t = bp.furnitureTypes[o.type as string];
    t.spots.forEach((s, i) => {
      const key = `${o.id}#${i}`;
      let id = reg.ids[key];
      if (id === undefined) { id = reg.nextId++; reg.ids[key] = id; }
      const want: [number, number] = [o.x + s.stand[0], o.y + s.stand[1]];
      const cell = nav.nearestOpen(want[0], want[1], 4);
      const stand = cell ? nav.centre(cell[0], cell[1]) : want;
      spots.push({ id, key, object: o.id, at: { x: o.x + s.at[0], y: o.y + s.at[1] }, stand: { x: stand[0], y: stand[1] }, face: s.face as Face, pose: s.pose, depth: s.depth, zone: o.zone ?? zoneAt(o.x, o.y) });
    });
  }

  /* ---- 7. hubs, bots, the output ---- */
  const centreOf = (x: number, y: number): { x: number; y: number } => { const c = nav.nearestOpen(x, y, 6); return c ? { x: nav.centre(c[0], c[1])[0], y: nav.centre(c[0], c[1])[1] } : { x, y }; };
  const hubs: Hub[] = [];
  for (const h of bp.hubsUi) {
    let tx: number, ty: number;
    const ob = objects.find((o) => o.id === h.at);
    if (ob?.door) { tx = ob.door.entry.x; ty = ob.door.entry.y + 10; }
    else { const pz = plazaDefs.find((p) => p.id === h.at || p.id === `${h.at}-plaza` || p.id === `${h.at}-clearing`); if (!pz) { problems.push(`hub ${h.id}: no place ${h.at}`); continue; } tx = (pz.x + pz.w / 2) * T; ty = (pz.y + pz.h / 2 + 0.8) * T; }
    const at = centreOf(tx, ty);
    const spawn = [0, 1, 2, 3, 4].map((k) => { const a = (k / 5) * Math.PI * 2 + 0.6; return centreOf(at.x + Math.cos(a) * 44, at.y + Math.sin(a) * 30); });
    hubs.push({ id: h.id, label: h.label, x: at.x, y: at.y, spawn });
  }
  const botNodes: { x: number; y: number }[] = [], botLinks: number[][] = [], nodeEdge: number[] = [];
  pl.edges.forEach((e, ei) => {
    if (e.kind === "spur") return;
    let prev = -1;
    for (let i = 2; i < e.pts.length; i += 6 * MC) {
      const c = centreOf(e.pts[i][0] * T, e.pts[i][1] * T), id = botNodes.length;
      botNodes.push(c); botLinks.push([]); nodeEdge.push(ei);
      if (prev >= 0) { botLinks[prev].push(id); botLinks[id].push(prev); }
      prev = id;
    }
  });
  for (let a = 0; a < botNodes.length; a++) for (let b = a + 1; b < botNodes.length; b++) {
    if (nodeEdge[a] === nodeEdge[b] || botLinks[a].includes(b)) continue;
    if (Math.hypot(botNodes[a].x - botNodes[b].x, botNodes[a].y - botNodes[b].y) < 4.2 * T) { botLinks[a].push(b); botLinks[b].push(a); }
  }

  // ground tiles used by the painter
  const idx = new Map<string, number>();
  for (const t of cat.ground.tiles) idx.set(t.id, t.row * cat.ground.cols + t.col);
  const fam = cat.ground.fillFamilies;
  const tiles = { grassA: fam.grass_a.map((k) => idx.get(k) as number), flower: fam.grass_flower.map((k) => idx.get(k) as number), leaves: fam.grass_leaves.map((k) => idx.get(k) as number), dirt: fam.dirt.map((k) => idx.get(k) as number), plaza: idx.get(fam.plaza[0]) as number };

  const spawnC = centreOf(spawnWant[0], spawnWant[1]);
  const used = new Set<string>(objects.map((o) => o.sprite).filter(Boolean) as string[]);
  const spriteOut: Record<string, SpriteDef> = {};
  for (const k of used) spriteOut[k] = sprites[k];
  for (const nb of nbZones) {
    const xs = nb.houses.map((h) => h.x), ys = nb.houses.map((h) => h.y);
    zones.push({ id: nb.nb, name: bp.neighbourhoods.find((n) => n.id === nb.nb)?.name ?? nb.nb, rect: { x: Math.min(...xs) - 120, y: Math.min(...ys) - 140, w: Math.max(...xs) - Math.min(...xs) + 240, h: Math.max(...ys) - Math.min(...ys) + 240 } });
  }
  const packed = packScatter(objects);
  const data: TownData = {
    version: 2, name: bp.name, seed, cols, rows, bounds,
    atlases: {
      ground: { url: urls.ground, w: cat.groundSize[0], h: cat.groundSize[1] }, nature: { url: urls.nature, w: cat.nature.size[0], h: cat.nature.size[1] },
      cafe: { url: urls.cafe, w: cat.cafe.size[0], h: cat.cafe.size[1] }, cottage: { url: urls.cottage, w: cat.cottages.size[0], h: cat.cottages.size[1] },
      landmark: { url: urls.landmark, w: cat.landmarks.size[0], h: cat.landmarks.size[1] }, props: { url: urls.props, w: cat.props.size[0], h: cat.props.size[1] },
    } as Record<AtlasName | "ground", { url: string; w: number; h: number }>,
    premade: { url: urls.premade, w: 1248, h: 32 * urls.premadeRows, rows: urls.premadeRows },
    sprites: spriteOut, mat: { cols: cx, rows: cy, rle: rle(mask) }, groundCols: cat.ground.cols, tiles,
    objects: packed.rest.sort((a, b) => a.sortY - b.sortY || (a.id < b.id ? -1 : 1)), scatter: packed.scatter, spots, zones,
    spawn: { x: spawnC.x, y: spawnC.y },
    paths: pl.edges.map((e) => ({ id: e.id, kind: e.kind, half: Math.round(e.half.reduce((a, b) => a + b, 0) / e.half.length * 100) / 100, pts: e.pts.flatMap((p) => [Math.round(p[0] * T), Math.round(p[1] * T)]) })),
    plazas: plazaDefs.map((p) => ({ id: p.id, rect: { x: p.x * T, y: p.y * T, w: p.w * T, h: p.h * T } })),
    hubs, botNodes, botLinks, placeholders: placeholderOut.map((p) => ({ id: p.id, label: `${p.label} (to be built)`, x: p.x, y: p.y })),
    stats: {
      objects: objects.length, trees: objects.filter((o) => o.kind === "tree").length, bushes: objects.filter((o) => o.kind === "bush").length,
      furniture: objects.filter((o) => o.kind === "furniture").length, spots: spots.length, buildings: buildings.length, houses: houseObjs.length, paths: pl.edges.length, healed,
    },
  };
  const matCount = [0, 0, 0]; for (let i = 0; i < mask.length; i++) matCount[mask[i]]++;
  return { data, registry: reg, problems, notes: { pathCells: matCount[1], plazaCells: matCount[2], woods: wood, pathTrees, deco, logs: logN, benches: benchN, lamps: lampN, loops } };
}
export { MAT };
