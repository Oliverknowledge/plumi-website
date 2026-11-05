# AQA A-Level French and Spanish

Banks: `aqa-a-level-french`, `aqa-a-level-spanish`

Added 1 November 2026: `/question-bank/aqa-a-level-french` and `/question-bank/aqa-a-level-spanish`,
every question from AQA's A-Level French (7652) and Spanish (7692) Papers 1 and 2 that AQA still
publishes, November 2020 to June 2025, with the AS papers (7651, 7691: November 2020, then June
2022 on) marked AS. French: 845 parts from 22 papers; Spanish: 862 from 22. Every part has its
mark scheme cropped; 176 French and 138 Spanish questions have the examiner's comments.

- **Paper 1 (Listening, reading and writing) includes listening.** AQA publishes each sitting's
  recording on its own site ("SF-TRACKED" zips, an MP3 per track) and the transcript ("TR").
  The paper names each question's tracks ("Tracks: 02–14"), so `audio_languages.py` joins them
  into one MP3 per question (mono, 64 kbps) on R2 under `aqa/audio/`. November 2020 was only
  published as one untracked MP3: it is cut at the long silence between passages nearest where
  each passage should end (the paper prints each passage's length). A part carries its recording
  as `au`; QuestionRow plays it above the question and links the transcript (`wholes` "tr").
- **Topics:** the specification's four themes and their twelve sub-themes (Year 1: the two AS
  themes; Year 2: the other two), placed passage by passage by hand in `tag_languages.py`
  (titles rarely say: "Le Café Renaissance" is about prison); the skill each question tests
  (listening, reading, summaries, literary extracts, translation into English, translation into
  the language); the grammar points a scheme row demands ("must be pluperfect", "Must be in the
  future tense": AQA's schemes seldom say, so only a handful); and Paper 2's set texts and films,
  sixteen per language, so a student picks the works they study, as with English Literature.
- **Choices:** each work has two essays, either .1 or .2: the second is the alternative (`or`).
  Every Paper 1 adds up to 100 (AS: 90).
- **Mark schemes:** Paper 1's are a table per row headed "Qu"; the translations' box tables
  ("Box 1" to "30") print box numbers where question numbers go, so a whole question's number
  counts only as the first label under a "Qu" header, under a "Question 10" heading, or in drawn
  boxes. A translation into the language starts at its "Guidance on level of accuracy" heading
  and runs through its box table and conversion grid. Summaries (scheme rows "Bullet point 1")
  get the AO3 language grid; essays get the AO3 and AO4 grids; AS Paper 2's five translated
  sentences each get the conversion grid printed after the last. A row never runs on into the
  marking guidance pages or past a "Section B" heading. Paper 2's schemes are no table: a row
  starts at its boxed label (cut.py's row_start took the rule AQA draws under the essay above,
  which cut that essay's scheme to its first line). Every essay's crop was checked for its
  possible content and both grids by height (3,300px and up).
- **AS Paper 2** prints its essay questions in the insert: they are cut from it.
- **Reports** comment by question on Paper 1 ("Question 9.1 - 9.8", "Question 9.9") and by essay on
  Paper 2 ("1.1 Students...", "Question 1.1. (55%)", or under the work's title in June 2022);
  each essay's comment sits under a "Question 01.1" line so the page shows it as that part's own.
- **Search** folds accents in the browser, so "benevolat" finds "bénévolat" and "nino" finds
  "niño"; the stored search text keeps them.
- **Pipeline:** `scripts/question-bank/aqa_languages/`: `fetch_languages.py` (fetch_aqa.py over the
  four specifications, plus the recordings; `--audio` for those alone), `audio_languages.py`,
  `cut_languages.py` (cut.py with the patches above), `tag_languages.py`, `build_languages.py`.
  Papers are on R2 under `aqa/AQA-765*` and `aqa/AQA-769*`, crops under `bank/765*` and
  `bank/769*`, recordings under `aqa/audio/`. `upload_r2.py` uploads a work dir's `audio-out/`
  when there is one.
- **Gaps:** AQA no longer publishes June 2017 to June 2019, so the banks start at November 2020.
  AS French June 2022's Q08 (a summary of an interview) is left out: AQA's copyright-removed
  paper blanks the interview. Paper 3 (speaking) has no written questions and isn't here, and
  the specimen papers are left out, as in the other AQA banks.

```bash
python3 scripts/question-bank/aqa_languages/fetch_languages.py
python3 scripts/question-bank/aqa_languages/audio_languages.py
python3 scripts/question-bank/aqa_languages/cut_languages.py
python3 scripts/question-bank/aqa_languages/tag_languages.py
python3 scripts/question-bank/aqa_languages/build_languages.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-languages
```
