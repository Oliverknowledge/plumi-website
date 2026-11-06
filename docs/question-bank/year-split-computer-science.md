# Year 12 / Year 13: A-Level Computer Science

Part of the Year 12 / Year 13 switch described in [Year 12 and Year 13](../seo/question-bank.md). This page is separate so the split PRs don't edit the same lines.

**A-Level Computer Science** (AQA, OCR, Eduqas; 5 November 2026) has the switch too, but is split by a
map, not by reading: `scripts/question-bank/computer_science_years.py build` writes the three `year13.json`
files, then `upload_data.py` ships them. An AS paper's questions are Year 12; a full A-Level paper's question is
Year 13 when it is tagged a topic only the A-Level specification teaches (AQA's 4.2.2-4.3.x, 4.4.3-4.4.5, 4.9.3-4.12;
OCR's 1.3.1, 2.1.5, 2.2.2; Eduqas's 1.6) or its wording has something only the A-Level adds inside a topic both teach
(recursion, object-oriented programming, linked lists / trees / graphs, floating point errors, interrupts, SQL and
normalisation, merge / quick sort, Dijkstra, Big O…). The rules and where each comes from (the boards' AS and A-Level
specifications side by side; AQA's is one document) are in the script's docstring and `RULES`. Cambridge's
Computer Science (9618) isn't split here.
