# Eduqas Religious Studies

`eduqas_rs/tag_eduqas_rs.py split` writes Eduqas's A Level (A120) and AS (B120) Religious
Studies parts to `.work/eduqas-rs/tag/`, one batch per area (`batch-A.jsonl` Christianity
… `batch-F.jsonl` Sikhism, `batch-P.jsonl` Philosophy of Religion, `batch-R.jsonl`
Religion and Ethics), and `merge` collects them. The brief is the one in `tag.md`, with
these differences:

- `rs-<area>-topics.txt` lists the area's 24 topics, one per line: `code | Theme N: … |
  title [AS] or [A-Level only] — what the specification says under it`. A code is the
  area, the theme and the section's letter (`B.2D`, Islam Theme 2D, Salah). Choose only
  from the batch's own area's file.
- Each line is one essay part: `(a)` asks for knowledge (examine, explain), `(b)` gives a
  quotation to evaluate. A `(b)` line carries its question's `part_a`: the two parts are
  usually on the same section, but a `(b)` can turn to a neighbouring one, so judge `(b)`
  by its own quotation and scheme.
- `report_says` is the examiner's report's own note of what the question tested
  ("Theme 1E: The role of shari'a …"). On an A-Level paper it is the topic code's theme
  and letter. On an AS paper the themes are numbered as the AS specification numbers
  them, which differs from these codes (AS Islam's Theme 3A is the A Level's `B.2D`):
  match it by its title.
- AS papers take only `[AS]` topics; merge drops any other.
- One code nearly always: a second only where the part plainly asks about two sections
  (a comparison of Natural Law with Situation Ethics, say).
