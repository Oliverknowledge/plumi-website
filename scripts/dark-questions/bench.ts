/** Time the segmentation and the render on a folder of crops (node, this machine): tsx scripts/dark-questions/bench.ts <dir> */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { analyse, renderDark } from "../../src/lib/darkQuestions";

(async () => {
  const dir = process.argv[2];
  const files = fs.readdirSync(dir).filter(f => /\.(webp|png)$/.test(f) && !f.startsWith("sheet"));
  const rows: { name: string; mpx: number; analyse: number; render: number }[] = [];
  for (const f of files) {
    const { data, info } = await sharp(path.join(dir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
    for (let warm = 0; warm < (rows.length < 3 ? 3 : 0); warm++) analyse({ ...px, data: new Uint8ClampedArray(data) });
    const t0 = performance.now(); const a = analyse(px); const t1 = performance.now();
    if (!a.skipped) renderDark(px, a.figures, a.paper);
    const t2 = performance.now();
    rows.push({ name: f, mpx: (info.width * info.height) / 1e6, analyse: t1 - t0, render: t2 - t1 });
  }
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];
  const tot = rows.map(r => r.analyse + r.render);
  console.log(`${rows.length} crops, ${(rows.reduce((s, r) => s + r.mpx, 0) / rows.length).toFixed(2)} Mpx on average`);
  console.log(`analyse + render ms: median ${q(tot, .5).toFixed(1)}, p95 ${q(tot, .95).toFixed(1)}, max ${Math.max(...tot).toFixed(1)}; mean ${(tot.reduce((a, b) => a + b, 0) / tot.length).toFixed(1)}`);
  const per = rows.map(r => (r.analyse + r.render) / r.mpx);
  console.log(`per megapixel: median ${q(per, .5).toFixed(1)} ms, p95 ${q(per, .95).toFixed(1)} ms; render alone mean ${(rows.reduce((s, r) => s + r.render, 0) / rows.length).toFixed(1)} ms`);
})();
