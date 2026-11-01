"use client";

import { useEffect, useRef, useState } from "react";
import { AppLink } from "@/components/studyapp/AppLink";
import type { LibraryHandle } from "@/components/landing/cafeScene";
import { toast } from "@/components/studyapp/toast";
import { leaveLibrary, rememberAvatar, useLibrary } from "@/lib/library";
import { totalHere } from "@/lib/social/lobby";
import type { SocialAvatar } from "@/lib/social/types";
import { publishLive } from "@/lib/studyapp/live";
import { enterBrowserFullscreen, enterBrowserFullscreenIfJustTapped, exitBrowserFullscreen } from "@/lib/studyapp/library/fullscreen";
import { markRoom } from "@/lib/studyapp/library/roomOpen";
import { LibrarySession } from "@/lib/studyapp/library/session";
import type { LibraryDriver } from "./driver";
import { Chat, SeatCard, Servers, WhoHere } from "./parts";
import { RoomCanvas } from "./RoomCanvas";
import { Wardrobe } from "./Wardrobe";
import { useSnapshot } from "./useVisit";

type Tab = "chat" | "people" | "libraries" | "outfit";
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
 */
export function LibraryRoom({ driver, onLeave = leaveLibrary }: { driver: LibraryDriver; onLeave?: () => Promise<boolean> }) {
  const [session] = useState(() => new LibrarySession({
    social: driver.social, realtime: driver.realtime, me: driver.me, publish: publishLive,
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
    return () => { stopScene?.(); session.leave(); markRoom(false); };
  }, [session, scene]);

  // Full screen: the page's own layout, plus the browser's when it lets us. Leaving the page lets go of both.
  useEffect(() => {
    enterBrowserFullscreenIfJustTapped();
    return () => exitBrowserFullscreen();
  }, []);
  useEffect(() => {
    if (!full) return;
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (drawer) setDrawer(null); else setFull(false);
    };
    window.addEventListener("keydown", esc);
    return () => { root.style.overflow = was; window.removeEventListener("keydown", esc); };
  }, [full, drawer]);

  const messages = snap.messages.length;
  const unread = drawer === "chat" ? 0 : Math.max(0, messages - seen);
  const open = (tab: Tab | null) => {
    if (drawer === "chat" && tab !== "chat") setSeen(messages);   // what was on screen while chat was open is read
    if (tab === "chat") setSeen(messages);
    setDrawer(tab);
  };
  const goFull = () => { setFull(true); enterBrowserFullscreen(); };
  const exitFull = () => { setFull(false); setDrawer(null); exitBrowserFullscreen(); };

  const pick = (id: string | null) => {
    setPicked(id); handle.current?.select(id);
    if (id !== null && full) open("people");             // clicking someone in the room opens their card
  };
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
  const status = snap.phase === "live"
    ? <><i className="dot" aria-hidden="true" />{here} here{revising !== null && revising > here ? ` \u00b7 ${revising} in all` : ""}</>
    : snap.phase === "unavailable" ? "One moment" : null;

  if (full && snap.phase !== "hidden") {
    return (
      <main className="wrap lb lb-full" data-testid="library" data-full="1" data-drawer={drawer ?? undefined}>
        <div className="lb-fstage">
          <RoomCanvas session={session} handleRef={handle} onPick={pick} label="The Grand Library. Tap the floor to walk and a free seat to sit. With this focused, arrow keys walk and Enter sits." you={you} />
        </div>
        <div className="lb-hud lb-hud-l">
          <AppLink className="btn lb-hbtn" href="/study" aria-label="Back to your desk">{"\u2190"} Desk</AppLink>
          {status && <span className="lb-hpill">{status}{snap.shard !== null && <small>Library {snap.shard}</small>}</span>}
          {snap.phase === "live" && !snap.live && <span className="lb-hpill is-quiet" title="Steps may take a few seconds to show">Catching up</span>}
        </div>
        <div className="lb-hud lb-hud-r" role="toolbar" aria-label="Library">
          <button type="button" className={`btn lb-hbtn${drawer === "chat" ? " is-on" : ""}`} aria-pressed={drawer === "chat"} data-testid="open-chat" onClick={() => open(drawer === "chat" ? null : "chat")}>
            Chat{unread > 0 && <b className="lb-unread" aria-label={`${unread} new`}>{unread > 9 ? "9+" : unread}</b>}
          </button>
          <button type="button" className={`btn lb-hbtn${drawer === "people" ? " is-on" : ""}`} aria-pressed={drawer === "people"} data-testid="open-people" onClick={() => open(drawer === "people" ? null : "people")}>
            People<span className="lb-hcount">{here}</span>
          </button>
          <button type="button" className={`btn lb-hbtn${drawer === "outfit" ? " is-on" : ""}`} aria-pressed={drawer === "outfit"} data-testid="open-outfit" onClick={() => open(drawer === "outfit" ? null : "outfit")}>Outfit</button>
          <button type="button" className={`btn lb-hbtn${drawer === "libraries" ? " is-on" : ""}`} aria-pressed={drawer === "libraries"} data-testid="open-libraries" onClick={() => open(drawer === "libraries" ? null : "libraries")}>Libraries</button>
          <button type="button" className="btn lb-hbtn" data-testid="exit-full" onClick={exitFull}>{"\u2922"} Exit full screen</button>
        </div>
        <div className="lb-dock"><SeatCard session={session} snap={snap} handleRef={handle} /></div>
        <aside className={`lb-drawer${drawer ? " is-open" : ""}`} data-tab={drawer ?? undefined} aria-label="Library panel" aria-hidden={drawer ? undefined : true} inert={drawer ? undefined : true} data-testid="drawer">
          <div className="lb-tabs" role="tablist">
            {(["chat", "people", "outfit", "libraries"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={drawer === t} className={drawer === t ? "on" : undefined} onClick={() => open(t)}>{TAB_TITLE[t]}</button>
            ))}
            <button type="button" className="lb-x" aria-label="Close panel" data-testid="close-panel" onClick={() => open(null)}>
              <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" /></svg>
            </button>
          </div>
          <div className="lb-dbody">
            {drawer === "chat" && <Chat session={session} snap={snap} me={driver.me} />}
            {drawer === "people" && <WhoHere session={session} snap={snap} picked={picked} onPick={pick} onPullUp={pullUp} />}
            {drawer === "outfit" && <Wardrobe social={driver.social} avatar={avatar} colour={colour} me={driver.me} onSaved={dressed} />}
            {drawer === "libraries" && <><Servers session={session} snap={snap} />{leaveBlock}</>}
          </div>
        </aside>
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
            <RoomCanvas session={session} handleRef={handle} onPick={pick} label="The Grand Library. Tap the floor to walk and a free seat to sit. With this focused, arrow keys walk and Enter sits." you={you} />
            {snap.phase === "live" && (
              <span className="lb-live"><i className="dot" aria-hidden="true" />{here} here{revising !== null && revising > here ? ` \u00b7 ${revising} in all` : ""}</span>
            )}
            {snap.phase === "unavailable" && <span className="lb-live is-quiet">One moment</span>}
            {snap.phase === "live" && !snap.live && <span className="lb-sync" title="Steps may take a few seconds to show">Catching up</span>}
          </section>
          {/* The panel comes straight after the room in reading and tab order, and is placed beside it by the grid */}
          <div className="lb-side">
            {outfitOpen && <div className="lb-slot lb-s-outfit"><Wardrobe social={driver.social} avatar={avatar} colour={colour} me={driver.me} onSaved={dressed} /></div>}
            <div className="lb-slot lb-s-seat"><SeatCard session={session} snap={snap} handleRef={handle} /></div>
            <div className="lb-slot lb-s-who"><WhoHere session={session} snap={snap} picked={picked} onPick={pick} onPullUp={pullUp} /></div>
            <div className="lb-slot lb-s-servers"><Servers session={session} snap={snap} /></div>
            <div className="lb-slot lb-s-foot">{leaveBlock}</div>
          </div>
          <div className="lb-slot lb-s-chat"><Chat session={session} snap={snap} me={driver.me} /></div>
        </div>
      )}
    </main>
  );
}
