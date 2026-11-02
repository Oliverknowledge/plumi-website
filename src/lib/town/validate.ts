import { gap } from "./worldgen";
import { allObjects } from "./objects";
import { unrle } from "./plan";
import { NAV, TILE, type PathOut, type Rect, type TownData } from "./types";
import { World } from "./world";

export interface Report { failures: string[]; warnings: string[]; summary: Record<string, number | string> }

const inR = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/** Screen of the library at 1280 px: 427 x 267 art px (docs/study/town.md). Used for the density figure. */
export const SCREEN = { w: 427, h: 267 };

/** Pockets of open navigation cells that nobody can reach are allowed up to this many cells (a nav cell is 16 px; 4 tiles are 16 cells). */
export const POCKET_MAX = 4;
export const WIDTH_MIN = 1.9, WIDTH_MAX = 3.6;         // tiles, a path's cross section away from junctions (the brief: 2 to 3.5, less the 8 px cell rounding)
export const STRAIGHT_WINDOW = 12, STRAIGHT_MIN_DEV = 0.4;   // tiles: no 12 tile stretch may stay within 0.4 tiles of its chord
export const SPOTS_PER_SCREEN = [1.5, 2.5] as const;

/**
 * The map validator. A map that fails does not get written (`tools/town/build.ts`) and the tests assert it on the real map:
 *   every door's entry reachable from the spawn and standable; the path network (path and plaza cells) is ONE connected piece; no pocket of open
 *   navigation cells larger than 4 that the spawn cannot reach; no footprint on a path cell; each path's width in [2, 3.5] tiles at every
 *   sample that is not a junction, end or plaza; no 12 tile stretch of a path straighter than a tolerance and no sharp turn; every sit spot reachable
 *   with a stand point that fits; spots per screen in the asked band; ids and keys unique; trees leave walkable gaps.
 */
export function validateTown(d: TownData, world = new World(d)): Report {
  const failures: string[] = [], warnings: string[] = [];
  const { coll, nav } = world;
  const objects = allObjects(d);
  const W = d.cols * TILE, H = d.rows * TILE;
  const mat = unrle(d.mat.rle, d.mat.cols * d.mat.rows);
  const mcols = d.mat.cols, mrows = d.mat.rows, CELL = TILE / 4;

  // spawn
  if (!coll.fits(d.spawn.x, d.spawn.y)) failures.push("spawn is blocked");
  const reach = nav.reachable([d.spawn.x, d.spawn.y]);
  const key = (cx: number, cy: number) => cy * nav.cols + cx;

  // doors
  let doors = 0;
  for (const o of objects) if (o.door) {
    doors++;
    const e = o.door.entry, c = nav.nearestOpen(e.x, e.y + 8, 3);
    if (!c) { failures.push(`door of ${o.id}: no open cell near its entry`); continue; }
    if (!reach.has(key(c[0], c[1]))) failures.push(`door of ${o.id}: its entry is not reachable from the spawn`);
    const t = o.door.trigger;
    let ok = false;
    for (let y = t.y; y < t.y + t.h && !ok; y += 4) for (let x = t.x; x < t.x + t.w && !ok; x += 4) if (coll.fits(x, y) && reach.has(key(Math.floor(x / NAV), Math.floor(y / NAV)))) ok = true;
    if (!ok) failures.push(`door of ${o.id}: nobody can stand in its trigger`);
  }

  // sealed pockets: components of open navigation cells the spawn cannot reach
  let open = 0, sealed = 0, bigPockets = 0, biggest = 0;
  const seenCell = new Uint8Array(nav.cols * nav.rows);
  for (let cy = 0; cy < nav.rows; cy++) for (let cx = 0; cx < nav.cols; cx++) if (nav.open(cx, cy)) {
    open++;
    const k = key(cx, cy);
    if (reach.has(k) || seenCell[k]) continue;
    const q = [k]; seenCell[k] = 1;
    for (let i = 0; i < q.length; i++) {
      const x = q[i] % nav.cols, y = Math.floor(q[i] / nav.cols);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, nk = key(nx, ny); if ((dx || dy) && nav.open(nx, ny) && !seenCell[nk] && !reach.has(nk)) { seenCell[nk] = 1; q.push(nk); } }
    }
    sealed += q.length; biggest = Math.max(biggest, q.length);
    if (q.length > POCKET_MAX) { bigPockets++; failures.push(`a sealed pocket of ${q.length} navigation cells at (${(k % nav.cols) * NAV},${Math.floor(k / nav.cols) * NAV})`); }
  }

  // the path network is one piece (8-connected cells of path or plaza)
  const comp = new Int32Array(mat.length).fill(-1);
  let comps = 0; const compSize: number[] = [];
  for (let i = 0; i < mat.length; i++) if (mat[i] && comp[i] < 0) {
    const q = [i]; comp[i] = comps;
    for (let a = 0; a < q.length; a++) {
      const x = q[a] % mcols, y = Math.floor(q[a] / mcols);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= mcols || ny >= mrows) continue;
        const k = ny * mcols + nx;
        if (mat[k] && comp[k] < 0) { comp[k] = comps; q.push(k); }
      }
    }
    compSize.push(q.length); comps++;
  }
  if (comps !== 1) failures.push(`the path network is ${comps} pieces (sizes ${compSize.slice(0, 6).join(", ")})`);
  const matAtPx = (x: number, y: number) => { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); return i < 0 || j < 0 || i >= mcols || j >= mrows ? 0 : mat[j * mcols + i]; };

  // no footprint on a path (dirt) cell; plazas may carry their furniture, lamps and bins
  let onPath = 0;
  for (const o of objects) {
    if (o.zone === "treeline" || o.id.startsWith("bench-view")) continue;
    const f = o.foot;
    let hit = false;
    for (let y = Math.floor(f.y / CELL); y <= Math.floor((f.y + f.h - 1) / CELL) && !hit; y++) for (let x = Math.floor(f.x / CELL); x <= Math.floor((f.x + f.w - 1) / CELL); x++) {
      const m = x < 0 || y < 0 || x >= mcols || y >= mrows ? 0 : mat[y * mcols + x];
      if (m === 1 || (m === 2 && (o.kind === "tree" || o.kind === "bush" || o.kind === "log" || o.kind === "building"))) { hit = true; break; }
    }
    if (hit) { onPath++; failures.push(`${o.id}'s footprint is on a path`); }
  }

  // path geometry: widths, straightness, turns
  const lines = d.paths.filter((p) => p.kind !== "spur");
  const sample = (p: PathOut) => { const out: [number, number][] = []; for (let i = 0; i < p.pts.length; i += 2) out.push([p.pts[i] / TILE, p.pts[i + 1] / TILE]); return out; };
  const pts = lines.map(sample);
  const others = (ei: number, x: number, y: number, r: number) => {
    for (let k = 0; k < d.paths.length; k++) {
      if (d.paths[k] === lines[ei]) continue;
      const q = d.paths[k].pts;
      for (let i = 0; i < q.length; i += 2) if (Math.hypot(q[i] / TILE - x, q[i + 1] / TILE - y) < r) return true;
    }
    return false;
  };
  let wMin = Infinity, wMax = 0, wN = 0;
  let worstDev = Infinity, worstTurn = 0;
  lines.forEach((p, ei) => {
    const P = pts[ei];
    for (let i = 4; i < P.length - 4; i += 4) {
      const a = P[i - 1], b = P[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l;
      const [x, y] = P[i];
      if (others(ei, x, y, 3.6)) continue;
      // march along the normal both ways until the material ends; a plaza on the way means a junction: skip
      let w = 0, plaza = false;
      for (const s of [1, -1]) { let t = 0; while (t < 4) { const m = matAtPx((x + nx * s * t) * TILE, (y + ny * s * t) * TILE); if (m === 2) plaza = true; if (!m) break; t += 0.125; } w += t; }
      if (plaza || Math.min(i, P.length - i) < 8) continue;
      wN++; wMin = Math.min(wMin, w); wMax = Math.max(wMax, w);
      if (w < WIDTH_MIN || w > WIDTH_MAX) failures.push(`${p.id}: ${w.toFixed(2)} tiles wide at (${Math.round(x)},${Math.round(y)}) tiles`);
    }
    // straightness: windows of 12 tiles of arc, away from the 3 tile ends
    const arc: number[] = [0];
    for (let i = 1; i < P.length; i++) arc.push(arc[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const total = arc[arc.length - 1];
    for (let s0 = 3; s0 + STRAIGHT_WINDOW <= total - 3; s0 += 1) {
      const i0 = arc.findIndex((a) => a >= s0), i1 = arc.findIndex((a) => a >= s0 + STRAIGHT_WINDOW);
      if (i0 < 0 || i1 < 0) continue;
      const A = P[i0], B = P[i1], cl = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
      let dev = 0;
      for (let i = i0; i <= i1; i++) dev = Math.max(dev, Math.abs((P[i][0] - A[0]) * (B[1] - A[1]) - (P[i][1] - A[1]) * (B[0] - A[0])) / cl);
      worstDev = Math.min(worstDev, dev);
      if (dev < STRAIGHT_MIN_DEV) { failures.push(`${p.id}: a ${STRAIGHT_WINDOW} tile stretch at ${s0.toFixed(0)} tiles is only ${dev.toFixed(2)} tiles off straight`); break; }
    }
    // turns: the heading 1.5 tiles apart never changes by more than 100 degrees
    for (let s0 = 1; s0 + 3 < total; s0 += 1) {
      const i0 = arc.findIndex((a) => a >= s0), i1 = arc.findIndex((a) => a >= s0 + 1.5), i2 = arc.findIndex((a) => a >= s0 + 3);
      if (i0 < 0 || i1 < 0 || i2 < 0) continue;
      const a1 = Math.atan2(P[i1][1] - P[i0][1], P[i1][0] - P[i0][0]), a2 = Math.atan2(P[i2][1] - P[i1][1], P[i2][0] - P[i1][0]);
      let da = Math.abs(a2 - a1); if (da > Math.PI) da = 2 * Math.PI - da;
      worstTurn = Math.max(worstTurn, da);
    }
  });
  if (worstTurn > (100 * Math.PI) / 180) failures.push(`a path turns ${Math.round((worstTurn * 180) / Math.PI)} degrees within 3 tiles`);

  // clear gaps between things placed to be walked between
  const solid = objects.filter((o) => o.zone !== "treeline");
  let tight = 0;
  const cellOf = new Map<number, number[]>();
  solid.forEach((o, i) => { const k = Math.floor(o.block.x / 128) * 4096 + Math.floor(o.block.y / 128); (cellOf.get(k) ?? cellOf.set(k, []).get(k)!).push(i); });
  for (let i = 0; i < solid.length; i++) {
    const a = solid[i], cx = Math.floor(a.block.x / 128), cy = Math.floor(a.block.y / 128);
    for (let gy = cy - 2; gy <= cy + 2; gy++) for (let gx = cx - 2; gx <= cx + 2; gx++) for (const j of cellOf.get(gx * 4096 + gy) ?? []) {
      if (j <= i) continue;
      const b = solid[j], g = gap(a.block, b.block);
      if (g >= 24) continue;
      const furn = a.kind === "furniture" || b.kind === "furniture";
      const prop = a.kind === "prop" || b.kind === "prop";
      if (g === 0 && !furn && !prop) { failures.push(`${a.id} and ${b.id} overlap`); continue; }
      if (!furn && !prop && g < 24) { tight++; failures.push(`${a.id} and ${b.id} leave a ${Math.round(g)} px gap (need 24)`); }
    }
  }

  // cottages: a front yard to the path (the spur), 3 tiles between houses
  const houses = objects.filter((o) => o.sprite?.startsWith("cottage_"));
  let minSpacing = Infinity;
  for (const h of houses) for (const o of houses) if (o !== h) minSpacing = Math.min(minSpacing, gap(h.foot, o.foot));
  if (houses.length > 1 && minSpacing < 3 * TILE - 1) failures.push(`two houses stand ${Math.round(minSpacing)} px apart (need ${3 * TILE})`);

  // every house door meets a path: the spur's material is under its entry
  let doorsOnPath = 0;
  for (const o of objects) if (o.door && matAtPx(o.door.entry.x, o.door.entry.y - 2) + matAtPx(o.door.entry.x, o.door.entry.y + 8) > 0) doorsOnPath++;
  if (doorsOnPath !== doors) failures.push(`${doors - doorsOnPath} doors have no path at their entry`);

  // sit spots
  const ids = new Set<number>(), keys = new Set<string>();
  const byId = new Map(objects.map((o) => [o.id, o]));
  let spotsOk = 0;
  for (const s of d.spots) {
    if (ids.has(s.id)) failures.push(`spot id ${s.id} twice`);
    if (keys.has(s.key)) failures.push(`spot key ${s.key} twice`);
    ids.add(s.id); keys.add(s.key);
    const o = byId.get(s.object);
    if (!o) { failures.push(`spot ${s.key}: no object ${s.object}`); continue; }
    let ok = true;
    if (!coll.fits(s.stand.x, s.stand.y)) { failures.push(`spot ${s.key}: its stand point is blocked`); ok = false; }
    else { const c = nav.cellOf(s.stand.x, s.stand.y); if (!reach.has(key(c[0], c[1]))) { failures.push(`spot ${s.key}: its stand point is not reachable`); ok = false; } }
    if (Math.hypot(s.stand.x - s.at.x, s.stand.y - s.at.y) > 64) { failures.push(`spot ${s.key}: its stand point is ${Math.round(Math.hypot(s.stand.x - s.at.x, s.stand.y - s.at.y))} px from the seat`); ok = false; }
    const box = { x: s.at.x - 4, y: s.at.y - 3, w: 8, h: 6 };
    for (const other of solid) if (other !== o && other.kind !== "furniture" && other.kind !== "prop" && gap(box, other.block) === 0 && other.block.x < box.x + box.w && other.block.x + other.block.w > box.x && other.block.y < box.y + box.h && other.block.y + other.block.h > box.y) { failures.push(`spot ${s.key}: the seat is on ${other.id}'s footprint`); ok = false; break; }
    if (!inR(d.bounds, s.at.x, s.at.y)) { failures.push(`spot ${s.key}: the seat is outside the map`); ok = false; }
    if (ok) spotsOk++;
  }
  const screens = (W * H) / (SCREEN.w * SCREEN.h), perScreen = d.spots.length / screens;
  if (d.spots.length < 120) failures.push(`only ${d.spots.length} spots (need 120)`);
  if (perScreen < SPOTS_PER_SCREEN[0] || perScreen > SPOTS_PER_SCREEN[1]) failures.push(`${perScreen.toFixed(2)} spots a screen (want ${SPOTS_PER_SCREEN[0]} to ${SPOTS_PER_SCREEN[1]})`);
  const byFace: Record<string, number> = {};
  for (const s of d.spots) byFace[s.face] = (byFace[s.face] ?? 0) + 1;
  // worst case route: library plaza to the bakery's (the far end), time and expansions
  const t0 = performance.now();
  const lib = d.hubs.find((h) => h.id === "library"), bak = d.hubs.find((h) => h.id === "bakery");
  let routeMs = 0, expansions = 0;
  if (lib && bak) { world.nav.plan([lib.x, lib.y], [bak.x, bak.y]); routeMs = performance.now() - t0; expansions = world.nav.expansions; }
  void warnings;
  return {
    failures, warnings,
    summary: {
      doors, openNavCells: open, sealedNavCells: sealed, biggestPocket: biggest, bigPockets, pathPieces: comps, onPath, tightGaps: tight, houses: houses.length,
      minHouseGapPx: Number.isFinite(minSpacing) ? Math.round(minSpacing) : -1, widthSamples: wN, widthMin: Math.round(wMin * 100) / 100, widthMax: Math.round(wMax * 100) / 100,
      straightestWindowDev: Math.round(worstDev * 100) / 100, sharpestTurnDeg: Math.round((worstTurn * 180) / Math.PI),
      spots: d.spots.length, spotsOk, screens: Math.round(screens * 10) / 10, spotsPerScreen: Math.round(perScreen * 100) / 100,
      front: byFace.front ?? 0, back: byFace.back ?? 0, left: byFace.left ?? 0, right: byFace.right ?? 0, worstRouteMs: Math.round(routeMs * 10) / 10, worstRouteExpansions: expansions,
    },
  };
}
