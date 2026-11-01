"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { LibraryHandle } from "@/components/landing/cafeScene";
import { toast } from "@/components/studyapp/toast";
import { EMOTE_TITLE } from "@/lib/social/lobby";
import { floorFromArt, seatTable } from "@/lib/studyapp/library/room";
import type { LibrarySession } from "@/lib/studyapp/library/session";

/**
 * The Grand Library's floor: the homepage's room engine (src/components/landing/cafeScene.ts) in its library mode,
 * with its people and your own steps going through the visit (`LibrarySession`). The engine draws and walks; the
 * visit decides who is here and says where you are. Loaded after first paint, like the homepage's, so the page's
 * words are there before the art is.
 *
 * Tap the floor to walk, a free seat to sit; the arrow keys walk and Enter sits, with the room focused. Under
 * reduced motion everyone is placed where they are and nothing animates.
 */

const LOOK_KEY = "plumi-cafe-look";
function savedLook(): number | undefined {
  try { const v = window.localStorage.getItem(LOOK_KEY); return v === null ? undefined : Number(v); } catch { return undefined; }
}

export function RoomCanvas({ session, handleRef, onPick, label }: {
  session: LibrarySession;
  handleRef: RefObject<LibraryHandle | null>;
  onPick: (id: string | null) => void;
  label: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const pick = useRef(onPick);
  const [ready, setReady] = useState(false);
  useEffect(() => { pick.current = onPick; });

  useEffect(() => {
    const cv = canvas.current, ov = overlay.current;
    if (!cv || !ov) return;
    let dead = false;
    let mounted: LibraryHandle | null = null;
    const offs: (() => void)[] = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("@/components/landing/cafeScene")
      .then((m) => m.mountLibrary(cv, ov, {
        reduced,
        look: savedLook(),
        cls: { nm: "lb-nm", timer: "lb-nm", you: "lb-nm is-you", pop: "lb-pop", tick: "is-tick", ink: "is-ink", who: "lb-who" },
        live: {
          seats: seatTable,
          onYou: () => session.roomChanged(),
          onPick: (id) => pick.current(id),
          describe: session.describe,
        },
      }))
      .then((h) => {
        if (dead) { h.destroy(); return; }
        mounted = h;
        handleRef.current = h;
        session.attachRoom(() => { const y = h.youNow(); return y ? floorFromArt(y) : null; });
        offs.push(session.onFloor(() => h.setRemotes(session.remotes())));
        offs.push(session.onEvent((e) => {
          if (e.type === "emote") h.say(e.id, EMOTE_TITLE[e.kind]);
          else toast(e.text);
        }));
        h.setRemotes(session.remotes());
        setReady(true);
      })
      .catch(() => { /* the art did not load: the panel still works, and the room stays a dark pane */ });
    return () => {
      dead = true;
      offs.forEach((f) => f());
      session.attachRoom(() => null);
      handleRef.current = null;
      mounted?.destroy();
    };
  }, [session, handleRef]);

  return (
    <div className="lb-room" data-ready={ready || undefined}>
      <canvas ref={canvas} role="application" aria-label={label} tabIndex={0} width={800} height={500} />
      <div ref={overlay} className="lb-ov" aria-hidden="true" />
      {!ready && <p className="lb-hello">Hopping into the library</p>}
    </div>
  );
}
