"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { QuestionsData } from "@/lib/studyapp/questions/model";
import { groupPapers, paperSetInput, paperState, SHELF_PAPERS, shelfOf, yearsOf, type Paper } from "@/lib/studyapp/questions/papers";
import { qa } from "@/lib/studyapp/questions/store";
import { baseSubject, boardLabel, subjectTint, type CatalogueSubject } from "@/lib/studyapp/questions/subject";
import { useSubject } from "./bankData";
import { BackIcon } from "./icons";
import { MoreCard, PaperCard, PaperGhost, PaperRetry, ShelfPills } from "./PaperCard";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const GHOSTS = [0, 1, 2, 3, 4, 5];
/** A year opens this many papers at a time (a year of 57 is a lot to draw at once on a slow device). */
const YEAR_PAGE = 24;

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
  const [cap, setCap] = useState(YEAR_PAGE);
  const years = useMemo(() => yearsOf(papers), [papers]);
  const { shown, more } = shelfOf(papers, SHELF_PAPERS);
  const wholeYear = useMemo(() => (all ? papers.filter((p) => p.year === (year ?? years[0]?.year)) : shown), [all, papers, year, years, shown]);
  const inYear = all ? wholeYear.slice(0, cap) : wholeYear;
  const hidden = wholeYear.length - inYear.length;
  const states = useMemo(() => new Map(papers.map((p) => [p.key, paperState(entry.slug, p.key, q.sets, q.answers)])), [papers, entry.slug, q.sets, q.answers]);

  const open = useCallback((p: Paper) => {
    if (!meta) return;
    const st = states.get(p.key);
    if (st?.set) qa.open(st.set.id);
    else qa.start(paperSetInput(meta, p));
  }, [meta, states]);

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
  const total = inYear.length + (all ? 0 : more > 0 ? 1 : 0);
  const stop = Math.min(cur, total - 1);   // the one card in the tab order, kept inside the row when it gets shorter
  const attach = useCallback((i: number, el: HTMLButtonElement | null) => { cards.current[i] = el; }, []);

  const tier = data.state === "ready" ? data.tier : null;
  const kind = `${boardLabel(entry)} \u00b7 ${entry.level}${tier ? ` \u00b7 ${tier}` : ""}`;
  const heading = `${name} ${kind}`;
  const failed = data.state === "error";
  const ready = data.state === "ready";
  const mix = useCallback(() => onPick(entry.slug, true), [onPick, entry.slug]);
  const pick = useCallback(() => onPick(entry.slug, false), [onPick, entry.slug]);
  return (
    <section ref={box} className="qh-shelf" aria-labelledby={`${id}-h`} style={{ "--tint": tint } as React.CSSProperties} data-testid="shelf" data-slug={entry.slug}>
      <header className="qh-shelf-head">
        <div className="qh-shelf-title">
          <h2 id={`${id}-h`}><span className="qh-dot" aria-hidden="true" />{name}<span className="qs-sr"> {kind}</span></h2>
          <span className="qh-tag" aria-hidden="true">{kind}</span>
          {ready && <span className="qh-n">{papers.length} {papers.length === 1 ? "paper" : "papers"}</span>}
        </div>
        <div className="qh-acts">
          <ShelfPills onMix={mix} onPick={pick} name={name} />
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
        </div>
      </header>

      {all && (
        <div className="qh-years" role="group" aria-label={`${name} papers by year`}>
          {years.map((y) => <button key={y.year} type="button" className={`qs-chip${(year ?? years[0]?.year) === y.year ? " on" : ""}`} aria-pressed={(year ?? years[0]?.year) === y.year} onClick={() => { setYear(y.year); setCap(YEAR_PAGE); setCur(0); }}>{y.year}<span className="qh-yn">{y.n}</span></button>)}
        </div>
      )}

      {failed ? (
        <div className="qh-scroller" role="group" aria-label={`${name} papers`}>
          <ul className="qh-row qh-row-still"><li className="qh-item"><PaperRetry name={name} onRetry={() => setAttempt((a) => a + 1)} /></li></ul>
        </div>
      ) : !ready ? (
        <div className="qh-scroller" role="status" aria-label={`Loading ${name} papers`}>
          <ul className="qh-row qh-row-still" aria-hidden="true" inert>{GHOSTS.map((i) => <li key={i} className="qh-item"><PaperGhost n={i} /></li>)}</ul>
        </div>
      ) : (
        <div className={`qh-scroller${edge.r && !all ? " has-more" : ""}${edge.l && !all ? " has-less" : ""}`}>
          <ul ref={row} role="list" className={`qh-row${all ? " wrap" : ""}`} onKeyDown={onKey} aria-label={`${heading} past papers`}>
            {inYear.map((p, i) => (
              <li key={p.key} className="qh-item"><PaperCard paper={p} state={states.get(p.key)!} n={i} tint={tint} stop={stop === i} attach={attach} focused={setCur} onOpen={open} /></li>
            ))}
            {!all && more > 0 && (
              <li key="more" className="qh-item"><MoreCard more={more} tint={tint} n={inYear.length} stop={stop === inYear.length} attach={attach} focused={setCur} onClick={() => { setAll(true); setCap(YEAR_PAGE); setYear(papers[SHELF_PAPERS]?.year ?? null); setCur(0); }} /></li>
            )}
          </ul>
        </div>
      )}
      {all && ready && hidden > 0 && (
        <button type="button" className="qh-showmore" onClick={() => setCap((c) => c + YEAR_PAGE)} data-testid="show-more">Show {Math.min(hidden, YEAR_PAGE)} more<span>{hidden} left in {year ?? years[0]?.year}</span></button>
      )}
      {ready && papers.length === 0 && (
        <div className="qh-fail"><span>No papers here yet</span></div>
      )}
    </section>
  );
}
