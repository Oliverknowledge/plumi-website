"use client";

import { useEffect, useState } from "react";

/** One quiet line at the top of the page, for what just happened. */
let say: ((message: string) => void) | null = null;

export function toast(message: string) { say?.(message); }

export function Toaster() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    say = (m) => { setMessage(m); clearTimeout(timer); timer = setTimeout(() => setMessage(null), 2600); };
    return () => { say = null; clearTimeout(timer); };
  }, []);
  return message ? <div className="toast" role="status" aria-live="polite">{message}</div> : null;
}
