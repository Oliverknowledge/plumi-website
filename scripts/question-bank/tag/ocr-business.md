# OCR Business

`ocr_business/tag_ocr_business.py split` writes batches of OCR A-Level (H431) and AS (H031) Business
parts to `.work/ocr-business/tag/`, and `merge` collects them. They were tagged on 3 November 2026 by
Claude subagents with the brief above, with these differences:

- `business-topics.txt` lists the specification's 105 topics: `code | section | title — what learners
  should be able to do`. The specification prints no numbers, so the codes are the bank's own (`5.5`
  Break-even analysis, `7.10` Place); choose from these, never a section like `5`. AS teaches the same
  topics, so one tree serves both.
- Each line has `id`, `marks`, `question` and `scheme`; there is no `setup`, as the case study is in a
  Resource Booklet that most questions don't quote. Tag by the business concept asked, not the
  company's industry.
- Questions 1 to 15 of H431/01 and H031/01 are multiple choice: `scheme` starts with the key ("Key: B.")
  and its rationale; tag the concept tested.
- The long "Evaluate" and "Discuss" questions often span topics: main one first, a second only when the
  scheme's indicative content truly needs it.
