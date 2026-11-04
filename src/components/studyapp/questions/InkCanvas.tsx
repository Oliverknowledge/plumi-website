"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent, type Ref } from "react";
import { toUnits } from "@/lib/studyapp/questions/annotGeom";
import { drawInk, drawLive } from "@/lib/studyapp/questions/draw";
import {
  encodeStroke, ERASER_RADIUS, inkBottom, inkBytes, INK_WIDTHS, NO_HISTORY, pushHistory, redo as redoH, REF_W, rectUnion, strokeBounds, strokesAt, strokesToAdd, undo as undoH,
  type History, type Ink, type Pt, type Rect, type Stroke,
} from "@/lib/studyapp/questions/ink";
import { loadInk, onInkRemote, onInkReset, peekInk, saveInk, watchOtherTabs } from "@/lib/studyapp/questions/inkDb";
import type { Bg, Tool } from "@/lib/studyapp/questions/model";
import { activateInk, registerInk, reportInk, setPenSeen } from "./inkBus";

/**
 * The handwriting surface of one answer zone: Pointer Events and perfect-freehand on a canvas, strokes kept as
 * vectors in logical units (lib/studyapp/questions/ink.ts), saved to IndexedDB as they are written.
 *
 * Finger and pen (docs/study/questions.md, "Pen and finger"): the surface reads `pointerType`. In "finger scrolls, pen
 * writes" a finger never draws: while no pen has been seen the surface says `touch-action: pan-y pinch-zoom` so the
 * browser scrolls the page natively with momentum; the first time a pen is seen (any pen pointer event on the page, or a
 * touchstart whose `touchType` is `stylus`) it says `touch-action: pinch-zoom` and scrolls the page itself from finger
 * movement, so a pen stroke is never taken for a scroll (and two fingers still zoom the page). A touchstart from a
 * stylus is also cancelled where the browser lets us. While a pen is down, or was a moment ago, a resting palm neither
 * scrolls nor draws. Mouse and, in "finger draws", touch write; a pen pointer-down pre-empts a touch stroke already
 * under way, and a second finger discards it (a pinch). A pen's eraser end (`buttons & 32` or `button === 5`) erases.
 *
 * Drawing: one canvas per zone, mounted only while the zone is near the screen. A frame repaints only the part of the
 * canvas the stroke changed (the strokes it touches are redrawn from their cached paths, then the live line), so a
 * long page of writing costs no more to write on than a short one. The canvas is sized by the pixel density the screen
 * has now (and the page zoom, so a pinch stays sharp), capped so no zone is more than a few million pixels.
 */

export interface InkCanvasHandle { undo(): void; redo(): void; clear(): void; focus(): void; /** Take away the newest stroke (marks on a question: "Undo mark", which also works on strokes from an earlier visit). */ dropLast(): void; /** Take up a stroke whose pen-down arrived before this canvas was mounted (the first stroke after a quick jump is never lost). */ begin(ev: PointerEvent): void }

interface Props {
  inkKey: string;
  label: string;
  /** Height in logical units. */
  units: number;
  bg: Bg;
  tool: Tool;
  colour: number;
  width: number;
  fingerScrolls: boolean;
  penSeen: boolean;
  /** How many strokes the app's document says this answer has (so a missing record is noticed). */
  metaN: number;
  /** The most bytes this answer may hold now: its own cap, or less if the device is nearly full. */
  getCap(): number;
  /** Ink changed: strokes and bytes. */
  onInk(n: number, bytes: number): void;
  /** A stroke was refused: this answer holds as much ink as it may. */
  onFull(): void;
  /** A finger touched the surface while fingers scroll (so a first-time student learns why nothing was drawn). */
  onFingerTap(): void;
  /** The lowest edge of the ink, in logical units (0 if none), so the zone cannot be dragged shorter than it. */
  onBottom(units: number): void;
  /** This surface is the layer of marks drawn ON a printed question picture: it fills the picture it sits over (no height of its own, no bg, no placeholder), is not a control for a keyboard, and stops a pen's tap from opening the picture's zoom. */
  annot?: boolean;
  /** (annot) the mouse draws too: only when the student has switched "Write on the question" on; otherwise it passes through to the picture as before. */
  mouseDraws?: boolean;
  ref?: Ref<InkCanvasHandle>;
}

/** Keep the pointer's events on the surface when it leaves it; refused (harmlessly) for a pointer the browser no longer has. */
function capture(el: Element, id: number) { try { el.setPointerCapture(id); } catch { /* not an active pointer */ } }

/** The clock, outside the component so its handlers stay plainly event handlers. */
const nowMs = () => performance.now();
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** How long after a pen was last seen (touching or hovering) a finger counts as a resting hand. */
const PALM_MS = 250;
/** How many of the newest points a live frame repaints around (the outline changes only at the tail). */
const TAIL = 40;
/** The most device pixels one zone's canvas may have: about 26 MB. */
const MAX_PIXELS = 6_500_000;

/* ── momentum of a finger scroll, by hand (once a pen has been seen) ── */

let inertia = 0;
function stopInertia() { if (inertia) { cancelAnimationFrame(inertia); inertia = 0; } }
function coast(velocity: number) {
  stopInertia();
  if (reducedMotion()) return;
  let v = velocity * 16;
  const step = () => { window.scrollBy({ top: v, behavior: "instant" as ScrollBehavior }); v *= 0.93; inertia = Math.abs(v) > 0.4 ? requestAnimationFrame(step) : 0; };
  inertia = requestAnimationFrame(step);
}

/* ── saving: every stroke is written the moment the pen lifts ──
 * A long answer's last stroke must survive a tab closed a moment later, so there is no waiting: each pen-up writes the answer's ink to the
 * device. Writes of one answer never overlap (one is in flight, and the newest ink waits behind it: what is written last is always the
 * newest), so a fast writer does not pile up work on the main thread. Only the small label in the document (how many strokes an answer
 * has) is written later (store.ts). */

const pending = new Map<string, Ink>();   // kept for the page-hide flush: ink handed over but not yet sent (always empty now between events)
const inflight = new Set<string>();
const queued = new Map<string, Ink>();
function writeNow(key: string, ink: Ink) {
  if (inflight.has(key)) { queued.set(key, ink); return; }
  inflight.add(key);
  void saveInk(key, ink).finally(() => {
    inflight.delete(key);
    const next = queued.get(key);
    if (next) { queued.delete(key); writeNow(key, next); }
  });
}
export function flushInk() {
  for (const [k, ink] of pending) void saveInk(k, ink);
  pending.clear();
  // the browser is about to hide or close the page: whatever waits behind a write in flight goes now, alongside it (the store keeps the newest)
  for (const [k, ink] of queued) void saveInk(k, ink);
  queued.clear();
}
function saveSoon(key: string, ink: Ink) { pending.delete(key); writeNow(key, ink); }
let hooked = false;
function hookPageHide() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  window.addEventListener("pagehide", flushInk);
  document.addEventListener("freeze", flushInk);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushInk(); });
}

/* ── one place that hears the screen change (rotation, resize, pinch zoom, a new pixel density) ── */

const refits = new Set<() => void>();
let hubTimer: ReturnType<typeof setTimeout> | null = null;
let hubbed = false;
function hubRefit() {
  if (hubTimer) clearTimeout(hubTimer);
  hubTimer = setTimeout(() => { hubTimer = null; refits.forEach((f) => f()); }, 140);
}
function hub() {
  if (hubbed || typeof window === "undefined") return;
  hubbed = true;
  window.addEventListener("resize", hubRefit);
  window.addEventListener("orientationchange", hubRefit);
  window.visualViewport?.addEventListener("resize", hubRefit);
  // a different pixel density (dragging the window to another screen, browser zoom)
  const watch = () => { const m = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`); m.addEventListener("change", () => { hubRefit(); watch(); }, { once: true }); };
  watch();
}

interface Live { kind: "pen" | "erase"; id: number; pts: Pt[]; flat: boolean; erased: Set<number>; at: { x: number; y: number } | null; type: string }

export function InkCanvas({ inkKey, label, units, bg, tool, colour, width, fingerScrolls, penSeen, metaN, getCap, onInk, onFull, onFingerTap, onBottom, annot = false, mouseDraws = true, ref }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [empty, setEmpty] = useState(() => !(peekInk(inkKey)?.length));
  const [failed, setFailed] = useState(false);
  const props = useRef({ tool, colour, width, fingerScrolls, penSeen, metaN, getCap, onInk, onFull, onFingerTap, onBottom, label, annot, mouseDraws });
  useEffect(() => { props.current = { tool, colour, width, fingerScrolls, penSeen, metaN, getCap, onInk, onFull, onFingerTap, onBottom, label, annot, mouseDraws }; });

  const st = useRef({
    ink: (peekInk(inkKey) ?? []) as Ink, hist: NO_HISTORY as History, ctx: null as CanvasRenderingContext2D | null,
    live: null as Live | null, adopt: null as number | null, erasing: new Set<number>(), scale: 1, w: 0, h: 0, density: 1, fit: null as null | (() => void), raf: 0, lastPen: 0,
    /** Where to repaint at the next frame (null: nowhere yet); `full` repaints the lot. */
    dirty: null as Rect | null, full: true, liveRect: null as Rect | null,
    scroll: null as null | { id: number; y: number; t: number; v: number; moved: number; t0: number },
  });

  /** Repaint what changed: clear it, redraw the strokes that touch it, then the live line or eraser ring on top. */
  const paint = useCallback(() => {
    const c = canvas.current, s = st.current;
    if (!c || !c.width) return;
    const ctx = s.ctx ?? (s.ctx = c.getContext("2d", { desynchronized: true }));
    if (!ctx) return;
    const all = s.full;
    const rect = all ? null : s.dirty;
    s.full = false; s.dirty = null;
    if (!all && !rect) return;
    const k = s.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    if (rect) {
      const x0 = Math.max(0, Math.floor(rect.x0 * k) - 1), y0 = Math.max(0, Math.floor(rect.y0 * k) - 1);
      const x1 = Math.min(c.width, Math.ceil(rect.x1 * k) + 1), y1 = Math.min(c.height, Math.ceil(rect.y1 * k) + 1);
      if (x1 <= x0 || y1 <= y0) { ctx.restore(); return; }
      ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
      ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
    } else ctx.clearRect(0, 0, c.width, c.height);
    drawInk(ctx, s.ink, k, { rect, skip: s.erasing });
    const l = s.live, p = props.current;
    if (l?.kind === "pen") drawLive(ctx, l.pts, p.colour, p.width, l.flat, k);
    if (l?.kind === "erase" && l.at) {
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.beginPath(); ctx.arc(l.at.x, l.at.y, eraserRadius(l.type), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34,48,77,.07)"; ctx.fill(); ctx.strokeStyle = "rgba(34,48,77,.5)"; ctx.lineWidth = 1.2 / k; ctx.stroke();
    }
    ctx.restore();
  }, []);

  const schedule = useCallback(() => {
    const s = st.current;
    if (s.raf) return;
    s.raf = requestAnimationFrame(() => { s.raf = 0; paint(); });
  }, [paint]);
  const paintNow = useCallback(() => {
    const s = st.current;
    if (s.raf) { cancelAnimationFrame(s.raf); s.raf = 0; }
    paint();
  }, [paint]);
  /** Mark a part of the zone (logical units) to repaint at the next frame. */
  const touch = useCallback((r: Rect | null) => { const s = st.current; if (r) s.dirty = rectUnion(s.dirty, r); }, []);
  const everything = useCallback(() => { st.current.full = true; schedule(); }, [schedule]);

  const report = useCallback(() => {
    const s = st.current;
    if (props.current.annot) return;   // (marks on a question have their own Undo under the picture; the tray's undo, redo and clear are for the answer)
    reportInk({ key: inkKey, canUndo: s.hist.past.length > 0, canRedo: s.hist.future.length > 0, hasInk: s.ink.length > 0, label: props.current.label });
  }, [inkKey]);

  /** Everything that follows a change to the ink, short of saving it. */
  const changed = useCallback((next: Ink) => {
    setEmpty(next.length === 0);
    props.current.onInk(next.length, inkBytes(next));
    props.current.onBottom(inkBottom(next));
    report();
  }, [report]);

  const commit = useCallback((next: Ink, region: Rect | "all" | null) => {
    const s = st.current;
    s.hist = pushHistory(s.hist, s.ink);
    s.ink = next;
    s.erasing.clear();
    if (region === "all") s.full = true; else touch(region);
    schedule();
    saveSoon(inkKey, next);
    changed(next);
  }, [inkKey, schedule, touch, changed]);

  const jump = useCallback((next: Ink) => {
    const s = st.current;
    s.ink = next;
    s.erasing.clear();
    everything();
    saveSoon(inkKey, next);
    changed(next);
  }, [inkKey, everything, changed]);

  useImperativeHandle(ref, () => ({
    undo() { const s = st.current; const r = undoH(s.hist, s.ink); if (r) { s.hist = r.h; jump(r.ink); } },
    redo() { const s = st.current; const r = redoH(s.hist, s.ink); if (r) { s.hist = r.h; jump(r.ink); } },
    clear() { const s = st.current; if (s.ink.length) commit([], "all"); },
    focus() { canvas.current?.focus({ preventScroll: true }); },
    dropLast() { const s = st.current; if (s.ink.length) commit(s.ink.slice(0, -1), "all"); },
    begin(ev) {
      // A pen or mouse put down on the picture before this canvas existed: the stroke is taken up here, from that point on, without relying on pointer capture (a capture asked for
      // by a stand-in event is dropped at once for a mouse, which would end the stroke as a dot): moves and the lift that do not reach the canvas are read from the window.
      const c = canvas.current, h = handlers.current;
      if (!c || !h) return;
      const s = st.current;
      const id = ev.pointerId;
      const shim = (e: PointerEvent, type: string) => ({ pointerType: e.pointerType, pointerId: e.pointerId, button: e.button, buttons: e.buttons, clientX: e.clientX, clientY: e.clientY, width: e.width, height: e.height, pressure: e.pressure, type, currentTarget: c, target: c, nativeEvent: e, preventDefault() {}, stopPropagation() {} }) as unknown as RPointerEvent<HTMLCanvasElement>;
      s.adopt = id;
      h.down(shim(ev, "pointerdown"));
      const move = (e: PointerEvent) => { if (e.pointerId === id && e.target !== c) handlers.current?.move(shim(e, "pointermove")); };
      const done = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        if (e.target !== c) { const fn = e.type === "pointercancel" ? handlers.current?.cancel : handlers.current?.up; fn?.(shim(e, e.type)); }
        window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", done, true); window.removeEventListener("pointercancel", done, true);
        s.adopt = null;
      };
      window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", done, true); window.addEventListener("pointercancel", done, true);
    },
  }), [commit, jump]);

  // Register with the pen tray, load what is on the device, and take in what another tab writes.
  useEffect(() => {
    hookPageHide();
    watchOtherTabs();
    const s = st.current;
    const unreg = registerInk(inkKey, {
      undo() { const r = undoH(s.hist, s.ink); if (r) { s.hist = r.h; jump(r.ink); } },
      redo() { const r = redoH(s.hist, s.ink); if (r) { s.hist = r.h; jump(r.ink); } },
      clear() { if (s.ink.length) commit([], "all"); },
      focus() { canvas.current?.focus({ preventScroll: true }); },
    });
    let live = true;
    const unremote = onInkRemote(inkKey, (added: Stroke[]) => {
      if (!live) return;
      const add = strokesToAdd(s.ink, added);
      if (!add.length) return;
      s.ink = [...s.ink, ...add];
      for (const a of add) touch(strokeBounds(a));
      schedule();
      changed(s.ink);
      // What waits to be written may have been taken before these strokes arrived (a copy of the answer's ink, or another tab's): write the whole now, so the newer
      // snapshot is what the queue holds and what the device ends with (an older one would drop them, as strokes this tab has already seen are not added again).
      saveSoon(inkKey, s.ink);
    });
    // Cleared in another tab: what this canvas shows is from before the clear; it takes what is stored now, and its undo history goes (it would bring the strokes back).
    const unreset = onInkReset(inkKey, (ink: Ink) => {
      if (!live) return;
      s.ink = ink; s.hist = NO_HISTORY; s.erasing.clear();
      everything(); changed(ink);
    });
    void loadInk(inkKey).then((ink) => {
      if (!live) return;
      if (s.ink !== ink && s.ink.length === 0) { s.ink = ink; setEmpty(ink.length === 0); everything(); }
      // The document says one thing and the device another (storage cleared, or never kept): say what is really here.
      if (props.current.metaN !== s.ink.length) props.current.onInk(s.ink.length, inkBytes(s.ink));
      props.current.onBottom(inkBottom(s.ink));
    });
    return () => {
      live = false; unreg(); unremote(); unreset();
      if (pending.has(inkKey)) { const ink = pending.get(inkKey)!; pending.delete(inkKey); void saveInk(inkKey, ink); }
      cancelAnimationFrame(s.raf); s.raf = 0;
    };
  }, [inkKey, jump, commit, changed, everything, schedule, touch]);

  // Size the canvas to the zone, sharp at the pixel density and page zoom there is now; ink re-draws at the new scale.
  useLayoutEffect(() => {
    const el = wrap.current, c = canvas.current;
    if (!el || !c) return;
    hub();
    const s = st.current;
    const fit = () => {
      if (s.live) { hubRefit(); return; }            // not under a pen
      const r = el.getBoundingClientRect();
      const w = Math.max(1, r.width), h = Math.max(1, r.height);
      const density = densityFor(w, h);
      const cw = Math.max(1, Math.round(w * density)), ch = Math.max(1, Math.round(h * density));
      if (cw === c.width && ch === c.height && s.ctx) { s.w = w; s.h = h; return; }
      s.w = w; s.h = h; s.scale = (w / REF_W) * density; s.density = density;
      c.width = cw; c.height = ch;
      s.ctx = null;
      el.style.setProperty("--u", `${(w / REF_W) * 32}px`);
      if (!c.getContext("2d")) { setFailed(true); return; }     // the browser would not give a canvas this size
      setFailed(false);
      s.full = true;
      paintNow();
    };
    s.fit = fit;
    fit();
    let raf = 0;
    const ro = new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; fit(); }); });
    ro.observe(el);
    refits.add(fit);
    return () => { ro.disconnect(); refits.delete(fit); cancelAnimationFrame(raf); c.width = 0; c.height = 0; s.ctx = null; s.fit = null; };
  }, [paintNow, units]);

  // A pen on the page, anywhere: from here on touch scrolling is ours. (Hover events too, where the device sends them.)
  useEffect(() => {
    const seen = (e: PointerEvent) => { if (e.pointerType === "pen") { st.current.lastPen = nowMs(); setPenSeen(true); } };
    const down = () => stopInertia();
    window.addEventListener("pointerover", seen, { capture: true, passive: true });
    window.addEventListener("pointerdown", seen, { capture: true, passive: true });
    window.addEventListener("pointerdown", down, { capture: true, passive: true });
    return () => { window.removeEventListener("pointerover", seen, true); window.removeEventListener("pointerdown", seen, true); window.removeEventListener("pointerdown", down, true); };
  }, []);

  // Safari tells a stylus touch from a finger touch (`touchType`): cancel the stylus's so the page does not scroll under it.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const onTouch = (e: TouchEvent) => {
      const stylus = Array.from(e.changedTouches).some((t) => (t as Touch & { touchType?: string }).touchType === "stylus");
      if (stylus) { setPenSeen(true); if (e.cancelable) e.preventDefault(); }
    };
    c.addEventListener("touchstart", onTouch, { passive: false });
    c.addEventListener("touchmove", onTouch, { passive: false });
    return () => { c.removeEventListener("touchstart", onTouch); c.removeEventListener("touchmove", onTouch); };
  }, []);

  /** A point in logical units, kept inside the zone (a stroke that leaves it runs along its edge, so no ink is stored out of sight). */
  const point = useCallback((e: PointerEvent | RPointerEvent, rect: DOMRect, flat: boolean): Pt => {
    const p = e.pointerType === "pen" ? Math.max(0.04, e.pressure || 0.5) : 0.5;
    return { ...toUnits(e.clientX, e.clientY, rect), p: flat ? 0.5 : p };
  }, []);

  const touchDraws = () => !props.current.fingerScrolls;
  /** A pen is down, or is hovering or was a moment ago: a hand on the glass is a resting hand. */
  const penBusy = () => { const s = st.current; return s.live?.type === "pen" || nowMs() - s.lastPen < PALM_MS; };
  const palm = (e: RPointerEvent) => penBusy() || Math.max(e.width, e.height) > 34;

  /** After a stroke ends low on the screen, bring the writing line up out from under the pen tray. */
  const keepVisible = (clientY: number) => {
    const vh = window.innerHeight;
    if (clientY < vh - 130 || window.scrollY + vh >= document.documentElement.scrollHeight - 8) return;
    window.scrollBy({ top: clientY - vh * 0.5, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  const ringRect = (at: { x: number; y: number } | null, type: string): Rect | null => {
    if (!at) return null;
    const r = eraserRadius(type) + 3;
    return { x0: at.x - r, y0: at.y - r, x1: at.x + r, y1: at.y + r };
  };

  const finish = useCallback((cancelled: boolean) => {
    const s = st.current;
    const l = s.live;
    s.live = null;
    if (!l) return;
    if (l.kind === "erase") {
      touch(ringRect(l.at, l.type));
      if (!cancelled && l.erased.size) commit(s.ink.filter((_, i) => !l.erased.has(i)), null);
      else { for (const i of l.erased) touch(strokeBounds(s.ink[i])); s.erasing.clear(); }
      schedule();
      return;
    }
    const region = s.liveRect;
    s.liveRect = null;
    if (cancelled || !l.pts.length) { touch(region); schedule(); return; }
    const stroke = encodeStroke(l.pts, props.current.colour, props.current.width, l.flat);
    const next = [...s.ink, stroke];
    if (inkBytes(next) > props.current.getCap()) { touch(region); schedule(); props.current.onFull(); return; }
    commit(next, rectUnion(region, strokeBounds(stroke)));
  }, [commit, schedule, touch]);

  const eraseTo = (x: number, y: number) => {
    const s = st.current, l = s.live;
    if (!l) return;
    const from = l.at ?? undefined;
    touch(ringRect(l.at, l.type));
    for (const i of strokesAt(s.ink, x, y, eraserRadius(l.type), from)) {
      if (!l.erased.has(i)) { l.erased.add(i); s.erasing.add(i); touch(strokeBounds(s.ink[i])); }
    }
    l.at = { x, y };
    touch(ringRect(l.at, l.type));
  };

  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    const s = st.current;
    // A mouse over a picture that is not being written on: the picture's own (a click opens its zoom).
    if (props.current.annot && e.pointerType === "mouse" && !props.current.mouseDraws) return;
    stopInertia();
    // The screen's density or the page's zoom changed without telling us (a window moved to another display): sharpen before drawing.
    if (!s.live && Math.abs(densityFor(s.w, s.h) - s.density) > 0.05 * s.density) s.fit?.();
    if (e.pointerType === "pen") { s.lastPen = nowMs(); setPenSeen(true); }
    if (!props.current.annot) activateInk({ key: inkKey, canUndo: s.hist.past.length > 0, canRedo: s.hist.future.length > 0, hasInk: s.ink.length > 0, label: props.current.label });
    if (e.pointerType === "touch") {
      if (!touchDraws()) {
        // Fingers scroll. Natively while `touch-action` lets the browser; by hand once a pen has made it `pinch-zoom`.
        // Not while a pen is writing: a resting palm must not move the page under it.
        if (penBusy()) { s.scroll = null; return; }
        s.scroll = { id: e.pointerId, y: e.clientY, t: nowMs(), v: 0, moved: 0, t0: nowMs() };
        if (props.current.penSeen) capture(e.currentTarget, e.pointerId);
        return;
      }
      if (s.live) { if (s.live.type === "touch") finish(true); return; }   // a second finger: a pinch or a hand, not a line
      if (palm(e)) return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (s.live) { if (e.pointerType === "pen" && s.live.type === "touch") finish(true); else return; }   // the pen wins over a finger already down
    e.preventDefault();
    const el = e.currentTarget;
    if (s.adopt !== e.pointerId) capture(el, e.pointerId);
    const eraserEnd = e.pointerType === "pen" && ((e.buttons & 32) !== 0 || e.button === 5);
    const kind = eraserEnd || props.current.tool === "eraser" ? "erase" : "pen";
    const rect = el.getBoundingClientRect();
    const flat = e.pointerType !== "pen";
    const first = point(e, rect, flat);
    s.live = { kind, id: e.pointerId, pts: kind === "pen" ? [first] : [], flat, erased: new Set(), at: null, type: e.pointerType };
    if (kind === "erase") eraseTo(first.x, first.y);
    else { s.liveRect = tailRect(s.live.pts, props.current.width); touch(s.liveRect); }
    schedule();
  };

  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (e.pointerType === "pen") s.lastPen = nowMs();
    if (s.scroll && e.pointerId === s.scroll.id) {
      if (penBusy()) { s.scroll = null; return; }     // a pen has come down under this hand
      const now = nowMs(), dy = s.scroll.y - e.clientY;
      s.scroll.moved += Math.abs(dy);
      if (props.current.penSeen) {
        window.scrollBy({ top: dy, behavior: "instant" as ScrollBehavior });   // (the page may ask for smooth scrolling, which would trail the finger)
        const dt = Math.max(1, now - s.scroll.t);
        s.scroll.v = 0.8 * s.scroll.v + 0.2 * (dy / dt);
      }
      s.scroll.y = e.clientY; s.scroll.t = now;
      return;
    }
    const l = s.live;
    if (!l || e.pointerId !== l.id) return;
    if (l.type === "touch" && nowMs() - s.lastPen < PALM_MS) { finish(true); return; }    // a pen has arrived over this hand
    const rect = e.currentTarget.getBoundingClientRect();
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e.nativeEvent as PointerEvent]) {
      const p = point(ev, rect, l.flat);
      if (l.kind === "erase") eraseTo(p.x, p.y);
      else {
        const last = l.pts[l.pts.length - 1];
        if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 0.35) l.pts.push(p);
      }
    }
    if (l.kind === "pen") {
      const w = tailRect(l.pts, props.current.width);
      touch(rectUnion(w, s.liveRect));
      s.liveRect = w;
    }
    schedule();
  };

  const onUp = (e: RPointerEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (s.scroll && e.pointerId === s.scroll.id) {
      const sc = s.scroll;
      s.scroll = null;
      if (sc.moved < 8 && nowMs() - sc.t0 < 450) props.current.onFingerTap();
      if (props.current.penSeen && Math.abs(sc.v) > 0.05) coast(sc.v);
      return;
    }
    if (s.live && e.pointerId === s.live.id) {
      if (e.pointerType === "pen") s.lastPen = nowMs();
      const l = s.live;
      const rect = e.currentTarget.getBoundingClientRect();
      if (l.kind === "pen" && e.type === "pointerup") { const p = point(e, rect, l.flat); const last = l.pts[l.pts.length - 1]; if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 0.35) l.pts.push(p); }
      finish(false);
      if (l.kind === "pen") keepVisible(e.clientY);
    }
  };

  const onCancel = (e: RPointerEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (s.scroll && e.pointerId === s.scroll.id) { s.scroll = null; return; }
    // The browser took a pen touch for a scroll or a system gesture: from now on the surface says `touch-action` without pan.
    if (e.pointerType === "pen") setPenSeen(true);
    // What a pen or mouse had written is kept (a system gesture must not eat a line); a finger's is dropped (a pinch, a hand).
    if (s.live && e.pointerId === s.live.id) finish(s.live.type === "touch");
  };

  const handlers = useRef<{ down(e: RPointerEvent<HTMLCanvasElement>): void; move(e: RPointerEvent<HTMLCanvasElement>): void; up(e: RPointerEvent<HTMLCanvasElement>): void; cancel(e: RPointerEvent<HTMLCanvasElement>): void } | null>(null);
  useLayoutEffect(() => { handlers.current = { down: onDown, move: onMove, up: onUp, cancel: onCancel }; });
  // Pinch-zoom is the browser's, always; a pen or a hand-scrolling finger is ours.
  const touchAction = fingerScrolls && !penSeen ? "pan-y pinch-zoom" : "pinch-zoom";
  return (
    <div ref={wrap} className={annot ? `qs-ink qs-annot${mouseDraws ? " is-mouse" : ""}${tool === "eraser" ? " is-eraser" : ""}` : `qs-ink bg-${bg}${tool === "eraser" ? " is-eraser" : ""}`} style={annot ? { touchAction } : { aspectRatio: `${REF_W} / ${units}`, touchAction }} data-testid={annot ? "annot-ink" : "ink"}>
      <canvas
        ref={canvas} className="qs-canvas" {...(annot ? { "aria-hidden": true, tabIndex: -1 } : { role: "img", tabIndex: 0, "aria-label": `${label}. Write with a pen, mouse or finger. To use the keyboard instead, choose Type.` })}
        style={{ touchAction }}
        onClick={annot ? (e) => { const t = (e.nativeEvent as PointerEvent).pointerType; if (t === "pen" || (t === "touch" && !fingerScrolls) || (t === "mouse" && mouseDraws)) e.stopPropagation(); } : undefined}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}
        onLostPointerCapture={(e) => { const l = st.current.live; if (st.current.adopt !== e.pointerId && l?.id === e.pointerId && !(l.type === "mouse" && (e.buttons & 1))) finish(false); /* (a mouse still held down goes on: its moves reach the canvas under it, and the lift ends the stroke) */ }}
        onContextMenu={(e) => e.preventDefault()}
        onFocus={() => { const s = st.current; activateInk({ key: inkKey, canUndo: s.hist.past.length > 0, canRedo: s.hist.future.length > 0, hasInk: s.ink.length > 0, label }); }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
            e.preventDefault();
            const s = st.current;
            const r = e.shiftKey ? redoH(s.hist, s.ink) : undoH(s.hist, s.ink);
            if (r) { s.hist = r.h; jump(r.ink); }
          }
        }}
      />
      {empty && !failed && !annot && <span className="qs-ph" aria-hidden="true">Write your answer here</span>}
      {failed && !annot && <p className="qs-ink-fail" role="status">Handwriting is not available on this screen. Use Type.</p>}
    </div>
  );
}

/** Device pixels per css pixel for a zone this big: the screen's density times the page's pinch zoom, at most 3, and never so many pixels that the zone's canvas passes `MAX_PIXELS`. */
function densityFor(w: number, h: number): number {
  const d = Math.min(3, Math.max(1, (window.devicePixelRatio || 1) * (window.visualViewport?.scale ?? 1)));
  return w * h * d * d > MAX_PIXELS ? Math.max(1, Math.sqrt(MAX_PIXELS / (w * h))) : d;
}

/** The eraser's reach: a fingertip is wider than a pen. */
const eraserRadius = (type: string) => (type === "touch" ? ERASER_RADIUS + 5 : ERASER_RADIUS);

/** Around the newest points of a live stroke, in logical units: all a new frame can change of the line. */
function tailRect(pts: readonly Pt[], width: number): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = Math.max(0, pts.length - TAIL); i < pts.length; i++) { const p = pts[i]; if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  const pad = INK_WIDTHS[width] * 0.8 + 4;
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

