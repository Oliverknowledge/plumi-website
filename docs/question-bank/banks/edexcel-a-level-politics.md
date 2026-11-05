# Edexcel A-Level Politics

Added 29 October 2026, after the founder asked for Politics on the most common board:
`/question-bank/edexcel-a-level-politics`, every question from Pearson Edexcel's A-Level (9PL0:
Paper 1, Paper 2, and Paper 3A USA or 3B Global) and AS (8PL0, Papers 1 and 2) Politics papers
that Pearson publishes on its own site, 2019 to 2025. That is 296 parts from 40 papers (7 series
of the A-Level, 6 of the AS), every one with its own mark scheme crop (the levels grid, then its
indicative content), and 284 with the examiner's comments on its question. Every paper's parts add
up to its printed total, counting each either/or choice once (`check_politics.py`).

- **Papers:** Paper 3 is two papers, 3A and 3B, of which a student sits one. Each is a paper of its
  own (`9pl03a`, `9pl03b`, "Paper 3A · Comparative Politics: USA"), so the paper filter picks one,
  and their topics sit under the tiles' "Paper 3 options": USA (Paper 3A) and Global Politics
  (Paper 3B).
- **Topics** are the specification's content areas (Issue 4), in six areas: UK Politics (democracy
  and participation, parties, electoral systems, voting behaviour and the media), Core Political
  Ideas (liberalism, conservatism, socialism), UK Government (constitution, Parliament, PM and
  executive, relations between the branches), Non-core Political Ideas (anarchism, ecologism,
  feminism, multiculturalism, nationalism), USA (six) and Global (six). Essays range across an
  area's numbered sub-points, so the bank tags to content areas. The specification numbers them
  afresh in each area, so codes carry the area (`UKP.2`) and topics show their names alone.
  UK Politics and UK Government are Year 1 (the AS), the ideas Year 2.
- **Either/or:** every question is "EITHER 1(a) OR 1(b)" (Paper 3's Section C: two of three), so
  every part after a question's first carries `or` and a whole question's marks count one essay.
  Paper 2's Section B is one question per non-core idea (3 Anarchism … 7 Nationalism on every paper).
- **Sources:** before 2023 each source is printed in its part, so the part's crop has it. From June
  2023 they are in a Source Booklet bound in after the paper; the question that says "Look at Source
  1(a)…" or "Read Sources 2 and 3…" carries them as its stem. The bank shows a question's stem once
  above its parts, so an "EITHER 1(a) OR 1(b)" question's stem has both sources, each under its own
  heading. AS Questions 2 and 3 have no parts, so their ids end `-q` (`8pl001-jun24-02-q`), as
  Geography's, for the stem's name.
- **Cutting:** `cut_politics.py` runs `cut_pearson.py --extracts --figures` with Politics' own
  pieces, patched from the wrapper so no other bank's crops move: older papers print the number again
  before the alternative ("1 (b)", "3 (b)"), read as the next part; the source booklet's stems; and
  its own mark scheme reader. Pearson's Politics schemes have no one layout (a levels grid before the
  indicative content or after it, labels "1(a)", "1a", "2a.", "4b)", "Question number 3", or none),
  so each part's crop runs from its label to the next landmark, after its "Guidelines for marking…"
  block. AS Paper 2 June 2022 prints 4(b)'s label as "4a": its start is set by hand (`MS_HAND`).
- **Reports:** headings like "Q1a Using the source…" go on lines of their own before cut_pearson
  reads them. A-Level Paper 1 and Paper 3B June 2024 set their text in fonts with no character map,
  so they are read by OCR (`ocr.swift`), with the candidates' scripts (pictures) whited out first.
- **Tags:** Claude tagged every part following `tag.md`'s "Edexcel Politics" section.

Gaps, honestly:

- No exams in June 2020 or June 2021 (cancelled); October 2020 and November 2021 were sat instead.
  AS wasn't sat in November 2021, so Pearson has no AS set for it.
- Pearson published no examiner's report for either AS paper in October 2020 ("insufficient
  entries"): those 12 parts have the scheme but no report.
- The two OCR'd reports (June 2024 Paper 1 and 3B) may have the odd misread word.
- Not included, by the brief's 2019–2025 scope: AS June 2018 (AS's first sitting, public on
  Pearson's site, could be added) and June 2026 (listed, but in Pearson's teachers-only area). The
  specimen papers are teachers-only too.
- Scheme crops are long (a levels grid plus up to four pages of indicative content); the longest,
  3B November 2021's essays, are 9,000–10,700px.
- No past paper library page for Politics yet (`FILES_JSON = None`), though the whole papers are on
  R2 under `edexcel/` for the bank's "whole paper" links.

```bash
python3 scripts/question-bank/edexcel_politics/fetch_politics.py
python3 scripts/question-bank/edexcel_politics/spec_politics.py
python3 scripts/question-bank/edexcel_politics/cut_politics.py
python3 scripts/question-bank/edexcel_politics/check_politics.py
python3 scripts/question-bank/edexcel_politics/tag_politics.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_politics/tag_politics.py merge
python3 scripts/question-bank/edexcel_politics/build_politics.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-politics --pdf-prefix=edexcel/
```
