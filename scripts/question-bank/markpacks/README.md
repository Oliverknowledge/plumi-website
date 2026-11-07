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

### Round 3: AQA A-level Biology, 60 parts (7 Nov 2026)

`fetch_batch.py` picks and downloads the parts (`--text-only` drops parts whose question words suggest a figure, table, drawing, tick-box or
calculation). **That filter makes this sample easier than the whole bank**: 929 of 1,469 one-to-three-mark parts pass it. 60 parts, two fresh
Claude readers each, with the board text layer.

First pass: **31 of 60 rejected by the word check, on both readers.** The cause was my segment finder, not the readers: in AQA's tall table rows the
text layer prints the question number in the middle of the row, so a scheme's words sit ABOVE the label line and the segment (which began at the
label) missed them. `pdf_text.py` now starts just after the previous part's label line and ends at the next one, using every part of the paper from
the bank's rows (`pdf_text_test.py`, one mutation caught). Known looseness: the segment also contains a neighbouring part's words, so the word
check proves "these words are on this page, near this row", not "in this row".

After the fix, same 60 readings: **32 agreed, 18 held (figure, tick, number, levels or doubt), 10 readers disagree, 0 rejected.** Of the 42 not held,
32 agreed (76%). The 10: six differ in an accept item (one reader kept the "for X" substitution words or a longer phrase), two in how the points
are worded, one in the answer kind and figure flag, one in the figure flag alone. Rounds 1 and 2 above were measured with the earlier,
stricter segment finder and were not re-run.
Cost: 0 DeepSeek calls, 8 reader runs of about 150,000 tokens each (about 10,000 tokens per part per reader, up from 8,000 because the
readers also read the text file).

### Publishing agreed packs (7 Nov 2026)

`publish_packs.ts <slug> <agreedDir> <out.sql>` turns agreed packs into SQL for the private pack store (migration 0130 in the app repo,
`mark_pack_publish`). It hashes each reading together with the exact bytes of the question and scheme pictures and the bank's cropVersion, and
writes a `.sql` file; it applies nothing. The SQL is board material and stays out of git. 52 agreed packs were generated across six subjects
(Biology 35, A-level Chemistry 4, A-level Psychology 4, GCSE Biology 3, GCSE Chemistry 3, OCR Chemistry A 3) and applied to a throwaway local
Postgres only: all 52 stored, twice, with no error.

## Wave 1: the ten busiest banks, parts students actually attempted (7 Nov 2026)

Scope (chosen with the founder): Chemistry, Biology, Physics and Combined Science, UK GCSE and A-level, the 10 banks students have marked most (real marks in
`bank_attempt`): AQA GCSE Chemistry, OCR A-level Biology A, AQA A-level Chemistry, OCR A-level Chemistry A, AQA A-level Biology, AQA GCSE Biology, OCR GCSE Biology A,
OCR A-level Physics A, OCR GCSE Physics A, AQA GCSE Combined Science. Wave 1 is the 1,589 parts in those banks that students have attempted AND the pipeline can
read (1 to 3 marks, own scheme, no multiple choice, no figure/table/drawing/tick words) AND that were not packed yet. `prepare_wave.py` cuts them into batches of 60;
`wave_step.py` runs the per-batch routine; `READER.md` / `AUDITOR.md` (in the wave folder) are the two agents' instructions.

The routine for every batch, with the rules enforced in `wave_step.py`:
1. Two independent Claude readers (outA, outB), four chunks of 15 each; `verify_pair.ts` keeps a part only if both pass the gates AND agree on everything that decides a mark.
2. An independent Claude auditor checks a seeded sample of 12 agreed packs against the board's own scheme image (it did not write them).
3. Nothing is loaded unless the audit is clean. If ANY audited pack has a problem, every other agreed pack in the batch is audited too, and only packs audited clean individually are loaded.
4. A pack with an audit problem is never loaded. Loaded packs are applied to the live store with `mark_pack_publish` (idempotent); a live pack can be withdrawn with `mark_pack_withdraw`.

| Bank / batch | parts | agreed | audit | loaded |
|---|---|---|---|---|
| AQA GCSE Chemistry b01 | 60 | 46 | 12 of 12 clean | 46 |
| AQA GCSE Chemistry b02 | 60 | 41 | 12 of 12 clean | 41 |
| AQA GCSE Chemistry b03 | 60 | 49 | 12 of 12 clean | 49 |
| AQA GCSE Chemistry b04 | 53 | 37 | sample found 1 defect; all 37 audited, all clean | 37 |
| AQA A-level Chemistry b01 | 60 | 37 | sample found 1 minor; all 37 audited: 35 clean, 2 minor | 35 |
| AQA A-level Chemistry b02 | 60 | 21 | sample found 4 of 12 (1 marking); all 21 audited | 16 |
| AQA A-level Biology b01 | 60 | 38 | 12 of 12 clean | 38 |
| AQA GCSE Biology b01 | 60 | 49 | 12 of 12 clean | 49 |
| AQA A-level Biology b02 | 60 | 33 | sample found 2 of 12 (1 marking); all 33 audited | 31 |
| AQA GCSE Biology b02 | 60 | 33 | sample found 2 of 12 (2 marking); all 33 audited | 28 |
| AQA A-level Biology b03 | 60 | 32 | 12 of 12 clean; all 32 audited, 1 minor | 31 |
| AQA GCSE Biology b03 | 60 | 34 | 12 of 12 clean; all 34 audited, 1 marking | 33 |
| AQA A-level Chemistry b03 | 60 | 16 | 12 of 12 clean; all 16 audited, all clean | 16 |
| AQA GCSE Combined Science b01 | 60 | 43 | 12 of 12 clean; all 43 audited, all clean | 43 |
| AQA A-level Biology b04 | 7 | 2 | all 2 audited, clean | 2 |
| AQA GCSE Biology b04 | 7 | 5 | all 5 audited, 1 minor | 4 |
| AQA GCSE Combined Science b02 | 13 | 8 | all 8 audited, 1 marking | 7 |
| OCR A-level Biology A b01 (first read, before the text-layer fix) | 60 | 22 | sample found 4 of 12 (1 marking) | 0 (paused) |
| OCR A-level Biology A b01 (same readings, after the fix) | 60 | 30 | 1 of 12 in the sample; all 30 audited: 9 problems (2 marking, 7 minor) | 21 |
| OCR A-level Chemistry A b01 | 60 | 21 | sample found 2 of 12; all 21 audited | 20 |
| OCR GCSE Biology A b01 | 60 | 21 | sample found 1 of 12; all 21 audited | 20 |

Live after the AQA batches: 558 packs (AQA GCSE Chemistry 176, A-level Biology 137, GCSE Biology 117, A-level Chemistry 71, GCSE Combined Science 50, A-level
Psychology 4, OCR A-level Chemistry A 3). Even when a 12-pack sample was clean, every remaining agreed pack was audited before loading (the earlier batches had defects
outside the sample). The recurring defect class in the audits: a scheme's single "allow A / B" note stored as separate bare accepts (so a half-phrase could earn the
mark), or a condition ("if neither given", "1 mark for ...") stored as an unconditional accept. Both are caught by the audit; there is no deterministic gate for them yet.

Cost, measured: about 18,000 tokens per part for the two readers, plus about 9,000 per audited part. Claude Haiku as a reader was tested on the 60-part Biology benchmark:
same tokens per part (22,664), fewer agreed (22 against 32), and 3 of its 22 "agreed" packs were not confirmed by the Claude readers: not used.

What the audits found (each is now a rule or a limit, not a surprise):
- **Mark allocation in a comment** ("allow for 1 mark ... or ...", "max 1 out of M2 and M3"): a text marker cannot enforce it. `gatePack` now HOLDS any pack whose accept /
  reject / ignore / guidance text allocates marks (`MARK_ALLOCATION`, `markpack.test.ts`). The same pattern was found in 2 live packs, which were withdrawn
  (AQA A-level Chemistry `chem1-jan13-03-b`, AQA A-level Biology `74012-jun18-06-1`).
- **Guidance attached to the whole question instead of one mark point** (OCR layouts, some AQA A-level): over-credit risk. Not yet a gate: OCR is paused (below).
- **Conventions a text pack cannot carry**: underlined required words, "not X" rejects, drawn structures (A-level Chemistry). Those packs are caught by the audit and not loaded.
- **OCR**: the board text layer for OCR schemes is cut from the WRONG question for many parts (e.g. 5(a)(i) got the chi-squared question's rows), so the word check rejects
  them (correct, fail closed): 18 of 60 rejected, 15 disagree. Fix needed in `pdf_text.py` for OCR layouts before any more OCR reading is worth spending.
- Agreement is not correctness, and the audit is the same model family as the readers, not an examiner; it checks fidelity to the printed scheme, not marking accuracy.

## OCR text-layer fix, the gate measurement and the text-first pilot (7 Nov 2026)

**OCR fix.** `pdf_text.py` ended a part's text at the first line that looked like another question's label, but OCR schemes number their mark POINTS ("1", "2", "3")
inside the answer cell, so Q25(b) of H020/01 June 2016 was cut after its first point. A neighbouring label now counts only at the part's own left margin
(`MARGIN_SLACK`). Same two readings of OCR A-level Biology A batch 1: 22 agreed became 30 (rejected 18 became 5), no model calls. `refresh_text.py` regenerates a prepared
batch's text layer (no images fetched). Applied to all 13 prepared OCR batches (a third to a half of their segments changed).

**Gate measurement (373 audited real packs, 22 found defective by the independent audit).** A deterministic rule can only be a HOLD if it is selective:

| rule | flags | defects caught (of 22) | clean packs wrongly flagged |
|---|---|---|---|
| a qualifier the board prints ("unless qualified", "if neither given", "alone") missing from the pack's item (`lostQualifiers`) | 5 | 2 | 3 |
| guidance left on no point although the scheme has several (`unattachedGuidance`) | 77 | 10 | 67 |
| an "A / B" chain split into separate items, or a one-word fragment next to a slash | 28 | 4 | 24 |

Only the first is a hold. The second is a report (which packs to audit first); the third is not usable because "xylem / phloem" and "atoms / elements" are genuinely
separate alternatives. A deterministic gate cannot replace the audit: all four rules together flag 27 percent of packs for 14 of 22 defects.

**Coverage.** 35 UK GCSE/A-level science banks hold 70,221 parts; 54,489 are readable by this pipeline (1 to 3 marks, own scheme, no multiple choice). With two readers plus
audit at about 27,000 tokens a part, the 10 busiest banks alone are about 400 million tokens more and all 35 about 1.5 billion: not the route to "every question".

**Text-first pilot (single reader, no pictures).** 66 parts already audited from picture reads (AQA GCSE Biology b02, AQA A-level Biology b02) were re-read from text only
(the board's text layer plus the bank's OCR) and compared with the audited picture pack by the production agreement code. Of the 59 whose picture pack was audited clean,
the text-only reading agreed on 44 (75 percent), held itself on 6 (it flagged its own doubt: the right outcome), and disagreed on 9, every one a difference in how a slash
alternative is grouped, which text alone cannot settle. Of 7 parts whose picture pack the audit found defective, the text-only reading agreed with the defective pack on 3:
agreement is not correctness. Cost: the text readers used about 11,000 tokens a part through agents, no cheaper than picture readers (about 9,000), because an agent re-reads its
whole instruction set each turn. The saving has to come from one short prompt per part through a cheap API model, which this pilot does not test.
