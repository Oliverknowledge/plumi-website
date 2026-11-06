import type { AppData } from "../model";
import type { Failure, SyncClient } from "./client";
import { noticeChanges } from "./engine";
import { runPass } from "./runner";
import { deviceId as makeDeviceId, emptyShadow, loadShadow, readOptIn, saveShadow, writeOptIn, type Shadow } from "./shadow";
import { OFF, reduce, type Event, type Status } from "./status";

/**
 * The background backup, as a small machine with its edges handed in (storage, network client, timers, clock, the app's data), so it is tested without a
 * browser. Rules:
 *  - nothing happens unless the student has chosen "Back up my notes" for the account that is signed in (a real one, not an anonymous visit);
 *  - a change waits a few seconds (so typing is one push), then a pass runs; a pass also runs when the app opens, when the tab comes back, and when
 *    the connection returns;
 *  - at most one pass at a time; a change during a pass earns another straight after;
 *  - a failure of any kind is "Waiting for a connection" and a quiet retry, further and further apart;
 *  - two tabs never run at once (a short lease in storage).
 */
export const DEBOUNCE_MS = 4_000;
export const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000] as const;
/** After a refusal (not a connection problem) trying again at once will not help. */
export const REFUSED_BACKOFF_MS = 600_000;
export const LEASE_MS = 150_000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface Timers { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void }

export interface RuntimeDeps {
  storage: Store | null;
  client: SyncClient;
  now(): number;
  online(): boolean;
  timers: Timers;
  getApp(): AppData;
  update(fn: (d: AppData) => AppData): void;
  random?(): number;
  debounceMs?: number;
}

export interface Account { id: string; anonymous?: boolean }

export function createSyncRuntime(deps: RuntimeDeps) {
  const debounce = deps.debounceMs ?? DEBOUNCE_MS;
  const random = deps.random ?? Math.random;
  const tab = `t${Math.floor(random() * 1e9).toString(36)}`;
  let account: Account | null = null;
  let on = false;
  let shadow: Shadow | null = null;
  let memoryOnly = false;
  let status: Status = OFF;
  let running = false;
  let again = false;
  let failures = 0;
  let timer: unknown = null;
  let epoch = 0;
  const listeners = new Set<() => void>();

  const real = (a: Account | null): a is Account => !!a && !a.anonymous;
  const apply = (e: Event) => { const next = reduce(status, e); if (next.phase !== status.phase || next.note !== status.note) { status = next; listeners.forEach((l) => l()); } };
  const cancel = () => { if (timer !== null) { deps.timers.clear(timer); timer = null; } };
  const later = (ms: number) => { cancel(); timer = deps.timers.set(() => { timer = null; void run(); }, ms); };

  const loadFor = (a: Account): Shadow => (memoryOnly && shadow && shadow.account === a.id ? shadow : loadShadow(deps.storage, a.id));
  const persist = (s: Shadow) => { shadow = s; if (!saveShadow(deps.storage, s)) memoryOnly = true; else memoryOnly = false; };

  const leaseKey = (id: string) => `plumi-sync-lease:${id}`;
  function takeLease(id: string): boolean {
    try {
      const raw = deps.storage?.getItem(leaseKey(id));
      if (raw) {
        const [owner, until] = raw.split("|");
        if (owner !== tab && Number(until) > deps.now()) return false;
      }
      deps.storage?.setItem(leaseKey(id), `${tab}|${deps.now() + LEASE_MS}`);
    } catch { /* no storage: nobody else can be told apart, carry on */ }
    return true;
  }
  function freeLease(id: string) {
    try { const raw = deps.storage?.getItem(leaseKey(id)); if (raw && raw.startsWith(`${tab}|`)) deps.storage?.removeItem(leaseKey(id)); } catch { /* as above */ }
  }

  async function run(): Promise<void> {
    const a = account;
    if (!on || !real(a)) return;
    if (running) { again = true; return; }
    if (!deps.online()) { apply({ type: "failed" }); return; }
    if (!takeLease(a.id)) { later(15_000); return; }
    running = true;
    const mine = epoch;
    apply({ type: "pending" });
    const start = loadFor(a);
    const out = await runPass({
      client: deps.client, account: a, device: makeDeviceId(deps.storage, random), now: deps.now, online: deps.online,
      getApp: deps.getApp, update: deps.update, save: persist, current: () => epoch === mine,
    }, start);
    running = false;
    freeLease(a.id);
    if (epoch !== mine) return;   // the account changed or the choice was withdrawn while it ran: that has already reset everything
    if (out.kind === "done") {
      failures = 0;
      persist(out.shadow);
      apply({ type: "done", notBackedUp: out.notBackedUp > 0 });
      if (again) { again = false; later(debounce); }
    } else if (out.kind === "failed") {
      again = false;
      persist(out.shadow);
      apply({ type: "failed" });
      later(delayFor(out.failure, failures++));
    }
  }

  const delayFor = (f: Failure, n: number): number => (f === "refused" || f === "unavailable" ? REFUSED_BACKOFF_MS : f === "signed_out" ? 60_000 : BACKOFF_MS[Math.min(n, BACKOFF_MS.length - 1)]);

  function reset(next: Account | null) {
    epoch++;
    cancel();
    running = false; again = false; failures = 0;
    account = next;
    on = real(next) && readOptIn(deps.storage, next.id);
    shadow = on && real(next) ? loadFor(next) : null;
    memoryOnly = false;
    status = on ? { phase: "backing_up", note: false } : OFF;
    listeners.forEach((l) => l());
  }

  return {
    /** The signed-in account (or none). A different account starts clean: its own choice, its own shadow. Signed out: nothing runs. */
    setAccount(next: Account | null) {
      if ((next?.id ?? null) === (account?.id ?? null) && (next?.anonymous ?? false) === (account?.anonymous ?? false)) return;
      reset(next);
      if (on) void run();
    },
    /** The student's data changed here. Costs nothing unless backing up is on. */
    notifyChange() {
      if (!on || !real(account)) return;
      const s = shadow ?? emptyShadow(account.id);
      const noticed = noticeChanges(deps.getApp(), s, deps.now());
      if (noticed !== s) shadow = noticed;
      apply({ type: "pending" });
      if (running) { again = true; return; }
      later(debounce);
    },
    /** The app opened, the tab came back, or the connection returned. */
    trigger() { if (on) { if (!deps.online()) apply({ type: "failed" }); else void run(); } },
    /** The connection went away. */
    offline() { if (on) apply({ type: "failed" }); },
    /** "Back up my notes", switched on: remembered for this account, and the first pass (the merge) starts now. */
    enable(): boolean {
      if (!real(account)) return false;
      writeOptIn(deps.storage, account.id, true);
      const a = account;
      reset(a);
      on = true;
      shadow = loadFor(a);
      status = reduce(OFF, { type: "enabled" });
      listeners.forEach((l) => l());
      void run();
      return true;
    },
    /** Switched off: nothing more is sent, and what is already backed up is left as it is. */
    disable() {
      if (!account) return;
      writeOptIn(deps.storage, account.id, false);
      const a = account;
      reset(a);
      on = false;
      status = OFF;
      listeners.forEach((l) => l());
    },
    /** Write what is known about this account's backup down now (the page is going away). */
    flush() { if (shadow && on) persist(shadow); },
    /** Run a pass now and wait for it (tests, and "load"). */
    runNow: run,
    status: (): Status => status,
    isOn: (): boolean => on,
    account: (): Account | null => account,
    subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; },
  };
}
export type SyncRuntime = ReturnType<typeof createSyncRuntime>;
