"use client";

import { useEffect, useRef, useState } from "react";
import type { LibraryHandle } from "@/components/landing/cafeScene";
import { toast } from "@/components/studyapp/toast";
import { leaveLibrary } from "@/lib/library";
import { totalHere } from "@/lib/social/lobby";
import { publishLive } from "@/lib/studyapp/live";
import { markRoom } from "@/lib/studyapp/library/roomOpen";
import { LibrarySession } from "@/lib/studyapp/library/session";
import type { LibraryDriver } from "./driver";
import { Chat, SeatCard, Servers, WhoHere } from "./parts";
import { RoomCanvas } from "./RoomCanvas";
import { useSnapshot } from "./useVisit";

/**
 * The Grand Library, live: the room with real students in it, and beside it your seat, who is here, the libraries
 * and the chat. One visit (`LibrarySession`) holds the state; the room and the panel read it. Closing the page
 * leaves the library, so nobody is left standing in an empty room.
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

  const scene = driver.scene;
  useEffect(() => {
    markRoom(true);
    void session.start();
    const stopScene = scene?.();
    return () => { stopScene?.(); session.leave(); markRoom(false); };
  }, [session, scene]);

  const pick = (id: string | null) => { setPicked(id); handle.current?.select(id); };
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

  return (
    <main className="wrap lb" data-testid="library">
      <header className="ph">
        <div>
          <div className="crumb">Study</div>
          <h1>The Grand Library{snap.shard !== null && <em>Library {snap.shard}</em>}</h1>
        </div>
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
            <RoomCanvas session={session} handleRef={handle} onPick={pick} label="The Grand Library. Tap the floor to walk and a free seat to sit. With this focused, arrow keys walk and Enter sits." />
            {snap.phase === "live" && (
              <span className="lb-live"><i className="dot" aria-hidden="true" />{here} here{revising !== null && revising > here ? ` \u00b7 ${revising} in all` : ""}</span>
            )}
            {snap.phase === "unavailable" && <span className="lb-live is-quiet">One moment</span>}
            {snap.phase === "live" && !snap.live && <span className="lb-sync" title="Steps may take a few seconds to show">Catching up</span>}
          </section>
          {/* The panel comes straight after the room in reading and tab order, and is placed beside it by the grid */}
          <div className="lb-side">
            <div className="lb-slot lb-s-seat"><SeatCard session={session} snap={snap} handleRef={handle} /></div>
            <div className="lb-slot lb-s-who"><WhoHere session={session} snap={snap} picked={picked} onPick={pick} onPullUp={pullUp} /></div>
            <div className="lb-slot lb-s-servers"><Servers session={session} snap={snap} /></div>
            <footer className="lb-foot lb-slot lb-s-foot">
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
          </div>
          <div className="lb-slot lb-s-chat"><Chat session={session} snap={snap} me={driver.me} /></div>
        </div>
      )}
    </main>
  );
}
