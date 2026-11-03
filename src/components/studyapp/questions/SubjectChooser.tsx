"use client";

import { useMemo, useState } from "react";
import { fold } from "@/lib/studyapp/questions/picker";
import type { CatalogueSubject } from "@/lib/studyapp/questions/subject";
import { SearchIcon } from "./icons";

const LEVELS = ["GCSE", "A-Level", "International GCSE", "IGCSE", "Level 2", "Level 1/2", "Level 3"];
const TINT: Record<string, string> = { Chemistry: "var(--t-chem)", Physics: "var(--t-eng)", Biology: "var(--t-bio)", Maths: "var(--t-maths)", "Further Maths": "var(--t-fm)", "Combined Science": "var(--t-bio)" };
const tint = (subject: string) => TINT[subject.replace(/ [AB]$/, "")] ?? "var(--card2)";

/** Pick the subject: the level, the board, then a tile. Type to find one. */
export function SubjectChooser({ catalogue, recent, onPick, current }: { catalogue: CatalogueSubject[]; recent: string[]; onPick(slug: string): void; current: string | null }) {
  const levels = useMemo(() => LEVELS.filter((l) => catalogue.some((c) => c.level === l)), [catalogue]);
  const startLevel = (current && catalogue.find((c) => c.slug === current)?.level) || (levels.includes("GCSE") ? "GCSE" : levels[0]);
  const [level, setLevel] = useState(startLevel);
  const [board, setBoard] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const words = fold(q).split(/\s+/).filter(Boolean);
  const inLevel = catalogue.filter((c) => c.level === level);
  const boards = [...new Set(inLevel.map((c) => c.board))];
  const shown = words.length
    ? catalogue.filter((c) => words.every((w) => fold(c.title).includes(w))).slice(0, 60)
    : inLevel.filter((c) => !board || c.board === board);
  const recents = recent.map((s) => catalogue.find((c) => c.slug === s)).filter((c): c is CatalogueSubject => !!c).slice(0, 4);
  return (
    <section className="qs-choose" aria-label="Choose a subject" data-testid="subject-chooser">
      <label className="qs-search">
        <SearchIcon /><span className="qs-sr">Find a subject</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a subject, like AQA Chemistry" autoComplete="off" enterKeyHint="search" />
      </label>
      {recents.length > 0 && !words.length && (
        <div className="qs-recent">
          <span className="lbl">Lately</span>
          {recents.map((c) => <button key={c.slug} type="button" className="chip qs-chip-btn" onClick={() => onPick(c.slug)}>{c.title}</button>)}
        </div>
      )}
      {!words.length && (
        <>
          <div className="seg qs-levels" role="group" aria-label="Level">
            {levels.map((l) => <button key={l} type="button" className={l === level ? "on" : ""} aria-pressed={l === level} onClick={() => { setLevel(l); setBoard(null); }}>{l}</button>)}
          </div>
          <div className="qs-boards" role="group" aria-label="Exam board">
            <button type="button" className={`qs-pill${board === null ? " on" : ""}`} aria-pressed={board === null} onClick={() => setBoard(null)}>All boards</button>
            {boards.map((b) => <button key={b} type="button" className={`qs-pill${board === b ? " on" : ""}`} aria-pressed={board === b} onClick={() => setBoard(board === b ? null : b)}>{b}</button>)}
          </div>
        </>
      )}
      <ul className="qs-tiles">
        {shown.map((c) => (
          <li key={c.slug}>
            <button type="button" className={`qs-tile${c.slug === current ? " on" : ""}`} style={{ "--tint": tint(c.subject) } as React.CSSProperties} onClick={() => onPick(c.slug)} data-testid={`subject-${c.slug}`}>
              <b>{c.subject}</b>
              <span>{c.board} {c.level}</span>
              <small>{c.count.toLocaleString("en-GB")} parts</small>
            </button>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="qs-empty-line">No subject matches that.</p>}
    </section>
  );
}
