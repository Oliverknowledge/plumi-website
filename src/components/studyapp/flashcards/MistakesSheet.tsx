"use client";

import { useMemo, useState } from "react";
import { track } from "@/lib/analytics";
import { mistakeCard, collectMistakes, madeParts, type Mistake } from "@/lib/studyapp/questions/mistakes";
import { useQuestions } from "@/lib/studyapp/questions/store";
import { actions, useApp } from "@/lib/studyapp/store";
import { toast } from "../toast";
import { Sheet } from "./Sheet";

/** The marks drawn: a dot a mark with the ones they got filled (a long question: a bar). */
function Dots({ got, marks }: { got: number; marks: number }) {
  const say = `${got} of ${marks} ${marks === 1 ? "mark" : "marks"}`;
  if (marks > 8) return <span className="mk-bar" role="img" aria-label={say}><i style={{ width: `${Math.round((got / marks) * 100)}%` }} /></span>;
  return <span className="mk-dots" role="img" aria-label={say}>{Array.from({ length: marks }, (_, i) => <i key={i} className={i < got ? "on" : undefined} />)}</span>;
}

const Pencil = () => <svg viewBox="0 0 64 40" width="64" height="40" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 30c8-10 14 6 22-4s12-12 16-8" /><path d="M44 14l8-8 6 6-8 8z" /><path d="M42 16l6 6" /></svg>;

/**
 * "From my mistakes": every question part the student marked themselves on and lost marks on (questions/mistakes.ts), by subject and topic, ticked by default; "Make cards"
 * turns the ticked ones into picture cards in the subject's "My mistakes" deck. Pro only (the button that opens it is gated); the data is the student's own, so nothing
 * here is fetched from a server.
 */
export function MistakesSheet({ onClose, onReview }: { onClose: () => void; onReview: (deckId: string) => void }) {
  const { ready, q } = useQuestions();
  const { data } = useApp();
  const found = useMemo(() => collectMistakes(q, madeParts(data.cards)), [q, data.cards]);
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const [done, setDone] = useState<{ n: number; title: string; deckId: string | null; many: boolean } | null>(null);

  const all = useMemo(() => found.groups.flatMap((g) => g.topics.flatMap((t) => t.mistakes)), [found]);
  const ticked = all.filter((m) => !off.has(m.part));
  const toggle = (m: Mistake) => setOff((s) => { const n = new Set(s); if (n.has(m.part)) n.delete(m.part); else n.add(m.part); return n; });

  const make = () => {
    if (ticked.length === 0) return;
    let added = 0, deckId: string | null = null, title = "";
    let decks = 0;
    for (const g of found.groups) {
      const cards = g.topics.flatMap((t) => t.mistakes).filter((m) => !off.has(m.part)).flatMap((m) => { const c = mistakeCard(q, m); return c ? [c] : []; });
      if (cards.length === 0) continue;
      const r = actions.addMistakes(g.base, cards);
      if (r.added > 0) { added += r.added; deckId = r.deckId; title = `My mistakes · ${g.base}`; decks++; track("mistakes_cards_made", { count: r.added, subject: g.base }); }
    }
    if (added === 0) return;
    toast(`${added} card${added === 1 ? "" : "s"} added`);
    setDone({ n: added, title, deckId, many: decks > 1 });
    setOff(new Set());
  };

  return (
    <Sheet title="From my mistakes" hint="The questions you lost marks on." onClose={onClose} wide>
      <div className="mk" data-testid="mistakes-sheet">
        {done && (
          <div className="mk-done" role="status" data-testid="mistakes-done">
            <span className="mk-tick" aria-hidden="true">&#10003;</span>
            <p><b>{done.n} card{done.n === 1 ? "" : "s"} added</b><small>{done.many ? "to your My mistakes decks" : `to ${done.title}`}</small></p>
            {done.deckId && !done.many && <button type="button" className="btn gold" onClick={() => { onClose(); onReview(done.deckId!); }} data-testid="mistakes-review">Review them</button>}
          </div>
        )}
        {!ready ? (
          <ul className="mk-list" aria-busy="true" aria-label="Loading"><li className="mk-ghost" /><li className="mk-ghost" /></ul>
        ) : all.length === 0 ? (
          <div className="mk-empty" data-testid="mistakes-empty">
            <Pencil />
            <p>{done ? "That is all of them for now." : "Nothing to redo yet. Mark yourself on a question and the ones you lose marks on show up here."}</p>
          </div>
        ) : (
          <>
            <div className="mk-bar-top">
              <span className="mk-count" data-testid="mistakes-count">{ticked.length} of {all.length} ticked</span>
              <button type="button" className="btn ghost" onClick={() => setOff(new Set())} data-testid="mistakes-all">Select all</button>
              <button type="button" className="btn ghost" onClick={() => setOff(new Set(all.map((m) => m.part)))} data-testid="mistakes-none">Select none</button>
            </div>
            <div className="mk-groups">
              {found.groups.map((g) => (
                <section key={g.subject} className="mk-subject" aria-label={g.title}>
                  <h3>{g.title}</h3>
                  {g.topics.map((t) => (
                    <div key={t.code || "other"} className="mk-topic">
                      <h4>{t.title}</h4>
                      <ul className="mk-list">
                        {t.mistakes.map((m) => (
                          <li key={m.part}>
                            <label className={`mk-row${off.has(m.part) ? " off" : ""}`}>
                              <input type="checkbox" className="cbx" checked={!off.has(m.part)} onChange={() => toggle(m)} data-testid="mistake-tick" />
                              <span className="mk-q"><b>{m.label}</b><small>{m.from}</small></span>
                              <Dots got={m.got} marks={m.marks} />
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              ))}
            </div>
            <div className="sheet-acts">
              <button type="button" className="btn gold" disabled={ticked.length === 0} onClick={make} data-testid="mistakes-make">{ticked.length === 0 ? "Tick some questions" : `Make ${ticked.length} card${ticked.length === 1 ? "" : "s"}`}</button>
              <button type="button" className="btn ghost" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
