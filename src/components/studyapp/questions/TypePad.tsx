"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { insertAt, SYMBOLS, toSub, toSup } from "@/lib/studyapp/questions/symbols";
import { REF_W } from "@/lib/studyapp/questions/ink";
import { TEXT_PART_CAP, TYPE_REM } from "@/lib/studyapp/questions/model";
import { useQuestionsValue } from "@/lib/studyapp/questions/store";

/** The strip of symbols: drawn once, not on every keystroke (it only depends on the function that inserts). */
const SymbolBar = memo(function SymbolBar({ put }: { put(ch: string, wrap?: (s: string) => string): void }) {
  const keep = (e: { preventDefault(): void }) => e.preventDefault();   // do not take the selection from the box
  return (
    <div className="qs-sym" role="toolbar" aria-label="Symbols">
      {SYMBOLS.map((s) => <button key={s.ch} type="button" onPointerDown={keep} onMouseDown={keep} onClick={() => put(s.ch)} aria-label={s.name} title={s.name}>{s.ch}</button>)}
      <span className="qs-sym-sep" aria-hidden="true" />
      <button type="button" className="wide" onPointerDown={keep} onMouseDown={keep} onClick={() => put("", toSup)} aria-label="Raise the selected text (superscript)" title="Select some text, then tap">x<sup>n</sup></button>
      <button type="button" className="wide" onPointerDown={keep} onMouseDown={keep} onClick={() => put("", toSub)} aria-label="Lower the selected text (subscript)" title="Select some text, then tap">x<sub>n</sub></button>
    </div>
  );
});

/**
 * The typed answer: a textarea (in a handwriting-like face if the student likes), a row of symbols, and
 * superscript and subscript for whatever is selected. Saved shortly after typing stops, and at once on leaving it, on
 * moving to another tab or app, and on closing the page. The size is the student's (Normal or Large, in rem, so a browser's
 * larger-text setting counts too). Text that arrives from another tab is not allowed to replace words not yet sent from here.
 */
export function TypePad({ text, onText, hand, label, full, units }: { text: string; onText(t: string): boolean; hand: boolean; label: string; full: boolean; units: number }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(text);
  const sent = useRef(text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);
  const send = useRef(onText);
  useEffect(() => { send.current = onText; });

  const size = useQuestionsValue((q) => q.prefs.typeSize ?? "normal");

  // The text was changed from outside (a reset, or another tab): take it, unless there are words here not sent yet.
  useEffect(() => {
    if (text === sent.current || latest.current !== sent.current) return;
    sent.current = text; latest.current = text; setValue(text);
  }, [text]);

  const flush = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (latest.current !== sent.current) { sent.current = latest.current; send.current(latest.current); }
  };
  useEffect(() => flush, []);
  // The phone is put down, the tab is left, the page is closed: whatever is typed goes now, not 250 ms from now.
  useEffect(() => {
    const away = () => { if (document.visibilityState !== "visible") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", away);
    return () => { window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", away); };
  }, []);

  const change = (v: string) => {
    latest.current = v; setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 250);
  };
  // Reads the text as it is now (a ref), so the function can stay the same one and the strip of symbols is not drawn again with every key.
  const put = useCallback((ch: string, wrap?: (s: string) => string) => {
    const el = area.current;
    if (!el) return;
    const value = latest.current;
    const s = el.selectionStart, e = el.selectionEnd;
    const chosen = wrap && s !== null && e !== null && e > s ? wrap(value.slice(s, e)) : ch;
    if (wrap && chosen === "") return;
    const r = insertAt(value, s, e, chosen);
    // The box refuses more than the cap; so does the symbol strip (the text shown is the text kept).
    if (r.value.length > TEXT_PART_CAP && r.value.length > value.length) return;
    change(r.value);
    requestAnimationFrame(() => { el.focus({ preventScroll: true }); el.setSelectionRange(r.caret, r.caret); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="qs-type">
      <SymbolBar put={put} />
      <div className="qs-typebox" style={{ aspectRatio: `${REF_W} / ${units}` }}>
        <textarea
          ref={area} className={`qs-text${hand ? " is-hand" : ""}`} value={value} aria-label={label} placeholder="Type your answer here"
          maxLength={TEXT_PART_CAP} onChange={(e) => change(e.target.value)} onBlur={flush} spellCheck
          style={{ fontSize: `${(hand ? 1.5625 : 1) * TYPE_REM[size]}rem` }}
        />
      </div>
      {full && <p className="qs-note" role="status">That is as much as this device can keep. Clear an old set to carry on.</p>}
    </div>
  );
}
