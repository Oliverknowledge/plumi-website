"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, type CSSProperties, type ReactNode, type Ref } from "react";
import { preload } from "react-dom";
import { AppLink } from "@/components/studyapp/AppLink";
import { lampLayers, type TimeOfDay } from "@/lib/studyapp/library/entry";
import { useCoverScale, useParallax, useReducedMotion, useScrollLock, useSky } from "./useFront";

/**
 * The front door of the Grand Library: one scene for every state of Study before the room (signed out, the join card,
 * the Enter screen, the waiting moment), so the whole way in is one place. The room's own art (bg.png, which Enter needs
 * anyway) is seen out of focus from the doorway, lit by the room's own lamps for the student's own hour, with dust in
 * the air; the lettering, the key and the controls sit sharp in front.
 * Everything is `aria-hidden` art and plain buttons and links, so it reads and tabs like a normal page.
 * Styles: src/app/study/(app)/entry.css. Notes: docs/study/library.md, "Entry screen".
 */

/** Motes of dust in the lamplight: the same on every visit (no randomness at render), spread over the width. */
const MOTES = (() => {
  let s = 11;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 30 }, (_, i) => ({
    x: Math.round(r() * 1000) / 10, size: i % 6 === 0 ? 5 : i % 3 === 0 ? 3 : 2, dur: Math.round(18 + r() * 24), delay: -Math.round(r() * 36),
    dx: Math.round((r() - 0.5) * 90), o: Math.round((0.35 + r() * 0.5) * 100) / 100,
  }));
})();

const LAMPS = lampLayers();

export type Stage = "door" | "press" | "go";

export interface SceneProps {
  children: ReactNode;
  /** Back to Desk (top left) is always there; Log out (top right) only for a signed-in student. */
  onLogOut?: (() => void) | null;
  /** The sky at the student's hour, unless the demo asks for one. */
  tod?: TimeOfDay;
  stage?: Stage;
  quick?: boolean;
  /** The transition has finished (the overlay's own fade ended). */
  onFaded?: () => void;
  /** The student reached for the scene while it was leaving: let them straight in. */
  onSkip?: () => void;
  testid?: string;
  label?: string;
  busy?: boolean;
  ref?: Ref<HTMLElement>;
}

export function FrontScene({ children, onLogOut, tod, stage = "door", quick = false, onFaded, onSkip, testid, label = "The Grand Library", busy, ref }: SceneProps) {
  const root = useRef<HTMLElement | null>(null);
  const sky = useSky();
  const reduced = useReducedMotion();
  preload("/library/bg.png", { as: "image" });
  useCoverScale(root);
  useParallax(root, reduced);
  useScrollLock();
  const set = (el: HTMLElement | null) => {
    root.current = el;
    if (typeof ref === "function") ref(el); else if (ref) (ref as { current: HTMLElement | null }).current = el;
  };
  return (
    <main
      ref={set} className={`en${quick ? " is-quick" : ""}`} data-tod={tod ?? sky.tod} data-season={sky.season} data-stage={stage}
      data-testid={testid} aria-label={label} aria-busy={busy || undefined}
      onTransitionEnd={(e) => { if (e.target === e.currentTarget && e.propertyName === "opacity" && stage === "go") onFaded?.(); }}
      onPointerDown={stage !== "door" ? onSkip : undefined}
      onKeyDown={stage !== "door" ? (e) => { if (!e.repeat && (e.key === "Enter" || e.key === " " || e.key === "Escape")) onSkip?.(); } : undefined}
    >
      <div className="en-world" aria-hidden="true">
        <div className="en-cam">
          <div className="en-art" />
          <div className="en-lamps is-steady" style={{ backgroundImage: LAMPS.steady }} />
          <div className="en-lamps is-tables" style={{ backgroundImage: LAMPS.tables }} />
          <div className="en-lamps is-fire" style={{ backgroundImage: LAMPS.fire }} />
        </div>
        <div className="en-tint" />
        <div className="en-beams"><i /><i /><i /></div>
        <div className="en-motes">{MOTES.map((m, i) => (
          <i key={i} style={{ "--x": `${m.x}%`, "--s": `${m.size}px`, "--d": `${m.dur}s`, "--w": `${m.delay}s`, "--dx": `${m.dx}px`, "--o": m.o } as CSSProperties} />
        ))}</div>
        <div className="en-glow" />
        <div className="en-vignette" />
        <div className="en-grain" />
      </div>
      <FrontBar onLogOut={onLogOut} />
      <div className="en-stage">{children}</div>
    </main>
  );
}

function Arrow() {
  return <svg viewBox="0 0 12 10" width="14" height="12" aria-hidden="true" shapeRendering="crispEdges"><path d="M5 0h2v2H5zM3 2h2v2H3zM1 4h2v2H1zM3 6h2v2H3zM5 8h2v2H5zM1 4h10v2H1z" fill="currentColor" /></svg>;
}

/** Back to Desk, top left; Log out, top right (like lofi.town's). Nothing else is on the screen. */
function FrontBar({ onLogOut }: { onLogOut?: (() => void) | null }) {
  return (
    <div className="en-bar">
      <AppLink className="en-pill" href="/study" data-testid="front-desk"><Arrow />Back to Desk</AppLink>
      {onLogOut && <button type="button" className="en-pill" onClick={onLogOut} data-testid="front-logout">Log out</button>}
    </div>
  );
}

/**
 * "The Grand Library" as a logotype: Plumi's pixel face, a cream face over a gold edge over a deep outline, so it reads
 * as one solid, chunky piece. Three copies of the same words are stacked in one grid cell (so they wrap identically at
 * 320px and at 2560px); only the top one is read aloud. Plumi stands on top of it.
 */
function Words() {
  return <><span className="w">Grand</span><span className="sp"> </span><span className="w">Library</span></>;
}

export function Wordmark({ mascot = true, small = false }: { mascot?: boolean; small?: boolean }) {
  return (
    <div className={`en-mark${small ? " is-small" : ""}`}>
      {mascot && (
        <div className="en-plumi" aria-hidden="true">
          <Image src="/study/mascot/plumi-welcoming.svg" alt="" width={160} height={160} unoptimized priority draggable={false} />
          <i className="en-shadow" />
        </div>
      )}
      <h1 className="en-title">
        <span className="en-the">The</span>
        <span className="en-word">
          <span className="en-l en-l-ink" aria-hidden="true"><Words /></span>
          <span className="en-l en-l-gold" aria-hidden="true"><Words /></span>
          <span className="en-l en-l-face"><Words /></span>
        </span>
      </h1>
      <div className="en-spark" aria-hidden="true"><i /><i /><i /><i /></div>
    </div>
  );
}

function KeyFace({ label, glyph }: { label: string; glyph: boolean }) {
  return (
    <>
      <span className="en-key-cap">
        <span className="en-key-label">{label}</span>
        {glyph && <svg className="en-key-glyph" viewBox="0 0 16 12" aria-hidden="true" shapeRendering="crispEdges"><path d="M13 0h3v7H5v2H3V7H1V5h2V3h2v2h8z" fill="currentColor" /><path d="M5 9h2v2H5zM3 7h2v2H3z" fill="currentColor" /></svg>}
      </span>
    </>
  );
}

export interface KeyProps { label: string; glyph?: boolean; small?: boolean; pressed?: boolean; testid?: string }

/** The big pixel key: it stands proud of the page and goes down when pressed (CSS), whether by tap, click, Enter or Space. */
export function Key({ label, glyph = false, small = false, pressed = false, testid, ref, ...rest }: KeyProps & Omit<React.ComponentProps<"button">, "children" | "className">) {
  return (
    <button type="button" ref={ref} className={`en-key${small ? " is-small" : ""}${pressed ? " is-down" : ""}`} data-testid={testid} {...rest}>
      <KeyFace label={label} glyph={glyph} />
    </button>
  );
}

export function KeyLink({ label, href, small = false, testid }: { label: string; href: string; small?: boolean; testid?: string }) {
  return (
    <Link className={`en-key${small ? " is-small" : ""}`} href={href} data-testid={testid}>
      <KeyFace label={label} glyph={false} />
    </Link>
  );
}

/** The card that goes with the lettering: a parchment plaque for the signed-out welcome and the join form. */
export function Plaque({ children, testid, as: Tag = "section", onSubmit }: { children: ReactNode; testid?: string; as?: "section" | "form"; onSubmit?: (e: React.FormEvent) => void }) {
  return <Tag className="en-plaque" data-testid={testid} onSubmit={onSubmit}>{children}</Tag>;
}
