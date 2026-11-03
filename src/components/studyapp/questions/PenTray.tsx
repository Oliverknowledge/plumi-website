"use client";

import { INK_COLOURS, INK_COLOUR_NAMES, INK_WIDTH_NAMES, INK_WIDTHS } from "@/lib/studyapp/questions/ink";
import type { QPrefs } from "@/lib/studyapp/questions/model";
import { qa } from "@/lib/studyapp/questions/store";
import { inkAct, useInkCaps } from "./inkBus";
import { EraserIcon, PenIcon, RedoIcon, TrashIcon, UndoIcon } from "./icons";

/**
 * The pen tray: thickness, eraser, colour, undo, redo, clear. It floats at the bottom of the sheet and works on the
 * answer zone the student last touched. Every button is 44 px.
 */
export function PenTray({ prefs }: { prefs: QPrefs }) {
  const caps = useInkCaps();
  const pen = prefs.tool === "pen";
  return (
    <div className="qs-tray" role="toolbar" aria-label="Pen tray" data-testid="pen-tray">
      <span className="qs-tray-ico" aria-hidden="true"><PenIcon /></span>
      <div className="qs-tray-group" role="group" aria-label="Pen thickness">
        {INK_WIDTHS.map((w, i) => (
          <button key={i} type="button" className={`qs-tool${pen && prefs.width === i ? " on" : ""}`} aria-pressed={pen && prefs.width === i} aria-label={`Pen, ${INK_WIDTH_NAMES[i].toLowerCase()}`} title={`Pen, ${INK_WIDTH_NAMES[i].toLowerCase()} (P)`}
            onClick={() => qa.prefs({ tool: "pen", width: i })} data-testid={`pen-${i}`}>
            <i className="nib" style={{ width: 3 + w * 2.6, height: 3 + w * 2.6, background: INK_COLOURS[prefs.colour] }} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button type="button" className={`qs-tool${!pen ? " on" : ""}`} aria-pressed={!pen} aria-label="Eraser" title="Eraser (E)" onClick={() => qa.prefs({ tool: prefs.tool === "eraser" ? "pen" : "eraser" })} data-testid="eraser"><EraserIcon /></button>
      <span className="qs-tray-sep" aria-hidden="true" />
      <div className="qs-tray-group" role="group" aria-label="Ink colour">
        {INK_COLOURS.map((c, i) => (
          <button key={c} type="button" className={`qs-swatch${prefs.colour === i ? " on" : ""}`} aria-pressed={prefs.colour === i} aria-label={`${INK_COLOUR_NAMES[i]} ink`} title={`${INK_COLOUR_NAMES[i]} ink`}
            onClick={() => qa.prefs({ colour: i, tool: "pen" })}><i style={{ background: c }} /></button>
        ))}
      </div>
      <span className="qs-tray-sep" aria-hidden="true" />
      <button type="button" className="qs-tool" onClick={inkAct.undo} disabled={!caps.canUndo} aria-label="Undo" title="Undo (Z)" data-testid="undo"><UndoIcon /></button>
      <button type="button" className="qs-tool" onClick={inkAct.redo} disabled={!caps.canRedo} aria-label="Redo" title="Redo (Shift Z)" data-testid="redo"><RedoIcon /></button>
      <button type="button" className="qs-tool" onClick={inkAct.clear} disabled={!caps.hasInk} aria-label="Clear this answer's ink" title="Clear ink (you can undo it)" data-testid="clear"><TrashIcon /></button>
    </div>
  );
}
