import type { Blueprint } from "./blueprint";
import { gap } from "./compile";
import { NAV, TILE, type Rect, type TownData } from "./types";
import { World } from "./world";

export interface Report { failures: string[]; warnings: string[]; summary: Record<string, number | string> }

const inR = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/** Screen of the library at 1280 px: 427 x 267 art px (docs/study/town.md). Used for the density figure. */
export const SCREEN = { w: 427, h: 267 };

/**
 * The map validator. A map that fails does not get written (`tools/town/build.ts`) and the tests assert it on the real map:
 * every door reachable, no sealed pockets, the ring continuous and walkable end to end, no footprint on the ring, the spawn free,
 * every sit spot's stand cell open and reachable, no spot on another object's footprint, trees and bushes with clear gaps between them.
 */
export function validateTown(d: TownData, _bp?: Blueprint, world = new World(d)): Report {
  const failures: string[] = [], warnings: string[] = [];
  const { coll, nav } = world;
  const W = d.cols * TILE, H = d.rows * TILE;
  const kindAt = (tx: number, ty: number) => (tx < 0 || ty < 0 || tx >= d.cols || ty >= d.rows ? 0 : d.kind[ty * d.cols + tx]);

  // spawn
  if (!coll.fits(d.spawn.x, d.spawn.y)) failures.push("spawn is blocked");
  const reach = nav.reachable([d.spawn.x, d.spawn.y]);
  const key = (cx: number, cy: number) => cy * nav.cols + cx;

  // doors
  let doors = 0;
  for (const o of d.objects) if (o.door) {
    doors++;
    const e = o.door.entry, c = nav.nearestOpen(e.x, e.y, 3);
    if (!c) { failures.push(`door of ${o.id}: no open cell near its entry`); continue; }
    if (!reach.has(key(c[0], c[1]))) failures.push(`door of ${o.id}: its entry is not reachable from the spawn`);
    const t = o.door.trigger;
    let ok = false;
    for (let y = t.y; y < t.y + t.h && !ok; y += 4) for (let x = t.x; x < t.x + t.w && !ok; x += 4) if (coll.fits(x, y) && reach.has(key(Math.floor(x / NAV), Math.floor(y / NAV)))) ok = true;
    if (!ok) failures.push(`door of ${o.id}: nobody can stand in its trigger`);
  }

  // sealed pockets: every open navigation cell inside the bounds is reachable from the spawn
  let open = 0, sealed = 0;
  for (let cy = 0; cy < nav.rows; cy++) for (let cx = 0; cx < nav.cols; cx++) if (nav.open(cx, cy)) { open++; if (!reach.has(key(cx, cy))) sealed++; }
  if (sealed > 0) {
    const first: string[] = [];
    for (let cy = 0; cy < nav.rows && first.length < 4; cy++) for (let cx = 0; cx < nav.cols && first.length < 4; cx++) if (nav.open(cx, cy) && !reach.has(key(cx, cy))) first.push(`(${cx * NAV},${cy * NAV})`);
    failures.push(`${sealed} open navigation cells are sealed off from the spawn, e.g. at ${first.join(" ")}`);
  }

  // the ring: fill tiles continuous, free of footprints, and walkable around
  const onRing = (tx: number, ty: number) => kindAt(tx, ty) === 1 || kindAt(tx, ty) === 2;
  let ringTiles = 0, ringBlocked = 0;
  for (let ty = 0; ty < d.rows; ty++) for (let tx = 0; tx < d.cols; tx++) if (kindAt(tx, ty) === 1) {
    ringTiles++;
    const r = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE };
    for (const o of d.objects) if (o.zone !== "treeline" && gap(o.block, r) === 0 && o.block.x < r.x + r.w && o.block.x + o.block.w > r.x && o.block.y < r.y + r.h && o.block.y + o.block.h > r.y) { ringBlocked++; failures.push(`${o.id}'s footprint is on the ring (tile ${tx},${ty})`); break; }
  }
  // connectivity of the ring's fill tiles (8-connected) as ONE component
  const seen = new Set<number>();
  const start = d.kind.findIndex((k) => k === 1);
  if (start >= 0) {
    const q = [start];
    seen.add(start);
    for (let i = 0; i < q.length; i++) {
      const x = q[i] % d.cols, y = Math.floor(q[i] / d.cols);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= d.cols || ny >= d.rows || !onRing(nx, ny)) continue;
        const k = ny * d.cols + nx;
        if (!seen.has(k)) { seen.add(k); q.push(k); }
      }
    }
  }
  const ringAll = d.kind.filter((k) => k === 1 || k === 2).length;
  if (seen.size !== ringAll) failures.push(`the ring is not one piece: ${seen.size} of ${ringAll} tiles connected`);
  // walkable end to end: each consecutive pair of ring nodes (clockwise, closing) is joined over ring tiles only
  let legsOk = 0;
  const onRingCell = (cx: number, cy: number) => nav.open(cx, cy) && onRing(Math.floor((cx * NAV + NAV / 2) / TILE), Math.floor((cy * NAV + NAV / 2) / TILE));
  for (let i = 0; i < d.ring.length; i++) {
    const a = d.ring[i], b = d.ring[(i + 1) % d.ring.length];
    const ca = nav.cellOf(a.x, a.y), cb = nav.cellOf(b.x, b.y);
    const q = [key(ca[0], ca[1])], vis = new Set<number>(q);
    let found = false;
    for (let j = 0; j < q.length && !found; j++) {
      const x = q[j] % nav.cols, y = Math.floor(q[j] / nav.cols);
      if (x === cb[0] && y === cb[1]) { found = true; break; }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || !onRingCell(x + dx, y + dy)) continue;
        if (dx && dy && !(onRingCell(x + dx, y) && onRingCell(x, y + dy))) continue;
        const k = key(x + dx, y + dy);
        if (!vis.has(k)) { vis.add(k); q.push(k); }
      }
    }
    if (found) legsOk++; else failures.push(`the ring is broken between node ${i} and ${(i + 1) % d.ring.length}`);
  }

  // clear gaps between things that were placed to be walked between
  const solid = d.objects.filter((o) => o.zone !== "treeline");
  let tight = 0;
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
    const a = solid[i], b = solid[j];
    const g = gap(a.block, b.block);
    if (g >= 24) continue;
    const furn = a.kind === "furniture" || b.kind === "furniture";
    if (g === 0 && !furn && !(a.kind === "prop" && b.kind === "prop")) { failures.push(`${a.id} and ${b.id} overlap`); continue; }
    if (!furn && g < 24 && a.kind !== "prop" && b.kind !== "prop") { tight++; failures.push(`${a.id} and ${b.id} leave a ${Math.round(g)} px gap (need 24)`); }
  }

  // cottages: a front yard of 2 tiles to the path, 3 tiles between houses
  const houses = d.objects.filter((o) => o.sprite?.startsWith("cottage_"));
  let minYard = Infinity, minSpacing = Infinity;
  for (const h of houses) {
    for (let ty = 0; ty < d.rows; ty++) for (let tx = 0; tx < d.cols; tx++) if (kindAt(tx, ty) === 1 || kindAt(tx, ty) === 2) {
      minYard = Math.min(minYard, gap(h.foot, { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE }));
    }
    for (const o of houses) if (o !== h) minSpacing = Math.min(minSpacing, gap(h.foot, o.foot));
    const sp = d.sprites[h.sprite as string];
    const wall = { x: h.sx + sp.foot.x, y: h.foot.y, w: sp.foot.w, h: sp.foot.h };
    for (const o of d.objects) if (o.id === "cafe") minSpacing = Math.min(minSpacing, gap(wall, o.foot));
  }
  if (houses.length && minYard < 2 * TILE - 1) failures.push(`a house stands ${Math.round(minYard)} px from the path (need ${2 * TILE})`);
  if (houses.length > 1 && minSpacing < 3 * TILE - 1) failures.push(`two houses stand ${Math.round(minSpacing)} px apart (need ${3 * TILE})`);

  // sit spots
  const ids = new Set<number>(), keys = new Set<string>();
  const byId = new Map(d.objects.map((o) => [o.id, o]));
  let spotsOk = 0;
  for (const s of d.spots) {
    if (ids.has(s.id)) failures.push(`spot id ${s.id} twice`);
    if (keys.has(s.key)) failures.push(`spot key ${s.key} twice`);
    ids.add(s.id); keys.add(s.key);
    const o = byId.get(s.object);
    if (!o) { failures.push(`spot ${s.key}: no object ${s.object}`); continue; }
    let ok = true;
    if (!coll.fits(s.stand.x, s.stand.y)) { failures.push(`spot ${s.key}: its stand point is blocked`); ok = false; }
    else {
      const c = nav.cellOf(s.stand.x, s.stand.y);
      if (!reach.has(key(c[0], c[1]))) { failures.push(`spot ${s.key}: its stand point is not reachable`); ok = false; }
    }
    if (Math.hypot(s.stand.x - s.at.x, s.stand.y - s.at.y) > 64) { failures.push(`spot ${s.key}: its stand point is ${Math.round(Math.hypot(s.stand.x - s.at.x, s.stand.y - s.at.y))} px from the seat`); ok = false; }
    // the seat's feet box must not stand on ANOTHER object's footprint
    const box = { x: s.at.x - 4, y: s.at.y - 3, w: 8, h: 6 };
    for (const other of d.objects) if (other !== o && other.kind !== "furniture" && gap(box, other.block) === 0 && other.block.x < box.x + box.w && other.block.x + other.block.w > box.x && other.block.y < box.y + box.h && other.block.y + other.block.h > box.y) { failures.push(`spot ${s.key}: the seat is on ${other.id}'s footprint`); ok = false; break; }
    if (!inR(d.bounds, s.at.x, s.at.y)) { failures.push(`spot ${s.key}: the seat is outside the map`); ok = false; }
    if (ok) spotsOk++;
  }
  const screens = (W * H) / (SCREEN.w * SCREEN.h);
  const byFace: Record<string, number> = {};
  for (const s of d.spots) byFace[s.face] = (byFace[s.face] ?? 0) + 1;
  void warnings;
  return {
    failures, warnings,
    summary: {
      doors, openNavCells: open, sealedNavCells: sealed, ringTiles, ringBlocked, ringLegsOk: legsOk, tightGaps: tight,
      houses: houses.length, minYardPx: Number.isFinite(minYard) ? Math.round(minYard) : -1, minHouseGapPx: Number.isFinite(minSpacing) ? Math.round(minSpacing) : -1,
      spots: d.spots.length, spotsOk, screens: Math.round(screens * 10) / 10, spotsPerScreen: Math.round((d.spots.length / screens) * 10) / 10,
      front: byFace.front ?? 0, back: byFace.back ?? 0, left: byFace.left ?? 0, right: byFace.right ?? 0,
    },
  };
}
