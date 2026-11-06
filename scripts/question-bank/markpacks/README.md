# Mark packs

A **mark pack** is one bank part's official mark scheme as data, read offline from the part's question and scheme *images*
and checked by deterministic gates. It is what AI marking on the web will be built on. **Nothing here is used by the
website yet**; this folder is build-time tooling and tests.

Why: the bank holds questions and schemes as pictures. `k` is only a multiple-choice letter; `text.json` is one lossy OCR
string with no boundary between question and scheme (`src/lib/studyapp/questions/partText.ts`). An AI marker needs the scheme
as data, and a visible question must only be marked against the scheme read from its **own** crops.

```
question + scheme images --(model transcribes)--> reading --(gates)--> ready | held | rejected --(a person)--> published
```

The model transcribes; code decides. `gatePack` (markpack.ts) refuses a reading that contradicts the bank (question or scheme
label, marks printed, scheme total, point marks), contradicts itself, or contains words the page's own OCR does not; it holds
(does not refuse) parts that are correct but not for the text marker: a figure or table is needed, the scheme is numeric,
a tick, or levels, or the reading flagged its own doubt. `packHash` changes if the reading or either picture changes, so a
re-cut bank invalidates its packs.

## Files

| File | What |
|---|---|
| `extraction_prompt.txt` | The system prompt (v2). The single source: `extract.py` reads it. |
| `markpack.ts` | The reading's type, defensive parser, gates, `packHash`. |
| `markpack.test.ts` | 49 tests: the 20 real readings pinned, crafted bad readings per gate, malformed JSON. `npm run markpacks:test` |
| `check.ts` | Runs the gates over a folder of readings and prints a table. |
| `extract.py` | Reads parts' images with DeepSeek (costs money, has a `--cap`). |
| `fixtures/pilot-v2/` | The 20 pilot readings, the bank rows and the OCR text they were checked against (small excerpts of AQA mark schemes, test data only). |

## The pilot (6 Nov 2026): AQA A-level Biology 7402, 20 parts

Parts: 1 to 3 marks, own scheme crop, no stem or multiple choice (785 of the bank's 1,702 parts qualify), stratified by marks and series.
Cost, **measured**: 41 calls in total (one smoke, two full runs of 20), **$0.026**; each reading used 1,100 to 2,230 input tokens
(two images and the prompt), 150 to 476 output tokens, about 2 seconds, $0.0004 to $0.0009.

Result of the gates on the final prompt: **11 ready, 9 held, 0 rejected.** The 9 held: 7 need a figure or table, 2 more are numeric (one an
"award 1 mark for any of these partial answers" layout the format cannot yet express).

What I found checking those 3 images against the readings: prompt v1 lost which mark point a comment belonged to
("1. Reject ...", "2. Reject ...") and merged "ignore X but reject Y" into one item. Prompt v2 fixed both on the part where it showed.
All 42 accept, reject and ignore items across the 20 readings occur in the page's own OCR (nothing invented).

**What this does NOT show:**
- I compared only **3 of the 11 ready readings** (and 1 held one) against the scheme images; I read several others as text but did
  not check them against their images, and the rest only passed the gates. The checker was me, not a teacher or an examiner.
  Fidelity is **not** established; this is a feasibility signal on 20 parts of one board.
- Nothing about marking accuracy: no student answer was marked.
- The OCR cross-check proves words are on the page, not that they are attached to the right mark point.
- 20 parts of a 1,702-part bank, chosen at random within a filter.

## Next

1. A teacher or tutor checks all 11 ready readings and the 9 held ones against the images (about 3 minutes each): the first real fidelity number.
2. Widen to ~100 parts (about $0.06) once v2 is accepted; add the "graded alternatives" shape (the numeric partial-credit layout) and a deterministic numeric path.
3. `published` status, storage (private, content-hashed), and the marking function that reads packs: see the web marking plan.
