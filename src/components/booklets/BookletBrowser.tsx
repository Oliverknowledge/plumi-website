"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";

/**
 * The booklets themselves, on the hub and on each group's page: a search box, filters, cards or a compact list,
 * and a viewer that opens a booklet on the page. Every booklet is rendered on the server as well, so the page
 * works and is indexed before this runs; filtering only hides what doesn't match.
 *
 * The viewer is the browser's own PDF viewer in a dialog. Phones (and anything narrower than VIEWER_MIN) open
 * the PDF in a new tab instead, because an embedded PDF there shows only its first page, or nothing.
 */

export interface BrowserItem {
  slug: string;
  title: string;
  kind?: string;
  modules?: string[];
  stars?: [number, number];
  questions: number;
  pages: number;
  size: string;
  questionsOnlySize?: string;
  pdf: string;
  questionsPdf?: string;
  preview: string;
  previewSize: [number, number];
  group: string;
  /** Searched as well as the title: the group's and shelf's names. */
  context: string;
}

export interface BrowserSection { id: string; title: string; href?: string; items: BrowserItem[] }

type View = "cards" | "list";
const VIEW_KEY = "plumi-booklets-view";
const VIEWER_MIN = "(min-width: 760px)";

const readView = (): View | null => {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "cards" || v === "list" ? v : null;
  } catch { return null; } // private mode, blocked storage: the page's default
};
const subscribeStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

const fold = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const stars = (n: number) => "★".repeat(n);
const starLabel = ([lo, hi]: [number, number]) => (lo === hi ? stars(lo) : `${stars(lo)}–${stars(hi)}`);
const plural = (n: number, one: string) => `${n.toLocaleString("en-GB")} ${one}${n === 1 ? "" : "s"}`;

const DIFFICULTY = {
  any: { label: "Any difficulty", test: () => true },
  easy: { label: "Starts easy (★–★★)", test: (b: BrowserItem) => !!b.stars && b.stars[0] <= 2 },
  hard: { label: "Has ★★★★★ questions", test: (b: BrowserItem) => !!b.stars && b.stars[1] >= 5 },
} as const;
type Difficulty = keyof typeof DIFFICULTY;

export function BookletBrowser({ sections, sectionLabel, page, defaultView, placeholder }: {
  sections: BrowserSection[];
  /** What a section chip filters by: "Group" on the hub, "Topic" on a group's page. */
  sectionLabel: string;
  /** For analytics: "hub" or the group's slug. */
  page: string;
  defaultView: View;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [module, setModule] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("any");
  const [questionsOnly, setQuestionsOnly] = useState(false);
  // The view a visitor last picked, remembered in this browser; the server renders the page's default.
  const saved = useSyncExternalStore(subscribeStorage, readView, () => null);
  const [chosen, setChosen] = useState<View | null>(null);
  const view = chosen ?? saved ?? defaultView;
  const [open, setOpen] = useState<{ item: BrowserItem; questions: boolean } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const chooseView = (v: View) => {
    setChosen(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* not remembered, still works */ }
  };

  const all = useMemo(() => sections.flatMap(s => s.items), [sections]);
  const kinds = useMemo(() => [...new Set(all.map(b => b.kind).filter(Boolean))] as string[], [all]);
  const modules = useMemo(() => [...new Set(all.flatMap(b => b.modules ?? []))].sort(), [all]);
  const hasStars = all.some(b => b.stars);
  const hasQuestionsOnly = all.some(b => b.questionsPdf);

  const words = fold(query).split(" ").filter(Boolean);
  const matches = (b: BrowserItem) => {
    if (kind && b.kind !== kind) return false;
    if (module && !b.modules?.includes(module)) return false;
    if (!DIFFICULTY[difficulty].test(b)) return false;
    if (questionsOnly && !b.questionsPdf) return false;
    if (!words.length) return true;
    const hay = fold(`${b.title} ${b.kind ?? ""} ${(b.modules ?? []).join(" ")} ${b.context}`);
    return words.every(w => hay.includes(w));
  };
  const shown = sections
    .filter(s => !section || s.id === section)
    .map(s => ({ ...s, items: s.items.filter(matches) }))
    .filter(s => s.items.length);
  const count = shown.reduce((n, s) => n + s.items.length, 0);
  const filtered = Boolean(words.length || section || kind || module || difficulty !== "any" || questionsOnly);
  const clear = () => { setQuery(""); setSection(null); setKind(null); setModule(null); setDifficulty("any"); setQuestionsOnly(false); };

  // A search that settles is worth knowing about (what students look for and don't find); each keystroke isn't.
  useEffect(() => {
    if (!words.length) return;
    const t = setTimeout(() => track("booklet_searched", { page, query: query.trim().slice(0, 60), results: count }), 1200);
    return () => clearTimeout(t);
  }, [query, count, page, words.length]);

  const view_ = (item: BrowserItem, questions: boolean) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    if (!window.matchMedia(VIEWER_MIN).matches) return; // a phone: the new tab
    event.preventDefault();
    setOpen({ item, questions });
  };
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const fileLinks = (b: BrowserItem, compact = false) => (
    <>
      <a className="pp-file is-qp" href={b.pdf} target="_blank" rel="noopener" onClick={view_(b, false)}
        data-booklet={b.slug} data-group={b.group} data-kind="full"
        aria-label={`Open ${b.title}${b.kind ? ` (${b.kind.toLowerCase()})` : ""}, with answers and worked solutions (PDF, ${b.size})`}>
        {compact ? "Open" : "Open booklet"}
      </a>
      {b.questionsPdf && (
        <a className="pp-file is-ms" href={b.questionsPdf} target="_blank" rel="noopener" onClick={view_(b, true)}
          data-booklet={b.slug} data-group={b.group} data-kind="questions"
          aria-label={`${b.title}, questions only (PDF, ${b.questionsOnlySize})`}>
          {compact ? "Questions" : "Questions only"}
        </a>
      )}
    </>
  );

  const tags = (b: BrowserItem) => (b.kind || b.modules || b.stars) ? (
    <span className="bk-tags">
      {b.kind && <span className="bk-tag">{b.kind}</span>}
      {b.modules && <span className="bk-tag">{b.modules.join(" · ")}</span>}
      {b.stars && <span className="bk-stars" title="Difficulty, in MadAsMaths' stars">{starLabel(b.stars)}</span>}
    </span>
  ) : null;

  return (
    <div className="bk-browser">
      <div className="lp-card bk-tools" role="search">
        <label className="bk-search">
          <span className="sr-only">Search the booklets</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /></svg>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} autoComplete="off" enterKeyHint="search" />
        </label>
        <div className="bk-view" role="group" aria-label="Show as">
          <button type="button" aria-pressed={view === "cards"} onClick={() => chooseView("cards")}>Cards</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => chooseView("list")}>List</button>
        </div>
        {sections.length > 1 && (
          <div className="bk-chips" role="group" aria-label={sectionLabel}>
            <span className="bk-chips-label">{sectionLabel}</span>
            <button type="button" aria-pressed={!section} onClick={() => setSection(null)}>All</button>
            {sections.map(s => <button key={s.id} type="button" aria-pressed={section === s.id} onClick={() => setSection(section === s.id ? null : s.id)}>{s.title}</button>)}
          </div>
        )}
        {(kinds.length > 0 || modules.length > 0 || hasStars || hasQuestionsOnly) && (
          <div className="bk-chips" role="group" aria-label="Filters">
            <span className="bk-chips-label">Show</span>
            {kinds.map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)}>{k}</button>)}
            {modules.map(m => <button key={m} type="button" aria-pressed={module === m} onClick={() => setModule(module === m ? null : m)}>{m}</button>)}
            {hasQuestionsOnly && <button type="button" aria-pressed={questionsOnly} onClick={() => setQuestionsOnly(!questionsOnly)}>Has questions only</button>}
            {hasStars && (
              <label className="bk-select">
                <span className="sr-only">Difficulty</span>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}>
                  {Object.entries(DIFFICULTY).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}
                </select>
              </label>
            )}
          </div>
        )}
        <p className="bk-count" aria-live="polite">
          {filtered ? <>{plural(count, "booklet")} match{count === 1 ? "es" : ""} · <button type="button" className="bk-clear" onClick={clear}>Clear</button></> : <>{plural(count, "booklet")}</>}
        </p>
      </div>

      {count === 0 && (
        <div className="lp-card bk-empty">
          <b>No booklet matches that.</b>
          <span>Try fewer words, or <button type="button" className="bk-clear" onClick={clear}>clear the filters</button>.</span>
        </div>
      )}

      {shown.map(s => (
        <section key={s.id} aria-labelledby={`sec-${s.id}`} className="bk-section">
          {sections.length > 1 && (
            <h2 id={`sec-${s.id}`} className="pp-group-title">
              {s.href ? <a href={s.href}>{s.title}</a> : s.title} <small>{plural(s.items.length, "booklet")}</small>
            </h2>
          )}
          {view === "cards" ? (
            <ul className="bk-cards">
              {s.items.map(b => (
                <li key={b.slug} id={b.slug} className="lp-card bk-card">
                  <a className="bk-preview" href={b.pdf} target="_blank" rel="noopener" tabIndex={-1} aria-hidden="true" onClick={view_(b, false)}
                    data-booklet={b.slug} data-group={b.group} data-kind="full">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served from R2 beside the PDFs, already sized */}
                    <img src={b.preview} width={b.previewSize[0]} height={b.previewSize[1]} alt="" loading="lazy" decoding="async" />
                  </a>
                  <div className="bk-body">
                    <h3>{b.title}</h3>
                    {tags(b)}
                    <p className="bk-meta">{plural(b.questions, "question")} · {b.pages} pages · {b.size}</p>
                    <p className="bk-get">{fileLinks(b)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="lp-card bk-list">
              {s.items.map(b => (
                <li key={b.slug} id={b.slug} className="bk-row">
                  <span className="bk-row-title"><b>{b.title}</b>{tags(b)}</span>
                  <span className="bk-row-meta">{plural(b.questions, "question")} · {b.pages} pp · {b.size}</span>
                  <span className="bk-get">{fileLinks(b, true)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <dialog ref={dialog} className="bk-viewer" onClose={() => setOpen(null)} aria-labelledby="bk-viewer-title"
        onClick={e => { if (e.target === dialog.current) setOpen(null); }}>
        {open && (
          <div className="bk-viewer-box">
            <header className="bk-viewer-bar">
              <b id="bk-viewer-title">{open.item.title}{open.questions ? ": questions only" : ""}</b>
              {open.item.questionsPdf && (
                <button type="button" className="pp-file" onClick={() => setOpen({ item: open.item, questions: !open.questions })}>
                  {open.questions ? "With solutions" : "Questions only"}
                </button>
              )}
              <a className="pp-file" href={open.questions ? open.item.questionsPdf : open.item.pdf} target="_blank" rel="noopener">New tab</a>
              <button type="button" className="pp-file bk-viewer-close" onClick={() => setOpen(null)} aria-label="Close">✕</button>
            </header>
            <iframe key={`${open.item.slug}-${open.questions}`} title={open.item.title} src={open.questions ? open.item.questionsPdf : open.item.pdf} />
          </div>
        )}
      </dialog>
    </div>
  );
}
