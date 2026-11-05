# CAIE AS & A Level Psychology

Bank: `caie-a-level-psychology`

Added 5 November 2026, after a member asked for it (3 November): `/question-bank/caie-a-level-psychology`, Cambridge
International AS & A Level Psychology 9990, every question from the papers Cambridge publishes on its own site. That is 196
parts from 7 papers: Papers 1 to 3 May/June 2024 (17, 26, 33) and the 2024 specimens of Papers 1 to 4 (17, 23, 30, 50),
196 with their mark schemes cropped (the generic levels tables whole) and 76 with the examiner's comments. Every paper
adds up to Cambridge's printed total (`check_caie_psychology.py`). Scripts in `scripts/question-bank/caie_psychology/`.

**What's public, and so what's here.** As for the other CAIE banks (`cambridge-international.md`): Cambridge keeps its
archive on the School Support Hub, for registered schools; we fetch nothing from it or from mirrors. Its public 9990 page
has May/June 2024 (one time-zone variant of each component: 11, 21, 31, 41), that series's examiner report and the
specimens for exams from 2024. `scope` ("June 2024 and the specimen papers") replaces the year range.

- **Gap: June 2024 Paper 4 (9990/41) has no mark scheme.** Cambridge's public link for it
  (`673843-june-2024-mark-scheme-paper-41.pdf`) is the May/June 2023 scheme of the previous syllabus (its cover says 2023,
  and its Question 1(a) is about SSRIs for OCD where the 2024 paper's is about Freeman et al.). `fetch_caie_psychology.py` leaves a scheme out
  whose cover doesn't carry its series' year. The paper's 51 parts are cut (work folder) but not in the bank, because a
  question with no scheme fails `bank:check`; `build_caie_psychology.py --keep-unmarked` builds them in. The correct
  scheme is on the School Support Hub only. Paper 4 is therefore the specimen only (50 parts).
- **The library hasn't got 9990.** The past paper library's CIE fetcher (`past-papers/boards/cie.py`) doesn't list it, so
  `fetch_caie_psychology.py` imports that file (unchanged) with the syllabus added, downloads the public papers under
  the library's names and `upload_r2.py --pdf-prefix=cie/` puts them where the other CAIE banks' whole-paper links are.
  There's no library page to link to yet.
- **Papers:** 1 Approaches, Issues and Debates (AS), 2 Research Methods (AS), 3 Specialist Options: Approaches, Issues and
  Debates, 4 Specialist Options: Application and Research Methods (A Level). Papers 3 and 4 hold four options (Clinical,
  Consumer, Health, Organisational), a student answering two. As in OCR Psychology, each option is a paper of its own
  (`99903cli`), carrying its `option`, so the Option filter and the paper filter both pick a student's; every option
  paper links the whole paper. The cutter reads each question's option off the paper's headings.
- **Topics** are the syllabus's headings (it has no numbered AS topics): 1 to 4 a topic per core study under its
  approach (12), 5 AS issues and debates, 6 research methods, 7 methodological concepts, and sections A to D for the
  four options, five areas each (`A1 Schizophrenia`, the syllabus's 1.1). AS is Year 1, the options Year 2. A Level
  debates (reductionism, determinism, idiographic) have no topic of their own.
- **Cutting:** `cut_caie_psychology.py` runs `edexcel_sciences/cut_pearson.py` (Cambridge mode), unchanged. Papers 3 and
  4's long answers say "Use Table A: AO1 Knowledge and understanding to mark candidate responses", a generic grid at the
  front of the scheme; it is added under the part's own rows (the specimen Paper 4's is set sideways on two pages).
- **Tags:** Claude tagged every part following `tag/caie-a-level-psychology.md`.

```bash
python3 scripts/question-bank/caie_psychology/fetch_caie_psychology.py
python3 scripts/question-bank/caie_psychology/spec_caie_psychology.py
python3 scripts/question-bank/caie_psychology/cut_caie_psychology.py
python3 scripts/question-bank/caie_psychology/check_caie_psychology.py
python3 scripts/question-bank/caie_psychology/tag_caie_psychology.py split   # tag the batches, then:
python3 scripts/question-bank/caie_psychology/tag_caie_psychology.py merge
python3 scripts/question-bank/caie_psychology/build_caie_psychology.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/caie-psychology --pdf-prefix=cie/
python3 scripts/question-bank/upload_data.py caie-a-level-psychology
```
