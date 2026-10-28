"""Pearson Edexcel's papers for the past paper library, from Pearson's own site.

    python3 scripts/past-papers/boards/edexcel.py

Asks the public search index behind Pearson's course-materials pages (the same one
scripts/question-bank/fetch_edexcel.py uses) for each specification below and keeps
its exam materials: question papers ("que"), mark schemes ("rms", "msc") and
examiner's reports ("pef"). The A-Level Maths, Further Maths and sciences pages are
the question bank's own (src/content/pastPapers.ts), so this covers the rest:

  edexcel        GCSE Maths 1MA1, Biology 1BI0, Chemistry 1CH0, Physics 1PH0
  edexcel-igcse  International GCSE Maths A 4MA1, Maths B 4MB1, Further Pure 4PM1,
                 Biology 4BI1, Chemistry 4CH1, Physics 4PH1, and the 4xx0 specs before them
  edexcel-ial    International A-Level Maths and Further Maths (WMA, WFM, WST, WME, WDM)
                 and Biology, Chemistry, Physics (WBI, WCH, WPH), units 1-6

Pearson's file names carry a date, not a series: a question paper is dated the day
it was sat, its mark scheme and report the day results came out. So each question
paper fixes a sitting, and the scheme and report join the latest sitting of the same
paper before them. Writes .work/edexcel/pdf/EDX-<SPEC>-<COMP>-<KIND>-<SERIES>.pdf and
.work/edexcel/manifest.json (boards/README.md).
"""
import json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "..", ".work", "edexcel")
PDF = os.path.join(WORK, "pdf")
ALGOLIA = "https://l639t95u5a-dsn.algolia.net/1/indexes/qualifications-uk_LIVE_master-content/query"
HEADERS = {"X-Algolia-Application-Id": "L639T95U5A", "X-Algolia-API-Key": "f79c7a8352e9ffbdaec387bf43612ee6", "Content-Type": "application/json"}
SITE = "https://qualifications.pearson.com"
NAME = re.compile(r"/([0-9a-z]{4,5})[-_]([0-9a-z]{2,3})[-_](que|rms|msc|pef)[-_](\d{8})[^/]*\.pdf$", re.I)
KINDS = {"que": "qp", "rms": "ms", "msc": "ms", "pef": "er"}

IAL_MATHS = {"WMA11": "P1", "WMA12": "P2", "WMA13": "P3", "WMA14": "P4", "WST01": "S1", "WME01": "M1", "WDM11": "D1",
             "WMA01": "C12", "WMA02": "C34", "WDM01": "D1"}
IAL_FURTHER = {"WFM01": "FP1", "WFM02": "FP2", "WFM03": "FP3", "WST02": "S2", "WST03": "S3", "WME02": "M2", "WME03": "M3"}
IAL_UNIT_NAME = {"P": "Pure Mathematics", "C": "Core Mathematics", "S": "Statistics", "M": "Mechanics", "D": "Decision Mathematics", "FP": "Further Pure Mathematics"}

# spec -> (subject, board, group, legacy)
SPECS = {
    "1MA1": ("gcse-maths", "edexcel", "GCSE (1MA1)", False),
    "1BI0": ("gcse-biology", "edexcel", "GCSE (1BI0)", False),
    "1CH0": ("gcse-chemistry", "edexcel", "GCSE (1CH0)", False),
    "1PH0": ("gcse-physics", "edexcel", "GCSE (1PH0)", False),
    "4MA1": ("gcse-maths", "edexcel-igcse", "Maths A (4MA1)", False),
    "4MB1": ("gcse-maths", "edexcel-igcse", "Maths B (4MB1)", False),
    "4PM1": ("gcse-maths", "edexcel-igcse", "Further Pure Maths (4PM1)", False),
    "4MA0": ("gcse-maths", "edexcel-igcse", "Maths A (4MA0)", True),
    "4MB0": ("gcse-maths", "edexcel-igcse", "Maths B (4MB0)", True),
    "4PM0": ("gcse-maths", "edexcel-igcse", "Further Pure Maths (4PM0)", True),
    "4BI1": ("gcse-biology", "edexcel-igcse", "International GCSE (4BI1)", False),
    "4CH1": ("gcse-chemistry", "edexcel-igcse", "International GCSE (4CH1)", False),
    "4PH1": ("gcse-physics", "edexcel-igcse", "International GCSE (4PH1)", False),
    "4BI0": ("gcse-biology", "edexcel-igcse", "International GCSE (4BI0)", True),
    "4CH0": ("gcse-chemistry", "edexcel-igcse", "International GCSE (4CH0)", True),
    "4PH0": ("gcse-physics", "edexcel-igcse", "International GCSE (4PH0)", True),
    **{u: ("a-level-maths", "edexcel-ial", "International A-Level", u in ("WMA01", "WMA02", "WDM01")) for u in IAL_MATHS},
    **{u: ("a-level-further-maths", "edexcel-ial", "International A-Level", False) for u in IAL_FURTHER},
    **{f"W{s}1{n}": (subj, "edexcel-ial", "International A-Level", False) for s, subj in (("BI", "a-level-biology"), ("CH", "a-level-chemistry"), ("PH", "a-level-physics")) for n in "123456"},
    **{f"W{s}0{n}": (subj, "edexcel-ial", "International A-Level", True) for s, subj in (("BI", "a-level-biology"), ("CH", "a-level-chemistry"), ("PH", "a-level-physics")) for n in "123456"},
}
GCSE_MATHS_PAPER = {"1": "non-calculator", "2": "calculator", "3": "calculator"}


def describe(spec, comp):
    """The group, paper name and code for one component: ('GCSE (1MA1)', 'Paper 1 (Higher), non-calculator', '1MA1/1H')."""
    subject, board, group, legacy = SPECS[spec]
    c = comp.upper()
    code = f"{spec}/{c}"
    if board == "edexcel-ial":
        units = {**IAL_MATHS, **IAL_FURTHER}
        if spec in units:
            short = units[spec]
            prefix = re.match(r"[A-Z]+", short).group(0)
            paper = f"{IAL_UNIT_NAME[prefix]} {' and '.join(short[len(prefix):])} ({short})"
        else:
            paper = f"Unit {spec[-1]}"
        return group + (", legacy" if legacy else ""), paper, code
    m = re.match(r"0?(\d)([A-Z]?)(R?)$", c)
    n, tier = (m.group(1), m.group(2)) if m else (c[:1], "")
    tier_name = {"H": "Higher", "F": "Foundation"}.get(tier, "")
    if spec == "1MA1":
        paper = f"Paper {n} ({tier_name}), {GCSE_MATHS_PAPER.get(n, '')}".rstrip(", ")
        group = f"{tier_name} tier (1MA1)"
    elif spec.startswith("1"):
        paper = f"Paper {n} ({tier_name})" if tier_name else f"Paper {n}"
        group = f"{tier_name} tier ({spec})" if tier_name else group
    else:
        paper = f"Paper {n} ({tier_name})" if tier_name else f"Paper {int(n)}"
        if tier_name and spec[:3] in ("4MA",):
            group = f"{group.split(' (')[0]} · {tier_name} tier ({spec})"
    return group + (", legacy" if legacy else ""), paper, code


def search(code):
    hits, page = [], 0
    while True:
        body = json.dumps({"params": f"query={code}&hitsPerPage=1000&page={page}"}).encode()
        for attempt in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(ALGOLIA, data=body, headers=HEADERS), timeout=60) as r:
                    d = json.load(r)
                break
            except Exception:  # noqa: BLE001  (a dropped connection mid-response; ask again)
                if attempt == 3:
                    raise
                time.sleep(3)
        hits += d["hits"]
        page += 1
        if page >= d.get("nbPages", 1):
            return hits


def series_for(date):
    """The sitting a question paper dated yyyymmdd belongs to."""
    year, month = int(date[:4]), int(date[4:6])
    mon = "JAN" if month <= 2 else "MAR" if month <= 4 else "JUN" if month <= 8 else "OCT" if month == 10 else "NOV"
    return f"{mon}{str(year)[2:]}"


def listed():
    """{(spec, comp): {(kind, date, url, raw kind)}} for every exam-materials PDF Pearson lists.
    Cached for a day in .work/edexcel/listing.json, so a re-run goes straight to the downloads."""
    cache = os.path.join(WORK, "listing.json")
    if os.path.exists(cache) and time.time() - os.path.getmtime(cache) < 86400:
        return {tuple(k.split("|")): {tuple(f) for f in v} for k, v in json.load(open(cache)).items()}
    found = {}
    for spec in SPECS:
        for h in search(spec):
            url = h.get("url", "")
            m = NAME.search(url)
            if not m or "exam-materials" not in url.lower() or m.group(1).upper() != spec:
                continue
            comp, kind, date = m.group(2).upper(), m.group(3).lower(), m.group(4)
            if not 2010 <= int(date[:4]) <= 2030:
                continue
            found.setdefault((spec, comp), set()).add((KINDS[kind], date, SITE + url, kind))
        time.sleep(0.4)
    json.dump({"|".join(k): sorted(v) for k, v in found.items()}, open(cache, "w"))
    return found


def get(url):
    # Pearson's paths have spaces ("International GCSE/Mathematics A/...").
    req = urllib.request.Request(urllib.parse.quote(url, safe=":/%"), headers={"User-Agent": UA})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                return None
            time.sleep(2)
        except Exception:  # noqa: BLE001
            time.sleep(2)
    return None


def main():
    os.makedirs(PDF, exist_ok=True)
    found = listed()
    print(f"{sum(len(v) for v in found.values())} files listed for {len(found)} components", file=sys.stderr)
    slots = {}
    for (spec, comp), files in found.items():
        sittings = sorted({d for k, d, _, _ in files if k == "qp"})
        for kind, date, url, raw in sorted(files, key=lambda f: (f[1], f[3] != "rms")):
            if kind == "qp":
                series = series_for(date)
            else:
                before = [d for d in sittings if d <= date]
                if not before:
                    continue
                series = series_for(before[-1])
            slot = (spec, comp, kind, series)
            if slot in slots and raw == "msc":
                continue  # prefer the "rms" scheme over an "msc" one for the same sitting
            slots[slot] = url
    def fetch(item):
        (spec, comp, kind, series), url = item
        out = os.path.join(PDF, f"EDX-{spec}-{comp}-{kind.upper()}-{series}.pdf")
        if not os.path.exists(out):
            body = get(url)
            if not body or not body.startswith(b"%PDF"):
                return False
            with open(out, "wb") as fh:
                fh.write(body)
            time.sleep(0.3)
        return True

    # Four at a time: Pearson's file server is slow per file, not busy.
    items = sorted(slots.items())
    with ThreadPoolExecutor(max_workers=4) as pool:
        ok = list(pool.map(fetch, items))
    manifest, missing = [], ok.count(False)
    for ((spec, comp, kind, series), url), got in zip(items, ok):
        if not got:
            continue
        name = f"EDX-{spec}-{comp}-{kind.upper()}-{series}.pdf"
        subject, board, _, _ = SPECS[spec]
        group, paper, code = describe(spec, comp)
        manifest.append({"subject": subject, "board": board, "group": group, "paper": paper, "code": code,
                         "series": series, "kind": kind, "source": url, "file": f"edexcel/{name}"})
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    size = sum(os.path.getsize(os.path.join(PDF, os.path.basename(f["file"]))) for f in manifest)
    print(f"{len(manifest)} files, {size / 1e6:.0f} MB; {missing} not downloadable (teacher-only or gone)", file=sys.stderr)


if __name__ == "__main__":
    main()
