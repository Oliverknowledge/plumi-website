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

## Round results across the most-visited subjects (7 Nov 2026)

Subjects chosen from the site's own analytics (Vercel: top question-bank pages): AQA A-level Biology, Edexcel A-level Maths, AQA A-level
Chemistry, AQA GCSE Biology, OCR A-level Chemistry A, Edexcel GCSE Maths, AQA A-level Psychology, AQA GCSE Chemistry. 20 new parts each
(a stratified sample of 1 to 3 mark parts; 1 to 4 for maths), read with prompt v3, then checked twice: the deterministic gates, a model critic
(`critic.py`, calibrated: no false alarms on 11 confirmed readings, caught 6 of 7 deliberate corruptions) and six Claude reviewers that looked at
the actual pictures. Cost, measured: about $0.0008 per reading, $0.12 for the 160, $0.024 for the model critic.

| Subject | gates: ready / held / rejected | both critics clean | contested | blocked |
|---|---|---|---|---|
| AQA A-level Biology | 11 / 8 / 1 | 9 | 2 | 0 |
| AQA A-level Chemistry | 11 / 7 / 2 | 8 | 3 | 0 |
| OCR A-level Chemistry A | 9 / 7 / 4 | 7 | 2 | 0 |
| AQA A-level Psychology | 6 / 11 / 3 | 6 | 0 | 0 |
| AQA GCSE Biology | 8 / 12 / 0 | 6 | 1 | 1 |
| AQA GCSE Chemistry | 5 / 15 / 0 | 2 | 2 | 1 |
| Edexcel A-level Maths | 3 / 1 / 16 | 1 | 1 (+1 flagged by both) | 0 |
| Edexcel GCSE Maths | 1 / 14 / 5 | 0 | 0 (+1 flagged by both) | 0 |

**Maths is not ready, for structural reasons, not tuning:** the bank's unit for Edexcel maths is a whole multi-part question (the pack format
has one label and one mark total), the bank's page text for maths is garbled symbols so the "words must be on the page" check cannot
validate it, the readers misread a symbol ("= 2/7" read as "-2/7") and a text marker cannot mark method, accuracy and carried-forward marks.
Held back on purpose.

Build rounds that changed something (each re-checked against the 20 pilot parts a person had confirmed): stem pictures so GCSE sciences and OCR
are readable at all (19 of 1,505 AQA GCSE Biology parts qualified without them, 1,336 with); a label check that accepts a part the paper prints
as just "(ii)" (OCR Chemistry 2 -> 9 ready); leading zeros in labels; formulas split by the bank's OCR; "marks never null"; reject items without
quotation marks; an "OR means one point" rule (the gate refused an unstable representation: fail closed); question-wide comments get `point: null`
and "allow ..." comments go in the accept list. One rule (splitting alternatives on OR) made things worse and was removed.

Known limits: readings vary between runs (a figure flag flipped on one pilot pack), so a pack should eventually need two agreeing reads; one
question-wide "ignore" note is still scoped to the wrong point on one GCSE Biology pack; the two critics disagree on 11 packs, which a person
should look at (the review page does that); the critics are the same model family (DeepSeek) or the author's own family (Claude), not examiners.
