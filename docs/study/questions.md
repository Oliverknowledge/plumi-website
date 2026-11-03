# Questions: pick from the bank, write under each part

The fourth place in the study app: **Desk | Study | Questions | Flashcards**, at `/study/questions` (`study.tryplumi.app/questions`).
A student picks past-paper parts from the question bank, then works through them on a lofi sheet, writing the answer
directly under each part (a pen, a mouse, a finger, or the keyboard), checks the mark scheme and marks themselves.
Behind the same sign-in gate as the rest. **There is no AI marking in this version.**

## What is on screen

| Step | What | Code |
|---|---|---|
| Subject | Level, board, tile (every bank subject, about 120). The last choice and its topics are remembered | `SubjectChooser.tsx` |
| Pick | Topic chips by area, search, paper, series, marks band, "Has a mark scheme", "Mix for me" 5 / 10 / 15. Rows have a tick box, the question's top as a thumbnail, marks, topic, and "+ all N" for the rest of the question. Up to 60 parts a set | `Picker.tsx`, `ResultList.tsx` |
| Sheet | Cream paper on a wooden desk. Per question: the setup picture (if any), then each part's picture with its answer zone, **Check**, and margin mark under it; "(Total for Question 1 is 5 marks)" at the foot. Quiet progress bar, pen tray, Page settings | `Sheet.tsx` |
| Answer zone | **Write** (ink) or **Type**, switchable per part, remembered, both can hold content (a dot on the tab shows which does). Height: 90 units a mark, at least 140; "More space" or drag the grip | `AnswerZone.tsx` |
| Check | Opens the mark scheme picture (or the answer letter of a multiple-choice part, or the PDF link where no crop exists), the examiner's report if there is one, and **Mark yourself**: one tick circle per mark. The mark is written in the margin in a green hand (amber if partial, red if none). Nothing is ever awarded for the student | `Check.tsx` |
| Re-mark | Shown as on the reference sheet, **switched off**: "AI marking is coming soon". No model is called | `Sheet.tsx` |
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
| Sets (the chosen parts with what the sheet needs: no refetch of the subject), typed answers, modes, zone sizes, self-marks, "done lately", the open set, last subject and topics, tool and page preferences | `AppData.questions` in `localStorage["plumi-study-app"]` (`questions/model.ts`) | One versioned document like the Desk and Flashcards. **Additive**: `v` stays 1; a save without it reads as empty; sanitised on load (`sanitiseQuestions`) |
| **Ink** | **IndexedDB** `plumi-study-ink`, store `ink`, key `<setId>/<partId>`, value `{ v: 1, ink: Stroke[], at }` (`inkDb.ts`) | localStorage is about 5 MB for the whole origin, shared with the rest of the app, and re-serialised whole on every change; a set of twelve parts of working reaches megabytes. The document only keeps `ink: { n strokes, b bytes }` per answer so the sheet can show what has ink without waiting for IndexedDB |

Caps (all enforced on write and again on load): 40 sets (a finished one goes first, then the oldest; its answers and ink go with it),
60 parts a set, **12,000 typed characters a part and 700,000 in all**, **400 KB of ink a part and 20 MB in all**, 500 recent parts.
At 90% of the ink total the sheet shows "Your device is nearly full of handwriting. Clear old sets" (**Your sets** lists every set with its
size and a Delete). A stroke that would pass a cap is refused, and the zone says it is full and offers Type.

Writes: ink is saved 300 ms after each stroke ends and flushed on `pagehide` and `visibilitychange`; typing 250 ms after the last key and on blur.
If IndexedDB is missing or refuses (some private windows), ink is kept in memory for the visit and never shows an error.

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
Stroke = { c: colour 0..2 (ink black, blue, green), w: width 0..2 (fine, medium, bold), sp?: 1 (pressure was simulated), d: number[] }
d      = [x0, y0, p0, dx, dy, dp, ...]   whole numbers: x and y in tenths of a unit, pressure 0..100, every point after the first a delta
```
A stroke is simplified (Ramer-Douglas-Peucker over x, y and pressure, 0.45 unit) before it is encoded: about 1 KB for a word. Rendering
is `perfect-freehand`'s outline filled on a canvas at devicePixelRatio (up to 3), committed strokes cached on an offscreen canvas so a
long answer stays smooth. Undo and redo are whole-state (an `Ink` is immutable): one step per stroke, per erase, per clear; in memory only (gone on reload).
Eraser: touches by tap or scrub remove whole strokes (`strokesAt`); the pen's eraser end erases too.

**`getAnswerImage(partId, { setId?, scale?, paper?, crop? })`** (`answerImage.ts`) returns a PNG data URL of the ink on plain white, drawn
from the stored strokes (so clean at any screen density), or null if there is none; `getAnswerText(partId)` the typed answer. Nothing
calls them yet. They are the hand-off for AI marking.

## Pen and finger (what is built, what is verified)

The surface (`InkCanvas.tsx`) reads `pointerType`:

- **Mouse** draws. **Pen** draws with real pressure (`pressure`; if every point has the same pressure, which some Android styluses do, the
  stroke is stored as simulated). The pen's **eraser end** (`buttons & 32` or `button === 5`) erases.
- **Touch**, with "Finger scrolls, pen writes" ON (the default where the primary pointer is coarse; switch in **Page**): a finger never draws.
  While no pen has been seen the surface says `touch-action: pan-y pinch-zoom`, so the browser scrolls the page natively with momentum. The moment
  a pen is seen (any pen `pointerover` / `pointerdown` on the page, a `touchstart` whose Safari `touchType` is `stylus`, or a `pointercancel` of a pen touch the browser took
  for a scroll) it says `touch-action: none`, remembered on the device (`prefs.penSeen`), and the finger's scroll is done by hand (`window.scrollBy`
  with a little inertia). That is because the spec applies `touch-action` to pen as well as touch, and a pen stroke must never be taken for a pan. A stylus `touchstart` is also
  `preventDefault`ed where the browser lets us (Safari).
- A first finger tap in this mode shows "Fingers scroll the page. Write with a pen." with **Draw with my finger**.
- **Finger draws** (toggle off): `touch-action: none`, touch draws. **Palm rejection**: a touch is ignored within 0.8 s of any pen event, while a pen is down, and when its contact patch is wider than 34 px.
- On a phone (viewport under 640 px) each zone starts in **Type**; ink works but small (the sheet scales to the width).

**Verified here (Chromium, emulated touch device 820 x 1180, CDP touch events and synthetic `PointerEvent`s with `pointerType: "pen"` and pressure):**
a finger swipe on the canvas scrolls the page and draws nothing; `touch-action` is `pan-y pinch-zoom` before a pen and `none` after; a pen draws; the
finger still scrolls by hand after a pen; with the toggle off a finger draws; a touch right after a pen stroke is rejected; the eraser end (`buttons: 32`) erases;
ink survives reload (IndexedDB), undo and redo.

**Not verified (no real hardware):** a real Apple Pencil on iPad Safari (that Safari reports `pointerType: "pen"`, delivers `pressure` as expected, that
`touchType === "stylus"` is present and cancelable so the page does not scroll under the first stroke, that Pencil hover events arrive on M2 iPads, how Scribble or the
Pencil double tap interact), Android Chrome with a stylus (whether a pen drag under `pan-y` pans before we see it; the `pointercancel` fallback covers
the first stroke only), palm contact sizes (`width`/`height` of a real palm; Safari does not report them), momentum feel of the hand-made finger scroll.
The first real iPad session should check: first Pencil stroke on a fresh page does not scroll it; finger scroll after that; eraser end; undo.

## Keys (desktop)

**N** next question, **B** back, **P** pen, **E** eraser, **Z** undo, **Shift Z** redo (not while typing). In the ink surface **Ctrl or Cmd Z** (Shift for redo). In the list: arrows, Page Up/Down, Home, End, Space or Enter.

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
- Highlighter, shapes, lasso, text boxes on the ink; zoom and pan inside an answer zone (the page zooms, the ink is vector so stays sharp);
  undo that survives a reload; a search over mark scheme text only; the bank's tier and option filters (Higher or Foundation is the paper filter); the
  worked solutions the bank page has; audio for listening questions; the insert (sources) for English Language; "Show question so far" for a single later part
  (the setup is shown, earlier parts are not).
- The crops include the paper's own printed answer lines, so a part shows those and then the zone under it.
