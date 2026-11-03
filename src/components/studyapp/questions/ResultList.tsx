"use client";

import { useEffect, useRef, useState } from "react";
import { partImage } from "@/lib/studyapp/questions/cropUrls";
import { questionKeyOf } from "@/lib/studyapp/questions/model";
import { snippet, windowOf, type BankRow } from "@/lib/studyapp/questions/picker";
import type { SubjectMeta } from "@/lib/studyapp/questions/subject";

export const ROW_H = 96;

/** The rows in view of a long list that scrolls with the page: only they are drawn. */
function useWindowRows(count: number, boxRef: React.RefObject<HTMLElement | null>) {
  const [range, setRange] = useState({ from: 0, to: 24 });
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = boxRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const next = windowOf(count, ROW_H, Math.max(0, -top), window.innerHeight);
      setRange((r) => (r.from === next.from && r.to === next.to ? r : next));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); if (raf) cancelAnimationFrame(raf); };
  }, [count, boxRef]);
  return range;
}

/**
 * The picker's results: thousands of rows, a screenful drawn. It is a listbox you can use with the keyboard (arrows,
 * Home, End, Space or Enter to tick, A or Shift+Enter to add the rest of the row's question). The row you are on is
 * always in the page, even when it has scrolled out of the window, so the screen reader never loses it.
 */
export function ResultList({ rows, meta, selected, done, groups, onToggle, onAddQuestion, full, label }: {
  rows: BankRow[]; meta: SubjectMeta; selected: ReadonlyMap<string, BankRow>; done: ReadonlySet<string>;
  groups: ReadonlyMap<string, BankRow[]>; onToggle(row: BankRow): void; onAddQuestion(rows: BankRow[]): void; full: boolean; label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const { from, to } = useWindowRows(rows.length, box);
  const [activeRaw, setActive] = useState(0);
  const active = Math.min(activeRaw, rows.length - 1);
  const name = (id: string, of: { id: string; name?: string; label?: string }[]) => of.find((x) => x.id === id);
  const move = (to2: number) => {
    const i = Math.max(0, Math.min(rows.length - 1, to2));
    setActive(i);
    const el = box.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY + i * ROW_H;
    if (top < window.scrollY + 160 || top + ROW_H > window.scrollY + window.innerHeight - 110) window.scrollTo({ top: top - window.innerHeight / 3 });
  };
  const siblingsLeft = (r: BankRow) => {
    const sibs = groups.get(questionKeyOf(r)) ?? [];
    return { sibs, rest: sibs.filter((s) => !selected.has(s.id)) };
  };
  const row = rows[active];
  // the window, plus the row you are on
  const idx: number[] = [];
  for (let i = from; i < Math.min(to, rows.length); i++) idx.push(i);
  if (row && (active < from || active >= to)) idx.push(active);
  return (
    <div
      ref={box} className="qs-list" role="listbox" aria-multiselectable="true" aria-label={label} tabIndex={0} style={{ height: rows.length * ROW_H }}
      aria-activedescendant={row ? `qrow-${row.id}` : undefined} data-testid="results" id="qs-results-list"
      onKeyDown={(e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const add = (e.key === "a" || e.key === "A" || (e.key === "Enter" && e.shiftKey)) && row;
        if (e.key === "ArrowDown") { e.preventDefault(); move(active + 1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); move(active - 1); }
        else if (e.key === "PageDown") { e.preventDefault(); move(active + 6); }
        else if (e.key === "PageUp") { e.preventDefault(); move(active - 6); }
        else if (e.key === "Home") { e.preventDefault(); move(0); }
        else if (e.key === "End") { e.preventDefault(); move(rows.length - 1); }
        else if (add) { e.preventDefault(); const { rest } = siblingsLeft(row); if (rest.length) onAddQuestion(rest); }
        else if ((e.key === " " || e.key === "Enter") && row) { e.preventDefault(); onToggle(row); }
      }}
    >
      {idx.map((i) => {
        const r = rows[i];
        const on = selected.has(r.id);
        const { sibs, rest } = siblingsLeft(r);
        const topic = meta.topics.find((t) => t.code === r.t[0]);
        const series = name(r.s, meta.series)?.label ?? r.s;
        const paper = name(r.p, meta.papers)?.name ?? r.p;
        const canAddAll = rest.length > 0 && sibs.length > 1;
        return (
          <div
            key={r.id} id={`qrow-${r.id}`} role="option" aria-selected={on} aria-setsize={rows.length} aria-posinset={i + 1}
            className={`qs-row${on ? " on" : ""}${i === active ? " cur" : ""}`} style={{ top: i * ROW_H, height: ROW_H - 8 }}
            onClick={(e) => {
              setActive(i);
              if (canAddAll && !full && (e.target as HTMLElement).closest("[data-addall]")) onAddQuestion(rest);
              else onToggle(r);
            }}
            data-testid="result-row" data-id={r.id}
          >
            <span className="qs-box" aria-hidden="true" />
            <span className="qs-thumb" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={partImage(r.id, "qp", meta.cv)} alt="" loading="lazy" decoding="async" draggable={false} />
            </span>
            <span className="qs-info">
              <span className="qs-info-top">
                <b>Q{r.l}</b>
                <span className="qs-marks">{r.m == null ? "no marks" : `${r.m} ${r.m === 1 ? "mark" : "marks"}`}</span>
                {done.has(r.id) && <span className="qs-done">done lately</span>}
              </span>
              <span className="qs-meta">{topic ? `${topic.short ?? topic.title} · ` : ""}{series} · {paper}</span>
              <span className="qs-x">{snippet(r.x)}</span>
            </span>
            {canAddAll && (
              // A tap target, not a button inside the option: the keyboard does the same with A (or Shift+Enter).
              <span className={`qs-addq${full ? " is-off" : ""}`} data-addall aria-hidden="true">{on ? "Add the rest" : "Whole question"}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
