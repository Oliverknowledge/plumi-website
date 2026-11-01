"use client";

/**
 * What the app shows of the Grand Library from outside it: the Desk's "412 revising" card and the Study tab's
 * badge. The library's own code (src/components/studyapp/library) fills this in; until it does, nothing is
 * claimed, so the Desk says nothing rather than something made up.
 *
 *   off        accounts are not configured on this site
 *   signedOut  nobody is signed in
 *   notJoined  signed in, but has not joined the library (nothing is shared until they do)
 *   ready      joined; `revising` and `friendsIn` are the server's own answer
 */
export type LiveState = "off" | "signedOut" | "notJoined" | "ready";
export interface LiveFriend { id: string; name: string; colour: number }
export interface LiveSummary { state: LiveState; revising: number | null; friendsIn: LiveFriend[] }

const NONE: LiveSummary = { state: "off", revising: null, friendsIn: [] };

let current: LiveSummary = NONE;
const listeners = new Set<() => void>();

/** Called by the library code whenever it knows more. */
export function publishLive(next: LiveSummary) {
  current = next;
  listeners.forEach((l) => l());
}

import { useSyncExternalStore } from "react";
export function useLiveSummary(): LiveSummary {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => current, () => NONE);
}
