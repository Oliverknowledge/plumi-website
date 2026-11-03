"use client";

import { useMemo, useState } from "react";
import { fold } from "@/lib/studyapp/questions/picker";
import { subjectOrder, subjectTint, type CatalogueSubject } from "@/lib/studyapp/questions/subject";
import { SearchIcon } from "./icons";

const MAIN = ["GCSE", "A-Level"];
const OTHER = ["International GCSE", "IGCSE", "Level 2", "Level 1/2", "Level 3"];
const tint = subjectTint;

const KEY = "plumi-qs-chooser";
/** The level and board last chosen here: a per-visitor convenience, so it must not matter if the browser will not keep it. */
function remembered(): { level?: string; board?: string | null } {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
function remember(level: string, board: string | null) {
  try { localStorage.setItem(KEY, JSON.stringify({ level, board })); } catch { /* not kept */ }
}

/** Pick the subject: GCSE or A-Level (the others under More), the board if there is a choice, then a tile. Type to find one. */
export function SubjectChooser({ catalogue, recent, onPick, current }: { catalogue: CatalogueSubject[]; recent: string[]; onPick(slug: string): void; current: string | null }) {
  const has = useMemo(() => new Set(catalogue.map((c) => c.level)), [catalogue]);
  const [start] = useState(() => {
    const cur = current ? catalogue.find((c) => c.slug === current) : undefined;
    if (cur) return { level: cur.level, board: cur.board as string | null };
    const mem = remembered();
    if (mem.level && has.has(mem.level)) return { level: mem.level, board: mem.board && catalogue.some((c) => c.level === mem.level && c.board === mem.board) ? mem.board : null };
    return { level: has.has("GCSE") ? "GCSE" : [...has][0], board: null as string | null };
  });
  const [level, setLevel] = useState(start.level);
  const [board, setBoard] = useState<string | null>(start.board);
  const [more, setMore] = useState(!MAIN.includes(start.level));
  const [q, setQ] = useState("");
  const words = fold(q).split(/\s+/).filter(Boolean);
  const mains = MAIN.filter((l) => has.has(l));
  const others = OTHER.filter((l) => has.has(l));
  const inLevel = catalogue.filter((c) => c.level === level);
  const boards = [...new Set(inLevel.map((c) => c.board))];
  const shown = (words.length
    ? catalogue.filter((c) => words.every((w) => fold(c.title).includes(w))).slice(0, 60)
    : inLevel.filter((c) => !board || c.board === board)
  ).slice().sort((a, b) => subjectOrder(a.subject) - subjectOrder(b.subject) || a.subject.localeCompare(b.subject) || a.board.localeCompare(b.board));
  const grouped = !words.length && !board && boards.length > 1;
  const groups = grouped ? boards.map((b) => ({ board: b, items: shown.filter((c) => c.board === b) })) : [{ board: "", items: shown }];
  const recents = recent.map((s) => catalogue.find((c) => c.slug === s)).filter((c): c is CatalogueSubject => !!c).slice(0, 4);
  const pickLevel = (l: string) => { setLevel(l); setBoard(null); remember(l, null); };
  const pickBoard = (b: string | null) => { setBoard(b); remember(level, b); };
  const tile = (c: CatalogueSubject, quiet: boolean) => (
    <li key={c.slug}>
      <button type="button" className={`qs-tile${c.slug === current ? " on" : ""}`} style={{ "--tint": tint(c.subject) } as React.CSSProperties} onClick={() => onPick(c.slug)} data-testid={`subject-${c.slug}`}>
        <b>{c.subject}</b>
        {!quiet && <span>{c.board} {c.level}</span>}
        <small>{c.count.toLocaleString("en-GB")} questions</small>
      </button>
    </li>
  );
  return (
    <section className="qs-choose" aria-label="Choose a subject" data-testid="subject-chooser">
      <label className="qs-search">
        <SearchIcon /><span className="qs-sr">Find a subject</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a subject, like AQA Chemistry" autoComplete="off" enterKeyHint="search" />
      </label>
      {recents.length > 0 && !words.length && (
        <div className="qs-recent">
          <span className="lbl">Lately</span>
          {recents.map((c) => <button key={c.slug} type="button" className="qs-chip" onClick={() => onPick(c.slug)}>{c.title}</button>)}
        </div>
      )}
      {!words.length && (
        <div className="qs-pickers">
          <div className="qs-levels" role="group" aria-label="Level">
            {mains.map((l) => <button key={l} type="button" className={`qs-level${l === level ? " on" : ""}`} aria-pressed={l === level} onClick={() => pickLevel(l)}>{l}</button>)}
            {others.length > 0 && <button type="button" className={`qs-level qs-more${more || !MAIN.includes(level) ? " open" : ""}`} aria-expanded={more} onClick={() => setMore((m) => !m)}>More</button>}
          </div>
          {(more || !MAIN.includes(level)) && others.length > 0 && (
            <div className="qs-levels qs-levels-more" role="group" aria-label="Other levels">
              {others.map((l) => <button key={l} type="button" className={`qs-chip${l === level ? " on" : ""}`} aria-pressed={l === level} onClick={() => pickLevel(l)}>{l}</button>)}
            </div>
          )}
          {boards.length > 1 && (
            <div className="qs-boards" role="group" aria-label="Exam board">
              <button type="button" className={`qs-chip${board === null ? " on" : ""}`} aria-pressed={board === null} onClick={() => pickBoard(null)}>All boards</button>
              {boards.map((b) => <button key={b} type="button" className={`qs-chip${board === b ? " on" : ""}`} aria-pressed={board === b} onClick={() => pickBoard(board === b ? null : b)}>{b}</button>)}
            </div>
          )}
        </div>
      )}
      {groups.map((g) => (
        <div key={g.board || "all"} className="qs-group">
          {g.board && <h2 className="qs-group-h">{g.board}</h2>}
          <ul className="qs-tiles">{g.items.map((c) => tile(c, !!g.board))}</ul>
        </div>
      ))}
      {shown.length === 0 && <p className="qs-empty-line">No subject matches that.</p>}
    </section>
  );
}
