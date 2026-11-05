# AQA A-Level English Literature B

Added 29 October 2026: `/question-bank/aqa-a-level-english-literature-b`, every question from
AQA's A-Level (7717) and AS (7716) English Literature B papers that AQA still publishes,
November 2020 to June 2025. That is 327 questions (228 A-Level, 99 AS) from 42 papers, every
one with its mark scheme cropped and 238 with the examiner's comments. The same scripts with
`--level=b` (`fetch_english_lit.py a-level-b`).

- **Options are genres, and papers.** Each paper is sat as one of two options, and AQA gives
  each its own component: A-Level Paper 1A Aspects of tragedy, 1B Aspects of comedy, 2A
  Elements of crime writing, 2B Elements of political and social protest writing; AS Paper
  1A/1B (drama) and 2A/2B (prose and poetry) in tragedy or comedy. So the paper filter has
  eight papers, and the topic tiles are the four genres.
- **Topics are the set texts, within their genre.** A question is tagged from its heading
  ("Othello – William Shakespeare") against its option's genre only (`texts.for_option`).
  Texts that A-Level students write about only in Section C (Richard II, The Great Gatsby,
  Emma and the rest) have named questions only on the AS papers, so their topics say "(AS)".
  The questions that name no text are their genre's own topics (`texts.unheaded`): Paper
  2's unseen extract (Section A: "Unseen crime extract", "Unseen protest extract") and the
  A-Level's two-text questions (Section C: "Tragedy across two texts" and so on). The
  Merchant's Prologue and Tale has had no question since 2020, so it has no tile.
- **Whole questions, extract included,** as at GCSE: a question runs from its label to the
  next "or", heading or label, so the extract printed under a Paper 1 Section A or AS
  question, and Paper 2's unseen extract, come with it. Section C's ids are
  `77171a-jun24-c-07`, and their stem is the section's rubric with its list of texts
  (`77171a-jun24-c-stem.webp`). Other ids are `77172a-jun24-01`.
- **Either/or.** In each section every question after the first carries `or` (Paper 2's
  Section A is one question), so every paper adds up to its 75 (AS: 50).
- **Mark schemes** print each question's label in a box, as the papers do: a question's
  indicative content runs to the next label, with the one levels grid ("Band 5 … How to
  arrive at (a) mark", landscape, portrait in AS June 2022) stacked under it. AS Paper 2A
  and 2B June 2022 print the label's two boxes one over the other (`stacked_labels`).
- **Reports** head a question ("Question 1", "Question 1: The Taming of the Shrew") or a
  section (Paper 2's), and a question gets its own paragraphs, else its section's that name
  its text, else the section's general ones. June 2025's reports set their headings in a
  medium weight, read as bold for B.
- **Pipeline:** `aqa_english_lit/` as above with `--level=b`; GCSE and Specification A are
  unchanged (their Paper 2 cuts are byte-identical before and after). Papers are on R2 under
  `aqa/AQA-771[67]*`, crops under `bank/771[67]*`.
- **Gaps:** AQA no longer publishes 2017–2019 (or AS 2016–2019), and its file store has
  none, so the bank starts at November 2020; the specimens are left out. AQA publishes no
  AS Paper 1B or 2B for November 2020 and sat no AS papers in November 2021. There are no
  reports for November 2020 or 2021 (87 questions), and the AS Paper 1A reports of June 2022
  and 2023 skip A Streetcar Named Desire (2 questions). AQA's copies withhold three extracts
  for copyright, and those crops show AQA's note: Paper 2A June 2022's unseen extract, AS
  Paper 2A June 2022's Poetry Anthology: Tragedy poem and AS Paper 2B June 2025's Poetry
  Anthology: Comedy extract. The questions are all there.

```bash
python3 scripts/question-bank/aqa_english_lit/fetch_english_lit.py a-level-b
python3 scripts/question-bank/aqa_english_lit/cut_english_lit.py --level=b
python3 scripts/question-bank/aqa_english_lit/build_english_lit.py --level=b
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-english-lit-b
```
