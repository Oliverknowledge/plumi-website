"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AppLink } from "@/components/studyapp/AppLink";
import { TimerChip } from "@/components/studyapp/timer/TimerChip";

/**
 * The full-screen library's controls: ONE bar along the top of the room, in two clusters that can never overlap
 * (the left one gives way first, in words: see library.css "the bar"), a menu for everything that is not used every
 * minute (Outfit, Libraries, Hide me, Exit full screen, Leave), and the two dialogs the page needs.
 *
 * Until the room has drawn its first frame the bar is asleep: the same shapes, drawn as a skeleton and `inert`, so
 * nothing can be pressed that has nothing to act on and nothing moves when it wakes.
 *
 * Keys. Escape closes one thing at a time, innermost first: the Leave question, then this menu, then the timer's
 * card (its own handler), then the panel; with none of those open it gives the notebook page back (the room's
 * "Exit full screen"). It never leaves the library, hides you or changes anything else.
 */

export type HudTab = "chat" | "people" | "outfit" | "libraries";

const I = ({ children }: { children: ReactNode }) => (
  <svg className="lb-ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
export const Icons = {
  back: <I><path d="M12 4l-6 6 6 6M6 10h10" /></I>,
  chat: <I><path d="M3.500 5.500a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3h-.500a2 2 0 0 1-1-1.700z" /></I>,
  people: <I><circle cx="7.500" cy="7" r="2.800" /><path d="M2.500 16.500c.400-3 2.500-4.500 5-4.500s4.600 1.500 5 4.500M13 4.600a2.800 2.800 0 0 1 0 5.200M14.500 12.300c1.800.500 2.800 1.900 3 4.200" /></I>,
  more: <I><circle cx="4.500" cy="10" r="1.200" fill="currentColor" /><circle cx="10" cy="10" r="1.200" fill="currentColor" /><circle cx="15.500" cy="10" r="1.200" fill="currentColor" /></I>,
  outfit: <I><path d="M7 3.500L3 6l1.800 3L7 8v8.500h6V8l2.200 1L17 6l-4-2.500c-.400 1.200-1.500 1.800-3 1.800S7.400 4.700 7 3.500z" /></I>,
  books: <I><path d="M4 3.500h3v13H4zM8.500 3.500h3v13h-3zM13.200 4.800l2.800-.800 3 12-2.800.800z" /></I>,
  eyeOff: <I><path d="M2.500 10S5.300 5 10 5s7.500 5 7.500 5-2.800 5-7.500 5S2.500 10 2.500 10zM3.500 3.500l13 13" /><circle cx="10" cy="10" r="2" /></I>,
  eye: <I><path d="M2.500 10S5.300 5 10 5s7.500 5 7.500 5-2.800 5-7.500 5S2.500 10 2.500 10z" /><circle cx="10" cy="10" r="2.200" /></I>,
  exit: <I><path d="M8 3.500H4.500v4M12 3.500h3.500v4M8 16.500H4.500v-4M12 16.500h3.500v-4" /></I>,
  door: <I><path d="M8 3.500H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h3M12.500 6.500L16 10l-3.500 3.500M16 10H8" /></I>,
};

/** The things the menu can do; the page decides what each means. */
export interface HudMenuActions {
  outfit: () => void; libraries: () => void; toggleHidden: () => void; exitFull: () => void; leave: () => void;
}

/** What Tab does inside a small dialog or panel: it stays there (the last item wraps to the first, and back). */
export function wrapTab(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== "Tab") return;
  const box = e.currentTarget;
  const items = [...box.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0);
  if (items.length === 0) return;
  const first = items[0], last = items[items.length - 1], at = document.activeElement;
  if (e.shiftKey && (at === first || !box.contains(at))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (at === last || !box.contains(at))) { e.preventDefault(); first.focus(); }
}

export function HudMenu({ hidden, actions, canLibraries }: { hidden: boolean; actions: HudMenuActions; canLibraries: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const walk = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => { e.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
    if (e.key === "ArrowDown") go(at + 1); else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home") go(0); else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Tab") setOpen(false);
  };
  const choose = (fn: () => void) => () => { setOpen(false); fn(); };

  return (
    <div className="lb-menu" ref={box}>
      <button ref={trigger} type="button" className={`btn lb-hbtn lb-hicon${open ? " is-on" : ""}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label="More" data-testid="open-menu" onClick={() => setOpen((o) => !o)}>
        {Icons.more}<span className="lb-hlab">More</span>
      </button>
      {open && (
        <div className="lb-mpop" id={id} role="menu" aria-label="More" ref={list} onKeyDown={walk}>
          <button type="button" role="menuitem" data-testid="open-outfit" disabled={false} onClick={choose(actions.outfit)}>{Icons.outfit}Outfit</button>
          <button type="button" role="menuitem" data-testid="open-libraries" disabled={!canLibraries} onClick={choose(actions.libraries)}>{Icons.books}Libraries</button>
          <button type="button" role="menuitem" data-testid="toggle-hidden" onClick={choose(actions.toggleHidden)}>{hidden ? Icons.eye : Icons.eyeOff}{hidden ? "Show me" : "Hide me"}</button>
          <button type="button" role="menuitem" data-testid="exit-full" onClick={choose(actions.exitFull)}>{Icons.exit}Exit full screen</button>
          <hr />
          <button type="button" role="menuitem" className="is-leave" data-testid="leave-library" onClick={choose(actions.leave)}>{Icons.door}Leave the library</button>
        </div>
      )}
    </div>
  );
}

export interface HudProps {
  /** The room has drawn its first frame. */
  awake: boolean;
  hidden: boolean;
  /** "7 here", "10 in all", "Library 1", and whether steps reach others live. */
  here: number; revising: number | null; shard: number | null; live: boolean; unavailable: boolean; online: boolean;
  drawer: HudTab | null; unread: number;
  onTab: (t: HudTab) => void;
  actions: HudMenuActions;
}

export function Hud({ awake, hidden, here, revising, shard, live, unavailable, online, drawer, unread, onTab, actions }: HudProps) {
  const all = revising !== null && revising > here ? revising : null;
  const pill = hidden ? (
    <span className="lb-hpill is-quiet" data-testid="hud-pill"><span className="lb-hico">{Icons.eyeOff}</span><span className="lb-pl-main">Hidden</span></span>
  ) : unavailable ? (
    <span className="lb-hpill is-quiet" data-testid="hud-pill"><i className="dot is-wait" aria-hidden="true" /><span className="lb-pl-main">One moment</span></span>
  ) : !online ? (
    <span className="lb-hpill is-quiet" data-testid="hud-pill"><i className="dot" aria-hidden="true" /><span className="lb-pl-main">Joining</span></span>
  ) : online ? (
    <span className={`lb-hpill${live ? "" : " is-sync"}`} data-testid="hud-pill">
      <i className="dot" aria-hidden="true" />
      <span className="lb-pl-main"><b>{here}</b><span className="lb-pl-w"> here</span></span>
      {all !== null && <span className="lb-pl-all"> {"·"} {all} in all</span>}
      {shard !== null && <small className="lb-pl-lib">Library {shard}</small>}
      {!live && <small className="lb-pl-sync">Catching up</small>}
    </span>
  ) : null;

  return (
    <div className="lb-top" data-awake={awake || undefined} data-testid="hud" inert={!awake ? true : undefined} aria-busy={!awake || undefined}>
      <div className="lb-bl">
        <AppLink className="btn lb-hbtn lb-hicon lb-hback" href="/study" aria-label="Back to your desk">{Icons.back}<span className="lb-hlab">Desk</span></AppLink>
        {pill}
      </div>
      <div className="lb-br" role="toolbar" aria-label="Library">
        <TimerChip where="hud" />
        <button type="button" className={`btn lb-hbtn lb-hicon${drawer === "chat" ? " is-on" : ""}`} aria-pressed={drawer === "chat"} aria-label={unread > 0 ? `Chat, ${unread} new` : "Chat"} disabled={hidden} data-testid="open-chat" onClick={() => onTab("chat")}>
          {Icons.chat}<span className="lb-hlab">Chat</span>
          {unread > 0 && <b className="lb-unread" aria-hidden="true">{unread > 9 ? "9+" : unread}</b>}
        </button>
        <button type="button" className={`btn lb-hbtn lb-hicon${drawer === "people" ? " is-on" : ""}`} aria-pressed={drawer === "people"} aria-label={`People, ${here} here`} disabled={hidden} data-testid="open-people" onClick={() => onTab("people")}>
          {Icons.people}<span className="lb-hlab">People</span><span className="lb-hcount">{here}</span>
        </button>
        <HudMenu hidden={hidden} actions={actions} canLibraries={!hidden} />
      </div>
    </div>
  );
}

/** "Leave the library?" Stay is where focus starts: leaving also removes friends and groups, so it is never the easy key. */
export function LeaveDialog({ busy, onLeave, onStay }: { busy: boolean; onLeave: () => void; onStay: () => void }) {
  const stay = useRef<HTMLButtonElement>(null);
  const t = useId(), d = useId();
  useEffect(() => {
    stay.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key !== "Escape" || e.defaultPrevented) return; e.preventDefault(); onStay(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onStay]);
  return (
    <div className="lb-modal" onPointerDown={(e) => { if (e.target === e.currentTarget) onStay(); }}>
      <div className="card lb-ldlg" role="alertdialog" aria-modal="true" aria-labelledby={t} aria-describedby={d} onKeyDown={wrapTab} data-testid="leave-dialog">
        <h2 id={t}>Leave the library?</h2>
        <p id={d}>Leaving also removes you from your Plumi friends and groups, on iPad too.</p>
        <div className="lb-row">
          <button ref={stay} type="button" className="btn gold" onClick={onStay}>Stay</button>
          <button type="button" className="btn" disabled={busy} data-testid="leave-confirm" onClick={onLeave}>Leave the library</button>
        </div>
      </div>
    </div>
  );
}

/** Shown over a dimmed room while you are hidden: what that means, and the one way back. */
export function HiddenVeil({ onShow }: { onShow: () => void }) {
  return (
    <div className="lb-veil" data-testid="hidden-veil">
      <div className="card lb-vcard" role="status">
        <span className="lb-vico" aria-hidden="true">{Icons.eyeOff}</span>
        <h2>You’re hidden</h2>
        <p>Nobody sees you, and you see nobody.</p>
        <button type="button" className="btn gold lb-show" data-testid="show-me" onClick={onShow}>Show me</button>
      </div>
    </div>
  );
}

/** Alone in the library: a drawn mug and book, and one line. Gone as soon as anyone arrives. */
export function QuietNote() {
  return (
    <div className="lb-quiet" data-testid="quiet-note" aria-hidden="true">
      <svg viewBox="0 0 40 28" width="40" height="28" shapeRendering="crispEdges">
        <path d="M3 22h18v-3H3z" fill="#7a4f33" /><path d="M4 12h16v7H4z" fill="#f4e7c9" /><path d="M12 12v7" stroke="#b9854f" strokeWidth="1" />
        <path d="M26 14h9v8h-9z" fill="#d97f6a" /><path d="M35 16h2v4h-2z" fill="#d97f6a" /><path d="M27 14h7v2h-7z" fill="#f7efe0" />
        <path className="lb-steam" d="M29 11c-1-2 1-3 0-5M32 11c-1-2 1-3 0-5" stroke="#fff" strokeWidth="1.200" fill="none" strokeLinecap="round" opacity=".8" />
      </svg>
      <span>Quiet in here. Take any seat.</span>
    </div>
  );
}

