"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { progress, type QuestionsData } from "@/lib/studyapp/questions/model";
import { baseSubject, type CatalogueSubject } from "@/lib/studyapp/questions/subject";
import { qa } from "@/lib/studyapp/questions/store";
import { PlusIcon } from "./icons";
import { SetsSheet } from "./SetsSheet";
import { Shelf } from "./Shelf";

/**
 * The front door: one shelf of past papers for each subject the student does. Everything else (the picker with its search and
 * filters, mixes) is a card at the end of a shelf. The subjects are theirs to change (Change, Add a subject).
 */
export function Home({ catalogue, q, mine, onPick, onSetup }: { catalogue: CatalogueSubject[]; q: QuestionsData; mine: string[]; onPick(slug: string, mix: boolean): void; onSetup(): void }) {
  const [sets, setSets] = useState(false);
  const entries = useMemo(() => mine.map((s) => catalogue.find((c) => c.slug === s)).filter((c): c is CatalogueSubject => !!c), [mine, catalogue]);
  const names = [...new Set(entries.map((e) => baseSubject(e.subject)))].join(", ");
  const resume = q.sets.filter((s) => !s.finishedAt).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const a = document.activeElement;
    if (!a || a === document.body) h1.current?.focus({ preventScroll: true });
  }, []);
  return (
    <main className="qs-page qs-picker qh-home" data-testid="home" id="qs-main">
      <div className="wrap">
        <div className="qs-col">
          <a className="qs-skip" href="#qh-shelves" onClick={(e) => { e.preventDefault(); const el = document.getElementById("qh-shelves"); el?.scrollIntoView({ block: "start" }); el?.focus({ preventScroll: true }); }}>Skip to your papers</a>
          <header className="qs-head">
            <div className="qs-head-text">
              <h1 ref={h1} tabIndex={-1}>Questions</h1>
              <p className="qs-sub qh-mine"><span className="qh-mine-names" data-testid="mine-names">{names}</span><button type="button" className="qs-link" onClick={onSetup} data-testid="change-subjects">Change</button></p>
            </div>
            {q.sets.length > 0 && <button type="button" className="btn ghost" onClick={() => setSets(true)} data-testid="your-sets">Your sets<span className="k">{q.sets.length}</span></button>}
          </header>

          {resume && (() => {
            const p = progress(resume, q.answers);
            return (
              <div className="qs-resume" data-testid="resume">
                <Image src="/study/mascot/plumi-focused.svg" alt="" width={44} height={44} unoptimized />
                <div className="qs-resume-text"><b>{resume.name}</b><span>{p.done} of {p.of} marked</span></div>
                <button type="button" className="btn" onClick={() => qa.open(resume.id)} data-testid="resume-btn">Pick up</button>
              </div>
            );
          })()}

          <div className="qh-shelves" id="qh-shelves" tabIndex={-1}>
            {entries.map((e) => <Shelf key={e.slug} entry={e} q={q} onPick={onPick} />)}
          </div>
          <button type="button" className="qh-add" onClick={onSetup} data-testid="add-subject"><PlusIcon />Add a subject</button>
        </div>
      </div>
      {sets && <SetsSheet q={q} onClose={() => setSets(false)} />}
    </main>
  );
}
