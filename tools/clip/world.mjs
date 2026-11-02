/*
 * The town's map data on the node side: everything the storyboard needs (door entries, hubs, plazas, zones, path network)
 * is READ from public/town/v1/town.<hash>.json, never typed in as pixel coordinates, so a re-generated or polished map
 * needs no edit here. Anchors a storyboard can name:
 *   { door: "cafe" }            a door's id (building id, e.g. "library", "cafe", "orchard-row-house-4"): the point in front of it
 *   { hub: "plaza" }            a hub's walk-to point (library, cafe, bakery, bookshop, plaza, park)
 *   { plaza: "library-plaza" }  the centre of a plaza (or { zone: "quiet-grove" }: the centre of a zone)
 *   { path: "orchard-row-street", at: 0.5 }   a point along a named path (0 start .. 1 end)
 *   { x, y, dx, dy }            a literal point (art px), as a last resort, optionally offset
 */
import fs from "node:fs";
import path from "node:path";

export function loadTown(root) {
  const gen = fs.readFileSync(path.join(root, "src/lib/town/assets.generated.ts"), "utf8");
  const url = /TOWN_DATA_URL\s*=\s*"([^"]+)"/.exec(gen)[1];
  return JSON.parse(fs.readFileSync(path.join(root, "public", url), "utf8"));
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export class Town {
  constructor(data) {
    this.d = data;
    this.byId = new Map(data.objects.map((o) => [o.id, o]));
    // the path network: a node per centre-line sample, joined along each path and wherever two paths touch
    this.nodes = []; this.adj = [];
    const first = new Map();
    for (const p of data.paths) {
      const idx = [];
      for (let i = 0; i < p.pts.length; i += 2) { idx.push(this.nodes.length); this.nodes.push([p.pts[i], p.pts[i + 1]]); this.adj.push([]); }
      first.set(p.id, idx);
      for (let i = 1; i < idx.length; i++) this.link(idx[i - 1], idx[i]);
    }
    const cell = 16, grid = new Map();
    this.nodes.forEach((n, i) => { const k = `${Math.floor(n[0] / cell)},${Math.floor(n[1] / cell)}`; (grid.get(k) ?? grid.set(k, []).get(k)).push(i); });
    this.nodes.forEach((n, i) => {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of grid.get(`${Math.floor(n[0] / cell) + dx},${Math.floor(n[1] / cell) + dy}`) ?? []) if (j > i && dist(n, this.nodes[j]) < 14) this.link(i, j);
    });
    this.pathIdx = first;
    // a paved plaza is open ground: every path end that touches one is joined through a node at its centre, and tight junctions the 14 px join missed are healed
    for (const pl of data.plazas) {
      const r = pl.rect, c = this.nodes.length;
      this.nodes.push([r.x + r.w / 2, r.y + r.h / 2]); this.adj.push([]);
      const ids = [];
      this.nodes.forEach((n, i) => { if (i < c && n[0] > r.x - 24 && n[0] < r.x + r.w + 24 && n[1] > r.y - 24 && n[1] < r.y + r.h + 24) ids.push(i); });
      for (const i of ids) this.link(c, i);
    }
    this.heal(40);
  }
  /** Joins the connected pieces of the network at their closest pair of nodes (within `max` px). */
  heal(max) {
    for (;;) {
      const comp = new Int32Array(this.nodes.length).fill(-1); let c = 0;
      for (let i = 0; i < this.nodes.length; i++) if (comp[i] < 0) { const st = [i]; comp[i] = c; while (st.length) { const u = st.pop(); for (const [v] of this.adj[u]) if (comp[v] < 0) { comp[v] = c; st.push(v); } } c++; }
      if (c === 1) return;
      let best = null;
      for (let i = 0; i < this.nodes.length; i += 1) for (let j = i + 1; j < this.nodes.length; j += 1) {
        if (comp[i] === comp[j]) continue;
        const q = dist(this.nodes[i], this.nodes[j]);
        if (q < max && (!best || q < best[2])) best = [i, j, q];
      }
      if (!best) return;
      this.link(best[0], best[1]);
    }
  }
  link(a, b) { const w = dist(this.nodes[a], this.nodes[b]); this.adj[a].push([b, w]); this.adj[b].push([a, w]); }

  /** An anchor to a point (feet, art px). */
  point(a) {
    const d = this.d;
    if (a.door) { const o = this.byId.get(a.door); if (!o?.door) throw new Error(`no door "${a.door}"`); return [o.door.entry.x, o.door.entry.y + (a.dy ?? 10)]; }
    if (a.hub) { const h = d.hubs.find((q) => q.id === a.hub); if (!h) throw new Error(`no hub "${a.hub}"`); return [h.x + (a.dx ?? 0), h.y + (a.dy ?? 0)]; }
    if (a.plaza) { const p = d.plazas.find((q) => q.id === a.plaza); if (!p) throw new Error(`no plaza "${a.plaza}"`); return [p.rect.x + p.rect.w / 2 + (a.dx ?? 0), p.rect.y + p.rect.h / 2 + (a.dy ?? 0)]; }
    if (a.zone) { const z = d.zones.find((q) => q.id === a.zone); if (!z) throw new Error(`no zone "${a.zone}"`); return [z.rect.x + z.rect.w / 2 + (a.dx ?? 0), z.rect.y + z.rect.h / 2 + (a.dy ?? 0)]; }
    if (a.path) { const idx = this.pathIdx.get(a.path); if (!idx) throw new Error(`no path "${a.path}"`); const n = this.nodes[idx[Math.round((a.at ?? 0) * (idx.length - 1))]]; return [n[0] + (a.dx ?? 0), n[1] + (a.dy ?? 0)]; }
    if (typeof a.x === "number") return [a.x + (a.dx ?? 0), a.y + (a.dy ?? 0)];
    throw new Error("bad anchor " + JSON.stringify(a));
  }
  nearest(p) { let b = 0, bd = Infinity; this.nodes.forEach((n, i) => { const q = dist(n, p); if (q < bd) { bd = q; b = i; } }); return b; }

  /** The shortest way along the paths between two network nodes (indices). */
  dijkstra(s, t) {
    const n = this.nodes.length, D = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    D[s] = 0;
    for (;;) {
      let u = -1, bd = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && D[i] < bd) { bd = D[i]; u = i; }
      if (u < 0 || u === t) break;
      done[u] = 1;
      for (const [v, w] of this.adj[u]) if (D[u] + w < D[v]) { D[v] = D[u] + w; prev[v] = u; }
    }
    const out = [];
    for (let u = t; u >= 0; u = prev[u]) out.push(u);
    return out.reverse();
  }

  /**
   * A route: from anchor to anchor along the path network (the winding way a person takes, not the straight line), through each `via`.
   * The first and last anchors are joined to the network by a straight stub. Returns [[x, y], ...] at about `step` art px.
   */
  route(anchors, step = 14) {
    const pts = anchors.map((a) => this.point(a));
    const raw = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const s = this.nearest(pts[i]), t = this.nearest(pts[i + 1]);
      raw.push(this.nodes[s]);
      const way = this.dijkstra(s, t);
      for (const u of way) raw.push(this.nodes[u]);
      raw.push(pts[i + 1]);
    }
    return resample(raw, step);
  }
  length(r) { let L = 0; for (let i = 1; i < r.length; i++) L += dist(r[i - 1], r[i]); return L; }
}

/** Evenly spaced points along a polyline (a light smoothing first removes the zigzag of joined samples). */
export function resample(raw, step) {
  const dedup = [raw[0]];
  for (const p of raw) if (dist(p, dedup[dedup.length - 1]) > 0.5) dedup.push(p);
  const sm = dedup.map((p, i) => {
    if (i === 0 || i === dedup.length - 1) return p;
    let sx = 0, sy = 0, n = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(dedup.length - 1, i + 2); j++) { sx += dedup[j][0]; sy += dedup[j][1]; n++; }
    return [sx / n, sy / n];
  });
  const out = [sm[0]];
  let acc = 0;
  for (let i = 1; i < sm.length; i++) {
    let a = sm[i - 1]; const b = sm[i];
    let seg = dist(a, b);
    while (acc + seg >= step) {
      const t = (step - acc) / seg;
      a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(a); seg = dist(a, b); acc = 0;
    }
    acc += seg;
  }
  out.push(sm[sm.length - 1]);
  return out;
}
