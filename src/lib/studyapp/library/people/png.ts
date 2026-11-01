/**
 * A small PNG reader for the people's layers (public/library/people-layers.bin): indexed colour at 1, 2, 4 or 8 bits
 * with a tRNS chunk (what the app's tools/cafe-hall/people.py writes), and 8-bit RGBA (people.png, for the test).
 * Not the browser's own decoder, on purpose: a canvas keeps pixels premultiplied, which would nudge the soft shadow
 * pixels (alpha 92) the layers are composed from, and the person would not be the iPad's person to the last value.
 * Pure: the only browser thing is `DecompressionStream`, which Node has too.
 */

export interface Bitmap { width: number; height: number; rgba: Uint8Array }

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Decodes a non-interlaced PNG; throws on anything else (the caller treats a throw as "the art is not there"). */
export async function decodePng(bytes: Uint8Array): Promise<Bitmap> {
  if (bytes.length < 33 || SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error("png: signature");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0, depth = 0, colour = -1, interlace = 0;
  let palette: Uint8Array | null = null, trns: Uint8Array | null = null;
  const parts: Uint8Array[] = [];
  let p = 8;
  while (p + 12 <= bytes.length) {
    const n = dv.getUint32(p), type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    if (p + 12 + n > bytes.length) throw new Error("png: truncated");
    const body = bytes.subarray(p + 8, p + 8 + n);
    if (type === "IHDR") { width = dv.getUint32(p + 8); height = dv.getUint32(p + 12); depth = bytes[p + 16]; colour = bytes[p + 17]; interlace = bytes[p + 20]; }
    else if (type === "PLTE") palette = body;
    else if (type === "tRNS") trns = body;
    else if (type === "IDAT") parts.push(body);
    else if (type === "IEND") break;
    p += 12 + n;
  }
  if (!width || !height || width * height > 4_000_000 || interlace !== 0) throw new Error("png: unsupported");
  const indexed = colour === 3 && (depth === 1 || depth === 2 || depth === 4 || depth === 8);
  const rgba8 = colour === 6 && depth === 8;
  if (!indexed && !rgba8) throw new Error("png: unsupported");
  if (indexed && !palette) throw new Error("png: no palette");
  const joined = new Uint8Array(parts.reduce((s, x) => s + x.length, 0));
  let o = 0;
  for (const x of parts) { joined.set(x, o); o += x.length; }
  const raw = await inflate(joined);
  const bpp = rgba8 ? 4 : 1;                                   // bytes per pixel for the filters (at least 1)
  const stride = rgba8 ? width * 4 : Math.ceil((width * depth) / 8);
  if (raw.length < (stride + 1) * height) throw new Error("png: short");
  const lines = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? lines[dst + x - bpp] : 0;
      const b = y > 0 ? lines[dst - stride + x] : 0;
      const c = x >= bpp && y > 0 ? lines[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      switch (f) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: {
          const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error("png: filter");
      }
      lines[dst + x] = v & 255;
    }
  }
  if (rgba8) return { width, height, rgba: lines };
  const rgba = new Uint8Array(width * height * 4);
  const mask = (1 << depth) - 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bit = x * depth;
      const idx = (lines[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & mask;
      const i = (y * width + x) * 4;
      if (idx * 3 + 2 >= palette!.length) continue;
      rgba[i] = palette![idx * 3]; rgba[i + 1] = palette![idx * 3 + 1]; rgba[i + 2] = palette![idx * 3 + 2];
      rgba[i + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  }
  return { width, height, rgba };
}
