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

## Two Claude readers instead of one DeepSeek reader (7 Nov 2026)

Why: no DeepSeek spend, and no person reviewing each pack. Two independent Claude agents each transcribe a part from its images
(`extraction_prompt_v4.txt`, which keeps "issues" for real doubt only). `verify_pair.ts` then decides: a part is **agreed** only if both
readings pass `gatePack` AND `consensus.ts` finds them identical on everything that decides a mark (points, marks, totals, caps, kind,
accept / reject / ignore items). Everything else is held and never goes to a person. **Agreement is not correctness**: two readers can
misread a page the same way.

| Batch | Parts | Agreed | Held (both agree: figure, tick, numeric) | Rejected by the OCR gate (both readers) | Readers disagree |
|---|---|---|---|---|---|
| 1: AQA A-level Biology, parts DeepSeek read as ready (v3.6 prompt, old gate) | 12 | not run through `verify_pair` | | | |
| 2: six subjects, random | 60 | 11 | 29 | 7 | 13 |

Batch 1 was tried with the v3.6 prompt: both readers matched the DeepSeek reading on every point, mark and total in all 12; they differed only on
where unnumbered comments apply and on how much of an "eg" list to keep.

Batch 2 was NOT representative for Biology: the 8 Biology parts left over were all figure parts. Of the 31 parts the text marker could take
(not held for a figure, tick or number), 11 were agreed, 13 had readers disagree and 7 were rejected by the OCR check. What the misses are:
- 7 rejected on BOTH readers: the bank's OCR text lacks words the page shows (chemical formulas, symbols, cut lines). The fix is a better text source (the board PDF text layer), not a looser gate.
- 13 disagreements (categories overlap, counted by hand): a figure or table flag set by one reader only (4), a different answer kind (3), a different split of the same scheme (4, for example "any one from a, b, c" as one point or as three points with a cap of one: the same marks written differently, which `consensus.ts` does not yet treat as equal), and a wording or scope difference in an accept item (3).
- A third reading (the existing DeepSeek one) agrees with one of the two readers on only 5 of the 13, so it would not rescue most of them.

Cost: 0 DeepSeek calls. 16 Claude reader runs (about 120,000 tokens each).

### Round 2: board text layer, "same marks written differently", drawing rule (7 Nov 2026)

`pdf_text.py` takes the scheme's words from the board's own PDF text layer (the whole-paper PDFs are already on the bank's bucket) instead of the
bank's lossy OCR, so the word check is stricter and exact. It located the scheme rows for 51 of the 60 parts (the other 9 were figure parts, not tried).
`consensus.ts` now treats "any one from a, b, c" as one point or as three points with a cap of one as the same scheme. The v4 prompt now tells a
reader not to describe a drawing (skeletal formula, diagram): copy the printed words, set needs_figure_or_table. The 19 parts that were not agreed
or held were read again by two fresh Claude readers who also got the text layer.

Same 60 parts, final: **17 agreed, 37 held (figure, tick, number, levels or doubt), 4 rejected, 2 readers disagree.** Of the 23 that were not held, 17 agreed.
Honest limits: this is one sample of 60 across six subjects (Biology was figure-heavy); the 5 re-read parts were given the text layer, so their
wording is not fully independent; part of the rise in "held" is the prompt now sending drawing answers to held, which is correct, not a better
reading; 2 of the 4 rejected still fail the word check and are not explained yet (`74042-nov20-08-2`, `84622f-spec-09-2`); the two readers can still
misread a page the same way. Cost: 0 DeepSeek calls, 4 more reader runs of about 120,000 tokens.
