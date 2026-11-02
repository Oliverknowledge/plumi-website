import { focusTag, subjectName, type LobbyFriendRequest, type LobbyPerson } from "../../social/lobby";
import type { FriendRequest, SocialAvatar, SocialPerson, SocialSummary, StudyPresence } from "../../social/types";
import { daysBetween, dayOf } from "../time";

/**
 * Your friends and the requests waiting on you, as the People panel shows them. Pure: the session holds the raw
 * answers (`loadFriends`, `lobbyFriendRequests`) and calls these to join them to who is in the room NOW.
 *
 * WHAT THIS MAY CONTAIN (the privacy rules, held by friends.test.ts and session.test.ts):
 *   - Friends are only ever accepted friends, by the name they gave you. Anyone you blocked is gone.
 *   - A request that began in a library is only ever a nickname (`lobby_friend_requests` has no name and no code
 *     column; 0125). If the same person also shows up in the ordinary requests, the library's version wins, so a
 *     real name can never ride in on the other list.
 *   - Nothing here asks the server about anyone: it joins what was already read.
 */

/** A friend who is studying somewhere else right now (their `study_presence`, still fresh). */
export interface Elsewhere { subjectId: string; phase: "work" | "break" }

export interface FriendEntry {
  /** Lowercase, as the server writes ids and as the room keys people. */
  id: string;
  name: string;
  colour: number;
  avatar: SocialAvatar | null;
  /** The day streak, only while it can still be alive; null when it is not known or has lapsed. */
  streak: number | null;
  pro: boolean;
  /** Their live row when they are in THIS library: subject, minutes, sitting or standing. Null otherwise. */
  here: LobbyPerson | null;
  /** Studying somewhere else, from a fresh presence. Null when it is not known: nothing is guessed. */
  elsewhere: Elsewhere | null;
}

export interface RequestEntry {
  id: string;
  /** A library request is the sender's nickname; an ordinary one (their friend code was typed in) is the name they gave. */
  name: string;
  fromLibrary: boolean;
  colour: number;
  avatar: SocialAvatar | null;
  streak: number | null;
}

/** A streak is only worth showing while it can still be alive: last counted today or yesterday (London days). */
export function liveStreak(s: Pick<SocialSummary, "streak" | "streakDay"> | undefined, now: number): number | null {
  if (!s || s.streak <= 0 || !s.streakDay) return null;
  const gap = daysBetween(s.streakDay, dayOf(now));
  return gap === 0 || gap === 1 ? s.streak : null;
}

/** Presence that is still true: it has an end (`expiresAt`) and that is ahead of us. A presence with no end is not believed. */
export function freshPresence(p: StudyPresence | undefined, now: number): Elsewhere | null {
  if (!p || !p.expiresAt) return null;
  const end = Date.parse(p.expiresAt);
  if (!Number.isFinite(end) || end <= now) return null;
  return { subjectId: p.subjectId, phase: p.phase };
}

const byName = (a: { name: string; id: string }, b: { name: string; id: string }) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** 0 in this library, 1 studying elsewhere, 2 the rest. */
export const friendRank = (f: Pick<FriendEntry, "here" | "elsewhere">) => (f.here ? 0 : f.elsewhere ? 1 : 2);

/**
 * Every accepted friend, joined to the room by id: in this library first, then studying elsewhere, then the rest,
 * each group by name. A stable order, so the list does not shuffle between reads. `blocked` are never listed.
 */
export function buildFriends(raw: readonly SocialPerson[], people: readonly LobbyPerson[], blocked: ReadonlySet<string>, now: number): FriendEntry[] {
  const here = new Map(people.map((p) => [p.id.toLowerCase(), p]));
  const seen = new Set<string>();
  const out: FriendEntry[] = [];
  for (const f of raw) {
    const id = f.id.toLowerCase();
    if (seen.has(id) || blocked.has(id)) continue;
    seen.add(id);
    const room = here.get(id) ?? null;
    out.push({
      id, name: f.displayName, colour: f.colour, avatar: room?.avatar ?? f.avatar,
      streak: room ? (room.streak > 0 ? room.streak : null) : liveStreak(f.summary, now),
      pro: (room?.avatar ?? f.avatar)?.pro === "1",
      here: room,
      elsewhere: room ? null : freshPresence(f.presence, now),
    });
  }
  return out.sort((a, b) => friendRank(a) - friendRank(b) || byName(a, b));
}

/**
 * Friends when the first read has not been answered but the room already knows some: the people in this library the
 * server marks as friends, by the name it gave. Used only so a friend you are standing next to does not vanish from
 * the panel because the friends list could not be read.
 */
export function friendsFromRoom(people: readonly LobbyPerson[], blocked: ReadonlySet<string>): FriendEntry[] {
  return people.filter((p) => p.isFriend && p.displayName && !blocked.has(p.id)).map((p) => ({
    id: p.id, name: p.displayName!, colour: p.colour, avatar: p.avatar, streak: p.streak > 0 ? p.streak : null, pro: p.pro, here: p, elsewhere: null,
  })).sort(byName);
}

/**
 * The requests waiting on you, newest first. Library requests (nickname and look only) and ordinary ones (a friend
 * code was typed in; the sender's name is readable, as on the iPad). Someone in both lists is the library's.
 * Requests from people who are already friends or blocked are dropped; outgoing ones are not listed here.
 */
export function buildRequests(ordinary: readonly FriendRequest[], library: readonly LobbyFriendRequest[], friends: ReadonlySet<string>, blocked: ReadonlySet<string>, now: number): RequestEntry[] {
  const made: { at: number; entry: RequestEntry }[] = [];
  const fromLibrary = new Set<string>();
  for (const q of library) {
    const id = q.userId.toLowerCase();
    if (q.direction !== "incoming" || friends.has(id) || blocked.has(id) || fromLibrary.has(id)) continue;
    fromLibrary.add(id);
    made.push({ at: q.createdAt, entry: { id, name: q.nickname, fromLibrary: true, colour: q.colour, avatar: q.avatar, streak: q.streak > 0 ? q.streak : null } });
  }
  const outgoingToLibrary = new Set(library.map((q) => q.userId.toLowerCase()));
  for (const q of ordinary) {
    const id = q.otherUserId.toLowerCase();
    if (q.direction !== "incoming" || !q.person || friends.has(id) || blocked.has(id) || fromLibrary.has(id) || outgoingToLibrary.has(id)) continue;
    const at = Date.parse(q.createdAt);
    made.push({ at: Number.isFinite(at) ? at : 0, entry: { id, name: q.person.displayName, fromLibrary: false, colour: q.person.colour, avatar: q.person.avatar, streak: liveStreak(q.person.summary, now) } });
  }
  return made.sort((a, b) => b.at - a.at || (a.entry.id < b.entry.id ? -1 : 1)).map((m) => m.entry);
}

/**
 * The quiet second line of a friend's row. In this library: "In this library, Chemistry 24 min", or sitting, or
 * standing. Studying elsewhere (a fresh presence): "Studying Maths now". Anyone else: nothing (no last seen, no
 * invented "online").
 */
export function friendStatus(f: FriendEntry, now: number): string | null {
  if (f.here) {
    const tag = focusTag(f.here, now);
    return `In this library, ${tag ?? (f.here.seated ? "sitting" : "standing")}`;
  }
  if (f.elsewhere) {
    if (f.elsewhere.phase === "break") return "On a break";
    const subject = subjectName(f.elsewhere.subjectId);
    return subject ? `Studying ${subject} now` : "Studying now";
  }
  return null;
}

/** The count in the Friends header: "3 of 5 in this library", or just "5 friends" when none is here. */
export function friendsCount(friends: readonly FriendEntry[]): string {
  const here = friends.filter((f) => f.here).length;
  const n = friends.length;
  if (here > 0) return `${here} of ${n} in this library`;
  return `${n} friend${n === 1 ? "" : "s"}`;
}

/** The streak as a student reads it: "1 day" or "12 days". */
export const streakWords = (n: number) => (n === 1 ? "1 day" : `${n} days`);

/**
 * A list in the order it was when the finger went down, whatever it has become since: rows already shown keep their
 * place, rows gone drop out, and rows that arrived are added at the end. So a row never moves under a tap.
 */
export function inHeldOrder<T extends { id: string }>(list: readonly T[], held: readonly string[] | null): T[] {
  if (!held) return [...list];
  const by = new Map(list.map((x) => [x.id, x]));
  const out: T[] = [];
  for (const id of held) { const x = by.get(id); if (x) { out.push(x); by.delete(id); } }
  for (const x of list) if (by.has(x.id)) out.push(x);
  return out;
}

/**
 * `next` with every row that did not change replaced by the row it was (same object), and the whole list returned as
 * it was when nothing changed. A row a screen memoises is then not redrawn by a read that told it nothing new.
 */
export function keepSame<T extends { id: string }>(prev: readonly T[], next: readonly T[]): T[] {
  const old = new Map(prev.map((x) => [x.id, x]));
  const out = next.map((x) => { const o = old.get(x.id); return o && JSON.stringify(o) === JSON.stringify(x) ? o : x; });
  return out.length === prev.length && out.every((x, i) => x === prev[i]) ? (prev as T[]) : out;
}
