"use client";

import { useRef, useState } from "react";
import { insertAt, SymbolBar } from "./SymbolBar";

/**
 * The two boxes of a card (front, back), a symbol bar that types into whichever you were in, and a button.
 * Used to add a card and to edit one. Cmd or Ctrl and Enter submits from either box.
 */
export function CardFields({
  initialFront = "", initialBack = "", submitLabel, onSubmit, onCancel, resetOnSubmit = false, idPrefix,
}: {
  initialFront?: string; initialBack?: string; submitLabel: string; onSubmit: (front: string, back: string) => void; onCancel?: () => void; resetOnSubmit?: boolean; idPrefix: string;
}) {
  const [front, setFront] = useState(initialFront);
  const [back, setBack] = useState(initialBack);
  const [active, setActive] = useState<"front" | "back">("front");
  const frontEl = useRef<HTMLTextAreaElement>(null);
  const backEl = useRef<HTMLTextAreaElement>(null);
  const ok = front.trim().length > 0 && back.trim().length > 0;

  const put = (text: string) => {
    const el = active === "front" ? frontEl.current : backEl.current;
    const value = active === "front" ? front : back;
    const r = insertAt(value, el?.selectionStart ?? null, el?.selectionEnd ?? null, text);
    (active === "front" ? setFront : setBack)(r.value);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(r.caret, r.caret); });
  };
  const submit = () => {
    if (!ok) return;
    onSubmit(front, back);
    if (resetOnSubmit) { setFront(""); setBack(""); setActive("front"); requestAnimationFrame(() => frontEl.current?.focus()); }
  };
  const keys = (e: React.KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } };

  return (
    <div className="cardfields">
      <div className="cf-grid">
        <label htmlFor={`${idPrefix}-front`} className="lbl">Front (the question)</label>
        <textarea id={`${idPrefix}-front`} ref={frontEl} value={front} maxLength={400} rows={2} onChange={(e) => setFront(e.target.value)} onFocus={() => setActive("front")} onKeyDown={keys} data-testid={`${idPrefix}-front`} />
        <label htmlFor={`${idPrefix}-back`} className="lbl">Back (the answer)</label>
        <textarea id={`${idPrefix}-back`} ref={backEl} value={back} maxLength={800} rows={3} onChange={(e) => setBack(e.target.value)} onFocus={() => setActive("back")} onKeyDown={keys} data-testid={`${idPrefix}-back`} />
      </div>
      <SymbolBar onInsert={put} />
      <div className="cf-acts">
        <button type="button" className="btn gold" disabled={!ok} onClick={submit} data-testid={`${idPrefix}-submit`}>{submitLabel}</button>
        {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>}
        <span className="cf-hint"><kbd>{typeof navigator !== "undefined" && /Mac/i.test(navigator.platform) ? "⌘" : "Ctrl"}</kbd> <kbd>Enter</kbd> to add</span>
      </div>
    </div>
  );
}
