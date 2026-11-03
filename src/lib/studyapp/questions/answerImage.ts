"use client";

import { currentQuestions } from "../store";
import { drawInk, drawPaper } from "./draw";
import { inkBottom, REF_W } from "./ink";
import { loadInk } from "./inkDb";
import { keyOf, zoneHeight, type Bg } from "./model";

export interface AnswerImageOptions {
  /** Which set's answer. Default: the set on the desk, else the newest set that has this part. */
  setId?: string;
  /** Output pixels per logical unit. Default 1.5, so the image is 1200 px wide. */
  scale?: number;
  /** Faint lines behind the ink (never needed for reading it). Default none. */
  paper?: Bg;
  /** Crop to the ink (plus a margin) rather than the whole answer zone. Default true. */
  crop?: boolean;
}

/**
 * A student's handwritten answer to one part as a PNG data URL: dark ink on plain white, ready to send to a vision
 * model for marking. Returns null if nothing is written in ink (a typed answer is `getAnswerText`).
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
  if (!ink.length) return null;
  const scale = o.scale ?? 1.5;
  const full = zoneHeight(part, q.answers[keyOf(set.id, partId)]);
  const bottom = (o.crop ?? true) ? Math.min(full, inkBottom(ink) + 24) : full;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(REF_W * scale);
  canvas.height = Math.max(1, Math.round(Math.max(60, bottom) * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (o.paper) drawPaper(ctx, o.paper, REF_W, canvas.height / scale, scale);
  drawInk(ctx, ink, scale);
  return canvas.toDataURL("image/png");
}

/** The typed answer to one part, or null. */
export function getAnswerText(partId: string, setId?: string): string | null {
  const q = currentQuestions();
  const set = (setId ? q.sets.find((s) => s.id === setId) : undefined) ?? q.sets.find((s) => s.id === q.open && s.parts.some((p) => p.id === partId)) ?? q.sets.find((s) => s.parts.some((p) => p.id === partId));
  const t = set ? q.answers[keyOf(set.id, partId)]?.text : undefined;
  return t && t.trim() ? t : null;
}
