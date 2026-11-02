/**
 * The questions in dark, 2 November 2026: a question is a crop of an exam paper (black print on white, with figures in the same
 * picture), and in dark mode the print becomes pure white on pure black while every figure stays exactly as printed.
 *
 * This file is the picture work only: no DOM, no React, so it runs under node:test on synthetic pixels (darkQuestions.test.ts).
 * `darkQuestions.client.ts` does the fetching, caching and swapping.
 *
 * How a crop is cut up (all sizes below are written for a crop 1086 px wide, the bank's usual, and scaled to the real width):
 *   1. the crop is shrunk to about half size and every mark on the paper becomes a connected component;
 *   2. a component is TEXT (a letter, a word, a rule, an answer line, a table or box made of straight rules) or a FIGURE SEED
 *      (big, or line art with no straight-rule structure: graphs, circuits, apparatus, structures, maps);
 *      coloured areas and flat grey or photographic areas are seeds too;
 *   3. seeds close to one another join into one rectangle; the labels, numbers and captions that touch it join it;
 *   4. a little clean white margin is added, never into a neighbouring line of print.
 * Everything outside the rectangles is turned to white ink on black; the rectangles are left as printed.
 *
 * Errors are biased: when unsure a region is a FIGURE (left as paper). A patch of text left black on white looks a bit odd;
 * a diagram turned inside out looks wrong. Nothing here reads the words, only the marks.
 */

export interface Pixels { data: Uint8ClampedArray | Uint8Array; width: number; height: number }
export interface Rect { x: number; y: number; w: number; h: number }

/** Crops above this many pixels (a very tall mark scheme) are left as paper rather than spend the time. */
export const MAX_PIXELS = 9_000_000;

/** The widths below are for a crop this wide. */
const REF = 1086;
/** What the bank prints at: working size is about this wide. */
const WORK = 540;

// All distances, in 1086-px-wide pixels.
const TEXT_MAX_H = 64;     // a component taller than this is a figure seed; glyphs, fractions and big brackets are shorter
const WIDE_MIN_W = 220;    // wider than this and taller than WIDE_MIN_H: a seed (a bold word is never this big)
const WIDE_MIN_H = 44;
const LINEART_MIN = 40;    // both sides at least this: line art (a circle, an arrow, a triangle), not a letter
const RULE_MAX_T = 7;      // a rule is at most this thick
const RULE_MIN_L = 36;     // and at least this long
const MERGE_GAP = 40;      // seeds this close join one figure
const BRIDGE_GAP = 70;     // figures this close join too, if no print lies between them
const LABEL_GAP = 24;      // a short line of print this close to a figure is its label
const LABEL_MAX_W = 300;   // ...if the line is no longer than this
const SPARSE_MIN_W = 36;   // long thin sparse marks: arrows, dimension lines
const SPARSE_FILL = 0.2;   // ...less than this much ink in their box
const PAD = 14;            // clean margin round a figure
const TEXT_CLEAR = 3;      // never closer than this to print
const RESIDUE_MAX = 24;    // a mark left on a table's rules that is this tall and this wide is a curve, not a word
const LATTICE_MIN_PITCH = 15; // rules closer than this are graph paper, not a table
const TILE = 16;           // working pixels, for flat grey and colour areas

const CHROMA = 46;         // a pixel this far from grey is colour
const GREY_KEEP = 24;      // within this of grey, a pixel is plain ink and paper

export interface Analysis {
  /** Figure rectangles, in the crop's own pixels. */
  figures: Rect[];
  /** The paper's level (0 to 255): what "white" is in this crop. */
  paper: number;
  /** Why the crop was left whole, if it was: "dark" (already dark), "huge" or "tiny". */
  skipped?: "dark" | "huge" | "tiny";
}

interface Comp { id: number; x0: number; y0: number; x1: number; y1: number; area: number }
interface Box { x0: number; y0: number; x1: number; y1: number }
type Kind = "text" | "rule" | "lattice" | "seed";

const hit = (a: Box, b: Box, g = 0) => a.x0 - g <= b.x1 && b.x0 - g <= a.x1 && a.y0 - g <= b.y1 && b.y0 - g <= a.y1;
const dist = (a: Box, b: Box) => Math.max(0, a.x0 - b.x1, b.x0 - a.x1, a.y0 - b.y1, b.y0 - a.y1);

/** Find the figure rectangles in a crop. */
export function analyse(img: Pixels): Analysis {
  const { width: W, height: H, data } = img;
  if (W < 24 || H < 24) return { figures: [], paper: 255, skipped: "tiny" };
  if (W * H > MAX_PIXELS) return { figures: [{ x: 0, y: 0, w: W, h: H }], paper: 255, skipped: "huge" };

  // 1. Half size: grey, and how far from grey, per working pixel.
  const s = Math.max(1, Math.round(W / WORK));
  const w = Math.floor(W / s), h = Math.floor(H / s);
  const k = w / REF;
  const grey = new Uint8Array(w * h);
  const chroma = new Uint8Array(w * h);
  const hist = new Uint32Array(256);
  const n = s * s;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let g = 0, c = 0;
      for (let dy = 0; dy < s; dy++) {
        let i = ((y * s + dy) * W + x * s) * 4;
        for (let dx = 0; dx < s; dx++, i += 4) {
          const a = data[i + 3];
          let r = data[i], gr = data[i + 1], b = data[i + 2];
          if (a < 255) { r = (r * a + 255 * (255 - a)) / 255; gr = (gr * a + 255 * (255 - a)) / 255; b = (b * a + 255 * (255 - a)) / 255; }
          g += (r * 299 + gr * 587 + b * 114) / 1000;
          c += Math.max(r, gr, b) - Math.min(r, gr, b);
        }
      }
      const gi = (g / n + 0.5) | 0;
      grey[y * w + x] = gi; chroma[y * w + x] = Math.min(255, (c / n + 0.5) | 0); hist[gi]++;
    }
  }
  // The paper: the brightest level that a tenth of the picture has.
  let acc = 0, paper = 255;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= w * h * 0.1) { paper = v; break; } }
  if (paper < 150) return { figures: [{ x: 0, y: 0, w: W, h: H }], paper, skipped: "dark" };
  paper = Math.max(paper, 200);

  // 2. Marks, and their components.
  const inkAt = paper - 28;
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (grey[i] < inkAt) ink[i] = 1;
  const { label, comps } = components(ink, w, h);

  // 3. What each component is.
  const kinds: Kind[] = new Array(comps.length);
  const seeds: Box[] = [];
  const rel = (v: number) => v / k;
  for (let ci = 0; ci < comps.length; ci++) {
    const c = comps[ci];
    const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
    const wr = rel(bw), hr = rel(bh);
    let kind: Kind = "text";
    if ((hr <= RULE_MAX_T && wr >= RULE_MIN_L) || (wr <= RULE_MAX_T && hr >= RULE_MIN_L)) kind = "rule";
    else if (c.area < 3) kind = "text";
    else {
      const big = hr > TEXT_MAX_H || (wr > WIDE_MIN_W && hr > WIDE_MIN_H) || (Math.min(wr, hr) >= LINEART_MIN);
      if (big) kind = isLattice(c, label, w, k) ? "lattice" : "seed";
      // a long thin mark that is mostly empty (an arrow, a dimension line, a dashed stroke) is not a word
      else if (wr >= SPARSE_MIN_W && hr >= 6 && c.area < SPARSE_FILL * bw * bh && !boxLike(c, label, w)) kind = "seed";
    }
    kinds[ci] = kind;
    if (kind === "seed") seeds.push({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 });
  }

  // Flat grey, photographs and colour: tiles of the picture.
  const lattices: Box[] = [];
  comps.forEach((c, i) => { if (kinds[i] === "lattice") lattices.push(c); });
  tileSeeds(grey, chroma, w, h, paper, lattices, seeds);

  if (!seeds.length) return { figures: [], paper };

  // 4. Seeds close together are one figure.
  let boxes = mergeBoxes(seeds, Math.round(MERGE_GAP * k));

  // 5. Labels: print that overlaps a figure, or a short line of print close to it, belongs to it.
  const lines = textLines(comps, kinds, k);
  const absorbed = new Uint8Array(comps.length);
  const labelGap = LABEL_GAP * k, maxLabel = LABEL_MAX_W * k;
  const members: number[][] = lines.width.map(() => []);
  lines.of.forEach((l, ci) => { if (l >= 0) members[l].push(ci); });
  const take = (b: Box, ci: number) => {
    absorbed[ci] = 1;
    const c = comps[ci];
    b.x0 = Math.min(b.x0, c.x0); b.y0 = Math.min(b.y0, c.y0); b.x1 = Math.max(b.x1, c.x1); b.y1 = Math.max(b.y1, c.y1);
  };
  for (let pass = 0; pass < 3; pass++) {
    for (let ci = 0; ci < comps.length; ci++) {
      if (kinds[ci] === "seed" || absorbed[ci]) continue;
      const c = comps[ci];
      if (kinds[ci] === "rule" && Math.max(c.x1 - c.x0, c.y1 - c.y0) > maxLabel) continue;
      const ln = lines.of[ci];
      const short = ln >= 0 && lines.width[ln] <= maxLabel;
      for (const b of boxes) {
        const d = dist(c, b);
        if (kinds[ci] === "text" && short && d <= labelGap) {
          // a label comes whole: every mark on its line
          for (const m of members[ln]) if (!absorbed[m]) take(b, m);
          break;
        }
        if (d === 0 && hit(c, b)) { take(b, ci); break; }
      }
    }
    boxes = mergeBoxes(boxes, 0);
  }
  // 5b. Pieces of one drawing that the print between them kept apart (a scatter of arrows, a pair of apparatus) bridge over bare paper.
  const bridge = Math.round(BRIDGE_GAP * k);
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < boxes.length && !changed; i++) {
      for (let j = i + 1; j < boxes.length && !changed; j++) {
        if (!hit(boxes[i], boxes[j], bridge)) continue;
        const u = { x0: Math.min(boxes[i].x0, boxes[j].x0), y0: Math.min(boxes[i].y0, boxes[j].y0), x1: Math.max(boxes[i].x1, boxes[j].x1), y1: Math.max(boxes[i].y1, boxes[j].y1) };
        let clear = true;
        for (let ci = 0; ci < comps.length && clear; ci++) {
          if (kinds[ci] !== "seed" && !absorbed[ci] && comps[ci].area >= 3 && hit(comps[ci], u)) clear = false;
        }
        if (clear) { boxes[i] = u; boxes.splice(j, 1); changed = true; }
      }
    }
  }
  // 6. A clean margin, never into print.
  const obstacles: Box[] = [];
  for (let ci = 0; ci < comps.length; ci++) if (!absorbed[ci] && kinds[ci] !== "seed" && comps[ci].area >= 3) obstacles.push(comps[ci]);
  const pad = Math.max(2, Math.round(PAD * k)), clear = Math.max(1, Math.round(TEXT_CLEAR * k));
  const padded: Box[] = [];
  for (let bi = 0; bi < boxes.length; bi++) {
    const b = { ...boxes[bi] };
    const others = boxes.filter((_, j) => j !== bi);
    // top, bottom, left, right: each grows as far as the margin allows without touching print or another figure
    b.y0 = grow(b, "y0", -1, pad, w, h, obstacles, others, clear);
    b.y1 = grow(b, "y1", 1, pad, w, h, obstacles, others, clear);
    b.x0 = grow(b, "x0", -1, pad, w, h, obstacles, others, clear);
    b.x1 = grow(b, "x1", 1, pad, w, h, obstacles, others, clear);
    padded.push(b);
  }

  const figures = padded.map(b => ({
    x: b.x0 * s, y: b.y0 * s,
    w: Math.min(W, (b.x1 + 1) * s) - b.x0 * s, h: Math.min(H, (b.y1 + 1) * s) - b.y0 * s,
  })).filter(r => r.w > 0 && r.h > 0);
  return { figures, paper };
}

/** Grow one side of a box by up to `pad`, stopping short of print and other figures. */
function grow(b: Box, side: "x0" | "x1" | "y0" | "y1", dir: -1 | 1, pad: number, w: number, h: number, obs: Box[], figs: Box[], clear: number) {
  const horizontal = side === "x0" || side === "x1";
  const limit = horizontal ? (dir < 0 ? 0 : w - 1) : (dir < 0 ? 0 : h - 1);
  let room = Math.min(pad, Math.abs(limit - b[side]));
  // the strip the side would sweep
  const strip = (e: number): Box => horizontal
    ? { x0: dir < 0 ? b.x0 - e : b.x1 + 1, x1: dir < 0 ? b.x0 - 1 : b.x1 + e, y0: b.y0, y1: b.y1 }
    : { y0: dir < 0 ? b.y0 - e : b.y1 + 1, y1: dir < 0 ? b.y0 - 1 : b.y1 + e, x0: b.x0, x1: b.x1 };
  while (room > 0) {
    const t = strip(room);
    let blocked = false;
    for (const o of obs) if (hit(t, o, clear)) { blocked = true; break; }
    if (!blocked) for (const f of figs) if (hit(t, f)) { blocked = true; break; }
    if (!blocked) break;
    room--;
  }
  return b[side] + dir * room;
}

/** Union of boxes that come within `gap` of one another, until none do. */
function mergeBoxes(input: Box[], gap: number): Box[] {
  let boxes = input.map(b => ({ ...b }));
  // A thousand tiny seeds (dots of a plot) would make this quadratic: merge on a coarse grid first.
  if (boxes.length > 300) boxes = coarse(boxes, Math.max(8, gap));
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (hit(boxes[i], boxes[j], gap)) {
          const a = boxes[i], b = boxes[j];
          a.x0 = Math.min(a.x0, b.x0); a.y0 = Math.min(a.y0, b.y0); a.x1 = Math.max(a.x1, b.x1); a.y1 = Math.max(a.y1, b.y1);
          boxes.splice(j, 1); j--; changed = true;
        }
      }
    }
  }
  return boxes;
}
function coarse(boxes: Box[], cell: number): Box[] {
  const m = new Map<string, Box>();
  for (const b of boxes) {
    const key = `${Math.floor(((b.x0 + b.x1) / 2) / (cell * 4))},${Math.floor(((b.y0 + b.y1) / 2) / (cell * 4))}`;
    const e = m.get(key);
    if (!e) m.set(key, { ...b });
    else { e.x0 = Math.min(e.x0, b.x0); e.y0 = Math.min(e.y0, b.y0); e.x1 = Math.max(e.x1, b.x1); e.y1 = Math.max(e.y1, b.y1); }
  }
  return [...m.values()];
}

/** Connected components (8-connected) of a 0/1 mask, with bounding boxes and areas. */
function components(mask: Uint8Array, w: number, h: number) {
  const label = new Int32Array(w * h);
  const parent: number[] = [0];
  const find = (a: number) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const join = (a: number, b: number) => { a = find(a); b = find(b); if (a !== b) { if (a < b) parent[b] = a; else parent[a] = b; } return Math.min(a, b); };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      let l = 0;
      const nb = [x > 0 ? label[i - 1] : 0, y > 0 && x > 0 ? label[i - w - 1] : 0, y > 0 ? label[i - w] : 0, y > 0 && x < w - 1 ? label[i - w + 1] : 0];
      for (const v of nb) if (v) l = l ? join(l, v) : v;
      if (!l) { l = parent.length; parent.push(l); }
      label[i] = l;
    }
  }
  const index = new Int32Array(parent.length).fill(-1);
  const comps: Comp[] = [];
  for (let i = 0; i < w * h; i++) {
    const l = label[i];
    if (!l) continue;
    const r = find(l);
    let ci = index[r];
    const x = i % w, y = (i / w) | 0;
    if (ci < 0) { ci = comps.length; index[r] = ci; comps.push({ id: r, x0: x, y0: y, x1: x, y1: y, area: 0 }); }
    const c = comps[ci];
    c.area++;
    if (x < c.x0) c.x0 = x; else if (x > c.x1) c.x1 = x;
    if (y > c.y1) c.y1 = y;
    label[i] = r;
  }
  return { label, comps };
}

/** Most of the ink on the edge of its own box: an outline (a question number's box, a tick box), not an arrow. */
function boxLike(c: Comp, label: Int32Array, w: number): boolean {
  if (Math.min(c.x1 - c.x0, c.y1 - c.y0) < 10) return false;
  let ring = 0;
  for (let y = c.y0; y <= c.y1; y++) {
    for (let x = c.x0; x <= c.x1; x++) {
      if (label[y * w + x] !== c.id) continue;
      if (x - c.x0 < 3 || c.x1 - x < 3 || y - c.y0 < 3 || c.y1 - y < 3) ring++;
    }
  }
  return ring >= 0.6 * c.area;
}

/**
 * A table, a ruled box, a row of boxes: marks that are nothing but long straight rules, each running most of the way across,
 * with room between them. (Graph paper has the same rules but close together, and the curve on it is not straight.)
 */
function isLattice(c: Comp, label: Int32Array, w: number, k: number): boolean {
  const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
  if (c.area > 0.6 * bw * bh) return false;
  const minRun = Math.max(6, Math.round(30 * k));
  const hmark = new Uint8Array(bw * bh), vmark = new Uint8Array(bw * bh);
  // Shading (a table's grey header) is solid ink, thicker than any rule: it belongs to the table and is set aside.
  const solid = new Uint8Array(bw * bh);
  for (let y = 2; y < bh - 2; y++) for (let x = 2; x < bw - 2; x++) {
    let all = true;
    for (let dy = -2; dy <= 2 && all; dy++) for (let dx = -2; dx <= 2; dx++) if (label[(c.y0 + y + dy) * w + c.x0 + x + dx] !== c.id) { all = false; break; }
    if (all) solid[y * bw + x] = 1;
  }
  const mine = (x: number, y: number) => label[(c.y0 + y) * w + c.x0 + x] === c.id && !solid[y * bw + x];
  const hRows: { y: number; len: number }[] = [];
  for (let y = 0; y < bh; y++) {
    let x = 0;
    while (x < bw) {
      if (!mine(x, y)) { x++; continue; }
      let e = x;
      while (e < bw && mine(e, y)) e++;
      if (e - x >= minRun) { for (let i = x; i < e; i++) hmark[y * bw + i] = 1; hRows.push({ y, len: e - x }); }
      x = e;
    }
  }
  const vCols: { x: number; len: number }[] = [];
  for (let x = 0; x < bw; x++) {
    let y = 0;
    while (y < bh) {
      if (!mine(x, y)) { y++; continue; }
      let e = y;
      while (e < bh && mine(x, e)) e++;
      if (e - y >= minRun) { for (let i = y; i < e; i++) vmark[i * bw + x] = 1; vCols.push({ x, len: e - y }); }
      y = e;
    }
  }
  let straight = 0, hPix = 0, hLong = 0, vPix = 0, vLong = 0;
  for (let i = 0; i < bw * bh; i++) if (hmark[i] || vmark[i] || solid[i]) straight++;
  if (straight < 0.8 * c.area) return false;
  // What is left over must be little marks (a letter that touches a rule), not a stroke running on: a curve over a grid is not a table.
  if (straight < c.area) {
    const seen = new Uint8Array(bw * bh);
    const reach = RESIDUE_MAX * k;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const i = y * bw + x;
      if (seen[i] || hmark[i] || vmark[i] || solid[i] || label[(c.y0 + y) * w + c.x0 + x] !== c.id) continue;
      const stack = [i]; seen[i] = 1;
      let x0 = x, x1 = x, y0 = y, y1 = y;
      while (stack.length) {
        const j = stack.pop()!;
        const jx = j % bw, jy = (j / bw) | 0;
        if (jx < x0) x0 = jx; if (jx > x1) x1 = jx; if (jy < y0) y0 = jy; if (jy > y1) y1 = jy;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = jx + dx, ny = jy + dy;
          if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
          const nj = ny * bw + nx;
          if (seen[nj] || hmark[nj] || vmark[nj] || solid[nj] || label[(c.y0 + ny) * w + c.x0 + nx] !== c.id) continue;
          seen[nj] = 1; stack.push(nj);
        }
      }
      if (Math.min(x1 - x0, y1 - y0) + 1 >= reach) return false;
    }
  }
  for (const r of hRows) { hPix += r.len; if (r.len >= 0.45 * bw) hLong += r.len; }
  for (const r of vCols) { vPix += r.len; if (r.len >= 0.45 * bh) vLong += r.len; }
  if (hPix === 0 || vPix === 0 || hLong < 0.5 * hPix || vLong < 0.5 * vPix) return false;
  // rule positions: runs of consecutive rows or columns are one rule
  const pitch = (xs: number[]) => {
    const u = [...new Set(xs)].sort((a, b) => a - b);
    const groups: number[] = [];
    for (const v of u) { if (!groups.length || v - groups[groups.length - 1] > 4) groups.push(v); else groups[groups.length - 1] = v; }
    let min = Infinity;
    for (let i = 1; i < groups.length; i++) min = Math.min(min, groups[i] - groups[i - 1]);
    return { count: groups.length, min };
  };
  const hp = pitch(hRows.filter(r => r.len >= 0.45 * bw).map(r => r.y));
  const vp = pitch(vCols.filter(r => r.len >= 0.45 * bh).map(r => r.x));
  // a table cropped through its top or side shows one rule one way and several the other
  if (!((hp.count >= 2 && vp.count >= 2) || (hp.count >= 1 && vp.count >= 3) || (hp.count >= 3 && vp.count >= 1))) return false;
  return hp.min >= LATTICE_MIN_PITCH * k && vp.min >= LATTICE_MIN_PITCH * k;
}

/** Flat grey and photographic tiles, and coloured tiles, as seed boxes. Tiles inside a table are left alone. */
function tileSeeds(grey: Uint8Array, chroma: Uint8Array, w: number, h: number, paper: number, lattices: Box[], out: Box[]) {
  const tw = Math.floor(w / TILE), th = Math.floor(h / TILE);
  if (tw < 1 || th < 1) return;
  const flat = new Uint8Array(tw * th), colour = new Uint8Array(tw * th);
  const hiMid = paper - 20;
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      let mid = 0, col = 0;
      for (let y = ty * TILE; y < ty * TILE + TILE; y++) {
        const row = y * w;
        for (let x = tx * TILE; x < tx * TILE + TILE; x++) {
          const g = grey[row + x];
          if (g > 40 && g < hiMid) mid++;
          if (chroma[row + x] > CHROMA && g < paper - 12) col++;
        }
      }
      const i = ty * tw + tx;
      if (mid > TILE * TILE * 0.7) flat[i] = 1;
      if (col >= 6) colour[i] = 1;
    }
  }
  const inside = (b: Box) => lattices.some(l => b.x0 >= l.x0 - TILE && b.x1 <= l.x1 + TILE && b.y0 >= l.y0 - TILE && b.y1 <= l.y1 + TILE);
  for (const [grid, minTiles, checkLattice] of [[flat, 3, true], [colour, 1, false]] as const) {
    const seen = new Uint8Array(tw * th);
    for (let i = 0; i < tw * th; i++) {
      if (!grid[i] || seen[i]) continue;
      // flood the tile group (8-connected)
      const stack = [i]; seen[i] = 1;
      let x0 = tw, y0 = th, x1 = 0, y1 = 0, count = 0;
      while (stack.length) {
        const j = stack.pop()!;
        const jx = j % tw, jy = (j / tw) | 0;
        count++; x0 = Math.min(x0, jx); x1 = Math.max(x1, jx); y0 = Math.min(y0, jy); y1 = Math.max(y1, jy);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = jx + dx, ny = jy + dy;
          if (nx < 0 || ny < 0 || nx >= tw || ny >= th) continue;
          const nj = ny * tw + nx;
          if (grid[nj] && !seen[nj]) { seen[nj] = 1; stack.push(nj); }
        }
      }
      if (count < minTiles) continue;
      const b = { x0: x0 * TILE, y0: y0 * TILE, x1: x1 * TILE + TILE - 1, y1: y1 * TILE + TILE - 1 };
      if (checkLattice && inside(b)) continue;
      out.push(b);
    }
  }
}

/** Short runs of print: components of text size on one line, so labels can be told from paragraphs. */
function textLines(comps: Comp[], kinds: Kind[], k: number) {
  const idx: number[] = [];
  for (let i = 0; i < comps.length; i++) if (kinds[i] === "text") idx.push(i);
  idx.sort((a, b) => comps[a].x0 - comps[b].x0);
  const parent = idx.map((_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const gap = 26 * k;
  for (let a = 0; a < idx.length; a++) {
    const ca = comps[idx[a]];
    const cya = (ca.y0 + ca.y1) / 2, ha = ca.y1 - ca.y0 + 1;
    for (let b = a + 1; b < idx.length; b++) {
      const cb = comps[idx[b]];
      if (cb.x0 - ca.x1 > gap && cb.x0 > ca.x1) {
        // sorted by left edge, so a later one can still be near a wider earlier one: stop only when far past every earlier right edge
        if (cb.x0 - ca.x1 > gap * 3) break;
        continue;
      }
      const cyb = (cb.y0 + cb.y1) / 2, hb = cb.y1 - cb.y0 + 1;
      if (Math.abs(cya - cyb) <= 0.6 * Math.max(ha, hb, 10 * k)) parent[find(b)] = find(a);
    }
  }
  const of = new Int32Array(comps.length).fill(-1);
  const ids = new Map<number, number>();
  const x0: number[] = [], x1: number[] = [];
  idx.forEach((ci, i) => {
    const r = find(i);
    let l = ids.get(r);
    if (l === undefined) { l = ids.size; ids.set(r, l); x0.push(Infinity); x1.push(-Infinity); }
    of[ci] = l; x0[l] = Math.min(x0[l], comps[ci].x0); x1[l] = Math.max(x1[l], comps[ci].x1);
  });
  return { of, width: x0.map((v, i) => x1[i] - v + 1) };
}

/** Round the corners of a figure's box a little, so the white card sits softly on the black. */
const CORNER = 6;

/**
 * Turn a crop to white ink on black, everywhere but inside `figures`, in place. The paper's own level becomes exactly black;
 * a greyscale pixel is inverted by its brightness; a colour keeps its hue and has its lightness inverted.
 */
export function renderDark(img: Pixels, figures: Rect[], paper = 255): void {
  const { width: W, height: H, data } = img;
  const keep = new Uint8Array(W * H);
  for (const f of figures) {
    const r = Math.min(CORNER, f.w >> 1, f.h >> 1);
    for (let y = Math.max(0, f.y); y < Math.min(H, f.y + f.h); y++) {
      const dy = y - f.y < r ? r - (y - f.y) - 0.5 : f.y + f.h - 1 - y < r ? r - (f.y + f.h - 1 - y) - 0.5 : -1;
      const inset = dy < 0 ? 0 : Math.ceil(r - Math.sqrt(Math.max(0, r * r - dy * dy)));
      keep.fill(1, y * W + Math.max(0, f.x + inset), y * W + Math.min(W, f.x + f.w - inset));
    }
  }
  const scale = 255 / Math.max(1, paper);
  for (let p = 0, i = 0; p < W * H; p++, i += 4) {
    if (keep[p]) { data[i + 3] = 255; continue; }
    let r = data[i], g = data[i + 1], b = data[i + 2];
    const a = data[i + 3];
    if (a < 255) { r = (r * a + 255 * (255 - a)) / 255; g = (g * a + 255 * (255 - a)) / 255; b = (b * a + 255 * (255 - a)) / 255; }
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn <= GREY_KEEP) {
      const v = Math.min(255, ((r * 299 + g * 587 + b * 114) / 1000) * scale);
      const o = 255 - v + 0.5 | 0;
      data[i] = data[i + 1] = data[i + 2] = o;
    } else {
      // lightness inverted, hue and saturation kept
      const l = (mx + mn) / 510, d = (mx - mn) / 255;
      const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      let hue = 0;
      if (mx === r) hue = ((g - b) / (mx - mn) + 6) % 6; else if (mx === g) hue = (b - r) / (mx - mn) + 2; else hue = (r - g) / (mx - mn) + 4;
      const l2 = 1 - l, c2 = (1 - Math.abs(2 * l2 - 1)) * sat, x2 = c2 * (1 - Math.abs((hue % 2) - 1)), m2 = l2 - c2 / 2;
      const [rr, gg, bb] = hue < 1 ? [c2, x2, 0] : hue < 2 ? [x2, c2, 0] : hue < 3 ? [0, c2, x2] : hue < 4 ? [0, x2, c2] : hue < 5 ? [x2, 0, c2] : [c2, 0, x2];
      data[i] = (rr + m2) * 255 + 0.5 | 0; data[i + 1] = (gg + m2) * 255 + 0.5 | 0; data[i + 2] = (bb + m2) * 255 + 0.5 | 0;
    }
    data[i + 3] = 255;
  }
}

/** Analyse a crop and turn it dark in place; returns what it found. */
export function darkenCrop(img: Pixels): Analysis {
  const a = analyse(img);
  if (a.skipped) return a;
  renderDark(img, a.figures, a.paper);
  return a;
}
