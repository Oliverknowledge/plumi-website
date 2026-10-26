"""Fetch OCR's own A-Level (H446) and AS (H046) Computer Science papers.

    python3 scripts/question-bank/computer_science/fetch_ocr_cs.py [work-dir]   # default scripts/question-bank/.work/ocr-cs

The past paper library has no Computer Science, so this reads OCR's assessment page
itself, the way the library's OCR fetcher does: plain server-rendered HTML, a tab
per level ("A Level", "AS Level"), accordions "Question papers, mark schemes and
reports" > "2025 - June series", each a list of /Images/<id>-<slug>.pdf links with
the component code beside them. Keeps the written papers' question papers, mark
schemes and examiners' reports (H446/01, /02 and H046/01, /02); the programming
project (H446/03) has no paper, and modified papers, moderators' reports and the
sample assessment materials are left out.

OCR publishes A-Level November 2021 and June 2022 on, and AS June 2022 on; the
earlier series are on Teach Cambridge (OCR's teacher login) only, and never fetched.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf (OCR's files, unmodified) and
<work-dir>/manifest.json in fetch_ocr.py's shape, with `r2` the key the bank uploads
each whole paper to (ocr/OCR-H446-01-QP-JUN24.pdf, the library's naming).
"""
import html as htmllib, json, os, re, sys, time, urllib.error, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
SITE = "https://www.ocr.org.uk"
PAGE = f"{SITE}/qualifications/as-and-a-level/computer-science-h046-h446-from-2015/assessment/"
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-cs")
PDF = os.path.join(WORK, "pdf")
COMPONENTS = {"H446/01", "H446/02", "H046/01", "H046/02"}
KIND = {"question paper": "qp", "mark scheme": "ms", "examiners' report": "er"}
MONTHS = {"june": "JUN", "november": "NOV"}
# The library's reader for OCR's page: tab bodies and names, accordion headings, file links.
TOKEN = re.compile(
    r'<div id="specification-tab-(\d+)"'
    r'|<a id="[^"]+" href="#specification-tab-(\d+)">([^<]*)</a>'
    r'|<h[3-6]\s[^>]*class="level-(\d) heading[^"]*"[^>]*>\s*<span>(.*?)</span>'
    r'|<li class="resource[^"]*">\s*<a href="([^"]+)"[^>]*>(.*?)</a>(.*?)</li>', re.S)


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                body = r.read()
                return body if binary else body.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403, 404, 410):
                return None
            time.sleep(3)
        except Exception:  # noqa: BLE001
            time.sleep(3)
    return None


def text(s):
    return re.sub(r"\s+", " ", htmllib.unescape(re.sub(r"<[^>]+>", "", s or ""))).strip()


def listing(page_html):
    """Every file link on the page with the tab and headings it sits under."""
    names, tab, heads, out = {}, None, {}, []
    for m in TOKEN.finditer(page_html):
        if m.group(1):
            tab, heads = names.get(m.group(1), ""), {}
        elif m.group(2):
            names[m.group(2)] = text(m.group(3))
        elif m.group(4):
            level = int(m.group(4))
            heads = {k: v for k, v in heads.items() if k < level}
            heads[level] = text(m.group(5))
        else:
            code = re.search(r'unit-code">([^<]*)', m.group(8))
            out.append(dict(tab=tab, section=heads.get(1, ""), series=heads.get(2, ""), href=m.group(6).strip(),
                            title=text(m.group(7)), code=text(code.group(1)) if code else ""))
    return out


def main():
    os.makedirs(PDF, exist_ok=True)
    page = get(PAGE)
    if not page:
        sys.exit(f"could not fetch {PAGE}")
    out, headings = [], set()
    for r in listing(page):
        if r["section"] != "Question papers, mark schemes and reports":
            continue
        headings.add((r["tab"], r["series"]))
        s = re.match(r"(20\d\d) - (\w+) series", r["series"])
        kind = KIND.get(r["title"].split(" - ")[0].strip().lower())
        if not s or not kind or r["code"] not in COMPONENTS or not r["href"].lower().endswith(".pdf"):
            continue
        series = MONTHS[s.group(2).lower()] + s.group(1)[2:]
        spec, num = r["code"].split("/")
        comp = f"{spec.lower()}-{num}"
        name = f"{comp}-{kind}-{series.lower()}.pdf"
        dest = os.path.join(PDF, name)
        source = SITE + r["href"] if r["href"].startswith("/") else r["href"]
        if not os.path.exists(dest):
            body = get(source, binary=True)
            if not body or not body.startswith(b"%PDF"):
                print("  failed", source, file=sys.stderr)
                continue
            open(dest, "wb").write(body)
            time.sleep(0.5)
        title = r["title"].split(" - ", 1)[-1] if kind == "qp" else ""
        out.append({"component": comp, "spec": spec, "kind": kind, "series": series, "title": title, "source": source, "file": name,
                    "r2": f"ocr/OCR-{spec}-{num}-{kind.upper()}-{series}.pdf", "bytes": os.path.getsize(dest)})
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} files ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}; series listed: "
          + ", ".join(sorted(f"{t} {s}" for t, s in headings)), file=sys.stderr)


if __name__ == "__main__":
    main()
