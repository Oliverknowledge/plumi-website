"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { QuestionsData } from "@/lib/studyapp/questions/model";
import { groupPapers, paperSetInput, paperState, SHELF_PAPERS, shelfOf, yearsOf, type Paper } from "@/lib/studyapp/questions/papers";
import { qa } from "@/lib/studyapp/questions/store";
import { baseSubject, boardLabel, subjectTint, type CatalogueSubject } from "@/lib/studyapp/questions/subject";
import { useSubject } from "./bankData";
import { BackIcon } from "./icons";
import { ActionCard, PaperCard, PaperGhost, type Roving } from "./PaperCard";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const GHOSTS = [0, 1, 2, 3, 4, 5];

/** True once the element is near the screen (one way: a shelf that has been near stays loaded). Without IntersectionObserver, at once. */
function useNear(ref: React.RefObject<Element | null>): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return near;
}

/**
 * One subject's shelf: its past papers, newest first, as cards you can scroll along. The shelf is drawn from the catalogue at
 * once (its name, a row of ghost papers) and fills in when the subject's list arrives, which is asked for only when the shelf
 * is near the screen. A paper opens the whole paper as a sheet (or picks it up where it was left); the last cards open the picker.
 */
export function Shelf({ entry, q, onPick }: { entry: CatalogueSubject; q: QuestionsData; onPick(slug: string, mix: boolean): void }) {
  const box = useRef<HTMLElement>(null);
  const near = useNear(box);
  const [attempt, setAttempt] = useState(0);
  const data = useSubject(entry.slug, attempt, near);
  const tint = subjectTint(entry.subject);
  const name = baseSubject(entry.subject);
  const id = useId();
  const rows = data.state === "ready" ? data.rows : null;
  const meta = data.state === "ready" ? data.meta : null;
  const papers = useMemo(() => (rows && meta ? groupPapers(rows, meta) : []), [rows, meta]);
  const [all, setAll] = useState(false);
  const [year, setYear] = useState<string | null>(null);
  const years = useMemo(() => yearsOf(papers), [papers]);
  const { shown, more } = shelfOf(papers, SHELF_PAPERS);
  const inYear = all ? papers.filter((p) => p.year === (year ?? years[0]?.year)) : shown;
  const states = useMemo(() => new Map(papers.map((p) => [p.key, paperState(entry.slug, p.key, q.sets, q.answers)])), [papers, entry.slug, q.sets, q.answers]);

  const open = (p: Paper) => {
    if (!meta) return;
    const st = states.get(p.key);
    if (st?.set) qa.open(st.set.id);
    else qa.start(paperSetInput(meta, p));
  };

  // the row: arrows, and one tab stop (the cards move among themselves with the arrow keys)
  const row = useRef<HTMLUListElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const [cur, setCur] = useState(0);
  const [edge, setEdge] = useState({ l: false, r: false });
  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    setEdge((e) => { const l = el.scrollLeft > 4, r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4; return e.l === l && e.r === r ? e : { l, r }; });
  }, []);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => { el.removeEventListener("scroll", measure); ro?.disconnect(); };
  }, [measure, data.state, all, year]);
  const slide = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * Math.max(240, row.current.clientWidth * 0.8), behavior: reduced() ? "auto" : "smooth" });
  const onKey = (e: React.KeyboardEvent) => {
    const list = cards.current.filter((c): c is HTMLButtonElement => !!c);
    const at = list.findIndex((c) => c === document.activeElement);
    if (at < 0) return;
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? at + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? at - 1 : e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : -1;
    if (next < 0 || next >= list.length) return;
    e.preventDefault();
    list[next].focus();
  };
  const total = inYear.length + (all ? 0 : (more > 0 ? 1 : 0) + 2);
  const stop = Math.min(cur, total - 1);   // the one card in the tab order, kept inside the row when it gets shorter
  const attach = useCallback((i: number, el: HTMLButtonElement | null) => { cards.current[i] = el; }, []);
  const nav = (i: number): Roving => ({ index: i, stop: stop === i, attach, focused: setCur });

  const heading = `${name} ${boardLabel(entry)} ${entry.level}`;
  const failed = data.state === "error";
  const ready = data.state === "ready";
  let k = 0;
  return (
    <section ref={box} className="qh-shelf" aria-labelledby={`${id}-h`} style={{ "--tint": tint } as React.CSSProperties} data-testid="shelf" data-slug={entry.slug}>
      <header className="qh-shelf-head">
        <div className="qh-shelf-title">
          <h2 id={`${id}-h`}><span className="qh-dot" aria-hidden="true" />{name}<span className="qs-sr"> {boardLabel(entry)} {entry.level}</span></h2>
          <span className="qh-tag" aria-hidden="true">{boardLabel(entry)} {entry.level}</span>
          {ready && <span className="qh-n">{papers.length} {papers.length === 1 ? "paper" : "papers"}</span>}
        </div>
        {all ? (
          <button type="button" className="qs-link" onClick={() => { setAll(false); setCur(0); }} aria-label={`Back to the latest ${name} papers`}><BackIcon />Latest</button>
        ) : (
          edge.l || edge.r ? (
            <span className="qh-arrows">
              <button type="button" className="qh-arrow" onClick={() => slide(-1)} disabled={!edge.l} aria-label={`Scroll ${heading} papers back`} tabIndex={-1}><BackIcon /></button>
              <button type="button" className="qh-arrow next" onClick={() => slide(1)} disabled={!edge.r} aria-label={`Scroll ${heading} papers forward`} tabIndex={-1}><BackIcon /></button>
            </span>
          ) : null
        )}
      </header>

      {all && (
        <div className="qh-years" role="group" aria-label={`${name} papers by year`}>
          {years.map((y) => <button key={y.year} type="button" className={`qs-chip${(year ?? years[0]?.year) === y.year ? " on" : ""}`} aria-pressed={(year ?? years[0]?.year) === y.year} onClick={() => { setYear(y.year); setCur(0); }}>{y.year}<span className="qh-yn">{y.n}</span></button>)}
        </div>
      )}

      {failed ? (
        <div className="qh-fail" role="status">
          <Image src="/study/mascot/plumi-curious.svg" alt="" width={40} height={40} unoptimized />
          <span>These papers did not load</span>
          <button type="button" className="btn" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
        </div>
      ) : !ready ? (
        <div className="qh-scroller" role="status" aria-label={`Loading ${name} papers`}>
          <ul className="qh-row" aria-hidden="true">{GHOSTS.map((i) => <li key={i} className="qh-item"><PaperGhost n={i} /></li>)}</ul>
        </div>
      ) : (
        <div className={`qh-scroller${edge.r && !all ? " has-more" : ""}${edge.l && !all ? " has-less" : ""}`}>
          <ul ref={row} role="list" className={`qh-row${all ? " wrap" : ""}`} onKeyDown={onKey} aria-label={`${heading} past papers`}>
            {inYear.map((p) => {
              const i = k++;
              return <li key={p.key} className="qh-item"><PaperCard paper={p} state={states.get(p.key)!} n={i} tint={tint} onOpen={() => open(p)} nav={nav(i)} /></li>;
            })}
            {!all && more > 0 && (() => { const i = k++; return <li key="more" className="qh-item"><ActionCard kind="more" label="More papers" sub={`${more} earlier`} extra={`+${more}`} tint={tint} onClick={() => { setAll(true); setYear(papers[SHELF_PAPERS]?.year ?? null); setCur(0); }} nav={nav(i)} /></li>; })()}
            {!all && (() => { const i = k++; return <li key="mix" className="qh-item"><ActionCard kind="mix" label="Mix for me" sub="Ten at a time" tint={tint} onClick={() => onPick(entry.slug, true)} nav={nav(i)} /></li>; })()}
            {!all && (() => { const i = k++; return <li key="pick" className="qh-item"><ActionCard kind="pick" label="Pick your own" sub="Search, filters" tint={tint} onClick={() => onPick(entry.slug, false)} nav={nav(i)} /></li>; })()}
          </ul>
        </div>
      )}
      {ready && papers.length === 0 && (
        <div className="qh-fail"><span>No papers here yet</span><button type="button" className="btn" onClick={() => onPick(entry.slug, false)}>Pick your own</button></div>
      )}
    </section>
  );
}
