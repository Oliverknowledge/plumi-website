"use client";

import { useSyncExternalStore } from "react";
import { track as trackEvent } from "@/lib/analytics";

/**
 * A tickbox before each sitting of a paper, so a student can keep track of the papers they've done
 * (a student asked for it, 29 October 2026). Kept in this browser only, keyed by the paper and the
 * session ("aqa-a-level-chemistry-1|June 2024"); no account needed, and nothing leaves the device.
 */
const KEY = "plumi-papers-done";
const listeners = new Set<() => void>();
let cache: { raw: string | null; set: Set<string> } = { raw: null, set: new Set() };

function read(): Set<string> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache.set;
  }
  if (raw !== cache.raw) {
    let list: string[] = [];
    try {
      list = raw ? JSON.parse(raw) : [];
    } catch {
      list = [];
    }
    cache = { raw, set: new Set(Array.isArray(list) ? list : []) };
  }
  return cache.set;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}

function setDone(id: string, on: boolean) {
  const next = new Set(read());
  if (on) next.add(id);
  else next.delete(id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    cache = { raw: cache.raw, set: next }; // private browsing: kept for this page only
  }
  listeners.forEach(l => l());
}

export function DoneTick({ paper, session, label }: { paper: string; session: string; label: string }) {
  const id = `${paper}|${session}`;
  const done = useSyncExternalStore(subscribe, () => read().has(id), () => false);
  return (
    <label className="pp-done" title={done ? "Done: untick to clear" : "Tick when you've done this paper"}>
      <input type="checkbox" checked={done} aria-label={`${label}: done`}
        onChange={e => { setDone(id, e.target.checked); if (e.target.checked) trackEvent("paper_marked_done", { paper, session }); }} />
    </label>
  );
}
