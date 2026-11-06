"use client";

import { useEffect, useSyncExternalStore } from "react";
import { supabase, useAccount } from "@/lib/account";

/**
 * Plumi Pro, as the website sees it. Pro is bought in the iPad app (Apple's rules: nothing here sells it, prices it or links to buying it); the website only
 * learns whether the signed-in student has it, and it works here when they sign in.
 *
 * The Mark scheme decks are EXCLUSIVELY Pro: always locked for anyone who is not, with no taster and no switch. This file is only what the screen shows (a lock,
 * a Pro tag). The real gate is on the server: the cards are not in the page or in any public file, and /api/premade/markscheme/<spec> sends them only after
 * checking the student's own entitlement (lib/studyapp/proServer.ts). So a student who edits this file in their browser gets a lock that opens onto nothing.
 *
 * Status comes from /api/pro-status, which reads the student's own entitlement row with their own token. It never calls the `account_pro` function, which
 * counts the caller as one of the account's three devices: the website takes no slot.
 *
 * Rules: unknown while the answer is on its way (never shown locked and then opened; a tap waits for it). Signed out, or an anonymous visitor, is free and
 * asks nothing. A real answer is kept for the visit. An error is "free" (fail closed), never shown to the student, and asked again after a minute.
 */
export type ProState = "unknown" | "free" | "pro";

/** How long an answer that was not definitive (an error) is trusted before asking again. */
export const RETRY_MS = 60_000;

export type ProAnswer = "pro" | "free" | "error";

/** What /api/pro-status said: 200 is Pro, 403 is not; 401 (a token the server does not accept) is not Pro either; anything else could not be told. */
export function answerFromStatus(status: number): ProAnswer {
  return status === 200 ? "pro" : status === 403 || status === 401 ? "free" : "error";
}

/** Whether a locked deck is shown locked: the Mark scheme group, once we know the student is not Pro. Unknown shows neither lock nor open. */
export const isLocked = (state: ProState): boolean => state === "free";

/** What a tap on a Mark scheme deck does: open it (Pro), show the Pro panel (free), or wait for the answer first. */
export function onTap(state: ProState): "open" | "locked" | "wait" {
  return state === "pro" ? "open" : state === "free" ? "locked" : "wait";
}

export interface Who { ready: boolean; userId: string | null; anonymous: boolean }
interface Entry { state: "pro" | "free"; definitive: boolean; at: number }

/** The answer for each signed-in student, and the asking. Pure but for the probe and the clock it is given. */
export class ProGate {
  private cache = new Map<string, Entry>();
  private inflight = new Map<string, Promise<"pro" | "free">>();
  private listeners = new Set<() => void>();
  /** Bumped whenever an answer lands, so a subscriber knows to read again. */
  version = 0;
  constructor(private probe: () => Promise<ProAnswer>, private now: () => number = Date.now) {}

  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; };

  /** What is known right now, never asking. */
  peek(who: Who): ProState {
    if (!who.ready) return "unknown";
    if (!who.userId || who.anonymous) return "free";
    const e = this.cache.get(who.userId);
    return e ? e.state : "unknown";
  }

  /** The answer, asking the server if there is none (or only a failed one older than `RETRY_MS`). Never rejects. */
  ask(who: Who): Promise<"pro" | "free"> {
    if (!who.ready || !who.userId || who.anonymous) return Promise.resolve("free");
    const id = who.userId;
    const e = this.cache.get(id);
    if (e && (e.definitive || this.now() - e.at < RETRY_MS)) return Promise.resolve(e.state);
    const running = this.inflight.get(id);
    if (running) return running;
    const p = this.fetch(id).finally(() => this.inflight.delete(id));
    this.inflight.set(id, p);
    return p;
  }

  private async fetch(id: string): Promise<"pro" | "free"> {
    let a: ProAnswer;
    try { a = await this.probe(); } catch { a = "error"; }
    const entry: Entry = { state: a === "pro" ? "pro" : "free", definitive: a !== "error", at: this.now() };
    this.cache.set(id, entry);
    this.version++;
    this.listeners.forEach((l) => l());
    return entry.state;
  }
}

/** The student's access token, if signed in (null if not, or if accounts are off). */
export async function accessToken(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  try { return (await sb.auth.getSession()).data.session?.access_token ?? null; } catch { return null; }
}

async function probeServer(): Promise<ProAnswer> {
  const token = await accessToken();
  if (!token) return "free";
  const res = await fetch("/api/pro-status", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  return answerFromStatus(res.status);
}

/** The page's gate. */
export const gate = new ProGate(probeServer);

/** `{ state }` and `ask`: what the Mark scheme group needs. */
export function usePro(): { state: ProState; ask: () => Promise<"pro" | "free"> } {
  const { ready, user } = useAccount();
  const who: Who = { ready, userId: user?.id ?? null, anonymous: !!user?.is_anonymous };
  const key = `${who.ready}|${who.userId}|${who.anonymous}`;
  // The snapshot is a string so React compares by value; it changes when an answer lands or who is signed in changes.
  useSyncExternalStore(gate.subscribe, () => `${key}|${gate.version}`, () => "server");
  useEffect(() => { void gate.ask(who); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { state: gate.peek(who), ask: () => gate.ask(who) };
}
