"use client";

import { useEffect, useRef, useState } from "react";
import { lofi, useLofi } from "@/lib/studyapp/music";

/**
 * The record player, bottom right of every page of the app: tap the record for lofi (lib/studyapp/music.ts).
 * It spins and the tonearm swings on while it plays, notes float up from it, and the Spotify card sits beside
 * it. Once it has played, ⏮ / ⏭ and a button to tuck the card away appear beside the record. Until a student
 * has played it once, a little label invites them to.
 */
const NOTES = ["♪", "♫", "♬", "♩"];
const NOTE_COLOURS = ["#2f62c8", "#6fae5a", "#e0605a", "#f2c96b", "#a98be0", "#4fb3ad"];

export function Vinyl() {
  const s = useLofi();
  const host = useRef<HTMLDivElement>(null);
  const notes = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState(false);

  useEffect(() => { if (host.current) lofi().attach(host.current); }, []);

  useEffect(() => {
    if (lofi().state.everPlayed) return;
    const t = setTimeout(() => setTip(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // In the full-screen library on a phone, the seat card runs right along the bottom: the record rises above it.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dock: Element | null = null;
    const sizes = new ResizeObserver(() => lift());
    function lift() {
      const r = dock?.getBoundingClientRect();
      const under = r && r.width > 0 && r.right > window.innerWidth - 100;
      box.current?.style.setProperty("--rp-lift", under ? `${Math.max(0, window.innerHeight - r.top - 4)}px` : "0px");
    }
    function find() {
      const now = document.querySelector(".lb-full .lb-dock");
      if (now === dock) return;
      if (dock) sizes.unobserve(dock);
      dock = now;
      if (dock) sizes.observe(dock);
      lift();
    }
    const pages = new MutationObserver(find);
    pages.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", lift);
    find();
    return () => { pages.disconnect(); sizes.disconnect(); window.removeEventListener("resize", lift); };
  }, []);

  // A note that floats up from the record, sways and fades away.
  useEffect(() => {
    if (!s.playing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      const box = notes.current;
      if (!box || document.hidden) return;
      const n = document.createElement("span");
      n.className = "rp-note";
      n.textContent = NOTES[Math.floor(Math.random() * NOTES.length)];
      n.style.color = NOTE_COLOURS[Math.floor(Math.random() * NOTE_COLOURS.length)];
      n.style.setProperty("--dx", `${(-20 - Math.random() * 55).toFixed(0)}px`);
      n.style.setProperty("--sway", `${(Math.random() * 16 - 8).toFixed(0)}px`);
      n.style.setProperty("--rot", `${(Math.random() * 50 - 25).toFixed(0)}deg`);
      n.style.fontSize = `${(16 + Math.random() * 10).toFixed(0)}px`;
      n.addEventListener("animationend", () => n.remove());
      box.appendChild(n);
    }, 650);
    return () => clearInterval(t);
  }, [s.playing]);

  const what = `“${s.track.title}” by ${s.track.artist}`;
  const label = `${s.playing ? "Pause" : "Play"} ${what} (lofi)`;
  const cardLabel = s.cardHidden ? "Show the player" : "Hide the player";

  return (
    <div ref={box} className={`rp${s.playing ? " is-playing" : ""}${s.begun ? " is-begun" : ""}`} data-testid="record-player">
      <div className={`rp-card${s.cardOpen ? " is-open" : ""}`} aria-live="polite">
        <div className="rp-embed" ref={host} />
        {s.line && <p className="rp-line">{s.line}</p>}
      </div>
      <div className="rp-side" aria-label="Music controls">
        <button type="button" className="rp-btn" aria-label="Previous song" title="Previous song" onClick={() => lofi().skip(-1)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 4 V16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><path d="M16 4.5 L7.5 10 L16 15.5 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" className="rp-btn" aria-label="Next song" title="Next song" onClick={() => lofi().skip(1)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15 4 V16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><path d="M4 4.5 L12.5 10 L4 15.5 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" className={`rp-btn${s.cardHidden ? " is-off" : ""}`} aria-label={cardLabel} title={cardLabel} onClick={() => lofi().toggleCard()}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4" width="14" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M6.5 8.5 H13.5 M6.5 11.5 H11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </div>
      {tip && !s.begun && <span className="rp-tip">tap for lofi ♪</span>}
      <button type="button" className="rp-vinyl" aria-pressed={s.playing} aria-label={label} title={label} onClick={() => { setTip(false); lofi().toggle(); }}>
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <g className="rp-disc">
            <circle cx="36" cy="36" r="33" fill="#1b1922" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="36" cy="36" r="28" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="1.2" />
            <circle cx="36" cy="36" r="23.5" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="1.2" />
            <circle cx="36" cy="36" r="19" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="1.2" />
            <path d="M36 6 A30 30 0 0 1 60 18" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="2" strokeLinecap="round" />
            <circle cx="36" cy="36" r="12.5" fill={s.label} stroke="#22304d" strokeWidth="1.5" />
            <ellipse cx="29.6" cy="38.6" rx="1.9" ry="1.2" fill="#ff7d9c" fillOpacity=".55" />
            <ellipse cx="42.4" cy="38.6" rx="1.9" ry="1.2" fill="#ff7d9c" fillOpacity=".55" />
            <circle cx="32" cy="33.2" r="1.5" fill="#22304d" /><circle cx="40" cy="33.2" r="1.5" fill="#22304d" />
            <path d="M33.2 39.6 Q36 42.4 38.8 39.6" fill="none" stroke="#22304d" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="36" cy="36" r="1.6" fill="#fbfdff" stroke="#22304d" strokeWidth=".8" />
          </g>
          <path d="M15 24 A24 24 0 0 1 27 13" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
        <svg className="rp-arm" viewBox="0 0 30 46" aria-hidden="true">
          <circle cx="23" cy="6" r="4.5" fill="#c9d8ec" stroke="currentColor" strokeWidth="1.6" />
          <path d="M23 6 L21 26 L9 38" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="3.5" y="35.5" width="9" height="6" rx="1.5" transform="rotate(-45 8 38.5)" fill="#f2c96b" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      <div className="rp-notes" ref={notes} aria-hidden="true" />
    </div>
  );
}
