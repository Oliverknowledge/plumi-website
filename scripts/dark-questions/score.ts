/**
 * Score the segmentation against the synthetic corpus's known figure boxes.
 *   tsx scripts/dark-questions/score.ts <corpus dir> [--json]
 * Two error rates, over the marks (dark pixels) on the paper:
 *   figure ink inverted: a mark inside a figure box that the segmentation did not keep as printed   (bad)
 *   print left paper:    a mark outside every figure box that the segmentation kept as printed       (a light patch on a dark page)
 * and the IoU of the kept area against the figure boxes (padded, since a margin is wanted).
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { analyse } from "../../src/lib/darkQuestions";

const dir = process.argv[2];
type Box = [number, number, number, number];
const files = fs.readdirSync(dir).filter(f => f.endsWith(".png") && fs.existsSync(path.join(dir, f.replace(".png", ".json")))).sort();
(async () => {
  const rows: Record<string, number | string>[] = [];
  let figInk = 0, figBad = 0, txtInk = 0, txtBad = 0;
  for (const f of files) {
    const gt = JSON.parse(fs.readFileSync(path.join(dir, f.replace(".png", ".json")), "utf8")) as { figures: Box[]; keep: Box[] };
    const boxes = [...gt.figures, ...gt.keep];
    const { data, info } = await sharp(path.join(dir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    const a = analyse({ data: new Uint8ClampedArray(data), width: W, height: H });
    const det = new Uint8Array(W * H), tru = new Uint8Array(W * H), truPad = new Uint8Array(W * H);
    for (const r of a.figures) for (let y = r.y; y < r.y + r.h; y++) det.fill(1, y * W + r.x, y * W + r.x + r.w);
    for (const [x0, y0, x1, y1] of boxes) {
      for (let y = y0; y < y1; y++) tru.fill(1, y * W + x0, y * W + x1);
      for (let y = Math.max(0, y0 - 16); y < Math.min(H, y1 + 16); y++) truPad.fill(1, y * W + Math.max(0, x0 - 16), y * W + Math.min(W, x1 + 16));
    }
    let fi = 0, fb = 0, ti = 0, tb = 0, inter = 0, uni = 0;
    for (let p = 0; p < W * H; p++) {
      const i = p * 4;
      const g = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      const ch = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
      const mark = g < 200 || ch > 40;
      if (tru[p]) { if (mark) { fi++; if (!det[p]) fb++; } }
      else if (!truPad[p]) { if (mark) { ti++; if (det[p]) tb++; } }
      if (truPad[p] || det[p]) { uni++; if (truPad[p] && det[p]) inter++; }
    }
    figInk += fi; figBad += fb; txtInk += ti; txtBad += tb;
    rows.push({ crop: f, figures: boxes.length, found: a.figures.length, "figure ink inverted %": fi ? +(100 * fb / fi).toFixed(2) : 0, "print left paper %": ti ? +(100 * tb / ti).toFixed(2) : 0, IoU: uni ? +(inter / uni).toFixed(3) : 1 });
  }
  console.table(rows);
  const iou = rows.reduce((s, r) => s + (r.IoU as number), 0) / rows.length;
  console.log(`crops ${rows.length}; figure ink wrongly inverted ${(100 * figBad / Math.max(1, figInk)).toFixed(3)}% (${figBad} of ${figInk} px); print wrongly left paper ${(100 * txtBad / Math.max(1, txtInk)).toFixed(3)}% (${txtBad} of ${txtInk} px); mean IoU ${iou.toFixed(3)}`);
  const worst = rows.filter(r => (r["figure ink inverted %"] as number) > 0);
  console.log("crops with any figure ink inverted:", worst.length ? worst.map(r => `${r.crop} ${r["figure ink inverted %"]}%`).join(", ") : "none");
})();
