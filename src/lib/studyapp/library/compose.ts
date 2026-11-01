import { focusTag, shownName, type LobbyPerson } from "../../social/lobby";
import { lookFor, toArt, type FloorPresence, type Pt } from "./room";

/**
 * What the room is told about everyone else: the server's list of who is here and what they are doing
 * (`lobby_people`, polled), with what Realtime has said of where they stand. Pure and tested.
 */

/** Where someone last said they stand on the floor, and when we heard it. */
export interface HeardFloor { floor: FloorPresence; at: number; seq: number }

/** Floor news older than this is not believed: a standing student resends every ten seconds (RESEND_MS). */
export const FLOOR_FRESH_MS = 45_000;
/**
 * Someone who said they left stays gone this long even if the server still lists them: its list holds a row for
 * 30 seconds after the last beat (`lobby_fresh`). HallLive.gone does the same on the iPad (freshFor + 5).
 */
export const GONE_FOR_MS = 35_000;

/** The shape the room takes (cafeScene.ts LiveRemote): positions in art pixels, the seat as the iPad numbers it. */
export interface RemoteState {
  id: string; look: number; pos: Pt | null; seat: number | null; path: Pt[]; seated: boolean;
  /** Which piece of floor news this is (0 for none): the room acts on each once, so a walk heard once is not restarted every time the list is read. */
  rev: number;
}

export function composeRemotes(people: readonly LobbyPerson[], floor: ReadonlyMap<string, HeardFloor>, gone: ReadonlyMap<string, number>, now: number): RemoteState[] {
  const out: RemoteState[] = [];
  for (const p of people) {
    const left = gone.get(p.id);
    if (left !== undefined && now - left < GONE_FOR_MS) continue;
    const heard = floor.get(p.id);
    const fresh = heard && now - heard.at < FLOOR_FRESH_MS ? heard.floor : null;
    out.push({
      id: p.id, look: lookFor(p.id), seated: p.seated || fresh?.seat != null,
      pos: fresh ? toArt([fresh.x, fresh.y]) : null,
      seat: fresh?.seat ?? null,
      path: fresh ? fresh.path.map(toArt) : [],
      rev: fresh ? heard!.seq : 0,
    });
  }
  return out;
}

/** What goes over someone's head: their name, and "Physics · 12 min" while they are timing. */
export function labelFor(p: LobbyPerson, now: number) {
  return { name: shownName(p), tag: focusTag(p, now), friend: p.isFriend, pro: p.pro };
}
