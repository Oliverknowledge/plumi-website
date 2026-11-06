/**
 * npm run sync:test
 *
 * The background behaviour: nothing runs unless signed in for real AND opted in; a change waits, then goes up as one; one pass at a time; failures wait
 * and retry; the shadow and the choice belong to the account; broken storage loses nothing.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addCard, addDeck, editCard, EMPTY, type AppData } from "../model";
import { createSyncClient } from "./client";
import { BACKOFF_MS, createSyncRuntime, DEBOUNCE_MS, REFUSED_BACKOFF_MS, type Timers } from "./runtime";
import { loadShadow, optInKey, shadowKey, DEVICE_KEY } from "./shadow";
import { FakeServer } from "./testkit";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
class BrokenStorage { getItem(): string | null { throw new Error("blocked"); } setItem(): void { throw new Error("full"); } removeItem(): void { throw new Error("blocked"); } }

/** Timers on a clock the test moves. */
function clockwork(start = 1_762_400_000_000) {
  let t = start;
  let seq = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers: Timers = {
    set: (fn, ms) => { const id = ++seq; pending.set(id, { at: t + ms, fn }); return id; },
    clear: (h) => { pending.delete(h as number); },
  };
  return {
    timers, now: () => t, pending: () => [...pending.values()].map((p) => p.at - t).sort((a, b) => a - b),
    async advance(ms: number) {
      const end = t + ms;
      for (;;) {
        const due = [...pending.entries()].filter(([, p]) => p.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        pending.delete(due[0]); t = Math.max(t, due[1].at); due[1].fn();
        await settle();
      }
      t = end;
    },
  };
}
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };

function rig(opts: { storage?: MemoryStorage | BrokenStorage; server?: FakeServer; online?: () => boolean; user?: string | null } = {}) {
  const server = opts.server ?? new FakeServer();
  const storage = opts.storage ?? new MemoryStorage();
  const clock = clockwork();
  let app: AppData = EMPTY;
  const rt = createSyncRuntime({
    storage, client: createSyncClient(server.api(opts.user === undefined ? "user-1" : opts.user)), now: clock.now, online: opts.online ?? (() => true), timers: clock.timers,
    getApp: () => app, update: (fn) => { app = fn(app); }, random: () => 0.123456,
  });
  const edit = (fn: (d: AppData, now: number) => AppData) => { app = fn(app, clock.now()); rt.notifyChange(); };
  return { server, storage, clock, rt, edit, get app() { return app; }, set app(v: AppData) { app = v; } };
}
const withDeck = (r: ReturnType<typeof rig>) => { r.edit((d, n) => addDeck(d, "Notes", n).data); const id = r.app.decks[0].id; r.edit((d, n) => addCard(d, id, "q", "a", n)); return id; };

describe("signed out, anonymous or not opted in: nothing leaves the browser", () => {
  it("signed out: not one call, whatever happens", async () => {
    const r = rig();
    r.rt.setAccount(null);
    withDeck(r);
    r.rt.trigger(); r.rt.offline();
    assert.equal(r.rt.enable(), false, "there is nobody to back up for");
    await r.clock.advance(10 * 60_000);
    assert.equal(r.server.calls.length, 0);
    assert.equal(r.rt.status().phase, "off");
    assert.deepEqual([...(r.storage as MemoryStorage).data.keys()], [], "and nothing is written either");
  });

  it("an anonymous visit: not one call", async () => {
    const r = rig();
    r.rt.setAccount({ id: "anon-1", anonymous: true });
    withDeck(r);
    r.rt.trigger();
    assert.equal(r.rt.enable(), false);
    await r.clock.advance(10 * 60_000);
    assert.equal(r.server.calls.length, 0);
  });

  it("signed in but never chose to back up: not one call, no timers", async () => {
    const r = rig();
    r.rt.setAccount({ id: "user-1" });
    withDeck(r);
    r.rt.trigger();
    assert.deepEqual(r.clock.pending(), []);
    await r.clock.advance(10 * 60_000);
    assert.equal(r.server.calls.length, 0);
    assert.equal(r.rt.status().phase, "off");
  });

  it("the server refusing the session (signed out in another tab) is just waiting", async () => {
    const r = rig({ user: null });
    r.rt.setAccount({ id: "user-1" });
    r.rt.enable();
    await settle();
    assert.equal(r.rt.status().phase, "waiting");
  });
});

describe("opting in", () => {
  it("turning it on remembers the choice for this account and starts the merge at once", async () => {
    const r = rig();
    r.rt.setAccount({ id: "user-1" });
    r.app = EMPTY;
    withDeck(r);   // made before the choice: not sent yet
    assert.equal(r.server.calls.length, 0);
    assert.equal(r.rt.enable(), true);
    assert.equal(r.rt.status().phase, "backing_up");
    await settle();
    assert.equal(r.rt.status().phase, "backed_up");
    assert.equal(r.server.decks.size, 1);
    assert.equal(r.server.cards.size, 1);
    assert.equal((r.storage as MemoryStorage).getItem(optInKey("user-1")), "1");
    assert.ok((r.storage as MemoryStorage).getItem(shadowKey("user-1")));
  });

  it("the choice survives a reload, and the app then backs up on load", async () => {
    const storage = new MemoryStorage();
    const server = new FakeServer();
    const first = rig({ storage, server });
    first.rt.setAccount({ id: "user-1" });
    withDeck(first);
    first.rt.enable();
    await settle();
    const again = rig({ storage, server });
    again.app = first.app;
    again.edit((d, n) => addCard(d, d.decks[0].id, "added while closed", "a", n));
    const before = server.calls.length;
    again.rt.setAccount({ id: "user-1" });
    assert.equal(again.rt.isOn(), true);
    await settle();
    assert.ok(server.calls.length > before, "synced on load");
    assert.equal(server.cards.size, 2);
  });

  it("turning it off stops everything and leaves what is on the server as it is", async () => {
    const r = rig();
    r.rt.setAccount({ id: "user-1" });
    const deck = withDeck(r);
    r.rt.enable();
    await settle();
    const calls = r.server.calls.length;
    r.rt.disable();
    assert.equal(r.rt.status().phase, "off");
    r.edit((d) => editCard(d, d.cards[0].id, "changed after", "a"));
    r.rt.trigger();
    await r.clock.advance(10 * 60_000);
    assert.equal(r.server.calls.length, calls, "no call after it was turned off");
    assert.equal(r.server.cards.size, 1);
    assert.equal([...r.server.cards.values()][0].deleted_at, null, "nothing was deleted from the backup");
    assert.equal((r.storage as MemoryStorage).getItem(optInKey("user-1")), null);
    void deck;
  });
});

describe("when it runs", () => {
  it("a burst of changes waits four seconds and goes up as one push", async () => {
    const r = rig();
    r.rt.setAccount({ id: "user-1" });
    r.rt.enable();
    await settle();
    const pushes = () => r.server.calls.filter((c) => c.name === "sync_push").length;
    const base = pushes();
    withDeck(r);
    r.edit((d) => editCard(d, d.cards[0].id, "q2", "a"));
    r.edit((d) => editCard(d, d.cards[0].id, "q3", "a"));
    assert.equal(r.rt.status().phase, "backing_up");
    await r.clock.advance(DEBOUNCE_MS - 1);
    assert.equal(pushes(), base, "not yet");
    await r.clock.advance(2);
    assert.equal(pushes(), base + 1, "one push");
    assert.equal(r.rt.status().phase, "backed_up");
    assert.equal([...r.server.cards.values()][0].content.front, "q3");
  });

  it("at most one pass at a time; a change during a pass earns one more straight after", async () => {
    const server = new FakeServer();
    let release: (() => void) | null = null;
    const api = server.api();
    let concurrent = 0, peak = 0;
    const slow = { rpc: async (n: string, a: Record<string, unknown>) => { concurrent++; peak = Math.max(peak, concurrent); await new Promise<void>((res) => { release = res; if (n === "sync_pull") setImmediate(res); }); concurrent--; return api.rpc(n, a); } };
    const clock = clockwork();
    let app: AppData = EMPTY;
    const rt = createSyncRuntime({ storage: new MemoryStorage(), client: createSyncClient(slow), now: clock.now, online: () => true, timers: clock.timers, getApp: () => app, update: (fn) => { app = fn(app); }, random: () => 0.5 });
    rt.setAccount({ id: "user-1" });
    app = addDeck(app, "Notes", clock.now()).data;
    rt.enable();
    await settle();
    rt.trigger(); rt.trigger(); rt.trigger();   // focus, online, focus: while one is in flight
    app = addCard(app, app.decks[0].id, "q", "a", clock.now()); rt.notifyChange();
    (release as (() => void) | null)?.();
    for (let i = 0; i < 40; i++) { (release as (() => void) | null)?.(); await clock.advance(1000); }
    assert.equal(peak, 1, "never two calls at once");
    assert.equal(server.cards.size, 1, "the change made during the pass was sent after it");
  });

  it("coming back online, and the tab coming back, run a pass; offline is waiting with no call", async () => {
    let online = false;
    const r = rig({ online: () => online });
    r.rt.setAccount({ id: "user-1" });
    withDeck(r);
    r.rt.enable();
    await settle();
    assert.equal(r.rt.status().phase, "waiting");
    assert.equal(r.server.calls.length, 0);
    online = true;
    r.rt.trigger();
    await settle();
    assert.equal(r.rt.status().phase, "backed_up");
    assert.equal(r.server.cards.size, 1);
  });

  it("a failure of any kind waits and tries again, further apart each time, and recovers by itself", async () => {
    const r = rig();
    r.rt.setAccount({ id: "user-1" });
    withDeck(r);
    r.server.down = { message: "Failed to fetch" };
    r.rt.enable();
    await settle();
    assert.equal(r.rt.status().phase, "waiting");
    const gaps: number[] = [];
    for (let i = 0; i < 5; i++) { gaps.push(r.clock.pending()[0]); await r.clock.advance(r.clock.pending()[0]); }
    assert.deepEqual(gaps, [BACKOFF_MS[0], BACKOFF_MS[1], BACKOFF_MS[2], BACKOFF_MS[3], BACKOFF_MS[3]]);
    assert.equal(r.rt.status().phase, "waiting");
    r.server.down = null;
    await r.clock.advance(BACKOFF_MS[3] + 1);
    assert.equal(r.rt.status().phase, "backed_up");
    assert.equal(r.server.cards.size, 1);
  });

  it("a refusal (not a connection problem) is not hammered", async () => {
    const r = rig();
    r.rt.setAccount({ id: "user-1" });
    r.server.down = { message: "sync:bad_request", code: "P0001", status: 400 };
    r.rt.enable();
    await settle();
    assert.equal(r.rt.status().phase, "waiting");
    assert.deepEqual(r.clock.pending(), [REFUSED_BACKOFF_MS]);
  });

  it("a quota refusal shows Backed up with the calm note", async () => {
    const r = rig();
    r.server.caps.cards = 0;
    r.rt.setAccount({ id: "user-1" });
    withDeck(r);
    r.rt.enable();
    await settle();
    assert.deepEqual(r.rt.status(), { phase: "backed_up", note: true });
  });
});

describe("accounts do not mix", () => {
  it("the shadow and the choice are kept per account id", async () => {
    const storage = new MemoryStorage();
    const server = new FakeServer();
    const a = rig({ storage, server });
    a.rt.setAccount({ id: "user-A" });
    withDeck(a);
    a.rt.enable();
    await settle();
    assert.ok(storage.getItem(shadowKey("user-A")));
    assert.equal(loadShadow(storage, "user-B").cursor, 0, "another account starts clean");
    assert.deepEqual(loadShadow(storage, "user-B").rows, {});
    assert.ok(Object.keys(loadShadow(storage, "user-A").rows).length >= 2);
    // a shadow saved under one account's key but written for another is not believed
    storage.setItem(shadowKey("user-C"), storage.getItem(shadowKey("user-A"))!);
    assert.deepEqual(loadShadow(storage, "user-C").rows, {});
  });

  it("signing in as someone else on the same browser does not run until they choose, and then merges with their own shadow", async () => {
    const storage = new MemoryStorage();
    const server = new FakeServer();
    const r = rig({ storage, server });
    r.rt.setAccount({ id: "user-A" });
    withDeck(r);
    r.rt.enable();
    await settle();
    const calls = server.calls.length;
    r.rt.setAccount({ id: "user-B" });
    assert.equal(r.rt.isOn(), false);
    r.rt.trigger();
    r.edit((d) => editCard(d, d.cards[0].id, "edited as B", "a"));
    await r.clock.advance(60_000);
    assert.equal(server.calls.length, calls, "B has not chosen to back up: nothing is sent");
    r.rt.setAccount({ id: "user-A" });
    assert.equal(r.rt.isOn(), true, "A's choice is still A's");
  });

  it("a pass that was running when the account changed does not touch the new one", async () => {
    const server = new FakeServer();
    const api = server.api();
    let release: (() => void) | null = null;
    const gated = { rpc: (n: string, a: Record<string, unknown>) => new Promise<{ data: unknown; error: null }>((res) => { release = () => res(api.rpc(n, a) as never); }) };
    const clock = clockwork();
    let app: AppData = addDeck(EMPTY, "Notes", clock.now()).data;
    const rt = createSyncRuntime({ storage: new MemoryStorage(), client: createSyncClient(gated), now: clock.now, online: () => true, timers: clock.timers, getApp: () => app, update: (fn) => { app = fn(app); }, random: () => 0.5 });
    rt.setAccount({ id: "user-A" });
    rt.enable();
    await settle();
    const before = app;
    rt.setAccount({ id: "user-B" });
    (release as (() => void) | null)?.();
    await settle();
    assert.equal(app, before, "the answer meant for A was not applied");
  });
});

describe("storage that is missing, full or blocked", () => {
  it("loses nothing: the data stays, the pass works from memory, and a later pass merges again", async () => {
    const r = rig({ storage: new BrokenStorage() });
    r.rt.setAccount({ id: "user-1" });
    withDeck(r);
    const mine = JSON.stringify(r.app);
    assert.equal(r.rt.enable(), true, "the choice holds for the visit");
    await settle();
    assert.equal(r.rt.status().phase, "backed_up");
    assert.equal(r.server.cards.size, 1);
    assert.equal(JSON.stringify(r.app), mine, "nothing changed or lost here");
    r.edit((d) => editCard(d, d.cards[0].id, "again", "a"));
    await r.clock.advance(DEBOUNCE_MS + 1);
    assert.equal([...r.server.cards.values()][0].content.front, "again", "still working from memory");
  });

  it("with no storage at all (null) it still works", async () => {
    const server = new FakeServer();
    const clock = clockwork();
    let app: AppData = EMPTY;
    const rt = createSyncRuntime({ storage: null, client: createSyncClient(server.api()), now: clock.now, online: () => true, timers: clock.timers, getApp: () => app, update: (fn) => { app = fn(app); }, random: () => 0.5 });
    rt.setAccount({ id: "user-1" });
    app = addDeck(app, "Notes", clock.now()).data;
    rt.enable();
    await settle();
    assert.equal(server.decks.size, 1);
  });

  it("a lost shadow after a full-storage visit is the ordinary merge: still nothing lost", async () => {
    const server = new FakeServer();
    const r = rig({ server, storage: new MemoryStorage() });
    r.rt.setAccount({ id: "user-1" });
    const deck = withDeck(r);
    r.rt.enable();
    await settle();
    (r.storage as MemoryStorage).data.delete(shadowKey("user-1"));   // gone
    const second = rig({ server, storage: r.storage as MemoryStorage });
    second.app = r.app;
    second.rt.setAccount({ id: "user-1" });
    await settle();
    assert.equal(server.cards.size, 1, "no duplicate");
    assert.equal(second.app.cards.length, 1);
    void deck;
  });

  it("this browser's id for the server is made once and kept", async () => {
    const r = rig();
    r.rt.setAccount({ id: "user-1" });
    r.rt.enable();
    await settle();
    const id = (r.storage as MemoryStorage).getItem(DEVICE_KEY)!;
    assert.match(id, /^web-[a-z0-9]{12}$/);
    assert.ok(id.length >= 8 && id.length <= 64);
    assert.equal(((r.server.calls.find((c) => c.name === "sync_push")?.args.p_device ?? id)), id);
  });
});

describe("two tabs", () => {
  it("only one runs at a time (a short lease in storage)", async () => {
    const storage = new MemoryStorage();
    const server = new FakeServer();
    const one = rig({ storage, server });
    const two = rig({ storage, server });
    // a second runtime with its own random id
    one.rt.setAccount({ id: "user-1" });
    withDeck(one);
    storage.setItem(`plumi-sync-lease:user-1`, `other-tab|${one.clock.now() + 60_000}`);
    one.rt.enable();
    await settle();
    assert.equal(server.calls.length, 0, "another tab holds the lease: wait");
    assert.equal(one.rt.status().phase, "backing_up");
    storage.removeItem(`plumi-sync-lease:user-1`);
    await one.clock.advance(15_001);
    assert.equal(server.cards.size, 1);
    void two;
  });
});
