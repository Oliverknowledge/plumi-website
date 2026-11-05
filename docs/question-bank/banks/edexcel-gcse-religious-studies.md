# Edexcel GCSE Religious Studies A and B (1RA0, 1RB0)

Added 3 November 2026: `/question-bank/edexcel-gcse-religious-studies`, every question from Pearson Edexcel's
GCSE (9-1) Religious Studies A (1RA0) and B (1RB0) that Pearson publishes on qualifications.pearson.com: June
2018, June 2019, November 2020, November 2021 and June 2022 to June 2025. That is 3,000 parts from 226 option
papers (A: 968 parts, 99 sittings of 15 options; B: 2,032 parts, 127 sittings of 21 options), every one with
its marks, its own scheme crop and a topic; 2,456 carry the examiner's comments on their question. The Short
Courses (3RA0, 3RB0) are left out.

- **Options.** Every option is a paper of its own, as Pearson codes them: `1ra01a` is "Spec A Paper 1A" ·
  "Catholic Christianity (Study of Religion)", `1rb02f` is "Spec B Paper 2F" · "Judaism (Religion, Peace and
  Conflict)". The bank's `options` filter is labelled **Course**: a specification and a religion
  (`?option=b-ju`), or "Spec A: all religions" / "Spec B: all religions" for a student sitting two religions, who then
  ticks papers under Paper. Each pick's `takes` covers its own papers and sections, and the sections both
  specifications share. Mark's Gospel (Paper 4A) goes with Catholic Christianity and Christianity, the Qur'an (4B) with Islam.
- **Topics.** A topic is one of the specification's numbered items, a section one religion's section of content.
  Pearson prints the same sections many times: "Catholic Beliefs" under 1RB0's 1A, 2A and 3A and 1RA0's 1A and 2A;
  1RA0's "Practices" is 1RB0's "Living the Catholic Life", item for item (likewise "Arguments for the Existence of God"
  and "Philosophy of Religion", "Relationships and Families" and "Marriage and the Family"). Sections of a religion
  whose items read the same are merged by `spec_gcse_rs.py`, so 960 printed items are 528 topics in 66 sections and a
  topic's page shows every paper's questions on it. A title two religions share ("Pilgrimage") carries the religion in
  brackets, and slugs start with the religion unless the title names it. A part's section is fixed by its paper and
  question; `check_gcse_rs.py` compares each question's printed heading with it.
- **Crops.** Every question runs (a) 3, (b) 4, (c) 5, (d) 12 or 15 marks: 15 includes 3 for SPaG, as printed, so a paper adds up to 102
  (1RA0 Paper 1, all of 1RB0) or 51 (1RA0 Papers 2 to 4). Answers are written in the paper, so `cut_gcse_rs.py` uses
  `edexcel_gcse_history/cut_gcse_history.py`'s reader: dotted lines whited out and closed up, furniture left out.
- **Schemes.** A (d)'s crop runs through its indicative content, levels grid and, at 15 marks, the SPaG grid, over as many pages as
  they take; every (d) was audited for all four levels. Patches, in `cut_gcse_rs.py` only: labels printed "Q2(b)" and "Level"
  over "1" in a narrow column; a blank page between a (d) and its grid (1RB0 3D June 2019); Pearson's footer on a last page.
- **Tags.** Many reports name the item a part tested ("Bullet point 2.5", "This referred to the specification: 1.3"): `tag_gcse_rs.py` takes those
  for 1,603 parts. Claude subagents tagged the other 1,397 following `tag.md`'s "Edexcel GCSE Religious Studies" section. 13 topics have no
  question yet.
- **Reports** head parts in many ways ("1RA0_1A_Q01a", "Question 1a:", "2b:", "1a Outline…", "Question one"): all read by `cut_gcse_rs.py`.
- **Gaps.** June 2026 is for teachers only. Pearson lists no question paper for 1RB0 3F June 2023 or 3A and 3F June 2024 (their schemes are public), and November 2021 1RB0 1D's
  scheme is teachers only, so those four sittings are left out. 544 parts have no report comments: 30 sittings have a "will not publish" notice and 10 have
  no report at all (`build_gcse_rs.py` links neither), and a few report headings aren't per part. No past paper library page yet: the whole papers are on R2 under `edexcel/1ra0-*` and `edexcel/1rb0-*`,
  the crops under `bank/1ra0*` and `bank/1rb0*`.
- **Oddities in Pearson's own schemes, cut as printed.** 1RB0 3D June 2018's 2(d) grid has no Level 4 row; 1RB0 3D June 2019's 2(d) grid has its descriptors moved down a row. 1RB0 3G
  November 2020 prints 4(b) as "3(b)" (read as 4(b)). 1RA0 2B June 2025's 1(a) asks for religious traditions other than Christianity, which no item covers (filed under Christianity's beliefs, `CHBEL.1`).

```bash
python3 scripts/question-bank/edexcel_gcse_rs/fetch_gcse_rs.py
python3 scripts/question-bank/edexcel_gcse_rs/spec_gcse_rs.py   # reads .work/edexcel-gcse-rs/specs/spec-a.pdf, spec-b.pdf
python3 scripts/question-bank/edexcel_gcse_rs/cut_gcse_rs.py
python3 scripts/question-bank/edexcel_gcse_rs/check_gcse_rs.py
python3 scripts/question-bank/edexcel_gcse_rs/tag_gcse_rs.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_gcse_rs/tag_gcse_rs.py merge
python3 scripts/question-bank/edexcel_gcse_rs/build_gcse_rs.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-gcse-rs --pdf-prefix=edexcel/
```
