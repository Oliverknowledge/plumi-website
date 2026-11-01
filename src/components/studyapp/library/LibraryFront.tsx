"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/account";
import type { SocialService } from "@/lib/social/service";
import { entryMemory, goDelay, goMs, shouldShowEntry, type TimeOfDay } from "@/lib/studyapp/library/entry";
import { playEnter } from "@/lib/studyapp/library/entrySound";
import { enterBrowserFullscreen } from "@/lib/studyapp/library/fullscreen";
import { leaveLibrary, useLibrary } from "@/lib/library";
import type { LibraryDriver } from "./driver";
import { EntryScreen, type Peek } from "./EntryScreen";
import type { Stage } from "./Front";
import { LibraryRoom } from "./Library";
import { useReducedMotion } from "./useFront";
import { preloadEntry } from "./preload";

/**
 * Study for a student who has joined: first the door (EntryScreen), then the room. Pressing Enter is what puts them in
 * the library, so the visit (and the lobby, and the room) starts only then; the door itself announces nobody.
 *
 *   door     Enter is up, the room's code and art are being fetched in the background
 *   press    the key is down; the room is mounted behind the door and is drawing its first frame
 *   go       the door pushes toward the student and fades, the room comes forward out of the light
 *   in       the room alone
 *
 * Stepping out to the Desk and coming straight back (QUICK_RETURN_MS) skips the key: the same scene is just a short
 * veil that lifts off the room. A reload always shows the door (it forgot the full screen and the sound).
 */
type Phase = "door" | "entering" | "in";

export function LibraryFront({ driver, onLeave = leaveLibrary, forced = false, tod, peek, onLogOut = () => void signOut() }: {
  driver: LibraryDriver;
  onLeave?: () => Promise<boolean>;
  /** The demo shows the door every time. */
  forced?: boolean;
  tod?: TimeOfDay;
  /** The demo scripts what the door reads; the real one asks the server. */
  peek?: () => Promise<Peek>;
  onLogOut?: (() => void) | null;
}) {
  const reduced = useReducedMotion();
  const [quick] = useState(() => !shouldShowEntry({ leftAt: entryMemory.leftAt, now: Date.now(), forced }));
  const [phase, setPhase] = useState<Phase>(quick ? "entering" : "door");
  const [stage, setStage] = useState<Stage>(quick ? "press" : "door");
  const [ready, setReady] = useState(false);
  const flow = useRef<HTMLDivElement>(null);
  const pressedAt = useRef<number>(0);
  const roomOn = phase !== "door";

  // While the door is up: the room's code and art, then the people layers and this student's own person. Nothing here joins a library.
  const lib = useLibrary();
  const avatar = driver.mine ? driver.mine.avatar : lib.profile?.avatar ?? null;
  const colour = driver.mine?.colour ?? lib.profile?.colour ?? 0;
  const me = driver.me;
  useEffect(() => { void preloadEntry({ avatar, colour, id: me.toLowerCase() }); }, [avatar, colour, me]);

  const read = useCallback(async (): Promise<Peek> => {
    if (peek) return peek();
    const s = driver.social as Partial<Pick<SocialService, "lobbyMe">> & Pick<SocialService, "lobbyServers">;
    const [servers, me] = await Promise.all([s.lobbyServers(), s.lobbyMe ? s.lobbyMe() : Promise.resolve(null)]);
    return { servers: servers.ok ? servers.value : null, hidden: !!(me && me.ok && me.value.visible === false) };
  }, [driver, peek]);

  // The press: a tap or a key, so the browser allows full screen and sound now.
  const press = useCallback(() => {
    if (phase !== "door") return;
    pressedAt.current = performance.now();
    try { performance.mark("plumi:enter:press"); } catch { /* fine */ }
    enterBrowserFullscreen();
    playEnter();
    setPhase("entering");
    setStage("press");
  }, [phase]);

  const finish = useCallback(() => {
    setPhase("in");
    setStage("door");
    // the room has the keys now (arrow keys and E), unless the student has gone elsewhere
    requestAnimationFrame(() => {
      const a = document.activeElement;
      if (!a || a === document.body || a === document.documentElement) document.querySelector<HTMLElement>(".lb-room canvas")?.focus({ preventScroll: true });
    });
  }, []);

  // Remember stepping out, so coming straight back is a short veil rather than the door again.
  useEffect(() => {
    if (!roomOn) return;
    entryMemory.entered();
    return () => entryMemory.left(Date.now());
  }, [roomOn]);

  // The room is drawn: its canvas is shown (`data-ready`). That is "the first frame", and the moment the walk may begin.
  useEffect(() => {
    if (!roomOn) return;
    const root = flow.current;
    if (!root) return;
    let raf = 0;
    const check = () => {
      if (!root.querySelector(".lb-room[data-ready]")) return;
      mo.disconnect();
      raf = requestAnimationFrame(() => {
        try { performance.mark("plumi:enter:room"); performance.measure("plumi:enter-to-room", "plumi:enter:press", "plumi:enter:room"); } catch { /* quick starts have no press */ }
        setReady(true);
      });
    };
    const mo = new MutationObserver(check);
    mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-ready"] });
    const first = requestAnimationFrame(check);
    return () => { mo.disconnect(); cancelAnimationFrame(first); cancelAnimationFrame(raf); };
  }, [roomOn]);

  // From the press to the walk: when the room is drawn and the press has had its moment (or at the latest after OUTRO.giveUp).
  useEffect(() => {
    if (phase !== "entering" || stage !== "press") return;
    const elapsed = quick ? 0 : performance.now() - pressedAt.current;
    const t = setTimeout(() => setStage("go"), goDelay({ elapsed, ready, reduced, quick }));
    return () => clearTimeout(t);
  }, [phase, stage, ready, reduced, quick]);

  // The walk, then the room alone. The overlay's own transitionend finishes it sooner; this is the net under it.
  useEffect(() => {
    if (stage !== "go") return;
    const t = setTimeout(finish, goMs({ reduced, quick }) + 220);
    return () => clearTimeout(t);
  }, [stage, reduced, quick, finish]);

  return (
    <div ref={flow} className="en-flow" data-phase={phase} data-stage={stage} data-quick={quick || undefined}>
      {roomOn && <LibraryRoom driver={driver} onLeave={onLeave} />}
      {phase !== "in" && (
        <EntryScreen stage={stage} quick={quick} onPress={press} onSkip={finish} onFaded={finish} read={read} onLogOut={onLogOut} tod={tod} />
      )}
    </div>
  );
}
