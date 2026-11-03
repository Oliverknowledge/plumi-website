"use client";

import { useEffect, useRef, useState } from "react";
import { BGS, type Bg, type QPrefs } from "@/lib/studyapp/questions/model";
import { qa } from "@/lib/studyapp/questions/store";
import { GridIcon } from "./icons";
import { useMatch } from "./useMatch";

const BG_NAMES: Record<Bg, string> = { plain: "Plain", ruled: "Lined", dotted: "Dots", graph: "Graph" };

/** The page's own settings: the paper behind your writing, who writes (fingers or pen only), the typing face, the keys. */
export function PagePopover({ prefs }: { prefs: QPrefs }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const coarse = useMatch("(pointer: coarse)");
  const fingerScrolls = prefs.fingerScrolls ?? coarse;
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="qs-pop-wrap" ref={box}>
      <button type="button" className="btn qs-pop-btn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)} data-testid="page-settings"><GridIcon /> Page</button>
      {open && (
        <div className="qs-pop card" role="group" aria-label="Page settings">
          <p className="lbl">Paper</p>
          <div className="seg qs-seg" role="group" aria-label="Paper behind your writing">
            {BGS.map((b) => <button key={b} type="button" className={prefs.bg === b ? "on" : ""} aria-pressed={prefs.bg === b} onClick={() => qa.prefs({ bg: b })}>{BG_NAMES[b]}</button>)}
          </div>
          <label className="qs-switch">
            <input type="checkbox" checked={fingerScrolls} onChange={(e) => qa.prefs({ fingerScrolls: e.target.checked })} data-testid="finger-toggle" />
            <span className="track" aria-hidden="true" />
            <span>Finger scrolls, pen writes</span>
          </label>
          <label className="qs-switch">
            <input type="checkbox" checked={!!prefs.hand} onChange={(e) => qa.prefs({ hand: e.target.checked })} />
            <span className="track" aria-hidden="true" />
            <span>Typing in a handwriting font</span>
          </label>
          <p className="lbl">Keys</p>
          <p className="qs-keys"><kbd>N</kbd> next <kbd>B</kbd> back <kbd>P</kbd> pen <kbd>E</kbd> eraser <kbd>Z</kbd> undo <kbd>Shift</kbd><kbd>Z</kbd> redo</p>
        </div>
      )}
    </div>
  );
}
