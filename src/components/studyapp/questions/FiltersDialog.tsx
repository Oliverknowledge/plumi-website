"use client";

import { useEffect, useMemo, useRef } from "react";
import { areaState, BANDS, toggleArea, type Band, type Filters } from "@/lib/studyapp/questions/picker";
import type { SubjectMeta } from "@/lib/studyapp/questions/subject";
import { CloseIcon } from "./icons";

/** The topic as a chip reads: its name, without the specification's number (a 15 year old does not know what "4.5.6" is). */
export const topicName = (t: SubjectMeta["topics"][number]) => t.short ?? t.title;

/**
 * Filters: topics (an area of the specification is one tap), paper, series and marks, in a sheet over the list. The list
 * behind it changes as you choose, and "Show N questions" puts the sheet away. A native dialog: Escape closes it,
 * Tab stays inside it, and focus goes back to the Filters button.
 */
export function FiltersDialog({ meta, topics, filters, onFilters, onTopics, showScheme, count, onClose }: {
  meta: SubjectMeta; topics: string[]; filters: Filters; onFilters(next: Partial<Filters>): void; onTopics(next: string[]): void;
  showScheme: boolean; count: number; onClose(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  const by = useMemo(() => {
    const m = new Map<string, SubjectMeta["topics"]>();
    for (const t of meta.topics) { const a = m.get(t.section); if (a) a.push(t); else m.set(t.section, [t]); }
    return m;
  }, [meta]);
  const areas = meta.sections.filter((s) => by.has(s.code));
  const loose = meta.topics.filter((t) => !meta.sections.some((s) => s.code === t.section));
  const grouped = meta.topics.length > 14 && areas.length > 1;
  const chip = (t: SubjectMeta["topics"][number]) => {
    const on = topics.includes(t.code);
    return (
      <button key={t.code} type="button" className={`qs-pill${on ? " on" : ""}`} aria-pressed={on} data-testid="topic-chip"
        onClick={() => onTopics(on ? topics.filter((c) => c !== t.code) : [...topics, t.code])}>{topicName(t)}</button>
    );
  };
  const nothing = !topics.length && !filters.paper && !filters.series && filters.band === "any" && !filters.scheme;
  const clear = () => { onTopics([]); onFilters({ paper: null, series: null, band: "any", scheme: false }); };
  return (
    <dialog ref={ref} className="qs-dialog qs-fdlg card" aria-label="Filters" onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }} data-testid="filters-dialog">
      <div className="qs-dialog-head">
        <h2>Filters</h2>
        <span className="qs-dialog-acts">
          {!nothing && <button type="button" className="qs-link" onClick={clear}>Clear all</button>}
          <button type="button" className="btn ghost icon" aria-label="Close" onClick={() => ref.current?.close()}><CloseIcon /></button>
        </span>
      </div>
      <div className="qs-fscroll">
        <section className="qs-fsec" aria-label="Topics">
          <h3 className="lbl">Topics</h3>
          {grouped ? (
            areas.map((s) => {
              const ts = by.get(s.code)!;
              const st = areaState(ts.map((t) => t.code), topics);
              return (
                <div key={s.code} className="qs-area">
                  <button type="button" className={`qs-area-btn${st !== "none" ? " on" : ""}`} aria-pressed={st === "all" ? true : st === "some" ? "mixed" : false} onClick={() => onTopics(toggleArea(topics, ts.map((t) => t.code)))}>
                    <span className={`qs-box${st === "some" ? " part" : ""}`} aria-hidden="true" />{s.title}
                  </button>
                  <div className="qs-pills">{ts.map(chip)}</div>
                </div>
              );
            })
          ) : (
            <div className="qs-pills">{meta.topics.map(chip)}</div>
          )}
          {grouped && loose.length > 0 && <div className="qs-pills">{loose.map(chip)}</div>}
        </section>

        {meta.papers.length > 1 && (
          <section className="qs-fsec" aria-label="Paper">
            <h3 className="lbl">Paper</h3>
            <div className="qs-pills">
              <button type="button" className={`qs-pill${!filters.paper ? " on" : ""}`} aria-pressed={!filters.paper} onClick={() => onFilters({ paper: null })}>Any</button>
              {meta.papers.map((p) => <button key={p.id} type="button" className={`qs-pill${filters.paper === p.id ? " on" : ""}`} aria-pressed={filters.paper === p.id} onClick={() => onFilters({ paper: filters.paper === p.id ? null : p.id })}>{p.name}</button>)}
            </div>
          </section>
        )}
        {meta.series.length > 1 && (
          <section className="qs-fsec" aria-label="Series">
            <h3 className="lbl">Series</h3>
            <div className="qs-pills">
              <button type="button" className={`qs-pill${!filters.series ? " on" : ""}`} aria-pressed={!filters.series} onClick={() => onFilters({ series: null })}>Any</button>
              {meta.series.map((s) => <button key={s.id} type="button" className={`qs-pill${filters.series === s.id ? " on" : ""}`} aria-pressed={filters.series === s.id} onClick={() => onFilters({ series: filters.series === s.id ? null : s.id })}>{s.label}</button>)}
            </div>
          </section>
        )}
        <section className="qs-fsec" aria-label="Marks">
          <h3 className="lbl">Marks</h3>
          <div className="qs-pills">
            {BANDS.map((b) => <button key={b.id} type="button" className={`qs-pill${filters.band === b.id ? " on" : ""}`} aria-pressed={filters.band === b.id} onClick={() => onFilters({ band: b.id as Band })}>{b.label}</button>)}
          </div>
        </section>
        {showScheme && (
          <section className="qs-fsec" aria-label="Mark scheme">
            <button type="button" className={`qs-pill qs-wide${filters.scheme ? " on" : ""}`} aria-pressed={filters.scheme} onClick={() => onFilters({ scheme: !filters.scheme })}>Only with a mark scheme</button>
          </section>
        )}
      </div>
      <div className="qs-fdone">
        <button type="button" className="btn gold" onClick={() => ref.current?.close()} data-testid="filters-done">
          {count === 0 ? "Nothing matches" : `Show ${count.toLocaleString("en-GB")} ${count === 1 ? "question" : "questions"}`}
        </button>
      </div>
    </dialog>
  );
}
