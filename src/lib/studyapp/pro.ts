"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAccount } from "@/lib/account";

/**
 * Plumi Pro, as the website sees it. Pro is bought in the iPad app (Apple's rules: nothing here sells it, prices it or links to buying it);
 * the website only learns whether the signed-in student has it, from the account's server-verified record
 * (Supabase migration 0127, the RPC `account_pro`), so it "works here when you sign in".
 *
 * THE SWITCH. `PREMADE_GATE_ON` is false unless the build sets NEXT_PUBLIC_PREMADE_GATE=on. While it is off, nothing asks the server and
 * every ready-made deck is open to everyone. When it is on, the premade catalogue locks every module deck except each subject's taster
 * (premade.ts `entriesOf`) for a student who is not Pro.
 *
 * THE RULES. Unknown while the answer is on its way (never shown as locked: no flash). Signed out, or an anonymous visitor, is free, and asks
 * nothing. A server answer is kept for the visit. An error is "free" for gated decks (fail closed) but is never shown to the student and is
 * asked again after a minute. One caveat for whoever turns the gate on: `account_pro` also counts the asking device against the account's three
 * (0127, rule 4), so the website asks as ONE fixed device id (`WEB_DEVICE_ID`): every browser a student uses is one slot, not many.
 */
export const PREMADE_GATE_ON: boolean = process.env.NEXT_PUBLIC_PREMADE_GATE === "on";

export type ProState = "unknown" | "free" | "pro";

/** One fixed id for the website (the RPC wants 8 to 64 letters, digits and hyphens). */
export const WEB_DEVICE_ID = "plumi-web-browser";
export const PRO_RPC = "account_pro";
/** How long an answer that was not definitive (an error) is trusted before asking again. */
export const RETRY_MS = 60_000;

export type RpcFn = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

/** What `account_pro` answered: `pro` only for a row that says so. Null if the answer is not a row at all. */
export function readPro(data: unknown): boolean | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const pro = (row as { pro?: unknown }).pro;
  return typeof pro === "boolean" ? pro : null;
}

export interface Who { ready: boolean; userId: string | null; anonymous: boolean }

/** Whether a deck is locked now: only with the gate on, only once we know the student is free, and never the taster. */
export const isLocked = (gateOn: boolean, state: ProState, free: boolean): boolean => gateOn && state === "free" && !free;

/** What a tap on a deck does: add it, show the Pro panel, or wait for the answer (then ask again). */
export function onTap(gateOn: boolean, state: ProState, free: boolean): "add" | "locked" | "wait" {
  if (!gateOn || free || state === "pro") return "add";
  return state === "free" ? "locked" : "wait";
}

interface Entry { state: "pro" | "free"; definitive: boolean; at: number }

/** The answer for each signed-in student, and the asking. Pure but for the transport and the clock it is given. */
export class ProGate {
  private cache = new Map<string, Entry>();
  private inflight = new Map<string, Promise<"pro" | "free">>();
  private listeners = new Set<() => void>();
  /** Bumped whenever an answer lands, so a subscriber knows to read again. */
  version = 0;
  constructor(private rpc: () => Promise<RpcFn | null>, private now: () => number = Date.now) {}

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
    let entry: Entry;
    try {
      const rpc = await this.rpc();
      if (!rpc) throw new Error("not configured");
      const r = await rpc(PRO_RPC, { p_device_id: WEB_DEVICE_ID });
      const pro = r.error ? null : readPro(r.data);
      entry = pro === null ? { state: "free", definitive: false, at: this.now() } : { state: pro ? "pro" : "free", definitive: true, at: this.now() };
    } catch {
      entry = { state: "free", definitive: false, at: this.now() };
    }
    this.cache.set(id, entry);
    this.version++;
    this.listeners.forEach((l) => l());
    return entry.state;
  }
}

/** The page's gate, over the website's own Supabase client (loaded only when first asked). */
export const gate = new ProGate(async () => (await import("@/lib/social/browser")).browserApi.rpc);

/** `{ state }`: what the premade catalogue needs. With the switch off it is "unknown" and nothing is asked. */
export function usePro(): { state: ProState; gateOn: boolean; ask: () => Promise<"pro" | "free"> } {
  const { ready, user } = useAccount();
  const who: Who = { ready, userId: user?.id ?? null, anonymous: !!user?.is_anonymous };
  const key = `${who.ready}|${who.userId}|${who.anonymous}`;
  // The snapshot is a string so React compares by value; it changes when an answer lands or who is signed in changes.
  useSyncExternalStore(gate.subscribe, () => `${key}|${gate.version}`, () => "server");
  useEffect(() => { if (PREMADE_GATE_ON) void gate.ask(who); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { state: PREMADE_GATE_ON ? gate.peek(who) : "unknown", gateOn: PREMADE_GATE_ON, ask: () => gate.ask(who) };
}
