/**
 * The friends list's pure parts: who is a friend, who is here, who is studying elsewhere, the order, the lines, and the
 * privacy rules (a library request is only a nickname; a blocked person is never listed).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LobbyFriendRequest, LobbyPerson } from "../../social/lobby";
import type { FriendRequest, SocialPerson } from "../../social/types";
import { buildFriends, buildRequests, friendStatus, friendsCount, friendsFromRoom, inHeldOrder, keepSame, liveStreak, freshPresence, streakWords } from "./friends";

const NOW = Date.parse("2026-11-01T12:00:00Z");
const iso = (t: number) => new Date(t).toISOString();
const none = new Set<string>();

const friend = (id: string, name: string, o: Partial<SocialPerson> = {}): SocialPerson => ({ id, displayName: name, colour: 1, avatar: null, ...o });
const presence = (subjectId: string, minutes: number, phase: "work" | "break" = "work") => ({ subjectId, mode: "timer" as const, phase, startedAt: iso(NOW - 60_000), endsAt: null, expiresAt: iso(NOW + minutes * 60_000) });
const summary = (streak: number, streakDay: string | null) => ({ day: "2026-11-01", todaySeconds: 0, weekSeconds: 0, weekXp: 0, level: 3, streak, streakDay, updatedAt: null });
const room = (id: string, o: Partial<LobbyPerson> = {}): LobbyPerson => ({
  id, nickname: "Quiet Otter", displayName: null, isFriend: false, colour: 2, avatar: null, x: 65, y: 34, seated: false, subjectId: null, focusSince: null,
  streak: 0, level: 1, groups: [], emote: null, emoteAt: null, updatedAt: NOW, pro: false, ...o,
});
const ask = (id: string, direction: "incoming" | "outgoing", name: string | null, at = NOW): FriendRequest => ({
  otherUserId: id, direction, person: name ? friend(id, name) : null, createdAt: iso(at),
});
const libAsk = (userId: string, direction: "incoming" | "outgoing", nickname: string, createdAt = NOW): LobbyFriendRequest => ({ userId, direction, nickname, colour: 3, avatar: null, streak: 2, level: 4, createdAt });

describe("a day streak is only shown while it can be alive", () => {
  it("counts today and yesterday, not older, not unknown, not zero", () => {
    assert.equal(liveStreak(summary(5, "2026-11-01"), NOW), 5);
    assert.equal(liveStreak(summary(5, "2026-10-31"), NOW), 5);
    assert.equal(liveStreak(summary(5, "2026-10-30"), NOW), null, "two days ago: it has lapsed");
    assert.equal(liveStreak(summary(5, null), NOW), null);
    assert.equal(liveStreak(summary(0, "2026-11-01"), NOW), null);
    assert.equal(liveStreak(undefined, NOW), null);
  });
  it("says 1 day and N days", () => { assert.equal(streakWords(1), "1 day"); assert.equal(streakWords(12), "12 days"); });
});

describe("presence", () => {
  it("is believed only while it has an end that is still ahead", () => {
    assert.deepEqual(freshPresence(presence("maths", 10), NOW), { subjectId: "maths", phase: "work" });
    assert.equal(freshPresence(presence("maths", -1), NOW), null, "ended");
    assert.equal(freshPresence({ ...presence("maths", 10), expiresAt: null }, NOW), null, "no end: not believed");
    assert.equal(freshPresence({ ...presence("maths", 10), expiresAt: "soon" }, NOW), null);
    assert.equal(freshPresence(undefined, NOW), null);
  });
});

describe("the friends list", () => {
  const raw = [
    friend("c3", "Cleo", { summary: summary(7, "2026-11-01") }),
    friend("a1", "Ava"),
    friend("d4", "dev", { presence: presence("maths", 20) }),
    friend("b2", "Ben", { presence: presence("physics", 20) }),
    friend("e5", "Eli", { presence: presence("maths", -5) }),
  ];
  it("lists every friend: in this library first, then studying elsewhere, then the rest, each by name", () => {
    const people = [room("c3", { isFriend: true, displayName: "Cleo", seated: true, subjectId: "chemistry", focusSince: NOW - 24 * 60_000, streak: 9 }), room("zz")];
    const list = buildFriends(raw, people, none, NOW);
    assert.deepEqual(list.map((f) => f.name), ["Cleo", "Ben", "dev", "Ava", "Eli"]);
    assert.deepEqual(list.map((f) => [f.here !== null, f.elsewhere?.subjectId ?? null]), [[true, null], [false, "physics"], [false, "maths"], [false, null], [false, null]]);
    assert.equal(list[0].streak, 9, "a friend in the room carries the room's streak");
    assert.equal(list.find((f) => f.id === "e5")!.elsewhere, null, "an ended presence says nothing");
  });
  it("joins by id whatever the case, and never lists a stranger from the room", () => {
    const list = buildFriends([friend("AbC", "Abe")], [room("abc", { seated: true }), room("stranger")], none, NOW);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, "abc");
    assert.equal(list[0].here?.id, "abc");
    assert.ok(!JSON.stringify(list).includes("stranger"));
  });
  it("never lists someone you blocked, and lists a friend once", () => {
    const list = buildFriends([friend("a1", "Ava"), friend("a1", "Ava again"), friend("b2", "Ben")], [], new Set(["b2"]), NOW);
    assert.deepEqual(list.map((f) => f.name), ["Ava"]);
  });
  it("says what the room says for a friend here, and nothing for anyone it does not know", () => {
    const list = buildFriends(raw, [
      room("a1", { isFriend: true, displayName: "Ava", seated: true, subjectId: "chemistry", focusSince: NOW - 24 * 60_000 }),
      room("b2", { isFriend: true, displayName: "Ben", seated: true }),
      room("c3", { isFriend: true, displayName: "Cleo", seated: false }),
    ], none, NOW);
    const say = Object.fromEntries(list.map((f) => [f.name, friendStatus(f, NOW)]));
    assert.deepEqual(say, {
      Ava: "In this library, Chemistry · 24 min", Ben: "In this library, sitting", Cleo: "In this library, standing", dev: "Studying Maths now", Eli: null,
    });
  });
  it("has a line for a break and for a subject it does not know, and none for a friend with nothing fresh", () => {
    const list = buildFriends([friend("a", "A", { presence: presence("maths", 5, "break") }), friend("b", "B", { presence: presence("underwater-basketry", 5) }), friend("c", "C")], [], none, NOW);
    assert.deepEqual(list.map((f) => friendStatus(f, NOW)), ["On a break", "Studying now", null]);
  });
  it("counts how many are in this library", () => {
    const list = buildFriends(raw, [room("a1", { isFriend: true, displayName: "Ava" })], none, NOW);
    assert.equal(friendsCount(list), "1 of 5 in this library");
    assert.equal(friendsCount(buildFriends(raw, [], none, NOW)), "5 friends");
    assert.equal(friendsCount(buildFriends([friend("a", "A")], [], none, NOW)), "1 friend");
  });
  it("falls back to the friends the room itself marks, by the name it gave", () => {
    const list = friendsFromRoom([room("a", { isFriend: true, displayName: "Ava" }), room("b", { isFriend: false, displayName: "Real Name" }), room("c", { isFriend: true, displayName: null })], none);
    assert.deepEqual(list.map((f) => f.name), ["Ava"]);
    assert.ok(!JSON.stringify(list).includes("Real Name"));
  });
  it("is stable: the same input is the same order", () => {
    const a = buildFriends(raw, [], none, NOW).map((f) => f.id), b = buildFriends([...raw].reverse(), [], none, NOW).map((f) => f.id);
    assert.deepEqual(a, b);
  });
});

describe("requests", () => {
  it("shows a library request as its nickname only, and an ordinary one by name", () => {
    const list = buildRequests([ask("o1", "incoming", "Dana", NOW - 5000)], [libAsk("l1", "incoming", "Gentle Panda", NOW - 1000)], none, none, NOW);
    assert.deepEqual(list.map((r) => [r.name, r.fromLibrary]), [["Gentle Panda", true], ["Dana", false]], "newest first");
  });
  it("lets the library's version win when the same person is in both lists, so no real name rides in", () => {
    const list = buildRequests([ask("L1", "incoming", "Real Name Here")], [libAsk("l1", "incoming", "Gentle Panda")], none, none, NOW);
    assert.deepEqual(list.map((r) => r.name), ["Gentle Panda"]);
    assert.ok(!JSON.stringify(list).includes("Real Name Here"));
  });
  it("drops outgoing requests, requests from friends or blocked people, and an ordinary request whose person could not be read", () => {
    const list = buildRequests(
      [ask("o1", "outgoing", "Out"), ask("o2", "incoming", null), ask("o3", "incoming", "Friend"), ask("o4", "incoming", "Blocked"), ask("o5", "incoming", "Fine")],
      [libAsk("l1", "outgoing", "Quiet Otter"), libAsk("l2", "incoming", "Kind Seal")], new Set(["o3"]), new Set(["o4"]), NOW);
    assert.deepEqual(list.map((r) => r.name).sort(), ["Fine", "Kind Seal"]);
  });
  it("a library request carries a nickname, a look and a streak, and nothing else", () => {
    const [r] = buildRequests([], [libAsk("l1", "incoming", "Gentle Panda")], none, none, NOW);
    assert.deepEqual(Object.keys(r).sort(), ["avatar", "colour", "fromLibrary", "id", "name", "streak"]);
  });
});

describe("a list that does not move under a finger", () => {
  const row = (id: string) => ({ id });
  it("keeps the order it was held in, drops those gone and puts new ones last", () => {
    const now = [row("c"), row("a"), row("d"), row("b")];
    assert.deepEqual(inHeldOrder(now, ["a", "b", "x", "c"]).map((x) => x.id), ["a", "b", "c", "d"]);
    assert.deepEqual(inHeldOrder(now, null).map((x) => x.id), ["c", "a", "d", "b"]);
  });
  it("keepSame hands back the very same rows when nothing changed", () => {
    const prev = [{ id: "a", n: 1 }, { id: "b", n: 2 }];
    const same = keepSame(prev, [{ id: "a", n: 1 }, { id: "b", n: 2 }]);
    assert.equal(same, prev);
    const next = keepSame(prev, [{ id: "a", n: 1 }, { id: "b", n: 3 }]);
    assert.notEqual(next, prev);
    assert.equal(next[0], prev[0], "the unchanged row is the same object");
    assert.equal(next[1].n, 3);
  });
});
