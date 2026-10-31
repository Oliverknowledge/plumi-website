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

/* A string kept in localStorage, read live, with memory to fall back on when storage is off (private windows). */
function localString(key: string) {
  const listeners = new Set<() => void>();
  let memory = "";
  return {
    read: () => { try { return localStorage.getItem(key) ?? memory; } catch { return memory; } },
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => { if (e.key === key) cb(); };
      window.addEventListener("storage", onStorage);
      return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
    },
    write: (value: string) => {
      memory = value;
      try { localStorage.setItem(key, value); } catch { /* memory only */ }
      listeners.forEach(cb => cb());
    },
  };
}
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/* The banks a student opened lately, newest first: written by RememberBank on a bank's page. */
const RECENT_MAX = 4;
const recent = localString("plumi-bank-recent:v1");
const parseRecent = (raw: string): string[] => { try { return strings(JSON.parse(raw)); } catch { return []; } };

/*
 * The student's own say over "Your subjects": the banks they added, in the order they added them,
 * and the ones they took off, which opening or marking them again doesn't bring back.
 */
const PINNED_MAX = 12;
const mine = localString("plumi-bank-mine:v1");
const parseMine = (raw: string) => { try { const v = JSON.parse(raw); return { pinned: strings(v?.pinned), hidden: strings(v?.hidden) }; } catch { return { pinned: [], hidden: [] }; } };

/** On a bank's page: puts it at the front of the hub's "Your subjects". */
export function RememberBank({ slug }: { slug: string }) {
  useEffect(() => {
    recent.write(JSON.stringify([slug, ...parseRecent(recent.read()).filter(s => s !== slug)].slice(0, RECENT_MAX)));
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

const Glass = () => (
  <svg viewBox="0 0 8 8" aria-hidden="true" shapeRendering="crispEdges"><path fill="currentColor" d="M2 0h3v1H2zM1 1h1v1H1zM5 1h1v1H5zM0 2h1v3H0zM6 2h1v3H6zM1 5h1v1H1zM5 5h1v1H5zM2 6h3v-1H2zM6 6h1v1H6zM7 7h1v1H7z" /></svg>
);

type HubBank = ShelfBank & { colour: string };

/**
 * "Your subjects": the banks you added, then up to four more you opened or marked lately. "+ Add"
 * opens a search to pick from; Edit puts a cross on each, and a bank taken off stays off until it's
 * added again.
 */
function YourSubjects({ banks }: { banks: Map<string, HubBank> }) {
  const recentRaw = useSyncExternalStore(recent.subscribe, recent.read, () => "");
  const mineRaw = useSyncExternalStore(mine.subscribe, mine.read, () => "");
  const marks = useBankMarks();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [said, setSaid] = useState("");
  const addRef = useRef<HTMLButtonElement>(null);
  const pickRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);

  const { pinned, hidden } = parseMine(mineRaw);
  const ours = pinned.filter(s => banks.has(s));
  // Adding one never pushes another off: yours first, then up to four you opened or marked lately.
  const lately = [...new Set([...parseRecent(recentRaw), ...Object.keys(marks.subjects).filter(s => Object.keys(marks.subjects[s]).length)])]
    .filter(s => banks.has(s) && !hidden.includes(s) && !ours.includes(s)).slice(0, RECENT_MAX);
  const shown = [...ours, ...lately];
  const edit = editing && shown.length > 0;

  const terms = words(q);
  const found = terms.length ? [...banks.values()].filter(b => terms.every(t => b.find.includes(t))).slice(0, 7) : [];

  const save = (next: { pinned: string[]; hidden: string[] }) => mine.write(JSON.stringify({ pinned: next.pinned.slice(-PINNED_MAX), hidden: next.hidden.slice(0, 60) }));
  const add = (s: string) => {
    save({ pinned: [...pinned.filter(x => x !== s), s], hidden: hidden.filter(x => x !== s) });
    setSaid(`${banks.get(s)!.title} added to your subjects`);
  };
  const remove = (s: string, focusNext?: boolean) => {
    const i = shown.indexOf(s);
    save({ pinned: pinned.filter(x => x !== s), hidden: [s, ...hidden.filter(x => x !== s)] });
    setSaid(`${banks.get(s)!.title} taken off your subjects`);
    // Keep the keyboard where it was: on the next cross along, or on Done once none are left.
    if (focusNext) requestAnimationFrame(() => {
      const crosses = document.querySelectorAll<HTMLButtonElement>(".qb-mine-x");
      (crosses[Math.min(i, crosses.length - 1)] ?? editRef.current)?.focus();
    });
  };
  const close = () => { setAdding(false); setQ(""); addRef.current?.focus(); };

  // The picker closes on a tap anywhere else, as a menu would.
  useEffect(() => {
    if (!adding) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pickRef.current?.contains(t) && !addRef.current?.contains(t)) { setAdding(false); setQ(""); }
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [adding]);

  return (
    <nav className={`qb-mine${edit ? " is-editing" : ""}${shown.length ? "" : " is-empty"}`} aria-labelledby="qb-mine-h">
      <div className="qb-mine-top">
        <h2 id="qb-mine-h" className="qb-mine-h">Your subjects</h2>
        {!edit && (
          <button ref={addRef} type="button" className="qb-mine-add" aria-expanded={adding} aria-controls="qb-mine-pick" onClick={() => (adding ? close() : setAdding(true))}>
            <span aria-hidden="true">+</span>{shown.length ? "Add" : "Add your subjects"}
          </button>
        )}
        {shown.length > 0 && (
          <button ref={editRef} type="button" className="qb-mine-edit" aria-pressed={edit} onClick={() => { setEditing(!edit); setAdding(false); }}>
            {edit ? "Done" : "Edit"}
          </button>
        )}
        {adding && (
          <div id="qb-mine-pick" ref={pickRef} className="qb-mine-pick" role="group" aria-label="Add a subject"
            onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); close(); } }}>
            <label className="qb-find-box qb-mine-find">
              <span className="qb-sr">Find a subject to add</span>
              <Glass />
              <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. “edexcel physics”" autoComplete="off" enterKeyHint="done" autoFocus
                onKeyDown={e => { if (e.key === "Enter" && found[0]) { e.preventDefault(); if (!shown.includes(found[0].slug)) add(found[0].slug); setQ(""); } }} />
            </label>
            {found.length ? (
              <ul>
                {found.map(b => {
                  const on = shown.includes(b.slug);
                  return (
                    <li key={b.slug}>
                      <button type="button" aria-pressed={on} className={on ? "is-on" : ""} style={{ "--bk": b.colour } as CSSProperties} onClick={() => (on ? remove(b.slug) : add(b.slug))}>
                        <i aria-hidden="true" />
                        <span>{b.title}</span>
                        <small aria-hidden="true">{on ? "✓ Added" : "+ Add"}</small>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="qb-mine-hint">{terms.length ? <>No bank for “{q.trim()}” yet. Try just the subject.</> : "Type a subject, a board or both."}</p>
            )}
          </div>
        )}
      </div>
      {shown.length > 0 && <ul>
        {shown.map(s => {
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
              {edit && (
                <button type="button" className="qb-mine-x" aria-label={`Take ${b.title} off your subjects`}
                  onClick={e => remove(s, e.detail === 0)}>
                  <svg viewBox="0 0 5 5" aria-hidden="true" shapeRendering="crispEdges"><path fill="currentColor" d="M0 0h1v1H0zM4 0h1v1H4zM1 1h1v1H1zM3 1h1v1H3zM2 2h1v1H2zM1 3h1v1H1zM3 3h1v1H3zM0 4h1v1H0zM4 4h1v1H4z" /></svg>
                </button>
              )}
            </li>
          );
        })}
      </ul>}

      <p className="qb-sr" role="status">{said}</p>
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
          <Glass />
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
