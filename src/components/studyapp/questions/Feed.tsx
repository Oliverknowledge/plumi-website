"use client";

import Image from "next/image";
import { tabColour } from "@/lib/studyapp/questions/setupBooks";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  bandsFor, cleanFeedFilters, elsewhere, feedActive, hasFeedAnswer, feedList, feedOrders, feedProgress, hasCalcChoice, markedIds, NO_FEED, newSeed, practiseRows, progressLine,
  type FeedFilters, type FeedSort,
} from "@/lib/studyapp/questions/feed";
import { clearLeftCard, getLeftCard, holdScroll, rememberPos, setLeftCard, savedPos, setOpenPart, updateFeedPrefs, useFeedPrefs } from "@/lib/studyapp/questions/feedStore";
import { blocks, feedHasRoom, feedId, keyOf, MAX_SET_PARTS, questionKeyOf, type FeedInfo, type QSet, type QuestionsData } from "@/lib/studyapp/questions/model";
import { groupPapers, paperKey, paperSetInput, paperState } from "@/lib/studyapp/questions/papers";
import { buildSetInput, hasScheme, partsByQuestion, type BankRow } from "@/lib/studyapp/questions/picker";
import { currentQuestions, qa, useQuestions } from "@/lib/studyapp/questions/store";
import { baseSubject, type CatalogueSubject, type SubjectMeta } from "@/lib/studyapp/questions/subject";
import { cardEstimate } from "@/lib/studyapp/questions/virtual";
import { toast } from "../toast";
import { useBankText, useSubject } from "./bankData";
import { FeedCard, type FeedLookup } from "./FeedCard";
import { FeedActs, FeedFilterBody, FeedHead, FeedPills } from "./FeedBar";
import { FeedList } from "./FeedList";
import { FeedPen } from "./FeedPen";
import { useMatch } from "./useMatch";

const NO_IDS: ReadonlySet<string> = new Set();

/**
 * The questions of one subject as a single continuous list, like the public question bank but with the student's own writing space under each picture:
 * a strip of search, count, "Mix them up" and "Practise these"; the filters; and the questions, drawn only while they are near the screen. Each question
 * keeps its own answer (not a set's), so there is nothing to start or finish: write, pull up the mark scheme, mark yourself, scroll on.
 */
export function Feed({ entry, q }: { entry: CatalogueSubject; q: QuestionsData }) {
  const [attempt, setAttempt] = useState(0);
  const data = useSubject(entry.slug, attempt);
  const [slow, setSlow] = useState(false);
  const loading = data.state === "loading";
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setSlow(true), 8000);
    return () => { clearTimeout(t); setSlow(false); };
  }, [loading, attempt]);
  if (data.state === "error") {
    return (
      <div className="qs-fail" role="status">
        <Image src="/study/mascot/plumi-curious.svg" alt="" width={64} height={64} unoptimized />
        <b>Those questions did not load</b>
        <span>Check your connection, then try again.</span>
        <div className="qs-fail-acts"><button type="button" className="btn gold" onClick={() => setAttempt((a) => a + 1)}>Try again</button></div>
      </div>
    );
  }
  if (data.state === "loading") {
    return (
      <div className="qf-feed" role="status" aria-label={`Loading ${entry.title}`}>
        <div className="qf-ghosthead" aria-hidden="true"><i /><i /><i /></div>
        <div className="qf-ghosts" aria-hidden="true">{[0, 1].map((i) => <div key={i} className="qf-card qf-ghost"><div className="qf-left"><i /><i /><i /></div><div className="qf-sheet"><i /></div><div className="qf-right" /></div>)}</div>
        <span className="qs-sr">Loading {entry.title}</span>
        {slow && <div className="qs-slow"><span>Still loading. A slow connection?</span><button type="button" className="qs-link" onClick={() => setAttempt((a) => a + 1)}>Try again</button></div>}
      </div>
    );
  }
  return <FeedReady key={entry.slug} entry={entry} meta={data.meta} rows={data.rows} tier={data.tier} q={q} />;
}

function FeedReady({ entry, meta, rows, tier, q }: { entry: CatalogueSubject; meta: SubjectMeta; rows: BankRow[]; tier: string | null; q: QuestionsData }) {
  const { persisted } = useQuestions();
  const slug = entry.slug;
  const phone = useMatch("(max-width: 640px)");
  const prefs = useFeedPrefs();
  // The filters start folded everywhere, so the first screen is a question; they stay as the student leaves them (remembered for the subject).
  const folded = prefs.folded[slug];
  const bodyOpen = folded === undefined ? false : !folded;
  const head = useRef<HTMLDivElement>(null);

  /* ── the filters ───────────────────────────────────────────────── */
  const bands = useMemo(() => bandsFor(meta.subject, rows), [meta.subject, rows]);
  const stored = prefs.filters[slug] ?? NO_FEED;
  const filters = useMemo(() => cleanFeedFilters(stored, meta, bands), [stored, meta, bands]);
  const change = useCallback((patch: Partial<FeedFilters>) => {
    updateFeedPrefs((p) => ({ ...p, filters: { ...p.filters, [slug]: { ...(p.filters[slug] ?? NO_FEED), ...patch } } }));
  }, [slug]);
  const [search, setSearch] = useState(filters.q);
  useEffect(() => {
    if (search.trim() === filters.q.trim()) return;
    const t = setTimeout(() => change({ q: search }), 170);
    return () => clearTimeout(t);
  }, [search, filters.q, change]);
  const bank = useBankText(slug, search.trim().length > 0);
  const done = useMemo(() => (filters.hideDone ? markedIds(currentQuestions(), slug) : NO_IDS), [filters.hideDone, slug]);

  /* ── the list ──────────────────────────────────────────────────── */
  const orders = useMemo(() => feedOrders(rows, meta.series), [rows, meta.series]);
  const ctx = useMemo(() => ({ text: bank.text, bands, done }), [bank.text, bands, done]);
  const list = useMemo(() => feedList(orders, filters, ctx), [orders, filters, ctx]);
  const byQuestion = useMemo(() => partsByQuestion(orders.new), [orders]);
  const listKey = useMemo(() => JSON.stringify([filters, tier]), [filters, tier]);
  /** The questions that show a "How question 3 starts" / "so far" button (a setup picture, or a part after the first), so their height is guessed right. */
  const withStart = useMemo(() => {
    const ids = new Set<string>();
    for (const g of byQuestion.values()) g.forEach((p, i) => { if (i > 0 || g.some((x) => x.st)) ids.add(p.id); });
    return ids;
  }, [byQuestion]);
  const estimate = useCallback((p: BankRow, w: number) => cardEstimate(p, w, withStart.has(p.id)), [withStart]);

  const lookup = useMemo<FeedLookup>(() => ({
    series: new Map(meta.series.map((s) => [s.id, s.label])),
    papers: new Map(meta.papers.map((p) => [p.id.toLowerCase(), p.name])),
    topics: new Map(meta.topics.map((t) => [t.code, t.short ?? t.title])),
    trs: meta.trs ?? {},
    ins: meta.ins,
    code: meta.code,
    subject: meta.subject,
  }), [meta]);
  const info = useMemo<FeedInfo>(() => ({ subject: slug, title: meta.title, cv: meta.cv, rq: meta.rq }), [slug, meta]);
  /** The set the answer parts read (its identity fields only; the stored feed set holds the questions touched). */
  const view = useMemo<QSet>(() => ({
    id: feedId(slug), name: `Feed: ${meta.title}`, subject: slug, title: meta.title, cv: meta.cv, rq: meta.rq,
    names: { ...Object.fromEntries(lookup.series), ...Object.fromEntries(meta.papers.flatMap((p) => [[p.id, p.name], [p.id.toUpperCase(), p.name]])) },
    createdAt: 0, updatedAt: 0, parts: [], topics: {}, at: 0, feed: 1,
  }), [slug, meta, lookup]);

  /* ── how the student is doing (quietly) ────────────────────────── */
  const other = useMemo(() => elsewhere(q, slug), [q, slug]);
  const ids = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const progress = useMemo(() => feedProgress(q, slug, ids, other), [q, slug, ids, other]);
  const line = progressLine(progress);
  const full = !feedHasRoom(q, slug, "\0");
  const wrote = hasFeedAnswer(q.answers);
  const [here, setHere] = useState<BankRow | null>(null);

  /* ── actions ───────────────────────────────────────────────────── */
  const onTopic = useCallback((code: string) => change({ topics: [code] }), [change]);
  /** "The whole paper": the paper this question is on, in the paper sheet, at this question (a paper already begun is picked up). */
  const onWhole = useCallback((part: BankRow) => {
    const key = paperKey(part.s, part.p);
    const paper = groupPapers(rows.filter((r) => paperKey(r.s, r.p) === key), meta)[0];
    if (!paper) return;
    setOpenPart(part.id);
    setLeftCard(part.id);
    const cur = currentQuestions();
    const st = paperState(slug, key, cur.sets, cur.answers);
    const id = st.set ? st.set.id : qa.start(paperSetInput(meta, paper));
    const at = blocks(paper.rows).findIndex((b) => b.parts.some((p) => p.id === part.id));
    if (at > 0) qa.at(id, at);
    if (st.set) qa.open(id);
  }, [rows, meta, slug]);
  /** "You also wrote this in June 2025 Paper 1. See it": that paper or set, at this question. */
  const onSee = useCallback((setId: string, partId: string) => {
    const set = currentQuestions().sets.find((x) => x.id === setId);
    if (!set) return;
    setOpenPart(partId);
    setLeftCard(partId);
    const at = blocks(set.parts).findIndex((b) => b.parts.some((p) => p.id === partId));
    if (at > 0) qa.at(setId, at);
    qa.open(setId);
  }, []);
  const practise = () => {
    const r = practiseRows(list);
    if (!r.rows.length) return;
    qa.start(buildSetInput(meta, r.rows, { name: `${meta.title}, ${r.rows.length} ${r.rows.length === 1 ? "question" : "questions"}` }));
    if (r.left > 0) toast(`First ${MAX_SET_PARTS} questions`);
  };
  const setSort = (s: FeedSort) => change(s === "mix" ? { sort: "mix", seed: newSeed() } : { sort: s });
  const mixUp = () => change({ sort: "mix", seed: newSeed() });
  const clearAll = () => { setSearch(""); change({ topics: [], papers: [], series: [], types: [], calc: "", scheme: false, q: "", hideDone: false }); };
  const active = feedActive(filters);
  const setFolded = useCallback((f: boolean) => updateFeedPrefs((p) => ({ ...p, folded: { ...p.folded, [slug]: f } })), [slug]);
  /** Where the page was when the filters were opened from far down the list on a phone (where they sit above the list): put back when they are closed. */
  const backTo = useRef<{ y: number; key: string } | null>(null);
  const toTop = (y: number) => window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
  const toggleBody = () => {
    if (!bodyOpen && phone && window.scrollY > 200) { backTo.current = { y: window.scrollY, key: listKey }; toTop(0); }
    else if (bodyOpen && backTo.current) { const b = backTo.current; backTo.current = null; if (b.key === listKey) toTop(b.y); }
    setFolded(bodyOpen);
  };

  const hasSchemeFilter = useMemo(() => rows.some(hasScheme) && rows.some((r) => !hasScheme(r)), [rows]);
  const hasCalc = useMemo(() => hasCalcChoice(meta, rows), [meta, rows]);
  // Where the list was left is for the first drawing of the list only: a different list (a search cleared, a filter changed) starts at its top.
  const [start, setStart] = useState(() => savedPos(slug));
  useLayoutEffect(() => { if (start) holdScroll(); }, [start]);
  const firstKey = useRef(listKey);
  useEffect(() => { if (listKey !== firstKey.current) setStart(null); }, [listKey]);
  const [shownMarked] = useState(() => progress.marked > 0);
  const hasDone = shownMarked || progress.marked > 0 || filters.hideDone;

  const render = useCallback((p: BankRow, i: number) => {
    const sib = byQuestion.get(questionKeyOf(p)) ?? [p];
    return (
      <FeedCard n={i + 1} part={p} view={view} info={info} lookup={lookup} answer={q.answers[keyOf(view.id, p.id)]} other={other.get(p.id)} prefs={q.prefs} siblings={sib} eager={i < 2} full={full} cue={i < 3} wrote={wrote} onTopic={onTopic} onWhole={onWhole} onSee={onSee} />
    );
  }, [byQuestion, view, info, lookup, q.answers, q.prefs, other, full, wrote, onTopic, onWhole, onSee]);

  /** The reading line: where the sticky strip ends when it is stuck (its own top and its height), the same whether or not it is stuck yet. */
  const gap = useCallback(() => {
    const el = head.current;
    if (!el) return 66;
    return (parseFloat(getComputedStyle(el).top) || 66) + el.offsetHeight;
  }, []);
  const tint = tabColour(baseSubject(entry.subject));
  const searching = search.trim().length > 0;
  const searchNote = searching && !bank.text && !bank.failed ? <span className="qf-note-l"> {"·"} looking through the papers</span>
    : searching && bank.failed ? <span className="qf-note-l"> {"·"} searching titles only <button type="button" className="qs-link" onClick={bank.retry}>Try again</button></span> : null;

  // Once the student has scrolled or pressed something, the "tap for lofi" bubble has done its job and is put away (it would sit on the examiner's notes).
  useEffect(() => {
    const el = document.documentElement;
    const on = () => { if (window.scrollY > 30) el.dataset.qfEngaged = "1"; };
    const press = () => { el.dataset.qfEngaged = "1"; };
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("pointerdown", press, { passive: true });
    on();
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("pointerdown", press); delete el.dataset.qfEngaged; };
  }, []);
  // Back from "The whole paper" or "See it": focus is on the card the student left (once it is drawn), not lost at the top of the page.
  useEffect(() => {
    const id = getLeftCard();
    if (!id) return;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const el = document.querySelector<HTMLElement>(`[data-testid="feed-card"][data-part="${CSS.escape(id)}"]`);
      const a = document.activeElement;
      // (nothing is focused, or only the page's own heading that the app puts focus on when a page opens)
      const idle = !a || a === document.body || /^H[1-6]$/.test(a.tagName);
      if (el && idle) { el.focus({ preventScroll: true }); clearLeftCard(); clearInterval(t); }
      else if (tries > 30 || !idle) { clearLeftCard(); clearInterval(t); }
    }, 100);
    return () => clearInterval(t);
  }, []);
  // A small way back to the top: only past three screens, only while the student is scrolling back UP (going down they are reading on), at the right edge, and never
  // while a control in the list has focus (it would sit on a symbol key or the writing space they are using).
  const [deep, setDeep] = useState(false);
  const [pillTop, setPillTop] = useState(132);
  useEffect(() => {
    let last = window.scrollY, up = false, idle: ReturnType<typeof setTimeout> | undefined;
    const focusInList = () => { const a = document.activeElement; return !!a && a !== document.body && !!a.closest?.(".qf-list"); };
    const sync = () => {
      // under the sticky bar at the top (the writing, its symbol keys and the pen are all lower down)
      const h = head.current; if (h) setPillTop(Math.round(h.getBoundingClientRect().bottom) + 10);
      setDeep(up && window.scrollY > window.innerHeight * 3 && !focusInList());
    };
    const on = () => {
      const y = window.scrollY, dy = y - last;
      if (Math.abs(dy) >= 8) { up = dy < 0; last = y; }
      sync();
      clearTimeout(idle);
      idle = setTimeout(() => { up = false; sync(); }, 4000);
    };
    window.addEventListener("scroll", on, { passive: true });
    document.addEventListener("focusin", sync);
    document.addEventListener("focusout", sync);
    return () => { window.removeEventListener("scroll", on); document.removeEventListener("focusin", sync); document.removeEventListener("focusout", sync); clearTimeout(idle); };
  }, []);
  const first = list.length > MAX_SET_PARTS;
  const acts = (
    <FeedActs mixed={filters.sort === "mix"} onMix={mixUp} onPractise={practise} count={list.length} practiseLabel={first ? `Practise the first ${MAX_SET_PARTS}` : "Practise these"}
      practiseNote={first ? `The first ${MAX_SET_PARTS} of these` : "Make a set of these questions"} />
  );
  const allTiers = entry.tiers ?? [];
  const listIds = useMemo(() => new Set(list.map((r) => r.id)), [list]);
  const hereNow = list.length > 0 && here && listIds.has(here.id) ? here : null;
  const hereLine = hereNow ? `Q${hereNow.l}${hereNow.m ? ` \u00b7 ${hereNow.m} ${hereNow.m === 1 ? "mark" : "marks"}` : ""}` : null;
  const skip = (e: React.MouseEvent) => { e.preventDefault(); const el = document.getElementById("qf-results"); el?.scrollIntoView({ block: "start" }); el?.focus({ preventScroll: true }); };

  return (
    <div className="qf-feed" style={{ "--tint": tint } as React.CSSProperties} data-testid="feed" data-slug={slug}>
      <a className="qs-skip" href="#qf-results" onClick={skip} data-testid="feed-skip">Skip to the questions</a>
      <FeedHead
        ref={head} search={search} onSearch={setSearch} searchNote={searchNote} count={list.length} progress={line} active={active} open={bodyOpen} onToggle={toggleBody}
        tier={tier} phone={phone} here={hereLine} acts={acts}
      />
      {!persisted && <p className="qs-warn qf-notsaved" role="status" data-testid="not-saved">Your answers are not being saved on this device. Keep this tab open until you finish.</p>}
      <FeedPills meta={meta} bands={bands} f={filters} onChange={change} onClear={clearAll} />
      <FeedFilterBody
        meta={meta} bands={bands} f={filters} onChange={change} hasCalc={hasCalc} hasScheme={hasSchemeFilter} hasDone={hasDone} sort={filters.sort} onSort={setSort} hidden={!bodyOpen}
        acts={phone ? acts : undefined} tiers={allTiers} tierNow={tier} onTier={(t) => qa.tiers(slug, t ? [t] : [], allTiers)}
      />
      {phone && bodyOpen && (
        <button type="button" className="btn gold qf-showall" onClick={() => { const b = backTo.current; backTo.current = null; setFolded(true); toTop(b && b.key === listKey ? b.y : 0); }} data-testid="feed-show">
          Show {list.length.toLocaleString("en-GB")} {list.length === 1 ? "question" : "questions"}
        </button>
      )}
      <h2 className="qs-sr" id="qf-results" tabIndex={-1}>Questions</h2>
      {rows.length === 0 ? (
        <div className="qs-empty"><Image src="/study/mascot/plumi-curious.svg" alt="" width={72} height={72} unoptimized /><b>No questions here yet</b></div>
      ) : list.length === 0 ? (
        <div className="qs-empty" data-testid="feed-empty"><Image src="/study/mascot/plumi-curious.svg" alt="" width={72} height={72} unoptimized /><b>{searching ? "Nothing matches your search" : "Nothing matches"}</b>
          {searching && <button type="button" className="btn" onClick={() => setSearch("")} data-testid="feed-clear-search">Clear search</button>}
          {active > 0 && <button type="button" className="btn" onClick={clearAll}>Clear filters</button>}
        </div>
      ) : (
        <FeedList<BankRow> items={list} estimate={estimate} render={render} listKey={listKey} start={start} onPos={(pos) => { if (!backTo.current) rememberPos(slug, pos); }} onHere={setHere} gap={gap} label={`${list.length.toLocaleString("en-GB")} questions`} />
      )}
      {deep && (
        <button type="button" className="qf-top" style={{ top: pillTop }} aria-label="Back to the top" onClick={() => { window.scrollTo({ top: 0, behavior: "instant" }); setDeep(false); }} data-testid="feed-top">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 16V4M4 9l6-6 6 6" /></svg>Top
        </button>
      )}
      <FeedPen prefs={q.prefs} />
    </div>
  );
}
