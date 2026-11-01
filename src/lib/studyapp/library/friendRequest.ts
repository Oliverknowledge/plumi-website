import { askLine, studentFacing } from "@/lib/social/failure";
import { canAsk, type LobbyAskOutcome, type LobbyPerson } from "@/lib/social/lobby";
import type { Result } from "@/lib/social/failure";

/**
 * "Add friend" on someone you meet in the Grand Library (0125). Two halves:
 *
 *   - `askMessage` / `friendButton`: pure. The server's answer as the one short line a student reads, and the state a
 *     person's card is in. Nothing in a line says why (the server does not), so `not_here` reads the same whether the
 *     person left, hid or blocked.
 *   - `friendRequestFromLobby` / `friendRequester`: a thin async wrapper around the social service. It never throws and
 *     never shows an error: a project that has not had the migration yet means the button is not offered, not that a
 *     line appears.
 *
 * The page keeps no list of who it asked. The server says it (`LobbyPerson.friendRequest`), so a reload shows the truth.
 */

/** What the card shows for someone: the button, or why not. */
export type FriendButton = "add" | "sent" | "received" | "friends";

export function friendButton(p: Pick<LobbyPerson, "isFriend"> & Partial<Pick<LobbyPerson, "friendRequest">>): FriendButton {
  if (p.isFriend) return "friends";
  if (p.friendRequest === "sent") return "sent";
  if (p.friendRequest === "received") return "received";
  return "add";
}

/** Whether to draw "Add friend" at all: not for a friend, and not while a request is open either way. */
export const showsAddFriend = (p: LobbyPerson) => canAsk(p);

export interface FriendAsk {
  /** The server's word, or `unavailable` when no word came (offline, signed out, an older server). */
  outcome: LobbyAskOutcome | "unavailable";
  /** The one line to show, ready to read. */
  line: string;
  /** True when the card should now read "Friend request sent" (the request is open, or just became a friendship). */
  settled: boolean;
  /** True when the card should become the friend's (the request was an answer to theirs). */
  nowFriends: boolean;
}

/** An answer as a line and a state. Pure. */
export function askMessage(outcome: LobbyAskOutcome): FriendAsk {
  return {
    outcome, line: askLine(outcome),
    settled: outcome === "sent" || outcome === "already_asked" || outcome === "now_friends" || outcome === "already_friends",
    nowFriends: outcome === "now_friends" || outcome === "already_friends",
  };
}

/** A call that gave no word. The same quiet line the rest of the social screens use. */
export const askUnavailable = (): FriendAsk => ({ outcome: "unavailable", line: studentFacing("other"), settled: false, nowFriends: false });

/** The part of the social service this needs, so a test can stand in for it. */
export interface FriendRequestSource {
  sendLobbyFriendRequest(personId: string): Promise<Result<LobbyAskOutcome>>;
  readonly canRequestFriends: boolean | null;
  probeFriendRequests(): Promise<boolean | null>;
}

/** Asks, and returns what to show. Never throws. */
export async function friendRequestFromLobby(social: Pick<FriendRequestSource, "sendLobbyFriendRequest">, userId: string): Promise<FriendAsk> {
  try {
    const r = await social.sendLobbyFriendRequest(userId);
    return r.ok ? askMessage(r.value) : askUnavailable();
  } catch {
    return askUnavailable();
  }
}

/**
 * The page's handle on it: `canRequestFriends` is what to check before drawing the button (false only when the project is
 * known not to have the migration; true or unknown both show it), `probe()` finds out once, `ask(id)` asks.
 */
export function friendRequester(social: FriendRequestSource) {
  return {
    canRequestFriends: (): boolean => social.canRequestFriends !== false,
    probe: async (): Promise<boolean> => (await social.probeFriendRequests()) !== false,
    ask: (userId: string) => friendRequestFromLobby(social, userId),
  };
}
