"use client";

import Image from "next/image";
import { redoInput, scoreSet, type QSet, type QuestionsData } from "@/lib/studyapp/questions/model";
import { qa } from "@/lib/studyapp/questions/store";

/** The end of a set: marks, percent, how each topic went, what was skipped, and what to do next. Marks are only what the student gave themselves. */
export function Summary({ set, q, onReview }: { set: QSet; q: QuestionsData; onReview(partId?: string): void }) {
  const s = scoreSet(set, q.answers);
  const redo = redoInput(set, q.answers);
  const pct = s.pct;
  const mascot = pct === null ? "plumi-lofi-cozy" : pct >= 80 ? "plumi-celebrating" : pct >= 50 ? "plumi-proud" : "plumi-encouraging";
  const notMarked = s.unmarked.filter((p) => p.m != null && !s.skipped.includes(p));
  const tone = pct === null ? "" : pct >= 80 ? "full" : pct >= 40 ? "part" : "zero";
  return (
    <main className="qs-page qs-summary" data-testid="summary">
      <div className="qs-desk">
        <section className="qs-sum card">
          <Image src={`/study/mascot/${mascot}.svg`} alt="" width={96} height={96} unoptimized priority />
          <h1>Set done</h1>
          <p className="qs-sum-name">{set.name}</p>
          {s.total > 0 ? (
            <div className="qs-sum-score" data-testid="summary-score">
              <span className={`qs-margin big ${tone}`}>{s.got}/{s.total}</span>
              <span className="qs-pct">{pct}%</span>
            </div>
          ) : <p className="qs-sum-name">No marks were printed for these parts.</p>}

          {s.perTopic.length > 0 && s.total > 0 && (
            <ul className="qs-topics" aria-label="How each topic went">
              {s.perTopic.map((t) => (
                <li key={t.code}>
                  <span className="qs-topic-name">{t.title}</span>
                  <span className="qs-bar-track" role="img" aria-label={`${t.got} of ${t.total}`}><i style={{ width: `${t.total ? (t.got / t.total) * 100 : 0}%` }} /></span>
                  <b>{t.got}/{t.total}</b>
                </li>
              ))}
            </ul>
          )}

          {s.skipped.length > 0 && (
            <div className="qs-sum-block">
              <p className="lbl">Skipped</p>
              <div className="qs-chips">{s.skipped.map((p) => <button key={p.id} type="button" className="chip" onClick={() => onReview(p.id)}>{p.l}</button>)}</div>
            </div>
          )}
          {notMarked.length > 0 && (
            <div className="qs-sum-block">
              <p className="lbl">Not marked yet</p>
              <div className="qs-chips">{notMarked.map((p) => <button key={p.id} type="button" className="chip" onClick={() => onReview(p.id)}>{p.l}</button>)}</div>
            </div>
          )}

          <div className="qs-sum-acts">
            {redo && <button type="button" className="btn gold" onClick={() => { qa.redo(set.id); }} data-testid="redo-set">Redo the ones you dropped marks on <span className="k">{redo.parts.length}</span></button>}
            <button type="button" className={`btn${redo ? "" : " gold"}`} onClick={() => qa.open(null)} data-testid="keep-going">Keep going</button>
            <button type="button" className="btn ghost" onClick={() => onReview()} data-testid="review-sheet">Review the sheet</button>
          </div>
        </section>
      </div>
    </main>
  );
}
