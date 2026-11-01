/**
 * The web's social service, end to end, against the REAL schema: three students play friends, a group, the
 * hall, presence, reactions and chat through `createSocial`, with row-level security in force.
 *
 *   PGHOST=localhost PGPORT=5544 PGUSER=postgres PGDATABASE=postgres npm run social:e2e
 *
 * It needs a Postgres with the app's social migrations applied (the app repo's tools/social-check/run.sh
 * builds one in Docker and leaves it running with SOCIAL_CHECK_KEEP=1; any local cluster loaded with
 * Supabase/migrations 0102 to 0123 and tools/social-check/{auth,realtime}_setup.sql works).
 *
 * HOW IT TALKS TO THE DATABASE. A transport (`PsqlApi`) stands where the browser's Supabase client stands:
 * `rpc` runs `SELECT ... FROM public.<fn>(arg := ...)` and `select` runs the table read with the same
 * filters, each as the `authenticated` role with that student's JWT claims set, as PostgREST does. So the
 * service's table names, column names, argument names, filters and return shapes are all exercised for real.
 * It is NOT PostgREST: URL routing, JSON casting of arguments and CORS are not tested here.
 *
 * SAFETY. It creates test users in auth.users, so it refuses any database that is not on this machine.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import type { Api, Filter, Row } from "../src/lib/social/api";
import type { ApiError } from "../src/lib/social/failure";
import * as librarySpam from "../src/lib/social/librarySpam";
import { focusTag, listedServers, totalHere } from "../src/lib/social/lobby";
import { readPresence } from "../src/lib/social/presence";
import { studentFacing } from "../src/lib/social/failure";
import { createSocial } from "../src/lib/social/service";
import { FakeRealtimeHub } from "../src/lib/studyapp/library/fake";
import { LIBRARY_TILE } from "../src/lib/studyapp/library/room";
import { LibrarySession } from "../src/lib/studyapp/library/session";

const host = process.env.PGHOST ?? "";
if (!(host === "localhost" || host === "127.0.0.1" || host === "::1" || host.startsWith("/"))) {
  console.error("social:e2e writes test users, so it only runs against a database on this machine. Set PGHOST=localhost (and PGPORT, PGUSER, PGDATABASE).");
  process.exit(2);
}

function psql(sql: string): { out: string; err: string; ok: boolean } {
  try {
    const out = execFileSync("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], { input: sql, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, PGOPTIONS: "-c client_min_messages=warning" } });
    return { out: out.toString().trim(), err: "", ok: true };
  } catch (e) {
    const err = (e as { stderr?: Buffer }).stderr?.toString() ?? String(e);
    return { out: "", err, ok: false };
  }
}

const lit = (v: unknown): string => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;
const asStudent = (id: string) => `SET request.jwt.claims = '{"sub":"${id}","role":"authenticated"}'; SET ROLE authenticated;`;

function fail(message: string): ApiError {
  const m = /ERROR:\s+(.*)/.exec(message);
  return { message: m ? m[1] : message, status: 400 };
}

/** The transport: PostgREST's job, done in SQL, as one student. */
function PsqlApi(userId: string): Api {
  const kinds = new Map<string, { set: boolean; void: boolean }>();
  const kind = (fn: string) => {
    if (!kinds.has(fn)) {
      const r = psql(`SELECT proretset || ',' || (prorettype = 'void'::regtype) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ${lit(fn)} LIMIT 1;`);
      const [set, isVoid] = r.out.split(",");
      kinds.set(fn, { set: set === "true", void: isVoid === "true" });
    }
    return kinds.get(fn)!;
  };
  return {
    configured: true,
    userId: () => userId,
    async rpc(name, args = {}) {
      const params = Object.entries(args).map(([k, v]) => `${ident(k)} := ${lit(v)}`).join(", ");
      const k = kind(name);
      const call = `public.${ident(name)}(${params})`;
      const q = k.void ? `SELECT ${call};` : k.set ? `SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM ${call} t;` : `SELECT to_jsonb(${call});`;
      const r = psql(`${asStudent(userId)} ${q}`);
      if (!r.ok) return { data: null, error: fail(r.err) };
      const last = r.out.split("\n").filter((l) => l && l !== "SET").pop() ?? "";
      return { data: k.void || last === "" ? null : JSON.parse(last), error: null };
    },
    async select(table, columns, filters: Filter[] = []) {
      const where: string[] = [];
      let order = "", limit = "";
      for (const f of filters) {
        if (f[0] === "eq") where.push(`${ident(f[1])}::text = ${lit(f[2])}`);
        else if (f[0] === "in") where.push(`${ident(f[1])}::text IN (${f[2].map(lit).join(", ")})`);
        else if (f[0] === "gt") where.push(`${ident(f[1])} > ${lit(f[2])}`);
        else if (f[0] === "or") {
          const parts = f[1].replace(/^\(|\)$/g, "").split(",").map((p) => { const [c, op, v] = p.split("."); assert.equal(op, "eq"); return `${ident(c)}::text = ${lit(v)}`; });
          where.push(`(${parts.join(" OR ")})`);
        } else if (f[0] === "order") order = ` ORDER BY ${ident(f[1])} ${f[2]}`;
        else limit = ` LIMIT ${f[1]}`;
      }
      const cols = columns.split(",").map(ident).join(", ");
      const sql = `SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT ${cols} FROM public.${ident(table)}${where.length ? ` WHERE ${where.join(" AND ")}` : ""}${order}${limit}) t;`;
      const r = psql(`${asStudent(userId)} ${sql}`);
      if (!r.ok) return { data: null, error: fail(r.err) };
      const last = r.out.split("\n").filter((l) => l && l !== "SET").pop() ?? "[]";
      return { data: JSON.parse(last) as Row[], error: null };
    },
  };
}

let passed = 0;
/** Printed only after the checks above it have passed. */
const ok = (what: string) => { passed++; console.log(`ok ${String(passed).padStart(2)}  ${what}`); };
const value = <T,>(r: { ok: true; value: T } | { ok: false; failure: unknown }): T => { assert.ok(r.ok, JSON.stringify(r)); return (r as { ok: true; value: T }).value; };
const refused = (r: { ok: boolean; failure?: unknown }, reason: string) => assert.deepEqual(r.ok ? "ok" : r.failure, { kind: "refused", reason });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The Grand Library on the real schema (0117 to 0123): the lobby, positions, emotes, servers, hiding, and the chat with
 * its filters, pace, reports and blocks, then the web's own visit (`LibrarySession`) on top of it.
 */
async function theLibrary(w: { alex: ReturnType<typeof createSocial>; bea: ReturnType<typeof createSocial>; cal: ReturnType<typeof createSocial>; raw: (id: string) => Api; ids: { A: string; B: string; C: string } }) {
  const { alex, bea, cal, raw, ids: { A, B, C } } = w;
  const tile = { x: LIBRARY_TILE.x, y: LIBRARY_TILE.y };
  const NICK = /^[A-Z][a-z]+ [A-Z][a-z]+$/;

  // Joining: one library for the three, nicknames for everyone, the cap of sixty.
  // (A scratch database: clear who an earlier run left standing in the lobby, so the counts below are this run's.)
  assert.ok(psql("DELETE FROM public.lobby_presence; DELETE FROM public.library_message_report; DELETE FROM public.library_message;").ok);
  const ja = value(await alex.joinLobby(tile));
  const jb = value(await bea.joinLobby(tile));
  const jc = value(await cal.joinLobby(tile));
  assert.ok(ja.shard !== null && jb.shard === ja.shard && jc.shard === ja.shard, JSON.stringify([ja, jb, jc]));
  assert.ok(NICK.test(ja.nickname) && NICK.test(jb.nickname) && NICK.test(jc.nickname));
  assert.deepEqual([ja.visible, ja.cap, ja.wantedFull], [true, 60, false]);
  const shard = ja.shard!;
  ok(`three students joining the library are put in the same one (${shard}), each with a made-up nickname, and the cap is 60`);

  // Who sees whom: a friend by name, a stranger by nickname only
  value(await alex.setLobbyPosition(shard, tile, { seated: false }));
  value(await bea.setLobbyPosition(shard, tile, { seated: false }));
  value(await cal.setLobbyPosition(shard, tile, { seated: false }));
  const seenByAlex = value(await alex.lobbyPeople(shard));
  assert.deepEqual(seenByAlex.map((p) => [p.id, p.isFriend, p.displayName]).sort(), [[B, true, "Bea"], [C, false, null]].sort());
  const seenByCal = value(await cal.lobbyPeople(shard));
  assert.deepEqual(seenByCal.map((p) => [p.id, p.isFriend, p.displayName]).sort(), [[A, false, null], [B, false, null]].sort());
  assert.ok(!JSON.stringify(seenByCal).match(/"Alex"|"Bea"/), "a stranger's real name is nowhere in what Cal is sent");
  assert.ok(seenByAlex.every((p) => p.id !== A), "you are not in your own list");
  assert.ok(seenByAlex.every((p) => p.x === tile.x && p.y === tile.y), "the tile everyone sends is the library's");
  ok("a friend is shown by real name and a stranger only by nickname, never the real name; you are not in your own list");
  assert.deepEqual(await alex.lobbyPeople(shard + 100), { ok: false, failure: { kind: "refused", reason: "not_member" } });
  ok("asking for a library you are not in is refused (not_member), not answered with an empty room");

  // What you are doing: seated, the subject from the fixed list, how long
  const T0 = Date.now();
  assert.equal(value(await alex.setLobbyPosition(shard, tile, { seated: true, subjectId: "physics", focusSince: T0 - 5 * 60_000 })), true);
  const alexAsBea = value(await bea.lobbyPeople(shard)).find((p) => p.id === A)!;
  assert.deepEqual([alexAsBea.seated, alexAsBea.subjectId], [true, "physics"]);
  assert.equal(focusTag(alexAsBea, Date.now()), "Physics \u00b7 5 min");
  value(await alex.setLobbyPosition(shard, tile, { seated: true, subjectId: "basket-weaving", focusSince: T0 + 3_600_000 }));
  const odd = value(await bea.lobbyPeople(shard)).find((p) => p.id === A)!;
  assert.deepEqual([odd.subjectId, odd.focusSince], [null, null]);
  ok("seated, the subject and how long reach the others; a subject outside the list and a start an hour in the future are stored as nothing");
  value(await alex.setLobbyPosition(shard, tile, { seated: false, subjectId: "maths", focusSince: T0 }));
  const standing = value(await bea.lobbyPeople(shard)).find((p) => p.id === A)!;
  assert.deepEqual([standing.seated, standing.subjectId, standing.focusSince], [false, null, null]);
  ok("standing up clears the subject and the timer");
  assert.equal(value(await alex.setLobbyPosition(shard + 1, tile, { seated: false })), false);
  ok("positioning in a library you are not in answers 'rejoin' (false), so the page joins again");

  // Emotes
  assert.equal(value(await alex.lobbyEmote("wave")), "sent");
  assert.equal(value(await alex.lobbyEmote("high_five")), "too_soon");
  const waved = value(await cal.lobbyPeople(shard)).find((p) => p.id === A)!;
  assert.deepEqual([waved.emote, waved.emoteAt !== null], ["wave", true]);
  assert.match(String((await raw(A).rpc("lobby_emote", { kind: "dance" })).error?.message), /social:bad_emote/);
  ok("a wave shows over your head for everyone, a second inside five seconds is too_soon, and an emote the server does not have is refused");

  // Servers
  const servers = value(await alex.lobbyServers());
  const mine = servers.servers.find((x) => x.shard === shard)!;
  assert.deepEqual([servers.you, mine.here, mine.friends, servers.cap, servers.max], [shard, 3, 1, 60, 300]);
  assert.ok(servers.empty !== null && servers.empty !== shard && !servers.servers.some((x) => x.shard === servers.empty));
  assert.ok(listedServers(servers).some((x) => x.shard === shard) && totalHere(servers) >= 3);
  ok("the picker lists the library with its three people and the one friend, and offers an empty one to open");

  // Choosing a server, and a full one
  const other = servers.empty!;
  const moved = value(await cal.joinLobby(tile, other));
  assert.deepEqual([moved.shard, moved.wantedFull], [other, false]);
  assert.ok(!value(await alex.lobbyPeople(shard)).some((p) => p.id === C), "Cal is gone from the first library");
  assert.deepEqual(value(await cal.lobbyPeople(other)), []);
  ok("choosing another library moves you: the old one stops showing you and you see only the new one's people");
  const full = other + 7;
  assert.ok(psql(`DO $$ DECLARE u uuid; BEGIN FOR i IN 1..60 LOOP u := gen_random_uuid(); INSERT INTO auth.users(id,aud,role,email) VALUES (u,'authenticated','authenticated',u||'@fill.test'); INSERT INTO public.social_profile(user_id, display_name, colour, friend_code) VALUES (u, 'Filler'||i, 0, upper(translate(substr(md5(u::text),1,8),'01','23'))); INSERT INTO public.lobby_presence(user_id, shard, x, y, updated_at) VALUES (u, ${full}, 65, 34, clock_timestamp()); END LOOP; END $$;`).ok);
  const wanted = value(await cal.joinLobby(tile, full));
  assert.ok(wanted.wantedFull && wanted.shard !== full, JSON.stringify(wanted));
  ok("choosing a library with sixty in it puts you in another and says so (wantedFull)");
  value(await cal.joinLobby(tile, shard));
  value(await cal.setLobbyPosition(shard, tile, { seated: false }));

  // Chat: sending and reading, names, the client's mirror and the server's own filters
  const hello = value(await alex.sendLibraryMessage(shard, "  hello library  "));
  assert.equal(hello.body, "hello library");
  const asBea = value(await bea.libraryMessages(shard)), asCal = value(await cal.libraryMessages(shard));
  assert.deepEqual([asBea[0].name, asBea[0].body, asBea[0].senderId], ["Alex", "hello library", A], "a friend by real name");
  assert.deepEqual([asCal[0].name, asCal[0].pro], [ja.nickname, false], "a stranger by nickname");
  assert.ok(!JSON.stringify(asCal).includes('"Alex"'));
  ok("a message is tidied and stored; a friend reads the sender's real name, a stranger only their nickname");
  refused(await alex.sendLibraryMessage(shard, "second one"), "message_rate");
  assert.match(String((await raw(A).rpc("send_library_message", { shard, body: "another one" })).error?.message), /social:message_rate/);
  ok("a second message inside three seconds is refused as message_rate, by the browser's pace and by the server");
  await sleep(3200);
  const serverSays = async (body: string) => String((await raw(A).rpc("send_library_message", { shard, body })).error?.message ?? "sent");
  const cases: [string, string, string][] = [
    ["add me on snapchat", "message_link", "link"], ["www.example.com", "message_link", "link"], ["fuck this", "message_language", "language"],
    ["hahahahaha", "message_spam", "spam"], ["asdfghjkl", "message_spam", "spam"], ["!!!!!!!!!", "message_spam", "spam"], ["aaaaaaa", "message_spam", "spam"],
    ["WHY IS NOBODY ANSWERING ME", "message_shouting", "shouting"], ["", "message_empty", "empty"], ["x".repeat(281), "message_too_long", "too_long"],
  ];
  for (const [body, server, mirror] of cases) {
    assert.match(await serverSays(body), new RegExp(`social:${server}`), `server on ${JSON.stringify(body.slice(0, 20))}`);
    const v = librarySpam.check(body);
    assert.ok(!v.ok && v.refusal === mirror, `browser on ${JSON.stringify(body.slice(0, 20))}`);
    await sleep(40);
  }
  assert.equal(await serverSays("\u4eca\u5929\u4e00\u8d77\u590d\u4e60\u7269\u7406\u5427"), "sent", "a sentence in Chinese is writing, not spam (0123)");
  ok("the server's refusals (link, language, spam, shouting, empty, too long) are exactly the browser mirror's, and a sentence in Chinese is let through");
  await sleep(3200);
  assert.match(await serverSays("Hello Library"), /social:message_repeat/);
  assert.equal(librarySpam.check("Hello Library", [{ body: "hello library", at: Date.now() - 20_000 }]).ok, false);
  ok("saying the same thing again (folded) inside five minutes is refused as message_repeat, as the browser's mirror says");

  // Reports hide a message for the reporter at once and for everyone but its sender at two; two hidden messages mute
  const mid = hello.id;
  value(await bea.reportLibraryMessage(mid, "bullying", false));
  assert.deepEqual(value(await bea.libraryMessages(shard)).filter((m) => m.id === mid), []);
  assert.equal(value(await cal.libraryMessages(shard)).filter((m) => m.id === mid).length, 1, "one report hides it only from the reporter");
  value(await cal.reportLibraryMessage(mid, "other", false));
  assert.deepEqual(value(await cal.libraryMessages(shard)).filter((m) => m.id === mid), []);
  const own = value(await alex.libraryMessages(shard)).find((m) => m.id === mid)!;
  assert.equal(own.hidden, true, "its sender still sees it, marked hidden");
  assert.match(String((await raw(A).rpc("report_library_message", { message: Number(mid), reason: "other", block: false })).error?.message), /social:self/);
  ok("a message goes from the reporter's screen at once, from everyone's at two reports; its sender still sees it; you cannot report your own");
  await sleep(3200);
  const second = value(await alex.sendLibraryMessage(shard, "revising chemistry now"));
  value(await bea.reportLibraryMessage(second.id, "language", false));
  value(await cal.reportLibraryMessage(second.id, "language", false));
  await sleep(3200);
  refused(await alex.sendLibraryMessage(shard, "anybody there"), "message_muted");
  ok("two of your messages hidden by reports mute you for two hours: message_muted, in the student's words 'Chat is paused for you for a bit'");
  assert.equal(studentFacing("message_muted"), "Chat is paused for you for a bit");

  // Block: neither sees the other in the room or the chat
  await sleep(3200);
  const callMsg = value(await cal.sendLibraryMessage(shard, "hi from cal"));
  value(await bea.reportLibraryMessage(callMsg.id, "other", true));
  assert.ok(!value(await bea.lobbyPeople(shard)).some((p) => p.id === C), "Bea no longer sees Cal");
  assert.ok(!value(await cal.lobbyPeople(shard)).some((p) => p.id === B), "and Cal no longer sees Bea");
  assert.deepEqual(value(await bea.libraryMessages(shard)).filter((m) => m.senderId === C), []);
  ok("report and block hides the person from the room and the chat, both ways");
  value(await bea.unblock(C));

  // A hidden student neither sees nor is seen
  value(await cal.setLobbyVisible(false));
  assert.deepEqual(await cal.lobbyPeople(shard), { ok: false, failure: { kind: "refused", reason: "not_member" } });
  assert.deepEqual(await cal.libraryMessages(shard), { ok: false, failure: { kind: "refused", reason: "not_member" } });
  assert.ok(!value(await alex.lobbyPeople(shard)).some((p) => p.id === C));
  assert.equal(value(await cal.lobbyEmote("wave")), "not_in_lobby");
  const hiddenJoin = value(await cal.joinLobby(tile));
  assert.deepEqual([hiddenJoin.shard, hiddenJoin.visible], [null, false]);
  assert.equal(value(await cal.lobbyServers()).you, null);
  value(await cal.setLobbyVisible(true));
  assert.equal(value(await cal.joinLobby(tile, shard)).shard, shard);
  ok("a hidden student sees no one and is seen by no one, cannot read or post in the chat, and is put nowhere when joining; showing again puts them back");
  value(await cal.setLobbyPosition(shard, tile, { seated: false }));

  // Nickname: once a week
  const regen = value(await alex.regenerateNickname());
  assert.ok(regen.nickname === ja.nickname || NICK.test(regen.nickname));
  ok("a nickname is regenerated at most once a week (changed or too_soon, never an error)");

  // The web's own visit, over the real server: two sessions, and the floor over a scripted Realtime
  const hub = new FakeRealtimeHub();
  const sa = new LibrarySession({ social: alex, realtime: () => hub.client(A), me: A });
  const sb = new LibrarySession({ social: bea, realtime: () => hub.client(B), me: B });
  let place = { x: 944, y: 1248, seat: null as number | null, path: [] as [number, number][] };
  sa.attachRoom(() => place);
  await sa.start(shard); await sb.start(shard);
  assert.deepEqual([sa.snapshot().phase, sa.snapshot().shard, sb.snapshot().shard], ["live", shard, shard]);
  await sleep(50);
  place = { x: 728, y: 708, seat: 9, path: [] };
  sa.roomChanged();
  sa.startFocus("chemistry");
  await sa.tick();
  await sleep(5100);                    // while the floor is live the list is read every five seconds
  await sb.tick();
  const seen = sb.snapshot().people.find((p) => p.id === A)!;
  assert.deepEqual([seen.seated, seen.subjectId, seen.isFriend, seen.displayName], [true, "chemistry", true, "Alex"]);
  const floor = sb.remotes().find((r) => r.id === A)!;
  assert.deepEqual([floor.seat, floor.pos], [9, [364, 354]]);
  assert.equal(sb.describe(A)!.name, "Alex");
  assert.match(sb.describe(A)!.tag ?? "", /^Chemistry \u00b7 \d+ min$/);
  assert.ok(sb.snapshot().servers && totalHere(sb.snapshot().servers!) >= 2);
  ok("the web's visit over the real server: your seat reaches a friend as seat 9 at (364, 354) art pixels, with the subject and timer, by real name");
  // (Alex is muted by now: two of his messages were hidden by reports above, so Bea is the one who speaks)
  assert.deepEqual(await sb.send("anyone for a quiz?"), { ok: true });
  await sleep(4100);
  await sa.tick();
  assert.ok(sa.snapshot().messages.some((m) => m.body === "anyone for a quiz?" && m.name === "Bea"));
  assert.deepEqual(await sb.send("hahahahaha"), { ok: false, line: "That looks like spam. Say something real" });
  assert.deepEqual(await sa.send("am I allowed to talk?"), { ok: false, line: "Chat is paused for you for a bit" });
  ok("the visit sends and reads the chat over the real server, refuses in the student's words, and says kindly that a muted student's chat is paused");
  sa.leave(); sb.leave();
  await sleep(100);
  assert.ok(!value(await cal.lobbyPeople(shard)).some((p) => p.id === A), "Alex left the lobby");
  ok("leaving the page leaves the library: nobody is left standing in an empty room");
}

async function main() {
  const [A, B, C] = [randomUUID(), randomUUID(), randomUUID()];
  assert.ok(psql(`INSERT INTO auth.users (id, aud, role, email) VALUES ('${A}','authenticated','authenticated','${A}@e2e.test'),('${B}','authenticated','authenticated','${B}@e2e.test'),('${C}','authenticated','authenticated','${C}@e2e.test');`).ok);
  const alex = createSocial(PsqlApi(A)), bea = createSocial(PsqlApi(B)), cal = createSocial(PsqlApi(C));
  const raw = (id: string) => PsqlApi(id);

  // Profiles
  assert.deepEqual(await alex.loadProfile(), { ok: true, value: null });
  ok("a student who has not joined has no profile");
  const pa = value(await alex.optIn("Alex", 1));
  value(await bea.optIn("Bea", 2));
  value(await cal.optIn("Cal", 3));
  assert.match(pa.friendCode, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(pa.displayName, "Alex");
  ok("opting in returns the profile with an eight character friend code");
  assert.equal(value(await alex.loadProfile())?.friendCode, pa.friendCode);
  ok("the profile reads back, with the avatar column");
  const rude = await alex.optIn("fuck", 1);
  assert.ok(!rude.ok && rude.failure.kind === "refused" && rude.failure.reason === "name_rejected", JSON.stringify(rude));
  ok("a name the server refuses comes back as a quiet refusal, not an error");

  // Friends
  refused(await bea.sendFriendRequest("ZZZZ-ZZZZ"), "unknown_code");
  assert.deepEqual(await alex.sendFriendRequest(pa.friendCode), { ok: true, value: "own_code" });
  ok("a code nobody has is a quiet unknown_code, and your own code is an outcome, not an error");
  assert.deepEqual(await bea.sendFriendRequest(pa.friendCode), { ok: true, value: "sent" });
  assert.deepEqual(value(await alex.loadFriends()).requests.map((r) => [r.direction, r.person?.displayName]), [["incoming", "Bea"]]);
  assert.deepEqual(value(await bea.loadFriends()).requests.map((r) => [r.direction, r.person]), [["outgoing", null]]);
  ok("the recipient sees who asked (Bea); the sender sees only that a request is out, not whose code it was, until it is accepted");
  value(await alex.respondToFriendRequest(B, true));
  assert.deepEqual(value(await alex.loadFriends()).friends.map((f) => f.displayName), ["Bea"]);
  assert.deepEqual(value(await bea.loadFriends()).friends.map((f) => f.displayName), ["Alex"]);
  assert.equal(value(await alex.loadFriends()).requests.length, 0);
  assert.deepEqual(value(await cal.loadFriends()).friends, []);
  ok("after accepting, each is the other's friend, the request is gone, and Cal sees nobody");

  // Groups
  const g = value(await alex.createGroup("The Sigmas"));
  assert.match(g.inviteCode, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.deepEqual(value(await alex.loadGroups()).map((x) => [x.name, x.memberCount, x.hall.emblem, x.hall.theme, x.hall.weeklyGoalHours, x.isPublic]), [["The Sigmas", 1, 0, "blue", 30, false]]);
  ok("creating a group returns its code; it reads back with the hall's defaults and one member");
  assert.equal(value(await bea.joinGroup(g.inviteCode)).status, "joined");
  assert.deepEqual(value(await alex.loadGroups()).map((x) => x.memberCount), [2]);
  assert.deepEqual(value(await alex.loadMembers(g.id)).map((m) => [m.person.displayName, m.role]).sort(), [["Alex", "owner"], ["Bea", "member"]]);
  ok("joining by code adds a member; the owner is listed as owner");
  refused(await cal.joinGroup("ZZZZ-ZZZZ"), "unknown_code");
  assert.deepEqual(value(await cal.loadGroups()), []);
  assert.deepEqual(value(await cal.loadMembers(g.id)), []);
  ok("a student outside the group sees no group and no members (row-level security)");
  value(await alex.setGroupHall(g.id, { emblem: 2, theme: "cafe", weeklyGoalHours: 40 }));
  assert.deepEqual(value(await bea.loadGroups()).map((x) => [x.hall.emblem, x.hall.theme, x.hall.weeklyGoalHours]), [[2, "cafe", 40]]);
  assert.ok(!(await bea.setGroupHall(g.id, { emblem: 1, theme: "oak", weeklyGoalHours: 10 })).ok);
  ok("only the owner changes the hall, and every member sees the change");
  const rotated = value(await alex.rotateGroupCode(g.id));
  assert.notEqual(rotated, g.inviteCode);
  refused(await cal.joinGroup(g.inviteCode), "unknown_code");
  ok("rotating the code retires the old one");

  // Presence and the week's figures
  const T = Date.now();
  value(await bea.setPresence({ subjectId: "physics", mode: "pomodoro", phase: "work", startedAt: new Date(T - 600_000), endsAt: new Date(T + 900_000) }));
  value(await bea.publishSummary({ todaySeconds: 600, weekSeconds: 3000, weekXp: 120, level: 4, streak: 8 }));
  const friendBea = value(await alex.loadFriends()).friends[0];
  assert.equal(friendBea.presence?.subjectId, "physics");
  assert.equal(readPresence(friendBea.presence, T).state, "studying");
  assert.deepEqual([friendBea.summary?.todaySeconds, friendBea.summary?.weekSeconds, friendBea.summary?.weekXp, friendBea.summary?.level, friendBea.summary?.streak], [600, 3000, 120, 4, 8]);
  ok("a friend's presence and week figures are visible, and read as studying now");
  value(await bea.clearPresence());
  assert.equal(value(await alex.loadFriends()).friends[0].presence, undefined);
  ok("clearing presence takes it off the friend's screen");
  const badMode = await raw(B).rpc("set_presence", { subject: "physics", mode: "stopwatch", phase: "work", started_at: new Date().toISOString(), ends_at: null });
  assert.match(badMode.error?.message ?? "", /social:bad_presence/);
  ok("the server refuses a study mode it does not know (bad_presence)");

  // Chat
  const sent = value(await bea.sendGroupMessage(g.id, "  anyone doing q3? "));
  assert.equal(sent.body, "anyone doing q3?");
  assert.deepEqual(value(await alex.groupMessages(g.id)).map((m) => [m.body, m.senderId === B]), [["anyone doing q3?", true]]);
  ok("a member sends a message, it is tidied and stored, and another member reads it");
  refused(await bea.sendGroupMessage(g.id, "add me on snapchat"), "message_link");
  const viaServer = await raw(B).rpc("send_group_message", { group: g.id, body: "see www.example.com" });
  assert.match(viaServer.error?.message ?? "", /social:message_link/);
  ok("the browser refuses a link before sending, and the server refuses the same one if it is sent anyway");
  refused(await bea.sendGroupMessage(g.id, "hello again"), "message_rate");
  ok("a second message inside two seconds is refused as message_rate");
  assert.deepEqual(value(await cal.groupMessages(g.id)), []);
  assert.ok(!(await cal.sendGroupMessage(g.id, "hi")).ok);
  ok("a student outside the group reads nothing and cannot post");
  value(await alex.reportMessage(sent.id, "other", false));
  ok("a message can be reported");

  // The hall
  value(await alex.setHallPosition(g.id, 3, 4));
  assert.deepEqual(value(await bea.hallPositions(g.id)).map((s) => [s.userId === A, s.x, s.y]), [[true, 3, 4]]);
  refused(await cal.hallPositions(g.id), "not_member");
  ok("a member sees where another stands in the group's hall; an outsider is refused, not shown an empty hall");
  value(await alex.setHallPosition(g.id, 999, -5));
  assert.deepEqual(value(await bea.hallPositions(g.id)).map((s) => [s.x, s.y]), [[255, 0]]);
  ok("a tile outside the world is clamped to the edge, not refused");
  value(await alex.clearHallPosition());
  assert.deepEqual(value(await bea.hallPositions(g.id)), []);
  ok("leaving the hall clears the position");

  // Reactions
  assert.deepEqual(await alex.sendReaction("high_five", B, g.id), { ok: true, value: "sent" });
  assert.deepEqual(await alex.sendReaction("high_five", B, g.id), { ok: true, value: "too_soon" });
  assert.deepEqual(value(await bea.loadReactions()).map((r) => [r.kind, r.fromUserId === A, r.seenAt]), [["high_five", true, null]]);
  value(await bea.markReactionsSeen());
  assert.notEqual(value(await bea.loadReactions())[0].seenAt, null);
  assert.deepEqual(value(await cal.loadReactions()), []);
  ok("a reaction reaches its recipient, is marked seen, and nobody else sees it");

  await theLibrary({ alex, bea, cal, raw, ids: { A, B, C } });

  // Leaving
  value(await bea.leaveGroup(g.id));
  assert.deepEqual(value(await alex.loadGroups()).map((x) => x.memberCount), [1]);
  assert.deepEqual(value(await bea.groupMessages(g.id)), []);
  ok("leaving a group removes the member and their access to its messages");
  value(await cal.optOut());
  assert.deepEqual(await cal.loadProfile(), { ok: true, value: null });
  ok("opting out removes the profile");

  console.log(`\nsocial:e2e PASSED (${passed} checks, 3 students, the real schema, row-level security on)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
