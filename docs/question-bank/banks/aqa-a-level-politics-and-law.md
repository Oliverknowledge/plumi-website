# AQA A-Level Politics and Law

Banks: `aqa-a-level-politics`, `aqa-a-level-law`

Added 1 November 2026: `/question-bank/aqa-a-level-politics` and `/question-bank/aqa-a-level-law`,
every question from AQA's A-Level Politics (7152) and Law (7162) papers on AQA's own site. Both
specifications were first sat in June 2019, but AQA's page and file store only hold November 2020,
November 2021 and June 2022 to June 2025 (June 2019 404s, as for the other AQA essay banks; June
2020 and 2021 were cancelled). There is no AS in either.

- **Politics: 120 questions, 17 papers.** Papers 1 (the UK), 2 (the USA and comparative politics)
  and 3 (political ideas). Each is three 9-mark questions (01-03), a 25-mark extract question
  (04) and a choice of 25-mark essays: 05 or 06 in Papers 1 and 2, one of 05-09 (one per other
  ideology) in Paper 3. 06 onwards carry `or`, so every paper adds up to its 77 marks.
- **Extracts as stems.** Question 04's extracts ("Read the extracts below and answer question 4")
  are its stem, `71521-jun24-ex-stem.webp`, and its id names them: `71521-jun24-ex-04`. The
  extracts sit in a ruled box, so `cut_politics.py` frames the page without `cut_sociology.py`'s
  answer-box borders (which would have stopped the page at the box).
- **Politics schemes.** Each section's levels grid is printed once, before the section's
  indicative content. A question's crop is its indicative content (label to the next label or
  section, across pages) with the section's grid stacked under it, so every crop has both.
- **Law: 264 questions, 24 papers.** Papers 1 (criminal law and the legal system), 2 (tort and
  law and society), 3A (contract) and 3B (human rights), each with the nature of law. Every paper
  is the same eleven questions, all compulsory, for 100 marks: five 1-mark multiple-choice
  questions, then 5, 5, 10, 15, 30 and 30 marks.
- **The option.** Paper 3A and 3B carry `option` (`contract`, `human-rights`) and so do the
  Contract and Human rights sections, and the bank has `options` ("Option"), so the page's option
  filter keeps one Paper 3 and its topics. Their topics are year 3 ("Paper 3 options").
- **Scenarios** are printed between a question's label and its own words, so each Law question
  is whole, label to marks, and its crop always has its scenario. Multiple-choice questions run
  past their marks to the options (to the next label or the page's foot) and carry their answer
  letter (`k`) instead of a scheme crop. Every other question's scheme is its own levels grid and
  indicative content, label to label.
- **Topics.** Politics uses the specification's own numbers (`3.1.2.2`): six sections, 32 topics.
  Law's content table has no numbers, so, as OCR Law and Edexcel Politics, topics are coded by
  section and place (`CR.4` fatal offences): the nature of law (NL), law making (LM), the legal
  system (LS), criminal law (CR), tort (TO), contract (CO) and human rights (HR), 55 topics.
  Tagged by reading each question (tag.md's "AQA Politics" and "AQA Law"). Every Politics topic
  has questions; seven Law topics have none: the umbrella "rules of" rows (criminal law, tort,
  contract, human rights), tort theory, human rights before the 1998 Act and the Convention as a
  whole (its articles have their own topics). Reports are keyed by question (`reportsBy:
  "question"`): Politics 78 questions, Law 176 (AQA has no reports for the November series).
- **Pipeline.** `scripts/question-bank/aqa_politics/` and `aqa_law/`: `fetch_*` (fetch_aqa.py
  over each spec), `spec_*`, `cut_*` (cut_sociology.py imported and patched for the run, so it
  is unchanged), `tag_*`, `build_*`. Whole papers are on R2 under `aqa/AQA-7152*` and
  `aqa/AQA-7162*`; crops under `bank/7152*` and `bank/7162*`.

**Gaps:**
- Politics Paper 1, June 2025: AQA has published its scheme and report but not its question
  paper (it isn't on the page or the file store), so the sitting is left out and the bank's note
  says so.
- No mirror (PMT or other) is used for June 2019; that needs the founder's say-so.
- Specimen papers are left out, as in the other AQA banks.

```bash
python3 scripts/question-bank/aqa_politics/fetch_politics.py
python3 scripts/question-bank/aqa_politics/spec_politics.py
python3 scripts/question-bank/aqa_politics/cut_politics.py
python3 scripts/question-bank/aqa_politics/tag_politics.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_politics/tag_politics.py merge
python3 scripts/question-bank/aqa_politics/build_politics.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-politics
# and the same five steps with aqa_law/*_law.py, uploading .work/aqa-law
```
