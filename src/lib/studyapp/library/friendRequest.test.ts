import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fail, ok, type Result } from "@/lib/social/failure";
import { LOBBY_ASK_OUTCOMES, type LobbyAskOutcome, type LobbyPerson } from "@/lib/social/lobby";
import { askMessage, askUnavailable, friendButton, friendRequestFromLobby, friendRequester, showsAddFriend, type FriendRequestSource } from "./friendRequest";

const person = (o: Partial<LobbyPerson> = {}): LobbyPerson => ({
  id: "u1", nickname: "Quiet Otter", displayName: null, isFriend: false, colour: 0, avatar: null, x: 65, y: 34, seated: false, subjectId: null,
  focusSince: null, streak: 0, level: 0, groups: [], emote: null, emoteAt: null, updatedAt: 0, pro: false, ...o,
});

const source = (answer: () => Promise<Result<LobbyAskOutcome>>, can: boolean | null = null): FriendRequestSource & { asked: string[] } => {
  const asked: string[] = [];
  return {
    asked,
    sendLobbyFriendRequest: async (id) => { asked.push(id); return answer(); },
    get canRequestFriends() { return can; },
    probeFriendRequests: async () => can,
  };
};

describe("what an answer to Add friend looks like", () => {
  it("settles the card for a request that is open or a friendship, and not for one that was not sent", () => {
    const settled = Object.fromEntries(LOBBY_ASK_OUTCOMES.map((o) => [o, askMessage(o).settled]));
    assert.deepEqual(settled, { sent: true, now_friends: true, already_friends: true, already_asked: true, rate_limited: false, not_here: false });
    assert.deepEqual(LOBBY_ASK_OUTCOMES.filter((o) => askMessage(o).nowFriends), ["now_friends", "already_friends"]);
  });
  it("gives every answer a plain line and says the same thing for 'not here' whatever the reason", () => {
    assert.equal(askMessage("sent").line, "Friend request sent");
    assert.equal(askMessage("not_here").line, "They’re not around right now");
    for (const o of LOBBY_ASK_OUTCOMES) assert.doesNotMatch(askMessage(o).line, /[_—–]/);
    assert.doesNotMatch(askUnavailable().line, /[_—–]|unavailable|error/i);
  });
  it("shows the right state on a card, and Add friend only when nothing is open", () => {
    assert.equal(friendButton(person()), "add");
    assert.equal(friendButton(person({ friendRequest: "sent" })), "sent");
    assert.equal(friendButton(person({ friendRequest: "received" })), "received");
    assert.equal(friendButton(person({ isFriend: true })), "friends");
    assert.equal(friendButton(person({ isFriend: true, friendRequest: "sent" })), "friends");
    assert.deepEqual([person(), person({ friendRequest: "sent" }), person({ friendRequest: "received" }), person({ isFriend: true })].map(showsAddFriend), [true, false, false, false]);
  });
});

describe("asking, through the service", () => {
  it("passes the id and returns the answer as a line", async () => {
    const s = source(async () => ok("sent"));
    const r = await friendRequestFromLobby(s, "id-1");
    assert.deepEqual(s.asked, ["id-1"]);
    assert.deepEqual([r.outcome, r.line, r.settled], ["sent", "Friend request sent", true]);
  });
  it("turns every failure, and a thrown error, into the quiet line, never an exception", async () => {
    for (const failure of [{ kind: "offline" }, { kind: "unavailable" }, { kind: "signedOut" }, { kind: "notOptedIn" }, { kind: "refused", reason: "rate_limited" }] as const) {
      const r = await friendRequestFromLobby(source(async () => fail(failure)), "id");
      assert.deepEqual([r.outcome, r.settled], ["unavailable", false], JSON.stringify(failure));
      assert.doesNotMatch(r.line, /[_—–]/);
    }
    const thrown = await friendRequestFromLobby(source(async () => { throw new Error("boom"); }), "id");
    assert.deepEqual([thrown.outcome, thrown.settled], ["unavailable", false]);
    assert.doesNotMatch(thrown.line, /boom/);
  });
  it("offers the button unless the project is known not to have the migration", async () => {
    assert.equal(friendRequester(source(async () => ok("sent"), null)).canRequestFriends(), true);
    assert.equal(friendRequester(source(async () => ok("sent"), true)).canRequestFriends(), true);
    assert.equal(friendRequester(source(async () => ok("sent"), false)).canRequestFriends(), false);
    assert.equal(await friendRequester(source(async () => ok("sent"), false)).probe(), false);
    assert.equal(await friendRequester(source(async () => ok("sent"), null)).probe(), true, "could not tell: keep the button");
  });
  it("is the same word out of the page as out of the server for 'not here'", async () => {
    const r = await friendRequester(source(async () => ok("not_here"))).ask("id");
    assert.deepEqual([r.outcome, r.line, r.settled], ["not_here", "They’re not around right now", false]);
  });
});
