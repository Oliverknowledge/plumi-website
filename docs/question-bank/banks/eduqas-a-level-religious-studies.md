# Eduqas AS and A Level Religious Studies

Added 29 October 2026, at the founder's request ("eduqas re"):
`/question-bank/eduqas-a-level-religious-studies`, every question from Eduqas's AS (B120QS)
and A Level (A120QS) Religious Studies papers published on eduqas.co.uk, June 2017 to June
2025. That's 1,120 parts from 112 papers: 600 A Level parts (60 papers, June 2018 on) and
520 AS (52 papers). Every part has its mark scheme cropped, apart from one where Eduqas's
scheme answers a different question. 816 parts carry the examiner's comments on their
question, and every part is tagged.

- **Papers and options.** A student sits three components. Component 1 (a study of a
  religion) has a separate paper for each option: A Christianity, B Islam, C Judaism,
  D Buddhism, E Hinduism, F Sikhism (`a120ua0` … `a120uf0`, AS `b120ua0` …). Components 2
  (Philosophy of Religion, `a120u20`) and 3 (Religion and Ethics, `a120u30`) are sat by
  everyone. Each option is a paper of its own ("Component 1B · Islam"), and carries an
  `option`. The bank lists its religions in `options`, and the page gets a **Religion**
  filter beside Paper. Picking one keeps that religion's Component 1 papers and topics,
  plus Components 2 and 3. It also narrows the Paper list and the topic tiles. The filter
  is in the URL as `?option=B` and is hidden on topic pages. Any bank can use it: a paper
  or section without an `option` shows under every choice (`BankPaper.option`,
  `BankSection.option`, `BankSubject.options` in `src/content/questionBank.ts`).
- **Parts.** Every paper has five questions, each in two parts. Section A is questions 1–2,
  answer one; Section B is questions 3–5, answer one. Part (a) is AO1 knowledge (20 marks at
  A Level, 25 at AS) and part (b) is an AO2 evaluation of a quotation (30 marks, 25 at AS).
  A part's crop runs from its label to the next label or "Or,". Ids look like
  `a120ub0-jun24-03-b`, and labels like "3(b)". Reports are keyed by question; both parts
  share one. There are no calculations, so `noCalc` is set.
- **Mark schemes.** Each part's crop is its indicative content with the generic band
  descriptors for its assessment objective stacked underneath (AO1 for (a), AO2 for (b)).
  The descriptors are the levels the essay is marked on, and the scheme prints them once,
  at the front. AS Hinduism's June 2018 scheme prints no descriptors, so it borrows them
  from another AS scheme of that summer; they're generic and identical.
- **Topics.** These come from the A Level specification (`eduqas_rs/spec_eduqas_rs.py`).
  The eight areas are the sections: the six religions, Philosophy of Religion (`P`) and
  Religion and Ethics (`R`). Each area has four themes of six sections, A–F, and each
  section is a topic: 192 topics, coded like `B.2D` with ref "2D" (Islam, Theme 2D, Salah).
  AS papers are tagged to the same topics. A topic is year 1 (AS) when the AS
  specification teaches it, matched by its words, because the AS numbers its themes
  differently (AS Islam's Theme 3A is the A Level's 2D). Every area has 12 AS topics. One
  hand fix: R.2F, applying Finnis and Proportionalism, shares words with AS Natural Law but
  is A Level only. Tagging was done by Claude subagents reading each part
  (`eduqas_rs/tag_eduqas_rs.py`, tag.md's "Eduqas Religious Studies"). The reports for
  2024 and 2025 name each question's theme, and the tags agree with every one of them.
  23 parts have two topics; 4 topics have no questions yet (B.3C, C.3A, F.3F, F.4D).
  A topic's title is its heading as a student would know it ("Aquinas’ Natural Law: virtues
  and goods", "Muhammad in Makkah"), from `SHORT` in `spec_eduqas_rs.py`. The specification's
  own wording can run on into a paragraph, which made 600-character slugs that broke the
  production build. That wording stays in the topic's text in `spec.json`, for tagging.
  Titles shared across religions name their religion ("Festivals and Jewish identity"), and
  every slug is under 50 characters.
- **Pipeline.** `scripts/question-bank/eduqas_rs/`:
  - `fetch_eduqas_rs.py` reads the qualification page's pastpapers and keydocuments tabs,
    as `eduqas/fetch_eduqas.py` does. It places each file by its listed title, checked
    against the code in the file name and the PDF's cover. Pre-2023 files are named by old
    paper numbers (`s19-8121-04.pdf` is A Level Option B), and 2017's schemes only by a
    running number.
  - `spec_eduqas_rs.py`.
  - `cut_eduqas_rs.py` is self-contained, because the layout is the same every year; the
    shared cutters are untouched.
  - `tag_eduqas_rs.py`.
  - `build_eduqas_rs.py`.

  On R2, the papers are under `eduqas/a120*`, `eduqas/b120*` (reports
  `eduqas/a120-er-jun24.pdf`, one per level and series), and the crops under `bank/a120*`,
  `bank/b120*`.
- **Gaps (as Eduqas publishes them):**
  - Eduqas doesn't publish every option every year; low-entry options are left out. Not
    on the site:
    - A Level Sikhism, June 2024.
    - In Autumn 2021, every option except Christianity, Islam and Buddhism (Judaism,
      Hinduism and Sikhism).
    - AS Sikhism, June 2017, 2022, 2023, 2024 and 2025.
    - AS Judaism, June 2022 and 2025.
    - AS Hinduism, June 2023.
    - AS Autumn 2020, Options C–F: their mark schemes are listed but their papers aren't.

    These papers are on Eduqas's secure site only.
  - June 2026 papers aren't up yet (Eduqas waits a year), though the June 2026 reports are.
    They're left out until the papers follow.
  - Reports (816 of the 1,120 parts have comments):
    - Autumn 2021 has none at either level, and AS Autumn 2020 has none. A Level Autumn
      2020 covers only Components 2 and 3.
    - Some options get no section, or a summary with no per-question comments:
      - A Level Sikhism in 2022, 2023 and 2025.
      - A Level Judaism and Hinduism in 2025.
      - AS Sikhism in 2018 and 2019.
      - AS Judaism in 2019, 2023 and 2024.
      - AS Hinduism in 2022, 2024 and 2025.
    - AS 2025's Christianity and Buddhism comments couldn't be placed: the report runs
      them on without headings that match, so those 20 parts show none rather than risk
      the wrong ones.
    - A question that "worked well" is sometimes skipped; Eduqas says so in each report.
      Two questions miss out this way: A Level Ethics 2018 Q2 and Philosophy Autumn 2020 Q3.
    - Every comment was checked against its question's words.
  - Eduqas's June 2018 A Level Sikhism scheme prints a gurdwara question under 4(b), but
    the paper's 4(b) is about festivals. That part has no scheme crop (`WRONG_SCHEME` in
    `build_eduqas_rs.py`) and links the whole scheme PDF instead.
  - No sample assessment materials are included, as with the other banks.

```bash
python3 scripts/question-bank/eduqas_rs/fetch_eduqas_rs.py
python3 scripts/question-bank/eduqas_rs/spec_eduqas_rs.py
python3 scripts/question-bank/eduqas_rs/cut_eduqas_rs.py
python3 scripts/question-bank/eduqas_rs/tag_eduqas_rs.py split   # tag the batches, then:
python3 scripts/question-bank/eduqas_rs/tag_eduqas_rs.py merge
python3 scripts/question-bank/eduqas_rs/build_eduqas_rs.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/eduqas-rs --pdf-prefix=eduqas/
```
