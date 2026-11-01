import { MAX_TILE } from "./types";

/**
 * The study hall and the group chat in real time, over Supabase Realtime on PRIVATE channels
 * (Supabase/migrations/0113_realtimeHall.sql in the app repo decides who may join which; this only
 * speaks the protocol). It is the iPad's SocialRealtime.swift and RealtimeProtocol.swift for a browser.
 *
 *   walk:<hall>:<user>   one student's steps in one hall. <hall> is a group id (lower case) or "friends".
 *                        Only that student sends on it; friends (the friends' hall) or fellow members (a
 *                        group's hall) receive, never across a block. The sender is the topic, never a
 *                        field of the payload, so a step cannot be sent in someone else's name.
 *                        broadcast "move" {x, y}   the tile they are walking to
 *                        broadcast "leave" {}      they left the hall
 *                        presence (key = their id) in the hall now
 *   chat:<group>         "a message was stored", sent by the database (a trigger on group_message),
 *                        never by a client, carrying only the message id. The client then reads the
 *                        message under row-level security, so a message the server refused or hid is
 *                        never shown.
 *
 * Realtime is an enhancement: the durable writes (`setHallPosition`) and reads still work without it, a
 * few seconds behind. Everything here fails quietly.
 */

/** The slice of supabase-js's realtime we use, so this is tested with a fake and bound to the real one in browser.ts. */
export interface ChannelLike {
  on(type: "broadcast" | "presence", filter: { event: string }, callback: (message: { payload?: Record<string, unknown>; key?: string }) => void): ChannelLike;
  subscribe(callback?: (status: string) => void): ChannelLike;
  send(message: { type: "broadcast"; event: string; payload: Record<string, unknown> }): Promise<unknown> | unknown;
  track(payload: Record<string, unknown>): Promise<unknown> | unknown;
  untrack(): Promise<unknown> | unknown;
}
export interface RealtimeLike {
  channel(topic: string, options?: { config?: { private?: boolean; presence?: { key: string }; broadcast?: { self?: boolean } } }): ChannelLike;
  removeChannel(channel: ChannelLike): Promise<unknown> | unknown;
}

export const walkTopic = (hall: string, user: string) => `walk:${hall.toLowerCase()}:${user.toLowerCase()}`;
export const chatTopic = (group: string) => `chat:${group.toLowerCase()}`;

/** The most walk topics listened to at once, besides your own (Realtime allows about 100 channels per connection). */
export const MAX_PEOPLE = 50;
/** Standing still, the tile is sent again this often, for anyone who joined since. */
export const RESEND_MS = 10_000;
/** The quickest two steps are sent apart: a tap's walk is one message. */
export const MIN_GAP_MS = 100;

export type HallSignal =
  | { kind: "here"; user: string }
  | { kind: "moved"; user: string; x: number; y: number }
  | { kind: "left"; user: string };

const tile = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_TILE ? v : null);

export interface HallWatch {
  /** Walk to a tile: sent at once, and again every ten seconds while you stand there. */
  move(x: number, y: number): void;
  /** Say you have left, then stop. */
  leave(): void;
  stop(): void;
}

/**
 * Join a hall: your own topic (tracking presence on it) and the topic of everyone who could be there.
 * `people` is whoever the hall may show you (friends, or a group's members), at most MAX_PEOPLE are heard.
 */
export function watchHall(
  rt: RealtimeLike,
  o: { hall: string; me: string; people: string[]; onSignal: (s: HallSignal) => void; now?: () => number },
): HallWatch {
  const now = o.now ?? Date.now;
  const channels: ChannelLike[] = [];
  let last: { x: number; y: number; at: number } | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const mine = rt.channel(walkTopic(o.hall, o.me), { config: { private: true, presence: { key: o.me.toLowerCase() }, broadcast: { self: false } } });
  channels.push(mine);
  mine.subscribe((status) => { if (status === "SUBSCRIBED") void mine.track({ at: now() }); });

  for (const person of o.people.filter((p) => p.toLowerCase() !== o.me.toLowerCase()).slice(0, MAX_PEOPLE)) {
    const who = person.toLowerCase();
    const ch = rt.channel(walkTopic(o.hall, who), { config: { private: true, broadcast: { self: false } } });
    ch.on("broadcast", { event: "move" }, ({ payload }) => {
      const x = tile(payload?.x), y = tile(payload?.y);
      if (x !== null && y !== null) o.onSignal({ kind: "moved", user: who, x, y });
    });
    ch.on("broadcast", { event: "leave" }, () => o.onSignal({ kind: "left", user: who }));
    ch.on("presence", { event: "join" }, () => o.onSignal({ kind: "here", user: who }));
    ch.on("presence", { event: "leave" }, () => o.onSignal({ kind: "left", user: who }));
    ch.subscribe();
    channels.push(ch);
  }

  const sendTile = () => {
    if (stopped || !last) return;
    void mine.send({ type: "broadcast", event: "move", payload: { x: last.x, y: last.y } });
  };

  return {
    move(x, y) {
      const tx = tile(Math.round(x)), ty = tile(Math.round(y));
      if (stopped || tx === null || ty === null) return;
      const t = now();
      if (last && t - last.at < MIN_GAP_MS && last.x === tx && last.y === ty) return;
      last = { x: tx, y: ty, at: t };
      sendTile();
      timer ??= setInterval(sendTile, RESEND_MS);
    },
    leave() {
      if (stopped) return;
      void mine.send({ type: "broadcast", event: "leave", payload: {} });
      void mine.untrack();
      this.stop();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer) clearInterval(timer);
      for (const ch of channels) void rt.removeChannel(ch);
    },
  };
}

/**
 * Hear that a message was stored in a group: `onPing` should then read what is new (the pull goes through
 * row-level security, so the filter, hiding and blocks stay the only judges of what is shown).
 */
export function watchChat(rt: RealtimeLike, groupId: string, onPing: () => void): () => void {
  const ch = rt.channel(chatTopic(groupId), { config: { private: true, broadcast: { self: false } } });
  ch.on("broadcast", { event: "message" }, () => onPing());
  ch.subscribe();
  return () => { void rt.removeChannel(ch); };
}
