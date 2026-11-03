"use client";

import { useEffect, useState } from "react";

/** How long a line stays: long enough to be read by someone who looked away for a moment (WCAG 2.2.1), and a tap on it puts it away. */
const TOAST_MS = 7000;

/** One quiet line at the top of the page, for what just happened. */
let say: ((message: string) => void) | null = null;

export function toast(message: string) { say?.(message); }

export function Toaster() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    say = (m) => { setMessage(m); clearTimeout(timer); timer = setTimeout(() => setMessage(null), TOAST_MS); };
    return () => { say = null; clearTimeout(timer); };
  }, []);
  return message ? <div className="toast" role="status" aria-live="polite" onClick={() => setMessage(null)}>{message}</div> : null;
}
