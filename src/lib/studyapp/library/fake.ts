import { fail, ok, type Result } from "../../social/failure";
import { check as libraryCheck } from "../../social/librarySpam";
import { sanitised, LOBBY_CAP, type LibraryMessage, type LobbyEmote, type LobbyAskOutcome, type LobbyEmoteOutcome, type LobbyFriendRequest, type LobbyJoin, type LobbyPerson, type LobbyServers } from "../../social/lobby";
import type { FriendRequest, FriendsSnapshot, SocialPerson } from "../../social/types";
import { dayOf } from "../time";
import type { LobbyChannel, LobbyRealtime } from "./lobbyWatch";
import { presenceFields, type FloorPresence } from "./room";
import { LIBRARY_TILE } from "./room";
import type { LibrarySocial } from "./session";

/**
 * A scripted library, for the tests and for the dev-only demo page (`/study/library/demo`): a Realtime hub that
 * delivers broadcasts and presence between clients as Supabase would, and a world that answers the lobby calls
 * as the server does (a shard of 60, friends shown by name and strangers by nickname, the chat's filters and
 * pace). It is a stand-in for the server, not the server: where it matters the real functions are what the
 * end-to-end run (scripts/social-e2e.ts) and the fuzz (scripts/social-fuzz-library.ts) are held to.
 */

/* ── Realtime ────────────────────────────────────────────────────────── */

type Cb = (m: Record<string, unknown>) => void;

class FakeChannel implements LobbyChannel {
  broadcast = new Map<string, Cb[]>();
  presence = new Map<string, Cb[]>();
  meta: Record<string, unknown> | null = null;
  subscribed = false;
  constructor(readonly hub: FakeRealtimeHub, readonly user: string, readonly topic: string, readonly key: string) {}
  on(type: "broadcast" | "presence", filter: { event: string }, cb: Cb): LobbyChannel {
    const book = type === "broadcast" ? this.broadcast : this.presence;
    book.set(filter.event, [...(book.get(filter.event) ?? []), cb]);
    return this;
  }
  subscribe(cb?: (status: string) => void): LobbyChannel {
    this.subscribed = true;
    this.hub.channels.add(this);
    queueMicrotask(() => {
      // someone already tracked on this topic is "joined" as soon as we listen
      for (const other of this.hub.channels) if (other !== this && other.topic === this.topic && other.meta) this.fire(this.presence, "join", { event: "join", key: other.key, newPresences: [other.meta], currentPresences: [] });
      cb?.("SUBSCRIBED");
    });
    return this;
  }
  send(m: { type: "broadcast"; event: string; payload: Record<string, unknown> }) {
    this.hub.sent.push({ user: this.user, topic: this.topic, event: m.event, payload: m.payload });
    if (!this.subscribed) return;
    for (const other of this.hub.channels) if (other !== this && other.topic === this.topic) other.fire(other.broadcast, m.event, { type: "broadcast", event: m.event, payload: m.payload });
  }
  track(meta: Record<string, unknown>) {
    this.meta = meta;
    for (const other of this.hub.channels) if (other !== this && other.topic === this.topic) other.fire(other.presence, "join", { event: "join", key: this.key, newPresences: [meta], currentPresences: [] });
  }
  untrack() {
    this.meta = null;
    for (const other of this.hub.channels) if (other !== this && other.topic === this.topic) other.fire(other.presence, "leave", { event: "leave", key: this.key, leftPresences: [] });
  }
  fire(book: Map<string, Cb[]>, event: string, m: Record<string, unknown>) { for (const cb of book.get(event) ?? []) cb(m); }
}

export class FakeRealtimeHub {
  channels = new Set<FakeChannel>();
  /** Every channel any client opened, with its options: so a test can check topics and that each is private. */
  opened: { user: string; topic: string; private: boolean; presenceKey: string | null; presenceEnabled: boolean | null }[] = [];
  /** Every broadcast sent. */
  sent: { user: string; topic: string; event: string; payload: Record<string, unknown> }[] = [];

  client(user: string): LobbyRealtime {
    return {
      channel: (topic, options) => {
        const c = options?.config;
        this.opened.push({ user, topic, private: c?.private === true, presenceKey: c?.presence?.key ?? null, presenceEnabled: c?.presence?.enabled ?? null });
        return new FakeChannel(this, user, topic, c?.presence?.key ?? user);
      },
      removeChannel: (ch) => {
        const c = ch as FakeChannel;
        if (c.meta) c.untrack();
        this.channels.delete(c);
      },
    };
  }
}

/* ── The server ──────────────────────────────────────────────────────── */

interface Student {
  id: string; nickname: string; display: string; colour: number; friends: Set<string>; blocked: Set<string>; pro: boolean;
  visible: boolean; shard: number | null; seated: boolean; subject: string | null; focusSince: number | null; beat: number;
  emote: LobbyEmote | null; emoteAt: number | null; emoteLast: number; streak: number; level: number;
  said: number[]; reportedHidden: number;
  /** social_profile.avatar */
  avatar: Record<string, string> | null;
  /** study_presence: studying somewhere (in or out of a library) until `until` (epoch ms). */
  presence: { subject: string; phase: "work" | "break"; since: number; until: number } | null;
}
interface Msg { id: number; shard: number; sender: string; body: string; at: number; hidden: boolean; reporters: Set<string> }

export class FakeLibraryWorld {
  students = new Map<string, Student>();
  messages: Msg[] = [];
  reports: { message: number; by: string; reason: string; block: boolean }[] = [];
  userReports: { user: string; by: string; reason: string }[] = [];
  /** Open friend requests made in the library, as "from>to". */
  asked = new Set<string>();
  /** When each was made. */
  askedAt = new Map<string, number>();
  /** Open ordinary friend requests (the sender typed a friend code), as "from>to". Their sender's name is readable by the one asked. */
  plain = new Map<string, number>();
  /** The name of every call, in order (so a test can say what was NOT asked). */
  calls: string[] = [];
  private nextId = 1;
  /** Calls that should fail, by name: a test of "the network went", never an error on screen. */
  failing = new Set<string>();
  now: () => number;

  constructor(now: () => number = Date.now) { this.now = now; }

  add(id: string, o: Partial<Student> & { nickname: string; display: string }): Student {
    const s: Student = {
      id, colour: 0, friends: new Set(), blocked: new Set(), pro: false, visible: true, shard: null, seated: false, subject: null, focusSince: null,
      beat: 0, emote: null, emoteAt: null, emoteLast: -Infinity, streak: 0, level: 1, said: [], reportedHidden: 0, avatar: null, presence: null, ...o,
    };
    this.students.set(id, s);
    return s;
  }
  befriend(a: string, b: string) { this.students.get(a)!.friends.add(b); this.students.get(b)!.friends.add(a); }
  unfriend(a: string, b: string) { this.students.get(a)?.friends.delete(b); this.students.get(b)?.friends.delete(a); }
  /** A request made in the library: `from` asked `to` (the recipient reads it as a nickname only). */
  libraryAsk(from: string, to: string, at = this.now()) { this.asked.add(`${from}>${to}`); this.askedAt.set(`${from}>${to}`, at); }
  /** An ordinary request: `from` typed `to`'s friend code. */
  plainAsk(from: string, to: string, at = this.now()) { this.plain.set(`${from}>${to}`, at); }
  /** `id` is studying `subject` for the next `minutes` (a fresh presence), wherever they are. */
  studying(id: string, subject: string, minutes = 25, phase: "work" | "break" = "work") {
    this.students.get(id)!.presence = { subject, phase, since: this.now(), until: this.now() + minutes * 60_000 };
  }
  /** Puts a student in a shard without a join (a scripted student already there). */
  place(id: string, shard: number, o: { seated?: boolean; subject?: string | null; focusSince?: number | null } = {}) {
    const s = this.students.get(id)!;
    Object.assign(s, { shard, beat: this.now(), seated: o.seated ?? false, subject: o.subject ?? null, focusSince: o.focusSince ?? null });
  }
  private fresh(s: Student) { return s.shard !== null && s.visible && this.now() - s.beat < 30_000; }
  private inShard(shard: number) { return [...this.students.values()].filter((s) => s.shard === shard && this.fresh(s)); }
  private blockedEither(a: Student, b: Student) { return a.blocked.has(b.id) || b.blocked.has(a.id); }

  say(sender: string, shard: number, body: string, o: { at?: number } = {}) {
    const m: Msg = { id: this.nextId++, shard, sender, body, at: o.at ?? this.now(), hidden: false, reporters: new Set() };
    this.messages.push(m);
    return m;
  }

  /** The lobby calls, as one student (the same shape the real service returns). */
  social(me: string): LibrarySocial {
    const self = () => this.students.get(me)!;
    const gate = <T,>(name: string, f: () => Result<T>): Promise<Result<T>> => {
      this.calls.push(name);
      return Promise.resolve(this.failing.has(name) ? fail<T>({ kind: "offline" }) : f());
    };
    const iso = (t: number) => new Date(t).toISOString();
    /** A friend as `social_profile` and the presence and summary reads give them (never a stranger: only called for accepted friends and open ordinary requests). */
    const profile = (x: Student, withExtras: boolean): SocialPerson => ({
      id: x.id, displayName: x.display, colour: x.colour, avatar: x.avatar,
      ...(withExtras && x.presence ? { presence: { subjectId: x.presence.subject, mode: "timer" as const, phase: x.presence.phase, startedAt: iso(x.presence.since), endsAt: null, expiresAt: iso(x.presence.until) } } : {}),
      ...(withExtras ? { summary: { day: dayOf(this.now()), todaySeconds: 0, weekSeconds: 0, weekXp: 0, level: x.level, streak: x.streak, streakDay: x.streak > 0 ? dayOf(this.now()) : null, updatedAt: iso(this.now()) } } : {}),
    });
    const notMember = <T,>() => fail<T>({ kind: "refused", reason: "not_member" });
    return {
      joinLobby: (_tile, want) => gate("joinLobby", () => {
        const s = self();
        if (!s.visible) { s.shard = null; return ok<LobbyJoin>({ shard: null, nickname: s.nickname, visible: false, cap: LOBBY_CAP, wantedFull: false }); }
        const count = (n: number) => this.inShard(n).filter((x) => x.id !== me).length;
        let pick = 0, wantedFull = false;
        if (want && want >= 1 && want <= 300) { if (count(want) < LOBBY_CAP) pick = want; else wantedFull = true; }
        if (!pick) {
          const open = [...new Set(this.students.values())].flatMap((x) => (x.shard !== null && this.fresh(x) && x.id !== me ? [x.shard] : []));
          const shards = [...new Set(open)].filter((n) => count(n) < LOBBY_CAP)
            .sort((a, b) => this.inShard(b).filter((x) => s.friends.has(x.id)).length - this.inShard(a).filter((x) => s.friends.has(x.id)).length || count(b) - count(a) || a - b);
          pick = shards[0] ?? Math.min(...Array.from({ length: 300 }, (_, i) => i + 1).filter((n) => count(n) === 0));
        }
        s.shard = pick; s.beat = this.now(); s.seated = false; s.subject = null; s.focusSince = null;
        return ok<LobbyJoin>({ shard: pick, nickname: s.nickname, visible: true, cap: LOBBY_CAP, wantedFull });
      }),
      lobbyServers: () => gate("lobbyServers", () => {
        const s = self();
        const by = new Map<number, number>(), fr = new Map<number, number>();
        for (const x of this.students.values()) if (this.fresh(x) && x.shard !== null) {
          by.set(x.shard, (by.get(x.shard) ?? 0) + 1);
          if (x.id !== me && s.friends.has(x.id) && !this.blockedEither(s, x)) fr.set(x.shard, (fr.get(x.shard) ?? 0) + 1);
        }
        const servers = [...by.keys()].sort((a, b) => a - b).map((shard) => ({ shard, here: by.get(shard)!, friends: fr.get(shard) ?? 0 }));
        const empty = Array.from({ length: 300 }, (_, i) => i + 1).find((n) => !by.has(n)) ?? null;
        return ok<LobbyServers>({ cap: LOBBY_CAP, you: s.visible ? s.shard : null, empty, max: 300, servers });
      }),
      setLobbyPosition: (shard, _tile, st) => gate("setLobbyPosition", () => {
        const s = self();
        if (!s.visible || s.shard !== shard) return ok(false);
        s.beat = this.now(); s.seated = st.seated; s.subject = st.seated ? st.subjectId ?? null : null;
        s.focusSince = st.seated && st.focusSince != null ? new Date(st.focusSince).getTime() : null;
        return ok(true);
      }),
      leaveLobby: () => gate("leaveLobby", () => { self().shard = null; return ok(undefined); }),
      // `friendship` table reads under RLS: accepted friends, and ordinary pending requests. A pending LIBRARY request is hidden from the table (0125).
      loadFriends: () => gate("loadFriends", () => {
        const s = self();
        const friends = [...s.friends].flatMap((id) => { const x = this.students.get(id); return x && !this.blockedEither(s, x) ? [profile(x, true)] : []; });
        const requests = [...this.plain].flatMap(([k, at]): FriendRequest[] => {
          const [from, to] = k.split(">");
          if (to !== me && from !== me) return [];
          const other = this.students.get(from === me ? to : from);
          if (!other || this.blockedEither(s, other)) return [];
          return [{ otherUserId: other.id, direction: from === me ? "outgoing" : "incoming", person: profile(other, false), createdAt: iso(at) }];
        });
        return ok<FriendsSnapshot>({ friends, requests });
      }),
      // lobby_friend_requests (0125): your open library requests, both ways, as a nickname and a look. No name, no code.
      lobbyFriendRequests: () => gate("lobbyFriendRequests", () => ok([...this.asked].flatMap((k): LobbyFriendRequest[] => {
        const [from, to] = k.split(">");
        if (from !== me && to !== me) return [];
        const x = this.students.get(from === me ? to : from);
        if (!x || this.blockedEither(self(), x)) return [];
        return [{ userId: x.id, direction: from === me ? "outgoing" : "incoming", nickname: x.nickname, colour: x.colour, avatar: x.avatar, streak: x.streak, level: x.level, createdAt: this.askedAt.get(k) ?? this.now() }];
      }))),
      respondToFriendRequest: (from, accept) => gate("respondToFriendRequest", () => {
        const key = `${from}>${me}`;
        const open = this.asked.has(key) || this.plain.has(key);
        this.asked.delete(key); this.plain.delete(key);
        if (open && accept && this.students.has(from)) this.befriend(me, from);
        return ok(undefined);
      }),
      removeFriend: (id) => gate("removeFriend", () => {
        this.unfriend(me, id);
        for (const k of [`${me}>${id}`, `${id}>${me}`]) { this.asked.delete(k); this.plain.delete(k); }
        return ok(undefined);
      }),
      canRequestFriends: true,
      probeFriendRequests: async () => true,
      sendLobbyFriendRequest: (id) => gate("sendLobbyFriendRequest", () => {
        const s = self(), t = this.students.get(id);
        if (!t || t === s || !s.visible || !t.visible || s.shard === null || s.shard !== t.shard || this.blockedEither(s, t)) return ok<LobbyAskOutcome>("not_here");
        if (s.friends.has(id)) return ok<LobbyAskOutcome>("already_friends");
        if (this.asked.has(`${id}>${me}`)) { this.asked.delete(`${id}>${me}`); this.befriend(me, id); return ok<LobbyAskOutcome>("now_friends"); }   // asking back is the acceptance
        if (this.asked.has(`${me}>${id}`)) return ok<LobbyAskOutcome>("already_asked");
        this.libraryAsk(me, id);
        return ok<LobbyAskOutcome>("sent");
      }),
      lobbyPeople: (shard) => gate("lobbyPeople", () => {
        const s = self();
        if (!s.visible || s.shard !== shard) return notMember<LobbyPerson[]>();
        return ok(this.inShard(shard).filter((x) => x.id !== me && !this.blockedEither(s, x)).map((x) => sanitised({
          id: x.id, nickname: x.nickname, displayName: s.friends.has(x.id) ? x.display : null, isFriend: s.friends.has(x.id), colour: x.colour,
          avatar: x.avatar ?? (x.pro ? { pro: "1" } : null), x: LIBRARY_TILE.x, y: LIBRARY_TILE.y, seated: x.seated, subjectId: x.subject, focusSince: x.focusSince,
          streak: x.streak, level: x.level, groups: [], emote: x.emoteAt !== null && this.now() - x.emoteAt < 10_000 ? x.emote : null,
          emoteAt: x.emoteAt !== null && this.now() - x.emoteAt < 10_000 ? x.emoteAt : null, updatedAt: x.beat, pro: x.avatar ? x.avatar.pro === "1" : x.pro,
          platform: x.avatar?.outfit ? "ipad" : null, friendRequest: this.asked.has(`${me}>${x.id}`) ? "sent" : this.asked.has(`${x.id}>${me}`) ? "received" : null,
        })));
      }),
      lobbyEmote: (kind) => gate("lobbyEmote", () => {
        const s = self();
        if (!s.visible || s.shard === null || !this.fresh(s)) return ok<LobbyEmoteOutcome>("not_in_lobby");
        if (this.now() - s.emoteLast < 5000) return ok<LobbyEmoteOutcome>("too_soon");
        s.emote = kind; s.emoteAt = this.now(); s.emoteLast = this.now();
        return ok<LobbyEmoteOutcome>("sent");
      }),
      libraryMessages: (shard, since) => gate("libraryMessages", () => {
        const s = self();
        if (!s.visible || s.shard !== shard) return notMember<LibraryMessage[]>();
        const after = since === undefined || since === null ? -Infinity : new Date(since).getTime();
        const out = this.messages.filter((m) => m.shard === shard && this.now() - m.at < 3 * 3600_000 && m.at > after && (!m.hidden || m.sender === me)
          && !m.reporters.has(me) && !this.blockedEither(s, this.students.get(m.sender)!))
          .sort((a, b) => b.at - a.at || b.id - a.id).slice(0, 100)
          .map((m): LibraryMessage => {
            const from = this.students.get(m.sender)!;
            return { id: String(m.id), shard, senderId: m.sender, name: s.friends.has(m.sender) ? from.display : from.nickname, body: m.body, createdAt: m.at, hidden: m.hidden, pro: from.pro };
          });
        return ok(out.reverse());
      }),
      sendLibraryMessage: (shard, body, recent = [], now = this.now()) => gate("sendLibraryMessage", () => {
        const s = self();
        if (!s.visible || s.shard !== shard) return notMember<LibraryMessage>();
        const v = libraryCheck(body, recent, now);
        if (!v.ok) return fail({ kind: "refused", reason: ({ empty: "message_empty", too_long: "message_too_long", link: "message_link", language: "message_language", spam: "message_spam", shouting: "message_shouting", repeat: "message_repeat" } as const)[v.refusal] });
        const t = this.now();
        s.said = s.said.filter((x) => t - x < 600_000);
        if (s.said.some((x) => t - x < 3000) || s.said.filter((x) => t - x < 60_000).length >= 8 || s.said.length >= 30) return fail({ kind: "refused", reason: "message_rate" });
        s.said.push(t);
        const m = this.say(me, shard, v.body, { at: t });
        return ok<LibraryMessage>({ id: String(m.id), shard, senderId: me, name: s.nickname, body: m.body, createdAt: t, hidden: false, pro: s.pro });
      }),
      reportLibraryMessage: (id, reason, block) => gate("reportLibraryMessage", () => {
        const s = self();
        const m = this.messages.find((x) => String(x.id) === id);
        if (!m || s.shard !== m.shard) return ok(undefined);
        this.reports.push({ message: m.id, by: me, reason, block });
        m.reporters.add(me);
        if (m.reporters.size >= 2) m.hidden = true;
        if (block) s.blocked.add(m.sender);
        return ok(undefined);
      }),
      block: (id) => gate("block", () => { self().blocked.add(id); return ok(undefined); }),
      reportUser: (id, reason) => gate("reportUser", () => { this.userReports.push({ user: id, by: me, reason }); return ok(undefined); }),
      // set_avatar (0120): replaces the whole avatar; only these keys, each an identifier or a #rrggbb colour, at most 1024 bytes
      setAvatar: (avatar) => gate("setAvatar", () => {
        const allowed = ["feather", "top", "colour", "shade", "accent", "legs", "shoe", "hat", "hat_colour", "scarf", "glasses", "body", "eyes", "outfit", "hair", "acc", "phones", "pro"];
        const entries = Object.entries(avatar ?? {});
        if (JSON.stringify(avatar).length > 1024 || entries.some(([k, v]) => !allowed.includes(k) || typeof v !== "string" || !(/^[a-z0-9_-]{1,24}$/.test(v) || /^#[0-9a-f]{6}$/.test(v)))) return fail({ kind: "unavailable" });
        self().avatar = { ...avatar };
        return ok(undefined);
      }),
      setLobbyVisible: (visible) => gate("setLobbyVisible", () => { const s = self(); s.visible = visible; if (!visible) s.shard = null; return ok(undefined); }),
    };
  }
}

/** A scripted student on the floor: speaks on Realtime as the iPad does (`move` with `lx`, `ly`, `ls`, `lp`, and presence). */
export class FakeBot {
  private ch: LobbyChannel;
  constructor(private rt: LobbyRealtime, readonly id: string, readonly shard: number, topic: string) {
    this.ch = rt.channel(topic, { config: { private: true, presence: { key: id, enabled: true }, broadcast: { self: false } } });
    this.ch.subscribe();
  }
  /** Where the bot is: the wire's fields beside the tile. */
  at(p: FloorPresence) {
    const payload = { x: LIBRARY_TILE.x, y: LIBRARY_TILE.y, ...presenceFields(p) };
    void this.ch.track(payload);
    void this.ch.send({ type: "broadcast", event: "move", payload });
  }
  leave() { void this.ch.send({ type: "broadcast", event: "leave", payload: {} }); void this.ch.untrack(); this.rt.removeChannel(this.ch); }
}
