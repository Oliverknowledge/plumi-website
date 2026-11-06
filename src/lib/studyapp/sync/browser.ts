"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { accountsOn, supabase, useAccount } from "@/lib/account";
import type { AppData } from "../model";
import { createSyncClient, type SyncClient } from "./client";
import { syncSwitchedOff } from "./contract";
import { createSyncRuntime, type SyncRuntime } from "./runtime";
import { OFF, type Status } from "./status";

/**
 * The browser's binding of the background backup: the one Supabase client, localStorage, the window's events and the study app's store. Nothing
 * here decides anything; runtime.ts does. Started once by the store (store.ts) when the study app opens. With no project configured, or the kill
 * switch (NEXT_PUBLIC_PLUMI_SYNC=off), it never starts and the app is exactly as it was.
 */
export interface AppBridge { get(): AppData; update(fn: (d: AppData) => AppData): void }

let runtime: SyncRuntime | null = null;
const noop = () => {};

const storage = (): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null => { try { return window.localStorage; } catch { return null; } };

const client = (): SyncClient => createSyncClient({
  async rpc(name, args) {
    const sb = supabase();
    if (!sb) return { data: null, error: { message: "not configured" } };
    const r = await sb.rpc(name, args);
    return { data: r.data, error: r.error ? { message: r.error.message, code: r.error.code, status: r.status } : null };
  },
});

export function startAppSync(bridge: AppBridge): void {
  if (runtime || typeof window === "undefined" || !accountsOn || syncSwitchedOff()) return;
  const sb = supabase();
  if (!sb) return;
  const rt = createSyncRuntime({
    storage: storage(), client: client(), now: Date.now, online: () => navigator.onLine !== false,
    timers: { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
    getApp: bridge.get, update: bridge.update,
  });
  runtime = rt;

  const set = (user: { id: string; is_anonymous?: boolean } | null | undefined) => rt.setAccount(user ? { id: user.id, anonymous: user.is_anonymous === true } : null);
  void sb.auth.getSession().then(({ data }) => set(data.session?.user), () => set(null));
  sb.auth.onAuthStateChange((_event, session) => set(session?.user));

  let last = 0;
  const wake = () => { if (document.visibilityState === "visible" && Date.now() - last > 15_000) { last = Date.now(); rt.trigger(); } };
  window.addEventListener("focus", wake);
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("online", () => rt.trigger());
  window.addEventListener("offline", () => rt.offline());
  window.addEventListener("pagehide", () => rt.flush());
}

/** The store tells the backup the student's data changed (not when the backup itself changed it). */
export function noteAppChanged(): void { runtime?.notifyChange(); }

/* ── For the Settings row ──────────────────────────────────────────────────────────────────────────────────── */

const subscribe = (cb: () => void) => (runtime ? runtime.subscribe(cb) : noop);
const status = (): Status => runtime?.status() ?? OFF;
const isOn = (): boolean => runtime?.isOn() ?? false;

/** Does this project have the backup functions? Asked once per visit, by a call that reads nothing (a cursor past the end), and only for a signed-in student. */
type Availability = "on" | "off" | "unknown";
let probed: Promise<Availability> | null = null;
const PROBE_KEY = "plumi-sync-probe";
function probe(): Promise<Availability> {
  probed ??= (async () => {
    try { const v = window.sessionStorage.getItem(PROBE_KEY); if (v === "on" || v === "off") return v; } catch { /* below */ }
    const r = await client().pull(Number.MAX_SAFE_INTEGER, 1);
    const a: Availability = r.ok ? "on" : r.failure === "unavailable" ? "off" : "unknown";
    if (a !== "unknown") { try { window.sessionStorage.setItem(PROBE_KEY, a); } catch { /* not remembered */ } } else probed = null;
    return a;
  })();
  return probed;
}

export interface SyncSetting {
  /** Draw the row at all: a real signed-in account, a project that has the backup, and not switched off. */
  visible: boolean;
  on: boolean;
  status: Status;
  enable(): void;
  disable(): void;
}

export function useSyncSetting(): SyncSetting {
  const { ready, user, on: accounts } = useAccount();
  const st = useSyncExternalStore(subscribe, status, () => OFF);
  const on = useSyncExternalStore(subscribe, isOn, () => false);
  const real = accountsOn && accounts && ready && !!user && user.is_anonymous !== true && !syncSwitchedOff();
  const [available, setAvailable] = useState<Availability>("unknown");
  useEffect(() => {
    if (!real || on) return;
    let live = true;
    void probe().then((a) => { if (live) setAvailable(a); });
    return () => { live = false; };
  }, [real, on]);
  return { visible: real && (on || available === "on"), on, status: st, enable: () => { runtime?.enable(); }, disable: () => { runtime?.disable(); } };
}
