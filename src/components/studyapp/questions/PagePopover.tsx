"use client";

import { useEffect, useRef, useState } from "react";
import { BGS, type Bg, type QPrefs } from "@/lib/studyapp/questions/model";
import { qa } from "@/lib/studyapp/questions/store";
import { GridIcon } from "./icons";
import { useMatch } from "./useMatch";

const BG_NAMES: Record<Bg, string> = { plain: "Plain", ruled: "Lined", dotted: "Dots", graph: "Graph" };
const KEYS_HELP = "N next question, B back, P pen, E eraser, Z undo, Shift and Z redo. They work while you are on the writing space or the pen tray, or with Alt held down anywhere.";

/**
 * The page's own settings, in a modal <dialog> opened from the Page button: focus is kept inside it, Escape or a tap
 * outside closes it and focus goes back to the button. On a phone (CSS) it is a sheet at the foot of the screen.
 * Paper, who writes (fingers or pen only), always type, the size of typed answers and the typing face, keyboard shortcuts.
 */
export function PagePopover({ prefs }: { prefs: QPrefs }) {
  const [open, setOpen] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const coarse = useMatch("(pointer: coarse)");
  const fingerScrolls = prefs.fingerScrolls ?? coarse;
  const large = prefs.typeSize === "large";
  useEffect(() => {
    const d = dlg.current;
    if (open && d && !d.open) d.showModal();
  }, [open]);
  const close = () => { const d = dlg.current; if (d?.open) d.close(); else setOpen(false); };
  return (
    <div className="qs-pop-wrap">
      <button type="button" className="btn qs-pop-btn" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)} data-testid="page-settings"><GridIcon /> Page</button>
      {open && (
        <dialog
          ref={dlg} className="qs-popd card" aria-labelledby="qs-popd-title" data-testid="page-popover"
          onClose={() => setOpen(false)}
          onClick={(e) => { if (e.target === dlg.current) close(); }}
        >
          <div className="qs-popd-in">
            <div className="qs-popd-head">
              <h2 id="qs-popd-title">Page</h2>
              <button type="button" className="btn ghost icon qs-popd-x" aria-label="Close" onClick={close}>&times;</button>
            </div>
            <p className="lbl" id="qs-bg-lbl">Paper</p>
            <div className="qs-swatches" role="group" aria-labelledby="qs-bg-lbl">
              {BGS.map((b) => (
                <button key={b} type="button" className={`qs-swatch${prefs.bg === b ? " on" : ""}`} aria-pressed={prefs.bg === b} onClick={() => qa.prefs({ bg: b })} data-testid={`bg-${b}`}>
                  <span className={`qs-sw-paper bg-${b}`} aria-hidden="true" />
                  <span className="qs-sw-name">{BG_NAMES[b]}</span>
                </button>
              ))}
            </div>
            <label className="qs-switch">
              <input type="checkbox" checked={fingerScrolls} onChange={(e) => qa.prefs({ fingerScrolls: e.target.checked })} data-testid="finger-toggle" />
              <span className="track" aria-hidden="true" />
              <span>Finger scrolls, pen writes</span>
            </label>
            <label className="qs-switch">
              <input type="checkbox" checked={!!prefs.alwaysType} onChange={(e) => qa.prefs({ alwaysType: e.target.checked })} data-testid="always-type" />
              <span className="track" aria-hidden="true" />
              <span>Always type</span>
            </label>
            <p className="lbl" id="qs-size-lbl">Typing size</p>
            <div className="seg qs-seg" role="group" aria-labelledby="qs-size-lbl">
              <button type="button" className={large ? "" : "on"} aria-pressed={!large} onClick={() => qa.prefs({ typeSize: "normal" })} data-testid="type-normal">Normal</button>
              <button type="button" className={large ? "on" : ""} aria-pressed={large} onClick={() => qa.prefs({ typeSize: "large" })} data-testid="type-large">Large</button>
            </div>
            <label className="qs-switch">
              <input type="checkbox" checked={prefs.hand !== false} onChange={(e) => qa.prefs({ hand: e.target.checked })} />
              <span className="track" aria-hidden="true" />
              <span>Typing in a handwriting font</span>
            </label>
            <label className="qs-switch" title={KEYS_HELP}>
              <input type="checkbox" checked={prefs.keys !== false} onChange={(e) => qa.prefs({ keys: e.target.checked })} aria-describedby="qs-keys-help" data-testid="keys-toggle" />
              <span className="track" aria-hidden="true" />
              <span>Keyboard shortcuts</span>
            </label>
            <p className="qs-sr" id="qs-keys-help">{KEYS_HELP}</p>
          </div>
        </dialog>
      )}
    </div>
  );
}
