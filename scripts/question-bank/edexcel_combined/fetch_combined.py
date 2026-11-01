"""Fetch Pearson Edexcel's own GCSE (9–1) Combined Science (1SC0) papers.

    python3 scripts/question-bank/edexcel_combined/fetch_combined.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-combined

edexcel_gcse/fetch_gcse.py for 1SC0, from the same search ("gcse16-science"). 1SC0 has twelve
papers, named by paper, science and tier: 1BF is Biology Paper 1 Foundation, 2CH Chemistry
Paper 2 Higher. November 2020 onwards are single PDFs; June 2018 is a zip per science and tier
("combined-science-biology-higher-tier.zip"), June 2019 a zip per tier ("combined-higher-papers-
2019.zip"). Pearson keeps June 2026 for teachers only, so it comes back as a page and is skipped.
The specimen papers (one book of all twelve) aren't fetched: the separate sciences' own books
hold most of the same questions, and AQA's Trilogy bank leaves its specimens out too.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf ("1sc0-2ch-ms-jun22.pdf") and
<work-dir>/manifest.json in fetch_pearson.py's shape. Polite and cached.
"""
import io, json, os, re, sys, time, urllib.parse, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-combined")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_gcse"))
import fetch_gcse as fg  # noqa: E402

# 1sc0-2ch-que-20220621.pdf, 1SC0_1PH_que_20211124.pdf, 2018's "1SC0_1BF_Exam paper_20180515.pdf"
NAME = re.compile(r"(1sc0)[-_ ]?([12][bcp][fh])[-_ ]", re.I)
ZIP = re.compile(r"combined[- ](?:science[- ](?:biology|chemistry|physics)[- ](?:foundation|higher)[- ]tier|(?:foundation|higher)-papers-2019)\.zip")


def main():
    files = {}
    records = fg.listed()
    print(f"{fg.SPEC}: {len(records)} documents listed", file=sys.stderr)
    for r in records:
        url, title = r.get("url", ""), re.sub(r"\s+", " ", r.get("title", "")).strip()
        cats = r.get("category", [])
        series = next((c.split("/")[-1] for c in cats if c.startswith("Pearson-UK:Exam-Series/")), None)
        name = os.path.basename(url)
        if name.lower().endswith(".zip"):
            if not ZIP.fullmatch(name.lower()):
                continue  # the separate sciences, mocks, modified papers
            body = fg.cached(fg.BASE + urllib.parse.quote(url), name)
            if not body:
                continue
            year = "19" if "2019" in name else "18"
            with zipfile.ZipFile(io.BytesIO(body)) as zf:
                for member in zf.namelist():
                    base = os.path.basename(member)
                    m, kind = NAME.search(base), fg.kind_of(base)
                    if m and kind and base.lower().endswith(".pdf"):
                        fg.keep(files, f"1sc0-{m.group(2).lower()}", kind, f"JUN{year}", title, fg.BASE + url, base, zf.read(member))
            continue
        kind = next((fg.DOC_TYPES[c.split("/")[-1]] for c in cats if c.startswith("Pearson-UK:Document-Type/") and c.split("/")[-1] in fg.DOC_TYPES), None)
        m = NAME.search(name)
        if not (kind and series and m and name.lower().endswith(".pdf")) or series.split("-")[0] not in fg.MONTHS:
            continue
        kind = fg.kind_of(name) or kind
        mon, year = series.split("-")
        fg.keep(files, f"1sc0-{m.group(2).lower()}", kind, fg.MONTHS[mon] + year[2:], title, fg.BASE + url, name)

    manifest, restricted = [], []
    old_path = os.path.join(WORK, "manifest.json")
    before = {f["file"]: f["pearsonName"] for f in json.load(open(old_path))} if os.path.exists(old_path) else {}
    for slot, f in sorted(files.items()):
        out = os.path.join(fg.PDF, f"{f['component']}-{f['kind']}-{f['series'].lower()}.pdf")
        if os.path.exists(out) and before.get(os.path.basename(out), f["pearsonName"]) != f["pearsonName"]:
            os.remove(out)
        body = f.pop("body", None)
        if not os.path.exists(out):
            body = body or fg.download(urllib.parse.quote(f["source"], safe=":/"))
            if not body or not body.startswith(b"%PDF"):
                restricted.append(f"{f['component']} {f['kind']} {f['series']}")
                continue
            open(out, "wb").write(body)
            time.sleep(0.4)
        f["file"] = os.path.basename(out)
        f["bytes"] = os.path.getsize(out)
        manifest.append(f)
    json.dump(manifest, open(old_path, "w"), indent=1)
    print(f"{len(manifest)} files, {sum(f['bytes'] for f in manifest) / 1e6:.0f} MB in {fg.PDF}", file=sys.stderr)
    print(f"not public ({len(restricted)}): " + "; ".join(restricted), file=sys.stderr)


if __name__ == "__main__":
    main()
