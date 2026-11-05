"use client";

import { useEffect, useRef } from "react";

/** A small sheet over the page: the browser's own modal dialog (focus stays inside, Escape closes it). Render it only while open. */
export function PageSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.open) el.showModal();
    el.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);
  return (
    <dialog ref={ref} className="sh-sheet" aria-labelledby="sh-sheet-title" onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sh-sheet-in">
        <div className="sh-sheet-h">
          <h2 id="sh-sheet-title">{title}</h2>
          <button type="button" className="sh-x" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
