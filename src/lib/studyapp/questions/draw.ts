"use client";

import { INK_COLOURS, REF_W, strokePath, outlinePath, INK_WIDTHS, type Ink, type Pt, type Stroke } from "./ink";
import type { Bg } from "./model";

/**
 * Drawing ink onto a canvas 2D context (browser only). Strokes are in logical units (ink.ts); `scale` is device
 * pixels per logical unit: (css width / REF_W) * devicePixelRatio. Each stored stroke's outline is built once and kept.
 */
const paths = new WeakMap<Stroke, Path2D>();

function pathOf(s: Stroke): Path2D {
  let p = paths.get(s);
  if (!p) { p = new Path2D(strokePath(s)); paths.set(s, p); }
  return p;
}

export function drawInk(ctx: CanvasRenderingContext2D, ink: Ink, scale: number) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  for (const s of ink) { ctx.fillStyle = INK_COLOURS[s.c]; ctx.fill(pathOf(s)); }
  ctx.restore();
}

/** The stroke being drawn now, from its raw points (not yet simplified or stored). */
export function drawLive(ctx: CanvasRenderingContext2D, pts: readonly Pt[], colour: number, width: number, simulate: boolean, scale: number) {
  if (!pts.length) return;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = INK_COLOURS[colour];
  ctx.fill(new Path2D(outlinePath(pts, INK_WIDTHS[width], simulate, false)));
  ctx.restore();
}

/** Faint paper lines for an exported image, matching the zone's own background (CSS draws the on-screen one). */
export function drawPaper(ctx: CanvasRenderingContext2D, bg: Bg, w: number, h: number, scale: number) {
  if (bg === "plain") return;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.strokeStyle = "rgba(60,90,150,.22)";
  ctx.fillStyle = "rgba(60,90,150,.3)";
  ctx.lineWidth = 1 / scale;
  const step = 32;
  if (bg === "ruled") { for (let y = step; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } }
  else if (bg === "graph") {
    for (let y = 0; y < h; y += step / 2) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    for (let x = 0; x < w; x += step / 2) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  } else { for (let y = step; y < h; y += step) for (let x = step; x < w; x += step) ctx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8); }
  ctx.restore();
}

export { REF_W };
