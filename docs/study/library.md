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
- **Looks.** Everyone is drawn as the person they dressed (see "People and the wardrobe" below). Someone whose
  avatar names no person, or whose layers have not loaded yet, wears a premade look from `people.png` picked from
  their id (`lookFor`, the iPad's hash over this site's own cast). Cosmetic: nothing identifies a student by it.
- **Ambient crowd.** The iPad draws anonymous decorative students ("less NPCs for each real person", `LibraryScene`
  `seatTheCrowd`). The web draws only real people and the two staff, so what is on screen is who is here. Counts never
  include decoration on either side.
- **Not verified.** Agreement is by reading the iPad's code and by tests of the pure format; **no iPad build ran
  against this**, so a real iPad seeing a real web student walk is unproven. The one thing to check first on a device:
  a web student sits in seat N, an iPad student sees them in the same chair.

## People and the wardrobe

**Drawn as themselves.** The iPad dresses a person from LimeZu layers (body, eyes, outfit, hair, accessory,
headphones; app repo `PixelPeople.swift`, `RoomAvatar.swift`). The site ships the same layers
(`public/library/people-layers.bin` + `.json` = the app's `lz_people.bin/.json`, loaded only by the Study page, 0.6 MB),
and `src/lib/studyapp/library/people/` builds each student's 78 frames from them:

| | |
|---|---|
| `look.ts` | `PersonLook`, `known` (unknown part -> nearest known), `derived` and `personOf` (= `RoomAvatar.person`): the iPad's FNV-1a hash, so an avatar with no person is the same derived person as on every iPad. |
| `png.ts`, `layers.ts` | Reads the indexed PNGs itself (a canvas would premultiply the alpha-92 shadow pixels). |
| `sheet.ts` | Layers over one another, the book, `lengthen` 1.25, the Plumi headphones, the colour grade the web art is baked with, laid out as the engine's 78 frames. The mapping is written at the top of the file. |
| `store.ts` | Browser adapter: fetch once, build a row per distinct look, cache (80), tell subscribers. A row not built yet answers null and the room keeps the premade person. |
| `wardrobe.ts` | The free set, `worn`, `mergeAvatar`. `components/studyapp/library/Wardrobe.tsx` is the panel. |

**The mapping was found, not assumed.** `people.png` was cut from the same pack by `scripts/cafe-hero/export_library.py`.
Its 36 looks were reproduced from their parts (the crowd generator's seed), composed with this code, and compared:
all 36 x 78 frames have the identical outline; all but at most 12 of 512 pixels agree (the rest are the soft hair
shadows: the iPad restyles each layer before laying them over each other, the web cast restyled the finished picture, so
a shadow over skin is lighter there). `people/sheet.test.ts` holds this. Idle 0-23 and walk 24-47 are layer rows 0 and
1; sit 48-59, phone 60-65 and read 66-71 (with a book) are row 2; the stool frames (72-77) are the "back" idle frames,
lengthened a second time and cut to rows 4 to 23.

**What the iPad itself does.** Its Grand Library scene draws only *you* from your wardrobe look (`LibraryArt.dress`).
Other people there are drawn from the library sheet's rows (`LibraryScene.pick`, a hash of their id). The web draws
everyone from their avatar, which is what the iPad's own cards, chat dots and hall do (`RoomAvatar.person`). So a
web student's outfit reaches iPad students in cards and lists now, and in the iPad's library scene only when that
scene starts drawing others from avatars. Not a web fix.

**The wardrobe offers only the free starter set.** Most parts cost ink earned by studying (some unlock by streak or
focus hours); ownership is kept on the iPad and `set_avatar` does not check it. The web has no ink and does not go
round that economy: it offers the items with `price == 0` and no unlock in `RoomStore.swift` `WardrobeItem.all`
(7 skins, 7 eyes, 6 hairstyles, 5 outfits, no glasses, no headphones, teal, red) and the colours of the style worn
(free on the iPad too: `setVariant`). A part dressed on the iPad outside that set stays on, shown as "Current", until
the student picks another in that slot. `wardrobe.test.ts` parses the Swift source to hold the list and the titles
to the iPad's when the app repo is beside this one. The iPad's titles are used as they are (skin 01 is "Fair" there,
though the art's first body is the darkest: not changed here).

**Saving.** `set_avatar` REPLACES the avatar (0120: `UPDATE social_profile SET avatar = $1`) and takes only
feather, top, colour, shade, accent, legs, shoe, hat, hat_colour, scarf, glasses, body, eyes, outfit, hair, acc,
phones, pro, each an identifier or `#rrggbb`. So a save starts from the avatar read from `social_profile`
(`library.ts`, `useLibrary().profile.avatar`) and changes only body, eyes, outfit, hair, acc and phones ("none" when
empty); `pro` and every older key stay. A key or value the server would refuse is left out of the merge rather than
failing the save. A failed save says one plain line and keeps the choice on screen. After a save the room redraws you
at once; the avatar is also remembered in the profile store.

**How fast a friend sees it.** `lobby_people` returns `social_profile.avatar`, and the visit reads it every 2 s
(every 5 s while the floor is live; `PEOPLE_EVERY_MS`, `PEOPLE_LIVE_EVERY_MS`), so a web friend's room changes within
5 s of the save landing. An iPad friend reads on `lobbyReadEvery`/`liveReadEvery` (2 s and 5 s), but draws the person in
cards and lists, not in its library scene (above).

**Known conflict, not solved: two devices, one avatar.** The iPad also writes the avatar (`SocialModel.publishAvatar`,
every poll, only when it differs from what *that process* last sent; `lastSentAvatar` is in memory). The server keeps
whichever saved last. The iPad never reads its own avatar back from the server (`avatarSource` is its local
`RoomStore.look`), so a web change is never pulled into the iPad's wardrobe, and the iPad sends its own look again at
its next launch or whenever its look changes, replacing the web's. A student who dresses on both will see the iPad's
look return after the iPad is next opened.

**Checked.** `npm run library:test` (people/ added), and `social:e2e` section "the wardrobe" (5 checks on the real
schema: an iPad avatar reads back, the merged avatar is accepted exactly and changes only what was chosen, the whole
avatar is replaced, an invented key is refused, and another student's `lobby_people` returns it).

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
npm run library:test         # room, session, social/library and people/ (look, sheet, wardrobe, flow)
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
