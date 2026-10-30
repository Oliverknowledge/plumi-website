"use client";

import { useId, useState } from "react";
import { partStatus, recordMark, ROUGH, shareTone, topicAttempts, undoMark, useBankMarks, type Attempt } from "@/lib/bankProgress";
import type { BankPart } from "@/content/questionBank";

/**
 * Marking yourself, under each part's mark scheme: tap how many marks you got.
 * Up to ten marks the choices are keys, one per mark; an essay's 25 is a slider with
 * a step either side. A part with no printed marks takes a rough "Got it / Partly /
 * Missed". Multiple choice needs none of this: `ChoicePick` marks it from the letter.
 *
 * The mark lands where the student is looking: circled in red pen beside the keys,
 * as well as in the margin, which on a phone is a screen away.
 */

const ROUGH_KEYS = [["Got it", 2], ["Partly", 1], ["Missed", 0]] as const;

function latest(h?: Attempt[]) { return h?.[h.length - 1]; }

/** A mark in red pen, circled: "2/3", or a tick, wave or cross for a rough one. */
export function InkScore({ s, of, rough, size }: { s: number; of: number; rough?: boolean; size?: "note" }) {
  const r = of ? s / of : 0;
  const said = rough ? (r >= 1 ? "Got it" : r > 0 ? "Partly" : "Missed") : `${s} out of ${of}`;
  return (
    <span className={`qb-ink ${shareTone(r)}${size ? ` is-${size}` : ""}`} role="img" aria-label={said}>
      {rough ? (r >= 1 ? "✓" : r > 0 ? "~" : "✗") : <>{s}<i>/</i>{of}</>}
    </span>
  );
}

function verdict(a: Attempt, firstOnTopic: boolean) {
  const r = a[1] ? a[0] / a[1] : 0;
  const pct = Math.round(r * 100);
  if (firstOnTopic && pct >= 40) return pct >= 100 ? "Full marks. One more on this topic and its square colours in." : "Saved. One more on this topic and its square colours in.";
  if (pct >= 100) return "Full marks.";
  if (pct >= 62) return "Nearly there.";
  if (pct >= 40) return "Saved. Over half way.";
  return "Saved. Worth another go later.";
}

function useFirstOnTopic(subject: string, part: BankPart) {
  const store = useBankMarks();
  return topicAttempts(store.subjects[subject], part.t).length === 1;
}

export function SelfMark({ subject, part, many }: { subject: string; part: BankPart; many?: boolean }) {
  const store = useBankMarks();
  const rec = store.subjects[subject]?.[part.id];
  const last = latest(rec?.h);
  const before = rec && rec.h.length > 1 ? rec.h[rec.h.length - 2] : undefined;
  const firstOnTopic = useFirstOnTopic(subject, part);
  const outOf = part.m ?? 2;
  const [slide, setSlide] = useState<number | null>(null);
  const [undone, setUndone] = useState(false);
  const sliderId = useId();
  const mark = (score: number, kind: "marks" | "rough") => {
    setUndone(false);
    recordMark({ subject, part: part.id, topics: part.t, score, outOf, kind });
  };
  const value = slide ?? last?.[0] ?? 0;

  return (
    <div className={`qb-self${last ? " is-done" : ""}`} role="group" aria-label={`Mark yourself on ${part.l}`}>
      <p className="qb-self-q">
        {part.m == null ? "How did it go?" : "How many marks did you get?"}
        {many && <span className="qb-self-part"> {part.l}</span>}
      </p>
      {part.m == null ? (
        <div className="qb-self-keys">
          {ROUGH_KEYS.map(([label, score]) => (
            <button key={label} type="button" className={`qb-self-key is-wide${last?.[0] === score ? " is-on" : ""}`} aria-pressed={last?.[0] === score} onClick={() => mark(score, "rough")}>{label}</button>
          ))}
        </div>
      ) : part.m <= 10 ? (
        <div className="qb-self-keys">
          {Array.from({ length: part.m + 1 }, (_, n) => (
            <button key={n} type="button" className={`qb-self-key${last?.[0] === n ? " is-on" : ""}`} aria-pressed={last?.[0] === n}
              aria-label={`${n} out of ${part.m}`} onClick={() => mark(n, "marks")}>{n}</button>
          ))}
        </div>
      ) : (
        <div className="qb-self-slide">
          <button type="button" className="qb-self-key" aria-label="One fewer" onClick={() => setSlide(Math.max(0, value - 1))}>−</button>
          <input id={sliderId} type="range" min={0} max={part.m} step={1} value={value} aria-label={`Marks out of ${part.m}`} onChange={e => setSlide(Number(e.target.value))} />
          <button type="button" className="qb-self-key" aria-label="One more" onClick={() => setSlide(Math.min(part.m ?? 0, value + 1))}>+</button>
          <label htmlFor={sliderId} className="qb-self-n"><strong>{value}</strong> / {part.m}</label>
          <button type="button" className="qb-self-key is-wide is-save" onClick={() => { mark(value, "marks"); setSlide(null); }}>{last ? "Save again" : "Save"}</button>
        </div>
      )}
      {last ? (
        <p className="qb-self-note" role="status">
          <InkScore s={last[0]} of={last[1]} rough={last[3] === ROUGH} size="note" />
          <span>
            {verdict(last, firstOnTopic)}
            {before && before[3] !== ROUGH && <> Last time {before[0]}/{before[1]}.</>}
            {" "}<button type="button" className="qb-link" onClick={() => { undoMark(subject, part.id); setUndone(true); }}>Undo</button>
          </span>
        </p>
      ) : undone ? <p className="qb-self-note" role="status">Undone.</p> : null}
    </div>
  );
}

/**
 * Multiple choice: pick a letter and it is marked on the spot, against the key. The
 * first pick stands (the right letter shows straight after, so a second tap would
 * only copy it); Undo takes it back for a genuine slip.
 */
export function ChoicePick({ subject, part }: { subject: string; part: BankPart }) {
  const store = useBankMarks();
  const last = latest(store.subjects[subject]?.[part.id]?.h);
  const key = part.k ?? "";
  // "A or C": either is right.
  const right = (letter: string) => key.split(/\s+or\s+/i).includes(letter);
  const picked = last ? last[3] ?? null : null;
  const done = !!last;

  function pick(letter: string) {
    if (done) return;
    recordMark({ subject, part: part.id, topics: part.t, score: right(letter) ? 1 : 0, outOf: 1, kind: "choice", choice: letter });
  }

  return (
    <div className="qb-choice" role="group" aria-label={`Your answer to ${part.l}`}>
      <span className="qb-self-q">Your answer</span>
      <div className="qb-self-keys">
        {["A", "B", "C", "D"].map(l => {
          const state = !done ? "" : picked === l ? (right(l) ? " is-right" : " is-wrong") : right(l) ? " is-key" : " is-off";
          return <button key={l} type="button" className={`qb-self-key${state}`} aria-pressed={picked === l} disabled={done} onClick={() => pick(l)}>{l}</button>;
        })}
      </div>
      {last && (
        <p className="qb-self-note" role="status">
          <InkScore s={last[0]} of={1} size="note" />
          <span>
            {last[0] ? "Right." : <>It’s <strong>{key}</strong>.</>}
            {" "}<button type="button" className="qb-link" onClick={() => undoMark(subject, part.id)}>Undo</button>
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * The score in the margin, in red pen, the way an examiner writes a question's total:
 * every part of the row that has a mark, added up.
 */
export function MarginScore({ subject, parts }: { subject: string; parts: BankPart[] }) {
  const store = useBankMarks();
  const bank = store.subjects[subject];
  let s = 0, of = 0, marked = 0, rough = 0;
  for (const p of parts) {
    const a = latest(bank?.[p.id]?.h);
    if (!a) continue;
    marked++;
    if (a[3] === ROUGH) { rough++; s += a[0]; of += a[1]; continue; }
    s += a[0]; of += a[1];
  }
  if (!marked) return null;
  return (
    <span className="qb-margin-score">
      <InkScore s={s} of={of} rough={rough === marked} />
      {marked < parts.length && <small>so far</small>}
    </span>
  );
}

/** In the margin, under the score: a question missed a few days ago that has come back. */
export function AgainTag({ subject, parts }: { subject: string; parts: BankPart[] }) {
  const store = useBankMarks();
  const bank = store.subjects[subject];
  if (!parts.some(p => partStatus(bank?.[p.id]).status === "again")) return null;
  return <span className="qb-again-tag" title="You missed this a few days ago. Try it again before you look at the scheme.">↻ Have another go</span>;
}
