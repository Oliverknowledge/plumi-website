"use client";

import { useEffect, useRef, useState } from "react";
import { totalHere, type LobbyServers } from "@/lib/social/lobby";
import { HIDDEN_NOTE, entryMemory, friendsIn, friendsLine, liveLine, namesAreFresh, type TimeOfDay } from "@/lib/studyapp/library/entry";
import { useLiveSummary } from "@/lib/studyapp/live";
import { FrontScene, Key, Wordmark, type Stage } from "./Front";

/** What the door may say, read once: the servers' counts, and whether the student is hidden. Nothing here puts anyone in a library. */
export interface Peek {
  servers: LobbyServers | null;
  hidden: boolean;
  /** Friends' names, when the caller already knows them truthfully (the dev-only demo's script; the real door never sets it). */
  names?: string[] | null;
}

/**
 * The Enter screen: the scene, the lettering, one key, and two true lines under it (how many are studying, which
 * friends are in). Pressing the key (a tap or a click, or Enter or Space while nothing else has focus) is handled by
 * LibraryFront, which also owns the transition; this is only what is on the screen. Nothing is said that the
 * server did not say: until it answers there are no lines, and the space for them is already there.
 */
export function EntryScreen({ stage, quick, onPress, onSkip, onFaded, read, onLogOut, tod }: {
  stage: Stage;
  quick: boolean;
  onPress: () => void;
  onSkip: () => void;
  onFaded: () => void;
  read: () => Promise<Peek>;
  onLogOut?: (() => void) | null;
  tod?: TimeOfDay;
}) {
  const key = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement | null>(null);
  const live = useLiveSummary();
  const liveNow = useRef(live);
  const [seen, setSeen] = useState<{ peek: Peek; names: string[] | null } | null>(null);
  const waiting = stage === "door";

  useEffect(() => { liveNow.current = live; });

  // What the server says, once. The room's own published friends are used for names only if it published them moments ago.
  useEffect(() => {
    let dead = false;
    read().then((peek) => {
      if (dead) return;
      const l = liveNow.current;
      const fresh = l.state === "ready" && namesAreFresh(entryMemory.leftAt, Date.now());
      setSeen({ peek, names: peek.names ?? (fresh ? l.friendsIn.map((f) => f.name) : null) });
    }).catch(() => { /* nothing is said */ });
    return () => { dead = true; };
  }, [read]);

  // The key has focus, so Enter and Space press it natively; if focus is on nothing, they press it anyway.
  useEffect(() => {
    if (!waiting) return;
    key.current?.focus({ preventScroll: true });
    const on = (e: KeyboardEvent) => {
      if (e.repeat || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      const a = document.activeElement;
      if (a && a !== document.body && a !== document.documentElement && a !== root.current) return;   // a focused control handles its own keys
      e.preventDefault();
      onPress();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [waiting, onPress]);

  const total = seen?.peek.servers ? totalHere(seen.peek.servers) : null;
  const friends = seen?.peek.servers ? friendsIn(seen.peek.servers) : null;
  const one = liveLine(total), two = friendsLine(friends, seen?.names ?? null), three = seen?.peek.hidden ? HIDDEN_NOTE : null;

  return (
    <FrontScene ref={root} stage={stage} quick={quick} tod={tod} onLogOut={onLogOut} onFaded={onFaded} onSkip={onSkip} testid="library-entry">
      <div className="en-col">
        <Wordmark />
        <div className="en-cta">
          <Key ref={key} label="Enter" glyph pressed={!waiting} onClick={onPress} aria-label="Enter the Grand Library" testid="enter-library" />
          <div className="en-live" aria-live="polite" data-testid="entry-live">
            {one && <p className="en-line is-live" data-testid="entry-count"><i aria-hidden="true" />{one}</p>}
            {two && <p className="en-line" data-testid="entry-friends">{two}</p>}
            {three && <p className="en-line is-quiet" data-testid="entry-hidden">{three}</p>}
          </div>
        </div>
      </div>
    </FrontScene>
  );
}
