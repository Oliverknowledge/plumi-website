"""Fetch AQA's legacy A-Level Physics A (2450) papers, 2010-2016, from Physics & Maths Tutor.

    python3 scripts/question-bank/aqa_physics_legacy/fetch_pmt.py [work-dir]   # default scripts/question-bank/.work/phya

AQA publishes none of the 2450 papers any more: its file store answers "not found" for every
PHYA unit and series, and its past paper search starts at June 2016 (2 November 2026). The
founder chose PMT's copies (2 November 2026), for the question bank only, not the past paper
library. PMT has no examiners' reports for them.

Units: PHYA1 and PHYA2 (AS), PHYA4 and PHYA5 (A2), January and June 2010 to June 2016 (AQA's
last January series was 2013; PHYA5 was sat in June only). PHYA3 (the practical ISA/EMPA) is
left out. PMT splits PHYA4 into Section A (the objective test, "4A") and Section B ("4B") with
one scheme, and PHYA5 into Section 1 (the core, "5-1") and its four Section 2 options
("5-2A" Astrophysics to "5-2D" Turning points), a scheme each. Each becomes a paper of its own:

  PHYA1, PHYA2, PHYA4A, PHYA4B, PHYA5A, PHYA5BA (Astrophysics), PHYA5BB (Medical physics),
  PHYA5BC (Applied physics), PHYA5BD (Turning points in physics)

Downloads to <work-dir>/pdf/AQA-<paper>-<QP|MS>-<series>.pdf and writes <work-dir>/manifest.json
in fetch_aqa.py's shape, with `source` the PMT link. Polite: one request at a time, cached.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "phya")
PDF = os.path.join(WORK, "pdf")
BASE = "https://www.physicsandmathstutor.com/past-papers/a-level-physics/"
UNITS = ["aqa-unit-1", "aqa-unit-2", "aqa-unit-4", "aqa-unit-5"]
# PMT's unit names -> our papers. A scheme for "Unit 4" covers both of its sections.
PAPERS = {"1": ["PHYA1"], "2": ["PHYA2"], "4": ["PHYA4A", "PHYA4B"], "4A": ["PHYA4A"], "4B": ["PHYA4B"],
          "5-1": ["PHYA5A"], "5-2A": ["PHYA5BA"], "5-2B": ["PHYA5BB"], "5-2C": ["PHYA5BC"], "5-2D": ["PHYA5BD"]}
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
    manifest = {}
    for page in UNITS:
        html = (get(BASE + page + "/") or b"").decode("utf-8", "replace")
        for href in sorted(set(re.findall(r'href="([^"#]+\.pdf)"', html))):
            name = urllib.parse.unquote(href.rsplit("/", 1)[1])
            m = re.match(r"(January|June) (\d{4}) (QP|MS) - Unit ([\dA-D-]+?)-? AQA Physics", name)
            if not m or int(m.group(2)) < 2010:
                continue
            series, kind = MONTH[m.group(1)] + m.group(2)[2:], m.group(3).lower()
            for comp in PAPERS[m.group(4)]:
                fname = f"AQA-{comp}-{kind.upper()}-{series}.pdf"
                dest = os.path.join(PDF, fname)
                if not os.path.exists(dest):
                    body = get(urllib.parse.quote(href, safe=":/"))
                    if not body or not body.startswith(b"%PDF"):
                        print("  failed", href, file=sys.stderr)
                        continue
                    open(dest, "wb").write(body)
                    time.sleep(0.5)
                manifest[(comp, kind, series)] = {
                    "component": comp, "kind": kind, "series": series, "spec": "2450",
                    "title": f"{TITLE[kind]}: Unit {m.group(4)} - {m.group(1)} {m.group(2)}", "source": href, "cr": False,
                    "aqaName": f"AQA-{comp}-{kind.upper()}-{series}.PDF", "file": fname, "bytes": os.path.getsize(dest)}
        time.sleep(1)
    out = [manifest[k] for k in sorted(manifest)]
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    qps = sorted((f["component"], f["series"]) for f in out if f["kind"] == "qp")
    no_ms = [s for s in qps if (s[0], "ms", s[1]) not in manifest]
    print(f"{len(out)} files, {len(qps)} question papers, without a scheme: {no_ms}", file=sys.stderr)


if __name__ == "__main__":
    main()
