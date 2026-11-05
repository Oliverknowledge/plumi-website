# AQA GCSE German

Added 3 November 2026: `/question-bank/aqa-gcse-german`, on the GCSE shelf beside French, Spanish and
Bengali, built with the same pipeline (`scripts/question-bank/aqa_gcse_languages/`, run with its own work
directory). Every file is AQA's own, from the German 8668 and 8662 assessment-resources pages. Whole papers
are on R2 under AQA's names (`aqa/AQA-8668RH-QP-JUN24.pdf`), the crops under `bank/8668*` and `bank/8662*`,
and the Listening recordings under `aqa/audio/` (`aqa/audio/8668lh-jun24-07.mp3`). There is no German
past-paper library page to link to.

- **1,211 parts in 42 papers:** Listening, Reading and Writing, Higher and Foundation, for November 2020,
  November 2021 and June 2022 to June 2025 (June 2018 and 2019 are withdrawn from AQA's site), plus the
  8662 specimens. Every part has its marks, its topics (all 1,211) and its own scheme crop; every paper adds
  up to its marks, less the left-out questions below. 226 questions have the examiner's comments (no
  reports for November 2021, the Foundation papers of November 2020, or Higher Writing June 2022). `tiers.json` pairs 168
  Foundation parts with their Higher copies.
- **Listening with AQA's recordings:** all 521 Listening parts play their question's track (`au`); November
  2020 has only the whole recording (`auw`, 78 parts). The specimens' dictations join their sentence tracks.
- **The 2026 specification (8662).** First examined in June 2026; AQA has published only its specimens so
  far, which are in the bank as "2026 specimen" with the "Specification" filter, as French and Spanish do.
  How they differ: new themes (People and lifestyle; Popular culture; Communication and the world around
  us), set vocabulary; Listening adds a dictation (Section B, 8 marks Foundation, 10 Higher); Reading is 50
  marks (not 60) and ends with a translation into English (Section B, 10 marks), its first questions
  short items on set vocabulary; Writing is 50 marks at both tiers (Higher was 60), Foundation adding a
  grammar gap-fill (5 marks) and Higher three tasks: a translation (10), a choice of 90-word tasks (15) and
  of 150-word tasks (25). The specimens are tagged to the old topic list, as French and Spanish do.
- **Left out:** Paper 2 Speaking; 8 Reading questions whose texts AQA removes from the copyright-removed
  copies it publishes (Foundation June 2023 Q6 and Q11, November 2021 Q6; Higher June 2022 Q4, June 2023
  Q3 and Q8, November 2020 Q5): 29 marks; the old specification's 2016 specimens; modified papers.
- **Cutter fixes made for German, shared with French, Spanish and Bengali** (`cut_gcse_languages.py`):
  a crop edge that would slice an answer box or a line of text moves above it (`clear_edge`); a title set
  below a separator rule, or at the question's first line rather than a table's left column, moves on to
  the next question; a part whose own start is only "Answer both parts of the question." shows the
  question before's start; the paper's last crop stops at "END OF QUESTIONS"; the next task's routing
  ("Answer either Question 4.1 or Question 4.2.") is cut from the foot of a Writing crop; a specimen's
  dictation never takes a shared start; a scheme's first label under a "Section B" heading starts at the
  heading (the specimens' Reading translation); a specimen scheme's row keeps its own "Qu | Accept | Mark"
  heading; a specimen's first Reading question takes the text on the page before its label; marks at the
  frame's edge stay whole. French, Spanish and Bengali haven't been re-cut with them.

```bash
python3 scripts/question-bank/aqa_gcse_languages/fetch_gcse_languages.py scripts/question-bank/.work/aqa-gcse-german --lang=german
python3 scripts/question-bank/aqa_gcse_languages/cut_gcse_languages.py scripts/question-bank/.work/aqa-gcse-german   # needs ffmpeg
python3 scripts/question-bank/aqa_gcse_languages/tag_gcse_languages.py split scripts/question-bank/.work/aqa-gcse-german   # tag the batches, then:
python3 scripts/question-bank/aqa_gcse_languages/tag_gcse_languages.py merge scripts/question-bank/.work/aqa-gcse-german
python3 scripts/question-bank/aqa_gcse_languages/build_gcse_languages.py scripts/question-bank/.work/aqa-gcse-german
python3 scripts/question-bank/tiers.py aqa-gcse-german
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-gcse-german
```
