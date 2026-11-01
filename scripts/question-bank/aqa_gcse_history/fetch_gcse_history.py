"""Fetch AQA's own GCSE History (8145) papers: question papers, inserts, mark schemes and reports, one set per option.

    python3 scripts/question-bank/aqa_gcse_history/fetch_gcse_history.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-history

fetch_aqa.py's sources (the specification's assessment-resources page, which lists every file
from November 2020). AQA sets each option as its own paper, coded by paper, section and option:
81451AA is Paper 1 Section A Option A (America, 1840-1895), 81452BC Paper 2 Section B Option C
(Elizabethan England). Each has a question paper, an insert holding its sources and
interpretations, and a mark scheme. Reports are one per section (81451A, 81452B, ...) from
June 2022; November 2020 has three per option.
  - Where AQA lists only a copyright-removed ("-CR") insert, that is the one taken: the cutter
    leaves out any question whose source AQA has blanked.
  - June 2025's Paper 1 Section B Option B and Paper 2 Section B Option A question papers are
    filed under their section's code (81451B, 81452A); the cover names the option.
  - June 2025's Paper 2 Section B Option D insert is listed only as modified (enlarged) copies;
    the A4 18pt one is taken, its interpretation being text.
AQA's other modified copies are left out. June 2018 and June 2019 have been withdrawn from AQA's
site (the file store answers 404); June 2020 and 2021 were cancelled. Option E of Paper 1
Section B wasn't sat in November 2021.
"""
import json, os, re, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-history")
PDF = os.path.join(WORK, "pdf")
PAGE = "https://www.aqa.org.uk/subjects/history/gcse/history-8145/assessment-resources"
OPTIONS = {"81451A": "ABCD", "81451B": "ABCDE", "81452A": "ABC", "81452B": "ABCD"}
COMPONENTS = [s + o for s, opts in OPTIONS.items() for o in opts]
SERIES = ["NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]
CODES = {"QP": "qp", "MS": "ms", "WRE": "er", "INS": "ins"}
RANK = ["", "CR", "MQP18A4-CR", "MQP18A4"]  # the standard file, its copyright-removed copy, else the A4 18pt copy


def parse(name):
    """'AQA-81451AB-INS-JUN24-CR.PDF' -> ('81451AB', 'ins', 'JUN24', rank). None for anything else."""
    n = re.sub(r"\.PDF$", "", name.upper())
    m = re.match(r"AQA-(8145[12][AB][A-E]?)-(?:W-)?(QP|MS|WRE|INS)-(.*)$", n)
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
    return comp, CODES[code], series, RANK.index(variant)


def option_of(f):
    """The option a section-coded question paper is ("Paper 2 Section B Option A"), read off its cover."""
    import pymupdf
    body, _ = fetch_aqa.get(f["source"], binary=True)
    cover = re.sub(r"\s+", " ", pymupdf.open(stream=body, filetype="pdf")[0].get_text()) if body else ""
    m = re.search(r"Paper ([12])\s*Section ([AB])\s*/?\s*(?:Option\s*)?([A-E])\b", cover) or \
        re.search(r"8145/([12])([AB])/([A-E])", cover)
    return f"8145{m.group(1)}{m.group(2)}{m.group(3)}" if m else None


def listed():
    html, _ = fetch_aqa.get(PAGE)
    html = html.replace('\\"', '"')
    found = {}
    for m in re.finditer(r'"originalFilename":"([^"]+)","path":"[^"]+","sha1hash":"[^"]+","size":(\d+),"uploadId":"[^"]+","url":"([^"]+)"\}\},"publicationDate":"[^"]*","resourceType":\[[^\]]*\],"thumbnail":[^,]*,"title":"([^"]*)"', html):
        name, size, url, title = m.groups()
        key = parse(name)
        if not key:
            continue
        comp, kind, series, rank = key
        if rank >= 2 and kind != "ins":
            continue
        f = {"component": comp, "kind": kind, "series": series, "title": title.strip(), "source": url, "cr": "CR" in RANK[rank],
             "modified": rank >= 2, "aqaName": name, "rank": rank}
        if len(comp) == 6 and kind == "qp":
            comp = option_of(f)
            if not comp:
                print("  no option on the cover of", name, file=sys.stderr)
                continue
            f["component"] = comp
        slot = (comp, kind, series)
        if series in SERIES and (slot not in found or rank < found[slot]["rank"]):
            found[slot] = f
    return found


def main():
    os.makedirs(PDF, exist_ok=True)
    files = listed()
    print(f"{len(files)} files listed on AQA's resource page", file=sys.stderr)
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
            time.sleep(0.3)
        f.pop("rank")
        f["file"] = os.path.basename(out)
        f["bytes"] = os.path.getsize(out)
        manifest.append(f)
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    got = {(f["component"], f["series"]) for f in manifest if f["kind"] == "qp"}
    print(f"{len(manifest)} files, {sum(f['bytes'] for f in manifest) / 1e6:.0f} MB in {PDF}; papers {len(got)}", file=sys.stderr)
    for comp in COMPONENTS:
        for series in SERIES:
            have = sorted(f["kind"] + ("(cr)" if f["cr"] else "") + ("(mod)" if f["modified"] else "")
                          for f in manifest if f["component"] == comp and f["series"] == series)
            print(f"  {comp} {series}: {' '.join(have)}", file=sys.stderr)
    for sec in OPTIONS:
        print(f"  {sec} reports: {' '.join(f['series'] for f in manifest if f['component'] == sec and f['kind'] == 'er')}", file=sys.stderr)


if __name__ == "__main__":
    main()
