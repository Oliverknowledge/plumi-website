"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { useAccount } from "@/lib/account";
import { NOTE_MAX, saveNote, setBookmarks, useSavedItems } from "@/lib/bankSaved";
import type { BankPart } from "@/content/questionBank";

export function RibbonIcon() {
  return <svg viewBox="0 0 24 32" aria-hidden="true"><path d="M3 1h18v29l-9-7-9 7z" /></svg>;
}

/**
 * The bookmark, hanging off the top of the paper. In the whole-question view it covers all
 * the question's parts, and shows on if any of them is on, so a question found through Saved
 * never looks unsaved; pressed then, it takes them all off.
 */
export function BookmarkRibbon({ subject, parts, label }: { subject: string; parts: BankPart[]; label: string }) {
  const items = useSavedItems();
  const on = parts.some(p => items[p.id]?.b);
  return (
    <button type="button" className={`qb-bookmark${on ? " is-on" : ""}`} aria-pressed={on} aria-label={`Bookmark ${label}`} title={on ? "Bookmarked: tap to take it off" : "Bookmark this question"}
      onClick={() => {
        setBookmarks(subject, parts.map(p => p.id), !on);
        track("bank_bookmarked", { subject, on: !on, parts: parts.length });
      }}>
      <RibbonIcon />
    </button>
  );
}

const started = new Set<string>();

/**
 * A note to self on a part: what tripped them up, what a teacher said. Not the answer (that's
 * AnswerBox, which gets marked against the scheme): this is for next time they see the question.
 * Saved as they type. Emptying it removes it, and a new note bookmarks its question (lib/bankSaved).
 */
export function NoteBox({ subject, part, many }: { subject: string; part: BankPart; many?: boolean }) {
  const saved = useSavedItems()[part.id]?.n ?? "";
  const account = useAccount();
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const value = text ?? saved;
  const shown = open || !!saved || !!text;

  // Saved a moment after typing stops, and straight away when the box is left or the page closes.
  const latest = useRef<string | null>(null);
  useEffect(() => { latest.current = text; }, [text]);
  useEffect(() => {
    if (text === null) return;
    const t = setTimeout(() => saveNote(subject, part.id, text), 500);
    return () => clearTimeout(t);
  }, [text, subject, part.id]);
  useEffect(() => {
    const save = () => { if (latest.current !== null) saveNote(subject, part.id, latest.current); };
    window.addEventListener("pagehide", save);
    return () => { window.removeEventListener("pagehide", save); save(); };
  }, [subject, part.id]);

  // Opened from its button: straight in, ready to type.
  useEffect(() => { if (open) area.current?.focus(); }, [open]);

  // The note grows with what's written.
  useLayoutEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = "auto";
    a.style.height = `${a.scrollHeight + 2}px`;
  }, [value, shown]);

  if (!shown) {
    return (
      <button type="button" className="qb-answer-open qb-mynote-open" onClick={() => setOpen(true)}>
        + Add a note{many ? ` to ${part.l}` : ""}
      </button>
    );
  }

  return (
    <div className="qb-mynote">
      <span className="lp-tape" aria-hidden="true" />
      <label htmlFor={id} className="qb-mynote-label">My note{many ? <span> {part.l}</span> : null}</label>
      <textarea id={id} ref={area} className="qb-mynote-area" value={value} rows={2} maxLength={NOTE_MAX}
        placeholder="What do you want to remember next time?" spellCheck autoCapitalize="sentences" autoCorrect="on"
        onChange={e => {
          if (!started.has(part.id)) { started.add(part.id); track("bank_note_started", { subject }); }
          setText(e.target.value);
        }}
        onBlur={() => {
          if (text !== null) saveNote(subject, part.id, text);
          // Left empty, it folds back to its button.
          if (!value.trim()) { setText(null); setOpen(false); }
        }} />
      {value.trim() && <p className="qb-mynote-foot">{account.user ? "Saved" : "Saved in this browser"}</p>}
    </div>
  );
}
