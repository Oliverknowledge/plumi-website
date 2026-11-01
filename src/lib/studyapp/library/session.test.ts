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
