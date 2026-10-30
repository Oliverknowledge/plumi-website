"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useBankMarks } from "@/lib/bankProgress";

/**
 * The hub's shelves (BankPages.tsx shapes them on the server): a shelf a level, a book a subject, and
 * on each book a key a board, so GCSE Maths is one book with AQA, Edexcel, OCR and Cambridge on it,
 * not three blue books in a row (the founder, 30 October 2026). Every bank is still a plain link in
 * the server's HTML; the search and "Your subjects" only hide and add to what's there.
 */

export interface ShelfBank { slug: string; board: string; title: string; count: number; years: string; find: string }
export interface ShelfBook { subject: string; colour: string; count: number; banks: ShelfBank[] }
export interface Shelf { id: string; name: string; jump: string; books: ShelfBook[] }

/* The banks a student opened lately, newest first: written by RememberBank on a bank's page. */
const RECENT_KEY = "plumi-bank-recent:v1";
const RECENT_MAX = 4;
const recentListeners = new Set<() => void>();
let recentMemory = "";
const readRecent = () => { try { return localStorage.getItem(RECENT_KEY) ?? recentMemory; } catch { return recentMemory; } };
const subscribeRecent = (cb: () => void) => { recentListeners.add(cb); return () => { recentListeners.delete(cb); }; };
const parseRecent = (raw: string): string[] => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v.filter(x => typeof x === "string") : []; } catch { return []; } };

/** On a bank's page: puts it at the front of the hub's "Your subjects". */
export function RememberBank({ slug }: { slug: string }) {
  useEffect(() => {
    const next = JSON.stringify([slug, ...parseRecent(readRecent()).filter(s => s !== slug)].slice(0, RECENT_MAX));
    recentMemory = next;
    try { localStorage.setItem(RECENT_KEY, next); } catch { /* memory only */ }
    recentListeners.forEach(cb => cb());
  }, [slug]);
  return null;
}

/**
 * A bank's row of boards (BankPages.tsx OtherBoards). On a phone the row scrolls sideways rather
 * than wrapping onto a second line over the questions, so it starts scrolled to the board you're on.
 */
export function BoardRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const row = ref.current, on = row?.querySelector<HTMLElement>(".is-on");
    if (row && on && on.offsetLeft + on.offsetWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - 18;
  }, []);
  return <nav ref={ref} className="qb-boards-here" aria-label="Exam board">{children}</nav>;
}

const words = (q: string) => q.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
const n = (x: number) => x.toLocaleString("en-GB");

function YourSubjects({ banks }: { banks: Map<string, ShelfBank & { colour: string }> }) {
  const raw = useSyncExternalStore(subscribeRecent, readRecent, () => "");
  const marks = useBankMarks();
  // Opened lately first, then any bank with marks in it the list has forgotten.
  const slugs = [...new Set([...parseRecent(raw), ...Object.keys(marks.subjects).filter(s => Object.keys(marks.subjects[s]).length)])]
    .filter(s => banks.has(s)).slice(0, RECENT_MAX);
  if (!slugs.length) return null;
  return (
    <nav className="qb-mine" aria-labelledby="qb-mine-h">
      <h2 id="qb-mine-h" className="qb-mine-h">Your subjects</h2>
      <ul>
        {slugs.map(s => {
          const b = banks.get(s)!;
          const marked = Object.keys(marks.subjects[s] ?? {}).length;
          return (
            <li key={s}>
              <Link href={`/question-bank/${s}`} style={{ "--bk": b.colour } as CSSProperties}>
                <i aria-hidden="true" />
                <span>{b.title}</span>
                {marked > 0 && <small>{n(marked)} marked</small>}
                <b aria-hidden="true">→</b>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function BankShelves({ shelves }: { shelves: Shelf[] }) {
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query);
  const terms = useMemo(() => words(q), [q]);
  const matches = (b: ShelfBank) => terms.every(t => b.find.includes(t));
  const shown = shelves.map(sh => ({
    ...sh,
    books: sh.books.map(bk => ({ ...bk, banks: terms.length ? bk.banks.filter(matches) : bk.banks })).filter(bk => bk.banks.length),
  })).filter(sh => sh.books.length);
  const found = shown.reduce((a, sh) => a + sh.books.reduce((b, bk) => b + bk.banks.length, 0), 0);
  const all = useMemo(() => new Map(shelves.flatMap(sh => sh.books.flatMap(bk => bk.banks.map(b => [b.slug, { ...b, colour: bk.colour }] as const)))), [shelves]);

  return (
    <>
      <div className="qb-find">
        <label className="qb-find-box">
          <span className="qb-sr">Find your subject</span>
          <svg viewBox="0 0 8 8" aria-hidden="true" shapeRendering="crispEdges"><path fill="currentColor" d="M2 0h3v1H2zM1 1h1v1H1zM5 1h1v1H5zM0 2h1v3H0zM6 2h1v3H6zM1 5h1v1H1zM5 5h1v1H5zM2 6h3v-1H2zM6 6h1v1H6zM7 7h1v1H7z" /></svg>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find your subject, e.g. “aqa chem”" autoComplete="off" enterKeyHint="search" />
        </label>
        <nav className="qb-jump" aria-label="Levels">
          {shelves.map(sh => <a key={sh.id} href={`#${sh.id}`}>{sh.jump}</a>)}
        </nav>
      </div>
      <p className="qb-sr" role="status">{terms.length ? `${found} ${found === 1 ? "bank" : "banks"} found` : ""}</p>

      {!terms.length && <YourSubjects banks={all} />}

      {shown.map(sh => (
        <section key={sh.id} id={sh.id} className="qb-shelf" aria-labelledby={`${sh.id}-h`}>
          <h2 id={`${sh.id}-h`} className="qb-shelf-name">{sh.name} <span>{sh.books.length} {sh.books.length === 1 ? "subject" : "subjects"}</span></h2>
          <ul className="qb-books">
            {sh.books.map(bk => (
              <li key={bk.subject} className="lp-book qb-book" style={{ "--bk": bk.colour } as CSSProperties}>
                <div className="lp-book-cover qb-book-cover">
                  <h3 className="lp-book-plate qb-book-plate">{bk.subject}</h3>
                  <span className="qb-book-total">{n(bk.count)} questions</span>
                  <i className="lp-book-rib" aria-hidden="true" />
                </div>
                <ul className="qb-keys-board" aria-label={`${sh.jump} ${bk.subject}: pick your exam board`}>
                  {bk.banks.map(b => (
                    <li key={b.slug} className={b.board.length > 12 ? "is-wide" : undefined}>
                      <Link href={`/question-bank/${b.slug}`} title={`${b.title}, ${b.years}`}>
                        <span className="qb-sr">{b.title}, </span>
                        <span aria-hidden="true">{b.board}</span>
                        <small>{n(b.count)}<span className="qb-sr"> questions</span></small>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <div className="qb-plank" aria-hidden="true" />
        </section>
      ))}

      {terms.length > 0 && !found && (
        <div className="lp-card qb-none">
          <p><strong>No bank for “{query.trim()}” yet.</strong> Try just the subject, or the board’s name.</p>
          <button type="button" className="lp-btn" onClick={() => setQuery("")}>Show every subject</button>
        </div>
      )}
    </>
  );
}
