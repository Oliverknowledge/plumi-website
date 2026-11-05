# Year 12 / Year 13: A-Level Business and Economics

Part of the Year 12 / Year 13 switch described in [Year 12 and Year 13](../seo/question-bank.md). This page is separate so the split PRs don't edit the same lines.

**Business and Economics (5 November 2026)** get the same switch for AQA, Edexcel (Business,
Economics A, Economics B), OCR and WJEC. Their topics already say which year they are, so
questions weren't judged one by one (a sample of each side was read): `business_economics_years.py build` marks a part Year 13 when
it is on WJEC's Unit 3, or when any of its topics is second-year content in the board's own
specification; AS-paper parts and parts on first-year topics are Year 12. Edexcel Business and
Economics B have no AS papers in the bank, but Pearson has centres teach Themes 1 and 2 in the
first year (Business: every Theme 1 and 2 sub-topic is in the AS specification) and Themes 3
and 4 in the second, so the themes decide. The script's docstring lists each board's source.
After a new series, rerun `build` (a new topic needs a line in the script only for OCR Business).
