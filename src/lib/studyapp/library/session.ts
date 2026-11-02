import { cleanInput } from "../../social/chatRules";
import { fail, studentFacing, type Failure, type Result } from "../../social/failure";
import { serverOffsetHint } from "../../social/serverTime";
import type { SocialService } from "../../social/service";
import {
  emoteLine, emoteOf, listPeople, mergeMessages, totalHere,
  type LibraryMessage, type LobbyEmote, type LobbyPerson, type LobbyServers,
} from "../../social/lobby";
import type { FriendsSnapshot, MessageReportReason, UserReportReason } from "../../social/types";
import type { LobbyFriendRequest } from "../../social/lobby";
import type { LiveSummary } from "../live";
import { composeRemotes, labelFor, type HeardFloor, type RemoteState } from "./compose";
import { friendRequestFromLobby, type FriendAsk } from "./friendRequest";
import { buildFriends, buildRequests, friendsFromRoom, keepSame, type FriendEntry, type RequestEntry } from "./friends";
import type { Lease } from "./lease";
import { watchLobby, type LobbyRealtime, type LobbySignal, type LobbyWatch } from "./lobbyWatch";
import { LIBRARY_TILE, type FloorPresence } from "./room";
import { ServerClock } from "./serverClock";

/**
 * One student's visit to the Grand Library: the state of it, and everything that keeps it true. The iPad's
 * SocialModel (enterLobby, lobbyBeat, switchLobby, hallTick) and GroupChatModel (the chat) are the reference;
 * this is their web counterpart, over the same server functions. No browser, no React: a service, an optional
 * Realtime, a clock and a ticker are handed in, so a scripted world drives it in the tests and the demo.
 *
 * THE BEAT (once a second, one thing at a time)
 *   position    `lobby_set_position` when what you are doing changed, and at least every ten seconds (a row is
 *               fresh for 30; HallPositions.heartbeat)
 *   people      `lobby_people` every 2 seconds, every 12 while the floor is live (the iPad reads every 5: SocialModel.lobbyReadEvery,
 *               HallPositions.liveReadEvery; the web saves the calls because Realtime already carries the movement)
 *   chat        `library_messages` every 4 seconds while the chat is on screen (GroupChatModel.pollInterval), every 20 otherwise,
 *               the newest 100 afresh every sixth read so a hidden message goes (fullReadEvery)
 *   servers     `lobby_servers` every 20 seconds while the picker is open, every 60 otherwise (the count)
 *   friends     `loadFriends` + `lobbyFriendRequests` once on joining, then every 60 seconds while the visit is live,
 *               at once when the People tab opens (`refreshFriends`), and after any friend action. A failed read
 *               keeps the last good list and says nothing.
 *
 * A student never sees an error: a failed read keeps what was last good; a failed write says one quiet line.
 *
 * WHEN THINGS GO WRONG (each of these was measured before it was fixed)
 *   a hung request   every call to the server is given `CALL_TIMEOUT_MS` and then counts as a network failure, and a
 *                    beat that somehow still hangs is given up on (`BUSY_WATCHDOG_MS`), so one half-open connection
 *                    (a laptop that slept) can never stop the visit for good.
 *   a failing call   is not repeated every second: each kind of call backs off 1, 2, 4 ... 30 seconds, with jitter,
 *                    and longer when the server said it is busy. After a few failures in a row `online` is false
 *                    (the page says "Catching up"); one success and it is true again.
 *   two tabs         only one tab per student is in the library (the lease, lease.ts); the other is `elsewhere` and
 *                    does nothing until its student says "move here" (`takeOver`).
 *   another account  the visit is for one student. If the browser's signed-in student changes, the visit leaves as the
 *                    student it began as (`farewell`) and stops; it never speaks as anyone else.
 *   a closing tab    `pageHidden` leaves at once with a request that outlives the page; if the page comes back from the
 *                    back/forward cache, `pageShown` goes in again.
 *   a hidden tab     for the first minute carries on as normal minus the reads (nobody is looking); after that one position
 *                    push every 25 seconds (the server forgets a student after 30) and nothing else. Hidden or untouched
 *                    for ten minutes with no study timer running, the visit ends (phase `away`) and the page offers to
 *                    rejoin. When the tab is seen again everything is read at once (`visible`).
 *   cost             the chat is read every 4 seconds only while it is on screen (every 20 otherwise), the libraries' counts
 *                    every 20 only while the picker is open (every 60 otherwise), the list every 12 while Realtime is up.
 *   the clock        every time the server gives is written into this device's clock where it comes in (serverClock.ts).
 */

/** What the study timer publishes to the library: focusing on `subject` since `since` (epoch ms), or null when it is not. */
export type TimerFocus = { subject: string | null; since: number } | null;

/**
 * `elsewhere`: this student is in the library in another tab of this browser; this one does nothing until told to move here.
 * `away`: the visit ended because the tab sat hidden or untouched for a long time; the page offers to rejoin.
 */
export type Phase = "idle" | "joining" | "live" | "hidden" | "unavailable" | "elsewhere" | "away";

export type LibrarySocial = Pick<SocialService,
  "joinLobby" | "lobbyServers" | "setLobbyPosition" | "leaveLobby" | "lobbyPeople" | "lobbyEmote" | "libraryMessages" |
  "sendLibraryMessage" | "reportLibraryMessage" | "block" | "reportUser" | "setLobbyVisible" | "setAvatar" |
  "sendLobbyFriendRequest" | "probeFriendRequests" | "canRequestFriends" |
  "loadFriends" | "respondToFriendRequest" | "removeFriend" | "lobbyFriendRequests">;

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
  /** The server is answering. False after a few calls in a row have failed: the page says it is catching up, in those words and no others. */
  online: boolean;
  /**
   * ALL your accepted friends, each joined by id to who is in this library now (in this library first, then studying
   * elsewhere, then the rest by name). Null until the first read has been answered; if that first read cannot be
   * answered, the friends the room itself marks. A later failure keeps the last good list.
   */
  friends: FriendEntry[] | null;
  /** Requests waiting on you: library ones as a nickname only, ordinary ones by name. Never your own, never a friend's. */
  requests: RequestEntry[];
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
  /**
   * Leaves the library as `me`, the student this visit is for, whoever the browser is signed in as by the time it
   * runs, and even while the page is closing (farewell.ts). Returns false when it could not be sent; the ordinary
   * `leaveLobby` is then used. Without it (tests, the demo) the ordinary call is all there is.
   */
  farewell?: () => boolean;
  /** The student the browser is signed in as right now. If it is ever someone other than `me` the visit ends itself. */
  current?: () => string | null;
  /** One tab at a time (lease.ts). Without it every tab is the library tab. */
  lease?: Lease | null;
  /** How long a call to the server may take before it counts as failed (default `CALL_TIMEOUT_MS`). */
  callTimeoutMs?: number;
  /** The server's clock minus this device's, if something has measured it (serverTime.ts). */
  serverOffset?: () => number | null;
  /** How often the list is read while Realtime is healthy (default `PEOPLE_LIVE_EVERY_MS`). */
  peopleLiveEveryMs?: number;
  /** Milliseconds between batches of Realtime topics joined (lobbyWatch.ts); 0 joins them all at once. */
  listenGapMs?: number;
  /** Random in [0, 1): the jitter of a back-off. */
  random?: () => number;
}

export const POS_EVERY_MS = 10_000;
export const PEOPLE_EVERY_MS = 2_000;
/**
 * While Realtime is healthy the floor news and the leavers arrive by themselves, so the list is only for newcomers and
 * their details: a new face shows within this (the roster stays accurate to about 15 seconds). Without Realtime it is
 * read every `PEOPLE_EVERY_MS`.
 */
export const PEOPLE_LIVE_EVERY_MS = 12_000;
export const CHAT_EVERY_MS = 4_000;
export const CHAT_FULL_EVERY = 6;
/** The libraries picker, while it is open. Otherwise the count is read at most this often (the Desk's "revising" figure). */
export const SERVERS_EVERY_MS = 20_000;
export const SERVERS_IDLE_EVERY_MS = 60_000;
/** The chat while it is not on screen: for the speech bubbles over heads and the unread count (a bubble shows within about this). */
export const CHAT_CLOSED_EVERY_MS = 8_000;
/** A tab hidden for longer than this sends only a slow heartbeat: under the server's freshness window (30 s, `lobby_fresh`, 0117). */
export const HIDDEN_AFTER_MS = 60_000;
export const HIDDEN_POS_EVERY_MS = 25_000;
/** Hidden, or with no input at all, for this long (and no study timer running): the visit ends and the page offers to rejoin. */
export const AWAY_AFTER_MS = 10 * 60_000;
export const FRIENDS_EVERY_MS = 60_000;
/** Opening the People tab reads at once, but not twice within this (a student tapping the tab on and off is not asking the server each time). */
export const FRIENDS_MIN_GAP_MS = 3_000;
/** Kept for callers; a failed join is now retried on a back-off (`bad("start")`), not on a fixed ten seconds. */
export const RETRY_MS = 10_000;
/** A call to the server that has not answered by now has failed (the data API client aborts at 8 s too: serverTime.ts). */
export const CALL_TIMEOUT_MS = 8_000;
/** A beat that has been running this long is abandoned (each call has its own timeout, so this is a second line of defence). */
export const BUSY_WATCHDOG_MS = 45_000;
/** A failing kind of call is asked again after 1, 2, 4 ... seconds, never more than this apart. */
export const BACKOFF_MAX_MS = 30_000;
/** This many failures in a row of the position push or the people read and the visit says it is catching up. */
export const OFFLINE_AFTER = 3;

type Lane = "pos" | "people" | "chat" | "servers" | "friends" | "join" | "start";
const LANES: readonly Lane[] = ["pos", "people", "chat", "servers", "friends", "join", "start"];
const lanes = <T,>(v: T): Record<Lane, T> => Object.fromEntries(LANES.map((l) => [l, v])) as Record<Lane, T>;

/** `social` with a timeout on every call: one that has not answered counts as a network failure (its answer, if it ever comes, is ignored). */
function guarded(social: LibrarySocial, ms: number): LibrarySocial {
  return new Proxy(social, {
    get(target, key) {
      const v = Reflect.get(target, key, target);
      if (typeof v !== "function") return v;
      return (...args: unknown[]) => new Promise((resolve) => {
        const gone = key === "probeFriendRequests" ? null : fail({ kind: "offline" });
        const timer = setTimeout(() => resolve(gone), ms);
        (timer as unknown as { unref?: () => void }).unref?.();          // (Node only: a pending timeout must not hold a test process open)
        let p: unknown;
        try { p = (v as (...a: unknown[]) => unknown).apply(target, args); } catch { clearTimeout(timer); resolve(gone); return; }
        Promise.resolve(p).then((r) => { clearTimeout(timer); resolve(r); }, () => { clearTimeout(timer); resolve(gone); });
      });
    },
  });
}

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
    messages: [], chatLoaded: false, live: false, online: true, friends: null, requests: [],
  };
  /** What the last good reads said (the snapshot's `friends` and `requests` are these joined to the room). */
  private rawFriends: FriendsSnapshot | null = null;
  private rawAsked: LobbyFriendRequest[] = [];
  private friendsTried = false;
  private friendsInFlight: Promise<void> | null = null;
  private lastFriends = -Infinity;
  /** Blocked this visit: never listed as a friend or a request, whatever the next read says. */
  private blocked = new Set<string>();
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
  private busyAt = 0;
  private beat = 0;
  /** A join may have reached the server (so a leave is owed), whatever its answer was or whether it came. */
  private joined = false;
  /** This tab holds the lease (see lease.ts). */
  private leased = false;
  private offLost: (() => void) | null = null;
  /** The page is not being looked at: only the position goes out. */
  private away = false;
  /** The page was put away (back/forward cache) with a visit open: come in again when it is shown. */
  private shelved = false;
  private fails = lanes(0);
  private holdOff = lanes(-Infinity);
  private statusDirty = true;
  private lastPos = -Infinity;
  private lastPeople = -Infinity;
  private lastChat = -Infinity;
  private lastServers = -Infinity;
  private lastRetry = -Infinity;
  private awayAt = 0;
  private lastInput = 0;
  private panels = { chat: true, libraries: true };
  private chatReads = 0;
  private seq = 0;
  private stopped = false;
  /** What the study timer says you are doing (see `followTimer`); remembered while you stand, applied when you sit. */
  private timer: TimerFocus | null = null;

  private now: () => number;
  private me: string;
  private social: LibrarySocial;
  private clock: ServerClock;
  private random: () => number;

  constructor(private d: SessionDeps) {
    this.now = d.now ?? Date.now;
    this.me = d.me.toLowerCase();
    this.social = guarded(d.social, d.callTimeoutMs ?? CALL_TIMEOUT_MS);
    this.clock = new ServerClock(d.serverOffset ?? serverOffsetHint);
    this.random = d.random ?? Math.random;
  }

  /** The server's now, on the server's own clock. */
  private serverNow() { return this.clock.now(this.now()); }

  /** A call failed: that kind is not asked again for a while (1, 2, 4 ... seconds, with jitter; longer if the server said it is busy). */
  private bad(lane: Lane, f?: Failure) {
    const n = ++this.fails[lane];
    // exponential, with full jitter (anywhere from half a second to the step), so a server that comes back is not met by everyone at once
    const slow = lane === "start" || lane === "join";
    const step = Math.min(BACKOFF_MAX_MS, (slow ? 2000 : 1000) * 2 ** (n - 1));
    const wait = Math.max(500, this.random() * step);
    const asked = f?.kind === "unavailable" ? f.retryAfterMs ?? 0 : 0;
    this.holdOff[lane] = this.now() + Math.max(wait, asked);
    this.judge();
  }
  private good(lane: Lane) {
    if (this.fails[lane] === 0 && this.holdOff[lane] === -Infinity) return;
    this.fails[lane] = 0; this.holdOff[lane] = -Infinity;
    this.judge();
  }
  private ready(lane: Lane) { return this.now() >= this.holdOff[lane]; }
  private judge() { this.set({ online: this.fails.pos < OFFLINE_AFTER && this.fails.people < OFFLINE_AFTER }); }

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
    if (s.phase === "idle" || s.phase === "joining" || s.phase === "unavailable" || s.phase === "elsewhere") return;
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
    this.shelved = false;
    const gen = ++this.gen;
    if (this.foreign()) return;
    this.lastInput = this.now();
    this.set({ phase: "joining" });
    if (!(await this.hold(gen))) return;
    this.joined = true;                                   // from here a leave is owed, whatever the join's answer is (or whether one comes)
    const r = await this.social.joinLobby(LIBRARY_TILE, want);
    if (gen !== this.gen || this.stopped) return;
    if (!r.ok) { this.bad("start", r.failure); this.set({ phase: "unavailable" }); this.ensureTicker(); return; }
    this.good("start");
    if (r.value.shard === null) {
      this.joined = false;
      this.dropWatch(true);
      this.set({ phase: "hidden", nickname: r.value.nickname, shard: null, people: [], messages: [], live: false, ...this.view([]) });
      this.ensureTicker();
      return;
    }
    if (want && r.value.wantedFull) this.say("That library is full, so you’re in another");
    this.adopt(r.value.shard, r.value.nickname);
    await this.readAll();
  }

  private adopt(shard: number, nickname: string) {
    this.dropWatch(true);                                 // moving library: say so on the one you leave
    this.floor.clear(); this.gone.clear(); this.lastEmote.clear();
    this.statusDirty = true; this.lastPos = -Infinity; this.lastPeople = -Infinity; this.lastChat = -Infinity; this.chatReads = 0;
    this.fails = lanes(0); this.holdOff = lanes(-Infinity);
    this.lastInput = this.now();
    // The server forgets what you were doing when you join (seated and the timer are cleared): say it again if the room still has you in a seat.
    const seated = this.floorNow()?.seat != null;
    this.set({ phase: "live", shard, nickname, people: [], messages: [], chatLoaded: false, live: false, online: true, seated, ...this.view([]), ...(seated ? {} : { subject: null, focusSince: null }) });
    void this.social.probeFriendRequests();          // does the server have "Add friend" yet (0125)? Asked once; the card hides the button until it says yes
    const rt = this.d.realtime?.() ?? null;
    if (rt) {
      this.watch = watchLobby(rt, {
        shard, me: this.me, people: [], floorNow: () => this.floorNow(), now: this.now, listenGapMs: this.d.listenGapMs,
        onSignal: (sig) => this.heard(sig),
        onLive: (live) => this.set({ live }),
      });
    }
    this.floorChanged();
    this.ensureTicker();
  }

  /** Stops listening on the floor; with `say`, tells it you have gone first. */
  private dropWatch(say = false) { if (say) this.watch?.leave(); else this.watch?.stop(); this.watch = null; }

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
    if (this.foreign()) return;
    const r = await this.social.setLobbyVisible(visible);
    if (!r.ok) { this.say("That didn’t go through. Try again in a moment"); return; }
    if (visible) await this.start(); else {
      this.gen++;
      this.joined = false;                          // the server took you out of the lobby
      this.dropWatch(true);
      this.set({ phase: "hidden", shard: null, people: [], messages: [], live: false, seated: false, focusSince: null, subject: null, ...this.view([]) });
      this.floorChanged();
    }
  }

  /**
   * Close the visit: say so on the floor, leave the lobby (so nobody sees you standing in an empty room), stop. The
   * lobby is left whenever a join might have reached the server, whatever state the visit got to (a failed switch, a
   * rejoin that never answered), and never when it did not (a tab that was never the library tab must not take the
   * other tab's student out of the room).
   */
  leave(): void {
    this.stopped = true;
    this.gen++;
    this.cancel?.(); this.cancel = null;
    this.watch?.leave(); this.watch = null;
    if (this.joined) this.goodbye();
    this.joined = false;
    this.letGo();
    this.set({ phase: "idle", shard: null, people: [], live: false, online: true, seated: false, focusSince: null, subject: null, ...this.view([]) });
  }

  /** `lobby_leave` as the student this visit is for: the farewell (a request that outlives the page, signed as `me`), else the ordinary call. */
  private goodbye() {
    let sent = false;
    try { sent = this.d.farewell?.() === true; } catch { sent = false; }
    if (!sent) void this.social.leaveLobby();
  }

  /** The browser's signed-in student is not the one this visit is for: leave as the one it is for, and stop. */
  private foreign(): boolean {
    const now = this.d.current?.();
    if (now === undefined || now === null || now.toLowerCase() === this.me) return false;
    this.leave();
    return true;
  }

  /* ── One tab at a time ────────────────────────────────────────────── */

  private holding: Promise<boolean> | null = null;

  /** Becomes the library tab (or, with `steal`, takes it from whoever is). False, and the visit says `elsewhere`, when another tab is. */
  private async hold(gen: number, steal = false): Promise<boolean> {
    const lease = this.d.lease;
    if (!lease || this.leased) return true;
    if (!this.holding || steal) {
      const asked = steal ? lease.steal() : lease.claim();
      const mine: Promise<boolean> = asked.then((got) => {
        if (this.holding === mine) this.holding = null;
        if (!got) return false;
        if (this.stopped) { lease.release(); return false; }          // left while asking
        this.leased = true;
        this.offLost = lease.onLost(() => this.lost());
        return true;
      }, () => { if (this.holding === mine) this.holding = null; return true; });   // a lease that cannot answer is no lease
      this.holding = mine;
    }
    const got = await this.holding;
    if (gen !== this.gen || this.stopped) return false;
    if (!got) { this.standAside(); return false; }
    return true;
  }

  /** Another tab of this student is the library tab: nothing here is asked of the server, and nothing is shown but that. */
  private standAside() {
    this.gen++;
    this.cancel?.(); this.cancel = null;
    this.dropWatch();
    this.joined = false;
    this.set({ phase: "elsewhere", shard: null, people: [], messages: [], live: false, online: true, seated: false, focusSince: null, subject: null, ...this.view([]) });
    this.floorChanged();
  }

  /** Another tab took the library from this one. The server row is theirs now, so nothing is sent: a leave from here would take THEM out. */
  private lost() {
    if (!this.leased) return;
    this.leased = false;
    this.offLost?.(); this.offLost = null;
    this.stopped = true;
    this.standAside();
  }

  private letGo() {
    this.offLost?.(); this.offLost = null;
    if (this.leased) { this.leased = false; this.d.lease?.release(); }
  }

  /** "Move here": this tab becomes the library tab and the other one stops. */
  async takeOver(): Promise<void> {
    if (this.s.phase !== "elsewhere") return;
    this.stopped = false;
    const gen = ++this.gen;
    if (!(await this.hold(gen, true))) return;
    await this.start();
  }

  /* ── The page ─────────────────────────────────────────────────────── */

  /** The page is going (closing, or into the back/forward cache): leave now, with a request that outlives it. */
  pageHidden(): void {
    if (this.s.phase === "idle" || this.s.phase === "elsewhere") return;
    this.shelved = true;
    this.leave();
  }

  /** The page came back from the back/forward cache with a visit open when it went: come in again. */
  pageShown(persisted: boolean): void {
    if (persisted && this.shelved) { this.shelved = false; void this.start(); }
  }

  /**
   * The tab is shown (true) or put in the background (false). In the background only the position goes out (the server
   * forgets a student after 30 seconds without one); on coming back everything is read at once, and a call that had been
   * left hanging by a sleep is let go.
   */
  visible(shown: boolean): void {
    if (!shown && !this.away) this.awayAt = this.now();
    this.away = !shown;
    if (shown) this.lastInput = this.now();
    if (!shown || this.stopped) return;
    this.holdOff = lanes(-Infinity);
    this.lastRetry = -Infinity;
    this.lastPeople = -Infinity; this.lastChat = -Infinity; this.lastServers = -Infinity;
    this.statusDirty = true;
    this.abandon();
    this.watch?.changed();
    void this.tick();
  }

  /** The student touched the page (a key, a tap, the pointer): they are here. The page reports it, throttled. */
  touch(): void { this.lastInput = this.now(); }

  /**
   * Which panels are on screen. The chat is read every few seconds only while it is shown (otherwise now and then, to
   * count what is new), and the libraries' counts only while the picker is shown (otherwise once a minute). Opening
   * either reads at once.
   */
  setPanels(p: { chat: boolean; libraries: boolean }): void {
    if (p.chat && !this.panels.chat) this.lastChat = -Infinity;
    if (p.libraries && !this.panels.libraries) this.lastServers = -Infinity;
    this.panels = { ...p };
  }

  /** The visit ends because nobody has been here for a while (hidden, or untouched, with no study timer running): the page offers to rejoin. */
  private stepAway() {
    this.leave();
    this.set({ phase: "away" });
  }

  /** "Rejoin", after the visit ended for a long absence. */
  async comeBack(): Promise<void> {
    if (this.s.phase !== "away") return;
    this.lastInput = this.now();
    await this.start();
  }

  /* ── The beat ─────────────────────────────────────────────────────── */

  /** Gives up on the beat in progress (it hung): its answers are ignored and the next beat is free to start. */
  private abandon() { this.beat++; this.busy = false; }

  async tick(): Promise<void> {
    if (this.stopped || this.foreign()) return;
    const t = this.now();
    if (this.s.phase === "unavailable") {
      if (this.ready("start")) { this.lastRetry = t; await this.start(); }
      return;
    }
    if (this.s.phase !== "live") return;
    // long hidden, or untouched, and not studying: leave rather than stand in the room for hours
    if (this.timer === null && t - (this.away ? this.awayAt : this.lastInput) >= AWAY_AFTER_MS) { this.stepAway(); return; }
    const hiddenLong = this.away && t - this.awayAt >= HIDDEN_AFTER_MS;
    if (this.busy) { if (t - this.busyAt < BUSY_WATCHDOG_MS) return; this.abandon(); }
    if (!hiddenLong) this.watch?.tick();               // a long-hidden tab does not resend its place; the server's row is what keeps it listed
    const gen = this.gen, beat = ++this.beat;
    const current = () => gen === this.gen && beat === this.beat;
    this.busy = true; this.busyAt = t;
    try {
      if ((this.statusDirty || t - this.lastPos >= (hiddenLong ? HIDDEN_POS_EVERY_MS : POS_EVERY_MS)) && this.ready("pos")) await this.pushPosition(gen);
      if (!current() || this.away) return;                        // in the background nothing but the position goes out
      if (t - this.lastPeople >= (this.s.live ? this.d.peopleLiveEveryMs ?? PEOPLE_LIVE_EVERY_MS : PEOPLE_EVERY_MS) && this.ready("people")) await this.readPeople(gen);
      if (!current()) return;
      if (t - this.lastChat >= (this.panels.chat ? CHAT_EVERY_MS : CHAT_CLOSED_EVERY_MS) && this.ready("chat")) await this.readChat(gen);
      if (!current()) return;
      if (t - this.lastServers >= (this.panels.libraries ? SERVERS_EVERY_MS : SERVERS_IDLE_EVERY_MS) && this.ready("servers")) await this.readServers(gen);
      if (!current()) return;
      if (t - this.lastFriends >= FRIENDS_EVERY_MS) await this.refreshFriends();
    } finally {
      if (beat === this.beat) this.busy = false;
    }
  }

  private async readAll() {
    const gen = this.gen, beat = ++this.beat;
    const current = () => gen === this.gen && beat === this.beat;
    this.busy = true; this.busyAt = this.now();
    try {
      // each step only while this is still the visit that began them (leaving or switching library stops the rest)
      await this.pushPosition(gen);
      if (!current()) return;
      await this.readPeople(gen);
      if (!current()) return;
      await this.readChat(gen);
      if (!current()) return;
      await this.readServers(gen);
      if (!current()) return;
      if (!this.friendsTried || this.now() - this.lastFriends >= FRIENDS_EVERY_MS) await this.refreshFriends();   // once on joining, not again on every switch of library
    } finally { if (beat === this.beat) this.busy = false; }
  }

  private async pushPosition(gen: number) {
    const s = this.s;
    if (s.shard === null) return;
    const t = this.now();
    this.statusDirty = false;
    // when you began, in the server's time: a device clock minutes out would otherwise put it in the future (refused) or make you look five minutes further in
    const since = s.focusSince === null ? null : s.focusSince + this.clock.offset();
    const r = await this.social.setLobbyPosition(s.shard, LIBRARY_TILE, { seated: s.seated, subjectId: s.subject, focusSince: since });
    if (gen !== this.gen) return;
    if (!r.ok) { this.statusDirty = true; this.bad("pos", r.failure); return; }       // asked again after 1, 2, 4 ... seconds, not every second
    this.good("pos");
    this.lastPos = t;
    if (!r.value) await this.rejoin(gen);          // hidden since, or the row went stale and was cleared: join again
  }

  /** The server says you are not in that shard any more: back in, in the same one if it has room. */
  private async rejoin(gen: number) {
    if (!this.ready("join")) return;
    const want = this.s.shard;
    this.joined = true;
    const r = await this.social.joinLobby(LIBRARY_TILE, want);
    if (gen !== this.gen) return;
    if (!r.ok) { this.bad("join", r.failure); return; }
    this.good("join");
    if (r.value.shard === null) {
      this.joined = false;
      this.dropWatch(true);
      this.set({ phase: "hidden", shard: null, people: [], messages: [], live: false, ...this.view([]) });
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
    const r = await this.social.lobbyPeople(shard);
    if (gen !== this.gen) return;
    if (!r.ok) {
      if (r.failure.kind === "refused" && r.failure.reason === "not_member") await this.rejoin(gen);
      else this.bad("people", r.failure);
      return;
    }
    this.good("people");
    const others = r.value.filter((p) => p.id !== this.me);
    // Times in the list are the server's: written into this device's clock here, so a clock that is minutes out still shows the right minutes.
    this.clock.observe(others.map((p) => p.updatedAt), t);
    const off = this.clock.offset();
    const mine = (x: number | null) => (x === null ? null : x - off);
    const people = keepSame(this.s.people, listPeople(off === 0 ? others : others.map((p) => ({ ...p, focusSince: mine(p.focusSince), emoteAt: mine(p.emoteAt), updatedAt: p.updatedAt - off }))));
    const ids = new Set(people.map((p) => p.id));
    for (const id of [...this.floor.keys()]) if (!ids.has(id)) this.floor.delete(id);
    for (const id of [...this.gone.keys()]) if (!ids.has(id)) this.gone.delete(id);
    for (const id of [...this.lastEmote.keys()]) if (!ids.has(id)) this.lastEmote.delete(id);
    // A wave is shown once, when it first appears. The server lists a wave for ten seconds only, so being listed is being new: the device's own clock is not asked.
    for (const p of others) {
      const kind = emoteOf(p);
      if (kind && p.emoteAt !== null && this.lastEmote.get(p.id) !== p.emoteAt) { this.lastEmote.set(p.id, p.emoteAt); this.emit({ type: "emote", id: p.id, kind }); }
    }
    this.watch?.setPeople(people.map((p) => p.id));
    this.set({ people, ...this.view(people) });
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
    const r = await this.social.libraryMessages(shard, full ? null : newest - 1000);
    if (gen !== this.gen) return;
    if (!r.ok) {
      if (r.failure.kind === "refused" && r.failure.reason === "not_member") await this.rejoin(gen);
      else this.bad("chat", r.failure);
      return;
    }
    this.good("chat");
    this.set({ messages: mergeMessages(this.s.messages, r.value, { replacing: full }), chatLoaded: true });
  }

  private async readServers(gen: number) {
    this.lastServers = this.now();
    const r = await this.social.lobbyServers();
    if (gen !== this.gen) return;
    if (!r.ok) { this.bad("servers", r.failure); return; }
    this.good("servers");
    this.set({ servers: r.value });
  }

  /** Reads the servers now (the picker opened). */
  async refreshServers() { if (this.stopped || this.s.phase !== "live") return; await this.readServers(this.gen); }

  /* ── Friends ──────────────────────────────────────────────────────── */

  /**
   * The friends list and the requests waiting on you, joined to the room (`Snapshot.friends`, `requests`). Called when
   * joining, every minute, when the People tab opens and after a friend action; asking again while one is on its way
   * shares it, unless `fresh` (after an action, which must not be answered by a read that began before it).
   * Never throws and never says a word: a failed read keeps what was last good.
   */
  refreshFriends(fresh = false): Promise<void> {
    if (this.stopped || this.s.phase !== "live") return Promise.resolve();
    if (this.friendsInFlight && !fresh) return this.friendsInFlight;
    if (!fresh && this.friendsTried && this.now() - this.lastFriends < FRIENDS_MIN_GAP_MS) return Promise.resolve();
    const before = this.friendsInFlight;
    const run: Promise<void> = (async () => {
      if (before) await before;
      await this.readFriends();
    })().finally(() => { if (this.friendsInFlight === run) this.friendsInFlight = null; });
    this.friendsInFlight = run;
    return run;
  }

  private async readFriends() {
    this.lastFriends = this.now();
    let f, q;
    try { [f, q] = await Promise.all([this.social.loadFriends(), this.social.lobbyFriendRequests()]); } catch { f = q = undefined; }
    if (this.stopped) return;
    this.friendsTried = true;
    if (f?.ok) this.rawFriends = f.value;
    if (q?.ok) this.rawAsked = q.value;
    this.set(this.view(this.s.people));
  }

  /** The friends and requests the panel shows: the last good reads, joined to the people in the room now. */
  private view(people: readonly LobbyPerson[]): Pick<Snapshot, "friends" | "requests"> {
    const t = this.serverNow();               // presences and streaks are the server's, and so is the day
    const built = this.rawFriends ? buildFriends(this.rawFriends.friends, people, this.blocked, t) : this.friendsTried ? friendsFromRoom(people, this.blocked) : null;
    const friends = built ? keepSame(this.s.friends ?? [], built) : null;
    const requests = keepSame(this.s.requests, buildRequests(this.rawFriends?.requests ?? [], this.rawAsked, new Set((friends ?? []).map((x) => x.id)), this.blocked, t));
    return { friends, requests };
  }

  /** Accept, or "Not now", a request waiting on you. The row goes at once; the list is read again behind it. */
  async answerRequest(id: string, accept: boolean): Promise<{ ok: boolean; line: string }> {
    const them = id.toLowerCase();
    const r = await this.social.respondToFriendRequest(them, accept);
    if (!r.ok) return { ok: false, line: "That didn’t go through. Try again in a moment" };
    this.forget(them);
    void this.refreshFriends(true);
    return { ok: true, line: accept ? "You’re friends now" : "Okay, not now" };
  }

  /** Takes someone off your friends. The name goes from the room at once too: a stranger is only a nickname. */
  async removeFriend(id: string): Promise<{ ok: boolean; line: string }> {
    const them = id.toLowerCase();
    const r = await this.social.removeFriend(them);
    if (!r.ok) return { ok: false, line: "That didn’t go through. Try again in a moment" };
    this.forget(them);
    const people = this.s.people.map((p) => (p.id === them ? { ...p, isFriend: false, displayName: null, friendRequest: null } : p));
    this.set({ people, ...this.view(people) });
    void this.refreshFriends(true);
    return { ok: true, line: "Friend removed" };
  }

  /** Someone gone from what was last read (answered, removed): out of the held lists now, before the next read says so. */
  private forget(id: string) {
    this.rawAsked = this.rawAsked.filter((q) => q.userId.toLowerCase() !== id);
    if (this.rawFriends) this.rawFriends = {
      friends: this.rawFriends.friends.filter((x) => x.id.toLowerCase() !== id),
      requests: this.rawFriends.requests.filter((x) => x.otherUserId.toLowerCase() !== id),
    };
    this.set(this.view(this.s.people));
  }

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
    if (this.s.phase !== "live" || this.foreign()) return;
    const r = await this.social.lobbyEmote(kind);
    if (!r.ok) { this.say("That didn’t go through. Try again in a moment"); return; }
    if (r.value === "sent") { this.emit({ type: "emote", id: "you", kind }); return; }
    if (r.value === "not_in_lobby") { await this.rejoin(this.gen); return; }
    const line = emoteLine(r.value);
    if (line) this.say(line);
  }

  /** Whether to offer "Add friend" at all: not once the server has said it does not have it (a project without 0125). */
  get canRequestFriends(): boolean { return this.social.canRequestFriends !== false; }

  /** "Add friend" on someone's card (0125). The card shows the line; the server's answer is the one that counts. */
  async addFriend(id: string): Promise<FriendAsk> {
    const asked = await friendRequestFromLobby(this.social, id);
    if (asked.settled) this.set({ people: this.s.people.map((p) => p.id === id
      ? { ...p, friendRequest: asked.nowFriends ? null : "sent", isFriend: p.isFriend || asked.nowFriends } : p) });
    if (asked.nowFriends) void this.refreshFriends(true);
    return asked;
  }

  /** Sends a chat message. The browser checks it first (`librarySpam`), the server's answer is the one that counts. */
  async send(body: string): Promise<{ ok: true } | { ok: false; line: string }> {
    const shard = this.s.shard;
    if (this.s.phase !== "live" || shard === null || this.foreign()) return { ok: false, line: "One moment, rejoining the library" };
    const t = this.serverNow();               // the messages' times are the server's, and the repeat check compares them with now
    const recent = this.s.messages.filter((m) => m.senderId === this.me).map((m) => ({ body: m.body, at: m.createdAt }));
    const r: Result<LibraryMessage> = await this.social.sendLibraryMessage(shard, cleanInput(body), recent, t);
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
    const r = await this.social.reportLibraryMessage(m.id, reason, block);
    this.say(r.ok ? (block ? "Reported and blocked" : "Reported. Thanks for telling us") : "Couldn’t send that report. Try again in a moment");
  }

  async reportPerson(id: string, reason: UserReportReason): Promise<void> {
    const r = await this.social.reportUser(id, reason, null);
    this.say(r.ok ? "Reported. Thanks for telling us" : "Couldn’t send that report. Try again in a moment");
  }

  async blockPerson(id: string): Promise<void> {
    this.dropPerson(id);
    const r = await this.social.block(id);
    this.say(r.ok ? "Blocked" : "Couldn’t block them. Try again in a moment");
  }

  /** Someone you blocked: gone from the list, the floor and the chat at once (the server stops returning them from the next read). */
  private dropPerson(id: string) {
    this.floor.delete(id);
    this.gone.set(id, this.now());
    this.blocked.add(id);
    const people = this.s.people.filter((p) => p.id !== id);
    this.set({ people, messages: this.s.messages.filter((m) => m.senderId !== id), ...this.view(people) });
    this.floorChanged();
  }
}
