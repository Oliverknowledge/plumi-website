"use client";

import { MAX_PIXELS, analyse, renderDark } from "./darkQuestions";
import type { DarkReply, DarkRequest } from "./darkWorker";

/**
 * The questions in dark (2 November 2026). A crop is a picture of an exam paper, print and figures together. In dark the print
 * should be white on pure black and the figures should stay as printed, so each crop is cut up (darkQuestions.ts) and a dark copy
 * is made in the browser: the crop is fetched, drawn on a canvas, its print turned over, and the result put on the <img> as a blob.
 * The original address is kept on the element, so going back to light puts the very same file back.
 *
 * Reading a crop's pixels needs its file host's CORS headers, which it sends to tryplumi.app only, so this runs on tryplumi.app
 * (and on a page's own origin: local builds serving /papers-local); anywhere else, or if the crop can't be read, the crop stays
 * paper: a clean white card (dark.css), never the whole page turned inside out.
 *
 * The picture is fetched again under its own address (`?dq=1`) and not through the <img>: a browser keeps the copy it got for the
 * plain <img> (no Origin sent, so no CORS headers, kept a year) and would hand it to a CORS request, which fails (1 November). The
 * <img> itself never asks for CORS, so light mode is exactly what it was.
 *
 * `data-dq` on the <img> says where it is: absent (paper), "pending" (being cut up, hidden), "swap" (dark copy loading, hidden),
 * "dark" (shown), "paper" (could not be done), "restore" (the light file coming back, hidden).
 */

type State = { orig: string; blob?: string };
const states = new WeakMap<HTMLImageElement, State>();
const registry = new Set<HTMLImageElement>();
/** Source address -> dark copy (a blob URL), or null when the crop is to stay paper. */
const done = new Map<string, string | null>();
const CACHE = 80;
let started = false;
let failures = 0;
let successes = 0;

const isDark = () => document.documentElement.dataset.theme === "dark";
const onOurSite = () => /(^|\.)tryplumi\.app$/.test(window.location.hostname);

/** Where a dark copy can be fetched from, or null if its pixels can't be read from here. */
function readable(src: string): string | null {
  try {
    const u = new URL(src, window.location.href);
    if (u.origin === window.location.origin) return u.href;
    if (!onOurSite() || (failures >= 3 && successes === 0)) return null;
    u.searchParams.set("dq", "1");
    return u.href;
  } catch { return null; }
}

const idle = (fn: () => void) => {
  if (typeof requestIdleCallback === "function") requestIdleCallback(() => fn(), { timeout: 500 });
  else setTimeout(fn, 16);
};
const later = () => new Promise<void>(resolve => idle(resolve));

let canvas: HTMLCanvasElement | null = null;

/**
 * The worker that makes dark copies: off the page's thread, so a long list scrolls as smoothly as before. Where a browser can't
 * (no Worker or OffscreenCanvas: an older iPad), the same work is done on the page's thread in idle moments instead.
 */
let worker: Worker | null | undefined;
let nextId = 1;
const waiting = new Map<number, (r: DarkReply) => void>();

function theWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || typeof createImageBitmap !== "function") return null;
  try {
    const w = new Worker(new URL("./darkWorker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<DarkReply>) => { waiting.get(e.data.id)?.(e.data); waiting.delete(e.data.id); };
    w.onerror = () => { // it will not run here: this and every crop still waiting go the other way
      worker = null;
      w.terminate();
      waiting.forEach((resolve, id) => resolve({ id, status: "retry" }));
      waiting.clear();
    };
    worker = w;
  } catch { worker = null; }
  return worker;
}

/** The longest one crop may take (fetch, cut up, turn over). Past it the crop stays paper and the next one goes: a stuck one must never hold the queue. */
const TAKES_AT_MOST = 12_000;

/** One crop turned to its dark copy: a blob URL; null if it should stay paper; undefined if it could not be fetched (try again later). */
async function make(src: string): Promise<string | null | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), TAKES_AT_MOST); });
  try { return await Promise.race([makeOne(src), late]); } finally { clearTimeout(timer); }
}

async function makeOne(src: string): Promise<string | null | undefined> {
  const url = readable(src);
  if (!url) return null;
  const w = theWorker();
  if (!w) return makeHere(url);
  const reply = await new Promise<DarkReply>(resolve => {
    const id = nextId++;
    waiting.set(id, resolve);
    w.postMessage({ id, url } satisfies DarkRequest);
    // a worker that has gone quiet (it never answers) is dropped, and what it held goes the other way
    setTimeout(() => {
      if (!waiting.has(id)) return;
      if (worker === w) { worker = undefined; w.terminate(); }
      waiting.forEach((resolveOther, other) => resolveOther({ id: other, status: "retry" }));
      waiting.clear();
    }, TAKES_AT_MOST - 2000);
  });
  if (reply.status === "retry") return makeHere(url);
  if (reply.status === "fetch") { failures++; return undefined; }
  if (reply.status === "ok") { successes++; return URL.createObjectURL(reply.blob); }
  return null;
}

/** The same work on the page's own thread: fetched, drawn, cut up and turned over in idle moments. */
async function makeHere(url: string): Promise<string | null | undefined> {
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    bitmap = typeof createImageBitmap === "function" ? await createImageBitmap(blob) : await decode(blob);
    successes++;
  } catch { failures++; return undefined; }
  const w = bitmap instanceof HTMLImageElement ? bitmap.naturalWidth : bitmap.width;
  const h = bitmap instanceof HTMLImageElement ? bitmap.naturalHeight : bitmap.height;
  if (!w || !h || w * h > MAX_PIXELS) { if ("close" in bitmap) bitmap.close(); return null; }
  await later(); // the picture work below is one go: take it when the page is quiet
  try {
    canvas ??= document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, w, h); // throws if the canvas was tainted
    const found = analyse(pixels);
    if (found.skipped) return null;
    renderDark(pixels, found.figures, found.paper);
    ctx.putImageData(pixels, 0, 0);
    const out = await new Promise<Blob | null>(resolve => canvas!.toBlob(resolve, "image/png"));
    return out ? URL.createObjectURL(out) : null;
  } catch { return null; }
  finally {
    if ("close" in bitmap) bitmap.close();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}

function decode(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const href = URL.createObjectURL(blob);
    img.onload = () => { URL.revokeObjectURL(href); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(href); reject(new Error("decode")); };
    img.src = href;
  });
}

function remember(src: string, blob: string | null) {
  done.set(src, blob);
  if (done.size <= CACHE) return;
  const inUse = new Set<string>();
  registry.forEach(img => { const b = states.get(img)?.blob; if (b) inUse.add(b); });
  for (const [key, value] of done) {
    if (done.size <= CACHE) break;
    if (key === src) continue; // the copy just made is about to be put on its picture: never the one to go
    if (value && inUse.has(value)) continue;
    if (value) URL.revokeObjectURL(value);
    done.delete(key);
  }
}

const queue: HTMLImageElement[] = [];
let running = 0;
const LIMIT = 2;

function pump() {
  while (running < LIMIT && queue.length) {
    const img = queue.shift()!;
    const st = states.get(img);
    if (!st || !registry.has(img) || !isDark() || img.dataset.dq !== "pending") continue;
    const src = st.orig;
    running++;
    (done.has(src) ? Promise.resolve(done.get(src) ?? null) : make(src).then(b => { if (b !== undefined) remember(src, b); return b ?? null; }))
      .catch(() => null)
      .then(blob => { if (registry.has(img) && isDark() && states.get(img)?.orig === src) show(img, blob); })
      .finally(() => { running--; pump(); });
  }
}

/** Put a crop's dark copy on its <img>, or leave it as paper. */
function show(img: HTMLImageElement, blob: string | null) {
  const st = states.get(img)!;
  if (!blob) { img.dataset.dq = "paper"; return; }
  st.blob = blob;
  img.dataset.dq = "swap";
  img.src = blob;
}

/** Bring one <img> in line with the theme. */
function settle(img: HTMLImageElement) {
  const st = states.get(img);
  if (!st) return;
  if (!isDark()) {
    if (st.blob) { // back to the light file, hidden until it is there
      img.dataset.dq = "restore";
      delete st.blob;
      img.src = st.orig;
    } else delete img.dataset.dq;
    return;
  }
  if (st.blob || img.dataset.dq === "pending" || img.dataset.dq === "swap") return;
  if (!img.complete || !img.naturalWidth) return; // its load event will come
  if (!readable(st.orig)) { img.dataset.dq = "paper"; return; }
  if (done.has(st.orig)) { show(img, done.get(st.orig) ?? null); return; }
  img.dataset.dq = "pending";
  // a crop opened full screen is wanted now: ahead of the list behind it
  if (img.closest("dialog")) queue.unshift(img); else queue.push(img);
  pump();
}

function onLoad(e: Event) {
  const img = e.currentTarget as HTMLImageElement;
  const st = states.get(img);
  if (!st) return;
  const now = img.currentSrc || img.src;
  if (st.blob && now === st.blob) { img.dataset.dq = "dark"; return; } // our dark copy arrived
  if (img.dataset.dq === "restore" && now === st.orig) { delete img.dataset.dq; return; } // the light file is back
  // a new picture (the page changed its address): start again with that
  delete st.blob;
  delete img.dataset.dq;
  st.orig = now;
  settle(img);
}

/**
 * A crop is hidden while its dark copy is made, never for good (4 November: on a student's tablet some crops stayed invisible in dark).
 * Whatever goes wrong, a hidden crop is put back as plain paper after this long: a white card, always readable.
 */
const HIDDEN_AT_MOST = 7000;
const hiddenSince = new WeakMap<HTMLImageElement, number>();

/** Give up on a crop's dark copy and show it as printed. */
function rescue(img: HTMLImageElement) {
  const st = states.get(img);
  if (!st) return;
  const q = queue.indexOf(img);
  if (q >= 0) queue.splice(q, 1);
  if (st.blob) {
    done.set(st.orig, null); // this copy did not work: later pictures of it stay paper too
    delete st.blob;
    if ((img.getAttribute("src") || img.src) !== st.orig) { img.dataset.dq = "restore"; img.src = st.orig; hiddenSince.set(img, Date.now()); return; }
  }
  img.dataset.dq = "paper";
  hiddenSince.delete(img);
}

function watch() {
  const now = Date.now();
  registry.forEach(img => {
    const dq = img.dataset.dq;
    if (dq !== "pending" && dq !== "swap" && dq !== "restore") { hiddenSince.delete(img); return; }
    const since = hiddenSince.get(img);
    if (since === undefined) { hiddenSince.set(img, now); return; }
    if (now - since < HIDDEN_AT_MOST) return;
    if (dq === "restore") { img.dataset.dq = "paper"; hiddenSince.delete(img); } else rescue(img);
  });
}

function onError(e: Event) {
  const img = e.currentTarget as HTMLImageElement;
  if (img.dataset.dq === "swap") rescue(img); // the dark copy would not load
}

function start() {
  if (started) return;
  started = true;
  new MutationObserver(() => registry.forEach(settle)).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  setInterval(watch, 1500);
}

/** The <img>'s ref: joins it to the dark treatment for as long as it is on the page. */
function attach(img: HTMLImageElement | null) {
  if (!img) return;
  start();
  registry.add(img);
  states.set(img, { orig: img.currentSrc || img.src });
  img.addEventListener("load", onLoad);
  img.addEventListener("error", onError);
  settle(img);
  return () => {
    img.removeEventListener("load", onLoad);
    img.removeEventListener("error", onError);
    registry.delete(img);
    states.delete(img);
    const i = queue.indexOf(img);
    if (i >= 0) queue.splice(i, 1);
  };
}

const props = { ref: attach };

/** Props for a question crop's <img>: in dark, its print is turned to white on black and its figures are kept as printed. */
export function useDarkCrop() {
  return props;
}
