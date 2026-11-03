"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { catchUpInput, redoInput, scoreSet, type QSet, type QuestionsData } from "@/lib/studyapp/questions/model";
import { qa } from "@/lib/studyapp/questions/store";
import { useDocumentTitle } from "./useDocumentTitle";

/**
 * The end of a set: marks, percent, how each topic went, what was skipped, and what to do next. Marks are only what the
 * student gave themselves, and only on the parts they marked: a part nobody marked is not a zero, it is not scored at all.
 */
export function Summary({ set, q, onReview }: { set: QSet; q: QuestionsData; onReview(partId?: string): void }) {
  const s = scoreSet(set, q.answers);
  const redo = redoInput(set, q.answers);
  const catchUp = catchUpInput(set, q.answers);
  const title = useRef<HTMLHeadingElement>(null);
  useDocumentTitle(`Set done, ${set.name} \u00b7 Plumi`);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);

  const pct = s.pct;
  // Mostly unmarked: the score is of a few parts, so it is shown plainly and not as a verdict.
  const mostly = s.markable > 0 && s.marked * 2 >= s.markable;
  const tone = pct === null || !mostly ? "" : pct >= 80 ? "full" : "part";
  const mascot = pct === null || !mostly ? "plumi-lofi-cozy" : pct >= 80 ? "plumi-celebrating" : pct >= 50 ? "plumi-proud" : "plumi-encouraging";
  const waiting = s.unmarked.filter((p) => !s.skipped.includes(p));
  return (
    <main className="qs-page qs-summary" data-testid="summary" aria-labelledby="qs-sum-title">
      <div className="qs-desk">
        <section className="qs-sum card">
          <Image src={`/study/mascot/${mascot}.svg`} alt="" width={96} height={96} unoptimized priority />
          <h1 id="qs-sum-title" ref={title} tabIndex={-1}>Set done</h1>
          <p className="qs-sum-name">{set.name}</p>
          {s.markable === 0 && <p className="qs-sum-line">No marks were printed for these parts.</p>}
          {s.total > 0 ? (
            <div className="qs-sum-score" data-testid="summary-score">
              <span className={`qs-margin big ${tone}`}>{s.got}/{s.total}</span>
              <span className="qs-pct">{pct}%</span>
            </div>
          ) : s.markable > 0 ? <p className="qs-sum-line" data-testid="summary-score">Nothing is marked yet.</p> : null}
          {s.markable > 0 && <p className="qs-sum-line" role="status">{s.marked} of {s.markable} {s.markable === 1 ? "part" : "parts"} marked</p>}

          {s.perTopic.length > 0 && (
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
              <div className="qs-chips">{s.skipped.map((p) => <button key={p.id} type="button" className="chip" onClick={() => onReview(p.id)} aria-label={`Skipped: question ${p.l}. Go to it.`}>Q{p.l}</button>)}</div>
            </div>
          )}
          {waiting.length > 0 && (
            <div className="qs-sum-block">
              <p className="lbl">Not marked yet</p>
              <div className="qs-chips">{waiting.map((p) => <button key={p.id} type="button" className="chip" onClick={() => onReview(p.id)} aria-label={`Not marked yet: question ${p.l}. Go to it.`}>Q{p.l}</button>)}</div>
            </div>
          )}

          <div className="qs-sum-acts">
            {redo && <button type="button" className="btn gold" onClick={() => { qa.redo(set.id); }} data-testid="redo-set">Redo the ones you dropped marks on <span className="k">{redo.parts.length}</span></button>}
            {catchUp && <button type="button" className={`btn${redo ? "" : " gold"}`} onClick={() => { qa.catchUp(set.id); }} data-testid="catchup-set">Do the skipped ones <span className="k">{catchUp.parts.length}</span></button>}
            <button type="button" className={`btn${redo || catchUp ? "" : " gold"}`} onClick={() => qa.open(null)} data-testid="keep-going">Keep going</button>
            <button type="button" className="btn ghost" onClick={() => onReview()} data-testid="review-sheet">Review the sheet</button>
          </div>
        </section>
      </div>
    </main>
  );
}
