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
