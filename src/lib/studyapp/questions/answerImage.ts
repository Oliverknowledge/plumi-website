"use client";

import { drawInk, drawPaper } from "./draw";
import { inkBounds, REF_W } from "./ink";
import { loadInk } from "./inkDb";
import { keyOf, zoneHeight, type Bg } from "./model";
import { currentQuestions } from "./store";

export interface AnswerImageOptions {
  /** Which set's answer. Default: the set on the desk, else the newest set that has this part. */
  setId?: string;
  /** Output pixels per logical unit. Default 1.5 (a full-width answer is 1200 px wide); lowered if the picture would pass 4000 px. */
  scale?: number;
  /** Faint lines behind the ink (never needed for reading it). Default none. */
  paper?: Bg;
  /** Crop to the ink (plus a margin on every side) rather than the whole answer zone. Default true. */
  crop?: boolean;
}

/** Room left round the ink in a cropped picture, in logical units. */
const MARGIN = 24;
/** Never hand back a picture wider or taller than this many pixels. */
const MAX_SIDE = 4000;

/**
 * A student's handwritten answer to one part as a PNG data URL: dark ink on plain white, ready to send to a vision
 * model for marking. Returns null if nothing is written in ink (a typed answer is `getAnswerText`).
 *
 * The picture is as big as the writing: cropped on all four sides with a small margin (a short answer is a short,
 * narrow picture, not a page that is mostly white), or the whole answer zone with `crop: false`.
 *
 * Built for the AI marking that is not switched on yet (docs/study/questions.md): nothing calls it today except tests.
 * The image is drawn from the stored strokes, so it is clean whatever the screen's size or pixel density.
 */
export async function getAnswerImage(partId: string, o: AnswerImageOptions = {}): Promise<string | null> {
  const q = currentQuestions();
  const set = (o.setId ? q.sets.find((s) => s.id === o.setId) : undefined)
    ?? q.sets.find((s) => s.id === q.open && s.parts.some((p) => p.id === partId))
    ?? q.sets.find((s) => s.parts.some((p) => p.id === partId));
  const part = set?.parts.find((p) => p.id === partId);
  if (!set || !part) return null;
  const ink = await loadInk(keyOf(set.id, partId));
  const bounds = inkBounds(ink);
  if (!bounds) return null;
  const full = zoneHeight(part, q.answers[keyOf(set.id, partId)]);
  const crop = o.crop ?? true;
  // the area to draw, in logical units
  const x0 = crop ? Math.max(0, bounds.x0 - MARGIN) : 0, y0 = crop ? Math.max(0, bounds.y0 - MARGIN) : 0;
  const x1 = crop ? Math.min(REF_W, bounds.x1 + MARGIN) : REF_W, y1 = crop ? Math.max(bounds.y1 + MARGIN, y0 + 40) : Math.max(full, bounds.y1);
  const w = Math.max(40, x1 - x0), h = Math.max(40, y1 - y0);
  const scale = Math.min(o.scale ?? 1.5, MAX_SIDE / w, MAX_SIDE / h);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (o.paper) drawPaper(ctx, o.paper, REF_W, y0 + h, scale, x0, y0);
  drawInk(ctx, ink, scale, { ox: x0, oy: y0 });
  return canvas.toDataURL("image/png");
}

/** The typed answer to one part, or null. */
export function getAnswerText(partId: string, setId?: string): string | null {
  const q = currentQuestions();
  const set = (setId ? q.sets.find((s) => s.id === setId) : undefined) ?? q.sets.find((s) => s.id === q.open && s.parts.some((p) => p.id === partId)) ?? q.sets.find((s) => s.parts.some((p) => p.id === partId));
  const t = set ? q.answers[keyOf(set.id, partId)]?.text : undefined;
  return t && t.trim() ? t : null;
}
