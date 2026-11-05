# AQA GCSE French, Spanish and Bengali

Banks: `aqa-gcse-french`, `aqa-gcse-spanish`, `aqa-gcse-bengali`

Added 1 November 2026: `/question-bank/aqa-gcse-french`, `/question-bank/aqa-gcse-spanish` and
`/question-bank/aqa-gcse-bengali`, on the GCSE shelf. Every file is AQA's own, from the five
specifications' assessment-resources pages. Whole papers are on R2 under AQA's names, normalised
(`aqa/AQA-8658RH-QP-JUN24.pdf`), the crops under `bank/8658*`, `bank/8698*`, `bank/8652*`,
`bank/8692*` and `bank/8638*`, and the Listening recordings under `aqa/audio/` (`aqa/audio/8658lh-jun24-07.mp3`,
beside the A-Level languages' `aqa/audio/76521-…`).

- **3,409 parts:** French 1,177 (42 papers), Spanish 1,232 (42), Bengali 1,000 (36). Every part has its
  own scheme crop; every paper adds up to its marks, less the left-out questions below. 3,385 parts are
  tagged (the rest: the specimens' dictations and grammar gap-fills, and a few picture-only questions).
- **Papers:** Paper 1 Listening, Paper 3 Reading and Paper 4 Writing, Higher and Foundation, named
  as the GCSE science banks' are ("Paper 3 Reading Higher"), with `tiers.json` for the both-tiers
  switch. Series: November 2020, November 2021, June 2022 to June 2025 (June 2018 and 2019 are
  withdrawn from AQA's site; 2020 and 2021's summers were cancelled).
- **Two French and two Spanish specifications.** 8658 and 8698 were examined 2018 to 2025; 8652 and
  8692 are first examined in summer 2026, and AQA has published only their specimen papers, which are
  in the banks as "2026 specimen", their papers titled "2026 format" (the others "2018 to 2025 format"),
  with a "Specification" filter (the options mechanism). The bank note says the format changed in 2026.
  Bengali 8638 has no new specification.
- **Listening with AQA's recordings.** AQA publishes each Listening paper's recording, tracked one MP3
  per question (track 007 is question 07, as the transcripts number them). Each Listening part plays
  its question's track, re-encoded at 48 kbps mono (`au`); November 2020 has only the whole recording,
  which those parts play (`auw`). The 2026 specimens' dictation (Section B, unnumbered) is cut as the
  question after the last, its five sentence tracks joined. The player (`.qb-listen` in `QuestionRow`) is the
  A-Level languages bank's (PR #132), with a note for a whole-paper recording.
- **Writing schemes** are each question's own Part 2 section: the levels grids, then the option's own
  bullet notes and model answer (the other option's are left out). Choices of task ("Either 01.1 or
  01.2") mark the alternatives `or`. Foundation Question 1's sentences share their question's scheme
  (`msq`).
- **Topics:** the three themes as sections and their twelve topics, split into sub-topics where the
  specification has them (`1.3.4` Sport): 19 topics, tagged per question (tag.md's section). The 2026
  specimens are tagged to the same topics.
- **Bengali** text layers are a legacy font's glyph order, unreadable, so Bengali script is left out of
  search text and `x` (the English instructions and questions stay); questions in Bengali only were
  tagged from their rendered crops.
- **Notice pages, Spanish (November 2026):** 17 crops changed with `cut.py`'s fix and `cut_gcse_languages.py`, which now finds a
  question's label under a setup carried over a notice page, and gives a question with parts that setup as its stem. `8692lf-spec-22`
  loses its notice page. The specimens regain what the old cut lost: `8692rf-spec-37` to `39` their chat, `8692rh-spec-04` to `07` their article.
  Foundation Writing's "Answer either..." moves to Question 4 whole. `8692lf-spec-04`'s crop was already clean, so
  only its search text changed. Marks and paper totals stayed the same, and French, German and Bengali weren't re-cut.
- **Left out:** Paper 2 Speaking (teacher-marked role-plays and photo cards); questions whose text AQA
  removes from its copyright-removed copies, the only copies it publishes of nine Reading papers (Bengali
  Reading June 2024 and 2025, both tiers; Spanish Reading Foundation November 2020 and June 2024, Higher
  June 2022, June 2024 and November 2020): 15 questions; the old specifications' 2016 specimens; the
  modified (enlarged) papers. Spanish Foundation Reading June 2024's page 5 is a picture with no text
  layer: its question 4 is cut from set coordinates (`IMAGE_PAGES`).
- **Pipeline:** `scripts/question-bank/aqa_gcse_languages/`: `fetch_gcse_languages.py` (fetch_aqa.py
  over the five pages, three naming schemes read as one component code; the recordings), `cut_gcse_languages.py`
  (cut.py imported and patched: Bengali and specimen labels, Writing schemes, titles printed above a
  question's first part, marks printed beside the next label, copyright-removed questions, audio),
  `spec_gcse_languages.py`, `tag_gcse_languages.py`, `build_gcse_languages.py`; `upload_r2.py` uploads
  `<work-dir>/audio-out` to `aqa/audio/` (as the A-Level languages bank does).

```bash
python3 scripts/question-bank/aqa_gcse_languages/fetch_gcse_languages.py
python3 scripts/question-bank/aqa_gcse_languages/cut_gcse_languages.py   # needs ffmpeg
python3 scripts/question-bank/aqa_gcse_languages/tag_gcse_languages.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_gcse_languages/tag_gcse_languages.py merge
python3 scripts/question-bank/aqa_gcse_languages/build_gcse_languages.py
python3 scripts/question-bank/tiers.py aqa-gcse-french aqa-gcse-spanish aqa-gcse-bengali
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-gcse-languages
```
