# Eduqas A-Level sciences

Banks: `eduqas-a-level-physics`, `eduqas-a-level-chemistry`, `eduqas-a-level-biology`

Added 26 October 2026, after students asked for Eduqas Physics:

| Bank | Specification | Components | Series | Questions |
| --- | --- | --- | --- | --- |
| `/question-bank/eduqas-a-level-physics` | A420 (AS B420) | 1-3 (AS 1-2) | June 2016–2025, Autumn 2020–21 | 1,592 |
| `/question-bank/eduqas-a-level-chemistry` | A410 (AS B410) | 1-3 (AS 1-2) | June 2016–19 and 2024–25, Autumn 2020–21 | 1,513 |
| `/question-bank/eduqas-a-level-biology` | A400 (AS B400) | 1-3 (AS 1-2) | June 2016–2025, Autumn 2020–21 | 2,061 |

June 2016 is AS only: the A-Level was first sat in 2017. Eduqas is WJEC's brand for England; the papers are © WJEC CBAC Ltd., credited as "WJEC
Eduqas". The board is "Eduqas" in titles, with its own hub shelf ("Eduqas A-Level").
Papers are called components, as Eduqas does ("Component 1: Newtonian Physics", "AS
Component 2"), and the October–November 2020 and 2021 sittings are "Autumn" (`OCT20`).

- **Papers:** only eduqas.co.uk. `eduqas/fetch_eduqas.py` reads each qualification
  page's tabs from `/umbraco/surface/TabSurface/Get<tab>Tab?qualificationId=…` (the
  page loads them by script): "pastpapers" lists question papers, mark schemes, data
  booklets and large-print papers on pastpapers.download.wjec.co.uk, "keydocuments" the
  specifications and examiner's reports (one per level and series, a section per
  component). Large-print papers are left out. Eduqas files AS Physics June 2018's two
  mark schemes under each other's names: the fetcher files a paper or scheme under the
  component its cover names. Whole papers are in R2 under `eduqas/a420u10-qp-jun24.pdf`
  (the library's own Eduqas copies, `eduqas/EDUQAS-…`, are a different set of names).
- **Cutting:** `eduqas/cut_eduqas.py`, self-contained (cut_pearson.py is untouched).
  WJEC typesets Eduqas's and its own papers the same way, so it should cut WJEC banks
  too. Question papers: labels down the left inside the drawn frame, a bold "3." then
  "(a)" and "(i)" each set with a tab; a label only counts as the next one expected,
  so paragraph numbers in a comprehension stay out; a sub-part label set right of a
  figure still counts by its tab; questions set straight in "(i)", "(ii)" are read as
  such. Trailing answer lines (dotted rules) are left off each crop and pages of nothing
  but answer lines dropped; a full-page graph grid isn't mistaken for the frame. Physics
  Component 1's comprehension article is its question's stem, and a part ends above
  Component 3's option headings ("Option B – Medical Physics"). Schemes: the "Question |
  Marking details | … | Prac" table, its header repeated on most pages (2018's continue
  without it); label pieces sit in the columns left of "Marking details", and a row
  only counts when its label is one the paper has, in order, so a levels table's "4"
  or a numbered answer point never starts a row. The crop is the page's header with the
  part's rows under it, stopping at "Question 3 total" and before the summary of marks.
  It copes with "1." and "5 (a)" labels, "iii" without brackets, "(i) (ii)" sharing one
  cell, "6 (ii)" for 6(d)(ii), "5 (a) (i)" where the paper's (a) has no sub-parts, and
  rows a page leaves unruled at its foot. `scripts/question-bank/labels/a400u20-oct20.json`
  maps one misnumbered scheme ((v), (vi) for the paper's (iv), (v)). Every part has its
  scheme crop except two essays whose scheme rows Eduqas left unlabelled
  (Biology A400U20 Autumn 2020 Q7, AS B400U10 June 2025 Q6): they link the whole scheme.
- **Topics:** `eduqas/spec_eduqas.py`, from the A-Level specifications. Physics and
  Biology number topics within components ("1.2 Kinematics", "3.10 Electromagnetic
  induction"), with the Component 3 options as `3.A`-`3.D` (Year · options); Biology's
  Core Concepts, examined in every component, are `C.1`-`C.5`. Chemistry prints its own
  codes (`C1.3`, `PI2.2`, `OA3.1`; `PI3` and `OA4` have no sub-topics). A topic is AS
  (Year 1) when the AS specification has it, matched by title. AS papers are tagged
  only to AS topics (merge enforces it).
- **Tagging:** `eduqas/tag_eduqas.py split|merge`, briefed by tag.md's Eduqas section.
  Moments, equilibrium and centre of gravity are Physics 1.1 (Basic physics) in this
  specification; `tag/overrides.json` puts 16 parts one reader had under Dynamics there.
- **Practicals:** Eduqas's schemes give each part's practical-skills marks in a "Prac"
  column (`prac` in parts.json). `eduqas/practical_candidates.py` adds those the usual
  net misses to practicals.py's batches; every candidate (1,691) was judged by the usual
  brief, since the column is broader than it (Chemistry credits a reagent for a synthesis
  step). 933 are practical: Physics 219, Chemistry 357, Biology 357.
- **Gaps:** Eduqas puts papers up a year after the exam (June 2026 next autumn) and
  doesn't publish some: no A-Level Physics question papers for June 2022 (only
  large-print copies of two components), no Chemistry question papers for June 2022 or
  2023 (A-Level or AS), and no AS Physics or AS Chemistry autumn sittings. Examiner's
  reports: none for Autumn 2021, AS Physics June 2019, 2022 or 2025, or AS Biology Autumn
  2021, and the June 2025 Chemistry and Biology reports are a summary with no comments on
  questions.

```bash
python3 scripts/question-bank/eduqas/fetch_eduqas.py              # --only=physics; prints the gaps
python3 scripts/question-bank/eduqas/spec_eduqas.py
python3 scripts/question-bank/eduqas/cut_eduqas.py                # --only=a420u10-jun24; --debug prints scheme labels
python3 scripts/question-bank/eduqas/tag_eduqas.py split          # tag, then: merge
python3 scripts/question-bank/eduqas/build_eduqas.py
python3 scripts/question-bank/practicals.py split --only=eduqas-a-level-physics,eduqas-a-level-chemistry,eduqas-a-level-biology --parts=scripts/question-bank/.work/eduqas-sciences/parts.json
python3 scripts/question-bank/eduqas/practical_candidates.py      # judge, then: practicals.py merge
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/eduqas-sciences --pdf-prefix=eduqas/
```
