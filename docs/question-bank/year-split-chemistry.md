# Year 12 / Year 13: A-Level Chemistry

Part of the Year 12 / Year 13 switch described in [Year 12 and Year 13](../seo/question-bank.md). This page is separate so the split PRs don't edit the same lines.

**A-Level Chemistry** (all seven banks, 5 November 2026) has the same switch, but chemistry topics
already belong to a year (each topic's `year`, set from the board's own specification), so
`chemistry_years.py` decides by rule rather than by reading every question: an AS paper's
questions are Year 12; any other question is Year 13 if any of its topics is a second-year
topic, else Year 12; a short `OVERRIDES` list holds the parts read by hand against the
specification (chromatography and high-resolution NMR are A-level only at Eduqas, for
example). That includes the A2-only units (WJEC 3-4, Cambridge 4-5, AQA's old CHEM4/CHEM5):
their first-year-topic parts stay Year 12, because a Year 12 student can do them. AQA's
2010-2016 papers take today's year for the topic they were sorted into (old CHEM1/CHEM2 are
AS units: Year 12). After a new series: build the bank, `upload_data.py --pull` the other
files, run `chemistry_years.py`, then `upload_data.py <slug>`.
