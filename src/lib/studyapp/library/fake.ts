import { fail, ok, type Result } from "../../social/failure";
import { check as libraryCheck } from "../../social/librarySpam";
import { sanitised, LOBBY_CAP, type LibraryMessage, type LobbyEmote, type LobbyEmoteOutcome, type LobbyJoin, type LobbyPerson, type LobbyServers } from "../../social/lobby";
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
}
interface Msg { id: number; shard: number; sender: string; body: string; at: number; hidden: boolean; reporters: Set<string> }

export class FakeLibraryWorld {
  students = new Map<string, Student>();
  messages: Msg[] = [];
  reports: { message: number; by: string; reason: string; block: boolean }[] = [];
  userReports: { user: string; by: string; reason: string }[] = [];
  private nextId = 1;
  /** Calls that should fail, by name: a test of "the network went", never an error on screen. */
  failing = new Set<string>();
  now: () => number;

  constructor(now: () => number = Date.now) { this.now = now; }

  add(id: string, o: Partial<Student> & { nickname: string; display: string }): Student {
    const s: Student = {
      id, colour: 0, friends: new Set(), blocked: new Set(), pro: false, visible: true, shard: null, seated: false, subject: null, focusSince: null,
      beat: 0, emote: null, emoteAt: null, emoteLast: -Infinity, streak: 0, level: 1, said: [], reportedHidden: 0, ...o,
    };
    this.students.set(id, s);
    return s;
  }
  befriend(a: string, b: string) { this.students.get(a)!.friends.add(b); this.students.get(b)!.friends.add(a); }
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
    const gate = <T,>(name: string, f: () => Result<T>): Promise<Result<T>> =>
      Promise.resolve(this.failing.has(name) ? fail<T>({ kind: "offline" }) : f());
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
      lobbyPeople: (shard) => gate("lobbyPeople", () => {
        const s = self();
        if (!s.visible || s.shard !== shard) return notMember<LobbyPerson[]>();
        return ok(this.inShard(shard).filter((x) => x.id !== me && !this.blockedEither(s, x)).map((x) => sanitised({
          id: x.id, nickname: x.nickname, displayName: s.friends.has(x.id) ? x.display : null, isFriend: s.friends.has(x.id), colour: x.colour,
          avatar: x.pro ? { pro: "1" } : null, x: LIBRARY_TILE.x, y: LIBRARY_TILE.y, seated: x.seated, subjectId: x.subject, focusSince: x.focusSince,
          streak: x.streak, level: x.level, groups: [], emote: x.emoteAt !== null && this.now() - x.emoteAt < 10_000 ? x.emote : null,
          emoteAt: x.emoteAt !== null && this.now() - x.emoteAt < 10_000 ? x.emoteAt : null, updatedAt: x.beat, pro: x.pro,
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
