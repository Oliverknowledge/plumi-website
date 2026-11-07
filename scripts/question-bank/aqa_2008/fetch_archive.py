"""Fetch the approved FreeExamPapers copies of AQA's 2008–2009 science papers.

Approved by Daniel on 6 November 2026, for both question banks only. Practical
assessments are excluded; written units and Physics options stay separate.
Files are cached and validated as PDFs. The manifest retains every source URL.

    python3 scripts/question-bank/aqa_2008/fetch_archive.py [work-dir]
"""
import hashlib
import json
from pathlib import Path
import re
import sys
import time
import urllib.parse
import urllib.request

WORK = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / ".work/archive-2008"
BASE = "https://freeexampapers.com/exam-papers/A-Level/"
UA = "Mozilla/5.0"
UNITS = {
    "Physics": {"PA01", "PA02", "PA04", "PA04B", "PA10", "PHA3W", "PHA5W", "PHA6W", "PHA7W", "PHA8W", "PHA9W"},
    "Chemistry": {"CHM1", "CHM2", "CHM3W", "CHM4", "CHM5", "CHM6W", "CHEM1", "CHEM2"},
}


def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2)


def main():
    pdf = WORK / "pdf"
    pdf.mkdir(parents=True, exist_ok=True)
    inventory = Path(__file__).with_name("sources.json")
    expected = {r["file"]: r["sha256"] for r in json.loads(inventory.read_text())} if inventory.exists() else {}
    manifest = {}
    for subject, spec in (("Physics", "Physics-A-2450"), ("Chemistry", "2420")):
        for year in (2008, 2009):
            for month in ("Jan", "Jun"):
                index = f"{BASE}{subject}/AQA/{spec}/{year}-{month}/"
                html = get(index).decode()
                for name in sorted(set(re.findall(r'href="([^"?#]+\.[pP][dD][fF])"', html))):
                    match = re.fullmatch(r"AQA-([A-Z0-9]+)-W-(QP|MS)-(JAN|JUN)(08|09)\.PDF", name, re.I)
                    alias = re.fullmatch(r"(PA01|PA02|PHA3)(QP|MS)JAN09\.pdf", name, re.I)
                    report = re.fullmatch(r"AQA-(PHYA[12]|CHEM[12])-(?:W-)?WRE-(JAN|JUN)09\.PDF", name, re.I)
                    if report:
                        comp, kind, series = report.group(1).upper(), "er", report.group(2).upper() + "09"
                    elif subject == "Chemistry" and year == 2009 and month == "Jan" and name in ("QP.pdf", "MS.pdf"):
                        # Covers identify these generically named files as the
                        # resit of the pre-2009 CHM1 unit, not CHEM1.
                        comp, kind, series = "CHM1", name[:2].lower(), "JAN09"
                    elif alias:
                        comp, kind = alias.group(1).upper(), alias.group(2).lower()
                        comp = "PHA3W" if comp == "PHA3" else comp
                        series = "JAN09"
                    elif match and match.group(1).upper() in UNITS[subject]:
                        comp, kind = match.group(1).upper(), match.group(2).lower()
                        series = match.group(3).upper() + match.group(4)
                    else:
                        continue
                    source = urllib.parse.urljoin(index, name)
                    fname = f"AQA-{comp}-{kind.upper()}-{series}.pdf"
                    dest = pdf / fname
                    if not dest.exists():
                        body = get(source)
                        if not body.startswith(b"%PDF"):
                            raise ValueError(f"Not a PDF: {source}")
                        dest.write_bytes(body)
                        time.sleep(0.3)
                    if fname in expected and hashlib.sha256(dest.read_bytes()).hexdigest() != expected[fname]:
                        raise ValueError(f"Source bytes changed; review before importing: {source}")
                    manifest[(subject, comp, series, kind)] = {
                        "subject": subject, "component": comp, "series": series,
                        "kind": kind, "file": fname, "source": source,
                        "bytes": dest.stat().st_size,
                    }
                    print(fname, flush=True)
    rows = [manifest[k] for k in sorted(manifest)]
    (WORK / "manifest.json").write_text(json.dumps(rows, indent=1))
    print(f"{len(rows)} files")


if __name__ == "__main__":
    main()
