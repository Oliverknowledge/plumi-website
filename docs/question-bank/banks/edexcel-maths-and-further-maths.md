# Edexcel Maths and Further Maths

Banks: `edexcel-a-level-maths`, `edexcel-a-level-further-maths`

`/question-bank/edexcel-a-level-maths` and `/question-bank/edexcel-a-level-further-maths`:
every question from Pearson Edexcel's current specifications, 9MA0 and AS 8MA0
(Maths) and 9FM0 and AS 8FM0 (Further Maths). The Maths bank preserves its 444
current-specification questions and adds 759 legacy questions from 90 papers
(2010–2018), for 1,203 in total. Further Maths coverage is unchanged. Questions
are cut whole because Edexcel's mark schemes and examiner's reports go by question.
Topics follow the specification's numbered areas, with no Year 1 and Year 2 split.
Maths has separate legacy C1–C4, S1 and M1 module filters. These are explicitly
labelled as the previous specification and are not mapped to today's topics.
The other legacy modules remain excluded.

The additive legacy pipeline, source coverage, gaps and reproduction steps are
in `scripts/question-bank/edexcel_legacy/README.md`. It retains the existing
questions, crops and worked solutions. June 2011 C1's indexed filename has a
mistyped year (`0011`); its cover confirms 2011. Three regional June 2013 papers
need local OCR derivatives.

**MadAsMaths** (6 November 2026): A-Level Maths has an "Add MadAsMaths questions" switch, off by default, that
mixes 6,477 questions from MadAsMaths' topic booklets into its topics (`madas.json` among its data). How they're cut,
tagged and mapped to this bank's topics: `docs/BOOKLETS.md`.

- **Source papers:** `fetch_edexcel.py` asks the public search index behind
  Pearson's course-materials pages for each spec code. Whole papers are stored on
  R2 under `edexcel/`, and crops under `bank/` next to AQA's.
- **Gaps:** Pearson keeps the June 2018 9MA0/8MA0 papers and June 2026 for
  teachers only. June 2019 9MA0 Paper 3 and 9FM0 Further Mechanics 1, plus the
  2018 AS Decision papers, are scanned images, so they're in the past paper
  library but not the bank. Every question has its marks, and all but 41 have a
  cropped mark scheme. The rest link to the whole scheme.

```bash
npm run bank:fetch:edexcel
npm run bank:cut:edexcel
python3 scripts/question-bank/tag_batches.py split scripts/question-bank/.work-edexcel   # then tag
python3 scripts/question-bank/tag_batches.py merge scripts/question-bank/.work-edexcel
npm run bank:build:edexcel
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work-edexcel --pdf-prefix=edexcel/
```
