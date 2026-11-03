"use client";

import { useEffect, useRef, useState } from "react";
import { insertAt, SYMBOLS, toSub, toSup } from "@/lib/studyapp/questions/symbols";
import { REF_W } from "@/lib/studyapp/questions/ink";
import { TEXT_PART_CAP } from "@/lib/studyapp/questions/model";

/**
 * The typed answer: a textarea (in a handwriting-like face if the student likes), a row of symbols, and
 * superscript and subscript for whatever is selected. Saved shortly after typing stops, and at once on leaving it.
 */
export function TypePad({ text, onText, hand, label, full, units }: { text: string; onText(t: string): boolean; hand: boolean; label: string; full: boolean; units: number }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(text);
  const sent = useRef(text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);
  const send = useRef(onText);
  useEffect(() => { send.current = onText; });

  // The text was changed from outside (a reset): take it.
  useEffect(() => { if (text !== sent.current) { sent.current = text; latest.current = text; setValue(text); } }, [text]);

  const flush = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (latest.current !== sent.current) { sent.current = latest.current; send.current(latest.current); }
  };
  useEffect(() => flush, []);

  const change = (v: string) => {
    latest.current = v; setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 250);
  };
  const put = (ch: string, wrap?: (s: string) => string) => {
    const el = area.current;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const chosen = wrap && s !== null && e !== null && e > s ? wrap(value.slice(s, e)) : ch;
    if (wrap && chosen === "") return;
    const r = insertAt(value, s, e, chosen);
    change(r.value);
    requestAnimationFrame(() => { el.focus({ preventScroll: true }); el.setSelectionRange(r.caret, r.caret); });
  };
  const keep = (e: { preventDefault(): void }) => e.preventDefault();   // do not take the selection from the box
  return (
    <div className="qs-type">
      <div className="qs-sym" role="toolbar" aria-label="Symbols">
        {SYMBOLS.map((s) => <button key={s.ch} type="button" onPointerDown={keep} onMouseDown={keep} onClick={() => put(s.ch)} aria-label={s.name} title={s.name}>{s.ch}</button>)}
        <span className="qs-sym-sep" aria-hidden="true" />
        <button type="button" className="wide" onPointerDown={keep} onMouseDown={keep} onClick={() => put("", toSup)} aria-label="Raise the selected text (superscript)" title="Select some text, then tap">x<sup>n</sup></button>
        <button type="button" className="wide" onPointerDown={keep} onMouseDown={keep} onClick={() => put("", toSub)} aria-label="Lower the selected text (subscript)" title="Select some text, then tap">x<sub>n</sub></button>
      </div>
      <div className="qs-typebox" style={{ aspectRatio: `${REF_W} / ${units}` }}>
        <textarea
          ref={area} className={`qs-text${hand ? " is-hand" : ""}`} value={value} aria-label={label} placeholder="Type your answer here"
          maxLength={TEXT_PART_CAP} onChange={(e) => change(e.target.value)} onBlur={flush} spellCheck
        />
      </div>
      {full && <p className="qs-note" role="status">That is as much as this device can keep. Clear an old set to carry on.</p>}
    </div>
  );
}
