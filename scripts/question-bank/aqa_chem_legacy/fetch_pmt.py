"""Fetch AQA's legacy A-Level Chemistry (2420) unit papers from Physics & Maths Tutor.

    python3 scripts/question-bank/aqa_chem_legacy/fetch_pmt.py [work-dir]   # default scripts/question-bank/.work-chem-legacy

AQA's own site no longer has any 2420 paper (2 November 2026: every file store address answers
"not found", and its past paper search has no series before June 2016). A student's teacher sets
tests from them, and the founder chose PMT's copies, for the question bank only, not the past
paper library. Units CHEM1, CHEM2, CHEM4 and CHEM5; CHEM3 and CHEM6 were the practical ISA/EMPA
units. PMT has question papers and mark schemes, no examiners' reports.

Downloads each to <work-dir>/pdf/AQA-CHEM1-QP-JAN10.pdf and writes <work-dir>/manifest.json in
fetch_aqa.py's shape, with `source` the PMT link. Polite: one request at a time, cached.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work-chem-legacy")
PDF = os.path.join(WORK, "pdf")
BASE = "https://www.physicsandmathstutor.com/past-papers/a-level-chemistry/aqa-unit-{}/"
UNITS = {1: "Foundation Chemistry", 2: "Chemistry in Action", 4: "Kinetics, Equilibria and Organic Chemistry",
         5: "Energetics, Redox and Inorganic Chemistry"}
MONTH = {"January": "JAN", "June": "JUN"}
TITLE = {"qp": "Question paper", "ms": "Mark scheme"}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except Exception:  # noqa: BLE001
            time.sleep(3)
    return None


def main():
    os.makedirs(PDF, exist_ok=True)
    manifest = []
    for unit, title in UNITS.items():
        comp = f"CHEM{unit}"
        html = (get(BASE.format(unit)) or b"").decode("utf-8", "replace")
        for href in sorted(set(re.findall(r'href="([^"#]+\.pdf)"', html))):
            m = re.match(r"(January|June) (\d{4}) (QP|MS) - Unit (\d)\b", urllib.parse.unquote(href.rsplit("/", 1)[1]))
            if not m or int(m.group(4)) != unit:
                continue
            series, kind = MONTH[m.group(1)] + m.group(2)[2:], m.group(3).lower()
            fname = f"AQA-{comp}-{kind.upper()}-{series}.pdf"
            dest = os.path.join(PDF, fname)
            if not os.path.exists(dest):
                body = get(urllib.parse.quote(href, safe=":/"))
                if not body or not body.startswith(b"%PDF"):
                    print("  failed", href, file=sys.stderr)
                    continue
                open(dest, "wb").write(body)
                time.sleep(0.5)
            manifest.append({"component": comp, "kind": kind, "series": series,
                             "title": f"{TITLE[kind]}: Unit {unit} {title} - {m.group(1)} {m.group(2)}", "source": href, "cr": False,
                             "aqaName": f"AQA-{comp}-{kind.upper()}-{series}.PDF", "file": fname, "bytes": os.path.getsize(dest)})
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files from PMT", file=sys.stderr)


if __name__ == "__main__":
    main()
