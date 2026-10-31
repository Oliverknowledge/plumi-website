"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { readPapersDone, setPaperDone, subscribePapersDone } from "@/components/pastPapers/DoneTick";
import { bankTopicPath, topicRef, type BankTopic } from "@/content/questionBank";
import { standing, topicAttempts, useBankMarks, type PartRecord, type Standing, type TopicState } from "@/lib/bankProgress";

/**
 * My topics: a revision board (the founder, 31 October 2026: "it reminds me of a kanban board").
 * Four columns, Up next, Practising, Revising and Got it, and three kinds of card on them:
 *
 *  - a topic, with the share of its marks the student has earned;
 *  - a past paper sitting, from the Past papers pages, whose tick there is its place here: ticked
 *    done it sits in Got it, and moved into Got it it's ticked done there;
 *  - a note of the student's own, a title, a line or two and any topics they like ("Mock prep:
 *    circles and trig"), practised all together.
 *
 * The student moves cards themselves (drag, a grip on a touch screen, or the arrow keys); the marks
 * only suggest ("your marks say you've got this") and place a topic the first time it's answered.
 * A new board starts with the three topics asked most often in Up next. Everything else waits in
 * the tray, to be searched and added.
 *
 * Design exploration: three looks at the same board, flipped with a switcher pinned to the corner
 * in development only (?blook=). Sticky notes is the board as it ships.
 */

/** The switcher: off in a production build, except a local one made with NEXT_PUBLIC_DESIGN_PREVIEW=1 to judge the real speed. */
const TRYING = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DESIGN_PREVIEW === "1";

export const BOARD_LOOKS = [
  { id: "board", name: "Board" },
  { id: "sticky", name: "Sticky notes" },
  { id: "sidebar", name: "Spec sidebar" },
] as const;
export type BoardLook = (typeof BOARD_LOOKS)[number]["id"];

const LOOK_KEY = "plumi-board-look";
const lookListeners = new Set<() => void>();
const isLook = (v: string | null): v is BoardLook => BOARD_LOOKS.some(l => l.id === v);
function readLook(): BoardLook {
  if (!TRYING) return "sticky";
  const fromUrl = new URLSearchParams(window.location.search).get("blook");
  if (isLook(fromUrl)) { try { localStorage.setItem(LOOK_KEY, fromUrl); } catch { /* fine */ } return fromUrl; }
  try { const v = localStorage.getItem(LOOK_KEY); return isLook(v) ? v : "sticky"; } catch { return "sticky"; }
}
export const useBoardLook = () => useSyncExternalStore(cb => { lookListeners.add(cb); return () => { lookListeners.delete(cb); }; }, readLook, () => "sticky" as BoardLook);

export function BoardLookSwitch() {
  const look = useBoardLook();
  if (!TRYING) return null;
  const pick = (id: BoardLook) => {
    try { localStorage.setItem(LOOK_KEY, id); } catch { /* fine */ }
    const u = new URL(window.location.href); u.searchParams.delete("blook"); window.history.replaceState(null, "", u);
    lookListeners.forEach(l => l());
  };
  return (
    <div className="tb-switch" role="radiogroup" aria-label="Board design to try">
      <span>Design</span>
      {BOARD_LOOKS.map(l => <button key={l.id} type="button" role="radio" aria-checked={look === l.id} className={look === l.id ? "is-on" : ""} onClick={() => pick(l.id)}>{l.name}</button>)}
    </div>
  );
}

/* ── What's on a board ── */

type Col = "next" | "doing" | "revise" | "done";
const COLS: { id: Col; name: string; hint: string }[] = [
  { id: "next", name: "Up next", hint: "To start" },
  { id: "doing", name: "Practising", hint: "Working on these" },
  { id: "revise", name: "Revising", hint: "Keep them fresh" },
  { id: "done", name: "Got it", hint: "Confident here" },
];
const COL_NAME = Object.fromEntries(COLS.map(c => [c.id, c.name])) as Record<Col, string>;
/** Where a topic lands the first time it's answered, if the student hasn't put it anywhere. */
const AUTO: Record<TopicState, Col> = { needs: "doing", developing: "doing", early: "doing", rusty: "revise", strong: "done" };

/** What a board needs of a subject (boardData.ts makes it on the server): its topics and areas, colour and papers. */
export interface BoardSubject { slug: string; title: string; /** The subject alone, "Chemistry": a note's button for it. */ name: string; colour: string; topics: BankTopic[]; sections: { code: string; title: string }[]; papers: BoardPaper[] }

/** One sitting of one paper, from the Past papers pages: `key` is its tick there ("<paper>|<session>"). */
export interface BoardPaper { track: string; name: string; title: string; sessions: { session: string; qp?: string; ms?: string }[] }
interface Sitting { key: string; name: string; title: string; session: string; qp?: string; ms?: string }

export const TINTS = ["yellow", "pink", "blue", "green", "lilac"] as const;
type Tint = (typeof TINTS)[number];
interface Note { title: string; text: string; topics: string[]; tint: Tint }

/** A card's id on the board: a topic's code, "p:" and a sitting's key, or "n:" and a note's own id. */
const PAPER = "p:", NOTE = "n:";
interface Board { cols: Record<Col, string[]>; off: string[]; notes: Record<string, Note> }

const BOARD_KEY = "plumi-bank-board:v1";
const boardListeners = new Set<() => void>();
let boardMemory = "";
const boards = {
  read: () => { try { return localStorage.getItem(BOARD_KEY) ?? boardMemory; } catch { return boardMemory; } },
  subscribe: (cb: () => void) => {
    boardListeners.add(cb);
    const onStorage = (e: StorageEvent) => { if (e.key === BOARD_KEY) cb(); };
    window.addEventListener("storage", onStorage);
    return () => { boardListeners.delete(cb); window.removeEventListener("storage", onStorage); };
  },
  write: (v: string) => { boardMemory = v; try { localStorage.setItem(BOARD_KEY, v); } catch { /* memory only */ } boardListeners.forEach(cb => cb()); },
};
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const parseBoards = (raw: string): Record<string, Partial<Board>> => { try { const v = JSON.parse(raw); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
const cleanNotes = (v: unknown, topics: Set<string>): Record<string, Note> => {
  const out: Record<string, Note> = {};
  if (!v || typeof v !== "object") return out;
  for (const [id, n] of Object.entries(v as Record<string, Partial<Note>>)) {
    if (!n || typeof n.title !== "string") continue;
    out[id] = { title: n.title, text: typeof n.text === "string" ? n.text : "", topics: strings(n.topics).filter(c => topics.has(c)), tint: TINTS.includes(n.tint as Tint) ? n.tint as Tint : "yellow" };
  }
  return out;
};

/**
 * The stored board, cleaned of anything the bank no longer has, with:
 *  - any answered topic not yet on it placed by its marks;
 *  - each paper sitting where its tick says (ticked done: Got it; unticked: not Got it);
 *  - on a board never touched, the three topics asked most often in Up next.
 */
function merge(stored: Partial<Board> | undefined, rows: Row[], sittings: Map<string, Sitting>, done: Set<string>, hot: Row[]): Board {
  const topics = new Set(rows.map(r => r.t.code));
  const notes = cleanNotes(stored?.notes, topics);
  const known = (id: string) => (id.startsWith(PAPER) ? sittings.has(id) : id.startsWith(NOTE) ? id in notes : topics.has(id));
  const b: Board = { cols: { next: [], doing: [], revise: [], done: [] }, off: [], notes };
  const seen = new Set<string>();
  for (const c of COLS) for (const id of strings(stored?.cols?.[c.id])) {
    if (!known(id) || seen.has(id)) continue;
    seen.add(id);
    const ticked = id.startsWith(PAPER) && done.has(id.slice(PAPER.length));
    b.cols[id.startsWith(PAPER) ? (ticked ? "done" : c.id === "done" ? "doing" : c.id) : c.id].push(id);
  }
  b.off = strings(stored?.off).filter(id => known(id) && !seen.has(id));
  const off = new Set(b.off);
  for (const r of rows) if (r.st.attempts && !seen.has(r.t.code) && !off.has(r.t.code)) { b.cols[AUTO[r.st.state]].push(r.t.code); seen.add(r.t.code); }
  for (const key of done) { const id = PAPER + key; if (sittings.has(id) && !seen.has(id) && !off.has(id)) { b.cols.done.push(id); seen.add(id); } }
  if (!stored) for (const r of hot) if (!seen.has(r.t.code) && b.cols.next.length < 3) { b.cols.next.push(r.t.code); seen.add(r.t.code); }
  return b;
}

/* ── A topic, as the cards and the tray draw it ── */

const DAY = 86_400_000;
interface Row { t: BankTopic; st: Standing; share: number | null; section: string }
const digest = (subject: Pick<BoardSubject, "topics" | "sections">, bank: Record<string, PartRecord> | undefined): Row[] => {
  const titles = new Map(subject.sections.map(s => [s.code, s.title]));
  return subject.topics.filter(t => t.count > 0).map(t => {
    const st = standing(topicAttempts(bank, [t.code]));
    return { t, st, share: st.outOf ? st.scored / st.outOf : null, section: titles.get(t.section) ?? "Other topics" };
  });
};
/** The topics asked most often, a tenth of them (three at least): "Comes up a lot". */
const hotOf = (rows: Row[]) => [...rows].sort((a, b) => b.t.count - a.t.count).slice(0, Math.max(3, Math.round(rows.length / 10)));
const kind = (r: Row) => (r.st.attempts ? r.st.state : "fresh");
const tone = (share: number) => (share >= 0.62 ? "is-high" : share >= 0.4 ? "is-mid" : "is-low");
const short = (t: BankTopic) => t.short ?? t.title;
const ago = (ms: number | null, now = Date.now()) => {
  if (!ms) return "";
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / DAY);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 14 ? `${days} days ago` : days < 60 ? `${Math.round(days / 7)} weeks ago` : "a while ago";
};
const words = (q: string) => q.toLowerCase().replace(/[^a-z0-9. ]+/g, " ").split(/\s+/).filter(Boolean);

/** What the marks make of where the student put a topic, with the move it suggests. */
function nudge(r: Row, col: Col): { text: string; to: Col } | null {
  const { st } = r;
  if (!st.attempts) return null;
  if (col === "done" && st.state === "rusty") return { text: `Not done since ${ago(st.lastAt)}`, to: "revise" };
  if (col === "done" && st.attempts > 1 && (st.estimate ?? 1) < 0.62) return { text: "Your marks say: not yet", to: "doing" };
  if ((col === "doing" || col === "next") && st.state === "strong") return { text: "Your marks say you’ve got this", to: "done" };
  return null;
}

/**
 * Practise one topic, or several (a note's): the bank filtered to them. On that subject's own bank page
 * it filters the list in place (`here`); anywhere else, My board, it goes to the bank's page.
 */
export type Practise = (slug: string, topics: BankTopic[], label: ReactNode, className: string) => ReactNode;
export function practiseWith(here?: { slug: string; go: (codes: string[]) => void }): Practise {
  // eslint-disable-next-line react/display-name
  return (slug, topics, label, className) => {
    const codes = topics.map(t => t.code);
    if (here?.slug === slug) return <button type="button" className={className} onClick={() => here.go(codes)}>{label}</button>;
    return <Link className={className} href={topics.length === 1 ? bankTopicPath(slug, topics[0].slug) : `/question-bank/${slug}?topic=${codes.join(",")}`}>{label}</Link>;
  };
}

/* ── Dragging ──
 * Pointer events, so a mouse, a pen and (by the grip) a finger all work. The lifted card follows the
 * pointer by writing its transform to the element once a frame; React hears of a drag only when the
 * spot it would land on changes, so moving never re-draws the board. Cards making room glide there,
 * and on letting go the card settles into its spot (or back home) before it's placed. */

type Target = { col: Col | "off"; index: number };
interface Lifted { code: string; w: number; h: number; dx: number; dy: number; x0: number; y0: number }
const EASE = "cubic-bezier(.2, .8, .2, 1)";
const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const NAV = 96;
/** A phone: one column at a time, a tab each, swiped between; topics and papers in a sheet from the bottom. */
const PHONE = "(max-width: 620px)";
const usePhone = () => useSyncExternalStore(cb => { const m = window.matchMedia(PHONE); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
  () => window.matchMedia(PHONE).matches, () => false);

function useLift(onDrop: (code: string, to: Target) => void, beforeChange: () => void) {
  const [lifted, setLifted] = useState<Lifted | null>(null);
  const [over, setOver] = useState<Target | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const st = useRef({
    start: null as { code: string; x: number; y: number; el: HTMLElement } | null,
    live: false, landing: false, x: 0, y: 0, frame: 0, top: NAV,
    over: null as Target | null, home: null as Target | null, lift: null as Lifted | null,
  });
  const drop = useRef(onDrop), snap = useRef(beforeChange);
  useLayoutEffect(() => { drop.current = onDrop; snap.current = beforeChange; });

  useEffect(() => {
    const s = st.current;
    // Where a card would land: by each card's laid-out position, which an animation in progress doesn't move.
    const find = (x: number, y: number): Target | null => {
      const zone = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-col]");
      if (!zone) return null;
      const col = zone.dataset.col as Col | "off";
      const list = zone.querySelector<HTMLElement>(".tb-list");
      if (!list) return { col, index: 0 };
      const top = list.getBoundingClientRect().top - list.scrollTop;
      let index = 0;
      for (const c of list.querySelectorAll<HTMLElement>("[data-card]")) { if (y < top + c.offsetTop + c.offsetHeight / 2) break; index++; }
      return { col, index };
    };
    const same = (a: Target | null, b: Target | null) => a?.col === b?.col && a?.index === b?.index;
    const target = (t: Target | null) => { if (!same(t, s.over)) { s.over = t; snap.current(); setOver(t); } };
    const paint = () => {
      const g = ghost.current, l = s.lift;
      if (g && l) g.style.transform = `translate3d(${s.x - l.dx}px, ${s.y - l.dy}px, 0)`;
    };
    // Near an edge the page (or, on a narrow screen, the row of columns) scrolls itself, faster the closer it gets.
    const speed = (d: number) => Math.min(18, Math.ceil(d / 4));
    const tick = () => {
      s.frame = 0;
      if (!s.live || s.landing) return;
      paint();
      const edge = 64;
      const v = s.y < s.top + edge && window.scrollY > 0 ? -speed(s.top + edge - s.y) : s.y > window.innerHeight - edge ? speed(s.y - window.innerHeight + edge) : 0;
      // "instant": the page scrolls smoothly when asked, which would turn each frame's nudge into an animation of its own.
      if (v) window.scrollBy({ top: v, behavior: "instant" });
      const row = document.querySelector<HTMLElement>(".tb-cols");
      let h = 0;
      if (row && row.scrollWidth > row.clientWidth) {
        const r = row.getBoundingClientRect();
        h = s.x < r.left + edge ? -speed(r.left + edge - s.x) : s.x > r.right - edge ? speed(s.x - r.right + edge) : 0;
        if (h) row.scrollBy({ left: h, behavior: "instant" });
      }
      // And a long column scrolls under the card, near its own top and bottom.
      let c = 0;
      const list = document.elementFromPoint(s.x, s.y)?.closest<HTMLElement>("[data-col]")?.querySelector<HTMLElement>(".tb-list");
      if (list && list.scrollHeight > list.clientHeight) {
        const r = list.getBoundingClientRect(), near = 48;
        c = s.y < r.top + near && list.scrollTop > 0 ? -speed(r.top + near - s.y)
          : s.y > r.bottom - near && list.scrollTop < list.scrollHeight - list.clientHeight ? speed(s.y - r.bottom + near) : 0;
        if (c) list.scrollTop += c;
      }
      target(find(s.x, s.y));
      if (v || h || c) s.frame = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      const b = s.start;
      if (!b || s.landing) return;
      s.x = e.clientX;
      s.y = e.clientY;
      if (!s.live) {
        if (Math.hypot(s.x - b.x, s.y - b.y) < 6) return;
        s.live = true;
        const r = b.el.getBoundingClientRect();
        s.lift = { code: b.code, w: r.width, h: r.height, dx: b.x - r.left, dy: b.y - r.top, x0: s.x, y0: s.y };
        // A card's home is where it was; a topic from the list has none.
        const zone = b.el.matches("[data-card]") ? b.el.closest<HTMLElement>("[data-col]") : null;
        s.home = zone ? { col: zone.dataset.col as Col, index: [...zone.querySelectorAll("[data-card]")].indexOf(b.el) } : null;
        s.over = s.home;
        // Where the page's own top ends, under the nav (and a phone's column tabs): scrolling up starts below it.
        const nav = document.querySelector(".lp-nav")?.getBoundingClientRect().bottom ?? NAV;
        const tabs = document.querySelector(".tb-coltabs")?.getBoundingClientRect();
        s.top = tabs && tabs.top <= nav + 12 ? Math.max(nav, tabs.bottom) : nav;
        document.documentElement.classList.add("tb-dragging");
        snap.current();
        setLifted(s.lift);
        setOver(s.over);
        return;
      }
      if (e.cancelable) e.preventDefault();
      // The card follows at once, in this event, not a frame later; finding where it lands waits for the frame.
      paint();
      if (!s.frame) s.frame = requestAnimationFrame(tick);
    };
    const clear = () => {
      cancelAnimationFrame(s.frame);
      Object.assign(s, { start: null, live: false, landing: false, frame: 0, over: null, home: null, lift: null });
      document.documentElement.classList.remove("tb-dragging");
      setLifted(null);
      setOver(null);
    };
    const land = (keep: boolean) => {
      if (!s.start || s.landing) return;
      if (!s.live) { s.start = null; return; }
      cancelAnimationFrame(s.frame);
      s.frame = 0;
      s.landing = true;
      const code = s.start.code;
      // Let go over nowhere, or cancelled: back home, or (from the list) away.
      const to = keep && s.over ? s.over : s.home;
      const moved = !!to && !same(to, s.home) && !(to.col === "off" && !s.home);
      let done = false;
      const settle = () => { if (done) return; done = true; snap.current(); if (moved) drop.current(code, to!); clear(); };
      const g = ghost.current;
      if (!g || still()) return settle();
      if (to !== s.over) target(to);
      // Measured a frame on, once the space it's settling into is drawn.
      requestAnimationFrame(() => {
        const spot = to && to.col !== "off" ? document.querySelector<HTMLElement>(".tb-place")?.getBoundingClientRect() : null;
        const from = g.style.transform;
        const end = spot ? `translate3d(${spot.left}px, ${spot.top}px, 0)` : `${from} scale(.8)`;
        const ms = spot ? 200 : 150;
        const a = g.animate([{ transform: from, opacity: 1 }, { transform: end, opacity: spot ? 1 : 0 }], { duration: ms, easing: EASE, fill: "forwards" });
        g.firstElementChild?.animate([{ transform: "scale(1.035) rotate(2deg)" }, { transform: "none" }], { duration: ms, easing: EASE, fill: "forwards" });
        a.onfinish = settle;
        a.oncancel = settle;
      });
      // A page put in the background stops animating: the drop still lands.
      window.setTimeout(settle, 400);
    };
    const up = () => land(true), cancel = () => land(false);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && s.live) cancel(); };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(s.frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
    };
  }, []);

  /** A mouse drags from anywhere on a card but its buttons; a finger only from the grip, so the page still scrolls. */
  const grab = useCallback((e: React.PointerEvent<HTMLElement>, code: string) => {
    if (e.button !== 0 || st.current.live || st.current.landing) return;
    const t = e.target as HTMLElement;
    const onGrip = !!t.closest(".tb-grip");
    if (!onGrip && (e.pointerType !== "mouse" || t.closest("button, a, input"))) return;
    if (onGrip) e.preventDefault();
    st.current.start = { code, x: e.clientX, y: e.clientY, el: e.currentTarget };
  }, []);
  return { lifted, over, ghost, grab };
}


/* ── The cards: drawn once and left alone while others move ── */

/** On My board, a card's subject: its name and shelf colour, on a tab along the card's top. */
interface Tag { title: string; colour: string }
type Item =
  | { id: string; src: string; tag?: Tag; type: "topic"; r: Row; hot: boolean }
  | { id: string; src: string; tag?: Tag; type: "paper"; s: Sitting }
  | { id: string; src: string; tag?: Tag; type: "note"; n: Note; groups: { slug: string; title: string; name: string; rows: Row[] }[] };

interface Acts {
  grab: (e: React.PointerEvent<HTMLElement>, id: string) => void;
  key: (e: React.KeyboardEvent, id: string, col: Col) => void;
  place: (id: string, to: Col, index?: number) => void;
  off: (id: string) => void;
  edit: (id: string) => void;
}

/** A card's element id: its board id, made safe for one ("p:paper-1|June 2024"). */
const domId = (id: string) => `tb-${id.replace(/[^\w-]/g, "_")}`;
const nameOf = (it: Item) => (it.type === "topic" ? short(it.r.t) : it.type === "paper" ? `${it.s.name}, ${it.s.session}` : it.n.title || "Your note");

/** ‹ › and × along a card's foot: shown on hover or focus, always on a touch screen. */
function Tools({ it, col, acts }: { it: Item; col: Col; acts: Acts }) {
  const i = COLS.findIndex(c => c.id === col);
  return (
    <span className="tb-tools">
      {it.type === "note" && <button type="button" aria-label={`Edit ${nameOf(it)}`} onClick={() => acts.edit(it.id)}>✎</button>}
      {i > 0 && <button type="button" aria-label={`Move to ${COLS[i - 1].name}`} onClick={() => acts.place(it.id, COLS[i - 1].id)}>‹</button>}
      {i < COLS.length - 1 && <button type="button" aria-label={`Move to ${COLS[i + 1].name}`} onClick={() => acts.place(it.id, COLS[i + 1].id)}>›</button>}
      <button type="button" aria-label={it.type === "note" ? `Delete ${nameOf(it)}` : `Take ${nameOf(it)} off your board`} onClick={() => acts.off(it.id)}>×</button>
    </span>
  );
}

const Grip = () => <span className="tb-grip" aria-hidden="true"><i /><i /><i /></span>;
const SubjectTag = ({ tag }: { tag?: Tag }) => (tag ? <span className="tb-tag" style={{ "--tag": tag.colour } as CSSProperties}>{tag.title}</span> : null);

function TopicFace({ it, col, practise, acts }: { it: Extract<Item, { type: "topic" }>; col: Col | null; practise: Practise; acts?: Acts }) {
  const { r } = it;
  const k = kind(r), pct = r.share !== null ? Math.round(r.share * 100) : null, n = col && nudge(r, col);
  return (
    <>
      <Grip />
      <div className="tb-main">
        <SubjectTag tag={it.tag} />
        <p className="tb-title" title={r.t.title}>{topicRef(r.t) && <span className="qb-code">{topicRef(r.t)} </span>}{short(r.t)}</p>
        <p className="tb-meta">
          {it.hot && <span className="tb-hot" title={`In ${it.r.t.count} exam questions: more than most topics`}>Comes up a lot</span>}
          {r.st.attempts ? <>{r.st.outOf ? `${r.st.scored}/${r.st.outOf} marks` : `${r.st.attempts} ${r.st.attempts === 1 ? "answer" : "answers"}`} · {ago(r.st.lastAt)}</> : <>{r.t.count} questions</>}
        </p>
      </div>
      <b className={`tb-pct ${pct !== null ? tone(r.share!) : "is-none"}`} aria-hidden="true">{pct !== null ? <>{pct}<i>%</i></> : "–"}</b>
      {!col && pct !== null && <span className={`tb-meter is-${k}`} aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>}
      {n && acts && <button type="button" className={`tb-nudge is-to-${n.to}`} onClick={() => acts.place(it.id, n.to)}>{n.text} <span aria-hidden="true">→ {COL_NAME[n.to]}</span></button>}
      {col && acts && (
        <div className="tb-foot">
          {pct !== null && <span className={`tb-meter is-${k}`} aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>}
          {practise(it.src, [r.t], r.st.attempts ? "Practise" : "Start", "tb-go")}
          <Tools it={it} col={col} acts={acts} />
        </div>
      )}
    </>
  );
}

/** A past paper: a sheet of exam paper, not a note, with its paper and mark scheme a tap away. */
function PaperFace({ it, col, acts }: { it: Extract<Item, { type: "paper" }>; col: Col | null; acts?: Acts }) {
  const { s } = it;
  return (
    <>
      <Grip />
      <div className="tb-main">
        <SubjectTag tag={it.tag} />
        <p className="tb-kicker">Past paper</p>
        <p className="tb-title" title={s.title}>{s.name}</p>
        <p className="tb-meta">{s.session}</p>
      </div>
      {col === "done" ? <b className="tb-stamp" aria-label="Done">Done</b> : <span className="tb-sheet-icon" aria-hidden="true" />}
      {col && acts && (
        <div className="tb-foot">
          {s.qp && <a className="tb-go" href={s.qp} target="_blank" rel="noopener">Paper <span aria-hidden="true">↗</span></a>}
          {s.ms && <a className="tb-go is-quiet" href={s.ms} target="_blank" rel="noopener">Mark scheme</a>}
          <Tools it={it} col={col} acts={acts} />
        </div>
      )}
    </>
  );
}

/** A note of the student's own: its title, a line or two, and its topics, practised together. */
function NoteFace({ it, col, practise, acts }: { it: Extract<Item, { type: "note" }>; col: Col | null; practise: Practise; acts?: Acts }) {
  const { n, groups } = it;
  const rows = groups.flatMap(g => g.rows);
  const scored = rows.filter(r => r.share !== null);
  const pct = scored.length ? Math.round((scored.reduce((x, r) => x + r.share!, 0) / scored.length) * 100) : null;
  return (
    <>
      <Grip />
      <span className="tb-pin" aria-hidden="true" />
      <div className="tb-main">
        <SubjectTag tag={it.tag} />
        <p className="tb-title">{n.title || "Your note"}</p>
        {n.text && <p className="tb-text">{n.text}</p>}
        {rows.length > 0 && (
          <ul className="tb-chips" aria-label="Topics">
            {rows.slice(0, 4).map((r, i) => <li key={i}>{short(r.t)}</li>)}
            {rows.length > 4 && <li className="is-more">+{rows.length - 4}</li>}
          </ul>
        )}
      </div>
      {pct !== null && <b className={`tb-pct ${tone(pct / 100)}`} aria-hidden="true">{pct}<i>%</i></b>}
      {col && acts && (
        <div className="tb-foot">
          {/* A note across subjects practises each subject's topics in that subject's bank. */}
          {groups.length === 1
            ? practise(groups[0].slug, groups[0].rows.map(r => r.t), groups[0].rows.length === 1 ? "Practise" : `Practise all ${groups[0].rows.length}`, "tb-go")
            : groups.map(g => <span key={g.slug} title={`Practise the ${g.title} topics`}>{practise(g.slug, g.rows.map(r => r.t), g.name, "tb-go")}</span>)}
          <Tools it={it} col={col} acts={acts} />
        </div>
      )}
    </>
  );
}

function Face({ it, col, practise, acts }: { it: Item; col: Col | null; practise: Practise; acts?: Acts }) {
  return it.type === "topic" ? <TopicFace it={it} col={col} practise={practise} acts={acts} />
    : it.type === "paper" ? <PaperFace it={it} col={col} acts={acts} />
      : <NoteFace it={it} col={col} practise={practise} acts={acts} />;
}
const look = (it: Item) => (it.type === "topic" ? `is-${kind(it.r)}` : it.type === "paper" ? "is-paper" : `is-note tint-${it.n.tint}`);

const Card = memo(function Card({ it, col, here, practise, acts }: { it: Item; col: Col; here: boolean; practise: Practise; acts: Acts }) {
  const label = it.type === "topic" ? `${short(it.r.t)}${it.r.share !== null ? `, ${Math.round(it.r.share * 100)}% of marks` : ", not tried yet"}`
    : it.type === "paper" ? `Past paper: ${it.s.title}, ${it.s.session}` : `Note: ${nameOf(it)}`;
  return (
    <li id={domId(it.id)} data-card className={`tb-card ${look(it)}${here ? " is-here" : ""}`} tabIndex={0} aria-label={label} aria-describedby="tb-keys"
      onPointerDown={e => acts.grab(e, it.id)} onKeyDown={e => acts.key(e, it.id, col)}>
      <Face it={it} col={col} practise={practise} acts={acts} />
    </li>
  );
});

/**
 * A column's cards, in a list that scrolls inside the column once it's full, so a long column stays the
 * board's height. A fade at either end says there's more; it's set straight on the element as it scrolls.
 */
function ColumnList({ children }: { children: ReactNode }) {
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const el = list.current, box = el?.parentElement;
    if (!el || !box) return;
    const edges = () => {
      box.classList.toggle("has-above", el.scrollTop > 2);
      box.classList.toggle("has-below", el.scrollTop < el.scrollHeight - el.clientHeight - 2);
    };
    edges();
    el.addEventListener("scroll", edges, { passive: true });
    const ro = new ResizeObserver(edges);
    ro.observe(el);
    const mo = new MutationObserver(edges);
    mo.observe(el, { childList: true });
    return () => { el.removeEventListener("scroll", edges); ro.disconnect(); mo.disconnect(); };
  }, []);
  return <div className="tb-scroll"><ul ref={list} className="tb-list">{children}</ul></div>;
}


/* ── The board ── */

/*
 * On a subject's page the board is that subject's; on My board it's every subject at once. Either way each
 * subject's cards live in that subject's own board (above), so a card moved on one is moved on the other.
 * Inside, every card's id carries its subject ("aqa-gcse-maths/N14"). My board keeps two things of its
 * own: the order of each column across subjects, and notes whose topics span subjects (subject "*").
 */
const CROSS = "*";
const join = (src: string, id: string) => `${src}/${id}`;
const split = (id: string): [string, string] => { const i = id.indexOf("/"); return [id.slice(0, i), id.slice(i + 1)]; };

/** My board's own: each column's order across subjects, notes across subjects, and the subjects taken off it. */
interface Mine { order: Record<Col, string[]>; notes: Record<string, Note>; hidden: string[] }
const MINE_KEY = "plumi-my-board:v1";
const mineListeners = new Set<() => void>();
let mineMemory = "";
const mineStore = {
  read: () => { try { return localStorage.getItem(MINE_KEY) ?? mineMemory; } catch { return mineMemory; } },
  subscribe: (cb: () => void) => {
    mineListeners.add(cb);
    const onStorage = (e: StorageEvent) => { if (e.key === MINE_KEY) cb(); };
    window.addEventListener("storage", onStorage);
    return () => { mineListeners.delete(cb); window.removeEventListener("storage", onStorage); };
  },
  write: (v: string) => { mineMemory = v; try { localStorage.setItem(MINE_KEY, v); } catch { /* memory only */ } mineListeners.forEach(cb => cb()); },
};
const parseMine = (raw: string): Mine => {
  let v: Partial<Mine> = {};
  try { v = JSON.parse(raw) ?? {}; } catch { /* a fresh board */ }
  const order = Object.fromEntries(COLS.map(c => [c.id, strings(v.order?.[c.id])])) as Record<Col, string[]>;
  const notes: Record<string, Note> = {};
  for (const [id, n] of Object.entries(v.notes ?? {})) if (n && typeof n.title === "string") notes[id] = { title: n.title, text: n.text ?? "", topics: strings(n.topics), tint: TINTS.includes(n.tint) ? n.tint : "yellow" };
  return { order, notes, hidden: strings(v.hidden) };
};
/** The subjects a student has on My board: any with a board of its own, or marks in it, less any taken off. */
export function useSubjectsOnBoard(): string[] {
  const marks = useBankMarks();
  const raw = useSyncExternalStore(boards.subscribe, boards.read, () => "");
  const hidden = parseMine(useSyncExternalStore(mineStore.subscribe, mineStore.read, () => "")).hidden;
  return useMemo(() => {
    const marked = Object.keys(marks.subjects).filter(k => Object.keys(marks.subjects[k] ?? {}).length);
    return [...new Set([...Object.keys(parseBoards(raw)), ...marked])].filter(s => !hidden.includes(s));
  }, [marks, raw, hidden]);
}
/** Takes a subject off My board, or puts it back; its own board is kept either way. */
export function setSubjectHidden(slug: string, hide: boolean) {
  const m = parseMine(mineStore.read());
  mineStore.write(JSON.stringify({ ...m, hidden: hide ? [...new Set([...m.hidden, slug])] : m.hidden.filter(x => x !== slug) }));
}
/** Puts a subject on My board: its board saved as a new one starts, its three most-asked topics in Up next. */
export function addSubjectBoard(s: BoardSubject) {
  const all = parseBoards(boards.read());
  if (all[s.slug]) return;
  const rows = digest(s, undefined);
  all[s.slug] = merge(undefined, rows, new Map(), new Set(), hotOf(rows));
  boards.write(JSON.stringify(all));
}

export function TopicBoard({ look: design, subjects, mine = false, practise, lockedTopic, onHide, extra }: {
  look: BoardLook;
  /** The subject on its own page, or every one on My board. */
  subjects: BoardSubject[];
  /** My board: every subject at once, with a chip to show one. */
  mine?: boolean;
  practise: Practise; lockedTopic?: string;
  /** My board: take a subject off it (its board is kept). */
  onHide?: (slug: string) => void;
  /** My board: after the subject chips, "+ Add a subject". */
  extra?: ReactNode;
}) {
  const marks = useBankMarks();
  const per = useMemo(() => subjects.map(s => {
    const rows = digest(s, marks.subjects[s.slug]);
    const hot = hotOf(rows);
    const sittings = new Map(s.papers.flatMap(p => p.sessions.map(x => {
      const key = `${p.track}|${x.session}`;
      return [PAPER + key, { key, name: p.name, title: p.title, session: x.session, qp: x.qp, ms: x.ms }] as const;
    })));
    return { s, rows, hot, hotSet: new Set(hot.map(r => r.t.code)), byCode: new Map(rows.map(r => [r.t.code, r])), sittings };
  }), [subjects, marks]);
  const perOf = useMemo(() => new Map(per.map(p => [p.s.slug, p])), [per]);
  const raw = useSyncExternalStore(boards.subscribe, boards.read, () => "");
  const mineRaw = useSyncExternalStore(mineStore.subscribe, mineStore.read, () => "");
  // A tick on the Past papers pages is a paper's place here: read live, so a tick in another tab moves the card.
  const doneRaw = useSyncExternalStore(subscribePapersDone, () => [...readPapersDone()].sort().join("\n"), () => "");
  const done = useMemo(() => new Set(doneRaw ? doneRaw.split("\n") : []), [doneRaw]);
  const boardOf = useMemo(() => {
    const all = parseBoards(raw);
    return new Map(per.map(p => [p.s.slug, merge(all[p.s.slug], p.rows, p.sittings, done, p.hot)]));
  }, [raw, per, done]);
  const my = useMemo(() => parseMine(mineRaw), [mineRaw]);

  const items = useMemo(() => {
    const m = new Map<string, Item>();
    for (const p of per) {
      const src = p.s.slug, tag = mine ? { title: p.s.title, colour: p.s.colour } : undefined;
      for (const r of p.rows) m.set(join(src, r.t.code), { id: join(src, r.t.code), src, tag, type: "topic", r, hot: p.hotSet.has(r.t.code) });
      for (const [lid, s] of p.sittings) m.set(join(src, lid), { id: join(src, lid), src, tag, type: "paper", s });
      for (const [lid, n] of Object.entries(boardOf.get(src)!.notes)) {
        m.set(join(src, lid), { id: join(src, lid), src, tag, type: "note", n, groups: [{ slug: src, title: p.s.title, name: p.s.name, rows: n.topics.map(c => p.byCode.get(c)!).filter(Boolean) }] });
      }
    }
    if (mine) for (const [lid, n] of Object.entries(my.notes)) {
      const groups = per.map(p => ({ slug: p.s.slug, title: p.s.title, name: p.s.name, rows: n.topics.filter(t => split(t)[0] === p.s.slug).map(t => p.byCode.get(split(t)[1])!).filter(Boolean) })).filter(g => g.rows.length);
      m.set(join(CROSS, lid), { id: join(CROSS, lid), src: CROSS, type: "note", n, groups });
    }
    return m;
  }, [per, boardOf, my.notes, mine]);

  // Every column in full: one subject's in its own order; on My board every subject's, in My board's order.
  const full = useMemo(() => {
    const out = {} as Record<Col, string[]>;
    for (const c of COLS) {
      const ids = per.flatMap(p => boardOf.get(p.s.slug)!.cols[c.id].map(l => join(p.s.slug, l)));
      if (!mine) { out[c.id] = ids; continue; }
      const pool = new Set([...ids, ...my.order[c.id].filter(id => id.startsWith(`${CROSS}/`) && items.has(id))]);
      const ordered = my.order[c.id].filter(id => pool.has(id));
      const placed = new Set(ordered);
      out[c.id] = [...ordered, ...ids.filter(id => !placed.has(id))];
    }
    return out;
  }, [per, boardOf, mine, my.order, items]);
  const [filter, setFilter] = useState("all");
  const shown = filter !== "all" && perOf.has(filter) ? filter : "all";
  const cols = useMemo(() => {
    const showing = (id: string) => {
      if (shown === "all") return true;
      const it = items.get(id);
      return split(id)[0] === shown || (it?.type === "note" && it.groups.some(g => g.slug === shown));
    };
    return Object.fromEntries(COLS.map(c => [c.id, full[c.id].filter(showing)])) as Record<Col, string[]>;
  }, [full, shown, items]);
  const colOf = useMemo(() => new Map(COLS.flatMap(c => full[c.id].map(id => [id, c.id] as const))), [full]);

  const [adding, setAdding] = useState<Col | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const phone = usePhone();
  const [sheet, setSheet] = useState(false);
  const [at, setAt] = useState(0);
  const row = useRef<HTMLDivElement>(null);
  /** A phone's column tabs: tap one to slide to its column; swiping sets the tab. */
  const toColumn = (i: number) => {
    const el = row.current?.children[i] as HTMLElement | undefined;
    if (el && row.current) row.current.scrollTo({ left: el.offsetLeft - row.current.offsetLeft - parseFloat(getComputedStyle(row.current).paddingLeft || "0"), behavior: still() ? "auto" : "smooth" });
    setAt(i);
  };
  const onSwipe = () => {
    const r = row.current, first = r?.children[0] as HTMLElement | undefined;
    if (r && first) setAt(Math.max(0, Math.min(COLS.length - 1, Math.round(r.scrollLeft / (first.offsetWidth + parseFloat(getComputedStyle(r).columnGap || "0"))))));
  };

  // FLIP: note where every card is just before a change, and once it's drawn, glide each from there to its new place.
  const flipFrom = useRef<Map<string, DOMRect> | null>(null);
  const snapshot = useCallback(() => {
    if (!root.current || still()) return;
    const m = new Map<string, DOMRect>();
    root.current.querySelectorAll<HTMLElement>("[data-card]").forEach(el => m.set(el.id, el.getBoundingClientRect()));
    flipFrom.current = m;
  }, []);
  useLayoutEffect(() => {
    const from = flipFrom.current;
    if (!from || !root.current) return;
    flipFrom.current = null;
    root.current.querySelectorAll<HTMLElement>("[data-card]").forEach(el => {
      const a = from.get(el.id);
      if (!a) return;
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: 200, easing: EASE });
    });
  });

  // A card moved by the keyboard lands in another column, a new element: focus follows it once it's drawn.
  // One moved by a button, or added, goes to the top of its column: that column scrolls up to show it.
  const refocus = useRef<string | null>(null);
  const reveal = useRef<Col | null>(null);
  useEffect(() => {
    if (refocus.current) document.getElementById(domId(refocus.current))?.focus();
    else if (reveal.current) root.current?.querySelector(`.tb-col.is-${reveal.current} .tb-list`)?.scrollTo({ top: 0, behavior: still() ? "auto" : "smooth" });
    refocus.current = null;
    reveal.current = null;
  });

  const saveBoard = (slug: string, b: Board) => {
    const all = parseBoards(boards.read());
    all[slug] = b;
    boards.write(JSON.stringify(all));
  };
  const saveMine = (m: Mine) => mineStore.write(JSON.stringify(m));
  const lose = (b: Board, lid: string): Board => {
    const out: Board = { cols: { ...b.cols }, off: b.off.filter(x => x !== lid), notes: b.notes };
    for (const c of COLS) out.cols[c.id] = out.cols[c.id].filter(x => x !== lid);
    return out;
  };
  /** Into a column at `index` of what's shown: the top unless said, so a card moved by a key or a button, or just added, is in sight. */
  const place = (id: string, to: Col, index = 0, focus = false) => {
    const it = items.get(id);
    if (!it) return;
    snapshot();
    const [src, lid] = split(id);
    const shownNow = cols[to].filter(x => x !== id);
    const anchor = shownNow[index];
    if (src !== CROSS) {
      const b = lose(boardOf.get(src)!, lid);
      const list = [...b.cols[to]];
      list.splice(shownNow.slice(0, index).filter(x => split(x)[0] === src).length, 0, lid);
      b.cols[to] = list;
      // A paper's tick follows it into Got it and out again.
      if (lid.startsWith(PAPER)) setPaperDone(lid.slice(PAPER.length), to === "done");
      saveBoard(src, b);
    }
    if (mine) {
      const order = { ...my.order };
      for (const c of COLS) order[c.id] = full[c.id].filter(x => x !== id);
      const at = anchor ? order[to].indexOf(anchor) : -1;
      order[to].splice(at < 0 ? order[to].length : at, 0, id);
      saveMine({ ...my, order });
    }
    setSaid(`${nameOf(it)} is in ${COL_NAME[to]}`);
    if (focus) refocus.current = id;
    else if (index === 0) reveal.current = to;
  };
  const takeOff = (id: string) => {
    const it = items.get(id);
    if (!it) return;
    const [src, lid] = split(id);
    if (it.type === "note") {
      // A note is the student's own: gone means gone, so it asks.
      if (!window.confirm(`Delete “${nameOf(it)}”?`)) return;
      snapshot();
      if (src === CROSS) {
        const notes = { ...my.notes };
        delete notes[lid];
        saveMine({ ...my, order: Object.fromEntries(COLS.map(c => [c.id, my.order[c.id].filter(x => x !== id)])) as Record<Col, string[]>, notes });
      } else {
        const b = lose(boardOf.get(src)!, lid);
        const notes = { ...b.notes };
        delete notes[lid];
        saveBoard(src, { ...b, notes });
      }
      setSaid(`${nameOf(it)} deleted`);
      return;
    }
    snapshot();
    const b = lose(boardOf.get(src)!, lid);
    b.off = [lid, ...b.off];
    saveBoard(src, b);
    setSaid(`${nameOf(it)} taken off your board`);
  };
  const keys = (e: React.KeyboardEvent, id: string, col: Col) => {
    const i = COLS.findIndex(c => c.id === col), at = cols[col].indexOf(id);
    if (e.key === "ArrowRight" && i < COLS.length - 1) place(id, COLS[i + 1].id, 0, true);
    else if (e.key === "ArrowLeft" && i > 0) place(id, COLS[i - 1].id, 0, true);
    else if (e.key === "ArrowUp" && at > 0) place(id, col, at - 1, true);
    else if (e.key === "ArrowDown" && at < cols[col].length - 1) place(id, col, at + 1, true);
    else if (e.key === "Delete" || e.key === "Backspace") takeOff(id);
    else return;
    e.preventDefault();
  };
  /** A note's topics come as card ids; one subject's note lives on that subject's board, one across subjects on My board. */
  const saveNote = (id: string | null, note: Note, to: Col) => {
    snapshot();
    const srcs = [...new Set(note.topics.map(t => split(t)[0]))];
    const local = (n: Note): Note => ({ ...n, topics: n.topics.map(t => split(t)[1]) });
    if (id) {
      const [src, lid] = split(id);
      if (src === CROSS) saveMine({ ...my, notes: { ...my.notes, [lid]: note } });
      else { const b = boardOf.get(src)!; saveBoard(src, { ...b, notes: { ...b.notes, [lid]: local(note) } }); }
    } else {
      const lid = `${NOTE}${Date.now().toString(36)}`;
      const home = !mine ? per[0].s.slug : srcs.length === 1 ? srcs[0] : srcs.length === 0 && shown !== "all" ? shown : srcs.length === 0 && per.length === 1 ? per[0].s.slug : CROSS;
      if (home === CROSS) saveMine({ ...my, order: { ...my.order, [to]: [join(CROSS, lid), ...full[to]] }, notes: { ...my.notes, [lid]: note } });
      else {
        const b = boardOf.get(home)!;
        saveBoard(home, { ...b, notes: { ...b.notes, [lid]: local(note) }, cols: { ...b.cols, [to]: [lid, ...b.cols[to]] } });
        if (mine) saveMine({ ...my, order: { ...my.order, [to]: [join(home, lid), ...full[to]] } });
      }
      reveal.current = to;
    }
    setEditing(null);
    setSaid(id ? `${note.title || "Note"} saved` : `${note.title || "Note"} added to ${COL_NAME[to]}`);
  };

  // The cards and the tray hold on to one set of actions, so a drag's re-draws pass them by; each reads the latest board.
  const latest = useRef({ place, takeOff, keys });
  useLayoutEffect(() => { latest.current = { place, takeOff, keys }; });
  const { lifted, over, ghost, grab } = useLift(
    (id, to) => (to.col === "off" ? latest.current.takeOff(id) : latest.current.place(id, to.col, to.index)),
    snapshot,
  );
  const acts = useMemo<Acts>(() => ({
    grab,
    key: (e, id, col) => latest.current.keys(e, id, col),
    place: (id, to, index) => latest.current.place(id, to, index),
    off: id => latest.current.takeOff(id),
    edit: id => setEditing(id),
  }), [grab]);
  const addTo = adding ?? "next";
  const onAdd = useCallback((id: string) => latest.current.place(id, addTo), [addTo]);
  const onClose = useCallback(() => setAdding(null), []);

  // What the head counts: the topics of the subjects shown.
  const inView = shown === "all" ? per : per.filter(p => p.s.slug === shown);
  const topicCount = inView.reduce((n, p) => n + p.rows.length, 0);
  const isTopic = (id: string) => items.get(id)?.type === "topic";
  const onBoard = COLS.reduce((n, c) => n + cols[c.id].filter(isTopic).length, 0);
  const secure = cols.done.filter(isTopic).length;
  const suggest = inView.flatMap(p => p.hot.filter(r => !colOf.has(join(p.s.slug, r.t.code))).slice(0, mine ? 1 : 3).map(r => ({ p, r }))).slice(0, 3);
  const editorOptions = useMemo(() => {
    const srcOf = editing && editing !== "new" ? split(editing)[0] : null;
    const from = srcOf && srcOf !== CROSS ? per.filter(p => p.s.slug === srcOf) : shown !== "all" ? per.filter(p => p.s.slug === shown) : per;
    return from.flatMap(p => p.rows.map(r => ({ id: join(p.s.slug, r.t.code), r, label: mine && from.length > 1 ? p.s.title : undefined, hot: p.hotSet.has(r.t.code) })));
  }, [editing, per, shown, mine]);
  const editingNote = editing && editing !== "new" ? (() => {
    const it = items.get(editing);
    if (it?.type !== "note") return undefined;
    const [src] = split(editing);
    return src === CROSS ? it.n : { ...it.n, topics: it.n.topics.map(c => join(src, c)) };
  })() : undefined;

  const tabs = phone && (
    <div className="tb-coltabs" role="tablist" aria-label="Columns">
      {COLS.map((c, i) => (
        <button key={c.id} type="button" role="tab" aria-selected={at === i} className={`is-${c.id}${at === i ? " is-on" : ""}`} onClick={() => toColumn(i)}>
          <span>{c.name}</span><b>{cols[c.id].length}</b>
        </button>
      ))}
    </div>
  );
  const columns = (
    <div className="tb-cols" ref={row} onScroll={phone ? onSwipe : undefined}>
      {COLS.map(c => {
        const ids = cols[c.id];
        const scored = ids.map(id => items.get(id)).filter((it): it is Extract<Item, { type: "topic" }> => it?.type === "topic" && it.r.share !== null);
        const avg = scored.length ? Math.round((scored.reduce((n, it) => n + it.r.share!, 0) / scored.length) * 100) : null;
        const here = over?.col === c.id;
        const cards: ReactNode[] = ids.filter(id => id !== lifted?.code && items.has(id))
          .map(id => <Card key={id} it={items.get(id)!} col={c.id} here={!!lockedTopic && id === join(per[0]?.s.slug, lockedTopic)} practise={practise} acts={acts} />);
        if (here && lifted) cards.splice(Math.min(over!.index, cards.length), 0, <li key="place" className="tb-place" style={{ "--h": `${lifted.h}px` } as CSSProperties} aria-hidden="true" />);
        return (
          <section key={c.id} className={`tb-col is-${c.id}${here ? " is-over" : ""}`} data-col={c.id} aria-labelledby={`tb-h-${c.id}`}>
            <header className="tb-col-head">
              <h4 id={`tb-h-${c.id}`}>{c.name}</h4>
              <span className="tb-count">{ids.length}</span>
              {avg !== null && <span className="tb-avg" title="The average share of the marks on these topics">{avg}%</span>}
            </header>
            <p className="tb-hint">{c.hint}</p>
            {!ids.length && !here && (
              c.id === "next" && suggest.length ? (
                <div className="tb-empty">
                  <p>These come up most:</p>
                  {suggest.map(({ p, r }) => <button key={join(p.s.slug, r.t.code)} type="button" className="tb-suggest" onClick={() => place(join(p.s.slug, r.t.code), "next")}>+ {short(r.t)}{mine && shown === "all" && <small> · {p.s.title}</small>}</button>)}
                </div>
              ) : <p className="tb-empty">{c.id === "done" ? "Topics and papers you’re sure of go here." : "Drag a card here."}</p>
            )}
            <ColumnList>{cards}</ColumnList>
            {design === "board" && <button type="button" className="tb-add" aria-expanded={adding === c.id} onClick={() => { if (phone) { setAdding(c.id); setSheet(true); } else setAdding(a => (a === c.id ? null : c.id)); }}>+ Add</button>}
          </section>
        );
      })}
    </div>
  );

  const sources = useMemo(() => inView.map(p => ({ slug: p.s.slug, title: p.s.title, colour: p.s.colour, rows: p.rows, hot: p.hotSet, sittings: p.sittings })), [inView]);
  const closeSheet = useCallback(() => { setSheet(false); setAdding(null); }, []);
  const library = (mode: "pop" | "tray" | "side" | "sheet") => (
    <Library key={shown} mode={mode} sources={sources} colOf={colOf} target={addTo} grab={grab} lifted={lifted?.code} onAdd={onAdd}
      onClose={mode === "pop" ? onClose : mode === "sheet" ? closeSheet : undefined} />
  );

  const counts = useMemo(() => new Map(per.map(p => [p.s.slug, COLS.reduce((n, c) => n + full[c.id].filter(id => split(id)[0] === p.s.slug).length, 0)])), [per, full]);
  const head = (
    <header className="tb-head">
      <div>
        <h3 className="tb-heading">{mine ? (shown === "all" ? "Everything you’re revising" : perOf.get(shown)!.s.title) : "Your revision board"}</h3>
        <p className="tb-sum">
          <b>{secure}</b> of {topicCount} topics secure{mine && shown === "all" ? ` across ${per.length} ${per.length === 1 ? "subject" : "subjects"}` : ""} · {onBoard} on your board
          {!mine && <> · <Link href="/my-board" className="tb-allsubjects">All your subjects on My board <span aria-hidden="true">→</span></Link></>}
        </p>
      </div>
      <span className="tb-progress" aria-hidden="true">
        {COLS.map(c => { const n = cols[c.id].filter(isTopic).length; return n > 0 && <i key={c.id} className={`is-${c.id}`} style={{ flexGrow: n }} />; })}
        {topicCount - onBoard > 0 && <i className="is-off" style={{ flexGrow: topicCount - onBoard }} />}
      </span>
      <div className="tb-head-acts">
        <button type="button" className="tb-newnote" aria-expanded={editing === "new"} onClick={() => setEditing(e => (e === "new" ? null : "new"))}><span aria-hidden="true">✎</span> New note</button>
        {design === "board" && !phone && <button type="button" className="tb-addall" aria-expanded={adding !== null} onClick={() => setAdding(a => (a ? null : "next"))}><span aria-hidden="true">+</span> Add</button>}
      </div>
    </header>
  );

  const chips = mine && (
    <nav className="tb-subjects" aria-label="Subjects">
      <button type="button" aria-pressed={shown === "all"} className={`tb-subject${shown === "all" ? " is-on" : ""}`} onClick={() => setFilter("all")}>All subjects</button>
      {per.map(p => (
        <span key={p.s.slug} className={`tb-subject${shown === p.s.slug ? " is-on" : ""}`} style={{ "--tag": p.s.colour } as CSSProperties}>
          <button type="button" aria-pressed={shown === p.s.slug} onClick={() => setFilter(f => (f === p.s.slug ? "all" : p.s.slug))}>
            <i aria-hidden="true" />{p.s.title} <small>{counts.get(p.s.slug)}</small>
          </button>
          {onHide && <button type="button" className="tb-subject-x" aria-label={`Take ${p.s.title} off My board`} onClick={() => { if (shown === p.s.slug) setFilter("all"); onHide(p.s.slug); }}>×</button>}
        </span>
      ))}
      {extra}
    </nav>
  );

  const liftedItem = lifted && items.get(lifted.code);
  return (
    <div ref={root} className={`tb is-${design}${mine ? " is-mine" : ""}${lifted ? " is-lifting" : ""}`}>
      <BoardLookSwitch />
      {head}
      {chips}
      {editing && (
        <NoteEditor key={editing} options={editorOptions} note={editingNote}
          onSave={(n, to) => saveNote(editing === "new" ? null : editing, n, to)} onCancel={() => setEditing(null)} />
      )}
      {phone ? (
        <>
          <button type="button" className="tb-addbar" aria-expanded={sheet} onClick={() => setSheet(true)}><span aria-hidden="true">+</span> Add topics or past papers</button>
          {sheet && (
            <>
              <div className="tb-sheet-back" aria-hidden="true" onClick={closeSheet} />
              {library("sheet")}
            </>
          )}
          {tabs}
          {columns}
        </>
      ) : <>
        {design === "board" && adding && library("pop")}
        {design === "sticky" && library("tray")}
        {design === "sidebar" ? <div className="tb-shell">{library("side")}{columns}</div> : columns}
      </>}
      <p id="tb-keys" className="qb-sr">Drag to move. Or use the left and right arrow keys to move between columns, up and down to reorder, Delete to take it off.</p>
      <p className="qb-sr" role="status">{said}</p>
      {lifted && liftedItem && (
        <div ref={ghost} className="tb-ghost" aria-hidden="true" style={{ width: lifted.w, transform: `translate3d(${lifted.x0 - lifted.dx}px, ${lifted.y0 - lifted.dy}px, 0)` }}>
          <div className={`tb-card tb-ghost-card ${look(liftedItem)}${colOf.has(lifted.code) ? ` in-${colOf.get(lifted.code)}` : ""}`}>
            <Face it={liftedItem} col={null} practise={practise} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── A note of the student's own: a title, a line or two, topics to practise together, a colour ── */

function NoteEditor({ options, note, onSave, onCancel }: {
  options: { id: string; r: Row; label?: string; hot: boolean }[]; note?: Note; onSave: (n: Note, to: Col) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [text, setText] = useState(note?.text ?? "");
  const [topics, setTopics] = useState<string[]>(note?.topics ?? []);
  const [tint, setTint] = useState<Tint>(note?.tint ?? "yellow");
  const [to, setTo] = useState<Col>("next");
  const [q, setQ] = useState("");
  const terms = words(q);
  const byId = new Map(options.map(o => [o.id, o]));
  const hits = terms.length ? options.filter(o => !topics.includes(o.id) && terms.every(w => `${topicRef(o.r.t)} ${o.r.t.title} ${o.r.t.short ?? ""} ${o.label ?? ""}`.toLowerCase().includes(w))).slice(0, 6) : [];
  const toggle = (id: string) => setTopics(t => (t.includes(id) ? t.filter(x => x !== id) : [...t, id]));
  return (
    <form className={`tb-editor tint-${tint}`} aria-label={note ? "Edit note" : "New note"}
      onSubmit={e => { e.preventDefault(); onSave({ title: title.trim(), text: text.trim(), topics, tint }, to); }}
      onKeyDown={e => { if (e.key === "Escape") onCancel(); }}>
      <div className="tb-editor-paper">
        <span className="tb-pin" aria-hidden="true" />
        <label className="qb-sr" htmlFor="tb-note-title">Title</label>
        <input id="tb-note-title" className="tb-editor-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Give it a name, e.g. “Mock prep”" maxLength={60} autoFocus autoComplete="off" />
        <label className="qb-sr" htmlFor="tb-note-text">Note</label>
        <textarea id="tb-note-text" className="tb-editor-text" value={text} onChange={e => setText(e.target.value)} placeholder="Anything to remember (optional)" maxLength={240} rows={2} />
        {topics.length > 0 && (
          <ul className="tb-chips is-edit" aria-label="Topics on this note">
            {topics.map(id => byId.get(id) && (
              <li key={id}><button type="button" aria-label={`Remove ${short(byId.get(id)!.r.t)}`} onClick={() => toggle(id)}>{short(byId.get(id)!.r.t)} <span aria-hidden="true">×</span></button></li>
            ))}
          </ul>
        )}
      </div>
      <div className="tb-editor-side">
        <label className="qb-find-box tb-lib-find">
          <span className="qb-sr">Add a topic to this note</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Add topics, e.g. “circle”" autoComplete="off"
            onKeyDown={e => { if (e.key === "Enter" && hits[0]) { e.preventDefault(); toggle(hits[0].id); setQ(""); } }} />
        </label>
        {hits.length > 0 && (
          <ul className="tb-editor-hits">
            {hits.map(o => (
              <li key={o.id}><button type="button" onClick={() => { toggle(o.id); setQ(""); }}>
                + {topicRef(o.r.t) && <span className="qb-code">{topicRef(o.r.t)} </span>}{short(o.r.t)}{o.hot && <span className="tb-hot">Comes up a lot</span>}{o.label && <small> · {o.label}</small>}
              </button></li>
            ))}
          </ul>
        )}
        <div className="tb-editor-row">
          <span className="tb-editor-label">Colour</span>
          <span className="tb-tints" role="radiogroup" aria-label="Colour">
            {TINTS.map(t => <button key={t} type="button" role="radio" aria-checked={tint === t} aria-label={t} className={`tint-${t}${tint === t ? " is-on" : ""}`} onClick={() => setTint(t)} />)}
          </span>
        </div>
        {!note && (
          <label className="tb-editor-row">
            <span className="tb-editor-label">Put it in</span>
            <select value={to} onChange={e => setTo(e.target.value as Col)}>{COLS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
        )}
        <div className="tb-editor-go">
          <button type="button" className="qb-link" onClick={onCancel}>Cancel</button>
          <button type="submit" className="lp-btn tb-editor-save" disabled={!title.trim() && !topics.length}>{note ? "Save note" : "Pin it"}</button>
        </div>
      </div>
    </form>
  );
}

/* ── The tray: a subject's topics and past papers; search, add, or drag onto the board ── */

interface Source { slug: string; title: string; colour: string; rows: Row[]; hot: Set<string>; sittings: Map<string, Sitting> }

const Library = memo(function Library({ mode, sources, colOf, target, grab, lifted, onAdd, onClose }: {
  mode: "pop" | "tray" | "side" | "sheet"; sources: Source[]; colOf: Map<string, Col>; target: Col; lifted?: string;
  grab: (e: React.PointerEvent<HTMLElement>, id: string) => void; onAdd: (id: string) => void; onClose?: () => void;
}) {
  const [slug, setSlug] = useState(sources[0]?.slug ?? "");
  const src = sources.find(x => x.slug === slug) ?? sources[0];
  const [shelf, setShelf] = useState<"topics" | "papers">("topics");
  const [q, setQ] = useState("");
  const [area, setArea] = useState("all");
  const [order, setOrder] = useState<"spec" | "asked">("asked");
  if (!src) return null;
  const { rows, hot, sittings } = src;
  const id = (local: string) => join(src.slug, local);
  const terms = words(q);
  const areas = [...new Set(rows.map(r => r.section))];
  const free = (x: string) => mode === "pop" || mode === "sheet" || !colOf.has(x);
  const topicHits = rows.filter(r => (area === "all" || r.section === area) && free(id(r.t.code))
    && terms.every(w => `${topicRef(r.t)} ${r.t.title} ${r.t.short ?? ""} ${r.section}`.toLowerCase().includes(w)));
  if (order === "asked") topicHits.sort((a, b) => b.t.count - a.t.count);
  const paperNames = [...new Set([...sittings.values()].map(s => s.name))];
  const paperHits = [...sittings.entries()].filter(([lid, s]) => (area === "all" || s.name === area) && free(id(lid))
    && terms.every(w => `${s.name} ${s.title} ${s.session}`.toLowerCase().includes(w)));
  const hits = shelf === "topics" ? topicHits.map(r => ({ id: id(r.t.code), r })) : paperHits.map(([lid, s]) => ({ id: id(lid), s }));
  const pick = (to: "topics" | "papers") => { setShelf(to); setArea("all"); };
  return (
    <section className={`tb-lib is-${mode}`} data-col="off" aria-label="Topics and past papers" role={mode === "sheet" ? "dialog" : undefined} aria-modal={mode === "sheet" || undefined}
      onKeyDown={mode === "sheet" ? e => { if (e.key === "Escape") onClose?.(); } : undefined}>
      {mode === "sheet" && <span className="tb-sheet-grab" aria-hidden="true" />}
      <div className="tb-lib-top">
        <p className="tb-lib-title">{mode === "pop" || mode === "sheet" ? <>Add to <b>{COL_NAME[target]}</b></> : mode === "tray" ? "Tray" : "Add to your board"}</p>
        {sources.length > 1 && (
          <label className="tb-lib-subject" style={{ "--tag": src.colour } as CSSProperties}>
            <span className="qb-sr">Subject</span>
            <select value={src.slug} onChange={e => { setSlug(e.target.value); setArea("all"); }}>{sources.map(x => <option key={x.slug} value={x.slug}>{x.title}</option>)}</select>
          </label>
        )}
        {sittings.size > 0 && (
          <div className="tb-shelves" role="tablist" aria-label="What to add">
            <button type="button" role="tab" aria-selected={shelf === "topics"} className={shelf === "topics" ? "is-on" : ""} onClick={() => pick("topics")}>Topics</button>
            <button type="button" role="tab" aria-selected={shelf === "papers"} className={shelf === "papers" ? "is-on" : ""} onClick={() => pick("papers")}>Past papers</button>
          </div>
        )}
        <label className="qb-find-box tb-lib-find">
          <span className="qb-sr">{shelf === "topics" ? "Find a topic" : "Find a paper"}</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={shelf === "topics" ? "Find a topic" : "Find a paper, e.g. “2023”"} autoComplete="off" autoFocus={mode === "pop"}
            onKeyDown={e => { if (e.key === "Enter" && hits[0] && !colOf.has(hits[0].id)) { e.preventDefault(); onAdd(hits[0].id); setQ(""); } if (e.key === "Escape" && onClose) onClose(); }} />
        </label>
        {onClose && <button type="button" className="tb-lib-x" aria-label={mode === "sheet" ? "Done" : "Close"} onClick={onClose}>{mode === "sheet" ? "Done" : "×"}</button>}
      </div>
      <div className="tb-areas" role="group" aria-label={shelf === "topics" ? "Area" : "Paper"}>
        {["all", ...(shelf === "topics" ? areas : paperNames)].map(a => <button key={a} type="button" aria-pressed={area === a} className={area === a ? "is-on" : ""} onClick={() => setArea(a)}>{a === "all" ? (shelf === "topics" ? "All areas" : "All papers") : a}</button>)}
        {shelf === "topics" && <button type="button" className="tb-order" onClick={() => setOrder(o => (o === "asked" ? "spec" : "asked"))}>{order === "asked" ? "Most common first" : "Spec order"} <span aria-hidden="true">⇅</span></button>}
      </div>
      {hits.length ? (
        <ul className="tb-lib-list">
          {hits.map((h, i) => {
            const on = colOf.get(h.id);
            const r = "r" in h ? h.r : null, s = "s" in h ? h.s : null;
            const prev = hits[i - 1];
            const group = mode === "side" && area === "all" && order === "spec" && r && r.section !== (prev && "r" in prev ? prev.r.section : "");
            return [
              group && <li key={`h-${r!.section}`} className="tb-lib-group" aria-hidden="true">{r!.section}</li>,
              <li key={h.id} data-lib className={`tb-lib-item ${r ? `is-${kind(r)}` : "is-paper"}${on ? " is-on" : ""}${lifted === h.id ? " is-lifted" : ""}`} onPointerDown={on ? undefined : e => grab(e, h.id)}>
                {!on && <Grip />}
                {r ? <span className={`tb-dot is-${kind(r)}`} aria-hidden="true" /> : <span className="tb-sheet-icon is-small" aria-hidden="true" />}
                <span className="tb-lib-name">
                  {r ? <>{topicRef(r.t) && <span className="qb-code">{topicRef(r.t)} </span>}{short(r.t)}</> : <>{s!.name} · {s!.session}</>}
                  <small>
                    {r && hot.has(r.t.code) && <span className="tb-hot">Comes up a lot</span>}
                    {r ? (r.share !== null ? `${Math.round(r.share * 100)}% of marks` : r.st.attempts ? "tried" : `${r.t.count} questions`) : s!.title}
                  </small>
                </span>
                {on ? <span className="tb-lib-where">{COL_NAME[on]}</span>
                  : <button type="button" className="tb-lib-add" aria-label={`Add ${r ? short(r.t) : `${s!.name}, ${s!.session}`} to ${COL_NAME[target]}`} onClick={() => onAdd(h.id)}>+</button>}
              </li>,
            ];
          })}
        </ul>
      ) : <p className="tb-lib-none">{terms.length ? `Nothing matches “${q.trim()}”.` : "It’s all on your board."}</p>}
      {mode !== "pop" && mode !== "sheet" && <p className="tb-lib-tip">Drag one onto the board, or tap +. Drag a card back here to take it off.</p>}
    </section>
  );
});
