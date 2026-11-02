"use client";

import { useState, useSyncExternalStore } from "react";
import { cafeDemoDriver, type CafeDemoOptions } from "@/lib/studyapp/library/cafeDemo";
import { CAFE_ROOM } from "@/lib/studyapp/library/rooms";
import { LibraryRoom } from "./Library";

/** `?bots=12&me=badger&zoo=1&alone=1&seed=7`: what the browser checks add to the scripted cafe. Nothing on the server render. */
function options(q: URLSearchParams): CafeDemoOptions {
  const n = (k: string) => { const v = Number(q.get(k)); return Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined; };
  return { bots: n("bots"), me: q.get("me") ?? undefined, zoo: q.get("zoo") === "1", alone: q.get("alone") === "1", seed: n("seed") };
}

/** The cafe's room and the library's panel on a scripted world (dev only: see cafe/demo/page.tsx). */
export function DemoCafe() {
  const [driver] = useState(() => cafeDemoDriver(typeof window === "undefined" ? {} : options(new URLSearchParams(window.location.search))));
  const search = useSyncExternalStore(() => () => {}, () => window.location.search, () => null);
  if (search === null) return null;                    // the server and the first client render say nothing: the query is only known in the browser
  return <LibraryRoom driver={driver} onLeave={async () => true} room={CAFE_ROOM} />;
}
