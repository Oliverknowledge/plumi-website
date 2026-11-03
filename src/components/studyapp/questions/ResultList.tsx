"use client";

import { useEffect, useRef, useState } from "react";
import { partImage } from "@/lib/studyapp/questions/cropUrls";
import { questionKeyOf } from "@/lib/studyapp/questions/model";
import { windowOf, type BankRow } from "@/lib/studyapp/questions/picker";
import type { SubjectMeta } from "@/lib/studyapp/questions/subject";

export const ROW_H = 100;

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
 * The picker's results: thousands of rows, a screenful drawn. It is a listbox you can use with the keyboard
 * (arrows, Home, End, Space or Enter to tick), and each row can add the rest of its question.
 */
export function ResultList({ rows, meta, selected, done, groups, onToggle, onAddQuestion, full }: {
  rows: BankRow[]; meta: SubjectMeta; selected: ReadonlyMap<string, BankRow>; done: ReadonlySet<string>;
  groups: ReadonlyMap<string, BankRow[]>; onToggle(row: BankRow): void; onAddQuestion(rows: BankRow[]): void; full: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const { from, to } = useWindowRows(rows.length, box);
  const [active, setActive] = useState(0);
  const names = (id: string, of: { id: string; name?: string; label?: string }[]) => of.find((x) => x.id === id);
  const move = (to2: number) => {
    const i = Math.max(0, Math.min(rows.length - 1, to2));
    setActive(i);
    const el = box.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY + i * ROW_H;
    if (top < window.scrollY + 140 || top + ROW_H > window.scrollY + window.innerHeight - 100) window.scrollTo({ top: top - window.innerHeight / 3 });
  };
  const row = rows[Math.min(active, rows.length - 1)];
  return (
    <div
      ref={box} className="qs-list" role="listbox" aria-multiselectable="true" aria-label={`${rows.length} questions`} tabIndex={0} style={{ height: rows.length * ROW_H }}
      aria-activedescendant={row ? `qrow-${row.id}` : undefined} data-testid="results"
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); move(active + 1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); move(active - 1); }
        else if (e.key === "PageDown") { e.preventDefault(); move(active + 6); }
        else if (e.key === "PageUp") { e.preventDefault(); move(active - 6); }
        else if (e.key === "Home") { e.preventDefault(); move(0); }
        else if (e.key === "End") { e.preventDefault(); move(rows.length - 1); }
        else if ((e.key === " " || e.key === "Enter") && row) { e.preventDefault(); onToggle(row); }
      }}
    >
      {rows.slice(from, to).map((r, k) => {
        const i = from + k;
        const on = selected.has(r.id);
        const sibs = groups.get(questionKeyOf(r)) ?? [];
        const rest = sibs.filter((s) => !selected.has(s.id));
        const topic = meta.topics.find((t) => t.code === r.t[0]);
        const series = names(r.s, meta.series)?.label ?? r.s;
        const paper = names(r.p, meta.papers)?.name ?? r.p;
        return (
          <div
            key={r.id} id={`qrow-${r.id}`} role="option" aria-selected={on} className={`qs-row${on ? " on" : ""}${i === active ? " cur" : ""}`} style={{ top: i * ROW_H, height: ROW_H - 8 }}
            onClick={() => { setActive(i); onToggle(r); }} data-testid="result-row" data-id={r.id}
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
                {topic && <span className="qs-topic">{topic.short ?? topic.title}</span>}
                {done.has(r.id) && <span className="qs-done">done lately</span>}
              </span>
              <span className="qs-meta">{series} · {paper}</span>
              <span className="qs-x">{r.x}</span>
            </span>
            {rest.length > 0 && sibs.length > 1 && (
              <button type="button" className="qs-addq" tabIndex={-1} disabled={full}
                onClick={(e) => { e.stopPropagation(); onAddQuestion(rest); }} aria-label={`Add all ${sibs.length} parts of question ${r.l.replace(/\D.*$/, "")}`}>
                + all {sibs.length}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
