import type { Row } from "./api";
import type { SocialAvatar } from "./types";

/**
 * The public lobby and the Grand Library, as values: what `lobby_people`, `lobby_servers`, `lobby_join` and
 * `library_messages` return (Supabase/migrations/0117 to 0123 in the app repo), and the rules about what a
 * student may be shown of someone they have met there. This is the iPad's LobbyTypes.swift, rule for rule.
 *
 * WHAT A STRANGER MAY SEE (the server decides; this file never widens it): a nickname ("Quiet Otter"), where
 * they stand and whether they are seated, a subject from a fixed list and how long they have been focusing,
 * a streak, a level, the public groups they are in, and a wave or a high five. The real name only for a
 * friend. And even if a server ever sent a stranger's display name, `sanitised` drops it before a view sees it.
 */

/** Students to a shard (`lobby_cap()`, 0121). */
export const LOBBY_CAP = 60;
/** The most libraries there are (`lobby_max_shard()`, 0122): numbers 1 to 300. */
export const MAX_LIBRARIES = 300;
/** How long a lobby row counts as someone being there (`lobby_fresh()`), in seconds. */
export const FRESH_FOR_S = 30;

/** The hall key of a shard, as the realtime topics name it: `walk:lobby-3:<user>`. */
export const lobbyHall = (shard: number) => `lobby-${shard}`;
export function shardOfHall(hall: string): number | null {
  const m = /^lobby-([1-9][0-9]{0,5})$/.exec(hall);
  return m ? Number(m[1]) : null;
}

/** The two things anyone may do over their own head. No text, no target. */
export type LobbyEmote = "wave" | "high_five";
export const LOBBY_EMOTES: readonly LobbyEmote[] = ["wave", "high_five"];
export const EMOTE_TITLE: Record<LobbyEmote, string> = { wave: "Wave", high_five: "High five" };
export type LobbyEmoteOutcome = "sent" | "too_soon" | "rate_limited" | "not_in_lobby";
/** The one quiet line after an emote, or null when nothing needs saying (the pop over your head says it). */
export function emoteLine(outcome: LobbyEmoteOutcome): string | null {
  switch (outcome) {
    case "too_soon": return "One at a time";
    case "rate_limited": return "That’s plenty for today";
    default: return null;
  }
}

export interface LobbyGroupTag { id: string; name: string; emblem: number }

/** One other student in the shard, as `lobby_people` returns them. Times are epoch milliseconds. */
export interface LobbyPerson {
  id: string;
  nickname: string;
  /** Filled only for a friend. */
  displayName: string | null;
  isFriend: boolean;
  colour: number;
  avatar: SocialAvatar | null;
  /** The coarse tile on the world map (the library's tile for everyone in it). Not a place on the floor. */
  x: number;
  y: number;
  seated: boolean;
  subjectId: string | null;
  focusSince: number | null;
  streak: number;
  level: number;
  groups: LobbyGroupTag[];
  emote: LobbyEmote | null;
  emoteAt: number | null;
  updatedAt: number;
  /** The yellow Pro nametag (a cosmetic flag the app reports about itself: a badge, never an entitlement). */
  pro: boolean;
}

export interface LobbyServer { shard: number; here: number; friends: number }
/** `lobby_servers`: the servers with people in, the one the student is in, an empty one to open, the ceiling. */
export interface LobbyServers { cap: number; you: number | null; empty: number | null; max: number; servers: LobbyServer[] }

/**
 * What the picker lists: every library from the first to the one after the last with people in it, the empty
 * ones in between kept in their place rather than dropped (the app's rule, 26 October: "where did library 1
 * go"). The student's own is always there, and one empty one to open; never more than the ceiling.
 */
export function listedServers(s: LobbyServers): LobbyServer[] {
  const known = new Map<number, LobbyServer>();
  for (const x of s.servers) if (!known.has(x.shard)) known.set(x.shard, x);
  const top = s.max || MAX_LIBRARIES;
  const next = s.empty ?? (s.servers.length ? Math.max(...s.servers.map((x) => x.shard)) + 1 : null);
  for (const shard of [s.you, next]) {
    if (shard !== null && shard >= 1 && shard <= top && !known.has(shard)) known.set(shard, { shard, here: 0, friends: 0 });
  }
  return [...known.values()].filter((x) => x.shard >= 1 && x.shard <= top).sort((a, b) => a.shard - b.shard);
}

/** The people in every library at once: what the Desk calls "revising". Counts the student too if they are in one. */
export const totalHere = (s: LobbyServers) => s.servers.reduce((n, x) => n + Math.max(0, x.here), 0);

export interface LobbyJoin { shard: number | null; nickname: string; visible: boolean; cap: number; wantedFull: boolean }
export interface LobbyMe { nickname: string; visible: boolean; nextChangeAt: number | null }

/* ── The rules ───────────────────────────────────────────────────────── */

/** The subjects a stranger may be told about (`lobby_subject`), as a student reads them. */
export const SUBJECTS: Record<string, string> = {
  physics: "Physics", chemistry: "Chemistry", maths: "Maths", biology: "Biology", "further-maths": "Further Maths",
  further_maths: "Further Maths", economics: "Economics", psychology: "Psychology", "computer-science": "Computer Science",
  english: "English", history: "History", geography: "Geography",
};
export const subjectName = (id: string | null | undefined) => (id ? SUBJECTS[id.toLowerCase()] ?? null : null);

/** The five choices on the seat card (Other sends no subject: the server stores nothing it does not know). */
export const SEAT_SUBJECTS: readonly { id: string | null; label: string }[] = [
  { id: "maths", label: "Maths" }, { id: "physics", label: "Physics" }, { id: "chemistry", label: "Chemistry" },
  { id: "biology", label: "Biology" }, { id: null, label: "Other" },
];

const NICKNAME = /^[A-Z][a-z]+ [A-Z][a-z]+$/;

/** A row as a view may hold it: a stranger's display name is dropped; a nickname that is not two plain words becomes "Someone". */
export function sanitised(p: LobbyPerson): LobbyPerson {
  const out = { ...p };
  if (!p.isFriend) out.displayName = null;
  if (!NICKNAME.test(out.nickname)) out.nickname = "Someone";
  if (out.subjectId && !subjectName(out.subjectId)) out.subjectId = null;
  if (!out.seated) out.focusSince = null;
  return out;
}

/** The name over their head and on their card: a friend's real name, everyone else's nickname. */
export const shownName = (p: LobbyPerson) => (p.isFriend && p.displayName ? p.displayName : p.nickname);

/** Whole minutes focused, while seated and timing. A start more than a minute in the future is not believed. */
export function focusMinutes(p: LobbyPerson, now: number): number | null {
  if (!p.seated || p.focusSince === null || p.focusSince > now + 60_000) return null;
  return Math.max(0, Math.floor((now - p.focusSince) / 60_000));
}

/** The tag over a head: "Physics · 12 min" while timing, nothing otherwise. */
export function focusTag(p: LobbyPerson, now: number): string | null {
  const m = focusMinutes(p, now);
  if (m === null) return null;
  const subject = subjectName(p.subjectId);
  return subject ? `${subject} · ${m} min` : `${m} min`;
}

/** The wave over a head, while it is new. The server sends one for ten seconds; either side of the clocks counts. */
export function emoteOf(p: LobbyPerson, now: number): LobbyEmote | null {
  return p.emote && p.emoteAt !== null && Math.abs(now - p.emoteAt) < 10_000 ? p.emote : null;
}

/** The count line for a timer: "12:05" under an hour, "1 h 05 min" over. */
export function focusClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Friends first, then the rest; each by name. How "who is here" lists people. A stable order, so the list
 * does not shuffle every time it is read.
 */
export function listPeople(people: readonly LobbyPerson[]): LobbyPerson[] {
  return [...people].sort((a, b) => Number(b.isFriend) - Number(a.isFriend) || shownName(a).localeCompare(shownName(b)) || (a.id < b.id ? -1 : 1));
}

/* ── Decoding: rows to values. Pure, and tested. ─────────────────────── */

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const ms = (v: unknown): number | null => { const s = str(v); const t = s ? Date.parse(s) : NaN; return Number.isFinite(t) ? t : null; };
const whole = (v: unknown, fallback = 0) => { const n = num(v); return n === null ? fallback : Math.max(0, Math.floor(n)); };

function avatarOf(v: unknown): SocialAvatar | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: SocialAvatar = {};
  for (const [k, val] of Object.entries(v)) if (typeof val === "string") out[k] = val;
  return Object.keys(out).length > 0 ? out : null;
}

export const lobbyDecode = {
  person(row: Row): LobbyPerson | null {
    const id = str(row.user_id), nickname = str(row.nickname);
    if (!id || !nickname) return null;
    const emote = LOBBY_EMOTES.find((e) => e === row.emote) ?? null;
    const avatar = avatarOf(row.avatar);
    const groups = Array.isArray(row.groups)
      ? (row.groups as Row[]).flatMap((g) => { const gid = str(g?.id), name = str(g?.name); return gid && name ? [{ id: gid, name, emblem: Math.min(5, whole(g.emblem)) }] : []; })
      : [];
    return {
      id: id.toLowerCase(), nickname, displayName: str(row.display_name), isFriend: row.is_friend === true,
      colour: ((whole(row.colour) % 16) + 16) % 16, avatar, x: whole(row.x), y: whole(row.y), seated: row.seated === true,
      subjectId: str(row.subject_id), focusSince: ms(row.focus_since), streak: whole(row.streak), level: whole(row.level),
      groups, emote, emoteAt: emote ? ms(row.emote_at) : null, updatedAt: ms(row.updated_at) ?? 0, pro: avatar?.pro === "1",
    };
  },
  servers(data: unknown): LobbyServers | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const d = data as Row;
    const list = Array.isArray(d.servers) ? (d.servers as Row[]) : [];
    const servers = list.flatMap((r) => {
      const shard = num(r?.shard);
      return shard !== null && shard >= 1 ? [{ shard: Math.floor(shard), here: whole(r.here), friends: whole(r.friends) }] : [];
    });
    return { cap: whole(d.cap, LOBBY_CAP) || LOBBY_CAP, you: num(d.you), empty: num(d.empty), max: whole(d.max, MAX_LIBRARIES) || MAX_LIBRARIES, servers };
  },
  join(data: unknown): LobbyJoin | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const d = data as Row;
    const nickname = str(d.nickname);
    if (!nickname) return null;
    const shard = num(d.shard);
    return { shard: shard !== null && shard >= 1 ? Math.floor(shard) : null, nickname, visible: d.visible !== false, cap: whole(d.cap, LOBBY_CAP), wantedFull: d.wanted_full === true };
  },
  me(data: unknown): LobbyMe | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const d = data as Row;
    const nickname = str(d.nickname);
    return nickname ? { nickname, visible: d.visible !== false, nextChangeAt: ms(d.next_change_at) } : null;
  },
  emote(data: unknown): LobbyEmoteOutcome {
    const w = typeof data === "string" ? data.toLowerCase() : "";
    return w === "sent" || w === "too_soon" || w === "rate_limited" ? w : "not_in_lobby";
  },
  message(row: Row): LibraryMessage | null {
    const id = row.id, sender = str(row.sender), body = str(row.body);
    if ((typeof id !== "number" && typeof id !== "string") || !sender || body === null) return null;
    return {
      id: String(id), shard: num(row.shard), senderId: sender.toLowerCase(), name: str(row.nickname) ?? "Someone", body,
      createdAt: ms(row.created_at) ?? 0, hidden: row.hidden === true, pro: row.pro === true,
    };
  },
};

/** One message in a library's chat. A stranger is only ever their nickname; a friend shows their real name (the server decides). */
export interface LibraryMessage {
  id: string;
  shard: number | null;
  senderId: string;
  name: string;
  body: string;
  createdAt: number;
  hidden: boolean;
  pro: boolean;
}

/** Messages in the order a chat shows them: oldest first, ties by id. */
export const byMessageTime = (a: LibraryMessage, b: LibraryMessage) =>
  a.createdAt - b.createdAt || (Number(a.id) || 0) - (Number(b.id) || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The newest `keep` of two lists merged by id (newer rows win), as the chat holds them. */
export function mergeMessages(held: readonly LibraryMessage[], incoming: readonly LibraryMessage[], opts: { replacing: boolean; keep?: number }): LibraryMessage[] {
  const byId = new Map<string, LibraryMessage>();
  if (!opts.replacing) for (const m of held) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort(byMessageTime).slice(-(opts.keep ?? 100));
}
