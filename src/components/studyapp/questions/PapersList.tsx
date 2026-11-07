"use client";

import Image from "next/image";
import { memo, useCallback, useLayoutEffect, useMemo, useState } from "react";
import { WindowBar } from "@/components/cosy/WindowBar";
import { fileKindLabel, type FileKind } from "@/content/pastPaperKinds";
import { holdScroll } from "@/lib/studyapp/questions/feedStore";
import type { QuestionsData } from "@/lib/studyapp/questions/model";
import { byPaperCode, groupPapers, paperAria, paperSetInput, paperState, rowLine, yearsOf, type Paper, type PaperCode, type PaperState } from "@/lib/studyapp/questions/papers";
import { paperSpecials, wholeFiles, type Special } from "@/lib/studyapp/questions/specials";
import { qa } from "@/lib/studyapp/questions/store";
import { baseSubject, boardLabel, type CatalogueSubject, type SubjectMeta } from "@/lib/studyapp/questions/subject";
import { useSubject } from "./bankData";
import { RetryIcon } from "./icons";
import { ShuffleIcon } from "./pickerIcons";

/** Sittings a paper shows before the rest fold away, as on the public past papers page (PaperTable.tsx). */
const RECENT = 12;
const GHOSTS = [0, 1];
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Where the page was when a paper was opened, per subject: closing the paper puts the list back where it was (taken once). */
const left = new Map<string, number>();

/** The files a sitting has, as keys in the order the public page shows them: question paper, mark scheme, examiner's report; then the booklet, code files and transcript. */
interface Keys { whole: Partial<Record<"qp" | "ms" | "er", string>>; more: Special[] }
const MORE_SHORT: Record<Special["kind"], string> = { ins: "Insert", code: "Code", tr: "Transcript" };

/**
 * One subject's past papers, laid out like the public past papers page (src/components/pastPapers/): a card per paper (a pixel window, its title, its sittings
 * newest first as rows), each sitting with the files the bank hosts for it (QP, MS, ER, the insert) as the same small keys. What the public page does not have is here
 * too: each row says how far you are (Not started, 12 of 44 marked) and opens the whole paper as a sheet to write on (or picks it up where it was left).
 */
export function PapersList({ entry, q, onPick }: { entry: CatalogueSubject; q: QuestionsData; onPick(slug: string, mix: boolean): void }) {
  const [attempt, setAttempt] = useState(0);
  const data = useSubject(entry.slug, attempt);
  const name = baseSubject(entry.subject);
  const heading = `${boardLabel(entry)} ${entry.level} ${name}`;
  const ready = data.state === "ready";
  const rows = ready ? data.rows : null;
  const meta = ready ? data.meta : null;
  const papers = useMemo(() => (rows && meta ? groupPapers(rows, meta) : []), [rows, meta]);
  const cards = useMemo(() => byPaperCode(papers), [papers]);
  // the years the papers span ("2017 to 2025"); a sitting with no year (Specimen) is not one of them
  const span = useMemo(() => { const ys = yearsOf(papers).map((y) => y.year).filter((y) => /^\d{4}$/.test(y)); return ys.length > 1 ? `${ys[ys.length - 1]} to ${ys[0]}` : ys[0] ?? null; }, [papers]);
  const states = useMemo(() => new Map(papers.map((p) => [p.key, paperState(entry.slug, p.key, q.sets, q.answers)])), [papers, entry.slug, q.sets, q.answers]);
  const started = useMemo(() => [...states.values()].filter((s) => s.phase !== "new").length, [states]);

  // The list comes back where it was left (QuestionsPage puts a page at its top unless a screen says it is opening where it was).
  useLayoutEffect(() => {
    if (!ready) return;
    const y = left.get(entry.slug);
    if (y === undefined) return;
    left.delete(entry.slug);
    holdScroll();
    window.scrollTo(0, y);
  }, [ready, entry.slug]);

  const open = useCallback((p: Paper) => {
    if (!meta) return;
    left.set(entry.slug, window.scrollY);
    const st = states.get(p.key);
    if (st?.set) qa.open(st.set.id);
    else qa.start(paperSetInput(meta, p));
  }, [meta, states, entry.slug]);
  const mix = useCallback(() => onPick(entry.slug, true), [onPick, entry.slug]);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
    el.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
  };
  const idFor = (code: string) => `pp-${entry.slug}-${code.replace(/[^a-z0-9]+/gi, "-")}`;

  return (
    <section className="pp-st" aria-label={`${heading} past papers`} data-testid="papers" data-slug={entry.slug}>
      <div className="pp-st-top">
        {ready && papers.length > 0 && (
          <ul className="pp-st-facts" aria-label="At a glance">
            <li><strong>{papers.length.toLocaleString("en-GB")}</strong><span>{papers.length === 1 ? "paper" : "papers"}</span></li>
            {span && <li><strong>{span}</strong><span>{span.includes(" to ") ? "series" : "latest series"}</span></li>}
            {started > 0 && <li><strong>{started}</strong><span>started</span></li>}
          </ul>
        )}
        <button type="button" className="qh-pill mix pp-st-mix" onClick={mix} data-testid="card-mix"><span className="qh-pill-ico" aria-hidden="true"><ShuffleIcon /></span>Mix them up</button>
      </div>

      {ready && cards.length > 1 && (
        <nav className="pp-st-jump" aria-label="Jump to a paper">
          {cards.map((c) => <button key={c.code} type="button" onClick={() => jump(idFor(c.code))}>{c.name}</button>)}
        </nav>
      )}

      {data.state === "error" ? (
        <button type="button" className="pp-st-retry" onClick={() => setAttempt((a) => a + 1)} aria-label={`${name} papers did not load. Try again`} data-testid="shelf-retry">
          <Image src="/study/mascot/plumi-curious.svg" alt="" width={64} height={64} unoptimized />
          <span className="qh-retry-go" aria-hidden="true"><RetryIcon /></span>
        </button>
      ) : !ready ? (
        <div className="pp-st-papers" role="status" aria-label={`Loading ${name} papers`}>
          {GHOSTS.map((i) => (
            <div key={i} className="pp-st-card pp-st-ghost" aria-hidden="true"><WindowBar label="" />
              <div className="pp-st-body"><span className="pp-st-g wide" />{[0, 1, 2, 3].map((r) => <span key={r} className="pp-st-g" />)}</div>
            </div>
          ))}
        </div>
      ) : papers.length === 0 ? (
        <p className="pp-st-none">No papers here yet</p>
      ) : (
        <div className="pp-st-papers">
          {cards.map((c) => <Card key={c.code} id={idFor(c.code)} card={c} meta={meta!} heading={heading} states={states} onOpen={open} />)}
        </div>
      )}
    </section>
  );
}

/** One paper: a window with its name, and its sittings under it. */
function Card({ id, card, meta, heading, states, onOpen }: { id: string; card: PaperCode; meta: SubjectMeta; heading: string; states: Map<string, PaperState>; onOpen(p: Paper): void }) {
  // A column of keys is drawn only where some sitting has one, so a paper with a question paper and a scheme is two columns (the public page's rule).
  const files = useMemo(() => new Map<string, Keys>(card.sessions.map((p) => [p.key, { whole: wholeFiles(meta, p.p, p.s), more: paperSpecials(meta, p.p, p.s) }])), [card, meta]);
  const kinds = (["qp", "ms", "er"] as const).filter((k) => card.sessions.some((p) => files.get(p.key)?.whole[k]));
  const more = card.sessions.some((p) => files.get(p.key)?.more.length);
  const recent = card.sessions.slice(0, RECENT);
  const older = card.sessions.slice(RECENT);
  const shape = { kinds, more } satisfies Shape;
  const list = (items: Paper[]) => (
    <ul className="pp-st-rows" role="list">
      {items.map((p) => <Row key={p.key} paper={p} state={states.get(p.key)!} keys={files.get(p.key)!} shape={shape} heading={heading} onOpen={onOpen} />)}
    </ul>
  );
  return (
    <section id={id} className="pp-st-card" aria-labelledby={`${id}-h`} data-testid="paper-group" data-code={card.code}>
      <WindowBar label={`${card.sessions.length} ${card.sessions.length === 1 ? "session" : "sessions"}`} />
      <div className="pp-st-body">
        <h3 id={`${id}-h`} tabIndex={-1}>{card.name}</h3>
        {card.title && <p className="pp-st-sub">{card.title}</p>}
        {list(recent)}
        {older.length > 0 && (
          <details className="pp-st-older">
            <summary>{older.length} older {older.length === 1 ? "session" : "sessions"}, back to {older[older.length - 1].series}</summary>
            {list(older)}
          </details>
        )}
      </div>
    </section>
  );
}

interface Shape { kinds: readonly ("qp" | "ms" | "er")[]; more: boolean }

/** A sitting: how far you are and the way in on the left, its files as keys on the right (under it on a phone). */
const Row = memo(function Row({ paper, state, keys, shape, heading, onOpen }: { paper: Paper; state: PaperState; keys: Keys; shape: Shape; heading: string; onOpen(p: Paper): void }) {
  const pct = state.phase === "done" ? 100 : Math.round(state.fraction * 100);
  const go = state.phase === "new" ? "Start" : state.phase === "started" ? "Continue" : "Open";
  const attempt = state.attempt > 1 ? state.attempt : 0;
  const named = (kind: FileKind) => `${heading} ${paper.name}, ${paper.series}, ${fileKindLabel[kind].long.toLowerCase()}`;
  return (
    <li className={`pp-st-row is-${state.phase}${shape.more ? " wide" : ""}`} data-testid="paper-row" data-paper={paper.key}>
      <button type="button" className="pp-st-open" onClick={() => onOpen(paper)} aria-label={`Open in Plumi: ${paperAria(paper, state)}`} data-testid="paper-card">
        <span className="pp-st-main" aria-hidden="true">
          <span className="pp-st-session">{paper.series}{attempt > 0 && <i>Attempt {attempt}</i>}{paper.note && <i>{paper.note}</i>}</span>
          <span className="pp-st-state">
            {pct > 0 && <span className="pp-st-bar"><i style={{ width: `${pct}%` }} /></span>}
            <span>{rowLine(state)}</span>
          </span>
        </span>
        <span className="pp-file pp-st-go" aria-hidden="true">{go}</span>
      </button>
      <span className="pp-st-files" style={{ "--k": shape.kinds.length, "--m": shape.more ? "minmax(68px, auto)" : "0px" } as React.CSSProperties}>
        {shape.kinds.map((kind) => {
          const href = keys.whole[kind];
          if (!href) return <span key={kind} className="pp-none" aria-label="Not available">&middot;</span>;
          return (
            <a key={kind} className={`pp-file is-${kind}`} href={href} target="_blank" rel="noopener noreferrer" title={named(kind)} aria-label={`${named(kind)} (PDF)`}>{fileKindLabel[kind].short}</a>
          );
        })}
        {shape.more && (
          <span className="pp-more-files">
            {keys.more.map((x) => (
              <a key={x.kind} className="pp-file is-more" href={x.href} target="_blank" rel="noopener noreferrer" {...(x.download ? { download: "" } : {})} aria-label={`${heading} ${paper.name}, ${paper.series}, ${x.label}`}>{MORE_SHORT[x.kind]}</a>
            ))}
          </span>
        )}
      </span>
    </li>
  );
});
