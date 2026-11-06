"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FeedPos } from "@/lib/studyapp/questions/feedView";
import { indexAt, offsetsOf, rangeOf, withPinned } from "@/lib/studyapp/questions/virtual";

/**
 * A very long list of tall, changing items (the question feed: thousands of questions, each with a picture, a writing space and a mark scheme) that keeps
 * only the items near the screen in the page. The rest are two spacers whose heights are the heights the items have (measured where one has been drawn,
 * `estimate` where it has not), so the page is as long as the whole list and the scroll bar tells the truth.
 *
 *  - Scrolling is the page's own (no inner scroller: the iPad's momentum and the browser's find and anchors keep working).
 *  - An item that changes height (the mark scheme opens, a picture arrives) while it is above the reading line moves everything below it; the page is
 *    scrolled by the same amount in the same frame, so what the student is reading does not move. The browser's own scroll anchoring is turned off for
 *    the list (it cannot know about the spacers), and Safari has none.
 *  - The question at the top of the screen, and how far into it, is reported (`onPos`), and a list opens at one (`start`): exactly where it was left.
 *  - An item with the keyboard (a student typing) is never taken out of the page while it is near.
 */
export interface FeedListProps<T extends { id: string }> {
  items: readonly T[];
  /** The height of an item in px at this list width, for an item that has not been drawn. */
  estimate(item: T, width: number): number;
  render(item: T, index: number): React.ReactNode;
  /** A different list (the filters changed): the page goes back to its top. */
  listKey: string;
  /** Open here: the item (by id) and how far into it the reading line was. */
  start: FeedPos | null;
  onPos(pos: FeedPos): void;
  /** The item under the reading line, as it changes while scrolling (null when there is none). */
  onHere?(item: T | null): void;
  /** How far down the screen the reading line is: the bottom of whatever sticks to the top of the page (the nav and the bar). */
  gap(): number;
  label: string;
}

/** The overscan: this many screens of items above and below the one on screen are drawn (fewer for the first moments, so the first screen is not held up by what is below it). */
const AHEAD = 1.15;
const AHEAD_AT_FIRST = 0.4;
/** Every item's height in the model: measured where it has been drawn, else the guess, added up. */
const model = <T extends { id: string }>(list: readonly T[], w: number, estimate: (it: T, w: number) => number, measured: ReadonlyMap<string, number>) =>
  offsetsOf(list.map((it) => measured.get(it.id) ?? estimate(it, w)));
/** Move the page now, whatever smooth scrolling the page asks for (a position read straight after must be the new one). */
const jump = (y: number) => window.scrollTo({ top: Math.max(0, y), left: window.scrollX, behavior: "instant" as ScrollBehavior });

/** The list's width (css px): what a card in it is as wide as. A card that lays itself out by its width (FeedCard's pinned question) reads it here, so it is right in the very render that needs it. */
const ListWidth = createContext(0);
export const useListWidth = () => useContext(ListWidth);

export function FeedList<T extends { id: string }>({ items, estimate, render, listKey, start, onPos, onHere, gap, label }: FeedListProps<T>) {
  const box = useRef<HTMLDivElement>(null);
  const [measured] = useState(() => new Map<string, number>());
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1000 : Math.min(1184, Math.max(320, window.innerWidth - 32))));
  const [tick, setTick] = useState(0);
  const pinned = useRef<number | null>(null);
  /** While the list is being put back where it was left: the question it opens at stays drawn (its open scheme loads and is measured) and the page is aligned again each time a height settles. */
  const restoring = useRef<{ at: number; go(): void } | null>(null);
  /** Set when the list is no longer the one that was opened: no more putting the page back. */
  const restoreOff = useRef(false);
  const ahead = useRef(AHEAD_AT_FIRST);
  const latest = useRef({ items, gap, onPos, onHere, estimate, width });
  useLayoutEffect(() => { latest.current = { items, gap, onPos, onHere, estimate, width }; });

  const index = useMemo(() => new Map(items.map((it, i) => [it.id, i])), [items]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const offs = useMemo(() => model(items, width, estimate, measured), [items, tick, width, estimate, measured]);
  const offsRef = useRef(offs);
  const indexRef = useRef(index);
  useLayoutEffect(() => { offsRef.current = offs; indexRef.current = index; });
  const boxTop = () => (box.current?.getBoundingClientRect().top ?? 0) + window.scrollY;

  // the window of items to draw: opens round where the list was left (or at its top)
  const [win, setWin] = useState(() => {
    const at = start ? index.get(start.id) ?? 0 : 0;
    const y = (offs[at] ?? 0) + (start && index.has(start.id) ? start.off : 0);
    const vh = typeof window === "undefined" ? 800 : window.innerHeight;
    return withPinned(rangeOf(offs, y - vh * AHEAD_AT_FIRST, y + vh * (1 + AHEAD_AT_FIRST)), null, items.length);
  });
  const fit = useCallback(() => {
    const o = offsRef.current;
    const n = o.length - 1;
    const y = window.scrollY - boxTop();
    const vh = window.innerHeight;
    const r = withPinned(rangeOf(o, y - vh * ahead.current, y + vh * (1 + ahead.current)), pinned.current ?? restoring.current?.at ?? null, n, restoring.current ? 400 : 10);
    setWin((w) => (w.from === r.from && w.to === r.to ? w : r));
  }, []);

  // where the reading line is, as an item and how far into it
  const here = useCallback(() => {
    const o = offsRef.current;
    const y = window.scrollY + latest.current.gap() - boxTop();
    const i = indexAt(o, y);
    return i < 0 ? null : { i, off: Math.max(0, Math.round(y - o[i])) };
  }, []);

  // The item at the reading line as the page shows it (the first drawn item that ends below the line), and where its top is: when a height changes anywhere above
  // it, this is what moved, and the page is scrolled back by exactly that. Read from the page itself, so a wrong guess in the model cannot put it in the wrong place.
  const anchor = useRef<{ id: string; top: number; h: number } | null>(null);
  const capture = useCallback(() => {
    const g = latest.current.gap();
    anchor.current = null;
    for (const el of box.current?.querySelectorAll<HTMLElement>("[data-k]") ?? []) {
      const r = el.getBoundingClientRect();
      if (r.bottom > g) { anchor.current = { id: el.dataset.k ?? "", top: r.top, h: r.height }; return; }
    }
  }, []);
  // one observer for every drawn item: a change of height is taken into the model, and the page follows it when it was above the reading line
  const ro = useRef<ResizeObserver | null>(null);
  const observe = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    if (!ro.current) {
      ro.current = new ResizeObserver((entries) => {
        // The list's own width changed in this very frame (a turn of the screen): every height is about to be a guess again, and the width watcher puts the page back.
        if (box.current && Math.abs(box.current.offsetWidth - latest.current.width) > 1) return;
        const old = offsRef.current;
        let changed = false;
        for (const e of entries) {
          const el = e.target as HTMLElement;
          const id = el.dataset.k;
          const i = id === undefined ? undefined : indexRef.current.get(id);
          if (id === undefined || i === undefined || i >= old.length - 1) continue;
          const h = e.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight;
          if (!(h > 0)) continue;
          if (Math.abs(h - (old[i + 1] - old[i])) < 0.5) continue;
          measured.set(id, h);
          changed = true;
        }
        if (!changed) return;
        offsRef.current = model(latest.current.items, latest.current.width, latest.current.estimate, measured);
        const a = anchor.current;
        const at = a ? box.current?.querySelector<HTMLElement>(`[data-k="${a.id}"]`) : null;
        if (a && at) {
          const d = at.getBoundingClientRect().top - a.top;
          if (Math.abs(d) >= 0.5) jump(window.scrollY + d);
        }
        // Being put back where it was left: a height that has settled (an open scheme's picture) moves the place, so the page is aligned to the place again, not kept to a neighbour.
        if (restoring.current) restoring.current.go(); else capture();
        setTick((t) => t + 1);
      });
    }
    ro.current.observe(el);
    return () => ro.current?.unobserve(el);
  }, [measured, capture]);
  useEffect(() => () => { ro.current?.disconnect(); ro.current = null; }, []);

  // the list's own width: when it changes every height is a guess again, and the reading line is put back where it was
  const keep = useRef<{ id: string; frac: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const w = el.offsetWidth;
    if (w > 0 && Math.abs(w - width) > 1) setWidth(w);
    const watch = new ResizeObserver(() => {
      const nw = el.offsetWidth;
      if (nw <= 0 || Math.abs(nw - latest.current.width) <= 1) return;
      // The item at the reading line and how far down it the line was, as a fraction of its height (from the last frame before the turn).
      const a = anchor.current;
      keep.current = a && a.h > 0 ? { id: a.id, frac: Math.min(1, Math.max(0, (latest.current.gap() - a.top) / a.h)) } : null;
      anchor.current = null;
      measured.clear();
      setWidth(nw);
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, [width, measured]);
  useLayoutEffect(() => {
    const k = keep.current;
    keep.current = null;
    if (!k) return;
    // The item is drawn (it was at the reading line): read where it is now from the page and put the same fraction of it at the line. Only if it is not drawn is the model used.
    const at = box.current?.querySelector<HTMLElement>(`[data-k="${k.id}"]`);
    if (at) {
      const r = at.getBoundingClientRect();
      jump(window.scrollY + r.top + k.frac * r.height - latest.current.gap());
    } else {
      const i = indexRef.current.get(k.id);
      if (i !== undefined) jump(boxTop() + offsRef.current[i] + k.frac * (offsRef.current[i + 1] - offsRef.current[i]) - latest.current.gap());
    }
    capture();
    fit();
  }, [offs, fit, capture]);

  // where the student is, said when the scrolling has settled, and before anything in the list is pressed (so the position kept is the one they stopped at)
  const report = useCallback(() => {
    const h = here();
    const it = h ? latest.current.items[h.i] : undefined;
    // At the very top of the page the first question is still below the reading line; that is "the top", not a place 190px down the first question.
    const first = latest.current.items[0];
    if (window.scrollY < 2 && first) { latest.current.onPos({ id: first.id, off: 0 }); return; }
    if (h && it) latest.current.onPos({ id: it.id, off: h.off });
  }, [here]);
  const lastHere = useRef<string | undefined>(undefined);
  // a different list: the question under the reading line is read again (it may not be in the new list at all)
  useEffect(() => {
    lastHere.current = undefined;
    const h = here();
    const it = h ? latest.current.items[h.i] : undefined;
    lastHere.current = it?.id;
    latest.current.onHere?.(it ?? null);
  }, [items, here]);
  useEffect(() => {
    let raf = 0;
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      raf = 0;
      // A turn of the screen is in this frame: the width watcher has the reading line as it was (the page already shows the new layout), so it is not read again here.
      if (box.current && Math.abs(box.current.offsetWidth - latest.current.width) > 1) return;
      capture();
      fit();
      const h = here();
      const it = h ? latest.current.items[h.i] : undefined;
      if (it?.id !== lastHere.current) { lastHere.current = it?.id; latest.current.onHere?.(it ?? null); }
      clearTimeout(quiet);
      quiet = setTimeout(report, 180);
    };
    const on = () => { ahead.current = AHEAD; if (!raf) raf = requestAnimationFrame(run); };
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    window.addEventListener("pagehide", report);
    on();
    ahead.current = AHEAD_AT_FIRST;
    const widen = setTimeout(() => { ahead.current = AHEAD; fit(); }, 900);
    return () => { clearTimeout(widen); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); window.removeEventListener("pagehide", report); clearTimeout(quiet); if (raf) cancelAnimationFrame(raf); };
  }, [fit, report, capture, here]);
  // (Leaving the list is not the moment to read the page: by then the next screen is already in it. A press or a tap inside the list says where it is first.)

  // opening: the page is put where the list was left before anything is painted (the window was drawn round that place)
  useLayoutEffect(() => {
    if (!start) return;
    const i = indexRef.current.get(start.id);
    if (i !== undefined) { jump(i === 0 && start.off === 0 ? 0 : boxTop() + offsRef.current[i] + start.off - latest.current.gap()); capture(); }
    // only on opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // a height changed or the list changed: the window may need other items
  useLayoutEffect(() => { fit(); }, [offs, fit]);

  // the first time: put the page where the list was left, again as the page above it settles, until the student takes over
  useEffect(() => {
    if (!start) return;
    const i = indexRef.current.get(start.id);
    if (i === undefined) return;
    let touched = false;
    const done = () => { restoring.current = null; };
    const stop = () => { touched = true; done(); };
    const evs = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    evs.forEach((e) => window.addEventListener(e, stop, { passive: true }));
    const go = () => {
      if (touched || restoreOff.current) return;
      const want = i === 0 && start.off === 0 ? 0 : boxTop() + offsRef.current[i] + start.off - latest.current.gap();
      if (Math.abs(window.scrollY - want) > 3) { jump(want); capture(); }
    };
    restoring.current = { at: i, go };
    fit();
    go();
    const ts = [60, 250, 600, 1200, 2200].map((ms) => setTimeout(go, ms));
    // (an open scheme's picture can take a few seconds: the question is held and the page re-aligned for as long as the student has not taken over)
    const end = setTimeout(done, 12000);
    return () => { evs.forEach((e) => window.removeEventListener(e, stop)); ts.forEach(clearTimeout); clearTimeout(end); done(); };
    // only on opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Being put back where it was left belongs to the list that was opened: a different list (another epoch, or the same list given more or fewer questions when late results are taken in at
  // the top) ends it for good, so nothing is re-aligned to a place in a list that is no longer there.
  const sig = `${items.length}|${items[0]?.id ?? ""}|${items[items.length - 1]?.id ?? ""}`;
  const openedWith = useRef(sig);
  const openedKey = useRef(listKey);
  const lastSig = useRef(sig);
  useLayoutEffect(() => {
    if (lastSig.current !== sig) {
      // A different set of questions (late results taken in at the top): the card that was at the reading line is not held in place by scrolling the page (that is what carried the page down
      // by the height of the new cards above it); the reading line is read afresh from the new list.
      lastSig.current = sig;
      anchor.current = null;
      capture();
    }
    if (sig === openedWith.current && listKey === openedKey.current) return;
    restoreOff.current = true;
    restoring.current = null;
  }, [sig, listKey, capture]);

  // another list: back to its top (when the page has been scrolled past it)
  const seen = useRef(listKey);
  useEffect(() => {
    if (seen.current === listKey) return;
    seen.current = listKey;
    const top = boxTop() - latest.current.gap();
    if (window.scrollY > top) jump(top);
    fit();
  }, [listKey, fit]);

  // an item with the keyboard stays in the page. (A browser may say nothing, or say "nothing is focused", when the focused card is taken out of the page, so a
  // let-go is not read as the student leaving: the card is remembered until focus goes to something else in the page.)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const inn = (e: FocusEvent) => { const it = (e.target as HTMLElement).closest<HTMLElement>("[data-i]"); pinned.current = it ? Number(it.dataset.i) : null; };
    const out = (e: FocusEvent) => { const to = e.relatedTarget as HTMLElement | null; if (to && !to.closest?.("[data-i]")) pinned.current = null; };
    el.addEventListener("focusin", inn);
    el.addEventListener("focusout", out);
    return () => { el.removeEventListener("focusin", inn); el.removeEventListener("focusout", out); };
  }, []);

  // A card with the keyboard that is far off the screen is let go; focus then goes to the nearest drawn card instead of to the page.
  useEffect(() => {
    const gone = pinned.current;
    if (gone === null) return;
    const el = box.current;
    if (!el || el.contains(document.activeElement)) return;
    if (document.activeElement && document.activeElement !== document.body) { pinned.current = null; return; }
    if (el.querySelector(`[data-i="${gone}"]`)) return;   // still drawn: nothing was lost
    const drawn = [...el.querySelectorAll<HTMLElement>("[data-i]")];
    if (!drawn.length) return;
    drawn.sort((a, b) => Math.abs(Number(a.dataset.i) - gone) - Math.abs(Number(b.dataset.i) - gone));
    pinned.current = Number(drawn[0].dataset.i);
    drawn[0].focus({ preventScroll: true });
  }, [win]);

  const n = items.length;
  const from = Math.min(win.from, Math.max(0, n - 1)), to = Math.min(win.to, n);
  const shown = items.slice(from, to);
  return (
    <ListWidth.Provider value={width}>
    <div ref={box} className="qf-list" role="list" aria-label={label} data-testid="feed-list" data-from={from} data-to={to} data-total={n} onPointerDownCapture={report} onClickCapture={report}>
      <div aria-hidden="true" className="qf-spacer" style={{ height: offs[from] ?? 0 }} />
      {shown.map((it, k) => (
        <div key={it.id} ref={observe} role="listitem" tabIndex={-1} className="qf-item" aria-posinset={from + k + 1} aria-setsize={n} data-k={it.id} data-i={from + k} data-last={from + k === n - 1 ? 1 : undefined}>
          {render(it, from + k)}
        </div>
      ))}
      <div aria-hidden="true" className="qf-spacer" style={{ height: Math.max(0, (offs[n] ?? 0) - (offs[to] ?? 0)) }} />
    </div>
    </ListWidth.Provider>
  );
}
