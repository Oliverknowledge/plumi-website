"""Fetch AQA's own GCSE Religious Studies A (8062) papers: question papers, mark schemes and examiner's reports.

    python3 scripts/question-bank/aqa_gcse_rs/fetch_gcse_rs.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-rs

fetch_aqa.py's sources and file names (the specification's assessment-resources page, then AQA's
file store), for the nine papers:
  - Component 1, the study of religions: a paper per religion, 8062/11 Buddhism, /12 Catholic
    Christianity, /13 Christianity, /14 Hinduism, /15 Islam, /16 Judaism and /17 Sikhism
    (AQA files them as "806211" to "806217"). A student sits two.
  - Component 2: 8062/2A Thematic studies (themes A-F) and 8062/2B Textual studies (St Mark's
    Gospel, with themes A-D).
November 2020's schemes are filed "W-MS". AQA's modified copies (MQP18A4, MQP36A3), its exemplar
answers ("EX") and the 2026 specimens are left out. June 2018 and June 2019 have been withdrawn
from AQA's site (the file store answers 404); June 2020 and 2021 were cancelled.
"""
import json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-rs")
PDF = os.path.join(WORK, "pdf")
PAGE = "https://www.aqa.org.uk/subjects/religious-studies/gcse/religious-studies-8062/assessment-resources"
COMPONENTS = ["806211", "806212", "806213", "806214", "806215", "806216", "806217", "80622A", "80622B"]
SERIES = ["NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]
WITHDRAWN = ["JUN18", "JUN19"]
CODES = {"QP": "qp", "MS": "ms", "WRE": "er"}


def parse(name):
    """'AQA-806211-W-MS-NOV20.PDF' -> ('806211', 'ms', 'NOV20'). None for modified copies, exemplars and specimens."""
    n = re.sub(r"\.PDF$", "", name.upper())
    m = re.match(r"AQA-(8062(?:1[1-7]|2[AB]))-(?:W-)?(QP|MS|WRE)-((?:JUN|NOV)\d{2})(-CR)?$", n)
    return (m.group(1), CODES[m.group(2)], m.group(3)) if m else None


def listed():
    html, _ = fetch_aqa.get(PAGE)
    html = html.replace('\\"', '"')
    found = {}
    for m in re.finditer(r'"originalFilename":"([^"]+)","path":"[^"]+","sha1hash":"[^"]+","size":(\d+),"uploadId":"[^"]+","url":"([^"]+)"\}\},"publicationDate":"[^"]*","resourceType":\[[^\]]*\],"thumbnail":[^,]*,"title":"([^"]*)"', html):
        name, size, url, title = m.groups()
        key = parse(name)
        if key and key[2] in SERIES:
            comp, kind, series = key
            found[key] = {"component": comp, "kind": kind, "series": series, "title": title.strip(), "source": url, "aqaName": name}
    return found


def main():
    os.makedirs(PDF, exist_ok=True)
    files = listed()
    print(f"{len(files)} files listed on AQA's resource page", file=sys.stderr)
    for comp in COMPONENTS:
        for series in SERIES + WITHDRAWN:
            for kind in ("qp", "ms", "er"):
                if (comp, kind, series) in files or series in ("JUN24", "JUN25"):
                    continue
                for url, name in fetch_aqa.filestore_guess(comp, kind, series):
                    head = urllib.request.Request(url, method="HEAD", headers={"User-Agent": fetch_aqa.UA})
                    try:
                        with urllib.request.urlopen(head, timeout=30) as r:
                            if r.status == 200 and "pdf" in r.headers.get("Content-Type", "").lower():
                                files[(comp, kind, series)] = {"component": comp, "kind": kind, "series": series, "title": "", "source": url, "aqaName": name}
                                break
                    except Exception:  # noqa: BLE001
                        pass
                    time.sleep(0.3)
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
        f["file"] = os.path.basename(out)
        f["bytes"] = os.path.getsize(out)
        manifest.append(f)
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files, {sum(f['bytes'] for f in manifest) / 1e6:.0f} MB in {PDF}", file=sys.stderr)
    for comp in COMPONENTS:
        for series in SERIES:
            have = sorted(f["kind"] for f in manifest if f["component"] == comp and f["series"] == series)
            print(f"  {comp} {series}: {' '.join(have)}", file=sys.stderr)


if __name__ == "__main__":
    main()
