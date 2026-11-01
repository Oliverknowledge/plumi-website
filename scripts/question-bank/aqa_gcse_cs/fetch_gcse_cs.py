"""Fetch AQA's own GCSE Computer Science (8525) papers.

    python3 scripts/question-bank/aqa_gcse_cs/fetch_gcse_cs.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-cs

The A-Level fetcher (fetch_aqa.py) run over the specification's assessment-resources page,
with the same file names and the same <work-dir>/manifest.json. 8525 was first sat in June
2022. Paper 1 is set three times, once per programming language: 8525/1A (C#), 1B (Python)
and 1C (VB.NET). Each has its own question paper; the mark scheme and (from June 2024, filed
"85251ABC") the examiners' report cover all three, so the manifest lists them under each
language's paper, pointing at the one file.

The specimen papers ("Sample set 1", first published in 2020) are series "SPEC". AQA has
since set a second Paper 2 specimen for exams from 2027 ("AQA-85252-SQP-2027"), left out:
37 of its 40 parts are the 2020 specimen's word for word (it swaps FTP, which the 2027
specification drops, for other protocols). The insert AQA lists for some papers is only ever
the modified (enlarged) copy's, which the standard paper doesn't use. The old specification's
papers (8520), listed on the same page, are left out.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-cs")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = ["https://www.aqa.org.uk/subjects/computer-science/gcse/computer-science-8525/assessment-resources"]
LANGUAGES = ["85251A", "85251B", "85251C"]
fetch_aqa.COMPONENTS = {"8525": LANGUAGES + ["85251", "85252"]}
fetch_aqa.SERIES = ["JUN22", "JUN23", "JUN24", "JUN25"]

_parse = fetch_aqa.parse_name


def parse_name(name):
    n = name.upper()
    if not n.startswith("AQA-8525") or "MQP" in n:
        return None
    m = re.match(r"AQA-(8525\d[A-C]?)-S(QP|MS)-S1\.PDF$", n)  # "AQA-85251A-SQP-S1.PDF"
    if m:
        return m.group(1), m.group(2).lower(), "SPEC", False
    if re.match(r"AQA-8525\d[A-C]?-S(QP|MS)-", n):
        return None  # the 2027 specimen, and any later one
    key = _parse(re.sub(r"^AQA-85251ABC-", "AQA-85251-", n))
    return key if key and key[1] in ("qp", "ms", "er") else None


fetch_aqa.parse_name = parse_name


def shared():
    """Paper 1's one scheme and report, listed under each language's paper too."""
    path = os.path.join(sys.argv[1], "manifest.json")
    manifest = json.load(open(path))
    papers = {(f["component"], f["series"]) for f in manifest if f["kind"] == "qp"}
    out = [f for f in manifest if f["component"] != "85251"]
    for f in manifest:
        if f["component"] == "85251":
            out += [{**f, "component": lang} for lang in LANGUAGES if (lang, f["series"]) in papers]
    out.sort(key=lambda f: (f["component"], f["series"], f["kind"]))
    json.dump(out, open(path, "w"), indent=1)
    for comp, series in sorted(papers):
        print(f"  {comp} {series}: {' '.join(sorted(f['kind'] for f in out if f['component'] == comp and f['series'] == series))}", file=sys.stderr)


if __name__ == "__main__":
    fetch_aqa.main()
    shared()
