"use client";

import Image from "next/image";
import { tabColour } from "@/lib/studyapp/questions/setupBooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { progress, visibleSets, type QuestionsData } from "@/lib/studyapp/questions/model";
import { subjectFor, viewFor, type FeedViewKind } from "@/lib/studyapp/questions/feedView";
import { updateFeedPrefs, useFeedPrefs } from "@/lib/studyapp/questions/feedStore";
import { qa } from "@/lib/studyapp/questions/store";
import { baseSubject, boardLabel, tierLine, type CatalogueSubject } from "@/lib/studyapp/questions/subject";
import { useDayFigures } from "@/lib/studyapp/dayStreak";
import { Feed } from "./Feed";
import { QuestionsDay } from "./QuestionsDay";
import { Radios } from "./FeedBar";
import { useMatch } from "./useMatch";
import { ChevronIcon } from "./pickerIcons";
import { PlusIcon } from "./icons";
import { SetsSheet } from "./SetsSheet";
import { PapersList } from "./PapersList";

const VIEWS: { id: FeedViewKind; label: string }[] = [{ id: "questions", label: "Questions" }, { id: "papers", label: "Papers" }];

/**
 * The front door: one subject at a time, its questions as a single continuous list (the feed) or its past papers laid out like the public past papers page (Papers). The subjects are the
 * student's own, small notebook tabs along the top (Change, Add a subject); which subject and which of the two views they were last in is remembered.
 */
export function Home({ catalogue, q, mine, onPick, onSetup }: { catalogue: CatalogueSubject[]; q: QuestionsData; mine: string[]; onPick(slug: string, mix: boolean): void; onSetup(): void }) {
  const [sets, setSets] = useState(false);
  const [picking, setPicking] = useState(false);
  const phone = useMatch("(max-width: 640px)");
  const subjBtn = useRef<HTMLButtonElement>(null);
  // The sheet (or Your sets, opened from it) has closed: focus goes back to the subject button, never to the page.
  const wasOpen = useRef(false);
  const open = picking || sets;
  useEffect(() => {
    if (wasOpen.current && !open && phone) subjBtn.current?.focus();
    wasOpen.current = open;
  }, [open, phone]);
  const prefs = useFeedPrefs();
  const figures = useDayFigures();
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
  const subLine = `${boardLabel(entry)} \u00b7 ${entry.level}${tierLine(q.tiers?.[entry.slug], entry.tiers) ? ` \u00b7 ${tierLine(q.tiers?.[entry.slug], entry.tiers)}` : ""}`;
  return (
    <main className="qs-page qs-picker qh-home qf-home qf-ground" data-testid="home" id="qs-main" style={{ "--tint": tabColour(baseSubject(entry.subject)) } as React.CSSProperties}>
      <div className="wrap">
        <div className="qs-col">
          <header className={`qs-head${phone ? " qf-head-phone" : ""}`}>
            <div className="qs-head-text">
              <h1 ref={h1} tabIndex={-1} className={phone ? "qs-sr" : undefined}>{baseSubject(entry.subject)}<span className="qs-sr"> questions</span></h1>
            </div>
            <div className="qf-head-acts">
              {phone && (
                <button type="button" id="qf-subjbtn" ref={subjBtn} className="qf-subj" onClick={() => setPicking(true)} aria-haspopup="dialog" aria-expanded={picking} aria-label={`Subject: ${baseSubject(entry.subject)}, ${subLine}. Change subject`} data-testid="subject-picker" style={{ "--tint": tabColour(baseSubject(entry.subject)) } as React.CSSProperties}>
                  <span className="qf-subj-name">{baseSubject(entry.subject)}</span>
                  <span className="qf-subj-sub">{subLine}</span>
                  <ChevronIcon />
                </button>
              )}
              <Radios className="qf-views" label="Show" value={view} options={VIEWS.map((v) => [v.id, v.label])} onPick={(v) => setView(v as FeedViewKind)} testid="view" />
              {!phone && q.sets.length > 0 && <button type="button" className="btn ghost" onClick={() => setSets(true)} data-testid="your-sets">Your sets{mine1.length > 0 && <span className="k">{mine1.length}</span>}</button>}
            </div>
          </header>
          <QuestionsDay figures={figures} />

          {resume && (() => {
            const p = progress(resume, q.answers);
            return (
              <div className="qs-resume" data-testid="resume">
                <Image src="/study/mascot/plumi-focused.svg" alt="" width={44} height={44} unoptimized />
                <div className="qs-resume-text"><b>{resume.name}</b><span>{p.done} of {p.of} questions marked</span></div>
                <button type="button" className="btn" onClick={() => qa.open(resume.id)} data-testid="resume-btn">Continue</button>
              </div>
            );
          })()}

          {!phone && <div className="qf-tabrow">
            <div className="qf-tabs" data-testid="subject-tabs">
              <div className="qf-tablist" role="tablist" aria-label="Your subjects">
                {entries.map((e, i) => {
                  const on = e.slug === entry.slug;
                  const tier = tierLine(q.tiers?.[e.slug], e.tiers);
                  return (
                    <button
                      key={e.slug} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`qf-tab-${e.slug}`} aria-selected={on} aria-controls="qf-panel" tabIndex={on ? 0 : -1}
                      className={`qf-tab${on ? " on" : ""}`} style={{ "--tint": tabColour(baseSubject(e.subject)) } as React.CSSProperties} onClick={() => choose(e.slug)} onKeyDown={(ev) => onTabKey(ev, i)} data-testid="subject-tab" data-slug={e.slug}
                    >
                      <span className="qf-tab-name">{baseSubject(e.subject)}</span>
                      <span className="qf-tab-sub">{`${boardLabel(e)} \u00b7 ${e.level}${tier ? ` \u00b7 ${tier}` : ""}`}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="qf-tab qf-tab-add" onClick={onSetup} data-testid="add-subject" aria-label="Add a subject"><PlusIcon /></button>
            </div>
            <button type="button" className="qs-link qf-change" onClick={onSetup} data-testid="change-subjects">Change subjects</button>
          </div>}

          <div id="qf-panel" role="tabpanel" aria-labelledby={phone ? "qf-subjbtn" : `qf-tab-${entry.slug}`} className="qf-panel">
            {view === "questions" ? <Feed key={entry.slug} entry={entry} q={q} /> : <PapersList key={entry.slug} entry={entry} q={q} onPick={onPick} />}
          </div>
        </div>
      </div>
      {picking && (
        <SubjectSheet
          entries={entries} current={entry.slug} q={q} onClose={() => setPicking(false)} onChoose={(slug) => { choose(slug); setPicking(false); }}
          onSetup={() => { setPicking(false); onSetup(); }} onSets={q.sets.length > 0 ? () => { setPicking(false); setSets(true); } : undefined} setsCount={mine1.length}
        />
      )}
      {sets && <SetsSheet q={q} onClose={() => setSets(false)} />}
    </main>
  );
}

/** A phone's way to change subject: one button in the strip, and a sheet from the foot of the screen that lists them (however many) with Add a subject, Change and Your sets. */
function SubjectSheet({ entries, current, q, onClose, onChoose, onSetup, onSets, setsCount }: {
  entries: CatalogueSubject[]; current: string; q: QuestionsData; onClose(): void; onChoose(slug: string): void; onSetup(): void; onSets?: () => void; setsCount: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  // The page behind the sheet does not scroll under a finger that is moving the list of subjects.
  useEffect(() => { const el = document.documentElement; el.classList.add("qf-locked"); return () => el.classList.remove("qf-locked"); }, []);
  const close = () => { const d = ref.current; if (d?.open) d.close(); else onClose(); };
  return (
    <dialog ref={ref} className="qf-subjsheet" aria-label="Your subjects" onClose={onClose} onClick={(e) => { if (e.target === ref.current) close(); }} data-testid="subject-sheet">
      <div className="qf-subjsheet-in">
        <div className="qf-subjsheet-head"><h2>Your subjects</h2><button type="button" className="btn ghost icon" aria-label="Close" onClick={close}>{"\u00d7"}</button></div>
        <ul className="qf-subjlist">
          {entries.map((e) => {
            const tier = tierLine(q.tiers?.[e.slug], e.tiers);
            return (
              <li key={e.slug}>
                <button type="button" className={`qf-subjrow${e.slug === current ? " on" : ""}`} aria-current={e.slug === current ? "true" : undefined} onClick={() => onChoose(e.slug)} style={{ "--tint": tabColour(baseSubject(e.subject)) } as React.CSSProperties} data-testid="subject-row" data-slug={e.slug}>
                  <span className="qf-subjrow-dot" aria-hidden="true">{e.slug === current ? "\u2713" : ""}</span><span className="qf-subjrow-name">{baseSubject(e.subject)}</span>
                  <span className="qf-subjrow-sub">{`${boardLabel(e)} \u00b7 ${e.level}${tier ? ` \u00b7 ${tier}` : ""}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="qf-subjacts">
          <button type="button" className="btn" onClick={onSetup} data-testid="add-subject">Add a subject</button>
          <button type="button" className="qs-link qf-change" onClick={onSetup} data-testid="change-subjects">Change subjects</button>
          {onSets && <button type="button" className="btn ghost" onClick={onSets} data-testid="your-sets">Your sets{setsCount > 0 && <span className="k">{setsCount}</span>}</button>}
        </div>
      </div>
    </dialog>
  );
}
