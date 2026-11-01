import { READS, RPC, type Api, type Filter, type Row } from "./api";
import * as chat from "./chatRules";
import { fail, failureFor, ok, type Failure, type Result } from "./failure";
import { parseCode } from "./friendCode";
import { check as libraryCheck, type Said } from "./librarySpam";
import {
  byMessageTime, lobbyDecode, sanitised, type LibraryMessage, type LobbyEmote, type LobbyEmoteOutcome, type LobbyJoin, type LobbyMe,
  type LobbyPerson, type LobbyServers,
} from "./lobby";
import {
  MAX_TILE, REACTION_KINDS,
  type FriendRequest, type FriendRequestOutcome, type FriendsSnapshot, type GroupHall, type GroupMember, type GroupMessage,
  type GroupReaction, type GroupRole, type HallSpot, type HallTheme, type MessageReportReason, type PresenceUpdate,
  type ReactionKind, type ReactionOutcome, type SocialAvatar, type SocialPerson, type SocialProfile, type SocialSummary, type StudyGroup,
  type StudyPresence, type SummaryFigures, type UserReportReason,
} from "./types";

/**
 * Friends, study groups and the study hall for the website: the iPad's SocialService, over the same
 * Supabase project and the same functions (Supabase/migrations/0104 to 0123 in the app repo).
 *
 * Every call returns a Result and never throws at a view. Reads are table reads under row-level
 * security; every write is an RPC. The server decides everything that matters (who may see whom, the
 * chat's words, rate limits); this layer only asks, and turns a refusal into a value a screen can show.
 * What it does check first is cheap and kind: a malformed code, a message the chat will refuse.
 */

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const iso = (d: Date) => d.toISOString();

const clampTile = (n: number) => Math.min(MAX_TILE, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));

/** What a refusal from the library's checks is called in the quiet failures. */
const LIBRARY_REASON = {
  empty: "message_empty", too_long: "message_too_long", link: "message_link", language: "message_language",
  spam: "message_spam", shouting: "message_shouting", repeat: "message_repeat",
} as const;

const clampColour = (n: number | null) => ((n ?? 0) % 16 + 16) % 16;

function avatarOf(v: unknown): SocialAvatar | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: SocialAvatar = {};
  for (const [k, val] of Object.entries(v)) if (typeof val === "string") out[k] = val;
  return Object.keys(out).length > 0 ? out : null;
}

/* ── Decoding: rows to values. Pure, and tested. ─────────────────────── */

export const decode = {
  profile(row: Row): SocialProfile | null {
    const userId = str(row.user_id), displayName = str(row.display_name), friendCode = str(row.friend_code);
    if (!userId || !displayName || !friendCode) return null;
    return { userId, displayName, colour: clampColour(num(row.colour)), friendCode, optedInAt: str(row.opted_in_at) };
  },
  person(row: Row): SocialPerson | null {
    const id = str(row.user_id), displayName = str(row.display_name);
    if (!id || !displayName) return null;
    return { id, displayName, colour: clampColour(num(row.colour)), avatar: avatarOf(row.avatar) };
  },
  presence(row: Row): StudyPresence | null {
    const subjectId = str(row.subject_id), startedAt = str(row.started_at);
    const mode = row.mode === "timer" || row.mode === "pomodoro" ? row.mode : null;
    const phase = row.phase === "work" || row.phase === "break" ? row.phase : null;
    if (!subjectId || !startedAt || !mode || !phase) return null;
    return { subjectId, mode, phase, startedAt, endsAt: str(row.ends_at), expiresAt: str(row.expires_at) };
  },
  summary(row: Row): SocialSummary | null {
    if (!str(row.user_id)) return null;
    return {
      day: str(row.day), todaySeconds: num(row.today_seconds) ?? 0, weekSeconds: num(row.week_seconds) ?? 0,
      weekXp: num(row.week_xp) ?? 0, level: num(row.level) ?? 1, streak: num(row.streak) ?? 0,
      streakDay: str(row.streak_day), updatedAt: str(row.updated_at),
    };
  },
  group(row: Row, counts: Map<string, number>): StudyGroup | null {
    const id = str(row.id), name = str(row.name), ownerId = str(row.owner_id);
    if (!id || !name || !ownerId) return null;
    const theme = row.hall_theme;
    const hall: GroupHall = {
      emblem: num(row.emblem) ?? 0,
      theme: theme === "oak" || theme === "blue" || theme === "night" || theme === "cafe" ? (theme as HallTheme) : "blue",
      weeklyGoalHours: num(row.weekly_goal_hours) ?? 30,
    };
    return {
      id, name, inviteCode: str(row.invite_code), ownerId, createdAt: str(row.created_at) ?? "", memberCount: counts.get(id) ?? 1,
      hall, isPublic: row.visibility === "public",
    };
  },
  message(row: Row): GroupMessage | null {
    const id = row.id, groupId = str(row.group_id), senderId = str(row.sender), body = str(row.body);
    if ((typeof id !== "number" && typeof id !== "string") || !groupId || !senderId || body === null) return null;
    return { id: String(id), groupId, senderId, body, createdAt: str(row.created_at) ?? "", hidden: row.hidden === true };
  },
  reaction(row: Row): GroupReaction | null {
    const id = num(row.id), groupId = str(row.group_id), from = str(row.user_id), to = str(row.to_user);
    const kind = REACTION_KINDS.find((k) => k === row.kind);
    if (id === null || !groupId || !from || !to || !kind) return null;
    return { id, groupId, fromUserId: from, toUserId: to, kind, createdAt: str(row.created_at) ?? "", seenAt: str(row.seen_at) };
  },
  spot(row: Row): HallSpot | null {
    const userId = str(row.user_id), x = num(row.x), y = num(row.y);
    return userId && x !== null && y !== null ? { userId, x, y, updatedAt: str(row.updated_at) ?? "" } : null;
  },
};

/** The messages in the order a chat shows them: oldest first, ties by id. */
export const byTime = (a: GroupMessage, b: GroupMessage) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : (Number(a.id) || 0) - (Number(b.id) || 0);

/* ── The service ─────────────────────────────────────────────────────── */

export function createSocial(api: Api) {
  /** Run `work` as the signed-in student: not configured, signed out, a thrown error, all as a Failure. */
  async function run<T>(work: (me: string) => Promise<Result<T>>): Promise<Result<T>> {
    if (!api.configured) return fail({ kind: "notConfigured" });
    const me = api.userId();
    if (!me) return fail({ kind: "signedOut" });
    try {
      return await work(me);
    } catch (e) {
      return fail(failureFor({ message: e instanceof Error ? e.message : String(e) }));
    }
  }

  const rpc = async (key: keyof typeof RPC, args: Record<string, unknown> = {}) => {
    const { data, error } = await api.rpc(RPC[key].name, args);
    return error ? { failure: failureFor(error), data: null } : { failure: null, data };
  };

  async function read(table: string, columns: string, filters: Filter[] = []): Promise<{ rows: Row[]; failure: Failure | null }> {
    const { data, error } = await api.select(table, columns, filters);
    if (error) return { rows: [], failure: failureFor(error) };
    return { rows: data ?? [], failure: null };
  }

  /**
   * Read with the newest columns the server will give: a server that lacks a later migration refuses a
   * select naming its columns (`unavailable`), so the next, older set is tried. A refusal that is not
   * about columns (offline, signed out) stops at once.
   */
  async function readLadder(def: { table: string; ladder: readonly string[] }, filters: Filter[] = []) {
    let last: { rows: Row[]; failure: Failure | null } = { rows: [], failure: { kind: "unavailable" } };
    for (const columns of def.ladder) {
      last = await read(def.table, columns, filters);
      if (!last.failure || last.failure.kind !== "unavailable") return last;
    }
    return last;
  }

  /** A write whose answer we do not need. */
  const write = (key: keyof typeof RPC, args?: Record<string, unknown>): Promise<Result<void>> =>
    run(async () => {
      const r = await rpc(key, args);
      return r.failure ? fail(r.failure) : ok(undefined);
    });

  const inList = (ids: string[]): Filter => ["in", "user_id", ids];

  /** Profiles for `ids`, with presence and summary for `active`. Anyone the server does not return is absent. */
  async function people(ids: string[], active: string[]): Promise<{ people: Map<string, SocialPerson>; failure: Failure | null }> {
    const found = new Map<string, SocialPerson>();
    if (ids.length === 0) return { people: found, failure: null };
    const profiles = await readLadder(READS.people, [inList(ids)]);
    if (profiles.failure) return { people: found, failure: profiles.failure };
    for (const row of profiles.rows) { const p = decode.person(row); if (p) found.set(p.id, p); }
    const activeIds = active.filter((id) => found.has(id));
    if (activeIds.length > 0) {
      const pres = await readLadder(READS.presence, [inList(activeIds)]);
      for (const row of pres.rows) { const p = decode.presence(row); const id = str(row.user_id); if (p && id && found.has(id)) found.get(id)!.presence = p; }
      const sums = await readLadder(READS.summary, [inList(activeIds)]);
      for (const row of sums.rows) { const s = decode.summary(row); const id = str(row.user_id); if (s && id && found.has(id)) found.get(id)!.summary = s; }
    }
    return { people: found, failure: null };
  }

  return {
    get configured() { return api.configured; },

    /* Profile */
    loadProfile: () => run<SocialProfile | null>(async (me) => {
      const r = await readLadder(READS.profile, [["eq", "user_id", me]]);
      if (r.failure) return fail(r.failure);
      return ok(r.rows[0] ? decode.profile(r.rows[0]) : null);
    }),
    optIn: (displayName: string, colour: number) => run<SocialProfile>(async () => {
      const r = await rpc("optIn", { display_name: displayName, colour });
      if (r.failure) return fail(r.failure);
      const p = r.data && typeof r.data === "object" ? decode.profile(r.data as Row) : null;
      return p ? ok(p) : fail({ kind: "unavailable" });
    }),
    optOut: () => write("optOut"),

    /* Friends */
    loadFriends: () => run<FriendsSnapshot>(async (me) => {
      const links = await readLadder(READS.friendship, [["or", `(user_id.eq.${me},friend_id.eq.${me})`]]);
      if (links.failure) return fail(links.failure);
      const pairs = links.rows.flatMap((row) => {
        const a = str(row.user_id), b = str(row.friend_id);
        if (!a || !b || a === b || (a !== me && b !== me)) return [];
        return [{ other: a === me ? b : a, outgoing: a === me, accepted: String(row.status).toLowerCase() === "accepted", createdAt: str(row.created_at) ?? "" }];
      });
      const others = [...new Set(pairs.map((p) => p.other))].sort();
      const accepted = [...new Set(pairs.filter((p) => p.accepted).map((p) => p.other))].sort();
      const found = await people(others, accepted);
      if (found.failure) return fail(found.failure);
      const friends = accepted.flatMap((id) => (found.people.has(id) ? [found.people.get(id)!] : []));
      const requests: FriendRequest[] = pairs.filter((p) => !p.accepted).map((p) => ({
        otherUserId: p.other, direction: (p.outgoing ? "outgoing" : "incoming") as FriendRequest["direction"], person: found.people.get(p.other) ?? null, createdAt: p.createdAt,
      })).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      return ok({ friends, requests });
    }),
    /** A malformed code never leaves the browser. */
    sendFriendRequest: (code: string) => run<FriendRequestOutcome>(async () => {
      const clean = parseCode(code);
      if (!clean) return fail({ kind: "refused", reason: "unknown_code" });
      const r = await rpc("sendFriendRequest", { code: clean });
      if (r.failure) return fail(r.failure);
      // The server answers with a word (SocialDecode.requestOutcome in the app): a bad code and a block read the same.
      switch (typeof r.data === "string" ? r.data.toLowerCase() : "") {
        case "pending": return ok("sent");
        case "accepted": return ok("now_friends");
        case "already_friends": return ok("already_friends");
        case "self": return ok("own_code");
        case "not_found":
        case "blocked": return fail({ kind: "refused", reason: "unknown_code" });
        case "rate_limited": return fail({ kind: "refused", reason: "rate_limited" });
        default: return fail({ kind: "unavailable" });
      }
    }),
    respondToFriendRequest: (fromUserId: string, accept: boolean) => write("respondFriendRequest", { from_user: fromUserId, accept }),
    removeFriend: (userId: string) => write("removeFriend", { user: userId }),
    block: (userId: string) => write("block", { user: userId }),
    unblock: (userId: string) => write("unblock", { user: userId }),
    reportUser: (userId: string, reason: UserReportReason, groupId?: string | null) =>
      write("reportUser", { user: userId, reason, group: groupId ?? null }),

    /* Groups */
    loadGroups: () => run<StudyGroup[]>(async () => {
      const g = await readLadder(READS.groups, [["order", "created_at", "asc"]]);
      if (g.failure) return fail(g.failure);
      const ids = g.rows.map((r) => str(r.id)).filter((x): x is string => !!x);
      if (ids.length === 0) return ok([]);
      const m = await readLadder(READS.memberCounts, [["in", "group_id", ids]]);
      if (m.failure) return fail(m.failure);
      const counts = new Map<string, number>();
      for (const row of m.rows) { const id = str(row.group_id); if (id) counts.set(id, (counts.get(id) ?? 0) + 1); }
      return ok(g.rows.flatMap((row) => { const x = decode.group(row, counts); return x ? [x] : []; }));
    }),
    loadMembers: (groupId: string) => run<GroupMember[]>(async () => {
      const m = await readLadder(READS.members, [["eq", "group_id", groupId]]);
      if (m.failure) return fail(m.failure);
      const entries = m.rows.flatMap((row) => {
        const id = str(row.user_id);
        return id ? [{ id, joinedAt: str(row.joined_at) ?? "", role: (row.role === "owner" ? "owner" : "member") as GroupRole }] : [];
      });
      const ids = [...new Set(entries.map((e) => e.id))].sort();
      const found = await people(ids, ids);
      if (found.failure) return fail(found.failure);
      // A member the server will not show (a block either way) is simply not listed.
      return ok(entries.flatMap((e) => (found.people.has(e.id) ? [{ person: found.people.get(e.id)!, joinedAt: e.joinedAt, role: e.role }] : [])));
    }),
    createGroup: (name: string) => run<{ id: string; name: string; inviteCode: string }>(async () => {
      const r = await rpc("createGroup", { name });
      if (r.failure) return fail(r.failure);
      const d = (r.data ?? {}) as Row;
      const id = str(d.id), n = str(d.name), code = str(d.invite_code);
      return id && n && code ? ok({ id, name: n, inviteCode: code }) : fail({ kind: "unavailable" });
    }),
    joinGroup: (code: string) => run<{ id: string; name: string; inviteCode: string; status: string }>(async () => {
      const clean = parseCode(code);
      if (!clean) return fail({ kind: "refused", reason: "unknown_code" });
      const r = await rpc("joinGroup", { code: clean });
      if (r.failure) return fail(r.failure);
      const d = (Array.isArray(r.data) ? r.data[0] : r.data ?? {}) as Row;
      // {status, id, name, invite_code}: joined | already_member | not_found | full | rate_limited (SocialDecode.joinOutcome).
      switch (str(d.status)?.toLowerCase()) {
        case "joined":
        case "already_member": {
          const id = str(d.id), n = str(d.name);
          return id && n ? ok({ id, name: n, inviteCode: str(d.invite_code) ?? clean, status: str(d.status)! }) : fail({ kind: "unavailable" });
        }
        case "not_found": return fail({ kind: "refused", reason: "unknown_code" });
        case "full": return fail({ kind: "refused", reason: "group_full" });
        case "rate_limited": return fail({ kind: "refused", reason: "rate_limited" });
        default: return fail({ kind: "unavailable" });
      }
    }),
    leaveGroup: (groupId: string) => write("leaveGroup", { group: groupId }),
    removeMember: (groupId: string, userId: string) => write("removeMember", { group: groupId, user: userId }),
    rotateGroupCode: (groupId: string) => run<string>(async () => {
      const r = await rpc("rotateGroupCode", { group: groupId });
      return r.failure ? fail(r.failure) : typeof r.data === "string" ? ok(r.data) : fail({ kind: "unavailable" });
    }),
    renameGroup: (groupId: string, name: string) => write("renameGroup", { group: groupId, name }),
    setGroupHall: (groupId: string, hall: GroupHall) =>
      write("setGroupHall", { group: groupId, emblem: hall.emblem, hall_theme: hall.theme, weekly_goal_hours: hall.weeklyGoalHours }),
    setGroupVisibility: (groupId: string, isPublic: boolean) =>
      write("setGroupVisibility", { group: groupId, visibility: isPublic ? "public" : "private" }),

    /* Presence and the week's figures */
    setPresence: (p: PresenceUpdate) =>
      write("setPresence", { subject: p.subjectId, mode: p.mode, phase: p.phase, started_at: iso(p.startedAt), ends_at: p.endsAt ? iso(p.endsAt) : null }),
    clearPresence: () => write("clearPresence"),
    /** The week's seconds, today's, XP and level, then the streak (the iPad sends both, the streak best-effort). */
    publishSummary: (f: SummaryFigures) => run<void>(async () => {
      const r = await rpc("publishSummaryWeek", { today_seconds: f.todaySeconds, week_seconds: f.weekSeconds, week_xp: f.weekXp, level: f.level });
      if (r.failure) return fail(r.failure);
      await rpc("publishStreak", { days: f.streak });
      return ok(undefined);
    }),

    /* The study hall */
    sendReaction: (kind: ReactionKind, toUserId: string, groupId: string) => run<ReactionOutcome>(async () => {
      const r = await rpc("sendReaction", { group: groupId, user: toUserId, kind });
      if (r.failure) return fail(r.failure);
      const word = typeof r.data === "string" ? r.data.toLowerCase() : "";
      return ok(word === "sent" || word === "too_soon" || word === "rate_limited" ? word : "not_found");
    }),
    loadReactions: () => run<GroupReaction[]>(async (me) => {
      const r = await readLadder(READS.reactions, [["eq", "to_user", me], ["order", "created_at", "desc"], ["limit", 50]]);
      return r.failure ? fail(r.failure) : ok(r.rows.flatMap((row) => { const x = decode.reaction(row); return x ? [x] : []; }));
    }),
    markReactionsSeen: () => write("markReactionsSeen"),
    setAvatar: (avatar: SocialAvatar) => write("setAvatar", { avatar }),
    /** `hall` is a group id or "friends"; tiles are 0 to 255 and are clamped, not refused. */
    setHallPosition: (hall: string, x: number, y: number) =>
      write("setHallPosition", { hall, x: Math.min(MAX_TILE, Math.max(0, Math.round(x))), y: Math.min(MAX_TILE, Math.max(0, Math.round(y))) }),
    clearHallPosition: () => write("clearHallPosition"),
    hallPositions: (hall: string) => run<HallSpot[]>(async () => {
      const r = await rpc("hallPositions", { hall });
      if (r.failure) return fail(r.failure);
      return ok(Array.isArray(r.data) ? (r.data as Row[]).flatMap((row) => { const s = decode.spot(row); return s ? [s] : []; }) : []);
    }),

    /* Group chat */
    /** Checked here first so the student is told before sending; the server's check is the one that counts. */
    sendGroupMessage: (groupId: string, body: string) => run<GroupMessage>(async () => {
      const verdict = chat.check(body);
      if (!verdict.ok) {
        const reason = { empty: "message_empty", too_long: "message_too_long", link: "message_link", language: "message_language" } as const;
        return fail({ kind: "refused", reason: reason[verdict.refusal] });
      }
      const r = await rpc("sendGroupMessage", { group: groupId, body: verdict.body });
      if (r.failure) return fail(r.failure);
      const m = r.data && typeof r.data === "object" ? decode.message({ hidden: false, ...(r.data as Row) }) : null;
      return m ? ok(m) : fail({ kind: "unavailable" });
    }),
    /** The newest 100 the student may read (hidden, reported and blocked ones are the server's to withhold), or those after `since`. */
    groupMessages: (groupId: string, since?: Date | null) => run<GroupMessage[]>(async () => {
      const filters: Filter[] = [["eq", "group_id", groupId], ["order", "created_at", "desc"], ["limit", 100]];
      if (since) filters.push(["gt", "created_at", iso(since)]);
      const r = await readLadder(READS.messages, filters);
      if (r.failure) return fail(r.failure);
      return ok(r.rows.flatMap((row) => { const m = decode.message(row); return m ? [m] : []; }).sort(byTime));
    }),
    reportMessage: (messageId: string, reason: MessageReportReason, block: boolean) =>
      write("reportGroupMessage", { message: Number(messageId) || 0, reason, block }),

    /* The public lobby and the Grand Library (0117 to 0123): the same functions the iPad's library calls.
       A stranger is only ever a random nickname; a friend shows their real name. The server decides who sees whom. */
    lobbyMe: () => run<LobbyMe>(async () => {
      const r = await rpc("lobbyMe");
      const me = r.failure ? null : lobbyDecode.me(r.data);
      return r.failure ? fail(r.failure) : me ? ok(me) : fail({ kind: "unavailable" });
    }),
    /** Hidden: out of the lobby at once, and strangers are not shown either. */
    setLobbyVisible: (visible: boolean) => write("setLobbyVisible", { visible }),
    regenerateNickname: () => run<{ changed: boolean; nickname: string }>(async () => {
      const r = await rpc("regenerateNickname");
      if (r.failure) return fail(r.failure);
      const d = (r.data ?? {}) as Row;
      const nickname = str(d.nickname);
      return nickname ? ok({ changed: d.status === "changed", nickname }) : fail({ kind: "unavailable" });
    }),
    /**
     * Into the lobby, standing on a tile of the shared world: the shard to be in (none for a hidden student).
     * `want` asks for a server; when it is full the usual pick is made and `wantedFull` says so. Without
     * `want` the call is the two-argument one, so a server before 0121 still answers.
     */
    joinLobby: (tile: { x: number; y: number }, want?: number | null) => run<LobbyJoin>(async () => {
      const args: Record<string, unknown> = { x: clampTile(tile.x), y: clampTile(tile.y) };
      if (want !== undefined && want !== null) args.want = Math.floor(want);
      const r = await rpc("lobbyJoin", args);
      if (r.failure) return fail(r.failure);
      const j = lobbyDecode.join(r.data);
      return j ? ok(j) : fail({ kind: "unavailable" });
    }),
    /** `lobby_servers`: counts and the number of friends only, nothing about who. */
    lobbyServers: () => run<LobbyServers>(async () => {
      const r = await rpc("lobbyServers");
      if (r.failure) return fail(r.failure);
      const s = lobbyDecode.servers(r.data);
      return s ? ok(s) : fail({ kind: "unavailable" });
    }),
    /** Where you stand and what you are doing. False when you are not in that shard any more (hidden since, or the row went stale): join again. */
    setLobbyPosition: (shard: number, tile: { x: number; y: number }, status: { seated: boolean; subjectId?: string | null; focusSince?: Date | number | null }) => run<boolean>(async () => {
      const since = status.focusSince === undefined || status.focusSince === null ? null : new Date(status.focusSince).toISOString();
      const r = await rpc("lobbySetPosition", {
        shard, x: clampTile(tile.x), y: clampTile(tile.y), seated: status.seated, subject: status.seated ? status.subjectId ?? null : null,
        focus_since: status.seated ? since : null,
      });
      return r.failure ? fail(r.failure) : ok(r.data === "ok");
    }),
    leaveLobby: () => write("lobbyLeave"),
    /** Everyone else in your shard now, as you may see them. Refused (`not_member`) unless you are in that shard. */
    lobbyPeople: (shard: number) => run<LobbyPerson[]>(async () => {
      const r = await rpc("lobbyPeople", { shard });
      if (r.failure) return fail(r.failure);
      return ok(Array.isArray(r.data) ? (r.data as Row[]).flatMap((row) => { const p = lobbyDecode.person(row); return p ? [sanitised(p)] : []; }) : []);
    }),
    /** A wave or a high five over your own head. */
    lobbyEmote: (kind: LobbyEmote) => run<LobbyEmoteOutcome>(async () => {
      const r = await rpc("lobbyEmote", { kind });
      return r.failure ? fail(r.failure) : ok(lobbyDecode.emote(r.data));
    }),
    /** The newest 100 of the last three hours you may read, or those after `since`. Refused (`not_member`) unless you are in that shard. */
    libraryMessages: (shard: number, since?: Date | number | null) => run<LibraryMessage[]>(async () => {
      const args: Record<string, unknown> = { shard };
      if (since !== undefined && since !== null) args.since = new Date(since).toISOString();
      const r = await rpc("libraryMessages", args);
      if (r.failure) return fail(r.failure);
      return ok(Array.isArray(r.data) ? (r.data as Row[]).flatMap((row) => { const m = lobbyDecode.message(row); return m ? [m] : []; }).sort(byMessageTime) : []);
    }),
    /**
     * Checked here first (the group chat's rules, then the library's spam rule, then saying it again) so the
     * student is told before sending; the server's check is the one that counts. `recent` is what you said lately.
     */
    sendLibraryMessage: (shard: number, body: string, recent: readonly Said[] = [], now = Date.now()) => run<LibraryMessage>(async () => {
      const verdict = libraryCheck(body, recent, now);
      if (!verdict.ok) return fail({ kind: "refused", reason: LIBRARY_REASON[verdict.refusal] });
      const r = await rpc("sendLibraryMessage", { shard, body: verdict.body });
      if (r.failure) return fail(r.failure);
      const m = r.data && typeof r.data === "object" ? lobbyDecode.message({ hidden: false, ...(r.data as Row) }) : null;
      return m ? ok(m) : fail({ kind: "unavailable" });
    }),
    /** Reports a message (it disappears for you at once); with `block`, its sender is blocked too. */
    reportLibraryMessage: (messageId: string, reason: MessageReportReason, block: boolean) =>
      write("reportLibraryMessage", { message: Number(messageId) || 0, reason, block }),
  };
}

export type SocialService = ReturnType<typeof createSocial>;
