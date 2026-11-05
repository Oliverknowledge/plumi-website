# AQA Geography

`aqa_geography/tag_geography.py split` writes batches of AQA A-Level (7037) and AS
(7036) Geography parts to `.work/aqa-geography/tag/`, and `merge` collects them. The
brief is the one in `tag.md`, with these differences:

- `geography-topics.txt` lists one topic per line: `code | area | title — the
  specification's words`. Codes have four numbers (`3.1.3.2`, `3.2.4.4`), except the
  fieldwork area's (`3.3.1`-`3.3.5`, the stages of a fieldwork enquiry, which the
  specification doesn't number); choose from these, never an area like `3.1.3`.
- Each line has its `paper`, its `area`, its `marks`, the part's own `question` (an AS
  multiple-choice part lists its options A-D), its `setup` (the lines above it,
  "Figure 4 shows…") with the insert `figures` it is set on, and the start of its
  `scheme`.
- **Every code must be in the line's `area`**: the area is the question the part is
  printed in, and each option is its own area (deserts `3.1.2`, coasts `3.1.3`,
  glaciers `3.1.4`, hazards `3.1.5`, ecosystems `3.1.6`, urban `3.2.3`, population
  `3.2.4`, resources `3.2.5`), so a student who studies coasts never meets a glaciers
  part. The merge rejects a code from another area. A second code, only when the part
  genuinely needs two topics, comes from the same area.
- Each area's last topics are `Quantitative and qualitative skills` and `Case studies`.
  A part that asks to analyse, interpret or calculate from a figure ("Analyse the data
  shown in Figure 3", the 6-mark AO3 parts) is tagged to the content the data is about
  (rainfall and vegetation change in the Sahara: `3.1.2.4` desertification), with the
  area's skills topic second when the part is mainly a data skill (a mean, a standard
  deviation, a graph to complete). A 20-mark essay "with reference to a <place> you have
  studied" or "a case study of…" is tagged to the content it asks about first, with the
  area's `Case studies` topic second. Changing places' `3.2.2.4 Place studies` is for
  questions on the student's own local or distant place study.
- AS Paper 2 Section B (area `3.3`, questions 02-04) is fieldwork: `3.3.1` planning,
  aims, hypotheses, sampling, risk and ethics, choosing a site; `3.3.2` collecting
  primary and secondary data (questionnaires, interviews, census data, measurements);
  `3.3.3` presenting data (maps, graphs, completing a figure); `3.3.4` analysing data
  and statistics (median, interquartile range, standard deviation, Spearman's rank,
  significance); `3.3.5` conclusions, evaluating reliability and the enquiry, and how
  it could be developed. The scenario (a town survey, a peat depth study) doesn't
  matter: tag the stage of the enquiry the part asks about.
