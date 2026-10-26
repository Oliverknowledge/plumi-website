"""Download Eduqas's A-Level science papers, mark schemes and examiner's reports from eduqas.co.uk.

    python3 scripts/question-bank/eduqas/fetch_eduqas.py [work-dir] [--only=physics,chemistry]
    # default work dir: scripts/question-bank/.work/eduqas-sciences

Eduqas is WJEC's brand for England, and both sites are the same Umbraco build: a
qualification's page loads its tabs from /umbraco/surface/TabSurface/Get<tab>Tab, each
a list of files as JSON. The "pastpapers" tab lists question papers, mark schemes,
resource booklets (the data booklet) and modified (large-print) papers, served from
pastpapers.download.wjec.co.uk; the "keydocuments" tab lists the specification and the
examiner's reports ("A Level Physics Examiners' Report Summer 2024"), one per level and
series, a section per component. Nothing else is used: no mirrors. Eduqas puts papers
up twelve months after the exam, and leaves some out (a paper with third-party
material it can't publish); those are gaps, listed by the run.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf ("a420u10-qp-jun24.pdf") and
<work-dir>/manifest.json in fetch_pearson.py's shape: {component, spec, kind (qp, ms,
er, ins), series ("JUN24", "OCT20" for an autumn series), title, source, file, bytes}.
An examiner's report is listed once per component it covers, with `section`, the
component's heading in it ("COMPONENT 1"). A paper or scheme whose cover names another
component of the same specification is filed under its cover (the file keeps the name it
was listed under). Also <work-dir>/specs/<subject>.pdf and <subject>-as.pdf, the
A-Level and AS specifications, for spec_eduqas.py.

To reuse for WJEC (wjec.co.uk), change SITE and QUALIFICATIONS: the tabs are the same.
"""
import html, json, os, re, sys, time, urllib.parse, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
ONLY = next((a.split("=", 1)[1].split(",") for a in sys.argv[1:] if a.startswith("--only=")), None)
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "eduqas-sciences")
PDF = os.path.join(WORK, "pdf")
SITE = "https://www.eduqas.co.uk"
# subject: (qualification id, A-Level spec code, AS spec code). The ids are the hidden QualificationId on each page.
QUALIFICATIONS = {"physics": (38459, "A420", "B420"), "chemistry": (38389, "A410", "B410"), "biology": (38403, "A400", "B400")}
SERIES = {"Summer": "JUN", "Autumn": "OCT"}
# A component's code as it appears in a file name: "A420U10-1", "a420u10", or before 2018 the
# paper's own number, "8421-03" (A-Level) and "8420-01" (AS), component 3 and 1.
CODE = re.compile(r"([AB]\d{3})U(\d)0", re.I)
OLD_CODE = re.compile(r"(?<!\d)8(\d)(\d)([01])-0(\d)(?!\d)")


def get(url, tries=3):
    for n in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90).read()
        except Exception:  # noqa: BLE001
            if n == tries - 1:
                raise
            time.sleep(2 * (n + 1))


def tab(qid, name):
    """A tab's file list: the props of its React list component."""
    page = get(f"{SITE}/umbraco/surface/TabSurface/Get{name}Tab?qualificationId={qid}&cultureId=en-GB").decode("utf-8", "replace")
    items = []
    for m in re.finditer(r'<textarea class="react-component--props">(.*?)</textarea>', page, re.S):
        items += json.loads(html.unescape(m.group(1))).get("listItems", [])
    return items


def component_of(url, title, a_spec, as_spec, by_title):
    """'a420u10' for A-Level component 1, from the file name or, for the oldest schemes
    ("s17-physics11-ms.pdf"), the component title another file with a code carries."""
    name = urllib.parse.unquote(url.rsplit("/", 1)[-1])
    m = CODE.search(name)
    if m and m.group(1).upper() in (a_spec, as_spec):
        return f"{m.group(1).lower()}u{m.group(2)}0"
    m = OLD_CODE.search(name)
    if m and m.group(1) + m.group(2) == a_spec[1:3]:
        return f"{(a_spec if m.group(3) == '1' else as_spec).lower()}u{m.group(4)}0"
    return by_title.get(title)


def main():
    os.makedirs(PDF, exist_ok=True)
    os.makedirs(os.path.join(WORK, "specs"), exist_ok=True)
    out, gaps = [], []
    for subject, (qid, a_spec, as_spec) in QUALIFICATIONS.items():
        if ONLY and subject not in ONLY:
            continue
        papers = tab(qid, "pastpapers")
        docs = tab(qid, "keydocuments")
        rows = []
        for it in papers:
            ref, name, url = it.get("ProductReference") or "", it.get("FileName") or "", it.get("Url") or ""
            if ref == "Modified Paper" or not url.lower().endswith(".pdf") or it.get("Series") not in SERIES:
                continue
            # (2016's AS schemes are listed as past papers: the file name says what each is.)
            kind = "ins" if "[Resource]" in name else "ms" if ref == "Mark Scheme" or re.search(r"-ms\.pdf$", url, re.I) else "qp" if ref == "Past Paper" else None
            if not kind:
                continue
            # "Past Paper - Summer - GCE AS Physics Component 1 Motion, Energy:Motion, Energy and Matter"
            title = re.sub(r"\s*\[Resource\]\s*$", "", name.split(":", 1)[-1]).strip()
            level_as = " AS " in name or bool(CODE.search(url) and CODE.search(url).group(1).upper() == as_spec)
            rows.append({"kind": kind, "title": title, "url": url, "series": f"{SERIES[it['Series']]}{it['Year'][2:]}", "as": level_as})
        # A component's title names it: learn the codes from the files that carry one.
        by_title = {}
        for r in rows:
            c = component_of(r["url"], None, a_spec, as_spec, {})
            if c:
                by_title.setdefault(r["title"], c)
        seen = set()
        for r in sorted(rows, key=lambda r: (not re.search(r"/S\d\d/", r["url"], re.I), r["url"])):  # the S22/ copy before Z22/
            comp = component_of(r["url"], r["title"], a_spec, as_spec, by_title)
            if not comp:
                gaps.append(f"{subject}: no component for {r['url']}")
                continue
            key = (comp, r["kind"], r["series"])
            if key in seen:
                continue
            seen.add(key)
            out.append({"component": comp, "spec": comp[:4].upper(), "kind": r["kind"], "series": r["series"], "title": r["title"],
                        "source": r["url"], "subject": subject})
        # Examiner's reports: one per level and series ("AS Physics Examiners' Report - Summer 2017").
        comps = {}
        for f in out:
            if f["subject"] == subject and f["kind"] == "qp":
                comps.setdefault((f["spec"], f["series"]), set()).add(f["component"])
        for d in docs:
            name, link = d.get("Name") or "", d.get("Link") or ""
            m = re.search(r"(AS|A Level|A level).*?Examiners.? Report\W+(Summer|Autumn) (20\d\d)", name, re.I)
            if not m or not link.lower().endswith(".pdf"):
                continue
            spec = as_spec if m.group(1) == "AS" else a_spec
            series = f"{SERIES[m.group(2).title()]}{m.group(3)[2:]}"
            for comp in sorted(comps.get((spec, series), [])):
                out.append({"component": comp, "spec": spec, "kind": "er", "series": series, "title": name, "source": SITE + link,
                            "subject": subject, "section": f"COMPONENT {comp[-2]}"})
        # The A-Level specification, whose topics the bank uses, and the AS one, which says which of them are AS content.
        for prefix, suffix in (("A Level", ""), ("AS", "-as")):
            spec_doc = next((d for d in docs if d.get("DocumentType") == "Specification" and d.get("Name", "").startswith(prefix + " ")), None)
            dest = os.path.join(WORK, "specs", f"{subject}{suffix}.pdf")
            if spec_doc and not os.path.exists(dest):
                open(dest, "wb").write(get(SITE + spec_doc["Link"]))
        # What a sitting is missing.
        for (spec, series), cs in sorted(comps.items()):
            for comp in sorted(cs):
                have = {f["kind"] for f in out if f["component"] == comp and f["series"] == series}
                for k in ("ms", "er"):
                    if k not in have:
                        gaps.append(f"{subject}: {comp} {series} has no {k}")
        for f in out:
            if f["subject"] == subject and f["kind"] == "ms" and f["component"] not in comps.get((f["spec"], f["series"]), ()):
                gaps.append(f"{subject}: {f['component']} {f['series']} has a mark scheme but no question paper")
    for f in out:
        f["file"] = f"{f['component']}-{f['kind']}-{f['series'].lower()}.pdf"
        dest = os.path.join(PDF, f["file"])
        if not os.path.exists(dest):
            body = get(urllib.parse.quote(f["source"], safe=":/"))
            if not body.startswith(b"%PDF"):
                gaps.append(f"not a PDF: {f['source']}")
                continue
            open(dest, "wb").write(body)
            time.sleep(0.3)
        f["bytes"] = os.path.getsize(dest)
    out = [f for f in out if "bytes" in f]
    # Trust the cover over the listing: Eduqas files AS Physics June 2018's two mark schemes under each
    # other's names. The file keeps its listed name; the manifest says which component it is.
    import pymupdf  # noqa: PLC0415
    for f in out:
        if f["kind"] not in ("qp", "ms"):
            continue
        doc = pymupdf.open(os.path.join(PDF, f["file"]))
        cover = {m.lower() for m in re.findall(r"[AB]\d{3}U\d0", " ".join(doc[i].get_text() for i in range(min(3, len(doc)))), re.I)}
        if len(cover) == 1 and f["component"] not in cover and next(iter(cover))[:4] == f["component"][:4]:
            gaps.append(f"{f['file']} is {next(iter(cover))}'s, not {f['component']}'s: filed under its cover")
            f["component"] = next(iter(cover))
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} files ({sum(f['bytes'] for f in out) / 1e6:.0f} MB) in {PDF}", file=sys.stderr)
    for g in gaps:
        print("  gap:", g, file=sys.stderr)


if __name__ == "__main__":
    main()
