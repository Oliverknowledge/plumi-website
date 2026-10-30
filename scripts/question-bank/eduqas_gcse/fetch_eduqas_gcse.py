"""Download Eduqas's GCSE Religious Studies or History papers, mark schemes and examiner's reports from eduqas.co.uk.

    python3 scripts/question-bank/eduqas_gcse/fetch_eduqas_gcse.py rs|history [work-dir]
    # default work dir: scripts/question-bank/.work/eduqas-gcse-<subject>
    # needs: pip install pymupdf

eduqas_rs/fetch_eduqas_rs.py for GCSE: the qualification page's "pastpapers" tab lists every
question paper and mark scheme, the "keydocuments" tab the specification and the examiner's
reports. Only eduqas.co.uk and the files it links to on pastpapers.download.wjec.co.uk: no mirrors.

Every option is a paper of its own, with its own code:
  - Religious Studies (C120): Route A's Component 1 (Religious, Philosophical and Ethical
    Studies in the Modern World, C120U10), Component 2 (Christianity, U20) and Component 3,
    one world faith (Buddhism U30, Hinduism U40, Islam U50, Judaism U60, Sikhism U70); Route
    B's Components 1 and 2 (Foundational and Applied Catholic Theology, U80 and U90), whose
    Component 3 is Route A's Islam or Judaism paper. The short course (5125) is a qualification
    of its own and left out.
  - History (C100): Component 1, the studies in depth, 1A to 1H (C100UA0 to UH0); Component 2,
    the period studies 2A to 2D (U10 to U40) and thematic studies 2E to 2H (U50 to U80).
    Component 3 is non-exam assessment.
A file is placed by the code in its name ("S24-C100UA0-1.pdf"), or by the old paper number
2018 to 2020 use ("s18-5120-05.pdf" is RS's fifth paper, Islam; History's 5101 to 5104 are
1A-1D, 1E-1H, 2A-2D and 2E-2H), and checked against the code on its cover.

Large-print ("Modified Paper") and braille ("-BRL") copies are left out. Eduqas puts papers up
a year after the exam (the summer 2026 reports have no papers yet), and in the autumn 2020
and 2021 resits only some options sat: gaps are listed.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf ("c120u50-qp-jun24.pdf"), uploaded as
eduqas/<that name>; <work-dir>/manifest.json in fetch_eduqas_rs.py's shape: {component, spec,
kind (qp, ms, er), series ("JUN24", "OCT20"), title, source, file, bytes}, an examiner's report
listed once per component it covers; <work-dir>/specs/spec.pdf; gaps.txt.
"""
import html, json, os, re, sys, time, urllib.parse, urllib.request

import pymupdf

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
SUBJECT = ARGS[0] if ARGS else "rs"
WORK = os.path.abspath(ARGS[1]) if len(ARGS) > 1 else os.path.join(HERE, "..", ".work", f"eduqas-gcse-{SUBJECT}")
PDF = os.path.join(WORK, "pdf")
SITE = "https://www.eduqas.co.uk"
SERIES = {"Summer": "JUN", "Autumn": "OCT"}
# The hidden QualificationId on /qualifications/religious-studies-gcse/ and /qualifications/history-gcse/
SUBJECTS = {
    "rs": {"qualification": 38463, "spec": "C120", "name": "Religious Studies"},
    "history": {"qualification": 38445, "spec": "C100", "name": "History"},
}
CONF = SUBJECTS[SUBJECT]
CODE = re.compile(r"\b(C1[02]0)U([A-H1-9])0", re.I)
# RS Route B's own components; its Component 3 is Route A's Islam (U50) or Judaism (U60) paper
ROUTE_B = {"c120u80", "c120u90"}


def get(url, tries=3):
    for n in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90).read()
        except Exception:  # noqa: BLE001
            if n == tries - 1:
                raise
            time.sleep(2 * (n + 1))


def tab(name):
    page = get(f"{SITE}/umbraco/surface/TabSurface/Get{name}Tab?qualificationId={CONF['qualification']}&cultureId=en-GB").decode("utf-8", "replace")
    items = []
    for m in re.finditer(r'<textarea class="react-component--props">(.*?)</textarea>', page, re.S):
        items += json.loads(html.unescape(m.group(1))).get("listItems", [])
    return items


def component(url):
    """"c120u50" from the file's name: its code, or the old paper number ("s18-5120-05.pdf", "o20-5103-02.pdf")."""
    file = urllib.parse.unquote(url.rsplit("/", 1)[-1])
    c = CODE.search(file)
    if c:
        return f"{c.group(1)}u{c.group(2)}0".lower()
    old = re.search(r"\b(51\d\d)-0(\d)\b", file)
    if not old:
        return None
    paper, n = old.group(1), int(old.group(2))
    if paper == "5120":
        return f"c120u{n}0"
    if paper in ("5101", "5102"):  # 1A-1D, 1E-1H
        return f"c100u{'ABCDEFGH'[(paper == '5102') * 4 + n - 1].lower()}0"
    if paper in ("5103", "5104"):  # 2A-2D (U10-U40), 2E-2H (U50-U80)
        return f"c100u{(paper == '5104') * 4 + n}0"
    return None


def cover(path):
    """The component code a paper or scheme prints on its first pages, if one."""
    doc = pymupdf.open(path)
    found = {f"{a}u{b}0".lower() for a, b in CODE.findall(" ".join(doc[i].get_text() for i in range(min(2, len(doc)))))}
    return found.pop() if len(found) == 1 else None


def main():
    os.makedirs(PDF, exist_ok=True)
    os.makedirs(os.path.join(WORK, "specs"), exist_ok=True)
    out, gaps, seen = [], [], set()
    for it in sorted(tab("pastpapers"), key=lambda r: r.get("Url") or ""):
        ref, name, url = it.get("ProductReference") or "", it.get("FileName") or "", it.get("Url") or ""
        if ref not in ("Past Paper", "Mark Scheme") or not url.lower().endswith(".pdf") or it.get("Series") not in SERIES:
            continue
        if re.search(r"-BRL\.pdf$|-mlp-", url, re.I) or re.search(r"Short Course|Shrt Crs|\[Braille", name):
            continue
        comp = component(url)
        if not comp or not comp.startswith(CONF["spec"].lower()):
            gaps.append(f"can't place {url} ({name}): {comp}")
            continue
        kind = "ms" if ref == "Mark Scheme" else "qp"
        series = f"{SERIES[it['Series']]}{it['Year'][2:]}"
        if (comp, kind, series) in seen:
            continue  # RS's 2022 schemes are listed twice
        seen.add((comp, kind, series))
        title = name.split(":", 1)[-1].strip()  # "Study of a World Faith - Islam", "1A. Conflict and Upheaval: England, 1337-1381"
        title = re.sub(r"\s*\[[^\]]*\]$", "", title)
        out.append({"component": comp, "spec": CONF["spec"], "kind": kind, "series": series, "title": title, "source": url})
    # Examiner's reports: one per series (RS: one per route until 2024), a section per component.
    comps = {}
    for f in out:
        if f["kind"] == "qp":
            comps.setdefault(f["series"], set()).add(f["component"])
    docs = tab("keydocuments")
    for d in docs:
        name, link = d.get("Name") or "", d.get("Link") or ""
        m = re.search(r"Examiners.? Report\W+(Summer|Autumn) (20\d\d)", name)
        if not m or not link.lower().endswith(".pdf"):
            continue
        series = f"{SERIES[m.group(1)]}{m.group(2)[2:]}"
        route = re.search(r"Route ([AB])\b", name)
        if series not in comps:
            gaps.append(f"{name}: no papers published for that series yet")
            continue
        for comp in sorted(comps[series]):
            if route and SUBJECT == "rs":
                # Route A's report covers Components 1-3 (Islam and Judaism for Route B's students too); Route B's, U80 and U90
                if (route.group(1) == "B") != (comp in ROUTE_B):
                    continue
            out.append({"component": comp, "spec": CONF["spec"], "kind": "er", "series": series, "title": name,
                        "route": route.group(1) if route else None, "source": SITE + link})
    spec_doc = next((d for d in docs if d.get("DocumentType") == "Specification" and "Short Course" not in (d.get("Name") or "")
                     and "Comparison" not in (d.get("Name") or "")), None)
    dest = os.path.join(WORK, "specs", "spec.pdf")
    if spec_doc and not os.path.exists(dest):
        open(dest, "wb").write(get(SITE + spec_doc["Link"]))
    for series, cs in sorted(comps.items()):
        for comp in sorted(cs):
            have = {f["kind"] for f in out if f["component"] == comp and f["series"] == series}
            for k in ("ms", "er"):
                if k not in have:
                    gaps.append(f"{comp} {series} has no {k}")
    for f in out:
        if f["kind"] == "ms" and f["component"] not in comps.get(f["series"], ()):
            gaps.append(f"{f['component']} {f['series']} has a mark scheme but no question paper")
    for f in out:
        # (an examiner's report covers every component of its series and route: one file)
        f["file"] = (f"{f['spec'].lower()}-er{('-' + f['route'].lower()) if f.get('route') else ''}-{f['series'].lower()}.pdf" if f["kind"] == "er"
                     else f"{f['component']}-{f['kind']}-{f['series'].lower()}.pdf")
        dest = os.path.join(PDF, f["file"])
        if not os.path.exists(dest):
            body = get(urllib.parse.quote(f["source"], safe=":/%"))
            if not body.startswith(b"%PDF"):
                gaps.append(f"not a PDF: {f['source']}")
                continue
            open(dest, "wb").write(body)
            time.sleep(0.3)
        f["bytes"] = os.path.getsize(dest)
        f["r2"] = f"eduqas/{f['file']}"
    out = [f for f in out if "bytes" in f]
    for f in out:
        if f["kind"] in ("qp", "ms"):
            on_cover = cover(os.path.join(PDF, f["file"]))
            if on_cover and on_cover != f["component"]:
                gaps.append(f"{f['file']}: its cover says {on_cover}")
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    open(os.path.join(WORK, "gaps.txt"), "w").write("\n".join(gaps) + "\n")
    n = {k: sum(1 for f in out if f["kind"] == k) for k in ("qp", "ms", "er")}
    print(f"{n['qp']} papers, {n['ms']} schemes, {n['er']} report rows ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}", file=sys.stderr)
    for g in gaps:
        print("  gap:", g, file=sys.stderr)


if __name__ == "__main__":
    main()
