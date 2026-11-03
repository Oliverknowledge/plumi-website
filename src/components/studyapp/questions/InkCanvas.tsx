"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent as RPointerEvent, type Ref } from "react";
import { drawInk, drawLive } from "@/lib/studyapp/questions/draw";
import {
  encodeStroke, ERASER_RADIUS, inkBytes, NO_HISTORY, pushHistory, redo as redoH, REF_W, strokesAt, undo as undoH, type History, type Ink, type Pt,
} from "@/lib/studyapp/questions/ink";
import { loadInk, peekInk, saveInk } from "@/lib/studyapp/questions/inkDb";
import type { Bg, Tool } from "@/lib/studyapp/questions/model";
import { activateInk, registerInk, reportInk, setPenSeen } from "./inkBus";

/**
 * The handwriting surface of one answer zone: Pointer Events and perfect-freehand on a canvas, strokes kept as
 * vectors in logical units (lib/studyapp/questions/ink.ts), saved to IndexedDB after every stroke.
 *
 * Finger and pen (docs/study/questions.md, "Pen and finger"): the surface reads `pointerType`. In "finger scrolls, pen
 * writes" a finger never draws: while no pen has been seen the surface says `touch-action: pan-y` so the browser
 * scrolls the page natively with momentum; the first time a pen is seen (any pen pointer event on the page, or a
 * touchstart whose `touchType` is `stylus`) it says `touch-action: none` and scrolls the page itself from finger
 * movement, so a pen stroke is never taken for a scroll. A touchstart from a stylus is also cancelled where the
 * browser lets us. Mouse and, in "finger draws", touch write; touch has palm rejection (nothing within 0.8 s of a
 * pen, nothing while a pen is down, nothing with a contact patch wider than 34 px). A pen's eraser end (`buttons & 32`
 * or `button === 5`) erases.
 */

export interface InkCanvasHandle { undo(): void; redo(): void; clear(): void; focus(): void }

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
  /** The most bytes this answer may hold now: its own cap, or less if the device is nearly full. */
  cap: number;
  /** Ink changed: strokes and bytes. */
  onInk(n: number, bytes: number): void;
  /** A stroke was refused: this answer holds as much ink as it may. */
  onFull(): void;
  /** A finger touched the surface while fingers scroll (so a first-time student learns why nothing was drawn). */
  onFingerTap(): void;
  ref?: Ref<InkCanvasHandle>;
}

/** Keep the pointer's events on the surface when it leaves it; refused (harmlessly) for a pointer the browser no longer has. */
function capture(el: Element, id: number) { try { el.setPointerCapture(id); } catch { /* not an active pointer */ } }

/** The clock, outside the component so its handlers stay plainly event handlers. */
const nowMs = () => performance.now();

/** Ink waiting to be written, by key, so a page being left can flush it. */
const pending = new Map<string, Ink>();
let timer: ReturnType<typeof setTimeout> | null = null;
export function flushInk() {
  if (timer) { clearTimeout(timer); timer = null; }
  for (const [k, ink] of pending) void saveInk(k, ink);
  pending.clear();
}
function saveSoon(key: string, ink: Ink) {
  pending.set(key, ink);
  if (timer) clearTimeout(timer);
  timer = setTimeout(flushInk, 300);
}
let hooked = false;
function hookPageHide() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  window.addEventListener("pagehide", flushInk);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushInk(); });
}

interface Live { kind: "pen" | "erase"; id: number; pts: Pt[]; sim: boolean; erased: Set<number>; at: { x: number; y: number } | null; type: string }

export function InkCanvas({ inkKey, label, units, bg, tool, colour, width, fingerScrolls, penSeen, cap, onInk, onFull, onFingerTap, ref }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [empty, setEmpty] = useState(() => !(peekInk(inkKey)?.length));
  const props = useRef({ tool, colour, width, fingerScrolls, penSeen, cap, onInk, onFull, onFingerTap, label });
  useEffect(() => { props.current = { tool, colour, width, fingerScrolls, penSeen, cap, onInk, onFull, onFingerTap, label }; });

  const st = useRef({
    ink: (peekInk(inkKey) ?? []) as Ink, hist: NO_HISTORY as History, base: null as HTMLCanvasElement | null,
    live: null as Live | null, erasing: new Set<number>(), scale: 1, w: 0, h: 0, raf: 0, lastPen: 0,
    scroll: null as null | { id: number; y: number; t: number; v: number; moved: number; t0: number },
  });

  const paint = useCallback(() => {
    const c = canvas.current, s = st.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (s.base) ctx.drawImage(s.base, 0, 0);
    const l = s.live, p = props.current;
    if (l?.kind === "pen") drawLive(ctx, l.pts, p.colour, p.width, l.sim, s.scale);
    if (l?.kind === "erase" && l.at) {
      ctx.save(); ctx.setTransform(s.scale, 0, 0, s.scale, 0, 0);
      ctx.beginPath(); ctx.arc(l.at.x, l.at.y, ERASER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34,48,77,.07)"; ctx.fill(); ctx.strokeStyle = "rgba(34,48,77,.5)"; ctx.lineWidth = 1.2 / (s.scale / (window.devicePixelRatio || 1) || 1); ctx.stroke();
      ctx.restore();
    }
  }, []);

  const renderBase = useCallback(() => {
    const c = canvas.current, s = st.current;
    if (!c || !c.width) return;
    const base = (s.base ??= document.createElement("canvas"));
    if (base.width !== c.width || base.height !== c.height) { base.width = c.width; base.height = c.height; }
    const bctx = base.getContext("2d");
    if (!bctx) return;
    bctx.clearRect(0, 0, base.width, base.height);
    drawInk(bctx, s.erasing.size ? s.ink.filter((_, i) => !s.erasing.has(i)) : s.ink, s.scale);
    paint();
  }, [paint]);

  const schedule = useCallback(() => {
    const s = st.current;
    if (s.raf) return;
    s.raf = requestAnimationFrame(() => { s.raf = 0; paint(); });
  }, [paint]);

  const report = useCallback(() => {
    const s = st.current;
    reportInk({ key: inkKey, canUndo: s.hist.past.length > 0, canRedo: s.hist.future.length > 0, hasInk: s.ink.length > 0, label: props.current.label });
  }, [inkKey]);

  const commit = useCallback((next: Ink) => {
    const s = st.current;
    s.hist = pushHistory(s.hist, s.ink);
    s.ink = next;
    s.erasing.clear();
    renderBase();
    setEmpty(next.length === 0);
    saveSoon(inkKey, next);
    props.current.onInk(next.length, inkBytes(next));
    report();
  }, [inkKey, renderBase, report]);

  const jump = useCallback((next: Ink) => {
    const s = st.current;
    s.ink = next;
    s.erasing.clear();
    renderBase();
    setEmpty(next.length === 0);
    saveSoon(inkKey, next);
    props.current.onInk(next.length, inkBytes(next));
    report();
  }, [inkKey, renderBase, report]);

  useImperativeHandle(ref, () => ({
    undo() { const s = st.current; const r = undoH(s.hist, s.ink); if (r) { s.hist = r.h; jump(r.ink); } },
    redo() { const s = st.current; const r = redoH(s.hist, s.ink); if (r) { s.hist = r.h; jump(r.ink); } },
    clear() { const s = st.current; if (s.ink.length) commit([]); },
    focus() { canvas.current?.focus({ preventScroll: true }); },
  }), [commit, jump]);

  // Register with the pen tray, and load what is on the device.
  useEffect(() => {
    hookPageHide();
    const s = st.current;
    const unreg = registerInk(inkKey, {
      undo() { const r = undoH(s.hist, s.ink); if (r) { s.hist = r.h; jump(r.ink); } },
      redo() { const r = redoH(s.hist, s.ink); if (r) { s.hist = r.h; jump(r.ink); } },
      clear() { if (s.ink.length) commit([]); },
      focus() { canvas.current?.focus({ preventScroll: true }); },
    });
    let live = true;
    void loadInk(inkKey).then((ink) => {
      if (!live) return;
      if (s.ink !== ink && s.ink.length === 0) { s.ink = ink; setEmpty(ink.length === 0); renderBase(); }
    });
    return () => { live = false; unreg(); if (pending.has(inkKey)) { const ink = pending.get(inkKey)!; pending.delete(inkKey); void saveInk(inkKey, ink); } cancelAnimationFrame(s.raf); s.raf = 0; };
  }, [inkKey, jump, commit, renderBase]);

  // Size the canvas to the zone, sharp at any pixel density; ink re-renders at the new scale.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => {
      const c = canvas.current;
      if (!c) return;
      const r = el.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const w = Math.max(1, r.width), h = Math.max(1, r.height);
      const s = st.current;
      s.w = w; s.h = h; s.scale = (w / REF_W) * dpr;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      el.style.setProperty("--u", `${(w / REF_W) * 32}px`);
      renderBase();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [renderBase, units]);

  // A pen on the page, anywhere: from here on touch scrolling is ours. (Hover events too, where the device sends them.)
  useEffect(() => {
    const seen = (e: PointerEvent) => { if (e.pointerType === "pen") { st.current.lastPen = nowMs(); setPenSeen(true); } };
    window.addEventListener("pointerover", seen, { capture: true, passive: true });
    window.addEventListener("pointerdown", seen, { capture: true, passive: true });
    return () => { window.removeEventListener("pointerover", seen, true); window.removeEventListener("pointerdown", seen, true); };
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

  const point = useCallback((e: PointerEvent | RPointerEvent, rect: DOMRect, sim: boolean): Pt => {
    const k = REF_W / rect.width;
    const p = e.pointerType === "pen" ? Math.max(0.04, e.pressure || 0.5) : 0.5;
    return { x: (e.clientX - rect.left) * k, y: (e.clientY - rect.top) * k, p: sim ? 0.5 : p };
  }, []);

  const touchDraws = () => !props.current.fingerScrolls;
  const palm = (e: RPointerEvent) => {
    const s = st.current;
    return !!s.live?.type.startsWith("pen") || nowMs() - s.lastPen < 800 || Math.max(e.width, e.height) > 34;
  };

  const finish = useCallback((cancelled: boolean) => {
    const s = st.current;
    const l = s.live;
    s.live = null;
    if (!l) return;
    if (l.kind === "erase") {
      if (!cancelled && l.erased.size) commit(s.ink.filter((_, i) => !l.erased.has(i)));
      else { s.erasing.clear(); renderBase(); }
      return;
    }
    if (cancelled || !l.pts.length) { paint(); return; }
    const real = l.type === "pen" && l.pts.some((p) => Math.abs(p.p - l.pts[0].p) > 0.02);
    const stroke = encodeStroke(l.pts, props.current.colour, props.current.width, !real);
    const next = [...s.ink, stroke];
    if (inkBytes(next) > props.current.cap) { paint(); renderBase(); props.current.onFull(); return; }
    commit(next);
  }, [commit, paint, renderBase]);

  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (e.pointerType === "pen") { s.lastPen = nowMs(); setPenSeen(true); }
    activateInk({ key: inkKey, canUndo: s.hist.past.length > 0, canRedo: s.hist.future.length > 0, hasInk: s.ink.length > 0, label: props.current.label });
    if (e.pointerType === "touch") {
      if (!touchDraws()) {
        // Fingers scroll. Natively while `touch-action` lets the browser; by hand once a pen has made it `none`.
        s.scroll = { id: e.pointerId, y: e.clientY, t: nowMs(), v: 0, moved: 0, t0: nowMs() };
        if (props.current.penSeen) capture(e.currentTarget, e.pointerId);
        return;
      }
      if (palm(e)) return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (s.live) return;
    e.preventDefault();
    const el = e.currentTarget;
    capture(el, e.pointerId);
    const eraserEnd = e.pointerType === "pen" && ((e.buttons & 32) !== 0 || e.button === 5);
    const kind = eraserEnd || props.current.tool === "eraser" ? "erase" : "pen";
    const rect = el.getBoundingClientRect();
    const sim = e.pointerType !== "pen";
    const first = point(e, rect, sim);
    s.live = { kind, id: e.pointerId, pts: kind === "pen" ? [first] : [], sim, erased: new Set(), at: { x: first.x, y: first.y }, type: e.pointerType };
    if (kind === "erase") eraseAt(first.x, first.y);
    schedule();
  };

  const eraseAt = (x: number, y: number) => {
    const s = st.current, l = s.live;
    if (!l) return;
    let changed = false;
    for (const i of strokesAt(s.ink, x, y)) if (!l.erased.has(i)) { l.erased.add(i); changed = true; }
    if (changed) { s.erasing = new Set(l.erased); renderBase(); }
  };

  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (e.pointerType === "pen") s.lastPen = nowMs();
    if (s.scroll && e.pointerId === s.scroll.id) {
      const now = nowMs(), dy = s.scroll.y - e.clientY;
      s.scroll.moved += Math.abs(dy);
      if (props.current.penSeen) {
        window.scrollBy(0, dy);
        const dt = Math.max(1, now - s.scroll.t);
        s.scroll.v = 0.8 * s.scroll.v + 0.2 * (dy / dt);
      }
      s.scroll.y = e.clientY; s.scroll.t = now;
      return;
    }
    const l = s.live;
    if (!l || e.pointerId !== l.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e.nativeEvent as PointerEvent]) {
      const p = point(ev, rect, l.sim);
      l.at = { x: p.x, y: p.y };
      if (l.kind === "erase") eraseAt(p.x, p.y);
      else {
        const last = l.pts[l.pts.length - 1];
        if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 0.35) l.pts.push(p);
      }
    }
    schedule();
  };

  const onUp = (e: RPointerEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (s.scroll && e.pointerId === s.scroll.id) {
      const sc = s.scroll;
      s.scroll = null;
      if (sc.moved < 8 && nowMs() - sc.t0 < 450) props.current.onFingerTap();
      if (props.current.penSeen && Math.abs(sc.v) > 0.05) {
        let v = sc.v * 16;
        const step = () => { window.scrollBy(0, v); v *= 0.93; if (Math.abs(v) > 0.4 && !st.current.scroll) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }
      return;
    }
    if (s.live && e.pointerId === s.live.id) {
      if (e.pointerType === "pen") s.lastPen = nowMs();
      const l = s.live;
      const rect = e.currentTarget.getBoundingClientRect();
      if (l.kind === "pen" && e.type === "pointerup") { const p = point(e, rect, l.sim); const last = l.pts[l.pts.length - 1]; if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 0.35) l.pts.push(p); }
      finish(false);
    }
  };

  const onCancel = (e: RPointerEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (s.scroll && e.pointerId === s.scroll.id) { s.scroll = null; return; }
    // The browser took a pen touch for a scroll: from now on the surface says `touch-action: none`.
    if (e.pointerType === "pen") setPenSeen(true);
    if (s.live && e.pointerId === s.live.id) finish(true);
  };

  const touchAction = fingerScrolls ? (penSeen ? "none" : "pan-y pinch-zoom") : "none";
  return (
    <div ref={wrap} className={`qs-ink bg-${bg}${tool === "eraser" ? " is-eraser" : ""}`} style={{ aspectRatio: `${REF_W} / ${units}`, touchAction }} data-testid="ink">
      <canvas
        ref={canvas} className="qs-canvas" role="img" tabIndex={0} aria-label={`${label}. Write with a pen, mouse or finger. To use the keyboard instead, choose Type.`}
        style={{ touchAction }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}
        onLostPointerCapture={(e) => { if (st.current.live?.id === e.pointerId) finish(false); }}
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
      {empty && <span className="qs-ph" aria-hidden="true">Write your answer here</span>}
    </div>
  );
}
