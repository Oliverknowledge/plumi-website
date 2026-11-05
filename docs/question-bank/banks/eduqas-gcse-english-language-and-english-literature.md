# Eduqas GCSE English Language and English Literature

Banks: `eduqas-gcse-english-language`, `eduqas-gcse-english-literature`

Added 1 November 2026: `/question-bank/eduqas-gcse-english-language` and
`/question-bank/eduqas-gcse-english-literature`, every question from the papers Eduqas
publishes on eduqas.co.uk for GCSE English Language (C700QS) and English Literature (C720QS),
June 2017 on. The library's GCSE English Language and English Literature pages gain
Eduqas, with the same files.

- **English Language:** 210 questions from 30 papers, June 2017 to June 2025 with every
  November resit (Eduqas publishes a year after the exam). Every question has its scheme
  crop and its examiner's comments.
  - Component 1 (`c700u10`): Section A, five questions on a 20th-century prose passage (01,
    02 [5], 03, 04, 05 [10]); Section B, question 11, a story from a choice of four titles [40].
  - Component 2 (`c700u20`): Section A, 11-16 on two non-fiction texts (11 and 13 are three
    one-mark parts, kept whole); Section B, 21 and 22, transactional writing [20 each].
  - **Sources.** The passages are in a separate "Resource Material" insert, hosted as
    `eduqas/c700u10-ins-jun24.pdf` and linked from every question that reads it. Those
    questions carry a new `src` flag on their rows (`BankPart.src`), since Component 2's
    "How does the writer…" doesn't name a source. Component 2's 19th-century text is
    printed in the paper itself, so it's the stem of questions 13 to 16. Some sittings list
    the paper and its insert as one file (June 2022, June 2023, November 2018 and 2022);
    the fetcher splits it at the insert's own cover.
  - **Topics:** the question types (`texts.py` `LANG`), the same question in the same place
    every series: Component 1's Q01-Q05 and its writing, Component 2's Q11-Q16 and its writing.
  - **Schemes:** a reading question's crop runs from its number to the next, its levels
    included. A writing question's is Section B's descriptors and band grid, then its own
    task-specific guidance.
- **English Literature:** 264 questions from 19 papers, all tagged to their set text.
  - Component 1 (`c720u10`): Section A, Shakespeare, an extract question (N1 [15]) and an
    essay (N2 [25]) on each play; Section B, the Eduqas Poetry Anthology, 71 on a printed
    poem [15] and 72 comparing it with another [25].
  - Component 2 (`c720u20`): Section A, post-1914 prose or drama (01-10), Section B,
    19th-century prose (21-26), one extract question each [40]; Section C, unseen poetry,
    31 [15] and 32 [25].
  - June 2022's adapted papers (C722) are five papers, one per section (`c722u10a` …
    `c722u20c`). November 2021's Component 1 was Shakespeare with post-1914 prose/drama.
  - **Extracts.** A question's crop is its text's whole block, so an extract question
    shows its extract, printed below it or on the opposite page. Question 72 and question
    32 compare with the first poem, which is their stem.
  - **Set texts** (`texts.py` `LIT`) are the topics, so a student picks the texts they
    study, as in the AQA bank. June 2025 brought Twelfth Night (for Henry V), Boys Don't
    Cry (for Never Let Me Go) and Leave Taking (for A Taste of Honey); those titles say
    "from 2025" or "to 2024". Every block after a section's first is an alternative (`or`),
    so each paper's answered marks add up (80, 120; 40 for each 2022 paper).
  - **Schemes:** a question's indicative content (with its AO4 spelling grid where it has
    one), then the section's generic levels grid for that question (Shakespeare's extract
    or essay grid; Section C's 31 or 32 grid), stacked, across pages and landscape pages.
- **Reports:** one per series. Language comments by question ("Q1.2", "Question 0.3");
  Literature by text (Shakespeare's extract questions, then its essays), by question
  ("Question 3.1") or by section, and each question gets the most particular comments.
- **Pipeline:** `scripts/question-bank/eduqas_gcse_english/`. `fetch_english.py` uses
  `eduqas/fetch_eduqas.py`'s `get` and `tab`. The cutters use `eduqas_rs/cut_eduqas_rs.py`'s
  crop helpers (through `common.py`). `build_english.py` uses
  `edexcel_english_lit/build_english_lit.py`'s `build()`, which now passes a row's `src`
  and prefers a cutter's own words (`own`) for the question's summary. The library's
  entries come from `scripts/past-papers/boards/eduqas_english.py`.
  On R2, the papers are under `eduqas/c700*`, `eduqas/c720*` and `eduqas/c722*`, and the
  crops under `bank/c700*`, `bank/c720*` and `bank/c722*`, all new names.
- **Gaps (as Eduqas publishes them):**
  - Literature: of the autumn resits, only November 2020's Component 2 and November
    2021's Component 1 are published, and November 2021's has no mark scheme (its 22
    questions have the report but no scheme crop). November 2020's Component 1 scheme
    is published without its paper, so it's left out.
  - The November 2025 and June 2026 reports are up, but not their papers yet.
  - Language's Component 3 (spoken language) is non-exam assessment. The 2019 "Examination
    Summary Report"s are statistics, not comments, and are left out.

```bash
python3 scripts/question-bank/eduqas_gcse_english/fetch_english.py lang   # or lit
python3 scripts/question-bank/eduqas_gcse_english/cut_english_lang.py     # cut_english_lit.py
python3 scripts/question-bank/eduqas_gcse_english/build_english.py lang   # or lit
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/eduqas-gcse-english-lang --pdf-prefix=eduqas/
python3 scripts/past-papers/boards/eduqas_english.py
```
