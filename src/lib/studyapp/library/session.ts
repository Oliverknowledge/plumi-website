import { studentFacing, type Failure, type Result } from "../../social/failure";
import type { SocialService } from "../../social/service";
import {
  emoteLine, emoteOf, listPeople, mergeMessages, totalHere,
  type LibraryMessage, type LobbyEmote, type LobbyPerson, type LobbyServers,
} from "../../social/lobby";
import type { MessageReportReason, UserReportReason } from "../../social/types";
import type { LiveSummary } from "../live";
import { composeRemotes, labelFor, type HeardFloor, type RemoteState } from "./compose";
import { friendRequestFromLobby, type FriendAsk } from "./friendRequest";
import { watchLobby, type LobbyRealtime, type LobbySignal, type LobbyWatch } from "./lobbyWatch";
import { LIBRARY_TILE, type FloorPresence } from "./room";

/**
 * One student's visit to the Grand Library: the state of it, and everything that keeps it true. The iPad's
 * SocialModel (enterLobby, lobbyBeat, switchLobby, hallTick) and GroupChatModel (the chat) are the reference;
 * this is their web counterpart, over the same server functions. No browser, no React: a service, an optional
 * Realtime, a clock and a ticker are handed in, so a scripted world drives it in the tests and the demo.
 *
 * THE BEAT (once a second, one thing at a time)
 *   position    `lobby_set_position` when what you are doing changed, and at least every ten seconds (a row is
 *               fresh for 30; HallPositions.heartbeat)
 *   people      `lobby_people` every 2 seconds, every 5 while the floor is live (SocialModel.lobbyReadEvery,
 *               HallPositions.liveReadEvery)
 *   chat        `library_messages` every 4 seconds (GroupChatModel.pollInterval), the newest 100 afresh every
 *               sixth read so a hidden message goes (fullReadEvery)
 *   servers     `lobby_servers` every 20 seconds, for the picker and the count
 *
 * A student never sees an error: a failed read keeps what was last good; a failed write says one quiet line.
 */

/** What the study timer publishes to the library: focusing on `subject` since `since` (epoch ms), or null when it is not. */
export type TimerFocus = { subject: string | null; since: number } | null;

export type Phase = "idle" | "joining" | "live" | "hidden" | "unavailable";

export type LibrarySocial = Pick<SocialService,
  "joinLobby" | "lobbyServers" | "setLobbyPosition" | "leaveLobby" | "lobbyPeople" | "lobbyEmote" | "libraryMessages" |
  "sendLibraryMessage" | "reportLibraryMessage" | "block" | "reportUser" | "setLobbyVisible" | "setAvatar" |
  "sendLobbyFriendRequest" | "probeFriendRequests" | "canRequestFriends">;

export interface Snapshot {
  phase: Phase;
  shard: number | null;
  nickname: string | null;
  /** Friends first, then the rest, each by name. Never includes you. */
  people: LobbyPerson[];
  servers: LobbyServers | null;
  seated: boolean;
  subject: string | null;
  focusSince: number | null;
  messages: LibraryMessage[];
  chatLoaded: boolean;
  /** Your steps reach the others as you take them (your own Realtime topic is joined). */
  live: boolean;
}

export type SessionEvent =
  | { type: "notice"; text: string }
  | { type: "emote"; id: string; kind: LobbyEmote };

export interface SessionDeps {
  social: LibrarySocial;
  /** Realtime, made when wanted (null when accounts are off or in a test with none). */
  realtime?: () => LobbyRealtime | null;
  me: string;
  now?: () => number;
  /** Calls `fn` every `ms` until the returned function is called. */
  every?: (fn: () => void, ms: number) => () => void;
  /** Tells the rest of the app what the library knows (the Desk's "revising" card, the Study tab's badge). */
  publish?: (s: LiveSummary) => void;
}

export const POS_EVERY_MS = 10_000;
export const PEOPLE_EVERY_MS = 2_000;
export const PEOPLE_LIVE_EVERY_MS = 5_000;
export const CHAT_EVERY_MS = 4_000;
export const CHAT_FULL_EVERY = 6;
export const SERVERS_EVERY_MS = 20_000;
export const RETRY_MS = 10_000;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The line for a send that did not go. Never a rule's name, never a code. */
export function sendLine(f: Failure): string {
  if (f.kind === "refused") return f.reason === "not_member" ? "One moment, rejoining the library" : studentFacing(f.reason);
  if (f.kind === "offline") return "No connection. Try again in a moment";
  return "That didn’t send. Try again in a moment";
}

export class LibrarySession {
  private s: Snapshot = {
    phase: "idle", shard: null, nickname: null, people: [], servers: null, seated: false, subject: null, focusSince: null,
    messages: [], chatLoaded: false, live: false,
  };
  private listeners = new Set<() => void>();
  private floorListeners = new Set<() => void>();
  private eventListeners = new Set<(e: SessionEvent) => void>();
  private floor = new Map<string, HeardFloor>();
  private gone = new Map<string, number>();
  private lastEmote = new Map<string, number>();
  private watch: LobbyWatch | null = null;
  private floorNow: () => FloorPresence | null = () => null;
  private cancel: (() => void) | null = null;
  private gen = 0;
  private busy = false;
  private statusDirty = true;
  private lastPos = -Infinity;
  private lastPeople = -Infinity;
  private lastChat = -Infinity;
  private lastServers = -Infinity;
  private lastRetry = -Infinity;
  private chatReads = 0;
  private seq = 0;
  private stopped = false;
  /** What the study timer says you are doing (see `followTimer`); remembered while you stand, applied when you sit. */
  private timer: TimerFocus | null = null;

  private now: () => number;
  private me: string;

  constructor(private d: SessionDeps) {
    this.now = d.now ?? Date.now;
    this.me = d.me.toLowerCase();
  }

  /* ── Reading ──────────────────────────────────────────────────────── */

  readonly snapshot = (): Snapshot => this.s;
  readonly subscribe = (cb: () => void) => { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; };
  /** Called when the floor changes (a step heard, or who is here): read `remotes()` and tell the room. */
  readonly onFloor = (cb: () => void) => { this.floorListeners.add(cb); return () => { this.floorListeners.delete(cb); }; };
  readonly onEvent = (cb: (e: SessionEvent) => void) => { this.eventListeners.add(cb); return () => { this.eventListeners.delete(cb); }; };

  /** Your own id (lowercase, as the server writes it): the seed for the person you are drawn as when your avatar names none. */
  get meId() { return this.me; }

  remotes(): RemoteState[] { return composeRemotes(this.s.people, this.floor, this.gone, this.now()); }
  describe = (id: string) => {
    const p = this.s.people.find((x) => x.id === id);
    return p ? labelFor(p, this.now()) : null;
  };
  person(id: string) { return this.s.people.find((x) => x.id === id) ?? null; }

  private set(patch: Partial<Snapshot>) {
    const next = { ...this.s, ...patch };
    if (Object.keys(patch).every((k) => same((this.s as unknown as Record<string, unknown>)[k], (next as unknown as Record<string, unknown>)[k]))) return;
    this.s = next;
    this.listeners.forEach((l) => l());
    this.publishLive();
  }
  private emit(e: SessionEvent) { this.eventListeners.forEach((l) => l(e)); }
  private say(text: string) { this.emit({ type: "notice", text }); }
  private floorChanged() { this.floorListeners.forEach((l) => l()); }

  private publishLive() {
    if (!this.d.publish) return;
    const s = this.s;
    if (s.phase === "idle" || s.phase === "joining" || s.phase === "unavailable") return;
    this.d.publish({
      state: "ready",
      revising: s.servers ? totalHere(s.servers) : null,
      friendsIn: s.phase === "live" ? s.people.filter((p) => p.isFriend).map((p) => ({ id: p.id, name: p.displayName ?? p.nickname, colour: p.colour })) : [],
    });
  }

  /* ── Coming in and going ──────────────────────────────────────────── */

  /** Where you stand on the floor now, for the others (the room supplies it). */
  attachRoom(floorNow: () => FloorPresence | null) { this.floorNow = floorNow; }

  /** Into the library: a server is picked by the same rule as the iPad's (friends first, then the fullest with room). */
  async start(want?: number | null): Promise<void> {
    this.stopped = false;
    const gen = ++this.gen;
    this.set({ phase: "joining" });
    const r = await this.d.social.joinLobby(LIBRARY_TILE, want);
    if (gen !== this.gen || this.stopped) return;
    if (!r.ok) { this.set({ phase: "unavailable" }); this.ensureTicker(); return; }
    if (r.value.shard === null) {
      this.dropWatch();
      this.set({ phase: "hidden", nickname: r.value.nickname, shard: null, people: [], messages: [], live: false });
      this.ensureTicker();
      return;
    }
    if (want && r.value.wantedFull) this.say("That library is full, so you’re in another");
    this.adopt(r.value.shard, r.value.nickname);
    await this.readAll();
  }

  private adopt(shard: number, nickname: string) {
    this.dropWatch();
    this.floor.clear(); this.gone.clear(); this.lastEmote.clear();
    this.statusDirty = true; this.lastPos = -Infinity; this.lastPeople = -Infinity; this.lastChat = -Infinity; this.chatReads = 0;
    // The server forgets what you were doing when you join (seated and the timer are cleared): say it again if the room still has you in a seat.
    const seated = this.floorNow()?.seat != null;
    this.set({ phase: "live", shard, nickname, people: [], messages: [], chatLoaded: false, live: false, seated, ...(seated ? {} : { subject: null, focusSince: null }) });
    void this.d.social.probeFriendRequests();          // does the server have "Add friend" yet (0125)? Asked once; the card hides the button until it says yes
    const rt = this.d.realtime?.() ?? null;
    if (rt) {
      this.watch = watchLobby(rt, {
        shard, me: this.me, people: [], floorNow: () => this.floorNow(), now: this.now,
        onSignal: (sig) => this.heard(sig),
        onLive: (live) => this.set({ live }),
      });
    }
    this.floorChanged();
    this.ensureTicker();
  }

  private dropWatch() { this.watch?.stop(); this.watch = null; }

  private ensureTicker() {
    if (this.cancel || !this.d.every) return;
    this.cancel = this.d.every(() => { void this.tick(); }, 1000);
  }

  /** Moves to another library (the picker). When it was full the server puts you in another, and the line says so. */
  async switchTo(shard: number): Promise<void> {
    if (this.s.phase !== "live" || shard === this.s.shard) return;
    await this.start(shard);
  }

  /** Out of sight and out of mind: neither you nor anyone else is shown (`set_lobby_visible`). */
  async setVisible(visible: boolean): Promise<void> {
    const r = await this.d.social.setLobbyVisible(visible);
    if (!r.ok) { this.say("That didn’t go through. Try again in a moment"); return; }
    if (visible) await this.start(); else {
      this.gen++;
      this.dropWatch();
      this.set({ phase: "hidden", shard: null, people: [], messages: [], live: false, seated: false, focusSince: null, subject: null });
      this.floorChanged();
    }
  }

  /** Close the visit: say so on the floor, leave the lobby (so nobody sees you standing in an empty room), stop. */
  leave(): void {
    this.stopped = true;
    this.gen++;
    this.cancel?.(); this.cancel = null;
    const was = this.s.phase === "live";
    this.watch?.leave(); this.watch = null;
    if (was) void this.d.social.leaveLobby();
    this.set({ phase: "idle", shard: null, people: [], live: false, seated: false, focusSince: null, subject: null });
  }

  /* ── The beat ─────────────────────────────────────────────────────── */

  async tick(): Promise<void> {
    if (this.stopped) return;
    const t = this.now();
    if (this.s.phase === "unavailable" && t - this.lastRetry >= RETRY_MS) { this.lastRetry = t; await this.start(); return; }
    if (this.s.phase !== "live" || this.busy) return;
    this.watch?.tick();
    this.busy = true;
    const gen = this.gen;
    try {
      if (this.statusDirty || t - this.lastPos >= POS_EVERY_MS) await this.pushPosition(gen);
      if (gen !== this.gen) return;
      if (t - this.lastPeople >= (this.s.live ? PEOPLE_LIVE_EVERY_MS : PEOPLE_EVERY_MS)) await this.readPeople(gen);
      if (gen !== this.gen) return;
      if (t - this.lastChat >= CHAT_EVERY_MS) await this.readChat(gen);
      if (gen !== this.gen) return;
      if (t - this.lastServers >= SERVERS_EVERY_MS) await this.readServers(gen);
    } finally {
      this.busy = false;
    }
  }

  private async readAll() {
    const gen = this.gen;
    this.busy = true;
    try {
      // each step only while this is still the visit that began them (leaving or switching library stops the rest)
      await this.pushPosition(gen);
      if (gen !== this.gen) return;
      await this.readPeople(gen);
      if (gen !== this.gen) return;
      await this.readChat(gen);
      if (gen !== this.gen) return;
      await this.readServers(gen);
    } finally { this.busy = false; }
  }

  private async pushPosition(gen: number) {
    const s = this.s;
    if (s.shard === null) return;
    const t = this.now();
    this.statusDirty = false;
    const r = await this.d.social.setLobbyPosition(s.shard, LIBRARY_TILE, { seated: s.seated, subjectId: s.subject, focusSince: s.focusSince });
    if (gen !== this.gen) return;
    if (!r.ok) { this.lastPos = t - POS_EVERY_MS + 3000; this.statusDirty = true; return; }
    this.lastPos = t;
    if (!r.value) await this.rejoin(gen);          // hidden since, or the row went stale and was cleared: join again
  }

  /** The server says you are not in that shard any more: back in, in the same one if it has room. */
  private async rejoin(gen: number) {
    const want = this.s.shard;
    const r = await this.d.social.joinLobby(LIBRARY_TILE, want);
    if (gen !== this.gen) return;
    if (!r.ok) return;
    if (r.value.shard === null) {
      this.dropWatch();
      this.set({ phase: "hidden", shard: null, people: [], messages: [], live: false });
      return;
    }
    if (r.value.shard !== want) { this.adopt(r.value.shard, r.value.nickname); return; }
    this.statusDirty = true;
  }

  private async readPeople(gen: number) {
    const shard = this.s.shard;
    if (shard === null) return;
    const t = this.now();
    this.lastPeople = t;
    const r = await this.d.social.lobbyPeople(shard);
    if (gen !== this.gen) return;
    if (!r.ok) {
      if (r.failure.kind === "refused" && r.failure.reason === "not_member") await this.rejoin(gen);
      return;
    }
    const people = listPeople(r.value.filter((p) => p.id !== this.me));
    const ids = new Set(people.map((p) => p.id));
    for (const id of [...this.floor.keys()]) if (!ids.has(id)) this.floor.delete(id);
    for (const id of [...this.gone.keys()]) if (!ids.has(id)) this.gone.delete(id);
    for (const p of people) {
      const kind = emoteOf(p, t);
      if (kind && p.emoteAt !== null && this.lastEmote.get(p.id) !== p.emoteAt) { this.lastEmote.set(p.id, p.emoteAt); this.emit({ type: "emote", id: p.id, kind }); }
    }
    this.watch?.setPeople(people.map((p) => p.id));
    this.set({ people });
    this.floorChanged();
  }

  private async readChat(gen: number) {
    const shard = this.s.shard;
    if (shard === null) return;
    const t = this.now();
    this.lastChat = t;
    this.chatReads += 1;
    const newest = this.s.messages[this.s.messages.length - 1]?.createdAt;
    const full = !this.s.chatLoaded || this.chatReads % CHAT_FULL_EVERY === 0 || newest === undefined;
    const r = await this.d.social.libraryMessages(shard, full ? null : newest - 1000);
    if (gen !== this.gen) return;
    if (!r.ok) { if (r.failure.kind === "refused" && r.failure.reason === "not_member") await this.rejoin(gen); return; }
    this.set({ messages: mergeMessages(this.s.messages, r.value, { replacing: full }), chatLoaded: true });
  }

  private async readServers(gen: number) {
    this.lastServers = this.now();
    const r = await this.d.social.lobbyServers();
    if (gen !== this.gen || !r.ok) return;
    this.set({ servers: r.value });
  }

  /** Reads the servers now (the picker opened). */
  async refreshServers() { if (this.stopped || this.s.phase !== "live") return; await this.readServers(this.gen); }

  /* ── Realtime ─────────────────────────────────────────────────────── */

  private heard(sig: LobbySignal) {
    if (this.s.phase !== "live" || sig.user === this.me) return;
    const t = this.now();
    if (sig.kind === "left") {
      this.floor.delete(sig.user);
      this.gone.set(sig.user, t);
    } else {
      this.gone.delete(sig.user);
      if (sig.floor) this.floor.set(sig.user, { floor: sig.floor, at: t, seq: ++this.seq });
    }
    this.floorChanged();
  }

  /* ── What you do ──────────────────────────────────────────────────── */

  /** You walked, sat or stood: the room's place for you changed. Says so on the floor, and to the server if seated changed. */
  roomChanged() {
    const f = this.floorNow();
    const seated = f?.seat != null;
    if (seated !== this.s.seated) {
      this.statusDirty = true;
      this.set(seated ? { seated } : { seated, focusSince: null, subject: null });
      if (seated) this.applyTimer();               // sitting down while the timer runs: you are focusing again, since the work began
    }
    this.watch?.changed();
  }

  /**
   * The study timer drives your focus (one-way: the timer tells the visit, never the other way). Work running
   * while you are seated is "focusing since the work began"; paused, on a break, waiting or stopped is not.
   * Standing up does not stop the timer, it only stops publishing it: the focus is remembered here and
   * published again when you sit. The server calls are the ones `startFocus` and `stopFocus` already make.
   */
  followTimer(focus: TimerFocus) {
    this.timer = focus;
    this.applyTimer();
  }
  private applyTimer() {
    if (!this.s.seated) return;
    const f = this.timer;
    if (f) {
      if (this.s.focusSince === f.since && this.s.subject === f.subject) return;
      this.statusDirty = true;
      this.set({ subject: f.subject, focusSince: f.since });
    } else if (this.s.focusSince !== null) {
      this.statusDirty = true;
      this.set({ focusSince: null });
    }
  }

  /** Start the timer: what you are on, and when you began. Only while seated. */
  startFocus(subject: string | null) {
    if (!this.s.seated) return;
    this.statusDirty = true;
    this.set({ subject, focusSince: this.now() });
  }
  /** The subject changed while timing (the clock keeps running). */
  setSubject(subject: string | null) {
    if (!this.s.seated) return;
    this.statusDirty = true;
    this.set({ subject });
  }
  stopFocus() {
    if (this.s.focusSince === null) return;
    this.statusDirty = true;
    this.set({ focusSince: null });
  }

  async emote(kind: LobbyEmote): Promise<void> {
    if (this.s.phase !== "live") return;
    const r = await this.d.social.lobbyEmote(kind);
    if (!r.ok) { this.say("That didn’t go through. Try again in a moment"); return; }
    if (r.value === "sent") { this.emit({ type: "emote", id: "you", kind }); return; }
    if (r.value === "not_in_lobby") { await this.rejoin(this.gen); return; }
    const line = emoteLine(r.value);
    if (line) this.say(line);
  }

  /** Whether to offer "Add friend" at all: not once the server has said it does not have it (a project without 0125). */
  get canRequestFriends(): boolean { return this.d.social.canRequestFriends !== false; }

  /** "Add friend" on someone's card (0125). The card shows the line; the server's answer is the one that counts. */
  async addFriend(id: string): Promise<FriendAsk> {
    const asked = await friendRequestFromLobby(this.d.social, id);
    if (asked.settled) this.set({ people: this.s.people.map((p) => p.id === id
      ? { ...p, friendRequest: asked.nowFriends ? null : "sent", isFriend: p.isFriend || asked.nowFriends } : p) });
    return asked;
  }

  /** Sends a chat message. The browser checks it first (`librarySpam`), the server's answer is the one that counts. */
  async send(body: string): Promise<{ ok: true } | { ok: false; line: string }> {
    const shard = this.s.shard;
    if (this.s.phase !== "live" || shard === null) return { ok: false, line: "One moment, rejoining the library" };
    const t = this.now();
    const recent = this.s.messages.filter((m) => m.senderId === this.me).map((m) => ({ body: m.body, at: m.createdAt }));
    const r: Result<LibraryMessage> = await this.d.social.sendLibraryMessage(shard, body, recent, t);
    if (!r.ok) {
      if (r.failure.kind === "refused" && r.failure.reason === "not_member") void this.rejoin(this.gen);
      return { ok: false, line: sendLine(r.failure) };
    }
    this.set({ messages: mergeMessages(this.s.messages, [r.value], { replacing: false }) });
    return { ok: true };
  }

  /** Reports a message: it goes from your screen at once; with `block`, so does everything its sender wrote. */
  async reportMessage(m: LibraryMessage, reason: MessageReportReason, block: boolean): Promise<void> {
    if (m.senderId === this.me) return;
    this.set({ messages: this.s.messages.filter((x) => x.id !== m.id && !(block && x.senderId === m.senderId)) });
    if (block) this.dropPerson(m.senderId);
    const r = await this.d.social.reportLibraryMessage(m.id, reason, block);
    this.say(r.ok ? (block ? "Reported and blocked" : "Reported. Thanks for telling us") : "Couldn’t send that report. Try again in a moment");
  }

  async reportPerson(id: string, reason: UserReportReason): Promise<void> {
    const r = await this.d.social.reportUser(id, reason, null);
    this.say(r.ok ? "Reported. Thanks for telling us" : "Couldn’t send that report. Try again in a moment");
  }

  async blockPerson(id: string): Promise<void> {
    this.dropPerson(id);
    const r = await this.d.social.block(id);
    this.say(r.ok ? "Blocked" : "Couldn’t block them. Try again in a moment");
  }

  /** Someone you blocked: gone from the list, the floor and the chat at once (the server stops returning them from the next read). */
  private dropPerson(id: string) {
    this.floor.delete(id);
    this.gone.set(id, this.now());
    this.set({ people: this.s.people.filter((p) => p.id !== id), messages: this.s.messages.filter((m) => m.senderId !== id) });
    this.floorChanged();
  }
}
