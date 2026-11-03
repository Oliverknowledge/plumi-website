"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { choicesAt, draftKey, draftOf, draftSlugs, levelsOf, tickSubject, type SubjectChoice } from "@/lib/studyapp/questions/mine";
import { subjectTint, type CatalogueSubject } from "@/lib/studyapp/questions/subject";
import { BackIcon, CheckIcon } from "./icons";

/**
 * "What are you studying?": the level, the subjects they do, and for each the exam board (only the boards the bank has for it).
 * Kept on the device (`qa.mine`). The first thing a new student sees; reached again with Change and Add a subject, with their
 * choice already ticked, and nothing is kept until they say Show my papers.
 */
export function Setup({ catalogue, mine, first, onDone, onCancel }: { catalogue: CatalogueSubject[]; mine: string[]; first: boolean; onDone(slugs: string[]): void; onCancel(): void }) {
  const [draft, setDraft] = useState(() => draftOf(mine, catalogue));
  const { main, other } = useMemo(() => levelsOf(catalogue), [catalogue]);
  const [level, setLevel] = useState(() => {
    const c = mine.length ? catalogue.find((x) => x.slug === mine[0]) : undefined;
    return c?.level ?? main[0] ?? other[0] ?? "GCSE";
  });
  const [more, setMore] = useState(() => !main.includes(level));
  const choices = useMemo(() => choicesAt(catalogue, level), [catalogue, level]);
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h1.current?.focus({ preventScroll: true }); }, []);

  const slugOf = (c: SubjectChoice) => draft.get(draftKey(level, c.base));
  const toggle = (c: SubjectChoice) => setDraft((d) => {
    const k = draftKey(level, c.base);
    if (d.has(k)) { const n = new Map(d); n.delete(k); return n; }
    return tickSubject(d, level, c, catalogue);
  });
  const choose = (c: SubjectChoice, slug: string) => setDraft((d) => new Map(d).set(draftKey(level, c.base), slug));
  const levelCount = (l: string) => [...draft.keys()].filter((k) => k.startsWith(`${l}|`)).length;
  const ticked = draft.size;
  const missing = [...draft].filter(([, s]) => !s).map(([k]) => k.split("|")[1]);
  const ready = ticked > 0 && missing.length === 0;
  const slugs = draftSlugs(draft);
  const lvlBtn = (l: string) => (
    <button key={l} type="button" className={`qs-level${l === level ? " on" : ""}`} aria-pressed={l === level} onClick={() => setLevel(l)}>
      {l}{levelCount(l) > 0 && <span className="qs-badge" aria-label={`${levelCount(l)} chosen`}>{levelCount(l)}</span>}
    </button>
  );
  return (
    <main className="qs-page qs-picker qh-setup" id="qs-main" data-testid="setup" aria-labelledby="qh-setup-h">
      <div className="wrap">
        <div className="qs-col">
          <header className="qs-head">
            <div className="qs-head-text">
              {!first && <button type="button" className="qs-homeback" onClick={onCancel} data-testid="setup-cancel"><BackIcon />My papers</button>}
              <h1 id="qh-setup-h" ref={h1} tabIndex={-1}>What are you studying?</h1>
              <p className="qs-sub">Tick your subjects, then your exam board.</p>
            </div>
            <Image className="qh-setup-mascot" src="/study/mascot/plumi-welcoming.svg" alt="" width={84} height={84} unoptimized priority />
          </header>

          <div className="qs-levels" role="group" aria-label="Level">
            {main.map(lvlBtn)}
            {other.length > 0 && <button type="button" className={`qs-level qs-more${more ? " open" : ""}`} aria-expanded={more || !main.includes(level)} onClick={() => setMore((m) => !m)}>More</button>}
          </div>
          {(more || !main.includes(level)) && other.length > 0 && <div className="qs-levels qh-more-levels" role="group" aria-label="Other levels">{other.map(lvlBtn)}</div>}

          <ul className="qh-subjects" aria-label={`${level} subjects`}>
            {choices.map((c) => {
              const slug = slugOf(c);
              const on = slug !== undefined;
              const open = !slug;
              return (
                <li key={c.base} className={`qh-subj${on ? " on" : ""}${on && open ? " need" : ""}`} style={{ "--tint": subjectTint(c.base) } as React.CSSProperties}>
                  <button type="button" className="qh-subj-btn" aria-pressed={on} onClick={() => toggle(c)} data-testid={`tick-${c.base}`}>
                    <span className="qh-tick" aria-hidden="true">{on && <CheckIcon />}</span>
                    <b>{c.base}</b>
                  </button>
                  {on && (c.boards.length === 1 ? (
                    <div className="qh-boards"><span className="qs-chip on" data-testid="board-fixed">{c.boards[0].label}</span></div>
                  ) : (
                    <div className="qh-boards" role="group" aria-label={`Exam board for ${c.base}`}>
                      {c.boards.map((b) => <button key={b.slug} type="button" className={`qs-chip${slug === b.slug ? " on" : ""}`} aria-pressed={slug === b.slug} onClick={() => choose(c, b.slug)} data-testid={`board-${b.slug}`}>{b.label}</button>)}
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {ticked > 0 && (
        <div className="qs-selbar qh-donebar" role="region" aria-label="Your subjects">
          <p className="qs-sel-count" role="status" aria-live="polite">
            {missing.length > 0 ? <>Pick a board for <b>{missing[0]}</b></> : <><b data-testid="setup-count">{ticked}</b> {ticked === 1 ? "subject" : "subjects"}</>}
          </p>
          <button type="button" className="btn gold qs-start" disabled={!ready} onClick={() => onDone(slugs)} data-testid="setup-done">Show my papers</button>
        </div>
      )}
    </main>
  );
}
