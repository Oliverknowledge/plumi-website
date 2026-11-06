# Edexcel Maths legacy extension

This adds the public UK C1–C4, S1 and M1 papers from 2010–2018. It keeps all
444 existing current-specification questions and their solutions unchanged.
Legacy questions have six explicit **Legacy modules** topic filters. These are
module classifications, not claims that the content follows today's syllabus.
C3/C4 are A2 modules; C1/C2/S1/M1 are legacy AS modules.

Only Pearson's public index and PDF URLs are used. January, June and regional
papers are distinct. Descriptive 2014 filenames and the spaced older paths are
handled. June 2011 C1 is recovered from Pearson's mistyped `00110518` filename;
its cover confirms 18 May 2011. The import includes 270 source PDFs, 90 question
papers and 759 questions. All 90 papers total 75 marks.

## Reproduce

Use Python with PyMuPDF, Pillow and boto3, plus Tesseract English data. The cloud
machine has the first two and Tesseract. Prepare the SDK environment if needed:

The extraction was validated with PyMuPDF 1.26.6 and Pillow 13.0.0; preserve these
versions when reproducing existing immutable crop objects.

```bash
python3 -m venv --system-site-packages /tmp/plumi-r2-venv
/tmp/plumi-r2-venv/bin/pip install boto3==1.43.126
source /tmp/plumi-r2-venv/bin/activate
```

Use the four `R2_*` process variables, never values in tracked files. The R2
helper trims whitespace in memory and selects a separate Cloudflare profile.

From the checkout root, choose a fresh ignored work directory. Obtain the
original baseline metadata from commit `c1e7517` (before this import), rather
than taking a new snapshot of an already extended bank:

```bash
work=scripts/question-bank/.work-edexcel/legacy
git show c1e7517:src/content/questionBank/edexcel-a-level-maths.json > /tmp/plumi-baseline-meta.json
python3 scripts/question-bank/edexcel_legacy/r2_legacy.py snapshot "$work" /tmp/plumi-baseline-meta.json
python3 scripts/question-bank/edexcel_legacy/fetch_legacy.py "$work"
python3 scripts/question-bank/edexcel_legacy/cut_legacy.py "$work"
```

Three June 2013 regional papers have a broken font encoding, rather than an
absent text layer. OCR derivatives are local only; original source PDFs are
never rewritten or replaced on R2. Repair those sets, then append:

```bash
for code in 6663 6665 6666; do
  python3 scripts/question-bank/edexcel_legacy/cut_legacy.py "$work" --only="$code-01r-jun13" --ocr || exit 1
done
python3 scripts/question-bank/edexcel_legacy/append_legacy.py "$work"
```

The append step fails on duplicate IDs, empty papers, missing crops/marks, or
paper totals other than 75. It reconstructs from the baseline, so rerunning it
does not duplicate questions. The current-only builder must not be run over the
combined bank without subsequently restoring the legacy extension.

Review the question and scheme crops, including crop-edge warnings. The legacy
cutter fixes the centred A4 canvas in oversized 2010 PDFs, uses a bounded scheme
label matcher, and preserves superscript fractions and vectors above the first
line. OCR answer rules are distinguished from graph axes. OCR search text is
approximate; the displayed crops retain the original printed questions.

Upload only after validation:

```bash
python3 scripts/question-bank/edexcel_legacy/r2_legacy.py upload "$work"
python3 -m unittest discover -s scripts/question-bank/edexcel_legacy -p 'test_*.py'
npm run bank:check -- edexcel-a-level-maths
npm run bank:status -- --check
npm run lint
npm run typecheck
npm run pdf:test
```

For the full static build, use the read-only S3 mirror to avoid bulk requests
to the student-facing `r2.dev` host. Start it in one terminal, then build in
another:

```bash
python3 scripts/question-bank/edexcel_legacy/serve_assets.py --port 3033
# In a separate terminal:
NEXT_PUBLIC_PAPERS_URL=http://127.0.0.1:3033 npm run build
```

This override is for local validation. Deployment builds use their configured
public asset address. The mirror checks content hashes, shares concurrent reads
and exposes only bank assets on loopback. Restart it for a new session.

New crops use `bank/legacy-edx-…` and original papers `edexcel-legacy/…`.
The uploader refuses to replace a different immutable object, verifies every
ETag and reads back JSON bodies before saving the new data hashes. Existing
solutions are retained. Uploading stages data; it does not merge or deploy.
