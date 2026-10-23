"""Fetch AQA's own A-Level Biology, Chemistry and Physics papers.

    python3 scripts/question-bank/fetch_aqa.py [work-dir]   # default scripts/question-bank/.work

Sources, both AQA's:
  1. Each specification's "assessment resources" page, which embeds its file list
     (original filename, title, CDN URL). This is where June 2024 and 2025 live.
  2. AQA's file store, for older series a resources page no longer lists.

Downloads question papers, mark schemes, examiner reports, inserts and data
booklets, unmodified, to <work-dir>/pdf/<AQA filename>.pdf, and writes
<work-dir>/manifest.json. Modified (large print) copies are skipped. Polite:
one request at a time, cached, so a re-run fetches only what is missing.
"""
import json, os, re, sys, time, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, ".work")
PDF = os.path.join(WORK, "pdf")
os.makedirs(PDF, exist_ok=True)

PAGES = [
    "https://www.aqa.org.uk/subjects/biology/as-and-a-level/biology-7401-7402/assessment-resources",
    "https://www.aqa.org.uk/subjects/biology/a-level/biology-7402/assessment-resources",
    "https://www.aqa.org.uk/subjects/chemistry/as/chemistry-7404/assessment-resources",
    "https://www.aqa.org.uk/subjects/chemistry/a-level/chemistry-7405/assessment-resources",
    "https://www.aqa.org.uk/subjects/physics/a-level/physics-7408/assessment-resources",
    "https://www.aqa.org.uk/subjects/physics/as-level/physics-7407/assessment-resources",
    "https://www.aqa.org.uk/subjects/physics/as-and-a-level/physics-7407-7408/assessment-resources",
]
# Every paper of every spec, and every series AQA has sat since the specs began.
COMPONENTS = {
    "7401": ["74011", "74012"], "7402": ["74021", "74022", "74023"],
    "7404": ["74041", "74042"], "7405": ["74051", "74052", "74053"],
    "7407": ["74071", "74072"], "7408": ["74081", "74082", "74083A", "74083BA", "74083BB", "74083BC", "74083BD", "74083BE"],
}
SERIES = ["JUN16", "JUN17", "JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]
KINDS = {"QP": "qp", "MS": "ms", "WRE": "er", "INS": "ins", "DB": "db"}


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read()
                return (body if binary else body.decode("utf-8", "replace")), r.geturl()
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                return None, url
            time.sleep(2)
        except Exception:  # noqa: BLE001
            time.sleep(2)
    return None, url


def parse_name(name):
    """'AQA-74051-QP-JUN23-CR.PDF' -> ('74051', 'qp', 'JUN23', cr=True). None for modified copies."""
    n = name.upper()
    if "MQP" in n or "MODIFIED" in n:
        return None
    m = re.match(r"AQA-(\d{5}[A-Z]{0,2})-(?:W-)?(QP|MS|WRE|INS|DB)-(JUN|NOV)(\d{2})(?:\d{2})?", n)
    if m:
        return m.group(1), KINDS[m.group(2)], m.group(3) + m.group(4)[-2:], "-CR" in n
    m = re.match(r"AQA-(\d{5}[A-Z]{0,2})-S(QP|MS)", n)  # specimen papers
    if m:
        return m.group(1), KINDS[m.group(2)], "SPEC", "-CR" in n
    m = re.match(r"AQA-(\d{4})-SDB", n)
    if m:
        return m.group(1), "db", "SPEC", False
    return None


def listed_files():
    found = {}
    for page in PAGES:
        html, _ = get(page)
        if not html:
            print("  page failed", page, file=sys.stderr)
            continue
        html = html.replace('\\"', '"')
        for m in re.finditer(r'"originalFilename":"([^"]+)","path":"[^"]+","sha1hash":"[^"]+","size":(\d+),"uploadId":"[^"]+","url":"([^"]+)"\}\},"publicationDate":"[^"]*","resourceType":\[[^\]]*\],"thumbnail":[^,]*,"title":"([^"]*)"', html):
            name, size, url, title = m.groups()
            key = parse_name(name)
            if not key:
                continue
            comp, kind, series, cr = key
            slot = (comp, kind, series)
            # Prefer AQA's full version over the copyright-removed ("-CR") one.
            if slot not in found or (found[slot]["cr"] and not cr):
                found[slot] = {"component": comp, "kind": kind, "series": series, "title": title, "source": url, "cr": cr, "aqaName": name}
        time.sleep(1)
    return found


def filestore_guess(comp, kind, series):
    code = {v: k for k, v in KINDS.items()}[kind]
    mon, yy = series[:3], series[3:]
    folder = {"JUN": "june", "NOV": "november"}[mon]
    base = f"https://filestore.aqa.org.uk/sample-papers-and-mark-schemes/20{yy}/{folder}/"
    names = [f"AQA-{comp}-{code}-{series}.PDF"] + ([f"AQA-{comp}-W-MS-{series}.PDF"] if kind == "ms" else [])
    return [(base + n, n) for n in names]


def main():
    files = listed_files()
    print(f"{len(files)} files listed on AQA's resource pages", file=sys.stderr)
    for spec, comps in COMPONENTS.items():
        for comp in comps:
            for series in SERIES:
                for kind in ("qp", "ms", "er", "ins"):
                    if (comp, kind, series) in files:
                        continue
                    for url, name in filestore_guess(comp, kind, series):
                        if series in ("JUN24", "JUN25"):
                            break  # only ever published through the resource pages
                        head = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
                        try:
                            with urllib.request.urlopen(head, timeout=30) as r:
                                if r.status == 200 and "pdf" in r.headers.get("Content-Type", "").lower():
                                    files[(comp, kind, series)] = {"component": comp, "kind": kind, "series": series, "title": "", "source": url, "cr": False, "aqaName": name}
                                    break
                        except Exception:  # noqa: BLE001
                            pass
                        time.sleep(0.3)
    manifest = []
    for (comp, kind, series), f in sorted(files.items()):
        out = os.path.join(PDF, f"AQA-{comp}-{kind.upper()}-{series}.pdf")
        if not os.path.exists(out):
            body, _ = get(f["source"], binary=True)
            if not body or not body.startswith(b"%PDF"):
                print("  failed", f["source"], file=sys.stderr)
                continue
            with open(out, "wb") as fh:
                fh.write(body)
            time.sleep(0.5)
        f["file"] = os.path.basename(out)
        f["bytes"] = os.path.getsize(out)
        manifest.append(f)
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files, {sum(f['bytes'] for f in manifest) / 1e6:.0f} MB in {PDF}", file=sys.stderr)


if __name__ == "__main__":
    main()
