"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/studyapp/toast";
import { useNow } from "@/lib/studyapp/clock";
import { compactFace, settled } from "@/lib/studyapp/timer";
import { timer, useTimer, type Notice } from "@/lib/studyapp/timerStore";
import { armChime, chime } from "./sound";

/** What the toast, the screen reader and the notification say when the clock moves the session on. No em dashes. */
export function noticeLine(n: Notice): { toast: string; say: string } {
  const mins = Math.round(n.session.breakLength / 60_000);
  if (n.kind === "break") return { toast: `Break time. ${mins} min`, say: `Break. ${mins} minutes.` };
  if (n.kind === "break_over") return { toast: "Break's over. Back to it?", say: "Break is over. Back to it?" };
  return { toast: "Session done", say: "Session done." };
}

/**
 * Everything the timer does that is not on the page it is on, mounted once in the app's layout so it works on every
 * page including the full-screen library:
 *   - the tab's title carries the live clock while a session runs (put back afterwards), so a hidden tab shows it;
 *   - a phase change the clock makes is noticed: a short toast, a soft chime (only once the student has touched the
 *     page), a system notification (only if the student asked for it, and only when the tab is hidden), and ONE polite
 *     sentence for screen readers. The clock itself is never announced every second.
 */
export function TimerEffects() {
  const { doc } = useTimer();
  const now = useNow(1000);
  const [said, setSaid] = useState("");
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => armChime(), []);

  useEffect(() => timer.onNotice((n) => {
    const line = noticeLine(n);
    toast(line.toast);
    setSaid(line.say);
    if (clear.current) clearTimeout(clear.current);
    clear.current = setTimeout(() => setSaid(""), 6000);            // so the same sentence next round is heard again
    const d = timer.snapshot().doc;
    if (d.chime) chime();
    try {
      if (d.notify && document.visibilityState === "hidden" && typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Plumi", { body: line.toast, tag: "plumi-timer", silent: true });
      }
    } catch { /* some browsers only allow notifications from a service worker; fine without */ }
  }), []);
  useEffect(() => () => { if (clear.current) clearTimeout(clear.current); }, []);

  // The tab's title. `base` is the page's own title; if the page changes it (a navigation), the new one becomes the base.
  const base = useRef<string | null>(null);
  const last = useRef<string | null>(null);
  const text = now ? titleFor(doc.session, now) : null;
  useEffect(() => {
    if (text === null) {
      if (last.current !== null && base.current !== null && document.title === last.current) document.title = base.current;
      last.current = null; base.current = null;
      return;
    }
    if (last.current === null || document.title !== last.current) base.current = document.title;
    const next = `${text} · ${base.current}`;
    document.title = next;
    last.current = next;
  }, [text]);
  useEffect(() => () => {
    if (last.current !== null && base.current !== null && document.title === last.current) document.title = base.current;
  }, []);

  return <p className="tm-sr" role="status" aria-live="polite" aria-atomic="true">{said}</p>;
}

function titleFor(session: Parameters<typeof settled>[0] | null, now: number): string | null {
  if (!session) return null;
  const s = settled(session, now);
  if (s.isOver) return null;
  if (s.phase === "break_over") return "Back to it?";
  const face = compactFace(s, now);
  if (s.clock.runningSince === null) return `Paused ${face}`;
  return s.phase === "break" ? `${face} Break` : `${face} Focus`;
}
