"use client";

import { drawInk } from "./draw";
import { REF_W } from "./ink";
import { loadInk } from "./inkDb";
import { partImage } from "./cropUrls";

const WIDTH = 1100;

/**
 * A part's printed question with the student's own marks drawn on it, as a PNG data URL, for the page "Save my work" makes. The picture comes from R2 asked with CORS (the canvas would
 * otherwise be tainted and could not be read back); where that is refused, or the picture will not load, this is null and the saved page simply leaves it out.
 */
export async function questionWithMarks(setId: string, partId: string, cv?: number): Promise<string | null> {
  const ink = await loadInk(`${setId}/${partId}:q`);
  if (!ink.length) return null;
  const img = await new Promise<HTMLImageElement | null>((done) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    const t = setTimeout(() => done(null), 10_000);
    i.onload = () => { clearTimeout(t); done(i); };
    i.onerror = () => { clearTimeout(t); done(null); };
    i.src = partImage(partId, "qp", cv);
  });
  if (!img || !img.naturalWidth) return null;
  const k = WIDTH / img.naturalWidth;
  const c = document.createElement("canvas");
  c.width = WIDTH; c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  drawInk(ctx, ink, WIDTH / REF_W);
  try { return c.toDataURL("image/png"); } catch { return null; }
}
