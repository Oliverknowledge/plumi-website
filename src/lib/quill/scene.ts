"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { QuillMood } from "@/components/quill/Quill";

/**
 * A tiny choreographer. A scene is a list of steps; the quill's tip is always
 * either on the ink it is drawing or travelling to the next stroke, so nothing
 * "spawns" — every mark is pulled out of the nib in real time.
 *
 * Strokes are <path data-ink="name"> elements. Their dash offset is walked from
 * full length to zero while the quill reads its position from the same path.
 */
export type Step =
  | { draw: string; dur: number; mood?: QuillMood }
  | { move: [number, number]; dur: number; mood?: QuillMood; lift?: number }
  | { hold: number; mood?: QuillMood }
  | { reveal: string; dur?: number }
  | { cls: string; add: string; at?: "root" }
  | { ink: number; dur: number }
  | { call: () => void }
  | { enter: [number, number]; mood?: QuillMood }
  | { exit: [number, number]; dur: number };

type Resolved = { step: Step; start: number; dur: number; from: [number, number]; to: [number, number]; path?: SVGGeometryElement; len: number; els?: Element[]; fired?: boolean };

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Timeline {
  private items: Resolved[] = [];
  total = 0;
  t = 0;
  private raf = 0;
  private last = 0;
  playing = false;
  private prev: [number, number] | null = null;
  private tilt = 0;
  private quill: SVGGElement | null;
  private startInk = 1;
  constructor(private root: SVGSVGElement, private steps: Step[], private opts: { speed?: number; onEnd?: () => void } = {}) {
    this.quill = root.querySelector<SVGGElement>(".quill");
    this.prepare();
  }
  private prepare() {
    let clock = 0;
    let pos: [number, number] = [0, 0];
    let ink = 1;
    for (const step of this.steps) {
      const r: Resolved = { step, start: clock, dur: 0, from: pos, to: pos, len: 0 };
      if ("draw" in step) {
        const path = this.root.querySelector<SVGGeometryElement>(`[data-ink="${step.draw}"]`);
        if (path) {
          r.path = path; r.len = path.getTotalLength();
          path.style.strokeDasharray = `${r.len + 2}`; path.style.strokeDashoffset = `${r.len + 2}`;
          const a = path.getPointAtLength(0), b = path.getPointAtLength(r.len);
          r.from = [a.x, a.y]; r.to = [b.x, b.y];
        }
        r.dur = step.dur;
      } else if ("move" in step) { r.to = step.move; r.dur = step.dur; }
      else if ("hold" in step) { r.dur = step.hold; }
      else if ("reveal" in step) { r.els = Array.from(this.root.querySelectorAll(`[data-reveal="${step.reveal}"]`)); r.els.forEach(e => ((e as HTMLElement).style.opacity = "0")); r.dur = step.dur ?? 0.35; }
      else if ("ink" in step) { r.dur = step.dur; r.len = ink; ink = step.ink; }
      else if ("enter" in step) { r.to = step.enter; }
      else if ("exit" in step) { r.to = step.exit; r.dur = step.dur; }
      pos = r.to; clock += r.dur; this.items.push(r);
    }
    this.startInk = 1;
    this.total = clock;
    this.render(0);
  }
  private setQuill(x: number, y: number, moving: boolean) {
    if (!this.quill) return;
    if (this.prev && moving) { const vx = x - this.prev[0]; this.tilt += (Math.max(-16, Math.min(16, vx * 1.6)) - this.tilt) * 0.18; } else this.tilt *= 0.85;
    this.prev = [x, y];
    this.quill.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${this.tilt.toFixed(2)})`);
  }
  render(t: number) {
    let mood: QuillMood | undefined; let visible = false; let opacity = 1; let ink = this.startInk; let placed = false;
    for (const r of this.items) {
      const s = r.step; const local = t - r.start; const p = r.dur > 0 ? Math.max(0, Math.min(1, local / r.dur)) : local >= 0 ? 1 : 0;
      if (local < 0) { r.fired = false; if ("draw" in s && r.path) r.path.style.strokeDashoffset = `${r.len + 2}`; if ("reveal" in s) r.els?.forEach(e => ((e as HTMLElement).style.opacity = "0")); if ("cls" in s) this.root.classList.remove(s.add); continue; }
      if ("mood" in s && s.mood) mood = s.mood;
      if ("draw" in s && r.path) { r.path.style.strokeDashoffset = `${(r.len + 2) * (1 - p)}`; if (p < 1) { const pt = r.path.getPointAtLength(r.len * p); this.setQuill(pt.x, pt.y, true); placed = true; } visible = true; }
      else if ("move" in s) { const e = easeIO(p); const lift = s.lift ?? 26; const x = r.from[0] + (r.to[0] - r.from[0]) * e; const y = r.from[1] + (r.to[1] - r.from[1]) * e - Math.sin(Math.PI * e) * lift; if (p < 1) { this.setQuill(x, y, true); placed = true; } visible = true; }
      else if ("enter" in s) { visible = true; if (!placed) this.setQuill(r.to[0], r.to[1], false); }
      else if ("exit" in s) { const e = ease(p); const x = r.from[0] + (r.to[0] - r.from[0]) * e; const y = r.from[1] + (r.to[1] - r.from[1]) * e - Math.sin(Math.PI * e) * 30; if (p < 1) { this.setQuill(x, y, true); placed = true; } opacity = 1 - p; visible = p < 1; }
      else if ("reveal" in s) r.els?.forEach(e => ((e as HTMLElement).style.opacity = `${ease(p)}`));
      else if ("cls" in s) this.root.classList.add(s.add);
      else if ("ink" in s) ink = r.len + (s.ink - r.len) * ease(p);
      else if ("call" in s) { if (!r.fired) { r.fired = true; s.call(); } }
    }
    if (!placed && visible) { const active = this.items.filter(r => t >= r.start).pop(); if (active) this.setQuill(active.to[0], active.to[1], false); }
    if (this.quill) { this.quill.style.opacity = visible ? `${opacity}` : "0"; if (mood) this.quill.dataset.mood = mood; this.quill.style.setProperty("--ink", `${ink}`); }
  }
  private tick = (now: number) => {
    if (!this.playing) return;
    const dt = Math.min(0.05, (now - this.last) / 1000) * (this.opts.speed ?? 1); this.last = now; this.t += dt;
    this.render(this.t);
    if (this.t >= this.total) { this.playing = false; this.opts.onEnd?.(); return; }
    this.raf = requestAnimationFrame(this.tick);
  };
  play() { if (this.playing || this.t >= this.total) return; this.playing = true; this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); }
  pause() { this.playing = false; cancelAnimationFrame(this.raf); }
  restart() { this.pause(); this.t = 0; this.prev = null; this.tilt = 0; this.render(0); this.play(); }
  finish() { this.pause(); this.t = this.total; this.render(this.total); }
  destroy() { this.pause(); }
}

/**
 * Runs a scene when it is on screen and motion is allowed. Returns transport
 * controls. With motion off (or before hydration) nothing is prepared, so the
 * server-rendered SVG is simply the finished drawing.
 */
export function useQuillScene(ref: RefObject<SVGSVGElement | null>, steps: () => Step[], { motion, speed = 1, deps = [] as unknown[] }: { motion: boolean; speed?: number; deps?: unknown[] }) {
  const tl = useRef<Timeline | null>(null);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(false);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    obs.observe(el); return () => obs.disconnect();
  }, [ref]);
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const el = ref.current; if (!el || !motion) return;
    setDone(false);
    const timeline = new Timeline(el, steps(), { speed, onEnd: () => setDone(true) });
    tl.current = timeline;
    return () => { timeline.destroy(); tl.current = null; };
  }, [ref, motion, speed, run, ...deps]);
  /* eslint-enable react-hooks/exhaustive-deps */
  useEffect(() => { const t = tl.current; if (!t) return; if (visible && !paused) t.play(); else t.pause(); }, [visible, paused, run, motion]);
  return { paused, done, togglePause: () => setPaused(v => !v), replay: () => { setPaused(false); setRun(v => v + 1); }, visible };
}
