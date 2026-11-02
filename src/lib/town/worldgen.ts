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
import type { World as Blueprint, FurnitureType, HouseSpec } from "./blueprint";
import { CollisionGrid } from "./collision";
import { Nav } from "./nav";
import { MC, MAT, Planner, rle, roundedSd, type PathEdge, type PlazaDef } from "./plan";
import { bounds as boundsOf, packScatter } from "./objects";
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
  "fence-straight": [33, 5], "fence-post": [8, 5], "fence-corner": [28, 5], "fence-end": [10, 5], gate: [37, 5], "stone-wall": [45, 6], "bike-rack": [34, 5], flag: [8, 5],
};
/** Props that are not one lump: what really blocks (relative to the sprite's top left). */
const SOLIDS: Record<string, Rect[]> = {
  "stone-arch": [{ x: 2, y: 39, w: 6, h: 5 }, { x: 39, y: 39, w: 6, h: 5 }],
  "string-lights": [{ x: 1, y: 35, w: 6, h: 5 }, { x: 40, y: 35, w: 6, h: 5 }],
};
/** Colour families of the trees: a grove is mostly one, with a contrast now and then. */
const TREES: Record<string, string[]> = { gold: ["gold_round", "gold_twin"], amber: ["amber_tall", "orange_wide"], mixed: ["mixed"], red: ["red"] };
const BUSHES: Record<string, string[]> = { gold: ["bush_gold_round", "bush_gold_hedge"], amber: ["bush_orange_round", "bush_orange_twin"], mixed: ["bush_mixed"], red: ["bush_red_long"] };
const FAMS = ["gold", "amber", "mixed", "red"] as const;

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
    const solids = SOLIDS[p.name];
    out[p.name] = { atlas: "props", x: p.x, y: p.y, w: p.w, h: p.h, anchorX: p.anchorX, anchorY: p.anchorY, foot: solids ? boundsOf(solids) : { x: p.anchorX - Math.floor(bw / 2), y: p.anchorY - bd + 1, w: bw, h: bd }, ...(solids ? { solids } : {}) };
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
  /** Whether any rect overlaps r (touching is not overlapping). */
  hits(r: Rect): boolean {
    for (const k of this.keys(r, 0)) { const l = this.cells.get(k); if (l) for (const b of l) if (overlaps(r, b)) return true; }
    return false;
  }
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
  const beltBucket = new Buckets();          // belts and hedge rows: continuous by design, exempt from the spacing rules
  const add = (o: TownObject) => { objects.push(o); bucket.add(o.block); };
  const bounds: Rect = { x: bp.bounds[0] * T, y: bp.bounds[1] * T, w: bp.bounds[2] * T, h: bp.bounds[3] * T };
  const worn: number[] = [];

  const place = (spriteKey: string, tx: number, ty: number, id: string, extra: Partial<TownObject> = {}, doorKind?: DoorKind, label = ""): TownObject => {
    const sp = sprites[spriteKey];
    if (!sp) throw new Error(`unknown sprite ${spriteKey}`);
    const x = Math.round(tx * T), y = Math.round(ty * T), sx = x - sp.anchorX, sy = y - 1 - sp.anchorY;
    const foot = shift(sp.foot, sx, sy), block = shift(sp.block ?? sp.foot, sx, sy);
    const o: TownObject = { id, kind: kindOfObject(spriteKey), sprite: spriteKey, x, y, sortY: y, block, foot, sx, sy, ...extra };
    if (sp.solids) o.solids = sp.solids.map((r) => shift(r, sx, sy));
    if (doorKind && sp.entry && sp.trigger) o.door = { kind: doorKind, rect: shift(sp.door as Rect, sx, sy), entry: { x: sx + sp.entry.x, y: sy + sp.entry.y }, trigger: shift(sp.trigger, sx, sy), label };
    return o;
  };
  const blockPlanner = (r: Rect, g = 0) => pl.block((r.x - g) / T, (r.y - g) / T, (r.x + r.w + g) / T, (r.y + r.h + g) / T);
  const entryOf = (o: TownObject) => (o.door as NonNullable<TownObject["door"]>).entry;

  /* ---- 1. landmarks, placeholders, belts ---- */
  const plazaDefs: PlazaDef[] = [];
  const nodes: { id: string; x: number; y: number }[] = [];
  const zones: Zone[] = [];
  for (const L of bp.landmarks) {
    const o = place(L.sprite, L.at[0], L.at[1], L.id, { zone: L.id }, L.door, L.label);
    add(o); blockPlanner(o.block, 2);
    const e = entryOf(o);
    const p: PlazaDef = { id: `${L.id}-plaza`, x: Math.round((e.x / T - L.plaza.w / 2) * MC) / MC, y: Math.ceil((e.y / T) * MC) / MC, w: L.plaza.w, h: L.plaza.h, round: L.plaza.round, apron: L.plaza.apron, rag: L.plaza.rag };
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
  // belts are obstacles for the planner, open only at their gates; a gate is a node of the network
  for (const B of bp.belts) {
    pl.blockBelt(B.pts, 2.0, B.gates, 3.4);
    B.gates.forEach((g, i) => nodes.push({ id: `gate-${B.id}-${i}`, x: g[0], y: g[1] }));
  }
  pl.finishObstacles(6);
  for (const p of plazaDefs) pl.addPlaza(p);

  /* ---- 2. neighbourhoods, courtyards, single houses ---- */
  const unions: [string, string][] = [];
  const houseObjs: TownObject[] = [];
  const gardens = new Set<string>();
  const nbZones: { nb: string; houses: TownObject[]; street: PathEdge }[] = [];
  const houseStreetY = (street: PathEdge, x: number) => { let bi = 0, bd = Infinity; street.pts.forEach((p, i) => { const d = Math.abs(p[0] - x); if (d < bd) { bd = d; bi = i; } }); return bi; };
  bp.neighbourhoods.forEach((N, ni) => {
    const street = pl.shape(`${N.id}-street`, N.street, "street", seed + ni * 101, 1.2, false, false, false);
    if (!street) { problems.push(`neighbourhood ${N.id}: no street`); return; }
    pl.stampEdge(street);
    const houses: TownObject[] = [];
    let cursor = N.street[0][0] + N.start;
    N.houses.forEach((hsp, hi) => {
      const spec: HouseSpec = typeof hsp === "string" ? { s: hsp } : hsp;
      const sp = sprites[spec.s];
      const w = sp.foot.w / T;
      const x = spec.x ?? cursor + w / 2;
      cursor = x + w / 2 + N.gap;
      const bi = houseStreetY(street, x), sy = street.pts[bi][1], jitter = (hash2(seed + 61, ni, hi) - 0.5) * 0.3;
      // the house stands clear of the street's top edge along its whole width (the street wanders)
      let top = Infinity;
      for (let k = 0; k < street.pts.length; k++) if (Math.abs(street.pts[k][0] - x) <= w / 2 + 0.6) top = Math.min(top, street.pts[k][1] - street.half[k]);
      const ay = Math.min(top, sy - street.half[bi]) - 1.0 - (spec.lead ?? 1.0) + jitter;
      const o = place(spec.s, x, ay, `${N.id}-house-${hi + 1}`, { zone: N.id }, "cottage", "Cottage");
      add(o); houses.push(o); houseObjs.push(o);
      if (spec.garden) gardens.add(o.id);
      blockPlanner(o.block, 1);
      // the spur from the door to the street (a lane bends sideways on the way)
      const e = entryOf(o), ex = e.x / T, ey0 = e.y / T + 0.8;
      let line: [number, number][] = [[ex, ey0], [ex, sy]];
      if (spec.lane) {
        const dx = spec.lane[0], sy2 = street.pts[houseStreetY(street, ex + dx)][1], dy = sy2 - ey0;
        line = [[ex, ey0], [ex, ey0 + dy * 0.3], [ex + dx, ey0 + dy * 0.7], [ex + dx, sy2]];
      }
      const spur = pl.shape(`${N.id}-spur-${hi + 1}`, line, "spur", seed + hi, 0.8, false, false, false);
      if (spur) pl.stampEdge(spur);
    });
    nodes.push({ id: `${N.id}-a`, x: street.pts[0][0], y: street.pts[0][1] }, { id: `${N.id}-b`, x: street.pts[street.pts.length - 1][0], y: street.pts[street.pts.length - 1][1] });
    unions.push([`${N.id}-a`, `${N.id}-b`]);
    nbZones.push({ nb: N.id, houses, street });
  });
  // courtyards: two houses flank a tiny yard, one stands behind it, a well beside the middle one's path; every door faces south onto the lane
  const wells: { x: number; y: number; zone: string }[] = [];
  bp.courtyards.forEach((C, ci) => {
    const [cx, cy] = C.at;
    const spots: [number, number][] = [[cx - 5.4, cy], [cx + 5.4, cy], [cx, cy - 3.9]];
    const hs = C.houses.map((s, i) => { const o = place(s, spots[i][0], spots[i][1], `${C.id}-house-${i + 1}`, { zone: C.id }, "cottage", "Cottage"); add(o); houseObjs.push(o); blockPlanner(o.block, 1); return o; });
    const ly = Math.max(entryOf(hs[0]).y, entryOf(hs[1]).y) / T + 1.5;
    const A = entryOf(hs[0]), B = entryOf(hs[1]), Cc = entryOf(hs[2]);
    const lane = pl.shape(`${C.id}-lane`, [[A.x / T, A.y / T + 0.8], [A.x / T + 0.6, ly], [cx - 2.4, ly + 0.15], [cx, ly + 0.2], [cx + 2.4, ly + 0.15], [B.x / T - 0.6, ly], [B.x / T, B.y / T + 0.8]], "spur", seed + 300 + ci, 0.85, false, false, false);
    if (lane) pl.stampEdge(lane);
    const spur = pl.shape(`${C.id}-spur`, [[Cc.x / T, Cc.y / T + 0.85], [cx, ly + 0.2]], "spur", seed + 310 + ci, 0.8, false, false, false);
    if (spur) pl.stampEdge(spur);
    nodes.push({ id: C.id, x: cx, y: ly + 0.2 });
    const wx = cx + 2.3, wy = (Cc.y / T + ly) / 2 + 0.7;
    wells.push({ x: wx, y: wy, zone: C.id });
    pl.block(wx - 1, wy - 0.8, wx + 1, wy + 0.3);
    nbZones.push({ nb: C.id, houses: hs, street: lane as PathEdge });
  });
  const singles: { o: TownObject; id: string }[] = [];
  bp.singles.forEach((S) => {
    const o = place(S.s, S.at[0], S.at[1], `${S.id}-house`, { zone: S.id }, "cottage", "Cottage");
    add(o); houseObjs.push(o); blockPlanner(o.block, 1);
    if (S.garden) gardens.add(o.id);
    singles.push({ o, id: S.id });
  });
  pl.finishObstacles(6);

  /* ---- 3. groves, the network ---- */
  for (const G of bp.groves) {
    const p: PlazaDef = { id: `${G.id}-clearing`, x: Math.round((G.center[0] - G.plaza[0] / 2) * MC) / MC, y: Math.round((G.center[1] - G.plaza[1] / 2) * MC) / MC, w: G.plaza[0], h: G.plaza[1], round: 1.8, apron: 0.9, rag: 0.7 };
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
  const unroutable: string[] = [];
  for (const c of cand) {
    if (find(c.a) === find(c.b)) continue;
    const added = pl.connect(`p${ek}`, [nodes[c.a].x, nodes[c.a].y], [nodes[c.b].x, nodes[c.b].y], "trunk", seed + ek * 17);
    ek++;
    if (added < 0) { unroutable.push(`${nodes[c.a].id}-${nodes[c.b].id}`); continue; }          // a belt can close this pair: another pair will join the pieces
    parent[find(c.a)] = find(c.b); link.push([c.a, c.b, c.d * 1.3]);
  }
  const roots = new Set(nodes.map((_, i) => find(i)));
  if (roots.size > 1) {
    const pieces = new Map<number, string[]>();
    nodes.forEach((n, i) => { const r = find(i); (pieces.get(r) ?? pieces.set(r, []).get(r)!).push(n.id); });
    problems.push(`the network has ${roots.size} pieces: ${[...pieces.values()].map((v) => v.join("+")).join(" | ")}; no route for ${unroutable.slice(0, 12).join(", ")}`);
  }
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
  // directness: the places a student walks between (the hubs) must not be reached by a path much longer than the crow flies, unless a belt is in the way
  const ui = ["library", "cafe", "bakery", "bookshop", "orchard-park"].map((id) => nodes.find((n) => n.id === id)).filter(Boolean) as { id: string; x: number; y: number }[];
  const crossesBelt = (a: { x: number; y: number }, b: { x: number; y: number }) => { const L = Math.hypot(b.x - a.x, b.y - a.y); for (let t = 0; t <= L; t += 0.5) if (pl.beltTiles.has(Math.floor(a.y + ((b.y - a.y) * t) / L) * cols + Math.floor(a.x + ((b.x - a.x) * t) / L))) return true; return false; };
  const matDistances = (from: { x: number; y: number }): Float64Array => {
    const dist = new Float64Array(pl.cx * pl.cy).fill(Infinity);
    const si = Math.floor(from.y * MC) * pl.cx + Math.floor(from.x * MC);
    dist[si] = 0;
    const hf: number[] = [0], hi: number[] = [si];
    const push = (f: number, i: number) => { let k = hf.length; hf.push(f); hi.push(i); while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= f) break; hf[k] = hf[p]; hi[k] = hi[p]; k = p; } hf[k] = f; hi[k] = i; };
    const pop = (): [number, number] => {
      const f0 = hf[0], i0 = hi[0], lf = hf.pop() as number, li = hi.pop() as number;
      if (hf.length) { let k = 0; for (;;) { let c = 2 * k + 1; if (c >= hf.length) break; if (c + 1 < hf.length && hf[c + 1] < hf[c]) c++; if (hf[c] >= lf) break; hf[k] = hf[c]; hi[k] = hi[c]; k = c; } hf[k] = lf; hi[k] = li; }
      return [f0, i0];
    };
    hf.length = 0; hi.length = 0; push(0, si);
    while (hf.length) {
      const [dd, i] = pop();
      if (dd > dist[i]) continue;
      const x = i % pl.cx, y = Math.floor(i / pl.cx);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= pl.cx || ny >= pl.cy || !pl.mask[ny * pl.cx + nx]) continue;
        const nd = dd + (dx && dy ? Math.SQRT2 : 1), j = ny * pl.cx + nx;
        if (nd < dist[j]) { dist[j] = nd; push(nd, j); }
      }
    }
    return dist;
  };
  let direct = 0;
  for (let round = 0; round < 12; round++) {
    let worst: { a: number; b: number; r: number } | null = null;
    ui.forEach((A, ia) => {
      const dist = matDistances(A);
      ui.forEach((B, ib) => {
        if (ib <= ia) return;
        const crow = Math.hypot(A.x - B.x, A.y - B.y);
        if (crow < 8 || crossesBelt(A, B)) return;
        const P = dist[Math.floor(B.y * MC) * pl.cx + Math.floor(B.x * MC)] / MC, r = P / crow;
        if (r > bp.directness && (!worst || r > worst.r)) worst = { a: ia, b: ib, r };
      });
    });
    if (!worst) break;
    const w = worst as { a: number; b: number; r: number };
    if (pl.connect(`direct${direct++}`, [ui[w.a].x, ui[w.a].y], [ui[w.b].x, ui[w.b].y], "trunk", seed + 1500 + round * 7, undefined, 2.2) < 0) break;
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
  // single houses: their spur goes to the nearest path
  for (const S of singles) {
    const e = entryOf(S.o);
    const t = pl.nearestAttach(e.x / T, e.y / T + 1, 14);
    if (!t) { problems.push(`single house ${S.id}: no path within 14 tiles`); continue; }
    if (pl.connect(`${S.id}-spur`, [e.x / T, e.y / T + 0.8], [t.x, t.y], "spur", seed + 700, 0.8) < 0) problems.push(`single house ${S.id}: no route to a path`);
  }
  // the distance-field clamp: no junction swells over the cap
  const carved = pl.carveBelts();
  const trimmed = pl.clampWidths(bp.widthCap, 3.0);
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
  const bx0 = bounds.x + 14, by0 = bounds.y + 14, bx1 = bounds.x + bounds.w - 14, by1 = bounds.y + bounds.h - 14;
  const nearBounds = (r: Rect) => r.x < bx0 || r.y < by0 || r.x + r.w > bx1 || r.y + r.h > by1;
  const doorList = objects.filter((o) => o.door);
  const nearDoor = (r: Rect, g: number) => doorList.some((o) => gap(r, (o.door as NonNullable<TownObject["door"]>).trigger) < g);
  const phRects: Rect[] = bp.placeholders.map((p) => ({ x: p.rect[0] * T, y: p.rect[1] * T, w: p.rect[2] * T, h: p.rect[3] * T }));
  const zoneAt = (x: number, y: number) => zones.find((z) => inRect(z.rect, x, y))?.id ?? "paths";

  /** Where a path comes into a plaza: furniture and dressing keep clear of the way in (a clump of benches across a path's mouth seals the plaza). */
  const lanePts: [number, number][] = [];
  for (const p of plazaDefs) for (const e of pl.edges) for (let i = 0; i < e.pts.length; i += 2) { const sd = roundedSd(p, e.pts[i][0], e.pts[i][1]); if (sd > 0 && sd < 4.5) lanePts.push([e.pts[i][0] * T, e.pts[i][1] * T]); }
  const nearLane = (r: Rect, g: number) => lanePts.some(([x, y]) => x > r.x - g && x < r.x + r.w + g && y > r.y - g && y < r.y + r.h + g);

  /* ---- colour families: groves of one colour, a contrast now and then ---- */
  const famAt = (x: number, y: number): (typeof FAMS)[number] => {
    const t = valueNoise(seed + 120, x / T, y / T, 12), r = valueNoise(seed + 121, x / T, y / T, 6);
    if (r > 0.8 && t > 0.3) return "red";
    return t < 0.4 ? "gold" : t < 0.66 ? "amber" : t < 0.82 ? "mixed" : "gold";
  };
  const rt = rng(seed + 91);
  const treeAt = (x: number, y: number, size: "l" | "m", contrast = 0.14): string => {
    let f = famAt(x, y);
    const a = rt(), b = rt(), c = rt();
    if (a < contrast) f = FAMS[Math.floor(b * FAMS.length)];
    const list = TREES[f];
    return `tree_${size}_${list[Math.floor(c * list.length)]}`;
  };
  const bushAt = (x: number, y: number, contrast = 0.1): string => {
    let f = famAt(x, y);
    const a = rt(), b = rt();
    if (a < contrast) f = FAMS[Math.floor(b * FAMS.length)];
    const list = BUSHES[f];
    return list[Math.floor(rt() * list.length)];
  };

  const famBush = (f: (typeof FAMS)[number], r: number) => BUSHES[f][Math.floor(r * BUSHES[f].length)];
  const famTree = (f: (typeof FAMS)[number], size: "l" | "m", r: number) => `tree_${size}_${TREES[f][Math.floor(r * TREES[f].length)]}`;
  /* ---- belts: continuous hedge rows and walls of trees between the districts; open only where a path crosses ---- */
  let beltN = 0;
  const beltElem = (name: string, x: number, y: number): boolean => {
    const o = place(name, x / T, y / T, `belt-${beltN}`, { zone: "hedge" });
    if (onMat(o.foot, 5)) return false;                                  // the gate: the path and a little more
    if (bucket.hits(grow(o.block, 1))) return false;                       // a building (solid already)
    for (const r of phRects) if (overlaps(o.block, r)) return false;
    beltBucket.add(o.block); objects.push(o); beltN++;
    return true;
  };
  for (const B of bp.belts) {
    const pts = B.pts;
    let arc = 0, nextBush = 0, nextTree = 14;
    for (let i = 0; i + 1 < pts.length; i++) {
      const ax = pts[i][0] * T, ay = pts[i][1] * T, bx = pts[i + 1][0] * T, by = pts[i + 1][1] * T, L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L;
      for (let a = 0; a < L; a += 2) {
        const at = arc + a, x = ax + ((bx - ax) * a) / L, y = ay + ((by - ay) * a) / L;
        const section = Math.floor(at / (14 * T)), fam = (['gold', 'amber', 'gold', 'mixed', 'amber', 'red'] as const)[Math.floor(hash2(seed + 137, section, B.id.length * 7) * 6)], kind = B.kind === "mixed" ? (hash2(seed + 130, section, B.id.length) < 0.5 ? "hedge" : "wood") : B.kind;
        if (at >= nextBush) {
          const lat = (hash2(seed + 131, Math.floor(at), 1) - 0.5) * 6;
          beltElem(famBush(fam, hash2(seed + 138, Math.floor(at), 7)), x + nx * lat, y + ny * lat + 4);
          // bushes are wide and shallow: along a vertical run they stand closer so the row reads as one hedge
          const horiz = Math.abs(bx - ax) / L;
          nextBush = at + 17 + 14 * horiz + hash2(seed + 132, Math.floor(at), 2) * 3;
        }
        if (at >= nextTree) {
          const side = hash2(seed + 133, Math.floor(at), 3) < 0.5 ? 1 : -1, lat = side * (8 + hash2(seed + 134, Math.floor(at), 4) * 8);
          const big = kind === "wood" && hash2(seed + 135, Math.floor(at), 5) < 0.5;
          beltElem(famTree(fam, big ? "l" : "m", hash2(seed + 139, Math.floor(at), 8)), x + nx * lat, y + ny * lat + 2);
          nextTree = at + (kind === "wood" ? 30 : 70) + hash2(seed + 136, Math.floor(at), 6) * 30;
        }
      }
      arc += L;
    }
  }

  // what actually blocks: a continuous strip under every belt (the drawn bushes and trunks are shallow and would leave gaps), open where a path or plaza is
  const walls: number[] = [];
  for (const B of bp.belts) {
    for (let i = 0; i + 1 < B.pts.length; i++) {
      const ax = B.pts[i][0] * T, ay = B.pts[i][1] * T, bx = B.pts[i + 1][0] * T, by = B.pts[i + 1][1] * T, L = Math.hypot(bx - ax, by - ay);
      for (let a = 0; a <= L; a += 8) {
        const x = ax + ((bx - ax) * a) / L, y = ay + ((by - ay) * a) / L + 4, r: Rect = { x: Math.round(x - 8), y: Math.round(y - 8), w: 16, h: 16 };
        if (onMat(r, 2) || bucket.hits(r)) continue;
        walls.push(r.x, r.y, r.w, r.h);
      }
    }
  }

  /* ---- 4. furniture ---- */
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
  const clearOfBelts = (r: Rect, g: number) => beltBucket.clear(r, g);
  /** Furniture off the paths (its base on no path or plaza cell), clear of others, inside the bounds, not in front of a door. */
  const addFurn = (id: string, type: string, ax: number, ay: number, zone?: string, opt: { free?: boolean; gap?: number; lane?: boolean } = {}): boolean => {
    const o = furnObj(id, type, ax, ay, zone);
    if (nearBounds(o.block)) return false;
    if (!opt.free && onMat(o.block, 2)) return false;
    if (!bucket.clear(o.block, opt.gap ?? 6) || !clearOfBelts(o.block, 8)) return false;
    if (nearDoor(o.block, 16) || (opt.lane !== false && nearLane(o.block, 40))) return false;
    add(o); return true;
  };
  const addProp = (id: string, sprite: string, ax: number, ay: number, zone?: string, free = false): TownObject | null => {
    const o = place(sprite, ax / T, ay / T, id, { zone: "dress", kind: "prop" });
    void zone;
    if (nearBounds(o.block) || (!free && onMat(o.block, 2)) || (free && onDirt(o.block)) || !bucket.clear(o.block, 6) || !clearOfBelts(o.block, 8) || nearDoor(o.block, 16) || nearLane(o.block, 40)) return null;
    add(o); return o;
  };
  /** Dressing at a place: if it does not fit there, the nearest free spot within `reach` px (rings of 6 px). `free`: may stand on the paving. */
  const dressAt = (id: string, sprite: string, ax: number, ay: number, opt: { free?: boolean; reach?: number; gap?: number; matGap?: number } = {}): TownObject | null => {
    const reach = opt.reach ?? 40;
    for (let r = 0; r <= reach; r += 6) for (let k = 0; k < (r === 0 ? 1 : 12); k++) {
      const a = (k / 12) * Math.PI * 2 + r * 0.3, x = ax + Math.cos(a) * r, y = ay + Math.sin(a) * r * 0.7;
      const o = place(sprite, x / T, y / T, id, { zone: "dress", kind: "prop" });
      if (nearBounds(o.block) || (!opt.free && onMat(o.block, opt.matGap ?? 3)) || (opt.free && onDirt(o.solids ? boundsOf(o.solids) : o.foot)) || !bucket.clear(o.block, opt.gap ?? 5) || !clearOfBelts(o.block, 8) || nearDoor(o.block, 16) || nearLane(o.block, 40)) continue;
      if (phRects.some((q) => gap(o.block, q) < 10)) continue;
      add(o); return o;
    }
    return null;
  };
  /** A run of one sprite along a straight line (px), stepping `step`, each piece kept only if it fits (a piece on a path is dropped: that is the gap). */
  const run = (idp: string, sprite: string, x0: number, y0: number, x1: number, y1: number, step: number, opt: { grace?: number; zone?: string; keep?: (x: number, y: number) => boolean } = {}): number => {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / step));
    let made = 0;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      if (opt.keep && !opt.keep(x, y)) continue;
      const hedge = opt.zone === "hedge", o = place(sprite, x / T, y / T, `${idp}-${i}`, hedge ? { zone: "hedge" } : { zone: "dress", kind: "prop" });
      if (nearBounds(o.block) || onMat(o.block, opt.grace ?? 3) || nearDoor(o.block, 14)) continue;
      if (hedge ? bucket.hits(grow(o.block, 1)) : !bucket.clear(o.block, 0.5) || !clearOfBelts(o.block, 8)) continue;
      if (phRects.some((q) => gap(o.block, q) < 6)) continue;
      if (hedge) { beltBucket.add(o.block); objects.push(o); } else add(o);
      made++;
    }
    return made;
  };
  /** Whether a rect stands on path (dirt) cells: paving and grass are fine for dressing, dirt is the way. */
  const onDirt = (r: Rect): boolean => { for (let j = Math.floor(r.y / CELL_PX); j <= Math.floor((r.y + r.h - 1) / CELL_PX); j++) for (let i = Math.floor(r.x / CELL_PX); i <= Math.floor((r.x + r.w - 1) / CELL_PX); i++) if (i >= 0 && j >= 0 && i < cx && j < cy && mask[j * cx + i] === MAT.path) return true; return false; };
  const inside = (p: PlazaDef, x: number, y: number, m: number) => roundedSd(p, x, y) < -m;
  const benchToward = (ax: number, ay: number, tx: number, ty: number): string => {
    const dx = tx - ax, dy = ty - ay;
    return Math.abs(dy) >= Math.abs(dx) ? (dy > 0 ? "bench_front" : "bench_back") : dx > 0 ? "bench_right" : "bench_left";
  };

  // plaza sets, from the blueprint (relative to the plaza's centre)
  for (const p of plazaDefs) {
    const key = p.id.replace(/-plaza$|-clearing$/, "");
    const set = bp.plazaFurniture[key] ?? [];
    set.forEach(([type, dx, dy], i) => {
      if (!addFurn(`${key}-set-${i}`, type, (p.x + p.w / 2 + dx) * T, (p.y + p.h / 2 + dy) * T, key, { free: true, lane: false })) problems.push(`plaza set ${key} #${i} (${type}) did not fit`);
    });
  }
  // plaza edges: benches facing in, a lamp at the corners, a bin
  for (const p of plazaDefs) {
    const key = p.id.replace(/-plaza$|-clearing$/, "");
    const isGrove = p.id.endsWith("-clearing");
    const L = bp.landmarks.find((l) => l.id === key);
    const doorX = L ? entryOf(objects.find((o) => o.id === L.id) as TownObject).x / T : p.x + p.w / 2;
    let n = 0;
    const put = (type: string, x: number, y: number) => { if (inside(p, x, y, 0.4) && addFurn(`${key}-edge-${n}`, type, x * T, y * T, key, { free: true })) n++; };
    const step = isGrove ? 3.2 : 4.6;
    for (let x = p.x + 2.2; x <= p.x + p.w - 2.2; x += step) {
      if (!L || Math.abs(x - doorX) > (L.door === "library" ? 4.4 : 3.0)) put("bench_front", x, p.y + 1.15);
      put("bench_back", x, p.y + p.h - 0.6);
    }
    if (p.w >= 10) for (let y = p.y + 2.2; y <= p.y + p.h - 1.6; y += 3.4) { put("bench_right", p.x + 1.1, y + 0.4); put("bench_left", p.x + p.w - 1.1, y + 0.4); }
    const lampAt = (lx: number, ly: number) => { const cxm = p.x + p.w / 2, cym = p.y + p.h / 2; for (let k = 0; k < 20 && !inside(p, lx, ly, 0.9); k++) { lx += (cxm - lx) * 0.08; ly += (cym - ly) * 0.08; } addProp(`${key}-lamp-${n++}`, isGrove ? "lamp-post-small" : "lamp-post-ornate", lx * T, ly * T, key, true); };
    for (const [lx, ly] of [[p.x + 0.8, p.y + 0.9], [p.x + p.w - 0.8, p.y + 0.9], [p.x + 0.8, p.y + p.h - 0.5], [p.x + p.w - 0.8, p.y + p.h - 0.5]]) if (p.w >= 10 || ly > p.y + 2) lampAt(lx, ly);
    if (bp.benches.bin) { let bx = p.x + 1.8, by = p.y + p.h - 1.2; for (let k = 0; k < 20 && !inside(p, bx, by, 0.7); k++) { bx += (p.x + p.w / 2 - bx) * 0.08; by += (p.y + p.h / 2 - by) * 0.08; } addProp(`${key}-bin`, "bin", bx * T, by * T, key, true); }
  }
  let dressMissed = 0;
  // plaza dressing from the blueprint: [sprite, dx, dy] tiles from the door's entry (a building) or the clearing's middle (a grove)
  for (const [key, list] of Object.entries(bp.plazaDress)) {
    const p = plazaDefs.find((q) => q.id === `${key}-plaza` || q.id === `${key}-clearing`);
    if (!p) { problems.push(`plazaDress ${key}: no such plaza`); continue; }
    const lo = objects.find((o) => o.id === key && o.door);
    const ox = lo ? entryOf(lo).x / T : p.x + p.w / 2, oy = lo ? entryOf(lo).y / T : p.y + p.h / 2;
    list.forEach(([sprite, dx, dy], i) => { if (!dressAt(`${key}-dress-${i}`, sprite, (ox + dx) * T, (oy + dy) * T, { free: true, reach: 30, gap: 3 })) dressMissed++; });
  }
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
          if (addFurn(`bench-${e.id}-${benchN}`, type, ax, ay, zoneAt(ax, ay))) {
            benchN++; done = true;
            // a bench's neighbours: a bin, a lamp
            const nb = hash2(seed + 170, benchN, 1);
            if (nb < 0.3) addProp(`bin-${benchN}`, "bin", ax + tx * 30, ay + ty * 30 + 2, "dress");
            else if (nb < 0.5) addProp(`blamp-${benchN}`, "lamp-post-small", ax - tx * 28, ay - ty * 28, "dress");
          }
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
        const bxx = ax + tx * 30, byy = ay + ty * 30;
        addFurn(`bench-lamp-${e.id}-${lampN}`, benchToward(bxx, byy, e.pts[i][0] * T + tx * 30, e.pts[i][1] * T + ty * 30), bxx, byy, zoneAt(ax, ay));
        break;
      }
    }
  }
  // viewpoints: two benches with a view
  for (const v of viewpoints) {
    const dx = v.x - v.from.x, dy = v.y - v.from.y;
    addFurn(`bench-view-${Math.round(v.x)}-${Math.round(v.y)}`, benchToward(v.x * T, v.y * T, v.x * T - dx * 3, v.y * T - dy * 3), v.x * T, v.y * T + 2, "view", { free: true });
    addFurn(`bench-view2-${Math.round(v.x)}-${Math.round(v.y)}`, benchToward(v.x * T + 36, v.y * T, v.x * T - dx * 3, v.y * T - dy * 3), v.x * T + 36, v.y * T + 2, "view", { free: true });
  }

  /* ---- 5. incidents: the things that make a meadow a place ---- */
  houseObjs.forEach((h, hi) => {
    const d = entryOf(h), w = sprites[h.sprite as string].foot.w;
    const zone = h.zone;
    if (gardens.has(h.id)) {
      // a fenced front garden: the front line (a gap where the spur comes through), two side lines running back, a mailbox at the gate
      const xL = h.x - w / 2 - 22, xR = h.x + w / 2 + 22, yF = d.y + 26;
      run(`gf-${hi}-front`, "fence-straight", xL, yF, xR, yF, 33, { grace: 5, keep: (x) => Math.abs(x - d.x) > 40 });
      // the sides are hedges (the fence art is front on: a fence cannot run back into the picture), the front corners a post
      for (const sx of [xL, xR]) { run(`gf-${hi}-post${sx < h.x ? "l" : "r"}`, "fence-post", sx, yF + 1, sx, yF + 1, 10, { grace: 3 }); run(`gf-${hi}-side${sx < h.x ? "l" : "r"}`, bushAt(sx, yF, 0.05), sx, yF - 20, sx, yF - 80, 22, { grace: 4, zone: "hedge" }); }
      dressAt(`mailbox-${hi}`, "mailbox", d.x - 54, yF + 3, { reach: 10, matGap: 6, gap: 1 });
      addProp(`planter-${h.id}`, "planter-flowers", d.x + 54, d.y + 10, zone);
      return;
    }
    const kind = hi % 4;
    dressAt(`mailbox-${hi}`, "mailbox", d.x + (hi % 2 ? 44 : -44), d.y + 16, { reach: 14, matGap: 8 });
    if (kind === 0) { addProp(`planter-${h.id}`, "planter-flowers", d.x - 46, d.y + 3, zone); addProp(`lamp-${h.id}`, "lamp-post-small", d.x + 47, d.y - 2, zone); }
    else if (kind === 1) { for (const s of [1, -1]) if (addFurn(`bench-door-${h.id}`, "bench_front", d.x + s * (w / 2 + 40), d.y - 2, zone)) break; addProp(`planter-${h.id}`, "planter-pumpkins", d.x + 46, d.y + 3, zone); }
    else if (kind === 2) { dressAt(`logs-${h.id}`, "log", h.x + w / 2 + 34, h.y + 2, { reach: 20, gap: 3 }); dressAt(`stump-${h.id}`, "stump_small", h.x + w / 2 + 62, h.y - 4, { reach: 20, gap: 3 }); addProp(`lamp-${h.id}`, "lamp-post-small", d.x - 47, d.y - 2, zone); }
    else { addProp(`planter-${h.id}`, "planter-flowers", d.x + 46, d.y + 3, zone); dressAt(`barrel-${h.id}`, "barrel", h.x - w / 2 - 22, h.y + 4, { reach: 20 }); }
  });
  // wells (the courtyards') and the hand placed dressing
  wells.forEach((w, i) => { if (!dressAt(`well-c${i}`, "well", w.x * T, w.y * T, { reach: 24, gap: 3 })) problems.push(`courtyard well ${i} did not fit`); });
  bp.dress.forEach((D, i) => { if (!dressAt(D.id ?? `dress-${D.s}-${i}`, D.s, D.at[0] * T, D.at[1] * T, { reach: 56 })) problems.push(`dress ${D.s} at ${D.at} did not fit`); });
  // junctions (a route ends on another path): the most separated few get a noticeboard and a signpost, on the grass in the angle between the ways
  const junctions: { x: number; y: number }[] = [];
  for (const e of pl.edges) {
    if (e.kind === "spur" || e.kind === "foot") continue;
    for (const end of [e.pts[0], e.pts[e.pts.length - 1]]) {
      let near = false;
      for (const o of pl.edges) { if (o === e || near) continue; for (let i = 0; i < o.pts.length; i += 2) if (Math.hypot(o.pts[i][0] - end[0], o.pts[i][1] - end[1]) < 1.3) { near = true; break; } }
      if (near && !plazaDefs.some((p) => roundedSd(p, end[0], end[1]) < 3)) junctions.push({ x: end[0], y: end[1] });
    }
  }
  const lib = plazaDefs.find((q) => q.id === "library-plaza") as PlazaDef;
  const chosen: { x: number; y: number }[] = [];
  junctions.sort((a, b) => Math.hypot(a.x - lib.x, a.y - lib.y) - Math.hypot(b.x - lib.x, b.y - lib.y));
  for (const j of junctions) if (chosen.length < bp.junctionBoards && chosen.every((c) => Math.hypot(c.x - j.x, c.y - j.y) > 24)) chosen.push(j);
  let boards = 0;
  chosen.forEach((j, ji) => {
    for (const [sprite, off] of [["noticeboard", 3.0], ["signpost-double", 2.6]] as [string, number][]) {
      let best: { x: number; y: number; d: number } | null = null;
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + (sprite === "noticeboard" ? 0.2 : 2.4), x = (j.x + Math.cos(a) * off) * T, y = (j.y + Math.sin(a) * off) * T, d = matDist(x, y); if (!best || d > best.d) best = { x, y, d }; }
      if (best && dressAt(`${sprite}-j${ji}`, sprite, best.x, best.y, { reach: 28 })) boards++;
    }
  });
  // stone wall runs along some straight, level path stretches, hedge rows along others (the art is front on: a wall only runs left to right)
  let stoneWalls = 0, hedges = 0;
  for (const e of pl.edges) {
    if (e.kind === "spur" || e.kind === "foot" || e.pts.length < 60) continue;
    const roll = hash2(seed + 140, e.id.length, e.pts.length);
    if (roll > 0.85) continue;
    const side = hash2(seed + 141, e.pts.length, 7) < 0.5 ? 1 : -1;
    // the longest stretch that is level (|slope| < 0.18) and free
    let best: [number, number] | null = null, i = 8;
    while (i < e.pts.length - 8) {
      let j = i;
      while (j + 1 < e.pts.length - 8 && Math.abs(e.pts[j + 1][1] - e.pts[i][1]) < 0.26 * Math.max(1, Math.abs(e.pts[j + 1][0] - e.pts[i][0]))) j++;
      if (j - i > 18 && (!best || j - i > best[1] - best[0])) best = [i, j];
      i = j + 1;
    }
    if (!best) continue;
    const a = best[0] + 4, b = Math.min(best[1] - 4, a + 40);
    const off = (e.half[a] + 1.35) * T;
    if (stoneWalls < 8 && roll < 0.4) {
      const n = run(`wall-${stoneWalls}`, "stone-wall", e.pts[a][0] * T, e.pts[a][1] * T + side * off, e.pts[b][0] * T, e.pts[b][1] * T + side * off, 43, { grace: 6 });
      if (n >= 3) stoneWalls++;
    } else if (hedges < 12) {
      const hb = Math.min(b, a + 26), hn = run(`hedge-${hedges}`, bushAt(e.pts[a][0] * T, e.pts[a][1] * T, 0.05), e.pts[a][0] * T, e.pts[a][1] * T + side * (off + 10), e.pts[hb][0] * T, e.pts[hb][1] * T + side * (off + 10), 34, { grace: 6, zone: "hedge" });
      if (hn >= 3) hedges++;
    }
  }
  // a low wall along the library's and the cafe's plaza (a gap wherever a path comes in)
  for (const key of ["library", "cafe"]) {
    const p = plazaDefs.find((q) => q.id === `${key}-plaza`);
    if (!p) continue;
    run(`pwall-${key}`, "stone-wall", (p.x + 1.2) * T, (p.y + p.h + 1.7) * T, (p.x + p.w - 1.2) * T, (p.y + p.h + 1.7) * T, 43, { grace: 8 });
  }

  // the arch where a path comes into the library's plaza from the south (the art is front on: a vertical path through it)
  let arches = 0;
  {
    const p = plazaDefs.find((q) => q.id === "library-plaza");
    let best: { x: number; y: number; v: number } | null = null;
    if (p) for (const e of pl.edges) for (let i = 2; i < e.pts.length - 2; i++) {
      const [x, y] = e.pts[i], sd = roundedSd(p, x, y);
      if (sd < 2.0 || sd > 3.4 || y < p.y + p.h * 0.5) continue;
      const tx = e.pts[i + 1][0] - e.pts[i - 1][0], ty = e.pts[i + 1][1] - e.pts[i - 1][1], v = Math.abs(ty) / (Math.hypot(tx, ty) || 1);
      if (v > 0.8 && (!best || v > best.v)) best = { x, y, v };
    }
    if (best) {
      const o = place("stone-arch", best.x, best.y + 0.2, "arch-library", { zone: "dress", kind: "prop" });
      if (!nearDoor(o.block, 16) && !bucket.hits(o.block)) { add(o); arches++; }
    }
  }
  // the arch at a belt's gate where its path runs through level (a vertical path), a signpost where it does not
  for (const B of bp.belts) B.gates.forEach((g, i) => {
    let best: { x: number; y: number; v: number } | null = null;
    for (const e of pl.edges) for (let k = 2; k < e.pts.length - 2; k++) {
      const [x, y] = e.pts[k];
      if (Math.hypot(x - g[0], y - g[1]) > 2.6) continue;
      const tx = e.pts[k + 1][0] - e.pts[k - 1][0], ty = e.pts[k + 1][1] - e.pts[k - 1][1], v = Math.abs(ty) / (Math.hypot(tx, ty) || 1);
      if (!best || v > best.v) best = { x, y, v };
    }
    if (!best) return;
    if (best.v > 0.8) {
      const o = place("stone-arch", best.x, best.y + 0.25, `arch-${B.id}-${i}`, { zone: "dress", kind: "prop" });
      if (!nearDoor(o.block, 16) && !bucket.hits(o.block)) { add(o); arches++; }
    } else dressAt(`sign-${B.id}-${i}`, "signpost-double", (best.x + 2.1) * T, (best.y - 1.8) * T, { reach: 40 });
  });

  /* ---- worn ground: dirt showing through the grass where feet go ---- */
  for (const o of objects) {
    if (o.door && o.door.kind === "cottage") worn.push(Math.round(o.door.entry.x), Math.round(o.door.entry.y + 14), 17);
    else if (o.kind === "furniture" && o.type?.startsWith("bench_") && !onMat(o.block, 0) && hash2(seed + 150, o.x, o.y) < 0.7) worn.push(o.x, o.y + 10, 13);
    else if (o.sprite && /^(noticeboard|signpost-|well|cart-apples|mailbox)/.test(o.sprite) && !onMat(o.block, 0)) worn.push(o.x, o.y + 8, o.sprite === "well" || o.sprite === "cart-apples" ? 20 : 14);
  }

  /* ---- 6. trees, bushes, logs ---- */
  const logNames = cat.nature.objects.filter((o) => /^(stump|log|branch)/.test(o.name)).map((o) => o.name);
  const buildings = objects.filter((o) => o.kind === "building");
  const spriteBoxes = buildings.map((o) => ({ x: o.sx, y: o.sy, w: sprites[o.sprite as string].w, h: sprites[o.sprite as string].h }));
  const edgeDist = (x: number, y: number) => Math.min(x - bounds.x, y - bounds.y, bounds.x + bounds.w - x, bounds.y + bounds.h - y) / T;
  const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const F = bp.forest;
  /** The density of woodland at a point: a belt of F.belt tiles at the very edge, a gradient out to F.fade tiles, clumps and clearings in the gradient, clumps inland. */
  const density = (x: number, y: number) => {
    const e = edgeDist(x, y);
    const grad = 1 - smooth(F.belt, F.fade, e);                       // 1 inside the belt, falling to 0 at `fade` tiles
    const clump = smooth(0.38, 0.62, valueNoise(seed + 40, x / T, y / T, 5.5));     // clumps (about half the area)
    const clearing = smooth(0.66, 0.8, valueNoise(seed + 41, x / T, y / T, 7)) * smooth(F.belt, F.belt + 3, e);   // clearings, only outside the belt
    let edge = grad * (e < F.belt ? 0.95 - 0.1 * (1 - clump) : (0.2 + 0.8 * clump) * (1 - 0.9 * clearing));
    const inland = 0.008 + F.inland * smooth(0.62, 0.78, valueNoise(seed + 42, x / T, y / T, 8));
    let patch = 0;
    for (const [px, py, rx, ry] of bp.woodPatches) { const q = Math.hypot((x / T - px) / rx, (y / T - py) / ry); patch = Math.max(patch, 0.8 * (1 - smooth(0.55, 1.1, q))); }
    edge = Math.max(edge, 0);
    return Math.max(edge, patch, inland);
  };
  // canopy spacing: an ellipse round each tree, so big trees stand apart and a belt is not a carpet
  const treeGrid = new Map<number, { x: number; y: number; r: number }[]>();
  const canopyOk = (x: number, y: number, r: number, k: number): boolean => {
    for (let gy = Math.floor((y - 60) / 64); gy <= Math.floor((y + 60) / 64); gy++) for (let gx = Math.floor((x - 100) / 64); gx <= Math.floor((x + 100) / 64); gx++) {
      for (const q of treeGrid.get(gy * 4096 + gx) ?? []) { const ax = (r + q.r) * k, ay = ax * 0.5, dx = x - q.x, dy = y - q.y; if ((dx * dx) / (ax * ax) + (dy * dy) / (ay * ay) < 1) return false; }
    }
    return true;
  };
  const noteTree = (x: number, y: number, r: number) => { const k = Math.floor(y / 64) * 4096 + Math.floor(x / 64); const l = treeGrid.get(k); if (l) l.push({ x, y, r }); else treeGrid.set(k, [{ x, y, r }]); };
  const tryTree = (key: string, x: number, y: number, id: string, g: number, pathMin: number, k = 0): boolean => {
    const o = place(key, x / T, y / T, id, { zone: "wood" });
    if (nearBounds(grow(o.block, 4))) return false;
    if (matDist(o.x, o.y - 3) < pathMin || onMat(o.block, 4)) return false;
    if (!bucket.clear(o.block, g) || !beltBucket.clear(o.block, 16)) return false;
    const r = (sprites[key].w / 2) * 0.9;
    if (k > 0 && !canopyOk(o.x, o.y, r, k)) return false;
    for (const b of buildings) if (gap(o.block, b.foot) < 74 || gap(o.block, b.block) < 26) return false;
    for (const sb of spriteBoxes) if (overlaps(o.block, grow(sb, 20))) return false;
    for (const d of doorList) if (gap(grow(o.block, 20), (d.door as NonNullable<TownObject["door"]>).trigger) < 28) return false;
    for (const q of phRects) if (gap(o.block, q) < 22) return false;
    if (key.startsWith("tree_")) noteTree(o.x, o.y, r);
    add(o); return true;
  };
  // trees along the paths: sparse, a little back from the edge
  let pathTrees = 0;
  for (const e of pl.edges) {
    if (e.kind === "spur") continue;
    for (let i = 10; i < e.pts.length - 10; i += 14 + Math.floor(rt() * 16)) {
      const a = e.pts[Math.max(0, i - 1)], b = e.pts[Math.min(e.pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l, s = rt() < 0.5 ? 1 : -1, off = (e.half[i] + 1.8 + rt() * 2.6) * T;
      const x = e.pts[i][0] * T + nx * s * off, y = e.pts[i][1] * T + ny * s * off;
      if (tryTree(treeAt(x, y, rt() < 0.4 ? "l" : "m", 0.1), x, y, `pt-${pathTrees}`, 30, 40, 1.0)) pathTrees++;
    }
  }
  // the forest: size follows density (large trees where it is thick, medium and bushes at its fringe)
  let wood = 0;
  for (let tries = 0; tries < F.tries; tries++) {
    const x = rt() * W, y = rt() * H, r = rt(), dr = rt();
    const d = density(x, y);
    if (dr > d) continue;
    if (x < bounds.x - 4 || y < bounds.y - 4 || x > bounds.x + bounds.w + 4 || y > bounds.y + bounds.h + 4) continue;
    if (rt() > F.scale) continue;
    const bushShare = 0.34 - 0.2 * d, largeShare = 0.18 + 0.5 * d;
    const name = r < bushShare ? bushAt(x, y, 0.1) : r < bushShare + (1 - bushShare) * (1 - largeShare) ? treeAt(x, y, "m", 0.12) : treeAt(x, y, "l", 0.12);
    if (tryTree(name, x, y, `wood-${wood}`, 24, 34, name.startsWith("tree_") ? 1.06 - 0.2 * d : 0)) wood++;
  }
  // a bush and a tree behind each house, and bushes and logs just off the paths
  let bushN = 0;
  for (const h of houseObjs) {
    for (const dx of [-1, 1]) { const x = h.x + dx * (sprites[h.sprite as string].foot.w / 2 + 26), y = h.y - 30; if (tryTree(bushAt(x, y, 0.1), x, y, `hb-${bushN++}`, 24, 10)) break; }
    for (let k = 0; k < 6; k++) { const x = h.x + (rt() - 0.5) * 140, y = h.y - 120 - rt() * 60; if (tryTree(treeAt(x, y, "m", 0.1), x, y, `ht-${bushN++}`, 34, 30, 0.95)) break; }
  }
  let logN = 0;
  for (let tries = 0; tries < 4000 && logN < F.logs; tries++) {
    const x = rt() * W, y = rt() * H;
    const d = matDist(x, y);
    if (d < 36 || d > 150 || edgeDist(x, y) < 3) continue;
    const key = rt() < 0.55 ? logNames[Math.floor(rt() * logNames.length)] : bushAt(x, y, 0.1);
    if (tryTree(key, x, y, `ln-${logN}`, 30, 30)) logN++;
  }
  // the decoration treeline outside the walkable bounds: rows of trees, staggered, with gaps (it does not block; the bounds do)
  let deco = 0;
  {
    const perim = 2 * (bounds.w + bounds.h), step = F.decoStep * T;
    const at = (s: number, off: number): [number, number] => {
      const { x, y, w, h } = bounds;
      if (s < w) return [x + s, y - off];
      if (s < w + h) return [x + w + off, y + (s - w)];
      if (s < 2 * w + h) return [x + w - (s - w - h), y + h + off];
      return [x - off, y + h - (s - 2 * w - h)];
    };
    F.decoRows.forEach((row, ri) => {
      for (let s = (ri * step) / F.decoRows.length; s < perim; s += step * (0.8 + 0.4 * hash2(seed + 160, ri, Math.floor(s)))) {
        if (hash2(seed + 161, ri, Math.floor(s)) < F.decoSkip) continue;
        const [px, py] = at(s, row * T), x = px + (hash2(seed + 162, ri, Math.floor(s)) - 0.5) * 14, y = py + (hash2(seed + 163, ri, Math.floor(s)) - 0.5) * 14;
        if (x < 4 || y < 4 || x > W - 4 || y > H - 4) continue;
        const roll = hash2(seed + 164, ri, Math.floor(s));
        const name = roll < 0.12 ? bushAt(x, y, 0.1) : treeAt(x, y, ri === 0 || roll > 0.55 ? "l" : "m", 0.1);
        objects.push(place(name, x / T, y / T, `edge-${deco}`, { zone: "treeline" })); deco++;
      }
    });
  }

  /* ---- 7. collision, navigation, healing, spots ---- */
  const buildColl = () => {
    const coll = new CollisionGrid(W, H, bounds);
    for (const o of objects) if (o.zone !== "treeline") { if (o.solids) for (const r of o.solids) coll.addRect(r); else coll.addRect(o.block); }
    for (let i = 0; i < walls.length; i += 4) coll.addRect({ x: walls[i], y: walls[i + 1], w: walls[i + 2], h: walls[i + 3] });
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
    const victims = objects.filter((o) => (o.kind === "tree" || o.kind === "bush" || o.kind === "log") && o.zone === "wood" && pts.some((p) => gap(o.block, { x: p[0] - 8, y: p[1] - 8, w: 16, h: 16 }) < 18));
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

  /* ---- 8. hubs, bots, the output ---- */
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
    version: 3, name: bp.name, seed, cols, rows, bounds,
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
    worn, walls, hubs, botNodes, botLinks, placeholders: placeholderOut.map((p) => ({ id: p.id, label: `${p.label} (to be built)`, x: p.x, y: p.y })),
    stats: {
      objects: objects.length, trees: objects.filter((o) => o.kind === "tree").length, treesWalkable: objects.filter((o) => o.kind === "tree" && o.zone !== "treeline").length, treesDeco: objects.filter((o) => o.kind === "tree" && o.zone === "treeline").length, bushes: objects.filter((o) => o.kind === "bush").length,
      props: objects.filter((o) => o.kind === "prop").length, belt: objects.filter((o) => o.zone === "hedge").length, arches, worn: worn.length / 3,
      furniture: objects.filter((o) => o.kind === "furniture").length, spots: spots.length, buildings: buildings.length, houses: houseObjs.length, paths: pl.edges.length, healed,
    },
  };
  const matCount = [0, 0, 0]; for (let i = 0; i < mask.length; i++) matCount[mask[i]]++;
  return { data, registry: reg, problems, notes: { pathCells: matCount[1], plazaCells: matCount[2], woods: wood, pathTrees, deco, logs: logN, benches: benchN, lamps: lampN, loops, dressMissed, trimmed, carved, boards, junctions: junctions.length, stoneWalls, hedges, arches, beltWalls: walls.length / 4 } };
}
export { MAT };
