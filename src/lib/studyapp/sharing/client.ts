"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAccount } from "@/lib/account";
import { browserApi } from "@/lib/social/browser";
import type { AppData } from "../model";
import { OUT_KEY, codeForDeck, readCodes, writeCodes } from "./add";
import type { SharedRow } from "./contract";
import { makeProbe, type Availability } from "./probe";
import { sharePayload } from "./payload";
import { createSharing, type ShareResult } from "./service";

/**
 * Sharing, as the flashcards page uses it: is it on in this project, which decks have a live link, and the actions.
 *
 * The server's `my_shared_decks` is the truth about what is live (a link can be stopped from another device); this browser also
 * remembers which of its decks each code came from (`plumi-shared-out`, code to deck id), only so a deck can say "Shared" and
 * open its own link. A remembered code that the server no longer lists is dropped as soon as the list is known.
 */

interface State {
  availability: Availability | null;
  /** The live decks, or null until the list has been read (or when it could not be). */
  live: SharedRow[] | null;
  out: Record<string, string>;
}

const SERVER: State = { availability: null, live: null, out: {} };
let state: State = SERVER;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (next: Partial<State>) => { state = { ...state, ...next }; emit(); };

const sharing = createSharing(browserApi);
const store = (): Storage | null => { try { return window.localStorage; } catch { return null; } };
const session = (): Storage | null => { try { return window.sessionStorage; } catch { return null; } };
let probe: ReturnType<typeof makeProbe> | null = null;

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  probe = makeProbe(browserApi, session());
  state = { availability: probe.peek(), live: null, out: readCodes(store(), OUT_KEY) };
  window.addEventListener("storage", (e) => { if (e.key === OUT_KEY) set({ out: readCodes(store(), OUT_KEY) }); });
}

const subscribe = (cb: () => void) => { start(); listeners.add(cb); return () => { listeners.delete(cb); }; };
const snapshot = () => { start(); return state; };

async function ensureProbe() {
  start();
  if (state.availability) return;
  const a = await probe!.ask();
  if (a !== "unknown") set({ availability: a });
}

async function refreshLive(): Promise<SharedRow[] | null> {
  const r = await sharing.mine();
  if (!r.ok) return null;
  // Forget links the server no longer lists (stopped on another device, or by us).
  const live = new Set(r.value.map((x) => x.code));
  const kept = Object.fromEntries(Object.entries(state.out).filter(([c]) => live.has(c)));
  if (Object.keys(kept).length !== Object.keys(state.out).length) writeCodes(store(), OUT_KEY, kept);
  set({ live: r.value, out: kept });
  return r.value;
}

export type SignedIn = "real" | "anonymous" | "out";

export function useSharing() {
  const { user, ready } = useAccount();
  const s = useSyncExternalStore(subscribe, snapshot, () => SERVER);
  const signedIn: SignedIn = !ready || !user ? "out" : user.is_anonymous ? "anonymous" : "real";
  const userId = user?.id ?? null;

  useEffect(() => { void ensureProbe(); }, []);
  useEffect(() => {
    if (s.availability === "on" && signedIn === "real") void refreshLive();
    else if (s.live) set({ live: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `s.live` is only cleared here, never a reason to read again
  }, [s.availability, signedIn, userId]);

  const liveCodes = s.live ? new Set(s.live.map((r) => r.code)) : null;

  return {
    /** Sharing exists in this project. Until it does (or while that is not known) nothing about it is drawn. */
    available: s.availability === "on",
    signedIn,
    live: s.live,
    /** The live link of a deck made here, or null. */
    codeFor: (deckId: string): string | null => codeForDeck(s.out, deckId, liveCodes),
    refresh: refreshLive,
    async share(data: Pick<AppData, "decks" | "cards">, deckId: string): Promise<ShareResult<string>> {
      const payload = sharePayload(data, deckId);
      if (!payload) return { ok: false, reason: "other" };
      const r = await sharing.share(payload);
      if (r.ok) {
        const out = { ...state.out, [r.value]: deckId };
        writeCodes(store(), OUT_KEY, out);
        set({ out });
        void refreshLive();
      }
      return r;
    },
    async stop(code: string): Promise<ShareResult<boolean>> {
      const r = await sharing.unshare(code);
      // Already stopped (`false`) is the same outcome the student asked for.
      if (r.ok || (!r.ok && r.reason === "not_found")) {
        const out = Object.fromEntries(Object.entries(state.out).filter(([c]) => c !== code));
        writeCodes(store(), OUT_KEY, out);
        set({ out, live: state.live ? state.live.filter((x) => x.code !== code) : state.live });
        void refreshLive();
      }
      return r;
    },
  };
}
