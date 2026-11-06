"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase, useAccount } from "@/lib/account";
import { track } from "@/lib/analytics";
import { applyOverrideQuery, readProOverride } from "./override";
import type { ProReason } from "./server";

/**
 * Plumi Pro on the screen: ONE hook, `usePro()`, for everything. Pro is bought only in the iPad app; the website reads the student's own entitlement through
 * /api/pro-status (lib/pro/server.ts) and shows locks accordingly. The screen is only a courtesy: every Pro route checks again on the server (`requirePro`), so a
 * student who edits this in their browser gets a lock that opens onto nothing. See docs/study/pro.md.
 *
 * The rules, so a Pro student is never shown a lock and a free student never sees a flash of unlocked:
 *   - "unknown" (never "free") while the answer is on its way, and when it could not be had (an error shows as unknown, quietly, and is asked again after 60 s).
 *   - Signed out, or an anonymous visitor, is "free" at once and asks nothing.
 *   - ONE request is shared by every component; a real answer is kept for the visit.
 *   - It is asked again when the tab comes back after 5 minutes or more (the old answer stays on screen until the new one lands), and after signing in or out.
 *   - `refresh()` asks again now, past every cache (Settings "Check again", for the minute after a purchase on iPad).
 */
export type ProState = "unknown" | "free" | "pro";

/** What the server said, as the screen needs it. */
export type ProAnswer =
  | { kind: "pro"; expiresAt?: string; status?: "active" | "grace" }
  | { kind: "free"; reason: ProReason | "signed_out"; expiresAt?: string }
  | { kind: "unknown" };

export interface ProPlan { state: ProState; reason?: ProReason | "signed_out"; expiresAt?: string; status?: "active" | "grace" }

export const RETRY_MS = 60_000;
export const STALE_MS = 5 * 60_000;

/** What /api/pro-status answered: 200 Pro (with its expiry), 403 free (with why), a token it would not take is free too, anything else could not be told. */
export function parseStatus(status: number, body: unknown): ProAnswer {
  const b = (body && typeof body === "object" ? body : {}) as { expiresAt?: unknown; status?: unknown; reason?: unknown };
  const expiresAt = typeof b.expiresAt === "string" ? b.expiresAt : undefined;
  if (status === 200) return { kind: "pro", expiresAt, status: b.status === "grace" ? "grace" : "active" };
  if (status === 403) return { kind: "free", reason: (typeof b.reason === "string" ? b.reason : "none") as ProReason, ...(expiresAt ? { expiresAt } : {}) };
  if (status === 401) return { kind: "free", reason: "bad_token" };
  return { kind: "unknown" };
}

const plan = (a: ProAnswer): ProPlan =>
  a.kind === "pro" ? { state: "pro", expiresAt: a.expiresAt, status: a.status } : a.kind === "free" ? { state: "free", reason: a.reason, expiresAt: a.expiresAt } : { state: "unknown" };

export interface Who { ready: boolean; userId: string | null; anonymous: boolean }
interface Entry { answer: ProAnswer; at: number }

export interface StoreOptions {
  now?: () => number;
  /** Runs `fn` after `ms`; returns a cancel. (A seam for tests.) */
  later?: (fn: () => void, ms: number) => () => void;
}

/** The shared answer for each signed-in student, and the asking. Pure but for the probe, the clock and the timer it is given. */
export class ProStore {
  private entries = new Map<string, Entry>();
  private inflight = new Map<string, Promise<ProPlan>>();
  private retry: (() => void) | null = null;
  private last: Who | null = null;
  private listeners = new Set<() => void>();
  /** Bumped whenever an answer lands, so a subscriber knows to read again. */
  version = 0;
  private now: () => number;
  private later: (fn: () => void, ms: number) => () => void;

  constructor(private probe: (fresh: boolean) => Promise<ProAnswer>, opts: StoreOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.later = opts.later ?? ((fn, ms) => { const t = setTimeout(fn, ms); return () => clearTimeout(t); });
  }

  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; };
  hasListeners = () => this.listeners.size > 0;

  /** What is known right now, never asking. */
  peek(who: Who): ProPlan {
    if (!who.ready) return { state: "unknown" };
    if (!who.userId) return { state: "free", reason: "signed_out" };
    if (who.anonymous) return { state: "free", reason: "anonymous" };
    const e = this.entries.get(who.userId);
    return e ? plan(e.answer) : { state: "unknown" };
  }

  /** Is an answer on its way for this student (or not asked yet)? */
  loading(who: Who): boolean {
    if (!who.ready) return true;
    if (!who.userId || who.anonymous) return false;
    return this.inflight.has(who.userId) || !this.entries.has(who.userId);
  }

  /**
   * The answer, asking the server if there is none. `fresh` asks again past every cache. A background ask (the tab came back) keeps what is on screen until the
   * new answer lands, and an error never replaces a real answer with "unknown". Never rejects.
   */
  ask(who: Who, o: { fresh?: boolean; background?: boolean } = {}): Promise<ProPlan> {
    if (!who.ready || !who.userId || who.anonymous) return Promise.resolve(this.peek(who));
    this.last = who;
    const id = who.userId;
    const e = this.entries.get(id);
    if (!o.fresh && e && e.answer.kind !== "unknown") return Promise.resolve(plan(e.answer));
    const running = this.inflight.get(id);
    if (running) return running;
    // (listeners are told again once the request is no longer in flight, so `loading` reads false on that render)
    const p = this.run(id, !!o.fresh).finally(() => { this.inflight.delete(id); this.version++; this.listeners.forEach((l) => l()); });
    this.inflight.set(id, p);
    this.listeners.forEach((l) => l());
    return p;
  }

  private async run(id: string, fresh: boolean): Promise<ProPlan> {
    let a: ProAnswer;
    try { a = await this.probe(fresh); } catch { a = { kind: "unknown" }; }
    const prev = this.entries.get(id);
    // An error never throws away a real answer already on screen; it only means "ask again later".
    if (!(a.kind === "unknown" && prev && prev.answer.kind !== "unknown")) this.entries.set(id, { answer: a, at: this.now() });
    else this.entries.set(id, { answer: prev.answer, at: prev.at });
    this.version++;
    if (a.kind === "unknown") this.scheduleRetry(); else { this.retry?.(); this.retry = null; }
    this.listeners.forEach((l) => l());
    return plan(this.entries.get(id)!.answer);
  }

  private scheduleRetry() {
    this.retry?.();
    this.retry = this.later(() => {
      this.retry = null;
      const w = this.last;
      if (w && this.hasListeners()) void this.ask(w, { fresh: true, background: true });
    }, RETRY_MS);
  }

  /** The tab came back: ask again quietly if the answer is 5 minutes old or more. */
  refreshIfStale(who: Who): void {
    if (!who.ready || !who.userId || who.anonymous) return;
    const e = this.entries.get(who.userId);
    if (e && this.now() - e.at >= STALE_MS) void this.ask(who, { fresh: true, background: true });
  }
}

/** The student's access token, if signed in (null if not, or if accounts are off). `getSession` refreshes an expired one first. */
export async function accessToken(forceRefresh = false): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  try {
    if (forceRefresh) { const r = await sb.auth.refreshSession(); return r.data.session?.access_token ?? null; }
    return (await sb.auth.getSession()).data.session?.access_token ?? null;
  } catch { return null; }
}

async function probeServer(fresh: boolean): Promise<ProAnswer> {
  const call = async (token: string) => {
    const res = await fetch(`/api/pro-status${fresh ? "?fresh=1" : ""}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    return parseStatus(res.status, await res.json().catch(() => null));
  };
  let token = await accessToken();
  if (!token) return { kind: "free", reason: "no_token" };
  let a = await call(token);
  // A token that expired mid-session: take a new one once and ask again.
  if (a.kind === "free" && a.reason === "bad_token") { token = await accessToken(true); if (token) a = await call(token); }
  track("pro_status_checked", { state: a.kind });
  return a;
}

/** The page's store. */
export const store = new ProStore(probeServer);

let focusBound = false;
let current: Who = { ready: false, userId: null, anonymous: false };
function bindFocus() {
  if (focusBound || typeof document === "undefined") return;
  focusBound = true;
  const back = () => { if (document.visibilityState === "visible") store.refreshIfStale(current); };
  document.addEventListener("visibilitychange", back);
  window.addEventListener("focus", back);
}

export interface UsePro {
  state: ProState;
  /** An answer is on its way (or not asked yet). `state` is "unknown" meanwhile. */
  loading: boolean;
  plan: ProPlan;
  /** Ask again now, past every cache. */
  refresh: () => Promise<ProPlan>;
  /** Ask if there is no answer yet (and wait for it): what a tap on a Pro thing does before it decides. */
  ready: () => Promise<ProPlan>;
}

export function usePro(): UsePro {
  const { ready, user } = useAccount();
  const who: Who = { ready, userId: user?.id ?? null, anonymous: !!user?.is_anonymous };
  const key = `${who.ready}|${who.userId}|${who.anonymous}`;
  // The snapshot is a string so React compares by value; it changes when an answer lands or who is signed in changes.
  useSyncExternalStore(store.subscribe, () => `${key}|${store.version}`, () => "server");
  useEffect(() => { current = who; bindFocus(); void store.ask(who); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = useCallback(() => store.ask(current, { fresh: true }), []);
  const ensure = useCallback(() => store.ask(current), []);

  // The test seam (never in production: the build removes it, and readProOverride refuses anyway).
  let override: "on" | "off" | null = null;
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* blocked */ }
    const stored = applyOverrideQuery(process.env.NODE_ENV, window.location.search, storage);
    override = readProOverride({ nodeEnv: process.env.NODE_ENV, search: window.location.search, stored });
  }
  if (override) {
    const p: ProPlan = override === "on" ? { state: "pro", status: "active" } : { state: "free", reason: "none" };
    return { state: p.state, loading: false, plan: p, refresh: async () => p, ready: async () => p };
  }
  const p = store.peek(who);
  return { state: p.state, loading: store.loading(who), plan: p, refresh, ready: ensure };
}
