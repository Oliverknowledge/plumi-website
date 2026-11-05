# Edexcel International GCSE Biology, Chemistry and Physics

Banks: `edexcel-igcse-biology`, `edexcel-igcse-chemistry`, `edexcel-igcse-physics`

`/question-bank/edexcel-igcse-biology`, `-chemistry` and `-physics`, added 1 November 2026: every
question from Pearson Edexcel's International GCSE Biology (4BI1), Chemistry (4CH1) and Physics
(4PH1) papers that Pearson publishes, June 2019 to June 2025 with the January series of 2020 to
2023 and November 2020, 2021, 2023 and 2024. That is 6,173 question parts from 144 papers
(Biology 1,862, Chemistry 2,333, Physics 1,978), cut part by part with their mark scheme rows and
examiner's reports. Every paper adds up to its 110 (Paper 1) or 70 (Paper 2) marks. The hub shows
them as "Edexcel International GCSE" on the GCSE & IGCSE shelf, after the GCSE boards, as
Cambridge IGCSE is (`bankLevel`; Edexcel International GCSE Maths A uses the same naming).

- **Papers:** Paper 1 is sat for the subject and for Science (Double Award), the same paper with
  both codes (4BI1/1B and 4SD0/1B); Paper 2 only for the subject. No tiers. Each June and January
  paper also comes in an "R" version (4BI1/1BR), a different paper sat in other time zones: it is
  its own series ("JUN24R", "June 2024 (R)"), as Cambridge's second variant is, so the paper
  filter stays Paper 1 and Paper 2.
- **Source papers:** Pearson's own site only, through the same search index as the past paper
  library (`fetch_igcse.py` imports `scripts/past-papers/boards/edexcel.py`). Pearson's file
  names carry a date, not a series, and January 2020's papers are dated March (results day), so
  each file's series is read off its cover ("Mark Scheme (Results) January 2022"). The papers
  printed for May 2020 were sat in November 2020, the series their schemes name. Summer 2021's
  papers were published as assessment materials with provisional then final schemes; they are
  June 2021. Whole papers are on R2 under `edexcel-igcse/` (`4bi1-1b-qp-jun24r.pdf`), crops
  under `bank/`.
- **Topics:** the specifications' own lettered sub-topics ("2(e) Nutrition", coded `2e`), 22
  Biology, 28 Chemistry, 22 Physics; the tiles are its numbered topics. Physics's "Units"
  sub-topics are left out.
- **Cutting:** `cut_igcse.py` runs `edexcel_gcse/cut_gcse.py` (so `cut_pearson.py`) with one more
  patch, here only: "END" is read in capitals, so a diagram's "end" label (a burette) doesn't end
  a part. Chemistry 1C June 2019's question openings are pictures and Physics 1P June 2019 is a
  scan; OCR misses their question numbers, so both are read from hand labels
  (`labels/4ch11c-jun19.json`, `labels/4ph11p-jun19.json`, drafted from each "(Total for
  Question N" line and the OCR'd part labels, then checked against the marks). Two marks are set
  by hand: Chemistry 1C June 2019 11(a) and Chemistry 2CR June 2019 6(b).
- **Tags and practicals:** tagged by Claude following `tag.md` ("Edexcel International GCSE
  sciences"); practicals judged as for the other science banks.

Gaps, honestly:
- Pearson keeps November 2025 and June 2026 for teachers, and publishes nothing for November
  2022, so those aren't in. Pearson ran no January series after 2023, and its specimen papers
  (2017) are left out, as the brief was 2019 onwards.
- Chemistry's June 2019 schemes split each label across narrow columns ("3", "a", "i"), which
  `ms_tables` doesn't read; `ms_fallback.py` crops most of those parts' rows, and the rest link
  the whole scheme.
- Science (Double Award) 4SD0 isn't a bank of its own. Its Paper 1s are these banks' Paper 1s
  (same papers, both codes on the cover), so a 4SD0 bank would be the three Paper 1 filters put
  together: a new `BankSubject` built from these parts, no new cutting.

```bash
python3 scripts/question-bank/edexcel_igcse/fetch_igcse.py
python3 scripts/question-bank/edexcel_igcse/spec_igcse.py
python3 scripts/question-bank/edexcel_igcse/cut_igcse.py          # --only=4bi11b-jun26 for one paper
python3 scripts/question-bank/edexcel_igcse/tag_igcse.py split    # tag the new batches, then:
python3 scripts/question-bank/edexcel_igcse/tag_igcse.py merge
python3 scripts/question-bank/edexcel_igcse/build_igcse.py
python3 scripts/question-bank/practicals.py split --only=edexcel-igcse-biology,edexcel-igcse-chemistry,edexcel-igcse-physics --parts=scripts/question-bank/.work/edexcel-igcse/parts.json   # judge, then merge
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-igcse --pdf-prefix=edexcel-igcse/
python3 scripts/question-bank/ms_fallback.py cut --bank=edexcel-igcse-chemistry   # and -biology, -physics; upload --crops-only --checksum, then apply
```
