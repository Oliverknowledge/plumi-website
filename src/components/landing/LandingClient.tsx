"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { drawAvatar, drawOutfit, mountRoom, type RoomName } from "./pixelRoom";
import { cosyHero, moods } from "@/content/cosyHome";

/**
 * The cosy homepage's moving parts. Each is a small island so the rest of the page
 * stays server-rendered: the two pixel rooms, the hero's progress dialog, Plumi's moods,
 * and the little pixel portraits.
 */

/** A walkable pixel room. The name tags live in the overlay, which React leaves alone. */
export function RoomScene({ room, label }: { room: RoomName; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    return mountRoom(canvas.current, overlay.current, room);
  }, [room]);
  return (
    <div className="lp-scene" data-room={room}>
      <canvas ref={canvas} role="img" aria-label={label} width={room === "home" ? 432 : 384} height={room === "home" ? 264 : 240} />
      <div ref={overlay} className="lp-ov" aria-hidden="true" />
    </div>
  );
}

/** The hero's "Studying projectiles" bar: a meter that fills in steps, and a tip that turns over. */
export function HeroDialog() {
  const [pct, setPct] = useState(40);
  const [tip, setTip] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let p = 40;
    const id = setInterval(() => {
      p = p >= 100 ? 10 : p + 10;
      setPct(p);
      if (p % 30 === 10) setTip(t => (t + 1) % cosyHero.tips.length);
    }, 1600);
    return () => clearInterval(id);
  }, []);
  const [lead, ...rest] = cosyHero.tips[tip];
  return (
    <div className="lp-dialog">
      <div className="lp-row1"><b>{cosyHero.studying}</b><div className="lp-meter" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div></div>
      <div className="lp-tip"><span>{lead}</span> {rest.map((part, i) => i % 2 === 1 ? <sub key={i}>{part}</sub> : part)}</div>
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

/** A friend's pixel portrait, or one of the wardrobe's outfits. */
export function PixelPortrait({ avatar, outfit }: { avatar?: string; outfit?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (avatar) drawAvatar(ref.current, avatar);
    else if (outfit !== undefined) drawOutfit(ref.current, outfit);
  }, [avatar, outfit]);
  return <canvas ref={ref} width={22} height={38} aria-hidden="true" />;
}
