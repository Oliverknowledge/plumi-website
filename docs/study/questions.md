# Questions: pick from the bank, write under each part

The fourth place in the study app: **Desk | Study | Questions | Flashcards**, at `/study/questions` (`study.tryplumi.app/questions`).
A student picks past-paper parts from the question bank, then works through them on a lofi sheet, writing the answer
directly under each part (a pen, a mouse, a finger, or the keyboard), checks the mark scheme and marks themselves.
Behind the same sign-in gate as the rest. **There is no AI marking in this version.**

## What is on screen

| Step | What | Code |
|---|---|---|
| Subject | Level, board, tile (every bank subject, about 120). The last choice and its topics are remembered | `SubjectChooser.tsx` |
| Pick | Search first, one **Filters** sheet (topics, paper, series, marks, mark scheme), a rail of topic chips (areas in a long spec), **Mix for me** (the picks are shown as "your mix" with 5 / 10 / 15 and Shuffle). Rows: tick, thumbnail, "Q2.3, 2 marks", topic and paper, one opening line, "Whole question" (key A or Shift+Enter). The Start bar appears only when something is picked. Up to 60 parts a set | `Picker.tsx`, `ResultList.tsx` |
| Sheet | Cream paper on a wooden desk. Per question: the setup picture (if any), then each part's picture with its answer zone, **Check**, and margin mark under it; "(Total for Question 1 is 5 marks)" at the foot. Quiet progress bar, pen tray, Page settings | `Sheet.tsx` |
| Answer zone | **Write** (ink) or **Type**, switchable per part, remembered, both can hold content (a dot on the tab shows which does). Height: 90 units a mark, at least 140; "More space" or drag the grip | `AnswerZone.tsx` |
| Check | Opens the mark scheme picture (or the answer letter of a multiple-choice part, or the PDF link where no crop exists), the examiner's report if there is one, and **Mark yourself**: one tick circle per mark. The mark is written in the margin in a green hand (amber if partial, red if none). Nothing is ever awarded for the student | `Check.tsx` |
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
(a few hundred KB); filtering is a pass over the array per change. The list is **windowed**: fixed 100 px rows, only the rows in
view plus six either side exist in the DOM (`windowOf`), scrolling with the page (no nested scroller, which is poor on an iPad).
It is a listbox (arrows, Page Up/Down, Home/End, Space/Enter to tick). Thumbnails are the full crop clipped to 124 x 76 px at a third of its size, lazy loaded.
Text search folds 1 MB of paper text once, in slices of 400, after the first keystroke.

**Mix for me** (`mix`): from what the filters leave, n parts spread across the chosen topics (round robin), skipping parts done
lately (`recent`, newest 500) while others remain, from different questions while others remain, parts with no marks only if there
is nothing else; seeded so it is testable. It fills the tick list; **Start** makes the set.

## Storage (device only)

| What | Where | Why |
|---|---|---|
| Sets (the chosen parts with what the sheet needs: no refetch of the subject), typed answers, modes, zone sizes, self-marks, "done lately", the open set, last subject and topics, tool and page preferences | **`localStorage["plumi-study-questions"]`** as `{ v: 1, q }` (`questions/persist.ts`, `questions/store.ts`). Moved out of `plumi-study-app` (see "Sheet, data and accessibility" below) | Its own key: not re-serialised with the Desk and flashcards on every stroke, not sharing their quota, and an old tab re-saving `plumi-study-app` can no longer wipe it. Sanitised on load (`sanitiseQuestions`) |
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
that was at the top (`at`, written 600 ms after it changes; restored with three retries while pictures settle). The picker also
shows "Pick up" for an unfinished set. **Back** (Questions, top left) returns to the picker without closing the set.

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

Listbox with `aria-activedescendant`, `aria-multiselectable` and a live count; every control a button or a native input with a name; 44 px touch targets
(the tray, tick circles, mode tabs); the ink surface is `role="img"` with a name that says to choose **Type** for the keyboard, and **Type** is one tap on every zone;
tick circles are a `radiogroup`; the grip is a keyboard-operable separator (arrow keys); dialogs are `<dialog>`; `prefers-reduced-motion` stills the loading shimmer
(and the app's global rule stops the rest).

## Tests

`npm run app:test` includes `src/lib/studyapp/questions/*.test.ts` (65 tests): stroke simplification, encode and decode round trip, storage cleaning,
eraser hit tests, undo and redo; picker filters, search, order, mix (spread, recent, seeded), window; sets, grouping, self-mark totals and clamps, redo set,
summary, caps, the sanitiser, the document round trip; routing for `/questions`; picture addresses equal the bank's. Browser scripts used for this work
(Playwright, real crops from R2) are not in the repo: they drove picking, writing with a synthetic pen, erasing, undo, reload, typing, check, self-mark, finish, redo,
resume, touch behaviour, at 1280 x 800, 1024 x 768, 820 x 1180 and 390 x 844.

## Not built, and why

- **AI marking.** "Re-mark" is a disabled button. Marking handwriting needs a decision: cost per mark, DeepSeek consent in the privacy policy (the
  Supabase `ai` edge function), a vision model for handwriting (a text model cannot read the PNG), and what a student is told when the model is unsure.
  `getAnswerImage` and `getAnswerText` are ready for it; the truthful-assessment rule (never award what was not done) applies.
- **Handwriting to text on the web.** Same decision, plus accuracy on maths notation.
- **Sync across devices.** Everything is on this device. Signing in does not move it.
- Highlighter, shapes, lasso, text boxes on the ink; zoom and pan inside an answer zone (the page zooms with two fingers over the zone too, and the canvas is re-rastered for the new zoom, up to 3x; a real pinch is not verified on a device);
  undo that survives a reload; a search over mark scheme text only; the bank's tier and option filters (Higher or Foundation is the paper filter); the
  worked solutions the bank page has; audio for listening questions; the insert (sources) for English Language; "Show question so far" for a single later part
  (the setup is shown, earlier parts are not).
- The crops include the paper's own printed answer lines, so a part shows those and then the zone under it.

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
Each question carries `--qh` (`estimateBlock`) for `content-visibility: auto`.


## Picker, chooser and the tab's CSS (fix round 1, picker fixer)

- **Layout.** One column (max 960px): title, the subject as a quiet "AQA GCSE Physics v" button, search + Filters + Mix for me, a chip rail, then flat rows. The Filters dialog is a native `<dialog>` (Escape closes, focus returns to the button; a bottom sheet under 640px); the list behind it updates as you choose and its button reads "Show N questions". An area of a long specification is one tap (tri-state, `toggleArea`).
- **Mix** replaces the list with the picked questions ("your mix"), so they can be seen and swapped; changing a filter or typing leaves the mix view. The Start bar says "about N min" (`minutesFor`, about a minute a mark).
- **List semantics.** `aria-setsize` / `aria-posinset` on options, the active row is always in the DOM (`aria-activedescendant` never dangles), the count is a live region, "Skip to the questions" link, no button inside an option (the "Whole question" tap target is a span, the keyboard does it with A).
- **Chooser.** GCSE and A-Level first, other levels under More, a board rail only when there is a choice, tiles grouped by board, every subject tinted (`--t-*`), Maths / Biology / Chemistry / Physics first. The last level and board are remembered (localStorage key `plumi-qs-chooser`, per-visitor, optional).
- **Bad data.** `parts.json`, `text.json` and the subject file are validated on arrival (`cleanRows`, `cleanText`, `cleanMeta`): anything malformed reads as "did not load" with Try again (a retry shows the skeleton), never a crash. Slow (over 8 s) says so with Try again. `text.json` failing says "searching titles only" with Try again after one quiet retry. `questions/error.tsx` catches anything else: "Try again" clears the saved subject and closes the open set (kept in Your sets), nothing is deleted. Note: this Next version passes `retry` (not `reset`) to error.tsx.
- **CSS.** `questions.css` (picker, chooser, dialogs, desk, shared), `questions-ink.css` (pen, zone, tray), `questions-sheet.css` (sheet parts) load in that order from `questions/page.tsx`. Type scale: Pixelify 38 / 22 / 16, Nunito 800 15 / 13 / 12, Caveat 25 / 44 / 76. One focus ring on this tab (navy 3px over a white 5px halo). Forced colours: the paper and crops stay white, every selected state gets an outline. Short screens (max-height 520px, 400% zoom): sticky bars become static. `html:has(.pa)` is `color-scheme: light` (no dark scrollbar).
- **content-visibility on `.qs-q`** is written but off: it applies only under `.qs-desk.is-settled`, which nothing sets. Turned on from the start it made a reopened set land about 4,900px from the right question (270px, correct, with it off), because the restore scrolls before the questions above are laid out.
