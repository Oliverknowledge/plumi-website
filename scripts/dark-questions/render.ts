/**
 * Run the segmentation on a folder of crops and write, for each, a side-by-side picture: the original with the found figure
 * boxes outlined in red, and the dark rendering. Usage: tsx scripts/dark-questions/render.ts <in dir> <out dir> [limit]
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { analyse, renderDark } from "../../src/lib/darkQuestions";

const [inDir, outDir, limit] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(inDir).filter(f => /\.(webp|png|jpg)$/.test(f)).sort().slice(0, limit ? +limit : undefined);
(async () => {
  let total = 0;
  for (const f of files) {
    const { data, info } = await sharp(path.join(inDir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
    const t0 = performance.now();
    const a = analyse(px);
    const t1 = performance.now();
    total += t1 - t0;
    const over = new Uint8ClampedArray(data);
    for (const r of a.figures) {
      for (let x = r.x; x < r.x + r.w; x++) for (const y of [r.y, r.y + 1, r.y + r.h - 1, r.y + r.h - 2]) { const i = (y * info.width + x) * 4; over[i] = 255; over[i + 1] = 0; over[i + 2] = 0; }
      for (let y = r.y; y < r.y + r.h; y++) for (const x of [r.x, r.x + 1, r.x + r.w - 1, r.x + r.w - 2]) { const i = (y * info.width + x) * 4; over[i] = 255; over[i + 1] = 0; over[i + 2] = 0; }
    }
    if (!a.skipped) renderDark(px, a.figures, a.paper);
    const W = info.width, H = info.height;
    const out = Buffer.alloc(W * 2 * H * 4, 128);
    for (let y = 0; y < H; y++) {
      Buffer.from(over.buffer, y * W * 4, W * 4).copy(out, y * W * 8);
      Buffer.from(px.data.buffer, y * W * 4, W * 4).copy(out, y * W * 8 + W * 4);
    }
    await sharp(out, { raw: { width: W * 2, height: H, channels: 4 } }).png().toFile(path.join(outDir, f.replace(/\.\w+$/, ".png")));
    console.log(f.padEnd(34), `${(t1 - t0).toFixed(0)}ms`, a.figures.length, "figures", a.skipped ?? "");
  }
  console.log("mean ms", (total / files.length).toFixed(1));
})();
