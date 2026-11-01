/**
 * npm run library:test   (node:test via tsx)
 *
 * The lobby and the library chat on the web client: the rules about what a student may be shown (the iPad's
 * LobbyTypes.swift), the spam filter's mirror (held to the real server function by `npm run social:fuzz-library`,
 * and here by hand-made cases), and the service's calls with exactly the RPC and argument names the iPad uses.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RPC, type Api } from "./api";
import { askLine, failureFor, studentFacing } from "./failure";
import * as spam from "./librarySpam";
import {
  EMOTE_TITLE, LOBBY_ASK_OUTCOMES, LOBBY_CAP, canAsk, SEAT_SUBJECTS, byMessageTime, emoteLine, emoteOf, focusClock, focusMinutes, focusTag, listPeople, listedServers, lobbyDecode, lobbyHall,
  mergeMessages, sanitised, shardOfHall, shownName, subjectName, totalHere, type LibraryMessage, type LobbyPerson, type LobbyServers,
} from "./lobby";
import { createSocial } from "./service";

const T = Date.parse("2026-11-01T12:00:00Z");
const person = (o: Partial<LobbyPerson> = {}): LobbyPerson => ({
  id: "u1", nickname: "Quiet Otter", displayName: null, isFriend: false, colour: 0, avatar: null, x: 65, y: 34, seated: false, subjectId: null,
  focusSince: null, streak: 0, level: 0, groups: [], emote: null, emoteAt: null, updatedAt: T, pro: false, ...o,
});

describe("what a stranger may be shown (LobbyRules)", () => {
  it("drops a stranger's display name, even if a server ever sent one, and keeps a friend's", () => {
    assert.equal(sanitised(person({ displayName: "Real Name" })).displayName, null);
    assert.equal(sanitised(person({ isFriend: true, displayName: "Maya" })).displayName, "Maya");
    assert.equal(shownName(person({ isFriend: true, displayName: "Maya" })), "Maya");
    assert.equal(shownName(person({ isFriend: true, displayName: null })), "Quiet Otter");
    assert.equal(shownName(sanitised(person({ displayName: "Real Name" }))), "Quiet Otter");
  });
  it("turns a nickname that is not two plain words into Someone, and drops a subject it does not know", () => {
    for (const n of ["quiet otter", "Quiet", "Quiet Otter Fox", "Quiet  Otter", "Quiet Otter1", "Hannah Smith's", ""]) {
      if (n === "Hannah Smith's" || n === "Quiet Otter1" || n === "quiet otter" || n === "Quiet" || n === "Quiet Otter Fox" || n === "Quiet  Otter" || n === "") assert.equal(sanitised(person({ nickname: n })).nickname, "Someone", n);
    }
    assert.equal(sanitised(person({ nickname: "Brave Wren" })).nickname, "Brave Wren");
    assert.equal(sanitised(person({ seated: true, subjectId: "whatever" })).subjectId, null);
    assert.equal(sanitised(person({ seated: true, subjectId: "Physics" })).subjectId, "Physics");
  });
  it("forgets the focus start of someone not seated", () => {
    assert.equal(sanitised(person({ seated: false, focusSince: T - 60_000 })).focusSince, null);
    assert.equal(sanitised(person({ seated: true, focusSince: T - 60_000 })).focusSince, T - 60_000);
  });
  it("tags a head \"Physics · 12 min\" while timing, and nothing otherwise", () => {
    const p = person({ seated: true, subjectId: "physics", focusSince: T - 12 * 60_000 - 5000 });
    assert.equal(focusMinutes(p, T), 12);
    assert.equal(focusTag(p, T), "Physics · 12 min");
    assert.equal(focusTag(person({ seated: true, subjectId: null, focusSince: T - 120_000 }), T), "2 min");
    assert.equal(focusTag(person({ seated: false, subjectId: "physics", focusSince: T - 120_000 }), T), null);
    assert.equal(focusTag(person({ seated: true, subjectId: "physics" }), T), null, "seated but not timing");
    assert.equal(focusTag(person({ seated: true, subjectId: "physics", focusSince: T + 90_000 }), T), null, "a start in the future is not believed");
    assert.equal(focusTag(person({ seated: true, subjectId: "physics", focusSince: T + 30_000 }), T), "Physics · 0 min", "a clock a little fast counts as just started");
  });
  it("shows a wave for ten seconds, either side of the clocks", () => {
    const p = person({ emote: "wave", emoteAt: T - 4000 });
    assert.equal(emoteOf(p, T), "wave");
    assert.equal(emoteOf(p, T + 7000), null);
    assert.equal(emoteOf(person({ emote: "wave", emoteAt: T + 4000 }), T), "wave");
    assert.equal(emoteOf(person(), T), null);
  });
  it("lists friends first, then the rest by name, stably", () => {
    const l = listPeople([person({ id: "c", nickname: "Calm Heron" }), person({ id: "a", nickname: "Brave Wren", isFriend: true, displayName: "Zed" }), person({ id: "b", nickname: "Amber Fox" }), person({ id: "d", nickname: "Calm Heron" })]);
    assert.deepEqual(l.map((p) => p.id), ["a", "b", "c", "d"]);
  });
  it("knows the subjects the server stores and offers five on the seat card", () => {
    assert.equal(subjectName("Maths"), "Maths");
    assert.equal(subjectName("further-maths"), "Further Maths");
    assert.equal(subjectName("basket-weaving"), null);
    assert.deepEqual(SEAT_SUBJECTS.map((s) => s.label), ["Maths", "Physics", "Chemistry", "Biology", "Other"]);
    for (const s of SEAT_SUBJECTS) if (s.id) assert.ok(subjectName(s.id), s.id);
  });
  it("counts a timer as the app does", () => {
    assert.equal(focusClock(0), "0:00");
    assert.equal(focusClock(65), "1:05");
    assert.equal(focusClock(3599), "59:59");
    assert.equal(focusClock(3600), "1 h 00 min");
    assert.equal(focusClock(3725), "1 h 02 min");
    assert.equal(focusClock(-4), "0:00");
  });
  it("keeps the library's hall key as the realtime topics name it", () => {
    assert.equal(lobbyHall(3), "lobby-3");
    assert.equal(shardOfHall("lobby-3"), 3);
    assert.equal(shardOfHall("lobby-0"), null);
    assert.equal(shardOfHall("lobby-1000000"), null);
    assert.equal(shardOfHall("friends"), null);
    assert.equal(LOBBY_CAP, 60);
    assert.deepEqual(Object.values(EMOTE_TITLE), ["Wave", "High five"]);
  });
});

describe("the library servers picker", () => {
  const S = (o: Partial<LobbyServers>): LobbyServers => ({ cap: 60, you: null, empty: null, max: 300, servers: [], ...o });
  it("keeps emptied libraries in their place, adds yours and one to open, and never passes the ceiling", () => {
    const l = listedServers(S({ you: 4, empty: 2, servers: [{ shard: 1, here: 23, friends: 2 }, { shard: 3, here: 5, friends: 0 }] }));
    assert.deepEqual(l.map((x) => [x.shard, x.here]), [[1, 23], [2, 0], [3, 5], [4, 0]]);
    assert.deepEqual(listedServers(S({ you: 301, servers: [{ shard: 301, here: 1, friends: 0 }] })), []);
    assert.deepEqual(listedServers(S({ servers: [] })), []);
    assert.deepEqual(listedServers(S({ servers: [{ shard: 2, here: 1, friends: 0 }] })).map((x) => x.shard), [2, 3], "an empty one after the last when the server names none");
  });
  it("totals who is in every library", () => {
    assert.equal(totalHere(S({ servers: [{ shard: 1, here: 23, friends: 0 }, { shard: 2, here: 4, friends: 0 }] })), 27);
    assert.equal(totalHere(S({})), 0);
  });
  it("decodes the server's answer, and refuses nonsense", () => {
    const d = lobbyDecode.servers({ cap: 60, you: 2, empty: 5, max: 300, servers: [{ shard: 1, here: 12, friends: 1 }, { shard: "x" }, null, { shard: 2, here: "3", friends: 0 }] })!;
    assert.deepEqual(d.servers, [{ shard: 1, here: 12, friends: 1 }, { shard: 2, here: 3, friends: 0 }]);
    assert.equal(d.you, 2); assert.equal(d.empty, 5);
    assert.equal(lobbyDecode.servers("no"), null);
    assert.equal(lobbyDecode.servers([]), null);
  });
});

describe("decoding lobby_people", () => {
  it("reads a row as the server returns it", () => {
    const row = {
      user_id: "AAAA-1", nickname: "Quiet Otter", display_name: null, is_friend: false, colour: 5, avatar: { pro: "1", hat: "cap", n: 3 }, x: 65, y: 34, seated: true,
      subject_id: "physics", focus_since: "2026-11-01T11:48:00Z", streak: 4, level: 7, groups: [{ id: "g", name: "The Sigmas", emblem: 2 }, { name: "x" }], emote: "wave",
      emote_at: "2026-11-01T11:59:58Z", updated_at: "2026-11-01T11:59:59Z",
    };
    const p = lobbyDecode.person(row)!;
    assert.equal(p.id, "aaaa-1");
    assert.deepEqual([p.seated, p.subjectId, p.streak, p.level, p.pro, p.emote], [true, "physics", 4, 7, true, "wave"]);
    assert.deepEqual(p.groups, [{ id: "g", name: "The Sigmas", emblem: 2 }]);
    assert.deepEqual(p.avatar, { pro: "1", hat: "cap" }, "only strings are kept");
    assert.equal(p.focusSince, Date.parse("2026-11-01T11:48:00Z"));
    assert.equal(lobbyDecode.person({ nickname: "x" }), null);
    assert.equal(lobbyDecode.person({ user_id: "u" }), null);
    assert.equal(lobbyDecode.person({ user_id: "u", nickname: "A B", emote: "dance", emote_at: "2026-11-01T11:59:58Z" })!.emote, null, "an emote the server does not have");
  });
  it("reads a joined library, a hidden student and an emote outcome", () => {
    assert.deepEqual(lobbyDecode.join({ shard: 3, nickname: "Quiet Otter", visible: true, cap: 60, wanted_full: true }), { shard: 3, nickname: "Quiet Otter", visible: true, cap: 60, wantedFull: true });
    assert.deepEqual(lobbyDecode.join({ shard: null, nickname: "Quiet Otter", visible: false, cap: 60 }), { shard: null, nickname: "Quiet Otter", visible: false, cap: 60, wantedFull: false });
    assert.equal(lobbyDecode.join({ shard: 3 }), null);
    assert.equal(lobbyDecode.emote("sent"), "sent");
    assert.equal(lobbyDecode.emote("too_soon"), "too_soon");
    assert.equal(lobbyDecode.emote(null), "not_in_lobby");
    assert.equal(emoteLine("sent"), null);
    assert.match(emoteLine("rate_limited")!, /plenty/);
  });
  it("reads a chat message, with the Pro tag, and merges lists by id, newest 100, oldest first", () => {
    const m = lobbyDecode.message({ id: 12, sender: "AB", nickname: "Kind Fox", body: "hi", created_at: "2026-11-01T12:00:00Z", hidden: false, pro: true })!;
    assert.deepEqual([m.id, m.senderId, m.name, m.pro], ["12", "ab", "Kind Fox", true]);
    assert.equal(lobbyDecode.message({ id: 1, body: "x" }), null);
    const mk = (id: number, at: number, body = "b"): LibraryMessage => ({ id: String(id), shard: 1, senderId: "s", name: "N", body, createdAt: at, hidden: false, pro: false });
    const merged = mergeMessages([mk(1, 10), mk(2, 20)], [mk(2, 20, "edited"), mk(3, 15)], { replacing: false });
    assert.deepEqual(merged.map((x) => [x.id, x.body]), [["1", "b"], ["3", "b"], ["2", "edited"]]);
    assert.deepEqual(mergeMessages([mk(1, 10)], [mk(9, 5)], { replacing: true }).map((x) => x.id), ["9"], "a full read drops what the server no longer returns");
    const many = Array.from({ length: 130 }, (_, i) => mk(i + 1, i));
    assert.equal(mergeMessages([], many, { replacing: true }).length, 100);
    assert.equal(mergeMessages([], many, { replacing: true })[0].id, "31");
    assert.ok(byMessageTime(mk(1, 5), mk(2, 5)) < 0, "ties by id");
  });
});

describe("the library chat's spam rule (librarySpam.ts, a mirror of public.library_spam)", () => {
  const verdict = (s: string, recent: spam.Said[] = [], now = T) => { const v = spam.check(s, recent, now); return v.ok ? "ok" : v.refusal; };
  it("refuses what 0120 and 0123 describe", () => {
    assert.equal(verdict("aaaaaa"), "spam");
    assert.equal(verdict("aaaaa"), "ok");
    assert.equal(verdict("?????!!!!!"), "spam");
    assert.equal(verdict("hahahahaha"), "spam");
    // 0120's comment lists "no no no no", but the rule `(.{2,6})\1{3,}` needs the run four times AFTER its first
    // occurrence: the real server answers null for four "no" and spam for five (checked against library_spam).
    assert.equal(verdict("no no no no"), "ok");
    assert.equal(verdict("no no no no no"), "spam");
    assert.equal(verdict("no no no"), "ok");
    assert.equal(verdict("lolololol"), "spam");
    assert.equal(verdict("asdfghjkl"), "spam");
    assert.equal(verdict("qwertyui"), "spam");
    assert.equal(verdict("zxcvbnm"), "spam");
    assert.equal(verdict("bcdfghjk"), "spam", "eight letters with no vowel");
    assert.equal(verdict("rhythms"), "ok", "seven letters is a word");
    assert.equal(verdict("strengths"), "ok", "nine letters, but it has an e");
    assert.equal(verdict("\u{1F600}\u{1F600}\u{1F600}\u{1F600}\u{1F600}\u{1F600}\u{1F600}\u{1F600}\u{1F600}"), "spam");
    assert.equal(verdict("!!!!!!!!!"), "spam");
    assert.equal(verdict("THIS IS ABSOLUTELY FINE"), "shouting");
    assert.equal(verdict("This Is Absolutely Fine"), "ok");
    assert.equal(verdict("WHY SO LOUD"), "ok", "eleven letters is not twelve");
  });
  it("lets a sentence in any script through (0123: decided by what is LEFT once symbols and emoji are taken out)", () => {
    for (const s of ["今天一起复习物理吧", "هل أحد يراجع الفيزياء", "क्या कोई भौतिकी पढ़ रहा है", "ใครอ่านฟิสิกส์บ้าง"]) assert.equal(verdict(s), "ok", s);
  });
  it("leaves the pace and the mute to the server, and checks repeats the way the server does (last five, last five minutes, folded)", () => {
    const said = (body: string, ago: number) => ({ body, at: T - ago });
    assert.equal(verdict("good luck", [said("Good Luck", 60_000)]), "repeat");
    assert.equal(verdict("good luck", [said("good luck", 301_000)]), "ok");
    const six = ["a1", "a2", "a3", "a4", "a5", "good luck"].map((b, i) => said(b, 10_000 * (6 - i)));
    assert.equal(verdict("good luck", six.slice(0, 5).concat(said("zz", 1000))), "ok", "it was sixth back");
    assert.equal(verdict("good luck", six), "repeat");
    assert.equal(spam.repeats("x", [], T), false);
  });
  it("checks the chat rules first, in the server's order: a link is a link before it is spam", () => {
    assert.equal(verdict("www.example.com"), "link");
    assert.equal(verdict("fuck fuck fuck fuck"), "language");
    assert.equal(verdict("   "), "empty");
    assert.equal(verdict("a".repeat(300)), "too_long");
  });
  it("never names a rule", () => {
    for (const r of ["empty", "too_long", "link", "language", "spam", "shouting", "repeat"] as const) assert.doesNotMatch(spam.refusalLine(r), /spam filter|rule|regex|library_|code/i);
  });
});

/* A fake transport, as in social.test.ts */
function fake(rpc: Record<string, unknown> = {}, raise: Record<string, string> = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const api: Api = {
    configured: true,
    userId: () => "me",
    async rpc(name, args = {}) {
      calls.push({ name, args });
      if (raise[name]) return { data: null, error: { message: raise[name] } };
      return { data: rpc[name] ?? null, error: null };
    },
    async select() { return { data: [], error: null }; },
  };
  return { calls, social: createSocial(api) };
}

describe("the service's lobby calls", () => {
  it("call each function with the iPad's RPC name and argument names", async () => {
    const f = fake({
      lobby_join: { shard: 2, nickname: "Quiet Otter", visible: true, cap: 60, wanted_full: false }, lobby_servers: { cap: 60, you: 2, servers: [] }, lobby_set_position: "ok",
      lobby_people: [], lobby_emote: "sent", library_messages: [], send_library_message: { id: 1, shard: 2, sender: "me", nickname: "Quiet Otter", body: "hi", created_at: "2026-11-01T12:00:00Z", pro: false },
      lobby_me: { nickname: "Quiet Otter", visible: true }, regenerate_nickname: { status: "changed", nickname: "Brave Wren" }, report_library_message: "reported",
    });
    const s = f.social;
    await s.lobbyMe(); await s.setLobbyVisible(false); await s.regenerateNickname();
    await s.joinLobby({ x: 65, y: 34 }, 3); await s.lobbyServers();
    await s.setLobbyPosition(2, { x: 65, y: 34 }, { seated: true, subjectId: "physics", focusSince: T });
    await s.leaveLobby(); await s.lobbyPeople(2); await s.lobbyEmote("high_five");
    await s.libraryMessages(2, T); await s.sendLibraryMessage(2, "hi"); await s.reportLibraryMessage("12", "bullying", true);
    const byName = Object.fromEntries(f.calls.map((c) => [c.name, c.args]));
    for (const key of ["lobbyMe", "setLobbyVisible", "regenerateNickname", "lobbyJoin", "lobbyServers", "lobbySetPosition", "lobbyLeave", "lobbyPeople", "lobbyEmote", "libraryMessages", "sendLibraryMessage", "reportLibraryMessage"] as const) {
      assert.ok(RPC[key].name in byName, `${key} was not called`);
      assert.deepEqual(Object.keys(byName[RPC[key].name]).sort(), [...RPC[key].args].sort(), `${key} (${RPC[key].name})`);
    }
    assert.deepEqual(byName.lobby_join, { x: 65, y: 34, want: 3, platform: "web" });
    assert.deepEqual(byName.lobby_set_position, { shard: 2, x: 65, y: 34, seated: true, subject: "physics", focus_since: new Date(T).toISOString() });
    assert.deepEqual(byName.report_library_message, { message: 12, reason: "bullying", block: true });
    assert.deepEqual(byName.library_messages, { shard: 2, since: new Date(T).toISOString() });
  });
  it("joins without `want` unless a server is chosen, so a server before 0121 still answers, and says it is the web (0124)", async () => {
    const f = fake({ lobby_join: { shard: 1, nickname: "Quiet Otter", visible: true } });
    await f.social.joinLobby({ x: 65, y: 34 });
    assert.deepEqual(f.calls[0].args, { x: 65, y: 34, platform: "web" });
    await f.social.joinLobby({ x: 999, y: -4 }, null);
    assert.deepEqual(f.calls[1].args, { x: 255, y: 0, platform: "web" }, "a tile is clamped, not refused");
    await f.social.joinLobby({ x: 65, y: 34 }, 2, null);
    assert.deepEqual(f.calls[2].args, { x: 65, y: 34, want: 2 }, "a caller that wants to say nothing sends no platform");
  });
  it("sends no subject or focus start unless seated", async () => {
    const f = fake({ lobby_set_position: "ok" });
    await f.social.setLobbyPosition(1, { x: 65, y: 34 }, { seated: false, subjectId: "physics", focusSince: T });
    assert.deepEqual(f.calls[0].args, { shard: 1, x: 65, y: 34, seated: false, subject: null, focus_since: null });
    assert.deepEqual(await f.social.setLobbyPosition(1, { x: 65, y: 34 }, { seated: true }), { ok: true, value: true });
    const rejoin = fake({ lobby_set_position: "rejoin" });
    assert.deepEqual(await rejoin.social.setLobbyPosition(1, { x: 65, y: 34 }, { seated: false }), { ok: true, value: false });
  });
  it("checks a message first, in the student's words, and sends nothing the rules refuse", async () => {
    const f = fake();
    const lines: Record<string, string> = { "add me on snapchat": "message_link", "hahahahaha": "message_spam", "WHY IS NOBODY ANSWERING ME": "message_shouting", "": "message_empty" };
    for (const [body, reason] of Object.entries(lines)) assert.deepEqual(await f.social.sendLibraryMessage(1, body), { ok: false, failure: { kind: "refused", reason } }, body);
    assert.deepEqual(await f.social.sendLibraryMessage(1, "hello", [{ body: "Hello", at: T - 1000 }], T), { ok: false, failure: { kind: "refused", reason: "message_repeat" } });
    assert.equal(f.calls.length, 0);
    for (const reason of ["message_spam", "message_shouting", "message_repeat", "message_rate", "message_muted"] as const) assert.doesNotMatch(studentFacing(reason), /_|spam filter/);
  });
  it("turns the server's refusals into the same quiet failures", async () => {
    for (const [msg, reason] of [["social:message_spam", "message_spam"], ["social:message_shouting", "message_shouting"], ["social:message_repeat", "message_repeat"], ["social:message_muted", "message_muted"], ["social:message_rate", "message_rate"], ["social:not_member", "not_member"]] as const) {
      const r = await fake({}, { send_library_message: msg }).social.sendLibraryMessage(1, "hello there");
      assert.deepEqual(r, { ok: false, failure: { kind: "refused", reason } }, msg);
    }
    assert.deepEqual(failureFor({ message: "social:bad_emote" }), { kind: "unavailable" });
    const gone = await fake({}, { lobby_people: "social:not_member" }).social.lobbyPeople(3);
    assert.deepEqual(gone, { ok: false, failure: { kind: "refused", reason: "not_member" } });
  });
  it("never lets a stranger's display name through, whatever a server sends", async () => {
    const f = fake({ lobby_people: [{ user_id: "u", nickname: "Quiet Otter", display_name: "Their Real Name", is_friend: false, seated: false }] });
    const r = await f.social.lobbyPeople(1);
    assert.ok(r.ok && r.value[0].displayName === null);
  });
  it("is quiet signed out", async () => {
    const api: Api = { configured: true, userId: () => null, rpc: async () => ({ data: null, error: null }), select: async () => ({ data: [], error: null }) };
    assert.deepEqual(await createSocial(api).lobbyPeople(1), { ok: false, failure: { kind: "signedOut" } });
  });
});

/* ── The device a student is on (0124) ──────────────────────────────── */

describe("the device a student is on (0124)", () => {
  const row = (o: Record<string, unknown> = {}) => ({ user_id: "AAAA-1", nickname: "Quiet Otter", display_name: null, is_friend: false, colour: 5, seated: false, ...o });
  it("reads ipad and web in any case, and nothing else", () => {
    assert.equal(lobbyDecode.person(row({ platform: "ipad" }))!.platform, "ipad");
    assert.equal(lobbyDecode.person(row({ platform: " WEB " }))!.platform, "web");
    for (const bad of ["android", "", null, undefined, 3, {}, ["ipad"], "ipad; drop table"]) assert.equal(lobbyDecode.person(row({ platform: bad }))!.platform, null, String(bad));
    assert.equal(lobbyDecode.person(row())!.platform, null, "an older server sends no column at all");
  });
  it("keeps a platform through `sanitised`, and drops one that is not on the list", () => {
    assert.equal(sanitised(person({ platform: "web" })).platform, "web");
    assert.equal(sanitised(person({ platform: "android" as never })).platform, null);
    assert.equal(sanitised(person()).platform, undefined, "a hand-made person with none stays as it was");
  });
  it("joins saying `web`, and again without it when the project has not had 0124, and then stops sending it", async () => {
    const calls: Record<string, unknown>[] = [];
    const api: Api = {
      configured: true, userId: () => "me",
      async rpc(_n, args = {}) {
        calls.push(args);
        return "platform" in args
          ? { data: null, error: { message: "Could not find the function public.lobby_join(platform, x, y) in the schema cache", code: "PGRST202", status: 404 } }
          : { data: { shard: 1, nickname: "Quiet Otter", visible: true, cap: 60 }, error: null };
      },
      async select() { return { data: [], error: null }; },
    };
    const social = createSocial(api);
    const first = await social.joinLobby({ x: 65, y: 34 });
    assert.ok(first.ok && first.value.shard === 1, "the student still gets in");
    assert.deepEqual(calls, [{ x: 65, y: 34, platform: "web" }, { x: 65, y: 34 }]);
    await social.joinLobby({ x: 65, y: 34 });
    assert.deepEqual(calls.slice(2), [{ x: 65, y: 34 }], "once learned, it is not tried again");
  });
  it("does not give up on the platform for a hiccup that is not a missing function", async () => {
    let n = 0;
    const calls: Record<string, unknown>[] = [];
    const api: Api = {
      configured: true, userId: () => "me",
      async rpc(_n, args = {}) {
        calls.push(args);
        n++;
        return n === 1 ? { data: null, error: { message: "upstream hiccup", status: 502 } } : { data: { shard: 1, nickname: "Quiet Otter", visible: true }, error: null };
      },
      async select() { return { data: [], error: null }; },
    };
    const social = createSocial(api);
    assert.ok((await social.joinLobby({ x: 1, y: 1 })).ok);
    await social.joinLobby({ x: 1, y: 1 });
    assert.deepEqual(calls.map((c) => "platform" in c), [true, false, true], "retried once without, and the next join says it again");
  });
});

/* ── Asking someone in the library to be friends (0125) ─────────────── */

describe("asking someone in the library to be friends (0125)", () => {
  const ID = "0f9b2d9c-6a7e-4c0e-9d3b-1a2b3c4d5e6f";
  it("calls send_lobby_friend_request with exactly `person`, and reads each word", async () => {
    for (const word of ["sent", "now_friends", "already_friends", "already_asked", "rate_limited", "not_here"] as const) {
      const f = fake({ send_lobby_friend_request: word });
      assert.deepEqual(await f.social.sendLobbyFriendRequest(ID.toUpperCase()), { ok: true, value: word });
      assert.deepEqual(f.calls, [{ name: "send_lobby_friend_request", args: { person: ID } }]);
      assert.deepEqual(Object.keys(f.calls[0].args), [...RPC.sendLobbyFriendRequest.args]);
    }
  });
  it("never sends an id that is not an id: that is just 'not here'", async () => {
    const f = fake();
    for (const bad of ["", "me", "../../x", "1; drop table friendship", "0f9b2d9c-6a7e-4c0e-9d3b"]) assert.deepEqual(await f.social.sendLobbyFriendRequest(bad), { ok: true, value: "not_here" }, bad);
    assert.equal(f.calls.length, 0);
  });
  it("does not guess at a word it does not know", async () => {
    for (const data of ["pending", "blocked", "", null, { status: "sent" }, 1]) assert.deepEqual(await fake({ send_lobby_friend_request: data }).social.sendLobbyFriendRequest(ID), { ok: false, failure: { kind: "unavailable" } }, String(data));
  });
  it("says it cannot be done on a project without 0125, so the button can be hidden, and not before it knows", async () => {
    const api: Api = {
      configured: true, userId: () => "me",
      async rpc() { return { data: null, error: { message: "Could not find the function public.send_lobby_friend_request(person) in the schema cache", code: "PGRST202", status: 404 } }; },
      async select() { return { data: [], error: null }; },
    };
    const social = createSocial(api);
    assert.equal(social.canRequestFriends, null, "unknown before any call");
    assert.deepEqual(await social.sendLobbyFriendRequest(ID), { ok: false, failure: { kind: "unavailable" } });
    assert.equal(social.canRequestFriends, false);
    const probe = createSocial(api);
    assert.equal(await probe.probeFriendRequests(), false);
    assert.equal(probe.canRequestFriends, false);
  });
  it("is true once the server has answered, and a hiccup does not turn it off", async () => {
    const ok = fake({ send_lobby_friend_request: "not_here" });
    await ok.social.sendLobbyFriendRequest(ID);
    assert.equal(ok.social.canRequestFriends, true, "not_here is an answer");
    const flaky = createSocial({ configured: true, userId: () => "me", rpc: async () => ({ data: null, error: { message: "Failed to fetch" } }), select: async () => ({ data: [], error: null }) });
    assert.deepEqual(await flaky.sendLobbyFriendRequest(ID), { ok: false, failure: { kind: "offline" } });
    assert.equal(flaky.canRequestFriends, null);
    assert.equal(await flaky.probeFriendRequests(), null, "could not tell");
  });
  it("raises nothing for a student who has not turned friends on: a quiet failure", async () => {
    assert.deepEqual(await fake({}, { send_lobby_friend_request: "social:not_opted_in" }).social.sendLobbyFriendRequest(ID), { ok: false, failure: { kind: "notOptedIn" } });
  });
  it("reads the open requests as nicknames only, whatever the server sends with them", async () => {
    const f = fake({
      lobby_friend_requests: [
        { user_id: "AAAA-1", direction: "incoming", nickname: "Quiet Otter", colour: 21, avatar: { hat: "cap", n: 3 }, streak: 4, level: 2, created_at: "2026-11-01T12:00:00Z",
          display_name: "Ada Lovelace", friend_code: "ABCD2345", email: "ada@example.com" },
        { user_id: "BBBB-2", direction: "outgoing", nickname: "ada lovelace", colour: 3, streak: 0, level: 0, created_at: "2026-11-01T12:01:00Z" },
        { user_id: "CCCC-3", direction: "sideways", nickname: "Kind Fox" },
        { nickname: "Kind Fox", direction: "incoming" },
      ],
    });
    const r = await f.social.lobbyFriendRequests();
    assert.ok(r.ok);
    assert.equal(r.value.length, 2, "a row with an unknown direction, or no id, is dropped");
    assert.deepEqual(r.value[0], { userId: "aaaa-1", direction: "incoming", nickname: "Quiet Otter", colour: 5, avatar: { hat: "cap" }, streak: 4, level: 2, createdAt: Date.parse("2026-11-01T12:00:00Z") });
    assert.doesNotMatch(JSON.stringify(r.value), /Ada|Lovelace|ABCD2345|example\.com|friend_code|display_name/i);
    assert.equal(r.value[1].nickname, "Someone", "a nickname that is not two plain words is never shown");
    assert.deepEqual(f.calls, [{ name: "lobby_friend_requests", args: {} }]);
  });
  it("reads your own open request on a card, and offers Add friend only where it can work", async () => {
    const f = fake({ lobby_people: [
      { user_id: "a", nickname: "Quiet Otter", is_friend: false, friend_request: "sent" },
      { user_id: "b", nickname: "Kind Fox", is_friend: false, friend_request: "received" },
      { user_id: "c", nickname: "Brave Wren", is_friend: false, friend_request: "somebody else" },
      { user_id: "d", nickname: "Calm Hare", is_friend: true, display_name: "Dee" },
    ] });
    const r = await f.social.lobbyPeople(1);
    assert.ok(r.ok);
    assert.deepEqual(r.value.map((p) => p.friendRequest), ["sent", "received", null, null]);
    assert.deepEqual(r.value.map(canAsk), [false, false, true, false]);
  });
  it("has one short plain line per answer, with no rule, no code, no em dash, and no reason in the one for 'not here'", () => {
    for (const o of LOBBY_ASK_OUTCOMES) {
      const line = askLine(o);
      assert.ok(line.length > 0 && line.length <= 50, `${o}: ${line}`);
      assert.doesNotMatch(line, /[_\u2014\u2013]|block|hid|report|rate|limit|server|error|code/i, `${o}: ${line}`);
    }
    assert.equal(askLine("not_here"), "They’re not around right now");
    assert.equal(new Set(LOBBY_ASK_OUTCOMES.map(askLine)).size, 6, "six answers, six lines");
  });
});
