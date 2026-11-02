import { walkTopic } from "../../social/realtime";
import { LOBBY_CAP, lobbyHall } from "../../social/lobby";
import { LIBRARY_TILE, parsePresence, presenceFields, type FloorPresence } from "./room";

/**
 * The library's floor in real time: who is where, as it goes over Supabase Realtime on PRIVATE channels. The
 * iPad's SocialRealtime.swift and RealtimeProtocol.swift are the reference, and what is spoken here is what
 * they speak (checked by reading them, not by running against a real Realtime server: see docs/study/library.md).
 *
 *   walk:lobby-<shard>:<user>   one student's steps in one library (SocialRealtime.enterHall, with the hall key
 *                               `lobby-<shard>` from LobbyRules.hallKey). Only that student sends on it; every
 *                               visible student in the same shard may listen, never across a block
 *                               (0117's `plumi_private.realtime_may`). The sender is the topic, never a field,
 *                               so a step cannot be sent in someone else's name.
 *     broadcast "move"  {x, y, lx, ly, ls?, lp?}   the world tile (the library's, the same for everyone) beside
 *                               where they stand on the floor, their seat and the rest of their walk
 *     broadcast "leave" {}      they left
 *     presence key=<user>       they are in the library; the tracked meta is the last "move" payload, so
 *                               someone arriving after a step still knows where everyone stands
 *
 * Realtime is an enhancement: `lobby_people` (polled) says who is here and what they are doing; this says where
 * on the floor, a fraction of a second after it happens. Everything here fails quietly.
 */

export interface LobbyChannel {
  on(type: "broadcast" | "presence", filter: { event: string }, callback: (message: Record<string, unknown>) => void): LobbyChannel;
  subscribe(callback?: (status: string) => void): LobbyChannel;
  send(message: { type: "broadcast"; event: string; payload: Record<string, unknown> }): Promise<unknown> | unknown;
  track(payload: Record<string, unknown>): Promise<unknown> | unknown;
  untrack(): Promise<unknown> | unknown;
}
export interface LobbyRealtime {
  channel(topic: string, options?: { config?: { private?: boolean; presence?: { key: string; enabled?: boolean }; broadcast?: { self?: boolean; ack?: boolean } } }): LobbyChannel;
  removeChannel(channel: LobbyChannel): Promise<unknown> | unknown;
}

/**
 * The most walk topics listened to at once, besides your own: everyone else a full library can hold (`LOBBY_CAP`, the
 * server's `lobby_cap()`, 60). It was 50, and in a full library the last nine people (always the same nine, by
 * name) were never heard: no floor news, so every viewer drew them in a chair picked by a hash of their id. Realtime
 * allows about 100 channels per connection, and a visit uses at most 60 of them (your own and 59 others).
 */
export const MAX_LISTEN = LOBBY_CAP - 1;
/**
 * Standing still, your place is sent again this often (the iPad's SocialRealtime.resend is ten seconds). Every send
 * goes to every listener (up to 59), so this is the biggest line in Realtime's bill; a change is sent at once whatever
 * this is. Someone who arrives between two sends is told where you rest by the presence you track (see `send`), not by
 * waiting for the next one.
 */
export const RESEND_MS = 30_000;
/** New topics are joined this many at a time, this far apart, so a reconnect (or walking into a full library) is not 59 joins in one instant. */
export const LISTEN_BATCH = 5;
export const LISTEN_GAP_MS = 100;
/** The quickest two sends are apart: a tap's walk is one message (SocialRealtime.minGap). */
export const MIN_GAP_MS = 100;

export type LobbySignal =
  | { kind: "here" | "moved"; user: string; floor: FloorPresence | null }
  | { kind: "left"; user: string };

export interface LobbyWatch {
  /** Who could be in the shard now (everyone `lobby_people` returned): their topics are listened to. */
  setPeople(ids: readonly string[]): void;
  /** You walked, sat or stood: say where you are now (or soon, if it is too soon after the last). */
  changed(): void;
  /** Once a second: sends again after standing still, or a change that had to wait. */
  tick(): void;
  /** Your own topic is joined, so what you do reaches the others. */
  readonly live: boolean;
  /** Say you have left, stop being tracked, and stop. */
  leave(): void;
  stop(): void;
}

export function watchLobby(
  rt: LobbyRealtime,
  o: {
    shard: number;
    me: string;
    people: readonly string[];
    /** Where you stand on the floor now, asked whenever something goes out (null before you are in the room). */
    floorNow: () => FloorPresence | null;
    onSignal: (s: LobbySignal) => void;
    onLive?: (live: boolean) => void;
    now?: () => number;
    /** Milliseconds between batches of new topics (default `LISTEN_GAP_MS`; 0 joins them all at once, as the tests do). */
    listenGapMs?: number;
  },
): LobbyWatch {
  const now = o.now ?? Date.now;
  const hall = lobbyHall(o.shard);
  const me = o.me.toLowerCase();
  const others = new Map<string, LobbyChannel>();
  let stopped = false, live = false, dirty = false, lastSent = -Infinity, tracked = "";
  const gap = o.listenGapMs ?? LISTEN_GAP_MS;
  let queue: string[] = [], draining = false;

  const payload = () => {
    const f = o.floorNow();
    return { x: LIBRARY_TILE.x, y: LIBRARY_TILE.y, ...(f ? presenceFields(f) : {}) };
  };

  const mine = rt.channel(walkTopic(hall, me), { config: { private: true, presence: { key: me, enabled: true }, broadcast: { self: false } } });
  mine.subscribe((status) => {
    if (stopped) return;
    const was = live;
    live = status === "SUBSCRIBED";
    if (live) { tracked = JSON.stringify(payload()); void mine.track(payload()); dirty = true; lastSent = -Infinity; send(); }
    if (live !== was) o.onLive?.(live);
  });

  const hear = (user: string, kind: "here" | "moved", m: Record<string, unknown> | undefined) => {
    if (stopped) return;
    o.onSignal({ kind, user, floor: parsePresence(m) });
  };

  function listen(who: string) {
    if (others.has(who)) return;
    const ch = rt.channel(walkTopic(hall, who), { config: { private: true, broadcast: { self: false } } });
    ch.on("broadcast", { event: "move" }, (m) => hear(who, "moved", m.payload as Record<string, unknown> | undefined));
    ch.on("broadcast", { event: "leave" }, () => { if (!stopped) o.onSignal({ kind: "left", user: who }); });
    // Only the topic's own student counts: anyone else tracking on it is ignored (SocialRealtime.heard).
    ch.on("presence", { event: "join" }, (m) => {
      if (m.key !== undefined && String(m.key).toLowerCase() !== who) return;
      const metas = Array.isArray(m.newPresences) ? (m.newPresences as Record<string, unknown>[]) : [];
      hear(who, "here", metas[metas.length - 1]);
    });
    ch.on("presence", { event: "leave" }, (m) => {
      if (m.key !== undefined && String(m.key).toLowerCase() !== who) return;
      if (!stopped) o.onSignal({ kind: "left", user: who });
    });
    ch.subscribe();
    others.set(who, ch);
  }

  function send() {
    if (stopped || !live) return;
    const t = now();
    if (t - lastSent < MIN_GAP_MS) { dirty = true; return; }
    dirty = false;
    lastSent = t;
    const p = payload();
    void mine.send({ type: "broadcast", event: "move", payload: p });
    // Come to rest: the presence is what anyone arriving later is told (they hear it as soon as they listen), so it must say where you rest now.
    const f = o.floorNow();
    if (f && f.path.length === 0) {
      const key = JSON.stringify(p);
      if (key !== tracked) { tracked = key; void mine.track(p); }
    }
  }

  function drain() {
    draining = false;
    if (stopped) return;
    for (const who of queue.splice(0, LISTEN_BATCH)) listen(who);
    if (queue.length) { draining = true; setTimeout(drain, gap); }
  }

  const watch: LobbyWatch = {
    get live() { return live && !stopped; },
    setPeople(ids) {
      if (stopped) return;
      const wanted = new Set([...new Set(ids.map((i) => i.toLowerCase()).filter((i) => i !== me))].slice(0, MAX_LISTEN));
      for (const [who, ch] of [...others]) if (!wanted.has(who)) { void rt.removeChannel(ch); others.delete(who); }
      queue = [...wanted].filter((who) => !others.has(who));
      if (gap <= 0) { for (const who of queue.splice(0)) listen(who); return; }
      for (const who of queue.splice(0, LISTEN_BATCH)) listen(who);
      if (queue.length && !draining) { draining = true; setTimeout(drain, gap); }
    },
    changed() { dirty = true; send(); },
    tick() {
      if (stopped || !live) return;
      if (dirty || now() - lastSent >= RESEND_MS) { lastSent = dirty ? lastSent : -Infinity; send(); }
    },
    leave() {
      if (stopped) return;
      if (live) { void mine.send({ type: "broadcast", event: "leave", payload: {} }); void mine.untrack(); }
      watch.stop();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      void rt.removeChannel(mine);
      for (const ch of others.values()) void rt.removeChannel(ch);
      others.clear();
    },
  };
  watch.setPeople(o.people);
  return watch;
}
