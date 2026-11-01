"use client";

import { useState } from "react";
import { useNow } from "@/lib/studyapp/clock";
import { deckStats, dueNow, reviewStreak, SUBJECTS, subjectColour } from "@/lib/studyapp/model";
import { actions, useApp } from "@/lib/studyapp/store";
import { dayOf } from "@/lib/studyapp/time";
import { StarterPicker } from "./StarterPicker";

/** Decks: today at a glance, every deck with what is due, a way to make one, and the ready-made ones. */
export function DecksPanel({ onOpen, onReview, onReviewAll }: { onOpen: (id: string) => void; onReview: (id: string) => void; onReviewAll: () => void }) {
  const { data } = useApp();
  const now = useNow(1000);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [starters, setStarters] = useState(false);
  const today = now ? dayOf(now) : "";
  const log = today ? data.log[today] : undefined;
  const due = now ? dueNow(data, now).ids.length : 0;
  const streak = today ? reviewStreak(data, today) : 0;

  const make = () => {
    const id = actions.addDeck(title, subject || null);
    if (id) { setTitle(""); setSubject(""); onOpen(id); }
  };

  return (
    <div className="fcp-decks">
      <div className="fcp-stats" role="list">
        <div className="card" role="listitem"><span className="lbl">Due now</span><b className="num" data-testid="stat-due">{due}</b>
          <button type="button" className="btn gold" disabled={due === 0} onClick={onReviewAll}>Review</button></div>
        <div className="card" role="listitem"><span className="lbl">Reviewed today</span><b className="num">{log?.n ?? 0}</b><small>{log && log.n > 0 ? `${log.right} remembered` : "Nothing yet"}</small></div>
        <div className="card" role="listitem"><span className="lbl">Review streak</span><b className="num">{streak}</b><small>{streak === 1 ? "day" : "days"} in a row</small></div>
        <div className="card" role="listitem"><span className="lbl">New cards a day</span>
          <select value={data.perDay} onChange={(e) => actions.setPerDay(Number(e.target.value))} aria-label="New cards a day" data-testid="per-day">
            {[0, 5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>{n === 0 ? "None (reviews only)" : n}</option>)}
          </select>
          <small>Reviews of cards you know always come.</small></div>
      </div>

      <div className="fcp-bar">
        <h2>Your decks</h2>
        <span className="grow" />
        <button type="button" className="btn" onClick={() => setStarters((s) => !s)} aria-expanded={starters} data-testid="starters-toggle">Ready-made decks</button>
      </div>
      {starters && <div className="card fcp-starters"><StarterPicker compact /></div>}

      {data.decks.length === 0 ? (
        <p className="fcp-none" data-testid="no-decks">No decks yet. Make one below, or add a ready-made deck.</p>
      ) : (
        <ul className="fcp-grid">
          {data.decks.map((d) => {
            const st = now ? deckStats(data, d.id, now) : { total: 0, due: 0, fresh: 0, learning: 0, mature: 0 };
            return (
              <li key={d.id} className="card" data-testid="deck-tile">
                <div className="dk-top">
                  {d.subject && <span className="stk" style={{ background: subjectColour(d.subject) }}>{d.subject}</span>}
                  {st.due > 0 && <span className="due-n">{st.due} due</span>}
                </div>
                <h3>{d.title}</h3>
                <p>{st.total} card{st.total === 1 ? "" : "s"} &middot; {st.fresh} new &middot; {st.mature} well known</p>
                <div className="acts">
                  <button type="button" className="btn gold" disabled={st.due === 0} onClick={() => onReview(d.id)}>{st.due === 0 ? "Nothing due" : "Review"}</button>
                  <button type="button" className="btn" onClick={() => onOpen(d.id)} data-testid="open-deck">Open</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form className="card fcp-new" onSubmit={(e) => { e.preventDefault(); make(); }}>
        <h3>Make a deck</h3>
        <div className="row2">
          <input value={title} maxLength={50} onChange={(e) => setTitle(e.target.value)} placeholder="Deck name, e.g. Chemistry · Rates" aria-label="Deck name" data-testid="new-deck-name" />
          <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
            <option value="">No subject</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="submit" className="btn gold" disabled={!title.trim()} data-testid="new-deck-go">Make deck</button>
        </div>
      </form>
    </div>
  );
}
