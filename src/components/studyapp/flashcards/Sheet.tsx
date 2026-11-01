"use client";

import { useEffect, useRef } from "react";

/**
 * A sheet over the page: the browser's own modal dialog, so focus stays inside it, Escape closes it, and the page
 * behind cannot be reached or scrolled while it is open. Render it only while open. The first element marked
 * `data-autofocus` gets the cursor.
 */
export function Sheet({ title, hint, onClose, children, wide = false }: { title: string; hint?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.open) el.showModal();
    el.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`fcl-sheet${wide ? " wide" : ""}`}
      aria-labelledby="fcl-sheet-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="fcl-sheet-in">
        <div className="fcl-sheet-h">
          <div>
            <h2 id="fcl-sheet-title">{title}</h2>
            {hint && <p>{hint}</p>}
          </div>
          <button type="button" className="fcl-x" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
