# Questions: pick from the bank, write under each part

The fourth place in the study app: **Desk | Study | Questions | Flashcards**, at `/study/questions` (`study.tryplumi.app/questions`).
A student picks past-paper parts from the question bank, then works through them on a lofi sheet, writing the answer
directly under each part (a pen, a mouse, a finger, or the keyboard), pulls up the mark scheme and marks themselves.
Behind the same sign-in gate as the rest. **There is no AI marking in this version.**

## What is on screen

| Step | What | Code |
|---|---|---|
| My subjects | **First visit and always editable** ("What are you studying?"): level (GCSE, A-Level, More), tick the subjects, then the exam board for each (only boards the bank has for it; chosen for them where there is one, or where the board they chose for another subject at that level has it too). Kept in the Questions storage (`mine`); **Change** under the title and **Add a subject** at the foot reopen it with their ticks | `Setup.tsx`, `mine.ts` |
| Shelves (home) | One shelf per subject they do: a scrollable row of **paper cards**, one per real past paper (series and paper code), newest first, the latest 10 then **More papers** (a year filter), then **Mix for me** and **Pick your own** cards that open the picker below for that subject. A card shows the sitting hand-lettered, the paper's name, marks and questions, and progress that is remembered (Not started, Started, "3 of 24 marked", a stamp when finished). Tapping a paper opens the **whole paper** as a sheet, or picks it up where it was left | `Home.tsx`, `Shelf.tsx`, `PaperCard.tsx`, `paperArt.tsx`, `papers.ts` |
| Subject (picker) | The old chooser: every bank subject, about 120, by level and board, with search. Reached from the picker's subject button; a subject chosen there is added to My subjects | `SubjectChooser.tsx` |
| Pick | Search first, one **Filters** sheet (topics, paper, series, marks, mark scheme), a rail of topic chips (areas in a long spec), **Mix for me** (the picks are shown as "your mix" with 5 / 10 / 15 and Shuffle). Rows: tick, thumbnail, "Q2.3, 2 marks", topic and paper, one opening line, "Whole question" (key A or Shift+Enter). The Start bar appears only when something is picked. Up to 60 parts a set | `Picker.tsx`, `ResultList.tsx` |
| Sheet | Cream paper on a wooden desk. A slim bar (Questions, the set's name, one capsule per question, "2 of 5 marked", Page, Finish). Per question: a small "Q2 · June 2025 · Paper 1 Foundation" line, the setup picture (if any), then each part's picture with its answer zone, **Mark scheme**, and margin mark under it; "(Total for Question 1 is 5 marks)" at the foot, then one gold **Finish set**. Pen tray, Page settings | `Sheet.tsx` |
| Answer zone | One soft frame directly under the part's picture, with its tools along the top: **Write** and **Type** (switchable per part, remembered, both can hold content: a dot on the tab shows which does), then **More space** (icon) and **Reset** (only once there is something to clear), which appear when you reach for the zone (hover, focus, writing) and always on a touch screen. Reset asks "Clear this answer?" with **Keep** focused, Escape means Keep, and focus goes back to Reset (or to the tab after Clear). The paper is **plain** by default (the printed answer lines in the picture above are the lines); Lined, Dots and Graph are in Page. Height: 90 units a mark, at least 140; drag the grip | `AnswerZone.tsx` |
| Mark scheme | A quiet button named for what it shows (never "Check", which read as "Plumi will check my answer"; never gold). Opens the mark scheme picture (or the answer letter of a multiple-choice part, or the PDF link where no crop exists), the examiner's report link if there is one, and **Mark yourself**: one numbered circle per mark. The mark is written in the margin in a green hand (amber if partial, red if none). Nothing is ever awarded for the student | `Check.tsx` |
| Re-mark | **Removed** (a disabled button on every question read as a bug). No AI marking; the student marks themselves | |
| Summary | Marks, percent, per-topic bars, skipped parts, parts not marked yet. **Redo the ones you dropped marks on** (a new set, no answers carried over), **Keep going** (back to the picker), Review the sheet | `Summary.tsx` |

## Data flow

```
public/question-bank/<slug>/parts.json  --fetch-->  picker rows (BankRow)       src/lib/studyapp/questions/picker.ts
public/question-bank/<slug>/text.json   --fetch (only once someone types)-->     search text, folded in slices
/study/questions/subjects/<slug>         --fetch-->  topic tree, paper and series names (route.ts, static, built per subject)
R2 (NEXT_PUBLIC_PAPERS_URL)/bank/<id>-qp|ms|stem.webp   <img>                    cropUrls.ts
reports.json                             --fetch (only on opening a report)-->    Check.tsx
```

The picker never imports `content/questionBank.ts` (it pulls every subject's JSON into the bundle): the server page builds a
one-line-per-subject catalogue, a static route serves one subject's topic tree, and `cropUrls.ts` writes the same picture addresses
(a test holds them equal to `partImage` / `stemImage`).

**Volume.** A board set is about 6,400 parts (one subject up to about 3,000). `parts.json` is fetched when the subject is chosen
(a few hundred KB); filtering is a pass over the array per change. The list is **windowed**: fixed 96 px rows, only the rows in
view plus six either side exist in the DOM (`windowOf`), scrolling with the page (no nested scroller, which is poor on an iPad).
It is a listbox (arrows, Page Up/Down, Home/End, Space/Enter to tick). Thumbnails are the full crop clipped to 132 x 70 px, lazy loaded.
Text search folds 1 MB of paper text once, in slices of 400, after the first keystroke.

**Mix for me** (`mix`): from what the filters leave, n parts spread across the chosen topics (round robin), skipping parts done
lately (`recent`, newest 500) while others remain, from different questions while others remain, parts with no marks only if there
is nothing else; seeded so it is testable. It fills the tick list; **Start** makes the set.

## Storage (device only)

| What | Where | Why |
|---|---|---|
| Sets (the chosen parts with what the sheet needs: no refetch of the subject; a set made from a shelf also holds `paper`, the series and paper code), typed answers, modes, zone sizes, self-marks, "done lately", the open set, last subject and topics, **`mine`** (their subjects, as bank slugs, in the order chosen), tool and page preferences | **`localStorage["plumi-study-questions"]`** as `{ v: 1, q }` (`questions/persist.ts`, `questions/store.ts`). Moved out of `plumi-study-app` (see "Sheet, data and accessibility" below) | Its own key: not re-serialised with the Desk and flashcards on every stroke, not sharing their quota, and an old tab re-saving `plumi-study-app` can no longer wipe it. Sanitised on load (`sanitiseQuestions`) |
| **Ink** | **IndexedDB** `plumi-study-ink`, store `ink`, key `<setId>/<partId>`, value `{ v: 1, ink: Stroke[], at }` (`inkDb.ts`) | localStorage is about 5 MB for the whole origin, shared with the rest of the app, and re-serialised whole on every change; a set of twelve parts of working reaches megabytes. The document only keeps `ink: { n strokes, b bytes }` per answer so the sheet can show what has ink without waiting for IndexedDB |

Caps (all enforced on write and again on load): 40 sets (a finished one goes first, then the oldest; its answers and ink go with it),
60 parts a set, **12,000 typed characters a part and 700,000 in all**, **400 KB of ink a part and 20 MB in all**, 500 recent parts.
At 90% of the ink total the sheet shows "Your device is nearly full of handwriting. Clear old sets" (**Your sets** lists every set with its
size and a Delete). A stroke that would pass a cap is refused, and the zone says it is full and offers Type.

Writes (ink engine, fix round 1): a small answer (under 40 KB, a page of working) is written to IndexedDB the moment each stroke ends; a bigger one
at most every 1.5 s (a debounce of 300 ms with a 1.5 s maximum wait), and everything is flushed on `pagehide`, `freeze` and `visibilitychange`.
Typing: 250 ms after the last key and on blur. A write that fails is tried once more on a fresh connection. If IndexedDB is missing or refuses (some
private windows, a full disk), ink is kept in memory for the visit and the pen tray says, once and calmly, "Not saving handwriting on this device. Keep this tab
open, or use Type." (it goes away at the next good write). When a part is opened and the device holds a different number of strokes from the document's count
(storage cleared under the app), the count is corrected, so the Write dot never claims ink that is not there.
Two tabs on one answer: every write reads the stored record in the same transaction and adds any stroke another tab wrote that this one has never
seen (strokes are identified by a hash of their content), and a BroadcastChannel tells the other tab, which draws them. A stroke this tab erased stays
erased, one the other tab erased and this one still holds is kept: nothing a student wrote is lost to a merge. A record with `v` above 1 (a newer app) is read but never overwritten.

**Resume.** `open` is the set on the desk; closing the tab and coming back to `/study/questions` reopens it, scrolled to the question
that was at the top (`at`, written 600 ms after it changes). The restore scrolls to it, then puts it back each time the pictures and writing spaces above it have
moved it (eight checks over the first 2.3 s, none once the student has touched or scrolled the page), so it lands on the right question every time (measured below). The picker also
shows "Pick up" for an unfinished set. **Back** (Questions, top left) returns to the picker without closing the set.

Starting a set when 40 are kept removes the oldest finished one (else the oldest) and says so ("An old set was removed to make room."), never silently.

Known storage limits: no sync across devices; clearing site data deletes everything; **Safari deletes a site's script-written
storage after seven days without a visit unless it is added to the Home Screen**; a tab still running the site from before this
shipped re-saves the document without `questions` (the same hazard as when `sessions` was added: a brief window around a deploy).

## Ink format

Strokes are vectors in **logical units**: a zone is 800 units wide whatever its size on screen, y uses the same unit, so a stroke
re-renders at any width (an iPad turned round, a phone) exactly where it was written, thickness included.

```
Stroke = { c: colour 0..2 (ink black, blue, green), w: width 0..2 (fine, medium, bold), sp?: 1 (a mouse or finger: one even width), d: number[] }
d      = [x0, y0, p0, dx, dy, dp, ...]   whole numbers: x and y in tenths of a unit, pressure 0..100, every point after the first a delta
```
A stroke is simplified (Ramer-Douglas-Peucker over x, y and pressure, 0.45 unit) before it is encoded: about 1 KB for a word. That is for
STORAGE only: before any stroke is drawn (live, committed, reloaded, exported) it is resampled to at most 2 units between points (`densify`) and goes
through one function (`strokeOutline`, `perfect-freehand` with streamline 0.25 and the final point exact), so a sharp corner (V, 7, 4, a square root) is drawn where the
pen put it and the line does not change shape when the pen lifts (before this, the sparse points were smoothed and an apex was cut off by up to 30 px; `ink.test.ts` keeps the apex within 1.5 units).
Width is never simulated from speed: a pen stroke has the pen's pressure, a mouse or finger stroke is one even width, so live and stored widths cannot differ.
Rendering: one canvas per zone, mounted only while the zone is within about 700 px of the screen (a far zone is a plain placeholder holding no pixels), sized to
the screen's pixel density times the page's pinch zoom (at most 3, and at most 6.5 million pixels a zone), re-sized when the density, zoom, orientation or window changes
(debounced). There is no second offscreen copy: a frame repaints only the part the stroke changed (the strokes touching it from their cached `Path2D`s, then the live line),
so writing on a page of 1000 strokes costs the same as on an empty one (a stroke end took 57 to 125 ms at 1000 to 1500 strokes before; it is now under 1 ms of handler time).
Undo and redo are whole-state (an `Ink` is immutable): one step per stroke, per erase, per clear; in memory only (gone on reload).
Eraser: a tap or scrub removes whole strokes (v1; there is no partial eraser, a word written in one line goes whole). It tests a swept capsule between consecutive
positions, so a fast scrub cannot slip between two samples; reach is 8 units (13 for a fingertip) plus half the pen width, small enough to take one line of an equals sign.
The pen's eraser end erases too. A zone cannot be dragged or keyed shorter than its lowest stroke plus 24 units, and a stroke that leaves the zone runs along its edge.
Limits never drop what the cap allows: reading back accepts up to 12 000 strokes and 200 000 numbers a stroke; a part at 85% of its 400 KB cap says so ("nearly full") before a stroke is refused.

**`getAnswerImage(partId, { setId?, scale?, paper?, crop? })`** (`answerImage.ts`) returns a PNG data URL of the ink on plain white, drawn
from the stored strokes (so clean at any screen density), cropped to the ink with a 24 unit margin on all four sides by default (the picture is as big as the writing,
at most 4000 px a side; `crop: false` gives the whole zone), or null if there is none; `getAnswerText(partId)` the typed answer. Nothing
calls them yet. They are the hand-off for AI marking.

## Pen and finger (what is built, what is verified)

The surface (`InkCanvas.tsx`) reads `pointerType`:

- **Mouse** draws. **Pen** draws with real pressure (`pressure`; a pen that reports one constant pressure just draws at that width, live and stored alike).
  The pen's **eraser end** (`buttons & 32` or `button === 5`) erases. A system gesture that cancels a pen or mouse stroke (`pointercancel`) keeps what was written; a cancelled finger stroke is dropped.
- **Touch**, with "Finger scrolls, pen writes" ON (the default where the primary pointer is coarse; switch in **Page**): a finger never draws.
  While no pen has been seen the surface says `touch-action: pan-y pinch-zoom`, so the browser scrolls the page natively with momentum. The moment
  a pen is seen (any pen `pointerover` / `pointerdown` on the page, a `touchstart` whose Safari `touchType` is `stylus`, or a `pointercancel` of a pen touch the browser took
  for a scroll) it says `touch-action: pinch-zoom`, remembered on the device (`prefs.penSeen`), and the finger's scroll is done by hand (`window.scrollBy`
  with a little inertia, none under reduced motion, cancelled by any pointer-down on the page). That is because the spec applies `touch-action` to pen as well as touch, and a pen stroke must never be taken for a pan.
  `pinch-zoom` stays allowed so two fingers zoom the page over a writing zone as over the question picture (the browser then cancels the finger pointers). A stylus `touchstart` is also
  `preventDefault`ed where the browser lets us (Safari). While a pen is down, hovering, or was a quarter of a second ago, a resting hand neither scrolls nor draws.
- On a touch device where no pen has been seen, each writing zone's header carries **Draw with my finger** until a pen is seen or it is used; a first finger tap also shows
  "Fingers scroll the page. Write with a pen." with the same button and a dismiss, and it stays until dismissed (it no longer disappears after 5 s).
- **Finger draws** (toggle off): `touch-action: pinch-zoom`, touch draws. **Palm rejection**: a touch is ignored within 250 ms of any pen event, while a pen is down, and when its contact patch is wider than 34 px.
  A pen pointer-down pre-empts a finger stroke already under way (a resting hand), and a second finger discards it (a pinch).
- On a phone (viewport under 640 px) each zone starts in **Type**; ink works but small (the sheet scales to the width).

**Verified here (Chromium, emulated touch device 820 x 1180, CDP touch events and synthetic `PointerEvent`s with `pointerType: "pen"` and pressure):**
a finger swipe on the canvas scrolls the page and draws nothing; `touch-action` is `pan-y pinch-zoom` before a pen and `pinch-zoom` after; a pen draws; the
finger still scrolls by hand after a pen; with the toggle off a finger draws; a touch right after a pen stroke is rejected; the eraser end (`buttons: 32`) erases;
ink survives reload (IndexedDB), undo and redo.

**Not verified (no real hardware):** a real Apple Pencil on iPad Safari (that Safari reports `pointerType: "pen"`, delivers `pressure` as expected, that
`touchType === "stylus"` is present and cancelable so the page does not scroll under the first stroke, that Pencil hover events arrive on M2 iPads, how Scribble or the
Pencil double tap interact), Android Chrome with a stylus (whether a pen drag under `pan-y` pans before we see it; the `pointercancel` fallback covers
the first stroke only), palm contact sizes (`width`/`height` of a real palm; Safari does not report them), momentum feel of the hand-made finger scroll.
The first real iPad session should check: first Pencil stroke on a fresh page does not scroll it; finger scroll after that; eraser end; undo.

**Pen tray** (`PenTray.tsx`, styles in `questions-ink.css`): one 56 px pill, pen, eraser, a style button (opens a flyout with the three thicknesses, three colours and Clear ink),
undo, redo; every button 44 px. It is shown only while a writing zone is on the screen. After a stroke ends in the lowest 130 px of the screen the page scrolls up so the line
being written is not under the tray (smooth, instant under reduced motion).

## Keys (desktop)

**N** next question, **B** back, **P** pen, **E** eraser, **Z** undo, **Shift Z** redo, only while focus is on the writing space or the pen tray, or with **Alt** held anywhere; off with Page > Keyboard shortcuts. In the ink surface **Ctrl or Cmd Z** (Shift for redo). In the list: arrows, Page Up/Down, Home, End, Space or Enter.

## Accessibility

- **Keyboard and screen reader.** The picker list is a listbox with `aria-activedescendant`, `aria-multiselectable`, `aria-setsize` and `aria-posinset`, the active row is always in the DOM, the count is a live region, there is a "Skip to the questions" link, and A (or Shift+Enter) adds the rest of a row's question (no button inside an option). The sheet has one h1 (the set's name), an h2 per question, labelled groups per part, two skip links, progress as `nav > ol > button[aria-current]` plus a "3 of 8 parts marked" status, and radios with arrow keys for the self-mark. Dialogs (Your sets, Filters, Page, "Finish anyway?") are native `<dialog>`s: focus is kept, Escape closes, focus returns to the button. "Clear this answer?" in a zone puts focus on **Keep**, Escape is Keep and focus goes back to Reset (to the tab after Clear). Focus goes to the heading when the picker is reached by Back, and when a set opens.
- **Pointer and touch.** Every press target is 44 px on a touch screen (tray, tick circles, tabs, the More space icon); the pen tray and sticky bars are never on top of a focused control (scroll padding); sticky bars become static on a short screen (400% zoom).
- **Focus ring.** One two-tone ring (navy 3px, white halo) everywhere; round the whole frame for the writing space (the canvas or the textarea has no ring of its own).
- **Ink.** The surface is `role="img"` with a name that says to choose **Type** for the keyboard, and Type is one tap on every zone.
- **Forced colours.** The paper, the pictures and the writing stay white and dark, every selected state gets an outline (including the Page and finish dialogs and a picture that did not load). **Reduced motion** stills every slide, fade and shimmer.

## Tests

`npm run app:test` (344 tests in all) includes `src/lib/studyapp/questions/*.test.ts`: stroke simplification, encode and decode round trip, storage cleaning,
eraser hit tests, undo and redo; picker filters, search, order, mix (spread, recent, seeded), window; sets, grouping, self-mark totals and clamps, redo set,
summary, caps, the sanitiser, the document round trip; routing for `/questions`; picture addresses equal the bank's. Browser scripts used for this work
(Playwright, real crops from R2) are not in the repo: they drove picking, writing with a synthetic pen, erasing, undo, reload, typing, check, self-mark, finish, redo,
resume, touch behaviour, at 1280 x 800, 1024 x 768, 820 x 1180 and 390 x 844.

## Not built, and why

- **AI marking.** There is no Re-mark button (a disabled one on every question read as a bug); the student marks themselves. Marking handwriting needs a decision: cost per mark, DeepSeek consent in the privacy policy (the
  Supabase `ai` edge function), a vision model for handwriting (a text model cannot read the PNG), and what a student is told when the model is unsure.
  `getAnswerImage` and `getAnswerText` are ready for it; the truthful-assessment rule (never award what was not done) applies.
- **Handwriting to text on the web.** Same decision, plus accuracy on maths notation.
- **Sync across devices.** Everything is on this device. Signing in does not move it.
- Highlighter, shapes, lasso, text boxes on the ink; zoom and pan inside an answer zone (the page zooms with two fingers over the zone too, and the canvas is re-rastered for the new zoom, up to 3x; a real pinch is not verified on a device);
  undo that survives a reload; a search over mark scheme text only; the bank's tier and option filters (Higher or Foundation is the paper filter); the
  worked solutions the bank page has; audio for listening questions; the insert (sources) for English Language; "Show question so far" for a single later part
  (the setup is shown, earlier parts are not).
- The crops include the paper's own printed answer lines, so a part shows those and then the zone directly under it (plain by default, so there is no second set of lines). **Needs from the bank build:** `ay` per part (where the printed answer lines start), so the picture can end there and the zone replace them: one writing surface. It cannot be found in the browser (the pictures are cross-origin, so their pixels cannot be read).

## Sheet, data and accessibility (fix round 1)

**Storage.** `plumi-study-questions` holds `{ v: 1, q: QuestionsData }`. One-time migration on the first visit after this ships: if the key is absent,
`questions` is read from `plumi-study-app`, sanitised (as it always was), written to the new key and read back; only then does the app's document stop
carrying a copy (`questionsAreDurable`, set when the new key was verified, or found in the `{"v":1,"q":` format at start-up). Until then the old copy stays
as it was, so nothing can be lost between the two. Every change is applied to what storage holds *now* (not this tab's memory), so a tab that slept, or a
second tab, never writes an old copy over newer work; a `storage` event from another tab replaces the state; typing in a part is not overwritten by another tab
while unsent edits exist. An unreadable or newer-version record is copied to `plumi-study-questions-recovery` (first one kept) before anything is written over it, and the tab
starts empty instead of crashing. If localStorage is missing or full the sheet says "Your answers are not being saved on this device" (`persisted`). Deploy-window residue:
a tab still on the old code keeps working in the old key; its work after the move is not seen by the new code.

**Marks.** Only parts the student marked are scored (`scoreSet`: `got/total` over marked parts, `printed` for all, `pct` null if nothing marked). A skipped part is listed as skipped,
never counted as 0. The summary says "N of M parts marked", and offers "Do the skipped ones" (`catchUpInput`) beside Redo. Finish asks "3 parts are not marked yet (2 blank). Finish anyway?" (Keep going has focus, Escape is Keep going).

**Pictures.** `Crop.tsx`: a placeholder until loaded; on 404, garbage, HTML, abort or 20 s of nothing it retries once, then shows "Could not load this question picture", Try again, and the PDF where there is one
(mark scheme). A mark scheme that did not load holds back "Mark yourself" until the student says they have it. Part pictures reserve their size (`w`, `h`); others use the size
seen last time (`plumi-study-crops` in localStorage), or a 3.2 : 1 placeholder the first time (CLS 0.258 before; 0.024 first visit, 0.001 after, in this test).
**Needs from the bank build:** `sw`/`sh` (setup picture) and `mw`/`mh` (scheme picture) per part, and a question-paper PDF path, so the first visit is exact.

**Read as text** (under each part picture, lazy): `partText.ts`. `text.json` holds question and scheme as one folded string with no separator, so the text is cut at the part's own
`[N marks]` or `(N)`, or at the scheme table heading, whichever is first; if neither is found only the opening words (`x`) are shown and it says so. **Needs from the bank build:** `question` and `scheme` as two strings, properly cased. Alt text (`partAlt`) never cuts a word and says it is only the start.

**Keyboard and screen reader.** h1 = set name, h2 per question, each part a labelled group; skip links to the sheet and the first part still to answer; progress is `nav > ol > button[aria-current]` (44 px) with a "3 of 8 parts marked" status; per-part status "3 of 4 marks"; tick circles are radios with
roving tabindex and arrow keys; focus goes to the heading on Start, Review and Finish; the tab title names the view; Page settings and the finish question are native modal dialogs (focus kept, Escape closes and returns focus).
**Single-key shortcuts** (N B P E Z) only act while focus is on the writing space or the pen tray; Alt plus the key works anywhere; "Keyboard shortcuts" in Page switches all of it off; tool changes are announced.
Page also has **Always type** (every part starts in Type; a part switched to Write keeps its choice) and **Typing size** Normal or Large (1rem, 1.375rem). On a phone Page is a sheet at the foot.

**Speed.** `QuestionBlock` and `PartBlock` are memoised on their own set identity (not `updatedAt`), part, answers and prefs: typing or marking in one part of a 30-part sheet redraws that part (2 renders), not 30.
`content-visibility: auto` on questions was measured and **left out** (see the last section).


## Picker, chooser and the tab's CSS (fix round 1, picker fixer)

- **Layout.** One column (max 960px): title, the subject as a quiet "AQA GCSE Physics v" button, search + Filters + Mix for me, a chip rail, then flat rows. The Filters dialog is a native `<dialog>` (Escape closes, focus returns to the button; a bottom sheet under 640px); the list behind it updates as you choose and its button reads "Show N questions". An area of a long specification is one tap (tri-state, `toggleArea`).
- **Mix** replaces the list with the picked questions ("your mix"), so they can be seen and swapped; changing a filter or typing leaves the mix view. The Start bar says "about N min" (`minutesFor`, about a minute a mark).
- **List semantics.** `aria-setsize` / `aria-posinset` on options, the active row is always in the DOM (`aria-activedescendant` never dangles), the count is a live region, "Skip to the questions" link, no button inside an option (the "Whole question" tap target is a span, the keyboard does it with A).
- **Chooser.** GCSE and A-Level first, other levels under More, a board rail only when there is a choice, tiles grouped by board, every subject tinted (`--t-*`), Maths / Biology / Chemistry / Physics first. The last level and board are remembered (localStorage key `plumi-qs-chooser`, per-visitor, optional).
- **Bad data.** `parts.json`, `text.json` and the subject file are validated on arrival (`cleanRows`, `cleanText`, `cleanMeta`): anything malformed reads as "did not load" with Try again (a retry shows the skeleton), never a crash. Slow (over 8 s) says so with Try again. `text.json` failing says "searching titles only" with Try again after one quiet retry. `questions/error.tsx` catches anything else: "Try again" clears the saved subject and closes the open set (kept in Your sets), nothing is deleted. Note: this Next version passes `retry` (not `reset`) to error.tsx.
- **CSS.** `questions.css` (picker, chooser, dialogs, desk, shared), `questions-ink.css` (pen, zone, tray), `questions-sheet.css` (sheet parts) load in that order from `questions/page.tsx`. Type scale: Pixelify 38 / 22 / 16, Nunito 800 15 / 13 / 12, Caveat 25 / 44 / 76. One focus ring on this tab (navy 3px over a white 5px halo). Forced colours: the paper and crops stay white, every selected state gets an outline. Short screens (max-height 520px, 400% zoom): sticky bars become static. `html:has(.pa)` is `color-scheme: light` (no dark scrollbar).
- **content-visibility on `.qs-q`: tried twice, not used.** On a 30-part sheet (7 questions, 820 x 1180) with the CPU throttled 4x and a 55-key typing run: applying it to every question after reopening did cut typing cost (events averaging 84 to 92 ms against about 129 ms, long tasks 1.0 to 1.5 s against 4.9 s, one run each side) **but a reopened set then landed up to 300 px from the right place** (top of the target at 556, 259, 503, 22, minus 27 px against the correct 270 in five of seven runs), and `content-visibility` isolates its content, so the pictures' `mix-blend-multiply` lost the cream paper and showed as white slabs (fixed by giving each question the paper's own cream and grain, which is more weight to carry). Applying it only to questions more than a screen below the reader (so nothing in view or above can move) landed correctly every time but made no measurable difference to typing (average event 170 to 243 ms with it, 167 to 187 ms without, on a noisy machine). So the rule, `--qh` and `estimateBlock` are deleted. The reopen restore was fixed on the way: it re-aligns to the question whenever the content above has moved it (eight checks in the first 2.3 s, stopped by any wheel, touch, key or pointer press), and lands on the right question in seven of seven runs (270 px, the scroll margin), cold or warm, where the old three retries did not re-align once the page had moved more than 40 px.


## The front door: My subjects and the shelves of papers (fix round 2, home builder)

**What it is.** The Questions tab opens on the student's own subjects, not on a list of 1,653 rows. Flow: `QuestionsPage` shows the sheet if one is open, else (by a `view` it keeps) **Setup**
(no subjects yet, or Change), **Home** (the shelves), or the **Picker** (from a card). Closing a sheet returns to where it was opened from.

**My subjects (`mine.ts`, `Setup.tsx`).** A subject a student does is a bank slug (it names the level and the board). `QuestionsData.mine?: string[]` holds them in the order chosen
(cleaned on load: strings only, no repeats, 40 at most). **Migration:** older data has no `mine`; `effectiveMine` reads the last subject used and the subjects of their sets (newest first, six at most) as theirs,
so a student who used the tab before sees shelves, not the setup, and no set is touched; their first Done writes `mine` (tested through storage round trips and, in the browser, from both the new key and the old app document).
An empty list written on purpose stays empty (the setup shows again). The draft is kept in the component until Let's go, so Cancel loses nothing. Subject variants ("Biology A", "Biology B") are one tile whose
chips read "Edexcel A", "Edexcel B". Choosing a subject inside the picker adds it to My subjects.

**Papers (`papers.ts`).** `groupPapers(rows, meta)`: one paper per (series, paper code), rows in printed order (`compareLabels`), newest sitting first (the bank's series order), then the bank's paper order.
`questions` and `marks` are computed from the rows, per question (`blocks`), so an "either, or" choice counts once and a paper the bank holds only part of is a shorter paper that opens. `paperState` reads progress from the newest
set of that paper (`QSet.paper = "JUN25|84631h"`): Not started, Started (something written), "n of m marked", Done (a stamp with the percent when at least half the parts were marked, otherwise a tick and "Done, 2 of 39 marked":
never a verdict from a few parts). A paper opens as one set named "June 2025 Paper 1 Higher, AQA GCSE Physics" with every part; `MAX_PAPER_PARTS` is 120 (the longest paper has 73) against 60 for a hand-picked set.
The summary of a paper set has **Do this paper again** (a fresh set of the same parts, no answers carried over; the card then shows the new one).

**Data checks (the whole bank, `scratchpad/qfix/home/datacheck.ts`).** 120 subjects, 5,341 papers, 113,413 rows (every row lands in exactly one paper). Median 33 papers a subject; 107 subjects have more than 10, hence the shelf shows the latest 10 and
"More papers". The biggest: Edexcel A-Level History 355 (options: one paper per option per sitting, 40 in a year), OCR A-Level History A 283 (57 in a year), AQA A-Level History 171, Edexcel GCSE History 128, Edexcel A-Level Further Maths 120;
the sciences and Maths have 30 to 100. Every paper has marks printed and at least one mark scheme; none passes the cap; paper totals equal the sum of the rows and the question counts equal the sheet's (0 mismatches, 0 ordering violations). AQA GCSE Physics Paper 1 Higher reads 10 questions, 100 marks, as printed.
Pictures: the question and the scheme picture of two parts in every subject (474 files) all answer from the public bucket; in dev they are routed from `/papers-local` to it.

**Speed.** Shelves are drawn at once from the catalogue (name, board, a row of ghost papers), each asks for its subject's `parts.json` and names only when within 600 px of the screen (`IntersectionObserver`), and at most four files are in flight at
once (`bankData.ts`); a subject that has arrived is kept for the visit, so the picker opens from it with no wait. Measured: six shelves, 700 ms added per file, four in flight at most, the shelf below the fold asked for nothing until scrolled near.

**Look.** One place defines a card's look: `paperArt.tsx` (`PAPER_ART`: stickers, tape positions, tilts, and image urls that replace the CSS shapes when the final art arrives) and the block "PAPER CARD ART" in `questions-home.css`.
The default is CSS only: cream ruled paper with punched holes, washi tape in the subject's tint, the sitting in Caveat on a tinted label, marks in Caveat, a Plumi sticker (existing mascots) that becomes a stamp when done. The motion is the 180 ms card rise, hover lift and a 160 ms tick; under reduced motion all of it is still.

**Keyboard and screen reader.** Each shelf is a labelled region (`h2` plus board and level); the row is a list of buttons with one tab stop (arrows, Home and End move among the cards, the row scrolls to keep the focused card in view);
a card is named "June 2025 Paper 1 Higher, 10 questions, 100 marks, not started"; Mix for me, Pick your own and More papers are buttons in the same row; the sideways arrows are a mouse convenience (not in the tab order, hidden on touch). The setup is a group of toggle buttons with a labelled group of board chips each, and a polite status ("Pick a board for Physics", "3 subjects").
Focus ring: the tab's two-tone ring on every card; forced colours: borders and a Highlight outline for chosen subjects, the tape and paper texture dropped.

**Not done.** Final art (stickers are the existing Plumi poses, all one character); a way to remove a single subject from its shelf (it is in Change); the shelf does not remember its scroll position; progress for hand-picked sets is on the Pick up banner and Your sets, not on a card.

## Design pass: one notebook (fix round 3, design fixer; supersedes the shelf and picker wording above where it differs)

Goal: the whole tab reads as the shelf does (cute lofi paper, calm, premium). CSS and markup only; no new art. Every decision about a card's look stays in `paperArt.tsx` (`PAPER_ART`) and the block "PAPER CARD ART" in `questions-home.css`.

- **Shelf header.** "Mix for me" and "Pick your own" are two small pills in the shelf's own tint beside the scroll arrows, always there (also while the shelf loads or fails); the row ends with **More papers** (a little stack of sheets with "+N") and nothing else. A year opens 24 papers at a time ("Show 24 more"); `PaperCard` is memoised (stable props), so moving focus along the row does not redraw it. The shelf tag reads "AQA · GCSE · Higher" (no "OCR A A-Level" stutter; the tier shows when the student sits one).
- **Cards.** The look varies by index and is the same each time: tape (stripe, dots, plain, two strips) x position x tilt, holes (three, two big, a spiral's row), margin line (red or blue). The middle of the paper holds a sticker while the paper is untouched, a half stamp ("Started") once begun or finished early, the Done stamp (percent) only when `phase` is `done`, and a small stamp with the best finished score while a retry is open ("Attempt 2" beside it). The progress bar appears only when something is marked. `note` ("Part of this paper", "Choose from 16 questions") is drawn from `Paper.note`; a choose paper shows no marks total. Cards grow with their text (min-height, never clipped) so WCAG text spacing and bigger fonts do not cut the label; meta text is 13px (rem).
- **Loading and failure.** A ghost is a real-looking paper (cream, ruled, taped) with soft blanks and a light passing over them; the whole ghost row is `inert` and not scrollable, so there is no keyboard stop and no ring round blank paper. A failed shelf is one dashed paper-shaped card with a gentle mascot and a round Try again button, no sentence (its name says it to a screen reader).
- **Picker.** The page is tinted by its subject (washi strip under the title, the subject on a tinted label) and is the same 1100px column as the shelves. Rows are cream paper with the subject's colour down the left edge, the topic as the headline in Caveat, and "Q01.1 1 mark" as a small sticker in the corner; a ticked row is taped down and a little crooked. The Filters dialog is cream with dotted rules and Caveat section names. The chooser's tiles are the same tiles as the setup's.
- **Sheet.** Per part the picture has a small round "Aa" (Read as text) hung in the paper's margin (a quiet line under the picture on a phone); the writing space is plain paper with no outline until touched; its Write | Type pill and two icons float in the corner on hover (a mouse) or sit in a slim row that never covers ink (touch, and in Type mode). The "Draw with my finger" button is gone from each part (one shared hint at the top of the sheet; the tap hint after a finger tap keeps its button). The mark scheme card puts **Mark yourself** first (hand-lettered, 56px sticker-like circles), then the scheme's own table as the reference; the examiner's report is an icon in the card's corner. The toggle's label is constant ("Mark scheme") with `aria-expanded`, and `aria-controls` exists only while the card is open. On a phone the sheet bar is two rows (name, Page, Finish; then the questions and "n of m marked"), and the mark scheme picture, which scrolls sideways there, shows a shadow on the edge that has more.
- **Dialogs.** Finish confirm is a taped note on a paper-coloured scrim (a count chip, "Keep going" filled as the safe action, "Finish" plain, never gold); Your sets are folded paper tabs in the subject's colour with the paper, progress and a small delete (inline Keep or Delete); Page offers paper swatches (plain, lined, dots, graph) not text pills; the picture's large view is paper on the same scrim.
- **App-wide (app.css, three rules only).** The focus ring is navy with a white halo (it was gold, 1.45:1, on the paper); `kbd` and `.btn .k` are full-strength text. The record player shrinks to 48px at 900px and under, and its "tap for lofi" pill is hidden there and on every sheet and summary.
- **Touch.** Every press target is 44px on a touch screen (Page dialog, Close, Finish set, Your sets, the answer grip, skip links when shown); a mouse keeps the finer sizes.
- **Not changed, on purpose.** Dark mode (the app stays light and tells the browser so), the printed answer lines inside a question picture (hiding them behind the writing space needs the picture's `ay`, the fraction where they start, in `parts.json`).

## Logic, data, honesty and speed (fix round 3, logic fixer)

Goal: truthful (never celebrate or overstate), never lose a student's work, fast on a long paper. Pure rules are in `src/lib/studyapp/questions/*` and tested; the browser parts are in the components named.

- **Honest summary (`summaryView`, `Summary.tsx`).** The headline leads with coverage ("3 of 25 marked"; "Set done" only when at least 80% of the parts to mark are marked; "Nothing marked yet" for none). The score is shown, small, only when at least half are marked, and the per-topic bars with it. The mascot follows progress (encouraging under a quarter marked, calm below half, proud at half, celebrating only at 80%+ marked and 80%+ scored). The two chip lists are replaced by one grid of dots, one per part grouped by question (marked in green, amber or red, written but not marked hatched, blank empty), each going to its part. The buttons wake after 500 ms (a second tap on Finish cannot land on one), and `finishSet` is idempotent. "Save my work" downloads one page with the typed answers, the handwriting as pictures and the student's own marks (`saveWork.ts`, `saveWorkFile.ts`).
- **Card states (`papers.ts`).** `PaperState` has `phase` (new, started, partial, done), `fraction`, `line` ("Started, 3 of 25", "Finished, 3 of 25", "Done, 42 of 60 marks"), `attempt`, `attempts` and `best`. Done needs 80% of the parts to mark marked and the set finished (or all marked). A finished paper with fewer marked is `partial`: no Done stamp, no green. "Do this paper again" no longer hides the finished attempt: while a retry is open `best` holds the best finished attempt (80%+ marked) and `attempt` is 2.
- **Card honesty.** `Paper.choose` marks a paper the student picks questions from (printed total 250+, or over 200 and mostly either-or: AQA A-Level French and Spanish "640 marks", Eduqas RS options, English Literature); its `marks` is null and `note` says "Choose from 16 questions". The set made from it carries `choose: 1`, so progress, Finish and the summary count only the parts the student wrote on or marked (never "47 unmarked" for alternatives left alone). `Paper.partial` and `note` "Part of this paper" are set when the paper's marks are under 80% of what that paper code usually carries (the biggest total two or more sittings share, from three sittings) or 10% of its parts print no marks. Counts use one word on the card (questions) and no noun in progress ("3 of 25").
- **Tier (`subject.ts`, `Setup.tsx`, `bankData.ts`).** `tierOf` reads Higher or Foundation (and Cambridge's Core or Extended) from the paper's name; `CatalogueSubject.tiers` is set for GCSE and IGCSE subjects with two or more (Maths, the sciences, Combined Science, French, Spanish, Bengali, IGCSE Maths and sciences). Setup shows two quiet chips under the board (neither or both is both tiers); the choice is `QuestionsData.tiers[slug]`. `useSubject` returns `meta.papers` and `rows` already narrowed to it (`tier` says which), so the shelf, Mix for me and Pick your own all follow with no other change; a paper with no tier (a Speaking paper) is always kept.
- **Long papers (`Sheet.tsx`).** A part is drawn only while within 1600 px of the screen (one shared `IntersectionObserver`; leaving waits 1.2 s and never while something in the part has focus). Any other part is `.qs-part > .qs-part-hold`, an empty box of the height the part had when last seen (kept as a ratio of the width) or, if never drawn, of its picture, its answer space and the measured overhead; it keeps the part's id and name, and holds a hidden "Show question 3.2" button for a screen reader. The question the student opened the set at, and the ones round it, are drawn at once, so resume works as before. Redo and "Do the skipped ones" use the paper cap (120), not the picked-set cap (60), also when stored again (`sanitiseQuestions`).
- **Data safety.** Every bank file times out after 15 s (the shelf then says it did not load and Try again works; a retry drops the failed request). Ink is written to the device at every pen-up, one write in flight per answer with the newest waiting behind it (`InkCanvas.tsx`); only the small stroke-count label in the document is written later (350 ms, 1.5 s at most, at once on pagehide, hidden, or before any other change: `store.ts`). `navigator.storage.persist()` is asked for once, on the first ink or typing. Which set is on the desk is per tab (sessionStorage), so two tabs do not pull each other's view (a fresh tab picks up the last one). A `mine` whose every subject is gone reads as no choice, so their sets are found and the setup does not hide them. An unreadable record is kept under `plumi-study-questions-recovery`, then `-2` to `-5`, never over an older one, and the same text is not kept twice.
- **Phone.** A question or setup picture opens large on a tap (a magnifier chip, `dialog.qs-zoomd`, scrolls both ways and pinches; `Crop` `zoom`). The sheet bar keeps the paper's name first and "n of m marked" also on a phone (`questions-fixa.css`).
- **Mark scheme.** `MarkKey` is a collapsed key under Mark yourself in the words the bank's schemes use (maths: M, A, B, P, C, oe, ft, cao, isw, dep; sciences: allow, ignore, ecf, AO; essay subjects: levels). `SchemeText` is "Read the mark scheme as text" inside the scheme card (the scheme is what follows the question in `text.json`, cut at the question's end; where that cannot be told there is none and it says so). A short question whose opening words reach its marks is whole (no "only the start" note).
- **Small.** Each screen opens at the top and has its own tab title (Questions, What are you studying?, Pick questions); the "old set removed" note stays 7 s and a tap puts it away; the sheet's skip links follow the title; Home has "Skip to your papers"; the question strip is one tab stop with arrow keys; a multiple-choice part's writing space is 72 units, not 140 (`zoneHeight`); `answerHint(part)` gives the empty-space line for a table or diagram part; `rel="noopener noreferrer"` on the PDF link in `Crop`; the setup grid has no holes (a ticked subject is two tiles wide, tiles fill gaps) and the disabled "Show my papers" is 7:1.

## Setup as a stack of exercise books (setup designer; supersedes the setup's tile, chip and bar wording above)

**What it is.** "What are you studying?" is a desk: warm ruled paper under a lamp glow (red margin, a pendant lamp, stars, hearts and a mug in the margin), index tabs for the level (GCSE, A-Level, More; the open tab is raised and cream), and one exercise book per subject on a loose shelf (bottoms level, three heights, a small tilt and offset each). Ticking a book picks it up: it lifts, straightens, and a hand-drawn tick stamp lands on its corner. The mascot peeks over the page edge with a short hand-lettered bubble ("Pick up your books!"), which is the one line of copy.

**Logic is unchanged** (`mine.ts`: one board is chosen for them, a board already chosen at the level is carried; `Setup` props and `onDone(slugs, tiers)` are the same). What changed is how it is drawn and where the choices live:
- The exam board is written on the cover's label. Where a board is still open its choices hang from the cover in a kraft flap as luggage tags (only the boards the bank has for that subject and level); choosing one folds the flap away. Only one flap is out at a time; a tap anywhere else, Escape, or the label folds it. The flap sits on top of what is below it, so **ticking never moves anything** (every book has a fixed size; checked: slot boxes and page height are identical before and after a tick).
- The tier (Higher or Foundation, GCSE subjects that have two) is a quiet dashed sticker on the label ("Any tier" until they choose); one tap on the label opens the flap with the board tags and the tier stickers. It never opens by itself, so it never covers the books below.
- The bar at the foot is the pile: each picked-up book drops onto a small stack (five at most are drawn) with a count, a hand-lettered line (which books, or "Pick a board for Maths", naming the level only when the missing one is on another level) and the button. Waiting on a board, the button is `aria-disabled` (not `disabled`) and pressing it takes them to that book with its tags out (switching level if needed). On a phone the bar is one row ("Let's go", the line on up to two lines, to the left of the record player); the accessible name is always "Show my papers".

**Files.** `Setup.tsx` (state: draft, tier draft, level, which flap is out), `SetupBook.tsx` (one book), `SetupBar.tsx` (the pile bar), `BookArt.tsx` (all drawing decisions), `lib/studyapp/questions/setupBooks.ts` (pure: screen reader names, the pile, the bar's line, fallback tilt; tests in `setupBooks.test.ts`), `app/study/(app)/questions-setup.css` (the setup's CSS; it has been removed from `questions-home.css` and `questions-fixa.css`).

**To change the art** (the co-founder's final art): edit `BOOK_ART` in `BookArt.tsx` (per subject slug, `artSlug("Combined Science")` is `combined-science`: a `Doodle` component, a `cover` print, a `tape` style, a `binding`, a `tilt` in degrees, a `size` s, m or l), `DESK_ART` (the margin doodles; positions are `.qk-d-<id>` in the CSS), and `SETUP_ART` (the tick stamp, the mascot file and the bubble's words), plus the **EXERCISE BOOK ART** block at the top of `questions-setup.css` (cover prints `.qk-cover--*`, tapes `.qk-tape--*`, bindings `.qk-bind--*`, the paper, the stamp, the luggage tags, the pile). A subject with no entry gets a pencil-and-star doodle and a cover chosen from its name, the same every time. A doodle is a prop-less component on a 64 box in `currentColor` and `var(--qk-pop)`; it is sized by CSS, so a drawing of any size drops in. No raster art is used.

**Accessibility.** A book's button is named "Maths, not chosen", "Maths, AQA, chosen", "Maths, chosen, pick a board" (no `aria-pressed`; the state is in the name). The label is its own button ("Maths exam board AQA, any tier. Change", `aria-expanded`); the flap is a labelled group of `aria-pressed` tags, then a labelled group of tier stickers. Tab order is the tabs, then each book, its label, and its flap when out. Choosing a board returns focus to the book; Escape folds the flap and returns focus to the book. Everything pressed is 44px at least (the tags are 44px high buttons drawn 34px tall). The two-tone focus ring is the tab's. Reduced motion: books are still (no wiggle, lift or stamp motion; the tick still straightens the book, instantly). Forced colours: the paper, tapes and prints go; every book, plate, label, tag and tab gets a `CanvasText` border, a chosen book an outline in `Highlight` and its stamp, a chosen tab or tag `Highlight`; doodles sit on a white disc.

**Test ids kept:** `setup`, `tick-<Subject>`, `board-<slug>` and `tiers-<Subject>` / `tier-<Subject>-<Tier>` (in the flap, so present only while it is out: click the book's label, `label-<Subject>`, first), `board-fixed` (the single board of a subject with one), `setup-count` (the pile's count), `setup-done` (it is `aria-disabled`, so a script clicks it with `force` to test the waiting state), `setup-cancel`.

## The feed: the Questions tab as one list of questions (founder redirect, 3 November; feed builder)

**The front door is now a subject, not a paper.** `Home.tsx` shows the student's subjects as small notebook tabs (the same list as My subjects; **Change** and **+** go to the setup) and, for the subject chosen,
two views: **Questions** (the default: the feed) and **Papers** (the old shelf, one subject at a time). The subject and the view last used per subject are remembered (`feedStore.ts`, key `plumi-study-feed`, with the filters and
the reading position: losing it costs a filter, never an answer).

**The feed** (`Feed.tsx`) is the public question bank's page with a writing space under every picture. One continuous list of the subject's questions (the rows of `parts.json`, narrowed to the tier the student sits), no set to
start and nothing to finish:
- **Strip** (sticky under the app's bar): search (the words of every paper once typed, `useBankText`), how many questions there are, a quiet progress line ("128 of 2,666 marked", only once something is true to say; written
  is not marked, never a celebration), **Mix them up** (rounds of one question from each topic in a new order, seeded and remembered), **Practise these** (the first 60 of the list, in the order shown, as a set in the existing
  sheet; says so if there were more) and **Filters**.
- **Filters** (`FeedBar.tsx`, rules in `feed.ts`, the public page's semantics): question type (the marks a question is worth, `markBands`), paper and exam (several at once), year (a chip is all of that year's sittings),
  sort (newest, oldest, most marks, fewest marks, mixed up), calculator (allowed / not allowed where the bank sorts calculator papers, "only these / leave out" where it knows only which questions ask for one; absent where the bank says
  there is no choice), has a mark scheme, hide the ones I have marked (a snapshot, so a question does not vanish the moment it is marked), topics (areas with their topics in a long specification). They are open on a desk and folded on a phone
  until the student says otherwise. Saved ids the subject no longer has are dropped (`cleanFeedFilters`).
- **A question** (`FeedCard.tsx`): left margin (its number, "Q01.4", "June 2025 · Paper 1 Foundation", Not started / Written / Marked 2 of 3, marks, topic stickers that filter, **The whole paper**), the picture on a taped sheet
  (`Crop` with zoom, Read as text, "How question 3 starts" / "Question 3 so far" for a part that rests on a setup or on earlier parts), the **answer zone** (Write | Type, the pen tray), the **Mark scheme** pull-up with **Mark yourself**
  (`Check`, unchanged), and **Examiner's report** as a note on the right. On a narrow screen the margins fold above and below.
- **The whole paper** opens that paper in the existing sheet at this question (a paper already begun is picked up, `paperState`); Back returns to the feed at the question the student left.

**Data.** An answer belongs to its question: it is kept under the subject's **feed set**, one standing set per subject (`QSet.feed`, id `feed-<slug>`, `feedId`), that a question joins the first time the student writes on it, pulls up its
scheme or marks it (`feedTouch`, `addParts`; `qa.feedTouch`). Ink, typing, modes, marks, zone sizes, caps, recovery and "done lately" are all the sets' (nothing new to migrate; existing sets and papers are untouched). The feed set is never "the
set on the desk", is not one of the 40 sets the cap counts (and is never the one pushed out), is capped at `MAX_FEED_PARTS` (1,200 questions touched), and shows in **Your sets** as "<subject>, your feed" (Delete clears its answers and ink).
**Limit, stated:** a paper or set keeps its own answers. Work done in a paper shows in the feed as a quiet line on the question ("Marked 3 of 3 in June 2025 Paper 1") and counts in the subject's progress (`elsewhere`, `feedProgress`), but it is not
copied into the feed's writing space, and an answer written in the feed is not shown inside a paper (copying ink between sets was not cheap and would have made two places to edit one answer).

**The list** (`FeedList.tsx`, `virtual.ts`) is a measured virtual list on the page's own scroll: a few cards are in the DOM whatever the depth (about 470 to 700 nodes at 2,666 questions, against 7,000 for a 73-part paper); the rest are two
spacers whose heights are the measured heights (or `cardEstimate`, fitted to measured cards to within a few px). A height that changes above the reading line scrolls the page by the same amount in the same frame; the position
(question and how far into it) is reported after scrolling settles and before any press in the list, and the list opens exactly there. An item with the keyboard is never taken out. Native scroll anchoring is off for the list.

**Files:** `Home.tsx`, `Feed.tsx`, `FeedBar.tsx`, `FeedCard.tsx`, `FeedList.tsx`, `Check.tsx` (`useReport`, `ReportBody`, `reportOutside`), `useMatch.ts` (one list per query), `bankData.ts` (the early fetch), `questions/page.tsx` (starts the
subject's two files before the app has started), `questions-feed.css`; `lib/studyapp/questions/feed.ts`, `feedView.ts`, `feedStore.ts`, `virtual.ts`, and `model.ts` (`feedId`, `feedTouch`, `addParts`, `feedCounts`, `visibleSets`).

**Measured** (Chromium headless, dev server, AQA GCSE Physics and Maths; scripts in `scratchpad/qfix/feed`, shots in `scratchpad/qfix/shots-feed`): scrolling 200+ questions deep at 1280x800, 1180x820, 820x1180 and 390x844 gave no blank screen in 206 to 240 steps and at most 795 DOM nodes (470 at the first screen);
Home puts the list back at the top; a reload at depth, and a visit to a paper and back, return the same question within 0.4 px. Typing in a card: median 34 ms from input to the second frame at 4x CPU, the same as a bare textarea. Brisk scrolling (about 2,900 px/s):
no frame over 67 ms at 1x CPU; at 4x CPU in the dev build about 3 to 4 percent of frames pass 100 ms (a card being made: React's dev build and the ink canvas's layout effect). First question in the DOM at 4x CPU in dev: about 2.0 s after navigation,
about 0.15 s after the page's own shell (which is 1.8 to 2.4 s whatever the view; the paper shelf's first card is at about 2.6 s). The 1.5 s target is not met in dev; the subject's two files are asked for before the app starts to take about 0.3 s off, and a production build was not measured.

**Round 4 (feed agent).** Filters start folded everywhere (a question is the first screen; Skip to the questions link); the phone strip is one slim row (search, Filters, count and the question under the reading line, "Q12 · 3 marks"), Mix them up and Practise (the first 60) are inside the Filters card there. A question joins the feed set only at its first real write (`registerFeedPart` in store.ts: typing, a pen or mouse stroke, a mode tab, scheme, mark; never a finger that scrolls); a full feed (all 1,200 hold something; empty touched ones are evicted first) says so on the card before any writing. A card shows the best state across the feed and papers and a quiet "You also wrote this in ... See it" line; a paper part says "Also written in your feed. See it". Rotation keeps the question at the reading line by its fraction (`FeedList`). The subject prefetch is a module-level start in `bankData.ts` (no script tag). `feedStore` merges two tabs' changes. Wording: Mix them up everywhere, Choose questions, Back, "parts marked" in marking lines, mark scheme before Mark yourself, tier chips in the filters.

**Round 5 (feed agent).** Tabs wrap in one flow (nine or ten subjects, at most two rows on a desk); on a phone one subject button and the Questions | Papers switch share a row and a bottom sheet lists the subjects (Add, Change, Your sets). The ground (cream, ruled lines, hairline red margin) is one `position: fixed` layer on `.qf-ground` (Home, Picker "Build a set"), the list is transparent. The magnifier has a row of its own under each picture. The other copy of an answer (paper, set or feed) shows read only and faded in an empty box with See it and Continue here (`qa.continueHere`, `copyInk` in inkDb.ts: copied only on the student's tap). A paper opened from the feed lands on the part (`setOpenPart`). The first canvas gate reads the LAST observer entry; a finger on the grip scrolls; closed mark schemes stay closed; Try again really restarts a stalled load and a stalled report. Scripts: `scratchpad/qfix/r5-fix` (tabs, lens, lens-sheet, ground, focus, other, misc).
