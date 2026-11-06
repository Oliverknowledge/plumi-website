# AQA A-Level Biology, Chemistry and Physics

Banks: `aqa-a-level-biology`, `aqa-a-level-chemistry`, `aqa-a-level-physics`

The first banks, built 23 October 2026. Their notes are the opening of `docs/seo/question-bank.md`, because every later
bank was built from them, including its "Gaps, honestly" section.

## Biology, November 2026

**Crops:** 28 question crops across 17 questions held a whole notice page, because newer papers print `DO  NOT  WRITE` with
double spaces and `cut.py`'s check only matched single ones. `cut.py` now stops a part at the notice page, and what follows
it, up to the next label, goes to the next part as its setup. Skipping the page without that loses the setup, which a word
count across each question caught. The re-cut compared against a baseline run of the old cutter: only those 28 changed,
marks didn't, and every word in those questions is still there.

**Tags:** 16 moved, after reading each question and its scheme. They're in `scripts/question-bank/tag/aqa-a-level-sciences-corrections.json`,
which `tag_batches.py merge` keeps: Pacinian corpuscles to 3.6.1 (3 parts), stem cells to 3.8.2 (4), Required Practical 6 to
3.4.4 (8), phosphocreatine to 3.6.3 (1). `74023-jun23-01-2` stays in 3.6.2, as it's about the all-or-nothing principle. They
came from a term search over the wording taggers couldn't see, not a full re-tag, so more misfilings may remain.

## Chemistry and Physics, November 2026

**Crops:** the same fix as Biology's, with `cut.py`, which both banks' current papers use: 15 Chemistry crops and 11 Physics crops. Notice pages left seven
parts. Setups that had sat at the end of the part before moved to the question they belong to, and setups the old cut had
lost came back, most of all `74083a-nov20-03-3`, which regains Figures 11 and 12. The legacy papers (`CHEM`, `PHYA`) have
their own cutters and were checked too: no crop holds a notice page, so they weren't re-cut. Marks and paper totals didn't
change. Words only left a question to go to the next one, apart from the notice wording and one line `74083a-jun25-03-2`
and `03-3` both printed. `74042-jun16-08-1`, `74051-spec-05-1`, `74051-spec-07-1` and `74052-spec-04-1` differed only in
spacing and were left alone.

## Extension towards 2008, November 2026 — in progress

The published metadata still starts at 2010 for both Physics and Chemistry. No
earlier rows or new data hashes have been published by this extension yet.

### Physics 2009 prepared from the approved PMT source

| Unit | Series | Parts | Marks |
| --- | --- | ---: | ---: |
| PHYA1 | January 2009 | 28 | 70 |
| PHYA1 | June 2009 | 30 | 70 |
| PHYA2 | January 2009 | 25 | 70 |
| PHYA2 | June 2009 | 28 | 70 |
| Total | | 111 | 280 |

All 111 parts have marks, a question crop, a scheme crop and a reviewed topic
decision. `aqa_physics_legacy/check_legacy.py` reports zero issues; the four
question contact sheets and the combined-award/figure examples were read by eye.
The decisions are in `aqa_physics_legacy/tags_2009.json`.

The 2009 schemes centre labels beside answers in unruled rows. Their crops
therefore show the complete question's scheme (`msq`), rather than cutting at
the label and splitting the answer between parts. January PHYA1 6(b)(i–iii)
has one combined six-mark award, so it stays one part. June PHYA1 4(b) and
4(c)(i) have plain-font labels; June PHYA2 5(b) needs the figure printed under
5(a). These cases are restricted to the 2009 import; existing crops are not
re-cut.

To reproduce the prepared import:

```bash
python3 scripts/question-bank/aqa_physics_legacy/fetch_pmt.py scripts/question-bank/.work/physics-2009 --from-year 2009 --to-year 2009
python3 scripts/question-bank/aqa_physics_legacy/cut_legacy.py scripts/question-bank/.work/physics-2009
cp scripts/question-bank/aqa_physics_legacy/tags_2009.json scripts/question-bank/.work/physics-2009/tags.json
python3 scripts/question-bank/aqa_physics_legacy/check_legacy.py scripts/question-bank/.work/physics-2009
```

Both legacy builders now accept `--append` with a work folder containing only
new papers. Pull the existing bank data through the S3 API before using this
mode. It preserves old rows, their search text and whole-paper links, rejects
changes to an existing row, and recalculates counts and years. A second run is
idempotent. `test_legacy_append.py` exercises preservation and rejection for
both subjects.

R2 credentials are still needed to read the baseline and upload/verify the new
assets and content-addressed bank data. Then run `bank:check`, build and inspect
the local bank/topic pages before making the PR ready for review.

### Sources still awaiting approval

The 2008 papers precede the PHYA/CHEM format. They use PA01/PA02/PA04 and
PHA option units for Physics, and CHM units for Chemistry. PMT does not list
the 2008 sets; its Chemistry unit pages also start at 2010. Tests of AQA's
`store.aqa.org.uk/qual/gce/pdf/` and `filestore.aqa.org.uk/subjects/` addresses
for PA01/CHM1 June 2008 and CHEM1 January 2009 returned 404 on 6 November 2026.

FreeExamPapers lists question papers and schemes in these candidate archives:

- [Physics January 2008](https://freeexampapers.com/exam-papers/A-Level/Physics/AQA/Physics-A-2450/2008-Jan/)
- [Physics June 2008](https://freeexampapers.com/exam-papers/A-Level/Physics/AQA/Physics-A-2450/2008-Jun/)
- [Chemistry January 2008](https://freeexampapers.com/exam-papers/A-Level/Chemistry/AQA/2420/2008-Jan/)
- [Chemistry June 2008](https://freeexampapers.com/exam-papers/A-Level/Chemistry/AQA/2420/2008-Jun/)
- [Chemistry January 2009](https://freeexampapers.com/exam-papers/A-Level/Chemistry/AQA/2420/2009-Jan/)

Only the listings have been inspected. Importing from this additional mirror
for either subject awaits Daniel's approval under AGENTS.md. After approval,
inspect the PDFs' covers, formats and matched schemes before selecting units
and adapting the cutters. Keep these copies in the question banks only; do
not add them to the past paper library.
