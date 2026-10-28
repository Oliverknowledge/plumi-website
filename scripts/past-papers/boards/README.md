# Our own past paper library: one fetcher per board

Every file on `/past-papers` is our own copy of the exam board's paper, fetched from
the board's own website and served from R2. Nothing links to Physics & Maths Tutor
or any other site.

Each board has a fetcher here, `boards/<board>.py`. It downloads into
`scripts/past-papers/.work/<board>/` (gitignored) and writes the same thing:

```
.work/<board>/pdf/<file name>.pdf     the board's PDF, unmodified
.work/<board>/manifest.json           one entry per file, below
.work/<board>/gaps.md                 what the board doesn't publish publicly, and why
```

## manifest.json

A JSON list, one object per downloaded file:

```json
{
  "subject": "a-level-maths",
  "board": "ocr",
  "group": "A-Level (H240)",
  "paper": "Paper 1: Pure Mathematics",
  "code": "H240/01",
  "series": "JUN23",
  "kind": "qp",
  "source": "https://www.ocr.org.uk/Images/....pdf",
  "file": "ocr/OCR-H240-01-QP-JUN23.pdf"
}
```

- **subject:** one of the library's slugs: `a-level-maths`, `a-level-further-maths`,
  `a-level-biology`, `a-level-chemistry`, `a-level-physics`, `gcse-maths`,
  `gcse-biology`, `gcse-chemistry`, `gcse-physics`.
- **board:** the library's board slug: `aqa`, `edexcel`, `ocr`, `ocr-mei`, `wjec`,
  `eduqas`, `cie`, `edexcel-ial`, `cie-igcse`, `edexcel-igcse`.
- **group:** the heading the paper sits under on the board page, one per
  specification or tier, e.g. `A-Level (H240)`, `AS (H230)`, `Biology A (H420)`,
  `Higher tier (J560)`, `Foundation tier (J560)`. Legacy specifications get a group
  of their own ending in `, legacy` (e.g. `A-Level (H440), legacy`).
- **paper:** the paper's name as a student would say it, with the board's title
  after a colon where it has one: `Paper 1: Pure Mathematics`, `Paper 2 (Higher)`,
  `Unit 3: Pure Mathematics B`.
- **code:** the component code as the board prints it: `H240/01`, `9709/12`, `1MA1/1H`.
- **series:** month and two-digit year: `JAN`, `FEB`, `MAR`, `MAY`, `JUN`, `OCT`,
  `NOV` + `yy` (`JUN23`, `MAR24`), or `SPEC` for specimen papers. Cambridge's
  variants (9709/11, /12, /13) are separate codes, not separate series.
- **kind:** `qp` question paper, `ms` mark scheme, `er` examiner's report, `ins`
  insert or pre-release material, `db` data, formula or source booklet that belongs
  to the paper, `gt` grade thresholds. Anything else, leave out.
- **source:** the URL the file was downloaded from, on the board's own domain.
- **file:** the R2 key: `<board>/<board-prefix>-<code with / as ->-<KIND>-<series>.pdf`,
  upper case except the folder, unique across the whole bucket.

## Rules

- Only the board's own website (and the CDN its own pages link to). Never a
  third-party mirror, never anything behind a login, never a paywall.
- Polite: one request at a time, a short sleep between downloads, a real browser
  User-Agent, cached so a re-run fetches only what's missing.
- Check every download starts with `%PDF`; skip and log anything that doesn't.
- Modified, large-print and Braille versions are skipped.
