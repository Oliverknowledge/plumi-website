"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { calculator as copy } from "@/content/calculator";
import { useCalculatorDrag } from "./useCalculatorDrag";

type Status = "loading" | "ready" | "error";

/** The runtime is fetched only on first open. Hiding the panel preserves its RAM. */
export function Calculator() {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [started, setStarted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const { ref: panelRef, handlers: panelHandlers, clamp: clampPanel } = useCalculatorDrag<HTMLDialogElement>(open && !fullscreen);
  const modal = useRef(false);
  const minimise = useCallback(() => {
    setOpen(false);
    setFullscreen(false);
    requestAnimationFrame(() => trigger.current?.focus());
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
    const dialog = panelRef.current;
    if (!dialog) return;
    if (!open) { dialog.close(); return; }
    if (dialog.open && modal.current !== fullscreen) dialog.close();
    if (!dialog.open) {
      if (fullscreen) dialog.showModal(); else dialog.show();
      modal.current = fullscreen;
      closeButton.current?.focus();
    }
    if (!fullscreen) clampPanel();
  }, [open, fullscreen, started, panelRef, clampPanel]);

  useEffect(() => {
    if (!open || !fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open, fullscreen]);

  return (
    <>
      <button ref={trigger} type="button" className="qb-calculator-restore" hidden={open} aria-label={copy.label} title={copy.open} aria-expanded={open} aria-controls={started ? "qb-calculator" : undefined} onClick={() => { setStarted(true); setOpen(true); }}>
        <svg width="16" height="22" viewBox="0 0 16 22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="1" y="1" width="14" height="20" rx="3" /><path d="M4 5h8v4H4zM4 13h2m3 0h3M4 17h2m3 0h3" />
        </svg>
      </button>
      {started && (
        <dialog ref={panelRef} id="qb-calculator" className="qb-calculator" data-fullscreen={fullscreen} aria-label={copy.title} aria-describedby="qb-calculator-hint" onCancel={event => { event.preventDefault(); minimise(); }} onKeyDown={event => {
          if (event.key === "Escape") { event.stopPropagation(); minimise(); }
        }}>
          <button ref={closeButton} type="button" className="qb-calculator-close" aria-label={copy.minimise} title={copy.minimise} onClick={minimise}>−</button>
          <button type="button" className="qb-calculator-drag-handle" aria-label={copy.move} title={copy.dragHint} {...panelHandlers}>
            <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor" aria-hidden="true"><circle cx="3" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="13" cy="2" r="1.5"/><circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="8" r="1.5"/></svg>
          </button>
          <button type="button" className="qb-calculator-fullscreen" aria-label={fullscreen ? copy.exitFullscreen : copy.fullscreen} title={fullscreen ? copy.exitFullscreen : copy.fullscreen} aria-pressed={fullscreen} onClick={() => setFullscreen(value => !value)}>
            {fullscreen ? <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 7h5V2m11 5h-5V2M2 13h5v5m11-5h-5v5"/></svg> : <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M7 2H2v5m11-5h5v5M2 13v5h5m11-5v5h-5"/></svg>}
          </button>
          <div className="qb-calculator-screen">
            {status !== "error" && <iframe key={attempt} ref={frame} title={copy.frameTitle} src={copy.src} className="qb-calculator-frame" />}
            {status !== "ready" && <div className="qb-calculator-status" role="status">
              <p>{status === "error" ? copy.error : copy.loading}</p>
              {status === "error" && <button type="button" className="qb-calculator-retry" onClick={() => { setStatus("loading"); setAttempt(value => value + 1); }}>{copy.retry}</button>}
            </div>}
          </div>
          <p id="qb-calculator-hint" className="sr-only">{copy.hint}</p>
        </dialog>
      )}
    </>
  );
}
