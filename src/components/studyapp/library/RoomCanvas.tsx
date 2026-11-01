"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { LibraryHandle, LiveRemote } from "@/components/landing/cafeScene";
import { toast } from "@/components/studyapp/toast";
import { EMOTE_TITLE } from "@/lib/social/lobby";
import type { SocialAvatar } from "@/lib/social/types";
import { peopleStore } from "@/lib/studyapp/library/people/store";
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
 *
 * EVERYONE IS DRAWN AS THEMSELVES. Each student, you included, is the person they dressed (their avatar, from the
 * iPad's wardrobe) built from the iPad's own layers (src/lib/studyapp/library/people/); someone whose avatar names
 * no person is the person worked out from their id, the same on every iPad. The layers load after the room opens;
 * until a person is built they wear the premade look (`lookFor`), and if the layers never come that is what stays.
 */
export interface YouAre { avatar: SocialAvatar | null; colour: number }

const LOOK_KEY = "plumi-cafe-look";
function savedLook(): number | undefined {
  try { const v = window.localStorage.getItem(LOOK_KEY); return v === null ? undefined : Number(v); } catch { return undefined; }
}

/** How long the room waits for your own person before it opens with the premade one (the layers are 0.6 MB). */
const WAIT_FOR_YOU_MS = 1500;

export function RoomCanvas({ session, handleRef, onPick, label, you }: {
  session: LibrarySession;
  handleRef: RefObject<LibraryHandle | null>;
  onPick: (id: string | null) => void;
  label: string;
  /** Your avatar and colour (the profile's): you are drawn as the person they make. */
  you: YouAre;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const pick = useRef(onPick);
  const [ready, setReady] = useState(false);
  const youNow = useRef(you);
  const redress = useRef<() => void>(() => {});
  useEffect(() => { pick.current = onPick; youNow.current = you; });
  const youKey = JSON.stringify([you.avatar, you.colour]);
  useEffect(() => { redress.current(); }, [youKey]);

  useEffect(() => {
    const cv = canvas.current, ov = overlay.current;
    if (!cv || !ov) return;
    let dead = false;
    let mounted: LibraryHandle | null = null;
    const offs: (() => void)[] = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const store = peopleStore();
    const lookOfYou = () => store.lookOf(youNow.current.avatar, youNow.current.colour, session.meId);
    // You, built before the room opens if that takes a moment or less, so nobody sees you change.
    const mine = (async () => {
      if (!(await store.ready())) return null;
      const look = lookOfYou();
      return look ? store.make(look) : null;
    })();
    const waited = Promise.race([mine, new Promise<null>((done) => setTimeout(() => done(null), WAIT_FOR_YOU_MS))]);
    Promise.all([import("@/components/landing/cafeScene"), waited])
      .then(([m, you]) => m.mountLibrary(cv, ov, {
        reduced,
        look: savedLook(),
        youSheet: you ? { sheet: you.sheet, phones: you.phones } : null,
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
        // Everyone as themselves: a person whose row is built wears it; the rest wear the premade look until it is.
        const remotes = (): LiveRemote[] => session.remotes().map((r) => {
          const d = store.row(store.lookOf(r.avatar, r.colour, r.id));
          return d ? { ...r, sheet: d.sheet, phones: d.phones } : r;
        });
        const dressYou = () => { const d = store.row(lookOfYou()); if (d) h.dressYou(d.sheet, d.phones); };
        redress.current = () => { dressYou(); h.setRemotes(remotes()); };
        offs.push(() => { redress.current = () => {}; });
        offs.push(store.subscribe(() => { dressYou(); h.setRemotes(remotes()); }));
        offs.push(session.onFloor(() => h.setRemotes(remotes())));
        offs.push(session.onEvent((e) => {
          if (e.type === "emote") h.say(e.id, EMOTE_TITLE[e.kind]);
          else toast(e.text);
        }));
        dressYou();
        h.setRemotes(remotes());
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
