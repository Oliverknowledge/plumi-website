"use client";

import { decodeStroke, dotOutline, INK_COLOURS, INK_WIDTHS, REF_W, rectsMeet, strokeBounds, strokeOutline, type Ink, type Pt, type Rect, type Stroke } from "./ink";
import type { Bg } from "./model";

/**
 * Drawing ink onto a canvas 2D context (browser only). Strokes are in logical units (ink.ts); `scale` is device
 * pixels per logical unit: (css width / REF_W) * density. Each stored stroke's outline is built once and kept.
 */
const paths = new WeakMap<Stroke, Path2D>();

/** An outline polygon as a Path2D: quadratic curves through the midpoints, the same shape `outlinePath` writes as SVG. */
export function pathFromOutline(o: number[][]): Path2D {
  const p = new Path2D();
  if (o.length < 2) return p;
  p.moveTo(o[0][0], o[0][1]);
  for (let i = 0; i < o.length; i++) {
    const [x0, y0] = o[i];
    const [x1, y1] = o[(i + 1) % o.length];
    p.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  p.closePath();
  return p;
}

function outlineOf(pts: readonly Pt[], width: number, flat: boolean): number[][] {
  const o = strokeOutline(pts, width, flat);
  return o.length < 2 && pts.length ? dotOutline(pts[0], width) : o;
}

function pathOf(s: Stroke): Path2D {
  let p = paths.get(s);
  if (!p) { p = pathFromOutline(outlineOf(decodeStroke(s), INK_WIDTHS[s.w], !!s.sp)); paths.set(s, p); }
  return p;
}

export interface DrawOpts {
  /** Only strokes that can touch this part of the zone (logical units). The caller clips and clears it. */
  rect?: Rect | null;
  /** Strokes (by index) not to draw: the ones the eraser is over. */
  skip?: ReadonlySet<number> | null;
  /** Logical point drawn at the canvas's top left (an exported crop). Default 0, 0. */
  ox?: number;
  oy?: number;
}

export function drawInk(ctx: CanvasRenderingContext2D, ink: Ink, scale: number, o: DrawOpts = {}) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, -(o.ox ?? 0) * scale, -(o.oy ?? 0) * scale);
  for (let i = 0; i < ink.length; i++) {
    const s = ink[i];
    if (o.skip?.has(i)) continue;
    if (o.rect && !rectsMeet(strokeBounds(s), o.rect)) continue;
    ctx.fillStyle = INK_COLOURS[s.c];
    ctx.fill(pathOf(s));
  }
  ctx.restore();
}

/** The stroke being drawn now, from its raw points, through the same outline a stored stroke gets. */
export function drawLive(ctx: CanvasRenderingContext2D, pts: readonly Pt[], colour: number, width: number, flat: boolean, scale: number) {
  if (!pts.length) return;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = INK_COLOURS[colour];
  ctx.fill(pathFromOutline(outlineOf(pts, INK_WIDTHS[width], flat)));
  ctx.restore();
}

/** Faint paper lines for an exported image, matching the zone's own background (CSS draws the on-screen one). */
export function drawPaper(ctx: CanvasRenderingContext2D, bg: Bg, w: number, h: number, scale: number, ox = 0, oy = 0) {
  if (bg === "plain") return;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, -ox * scale, -oy * scale);
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
