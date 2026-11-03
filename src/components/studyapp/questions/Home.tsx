"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { progress, visibleSets, type QuestionsData } from "@/lib/studyapp/questions/model";
import { subjectFor, viewFor, type FeedViewKind } from "@/lib/studyapp/questions/feedView";
import { updateFeedPrefs, useFeedPrefs } from "@/lib/studyapp/questions/feedStore";
import { qa } from "@/lib/studyapp/questions/store";
import { baseSubject, boardLabel, subjectTint, tierLine, type CatalogueSubject } from "@/lib/studyapp/questions/subject";
import { Feed } from "./Feed";
import { PlusIcon } from "./icons";
import { SetsSheet } from "./SetsSheet";
import { Shelf } from "./Shelf";

const VIEWS: { id: FeedViewKind; label: string }[] = [{ id: "questions", label: "Questions" }, { id: "papers", label: "Papers" }];

/**
 * The front door: one subject at a time, its questions as a single continuous list (the feed) or its past papers on a shelf (Papers). The subjects are the
 * student's own, small notebook tabs along the top (Change, Add a subject); which subject and which of the two views they were last in is remembered.
 */
export function Home({ catalogue, q, mine, onPick, onSetup }: { catalogue: CatalogueSubject[]; q: QuestionsData; mine: string[]; onPick(slug: string, mix: boolean): void; onSetup(): void }) {
  const [sets, setSets] = useState(false);
  const prefs = useFeedPrefs();
  const entries = useMemo(() => mine.map((s) => catalogue.find((c) => c.slug === s)).filter((c): c is CatalogueSubject => !!c), [mine, catalogue]);
  const slug = subjectFor(prefs, entries.map((e) => e.slug));
  const entry = entries.find((e) => e.slug === slug) ?? entries[0];
  const view = entry ? viewFor(prefs, entry.slug) : "questions";
  const mine1 = visibleSets(q);
  const resume = mine1.filter((s) => !s.finishedAt).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const a = document.activeElement;
    if (!a || a === document.body) h1.current?.focus({ preventScroll: true });
  }, []);
  const choose = (s: string) => updateFeedPrefs((p) => (p.last === s ? p : { ...p, last: s }));
  const setView = (v: FeedViewKind) => entry && updateFeedPrefs((p) => (p.view[entry.slug] === v ? p : { ...p, view: { ...p.view, [entry.slug]: v } }));
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? entries.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    const at = (to + entries.length) % entries.length;
    choose(entries[at].slug);
    tabs.current[at]?.focus();
  };
  if (!entry) return null;
  return (
    <main className="qs-page qs-picker qh-home qf-home" data-testid="home" id="qs-main" style={{ "--tint": subjectTint(entry.subject) } as React.CSSProperties}>
      <div className="wrap">
        <div className="qs-col">
          <header className="qs-head">
            <div className="qs-head-text">
              <h1 ref={h1} tabIndex={-1}>Questions</h1>
            </div>
            <div className="qf-head-acts">
              <div className="qf-views" role="radiogroup" aria-label="Show">
                {VIEWS.map((v) => <button key={v.id} type="button" role="radio" aria-checked={view === v.id} className={view === v.id ? "is-on" : ""} onClick={() => setView(v.id)} data-testid={`view-${v.id}`}>{v.label}</button>)}
              </div>
              {q.sets.length > 0 && <button type="button" className="btn ghost" onClick={() => setSets(true)} data-testid="your-sets">Your sets{mine1.length > 0 && <span className="k">{mine1.length}</span>}</button>}
            </div>
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

          <div className="qf-tabrow">
            <div className="qf-tabs" data-testid="subject-tabs">
              <div className="qf-tablist" role="tablist" aria-label="Your subjects">
                {entries.map((e, i) => {
                  const on = e.slug === entry.slug;
                  const tier = tierLine(q.tiers?.[e.slug], e.tiers);
                  return (
                    <button
                      key={e.slug} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`qf-tab-${e.slug}`} aria-selected={on} aria-controls="qf-panel" tabIndex={on ? 0 : -1}
                      className={`qf-tab${on ? " on" : ""}`} style={{ "--tint": subjectTint(e.subject) } as React.CSSProperties} onClick={() => choose(e.slug)} onKeyDown={(ev) => onTabKey(ev, i)} data-testid="subject-tab" data-slug={e.slug}
                    >
                      <span className="qf-tab-name">{baseSubject(e.subject)}</span>
                      <span className="qf-tab-sub">{boardLabel(e)}{tier ? ` \u00b7 ${tier}` : ""}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="qf-tab qf-tab-add" onClick={onSetup} data-testid="add-subject" aria-label="Add a subject"><PlusIcon /></button>
            </div>
            <button type="button" className="qs-link qf-change" onClick={onSetup} data-testid="change-subjects">Change</button>
          </div>

          <div id="qf-panel" role="tabpanel" aria-labelledby={`qf-tab-${entry.slug}`} className="qf-panel">
            {view === "questions" ? <Feed key={entry.slug} entry={entry} q={q} /> : (
              <div className="qh-shelves" id="qh-shelves"><Shelf key={entry.slug} entry={entry} q={q} onPick={onPick} /></div>
            )}
          </div>
        </div>
      </div>
      {sets && <SetsSheet q={q} onClose={() => setSets(false)} />}
    </main>
  );
}
