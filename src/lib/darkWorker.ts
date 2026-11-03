/**
 * The dark copy of one crop, made off the page's thread (darkCrops.ts starts this): fetch the picture, find its figures, turn its
 * print over, send back a PNG. Cutting up a crop is a few tens of milliseconds, a hundred or more on a slow tablet, which on the page's
 * own thread would catch in a scroll through a long list.
 */
import { MAX_PIXELS, analyse, renderDark } from "./darkQuestions";

export interface DarkRequest { id: number; url: string }
/**
 * `fetch`: the picture could not be fetched (the host may not allow it); `skip`: leave it paper; `ok`: `blob` is the dark copy;
 * `retry` is never sent by the worker: the page's own answer for a request still waiting when the worker would not run.
 */
export type DarkReply = { id: number; status: "ok"; blob: Blob } | { id: number; status: "fetch" | "skip" | "retry" };

const scope = self as unknown as { onmessage: ((e: MessageEvent<DarkRequest>) => void) | null; postMessage(m: DarkReply): void };

scope.onmessage = async ({ data: { id, url } }) => {
  let bitmap: ImageBitmap;
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(String(res.status));
    bitmap = await createImageBitmap(await res.blob());
  } catch { scope.postMessage({ id, status: "fetch" }); return; }
  try {
    const { width: w, height: h } = bitmap;
    if (!w || !h || w * h > MAX_PIXELS) { scope.postMessage({ id, status: "skip" }); return; }
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) { scope.postMessage({ id, status: "skip" }); return; }
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, w, h);
    const found = analyse(pixels);
    if (found.skipped) { scope.postMessage({ id, status: "skip" }); return; }
    renderDark(pixels, found.figures, found.paper);
    ctx.putImageData(pixels, 0, 0);
    scope.postMessage({ id, status: "ok", blob: await canvas.convertToBlob({ type: "image/png" }) });
  } catch { scope.postMessage({ id, status: "skip" }); }
  finally { bitmap.close(); }
};
