"use client";

import { useState, useSyncExternalStore } from "react";
import { toast } from "@/components/studyapp/toast";
import { demoDriver, type DemoOptions } from "@/lib/studyapp/library/demo";
import type { LobbyServers } from "@/lib/social/lobby";
import { entryMemory, type TimeOfDay } from "@/lib/studyapp/library/entry";
import { JoinCard, SignedOutCard, Waiting } from "./Cards";
import type { Peek } from "./EntryScreen";
import { LibraryRoom } from "./Library";
import { LibraryFront } from "./LibraryFront";

/** `?people=40&friends=30` or `?friends=none` (what the browser checks add to the scripted world). Nothing on the server render. */
function demoOptions(q: URLSearchParams): DemoOptions {
  const n = (k: string) => { const v = Number(q.get(k)); return Number.isFinite(v) && v > 0 ? Math.min(150, Math.floor(v)) : undefined; };
  return { people: n("people"), friends: q.get("friends") === "none" ? "none" : n("friends") };
}

/**
 * `?entry=1` shows the front door before the room (always, as a first visit would). `?entry=signedout|join|wait` show
 * the other three states of the same scene. `&tod=dawn|day|evening|night` picks the sky, `&live=none|quiet` what the
 * door can say, `&hidden=1` a hidden student. Without `entry` the room opens straight away, as it always did.
 */
const SERVERS: LobbyServers = { cap: 60, you: null, empty: 3, max: 20, servers: [{ shard: 1, here: 37, friends: 2 }, { shard: 2, here: 10, friends: 0 }] };
const TODS = ["dawn", "day", "evening", "night"] as const;

function scripted(q: URLSearchParams): () => Promise<Peek> {
  const live = q.get("live"), hidden = q.get("hidden") === "1";
  return async () => {
    if (live === "none") return { servers: null, hidden };
    if (live === "quiet") return { servers: { ...SERVERS, servers: [] }, hidden };
    return { servers: SERVERS, hidden, names: ["Maya", "Josh"] };
  };
}

/** The real room and panel on a scripted world (dev only: see library/demo/page.tsx). */
export function DemoLibrary() {
  const [driver] = useState(() => demoDriver(typeof window === "undefined" ? {} : demoOptions(new URLSearchParams(window.location.search))));
  const search = useSyncExternalStore(() => () => {}, () => window.location.search, () => null);
  if (search === null) return null;                    // the server and the first client render say nothing: the query is only known in the browser
  const q = new URLSearchParams(search);
  const entry = q.get("entry");
  const tod = (TODS as readonly string[]).includes(q.get("tod") ?? "") ? (q.get("tod") as TimeOfDay) : undefined;
  if (entry === "signedout") return <SignedOutCard accountsOn />;
  if (entry === "join") return <JoinCard accountName="Alex" />;
  if (entry === "wait") return <Waiting />;
  if (entry === "quick") return <Quick driver={driver} tod={tod} />;
  if (entry) return <LibraryFront driver={driver} onLeave={async () => true} forced tod={tod} peek={scripted(q)} onLogOut={() => toast("Logged out (demo)")} />;
  return <LibraryRoom driver={driver} onLeave={async () => true} />;
}

/** `?entry=quick`: as a student who stepped out to the Desk a moment ago and came back (dev only: the tab's memory is set once, before the door decides). */
function Quick({ driver, tod }: { driver: ReturnType<typeof demoDriver>; tod?: TimeOfDay }) {
  useState(() => { entryMemory.entered(); entryMemory.left(Date.now()); });
  return <LibraryFront driver={driver} onLeave={async () => true} tod={tod} />;
}
