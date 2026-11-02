/**
 * The visit's lifecycle and sync, against the scripted world: timeouts, one tab at a time, the wrong account, a closing page,
 * back-off, the background, cost, and a clock that is out. Every one of these was measured as a fault before it was fixed
 * (the sync critic's scenarios n1 to n7 and b1 to b7); the numbers are in docs/study/library.md.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanInput } from "../../social/chatRules";
import { failureFor } from "../../social/failure";
import { LOBBY_CAP, focusTag } from "../../social/lobby";
import { noteServerDate, resetServerTime, serverOffsetHint, timedFetch } from "../../social/serverTime";
import { farewellFor, rememberToken } from "./farewell";
import { FakeLibraryWorld, FakeRealtimeHub } from "./fake";
import { browserLease, memoryLeases } from "./lease";
import { LISTEN_BATCH, MAX_LISTEN, watchLobby } from "./lobbyWatch";
import { ServerClock } from "./serverClock";
import {
  AWAY_AFTER_MS, BUSY_WATCHDOG_MS, CHAT_CLOSED_EVERY_MS, HIDDEN_POS_EVERY_MS, LibrarySession, SERVERS_IDLE_EVERY_MS,
  type SessionDeps, type SessionEvent,
} from "./session";

const A = "aaaaaaaa-0000-4000-8000-000000000001", B = "bbbbbbbb-0000-4000-8000-000000000002", C = "cccccccc-0000-4000-8000-000000000003";

function rig() {
  let t = 1_800_000_000_000;
  const clock = { now: () => t, advance: (ms: number) => { t += ms; } };
  const world = new FakeLibraryWorld(clock.now);
  world.add(A, { nickname: "Quiet Otter", display: "Alex", colour: 1 });
  world.add(B, { nickname: "Brave Wren", display: "Bea", colour: 2 });
  world.add(C, { nickname: "Calm Heron", display: "Cal", colour: 3 });
  const hub = new FakeRealtimeHub();
  const make = (me: string, extra: Partial<SessionDeps> = {}) =>
    new LibrarySession({ social: world.social(me), realtime: () => hub.client(me), me, now: clock.now, peopleLiveEveryMs: 5_000, listenGapMs: 0, random: () => 0.5, ...extra });
  /** Runs `seconds` of the beat for every session, one second at a time. */
  const run = async (seconds: number, ...sessions: LibrarySession[]) => {
    for (let i = 0; i < seconds; i++) { clock.advance(1000); for (const s of sessions) await s.tick(); }
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const count = (name: string) => world.calls.filter((c) => c === name).length;
  return { clock, world, hub, make, run, flush, count };
}

/** The session's call timers are unref'd (a pending timeout must not hold a process open), so a test that waits on one keeps the loop alive itself. */
const keepAlive = () => { const t = setInterval(() => {}, 10); return () => clearInterval(t); };

describe("a request that never answers", () => {
  it("is given up on, and the visit carries on (a laptop that slept leaves a half-open connection)", async () => {
    const r = rig();
    const social = r.world.social(A);
    let hang = false, pushes = 0;
    const spy = { ...social, setLobbyPosition: (...x: Parameters<typeof social.setLobbyPosition>) => { pushes++; return hang ? new Promise<never>(() => {}) : social.setLobbyPosition(...x); } };
    const a = r.make(A, { social: spy, callTimeoutMs: 20 });
    const stop = keepAlive();
    await a.start();
    hang = true;
    r.clock.advance(11_000);
    const t0 = Date.now();
    await a.tick();                                    // the push hangs; the beat is not stuck behind it
    assert.ok(Date.now() - t0 < 1000, "the call was given up on");
    hang = false;
    r.clock.advance(4_000);
    const before = pushes;
    await a.tick();
    await a.tick();
    assert.ok(pushes > before, "the next beat asks again");
    assert.equal(a.snapshot().phase, "live");
    stop();
  });

  it("a beat that somehow stays busy is abandoned after the watchdog", async () => {
    const r = rig();
    const social = r.world.social(A);
    let hang = false;
    const spy = { ...social, lobbyPeople: (shard: number) => (hang ? new Promise<never>(() => {}) : social.lobbyPeople(shard)) };
    const a = r.make(A, { social: spy, callTimeoutMs: 10 * 60_000 });          // the per-call timeout is out of the way: only the watchdog is left
    await a.start();
    hang = true;
    r.clock.advance(6_000);
    void a.tick();
    await r.flush();
    hang = false;
    r.clock.advance(6_000); await a.tick();                                    // still busy: nothing happens
    const calls = r.count("lobbyPeople");
    r.clock.advance(BUSY_WATCHDOG_MS); await a.tick(); await r.flush();
    assert.ok(r.count("lobbyPeople") > calls, "the stuck beat was let go and a new one read the list");
  });
});

describe("one tab at a time", () => {
  it("a second tab of the same student does not join, and fights nothing", async () => {
    const r = rig();
    const leases = memoryLeases();
    const t1 = r.make(A, { lease: leases(A) }), t2 = r.make(A, { lease: leases(A) });
    await t1.start();
    const joins = r.count("joinLobby");
    await t2.start();
    assert.equal(t2.snapshot().phase, "elsewhere");
    await r.run(60, t1, t2);
    assert.equal(r.count("joinLobby"), joins, "the second tab never joined, and the first was never told it was out");
    assert.equal(t1.snapshot().phase, "live");
    assert.equal(r.world.students.get(A)!.shard, 1);
    t2.leave();
    assert.equal(r.world.students.get(A)!.shard, 1, "closing the tab that was never in does not take the other out");
  });

  it("another student's tab is not affected", async () => {
    const r = rig();
    const leases = memoryLeases();
    const a = r.make(A, { lease: leases(A) }), b = r.make(B, { lease: leases(B) });
    await a.start(); await b.start();
    assert.equal(a.snapshot().phase, "live");
    assert.equal(b.snapshot().phase, "live");
  });

  it("moving here is deliberate: the other tab stops without a word to the server, and this one goes in", async () => {
    const r = rig();
    const leases = memoryLeases();
    const t1 = r.make(A, { lease: leases(A) }), t2 = r.make(A, { lease: leases(A) });
    await t1.start(); await t2.start();
    const leaves = r.count("leaveLobby");
    await t2.takeOver();
    assert.equal(t2.snapshot().phase, "live");
    assert.equal(t1.snapshot().phase, "elsewhere", "the first tab calmly steps aside");
    assert.equal(r.count("leaveLobby"), leaves, "and does not leave the library: the row is the new tab's");
    await r.run(40, t1, t2);
    assert.equal(r.world.students.get(A)!.shard, 1);
    assert.equal(r.count("joinLobby"), 2, "one join each, then quiet (it was 64 in 45 seconds)");
    t1.leave();
    assert.equal(r.world.students.get(A)!.shard, 1, "the old tab closing later does not take the new one out");
    t2.leave(); await r.flush();
    assert.equal(r.world.students.get(A)!.shard, null);
  });

  it("closing the library tab lets the next one in", async () => {
    const r = rig();
    const leases = memoryLeases();
    const t1 = r.make(A, { lease: leases(A) }), t2 = r.make(A, { lease: leases(A) });
    await t1.start(); await t2.start();
    t1.leave();
    await t2.takeOver();
    assert.equal(t2.snapshot().phase, "live");
  });
});

describe("the web locks lease", () => {
  function fakeLocks() {
    const held = new Map<string, { release: () => void; abort: () => void }>();
    return {
      held,
      request(name: string, options: { ifAvailable?: boolean; steal?: boolean }, cb: (lock: unknown) => unknown): Promise<unknown> {
        const cur = held.get(name);
        if (cur && options.ifAvailable) return Promise.resolve(cb(null));
        let reject!: (e: unknown) => void;
        const done = new Promise<unknown>((res, rej) => { reject = rej; void res; });
        if (cur && options.steal) cur.abort();
        const out = Promise.resolve(cb({ name }));
        const entry = () => held.get(name);
        let finish!: () => void;
        const ended = new Promise<void>((r) => { finish = r; });
        held.set(name, { release: () => { held.delete(name); finish(); }, abort: () => { held.delete(name); reject(new Error("AbortError")); } });
        const mine = held.get(name);
        void out.then(() => { if (held.get(name) === mine) held.delete(name); });
        void entry;
        return Promise.race([done, Promise.resolve(out).then(() => ended)]);
      },
    };
  }
  it("is held by one tab; another is told no; stealing tells the first", async () => {
    const locks = fakeLocks();
    const one = browserLease(A, locks)!, two = browserLease(A, locks)!;
    assert.equal(await one.claim(), true);
    assert.equal(await two.claim(), false);
    let lost = 0;
    one.onLost(() => { lost++; });
    assert.equal(await two.steal(), true);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(lost, 1);
    two.release();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(await one.claim(), true, "free again once released");
  });
  it("is no lease where there are no locks", () => {
    assert.equal(browserLease(A, undefined as never), null);
  });
});

describe("the wrong account", () => {
  it("a visit whose student is no longer the browser's leaves as its own student, not the new one", async () => {
    const r = rig();
    let signedIn: string = A;
    const farewells: string[] = [];
    const a = r.make(A, { current: () => signedIn, farewell: () => { farewells.push(A); return true; } });
    await a.start();
    signedIn = B;                                       // another tab signed in as someone else
    const leaves = r.count("leaveLobby");
    r.clock.advance(11_000);
    await a.tick();
    assert.equal(a.snapshot().phase, "idle", "the visit ended itself");
    assert.deepEqual(farewells, [A], "and left as A, with A's own token");
    assert.equal(r.count("leaveLobby"), leaves, "the ordinary call (which would have been B's) was not made");
    assert.equal(r.count("setLobbyPosition"), 1, "nothing was pushed in anyone's name after the switch (the one is the join's)");
  });

  it("the page leaving after the switch leaves as the captured student", async () => {
    const r = rig();
    const sent: { url: string; init: RequestInit }[] = [];
    rememberToken(A, "token-A"); rememberToken(B, "token-B");     // B signed in last
    const bye = farewellFor(A, { url: "https://x.supabase.co", key: "k", fetch: ((u: string, i: RequestInit) => { sent.push({ url: u, init: i }); return Promise.resolve(new Response("{}")); }) as unknown as typeof fetch });
    let signedIn = A;
    const a = r.make(A, { current: () => signedIn, farewell: bye });
    await a.start();
    signedIn = B;
    a.leave();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, "https://x.supabase.co/rest/v1/rpc/lobby_leave");
    assert.equal((sent[0].init.headers as Record<string, string>).Authorization, "Bearer token-A");
    assert.equal(sent[0].init.keepalive, true);
  });

  it("without a token the ordinary call is the fallback", async () => {
    const r = rig();
    const a = r.make(A, { farewell: farewellFor("dddddddd-0000-4000-8000-000000000009", { url: "u", key: "k", fetch: (() => Promise.resolve(new Response())) as unknown as typeof fetch }) });
    await a.start();
    a.leave(); await r.flush();
    assert.equal(r.world.students.get(A)!.shard, null);
  });
});

describe("leaving", () => {
  it("is asked of the server whenever a join might have reached it, even if the visit never got into the room", async () => {
    const r = rig();
    const social = r.world.social(A);
    const lostAnswer = { ...social, joinLobby: async (...x: Parameters<typeof social.joinLobby>) => { await social.joinLobby(...x); return { ok: false as const, failure: { kind: "offline" as const } }; } };
    const a = r.make(A, { social: lostAnswer });
    await a.start();
    assert.equal(a.snapshot().phase, "unavailable");
    assert.equal(r.world.students.get(A)!.shard, 1, "the server did join them; only the answer was lost");
    a.leave(); await r.flush();
    assert.equal(r.world.students.get(A)!.shard, null, "so leaving takes them out (it was left standing)");
  });

  it("a tab that closes sends the leave at once, and a page that comes back from the cache goes in again", async () => {
    const r = rig();
    const sent: string[] = [];
    const a = r.make(A, { farewell: () => { sent.push("bye"); return true; } });
    await a.start();
    a.pageHidden();
    assert.deepEqual(sent, ["bye"]);
    assert.equal(a.snapshot().phase, "idle");
    a.pageShown(false);
    assert.equal(a.snapshot().phase, "idle", "a page that is not from the cache does not come back by itself");
    a.leave();
    assert.deepEqual(sent, ["bye"], "the unmount after it does not send a second");
    const b = r.make(B);
    await b.start();
    b.pageHidden();
    b.pageShown(true);
    await r.flush(); await r.flush();
    assert.equal(b.snapshot().phase, "live");
    assert.equal(r.world.students.get(B)!.shard, 1);
  });

  it("switching library says so on the old one", async () => {
    const r = rig();
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start(); await r.run(6, a, b);
    const before = r.hub.sent.filter((s) => s.user === A && s.event === "leave").length;
    await a.switchTo(2);
    assert.equal(r.hub.sent.filter((s) => s.user === A && s.event === "leave").length, before + 1);
  });
});

describe("a failing server", () => {
  it("is not asked again every second: the position backs off, and the page says it is catching up", async () => {
    const r = rig();
    const a = r.make(A);
    await a.start();
    r.world.failing.add("setLobbyPosition");
    const base = r.count("setLobbyPosition");
    await r.run(120, a);
    const calls = r.count("setLobbyPosition") - base;
    assert.ok(calls <= 14, `${calls} pushes in 120 s (it was 116)`);
    assert.ok(calls >= 4, "but it does keep trying");
    assert.equal(a.snapshot().online, false);
    assert.equal(a.snapshot().phase, "live", "and nothing else about the page changes");
    r.world.failing.clear();
    await r.run(40, a);
    assert.equal(a.snapshot().online, true);
  });

  it("a busy server (429) is left alone for as long as it said", async () => {
    const f = failureFor({ message: "slow down", status: 429 });
    assert.deepEqual(f, { kind: "unavailable", retryAfterMs: 30_000 });
    const r = rig();
    const social = r.world.social(A);
    let pushes = 0, busy = false;
    const spy = { ...social, setLobbyPosition: (...x: Parameters<typeof social.setLobbyPosition>) => { pushes++; return busy ? Promise.resolve({ ok: false as const, failure: f }) : social.setLobbyPosition(...x); } };
    const a = r.make(A, { social: spy });
    await a.start();
    busy = true;
    pushes = 0;
    await r.run(25, a);
    assert.ok(pushes <= 2, `${pushes} pushes in 25 s`);
  });

  it("a failing join is retried on a growing, jittered gap (up to 30 s), not every ten seconds for ever", async () => {
    const r = rig();
    r.world.failing.add("joinLobby");
    const a = r.make(A);
    await a.start();
    await r.run(300, a);
    assert.ok(r.count("joinLobby") <= 26, `${r.count("joinLobby")} joins in 5 minutes (a fixed ten seconds made 30; the jitter here is its mid-point)`);
    assert.equal(a.snapshot().phase, "unavailable");
    r.world.failing.clear();
    await r.run(80, a);
    assert.equal(a.snapshot().phase, "live");
  });
});

describe("in the background", () => {
  it("a hidden tab sends only a slow heartbeat after a minute, and reads everything when it is seen again", async () => {
    const r = rig();
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start(); await r.run(10, a, b);
    a.visible(false);
    await r.run(60, a, b);
    const mark = r.world.calls.length;
    await r.run(100, a);
    const calls = r.world.calls.slice(mark);
    assert.deepEqual([...new Set(calls)], ["setLobbyPosition"], "only the position");
    assert.ok(calls.length <= Math.ceil(100_000 / HIDDEN_POS_EVERY_MS) + 1, `${calls.length} pushes in 100 s`);
    assert.ok(r.clock.now() - r.world.students.get(A)!.beat < 30_000, "and the server still has them");
    const before = r.world.calls.length;
    a.visible(true);
    await r.flush(); await r.flush();
    const after = r.world.calls.slice(before);
    for (const want of ["setLobbyPosition", "lobbyPeople", "libraryMessages", "lobbyServers"]) assert.ok(after.includes(want), `${want} was read at once`);
  });

  it("hidden for ten minutes, or untouched for ten, ends the visit and offers to rejoin; a running study timer keeps it", async () => {
    const r = rig();
    const a = r.make(A);
    await a.start();
    a.visible(false);
    r.clock.advance(AWAY_AFTER_MS + 1000);
    await a.tick();
    assert.equal(a.snapshot().phase, "away");
    await r.flush();
    assert.equal(r.world.students.get(A)!.shard, null, "they are not left standing in an empty room");
    a.visible(true);
    assert.equal(a.snapshot().phase, "away", "seeing the tab again does not rejoin by itself");
    await a.comeBack();
    assert.equal(a.snapshot().phase, "live");

    const b = r.make(B);
    await b.start();
    r.clock.advance(AWAY_AFTER_MS - 5000);
    b.touch();
    r.clock.advance(AWAY_AFTER_MS - 5000);
    await b.tick();
    assert.equal(b.snapshot().phase, "live", "a touch started the ten minutes again");
    r.clock.advance(10_000);
    await b.tick();
    assert.equal(b.snapshot().phase, "away", "untouched for ten minutes");

    const c = r.make(C);
    await c.start();
    c.followTimer({ subject: "maths", since: r.clock.now() });
    c.visible(false);
    r.clock.advance(AWAY_AFTER_MS * 2);
    await c.tick();
    assert.equal(c.snapshot().phase, "live", "studying: still in the library");
  });
});

describe("what it costs", () => {
  it("reads the chat and the libraries' counts rarely while they are not on screen, and at once when they are", async () => {
    const r = rig();
    const a = r.make(A);
    await a.start();
    a.setPanels({ chat: false, libraries: false });
    await r.run(1, a);
    const chat = r.count("libraryMessages"), servers = r.count("lobbyServers");
    await r.run(60, a);
    assert.ok(r.count("libraryMessages") - chat <= Math.ceil(60_000 / CHAT_CLOSED_EVERY_MS) + 1, `${r.count("libraryMessages") - chat} chat reads in a minute`);
    assert.ok(r.count("lobbyServers") - servers <= Math.ceil(60_000 / SERVERS_IDLE_EVERY_MS) + 1);
    const c0 = r.count("libraryMessages");
    a.setPanels({ chat: true, libraries: true });
    await r.run(1, a);
    assert.equal(r.count("libraryMessages"), c0 + 1, "opening the chat reads it at once");
  });

  it("reads the list every twelve seconds while Realtime is up and every two without it", async () => {
    const r = rig();
    const live = new LibrarySession({ social: r.world.social(A), realtime: () => r.hub.client(A), me: A, now: r.clock.now, listenGapMs: 0 });
    const dead = new LibrarySession({ social: r.world.social(B), me: B, now: r.clock.now });
    await live.start(); await dead.start(); await r.flush();
    assert.equal(live.snapshot().live, true);
    const before = r.world.calls.length;
    await r.run(60, live);
    const liveReads = r.world.calls.slice(before).filter((c) => c === "lobbyPeople").length;
    assert.ok(liveReads >= 4 && liveReads <= 6, `${liveReads} list reads in a minute with Realtime`);
    const mark = r.world.calls.length;
    await r.run(60, dead);
    const deadReads = r.world.calls.slice(mark).filter((c) => c === "lobbyPeople").length;
    assert.ok(deadReads >= 25, `${deadReads} list reads in a minute without Realtime`);
  });

  it("forgets a wave when its sender is gone", async () => {
    const r = rig();
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start(); await r.run(6, a, b);
    await b.emote("wave");
    await r.run(6, a, b);
    const held = () => (a as unknown as { lastEmote: Map<string, number> }).lastEmote.size;
    assert.equal(held(), 1);
    b.leave();
    await r.run(40, a);
    assert.equal(held(), 0);
  });
});

describe("a full library", () => {
  function counting() {
    const hub = new FakeRealtimeHub();
    return { hub, rt: hub.client("me") };
  }
  it("listens to everyone it can hold: 59 others and itself", () => {
    assert.equal(MAX_LISTEN, LOBBY_CAP - 1);
    const { hub, rt } = counting();
    watchLobby(rt, { shard: 1, me: "me", people: Array.from({ length: 80 }, (_, i) => `u${i}`), floorNow: () => null, onSignal: () => {}, listenGapMs: 0 });
    assert.equal(hub.opened.length, 1 + MAX_LISTEN);
  });
  it("joins the topics a few at a time, so a reconnect is not sixty joins in one instant", async () => {
    const { hub, rt } = counting();
    watchLobby(rt, { shard: 1, me: "me", people: Array.from({ length: 40 }, (_, i) => `u${i}`), floorNow: () => null, onSignal: () => {}, listenGapMs: 15 });
    assert.equal(hub.opened.length, 1 + LISTEN_BATCH, "the first batch at once");
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(hub.opened.length, 1 + 40, "the rest within a fraction of a second");
  });
});

describe("a clock that is out", () => {
  it("waves and focus minutes are right for a viewer whose clock is wrong", async () => {
    for (const skew of [0, 8_000, 12_000, -12_000, 5 * 60_000, -5 * 60_000]) {
      const r = rig();
      const a = r.make(A);
      const b = r.make(B, { now: () => r.clock.now() + skew });
      const events: SessionEvent[] = [];
      b.onEvent((e) => events.push(e));
      await a.start(); await b.start();
      a.attachRoom(() => ({ x: 100, y: 100, seat: 4, path: [] })); a.roomChanged();
      a.followTimer({ subject: "maths", since: r.clock.now() - 3 * 60_000 });          // A has been focusing for three minutes
      for (let i = 0; i < 8; i++) { r.clock.advance(1000); await a.tick(); await b.tick(); }
      await a.emote("wave");
      for (let i = 0; i < 6; i++) { r.clock.advance(1000); await a.tick(); await b.tick(); }
      const p = b.snapshot().people.find((x) => x.id === A)!;
      const device = r.clock.now() + skew;
      assert.equal(focusTag(p, device), "Maths · 3 min", `viewer clock ${skew / 1000} s out`);
      assert.ok(events.some((e) => e.type === "emote"), `the wave was seen with the clock ${skew / 1000} s out`);
    }
  });

  it("the student's own focus start goes to the server in the server's time, whatever their clock says", async () => {
    for (const skew of [300_000, -300_000, 3 * 3600_000]) {
      const r = rig();
      const social = r.world.social(A);
      let sent: number | null | undefined;
      const spy = { ...social, setLobbyPosition: (...x: Parameters<typeof social.setLobbyPosition>) => { sent = x[2].focusSince as number | null; return social.setLobbyPosition(...x); } };
      const a = r.make(A, { social: spy, now: () => r.clock.now() + skew, serverOffset: () => -skew });      // the header says the server is `skew` behind this device
      a.attachRoom(() => ({ x: 100, y: 100, seat: 4, path: [] }));
      await a.start(); a.roomChanged();
      a.followTimer({ subject: "maths", since: r.clock.now() + skew - 120_000 });       // two minutes ago by the student's own clock
      await r.run(2, a);
      assert.ok(Math.abs((sent as number) - (r.clock.now() - 120_000)) < 5_000, `skew ${skew / 1000} s: sent ${((r.clock.now() - (sent as number)) / 1000).toFixed(0)} s ago, want 120`);
    }
  });

  it("the header's estimate is used when there is one, and a second out is not a skew", () => {
    const c = new ServerClock(() => 400);
    assert.equal(c.offset(), 0);
    const d = new ServerClock(() => 300_000);
    assert.equal(d.offset(), 300_000);
    assert.equal(d.toDevice(1_000_000), 700_000);
  });

  it("learns the server's clock from the Date header of an answer", () => {
    resetServerTime();
    assert.equal(serverOffsetHint(), null);
    const sent = 1_800_000_000_000;
    noteServerDate(new Date(sent + 300_000).toUTCString(), sent, sent + 100);
    const off = serverOffsetHint()!;
    assert.ok(Math.abs(off - 300_000) <= 1_000, `offset ${off}`);
    resetServerTime();
  });
});

describe("every call to the data API has a timeout", () => {
  it("aborts a request that does not answer, and passes the Date header on", async () => {
    resetServerTime();
    const hung: typeof fetch = (_u, init) => new Promise((_res, rej) => { init?.signal?.addEventListener("abort", () => rej(new Error("AbortError: signal is aborted"))); });
    const f = timedFetch(30, hung);
    const keep = setInterval(() => {}, 10);              // (the abort timer is unref'd, as it must be for Node; something has to keep the test alive)
    await assert.rejects(f("https://x.supabase.co/rest/v1/rpc/lobby_people", {}), /abort/i);
    clearInterval(keep);
    assert.deepEqual(failureFor({ message: "AbortError: signal is aborted" }), { kind: "offline" }, "and the service sees a network failure, not an error");
    const quick = timedFetch(30, (async () => new Response("{}", { headers: { date: new Date().toUTCString() } })) as typeof fetch);
    await quick("https://x.supabase.co/rest/v1/rpc/lobby_people");
    assert.notEqual(serverOffsetHint(), null);
    const slowAuth = timedFetch(30, (async () => { await new Promise((r) => setTimeout(r, 80)); return new Response("{}"); }) as typeof fetch);
    await slowAuth("https://x.supabase.co/auth/v1/token", {});       // took longer than the timeout and was not aborted
    resetServerTime();
  });
});

describe("what a student types", () => {
  it("never sends a NUL, and no more than three combining marks in a row", () => {
    assert.equal(cleanInput("a\u0000b"), "ab");
    assert.equal(cleanInput("a" + "̀".repeat(200)), "à̀̀");
    assert.equal(cleanInput("ạ̈́ x"), "ạ̈́ x", "three marks are kept");
    assert.equal(cleanInput("é é"), "é é");
    assert.equal(cleanInput("lone \ud800 half"), "lone  half");
    assert.equal(cleanInput("naïve café 😀"), "naïve café 😀");
  });
});
