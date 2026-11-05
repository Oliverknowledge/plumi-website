"use client";

import { useEffect, useRef, useState } from "react";
import { INK_COLOURS, INK_COLOUR_NAMES, INK_WIDTH_NAMES, INK_WIDTHS } from "@/lib/studyapp/questions/ink";
import type { QPrefs } from "@/lib/studyapp/questions/model";
import { qa } from "@/lib/studyapp/questions/store";
import { inkAct, useInkCaps, useInkSaving, useInkZoneVisible } from "./inkBus";
import { EraserIcon, PenIcon, RedoIcon, RulerIcon, TrashIcon, UndoIcon } from "./icons";
import { useRulerState } from "@/lib/studyapp/questions/rulerStore";
import { toggleToolbarRuler } from "./rulerBand";

/**
 * The pen tray: one small pill with the pen, the eraser, the pen's look (thickness and colour in one flyout), undo and
 * redo. It floats at the bottom of the sheet, works on the answer zone the student last touched, and is only there while
 * a writing zone is on the screen. Every button is 44 px. If handwriting cannot be kept on this device it says so, once.
 */
export function PenTray({ prefs }: { prefs: QPrefs }) {
  const caps = useInkCaps();
  const here = useInkZoneVisible();
  const saving = useInkSaving();
  const [wanted, setOpen] = useState(false);
  const open = wanted && here;
  const root = useRef<HTMLDivElement>(null);
  const pen = prefs.tool === "pen";
  const rulerOn = useRulerState().partId !== null;
  // Undo or Redo that uses up its history disables its own button, and the focus it had falls to the page: it goes back to the writing space instead.
  const fromHistory = useRef(false);
  useEffect(() => {
    if (!fromHistory.current) return;
    const a = document.activeElement;
    if (!a || a === document.body || (a instanceof HTMLButtonElement && a.disabled)) { fromHistory.current = false; inkAct.focus(); }
  }, [caps.canUndo, caps.canRedo]);
  const history = (fn: () => unknown) => () => { fromHistory.current = true; fn(); setTimeout(() => { fromHistory.current = false; }, 600); };
  const size = (i: number) => 4 + INK_WIDTHS[i] * 2.4;

  // The flyout closes on a press anywhere else, on Escape (focus goes back to its button), and and is shut while the tray is away.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); root.current?.querySelector<HTMLElement>("[data-style]")?.focus(); } };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <>
      {here && !saving && <p className="qs-ink-line" role="status">Not saving handwriting on this device. Keep this tab open, or use Type.</p>}
      <div ref={root} className={`qs-pen${here ? "" : " is-away"}`} role="toolbar" aria-label="Pen tray" data-testid="pen-tray" inert={!here}>
        <button type="button" className="qs-pb" aria-pressed={pen} aria-label="Pen" title="Pen (P)" onClick={() => qa.prefs({ tool: "pen" })} data-testid="pen"><PenIcon /></button>
        <button type="button" className="qs-pb" aria-pressed={!pen} aria-label="Eraser" title="Eraser (E)" onClick={() => qa.prefs({ tool: prefs.tool === "eraser" ? "pen" : "eraser" })} data-testid="eraser"><EraserIcon /></button>
        <button type="button" className="qs-pb qs-pb-style" data-style="" aria-haspopup="true" aria-expanded={open} aria-label={`Pen style: ${INK_WIDTH_NAMES[prefs.width].toLowerCase()}, ${INK_COLOUR_NAMES[prefs.colour].toLowerCase()}`} title="Pen thickness and colour" onClick={() => setOpen(!open)} data-testid="pen-style">
          <i className="qs-nib" style={{ width: size(prefs.width), height: size(prefs.width), background: INK_COLOURS[prefs.colour] }} aria-hidden="true" />
        </button>
        <button type="button" className="qs-pb" aria-pressed={rulerOn} aria-label="Ruler" title="Ruler" onClick={toggleToolbarRuler} data-testid="toolbar-ruler"><RulerIcon /></button>
        <span className="qs-pen-sep" aria-hidden="true" />
        <button type="button" className="qs-pb" onClick={history(inkAct.undo)} disabled={!caps.canUndo} aria-label="Undo in the answer" title="Undo in the answer (Z)" data-testid="undo"><UndoIcon /></button>
        <button type="button" className="qs-pb" onClick={history(inkAct.redo)} disabled={!caps.canRedo} aria-label="Redo in the answer" title="Redo in the answer (Shift Z)" data-testid="redo"><RedoIcon /></button>
        {/* always in the page, shown on demand */}
        {(
          <div className="qs-pen-fly" role="group" aria-label="Pen style" hidden={!open}>
            <div className="qs-fly-row" role="group" aria-label="Pen thickness">
              {INK_WIDTHS.map((_, i) => (
                <button key={i} type="button" className="qs-pb" aria-pressed={pen && prefs.width === i} aria-label={`Pen, ${INK_WIDTH_NAMES[i].toLowerCase()}`} title={INK_WIDTH_NAMES[i]}
                  onClick={() => qa.prefs({ tool: "pen", width: i })} data-testid={`pen-${i}`}>
                  <i className="qs-nib" style={{ width: size(i), height: size(i), background: INK_COLOURS[prefs.colour] }} aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="qs-fly-row" role="group" aria-label="Ink colour">
              {INK_COLOURS.map((c, i) => (
                <button key={c} type="button" className="qs-pb" aria-pressed={prefs.colour === i} aria-label={`${INK_COLOUR_NAMES[i]} ink`} title={`${INK_COLOUR_NAMES[i]} ink`}
                  onClick={() => qa.prefs({ colour: i, tool: "pen" })} data-testid={`colour-${i}`}><i className="qs-dot" style={{ background: c }} aria-hidden="true" /></button>
              ))}
            </div>
            <button type="button" className="qs-fly-clear" onClick={() => { inkAct.clear(); setOpen(false); }} disabled={!caps.hasInk} data-testid="clear" title="Clear ink (you can undo it)"><TrashIcon /> Clear ink</button>
          </div>
        )}
      </div>
    </>
  );
}
