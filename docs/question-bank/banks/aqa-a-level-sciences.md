# AQA A-Level Biology, Chemistry and Physics

Banks: `aqa-a-level-biology`, `aqa-a-level-chemistry`, `aqa-a-level-physics`

The first banks, built 23 October 2026. Their notes are the opening of `docs/seo/question-bank.md`, because every later
bank was built from them, including its "Gaps, honestly" section.

## Biology, November 2026

**Crops:** 28 question crops across 17 questions held a whole notice page, because newer papers print `DO  NOT  WRITE` with
double spaces and `cut.py`'s check only matched single ones. `cut.py` now stops a part at the notice page, and what follows
it, up to the next label, goes to the next part as its setup. Skipping the page without that loses the setup, which a word
count across each question caught. The re-cut compared against a baseline run of the old cutter: only those 28 changed,
marks didn't, and every word in those questions is still there.

**Tags:** 16 moved, after reading each question and its scheme. They're in `scripts/question-bank/tag/aqa-a-level-sciences-corrections.json`,
which `tag_batches.py merge` keeps: Pacinian corpuscles to 3.6.1 (3 parts), stem cells to 3.8.2 (4), Required Practical 6 to
3.4.4 (8), phosphocreatine to 3.6.3 (1). `74023-jun23-01-2` stays in 3.6.2, as it's about the all-or-nothing principle. They
came from a term search over the wording taggers couldn't see, not a full re-tag, so more misfilings may remain.

## Chemistry and Physics, November 2026

**Crops:** the same fix as Biology's, with `cut.py`, which both banks' current papers use: 15 Chemistry crops and 11 Physics crops. Notice pages left seven
parts. Setups that had sat at the end of the part before moved to the question they belong to, and setups the old cut had
lost came back, most of all `74083a-nov20-03-3`, which regains Figures 11 and 12. The legacy papers (`CHEM`, `PHYA`) have
their own cutters and were checked too: no crop holds a notice page, so they weren't re-cut. Marks and paper totals didn't
change. Words only left a question to go to the next one, apart from the notice wording and one line `74083a-jun25-03-2`
and `03-3` both printed. `74042-jun16-08-1`, `74051-spec-05-1`, `74051-spec-07-1` and `74052-spec-04-1` differed only in
spacing and were left alone.

## Physics and Chemistry extended to 2008, November 2026

Both banks now cover **2008–2025**. Physics gains **356 parts** (4,500 → 4,856)
and Chemistry gains **404 parts** (4,346 → 4,750). All 8,846 earlier rows and
search entries are preserved exactly, along with their crop versions and images.

| Bank | January 2008 | June 2008 | January 2009 | June 2009 | Added |
| --- | ---: | ---: | ---: | ---: | ---: |
| Physics | 68 | 139 | 91 | 58 | 356 |
| Chemistry | 93 | 173 | 59 | 79 | 404 |

### Sources and coverage

Daniel approved FreeExamPapers for both subjects on 6 November 2026, **for the
question banks only**. Its 70 source PDFs (including seven examiner reports) are
inventoried with URLs and SHA-256 hashes in `scripts/question-bank/aqa_2008/sources.json`.
The additional eight PHYA1/PHYA2 2009 PDFs come from the already approved PMT
source. No past paper library registration or production deployment is included.

AQA's tested `store.aqa.org.uk/qual/gce/pdf/` and
`filestore.aqa.org.uk/subjects/` PA01/CHM1 June 2008 and CHEM1 January 2009
addresses returned 404. PMT does not list the 2008 papers; its Chemistry unit
pages start at 2010. FreeExamPapers provides the earlier PA/CHM format:

- Physics: PA01, PA02 and PHA3/W, January/June 2008 and January 2009; PA04
  objective and written sections, January/June 2008; June 2008 nuclear
  instability, Astrophysics, Medical, Applied, Turning Points, Electronics and
  the PA10 synoptic unit. PHYA1/PHYA2 January/June 2009 add four further sets.
- Chemistry: CHM1/CHM2/CHM3W/CHM4 January/June 2008, CHM5 and CHM6W June 2008,
  CHM1 January 2009, CHEM1 January/June 2009 and CHEM2 June 2009. The generically
  named `QP.pdf`/`MS.pdf` in January 2009 are the old CHM1 resit, confirmed from
  their covers, and kept separate from CHEM1.
- Practical assessments (`P`, ISA/EMPA and teacher materials) are excluded.
  The approved listings do not provide all 2009 A2/resit units, so this is not
  a claim of complete paper coverage for every unit and series.

Every option is separately filterable and every added paper has its original
unit and an old-specification label. The five Physics options repeat the same
three nuclear-instability parts: the builder keeps them once, in the separately
filterable `PHA5CORE` paper, rather than adding twelve duplicates.

### Crops, marks and topics

The 33 archive sets yield 695 scored parts; the separate 2009 Physics import
adds 111. Topic decisions are reviewed against the current 7405/7408 content:
`aqa_2008/decisions.json` and `aqa_physics_legacy/tags_2009.json` retain those
choices. Thirty-four archive parts (32 Chemistry, two Physics) are excluded
with individual reasons: obsolete extraction processes, magnetic-sector
spectrometry, epoxyethane, silicon tetrachloride hydrolysis, industrial
phenylethene manufacture and obsolete capacitor properties/reactance.

The original schemes often centre labels beside unruled answers. Scheme crops
therefore retain the full question (`msq`) to avoid splitting an answer at its
label. Thirty Chemistry parts whose question boundaries could not be read
reliably link to the complete correct scheme (`msf`). All 70 objective items
have their published answer keys (15 + 15 Physics, 40 Chemistry before off-spec
exclusions). The seven 2009 reports contribute 50 question commentaries: 28
Physics and 22 Chemistry, displayed on 223 included parts, with full report
PDF links too.

The cutter follows inherited labels such as `(b)(ii)`. Prompts sharing one
printed award stay together. Physics's separate two-mark global written
communication award is not assigned to the final question: written parts sum
to 48/43/78/38 rather than 50/45/80/40, while all Chemistry totals and Physics
objective totals match their paper covers. All 33 sets match these awards.

Figures printed after an earlier part's award move into the later parts'
setups. Shared Chemistry objective diagrams (4–6 and 24–25) and the 21–40
answer-code table are supplied as stems. Periodic/data-sheet insert pages and
blank answer pages are not mistaken for questions. The separate 2009 Physics
cutter handles PHYA1 January 6(b)'s shared six-mark award, June PHYA1's plain
labels and the figure June PHYA2 5(b) needs from 5(a).

The new rows include reviewed practical-method flags and Year 13 classification
by today's topic, including thermal physics that was AS in the older course.

### Reproduction and validation

Pull the existing five data files per bank through S3 first. Then:

```bash
python3 scripts/question-bank/aqa_physics_legacy/fetch_pmt.py scripts/question-bank/.work/physics-2009 --from-year 2009 --to-year 2009
python3 scripts/question-bank/aqa_physics_legacy/cut_legacy.py scripts/question-bank/.work/physics-2009
cp scripts/question-bank/aqa_physics_legacy/tags_2009.json scripts/question-bank/.work/physics-2009/tags.json
python3 scripts/question-bank/aqa_physics_legacy/build_legacy.py scripts/question-bank/.work/physics-2009 --append
python3 scripts/question-bank/aqa_2008/fetch_archive.py
python3 scripts/question-bank/aqa_2008/cut_archive.py
python3 scripts/question-bank/aqa_2008/build_archive.py
```

Both existing legacy builders now accept `--append`, preserving earlier rows,
search text and whole-paper links and rejecting changes to existing parts.
The archive builder likewise rejects replacement rows. Do not re-cut published
images under the same names; follow the usual re-cut workflow for future changes.

Validation includes all 760 new rows, crop files/dimensions, stems, scheme/key
availability, all archive mark totals, baseline preservation, visual contact
sheets and specific shared-diagram/award examples. All new rows and crops pass
with zero warnings. `bank:check` has only pre-existing warnings (14 Physics,
53 Chemistry); none belong to this extension. Synthetic format tests cover
inherited labels, shared awards, global writing awards and both objective-key
layouts; the append regression tests cover preservation, idempotency and refusal
to change existing parts.

The 1,712 referenced new assets (about 83 MB) were uploaded without replacing
existing objects and read back by S3 ETag. All ten bank data files were read back
through S3 and verified against their content hashes. The full Next.js production
build passed, generating 8,076 static pages, against a local S3-backed asset
mirror. Direct Node fetches in this managed environment do not use its HTTP
proxy, so the initial public-host build failed with `ECONNREFUSED`; the mirror
uses the same stored data and avoids bulk reads from the student-facing host.

**Still pending:** interactive bank/topic-page browser checks. Automatic approval
review denied the local preview URL and prohibited retrying through another
browser API. The PR remains a draft until that check can be completed with
approval. No browser verification is claimed.
