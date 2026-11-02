import type { Blueprint, FurnitureType } from "./blueprint";
import { classOf, cleanMask, maskProblems, pieceId, type Cls, type EdgeSets } from "./autotile";
import { CollisionGrid } from "./collision";
import { Nav } from "./nav";
import { hash2, rng, valueNoise } from "./rng";
import { TILE, type AtlasName, type Face, type Rect, type SitSpot, type SpriteDef, type TownData, type TownObject, type Zone } from "./types";

/* ---------- the art catalogues (the JSON the art tools wrote), only the fields used ---------- */
interface GroundTile { id: string; col: number; row: number; usable?: boolean }
export interface GroundManifest { tiles: GroundTile[]; fillFamilies: Record<string, string[]>; edgeSets: EdgeSets; cols: number }
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
  props: { props: PropObj[]; size: [number, number] };
  groundSize: [number, number];
}
export interface Registry { nextId: number; ids: Record<string, number> }
export interface Urls { ground: string; nature: string; cafe: string; cottage: string; props: string; premade: string; premadeRows: number }

/** Base boxes (w x d, centred on the anchor, ending at it) for the props atlas, which has no footprints of its own. */
const PROP_BASE: Record<string, [number, number]> = {
  "lamp-post-small": [6, 4], "lamp-post-ornate": [6, 4], "lamp-post-double": [8, 4], well: [30, 12], "cart-apples": [34, 10],
  "planter-flowers": [30, 8], "planter-pumpkins": [30, 8], bin: [12, 6], barrel: [18, 8], crates: [32, 10], noticeboard: [30, 8],
  "signpost-single": [8, 4], "signpost-double": [8, 4], mailbox: [8, 4],
};

const inRect = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
const shift = (r: Rect, dx: number, dy: number): Rect => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h });
const grow = (r: Rect, g: number): Rect => ({ x: r.x - g, y: r.y - g, w: r.w + 2 * g, h: r.h + 2 * g });
export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** The distance between two rects (0 when they touch or overlap). */
export function gap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w))), dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return Math.hypot(dx, dy);
}

export interface Compiled {
  data: TownData;
  registry: Registry;
  /** 0 grass, 1 dirt fill, 2 plaza fill, 3 edge piece, per tile. */
  kind: Uint8Array;
  problems: string[];
}

function spritesFrom(cat: Catalog) {
  const out: Record<string, SpriteDef> = {};
  for (const o of cat.nature.objects) {
    const isTree = o.name.startsWith("tree_");
    out[o.name] = { atlas: "nature", x: o.x, y: o.y, w: o.w, h: o.h, anchorX: o.anchorX, anchorY: o.anchorY, foot: o.footprint, ...(isTree ? { trunk: o.trunkRect, canopy: o.canopyRect ?? undefined } : {}) };
  }
  const c = cat.cafe.building;
  out.cafe = {
    atlas: "cafe", x: c.x, y: c.y, w: c.w, h: c.h, anchorX: c.anchorX, anchorY: c.anchorY, foot: c.footprint,
    block: { x: 0, y: 40, w: c.w, h: c.anchorY - 39 },       // the building's body: the ground behind its wall base is the cafe's, hidden by the roof
    roof: c.roofRect, door: c.door, entry: c.entry, trigger: { x: (c.door as Rect).x - 6, y: c.anchorY - 8, w: (c.door as Rect).w + 12, h: 36 },
  };
  for (const b of cat.cottages.buildings) {
    out[b.name] = {
      atlas: "cottage", x: b.x, y: b.y, w: b.w, h: b.h, anchorX: b.anchorX, anchorY: b.anchorY, foot: b.footprint, block: b.blockRect, roof: b.roofRect,
      door: b.doorRect, step: b.step, entry: b.entry, trigger: b.doorTrigger ? { ...b.doorTrigger, h: b.doorTrigger.h + 20 } : undefined, derived: b.derived,
    };
  }
  for (const p of cat.props.props) {
    const [bw, bd] = PROP_BASE[p.name] ?? [Math.round(p.w * 0.6), 6];
    out[p.name] = { atlas: "props", x: p.x, y: p.y, w: p.w, h: p.h, anchorX: p.anchorX, anchorY: p.anchorY, foot: { x: p.anchorX - Math.floor(bw / 2), y: p.anchorY - bd + 1, w: bw, h: bd } };
  }
  return out;
}

const kindOfObject = (name: string): TownObject["kind"] =>
  name.startsWith("tree_") ? "tree" : name.startsWith("bush_") ? "bush" : /^(stump|log|branch)/.test(name) ? "log" : name === "cafe" || name.startsWith("cottage_") ? "building" : "prop";

/** A distance-to-polyline mask: the tiles whose middle is within `halfWidth` tiles of the closed line. */
function ringMask(points: [number, number][], halfWidth: number, cols: number, rows: number): Uint8Array {
  const m = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const px = x + 0.5, py = y + 0.5;
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length];
      const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
    }
    if (best <= halfWidth) m[y * cols + x] = 1;
  }
  return m;
}

/** Points along the closed ring, every `step` px of arc, with the unit tangent and the INSIDE normal (clockwise on screen: tangent (1,0) -> inside (0,1)). */
export function ringSamples(points: [number, number][], step: number, start = 0) {
  const out: { x: number; y: number; tx: number; ty: number; nx: number; ny: number; s: number }[] = [];
  let total = 0;
  const segs = points.map((p, i) => { const q = points[(i + 1) % points.length]; const len = Math.hypot(q[0] - p[0], q[1] - p[1]) * TILE; const s0 = total; total += len; return { p, q, len, s0 }; });
  for (let s = start; s < total; s += step) {
    const g = segs.find((k) => s >= k.s0 && s < k.s0 + k.len) ?? segs[segs.length - 1];
    const t = (s - g.s0) / g.len, tx = (g.q[0] - g.p[0]) * TILE / g.len, ty = (g.q[1] - g.p[1]) * TILE / g.len;
    out.push({ x: (g.p[0] + (g.q[0] - g.p[0]) * t) * TILE, y: (g.p[1] + (g.q[1] - g.p[1]) * t) * TILE, tx, ty, nx: -ty, ny: tx, s });
  }
  return { samples: out, total };
}

export function compileTown(bp: Blueprint, cat: Catalog, urls: Urls, registry: Registry): Compiled {
  const { cols, rows } = bp;
  const problems: string[] = [];
  const W = cols * TILE, H = rows * TILE;
  const sprites = spritesFrom(cat);

  /* ---- ground masks ---- */
  const dirt = cleanMask(ringMask(bp.ring.points, bp.ring.halfWidth, cols, rows), cols, rows);
  const plaza = new Uint8Array(cols * rows);
  for (const p of bp.plazas) { const [x0, y0, w, h] = p.rect; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) plaza[y * cols + x] = 1; }
  const union = new Uint8Array(cols * rows);
  for (let i = 0; i < union.length; i++) union[i] = dirt[i] | plaza[i];
  cleanMask(union, cols, rows);
  for (const [x, y] of maskProblems(union, cols, rows)) problems.push(`ground: no edge piece for tile ${x},${y}`);
  const inU = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && union[y * cols + x] === 1;
  const inPlaza = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && plaza[y * cols + x] === 1;

  /* ---- placed objects ---- */
  const objects: TownObject[] = [];
  const blocks: Rect[] = [];       // block rects of everything that blocks, for spacing tests
  const place = (spriteKey: string, tx: number, ty: number, id: string, extra: Partial<TownObject> = {}): TownObject => {
    const sp = sprites[spriteKey];
    if (!sp) throw new Error(`unknown sprite ${spriteKey}`);
    // the anchor ROW is the last row above the ground line y (the sprite's bottom edge is at y), so footprints end exactly on tile lines
    const x = Math.round(tx * TILE), y = Math.round(ty * TILE), sx = x - sp.anchorX, sy = y - 1 - sp.anchorY;
    const foot = shift(sp.foot, sx, sy), block = shift(sp.block ?? sp.foot, sx, sy);
    const o: TownObject = { id, kind: kindOfObject(spriteKey), sprite: spriteKey, x, y, sortY: y, block, foot, sx, sy, ...extra };
    if (sp.entry && sp.trigger && (spriteKey === "cafe" || spriteKey.startsWith("cottage_"))) {
      o.door = { kind: spriteKey === "cafe" ? "cafe" : "cottage", rect: shift(sp.door as Rect, sx, sy), entry: { x: sx + sp.entry.x, y: sy + sp.entry.y }, trigger: shift(sp.trigger, sx, sy) };
    }
    return o;
  };

  // path distance: a tile within 1 tile of the path (fill) is "near"
  const near = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (union[y * cols + x]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) near[ny * cols + nx] = 1;
  }
  const nearPath = (r: Rect, margin = 0) => {
    const x0 = Math.floor((r.x - margin) / TILE), x1 = Math.floor((r.x + r.w + margin - 1) / TILE), y0 = Math.floor((r.y - margin) / TILE), y1 = Math.floor((r.y + r.h + margin - 1) / TILE);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < cols && y < rows && near[y * cols + x]) return true;
    return false;
  };
  const onPath = (r: Rect) => {
    const x0 = Math.floor(r.x / TILE), x1 = Math.floor((r.x + r.w - 1) / TILE), y0 = Math.floor(r.y / TILE), y1 = Math.floor((r.y + r.h - 1) / TILE);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < cols && y < rows && dirt[y * cols + x] && !plaza[y * cols + x]) return true;
    return false;
  };
  const onFill = (r: Rect) => {
    const x0 = Math.floor(r.x / TILE), x1 = Math.floor((r.x + r.w - 1) / TILE), y0 = Math.floor(r.y / TILE), y1 = Math.floor((r.y + r.h - 1) / TILE);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < cols && y < rows && (dirt[y * cols + x] || plaza[y * cols + x])) return true;
    return false;
  };
  const clearOfBlocks = (r: Rect, g: number) => blocks.every((b) => gap(r, b) >= g);
  const add = (o: TownObject) => { objects.push(o); blocks.push(o.block); };

  // fixed things first: the cafe and the cottages and the props
  for (const o of bp.objects) {
    const id = o.id ?? `${o.sprite}-${objects.length}`;
    const obj = place(o.sprite, o.at[0], o.at[1], id, { zone: o.zone });
    if (onPath(obj.block)) problems.push(`object ${id}: its footprint is on the path`);
    add(obj);
  }

  /* ---- furniture ---- */
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
  const addFurniture = (id: string, type: string, ax: number, ay: number, zone?: string, free = false): boolean => {
    const o = furnObj(id, type, ax, ay, zone);
    if (onFill(o.block) && !free) return false;
    if (!free && !clearOfBlocks(o.block, 6)) return false;
    add(o);
    return true;
  };

  // lamp posts (and a bench beside each) along the ring; benches between
  const { samples } = ringSamples(bp.ring.points, 8, 0);
  /** A bench type and facing for a bench on side `outer` (+1 inside the ring, -1 outside) of a path with inside normal (nx, ny). */
  const benchFacing = (nx: number, ny: number, outer: 1 | -1): string => {
    // the bench faces the path: on the inside it looks along -normal... the path is at the bench's other side from the normal it sits on
    const dx = -nx * outer, dy = -ny * outer;       // the direction from the bench to the path centre line
    if (Math.abs(dy) > Math.abs(dx)) return dy > 0 ? "bench_front" : "bench_back";
    return dx > 0 ? "bench_right" : "bench_left";
  };
  const tryRingFurniture = (type: string, id: string, s: (typeof samples)[number], offTiles: number, outer: 1 | -1, alongPx = 0): boolean => {
    for (let k = 0; k < 8; k++) {
      const off = offTiles * TILE + k * 4;
      const ax = s.x + s.nx * outer * off + s.tx * alongPx, ay = s.y + s.ny * outer * off + s.ty * alongPx;
      const o = furnObj(id, type, ax, ay, "ring");
      if (onFill(o.block) || nearBounds(o.block)) continue;
      if (!clearOfBlocks(o.block, 8)) return false;
      add(o);
      return true;
    }
    return false;
  };
  const bx0 = bp.bounds[0] * TILE + 12, by0 = bp.bounds[1] * TILE + 12, bx1 = (bp.bounds[0] + bp.bounds[2]) * TILE - 12, by1 = (bp.bounds[1] + bp.bounds[3]) * TILE - 12;
  const nearBounds = (r: Rect) => r.x < bx0 || r.y < by0 || r.x + r.w > bx1 || r.y + r.h > by1;
  const cafeOb = objects.find((o) => o.sprite === "cafe");
  const cafeCover: Rect | null = cafeOb ? { x: cafeOb.sx - 20, y: cafeOb.sy, w: (sprites.cafe.w) + 40, h: sprites.cafe.h + 40 } : null;

  let lampN = 0, benchN = 0;
  const lampStep = bp.lamps.everyTiles * TILE;
  for (let s = bp.lamps.startTiles * TILE; s < ringSamples(bp.ring.points, 1).total; s += lampStep) {
    const sm = samples.reduce((b, q) => (Math.abs(q.s - s) < Math.abs(b.s - s) ? q : b), samples[0]);
    const outer: 1 | -1 = lampN % 2 === 0 ? -1 : 1;
    const off = bp.lamps.offsetTiles * TILE;
    const lx = sm.x + sm.nx * outer * off, ly = sm.y + sm.ny * outer * off;
    const lamp = place(bp.lamps.sprite, lx / TILE, ly / TILE, `lamp-${lampN}`, { zone: "ring" });
    lampN++;
    if (onFill(lamp.block) || nearBounds(lamp.block) || !clearOfBlocks(lamp.block, 6) || (cafeCover && overlaps(lamp.block, cafeCover))) continue;
    add(lamp);
    if (bp.lamps.withBench) tryRingFurniture(benchFacing(sm.nx, sm.ny, outer), `bench-lamp-${lampN - 1}`, sm, bp.lamps.offsetTiles, outer, bp.lamps.benchGapPx);
  }
  let ringBenchN = 0;
  const bStep = bp.ringBenches.everyTiles * TILE;
  const ringTotal = ringSamples(bp.ring.points, 1).total;
  for (let s = bp.ringBenches.startTiles * TILE; s < ringTotal; s += bStep) {
    const sm = samples.reduce((b, q) => (Math.abs(q.s - s) < Math.abs(b.s - s) ? q : b), samples[0]);
    const outer: 1 | -1 = ringBenchN % 2 === 0 ? 1 : -1;
    let type = benchFacing(sm.nx, sm.ny, outer);
    if ((type === "bench_front" || type === "bench_back") && ringBenchN % bp.ringBenches.longEvery === bp.ringBenches.longEvery - 1) type += "_long";
    const ok = tryRingFurniture(type, `bench-ring-${ringBenchN}`, sm, 1.7, outer);
    if (ok) benchN++;
    ringBenchN++;
  }

  // explicit furniture (plaza edge, picnic clusters, study desk, cafe tables)
  for (const f of bp.furniture) {
    const id = f.id ?? `${f.type}-${objects.length}`;
    if (!addFurniture(id, f.type, f.at[0] * TILE, f.at[1] * TILE, f.zone, true)) problems.push(`furniture ${id}: on the path`);
  }

  /* ---- trees: clusters, then the treeline ---- */
  const treeRng = (seed: number) => rng(seed * 7919 + bp.seed);
  const tryTree = (key: string, x: number, y: number, id: string, g: number, treeline = false): boolean => {
    const o = place(key, x / TILE, y / TILE, id, { zone: treeline ? "treeline" : "grove" });
    if (!treeline && (nearPath(o.block, 6) || nearBounds(grow(o.block, 8)))) return false;
    if (onFill(o.block)) return false;
    if (treeline) { for (const b of blocks) if (overlaps(grow(o.block, 2), b)) return false; }
    else if (!clearOfBlocks(o.block, g)) return false;
    if (!treeline) {
      // not under a house's or the cafe's roof or in front of a door: keep the canopy off the doors
      for (const d of objects) if (d.door && gap(grow(o.block, 20), d.door.trigger) < 28) return false;
    }
    add(o);
    return true;
  };
  const pickWeighted = (mix: Record<string, number>, r: number): string => {
    const tot = Object.values(mix).reduce((a, b) => a + b, 0);
    let t = r * tot;
    for (const [k, w] of Object.entries(mix)) { t -= w; if (t <= 0) return k; }
    return Object.keys(mix)[0];
  };
  for (const c of bp.clusters) {
    const r = treeRng(c.seed);
    let placed = 0;
    for (let tries = 0; tries < c.n * 60 && placed < c.n; tries++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      const x = (c.center[0] + Math.cos(a) * d * c.rx) * TILE, y = (c.center[1] + Math.sin(a) * d * c.ry) * TILE;
      if (tryTree(pickWeighted(c.mix, r()), x, y, `${c.id}-${placed}`, 34)) placed++;
    }
    if (placed === 0) problems.push(`cluster ${c.id}: nothing fitted (asked for ${c.n})`);
    if (c.bench) { const [bxx, byy] = c.bench.at; if (!addFurniture(`${c.id}-bench`, c.bench.type, (c.center[0] + bxx) * TILE, (c.center[1] + byy) * TILE, "grove")) problems.push(`cluster ${c.id}: bench did not fit`); }
  }
  for (const sc of bp.scatter) {
    const r = treeRng(sc.seed);
    let n = 0;
    for (let tries = 0; tries < sc.tries; tries++) {
      const rect = sc.rects[Math.floor(r() * sc.rects.length)];
      const x = (rect[0] + r() * rect[2]) * TILE, y = (rect[1] + r() * rect[3]) * TILE;
      const key = sc.sprites[Math.floor(r() * sc.sprites.length)];
      if (tryTree(key, x, y, `${sc.id}-${n}`, sc.gap ?? sc.spacing, sc.decoration === true)) n++;
    }
  }

  /* ---- zones and sit spots ---- */
  const zones: Zone[] = bp.zones.map((z) => ({ id: z.id, name: z.name, rect: { x: z.rect[0] * TILE, y: z.rect[1] * TILE, w: z.rect[2] * TILE, h: z.rect[3] * TILE } }));
  const zoneAt = (x: number, y: number) => zones.find((z) => inRect(z.rect, x, y))?.id ?? "park";
  for (const o of objects) if (o.kind === "furniture" && !o.zone) o.zone = zoneAt(o.x, o.y);

  // collision and navigation, for the stand points
  const coll = new CollisionGrid(W, H, { x: bp.bounds[0] * TILE, y: bp.bounds[1] * TILE, w: bp.bounds[2] * TILE, h: bp.bounds[3] * TILE });
  for (const o of objects) if (o.zone !== "treeline") coll.addRect(o.block);
  const nav = new Nav(coll);
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

  /* ---- the ground ---- */
  const idx = new Map<string, number>();
  for (const t of cat.ground.tiles) idx.set(t.id, t.row * cat.ground.cols + t.col);
  const fam = cat.ground.fillFamilies;
  const ground = new Array<number>(cols * rows).fill(0);
  const kind = new Uint8Array(cols * rows);
  const seed = bp.seed;
  const treeCentres = objects.filter((o) => o.kind === "tree").map((o) => [o.x / TILE, o.y / TILE] as const);
  for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
    const i = ty * cols + tx;
    const pick = (list: string[], salt: number) => list[Math.floor(hash2(seed + salt, tx, ty) * list.length)];
    if (plaza[i]) { kind[i] = 2; ground[i] = idx.get(bp.plazaFill === "single" ? fam.plaza[0] : pick(fam.plaza, 1)) as number; continue; }
    if (dirt[i]) { kind[i] = 1; ground[i] = idx.get(pick(fam.dirt, 2)) as number; continue; }
    const cls = classOf(inU, tx, ty);
    if (cls !== "none" && cls !== "invalid") {
      kind[i] = 3;
      const wantPlaza = inPlaza(tx, ty - 1) || inPlaza(tx + 1, ty) || inPlaza(tx, ty + 1) || inPlaza(tx - 1, ty) || ((inPlaza(tx + 1, ty - 1) || inPlaza(tx - 1, ty - 1) || inPlaza(tx + 1, ty + 1) || inPlaza(tx - 1, ty + 1)) && !(inU(tx, ty - 1) || inU(tx + 1, ty) || inU(tx, ty + 1) || inU(tx - 1, ty)));
      ground[i] = idx.get(pieceId(cat.ground.edgeSets, wantPlaza ? "plaza" : "dirt", cls as Cls, seed + 3, tx, ty)) as number;
      continue;
    }
    // grass: seeded noise so it does not look tiled; flowers in drifts, leaves where trees are
    const fl = valueNoise(seed + 5, tx, ty, 5), lf = valueNoise(seed + 6, tx, ty, 4);
    let nearTree = false;
    for (const [cx, cy] of treeCentres) if (Math.abs(cx - tx) < 3.2 && Math.abs(cy - ty) < 3.2) { nearTree = true; break; }
    const roll = hash2(seed + 7, tx, ty);
    const set = fl > 0.62 && roll < 0.55 ? fam.grass_flower : (nearTree || lf > 0.68) && roll < 0.5 ? fam.grass_leaves : fam.grass_a;
    const flags = (hash2(seed + 8, tx, ty) < 0.5 ? 128 : 0) | (hash2(seed + 9, tx, ty) < 0.5 ? 256 : 0) | (hash2(seed + 10, tx, ty) < 0.25 ? 512 : 0);
    ground[i] = (idx.get(pick(set, 4)) as number) | flags;
  }

  /* ---- the ring's centre line as feet points, the plaza's stands, and the placeholders ---- */
  const ring: { x: number; y: number }[] = [];
  const bots = ringSamples(bp.ring.points, bp.botNodesEveryTiles * TILE, 0).samples;
  for (const s of bots) { const c = nav.nearestOpen(s.x, s.y, 3); ring.push(c ? { x: nav.centre(c[0], c[1])[0], y: nav.centre(c[0], c[1])[1] } : { x: s.x, y: s.y }); }
  const plazaStands = bp.plazaStands.map(([x, y]) => { const c = nav.nearestOpen(x * TILE, y * TILE, 4); return c ? { x: nav.centre(c[0], c[1])[0], y: nav.centre(c[0], c[1])[1] } : { x: x * TILE, y: y * TILE }; });
  const placeholders = objects.filter((o) => o.kind === "furniture").map((o) => ({ id: o.id, label: `${o.ph?.label} art (missing)`, x: o.x, y: o.y }));
  const spawn = nav.nearestOpen(bp.spawn[0] * TILE, bp.spawn[1] * TILE, 4) ?? [0, 0];
  const spawnPt = nav.centre(spawn[0], spawn[1]);

  const used = new Set<string>(objects.map((o) => o.sprite).filter(Boolean) as string[]);
  const spriteOut: Record<string, SpriteDef> = {};
  for (const k of used) spriteOut[k] = sprites[k];
  const data: TownData = {
    version: 1, name: bp.name, seed: bp.seed, cols, rows,
    bounds: { x: bp.bounds[0] * TILE, y: bp.bounds[1] * TILE, w: bp.bounds[2] * TILE, h: bp.bounds[3] * TILE },
    atlases: {
      ground: { url: urls.ground, w: cat.groundSize[0], h: cat.groundSize[1] }, nature: { url: urls.nature, w: cat.nature.size[0], h: cat.nature.size[1] },
      cafe: { url: urls.cafe, w: cat.cafe.size[0], h: cat.cafe.size[1] }, cottage: { url: urls.cottage, w: cat.cottages.size[0], h: cat.cottages.size[1] },
      props: { url: urls.props, w: cat.props.size[0], h: cat.props.size[1] },
    } as Record<AtlasName | "ground", { url: string; w: number; h: number }>,
    premade: { url: urls.premade, w: 1248, h: 32 * urls.premadeRows, rows: urls.premadeRows },
    sprites: spriteOut, ground, kind: [], groundCols: cat.ground.cols, objects, spots, zones,
    spawn: { x: spawnPt[0], y: spawnPt[1] }, ring, plaza: plazaStands, placeholders,
    stats: {
      objects: objects.length, trees: objects.filter((o) => o.kind === "tree").length, bushes: objects.filter((o) => o.kind === "bush").length,
      furniture: objects.filter((o) => o.kind === "furniture").length, spots: spots.length, lamps: lampN, buildings: objects.filter((o) => o.kind === "building").length,
    },
  };
  void benchN;
  data.kind = Array.from(kind);
  return { data, registry: reg, kind, problems };
}
