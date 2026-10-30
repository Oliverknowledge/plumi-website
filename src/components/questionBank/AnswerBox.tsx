"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { saveAnswer, useAnswer, wordCount } from "@/lib/bankAnswers";
import type { BankPart } from "@/content/questionBank";

/**
 * "Write your answer": a lined page under the question to type into, then the mark scheme
 * as usual and the self-marking keys. Nothing marks what's typed; it's there so the student
 * answers before they look, and has their own words beside the scheme when they do.
 *
 * Open from the start in essay subjects, where writing is the point; a button elsewhere,
 * so a science list isn't a column of empty boxes. A draft opens itself again, saved as
 * the student types (lib/bankAnswers). Built for both: it grows with the answer instead
 * of scrolling inside itself, and its text is 16px so a phone doesn't zoom in on it.
 */
export function AnswerBox({ subject, part, open: openFirst, many, schemeOpen, onCheck }: {
  subject: string; part: BankPart; open: boolean; many?: boolean; schemeOpen: boolean; onCheck?: () => void;
}) {
  const saved = useAnswer(part.id);
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const value = text ?? saved;
  const shown = open || openFirst || !!saved;

  // Saved a moment after typing stops, and straight away when the box is left.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = () => { if (pending.current) { clearTimeout(pending.current); pending.current = null; } if (text !== null) saveAnswer(subject, part.id, text); };
  useEffect(() => {
    if (text === null) return;
    pending.current = setTimeout(() => { pending.current = null; saveAnswer(subject, part.id, text); }, 500);
    return () => { if (pending.current) clearTimeout(pending.current); };
  }, [text, subject, part.id]);

  // And whatever is still waiting when the page closes or the box goes.
  const latest = useRef<string | null>(null);
  useEffect(() => { latest.current = text; }, [text]);
  useEffect(() => {
    const save = () => { if (latest.current !== null) saveAnswer(subject, part.id, latest.current); };
    window.addEventListener("pagehide", save);
    return () => { window.removeEventListener("pagehide", save); save(); };
  }, [subject, part.id]);

  // Opened from its button: straight into the box, ready to type.
  useEffect(() => { if (open) area.current?.focus(); }, [open]);

  // The page grows with the answer.
  useLayoutEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = "auto";
    a.style.height = `${a.scrollHeight + 2}px`;
  }, [value, shown]);

  if (!shown) {
    return (
      <button type="button" className="qb-answer-open" onClick={() => setOpen(true)}>
        <span aria-hidden="true">✎</span> Type your answer{many ? ` to ${part.l}` : ""}
      </button>
    );
  }

  const words = wordCount(value);
  return (
    <div className={`qb-answer${focus ? " is-focus" : ""}`}>
      <label htmlFor={id} className="qb-answer-label">Your answer{many ? <span> {part.l}</span> : null}</label>
      <textarea id={id} ref={area} className="qb-answer-area" value={value} rows={3}
        placeholder="Write your answer here" spellCheck autoCapitalize="sentences" autoCorrect="on"
        onChange={e => setText(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); flush(); }} />
      <div className="qb-answer-foot">
        <span className="qb-answer-count">{words} {words === 1 ? "word" : "words"}{words > 0 && <> · saved in this browser</>}</span>
        {onCheck && !schemeOpen && words > 0 && (
          <button type="button" className="qb-key qb-answer-check" onClick={() => { flush(); onCheck(); }}>Check against the mark scheme</button>
        )}
      </div>
    </div>
  );
}

/** The answer, read back beside the scheme in the full-screen viewer. */
export function AnswerReadBack({ part }: { part: BankPart }) {
  const text = useAnswer(part.id);
  if (!text.trim()) return null;
  return (
    <details className="qb-answer-back" open>
      <summary>Your answer <span>{wordCount(text)} words</span></summary>
      <p>{text}</p>
    </details>
  );
}
