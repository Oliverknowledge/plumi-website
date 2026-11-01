"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useNow } from "@/lib/studyapp/clock";
import { compactFace, settled } from "@/lib/studyapp/timer";
import { useTimer } from "@/lib/studyapp/timerStore";
import { TimerPanel, viewOf } from "./TimerPanel";

/**
 * The timer chip: in the top bar beside the account button, and in the full-screen library's toolbar (the top bar is
 * covered there). Red while idle, green while work runs, teal on a break: the iPad's circle in the app's own colours.
 * It opens the timer's card. The clock in it is plain text (no live region): a screen reader is told when the PHASE
 * changes (TimerEffects), never every second.
 */
export function TimerChip({ where }: { where: "top" | "hud" }) {
  const { doc, ready } = useTimer();
  const now = useNow(1000);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const session = ready && doc.session && now ? settled(doc.session, now) : null;
  const view = ready && now ? viewOf(doc.session, now) : "setup";
  const look = view === "work" ? "run" : view === "break" || view === "over" ? "rest" : view === "paused" ? "idle" : "idle";
  const word = view === "work" ? "work" : view === "break" ? "break" : view === "paused" ? "paused" : "";

  return (
    <div className={`tm tm-${where}`} ref={box}>
      <button
        ref={button} type="button" className={`tm-chipbtn is-${look}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)} data-testid={`timer-chip-${where}`} data-look={look} data-view={view}
      >
        {session && view !== "setup" && view !== "over" ? (
          <>
            <b className="tm-face" data-testid="timer-chip-face">{compactFace(session, now)}</b>
            <span className="tm-word tm-phase-word">{word}</span>
          </>
        ) : view === "over" ? (
          <span className="tm-word tm-ask-word"><span className="tm-long">Back to it?</span><span className="tm-short" aria-hidden="true">Back?</span></span>
        ) : (
          <><i className="tm-dot" aria-hidden="true" /><span className="tm-word">Timer</span></>
        )}
      </button>
      {open && <TimerPanel id={panelId} now={now} onClose={() => { setOpen(false); button.current?.focus(); }} />}
    </div>
  );
}
