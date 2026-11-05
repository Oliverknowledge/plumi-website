"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { calculator as copy } from "@/content/calculator";

type Status = "loading" | "ready" | "error";

/** The runtime is fetched only on first open. Hiding the panel preserves its RAM. */
export function Calculator() {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const minimise = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!started) return;
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.source !== "plumi-calculator") return;
      if (event.data.type === "ready") setStatus("ready");
      if (event.data.type === "error") setStatus("error");
      if (event.data.type === "close") minimise();
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [started, minimise]);

  useEffect(() => {
    if (!started || status !== "loading") return;
    const timeout = window.setTimeout(() => setStatus("error"), 30_000);
    return () => window.clearTimeout(timeout);
  }, [started, status, attempt]);

  useEffect(() => {
    if (open) closeButton.current?.focus();
  }, [open]);

  return (
    <>
      <button ref={trigger} type="button" className="lp-btn qb-calculator-trigger" aria-expanded={open} aria-controls="qb-calculator" aria-hidden={open || undefined} tabIndex={open ? -1 : 0} onClick={() => {
        if (open) { minimise(); return; }
        setStarted(true);
        setOpen(true);
      }}>
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="1" y="1" width="16" height="20" rx="3" /><path d="M4 5h10v4H4zM4 13h2m3 0h2m2 0h1M4 17h2m3 0h2m2 0h1" />
        </svg>
        {copy.label}
      </button>
      {started && (
        <aside id="qb-calculator" className="qb-calculator" hidden={!open} aria-label={copy.title} aria-describedby="qb-calculator-hint" onKeyDown={event => {
          if (event.key === "Escape") { event.stopPropagation(); minimise(); }
        }}>
          <button ref={closeButton} type="button" className="qb-calculator-close" aria-label={copy.minimise} title={copy.minimise} onClick={minimise}>−</button>
          <a className="qb-calculator-info" href={copy.creditsHref} target="_blank" rel="noopener noreferrer" aria-label={copy.credits} title={copy.credits}>i</a>
          <div className="qb-calculator-screen">
            {status !== "error" && <iframe key={attempt} ref={frame} title={copy.frameTitle} src={copy.src} className="qb-calculator-frame" />}
            {status !== "ready" && <div className="qb-calculator-status" role="status">
              <p>{status === "error" ? copy.error : copy.loading}</p>
              {status === "error" && <button type="button" className="lp-btn" onClick={() => { setStatus("loading"); setAttempt(value => value + 1); }}>{copy.retry}</button>}
            </div>}
          </div>
          <p id="qb-calculator-hint" className="sr-only">{copy.hint}</p>
        </aside>
      )}
    </>
  );
}
