# The Grand Library on the web (Study)

Study is the Grand Library: one room that iPad and web students share. A student joins, sees real students walk and
sit in the same room, takes a seat and times themselves, switches library servers, waves, and chats with the same
filters as the iPad. It is on the same Supabase project as the iPad (the app repo's migrations `0104` to `0123`), so
a web student and an iPad student are in the same shard of the same lobby. **No migration, no table, no new server
function** was added: the web speaks what the iPad speaks.

Reuse, not rewrite: the room is the homepage's engine (`src/components/landing/cafeScene.ts`) with a new `library`
mode added beside `hero` and `friends`. Hero and friends behave as before (checked before and after, see below).

## Where things are

| | |
|---|---|
| `src/app/study/(app)/library/page.tsx`, `library.css` | The page (replaces the placeholder), its styles under `.pa`. |
| `src/app/study/(app)/library/demo/page.tsx` | Dev-only scripted library (`/study/library/demo`); answers 404 in a production build. |
| `src/components/studyapp/library/` | `LibraryPage` (signed out / not joined / joined), `Cards` (door cards), `Library` (the live page), `RoomCanvas` (the engine), `parts` (seat, who is here, libraries, chat), `Beacon` (optional, for the Desk). |
| `src/lib/studyapp/library/` | `session.ts` (the visit), `lobbyWatch.ts` (Realtime), `room.ts` (units, seats, wire format), `compose.ts`, `fake.ts` + `demo.ts` (scripted world), `ipadSeats.ts` (generated), tests. |
| `src/lib/social/` | Extended: `lobby.ts` (types and the iPad's `LobbyRules`), `librarySpam.ts` (mirror of `library_spam`), 12 RPCs in `api.ts`, 12 service methods, `library.test.ts`. |
| `scripts/` | `social-e2e.ts` (extended), `social-fuzz-library.ts`, `library-seats.ts`; `social-check-sql.ts` knows 0117 to 0123. |

## How it works

`LibrarySession` is one student's visit. It holds the state, runs a one-second beat, and is handed a service, Realtime,
a clock and a ticker, so a scripted world drives it in tests and in the demo. The beat (the iPad's own cadence):

| Thing | When | iPad evidence |
|---|---|---|
| `lobby_join(x, y[, want])` | on entry, switching, and when the server says "rejoin" | `SocialModel.enterLobby / switchLobby`, `SocialModel.swift:880, 908` |
| `lobby_set_position(shard, x, y, seated, subject, focus_since)` | when seated or the subject changes, and every 10 s | `HallPositions.heartbeat` 10 s (`HallPositions.swift:38`), `lobbyBeat` (`SocialModel.swift:1018`) |
| `lobby_people(shard)` | every 2 s, every 5 s while the floor is live | `lobbyReadEvery` 2 (`SocialModel.swift:876`), `liveReadEvery` 5 (`HallPositions.swift:46`) |
| `library_messages(shard, since)` | every 4 s; the newest 100 afresh every sixth read | `GroupChatModel.pollInterval / fullReadEvery` (`GroupChatModel.swift:61, 64`) |
| `lobby_servers()` | every 20 s, and when the picker shows | `SocialModel.loadLobbyServers` |
| `lobby_leave()` | on leaving the page | `SocialModel.leaveHall` |

Failures are values (`Result`), never thrown at a view. A failed read keeps what was last good; a failed write says one
short line in the student's words (`failure.ts`); a student never sees a rule name, a code or "error". If the server
says `not_member` (hidden since, or the row went stale) the visit joins again by itself.

### Realtime (the floor)

`walk:lobby-<shard>:<user>`, private, as the iPad (`LobbyRules.hallKey` `LobbyTypes.swift:272`,
`RealtimeTopic.walk` `RealtimeProtocol.swift:265`, the topic rule in `0117_publicLobby.sql` `realtime_may`). Your own
topic tracks presence (key = your id) and broadcasts `move`; everyone else in `lobby_people` is listened to (at most
50: `SocialRealtime.maxPeople`, `SocialRealtime.swift:44`). A step is one message, with a 100 ms floor and a resend every
10 s while you stand (`SocialRealtime.swift:46, 48`). Realtime is an enhancement: with no socket the page works a few
seconds behind and says "Catching up".

### Two layers of position (what the lead's brief assumed, and what the iPad does)

1. **The server's coarse tile is the same for everyone.** It is **not** derived from where you stand on the floor.
   The iPad sends `StudyPlaces.shownLibraryTile` (`StudyPlaces.swift:312`), the walkable tile nearest the middle of the
   "Grand Library" room in `Resources/World/world.json`: **(65, 34)** (`entryTile`, `StudyPlaces.swift:289`; the
   fallback is (40, 40)). The iPad then shows `lobby_people` filtered to the library's place
   (`GrandLibraryView.swift:861`: `StudyPlaces.people(..., in: .library)`), so a tile outside the library's room
   would put a web student somewhere else. The web sends (65, 34); `room.test.ts` recomputes it from the app's
   `world.json` when the app repo is beside this one.
2. **The precise place travels in the realtime `move`** beside that tile: `lx, ly` (the sprite's top left in room
   points), `ls` (seat index), `lp` (the rest of the walk, flat `x, y, ...`, at most 24 points), clamped on read to
   0 to 6000 and seat 0 to 1000 (`LibraryPresence.swift:36-39, 48, 61`). `room.ts` is the same format, tested for the
   hostile payloads the iPad clamps.

### Do web and iPad positions agree? What was done, and what is not proven

- **Units.** The iPad's room is 1920 x 1312 points, this site's 960 x 656 pixels: exactly half (`layout.json` `w`
  and `h`; `room.test.ts`). A point on the wire is two art pixels. The sprite's top left is `(x, y)`; the iPad's
  feet are `(+16, +61)` points (`LibraryWorld.swift:113`), here `(+8, +31)` pixels, which is `(16, 62)`: one point of
  foot height that no one can see. The door agrees: iPad `(944, 1248)`, here `(480 - 8, 654 - 31) * 2`.
- **Seats.** `ls` is an index into the iPad's `seats` array: `lib_world.json` in file order, then the study pod
  appended (`LibraryWorld.swift:139-141`): 76 seats. `ipadSeats.ts` is that table, generated from the app's
  `lib_world.json` (`npm run library:seats`, `--check` to verify). Matched to this layout by position (the iPad's
  coordinates are exactly twice this layout's): **68 of the 76 match a spot here, at the same coordinates and
  facing**, including the pod. **Eight iPad seats have no spot in this layout** (iPad seats 10, 16, 28, 34, 40, 52, 60,
  66): the co-founder's render this layout is cut from left them empty, so `layout.json` has nobody in them. The chairs
  are in the art, so those eight are added from the iPad's own coordinates (their draw order is taken from the chair
  piece they sit in). The seats `layout.json` has that the iPad does not (stools along the rail, sofas) are scenery on
  the iPad; a web student can only sit in the 76, so they never appear to be standing at a bookshelf there.
- **Walking.** Everyone walks the same deterministic walk; a path is sent once. The web walks at 70 pixels a second
  (the iPad's 140 points: `LibraryScene.speed`, `LibraryScene.swift:128`). The iPad eases in and out; the web does
  not, so a long walk can differ by a fraction of a second. A new `move` re-places someone more than 24 pixels (48
  points) off, as `remoteHeard` does (`LibraryScene.swift:298`).
- **Looks.** NOT the same. A student's look is picked from their id on each client (`lookFor`, the iPad's hash) from
  that client's own cast; the iPad's people sheet and this site's `people.png` are different, restyled sheets (no
  frame matches), so the same student may wear a different look on the other client. Cosmetic: nothing identifies a
  student by it.
- **Ambient crowd.** The iPad draws anonymous decorative students ("less NPCs for each real person", `LibraryScene`
  `seatTheCrowd`). The web draws only real people and the two staff, so what is on screen is who is here. Counts never
  include decoration on either side.
- **Not verified.** Agreement is by reading the iPad's code and by tests of the pure format; **no iPad build ran
  against this**, so a real iPad seeing a real web student walk is unproven. The one thing to check first on a device:
  a web student sits in seat N, an iPad student sees them in the same chair.

## Safety (students are 13 to 18)

- Nothing is shared until the student joins (`LibraryPage`: signed out and not-joined states touch no lobby call).
  The Desk beacon only reads counts.
- A stranger is only a nickname; `sanitised` drops a stranger's display name even if a server ever sent one
  (`LobbyRules.sanitised`); the real name appears only for a friend.
- Report and block exist on every person (card in "Who's here") and every message (the `...` menu: four reasons, and
  "Report and block"), as the iPad's card and chat (App Review 1.2). A reported message goes from your screen at once;
  two reports hide it for everyone but its sender; two hidden messages mute the sender for two hours (the server).
- Chat is gated by a one-time "No links. No swearing. Be kind." (`GroupChatModel.rulesKey`), checked in the browser
  first (`chatRules.ts` + `librarySpam.ts`), refused by the server regardless.
- A hidden student (`set_lobby_visible(false)`) neither sees nor is seen; the page says so and offers "Show me".
- "Leave the library" says that it also removes friends and groups (`social_opt_out`), on iPad too.
- No Add friend for strangers (a friend needs the other's code, which the lobby never shows): as `LobbyPersonCard`.
  Public-group join requests are not built (optional in the brief).

## Tests and what they prove

```bash
npm run library:test         # 73 tests: room.test.ts 17, session.test.ts 29, social/library.test.ts 27
npm run social:test          # 54 (the earlier suite; one assertion updated, see below)
npm run app:test             # 57 (the lead's)
npm run library:seats -- --check   # ipadSeats.ts matches the app's lib_world.json
npm run social:check-sql     # regenerate supabase/checks/social_applied.sql (now 72 checks, incl. 0117 to 0123)

# a scratch Postgres 16 with the app's migrations 0102 to 0123, each applied twice. The app's own SQL suites on it:
# social 224, hall 48, cafe 7, person 8, chat 129, positions 21, realtime 56, join requests 42, streaks 8 all pass;
# lobby 77 of 83 (the 5 stale assertions after 0121, and one that is random: "a nickname is never made from the name"
# failed in one run and not another); library_chat stops at its line 122 (it reads lobby_profile as the student: refused)
PGHOST=localhost PGPORT=5545 PGUSER=postgres PGDATABASE=postgres npm run social:e2e            # 48 checks, real schema, RLS on
PGHOST=localhost PGPORT=5545 PGUSER=postgres PGDATABASE=postgres npm run social:contract       # 72 of 72
PGHOST=localhost PGPORT=5545 PGUSER=postgres PGDATABASE=postgres npm run social:fuzz-library   # 44,891 messages
```

- **The spam mirror is held to the real function.** `library_spam` (0123) plus `chat_refusal`, over a seeded corpus of
  44,891 messages (repeats, keyboard rows, symbols and emoji, shouting at every ratio, ten scripts, lookalikes,
  full-width, zero-width, leet, lengths 279 to 300): **0 disagreements**. The fuzz can fail: changing one digit of one
  rule (`{5,}` to `{6,}`) gives 1,666 disagreements. Not covered by the fuzz (needs history): the repeat rule, tested
  in the end-to-end run and by hand-made cases.
- **The end-to-end run** adds 22 checks on the real schema: joining and nicknames, friend by name and stranger by
  nickname only, seated and subject and timer, emotes and their pace, servers and the picker, choosing a library and a
  full one (60 rows are inserted to fill it), the chat's filters (each of link, language, spam, shouting, empty, too
  long agrees with the browser mirror), pace, repeat, reports and the two-report hide, the mute, report-and-block,
  a hidden student, and then `LibrarySession` over the real server for two students with the floor over a scripted
  Realtime.
- **A real page, signed in** (not committed: it lives in the build's scratch directory): the site run with
  `NEXT_PUBLIC_PLUMI_SUPABASE_URL` pointed at a small PostgREST-shaped server over the same real schema, and three
  browser contexts as three students. It exercises the join card, `social_opt_in`, the room, a friend by name, a
  stranger by nickname, sitting and timing, chat both ways, a wave, switching library, hiding, and leaving (the profile
  and friendships are gone, and the friend no longer sees them). Its only console errors are Realtime's WebSocket
  failing (there is no Realtime server there). An earlier run caught a `lobby_servers` read answered `not_opted_in`
  after leaving (a visit still coming in when you left kept asking); fixed, with a test that fails without the fix.
- **The Next.js dev server in the build container cannot run two copies in one directory**, so the browser checks ran
  from a copy of the source. Screenshots were taken at 1280 and 390 px and looked at; no horizontal overflow at 1280,
  390 or 320 px; keyboard (Tab to the room, arrows walk, Enter sits), touch (tap walks) and reduced motion (everyone is
  placed, nothing animates, a tap moves you at once) were each exercised.

## NOT verified (say so, do not assume)

- **Supabase Realtime itself.** There is no Realtime server here. The channel config (private, presence key and
  `enabled: true`, `broadcast.self: false`), the topics and the payloads follow the iPad's code and the migration's
  policies; whether Supabase accepts them as written is **unproven until a student joins a real library**. Realtime is
  tested against a fake hub that delivers broadcasts and presence the way Supabase documents.
- **PostgREST.** The browser-to-database check used a stand-in that runs each call in SQL as the student; URL routing,
  JSON casting of arguments and CORS are not tested for real. `supabase-js` and `social_opt_in` are already in use on
  the site, which is evidence for the calling convention, not for every function.
- **A real iPad on the same server** (see "Do web and iPad positions agree").
- **A live project.** Whether 0117 to 0123 are applied there is unknown until `supabase/checks/social_applied.sql` is
  run (it now checks them).
- `next build` was run on a copy of the source: it succeeds, `/study/library` is served (200) and `/study/library/demo` answers 404 in the production server; `tsc` and `eslint` pass on these files.

## Found, and what it means

- **A bug in the earlier hall client:** supabase-js (realtime-js 2.117) enables presence only on a channel with a
  presence listener or `presence.enabled: true`. `watchHall` tracked presence on its own topic with neither, so its
  arrival would never be announced. Fixed (`enabled: true`, test updated); `watchLobby` sets it.
- **In the app repo (not changed, not mine):** `0120_libraryChatSpam.sql` and `LibrarySpam.swift` list "no no no no" as
  spam; the rule `(.{2,6})\1{3,}` needs the run **five** times, and the real server accepts four (checked against
  `library_spam`). The comment is wrong, the rule is as intended. The earlier-noted stale `lobby_test` assertions (73
  to 76 and 80, after 0121's cap of 60) and `library_chat_test.sql` line 122 reading `lobby_profile` as the student
  are still there.
- **Locale.** The server's regexes use `\s` and character classes whose Unicode behaviour depends on the database's
  locale; the fuzz ran on a Postgres 16 with the container's default locale. Supabase's own locale was not checked.
  After `chat_tidy` the only whitespace left is a plain space, which limits the exposure.

## For the lead

- `LibraryBeacon` (`src/components/studyapp/library/Beacon.tsx`) is optional: mounted once in the layout it keeps the
  Desk's "N revising" true before Study has been visited (counts only; it never publishes names, so `friendsIn` stays
  empty until the page is open). Without it, `publishLive` is called only while Study is open.
- The page publishes `publishLive` (`state`, the total in every library from `lobby_servers`, and friends in your
  library by name) and a quiet state for signed out, not joined and off.
- A Next.js dev server cannot be started on a second port in the same project directory ("Another next dev server is
  already running"); use the running one, or a copy of the source.
