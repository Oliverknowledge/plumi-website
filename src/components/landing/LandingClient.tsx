"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { CafeHandle, CafeStatus } from "./cafeScene";
import { cafe, moods } from "@/content/cosyHome";

/**
 * The cosy homepage's moving parts. Each is a small island so the rest of the page
 * stays server-rendered: the café (the hero, and the friends' window), and Plumi's moods.
 */

const LOOK_KEY = "plumi-cafe-look";
function savedLook(): number | undefined {
  try { const v = window.localStorage.getItem(LOOK_KEY); return v === null ? undefined : Number(v); } catch { return undefined; }
}
function saveLook(look: number) {
  try { window.localStorage.setItem(LOOK_KEY, String(look)); } catch { /* private mode: the look is just not remembered */ }
}

/**
 * The café on a canvas. The box is reserved by CSS (no layout shift); the engine and its art
 * are fetched only once the page has painted, the browser is idle and the box is near the
 * screen. It pauses itself off screen and in a hidden tab, and is a still picture under
 * prefers-reduced-motion.
 */
function useCafe(mode: "hero" | "friends", onStatus?: (s: CafeStatus) => void) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const status = useRef(onStatus);
  const [handle, setHandle] = useState<CafeHandle | null>(null);
  useEffect(() => { status.current = onStatus; });
  useEffect(() => {
    const cv = canvas.current, ov = overlay.current;
    if (!cv || !ov) return;
    let dead = false, mounted: CafeHandle | null = null, timer = 0, idle = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const boot = () => {
      import("./cafeScene")
        .then(m => m.mountCafe(cv, ov, { mode, reduced, look: savedLook(), onStatus: s => status.current?.(s) }))
        .then(h => { if (dead) { h.destroy(); return; } mounted = h; setHandle(h); })
        .catch(() => { /* the art did not load: the window stays a dark pane, nothing breaks */ });
    };
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(boot, { timeout: 1200 });
      else timer = window.setTimeout(boot, 250);
    }, { rootMargin: "300px" });
    io.observe(cv);
    return () => {
      dead = true;
      io.disconnect();
      window.clearTimeout(timer);
      if (idle && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      mounted?.destroy();
    };
  }, [mode]);
  return { canvas, overlay, handle };
}

/** A person from the café's cast, standing, as a CSS sprite of its frame strip. */
export function Look({ look, scale = 2, top = 0, rows = 32 }: { look: number; scale?: number; top?: number; rows?: number }) {
  return (
    <span className="lp-look" aria-hidden="true" style={{
      width: 16 * scale, height: rows * scale,
      backgroundSize: `${1152 * scale}px ${448 * scale}px`,
      backgroundPosition: `-${18 * 16 * scale}px -${(look * 32 + top) * scale}px`,
    }} />
  );
}

/** The hero: the café, your person in it, and a bar with your timer and your look. */
export function CafeHero({ label }: { label: string }) {
  const [st, setSt] = useState<CafeStatus>({ seated: false, seconds: 0, look: 0 });
  const { canvas, overlay, handle } = useCafe("hero", setSt);
  const ready = handle !== null;
  const turn = (by: number) => {
    if (!handle) return;
    const look = (st.look + by + handle.looks) % handle.looks;
    handle.setLook(look);
    saveLook(look);
  };
  const mm = Math.floor(st.seconds / 60), ss = String(st.seconds % 60).padStart(2, "0");
  return (
    <>
      <div className="lp-scene lp-cafe" data-mode="hero" data-ready={ready || undefined}>
        <canvas ref={canvas} role="img" aria-label={label} tabIndex={0} width={416} height={288} />
        <div ref={overlay} className="lp-ov" aria-hidden="true" />
      </div>
      <div className="lp-dialog">
        <div className="lp-row1">
          <b>{st.seated ? `${cafe.studying} · ${mm}:${ss}` : cafe.idle}</b>
          <div className="lp-meter" aria-hidden="true"><i style={{ width: `${st.seated ? (st.seconds % 60) / .6 : 0}%` }} /></div>
        </div>
        <div className="lp-you">
          <span>{cafe.look}</span>
          <button type="button" onClick={() => turn(-1)} disabled={!ready} aria-label={cafe.prev}>‹</button>
          <span className="lp-look-box">{ready && <Look look={st.look} scale={2} top={5} rows={22} />}</span>
          <button type="button" onClick={() => turn(1)} disabled={!ready} aria-label={cafe.next}>›</button>
        </div>
      </div>
    </>
  );
}

/** The friends' window: the café's library wing, four friends in it, tap one to high-five. */
export function FriendsCafe({ label }: { label: string }) {
  const { canvas, overlay, handle } = useCafe("friends");
  return (
    <div className="lp-scene lp-cafe" data-mode="friends" data-ready={handle ? true : undefined}>
      <canvas ref={canvas} role="img" aria-label={label} width={204} height={150} />
      <div ref={overlay} className="lp-ov" aria-hidden="true" />
    </div>
  );
}

/** Plumi and its six moods: a button each, a speech bubble that changes with it. */
export function MeetPlumi() {
  const [mood, setMood] = useState<(typeof moods)[number]["id"]>("happy");
  const current = moods.find(m => m.id === mood) ?? moods[0];
  // Fetch the other five faces once the page is idle, so a tap swaps instantly.
  useEffect(() => {
    const warm = () => moods.forEach(m => { const img = new window.Image(); img.src = `/landing/plumi-mood-${m.id}.svg`; });
    const id = setTimeout(warm, 1500);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="lp-meet-art">
      <div className="lp-speech" aria-live="polite">{current.say}</div>
      <Image className="lp-sprite" src={`/landing/plumi-mood-${current.id}.svg`} alt={`Plumi, a little pixel quill, ${current.label.toLowerCase()}`} width={280} height={280} unoptimized priority={false} />
      <div className="lp-moods" role="group" aria-label="Plumi’s moods">
        {moods.map(m => (
          <button key={m.id} type="button" aria-pressed={m.id === mood} onClick={() => setMood(m.id)}>{m.label}</button>
        ))}
      </div>
    </div>
  );
}
