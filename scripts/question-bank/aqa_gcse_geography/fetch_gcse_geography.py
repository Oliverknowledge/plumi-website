"""Fetch AQA's own GCSE Geography (8035) papers: question papers, inserts, pre-release booklets, mark schemes and reports.

    python3 scripts/question-bank/aqa_gcse_geography/fetch_gcse_geography.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-geography

fetch_aqa.py's sources and file names (the specification's assessment-resources page, then
AQA's file store), with Geography's extra files told apart:
  - "ins": the insert. Papers 1 and 2 print their figures in the paper; the insert holds the
    key to an Ordnance Survey map extract, and in November 2021 Paper 2's two OS maps
    ("Study Figure 3, in the insert").
  - "pm": Paper 3's pre-release resources booklet ("Preliminary material", "Candidate
    material" in June 2024, and filed as the "Insert" in June 2025), which Section A's issue
    evaluation questions are about. Its Figures 1-3 are the paper's resources.
AQA's modified copies (enlarged to A3, or reset at 18pt) are left out: their inserts repeat
the paper's own figures with the photographs replaced by a description.
June 2018 and June 2019 have been withdrawn from AQA's site (the file store answers 404);
June 2020 and 2021 were cancelled.
"""
import json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-geography")
PDF = os.path.join(WORK, "pdf")
PAGE = "https://www.aqa.org.uk/subjects/geography/gcse/geography-8035/assessment-resources"
COMPONENTS = ["80351", "80352", "80353"]
SERIES = ["NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]
WITHDRAWN = ["JUN18", "JUN19"]
CODES = {"QP": "qp", "MS": "ms", "WRE": "er", "INS": "ins", "INS1": "ins", "INS2": "ins", "PM": "pm", "CM": "pm"}
RANK = ["", "CR"]  # the standard file, else its copyright-removed copy


def parse(name, title):
    """'AQA-80351-INS-MQP36A3-JUN23-CR.PDF' -> ('80351', 'ins', 'JUN23', rank). None for anything else."""
    n = re.sub(r"\.PDF$", "", name.upper())
    m = re.match(r"AQA-(8035[123])-(?:W-)?(QP|MS|WRE|INS1|INS2|INS|PM|CM)(?:-OS)?-(.*)$", n)
    if not m:
        return None
    comp, code, rest = m.groups()
    s = re.search(r"(JUN|NOV)(\d{2})(\d{2})?", rest)
    if not s:
        return None
    series = s.group(1) + (s.group(3) or s.group(2))
    variant = "-".join(x for x in re.sub(r"(JUN|NOV)\d{2,4}", "", rest).split("-") if x)
    if variant not in RANK:
        return None
    kind = "pm" if re.match(r"(Preliminary|Candidate) material", title) else CODES[code]
    return comp, kind, series, RANK.index(variant)


def pre_release(f):
    """Whether a file is Paper 3's pre-release resources booklet, read off its cover."""
    import pymupdf
    body, _ = fetch_aqa.get(f["source"], binary=True)
    return bool(body) and "Pre-release resources booklet" in pymupdf.open(stream=body, filetype="pdf")[0].get_text()


def listed():
    html, _ = fetch_aqa.get(PAGE)
    html = html.replace('\\"', '"')
    found = {}
    for m in re.finditer(r'"originalFilename":"([^"]+)","path":"[^"]+","sha1hash":"[^"]+","size":(\d+),"uploadId":"[^"]+","url":"([^"]+)"\}\},"publicationDate":"[^"]*","resourceType":\[[^\]]*\],"thumbnail":[^,]*,"title":"([^"]*)"', html):
        name, size, url, title = m.groups()
        key = parse(name, title)
        if not key:
            continue
        comp, kind, series, rank = key
        slot = (comp, kind, series)
        if series in SERIES and (slot not in found or rank < found[slot]["rank"]):
            found[slot] = {"component": comp, "kind": kind, "series": series, "title": title.strip(), "source": url, "cr": rank == 1,
                           "aqaName": name, "rank": rank}
    return found


def main():
    os.makedirs(PDF, exist_ok=True)
    files = listed()
    print(f"{len(files)} files listed on AQA's resource page", file=sys.stderr)
    for comp in COMPONENTS:
        for series in SERIES + WITHDRAWN:
            for kind in ("qp", "ms", "er", "ins"):
                if (comp, kind, series) in files or series in ("JUN24", "JUN25"):
                    continue
                for url, name in fetch_aqa.filestore_guess(comp, kind, series):
                    head = urllib.request.Request(url, method="HEAD", headers={"User-Agent": fetch_aqa.UA})
                    try:
                        with urllib.request.urlopen(head, timeout=30) as r:
                            if r.status == 200 and "pdf" in r.headers.get("Content-Type", "").lower():
                                files[(comp, kind, series)] = {"component": comp, "kind": kind, "series": series, "title": "", "source": url,
                                                               "cr": False, "aqaName": name, "rank": 0}
                                break
                    except Exception:  # noqa: BLE001
                        pass
                    time.sleep(0.3)
    # June 2025's pre-release booklet is filed as Paper 3's insert; the file store's guess at June 2022's
    # insert is the OS key the resource page lists already.
    for (comp, kind, series), f in list(files.items()):
        if comp == "80353" and kind == "ins" and (comp, "pm", series) not in files and pre_release(f):
            files[(comp, "pm", series)] = {**f, "kind": "pm"}
            del files[(comp, kind, series)]
    manifest = []
    for (comp, kind, series), f in sorted(files.items()):
        out = os.path.join(PDF, f"AQA-{comp}-{kind.upper()}-{series}.pdf")
        if not os.path.exists(out):
            body, _ = fetch_aqa.get(f["source"], binary=True)
            if not body or not body.startswith(b"%PDF"):
                print("  failed", f["source"], file=sys.stderr)
                continue
            with open(out, "wb") as fh:
                fh.write(body)
            time.sleep(0.5)
        f.pop("rank")
        f["file"] = os.path.basename(out)
        f["bytes"] = os.path.getsize(out)
        manifest.append(f)
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    got = {(f["component"], f["series"]) for f in manifest if f["kind"] == "qp"}
    print(f"{len(manifest)} files, {sum(f['bytes'] for f in manifest) / 1e6:.0f} MB in {PDF}; papers {len(got)}", file=sys.stderr)
    for comp in COMPONENTS:
        for series in SERIES:
            have = sorted(f["kind"] for f in manifest if f["component"] == comp and f["series"] == series)
            print(f"  {comp} {series}: {' '.join(have)}", file=sys.stderr)


if __name__ == "__main__":
    main()
