"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import { baseSubject, bankDataPath, bankHasPracticals, papersBase, paperName, questionKey, seriesLabel, topicRef, type BankPart, type BankSubject } from "@/content/questionBank";
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
type View = "parts" | "whole";
/** `calc` and `prac` both take "only" or "none" (leave them out); `view` shows parts one by one or whole questions. */
interface Filters { topics: string[]; papers: string[]; series: string[]; q: string; calc: Calc; prac: Calc; view: View; sort: Sort }

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
  const prac = u.get("practical");
  const sort = u.get("sort");
  return {
    topics: list("topic"), papers: list("paper"), series: list("year"), q: u.get("q") ?? "",
    calc: calc === "only" || calc === "none" ? calc : "",
    prac: prac === "only" || prac === "none" ? prac : "",
    view: u.get("view") === "whole" ? "whole" : "parts",
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
  if (f.prac) u.set("practical", f.prac);
  if (f.view === "whole") u.set("view", "whole");
  if (f.sort !== "new") u.set("sort", f.sort);
  const qs = u.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  urlListeners.forEach(l => l());
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
// (Cambridge's "JUN24V2" is a second June 2024 sitting, another variant of the same papers.)
const yearOf = (s: string) => { const y = s.match(/^[A-Z]{3}(\d\d)/); return y ? 2000 + Number(y[1]) : 0; };
const seriesRank = (s: string) => yearOf(s) * 100 + (s.startsWith("NOV") ? 11 : s.startsWith("OCT") ? 10 : s.startsWith("JUN") ? 6 : 0);
const specRank = (code: string) => code.split(".").map(n => n.padStart(3, "0")).join(".");
const words = (q: string) => q.toLowerCase().match(/"[^"]+"|\S+/g)?.map(w => w.replace(/"/g, "")) ?? [];

type Dim = "topics" | "papers" | "series" | "calc" | "prac" | "q";

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
  const [practicals, setPracticals] = useState<Set<string> | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [rangeNote, setRangeNote] = useState<string | null>(null);
  const [withReports, setWithReports] = useState(false);
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
    // The practical parts' ids, for the sciences: no file (or an empty one) and the filter stays hidden.
    if (bankHasPracticals(subject)) {
      fetch(bankDataPath(subject.slug, "practicals")).then(r => (r.ok ? r.json() : [])).then((ids: string[]) => setPracticals(new Set(ids))).catch(() => setPracticals(new Set()));
    }
  }, [subject]);

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
      (skip === "prac" || !f.prac || !practicals || (f.prac === "only") === practicals.has(p.id)) &&
      (!ws.length || (text ? ws.every(w => (text[p.id] ?? "").includes(w)) : ws.every(w => p.x.toLowerCase().includes(w))));
  }, [f.topics, f.papers, f.series, f.calc, f.prac, f.q, text, sectionOf, practicals]);

  // Every part of each question, in order, for the whole-question view.
  const questions = useMemo(() => {
    if (!parts) return null;
    const m = new Map<string, BankPart[]>();
    for (const p of parts) {
      const k = questionKey(p);
      const group = m.get(k);
      if (group) group.push(p);
      else m.set(k, [p]);
    }
    for (const g of m.values()) g.sort((a, b) => a.l.localeCompare(b.l, undefined, { numeric: true }));
    return m;
  }, [parts]);
  // Only a bank whose questions come in parts has a whole-question view (maths is cut whole already).
  const hasWhole = !!questions && [...questions.values()].some(g => g.length > 1);
  const hasPracticals = !!practicals?.size;
  const whole = f.view === "whole" && hasWhole;

  const results = useMemo(() => {
    if (!parts) return null;
    // Within a series: the full A-Level papers before AS, then paper order, then question order.
    const paperRank = (p: string) => (subject.papers.find(x => x.id === p)?.as ? 1 : 0);
    const byNew = (a: BankPart, b: BankPart) => seriesRank(b.s) - seriesRank(a.s) || paperRank(a.p) - paperRank(b.p) || a.p.localeCompare(b.p) || a.s.localeCompare(b.s) || a.l.localeCompare(b.l, undefined, { numeric: true });
    const sorted = parts.filter(p => matches(p)).sort(
      f.sort === "old" ? (a, b) => -byNew(a, b)
        : f.sort === "spec" ? (a, b) => specRank(a.t[0] ?? "9").localeCompare(specRank(b.t[0] ?? "9")) || byNew(a, b)
          : f.sort === "marks" ? (a, b) => (b.m ?? 0) - (a.m ?? 0) || byNew(a, b)
            : f.sort === "short" ? (a, b) => (a.m ?? 99) - (b.m ?? 99) || byNew(a, b)
              : byNew);
    if (!whole || !questions) return sorted.map(p => [p]);
    // Whole questions: each question any of whose parts matches, all its parts, where its first match falls.
    const seen = new Set<string>();
    const groups: BankPart[][] = [];
    for (const p of sorted) {
      const k = questionKey(p);
      if (seen.has(k)) continue;
      seen.add(k);
      groups.push(questions.get(k) ?? [p]);
    }
    const total = (g: BankPart[]) => g.reduce((n, p) => n + (p.m ?? 0), 0);
    if (f.sort === "marks") groups.sort((a, b) => total(b) - total(a));
    if (f.sort === "short") groups.sort((a, b) => total(a) - total(b));
    return groups;
  }, [parts, matches, f.sort, subject.papers, whole, questions]);

  /** How many questions each chip would give, with every other filter kept. */
  const counts = useMemo(() => {
    if (!parts) return null;
    const c = { topics: new Map<string, number>(), papers: new Map<string, number>(), series: new Map<string, number>(), calc: new Map<string, number>(), prac: new Map<string, number>() };
    // In the whole-question view a chip counts questions: each once, however many of its parts match.
    const counted = new Set<string>();
    const bump = (m: Map<string, number>, k: string, p: BankPart) => {
      if (whole) {
        const key = `${[...Object.values(c)].indexOf(m)}|${k}|${questionKey(p)}`;
        if (counted.has(key)) return;
        counted.add(key);
      }
      m.set(k, (m.get(k) ?? 0) + 1);
    };
    for (const p of parts) {
      if (matches(p, "topics")) for (const t of p.t) { bump(c.topics, t, p); const sec = sectionOf.get(t); if (sec && sec !== t) bump(c.topics, sec, p); }
      if (matches(p, "papers")) bump(c.papers, p.p, p);
      if (matches(p, "series")) bump(c.series, p.s, p);
      if (matches(p, "calc")) { bump(c.calc, "", p); bump(c.calc, p.calc ? "only" : "none", p); }
      if (practicals && matches(p, "prac")) bump(c.prac, practicals.has(p.id) ? "only" : "none", p);
    }
    return c;
  }, [parts, matches, sectionOf, whole, practicals]);
  const n = (dim: keyof NonNullable<typeof counts>, k: string) => counts?.[dim].get(k);

  const list = results ?? initial.map(p => [p]);
  const total = results?.length ?? subject.count;
  const active = (lockedTopic ? 0 : f.topics.length) + f.papers.length + f.series.length + (f.calc ? 1 : 0) + (f.prac ? 1 : 0) + (f.q ? 1 : 0);

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
  const wholePaper = f.papers.length === 1 && f.series.length === 1 ? subject.wholes[`${f.papers[0]}-${f.series[0]}`] : undefined;

  const pills: { label: string; clear: () => void }[] = [
    ...(lockedTopic ? [] : f.topics.map(t => ({ label: subject.topics.find(x => x.code === t)?.title ?? subject.sections.find(x => x.code === t)?.title ?? t, clear: () => update({ topics: f.topics.filter(x => x !== t) }) }))),
    ...f.papers.map(p => ({ label: paperName(subject, p), clear: () => update({ papers: f.papers.filter(x => x !== p) }) })),
    ...f.series.map(s => ({ label: seriesLabel(subject, s), clear: () => update({ series: f.series.filter(x => x !== s) }) })),
    ...(f.calc ? [{ label: f.calc === "only" ? "Only calculations" : "No calculations", clear: () => update({ calc: "" }) }] : []),
    ...(f.prac && hasPracticals ? [{ label: f.prac === "only" ? "Only practicals" : "No practicals", clear: () => update({ prac: "" }) }] : []),
    ...(f.q ? [{ label: `“${f.q}”`, clear: () => { setTyped(""); update({ q: "" }); } }] : []),
  ];
  const clearAll = () => { setTyped(""); write({ topics: [], papers: [], series: [], q: "", calc: "", prac: "", view: f.view, sort: f.sort }); setShown(PAGE); };

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

  const hasReports = useMemo(() => !!parts?.some(p => p.er), [parts]);
  async function downloadRange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Left blank, it's the whole list as filtered ("Bonding", say), up to what one PDF holds.
    const typed = String(new FormData(e.currentTarget).get("range") ?? "").trim();
    if (!results?.length) return;
    const raw = typed || `1-${results.length}`;
    // Up to SET_MAX parts, as a set holds. A number typed twice ("1–5, 3") goes in once; a whole question goes in whole or not at all.
    const picks = new Set<BankPart>();
    const numbers = new Set<number>();
    let capped = false;
    for (const bit of raw.split(/[,\s]+/).filter(Boolean)) {
      // "7" has no second number at all (undefined, not NaN); "5–2" counts as 2 to 5.
      const [a, b = a] = bit.split(/[-–]/).map(x => parseInt(x, 10));
      if (Number.isNaN(a)) continue;
      const end = Number.isNaN(b) ? a : b;
      for (let i = Math.max(1, Math.min(a, end)); i <= Math.min(results.length, Math.max(a, end)); i++) {
        const group = results[i - 1];
        if (numbers.has(i)) continue;
        if (picks.size + group.length > SET_MAX) { capped = true; break; }
        numbers.add(i);
        group.forEach(p => picks.add(p));
      }
    }
    if (!picks.size) { setRangeNote("Those numbers aren’t in this list."); return; }
    // The PDF reads as the list does: in number order ("7, 2–4" gives 2, 3, 4, 7), each question labelled with its number.
    const order = [...numbers].sort((a, b) => a - b);
    const numbered = new Map<string, number>();
    for (const i of order) for (const p of results[i - 1]) numbered.set(p.id, i);
    const ordered = order.flatMap(i => results[i - 1].filter(p => picks.has(p)));
    setRangeNote("Building…");
    try {
      const { buildSetPdf } = await import("@/lib/questionSetPdf");
      const reports = withReports && hasReports;
      const skipped = await buildSetPdf(subject, ordered, { markSchemes: true, reports, numbers: numbered, onProgress: (d, t) => setRangeNote(`Adding ${d} of ${t}…`) });
      track("bank_pdf_downloaded", { subject: subject.slug, questions: picks.size, mark_schemes: true, reports: reports ? 1 : 0, via: "range", skipped, whole: whole ? 1 : 0 });
      const what = whole ? `${numbers.size} whole ${numbers.size === 1 ? "question" : "questions"}` : `${picks.size} ${picks.size === 1 ? "question" : "questions"}`;
      setRangeNote(skipped
        ? `Saved, but ${skipped} of ${picks.size * 2} pages couldn’t be added. Try again in a moment.`
        : `Saved ✓ ${what}, mark schemes${reports ? " and examiner’s reports" : ""} at the back${capped ? ` (${SET_MAX} parts is the most in one go)` : ""}`);
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
                  placeholder={baseSubject(subject) === "Chemistry" ? "titration, \"bond angle\"" : baseSubject(subject) === "Biology" ? "osmosis, \"active transport\"" : subject.subject === "Psychology" ? "conformity, \"working memory\"" : baseSubject(subject) === "Economics" ? "elasticity, \"market failure\"" : subject.subject === "Computer Science" ? "recursion, \"binary search\"" : "capacitor, \"half-life\""}
                  onChange={e => setTyped(e.target.value)} onFocus={needText} />
              </form>
              {!subject.noCalc && <div className="qb-field qb-calc" role="group" aria-label="Calculations">
                <span className="qb-label">Calculations</span>
                <label><input type="checkbox" checked={f.calc === "only"} onChange={e => update({ calc: e.target.checked ? "only" : "" })} /> Only these</label>
                <label><input type="checkbox" checked={f.calc === "none"} onChange={e => update({ calc: e.target.checked ? "none" : "" })} /> Leave out</label>
              </div>}
            </div>
            <div className="qb-row-toggles">
              {hasWhole && (
                <div className="qb-field qb-view" role="radiogroup" aria-label="Show">
                  <span className="qb-label">Show</span>
                  <div className="qb-seg">
                    <button type="button" role="radio" aria-checked={!whole} className={!whole ? "is-on" : ""} onClick={() => update({ view: "parts" })}>Each part</button>
                    <button type="button" role="radio" aria-checked={whole} className={whole ? "is-on" : ""} onClick={() => update({ view: "whole" })}>Whole questions</button>
                  </div>
                </div>
              )}
              {hasPracticals && <div className="qb-field qb-calc" role="group" aria-label="Practicals">
                <span className="qb-label">Practicals</span>
                <label><input type="checkbox" checked={f.prac === "only"} onChange={e => update({ prac: e.target.checked ? "only" : "" })} /> Only these{counts && <span className="qb-n"> {n("prac", "only") ?? 0}</span>}</label>
                <label><input type="checkbox" checked={f.prac === "none"} onChange={e => update({ prac: e.target.checked ? "none" : "" })} /> Leave out</label>
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
              <input id="qb-range-input" name="range" placeholder="All, or e.g. 1–20 or 2–4, 7" inputMode="numeric" autoComplete="off" />
              <button type="submit" className="lp-btn" disabled={!results}>Download PDF</button>
            </div>
            {hasReports && <label className="qb-tray-ms"><input type="checkbox" checked={withReports} onChange={e => setWithReports(e.target.checked)} /> Examiner’s reports with the mark schemes</label>}
            {rangeNote && <span className="qb-range-note" role="status">{rangeNote}</span>}
          </form>
        </div>
        {pills.length > 0 && (
          <ul className="qb-pills" aria-label="Filters on">
            {pills.map(p => <li key={p.label}><button type="button" onClick={p.clear} aria-label={`Remove ${p.label}`}>{p.label} <span aria-hidden="true">×</span></button></li>)}
            {active > 1 && <li><button type="button" className="qb-pill-clear" onClick={clearAll}>Clear all</button></li>}
          </ul>
        )}
        {wholePaper && (
          <p className="qb-whole">
            The whole {seriesLabel(subject, f.series[0])} {paperName(subject, f.papers[0])}:{" "}
            {wholePaper.qp && <a href={`${papersBase}/${wholePaper.qp}`} target="_blank" rel="noopener">question paper</a>}
            {wholePaper.ms && <> · <a href={`${papersBase}/${wholePaper.ms}`} target="_blank" rel="noopener">mark scheme</a></>}
            {wholePaper.er && <> · <a href={`${papersBase}/${wholePaper.er}`} target="_blank" rel="noopener">examiner’s report</a></>}
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
            {list.slice(0, shown).map((g, i) => (
              <QuestionRow key={g[0].id} n={i + 1} parts={g} subject={subject} inSet={g.every(p => set.has(p.id))} setFull={set.ids.length + g.filter(p => !set.has(p.id)).length > SET_MAX}
                onToggleSet={() => (g.every(p => set.has(p.id)) ? set.remove(g.map(p => p.id)) : set.add(g.map(p => p.id)))}
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
