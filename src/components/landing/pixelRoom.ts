/**
 * The cosy homepage's pixel rooms: Plumi figures, furniture, and a small walkable
 * top-down world drawn on a <canvas>. A TypeScript port of the room engine in the
 * founder's landing design (19 October 2026), trimmed to what the homepage uses: two
 * scenes (your room at night, the study hall by day), tap to walk and sit, friends you
 * can tap, and the little avatars beside the feature list. The app's own engine is the
 * Swift port in Features/StudyRoom/PixelWorld.
 *
 * Browser only: nothing here runs at import time, and every entry point takes the
 * element it draws into.
 */

type Ctx = CanvasRenderingContext2D;
type Dir = "down" | "up" | "left" | "right";
type Env = { t: number; evening: boolean };

/* ---------- pixel art helper: rows of characters -> crisp SVG ---------- */
type Art = readonly [readonly string[], Readonly<Record<string, string>>];

function pix(rows: readonly string[], map: Readonly<Record<string, string>>): string {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  let s = "";
  rows.forEach((r, y) => {
    let x = 0;
    while (x < r.length) {
      const c = r[x];
      if (!map[c]) { x++; continue; }
      let x2 = x; while (x2 < r.length && r[x2] === c) x2++;
      s += `<rect x="${x}" y="${y}" width="${x2 - x}" height="1" fill="${map[c]}"/>`;
      x = x2;
    }
  });
  return `<svg class="px" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true">${s}</svg>`;
}

const N = "#2b3a5c";
const ART: Record<"star" | "cat", Art> = {
  star: [["....K....", "...KYK...", "KKKKYKKKK", "KYYYYYYYK", ".KYYYYYK.", "..KYYYK..", ".KYYKYYK.", ".KYK.KYK.", ".KK...KK."], { K: "#22304d", Y: "#f2c96b" }],
  cat: [[".K...K............", "KOK.KOK...........", "KOOKOOK...........", "KOOOOOOKKKKKKKK...", "KOKOOKOOOOOOOOOK..", "KOOOOOOOOoOOoOOOK.", "KOOPOOOOOoOOoOOOKK", ".KOOOOOOOOOOOOOOKO", "..KKKKKKKKKKKKKKKK", "CCCCCCCCCCCCCCCCCC", "cccccccccccccccccc"], { K: N, O: "#e9a94a", o: "#c97f2a", P: "#e9707f", C: "#a58fc4", c: "#7e6aa6" }],
};

/* ---------- Plumi characters: arms, legs, outfits, 4-way walk cycles ---------- */
const CK = "#3a2a35", SKIN = "#fbf7ee", SKIN_S = "#e6d9c6", BLUSH = "#f0a3a0", EYE = "#2b2433";
const FEATHERS: Record<string, readonly string[]> = {
  "": ["#6a9bd0", "#a9cbeb", "#7cc6c2", "#476ea3"], "-pink": ["#e48f9f", "#f6c6cd", "#f2b8a2", "#a9566a"],
  "-gold": ["#e3a53c", "#f6d98f", "#a8c86a", "#a26c1c"], "-lilac": ["#9b84c9", "#cfc2ea", "#e6a8c4", "#66509a"], "-green": ["#6fae6a", "#b6dcae", "#f2c96b", "#467a42"],
};
const FEATHER_ART = ["......KK.", ".....KfgK", "....KFfgK", "....KFfgK", "...KFFdgK", "...KFdfK.", "..KFdFgK.", "..KdFfK..", "..KFFgK..", "...KdK...", "...KdK..."];
const HEAD_F = ["....KKKKKK....", "..KKSSSSSSKK..", ".KSSSSSSSSSsK.", ".KSSSSSSSSSsK.", "KSSSSSSSSSSSsK", "KSSSESSSSESSsK", "KSSSESSSSESSsK", "KSBBSSSSSSBBsK", "KSSSSSMMSSSSsK", ".KSSSSSSSSSsK.", "..KKSSSSSSKK..", "....KKKKKK...."];
const HEAD_B = ["....KKKKKK....", "..KKSSSSSSKK..", ".KSSSSSSSSSsK.", ".KSSSSSSSSSsK.", "KSSSSSSSSSSssK", "KSSSSSSSSSSssK", "KSSSSSSSSSSssK", "KSSSSSSSSSSssK", "KsSSSSSSSSSssK", ".KsSSSSSSSssK.", "..KKssssssKK..", "....KKKKKK...."];
const HEAD_S = ["...KKKKKKK...", ".KKSSSSSSSKK.", ".KsSSSSSSSSSK", "KssSSSSSSSSSK", "KsSSSSSSSSSSK", "KsSSSSSSSESSK", "KsSSSSSSSESSK", "KsSSSSSSSBBSK", "KsSSSSSSSSSMK", ".KsSSSSSSSSK.", "..KKSSSSSKK..", "....KKKKK...."];

function grid(c: Ctx, rows: readonly string[], ox: number, oy: number, map: Record<string, string>, flip = false) {
  const w = rows[0].length;
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const col = map[r[x]]; if (col) { c.fillStyle = col; c.fillRect(ox + (flip ? w - 1 - x : x), oy + y, 1, 1); } } });
}
const ob2 = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = CK; c.fillRect(x, y, w, h); c.fillStyle = col; c.fillRect(x + 1, y + 1, w - 2, h - 2); };
const px = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

export interface Outfit {
  top: "none" | "hoodie" | "coat" | "sweater" | "puffer";
  col: string; sh?: string; acc: string; legs: string; shoe: string;
  hat: null | "headphones" | "beanie" | "witch"; hatCol?: string; scarf?: string | null;
}
const OUTFIT_DEFAULT: Outfit = { top: "hoodie", col: "#7cc6c2", sh: "#5eaaa8", acc: "#fbf7ee", legs: "#4a5d86", shoe: "#3a2a35", hat: "headphones", hatCol: "#e0605a", scarf: null };

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round((n >> 16) * k), g = Math.round((n >> 8 & 255) * k), b = Math.round((n & 255) * k);
  return "#" + ((1 << 24) + (Math.min(255, r) << 16) + (Math.min(255, g) << 8) + Math.min(255, b)).toString(16).slice(1);
}

interface PlumiOpts { dir?: Dir; frame?: number; pose?: string; pal?: string; outfit?: Outfit; t?: number; blink?: boolean; sleepy?: boolean; write?: boolean; mug?: boolean; noShadow?: boolean }

/** Draws a Plumi with feet at (x, y). */
function drawPlumi(c: Ctx, x: number, y: number, o: PlumiOpts) {
  const F = FEATHERS[o.pal || ""] || FEATHERS[""], fit = o.outfit || OUTFIT_DEFAULT;
  const fmap: Record<string, string> = { K: CK, F: F[0], f: F[1], g: F[2], d: F[3] };
  const C = fit.top === "none" ? SKIN : fit.col, Cs = fit.top === "none" ? SKIN_S : (fit.sh || shade(fit.col, .8));
  const dir = o.dir || "down", side = dir === "left" || dir === "right", flip = dir === "left";
  const f = o.frame || 0, pose = o.pose || "stand";
  const step = pose === "stand" && (f === 1 || f === 3);
  y = Math.round(y - (step ? 1 : 0)); x = Math.round(x);
  const closed = o.blink || o.sleepy;
  const hmap: Record<string, string> = { K: CK, S: SKIN, s: SKIN_S, E: closed ? SKIN : EYE, B: BLUSH, M: CK };
  if (pose === "sleep") {
    grid(c, FEATHER_ART, x - 2, y - 22, fmap);
    grid(c, HEAD_F, x - 7, y - 13, { ...hmap, E: SKIN });
    px(c, x - 4, y - 7, 2, 1, EYE); px(c, x + 2, y - 7, 2, 1, EYE);
    return;
  }
  const sit = pose === "sit";
  if (!sit && !o.noShadow) { px(c, x - 7, y - 2, 14, 3, "rgba(70,32,92,.28)"); px(c, x - 5, y - 3, 10, 5, "rgba(70,32,92,.28)"); }
  const sm = sit ? 3 : 0;
  if (!side) {
    const ox = x - 7, back = dir === "up";
    const aL = step ? (f === 1 ? -1 : 1) : 0, aR = -aL, lL = f === 1 ? 1 : 0, lR = f === 3 ? 1 : 0;
    if (!sit) { ob2(c, ox + 3, y - 6 + lL, 4, 6 - lL, fit.legs); px(c, ox + 4, y - 2, 2, 1, fit.shoe); ob2(c, ox + 7, y - 6 + lR, 4, 6 - lR, fit.legs); px(c, ox + 8, y - 2, 2, 1, fit.shoe); }
    else if (!back) { ob2(c, ox + 3, y - 4, 4, 3, fit.legs); ob2(c, ox + 7, y - 4, 4, 3, fit.legs); }
    const by = y - 14 + sm, long = fit.top === "coat";
    const arm = (ax: number, ay: number) => { ob2(c, ax, ay, 3, 7, C); px(c, ax + 1, ay + 4, 1, 2, fit.top === "none" ? SKIN_S : SKIN); };
    const wr = o.write ? Math.floor((o.t || 0) * 5) % 2 : 0;
    if (back && sit) { arm(ox, by); arm(ox + 11, by - wr); }
    ob2(c, ox + 2, by, 10, long ? 11 : 9, C);
    px(c, ox + 10, by + 1, 1, long ? 9 : 7, Cs);
    if (fit.top === "puffer") { px(c, ox + 3, by + 3, 8, 1, Cs); px(c, ox + 3, by + 6, 8, 1, Cs); }
    if (!back) {
      if (fit.top === "coat") { px(c, ox + 5, by + 1, 2, 3, fit.acc); px(c, ox + 7, by + 1, 2, 3, fit.acc); px(c, ox + 6, by + 5, 1, 5, Cs); px(c, ox + 7, by + 5, 1, 1, CK); px(c, ox + 7, by + 7, 1, 1, CK); }
      if (fit.top === "hoodie") { px(c, ox + 4, by + 1, 6, 1, Cs); px(c, ox + 5, by + 2, 1, 2, fit.acc); px(c, ox + 8, by + 2, 1, 2, fit.acc); px(c, ox + 4, by + 5, 6, 2, Cs); }
      if (fit.top === "sweater") { px(c, ox + 3, by + 7, 8, 1, Cs); px(c, ox + 6, by + 3, 2, 2, fit.acc); }
      if (fit.top === "puffer") { px(c, ox + 7, by + 1, 1, 7, fit.acc); }
    } else {
      if (fit.top === "hoodie") { ob2(c, ox + 3, by - 1, 8, 4, Cs); }
      if (fit.top === "coat") { px(c, ox + 3, by + 5, 8, 1, Cs); px(c, ox + 7, by + 6, 1, 4, Cs); }
    }
    if (!(back && sit)) {
      if (sit && !back) { arm(ox, by + 1); arm(ox + 11, by + 1); }
      else { arm(ox, by + 1 + aL); arm(ox + 11, by + 1 + aR); }
    }
    if (o.mug && !back) { ob2(c, ox + 12, by + 4 + aR, 4, 4, "#e0605a"); px(c, ox + 15, by + 5 + aR, 1, 2, CK); }
    if (fit.scarf) { ob2(c, ox + 2, by - 1, 10, 3, fit.scarf); if (!back) ob2(c, ox + 8, by + 1, 3, 5, fit.scarf); }
    const hy = y - 25 + sm;
    grid(c, FEATHER_ART, ox + 3, hy - 9, fmap);
    grid(c, back ? HEAD_B : HEAD_F, ox, hy, hmap);
    if (closed && !back) { px(c, ox + 3, hy + 6, 2, 1, EYE); px(c, ox + 9, hy + 6, 2, 1, EYE); }
    hat(c, fit, ox, hy, "front", fmap, false, x);
  } else {
    const ox = x - 6;
    const sp = f === 1 ? 2 : f === 3 ? -2 : 0;
    const L = (dx: number, dy: number, w: number, h: number, col: string) => ob2(c, flip ? 2 * x - (ox + dx) - w : ox + dx, dy, w, h, col);
    const P = (dx: number, dy: number, w: number, h: number, col: string) => px(c, flip ? 2 * x - (ox + dx) - w : ox + dx, dy, w, h, col);
    const by = y - 14 + sm;
    if (!sit) { L(4 - sp, y - 6, 4, 6, shade(fit.legs, .8)); L(5 + sp, y - 6, 4, 6, fit.legs); P(6 + sp, y - 2, 3, 1, fit.shoe); }
    else { L(5, y - 5, 7, 3, fit.legs); P(10, y - 4, 2, 1, fit.shoe); }
    L(5 + (step ? sp : 0), by + 1, 3, 7, Cs);
    L(3, by, 8, fit.top === "coat" ? 11 : 9, C);
    if (fit.top === "puffer") { P(4, by + 3, 6, 1, Cs); P(4, by + 6, 6, 1, Cs); }
    if (fit.top === "coat") P(9, by + 1, 1, 9, fit.acc);
    if (fit.top === "hoodie") L(2, by - 1, 4, 5, Cs);
    if (fit.scarf) { L(3, by - 1, 8, 3, fit.scarf); L(2, by + 1, 3, 5, fit.scarf); }
    const na = sit ? 1 : -(step ? sp : 0);
    L(5 + na, by + 1, 3, 7, C); P(6 + na, by + 5, 1, 2, SKIN);
    if (o.mug) { L(8 + na, by + 4, 4, 4, "#e0605a"); }
    const hy = y - 25 + sm;
    grid(c, FEATHER_ART, flip ? x + 6 - 9 + 1 : ox + 1, hy - 9, fmap, !flip);
    grid(c, HEAD_S, flip ? 2 * x - ox - 13 : ox, hy, hmap, flip);
    if (closed) P(9, hy + 6, 2, 1, EYE);
    hat(c, fit, ox, hy, "side", fmap, flip, x);
  }
}

function hat(c: Ctx, fit: Outfit, ox: number, hy: number, view: "front" | "side", fmap: Record<string, string>, flip: boolean, x: number) {
  if (!fit.hat) return;
  const hc = fit.hatCol || "#e0605a", hs = shade(hc, .78);
  const X = (dx: number, w: number) => view === "side" && flip ? 2 * x - (ox + dx) - w : ox + dx;
  if (fit.hat === "headphones") {
    if (view === "side") { ob2(c, X(2, 8), hy - 1, 8, 2, "#3b4a6b"); ob2(c, X(1, 4), hy + 3, 4, 6, hc); px(c, X(2, 2), hy + 4, 2, 4, hs); }
    else { ob2(c, ox + 2, hy - 1, 10, 2, "#3b4a6b"); ob2(c, ox - 1, hy + 4, 3, 6, hc); ob2(c, ox + 12, hy + 4, 3, 6, hc); }
  }
  if (fit.hat === "beanie") {
    const w = view === "side" ? 11 : 12, dx = 1;
    ob2(c, X(dx, w), hy - 2, w, 6, hc); px(c, X(dx + 1, w - 2), hy + 2, w - 2, 1, hs);
    for (let i = dx + 2; i < dx + w - 1; i += 2) px(c, X(i, 1), hy - 1, 1, 3, hs);
    grid(c, FEATHER_ART, view === "side" ? (flip ? x + 6 - 9 + 1 : ox + 1) : ox + 3, hy - 11, fmap, view === "side" ? !flip : false);
  }
  if (fit.hat === "witch") {
    ob2(c, X(-3, 20), hy + 1, 20, 3, hc);
    for (let i = 0; i < 9; i++) { const w = 11 - i; ob2(c, X(2 + Math.floor(i / 2) + (i > 5 ? 1 : 0), w), hy - 1 - i, w, 2, hc); }
    px(c, X(3, 9), hy, 9, 1, "#f2c96b");
  }
}

/* ---------- top-down rooms ---------- */
const T = 24, O = CK, SH = "rgba(70,32,92,.26)";
interface Palette { wa: string; wb: string; dot: string; wn: string; wnh: string; wnl: string; rail: string; base: string; trim: string; floor: readonly string[]; fhi: string; gap: string; grain: string; edge: string }
const PAL: Record<"oak" | "blue", Palette> = {
  oak: { wa: "#ead8bb", wb: "#e2cdab", dot: "#d6bb92", wn: "#a8714c", wnh: "#c08a62", wnl: "#8a5a3c", rail: "#7a4c33", base: "#5e3a29", trim: "#7a4c33",
    floor: ["#b47c55", "#bd855c", "#ad744e"], fhi: "#c99467", gap: "#7e4f36", grain: "#9c6643", edge: "#5e3a29" },
  blue: { wa: "#cddff1", wb: "#c1d5ec", dot: "#adc3e0", wn: "#8296bf", wnh: "#a2b4d6", wnl: "#6a7ca3", rail: "#4a5d86", base: "#3b4a6b", trim: "#4a5d86",
    floor: ["#b47c55", "#bd855c", "#ad744e"], fhi: "#c99467", gap: "#7e4f36", grain: "#9c6643", edge: "#3b4a6b" },
};
const WD = { top: "#c98e5f", hi: "#e0aa7b", front: "#9c6440", dark: "#7a4a30", grain: "#b27a4f" };
const rng = (seed: number) => { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const fr = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const ob = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => { fr(c, x, y, w, h, O); fr(c, x + 1, y + 1, w - 2, h - 2, col); };
const rb = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => { fr(c, x + 1, y, w - 2, h, O); fr(c, x, y + 1, w, h - 2, O); fr(c, x + 1, y + 1, w - 2, h - 2, col); };

const ARTC: Partial<Record<keyof typeof ART, HTMLCanvasElement>> = {};
function artCanvas(k: keyof typeof ART) {
  const cached = ARTC[k]; if (cached) return cached;
  const [rows, map] = ART[k], cv = document.createElement("canvas"), c = cv.getContext("2d")!;
  cv.width = Math.max(...rows.map(r => r.length)); cv.height = rows.length;
  rows.forEach((r, y) => [...r].forEach((ch, x) => { const col = map[ch]; if (col) fr(c, x, y, 1, 1, col === "currentColor" ? O : col); }));
  return ARTC[k] = cv;
}

function planks(c: Ctx, x0: number, y0: number, w: number, h: number, P: Palette, seed: number) {
  const r = rng(seed);
  for (let y = y0; y < y0 + h; y += 6) {
    let x = x0 - Math.floor(r() * 40);
    while (x < x0 + w) {
      const len = 26 + Math.floor(r() * 44);
      fr(c, x, y, len, 6, P.floor[Math.floor(r() * 3)]); fr(c, x, y, len, 1, P.fhi); fr(c, x, y + 5, len, 1, P.gap); fr(c, x + len - 1, y, 1, 6, P.gap);
      for (let g = 0; g < 2; g++) fr(c, x + 4 + Math.floor(r() * Math.max(1, len - 14)), y + 2 + Math.floor(r() * 2), 3 + Math.floor(r() * 7), 1, P.grain);
      if (r() < .1) fr(c, x + (len >> 1), y + 2, 2, 2, P.gap);
      x += len;
    }
  }
}

/* ---- furniture ---- */
const BOOKC = ["#6a9bd0", "#e0605a", "#f2c96b", "#7cc6c2", "#a58fc4", "#eaa99a", "#8fb35a", "#e8dfcc", "#c87a4a"];
function leaf(c: Ctx, x: number, y: number, w: number, h: number, col: string, hi: string) { rb(c, x, y, w, h, col); fr(c, x + 2, y + 1, Math.max(1, w - 4), 1, hi); }
function dDesk(c: Ctx, x: number, y: number, e: Env) {
  ob(c, x + 3, y + 12, 5, 12, WD.front); ob(c, x + 64, y + 12, 5, 12, WD.front);
  ob(c, x, y - 10, 72, 21, WD.top); fr(c, x + 1, y - 9, 70, 1, WD.hi);
  fr(c, x + 8, y - 5, 16, 1, WD.grain); fr(c, x + 40, y + 2, 20, 1, WD.grain); fr(c, x + 30, y - 7, 8, 1, WD.grain); fr(c, x + 12, y + 5, 10, 1, WD.grain);
  ob(c, x, y + 10, 72, 6, WD.front); ob(c, x + 46, y + 10, 24, 14, WD.front);
  fr(c, x + 47, y + 16, 22, 1, WD.dark); fr(c, x + 55, y + 12, 6, 1, O); fr(c, x + 55, y + 19, 6, 1, O);
  ob(c, x + 4, y - 3, 13, 5, "#6a9bd0"); ob(c, x + 5, y - 7, 12, 5, "#f2c96b"); ob(c, x + 4, y - 11, 13, 5, "#8fb35a");
  fr(c, x + 6, y - 2, 9, 1, "#a9cbeb"); fr(c, x + 7, y - 6, 8, 1, "#fff1c2"); fr(c, x + 6, y - 10, 9, 1, "#b5d47e");
  ob(c, x + 19, y - 4, 6, 6, "#c87a4a"); leaf(c, x + 17, y - 11, 5, 4, "#8fb35a", "#b5d47e"); leaf(c, x + 21, y - 13, 5, 5, "#6f9a45", "#8fb35a");
  ob(c, x + 27, y - 15, 20, 12, "#3b4a6b"); fr(c, x + 29, y - 13, 16, 8, e.evening ? "#9fd0f0" : "#cfe6f7");
  fr(c, x + 30, y - 12, 8, 1, "#fff"); fr(c, x + 30, y - 10, 11, 1, "#fff"); fr(c, x + 30, y - 8, 6, 1, "#fff");
  ob(c, x + 25, y - 4, 24, 6, "#c9d1e0"); fr(c, x + 27, y - 3, 20, 1, "#e6eaf2"); fr(c, x + 34, y, 6, 1, "#9aa6bd");
  ob(c, x + 51, y - 5, 6, 7, "#e0605a"); fr(c, x + 57, y - 3, 2, 3, O); fr(c, x + 52, y - 4, 4, 1, "#f0a3a0");
  const s = Math.floor(e.t * 2) % 2; fr(c, x + 53 + s, y - 9, 1, 2, "rgba(255,255,255,.75)"); fr(c, x + 54 - s, y - 12, 1, 2, "rgba(255,255,255,.5)");
  fr(c, x + 61, y - 1, 9, 3, O); fr(c, x + 64, y - 15, 2, 14, O); ob(c, x + 58, y - 22, 14, 8, "#f2c96b"); fr(c, x + 60, y - 20, 5, 1, "#fff1c2");
}
function chairSeat(c: Ctx, sx: number, sy: number) { ob(c, sx + 4, sy + 4, 16, 10, "#a8714c"); fr(c, sx + 5, sy + 5, 14, 5, "#d9897c"); fr(c, sx + 6, sy + 5, 10, 1, "#efb3a5"); }
function chairBack(c: Ctx, sx: number, sy: number) { ob(c, sx + 4, sy + 12, 16, 9, WD.front); fr(c, sx + 7, sy + 14, 10, 1, WD.dark); fr(c, sx + 7, sy + 17, 10, 1, WD.dark); fr(c, sx + 5, sy + 13, 14, 1, WD.hi); fr(c, sx + 5, sy + 21, 2, 3, O); fr(c, sx + 17, sy + 21, 2, 3, O); }
function stool(c: Ctx, sx: number, sy: number) { fr(c, sx + 6, sy + 16, 2, 5, O); fr(c, sx + 16, sy + 16, 2, 5, O); rb(c, sx + 4, sy + 6, 16, 12, "#7f8f6a"); fr(c, sx + 5, sy + 7, 14, 6, "#a3b38a"); fr(c, sx + 6, sy + 7, 10, 1, "#c3d1aa"); }
function dShelf(c: Ctx, x: number, y: number, seed: number) {
  const r = rng(seed);
  ob(c, x, y - 38, 48, 62, WD.front); fr(c, x + 1, y - 37, 46, 2, WD.hi); fr(c, x + 3, y - 34, 42, 56, "#5e3a29"); fr(c, x + 42, y - 34, 3, 56, "#4e2f22");
  [y - 16, y + 2, y + 20].forEach(yb => {
    fr(c, x + 3, yb, 42, 2, WD.top); fr(c, x + 3, yb + 2, 42, 1, WD.dark);
    let bx = x + 4;
    for (;;) {
      if (r() < .12 && bx + 8 < x + 42) {
        if (r() < .5) { ob(c, bx, yb - 7, 7, 7, "#c87a4a"); leaf(c, bx - 1, yb - 12, 5, 5, "#8fb35a", "#b5d47e"); leaf(c, bx + 3, yb - 13, 5, 6, "#6f9a45", "#8fb35a"); }
        else { ob(c, bx, yb - 8, 7, 8, "#6a9bd0"); fr(c, bx + 2, yb - 6, 2, 3, "#8fb35a"); fr(c, bx + 3, yb - 1, 1, 1, O); }
        bx += 9; continue;
      }
      const bw = 3 + Math.floor(r() * 3), bh = 9 + Math.floor(r() * 6);
      if (bx + bw > x + 43) break;
      const col = BOOKC[Math.floor(r() * BOOKC.length)];
      fr(c, bx, yb - bh, bw, bh, O); fr(c, bx, yb - bh + 1, bw - 1, bh - 1, col); fr(c, bx, yb - bh + 3, bw - 1, 1, "rgba(255,255,255,.45)"); fr(c, bx, yb - 3, bw - 1, 1, "rgba(0,0,0,.18)");
      bx += bw;
    }
  });
  if (seed % 2) { ob(c, x + 32, y - 45, 9, 8, "#c87a4a"); leaf(c, x + 29, y - 51, 6, 5, "#8fb35a", "#b5d47e"); leaf(c, x + 36, y - 53, 6, 6, "#6f9a45", "#8fb35a"); fr(c, x + 44, y - 38, 2, 12, "#6f9a45"); fr(c, x + 43, y - 30, 3, 2, "#8fb35a"); fr(c, x + 44, y - 24, 3, 2, "#8fb35a"); }
  else { ob(c, x + 6, y - 46, 14, 9, "#e8dfcc"); fr(c, x + 8, y - 44, 10, 5, "#a9cbeb"); ob(c, x + 30, y - 43, 6, 6, "#f2c96b"); }
}
function dPlant(c: Ctx, x: number, y: number, big: boolean) {
  if (big) {
    ([[-4, -16, 13, 9, "#6f9a45"], [10, -24, 12, 10, "#8fb35a"], [2, -28, 11, 9, "#6f9a45"], [13, -10, 12, 9, "#8fb35a"], [-3, -4, 11, 8, "#8fb35a"], [5, -14, 11, 9, "#a9cf6a"], [12, 0, 10, 7, "#6f9a45"]] as const)
      .forEach(([a, b, w, h, col]) => { leaf(c, x + a, y + b, w, h, col, "#c3e08a"); fr(c, x + a + (w >> 1), y + b + 2, 1, h - 3, "#4e7a34"); });
    fr(c, x + 11, y - 4, 2, 12, "#4e7a34");
  } else {
    fr(c, x + 11, y - 2, 2, 11, "#4e7a34");
    ([[3, -2, 8, 6, "#8fb35a"], [12, -7, 8, 6, "#6f9a45"], [7, -12, 8, 6, "#a9cf6a"], [14, 0, 8, 6, "#8fb35a"], [1, 4, 7, 5, "#6f9a45"], [9, -4, 7, 5, "#8fb35a"]] as const)
      .forEach(([a, b, w, h, col]) => leaf(c, x + a, y + b, w, h, col, "#c3e08a"));
  }
  ob(c, x + 6, y + 9, 12, 13, "#c87a4a"); ob(c, x + 5, y + 8, 14, 4, "#d98f5c"); fr(c, x + 7, y + 9, 10, 1, "#5e3a29"); fr(c, x + 15, y + 12, 2, 9, "#a8613a");
}
function dRug(c: Ctx, x: number, y: number, w: number, h: number, col?: string) {
  const R1 = col || "#8f3b3b", R2 = col ? shade(col, 1.35) : "#c0504a";
  for (let j = y + 3; j < y + h - 3; j += 3) { fr(c, x - 2, j, 2, 1, "#f3e2c7"); fr(c, x + w, j, 2, 1, "#f3e2c7"); }
  fr(c, x, y, w, h, O); fr(c, x + 1, y + 1, w - 2, h - 2, R1);
  fr(c, x + 3, y + 3, w - 6, h - 6, "#e0a35a"); fr(c, x + 4, y + 4, w - 8, h - 8, R1); fr(c, x + 6, y + 6, w - 12, h - 12, R2);
  for (let i = x + 7; i < x + w - 7; i += 5) { fr(c, i, y + 4, 2, 1, "#f3d6a8"); fr(c, i, y + h - 5, 2, 1, "#f3d6a8"); }
  for (let j = y + 7; j < y + h - 7; j += 5) { fr(c, x + 4, j, 1, 2, "#f3d6a8"); fr(c, x + w - 5, j, 1, 2, "#f3d6a8"); }
  const cx = x + (w >> 1), cy = y + (h >> 1), rad = Math.min((h >> 1) - 9, 14);
  const ring = (r: number, rc: string) => { for (let d = -r; d <= r; d++) { const half = Math.round(Math.sqrt(r * r - d * d) * 1.7); fr(c, cx - half, cy + d, half * 2, 1, rc); } };
  ring(rad, O); ring(rad - 1, "#e0a35a"); ring(rad - 3, "#3f5a7a"); ring(rad - 5, "#c0504a"); ring(Math.max(2, rad - 8), "#f3d6a8");
  for (let k = -1; k <= 1; k += 2) { fr(c, cx + k * Math.round(rad * 1.7 + 3) - 1, cy - 1, 3, 3, "#e0a35a"); }
  [[x + 9, y + 9], [x + w - 13, y + 9], [x + 9, y + h - 13], [x + w - 13, y + h - 13]].forEach(([a, b]) => { fr(c, a + 1, b, 2, 4, "#e0a35a"); fr(c, a, b + 1, 4, 2, "#e0a35a"); });
}
function dBed(c: Ctx, x: number, y: number) {
  ob(c, x + 1, y - 18, 46, 16, WD.front); fr(c, x + 2, y - 17, 44, 2, WD.hi);
  for (let i = 0; i < 6; i++) fr(c, x + 6 + i * 7, y - 14, 2, 10, WD.dark);
  ob(c, x + 1, y - 4, 46, 76, WD.front); fr(c, x + 3, y - 2, 42, 72, "#fbf7ee");
  rb(c, x + 6, y, 36, 14, "#ffffff"); fr(c, x + 8, y + 11, 32, 2, "#e6eef9"); fr(c, x + 23, y + 2, 1, 10, "#e6eef9");
  ob(c, x + 2, y + 18, 44, 52, "#9b84c9");
  for (let j = 0; j < 7; j++) for (let i = 0; i < 6; i++) if ((i + j) % 2) fr(c, x + 3 + i * 7, y + 25 + j * 7, 7, 7, "#b4a3dc");
  for (let i = 0; i < 6; i++) fr(c, x + 3 + i * 7, y + 25, 1, 44, "rgba(255,255,255,.25)");
  fr(c, x + 3, y + 19, 42, 5, "#fbf7ee"); fr(c, x + 3, y + 24, 42, 1, "#d9d0c0");
  ob(c, x + 1, y + 68, 46, 6, WD.top); fr(c, x + 2, y + 69, 44, 1, WD.hi);
}
function dBean(c: Ctx, x: number, y: number) {
  fr(c, x + 3, y + 3, 18, 19, O); fr(c, x + 1, y + 7, 22, 13, O);
  fr(c, x + 4, y + 4, 16, 17, "#f2c96b"); fr(c, x + 2, y + 8, 20, 11, "#f2c96b");
  fr(c, x + 6, y + 6, 6, 2, "#fff1c2"); fr(c, x + 7, y + 11, 10, 5, "#e3a53c"); fr(c, x + 16, y + 9, 3, 9, "#e3a53c");
}
function dRadio(c: Ctx, x: number, y: number, e: Env) {
  ob(c, x + 2, y + 4, 20, 11, WD.top); ob(c, x + 2, y + 14, 20, 8, WD.front); fr(c, x + 3, y + 5, 18, 1, WD.hi);
  rb(c, x + 4, y - 7, 16, 13, "#e0605a"); fr(c, x + 6, y - 5, 6, 8, "#8a3a4a"); for (let i = 0; i < 4; i++) fr(c, x + 6, y - 4 + i * 2, 6, 1, "#6a2a3a");
  ob(c, x + 13, y - 4, 5, 5, "#f2c96b"); fr(c, x + 15, y - 3, 1, 2, O); fr(c, x + 16, y - 14, 1, 7, O);
  const k = (e.t * 1.2) % 1; const nx = x + 18 + Math.round(k * 4), ny = y - 13 - Math.round(k * 12); fr(c, nx, ny, 1, 4, O); fr(c, nx - 2, ny + 3, 3, 2, O);
}
function dCat(c: Ctx, x: number, y: number, e: Env) {
  rb(c, x + 3, y + 6, 42, 16, "#a58fc4"); fr(c, x + 5, y + 8, 38, 3, "#c4b2e0");
  c.drawImage(artCanvas("cat"), x + 6, y + 1, 36, 22);
  if (Math.floor(e.t) % 3 === 0) { fr(c, x + 4, y - 6, 4, 1, O); fr(c, x + 6, y - 5, 1, 1, O); fr(c, x + 5, y - 4, 1, 1, O); fr(c, x + 4, y - 3, 4, 1, O); }
}
function dWindow(c: Ctx, x: number, e: Env) {
  const sky = e.evening ? "#2b3a5c" : "#a9d4f0", sky2 = e.evening ? "#34466c" : "#bfe0f5";
  fr(c, x - 7, 3, 62, 2, O); fr(c, x - 8, 2, 3, 4, O); fr(c, x + 53, 2, 3, 4, O);
  ob(c, x + 2, 6, 44, 31, WD.front); fr(c, x + 3, 7, 42, 1, WD.hi);
  [5, 25].forEach(a => { fr(c, x + a, 9, 18, 25, sky); fr(c, x + a, 21, 18, 13, sky2); });
  if (e.evening) { ob(c, x + 33, 12, 6, 6, "#fbf7ee"); [[8, 13], [15, 19], [28, 27], [41, 24], [11, 28], [20, 11]].forEach(([a, b]) => fr(c, x + a, b, 1, 1, "#fbf7ee")); }
  else { fr(c, x + 8, 15, 10, 3, "#fff"); fr(c, x + 10, 13, 6, 2, "#fff"); fr(c, x + 29, 20, 9, 3, "#fff"); fr(c, x + 31, 18, 5, 2, "#fff"); fr(c, x + 5, 29, 18, 5, "#8fb35a"); fr(c, x + 25, 30, 18, 4, "#8fb35a"); fr(c, x + 30, 26, 4, 4, "#6f9a45"); }
  fr(c, x + 23, 9, 2, 25, WD.front); fr(c, x + 5, 20, 38, 1, WD.front);
  ob(c, x - 1, 35, 50, 5, WD.top); fr(c, x, 36, 48, 1, WD.hi);
  ob(c, x + 4, 30, 6, 6, "#c87a4a"); leaf(c, x + 3, 25, 5, 5, "#8fb35a", "#b5d47e"); leaf(c, x + 7, 24, 4, 5, "#6f9a45", "#8fb35a");
  ob(c, x + 38, 31, 5, 5, "#a9cbeb"); fr(c, x + 40, 27, 1, 4, "#4e7a34"); fr(c, x + 39, 26, 3, 2, "#f0a53a");
  [-6, 46].forEach(a => { fr(c, x + a, 5, 8, 34, O); fr(c, x + a + 1, 5, 6, 33, "#e8a598"); for (let i = 1; i < 7; i += 2) fr(c, x + a + i, 6, 1, 32, "#d4877b"); fr(c, x + a, 22, 8, 2, "#f2c96b"); });
}
function dBoard(c: Ctx, x: number) {
  ob(c, x + 3, 9, 42, 26, WD.front); fr(c, x + 5, 11, 38, 22, "#c9935a"); for (let i = 0; i < 8; i++) fr(c, x + 6 + i * 5, 12 + (i % 3) * 6, 1, 1, "#b07a48");
  fr(c, x + 8, 14, 10, 9, "#fff1c2"); fr(c, x + 21, 17, 9, 8, "#cfe3f7"); fr(c, x + 33, 13, 8, 10, "#f6c6cd"); fr(c, x + 10, 25, 8, 6, "#d9eedb");
  fr(c, x + 12, 14, 2, 2, "#e0605a"); fr(c, x + 25, 17, 2, 2, "#6a9bd0"); fr(c, x + 36, 13, 2, 2, "#8fb35a");
  [17, 19, 21].forEach(yy => fr(c, x + 9, yy, 7, 1, "#c9935a")); [20, 22].forEach(yy => fr(c, x + 22, yy, 6, 1, "#a9b8d0"));
}
function dClock(c: Ctx, x: number) { rb(c, x + 4, 11, 16, 16, WD.front); rb(c, x + 6, 13, 12, 12, "#fbf7ee"); fr(c, x + 11, 15, 2, 5, O); fr(c, x + 12, 19, 4, 1, O); }
function dPainting(c: Ctx, x: number) { ob(c, x + 4, 10, 40, 24, "#e0a35a"); fr(c, x + 6, 12, 36, 20, "#fbf7ee"); fr(c, x + 7, 13, 34, 9, "#a9d4f0"); fr(c, x + 7, 22, 34, 9, "#6a9bd0"); for (let i = 0; i < 34; i += 6) { fr(c, x + 7 + i, 21, 4, 1, "#fbf7ee"); fr(c, x + 9 + i, 25, 3, 1, "#cfe6f7"); } fr(c, x + 12, 15, 8, 7, "#8fa3c0"); fr(c, x + 14, 13, 4, 2, "#fbf7ee"); fr(c, x + 32, 14, 4, 4, "#f2c96b"); }
function dHanging(c: Ctx, x: number) { fr(c, x + 8, 3, 1, 14, "#7a4c33"); fr(c, x + 15, 3, 1, 14, "#7a4c33"); ob(c, x + 6, 16, 12, 8, "#e8dfcc"); for (let k = 0; k < 4; k++) { fr(c, x + 5 + k * 4, 22, 2, 8 + k * 4 % 9, "#6f9a45"); leaf(c, x + 3 + k * 4, 25 + (k * 5) % 9, 5, 4, k % 2 ? "#8fb35a" : "#a9cf6a", "#c3e08a"); } leaf(c, x + 5, 12, 6, 5, "#8fb35a", "#c3e08a"); leaf(c, x + 12, 11, 6, 6, "#6f9a45", "#8fb35a"); }
function dDoor(c: Ctx, x: number) { ob(c, x, 6, 24, 42, WD.dark); ob(c, x + 3, 9, 18, 39, WD.front); ob(c, x + 6, 12, 12, 14, WD.top); ob(c, x + 6, 29, 12, 16, WD.top); fr(c, x + 17, 28, 2, 3, "#f2c96b"); }
function dMenu(c: Ctx, x: number) {
  ob(c, x + 2, 7, 44, 29, WD.front); fr(c, x + 4, 9, 40, 25, "#2f4a3f");
  fr(c, x + 7, 12, 14, 1, "#fbf7ee"); fr(c, x + 7, 16, 10, 1, "#cfe6f7"); fr(c, x + 7, 19, 12, 1, "#cfe6f7"); fr(c, x + 7, 22, 9, 1, "#cfe6f7"); fr(c, x + 7, 25, 11, 1, "#cfe6f7"); fr(c, x + 7, 28, 8, 1, "#cfe6f7");
  ob(c, x + 28, 15, 10, 9, "#fbf7ee"); fr(c, x + 38, 17, 2, 4, "#fbf7ee"); fr(c, x + 30, 11, 1, 3, "#cfe6f7"); fr(c, x + 34, 10, 1, 4, "#cfe6f7"); fr(c, x + 26, 27, 14, 1, "#f2c96b");
}
function dGarland(c: Ctx, e: Env, w: number) {
  const flowers = ["#f0a53a", "#e0605a", "#f2c96b"];
  for (let x = 0; x < w; x++) {
    const y = 3 + Math.round(4 * Math.sin(Math.PI * (x % 48) / 48));
    fr(c, x, y, 1, 1, "#4e7a34");
    if (x % 8 === 4) { fr(c, x - 1, y, 3, 2, "#6f9a45"); }
    if (x % 16 === 8) { const col = flowers[(x / 16 | 0) % 3]; fr(c, x - 2, y, 5, 3, O); fr(c, x - 1, y - 1, 3, 5, O); fr(c, x - 1, y, 3, 3, col); fr(c, x, y + 1, 1, 1, "#fff1c2"); }
    if (x % 16 === 0) { const on = (Math.floor(e.t * 1.5) + x / 16) % 3 !== 0; fr(c, x - 1, y + 2, 3, 3, on ? "#fff1c2" : "#c9b48a"); }
  }
}
function dTable(c: Ctx, x: number, y: number) {
  fr(c, x + 6, y + 14, 4, 10, O); fr(c, x + 38, y + 14, 4, 10, O);
  rb(c, x - 2, y - 10, 52, 26, WD.top); fr(c, x, y - 9, 48, 1, WD.hi);
  fr(c, x + 6, y - 4, 14, 1, WD.grain); fr(c, x + 26, y + 4, 16, 1, WD.grain); fr(c, x + 14, y + 8, 10, 1, WD.grain);
  rb(c, x - 2, y + 13, 52, 6, WD.front);
  const book = (bx: number, by: number, col: string) => { ob(c, bx, by, 6, 9, "#fbf7ee"); ob(c, bx + 5, by, 6, 9, "#fbf7ee"); fr(c, bx + 1, by + 8, 10, 1, col); fr(c, bx + 2, by + 3, 3, 1, "#cfd6e2"); fr(c, bx + 7, by + 3, 3, 1, "#cfd6e2"); fr(c, bx + 2, by + 5, 3, 1, "#cfd6e2"); };
  book(x + 3, y - 4, "#e0605a"); book(x + 34, y - 4, "#6a9bd0"); book(x + 3, y + 4, "#8fb35a"); book(x + 34, y + 4, "#a58fc4");
  ob(c, x + 18, y + 2, 12, 5, "#fbf7ee"); ob(c, x + 20, y - 1, 8, 6, "#e8dfcc"); fr(c, x + 21, y, 6, 1, "#7a4a30");
  fr(c, x + 22, y - 6, 4, 5, O); ob(c, x + 17, y - 14, 14, 8, "#f2c96b"); fr(c, x + 19, y - 12, 5, 1, "#fff1c2");
}
/** The group jar: each friend's week of minutes, stacked, against a 30 hour goal. */
const MATES = [
  { color: "#6a9bd0", week: 520 }, { color: "#e48f9f", week: 370 }, { color: "#e3a53c", week: 270 },
  { color: "#9b84c9", week: 230 }, { color: "#6fae6a", week: 90 },
];
function dJar(c: Ctx, x: number, y: number) {
  ob(c, x + 3, y + 6, 18, 16, WD.top); fr(c, x + 4, y + 7, 16, 2, WD.hi); fr(c, x + 4, y + 15, 16, 1, WD.dark);
  ob(c, x + 5, y - 16, 14, 22, "#e6f0fa");
  let yy = y + 5; const goal = 30 * 60;
  MATES.forEach(m => { const h = Math.round(m.week / goal * 20); fr(c, x + 6, yy - h + 1, 12, h, m.color); yy -= h; });
  fr(c, x + 7, y - 13, 1, 14, "rgba(255,255,255,.75)"); ob(c, x + 6, y - 20, 12, 5, "#c87a4a");
}
function dSofa(c: Ctx, x: number, y: number) {
  rb(c, x - 2, y - 16, 76, 18, "#5eaaa8"); for (let i = 0; i < 3; i++) { rb(c, x + 2 + i * 23, y - 14, 22, 14, "#7cc6c2"); fr(c, x + 4 + i * 23, y - 13, 16, 1, "#a3dcd8"); }
  rb(c, x + 1, y - 1, 70, 20, "#6cbab6"); for (let i = 0; i < 3; i++) fr(c, x + 3 + i * 23, y + 1, 20, 2, "#a3dcd8"); fr(c, x + 24, y, 1, 18, "#4e8f8c"); fr(c, x + 47, y, 1, 18, "#4e8f8c");
  rb(c, x - 5, y - 8, 9, 27, "#5eaaa8"); rb(c, x + 68, y - 8, 9, 27, "#5eaaa8");
  rb(c, x + 4, y - 10, 10, 9, "#eaa99a"); fr(c, x + 6, y - 9, 6, 1, "#f6c6cd"); rb(c, x + 58, y - 10, 10, 9, "#f2c96b"); fr(c, x + 60, y - 9, 6, 1, "#fff1c2");
  fr(c, x + 66, y - 6, 8, 20, "#e8dfcc"); for (let i = 0; i < 20; i += 4) fr(c, x + 66, y - 6 + i, 8, 1, "#e0605a");
}
function dCounter(c: Ctx, x: number, y: number) {
  ob(c, x - 2, y - 10, 76, 16, "#e0c9a6"); fr(c, x - 1, y - 9, 74, 1, "#f3e2c7");
  ob(c, x - 2, y + 5, 76, 19, WD.front); for (let i = 3; i < 72; i += 6) fr(c, x - 1 + i, y + 6, 1, 17, WD.dark);
  ob(c, x + 2, y - 26, 16, 18, "#3b4a6b"); fr(c, x + 4, y - 24, 12, 4, "#22304d"); fr(c, x + 5, y - 23, 2, 2, "#e0605a"); ob(c, x + 7, y - 14, 6, 5, "#fbf7ee"); fr(c, x + 9, y - 19, 2, 5, O);
  ob(c, x + 24, y - 22, 26, 14, "#cfe6f7"); fr(c, x + 25, y - 21, 24, 1, "#fff");
  [[27, -15], [35, -15], [43, -15]].forEach(([a, b]) => { rb(c, x + a, y + b, 7, 5, "#e3a53c"); fr(c, x + a + 1, y + b + 1, 5, 1, "#f6d98f"); });
  [[27, -20], [36, -20]].forEach(([a, b]) => { rb(c, x + a, y + b, 6, 4, "#c87a4a"); });
  for (let i = 0; i < 3; i++) ob(c, x + 56, y - 9 - i * 4, 7, 5, "#fbf7ee");
  ob(c, x + 64, y - 12, 6, 8, "#cfe6f7"); fr(c, x + 65, y - 9, 4, 3, "#f2c96b");
}

/* object types: w/h in tiles; seats say where a Plumi sits (feet px/py from the top-left, sort = draw order, face = direction) */
type TypeName = "desk" | "bookshelf" | "plant" | "monstera" | "rug" | "rug4" | "bed" | "beanbag" | "radio" | "catbed" | "nightstand" | "books" | "window" | "painting" | "hanging" | "board" | "menu" | "clock" | "door" | "lights" | "studytable" | "jar" | "sofa" | "counter";
interface Obj { id: string; type: TypeName; tx: number; ty: number; seed?: number; act?: string; rw?: number; rh?: number; col?: string; lit?: boolean; x: number; y: number; w: number; h: number; span: number }
interface Seat { tile: readonly [number, number]; px: number; py: number; sort: number; chair?: boolean; face?: Dir; write?: boolean; pose?: string }
interface Part { y?: number; f: (c: Ctx, e: Env) => void }
interface TypeDef { w: number; h?: number; block?: boolean; floor?: boolean; wall?: boolean; top?: boolean; act?: string; hitUp?: number; light?: (o: Obj) => readonly [number, number, number]; seats?: readonly Seat[]; parts: (o: Obj) => Part[] }

const TYPES: Record<TypeName, TypeDef> = {
  desk: { w: 3, h: 1, block: true, act: "desk", hitUp: 22, light: () => [65, -18, 58],
    seats: [{ tile: [1, 1], px: 36, py: 42, sort: 40, chair: true, face: "up", write: true }],
    parts: o => [{ y: o.y + T, f: (c, e) => dDesk(c, o.x, o.y, e) }, { y: o.y + T + 1, f: c => chairSeat(c, o.x + T, o.y + T) }, { y: o.y + 2 * T, f: c => chairBack(c, o.x + T, o.y + T) }] },
  bookshelf: { w: 2, h: 1, block: true, act: "shelf", hitUp: 38, parts: o => [{ y: o.y + T, f: c => dShelf(c, o.x, o.y, o.seed || 3) }] },
  plant: { w: 1, h: 1, block: true, act: "water", hitUp: 14, parts: o => [{ y: o.y + 22, f: c => dPlant(c, o.x, o.y, false) }] },
  monstera: { w: 1, h: 1, block: true, act: "water", hitUp: 28, parts: o => [{ y: o.y + 22, f: c => dPlant(c, o.x, o.y, true) }] },
  rug: { w: 5, h: 3, floor: true, parts: o => [{ f: c => dRug(c, o.x, o.y, o.w * T, o.h * T, o.col) }] },
  rug4: { w: 4, h: 3, floor: true, parts: o => [{ f: c => dRug(c, o.x, o.y, 4 * T, 3 * T, "#3f5a7a") }] },
  bed: { w: 2, h: 3, block: true, act: "nap", hitUp: 18, seats: [{ tile: [-1, 1], px: 24, py: 16, sort: 75, pose: "sleep" }], parts: o => [{ y: o.y + 3 * T, f: c => dBed(c, o.x, o.y) }] },
  beanbag: { w: 1, h: 1, block: true, act: "break", seats: [{ tile: [0, 1], px: 12, py: 20, sort: 25, face: "down" }], parts: o => [{ y: o.y + T, f: c => dBean(c, o.x, o.y) }] },
  radio: { w: 1, h: 1, block: true, act: "music", hitUp: 16, parts: o => [{ y: o.y + T, f: (c, e) => dRadio(c, o.x, o.y, e) }] },
  catbed: { w: 2, h: 1, block: true, act: "pet", hitUp: 4, parts: o => [{ y: o.y + 22, f: (c, e) => dCat(c, o.x, o.y, e) }] },
  nightstand: { w: 1, h: 1, block: true, light: () => [16, -6, 40], hitUp: 12, parts: o => [{ y: o.y + T, f: c => { ob(c, o.x + 2, o.y + 2, 20, 12, WD.top); fr(c, o.x + 3, o.y + 3, 18, 1, WD.hi); ob(c, o.x + 2, o.y + 13, 20, 9, WD.front); fr(c, o.x + 10, o.y + 16, 4, 2, O); ob(c, o.x + 4, o.y - 2, 6, 7, "#7cc6c2"); fr(c, o.x + 15, o.y - 2, 2, 6, O); ob(c, o.x + 11, o.y - 9, 10, 7, "#f2c96b"); } }] },
  books: { w: 1, h: 1, block: true, hitUp: 6, parts: o => [{ y: o.y + 22, f: c => { ob(c, o.x + 3, o.y + 14, 18, 7, "#e0605a"); ob(c, o.x + 5, o.y + 8, 15, 7, "#6a9bd0"); ob(c, o.x + 2, o.y + 2, 17, 7, "#f2c96b"); fr(c, o.x + 4, o.y + 4, 13, 1, "#fff1c2"); ob(c, o.x + 12, o.y - 2, 7, 5, "#fbf7ee"); } }] },
  window: { w: 2, wall: true, parts: o => [{ f: (c, e) => dWindow(c, o.x, e) }] },
  painting: { w: 2, wall: true, parts: o => [{ f: c => dPainting(c, o.x) }] },
  hanging: { w: 1, wall: true, parts: o => [{ f: c => dHanging(c, o.x) }] },
  board: { w: 2, wall: true, act: "board", parts: o => [{ f: c => dBoard(c, o.x) }] },
  menu: { w: 2, wall: true, parts: o => [{ f: c => dMenu(c, o.x) }] },
  clock: { w: 1, wall: true, parts: o => [{ f: c => dClock(c, o.x) }] },
  door: { w: 1, wall: true, act: "door", parts: o => [{ f: c => dDoor(c, o.x) }] },
  lights: { w: 1, wall: true, top: true, parts: o => [{ f: (c, e) => dGarland(c, e, o.span * T) }] },
  studytable: { w: 2, h: 1, block: true, act: "table", hitUp: 14, light: o => [24, -12, o.lit ? 56 : 0],
    seats: [
      { tile: [0, 1], px: 12, py: 42, sort: 40, chair: true, face: "up", write: true }, { tile: [1, 1], px: 36, py: 42, sort: 40, chair: true, face: "up", write: true },
      { tile: [0, -1], px: 12, py: -2, sort: -4, chair: true, face: "down" }, { tile: [1, -1], px: 36, py: -2, sort: -4, chair: true, face: "down" },
      { tile: [-1, 0], px: -10, py: 18, sort: 25, chair: true, face: "right" }, { tile: [2, 0], px: 58, py: 18, sort: 25, chair: true, face: "left" }],
    parts: o => [{ y: o.y + T, f: c => dTable(c, o.x, o.y) },
      ...([[0, 1], [1, 1], [0, -1], [1, -1], [-1, 0], [2, 0]] as const).map(([a, b]) => ({ y: o.y + b * T + (b === 1 ? 1 : b === -1 ? -T + 1 : 2), f: (c: Ctx) => stool(c, o.x + a * T, o.y + b * T) }))] },
  jar: { w: 1, h: 1, block: true, act: "jar", hitUp: 22, parts: o => [{ y: o.y + 22, f: c => dJar(c, o.x, o.y) }] },
  sofa: { w: 3, h: 1, block: true, act: "sofa", hitUp: 16, seats: [0, 1, 2].map(k => ({ tile: [k, 1] as const, px: 12 + 24 * k, py: 16, sort: T + 1, face: "down" as const })), parts: o => [{ y: o.y + T, f: c => dSofa(c, o.x, o.y) }] },
  counter: { w: 3, h: 1, block: true, act: "drink", hitUp: 26, light: () => [36, -16, 50], parts: o => [{ y: o.y + T, f: c => dCounter(c, o.x, o.y) }] },
};
const def = (o: Obj): TypeDef => TYPES[o.type];

/* everyone's outfits */
const FITS: Record<string, Outfit> = {
  maya: { top: "coat", col: "#c8925a", sh: "#a8743f", acc: "#f3e2c7", legs: "#5b4741", shoe: CK, hat: null, scarf: "#e0605a" },
  aisha: { top: "sweater", col: "#e3b04b", sh: "#c4923a", acc: "#e0605a", legs: "#4a5d86", shoe: CK, hat: "beanie", hatCol: "#9b84c9" },
  josh: { top: "puffer", col: "#5a86bf", sh: "#476ea3", acc: "#a9cbeb", legs: "#3b4a6b", shoe: CK, hat: "headphones", hatCol: "#f2c96b" },
  sam: { top: "sweater", col: "#e8dfcc", sh: "#cfc3ab", acc: "#8fb35a", legs: "#7e655b", shoe: CK, hat: null },
};
const fitOf = (id: string) => FITS[id] || OUTFIT_DEFAULT;
const AVATAR_PAL: Record<string, string> = { maya: "-pink", aisha: "-lilac", josh: "-gold", sam: "-green" };

/** A friend's portrait for the feature list: a 22 by 38 canvas, standing, facing you. */
export function drawAvatar(cv: HTMLCanvasElement, id: string) {
  cv.width = 22; cv.height = 38;
  const c = cv.getContext("2d"); if (!c) return;
  c.clearRect(0, 0, 22, 38);
  drawPlumi(c, 11, 37, { dir: "down", pal: AVATAR_PAL[id] ?? "", outfit: fitOf(id), noShadow: true });
}

/** The wardrobe on the "Earn your room" card: Plumi's default look, then three friends'. */
export const OUTFIT_COUNT = 4;
export function drawOutfit(cv: HTMLCanvasElement, i: number) {
  const fits = [OUTFIT_DEFAULT, FITS.maya, FITS.aisha, FITS.josh], pals = ["", "-pink", "-lilac", "-gold"];
  cv.width = 22; cv.height = 38;
  const c = cv.getContext("2d"); if (!c) return;
  c.clearRect(0, 0, 22, 38);
  drawPlumi(c, 11, 37, { dir: "down", pal: pals[i], outfit: fits[i], noShadow: true });
}

interface CharSpec { id: string; name: string; pal: string; tx: number; ty: number; seatAt?: readonly [string, number]; status?: string; sleepy?: boolean; wander?: boolean }
interface Char extends CharSpec {
  dir: Dir; path: [number, number][]; mode: "walk" | "sit"; phase: number; blinkAt: number; x: number; y: number;
  seat: { oid: string; i: number; tile: readonly [number, number] } | null; sort: number; pose: string; writing: boolean;
  then: (() => void) | null; moving: boolean; blink: boolean; wt?: number; mug: boolean;
}
interface Scene { cols: number; rows: number; theme: "oak" | "blue"; objects: Obj[]; chars: CharSpec[] }
interface WorldOpts { evening: boolean; onChar?: (ch: Char) => void }

class World {
  private sc: Scene; private o: WorldOpts; private W: number; private H: number;
  private cv: HTMLCanvasElement; private c: Ctx; private ov: HTMLElement | null;
  private t = 0; private chars: Char[]; private you: Char | undefined;
  private blk: boolean[][] = []; private res: boolean[][] = [];
  private light: HTMLCanvasElement; private base: HTMLCanvasElement;
  private ovEls: HTMLElement[] | null = null;
  private raf = 0; private iv: ReturnType<typeof setInterval> | undefined; private running = false; private last = 0;
  private abort = new AbortController();
  private timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(cv: HTMLCanvasElement, ov: HTMLElement | null, scene: Scene, o: WorldOpts) {
    this.sc = scene; this.o = o; this.W = scene.cols * T; this.H = scene.rows * T;
    this.cv = cv; this.cv.width = this.W; this.cv.height = this.H;
    this.c = this.cv.getContext("2d")!; this.c.imageSmoothingEnabled = false;
    this.ov = ov;
    this.chars = scene.chars.map((ch, i): Char => ({ dir: "down", path: [], mode: "walk", phase: i * .37, blinkAt: 1 + i * 1.3, seat: null, sort: 0, pose: "stand", writing: false, then: null, moving: false, blink: false, mug: false, ...ch, x: ch.tx * T + 12, y: ch.ty * T + 18 }));
    this.you = this.chars.find(ch => ch.id === "you");
    this.reblock();
    this.chars.forEach(ch => { if (ch.seatAt) { const s = this.obj(ch.seatAt[0]); if (s) this.sit(ch, s, ch.seatAt[1]); } });
    this.light = document.createElement("canvas"); this.light.width = this.W; this.light.height = this.H;
    this.base = this.drawBase();
    this.bind();
    this.draw();
  }
  private obj(id: string) { return this.sc.objects.find(x => x.id === id); }
  private reblock() {
    const { cols, rows } = this.sc;
    this.blk = Array.from({ length: rows }, (_, y) => Array<boolean>(cols).fill(y < 2));
    this.res = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
    this.sc.objects.forEach(o => {
      const d = def(o);
      o.x = o.tx * T; o.y = o.ty * T; o.w = d.top ? this.sc.cols : (o.rw || d.w); o.h = o.rh || d.h || 1; o.span = this.sc.cols;
      if (d.wall || d.floor) return;
      for (let y = o.ty; y < o.ty + o.h; y++) for (let x = o.tx; x < o.tx + o.w; x++) if (this.blk[y] && x >= 0 && x < cols) this.blk[y][x] = true;
      (d.seats || []).forEach(s => { const sx = o.tx + s.tile[0], sy = o.ty + s.tile[1]; if (this.res[sy] && sx >= 0 && sx < cols) this.res[sy][sx] = true; });
    });
  }
  private free(x: number, y: number) { return y >= 2 && y < this.sc.rows && x >= 0 && x < this.sc.cols && !this.blk[y][x]; }
  private tileOf(ch: Char): [number, number] { return [Math.floor(ch.x / T), Math.floor((ch.y - 2) / T)]; }
  private nearestFree([tx, ty]: readonly [number, number]): [number, number] | null {
    for (let r = 0; r < 10; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) + Math.abs(dy) !== r) continue; if (this.free(tx + dx, ty + dy)) return [tx + dx, ty + dy];
    }
    return null;
  }
  private randomFree(): [number, number] | null { for (let i = 0; i < 40; i++) { const x = Math.floor(Math.random() * this.sc.cols), y = 2 + Math.floor(Math.random() * (this.sc.rows - 2)); if (this.free(x, y) && !this.res[y][x]) return [x, y]; } return null; }
  private path(from: readonly [number, number], to: readonly [number, number]) {
    const cols = this.sc.cols, key = (x: number, y: number) => y * cols + x;
    const prev = new Map<number, [number, number] | null>([[key(from[0], from[1]), null]]);
    const q: [number, number][] = [[from[0], from[1]]];
    while (q.length) {
      const [x, y] = q.shift()!; if (x === to[0] && y === to[1]) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = key(nx, ny); if (!prev.has(k) && this.free(nx, ny)) { prev.set(k, [x, y]); q.push([nx, ny]); } }
    }
    if (!prev.has(key(to[0], to[1]))) return null;
    const out: [number, number][] = []; let cur: [number, number] | null | undefined = [to[0], to[1]];
    while (cur) { out.unshift(cur); cur = prev.get(key(cur[0], cur[1])); }
    return out.slice(1);
  }
  private walkTo(ch: Char, tile: readonly [number, number], then?: () => void) {
    this.stand(ch);
    let start = this.tileOf(ch); if (!this.free(...start)) start = this.nearestFree(start) || start;
    const p = this.path(start, tile); if (!p) return false;
    ch.path = p.map(([x, y]) => [x * T + 12, y * T + 18]); ch.then = then || null;
    if (!p.length && then) { ch.then = null; then(); }
    return true;
  }
  private approach(o: Obj, who?: Char) {
    const d = def(o), cand: [number, number][] = [];
    if (d.wall) for (let x = o.tx; x < o.tx + o.w; x++) cand.push([x, 2]);
    else {
      for (let x = o.tx; x < o.tx + o.w; x++) { cand.push([x, o.ty - 1]); cand.push([x, o.ty + o.h]); }
      for (let y = o.ty; y < o.ty + o.h; y++) { cand.push([o.tx - 1, y]); cand.push([o.tx + o.w, y]); }
    }
    const ch = who || this.you; if (!ch) return null;
    let start: [number, number] | null = this.tileOf(ch); if (!this.free(...start)) start = this.nearestFree(start);
    if (!start) return null;
    let best: [number, number] | null = null, bl = 1e9;
    for (const t of cand) { if (!this.free(...t)) continue; const p = this.path(start, t); if (p && p.length < bl) { bl = p.length; best = t; } }
    return best;
  }
  private seatTaken(o: Obj, i: number) { return this.chars.some(ch => ch !== this.you && ch.seat && ch.seat.oid === o.id && ch.seat.i === i); }
  private use(o: Obj, seat?: number) {
    const d = def(o), me = this.you; if (!me) return;
    if (d.seats) {
      const i = seat !== undefined ? seat : d.seats.findIndex((_, k) => !this.seatTaken(o, k));
      if (i < 0 || this.seatTaken(o, i)) return;
      if (me.seat && me.seat.oid === o.id && me.seat.i === i) return;
      const s = d.seats[i]; let tile: readonly [number, number] | null = [o.tx + s.tile[0], o.ty + s.tile[1]];
      if (!this.free(...tile)) tile = this.approach(o);
      if (!tile) return;
      this.walkTo(me, tile, () => this.sit(me, o, i));
      return;
    }
    const tile = this.approach(o); if (!tile) return;
    this.walkTo(me, tile, () => this.face(me, o));
  }
  private face(ch: Char, o: Obj) {
    const cx = o.x + o.w * T / 2, cy = def(o).wall ? 0 : o.y + o.h * T / 2, dx = cx - ch.x, dy = cy - (ch.y - 8);
    ch.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  }
  private sit(ch: Char, o: Obj, i: number) {
    const s = def(o).seats![i];
    ch.mode = "sit"; ch.seat = { oid: o.id, i, tile: [o.tx + s.tile[0], o.ty + s.tile[1]] };
    ch.x = o.x + s.px; ch.y = o.y + s.py; ch.sort = o.y + s.sort; ch.pose = s.pose || "sit"; ch.dir = s.face || "down"; ch.writing = !!s.write && !ch.sleepy; ch.path = [];
  }
  private stand(ch: Char) {
    if (ch.mode !== "sit" || !ch.seat) return;
    let t: readonly [number, number] | null = ch.seat.tile; if (!this.free(...t)) t = this.nearestFree(t);
    if (!t) return;
    ch.x = t[0] * T + 12; ch.y = t[1] * T + 18; ch.mode = "walk"; ch.seat = null; ch.pose = "stand"; ch.writing = false;
  }
  private update(dt: number) {
    this.t += dt;
    this.chars.forEach(ch => {
      if (ch.path.length) {
        const [tx, ty] = ch.path[0], dx = tx - ch.x, dy = ty - ch.y, dist = Math.hypot(dx, dy), step = 70 * dt;
        if (dist > .5) ch.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
        if (dist <= step) { ch.x = tx; ch.y = ty; ch.path.shift(); if (!ch.path.length && ch.then) { const f = ch.then; ch.then = null; f(); } }
        else { ch.x += dx / dist * step; ch.y += dy / dist * step; }
      }
      ch.moving = ch.path.length > 0;
      if (this.t > ch.blinkAt) { ch.blink = true; if (this.t > ch.blinkAt + .14) { ch.blink = false; ch.blinkAt = this.t + 2.5 + Math.random() * 3; } }
      if (ch.wander && ch.mode === "walk" && !ch.path.length) {
        ch.wt = (ch.wt === undefined ? 1.2 : ch.wt) - dt;
        if (ch.wt <= 0) {
          ch.wt = 2 + Math.random() * 3;
          const ctr = this.obj("counter");
          const t = ctr && Math.random() < .35 ? this.approach(ctr, ch) : null;
          if (t) this.walkTo(ch, t, () => { ch.dir = "up"; ch.mug = true; ch.wt = 2.5; });
          else { const r = this.randomFree(); if (r) this.walkTo(ch, r); }
        }
      }
    });
  }
  private drawBase() {
    const cv = document.createElement("canvas"); cv.width = this.W; cv.height = this.H;
    const c = cv.getContext("2d")!, P = PAL[this.sc.theme], W = this.W, H = this.H;
    planks(c, 0, 2 * T, W, H - 2 * T, P, 11);
    fr(c, 0, 0, W, 48, P.wa);
    for (let x = 2; x < W; x += 8) fr(c, x, 4, 3, 24, P.wb);
    for (let x = 6; x < W; x += 8) for (let y = 7; y < 27; y += 6) fr(c, x, y, 1, 1, P.dot);
    fr(c, 0, 0, W, 3, P.trim); fr(c, 0, 3, W, 1, P.wnh);
    fr(c, 0, 27, W, 3, P.rail); fr(c, 0, 27, W, 1, P.wnh); fr(c, 0, 30, W, 1, O);
    fr(c, 0, 31, W, 14, P.wn);
    for (let x = 0; x < W; x += 24) { fr(c, x + 3, 33, 18, 10, P.wnl); fr(c, x + 4, 34, 16, 8, P.wn); fr(c, x + 4, 34, 16, 1, P.wnh); }
    fr(c, 0, 44, W, 1, O); fr(c, 0, 45, W, 3, P.base);
    fr(c, 0, 2 * T, W, 4, "rgba(58,42,53,.22)");
    fr(c, 0, 0, 4, H, P.edge); fr(c, W - 4, 0, 4, H, P.edge); fr(c, 0, H - 4, W, 4, P.edge); fr(c, 4, 0, 1, H, "rgba(0,0,0,.2)"); fr(c, W - 5, 0, 1, H, "rgba(0,0,0,.2)");
    return cv;
  }
  private lights() {
    const out: [number, number, number][] = [];
    this.sc.objects.forEach(o => {
      const d = def(o);
      if (d.top) { for (let x = 0; x < o.span * T; x += 32) out.push([x, 9, 18]); return; }
      const l = d.light && d.light(o); if (l && l[2]) out.push([o.x + l[0], o.y + l[1], l[2]]);
    });
    return out;
  }
  private drawLight(evening: boolean) {
    const L = this.light.getContext("2d")!, c = this.c, ls = this.lights();
    if (!evening) {
      c.save(); c.globalCompositeOperation = "lighter";
      ls.forEach(([x, y, r]) => { if (r < 30) return; const g = c.createRadialGradient(x, y, 0, x, y, r * .7); g.addColorStop(0, "rgba(255,190,110,.16)"); g.addColorStop(1, "rgba(255,190,110,0)"); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); });
      c.restore(); return;
    }
    L.globalCompositeOperation = "source-over"; L.clearRect(0, 0, this.W, this.H);
    L.fillStyle = "rgba(34,22,58,.3)"; L.fillRect(0, 0, this.W, this.H);
    L.globalCompositeOperation = "destination-out";
    ls.forEach(([x, y, r]) => { const g = L.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(.55, "rgba(0,0,0,.65)"); g.addColorStop(1, "rgba(0,0,0,0)"); L.fillStyle = g; L.fillRect(x - r, y - r, 2 * r, 2 * r); });
    c.drawImage(this.light, 0, 0);
    c.save(); c.globalCompositeOperation = "lighter";
    ls.forEach(([x, y, r]) => { const g = c.createRadialGradient(x, y, 0, x, y, r * .8); g.addColorStop(0, "rgba(255,170,80,.2)"); g.addColorStop(1, "rgba(255,170,80,0)"); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); });
    c.restore();
  }
  private drawChar(ch: Char) {
    const frame = ch.moving ? Math.floor(this.t * 8 + ch.phase * 4) % 4 : 0;
    drawPlumi(this.c, ch.x, ch.y, { dir: ch.dir, frame, pose: ch.mode === "sit" ? (ch.pose || "sit") : "stand", pal: ch.pal, outfit: fitOf(ch.id), t: this.t + ch.phase, blink: ch.blink, sleepy: ch.sleepy, write: ch.writing, mug: ch.mug });
    if (ch.sleepy && ch.mode === "sit") { const k = Math.floor(this.t * 1.5 + ch.phase) % 3; fr(this.c, Math.round(ch.x) + 7 + k, Math.round(ch.y) - 34 - k * 3, 3, 1, O); fr(this.c, Math.round(ch.x) + 9 + k, Math.round(ch.y) - 33 - k * 3, 1, 1, O); fr(this.c, Math.round(ch.x) + 7 + k, Math.round(ch.y) - 32 - k * 3, 3, 1, O); }
  }
  private draw() {
    const c = this.c, e: Env = { t: this.t, evening: this.o.evening }, objs = this.sc.objects;
    c.drawImage(this.base, 0, 0);
    objs.forEach(o => { if (def(o).wall) def(o).parts(o).forEach(p => p.f(c, e)); });
    objs.forEach(o => { if (def(o).floor) def(o).parts(o).forEach(p => p.f(c, e)); });
    objs.forEach(o => { const d = def(o); if (d.wall || d.floor) return; const y = o.y + o.h * T; fr(c, o.x + 3, y - 6, o.w * T - 6, 6, SH); fr(c, o.x + 1, y - 4, o.w * T - 2, 3, SH); });
    const parts: Part[] = [];
    objs.forEach(o => { const d = def(o); if (!d.wall && !d.floor) d.parts(o).forEach(p => parts.push(p)); });
    this.chars.forEach(ch => parts.push({ y: ch.mode === "sit" ? ch.sort : ch.y, f: () => this.drawChar(ch) }));
    parts.sort((a, b) => (a.y ?? 0) - (b.y ?? 0)).forEach(p => p.f(c, e));
    this.drawLight(e.evening);
    this.drawNames();
  }
  private hit(px: number, py: number) {
    const objs = this.sc.objects.filter(o => !def(o).top);
    const solid = objs.filter(o => !def(o).wall && !def(o).floor).sort((a, b) => b.y - a.y);
    for (const o of solid) { const d = def(o); if (px >= o.x && px < o.x + o.w * T && py >= o.y - (d.hitUp || 0) && py < o.y + o.h * T) return o; }
    if (py < 2 * T) for (const o of objs) if (def(o).wall && px >= o.x && px < o.x + o.w * T) return o;
    for (const o of objs) if (def(o).floor && px >= o.x && px < o.x + o.w * T && py >= o.y && py < o.y + o.h * T) return o;
    return null;
  }
  private click(px: number, py: number) {
    const me = this.you; if (!me) return;
    const tile: [number, number] = [Math.floor(px / T), Math.floor(py / T)];
    const ch = this.chars.find(c => c !== me && Math.abs(px - c.x) < 10 && py > c.y - 34 && py < c.y + 2);
    if (ch && this.o.onChar) { this.o.onChar(ch); return; }
    for (const o of this.sc.objects) {
      const d = def(o); if (!d.seats || !(o.act || d.act)) continue;
      const i = d.seats.findIndex(s => s.chair && o.tx + s.tile[0] === tile[0] && o.ty + s.tile[1] === tile[1]);
      if (i >= 0 && this.free(...tile)) { this.use(o, i); return; }
    }
    const o = this.hit(px, py);
    if (o && (o.act || def(o).act)) { this.use(o); return; }
    const t = this.free(...tile) ? tile : this.nearestFree(tile);
    if (t) this.walkTo(me, t);
  }
  /** Name tags over everyone but you, positioned in percentages so they follow the canvas's size. */
  private drawNames() {
    const ov = this.ov; if (!ov) return;
    if (!this.ovEls) {
      this.ovEls = this.chars.map(ch => {
        const el = document.createElement("div"); el.className = "lp-nm";
        const b = document.createElement("b"); b.textContent = ch.name; el.appendChild(b);
        if (ch.status) { const s = document.createElement("span"); s.textContent = ` · ${ch.status}`; el.appendChild(s); }
        ov.appendChild(el); return el;
      });
    }
    this.chars.forEach((ch, i) => {
      const nm = this.ovEls![i], up = ch.mode === "sit" ? (ch.pose === "sleep" ? 22 : 34 + (ch.seat && ch.seat.i % 2 ? 9 : 0)) : 38;
      nm.style.left = (ch.x / this.W * 100) + "%"; nm.style.top = ((ch.y - up) / this.H * 100) + "%";
    });
  }
  /** A little pixel icon that rises from someone and fades: the high five. */
  float(ch: Char, dy = 40) {
    if (!this.ov) return;
    const f = document.createElement("div"); f.className = "lp-fl";
    f.style.left = (ch.x / this.W * 100) + "%"; f.style.top = ((ch.y - dy) / this.H * 100) + "%";
    f.innerHTML = pix(ART.star[0], ART.star[1]); this.ov.appendChild(f);
    const id = setTimeout(() => { f.remove(); this.timers.delete(id); }, 1500); this.timers.add(id);
  }
  private bind() {
    const cv = this.cv, signal = this.abort.signal;
    const pt = (e: PointerEvent): [number, number] => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * this.W, (e.clientY - r.top) / r.height * this.H]; };
    cv.addEventListener("pointerdown", e => { const [x, y] = pt(e); this.click(x, y); }, { signal });
  }
  private step = () => { const now = performance.now(), dt = Math.min(.05, (now - this.last) / 1000); this.last = now; this.update(dt); this.draw(); };
  private loop = () => { this.step(); this.raf = requestAnimationFrame(this.loop); };
  /** Runs the room. Paused while it is off screen, so two rooms never draw for nobody. */
  start() {
    if (this.running) return; this.running = true; this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    this.iv = setInterval(() => { if (performance.now() - this.last > 120) this.step(); }, 50);
  }
  pause() { this.running = false; cancelAnimationFrame(this.raf); clearInterval(this.iv); }
  destroy() {
    this.pause(); this.abort.abort();
    this.timers.forEach(id => clearTimeout(id)); this.timers.clear();
    if (this.ov) this.ov.replaceChildren();
    this.ovEls = null;
  }
}

/* scenes */
const mk = (o: Omit<Obj, "x" | "y" | "w" | "h" | "span">): Obj => ({ x: 0, y: 0, w: 1, h: 1, span: 0, ...o });
function homeScene(): Scene {
  return { cols: 18, rows: 11, theme: "blue", objects: [
    mk({ id: "lights", type: "lights", tx: 0, ty: 0 }),
    mk({ id: "win1", type: "window", tx: 2, ty: 0 }), mk({ id: "clock", type: "clock", tx: 5, ty: 0 }), mk({ id: "board", type: "board", tx: 8, ty: 0 }),
    mk({ id: "hang", type: "hanging", tx: 12, ty: 0 }), mk({ id: "win2", type: "window", tx: 13, ty: 0 }), mk({ id: "door", type: "door", tx: 16, ty: 0 }),
    mk({ id: "rug", type: "rug", tx: 6, ty: 5 }), mk({ id: "rug2", type: "rug4", tx: 1, ty: 6 }),
    mk({ id: "desk", type: "desk", tx: 2, ty: 2 }), mk({ id: "shelf", type: "bookshelf", tx: 6, ty: 2, seed: 4 }), mk({ id: "shelf2", type: "bookshelf", tx: 10, ty: 2, seed: 7 }),
    mk({ id: "plant1", type: "plant", tx: 0, ty: 2 }), mk({ id: "plant4", type: "plant", tx: 8, ty: 2 }), mk({ id: "radio", type: "radio", tx: 12, ty: 2 }),
    mk({ id: "bed", type: "bed", tx: 15, ty: 3 }), mk({ id: "night", type: "nightstand", tx: 14, ty: 3 }),
    mk({ id: "bean", type: "beanbag", tx: 2, ty: 7 }), mk({ id: "books", type: "books", tx: 4, ty: 7 }),
    mk({ id: "cat", type: "catbed", tx: 8, ty: 6 }), mk({ id: "plant2", type: "monstera", tx: 1, ty: 9 }), mk({ id: "plant3", type: "plant", tx: 17, ty: 9 }),
  ], chars: [{ id: "you", name: "You", pal: "", tx: 3, ty: 3, seatAt: ["desk", 0] }] };
}
function hallScene(): Scene {
  return { cols: 16, rows: 10, theme: "oak", objects: [
    mk({ id: "lights", type: "lights", tx: 0, ty: 0 }),
    mk({ id: "win1", type: "window", tx: 1, ty: 0 }), mk({ id: "menu", type: "menu", tx: 4, ty: 0 }), mk({ id: "paint", type: "painting", tx: 7, ty: 0 }),
    mk({ id: "door", type: "door", tx: 10, ty: 0, act: "home" }), mk({ id: "win2", type: "window", tx: 12, ty: 0 }), mk({ id: "hang", type: "hanging", tx: 15, ty: 0 }),
    mk({ id: "rugA", type: "rug", tx: 0, ty: 5, rw: 6, rh: 3 }), mk({ id: "rugB", type: "rug", tx: 7, ty: 5, rw: 6, rh: 3, col: "#3f5a7a" }),
    mk({ id: "counter", type: "counter", tx: 4, ty: 2 }), mk({ id: "shelf2", type: "bookshelf", tx: 14, ty: 2, seed: 9 }),
    mk({ id: "plantA", type: "monstera", tx: 0, ty: 2 }), mk({ id: "plantC", type: "plant", tx: 3, ty: 2 }), mk({ id: "plantB", type: "plant", tx: 15, ty: 6 }),
    mk({ id: "tA", type: "studytable", tx: 2, ty: 6, lit: true }), mk({ id: "tB", type: "studytable", tx: 9, ty: 6, lit: false }),
    mk({ id: "jar", type: "jar", tx: 13, ty: 4 }), mk({ id: "sofa", type: "sofa", tx: 12, ty: 8 }), mk({ id: "bean", type: "beanbag", tx: 6, ty: 9 }),
  ], chars: [
    { id: "you", name: "You", pal: "", tx: 10, ty: 3 },
    { id: "maya", name: "Maya", pal: "-pink", tx: 2, ty: 7, seatAt: ["tA", 0], status: "Chemistry · 12 min" },
    { id: "aisha", name: "Aisha", pal: "-lilac", tx: 3, ty: 5, seatAt: ["tA", 3], status: "Biology · 31 min" },
    { id: "josh", name: "Josh", pal: "-gold", tx: 7, ty: 4, wander: true, status: "On a break" },
    { id: "sam", name: "Sam", pal: "-green", tx: 13, ty: 9, seatAt: ["sofa", 1], status: "Away · 2 h", sleepy: true },
  ] };
}

export type RoomName = "home" | "hall";

/**
 * Mounts a room on `cv`, with its name tags in `ov`, and runs it while it is on screen.
 * Returns the cleanup, which stops it and removes everything it added.
 */
export function mountRoom(cv: HTMLCanvasElement, ov: HTMLElement | null, room: RoomName): () => void {
  const world: World = room === "home"
    ? new World(cv, ov, homeScene(), { evening: true })
    : new World(cv, ov, hallScene(), { evening: false, onChar: ch => world.float(ch) });
  if (typeof IntersectionObserver === "undefined") { world.start(); return () => world.destroy(); }
  const io = new IntersectionObserver(entries => { for (const e of entries) { if (e.isIntersecting) world.start(); else world.pause(); } }, { rootMargin: "100px 0px" });
  io.observe(cv);
  return () => { io.disconnect(); world.destroy(); };
}
