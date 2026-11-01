# iPad changes for "Add friend in the library" and "what device are they on"

**NOT COMPILED OR RUN.** There was no Swift toolchain where this was written, so no `.swift` file in the app repo
was touched. Everything below is a spec with Swift written against the names in `Sources/PlumiKit/Social/` as they
stand on branch `claude/friendly-brahmagupta-5m7yb4`. Expect to fix a label or an argument order when it first builds.

The server side is `Supabase/migrations/0124_lobbyPlatform.sql` and `0125_lobbyFriendRequests.sql`, tested by
`tools/social-check/friends_platform_test.sql` (121 assertions). The design and threat model are in
`docs/study/library.md`, section "Adding friends and platform".

## 0. What an iPad build that is NOT changed does after the migrations

Nothing breaks, and nothing new shows. Specifically:

- `lobby_join(x, y)` and `lobby_join(x, y, want)` still work (the new fourth argument has a default). The student's
  platform is then `NULL`, which the web shows as nothing, or as "iPad" if the avatar carries the wardrobe's keys.
- `lobby_people` has two more columns (`platform`, `friend_request`) at the end. `SocialDecode.lobbyPerson` reads
  columns by name, so they are ignored.
- A friend request that began in a library is **not listed** by `loadFriends()`: the `friendship` read policy hides a
  pending library request from both sides, and the requester's `social_profile` row is not readable (that is the point:
  no real name, no friend code). So an old iPad shows no "WANT TO BE FRIENDS" row for it, and never shows "Someone" with
  an Accept button. Requests made by friend code are exactly as before.
- Consequence to tell the founder: an iPad student on an old build cannot see or answer a request a web student sends
  them from the library until they update. The request waits 14 days.

## 1. Report the platform when entering the library

In `SupabaseSocialService.swift`, both `joinLobby` overloads send one more argument:

```swift
public func joinLobby(at tile: HallTile) async -> Result<LobbyJoin, SocialFailure> {
    await withCredentials { me in
        let row = try await self.lobbyJoinRow(["x": tile.x, "y": tile.y], me)
        guard let row, let name = row["nickname"] as? String else { throw SocialFailure.unavailable }
        return LobbyJoin(shard: SocialDecode.int(row["shard"]), nickname: name, visible: row["visible"] as? Bool ?? false)
    }
}

public func joinLobby(at tile: HallTile, server: Int) async -> Result<LobbyJoin, SocialFailure> {
    await withCredentials { me in
        let row = try await self.lobbyJoinRow(["x": tile.x, "y": tile.y, "want": server], me)
        guard let row, let name = row["nickname"] as? String else { throw SocialFailure.unavailable }
        return LobbyJoin(shard: SocialDecode.int(row["shard"]), nickname: name, visible: row["visible"] as? Bool ?? false,
                         wantedFull: row["wanted_full"] as? Bool ?? false)
    }
}

/// `lobby_join` with this device named (0124). A project before 0124 refuses the unknown argument, so the call is
/// made again without it, and not tried with it again for the life of the service.
private func lobbyJoinRow(_ args: [String: Any], _ me: SocialCredentials) async throws -> [String: Any]? {
    if joinsWithPlatform {
        do {
            return SocialDecode.row(try await rpc(SocialRPC.lobbyJoin, args.merging(["platform": LobbyPlatform.ipad.rawValue]) { $1 }, me))
        } catch SocialFailure.unavailable {
            joinsWithPlatform = false   // the call below tells a missing function from an offline one by failing again
        }
    }
    return SocialDecode.row(try await rpc(SocialRPC.lobbyJoin, args, me))
}
private var joinsWithPlatform = true
```

Notes: `rpc(...)` throws `SocialFailure.unavailable` for any non-2xx it does not recognise, which includes PGRST202 (the
function with that argument does not exist). If you want `joinsWithPlatform` to stay true across a transient 5xx, check
the HTTP status/`code` inside `rpc` the way the web does (`isMissingFunction` in `src/lib/social/failure.ts`).
Everything else about `enterLobby` and `switchLobby` in `SocialModel` is unchanged. A re-join (the 15-minute warm path,
a server switch) states the platform again, which is what keeps it true: a join that says nothing clears it.

`SocialRPC` (same file, top): add `static let sendLobbyFriendRequest = "send_lobby_friend_request" // (person)` and
`static let lobbyFriendRequests = "lobby_friend_requests" // ()`, and add both to `SocialRPC.all`.
`SocialServiceTests` (line ~272 area) pins names: add the two names and `lobby_join` args `x, y, want, platform`.

## 2. Types (`LobbyTypes.swift`)

```swift
/// The device a student is on right now (0124). Self-reported: a label, never a safety signal.
public enum LobbyPlatform: String, Equatable, Sendable {
    case ipad, web
    public var title: String { self == .ipad ? "iPad" : "Web" }
}

/// Your own open request with someone in the library (0125): you asked them, or they asked you.
public enum LobbyRequestState: String, Equatable, Sendable { case sent, received }

/// What `send_lobby_friend_request(person)` said. Words, not errors. `notHere` is one answer for left, hidden, blocked,
/// never there, and yourself: the app must not try to tell them apart.
public enum LobbyAskOutcome: String, Equatable, Sendable {
    case sent
    case nowFriends = "now_friends"
    case alreadyFriends = "already_friends"
    case alreadyAsked = "already_asked"
    case rateLimited = "rate_limited"
    case notHere = "not_here"
}

/// One of your open requests made in the library (`lobby_friend_requests`): the other student is only a nickname and a look.
public struct LobbyFriendRequest: Equatable, Sendable, Identifiable {
    public enum Direction: String, Equatable, Sendable { case incoming, outgoing }
    public let id: String            // the other student's id: respond_friend_request's from_user / remove_friend's user
    public var direction: Direction
    public var nickname: String
    public var colour: Int
    public var avatar: SocialAvatar?
    public var streak: Int
    public var level: Int
    public var createdAt: Date
}
```

`LobbyPerson` gains two stored properties with defaults, so every existing initialiser call compiles:
`public var platform: LobbyPlatform? = nil` and `public var friendRequest: LobbyRequestState? = nil` (add both to the
`init` as trailing defaulted parameters and assign them).

`SocialDecode.lobbyPerson`: add to the `LobbyPerson(...)` call
`platform: (row["platform"] as? String).flatMap { LobbyPlatform(rawValue: $0.lowercased()) }` and
`friendRequest: (row["friend_request"] as? String).flatMap(LobbyRequestState.init(rawValue:))`. An unknown or missing value
must decode to `nil`, never fail the row.

Add `SocialDecode.lobbyAsk(_ reply: Any?) -> LobbyAskOutcome?` (`(reply as? String)?.lowercased().flatMap(LobbyAskOutcome.init)`;
`nil` means `.failure(.unavailable)`, not a guess) and `SocialDecode.lobbyFriendRequest(_ row:)` which reads **only**
`user_id, direction, nickname, colour, avatar, streak, level, created_at`. Do not read `display_name` or `friend_code`
there even if a future server sends them. Run the nickname through `LobbyRules.sanitised`'s nickname check (two plain
capitalised words, else "Someone").

## 3. Service (`SocialService.swift`, `SupabaseSocialService.swift`, fakes)

Protocol additions, with defaults in the `extension SocialService` so existing fakes compile:

```swift
/// `send_lobby_friend_request` (0125): ask someone you can see in the library to be friends.
func sendLobbyFriendRequest(to personID: String) async -> Result<LobbyAskOutcome, SocialFailure>
/// `lobby_friend_requests` (0125): your own open library requests, both ways, every person a nickname.
func lobbyFriendRequests() async -> Result<[LobbyFriendRequest], SocialFailure>
// defaults: { .failure(.unavailable) }
```

`SupabaseSocialService`:

```swift
public func sendLobbyFriendRequest(to personID: String) async -> Result<LobbyAskOutcome, SocialFailure> {
    await withCredentials { me in
        guard UUID(uuidString: personID) != nil else { return .notHere }          // never leaves the device
        let reply = try await self.rpc(SocialRPC.sendLobbyFriendRequest, ["person": personID.lowercased()], me)
        guard let outcome = SocialDecode.lobbyAsk(reply) else { throw SocialFailure.unavailable }
        return outcome
    }
}

public func lobbyFriendRequests() async -> Result<[LobbyFriendRequest], SocialFailure> {
    await withCredentials { me in
        let rows = try await self.rpc(SocialRPC.lobbyFriendRequests, [:], me) as? [[String: Any]] ?? []
        return rows.compactMap(SocialDecode.lobbyFriendRequest)
    }
}
```

`FakeSocialService` / `FakeLobby`: model the rules the SQL test pins, so the model tests mean something. The minimum:
both in the same shard with a row fresher than `LobbyRules.fresh`; the person visible; not blocked either way; otherwise
`.notHere` for self, unknown, hidden, other shard and blocked (one branch, one word); `.alreadyAsked` for an open request or
a no within 7 days; `.nowFriends` when they had asked; limits of 6 an hour, 15 a day, 8 open; `friendRequest` filled on
the `LobbyPerson` rows the fake returns.

## 4. Model (`SocialModel.swift`)

```swift
@Published public private(set) var lobbyFriendRequests: [LobbyFriendRequest] = []
public var incomingLobbyRequests: [LobbyFriendRequest] { lobbyFriendRequests.filter { $0.direction == .incoming } }

private func loadLobbyFriendRequests() async {          // quiet on failure: a server before 0125 simply has none
    if case .success(let read) = await service.lobbyFriendRequests() { lobbyFriendRequests = read } else { lobbyFriendRequests = [] }
}

/// Add friend on a card. Returns the line to show, or nil when there is nothing to say.
@discardableResult
public func askToBeFriends(_ personID: String) async -> String? {
    switch await service.sendLobbyFriendRequest(to: personID) {
    case .success(let outcome):
        await loadFriends()                              // an answer to their request makes a friendship
        await loadLobbyFriendRequests()
        if outcome == .nowFriends { record(.friendRequestAccepted, kind: .friend, via: "library") }
        if outcome == .sent { record(.friendRequestSent, kind: .friend, via: "library") }
        if let i = lobbyPeople.firstIndex(where: { $0.id == personID }) {
            switch outcome {                             // the card changes at once; the next read says the same
            case .sent, .alreadyAsked: lobbyPeople[i].friendRequest = .sent
            case .nowFriends, .alreadyFriends: lobbyPeople[i].isFriend = true
            default: break
            }
        }
        return SocialCopy.ask(outcome)
    case .failure(.unavailable): return nil              // an older server: the card does not offer the button (see 5)
    case .failure(let failure): absorb(failure); return SocialCopy.askQuiet
    }
}
```

- Call `loadLobbyFriendRequests()` at the end of `loadFriends()` and in `enterLobby` after `myJoinRequests`.
- `respond(to:accept:)` (existing) already calls the right RPC for a library request (`from_user` is the requester's id).
  Also `lobbyFriendRequests.removeAll { $0.id == userID }` before the call, as it does for `requests`.
- `removeFriend(_:)` (existing) is also how a student takes back an outgoing request. Same removal from `lobbyFriendRequests`.
- Block and Report on a nickname-only requester: `block(userID)` and `reportUser` already take an id. A block deletes the
  pending row on the server, so the request vanishes on the next read.

## 5. UI

**`LobbyPersonCard.swift` and `LobbyCard`** (the doc comment "No Add friend" is no longer true; update it).
`LobbyCard` gains `platform: LobbyPlatform?` and `friendAction: FriendAction`:

```swift
public enum FriendAction: Equatable, Sendable { case add, sent, received, friends }
// in make(): friendAction = p.isFriend ? .friends : p.friendRequest == .sent ? .sent : p.friendRequest == .received ? .received : .add
```

The card shows, under the name: the platform as a small tag ("iPad" / "Web", nothing when `nil`), and a button row:
`.add` is a `ChunkyButtonStyle` "Add friend" (accessibility id `lobby-card-add-friend`); `.sent` is a disabled "Friend
request sent"; `.received` is "Asked you" with the same Accept / Not now as the requests list (`model.respond`);
`.friends` shows nothing extra. Hide the whole button row when `social.friendRequestsAvailable == false`: keep a
`@Published var friendRequestsAvailable = true` on the model, set false only when `sendLobbyFriendRequest` or
`lobbyFriendRequests` fails with `.unavailable` twice in a row (not on the first hiccup).

On tap: `if let line = await social.askToBeFriends(personID) { social.notice = line }`.

**`GroupsHomeView.requests(_:)` and `StreakFriendsView.requests(_:)`** (the "WANT TO BE FRIENDS" list): after the existing
rows, add one row per `social.incomingLobbyRequests`. Same layout as today's row, but:

```swift
SocialAvatarView(name: request.nickname, colour: request.colour, size: 40,
                 look: RoomAvatar.person(of: request.avatar, colour: request.colour, id: request.id))
Text(request.nickname)           // never a display name: there is none to show
// "Not now": Task { await model.respond(to: request.id, accept: false) }
// "Accept":  Task { await model.respond(to: request.id, accept: true) }
```

The row's avatar button must not open `PersonSheet` (it needs a `SocialPerson`, which would need a display name). Instead
a long press / context menu with "Block" and "Report" calling `model.block(request.id)` / the existing report flow.
`GroupsHomePlan.make` filters `requests` to incoming; add the lobby requests to its count so the section and the badge
appear (`SocialUIRules.swift`, `GroupsHomePlan`).

**Never** read `social_profile` for a library request, and never keep a nickname-to-real-name map: the real name arrives
only after Accept, through the ordinary friends read.

## 6. Copy (`SocialCopy`, `SocialUIRules.swift` line ~330 to ~450)

Same lines as the web (`askLine` in `src/lib/social/failure.ts`), no em dashes (`.context/tools/emdash.py` checks):

| `LobbyAskOutcome` | line |
|---|---|
| `sent` | Friend request sent |
| `nowFriends` | You're friends now |
| `alreadyFriends` | You're already friends |
| `alreadyAsked` | You already asked them |
| `rateLimited` | That's enough requests for now. Try again later |
| `notHere` | They're not around right now |

`askQuiet` (a call that gave no word): the same line `SocialCopy` already uses for "That didn't work. Try again later".
Add `SocialCopy.ask(_ outcome:)`, the two new buttons ("Add friend", "Friend request sent") and the platform titles to the
`SocialCopy.all` list that the em-dash and length tests walk (line ~437).

## 7. Tests to add (they cannot be run here)

- `SocialServiceTests`: the two new RPC names; `lobby_join` sent with `platform = "ipad"`; a 404/PGRST202 on that call is
  retried without `platform` and still returns the join; `send_lobby_friend_request` sends exactly `["person": id]`; every
  word decodes; an unknown word is `.failure(.unavailable)`; a malformed id makes no request.
- `LobbyTests`: `lobbyPerson` reads `platform` and `friend_request`, and tolerates both missing and garbage; `lobbyFriendRequest`
  never carries a name (feed it a row with `display_name`/`friend_code` and assert they are not in the value).
- `LobbyCard`: `friendAction` for friend, sent, received, nothing; `platform` passes through.
- `SocialModelTests`: `askToBeFriends` updates the card and the request list for each outcome; `respond` on a library request
  removes it from `lobbyFriendRequests` and calls `respond_friend_request(from_user:)`.
- Em dash scan over the new copy.

## 8. What the iPad must not do

- Do not call `send_friend_request` with a code for a person met in the library; there is no code to use.
- Do not show "Someone" for a library request. If `lobby_friend_requests` fails, show nothing.
- Do not treat `notHere` as informative. One line, no retry loop, no detail.
- Do not infer the platform from avatar keys once `LobbyPerson.platform` is non-nil; the server value is the device right now.
