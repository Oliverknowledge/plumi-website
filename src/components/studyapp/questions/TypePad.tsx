"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { insertAt, symbolsFor, toSub, toSup, type SymbolKit } from "@/lib/studyapp/questions/symbols";
import { REF_W } from "@/lib/studyapp/questions/ink";
import { TEXT_PART_CAP, TYPE_REM } from "@/lib/studyapp/questions/model";
import { useQuestionsValue } from "@/lib/studyapp/questions/store";
import { isFractionShortcut } from "@/lib/studyapp/questions/fraction";
import { FractionBox, FractionIcon } from "./FractionBox";

/** The strip of symbols: drawn once, not on every keystroke (it only depends on the function that inserts). */
const SymbolBar = memo(function SymbolBar({ put, kit, onFraction, fractionOpen }: { put(ch: string, wrap?: (s: string) => string): void; kit: SymbolKit; onFraction(e: React.MouseEvent<HTMLButtonElement>): void; fractionOpen: boolean }) {
  const keep = (e: { preventDefault(): void }) => e.preventDefault();   // do not take the selection from the box
  if (!kit.keys.length) return null;
  return (
    <div className="qs-sym" role="toolbar" aria-label={kit.script ? "Symbols" : "Letters and punctuation"}>
      {kit.fraction && (
        <button type="button" className="qs-sym-frac" onPointerDown={keep} onMouseDown={keep} onClick={onFraction} aria-haspopup="dialog" aria-expanded={fractionOpen} aria-label="Fraction, opens a box for the top and bottom" title="Fraction (Ctrl and /)" data-testid="fraction-key">
          <FractionIcon /><span>Fraction</span>
        </button>
      )}
      {kit.keys.map((s) => <button key={s.ch} type="button" onPointerDown={keep} onMouseDown={keep} onClick={() => put(s.ch)} aria-label={s.name} title={s.name}>{s.ch}</button>)}
      {kit.script && <><span className="qs-sym-sep" aria-hidden="true" />
      <button type="button" className="wide" onPointerDown={keep} onMouseDown={keep} onClick={() => put("", toSup)} aria-label="Raise the selected text (superscript)" title="Select some text, then tap">x<sup>n</sup></button>
      <button type="button" className="wide" onPointerDown={keep} onMouseDown={keep} onClick={() => put("", toSub)} aria-label="Lower the selected text (subscript)" title="Select some text, then tap">x<sub>n</sub></button></>}
    </div>
  );
});

/**
 * The typed answer: a textarea (in a handwriting-like face if the student likes), a row of symbols, and
 * superscript and subscript for whatever is selected. Saved shortly after typing stops, and at once on leaving it, on
 * moving to another tab or app, and on closing the page. The size is the student's (Normal or Large, in rem, so a browser's
 * larger-text setting counts too). Text that arrives from another tab is not allowed to replace words not yet sent from here.
 */
export function TypePad({ text, onText, hand, label, full, units, subject }: { subject: string; text: string; onText(t: string): boolean; hand: boolean; label: string; full: boolean; units: number }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(text);
  const sent = useRef(text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);
  const send = useRef(onText);
  useEffect(() => { send.current = onText; });

  const kit = useMemo(() => symbolsFor(subject), [subject]);
  const size = useQuestionsValue((q) => q.prefs.typeSize ?? "normal");

  // The text was changed from outside (a reset, or another tab): take it, unless there are words here not sent yet.
  useEffect(() => {
    if (text === sent.current || latest.current !== sent.current) return;
    // (words that arrive into an empty box, a faded copy taken on the first key or tap, leave the caret after them, not in front)
    const wasEmpty = latest.current === "";
    sent.current = text; latest.current = text; setValue(text);
    if (wasEmpty) requestAnimationFrame(() => { const el = area.current; if (el && document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length); });
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
  const put = useCallback((ch: string, wrap?: (s: string) => string): boolean => {
    const el = area.current;
    if (!el) return false;
    const value = latest.current;
    const s = el.selectionStart, e = el.selectionEnd;
    const chosen = wrap && s !== null && e !== null && e > s ? wrap(value.slice(s, e)) : ch;
    if (wrap && chosen === "") return false;
    const r = insertAt(value, s, e, chosen);
    // The box refuses more than the cap; so does the symbol strip (the text shown is the text kept).
    if (r.value.length > TEXT_PART_CAP && r.value.length > value.length) return false;
    // Typed into the box by the browser (insertText), so Ctrl+Z / Cmd+Z takes a symbol back like any typing; the box's own change event does the rest.
    el.focus({ preventScroll: true });
    let done = false;
    try { done = document.execCommand("insertText", false, chosen); } catch { done = false; }
    if (done) return true;
    change(r.value);
    requestAnimationFrame(() => { el.focus({ preventScroll: true }); el.setSelectionRange(r.caret, r.caret); });
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The Fraction box: what was selected in the answer fills the top; the answer's own selection is put back to take the fraction (or, on Escape, left exactly as it was).
  const [frac, setFrac] = useState<{ s: number; e: number; top: string; left: number; len: number } | null>(null);
  const [said, setSaid] = useState("");
  const openFraction = useCallback((left: number) => {
    const el = area.current;
    if (!el || !kit.fraction) return;
    const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s;
    setSaid("");
    setFrac({ s, e, top: e > s ? el.value.slice(s, e).trim() : "", left, len: el.value.length });
  }, [kit.fraction]);
  const closeFraction = (back: { s: number; e: number; len: number }, insert?: { text: string; spoken: string }) => {
    setFrac(null);
    const el = area.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    // (an earlier answer copied into the empty box while the Fraction box was open: the fraction goes after it)
    if (back.len === 0 && el.value.length > 0) el.setSelectionRange(el.value.length, el.value.length);
    else el.setSelectionRange(back.s, back.e);
    if (insert) {
      // after a digit ("2" then 3/5) a thin space keeps it a mixed number, "2 ³⁄₅", not "23/5"
      const before = el.value.slice(Math.max(0, el.selectionStart - 1), el.selectionStart);
      const done = put(/\d/.test(before) ? `\u2009${insert.text}` : insert.text);
      setSaid(done ? `Fraction inserted, ${insert.spoken}` : "That is as much as this answer can hold. Nothing was inserted.");
    }
  };
  const onFractionKey = (e: React.MouseEvent<HTMLButtonElement>) => {
    const host = e.currentTarget.closest(".qs-type")?.getBoundingClientRect(), k = e.currentTarget.getBoundingClientRect();
    openFraction(host ? Math.max(8, Math.min(k.left - host.left, host.width - 236)) : 8);
  };
  const code = kit.code;
  const hw = hand && !code;
  return (
    <div className="qs-type">
      <SymbolBar put={put} kit={kit} onFraction={onFractionKey} fractionOpen={!!frac} />
      {frac && <FractionBox top={frac.top} left={frac.left} onCancel={() => closeFraction(frac)} onInsert={(text, spoken) => closeFraction(frac, { text, spoken })} />}
      <span className="qs-sr" role="status" aria-live="polite">{said}</span>
      <div className={`qs-typebox${hw ? " is-hand" : ""}`} style={{ aspectRatio: `${REF_W} / ${units}`, ...(hw ? { "--rule": `${2 * TYPE_REM[size]}rem` } : {}) } as React.CSSProperties}>
        <textarea
          ref={area} className={`qs-text${hw ? " is-hand" : ""}${code ? " is-code" : ""}`} onKeyDown={(e) => { if (kit.fraction && isFractionShortcut(e)) { e.preventDefault(); openFraction(8); } }} value={value} aria-label={label} placeholder="Type your answer here"
          maxLength={TEXT_PART_CAP} onChange={(e) => change(e.target.value)} onBlur={flush} spellCheck={kit.spell} lang={kit.lang}
          {...(kit.code ? { autoCorrect: "off", autoCapitalize: "off" } : {})}
          style={{ fontSize: `${(hw ? 1.5625 : 1) * TYPE_REM[size]}rem` }}
        />
      </div>
      {full && <p className="qs-note" role="status">That is as much as this device can keep. Clear an old set to carry on.</p>}
    </div>
  );
}
