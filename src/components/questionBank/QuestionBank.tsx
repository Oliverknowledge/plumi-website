"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import { baseSubject, bankDataPath, papersBase, paperName, seriesLabel, topicRef, type BankPart, type BankSubject } from "@/content/questionBank";
import { QuestionRow } from "./QuestionRow";
import { SET_MAX, SetTray, useQuestionSet } from "./SetTray";

const PAGE = 20;
const NARROW = "(max-width: 980px)";
const subscribeNarrow = (cb: () => void) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

type Sort = "new" | "old" | "spec" | "marks" | "short";
type Calc = "" | "only" | "none";
interface Filters { topics: string[]; papers: string[]; series: string[]; q: string; calc: Calc; sort: Sort }

/**
 * The filters live in the URL and nowhere else, so any view of the bank is a link
 * someone can send, and a link always opens on exactly that view (it never waits
 * for the question list to load before it's read). The URL is the store; the
 * component subscribes to it.
 */
const urlListeners = new Set<() => void>();
const subscribeUrl = (cb: () => void) => {
  urlListeners.add(cb);
  window.addEventListener("popstate", cb);
  return () => { urlListeners.delete(cb); window.removeEventListener("popstate", cb); };
};
function parse(search: string): Filters {
  const u = new URLSearchParams(search);
  const list = (k: string) => (u.get(k) ?? "").split(",").filter(Boolean);
  const calc = u.get("calc");
  const sort = u.get("sort");
  return {
    topics: list("topic"), papers: list("paper"), series: list("year"), q: u.get("q") ?? "",
    calc: calc === "only" || calc === "none" ? calc : "",
    sort: sort === "old" || sort === "spec" || sort === "marks" || sort === "short" ? sort : "new",
  };
}
function write(f: Filters) {
  const u = new URLSearchParams();
  if (f.topics.length) u.set("topic", f.topics.join(","));
  if (f.papers.length) u.set("paper", f.papers.join(","));
  if (f.series.length) u.set("year", f.series.join(","));
  if (f.q) u.set("q", f.q);
  if (f.calc) u.set("calc", f.calc);
  if (f.sort !== "new") u.set("sort", f.sort);
  const qs = u.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  urlListeners.forEach(l => l());
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
const yearOf = (s: string) => (/\d\d$/.test(s) ? 2000 + Number(s.slice(-2)) : 0);
const seriesRank = (s: string) => yearOf(s) * 100 + (s.startsWith("NOV") ? 11 : s.startsWith("OCT") ? 10 : s.startsWith("JUN") ? 6 : 0);
const specRank = (code: string) => code.split(".").map(n => n.padStart(3, "0")).join(".");
const words = (q: string) => q.toLowerCase().match(/"[^"]+"|\S+/g)?.map(w => w.replace(/"/g, "")) ?? [];

type Dim = "topics" | "papers" | "series" | "calc" | "q";

/**
 * The bank itself. The whole subject's list (a few thousand short rows) is fetched
 * once and filtered in the browser, so every tap answers instantly; the search
 * text is fetched only when someone types. The server renders the newest twenty
 * first (`initial`), so the page works and reads before any of this loads.
 */
export function QuestionBank({ subject, initial, lockedTopic }: { subject: BankSubject; initial: BankPart[]; lockedTopic?: string }) {
  const search = useSyncExternalStore(subscribeUrl, () => window.location.search, () => "");
  const urlFilters = useMemo(() => parse(search), [search]);
  const f: Filters = lockedTopic ? { ...urlFilters, topics: [lockedTopic] } : urlFilters;
  const [parts, setParts] = useState<BankPart[] | null>(null);
  const [text, setText] = useState<Record<string, string> | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [rangeNote, setRangeNote] = useState<string | null>(null);
  const [typed, setTyped] = useState<string | null>(null); // null: the box shows the URL's search
  const query = typed ?? f.q;
  const set = useQuestionSet(subject.slug);
  const loadingText = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);

  // On a phone the filters start folded, so the first question is on screen; after that it's the reader's call.
  const isPhone = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const panelOpen = userOpen ?? !isPhone;
  // On a phone, once the filters have scrolled away, a pill brings them back.
  const [panelGone, setPanelGone] = useState(false);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPanelGone(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    fetch(bankDataPath(subject.slug, "parts")).then(r => r.json()).then(setParts).catch(() => setParts(null));
  }, [subject.slug]);

  const needText = useCallback(() => {
    if (text || loadingText.current) return;
    loadingText.current = true;
    fetch(bankDataPath(subject.slug, "text")).then(r => r.json()).then(setText).catch(() => { loadingText.current = false; });
  }, [subject.slug, text]);
  useEffect(() => { if (f.q) needText(); }, [f.q, needText]);

  function update(patch: Partial<Filters>) {
    const next = { ...f, ...patch };
    write(lockedTopic ? { ...next, topics: [] } : next);
    setShown(PAGE);
  }

  // Search waits for a pause in typing; it never writes until someone has typed.
  useEffect(() => {
    if (typed === null || typed.trim() === f.q) return;
    const t = setTimeout(() => update({ q: typed.trim() }), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed]);

  // A topic's section from the data, not its code: "3.1.2" is in "3.1", but Edexcel's "6.A" is in Topic "6".
  const sectionOf = useMemo(() => new Map(subject.topics.map(t => [t.code, t.section])), [subject.topics]);

  const matches = useCallback((p: BankPart, skip?: Dim) => {
    const ws = skip === "q" ? [] : words(f.q);
    return (skip === "topics" || !f.topics.length || p.t.some(t => f.topics.some(sel => t === sel || sectionOf.get(t) === sel))) &&
      (skip === "papers" || !f.papers.length || f.papers.includes(p.p)) &&
      (skip === "series" || !f.series.length || f.series.includes(p.s)) &&
      (skip === "calc" || ((f.calc !== "only" || !!p.calc) && (f.calc !== "none" || !p.calc))) &&
      (!ws.length || (text ? ws.every(w => (text[p.id] ?? "").includes(w)) : ws.every(w => p.x.toLowerCase().includes(w))));
  }, [f.topics, f.papers, f.series, f.calc, f.q, text, sectionOf]);

  const results = useMemo(() => {
    if (!parts) return null;
    // Within a series: the full A-Level papers before AS, then paper order, then question order.
    const paperRank = (p: string) => (subject.papers.find(x => x.id === p)?.as ? 1 : 0);
    const byNew = (a: BankPart, b: BankPart) => seriesRank(b.s) - seriesRank(a.s) || paperRank(a.p) - paperRank(b.p) || a.p.localeCompare(b.p) || a.l.localeCompare(b.l, undefined, { numeric: true });
    return parts.filter(p => matches(p)).sort(
      f.sort === "old" ? (a, b) => -byNew(a, b)
        : f.sort === "spec" ? (a, b) => specRank(a.t[0] ?? "9").localeCompare(specRank(b.t[0] ?? "9")) || byNew(a, b)
          : f.sort === "marks" ? (a, b) => (b.m ?? 0) - (a.m ?? 0) || byNew(a, b)
            : f.sort === "short" ? (a, b) => (a.m ?? 99) - (b.m ?? 99) || byNew(a, b)
              : byNew);
  }, [parts, matches, f.sort, subject.papers]);

  /** How many questions each chip would give, with every other filter kept. */
  const counts = useMemo(() => {
    if (!parts) return null;
    const c = { topics: new Map<string, number>(), papers: new Map<string, number>(), series: new Map<string, number>(), calc: new Map<string, number>() };
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    for (const p of parts) {
      if (matches(p, "topics")) for (const t of p.t) { bump(c.topics, t); const sec = sectionOf.get(t); if (sec && sec !== t) bump(c.topics, sec); }
      if (matches(p, "papers")) bump(c.papers, p.p);
      if (matches(p, "series")) bump(c.series, p.s);
      if (matches(p, "calc")) { bump(c.calc, ""); bump(c.calc, p.calc ? "only" : "none"); }
    }
    return c;
  }, [parts, matches, sectionOf]);
  const n = (dim: keyof NonNullable<typeof counts>, k: string) => counts?.[dim].get(k);

  const list = results ?? initial;
  const total = results?.length ?? subject.count;
  const active = (lockedTopic ? 0 : f.topics.length) + f.papers.length + f.series.length + (f.calc ? 1 : 0) + (f.q ? 1 : 0);

  useEffect(() => {
    if (!results || !active) return;
    const t = setTimeout(() => track("bank_filtered", { subject: subject.slug, results: results.length, topics: f.topics.length, search: f.q ? 1 : 0 }), 1200);
    return () => clearTimeout(t);
  }, [results, active, f.topics.length, f.q, subject.slug]);

  function showResults() {
    setUserOpen(false);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function backToFilters() {
    setUserOpen(true);
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  // One paper of one sitting picked: offer the whole thing.
  const whole = f.papers.length === 1 && f.series.length === 1 ? subject.wholes[`${f.papers[0]}-${f.series[0]}`] : undefined;

  const pills: { label: string; clear: () => void }[] = [
    ...(lockedTopic ? [] : f.topics.map(t => ({ label: subject.topics.find(x => x.code === t)?.title ?? subject.sections.find(x => x.code === t)?.title ?? t, clear: () => update({ topics: f.topics.filter(x => x !== t) }) }))),
    ...f.papers.map(p => ({ label: paperName(subject, p), clear: () => update({ papers: f.papers.filter(x => x !== p) }) })),
    ...f.series.map(s => ({ label: seriesLabel(subject, s), clear: () => update({ series: f.series.filter(x => x !== s) }) })),
    ...(f.calc ? [{ label: f.calc === "only" ? "Only calculations" : "No calculations", clear: () => update({ calc: "" }) }] : []),
    ...(f.q ? [{ label: `“${f.q}”`, clear: () => { setTyped(""); update({ q: "" }); } }] : []),
  ];
  const clearAll = () => { setTyped(""); write({ topics: [], papers: [], series: [], q: "", calc: "", sort: f.sort }); setShown(PAGE); };

  // Topic groups, as GradeHunt and the specification both arrange them: each section split by year.
  const years = ([0, 1, 2, 3] as const).map(y => ({
    year: y,
    label: y === 0 ? "By area" : y === 1 ? "Year 1 · AS" : y === 2 ? "Year 2 · A‑Level only" : "Paper 3 options",
    groups: subject.sections.map(sec => ({ key: `${sec.code}-${y}`, title: sec.title, code: sec.code, topics: subject.topics.filter(t => t.section === sec.code && t.year === y) }))
      .filter(g => g.topics.length),
  })).filter(y => y.groups.length);
  const groupState = (codes: string[]) => {
    const on = codes.filter(c => f.topics.includes(c)).length;
    return on === 0 ? false : on === codes.length ? true : "mixed";
  };
  function toggleGroup(codes: string[]) {
    const all = groupState(codes) === true;
    update({ topics: all ? f.topics.filter(t => !codes.includes(t)) : [...new Set([...f.topics, ...codes])] });
  }
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  async function downloadRange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = String(new FormData(e.currentTarget).get("range") ?? "");
    if (!results || !raw.trim()) return;
    // Up to SET_MAX, as a set holds. A number typed twice ("1–5, 3") goes in once.
    const picks = new Set<BankPart>();
    let capped = false;
    for (const bit of raw.split(/[,\s]+/).filter(Boolean)) {
      // "7" has no second number at all (undefined, not NaN); "5–2" counts as 2 to 5.
      const [a, b = a] = bit.split(/[-–]/).map(x => parseInt(x, 10));
      if (Number.isNaN(a)) continue;
      const end = Number.isNaN(b) ? a : b;
      for (let i = Math.max(1, Math.min(a, end)); i <= Math.min(results.length, Math.max(a, end)); i++) {
        if (picks.size >= SET_MAX && !picks.has(results[i - 1])) { capped = true; break; }
        picks.add(results[i - 1]);
      }
    }
    if (!picks.size) { setRangeNote("Those numbers aren’t in this list."); return; }
    setRangeNote("Building…");
    try {
      const { buildSetPdf } = await import("@/lib/questionSetPdf");
      const skipped = await buildSetPdf(subject, [...picks], { markSchemes: true, onProgress: (d, t) => setRangeNote(`Adding ${d} of ${t}…`) });
      track("bank_pdf_downloaded", { subject: subject.slug, questions: picks.size, mark_schemes: true, via: "range", skipped });
      setRangeNote(skipped
        ? `Saved, but ${skipped} of ${picks.size * 2} pages couldn’t be added. Try again in a moment.`
        : `Saved ✓ ${picks.size} ${picks.size === 1 ? "question" : "questions"}, mark schemes at the back${capped ? ` (${SET_MAX} is the most in one go)` : ""}`);
    } catch {
      setRangeNote("Couldn’t build it. Try again?");
    }
  }

  return (
    <div className="qb">
      {isPhone && panelGone && (
        <button type="button" className="qb-backpill" onClick={backToFilters}>
          Filters{active ? ` · ${active} on` : ""} · {total.toLocaleString("en-GB")} {total === 1 ? "question" : "questions"}
        </button>
      )}

      <section className="qb-filters" aria-label="Filter questions" ref={panelRef}>
        <details className="lp-card qb-desk" open={panelOpen} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; if (o !== panelOpen) setUserOpen(o); }}>
          <summary className="qb-desk-head">
            <span>{isPhone ? "Filter and search" : "Find questions"}</span>
            <span className="qb-count-pill" aria-live="polite">{active > 0 ? `${active} on · ` : ""}{total.toLocaleString("en-GB")}</span>
          </summary>
          <div className="qb-desk-body">
            {!lockedTopic && (
              <fieldset className="qb-topics">
                <legend><span className="qb-label">Topics</span> <span className="qb-hint">Pick as many as you like. Open one to choose its sub-topics.</span></legend>
                {years.map(y => (
                  <div key={y.year} className="qb-year">
                    <p className="qb-year-label">{y.label}</p>
                    <div className="qb-tiles">
                      {y.groups.map(g => {
                        const codes = g.topics.map(t => t.code);
                        const state = groupState(codes);
                        const count = codes.reduce((sum, c) => sum + (n("topics", c) ?? 0), 0);
                        return (
                          <div key={g.key} className={`qb-tile${state ? " is-on" : ""}${openGroup === g.key ? " is-open" : ""}`}>
                            <button type="button" role="checkbox" aria-checked={state} className="qb-check" onClick={() => toggleGroup(codes)}>
                              <span className="qb-box" aria-hidden="true">{state === "mixed" ? "–" : state ? "✓" : ""}</span>
                              <span>{g.title}{counts && <span className="qb-n"> {count}</span>}</span>
                            </button>
                            <button type="button" className="qb-open" aria-expanded={openGroup === g.key} aria-label={`Sub-topics of ${g.title}`}
                              onClick={() => setOpenGroup(o => (o === g.key ? null : g.key))}>{openGroup === g.key ? "−" : "+"}</button>
                          </div>
                        );
                      })}
                    </div>
                    {y.groups.filter(g => g.key === openGroup).map(g => (
                      <div key={g.key} className="qb-subs">
                        {g.topics.map(t => (
                          <button key={t.code} type="button" role="checkbox" aria-checked={f.topics.includes(t.code)}
                            className={`qb-check qb-sub${f.topics.includes(t.code) ? " is-on" : ""}${!f.topics.includes(t.code) && n("topics", t.code) === 0 ? " is-empty" : ""}`}
                            onClick={() => update({ topics: toggle(f.topics, t.code) })}>
                            <span className="qb-box" aria-hidden="true">{f.topics.includes(t.code) ? "✓" : ""}</span>
                            <span>{topicRef(t) && <><span className="qb-code">{topicRef(t)}</span> </>}{t.title}{counts && <span className="qb-n"> {n("topics", t.code) ?? 0}</span>}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </fieldset>
            )}

            <div className="qb-row-controls">
              <label className="qb-field">
                <span className="qb-label">Paper</span>
                <select value={f.papers.length === 1 ? f.papers[0] : ""} onChange={e => update({ papers: e.target.value ? [e.target.value] : [] })}>
                  <option value="">All papers</option>
                  {subject.papers.map(p => <option key={p.id} value={p.id}>{p.name}{p.title ? ` · ${p.title}` : ""}{counts ? ` (${n("papers", p.id) ?? 0})` : ""}</option>)}
                </select>
              </label>
              <label className="qb-field">
                <span className="qb-label">Exam</span>
                <select value={f.series.length === 1 ? f.series[0] : ""} onChange={e => update({ series: e.target.value ? [e.target.value] : [] })}>
                  <option value="">All years</option>
                  {subject.series.map(x => <option key={x.id} value={x.id}>{x.label}{counts ? ` (${n("series", x.id) ?? 0})` : ""}</option>)}
                </select>
              </label>
              <label className="qb-field">
                <span className="qb-label">Sort</span>
                <select value={f.sort} onChange={e => update({ sort: e.target.value as Sort })}>
                  <option value="new">Newest first</option>
                  <option value="old">Oldest first</option>
                  <option value="spec">Spec order</option>
                  <option value="marks">Most marks</option>
                  <option value="short">Fewest marks</option>
                </select>
              </label>
              <form className="qb-field qb-search" role="search" onSubmit={e => { e.preventDefault(); if (typed !== null) update({ q: typed.trim() }); if (isPhone) showResults(); }}>
                <label htmlFor="qb-q" className="qb-label">Search</label>
                <input id="qb-q" type="search" value={query} enterKeyHint="search"
                  placeholder={baseSubject(subject) === "Chemistry" ? "titration, \"bond angle\"" : baseSubject(subject) === "Biology" ? "osmosis, \"active transport\"" : subject.subject === "Psychology" ? "conformity, \"working memory\"" : baseSubject(subject) === "Economics" ? "elasticity, \"market failure\"" : "capacitor, \"half-life\""}
                  onChange={e => setTyped(e.target.value)} onFocus={needText} />
              </form>
              {!subject.noCalc && <div className="qb-field qb-calc" role="group" aria-label="Calculations">
                <span className="qb-label">Calculations</span>
                <label><input type="checkbox" checked={f.calc === "only"} onChange={e => update({ calc: e.target.checked ? "only" : "" })} /> Only these</label>
                <label><input type="checkbox" checked={f.calc === "none"} onChange={e => update({ calc: e.target.checked ? "none" : "" })} /> Leave out</label>
              </div>}
            </div>
            {isPhone && (
              <button type="button" className="lp-btn qb-show" onClick={showResults}>
                Show {total.toLocaleString("en-GB")} {total === 1 ? "question" : "questions"}
              </button>
            )}
          </div>
        </details>
      </section>

      <section className="qb-results" aria-labelledby="qb-results-title">
        <div className="qb-bar">
          <h2 id="qb-results-title" ref={resultsRef} aria-live="polite" tabIndex={-1}>
            <strong>{total.toLocaleString("en-GB")}</strong> {total === 1 ? "question" : "questions"}
          </h2>
          <form className="qb-range" onSubmit={downloadRange}>
            <label htmlFor="qb-range-input">Download by number, no sign-in</label>
            <div>
              <input id="qb-range-input" name="range" placeholder="e.g. 1–20 or 2–4, 7" inputMode="numeric" autoComplete="off" />
              <button type="submit" className="lp-btn" disabled={!results}>Download PDF</button>
            </div>
            {rangeNote && <span className="qb-range-note" role="status">{rangeNote}</span>}
          </form>
        </div>
        {pills.length > 0 && (
          <ul className="qb-pills" aria-label="Filters on">
            {pills.map(p => <li key={p.label}><button type="button" onClick={p.clear} aria-label={`Remove ${p.label}`}>{p.label} <span aria-hidden="true">×</span></button></li>)}
            {active > 1 && <li><button type="button" className="qb-pill-clear" onClick={clearAll}>Clear all</button></li>}
          </ul>
        )}
        {whole && (
          <p className="qb-whole">
            The whole {seriesLabel(subject, f.series[0])} {paperName(subject, f.papers[0])}:{" "}
            {whole.qp && <a href={`${papersBase}/${whole.qp}`} target="_blank" rel="noopener">question paper</a>}
            {whole.ms && <> · <a href={`${papersBase}/${whole.ms}`} target="_blank" rel="noopener">mark scheme</a></>}
            {whole.er && <> · <a href={`${papersBase}/${whole.er}`} target="_blank" rel="noopener">examiner’s report</a></>}
          </p>
        )}

        {results && results.length === 0 ? (
          <div className="lp-card qb-empty">
            <p><strong>Nothing matches all of that.</strong> Take one of the filters off:</p>
            <ul className="qb-pills">
              {pills.map(p => <li key={p.label}><button type="button" onClick={p.clear}>{p.label} <span aria-hidden="true">×</span></button></li>)}
            </ul>
            <button type="button" className="lp-btn" onClick={clearAll}>Clear all filters</button>
          </div>
        ) : (
          <ol className="qb-rows">
            {list.slice(0, shown).map((p, i) => (
              <QuestionRow key={p.id} n={i + 1} part={p} subject={subject} inSet={set.has(p.id)} setFull={set.full} onToggleSet={() => set.toggle(p.id)}
                onTopic={lockedTopic ? undefined : code => { update({ topics: [code] }); requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })); }} />
            ))}
          </ol>
        )}

        {results && results.length > shown && (
          <div className="qb-more">
            <button type="button" className="lp-btn" onClick={() => setShown(x => x + PAGE)}>Show {Math.min(PAGE, results.length - shown)} more</button>
            <span>Showing {shown} of {results.length.toLocaleString("en-GB")}</span>
          </div>
        )}
      </section>

      <SetTray subject={subject} set={set} parts={parts} />
    </div>
  );
}
