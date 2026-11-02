"use client";

import { useEffect, useRef, useState } from "react";
import type { LibraryHandle } from "@/components/landing/cafeScene";
import { toast } from "@/components/studyapp/toast";
import { leaveLibrary, rememberAvatar, useLibrary } from "@/lib/library";
import { totalHere } from "@/lib/social/lobby";
import type { SocialAvatar } from "@/lib/social/types";
import { publishLive } from "@/lib/studyapp/live";
import { enterBrowserFullscreen, enterBrowserFullscreenIfJustTapped, exitBrowserFullscreen } from "@/lib/studyapp/library/fullscreen";
import { bindPage } from "@/lib/studyapp/library/pageLifecycle";
import { markFull, markRoom } from "@/lib/studyapp/library/roomOpen";
import { LibrarySession } from "@/lib/studyapp/library/session";
import { libraryFocus } from "@/lib/studyapp/timer";
import { timer } from "@/lib/studyapp/timerStore";
import type { LibraryDriver } from "./driver";
import { Elsewhere } from "./Elsewhere";
import { Hud, HiddenVeil, LeaveDialog, QuietNote, wrapTab, type HudMenuActions, type HudTab } from "./Hud";
import { Chat, SeatCard, Servers } from "./parts";
import { WhoHere } from "./People";
import { RoomCanvas } from "./RoomCanvas";
import { Wardrobe } from "./Wardrobe";
import { useSnapshot } from "./useVisit";

type Tab = HudTab;
const TABS = ["chat", "people", "outfit", "libraries"] as const;
const TAB_TITLE: Record<Tab, string> = { chat: "Chat", people: "People", libraries: "Libraries", outfit: "Outfit" };

/**
 * The Grand Library, live: the room with real students in it, your seat, who is here, the libraries and the chat.
 * One visit (`LibrarySession`) holds the state; the room and the panels read it. Closing the page leaves the
 * library, so nobody is left standing in an empty room.
 *
 * Two layouts of the same visit. Pressing Study opens it FULL SCREEN (founder, 1 November 2026, after lofi.town):
 * the room fills the window, a few buttons float over it, and the chat, people and libraries live in a drawer that
 * slides in from the side. "Exit full screen" (or Escape) gives the notebook page back, room and panels side by
 * side, with the room's own "Full screen" button to go back in. The browser's own full screen is asked for too
 * when it is allowed (right after a tap, not on iPhone), and let go of on leaving.
 *
 * KEYBOARD AND FOCUS (full screen). Opening the panel moves focus into it (onto its current tab) and closing it
 * puts focus back on what opened it; Tab stays inside the panel while it is open (Escape is the way out). Escape
 * closes ONE thing, innermost first: the Leave question, the More menu, the timer's card, the panel; only with
 * none of those open does it give the notebook page back. It never leaves the library or hides you.
 */
export function LibraryRoom({ driver, onLeave = leaveLibrary }: { driver: LibraryDriver; onLeave?: () => Promise<boolean> }) {
  const [session] = useState(() => new LibrarySession({
    social: driver.social, realtime: driver.realtime, me: driver.me, publish: publishLive,
    farewell: driver.farewell, current: driver.current, lease: driver.lease,
    every: (fn, ms) => { const t = setInterval(fn, ms); return () => clearInterval(t); },
  }));
  const snap = useSnapshot(session);
  const handle = useRef<LibraryHandle | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(true);
  const [drawer, setDrawer] = useState<Tab | null>(null);
  const [seen, setSeen] = useState(0);
  const [awake, setAwake] = useState(false);                 // the room has drawn its first frame: until then the controls are a skeleton
  const drawerEl = useRef<HTMLElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);           // what had focus when the panel opened: focus goes back there
  const [outfitOpen, setOutfitOpen] = useState(false);       // the notebook layout's wardrobe card

  // Who you are drawn as: the avatar you dressed (the profile's, or what you just saved), else the person your id makes.
  const lib = useLibrary();
  const [saved, setSaved] = useState<SocialAvatar | null | undefined>(undefined);
  const avatar = saved !== undefined ? saved : driver.mine ? driver.mine.avatar : lib.profile?.avatar ?? null;
  const colour = driver.mine?.colour ?? lib.profile?.colour ?? 0;
  const you = { avatar, colour };
  const dressed = (a: Record<string, string>) => { setSaved(a); rememberAvatar(a); };

  const scene = driver.scene;
  useEffect(() => {
    markRoom(true);
    void session.start();
    const stopScene = scene?.();
    const unbind = bindPage(session);              // closing the tab leaves the library; a hidden tab keeps its place; coming back reads at once
    return () => { unbind(); stopScene?.(); session.leave(); markRoom(false); };
  }, [session, scene]);

  // The study timer drives what the others see (one way: the timer tells the visit). Work running while you are seated is
  // "focusing since the work began"; paused, a break, waiting or stopped is not. Standing up keeps the timer and stops publishing it.
  useEffect(() => {
    const follow = () => session.followTimer(libraryFocus(timer.snapshot().doc.session, Date.now()));
    follow();
    return timer.subscribe(follow);
  }, [session]);

  // Full screen: the page's own layout, plus the browser's when it lets us. Leaving the page lets go of both.
  useEffect(() => {
    enterBrowserFullscreenIfJustTapped();
    return () => exitBrowserFullscreen();
  }, []);
  const messages = snap.messages.length;
  const unread = drawer === "chat" ? 0 : Math.max(0, messages - seen);
  const open = (tab: Tab | null) => {
    if (drawer === "chat" && tab !== "chat") setSeen(messages);   // what was on screen while chat was open is read
    if (tab === "chat") setSeen(messages);
    if (tab !== null && drawer === null) {                        // opening: remember what to give focus back to
      const at = document.activeElement;
      opener.current = at instanceof HTMLElement && at !== document.body ? at : null;
    }
    setDrawer(tab);
  };
  const goFull = () => { setFull(true); setLeaving(false); enterBrowserFullscreen(); };
  const exitFull = () => { setFull(false); setLeaving(false); setDrawer(null); exitBrowserFullscreen(); };

  // Focus follows the panel: into it (its current tab) when it opens, back to what opened it when it closes.
  const wasOpen = useRef(false);
  useEffect(() => {
    const panel = drawerEl.current;
    if (drawer && !wasOpen.current) panel?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
    if (!drawer && wasOpen.current) {
      const back = opener.current;
      opener.current = null;
      const inside = !document.activeElement || document.activeElement === document.body || panel?.contains(document.activeElement);
      if (inside) {
        if (back && back.isConnected && back.getClientRects().length > 0) back.focus({ preventScroll: true });
        else document.querySelector<HTMLElement>('[data-testid="open-menu"]')?.focus({ preventScroll: true });
      }
    }
    wasOpen.current = drawer !== null;
  }, [drawer]);

  // Escape closes one thing at a time (see the note above); the Leave question and the More menu answer it themselves first.
  const latest = useRef({ drawer, leaving, open, exitFull });
  useEffect(() => { latest.current = { drawer, leaving, open, exitFull }; });
  useEffect(() => {
    if (!full) return;
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const { drawer: d, leaving: l, open: o, exitFull: x } = latest.current;
      if (l) return;
      if (d) o(null); else x();
    };
    window.addEventListener("keydown", esc);
    return () => { root.style.overflow = was; window.removeEventListener("keydown", esc); };
  }, [full]);

  // While the room covers the top bar, the top bar's timer chip steps aside (this toolbar carries one), so there is only ever one.
  const covering = full && snap.phase !== "elsewhere" && snap.phase !== "away";
  useEffect(() => {
    if (!covering) return;
    markFull(true);
    return () => markFull(false);
  }, [covering]);

  // What is on screen decides what is read: the chat every few seconds only while it is shown, the libraries' counts only while the picker is
  useEffect(() => { session.setPanels({ chat: !full || drawer === "chat", libraries: !full || drawer === "libraries" }); }, [session, full, drawer]);

  // Left and right walk the panel's tabs (and put focus on the new one), Home and End go to the ends.
  const tabKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tabs = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')];
    const at = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const to = e.key === "ArrowRight" ? at + 1 : e.key === "ArrowLeft" ? at - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (to === null || tabs.length === 0) return;
    e.preventDefault();
    const next = tabs[(to + tabs.length) % tabs.length];
    next.focus();
    next.click();
  };

  const pick = (id: string | null) => {
    setPicked(id); handle.current?.select(id);
    handle.current?.lookAt(id);                          // the view goes to them (and comes back to you when you move, or when they are put down)
    if (id !== null && full) open("people");             // clicking someone in the room opens their card
  };
  const look = (id: string) => { handle.current?.lookAt(id); };
  const pullUp = (id: string) => { if (!handle.current?.goTo(id)) toast("No free seat near them"); };
  const here = snap.people.length + 1;
  const revising = snap.servers ? totalHere(snap.servers) : null;

  async function leave() {
    setBusy(true);
    session.leave();                         // out of the room first, so nothing is asked of a library you are leaving
    const ok = await onLeave();
    setBusy(false);
    if (!ok) { toast("That didn’t go through. Try again in a moment"); setLeaving(false); void session.start(); }
  }

  const leaveBlock = (
    <footer className="lb-foot">
      <label className="lb-switch">
        <input type="checkbox" checked onChange={() => void session.setVisible(false)} />
        <span>Show me to other students</span>
      </label>
      {leaving ? (
        <div className="lb-ask">
          <p>Leaving also removes you from your Plumi friends and groups, on iPad too.</p>
          <button type="button" className="btn gold" disabled={busy} onClick={() => void leave()}>Leave the library</button>
          <button type="button" className="btn ghost" onClick={() => setLeaving(false)}>Stay</button>
        </div>
      ) : (
        <button type="button" className="btn ghost lb-leave" onClick={() => setLeaving(true)}>Leave the library</button>
      )}
    </footer>
  );
  const stay = () => {
    setLeaving(false);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="open-menu"]')?.focus({ preventScroll: true }));
  };
  const menuActions: HudMenuActions = {
    outfit: () => open("outfit"),
    libraries: () => open("libraries"),
    toggleHidden: () => {
      if (snap.phase === "hidden") { void session.setVisible(true); return; }
      if (drawer && drawer !== "outfit") open(null);      // chat, people and libraries are not there while you are hidden
      void session.setVisible(false);
    },
    exitFull,
    leave: () => setLeaving(true),
  };

  if (snap.phase === "elsewhere") return <Elsewhere kind="elsewhere" onAction={() => void session.takeOver()} />;
  if (snap.phase === "away") return <Elsewhere kind="away" onAction={() => void session.comeBack()} />;

  if (full) {
    const hidden = snap.phase === "hidden";
    return (
      <main className="wrap lb lb-full" data-testid="library" data-full="1" data-drawer={drawer ?? undefined} data-hidden={hidden || undefined} data-awake={awake || undefined}>
        <div className="lb-fstage" inert={hidden ? true : undefined}>
          <RoomCanvas session={session} handleRef={handle} onPick={pick} onReady={() => setAwake(true)} label="The Grand Library. Tap the floor to walk and a free seat to sit. W A S D or the arrow keys walk, E sits down, Enter or Space also sit." you={you} />
        </div>
        <Hud awake={awake} hidden={hidden} here={here} revising={revising} shard={snap.shard} live={snap.live && snap.online} unavailable={snap.phase === "unavailable"} online={snap.phase === "live"}
          drawer={drawer} unread={unread} onTab={(t) => open(drawer === t ? null : t)} actions={menuActions} />
        {awake && snap.phase === "live" && snap.people.length === 0 && <QuietNote />}
        {hidden ? <HiddenVeil onShow={() => void session.setVisible(true)} /> : (
          <div className="lb-dock" inert={!awake ? true : undefined} data-awake={awake || undefined}><SeatCard session={session} snap={snap} handleRef={handle} dock /></div>
        )}
        <aside className={`lb-drawer${drawer ? " is-open" : ""}`} data-tab={drawer ?? undefined} aria-label="Library panel" aria-hidden={drawer ? undefined : true} inert={drawer ? undefined : true} data-testid="drawer" ref={drawerEl} onKeyDown={wrapTab}>
          <div className="lb-tabs">
            <div className="lb-tablist" role="tablist" aria-label="Library panel" onKeyDown={tabKeys}>
              {TABS.map((t) => (
                <button key={t} type="button" role="tab" id={`lb-tab-${t}`} aria-selected={drawer === t} aria-controls="lb-tabpanel" tabIndex={drawer === t || (drawer === null && t === "chat") ? 0 : -1}
                  className={drawer === t ? "on" : undefined} disabled={hidden && t !== "outfit"} onClick={() => open(t)}>{TAB_TITLE[t]}</button>
              ))}
            </div>
            <button type="button" className="lb-x" aria-label="Close panel" data-testid="close-panel" onClick={() => open(null)}>
              <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" /></svg>
            </button>
          </div>
          <div className="lb-dbody" id="lb-tabpanel" role="tabpanel" aria-labelledby={drawer ? `lb-tab-${drawer}` : undefined}>
            {drawer === "chat" && <Chat session={session} snap={snap} me={driver.me} />}
            {drawer === "people" && <WhoHere session={session} snap={snap} you={you} picked={picked} onPick={pick} onPullUp={pullUp} onLook={look} />}
            {drawer === "outfit" && <Wardrobe social={driver.social} avatar={avatar} colour={colour} me={driver.me} onSaved={dressed} />}
            {drawer === "libraries" && <Servers session={session} snap={snap} />}
          </div>
        </aside>
        {leaving && <LeaveDialog busy={busy} onLeave={() => void leave()} onStay={stay} />}
      </main>
    );
  }

  return (
    <main className="wrap lb" data-testid="library">
      <header className="ph">
        <div>
          <div className="crumb">Study</div>
          <h1>The Grand Library{snap.shard !== null && <em>Library {snap.shard}</em>}</h1>
        </div>
        {snap.phase !== "hidden" && (
          <div className="lb-hbtns">
            <button type="button" className="btn" data-testid="open-outfit" aria-pressed={outfitOpen} onClick={() => setOutfitOpen((v) => !v)}>Outfit</button>
            <button type="button" className="btn" data-testid="enter-full" onClick={goFull}>{"\u2922"} Full screen</button>
          </div>
        )}
      </header>

      {snap.phase === "hidden" ? (
        <section className="card lb-card lb-hidden">
          <h2>You’re hidden</h2>
          <p>Nobody sees you, and you see nobody.</p>
          <button type="button" className="btn gold" onClick={() => void session.setVisible(true)}>Show me</button>
        </section>
      ) : (
        <div className="lb-grid">
          <section className="card lb-stage" aria-label="The library floor">
            <RoomCanvas session={session} handleRef={handle} onPick={pick} label="The Grand Library. Tap the floor to walk and a free seat to sit. W A S D or the arrow keys walk, E sits down, Enter or Space also sit." you={you} />
            {snap.phase === "live" && (
              <span className="lb-live"><i className="dot" aria-hidden="true" />{here} here{revising !== null && revising > here ? ` \u00b7 ${revising} in all` : ""}</span>
            )}
            {snap.phase === "unavailable" && <span className="lb-live is-quiet">One moment</span>}
            {snap.phase === "live" && (!snap.live || !snap.online) && <span className="lb-sync" title="Steps may take a few seconds to show">Catching up</span>}
          </section>
          {/* The panel comes straight after the room in reading and tab order, and is placed beside it by the grid */}
          <div className="lb-side">
            {outfitOpen && <div className="lb-slot lb-s-outfit"><Wardrobe social={driver.social} avatar={avatar} colour={colour} me={driver.me} onSaved={dressed} /></div>}
            <div className="lb-slot lb-s-seat"><SeatCard session={session} snap={snap} handleRef={handle} /></div>
            <div className="lb-slot lb-s-who"><WhoHere session={session} snap={snap} you={you} picked={picked} onPick={pick} onPullUp={pullUp} /></div>
            <div className="lb-slot lb-s-servers"><Servers session={session} snap={snap} /></div>
            <div className="lb-slot lb-s-foot">{leaveBlock}</div>
          </div>
          <div className="lb-slot lb-s-chat"><Chat session={session} snap={snap} me={driver.me} /></div>
        </div>
      )}
    </main>
  );
}
