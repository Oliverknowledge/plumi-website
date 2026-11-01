import { hexColour, known, type PeopleCatalogue, type PersonLook } from "./look";

/**
 * One person's 78 frames, drawn from the iPad's layers, in the order the room's engine reads them.
 *
 * THE MAPPING (found by composing known parts and matching them to public/library/people.png, see
 * sheet.test.ts: all 36 rows x 78 frames have the identical outline, and differ in at most 12 of 512 pixels, which is
 * the soft shadow pixels, below).
 *
 * The iPad's layers are 384 x 192 sheets of 16 x 32 frames (tools/cafe-hall/people.py `crop`):
 *   row 0 idle   24 frames: right, back, left, front, 6 each      row 3 stand  4    (not used here)
 *   row 1 walk   24 frames, the same order                          row 4 sleep  6    (not used here)
 *   row 2 sit    12 (0-5 right, 6-11 left), phone 6, read 6         row 5 sit2   12   (not used here)
 * The web engine reads one flat row of 78 frames (layout.json `people.rows`):
 *   0-23 idle = layer row 0 cols 0-23        24-47 walk = layer row 1 cols 0-23
 *   48-59 sit = layer row 2 cols 0-11        60-65 phone = row 2 cols 12-17       66-71 read = row 2 cols 18-23 + a book
 *   72-77 stool = layer row 0, "back" cols 6-11, lengthened a second time and cut to rows 4-23 (carrels and the bar)
 * Each frame is then made as the iPad makes it (`PeopleArt.frame`): layers over one another (body, eyes, outfit, hair,
 * accessory), the book over a reader, the body lengthened by 1.25 below the head, the Plumi headphones painted on,
 * and, last, the colour grade the web's art is baked with (the cast was made by export_library.py with
 * make_cafe_full.grade; the engine's lamplight goes over everything), so a person made here sits in the room like
 * the premade ones.
 *
 * Where it differs from people.png by a few pixels: the iPad restyles each layer before laying them over each other
 * (soft shadows become alpha 92), the web's cast restyled the finished picture. Hair shadows over skin are lighter
 * there. This is the iPad's own drawing, so it is kept.
 */

export const FRAME_W = 16, FRAME_H = 32;
export const FRAMES = 78;
export const ROW_W = FRAMES * FRAME_W;
export const SHEET_W = 384;
/** Rows 0 to 2 of a layer are all the web reads. */
export const SHEET_ROWS = 3;
export const SHEET_BYTES = SHEET_W * SHEET_ROWS * FRAME_H * 4;
/** Where each pose starts in the 78 (layout.json `people.rows`). */
export const POSE = { idle: 0, walk: 24, sit: 48, phone: 60, read: 66, stool: 72 } as const;

/** A layer, rows 0 to 2 of the iPad's 384 x 192 sheet, RGBA. */
export type Layer = Uint8Array;
export type LayerSource = (key: string) => Layer | null;

/** The iPad's `PixelBitmap.draw(_:at:)` with both pictures the same size: source-over in integers. */
function drawOver(dst: Uint8Array | Uint8ClampedArray, src: Uint8Array | Uint8ClampedArray) {
  for (let i = 0; i + 3 < src.length; i += 4) {
    const a = src[i + 3];
    if (a >= 255) { dst[i] = src[i]; dst[i + 1] = src[i + 1]; dst[i + 2] = src[i + 2]; dst[i + 3] = 255; }
    else if (a > 0) {
      const da = dst[i + 3];
      const outA = a + Math.trunc((da * (255 - a)) / 255);
      if (outA > 0) {
        const keep = da * (255 - a);
        for (let k = 0; k < 3; k++) dst[i + k] = Math.min(255, Math.trunc((src[i + k] * a + Math.trunc((dst[i + k] * keep) / 255)) / outA));
        dst[i + 3] = Math.min(255, outA);
      }
    }
  }
}

/** The keys of the layers a look is made of, in the order they are laid. */
export function layerKeys(look: PersonLook): string[] {
  const keys = ["body/" + look.body, "eyes/" + look.eyes, "outfit/" + look.outfit, "hair/" + look.hair];
  if (look.accessory !== null) keys.push("acc/" + look.accessory);
  return keys;
}

/** Body, eyes, outfit, hair and accessory over one another (`PeopleArt.sheet`); null without a body. */
export function laySheet(look: PersonLook, layer: LayerSource): Uint8Array | null {
  const keys = layerKeys(look);
  const base = layer(keys[0]);
  if (!base) return null;
  const out = new Uint8Array(base);
  for (const k of keys.slice(1)) { const top = layer(k); if (top) drawOver(out, top); }
  return out;
}

function frameOf(sheet: Uint8Array, row: number, col: number): Uint8Array {
  const f = new Uint8Array(FRAME_W * FRAME_H * 4);
  for (let y = 0; y < FRAME_H; y++) {
    const s = ((row * FRAME_H + y) * SHEET_W + col * FRAME_W) * 4;
    f.set(sheet.subarray(s, s + FRAME_W * 4), y * FRAME_W * 4);
  }
  return f;
}

/** Python's round and Swift's .toNearestOrEven: halves go to the even number. */
function roundEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** Bodies a little longer than the pack's chibi ones: the rows below the head stretched by whole rows, the feet where they were (`PeopleArt.lengthen`). */
export function lengthen(f: Uint8Array, stretch: number): Uint8Array {
  const w = FRAME_W, h = FRAME_H;
  let top = -1, bottom = -1;
  for (let y = 0; y < h; y++) {
    let any = false;
    for (let x = 0; x < w && !any; x++) any = f[(y * w + x) * 4 + 3] > 0;
    if (any) { if (top < 0) top = y; bottom = y; }
  }
  if (top < 0) return f;
  const start = top + 14, n = bottom - start + 1;
  if (n < 3) return f;
  const n2 = roundEven(n * stretch);
  let rows: number[] = [];
  for (let y = 0; y < start; y++) rows.push(y);
  for (let i = 0; i < n2; i++) rows.push(start + Math.trunc((i * n) / n2));
  for (let y = bottom + 1; y < h; y++) rows.push(y);
  rows = rows.slice(Math.max(0, n2 - n));
  const out = new Uint8Array(f.length);
  rows.forEach((from, y) => { if (y < h) out.set(f.subarray(from * w * 4, (from + 1) * w * 4), y * w * 4); });
  return out;
}

/** Plumi headphones: a cup each side of the head from the front or back, one behind the ear side-on, the band over the top (`PeopleArt.headphones`). */
export function headphones(src: Uint8Array, side: number, cup: readonly number[], light: readonly number[], band: readonly number[]): Uint8Array {
  const f = new Uint8Array(src), w = FRAME_W, h = FRAME_H;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && f[(y * w + x) * 4 + 3] > 0;
  const rgb = (x: number, y: number, c: readonly number[], opaque = false) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    f[i] = c[0]; f[i + 1] = c[1]; f[i + 2] = c[2];
    if (opaque) f[i + 3] = 255;
  };
  let top = -1;
  for (let y = 0; y < h && top < 0; y++) for (let x = 0; x < w; x++) if (on(x, y)) { top = y; break; }
  if (top < 0) return f;
  const cols: number[] = [];
  for (let x = 0; x < w; x++) for (let y = top; y < Math.min(h, top + 10); y++) if (on(x, y)) { cols.push(x); break; }
  if (!cols.length) return f;
  const x0 = cols[0], x1 = cols[cols.length - 1], cy = top + 5;
  if (side !== 0) {
    const cx = Math.trunc((x0 + x1) / 2) + (side > 0 ? -1 : 0);
    for (let y = cy - 1; y < cy + 2; y++) for (let x = cx; x < cx + 2; x++) rgb(x, y, cup);
    rgb(cx, cy - 1, light);
    for (let y = top + 1; y < cy - 1; y++) rgb(cx, y, band);
  } else {
    for (const cx of [x0, x1 - 1]) {
      for (let y = cy; y < cy + 3; y++) for (let x = cx; x < cx + 2; x++) rgb(x, y, cup, true);
      rgb(cx, cy, light);
    }
    if (x0 + 2 < x1 - 1) for (let x = x0 + 2; x < x1 - 1; x++) rgb(x, top + 1, band);
  }
  return f;
}

/** The colour grade the web's art is baked with (make_cafe_full.grade): a touch less colour, a warm cast. */
export function grade(f: Uint8Array | Uint8ClampedArray): void {
  for (let i = 0; i < f.length; i += 4) {
    if (f[i + 3] === 0) continue;
    const g = (f[i] + f[i + 1] + f[i + 2]) / 3;
    const mul = [0.96, 0.9, 0.88], add = [6, 2, 0];
    for (let k = 0; k < 3; k++) {
      const v = (g + (f[i + k] - g) * 0.94) * mul[k] + add[k];
      f[i + k] = Math.trunc(Math.min(255, Math.max(0, v)));
    }
  }
}

export interface RowOptions {
  /** Which of the generator's books a reader holds ("01" to "06" in the catalogue), or null for none. */
  book?: string | null;
  /** Leave the colour grade off (the wardrobe's own pictures, which are not lit by the room). */
  graded?: boolean;
}

/**
 * The 78 frames for one person, as a 1248 x 32 RGBA picture the engine draws a frame at a time (see the mapping at
 * the top). Null when the body layer is missing (the art did not load); a missing hair or outfit is left off.
 */
export function composeRow(cat: PeopleCatalogue, input: PersonLook, layer: LayerSource, opts: RowOptions = {}): Uint8ClampedArray | null {
  const look = known(cat, input);
  const sheet = laySheet(look, layer);
  if (!sheet) return null;
  const book = opts.book ? layer("book/" + opts.book) : null;
  const cols = cat.headphones[look.phones ?? ""] ?? null;
  const cup = cols ? hexColour(cols[0]) : null, light = cols ? hexColour(cols[1]) : null, band = hexColour(cat.band);
  const out = new Uint8ClampedArray(ROW_W * FRAME_H * 4);
  const put = (index: number, f: Uint8Array) => {
    const g = new Uint8Array(f);
    if (opts.graded !== false) grade(g);
    for (let y = 0; y < FRAME_H; y++) out.set(g.subarray(y * FRAME_W * 4, (y + 1) * FRAME_W * 4), (y * ROW_W + index * FRAME_W) * 4);
  };
  const make = (row: number, col: number, side: number, withBook = false) => {
    let f = frameOf(sheet, row, col);
    if (withBook && book) drawOver(f, frameOf(book, row, col));
    f = lengthen(f, cat.stretch);
    return cup && light ? headphones(f, side, cup, light, band) : f;
  };
  const sideOf = (dir: number) => (dir === 0 ? 1 : dir === 2 ? -1 : 0);
  let n = 0;
  for (const row of [0, 1]) for (let dir = 0; dir < 4; dir++) for (let i = 0; i < 6; i++) put(n++, make(row, dir * 6 + i, sideOf(dir)));
  for (let d = 0; d < 2; d++) for (let i = 0; i < 6; i++) put(n++, make(2, d * 6 + i, d === 0 ? 1 : -1));
  for (let i = 0; i < 6; i++) put(n++, make(2, 12 + i, 0));
  for (let i = 0; i < 6; i++) put(n++, make(2, 18 + i, 0, true));
  for (let i = 0; i < 6; i++) {
    const back = lengthen(make(0, 6 + i, 0), cat.stretch);
    const f = new Uint8Array(FRAME_W * FRAME_H * 4);
    f.set(back.subarray(4 * FRAME_W * 4, 24 * FRAME_W * 4));
    put(n++, f);
  }
  return out;
}
