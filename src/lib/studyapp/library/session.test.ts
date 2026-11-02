/**
 * The library visit, driven against a scripted world (fake.ts): a Realtime hub and a server that answers the lobby
 * calls as the real one does. The real server is held to the same flows by scripts/social-e2e.ts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LiveSummary } from "../live";
import { FakeBot, FakeLibraryWorld, FakeRealtimeHub } from "./fake";
import { LIBRARY_TILE, presenceFields, toWire } from "./room";
import { LibrarySession, sendLine, type SessionEvent } from "./session";

const A = "aaaaaaaa-0000-4000-8000-000000000001", B = "bbbbbbbb-0000-4000-8000-000000000002", C = "cccccccc-0000-4000-8000-000000000003";

function rig() {
  let t = 1_800_000_000_000;
  const clock = { now: () => t, advance: (ms: number) => { t += ms; } };
  const world = new FakeLibraryWorld(clock.now);
  world.add(A, { nickname: "Quiet Otter", display: "Alex", colour: 1 });
  world.add(B, { nickname: "Brave Wren", display: "Bea", colour: 2 });
  world.add(C, { nickname: "Calm Heron", display: "Cal", colour: 3 });
  const hub = new FakeRealtimeHub();
  const summaries: Record<string, LiveSummary[]> = { [A]: [], [B]: [], [C]: [] };
  const events: Record<string, SessionEvent[]> = { [A]: [], [B]: [], [C]: [] };
  const floors: Record<string, () => ReturnType<typeof presenceFields> | null> = {};
  const make = (me: string, realtime = true) => {
    const s = new LibrarySession({ social: world.social(me), realtime: realtime ? () => hub.client(me) : undefined, me, now: clock.now, publish: (x) => summaries[me].push(x) });
    s.onEvent((e) => events[me].push(e));
    return s;
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { clock, world, hub, make, summaries, events, flush, floors };
}

describe("coming in", () => {
  it("puts two students in the same library, each shown to the other as the server shows them", async () => {
    const r = rig();
    r.world.befriend(A, B);
    const a = r.make(A), b = r.make(B), c = r.make(C);
    await a.start(); await b.start(); await c.start();
    assert.equal(a.snapshot().shard, 1);
    assert.equal(b.snapshot().shard, 1);
    assert.equal(c.snapshot().shard, 1);
    await a.tick();
    r.clock.advance(6000);
    await a.tick(); await b.tick(); await c.tick();
    const seenByA = a.snapshot().people;
    assert.deepEqual(seenByA.map((p) => [p.isFriend, p.displayName, p.nickname]).sort(), [[false, null, "Calm Heron"], [true, "Bea", "Brave Wren"]].sort());
    assert.deepEqual(c.snapshot().people.map((p) => [p.displayName, p.nickname]).sort(), [[null, "Brave Wren"], [null, "Quiet Otter"]].sort(), "a stranger sees only nicknames");
    assert.equal(a.snapshot().people[0].isFriend, true, "friends first");
    assert.ok(a.snapshot().people.every((p) => p.id !== A), "you are never in your own list");
  });

  it("sends the library's own tile, the iPad's, to the server", async () => {
    const r = rig();
    let joined: unknown = null, positioned: unknown = null;
    const social = r.world.social(A);
    const spy = { ...social, joinLobby: (tile: { x: number; y: number }, want?: number | null) => { joined = tile; return social.joinLobby(tile, want); }, setLobbyPosition: (...x: Parameters<typeof social.setLobbyPosition>) => { positioned = x[1]; return social.setLobbyPosition(...x); } };
    const a = new LibrarySession({ social: spy, me: A, now: r.clock.now });
    await a.start();
    assert.deepEqual(joined, LIBRARY_TILE);
    assert.deepEqual(positioned, LIBRARY_TILE);
    assert.deepEqual(LIBRARY_TILE, { x: 65, y: 34 });
  });

  it("with the server unreachable shows nothing wrong and tries again on the beat", async () => {
    const r = rig();
    r.world.failing.add("joinLobby");
    const a = r.make(A);
    await a.start();
    assert.equal(a.snapshot().phase, "unavailable");
    r.world.failing.clear();
    r.clock.advance(11_000);
    await a.tick();
    assert.equal(a.snapshot().phase, "live");
  });

  it("a hidden student is told so, neither sees nor is seen, and joins again when shown", async () => {
    const r = rig();
    r.world.students.get(B)!.visible = false;
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start();
    assert.equal(b.snapshot().phase, "hidden");
    assert.equal(b.snapshot().shard, null);
    r.clock.advance(6000);
    await a.tick();
    assert.deepEqual(a.snapshot().people, [], "a hidden student is not shown to others");
    await b.tick();
    assert.deepEqual(b.snapshot().people, [], "and sees no one");
    await b.setVisible(true);
    assert.equal(b.snapshot().phase, "live");
    r.clock.advance(6000);
    await a.tick();
    assert.equal(a.snapshot().people.length, 1);
    await a.setVisible(false);
    assert.equal(a.snapshot().phase, "hidden");
    assert.equal(a.snapshot().people.length, 0);
  });

  it("joins again when the server says it no longer has you (a stale row cleared)", async () => {
    const r = rig();
    const a = r.make(A);
    await a.start();
    r.world.students.get(A)!.shard = null;
    r.clock.advance(11_000);
    await a.tick();
    await a.tick();
    r.clock.advance(11_000);
    await a.tick();
    assert.equal(a.snapshot().phase, "live");
    assert.equal(r.world.students.get(A)!.shard, a.snapshot().shard);
  });

  it("leaving in the middle of coming in asks nothing more of the library you left", async () => {
    const r = rig();
    const calls: string[] = [];
    const social = r.world.social(A);
    const visit: { a?: LibrarySession } = {};
    const spy = {
      ...social,
      setLobbyPosition: (...x: Parameters<typeof social.setLobbyPosition>) => { calls.push("setLobbyPosition"); const p = social.setLobbyPosition(...x); visit.a!.leave(); return p; },
      lobbyPeople: (...x: Parameters<typeof social.lobbyPeople>) => { calls.push("lobbyPeople"); return social.lobbyPeople(...x); },
      libraryMessages: (...x: Parameters<typeof social.libraryMessages>) => { calls.push("libraryMessages"); return social.libraryMessages(...x); },
      lobbyServers: () => { calls.push("lobbyServers"); return social.lobbyServers(); },
    };
    const a = (visit.a = new LibrarySession({ social: spy, me: A, now: r.clock.now }));
    await a.start();
    await r.flush();
    assert.deepEqual(calls, ["setLobbyPosition"], "after the first step of coming in, leaving stopped the rest");
    assert.equal(a.snapshot().phase, "idle");
  });

  it("leaving takes you out of the lobby", async () => {
    const r = rig();
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start();
    a.leave();
    assert.equal(a.snapshot().phase, "idle");
    await r.flush();
    assert.equal(r.world.students.get(A)!.shard, null);
    r.clock.advance(6000);
    await b.tick();
    assert.deepEqual(b.snapshot().people, []);
  });
});

describe("what you are doing", () => {
  it("sitting and timing reach the others: seated, the subject, and how long (Physics · 3 min)", async () => {
    const r = rig();
    const a = r.make(A), b = r.make(B);
    let floor: Parameters<typeof presenceFields>[0] | null = { x: 100, y: 100, seat: null, path: [] };
    a.attachRoom(() => floor);
    await a.start(); await b.start();
    floor = { x: 728, y: 708, seat: 9, path: [] };
    a.roomChanged();
    assert.equal(a.snapshot().seated, true);
    a.startFocus("physics");
    await a.tick();
    for (let i = 0; i < 18; i++) { r.clock.advance(10_000); await a.tick(); await b.tick(); }   // three minutes, both of you beating
    r.clock.advance(2000);
    await a.tick(); await b.tick();
    const p = b.snapshot().people[0];
    assert.equal(p.seated, true);
    assert.equal(p.subjectId, "physics");
    assert.deepEqual(b.describe(p.id), { name: "Quiet Otter", tag: "Physics · 3 min", friend: false, pro: false });
    floor = { x: 100, y: 100, seat: null, path: [] };
    a.roomChanged();
    assert.equal(a.snapshot().seated, false);
    assert.equal(a.snapshot().focusSince, null, "standing up ends the timer");
    assert.equal(a.snapshot().subject, null);
  });

  it("keeps your seat and your timer when you move to another library", async () => {
    const r = rig();
    const a = r.make(A);
    a.attachRoom(() => ({ x: 728, y: 708, seat: 9, path: [] }));
    await a.start();
    a.roomChanged();
    a.startFocus("physics");
    await a.switchTo(2);
    assert.equal(a.snapshot().shard, 2);
    assert.deepEqual([a.snapshot().seated, a.snapshot().subject, a.snapshot().focusSince !== null], [true, "physics", true]);
    const row = r.world.students.get(A)!;
    assert.deepEqual([row.shard, row.seated, row.subject], [2, true, "physics"], "and the new library is told");
  });

  it("a timer needs a seat", async () => {
    const r = rig();
    const a = r.make(A);
    a.attachRoom(() => ({ x: 1, y: 1, seat: null, path: [] }));
    await a.start();
    a.startFocus("maths");
    assert.equal(a.snapshot().focusSince, null);
  });

  describe("when the study timer drives the focus", () => {
    const MIN = 60_000;
    type Floor = { x: number; y: number; seat: number | null; path: [number, number][] };
    async function seated(floorRef: { f: Floor }) {
      const r = rig();
      const a = r.make(A), b = r.make(B);
      a.attachRoom(() => floorRef.f);
      await a.start(); await b.start();
      return { r, a, b };
    }
    const SEAT: Floor = { x: 728, y: 708, seat: 9, path: [] };
    const STAND: Floor = { x: 100, y: 100, seat: null, path: [] };

    it("work running while seated is focusing since the work began, and others see the minutes", async () => {
      const floor: { f: Floor } = { f: SEAT };
      const { r, a, b } = await seated(floor);
      a.roomChanged();
      const since = r.clock.now() - 12 * MIN;                      // the work phase began twelve minutes ago
      a.followTimer({ subject: "physics", since });
      assert.deepEqual([a.snapshot().seated, a.snapshot().subject, a.snapshot().focusSince], [true, "physics", since]);
      await a.tick();
      r.clock.advance(6000); await b.tick();
      const p = b.snapshot().people[0];
      assert.equal(p.focusSince, since);
      assert.equal(b.describe(p.id)?.tag, "Physics · 12 min");
    });

    it("paused, on a break or stopped is not focusing, and the server is told", async () => {
      const floor: { f: Floor } = { f: SEAT };
      const { r, a } = await seated(floor);
      a.roomChanged();
      a.followTimer({ subject: "maths", since: r.clock.now() });
      await a.tick();
      a.followTimer(null);                                          // a break began
      assert.equal(a.snapshot().focusSince, null);
      assert.equal(a.snapshot().seated, true, "still sitting");
      await a.tick();
      assert.equal(r.world.students.get(A)!.focusSince, null);
      const resumed = r.clock.now() - 3 * MIN;
      a.followTimer({ subject: "maths", since: resumed });          // back to work
      await a.tick();
      assert.equal(r.world.students.get(A)!.focusSince, resumed);
    });

    it("standing up stops publishing but not the timer: sitting again resumes the focus", async () => {
      const floor: { f: Floor } = { f: SEAT };
      const { r, a } = await seated(floor);
      a.roomChanged();
      const since = r.clock.now() - 5 * MIN;
      a.followTimer({ subject: "chemistry", since });
      floor.f = STAND; a.roomChanged();
      assert.deepEqual([a.snapshot().seated, a.snapshot().focusSince, a.snapshot().subject], [false, null, null]);
      a.followTimer({ subject: "chemistry", since });               // the timer carries on and says the same
      assert.equal(a.snapshot().focusSince, null, "nothing is published while you stand");
      floor.f = SEAT; a.roomChanged();
      assert.deepEqual([a.snapshot().seated, a.snapshot().subject, a.snapshot().focusSince], [true, "chemistry", since]);
      void r;
    });

    it("a timer that began before you sat is picked up when you do, and one that ended while you stood is not", async () => {
      const floor: { f: Floor } = { f: STAND };
      const { r, a } = await seated(floor);
      a.followTimer({ subject: "biology", since: r.clock.now() - MIN });
      assert.equal(a.snapshot().focusSince, null);
      floor.f = SEAT; a.roomChanged();
      assert.equal(a.snapshot().subject, "biology");
      floor.f = STAND; a.roomChanged();
      a.followTimer(null);
      floor.f = SEAT; a.roomChanged();
      assert.equal(a.snapshot().focusSince, null);
    });

    it("keeps following when you move to another library", async () => {
      const floor: { f: Floor } = { f: SEAT };
      const { r, a } = await seated(floor);
      a.roomChanged();
      const since = r.clock.now() - 2 * MIN;
      a.followTimer({ subject: "physics", since });
      await a.switchTo(2);
      assert.equal(a.snapshot().focusSince, since);
      assert.equal(r.world.students.get(A)!.shard, 2);
    });

    it("saying the same thing again changes nothing and tells nobody", async () => {
      const floor: { f: Floor } = { f: SEAT };
      const { r, a } = await seated(floor);
      a.roomChanged();
      const f = { subject: "maths", since: r.clock.now() - MIN };
      a.followTimer(f);
      let heard = 0;
      a.subscribe(() => { heard++; });
      a.followTimer({ ...f });
      a.followTimer({ ...f });
      assert.equal(heard, 0);
    });
  });

  it("an emote shows over your head and is rate limited quietly", async () => {
    const r = rig();
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start();
    await a.emote("wave");
    assert.deepEqual(r.events[A], [{ type: "emote", id: "you", kind: "wave" }]);
    await a.emote("high_five");
    assert.deepEqual(r.events[A].at(-1), { type: "notice", text: "One at a time" });
    r.clock.advance(5500);
    await b.tick();
    assert.deepEqual(r.events[B].filter((e) => e.type === "emote"), [{ type: "emote", id: A, kind: "wave" }], "the other student sees it once");
    r.clock.advance(2500);
    await b.tick();
    assert.equal(r.events[B].filter((e) => e.type === "emote").length, 1, "and not again on the next read");
  });
});

describe("the floor in real time", () => {
  it("speaks the iPad's topics, privately, with presence enabled on your own", async () => {
    const r = rig();
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start();
    r.clock.advance(6000);
    await a.tick(); await b.tick();
    const mine = r.hub.opened.filter((o) => o.user === A);
    assert.ok(mine.some((o) => o.topic === `walk:lobby-1:${A}` && o.presenceKey === A && o.presenceEnabled === true), "your own topic, presence keyed by your id");
    assert.ok(mine.some((o) => o.topic === `walk:lobby-1:${B}`), "and everyone else's");
    assert.ok(r.hub.opened.every((o) => o.private), "every channel is private");
    assert.ok(r.hub.opened.every((o) => /^walk:lobby-[1-9]\d{0,5}:[0-9a-f-]{36}$/.test(o.topic)), "walk:lobby-<shard>:<lower case id>");
  });

  it("carries where you stand beside the library's tile, and where others stand arrives in art pixels", async () => {
    const r = rig();
    const a = r.make(A), b = r.make(B);
    let me: Parameters<typeof presenceFields>[0] | null = { x: 944, y: 1248, seat: null, path: [] };
    a.attachRoom(() => me);
    await a.start(); await b.start();
    await r.flush();
    a.roomChanged();
    r.clock.advance(6000);
    await b.tick();
    await r.flush();
    const sent = r.hub.sent.filter((s) => s.user === A && s.event === "move").at(-1)!;
    assert.deepEqual(sent.payload, { x: 65, y: 34, lx: 944, ly: 1248 });
    assert.equal(sent.topic, `walk:lobby-1:${A}`);
    const rem = b.remotes().find((x) => x.id === A)!;
    assert.deepEqual(rem.pos, [472, 624], "room points over two");
    assert.equal(rem.seat, null);
    me = { x: 728, y: 708, seat: 9, path: [[740, 700]] };
    a.roomChanged();
    r.clock.advance(150);
    a.roomChanged();
    await r.flush();
    const next = b.remotes().find((x) => x.id === A)!;
    assert.equal(next.seat, 9);
    assert.deepEqual(next.path, [[370, 350]]);
    assert.equal(next.seated, true);
  });

  it("does not send faster than every 100 ms, and sends what is left on the next beat", async () => {
    const r = rig();
    const a = r.make(A);
    let n = 0;
    a.attachRoom(() => ({ x: ++n * 2, y: 5, seat: null, path: [] }));
    await a.start();
    await r.flush();
    const before = r.hub.sent.filter((s) => s.user === A).length;
    a.roomChanged(); a.roomChanged(); a.roomChanged();
    assert.ok(r.hub.sent.filter((s) => s.user === A).length - before <= 1, "three changes in the same instant are one message at most");
    r.clock.advance(1000);
    await a.tick();
    assert.ok(r.hub.sent.filter((s) => s.user === A).length - before >= 1, "the change that had to wait went on the next beat");
  });

  it("sends your place again every ten seconds while you stand still", async () => {
    const r = rig();
    const a = r.make(A);
    a.attachRoom(() => ({ x: 4, y: 4, seat: null, path: [] }));
    await a.start();
    await r.flush();
    const base = r.hub.sent.filter((s) => s.user === A && s.event === "move").length;
    for (let i = 0; i < 25; i++) { r.clock.advance(1000); await a.tick(); }
    const resent = r.hub.sent.filter((s) => s.user === A && s.event === "move").length - base;
    assert.ok(resent >= 2 && resent <= 3, `resent ${resent} times in 25 s`);
  });

  it("hears a student on an iPad (lx, ly, ls) and a student who left", async () => {
    const r = rig();
    const b = r.make(B);
    await b.start();
    // a student on an iPad, scripted: in the shard, and speaking on her topic
    r.world.add(C, { nickname: "Calm Heron", display: "Cal" });
    r.world.place(C, 1);
    await b.tick();
    r.clock.advance(6000);
    await b.tick();
    await r.flush();
    const bot = new FakeBot(r.hub.client(C), C, 1, `walk:lobby-1:${C}`);
    bot.at({ x: 758, y: 288, seat: 1, path: [] });
    const got = b.remotes().find((x) => x.id === C)!;
    assert.equal(got.seat, 1);
    assert.deepEqual(got.pos, [379, 144]);
    bot.leave();
    assert.equal(b.remotes().find((x) => x.id === C), undefined, "left: gone at once, though the server lists them for 30 s more");
  });

  it("numbers each piece of floor news once, so the room does not restart a walk every time the list is read", async () => {
    const r = rig();
    const a = r.make(A);
    r.world.add(C, { nickname: "Calm Heron", display: "Cal" });
    r.world.place(C, 1);
    await a.start();
    r.clock.advance(6000); await a.tick(); await r.flush();
    const bot = new FakeBot(r.hub.client(C), C, 1, `walk:lobby-1:${C}`);
    bot.at({ x: 100, y: 100, seat: null, path: [[300, 100]] });
    const first = a.remotes()[0];
    r.clock.advance(6000);
    r.world.place(C, 1);
    await a.tick();
    assert.equal(a.remotes()[0].rev, first.rev, "reading the list again is not news");
    assert.ok(first.rev > 0);
    bot.at({ x: 200, y: 100, seat: null, path: [] });
    assert.ok(a.remotes()[0].rev > first.rev, "a new step is");
  });

  it("a student with no floor news is still in the room, for the room to seat (an older app, or no socket)", async () => {
    const r = rig();
    const a = r.make(A, false);
    r.world.add(C, { nickname: "Calm Heron", display: "Cal" });
    r.world.place(C, 1, { seated: true });
    await a.start();
    r.clock.advance(6000);
    await a.tick();
    const rem = a.remotes();
    assert.equal(rem.length, 1);
    assert.deepEqual([rem[0].pos, rem[0].seat, rem[0].seated], [null, null, true]);
  });

  it("ignores floor news that is older than 45 seconds", async () => {
    const r = rig();
    const a = r.make(A);
    r.world.add(C, { nickname: "Calm Heron", display: "Cal" });
    r.world.place(C, 1);
    await a.start();
    r.clock.advance(6000); await a.tick(); await r.flush();
    const bot = new FakeBot(r.hub.client(C), C, 1, `walk:lobby-1:${C}`);
    bot.at({ x: 200, y: 200, seat: null, path: [] });
    assert.ok(a.remotes()[0].pos);
    r.clock.advance(46_000);
    r.world.place(C, 1);
    assert.equal(a.remotes()[0].pos, null);
  });
});

describe("library servers", () => {
  it("lists them with counts, switches to another, and keeps you out of the old one's list", async () => {
    const r = rig();
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start();
    await a.refreshServers();
    assert.deepEqual(a.snapshot().servers!.servers, [{ shard: 1, here: 2, friends: 0 }]);
    assert.equal(a.snapshot().servers!.empty, 2);
    await b.switchTo(2);
    assert.equal(b.snapshot().shard, 2);
    assert.deepEqual(b.snapshot().people, []);
    r.clock.advance(6000);
    await a.tick();
    assert.deepEqual(a.snapshot().people, []);
    assert.ok(r.hub.opened.some((o) => o.user === B && o.topic === `walk:lobby-2:${B}`), "listens in the new library");
  });

  it("says so when the library you chose is full and puts you in another", async () => {
    const r = rig();
    for (let i = 0; i < 60; i++) { const id = `dddddddd-0000-4000-8000-${String(i).padStart(12, "0")}`; r.world.add(id, { nickname: "Kind Fox", display: `S${i}` }); r.world.place(id, 7); }
    const a = r.make(A);
    await a.start();
    await a.switchTo(7);
    assert.notEqual(a.snapshot().shard, 7);
    assert.deepEqual(r.events[A].filter((e) => e.type === "notice").at(-1), { type: "notice", text: "That library is full, so you’re in another" });
  });

  it("publishes what it knows for the Desk and the Study tab, and never a number it does not have", async () => {
    const r = rig();
    r.world.befriend(A, B);
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start();
    for (let i = 0; i < 3; i++) { r.clock.advance(10_000); await a.tick(); await b.tick(); }
    const last = r.summaries[A].at(-1)!;
    assert.equal(last.state, "ready");
    assert.equal(last.revising, 2);
    assert.deepEqual(last.friendsIn, [{ id: B, name: "Bea", colour: 2 }]);
    assert.equal(r.summaries[A].find((x) => x.revising === null)?.state, "ready", "before the servers were read, revising was null, not a guess");
  });
});

describe("the chat", () => {
  it("sends and reads: you and the other student see the same room, with nicknames for strangers and names for friends", async () => {
    const r = rig();
    r.world.befriend(A, B);
    const a = r.make(A), b = r.make(B), c = r.make(C);
    await a.start(); await b.start(); await c.start();
    assert.deepEqual(await a.send("  anyone doing q3? "), { ok: true });
    r.clock.advance(4500);
    await b.tick(); await c.tick();
    assert.deepEqual(b.snapshot().messages.map((m) => [m.name, m.body]), [["Alex", "anyone doing q3?"]], "a friend by real name");
    assert.deepEqual(c.snapshot().messages.map((m) => [m.name, m.body]), [["Quiet Otter", "anyone doing q3?"]], "a stranger by nickname");
    assert.deepEqual(a.snapshot().messages.map((m) => m.body), ["anyone doing q3?"]);
  });

  it("refuses in the student's words: links, swearing, spam, shouting, saying it again, going too fast", async () => {
    const r = rig();
    const a = r.make(A);
    await a.start();
    const say = async (s: string) => { const x = await a.send(s); r.clock.advance(4000); return x; };
    assert.deepEqual(await say("add me on snapchat"), { ok: false, line: "No links or contact details" });
    assert.deepEqual(await say("fuck this"), { ok: false, line: "No swearing, please" });
    assert.deepEqual(await say("hahahahaha"), { ok: false, line: "That looks like spam. Say something real" });
    assert.deepEqual(await say("WHY IS NOBODY ANSWERING ME"), { ok: false, line: "Easy on the capitals" });
    assert.deepEqual(await say(""), { ok: false, line: "Write something first" });
    assert.deepEqual(await say("x".repeat(281)), { ok: false, line: "Keep it under 280 characters" });
    assert.deepEqual(await say("good luck with the maths paper"), { ok: true });
    assert.deepEqual(await say("Good Luck with the Maths Paper"), { ok: false, line: "You already said that" });
    const first = await a.send("second one");
    const quick = await a.send("third one");
    assert.deepEqual([first.ok, quick], [true, { ok: false, line: "Slow down a little" }]);
    for (const line of [sendLine({ kind: "unavailable" }), sendLine({ kind: "offline" }), sendLine({ kind: "refused", reason: "other" })]) assert.doesNotMatch(line, /message_|social:|error|failed/i);
  });

  it("holds the last good list when a read fails, and brings back what was missed", async () => {
    const r = rig();
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start();
    await a.send("hello there");
    r.clock.advance(4500);
    await b.tick();
    assert.equal(b.snapshot().messages.length, 1);
    r.world.failing.add("libraryMessages");
    await a.send("while you were away").catch(() => {});
    r.world.say(A, 1, "a message you will miss");
    r.clock.advance(4500);
    await b.tick();
    assert.equal(b.snapshot().messages.length, 1, "kept, not blanked");
    r.world.failing.clear();
    r.clock.advance(4500);
    await b.tick();
    assert.ok(b.snapshot().messages.some((m) => m.body === "a message you will miss"));
  });

  it("reports and blocks: the message and then the sender go from your screen at once; two reports hide it for everyone", async () => {
    const r = rig();
    const a = r.make(A), b = r.make(B), c = r.make(C);
    await a.start(); await b.start(); await c.start();
    await a.send("be mean to people");   // allowed by the filter; a report is for what the filter cannot know
    r.clock.advance(4500);
    await b.tick(); await c.tick();
    const m = b.snapshot().messages[0];
    await b.reportMessage(m, "bullying", false);
    assert.equal(b.snapshot().messages.length, 0);
    assert.deepEqual(r.events[B].at(-1), { type: "notice", text: "Reported. Thanks for telling us" });
    assert.equal(c.snapshot().messages.length, 1, "one report hides it only from the reporter");
    await c.reportMessage(c.snapshot().messages[0], "bullying", true);
    assert.deepEqual(r.events[C].at(-1), { type: "notice", text: "Reported and blocked" });
    assert.deepEqual(c.snapshot().people.filter((p) => p.id === A), [], "a blocked sender is gone from the list");
    r.clock.advance(4500);
    await b.tick();
    assert.equal(b.snapshot().messages.length, 0);
    assert.equal(r.world.messages[0].hidden, true, "two distinct reporters hide it");
    await a.reportMessage(a.snapshot().messages[0] ?? m, "other", false);
    assert.equal(r.world.reports.filter((x) => x.by === A).length, 0, "you cannot report yourself");
  });

  it("reports and blocks a person from their card", async () => {
    const r = rig();
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start();
    r.clock.advance(6000);
    await a.tick();
    await a.reportPerson(B, "name");
    assert.deepEqual(r.events[A].at(-1), { type: "notice", text: "Reported. Thanks for telling us" });
    assert.deepEqual(r.world.userReports, [{ user: B, by: A, reason: "name" }]);
    await a.blockPerson(B);
    assert.deepEqual(a.snapshot().people, []);
    assert.deepEqual(a.remotes(), []);
    r.clock.advance(6000);
    await a.tick(); await b.tick();
    assert.deepEqual(a.snapshot().people, [], "the server stops listing them either way");
    assert.deepEqual(b.snapshot().people, []);
  });
});

describe("a student never sees an error", () => {
  it("every failure of a read keeps what was last good, and a write says one short line", async () => {
    const r = rig();
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start();
    r.clock.advance(6000); await a.tick();
    assert.equal(a.snapshot().people.length, 1);
    for (const name of ["lobbyPeople", "lobbyServers", "libraryMessages", "setLobbyPosition"]) r.world.failing.add(name);
    r.clock.advance(11_000);
    await a.tick();
    assert.equal(a.snapshot().people.length, 1);
    assert.equal(a.snapshot().phase, "live");
    r.world.failing.add("lobbyEmote");
    await a.emote("wave");
    const line = r.events[A].filter((e) => e.type === "notice").at(-1);
    assert.ok(line && line.type === "notice" && !/error|failed|social:|undefined/i.test(line.text));
    r.world.failing.add("sendLibraryMessage");
    const sent = await a.send("hello");
    assert.ok(!sent.ok && !/error|failed|social:/i.test(sent.line));
  });

  it("toWire is the same as the wire's rounding", () => {
    assert.deepEqual(toWire([472.4, 624.5]), [945, 1249]);
  });
});

/* ── The friends list ──────────────────────────────────────────────────── */

const D = "dddddddd-0000-4000-8000-000000000004", E = "eeeeeeee-0000-4000-8000-000000000005", F = "ffffffff-0000-4000-8000-000000000006";

/** A world for the friends list: Bea is a friend and in this library, Dev is a friend studying elsewhere, Eve is a friend who is nowhere, Cal is a stranger here. */
function friendsRig() {
  const r = rig();
  r.world.add(D, { nickname: "Wise Hare", display: "Dev", colour: 4, streak: 6 });
  r.world.add(E, { nickname: "Keen Lynx", display: "Eve", colour: 5, streak: 0 });
  r.world.add(F, { nickname: "Gentle Panda", display: "Fiona Realname", colour: 6, streak: 3 });
  r.world.students.get(B)!.streak = 9;
  r.world.befriend(A, B); r.world.befriend(A, D); r.world.befriend(A, E);
  r.world.studying(D, "maths", 30);
  return r;
}
const names = (s: LibrarySession) => (s.snapshot().friends ?? []).map((f) => f.name);

describe("the friends list", () => {
  it("is null until the first read has been answered, and all friends are there once it is", async () => {
    const r = friendsRig();
    const a = r.make(A);
    assert.equal(a.snapshot().friends, null);
    await a.start();
    assert.deepEqual(names(a), ["Dev", "Bea", "Eve"], "nobody is in this library yet: studying elsewhere (Dev), then the rest by name");
    assert.deepEqual(a.snapshot().requests, []);
    const b = r.make(B);
    await b.start();
    r.clock.advance(6000); await a.tick();
    assert.deepEqual(names(a), ["Bea", "Dev", "Eve"], "Bea walks in: in this library first, then studying elsewhere, then the rest");
  });

  it("marks a friend who is in this library and carries their live status; a friend elsewhere carries their presence", async () => {
    const r = friendsRig();
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start();
    r.clock.advance(6000);
    await a.tick();
    const [bea, dev, eve] = a.snapshot().friends!;
    assert.equal(bea.here?.id, B);
    assert.equal(bea.here?.seated, false);
    assert.equal(bea.streak, 9);
    assert.deepEqual(dev.elsewhere, { subjectId: "maths", phase: "work" });
    assert.equal(dev.here, null);
    assert.equal(eve.here, null);
    assert.equal(eve.elsewhere, null, "nothing is invented for a friend with no presence");
    assert.equal(eve.streak, null);
    // Bea sits down and starts a timer: the friend's row follows the room, not the friends read
    b.roomChanged();
    r.world.place(B, 1, { seated: true, subject: "chemistry", focusSince: r.clock.now() - 24 * 60_000 });
    r.clock.advance(6000);
    await a.tick();
    const now = a.snapshot().friends![0].here!;
    assert.deepEqual([now.seated, now.subjectId, Math.round((r.clock.now() - now.focusSince!) / 60_000)], [true, "chemistry", 24]);
  });

  it("is joined by id: a stranger in the room is not a friend, and a friend is not listed twice", async () => {
    const r = friendsRig();
    const a = r.make(A), c = r.make(C);
    await a.start(); await c.start();
    r.clock.advance(6000); await a.tick();
    assert.deepEqual(names(a), ["Dev", "Bea", "Eve"]);
    assert.ok(!names(a).includes("Cal"));
    assert.ok(!JSON.stringify(a.snapshot().friends).includes(C), "Cal is only in the room");
  });

  it("reads on joining, not again when you switch library, again after a minute, and at once when asked", async () => {
    const r = friendsRig();
    const a = r.make(A);
    const count = () => r.world.calls.filter((c) => c === "loadFriends").length;
    await a.start();
    assert.equal(count(), 1);
    await a.switchTo(2);
    assert.equal(count(), 1, "switching library does not ask again");
    r.clock.advance(30_000); await a.tick();
    assert.equal(count(), 1);
    r.clock.advance(31_000); await a.tick();
    assert.equal(count(), 2, "every minute while the visit is live");
    r.clock.advance(5000);
    await a.refreshFriends();
    assert.equal(count(), 3, "at once when the People tab opens");
    await a.refreshFriends();
    assert.equal(count(), 3, "but a tab tapped on and off is not a read each time");
    r.clock.advance(5000);
    const p1 = a.refreshFriends(), p2 = a.refreshFriends();
    await Promise.all([p1, p2]);
    assert.equal(count(), 4, "two asks while one is on its way share it");
  });

  it("keeps the last good list when a read fails, and says nothing", async () => {
    const r = friendsRig();
    const a = r.make(A);
    await a.start();
    const before = a.snapshot().friends;
    r.world.failing.add("loadFriends"); r.world.failing.add("lobbyFriendRequests");
    r.clock.advance(5000);
    const reads = r.world.calls.filter((c) => c === "loadFriends").length;
    await a.refreshFriends();
    assert.equal(r.world.calls.filter((c) => c === "loadFriends").length, reads + 1, "it did ask, and it failed");
    assert.deepEqual(a.snapshot().friends, before);
    assert.equal(a.snapshot().phase, "live");
    assert.ok(!r.events[A].some((e) => e.type === "notice"), "no line for a failed read");
    r.world.failing.clear();
    r.world.befriend(A, C);
    r.clock.advance(5000);
    await a.refreshFriends();
    assert.ok(names(a).includes("Cal"), "and the next good read is used");
  });

  it("when the first read cannot be answered, the friends in the room are still there (by the name the server gave) and nothing else", async () => {
    const r = friendsRig();
    r.world.failing.add("loadFriends");
    const a = r.make(A), b = r.make(B);
    await b.start(); await a.start();
    r.clock.advance(6000); await a.tick();
    assert.deepEqual(names(a), ["Bea"]);
    r.world.failing.clear();
    await a.refreshFriends();
    assert.deepEqual(names(a), ["Bea", "Dev", "Eve"]);
  });

  it("never lists someone you block, in the room or out of it, now or after the next read", async () => {
    const r = friendsRig();
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start();
    r.clock.advance(6000); await a.tick();
    await a.blockPerson(B);
    assert.ok(!names(a).includes("Bea"));
    await a.refreshFriends();
    r.clock.advance(6000); await a.tick();
    assert.ok(!names(a).includes("Bea"));
    assert.ok(!JSON.stringify(a.snapshot()).includes("Bea"));
  });

  it("removing a friend takes them off the list at once and their name off the room, behind a read", async () => {
    const r = friendsRig();
    const a = r.make(A), b = r.make(B);
    await a.start(); await b.start();
    r.clock.advance(6000); await a.tick();
    assert.equal(a.snapshot().people.find((p) => p.id === B)?.displayName, "Bea");
    const out = await a.removeFriend(B);
    assert.deepEqual(out, { ok: true, line: "Friend removed" });
    assert.ok(!names(a).includes("Bea"));
    const p = a.snapshot().people.find((x) => x.id === B)!;
    assert.deepEqual([p.isFriend, p.displayName], [false, null], "a stranger is a nickname again");
    await r.flush();
    assert.ok(!names(a).includes("Bea"), "and the read behind it agrees");
    assert.ok(!r.world.students.get(B)!.friends.has(A), "on the server too");
  });

  it("a failed removal keeps the friend and says one plain line", async () => {
    const r = friendsRig();
    const a = r.make(A);
    await a.start();
    r.world.failing.add("removeFriend");
    const out = await a.removeFriend(D);
    assert.equal(out.ok, false);
    assert.ok(!/error|failed|social:/i.test(out.line));
    assert.ok(names(a).includes("Dev"));
  });
});

describe("requests waiting on you", () => {
  it("lists an ordinary request by name and a library request by nickname only, never the real name", async () => {
    const r = friendsRig();
    r.world.plainAsk(C, A);                              // Cal typed Alex's friend code
    r.world.libraryAsk(F, A);                            // Fiona asked in the library (not in the room)
    const a = r.make(A);
    await a.start();
    const list = a.snapshot().requests;
    assert.deepEqual(list.map((q) => [q.name, q.fromLibrary]).sort(), [["Cal", false], ["Gentle Panda", true]]);
    assert.ok(!JSON.stringify(a.snapshot()).includes("Fiona"), "the sender's real name is nowhere in what the page holds");
    assert.ok(!JSON.stringify(a.snapshot()).includes("Realname"));
  });

  it("Accept makes them a friend and the request goes at once; Not now clears it and they are not a friend", async () => {
    const r = friendsRig();
    r.world.libraryAsk(F, A); r.world.plainAsk(C, A);
    const a = r.make(A);
    await a.start();
    const yes = await a.answerRequest(F, true);
    assert.deepEqual(yes, { ok: true, line: "You’re friends now" });
    assert.deepEqual(a.snapshot().requests.map((q) => q.name), ["Cal"]);
    await r.flush(); await r.flush();
    assert.ok(names(a).includes("Fiona Realname"), "after accepting, the real name is shared: that is the moment, by their choice");
    const no = await a.answerRequest(C, false);
    assert.deepEqual(no, { ok: true, line: "Okay, not now" });
    assert.deepEqual(a.snapshot().requests, []);
    await r.flush(); await r.flush();
    assert.ok(!names(a).includes("Cal"));
    assert.ok(!r.world.students.get(A)!.friends.has(C));
  });

  it("a failed answer keeps the request and says one plain line", async () => {
    const r = friendsRig();
    r.world.libraryAsk(F, A);
    const a = r.make(A);
    await a.start();
    r.world.failing.add("respondToFriendRequest");
    const out = await a.answerRequest(F, true);
    assert.equal(out.ok, false);
    assert.ok(!/error|failed|social:/i.test(out.line));
    assert.equal(a.snapshot().requests.length, 1);
  });

  it("when the server has no library requests yet (before 0125) the list is just the ordinary ones, and nothing breaks", async () => {
    const r = friendsRig();
    r.world.plainAsk(C, A); r.world.libraryAsk(F, A);
    r.world.failing.add("lobbyFriendRequests");
    const a = r.make(A);
    await a.start();
    assert.deepEqual(a.snapshot().requests.map((q) => q.name), ["Cal"]);
    assert.deepEqual(names(a), ["Dev", "Bea", "Eve"], "the friends are unaffected");
  });

  it("asking back to someone's library request is accepting it: they become a friend and the request goes", async () => {
    const r = friendsRig();
    const a = r.make(A), c = r.make(C);
    await a.start(); await c.start();
    r.world.libraryAsk(C, A);
    r.clock.advance(6000); await a.tick();
    await a.refreshFriends();
    assert.equal(a.snapshot().requests.length, 1);
    const out = await a.addFriend(C);
    assert.equal(out.outcome, "now_friends");
    await r.flush(); await r.flush();
    assert.deepEqual(a.snapshot().requests, []);
    assert.ok(names(a).includes("Cal"));
  });
});

describe("what the friends list may ask and show", () => {
  it("asks only for friends and requests: nothing about anyone who is not a friend or in the room", async () => {
    const r = friendsRig();
    r.world.libraryAsk(F, A);
    const a = r.make(A);
    await a.start(); r.clock.advance(5000); await a.refreshFriends(); await a.refreshFriends(true);
    const allowed = new Set(["joinLobby", "setLobbyPosition", "lobbyPeople", "libraryMessages", "lobbyServers", "loadFriends", "lobbyFriendRequests"]);
    assert.deepEqual([...new Set(r.world.calls)].filter((c) => !allowed.has(c)), []);
  });

  it("never holds a stranger's real name or a friend code, whoever they are and wherever they are", async () => {
    const r = friendsRig();
    r.world.libraryAsk(F, A);
    const a = r.make(A), c = r.make(C);
    await a.start(); await c.start();
    r.clock.advance(6000); await a.tick();
    const text = JSON.stringify(a.snapshot());
    assert.ok(!text.includes("Fiona") && !text.includes("Realname"));
    assert.ok(!/"[A-Z0-9]{4}-[A-Z0-9]{4}"/.test(text), "no friend code anywhere");
    assert.ok(text.includes("Calm Heron"), "Cal in the room is a nickname");
    assert.ok(!text.includes('"Cal"'), "and never a name");
  });

  it("the friends list only ever contains accepted friends (a pending request is not one)", async () => {
    const r = friendsRig();
    r.world.plainAsk(C, A); r.world.libraryAsk(F, A);
    const a = r.make(A);
    await a.start();
    for (const f of a.snapshot().friends!) assert.ok(r.world.students.get(A)!.friends.has(f.id), `${f.name} is accepted`);
    assert.ok(!names(a).includes("Cal") && !names(a).includes("Fiona Realname"));
  });

  it("leaving the library stops the reads", async () => {
    const r = friendsRig();
    const a = r.make(A);
    await a.start();
    a.leave();
    r.clock.advance(120_000);
    await a.tick();
    await a.refreshFriends();
    assert.equal(r.world.calls.filter((c) => c === "loadFriends").length, 1);
  });
});
