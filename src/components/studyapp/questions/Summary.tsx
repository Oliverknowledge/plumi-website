"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { againInput, catchUpInput, partDots, redoInput, scoreSet, summaryView, type QSet, type QuestionsData } from "@/lib/studyapp/questions/model";
import { saveWork } from "@/lib/studyapp/questions/saveWorkFile";
import { qa } from "@/lib/studyapp/questions/store";
import { useDocumentTitle } from "./useDocumentTitle";
import "../../../app/study/(app)/questions-fixa.css";

/**
 * The end of a set. It leads with how much was done ("3 of 25 marked"), and shows the score, small, only once at least half of the
 * parts are marked: a score over three parts is not a result, and the page does not celebrate one. Marks are only what the student
 * gave themselves, on the parts they marked; a part nobody marked is not a zero. What was marked, written on and left blank is drawn
 * as a grid of dots, one per part, each of which goes to its part.
 */
export function Summary({ set, q, onReview }: { set: QSet; q: QuestionsData; onReview(partId?: string): void }) {
  const s = scoreSet(set, q.answers);
  const v = summaryView(s);
  const redo = redoInput(set, q.answers);
  const catchUp = catchUpInput(set, q.answers);
  const dots = partDots(set, q.answers).filter((d) => d.state !== "unchosen");
  const title = useRef<HTMLHeadingElement>(null);
  const [armed, setArmed] = useState(false);
  const [saved, setSaved] = useState<"" | "working" | "done" | "failed">("");
  useDocumentTitle(`${v.title}, ${set.name} \u00b7 Plumi`);
  useEffect(() => { title.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, []);
  // The actions wake a moment after the page opens: a second tap on the button that brought the student here must not land on one of them.
  useEffect(() => { const t = setTimeout(() => setArmed(true), 500); return () => clearTimeout(t); }, []);

  const count = (state: "marked" | "written" | "blank") => dots.filter((d) => d.state === state).length;
  const groups: (typeof dots)[] = [];
  for (const d of dots) { const last = groups[groups.length - 1]; if (last && last[0].question === d.question) last.push(d); else groups.push([d]); }
  const label = (d: (typeof dots)[number]) => {
    const p = d.part;
    const a = q.answers[`${set.id}/${p.id}`];
    const what = d.state === "marked" ? `marked ${a?.got ?? 0} of ${p.m ?? 0}` : d.state === "written" ? "written on, not marked yet" : "blank";
    return `Question ${p.l}, ${what}. Go to it.`;
  };
  return (
    <main className="qs-page qs-summary" data-testid="summary" aria-labelledby="qs-sum-title">
      <div className="qs-desk">
        <section className="qs-sum card">
          <Image src={`/study/mascot/${v.mascot}.svg`} alt="" width={96} height={96} unoptimized priority />
          <h1 id="qs-sum-title" ref={title} tabIndex={-1} data-testid="summary-title">{v.title}</h1>
          <p className="qs-sum-name">{set.name}</p>
          {s.markable === 0 && <p className="qs-sum-line">No marks were printed for these parts.</p>}
          {v.showScore && (
            <p className="qs-sum-small" data-testid="summary-score">
              <span className={`qs-margin ${v.tone}`}>{s.got}/{s.total}</span>
              <span className="qs-pct">{s.pct}%</span>
              <span className="qs-sr"> on the parts you marked</span>
            </p>
          )}

          {dots.length > 1 && (
            <div className="qs-sum-cover" data-testid="summary-dots">
              <div className="qs-pdots" role="group" aria-label="Your answers, part by part">
                {groups.map((g) => (
                  <span key={g[0].question} className="qs-pdotq">
                    {g.map((d) => (
                      <button key={d.part.id} type="button" className={`qs-pdot ${d.state}${d.tone ? ` ${d.tone}` : ""}`} onClick={() => onReview(d.part.id)} aria-label={label(d)} title={`Q${d.part.l}`}><i aria-hidden="true" /></button>
                    ))}
                  </span>
                ))}
              </div>
              <ul className="qs-pdot-key" aria-hidden="true">
                {count("marked") > 0 && <li><i className="qs-pdot-sw marked" />{count("marked")} marked</li>}
                {count("written") > 0 && <li><i className="qs-pdot-sw written" />{count("written")} written, not marked</li>}
                {count("blank") > 0 && <li><i className="qs-pdot-sw blank" />{count("blank")} blank</li>}
              </ul>
            </div>
          )}

          {v.showScore && s.perTopic.length > 0 && (
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

          <div className="qs-sum-acts" inert={!armed} data-testid="summary-acts">
            {redo && <button type="button" className="btn gold" onClick={() => { qa.redo(set.id); }} data-testid="redo-set">Redo the ones you dropped marks on <span className="k">{redo.parts.length}</span></button>}
            {catchUp && <button type="button" className={`btn${redo ? "" : " gold"}`} onClick={() => { qa.catchUp(set.id); }} data-testid="catchup-set">Do the skipped ones <span className="k">{catchUp.parts.length}</span></button>}
            <button type="button" className={`btn${redo || catchUp ? "" : " gold"}`} onClick={() => qa.open(null)} data-testid="keep-going">Keep going</button>
            {againInput(set) && <button type="button" className="btn" onClick={() => { qa.again(set.id); }} data-testid="again-paper">Do this paper again</button>}
            <button type="button" className="btn ghost" onClick={() => onReview()} data-testid="review-sheet">Review the sheet</button>
            <button
              type="button" className="btn ghost" data-testid="save-work" disabled={saved === "working"}
              onClick={() => { setSaved("working"); void saveWork(set, q).then((ok) => setSaved(ok ? "done" : "failed")); }}
            >{saved === "working" ? "Saving..." : saved === "done" ? "Saved \u2713" : "Save my work"}</button>
            {saved === "done" && <span className="qs-saved" data-testid="saved-note">Saved to your downloads</span>}
            {saved === "failed" && <span className="qs-saved qs-saved-no" data-testid="saved-note">Could not save. Try again.</span>}
          </div>
          <p className="qs-sr" role="status">{saved === "done" ? "Saved to your downloads." : saved === "failed" ? "Could not save. Try again." : ""}</p>
        </section>
      </div>
    </main>
  );
}
