# OCR History A

`ocr_history/tag_ocr_history.py split` writes the OCR A-Level History A (H505) questions to
`.work/ocr-history/tag/`, and `merge` collects them. The brief is the one in `tag.md`, with these
differences:

- `history-topics.txt` lists every unit's key topics: `code | unit | [kind] title — what learners
  should have studied`. The specification doesn't number them, so the codes are the unit's and
  the topic's place in it (`Y106.3` is Henry VIII and Wolsey). `kind` is `enquiry` (a Unit 1
  unit's enquiry topic), `period` (its British period study, or a Unit 2 unit), `theme` (a Unit 3
  unit's thematic study) or `depth` (its three in-depth interpretation topics).
- A question only tests its own unit, so each line carries `topics`, the codes it may choose
  from: a Unit 1 source question (Question 1) its enquiry topic's, a Unit 1 essay its period
  study's, a Unit 3 interpretations question (Question 1) its depth studies, a Unit 3 essay its
  thematic study's, a Unit 2 question its unit's. merge keeps only those codes.
- Tag by what the question asks and its scheme's indicative content, not by every source or
  passage it prints. A source question on one key topic is that topic; an interpretations
  question is the one depth study its passages debate.
- Unit 3 essays span the whole period ("How far do you agree with this view of the period
  1855–1964?"): give the thematic key topic the question is about, and a second only when the
  question names two strands (government and the economy, say).
- Unit 2 (a) questions weigh two factors and (b) questions are essays; give each the key topic
  its period falls in, and a second where its dates or factors genuinely cross two.
