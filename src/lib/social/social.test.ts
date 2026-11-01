/**
 * npm run social:test   (node:test, run through tsx; no network, no database)
 *
 * What it holds: the chat rules agree with every vector the server is held to; the server's refusals
 * become the right quiet failures; presence is read as the iPad reads it; the service asks for exactly the
 * tables and RPCs, with exactly the argument names, the iPad does; and the realtime layer speaks the
 * topics 0113's policies expect. The server itself is tested where it lives (tools/social-check in the app
 * repo), and `npm run social:contract` holds this library to it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { READS, RPC, type Api, type Filter, type Row } from "./api";
import * as chat from "./chatRules";
import { failureFor, raised, studentFacing, type Refusal } from "./failure";
import { CODE_ALPHABET, displayCode, findCode, parseCode, parseInvite } from "./friendCode";
import { elapsedSeconds, isStudyingNow, readPresence } from "./presence";
import { chatTopic, MAX_PEOPLE, walkTopic, watchChat, watchHall, type ChannelLike, type HallSignal, type RealtimeLike } from "./realtime";
import { byTime, createSocial, decode } from "./service";
import { hallKey, reactionLine } from "./types";

const vectors = JSON.parse(readFileSync(new URL("./chat.vectors.json", import.meta.url), "utf8")) as { vectors: { body: string; want: string | null }[] };

describe("chat rules", () => {
  it("agree with every vector the server is held to", () => {
    const wrong = vectors.vectors.filter((v) => (chat.refusal(v.body) ?? null) !== v.want)
      .map((v) => `${JSON.stringify(v.body).slice(0, 50)} wants ${v.want} got ${chat.refusal(v.body)}`);
    assert.deepEqual(wrong, []);
    assert.ok(vectors.vectors.length >= 60);
  });
  it("count characters as the server does, not UTF-16 units", () => {
    assert.equal(chat.refusal("é".repeat(280)), null);
    assert.equal(chat.refusal("\u{1F600}".repeat(280)), null);
    assert.equal(chat.refusal("\u{1F600}".repeat(281)), "too_long");
  });
  it("treat any Unicode letter as a word character, as the server does (a regression the vectors missed)", () => {
    for (const s of ["世界dot com", "ßdot com", "Σdot com"]) {
      assert.equal(chat.refusal(s), null, s);
    }
    assert.equal(chat.refusal("see dot com"), "link");
    assert.equal(chat.refusal("ßclassic dot com"), "link", "a real space before it is a link");
    assert.equal(chat.refusal("see www.x.org"), "link");
  });
  it("tidy the stored body", () => {
    assert.deepEqual(chat.check("  anyone   revising chem?​ "), { ok: true, body: "anyone revising chem?" });
  });
  it("never name the word that matched", () => {
    for (const r of ["empty", "too_long", "link", "language"] as const) assert.doesNotMatch(chat.refusalLine(r), /fuck|shit|www|http/i);
  });
  it("carry the server's word list (counted, so a dropped row is noticed)", () => {
    assert.equal(chat.TERMS.length, 141, "the server's chat_banned_term has 141 rows after 0109 and 0111");
    assert.equal(new Set(chat.TERMS.map((t) => t.term)).size, chat.TERMS.length);
    assert.ok(chat.TERMS.every((t) => /^[a-z ]+$/.test(t.term)));
  });
});

describe("codes", () => {
  it("use the app's alphabet and format", () => {
    assert.equal(CODE_ALPHABET.length, 32);
    for (const bad of "01OI") assert.ok(!CODE_ALPHABET.includes(bad));
    assert.equal(parseCode("abcd-2345"), "ABCD2345");
    assert.equal(parseCode(" abcd 2345 "), "ABCD2345");
    assert.equal(parseCode("ABCD234"), null);
    assert.equal(parseCode("ABCD2340"), null);
    assert.equal(displayCode("ABCD2345"), "ABCD-2345");
  });
  it("read the app's invite links", () => {
    assert.deepEqual(parseInvite("https://plumi.app/f/ABCD2345"), { kind: "friend", code: "ABCD2345" });
    assert.deepEqual(parseInvite("https://tryplumi.app/g/abcd-2345"), { kind: "group", code: "ABCD2345" }, "a hyphenated code is still the code");
    assert.deepEqual(parseInvite("https://plumi.app/g/ABCD2345/"), { kind: "group", code: "ABCD2345" });
    assert.equal(parseInvite("https://plumi.app/x/ABCD2345"), null);
    assert.equal(parseInvite("nonsense"), null);
  });
  it("find a code in pasted text", () => {
    assert.equal(findCode("add me! https://plumi.app/f/ABCD2345 thanks"), "ABCD2345");
    assert.equal(findCode("my code is ABCD-2345"), "ABCD2345");
    assert.equal(findCode("hello there"), null);
  });
});

describe("failures", () => {
  const cases: [string, string, string?][] = [
    ["social:not_signed_in", "signedOut"], ["social:not_opted_in", "notOptedIn"], ["social:name_refused", "refused", "name_rejected"],
    ["social:group_limit", "refused", "too_many_groups"], ["social:rate_limited", "refused", "rate_limited"], ["social:not_owner", "refused", "not_allowed"],
    ["social:self", "refused", "not_allowed"], ["social:not_member", "refused", "not_member"], ["social:message_link", "refused", "message_link"],
    ["social:message_language", "refused", "message_language"], ["social:message_rate", "refused", "message_rate"], ["social:message_spam", "refused", "message_spam"],
    ["social:bad_presence", "unavailable"], ["social:something_new", "refused", "other"],
  ];
  for (const [message, kind, reason] of cases) {
    it(`maps ${message}`, () => {
      const f = raised(`ERROR: ${message}`);
      assert.equal(f?.kind, kind);
      if (reason) assert.equal(f?.kind === "refused" ? f.reason : null, reason);
    });
  }
  it("is not fooled by an ordinary error", () => assert.equal(raised("permission denied"), null));
  it("tells offline, signed out, forbidden and a missing function apart", () => {
    assert.equal(failureFor({ message: "TypeError: Failed to fetch" }).kind, "offline");
    assert.equal(failureFor({ message: "JWT expired", status: 401 }).kind, "signedOut");
    assert.deepEqual(failureFor({ message: "denied", status: 403 }), { kind: "refused", reason: "not_allowed" });
    assert.equal(failureFor({ message: "Could not find the function", code: "PGRST202", status: 404 }).kind, "unavailable");
  });
  it("gives every refusal a short line with no code, rule or dash in it", () => {
    const all: Refusal[] = ["unknown_code", "own_code", "rate_limited", "group_full", "too_many_groups", "name_rejected", "not_allowed", "not_member",
      "message_empty", "message_too_long", "message_link", "message_language", "message_rate", "message_spam", "message_shouting", "message_repeat", "message_muted", "other"];
    for (const r of all) {
      const line = studentFacing(r);
      assert.ok(line.length > 0 && line.length < 60, line);
      assert.doesNotMatch(line, /[–—]|social:|_|RLS|rpc|error/i, line);
    }
  });
});

describe("presence", () => {
  const T = Date.parse("2026-11-01T12:00:00Z");
  const p = (over: Partial<Parameters<typeof readPresence>[0] & object> = {}) => ({
    subjectId: "physics", mode: "pomodoro" as const, phase: "work" as const,
    startedAt: "2026-11-01T11:50:00Z", endsAt: "2026-11-01T12:15:00Z", expiresAt: "2026-11-01T12:30:00Z", ...over,
  });
  it("reads a live session", () => {
    assert.equal(readPresence(p(), T).state, "studying");
    assert.ok(isStudyingNow(p(), T));
    assert.equal(elapsedSeconds(readPresence(p(), T), T), 600);
  });
  it("reads a break", () => assert.equal(readPresence(p({ phase: "break" }), T).state, "onBreak"));
  it("treats nothing, an expired row and a long-ended phase as idle", () => {
    assert.equal(readPresence(null, T).state, "idle");
    assert.equal(readPresence(p({ expiresAt: "2026-11-01T11:59:59Z" }), T).state, "idle");
    assert.equal(readPresence(p({ endsAt: "2026-11-01T11:58:00Z" }), T).state, "idle"); // 2 min past, beyond the 90 s grace
    assert.equal(readPresence(p({ endsAt: "2026-11-01T11:59:00Z" }), T).state, "studying"); // within grace
  });
  it("never counts down from the future", () => {
    const soon = readPresence(p({ startedAt: "2026-11-01T12:02:00Z" }), T);
    assert.equal(soon.state === "idle" ? 0 : soon.since, T);
    assert.equal(readPresence(p({ startedAt: "2026-11-01T12:10:00Z" }), T).state, "idle");
  });
});

/* A fake transport: records every call, answers from tables of canned replies. */
type Call = { kind: "rpc"; name: string; args: Record<string, unknown> } | { kind: "select"; table: string; columns: string; filters: Filter[] };
function fake(opts: { configured?: boolean; user?: string | null; rpc?: Record<string, unknown>; rows?: Record<string, Row[]>; raise?: Record<string, string> } = {}) {
  const calls: Call[] = [];
  const api: Api = {
    configured: opts.configured ?? true,
    userId: () => (opts.user === undefined ? "me" : opts.user),
    async rpc(name, args = {}) {
      calls.push({ kind: "rpc", name, args });
      if (opts.raise?.[name]) return { data: null, error: { message: opts.raise[name] } };
      return { data: opts.rpc?.[name] ?? null, error: null };
    },
    async select(table, columns, filters = []) {
      calls.push({ kind: "select", table, columns, filters });
      return { data: opts.rows?.[table] ?? [], error: null };
    },
  };
  return { api, calls, social: createSocial(api), rpcs: () => calls.filter((c): c is Extract<Call, { kind: "rpc" }> => c.kind === "rpc") };
}

describe("the service", () => {
  it("is quiet when not configured or signed out, and asks nothing", async () => {
    const a = fake({ configured: false });
    assert.deepEqual(await a.social.loadFriends(), { ok: false, failure: { kind: "notConfigured" } });
    const b = fake({ user: null });
    assert.deepEqual(await b.social.leaveGroup("g"), { ok: false, failure: { kind: "signedOut" } });
    assert.equal(a.calls.length + b.calls.length, 0);
  });

  it("calls each write with the app's RPC name and argument names", async () => {
    const f = fake({ rpc: { send_friend_request: "pending", rotate_group_code: "NEWCODE2", create_group: { id: "g1", name: "Sigmas", invite_code: "ABCD2345" } } });
    const s = f.social;
    await s.respondToFriendRequest("u1", true);
    await s.removeFriend("u1");
    await s.block("u1");
    await s.unblock("u1");
    await s.reportUser("u1", "name", "g1");
    await s.leaveGroup("g1");
    await s.removeMember("g1", "u1");
    await s.renameGroup("g1", "New");
    await s.setGroupHall("g1", { emblem: 2, theme: "cafe", weeklyGoalHours: 40 });
    await s.setGroupVisibility("g1", true);
    await s.sendReaction("nudge", "u1", "g1");
    await s.markReactionsSeen();
    await s.setAvatar({ hat: "cap" });
    await s.clearPresence();
    await s.clearHallPosition();
    await s.optOut();
    const byName = Object.fromEntries(f.rpcs().map((c) => [c.name, Object.keys(c.args)]));
    for (const [key, spec] of Object.entries(RPC)) {
      if (!(spec.name in byName)) continue; // exercised elsewhere in this file
      assert.deepEqual([...byName[spec.name]].sort(), [...spec.args].sort(), `${key} (${spec.name})`);
    }
    assert.deepEqual(f.rpcs().find((c) => c.name === "set_group_hall")?.args, { group: "g1", emblem: 2, hall_theme: "cafe", weekly_goal_hours: 40 });
    assert.deepEqual(f.rpcs().find((c) => c.name === "set_group_visibility")?.args, { group: "g1", visibility: "public" });
    assert.deepEqual(f.rpcs().find((c) => c.name === "report_user")?.args, { user: "u1", reason: "name", group: "g1" });
  });

  it("opts in with the server's profile, and refuses a name quietly", async () => {
    const profile = { user_id: "me", display_name: "Alex", colour: 3, friend_code: "ABCD2345", opted_in_at: "2026-11-01T10:00:00Z" };
    const ok = await fake({ rpc: { social_opt_in: profile } }).social.optIn("Alex", 3);
    assert.ok(ok.ok && ok.value.friendCode === "ABCD2345" && ok.value.displayName === "Alex");
    const no = await fake({ raise: { social_opt_in: "social:name_refused" } }).social.optIn("rude", 1);
    assert.deepEqual(no, { ok: false, failure: { kind: "refused", reason: "name_rejected" } });
  });

  it("never sends a malformed code", async () => {
    const f = fake();
    assert.deepEqual(await f.social.sendFriendRequest("hello"), { ok: false, failure: { kind: "refused", reason: "unknown_code" } });
    assert.deepEqual(await f.social.joinGroup("ABCD2340"), { ok: false, failure: { kind: "refused", reason: "unknown_code" } });
    assert.equal(f.calls.length, 0);
    const g = fake({ rpc: { send_friend_request: "accepted" } });
    assert.deepEqual(await g.social.sendFriendRequest("abcd-2345"), { ok: true, value: "now_friends" });
    assert.deepEqual(g.rpcs()[0].args, { code: "ABCD2345" });
  });

  it("reads send_friend_request's answer word as the app does, and never calls a bad code a sent request", async () => {
    const say = async (word: unknown) => fake({ rpc: { send_friend_request: word } }).social.sendFriendRequest("ABCD2345");
    assert.deepEqual(await say("pending"), { ok: true, value: "sent" });
    assert.deepEqual(await say("already_friends"), { ok: true, value: "already_friends" });
    assert.deepEqual(await say("self"), { ok: true, value: "own_code" });
    assert.deepEqual(await say("not_found"), { ok: false, failure: { kind: "refused", reason: "unknown_code" } });
    assert.deepEqual(await say("blocked"), { ok: false, failure: { kind: "refused", reason: "unknown_code" } }, "a blocked student cannot tell");
    assert.deepEqual(await say("rate_limited"), { ok: false, failure: { kind: "refused", reason: "rate_limited" } });
    assert.deepEqual(await say("something new"), { ok: false, failure: { kind: "unavailable" } });
    assert.deepEqual(await say(null), { ok: false, failure: { kind: "unavailable" } });
  });

  it("reads join_group's status, and reactions' outcome word", async () => {
    const join = async (row: unknown) => fake({ rpc: { join_group: row } }).social.joinGroup("ABCD2345");
    const inGroup = await join({ status: "already_member", id: "g1", name: "Sigmas", invite_code: "ABCD2345" });
    assert.ok(inGroup.ok && inGroup.value.id === "g1");
    assert.deepEqual(await join({ status: "full" }), { ok: false, failure: { kind: "refused", reason: "group_full" } });
    assert.deepEqual(await join({ status: "not_found" }), { ok: false, failure: { kind: "refused", reason: "unknown_code" } });
    assert.deepEqual(await join({ status: "rate_limited" }), { ok: false, failure: { kind: "refused", reason: "rate_limited" } });
    assert.deepEqual(await join({ status: "joined" }), { ok: false, failure: { kind: "unavailable" } }, "a join with no id is not a join");
    const react = async (word: unknown) => fake({ rpc: { send_reaction: word } }).social.sendReaction("nudge", "u1", "g1");
    assert.deepEqual(await react("sent"), { ok: true, value: "sent" });
    assert.deepEqual(await react("too_soon"), { ok: true, value: "too_soon" });
    assert.deepEqual(await react("???"), { ok: true, value: "not_found" });
    assert.equal(reactionLine("sent", "high_five"), "High five sent");
    assert.doesNotMatch(reactionLine("rate_limited", "nudge"), /[\u2013\u2014_]/);
  });

  it("tells the student about a link or a word before sending, and sends the tidied body otherwise", async () => {
    const f = fake({ rpc: { send_group_message: { id: 7, group_id: "g1", sender: "me", body: "anyone doing q3?", created_at: "2026-11-01T10:00:00Z" } } });
    assert.deepEqual(await f.social.sendGroupMessage("g1", "see www.x.com"), { ok: false, failure: { kind: "refused", reason: "message_link" } });
    assert.deepEqual(await f.social.sendGroupMessage("g1", "   "), { ok: false, failure: { kind: "refused", reason: "message_empty" } });
    assert.equal(f.calls.length, 0);
    const sent = await f.social.sendGroupMessage("g1", "  anyone   doing q3? ");
    assert.ok(sent.ok && sent.value.id === "7" && sent.value.hidden === false);
    assert.deepEqual(f.rpcs()[0].args, { group: "g1", body: "anyone doing q3?" });
  });

  it("still maps the server's refusal when the browser's check let it through", async () => {
    const f = fake({ raise: { send_group_message: "social:message_rate" } });
    assert.deepEqual(await f.social.sendGroupMessage("g1", "hello"), { ok: false, failure: { kind: "refused", reason: "message_rate" } });
  });

  it("loads friends and requests from the friendship rows", async () => {
    const f = fake({ rows: {
      friendship: [
        { user_id: "me", friend_id: "ann", status: "accepted", created_at: "2026-10-01T00:00:00Z" },
        { user_id: "bob", friend_id: "me", status: "accepted", created_at: "2026-10-02T00:00:00Z" },
        { user_id: "cat", friend_id: "me", status: "pending", created_at: "2026-10-03T00:00:00Z" },
        { user_id: "me", friend_id: "dan", status: "pending", created_at: "2026-10-04T00:00:00Z" },
        { user_id: "x", friend_id: "y", status: "accepted", created_at: "2026-10-05T00:00:00Z" },
      ],
      social_profile: [
        { user_id: "ann", display_name: "Ann", colour: 1, avatar: { hat: "cap", n: 3 } }, { user_id: "bob", display_name: "Bob", colour: 2 },
        { user_id: "cat", display_name: "Cat", colour: 3 },
      ],
      study_presence: [{ user_id: "ann", subject_id: "physics", mode: "timer", phase: "work", started_at: "2026-11-01T11:00:00Z", ends_at: null, expires_at: "2026-11-01T13:00:00Z" }],
      social_summary: [{ user_id: "ann", day: "2026-11-01", today_seconds: 600, week_seconds: 3000, week_xp: 10, level: 2, streak: 5, streak_day: "2026-11-01" }],
    } });
    const r = await f.social.loadFriends();
    assert.ok(r.ok);
    assert.deepEqual(r.value.friends.map((p) => p.displayName), ["Ann", "Bob"]);
    assert.equal(r.value.friends[0].presence?.subjectId, "physics");
    assert.equal(r.value.friends[0].summary?.streak, 5);
    assert.deepEqual(r.value.friends[0].avatar, { hat: "cap" }, "non-string avatar values are dropped");
    assert.deepEqual(r.value.requests.map((q) => [q.otherUserId, q.direction, q.person?.displayName ?? null]), [["cat", "incoming", "Cat"], ["dan", "outgoing", null]]);
    const first = f.calls[0];
    assert.ok(first.kind === "select" && first.table === "friendship");
    assert.deepEqual(first.filters, [["or", "(user_id.eq.me,friend_id.eq.me)"]]);
  });

  it("loads groups with member counts and the hall's columns", async () => {
    const f = fake({ rows: {
      study_group: [
        { id: "g1", name: "Sigmas", invite_code: "ABCD2345", owner_id: "me", created_at: "2026-10-01T00:00:00Z", emblem: 3, hall_theme: "cafe", weekly_goal_hours: 40, visibility: "public" },
        { id: "g2", name: "Old", invite_code: null, owner_id: "u", created_at: "2026-10-02T00:00:00Z", emblem: null, hall_theme: "weird", weekly_goal_hours: null, visibility: "private" },
      ],
      group_member: [{ group_id: "g1", user_id: "me" }, { group_id: "g1", user_id: "a" }, { group_id: "g2", user_id: "u" }],
    } });
    const r = await f.social.loadGroups();
    assert.ok(r.ok);
    assert.deepEqual(r.value.map((g) => [g.name, g.memberCount, g.hall.theme, g.hall.emblem, g.hall.weeklyGoalHours, g.isPublic]),
      [["Sigmas", 2, "cafe", 3, 40, true], ["Old", 1, "blue", 0, 30, false]]);
  });

  it("reads a group's messages oldest first, and only after `since` when asked", async () => {
    const f = fake({ rows: { group_message: [
      { id: 2, group_id: "g1", sender: "a", body: "second", created_at: "2026-11-01T10:00:02Z", hidden: false },
      { id: 1, group_id: "g1", sender: "b", body: "first", created_at: "2026-11-01T10:00:01Z", hidden: false },
      { id: 3, group_id: "g1", sender: "b", body: "tie", created_at: "2026-11-01T10:00:02Z", hidden: false },
      { id: "x", body: "no group" },
    ] } });
    const r = await f.social.groupMessages("g1", new Date("2026-11-01T09:00:00Z"));
    assert.ok(r.ok);
    assert.deepEqual(r.value.map((m) => m.body), ["first", "second", "tie"]);
    const q = f.calls[0];
    assert.ok(q.kind === "select");
    assert.deepEqual(q.filters, [["eq", "group_id", "g1"], ["order", "created_at", "desc"], ["limit", 100], ["gt", "created_at", "2026-11-01T09:00:00.000Z"]]);
    assert.deepEqual([...[{ id: "2", createdAt: "a" }, { id: "1", createdAt: "a" }] as never[]].sort(byTime as never).map((m: { id: string }) => m.id), ["1", "2"]);
  });

  it("clamps a hall tile to the world and sends the hall key", async () => {
    const f = fake();
    await f.social.setHallPosition(hallKey("ABC-Def"), 300.4, -2);
    assert.deepEqual(f.rpcs()[0].args, { hall: "abc-def", x: 255, y: 0 });
    assert.equal(hallKey(null), "friends");
  });

  it("reads hall positions and drops malformed rows", async () => {
    const f = fake({ rpc: { hall_positions: [{ user_id: "a", x: 3, y: 4, updated_at: "t" }, { user_id: "b", x: "no" }] } });
    const r = await f.social.hallPositions("friends");
    assert.deepEqual(r, { ok: true, value: [{ userId: "a", x: 3, y: 4, updatedAt: "t" }] });
  });

  it("sets presence with ISO times and the server's mode and phase words", async () => {
    const f = fake();
    await f.social.setPresence({ subjectId: "physics", mode: "pomodoro", phase: "work", startedAt: new Date("2026-11-01T10:00:00Z"), endsAt: new Date("2026-11-01T10:25:00Z") });
    assert.deepEqual(f.rpcs()[0].args, { subject: "physics", mode: "pomodoro", phase: "work", started_at: "2026-11-01T10:00:00.000Z", ends_at: "2026-11-01T10:25:00.000Z" });
  });

  it("publishes the week and then the streak, and a failed streak does not fail the publish", async () => {
    const f = fake({ raise: { publish_streak: "social:rate_limited" } });
    const r = await f.social.publishSummary({ todaySeconds: 600, weekSeconds: 3000, weekXp: 120, level: 4, streak: 8 });
    assert.ok(r.ok);
    assert.deepEqual(f.rpcs().map((c) => c.name), ["publish_summary_week", "publish_streak"]);
    assert.deepEqual(f.rpcs()[0].args, { today_seconds: 600, week_seconds: 3000, week_xp: 120, level: 4 });
    assert.deepEqual(f.rpcs()[1].args, { days: 8 });
  });

  it("decodes defensively", () => {
    assert.equal(decode.profile({ user_id: "a" }), null);
    assert.equal(decode.presence({ user_id: "a", subject_id: "p", mode: "stopwatch", phase: "work", started_at: "t" }), null);
    assert.equal(decode.reaction({ id: 1, group_id: "g", user_id: "a", to_user: "b", kind: "slap" }), null);
    assert.equal(decode.person({ user_id: "a", display_name: "A", colour: 99 })?.colour, 3, "colour is taken modulo 16");
  });

  it("climbs down the column ladder on a server that lacks a later migration, and stops on anything else", async () => {
    const calls: string[] = [];
    const old: Api = {
      configured: true, userId: () => "me",
      async rpc() { return { data: null, error: null }; },
      async select(table, columns) {
        calls.push(`${table}:${columns}`);
        if (columns.includes("visibility")) return { data: null, error: { message: "column study_group.visibility does not exist", code: "42703", status: 400 } };
        return { data: [{ id: "g1", name: "Sigmas", owner_id: "me", invite_code: "ABCD2345", created_at: "t", emblem: 1, hall_theme: "oak", weekly_goal_hours: 20 }], error: null };
      },
    };
    const r = await createSocial(old).loadGroups();
    assert.ok(r.ok && r.value[0].hall.theme === "oak" && r.value[0].isPublic === false);
    assert.equal(calls.filter((c) => c.startsWith("study_group")).length, 2, "tried the newest set, then the next");
    const offline: Api = { ...old, async select() { return { data: null, error: { message: "TypeError: Failed to fetch" } }; } };
    const o = await createSocial(offline).loadGroups();
    assert.deepEqual(o, { ok: false, failure: { kind: "offline" } });
  });

  it("reads only the tables and columns it names", () => {
    for (const r of Object.values(READS)) {
      assert.ok(r.table && r.ladder.length > 0);
      for (const columns of r.ladder) assert.ok(columns.split(",").every((c) => /^[a-z_]+$/.test(c)), columns);
    }
  });
});

/* A fake realtime: channels that record what they are asked. */
function fakeRealtime() {
  const made: { topic: string; options: unknown; sent: { event: string; payload: unknown }[]; tracked: unknown[]; untracked: number; handlers: Record<string, (m: { payload?: Record<string, unknown> }) => void>; removed: boolean; subscribed: number }[] = [];
  const rt: RealtimeLike = {
    channel(topic, options) {
      const rec = { topic, options, sent: [] as { event: string; payload: unknown }[], tracked: [] as unknown[], untracked: 0, handlers: {} as Record<string, (m: { payload?: Record<string, unknown> }) => void>, removed: false, subscribed: 0 };
      made.push(rec);
      const ch: ChannelLike = {
        on(type, filter, cb) { rec.handlers[`${type}:${filter.event}`] = cb; return ch; },
        subscribe(cb) { rec.subscribed++; cb?.("SUBSCRIBED"); return ch; },
        send(m) { rec.sent.push({ event: m.event, payload: m.payload }); },
        track(p) { rec.tracked.push(p); },
        untrack() { rec.untracked++; },
      };
      (rec as unknown as { ch: ChannelLike }).ch = ch;
      return ch;
    },
    removeChannel(ch) { const r = made.find((m) => (m as unknown as { ch: ChannelLike }).ch === ch); if (r) r.removed = true; },
  };
  return { rt, made };
}

describe("realtime", () => {
  it("names the topics the server's policies expect", () => {
    assert.equal(walkTopic("FRIENDS", "ABC"), "walk:friends:abc");
    assert.equal(walkTopic("G1", "U1"), "walk:g1:u1");
    assert.equal(chatTopic("G1"), "chat:g1");
  });

  it("joins your own topic privately with presence, and everyone else's privately to listen", () => {
    const { rt, made } = fakeRealtime();
    watchHall(rt, { hall: "g1", me: "ME", people: ["me", "ann", "bob"], onSignal: () => {} });
    assert.deepEqual(made.map((m) => m.topic), ["walk:g1:me", "walk:g1:ann", "walk:g1:bob"], "you are not listened to twice");
    assert.deepEqual(made[0].options, { config: { private: true, presence: { key: "me" }, broadcast: { self: false } } });
    assert.equal((made[1].options as { config: { private: boolean } }).config.private, true);
    assert.equal(made[0].tracked.length, 1, "presence is tracked once subscribed");
  });

  it("turns what it hears into signals, and ignores a tile outside the world", () => {
    const { rt, made } = fakeRealtime();
    const heard: HallSignal[] = [];
    watchHall(rt, { hall: "g1", me: "me", people: ["ann"], onSignal: (s) => heard.push(s) });
    const ann = made[1];
    ann.handlers["broadcast:move"]({ payload: { x: 3, y: 4 } });
    ann.handlers["broadcast:move"]({ payload: { x: 300, y: 4 } });
    ann.handlers["broadcast:move"]({ payload: { x: "3", y: 4 } });
    ann.handlers["presence:join"]({});
    ann.handlers["broadcast:leave"]({});
    assert.deepEqual(heard, [{ kind: "moved", user: "ann", x: 3, y: 4 }, { kind: "here", user: "ann" }, { kind: "left", user: "ann" }]);
  });

  it("listens to at most 50 people", () => {
    const { rt, made } = fakeRealtime();
    watchHall(rt, { hall: "g1", me: "me", people: Array.from({ length: 80 }, (_, i) => `u${i}`), onSignal: () => {} });
    assert.equal(made.length, 1 + MAX_PEOPLE);
  });

  it("sends a step at once, drops a repeat inside the gap, and says leave then tidies up", () => {
    const { rt, made } = fakeRealtime();
    let t = 1000;
    const w = watchHall(rt, { hall: "g1", me: "me", people: [], onSignal: () => {}, now: () => t });
    w.move(3, 4);
    t += 50; w.move(3, 4);
    t += 200; w.move(4, 4);
    w.move(999, 4);
    assert.deepEqual(made[0].sent, [{ event: "move", payload: { x: 3, y: 4 } }, { event: "move", payload: { x: 4, y: 4 } }]);
    w.leave();
    assert.deepEqual(made[0].sent.at(-1), { event: "leave", payload: {} });
    assert.equal(made[0].untracked, 1);
    assert.ok(made.every((m) => m.removed));
    w.move(5, 5);
    assert.equal(made[0].sent.length, 3, "nothing is sent after leaving");
  });

  it("hears a chat ping and stops listening on request", () => {
    const { rt, made } = fakeRealtime();
    let pings = 0;
    const stop = watchChat(rt, "G1", () => pings++);
    assert.equal(made[0].topic, "chat:g1");
    made[0].handlers["broadcast:message"]({});
    assert.equal(pings, 1);
    stop();
    assert.ok(made[0].removed);
  });
});
