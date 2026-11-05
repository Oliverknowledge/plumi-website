"use client";

import { ruler } from "@/lib/studyapp/questions/rulerStore";

/** The part of the window a picture can be read in: under the feed's sticky strip, above a pen tray that sits at the bottom of a touch screen. */
export function usableBand(): { top: number; bottom: number } {
  const head = document.querySelector<HTMLElement>(".qf-head, .qs-sheet-head");
  const tray = document.querySelector<HTMLElement>("[data-testid=pen-tray]:not(.is-away)");
  const top = Math.max(head && getComputedStyle(head).position !== "static" ? head.getBoundingClientRect().bottom : 0, 0);
  const tr = tray?.getBoundingClientRect();
  const bottom = tr && tr.top > window.innerHeight / 2 ? tr.top : window.innerHeight;
  return { top, bottom: Math.max(bottom, top + 120) };
}


/**
 * The question the student is reading, for the toolbar's Ruler: of the pictures with a marking layer (a feed card's, a set's part), the one with most of itself in the readable band of the
 * window (ties: the one whose middle is nearest the middle of the band). Its part id, or null when no picture is in view.
 */
export function partInView(): string | null {
  const { top, bottom } = usableBand();
  const mid = (top + bottom) / 2;
  let best: { id: string; seen: number; d: number } | null = null;
  for (const host of document.querySelectorAll<HTMLElement>("[data-testid=annot-host]")) {
    const box = host.closest<HTMLElement>(".qs-cropbox");
    const owner = host.closest<HTMLElement>("[data-part]");
    const id = owner?.dataset.part;
    if (!box || !id) continue;
    const r = box.getBoundingClientRect();
    const seen = Math.max(0, Math.min(r.bottom, bottom) - Math.max(r.top, top));
    if (seen <= 0) continue;
    const d = Math.abs((r.top + r.bottom) / 2 - mid);
    if (!best || seen > best.seen + 24 || (Math.abs(seen - best.seen) <= 24 && d < best.d)) best = { id, seen, d };
  }
  return best?.id ?? null;
}

/** The toolbar's Ruler: puts the ruler on the picture being read; again, away; on another picture, moved there (one ruler for the page). */
export function toggleToolbarRuler() {
  const now = ruler.get().partId;
  const target = partInView();
  if (now && (!target || target === now)) { ruler.close(); return; }
  if (target) ruler.open(target);
}
