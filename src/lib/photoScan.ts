"use client";

import { useSyncExternalStore, type SyntheticEvent } from "react";

/**
 * Dark mode inverts a question's scan (white ink on the dark sheet), which turns a photograph into its
 * negative (Discord, 1 November 2026). So a crop with a photograph in it is marked `data-photo` and stays
 * paper (dark.css). Shrunk to 300 px wide and cut into 12 px tiles, print leaves almost every tile white,
 * black or a mix of the two; a photograph fills ten or more with mid-tones (a sample of crops: photographs
 * 17 to 714, print, graphs and line diagrams 0 or 1; a grey-shaded chart can pass, and reads fine as paper).
 *
 * Reading a crop's pixels needs the file host's CORS headers, which it sends only to tryplumi.app, so the
 * images ask for them there only; elsewhere (local builds, previews, embeds) nothing is scanned.
 */
const WIDTH = 300;
const TILE = 12;
const MIN_TILES = 10;
const seen = new Map<string, boolean>();

function looksLikePhoto(img: HTMLImageElement) {
  const h = Math.max(1, Math.round((img.naturalHeight * WIDTH) / img.naturalWidth));
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0, WIDTH, h);
  const data = ctx.getImageData(0, 0, WIDTH, h).data;
  let tiles = 0;
  for (let ty = 0; ty + TILE <= h; ty += TILE) {
    for (let tx = 0; tx + TILE <= WIDTH; tx += TILE) {
      let mid = 0;
      for (let y = ty; y < ty + TILE; y++) {
        for (let x = tx; x < tx + TILE; x++) {
          const i = (y * WIDTH + x) * 4;
          const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (v > 30 && v < 225) mid++;
        }
      }
      if (mid > TILE * TILE * 0.75 && ++tiles >= MIN_TILES) return true;
    }
  }
  return false;
}

function markPhoto(img: HTMLImageElement) {
  const src = img.currentSrc || img.src;
  let photo = seen.get(src);
  if (photo === undefined) {
    try { photo = looksLikePhoto(img); } catch { photo = false; } // a crop served without CORS can't be read
    seen.set(src, photo);
  }
  if (photo) img.dataset.photo = "";
}

const noop = () => () => {};
const onOurSite = () => /(^|\.)tryplumi\.app$/.test(window.location.hostname);

/** Props for a question crop's <img>: on tryplumi.app, ask for CORS and mark photographs once loaded. */
export function usePhotoScan() {
  const scan = useSyncExternalStore(noop, onOurSite, () => false);
  return scan ? { crossOrigin: "anonymous" as const, onLoad: (e: SyntheticEvent<HTMLImageElement>) => markPhoto(e.currentTarget) } : {};
}
