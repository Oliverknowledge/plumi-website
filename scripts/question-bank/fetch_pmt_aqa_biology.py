"""Add the AQA A-Level and AS Biology papers AQA no longer publishes, from Physics & Maths Tutor.

    python3 scripts/question-bank/fetch_pmt_aqa_biology.py [work-dir]   # default scripts/question-bank/.work

AQA's site has dropped nine Biology sets (its file store answers "not found"): A-Level Paper 1
June 2017-2019, Paper 3 June 2018, AS Paper 1 June 2016, 2018 and 2019, AS Paper 2 June 2017
and 2018. A student asked for them, and the founder chose PMT's copies (28 October 2026), for
the question bank only, not the past paper library. PMT has no examiners' reports for them.

Run after fetch_aqa.py: this downloads each question paper and mark scheme to <work-dir>/pdf/
under fetch_aqa.py's names (AQA-74021-QP-JUN19.pdf) and adds them to manifest.json in its
shape, with `source` the PMT link. A set AQA itself publishes is never taken from PMT. Polite:
one request at a time, cached.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, ".work")
PDF = os.path.join(WORK, "pdf")
BASE = "https://www.physicsandmathstutor.com/past-papers/a-level-biology/"
PAGES = {"aqa-paper-1": ("74021", "A-level", "Paper 1"), "aqa-paper-3": ("74023", "A-level", "Paper 3"),
         "aqa-paper-1-as": ("74011", "AS", "Paper 1"), "aqa-paper-2-as": ("74012", "AS", "Paper 2")}
WANT = {("74021", "JUN17"), ("74021", "JUN18"), ("74021", "JUN19"), ("74023", "JUN18"), ("74011", "JUN16"),
        ("74011", "JUN18"), ("74011", "JUN19"), ("74012", "JUN17"), ("74012", "JUN18")}
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
    path = os.path.join(WORK, "manifest.json")
    manifest = json.load(open(path))
    have = {(f["component"], f["series"]) for f in manifest if f["kind"] == "qp"}
    added = 0
    for page, (comp, level, paper) in PAGES.items():
        html = (get(BASE + page + "/") or b"").decode("utf-8", "replace")
        for href in sorted(set(re.findall(r'href="([^"#]+\.pdf)"', html))):
            m = re.match(r"June (\d{4}) (QP|MS)\b", urllib.parse.unquote(href.rsplit("/", 1)[1]))
            if not m:
                continue
            series, kind = "JUN" + m.group(1)[2:], m.group(2).lower()
            if (comp, series) not in WANT or (comp, series) in have:
                continue  # AQA's own copy, or a set we weren't asked for
            fname = f"AQA-{comp}-{kind.upper()}-{series}.pdf"
            dest = os.path.join(PDF, fname)
            if not os.path.exists(dest):
                body = get(urllib.parse.quote(href, safe=":/"))
                if not body or not body.startswith(b"%PDF"):
                    print("  failed", href, file=sys.stderr)
                    continue
                open(dest, "wb").write(body)
                time.sleep(0.5)
            manifest = [f for f in manifest if f["file"] != fname]
            manifest.append({"component": comp, "kind": kind, "series": series,
                             "title": f"{TITLE[kind]} ({level}) : {paper} - June 20{series[3:]}", "source": href, "cr": False,
                             "aqaName": f"AQA-{comp}-{kind.upper()}-{series}.PDF", "file": fname, "bytes": os.path.getsize(dest)})
            added += 1
    json.dump(manifest, open(path, "w"), indent=1)
    print(f"{added} files from PMT; manifest now {len(manifest)}", file=sys.stderr)


if __name__ == "__main__":
    main()
