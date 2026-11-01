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
import { readPresence } from "../src/lib/social/presence";
import { createSocial } from "../src/lib/social/service";

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
