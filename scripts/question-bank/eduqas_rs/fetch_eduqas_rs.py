"""Download Eduqas's AS and A Level Religious Studies papers, mark schemes and examiner's reports from eduqas.co.uk.

    python3 scripts/question-bank/eduqas_rs/fetch_eduqas_rs.py [work-dir]
    # default work dir: scripts/question-bank/.work/eduqas-rs
    # needs: pip install pymupdf

The same Umbraco tabs as eduqas/fetch_eduqas.py (the sciences): the qualification page's
"pastpapers" tab lists every question paper and mark scheme, the "keydocuments" tab the
specifications and the examiner's reports, one per level and series. Only eduqas.co.uk and
the files it links to on pastpapers.download.wjec.co.uk: no mirrors.

A student sits three components. Component 1, the study of a religion, is six papers, one
per option, each with its own code: A120UA0 (Option A, Christianity) to A120UF0 (Option F,
Sikhism) at A-Level, B120UA0 to B120UF0 at AS. Components 2 (Philosophy of Religion) and 3
(Religion and Ethics) are A120U20/A120U30 and B120U20/B120U30. Before 2023 the files are named
by Eduqas's old paper numbers, "s19-8121-04.pdf" (8121 A-Level, 8120 AS; 01 is Option A, 02
and 03 Components 2 and 3, 04-08 Options B-F), and 2017's schemes only by a running number
("s17-religious-studies27-ms.pdf"): the listing's title names the component either way
("RS Component 1B Intro to Islam": "Intro" is AS), and each file's cover is checked against it.

Large-print copies ("Modified Paper") are left out. Eduqas puts papers up a year after the
exam and leaves some options out in some years (few candidates): those are gaps, listed.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf ("a120ua0-qp-jun24.pdf"), uploaded as
eduqas/<that name>; <work-dir>/manifest.json in fetch_eduqas.py's shape: {component, spec,
kind (qp, ms, er), series ("JUN24", "OCT20"), title, source, file, bytes}, an examiner's
report listed once per component it covers; <work-dir>/specs/rs.pdf and rs-as.pdf; gaps.txt.
"""
import html, json, os, re, sys, time, urllib.parse, urllib.request

import pymupdf

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "eduqas-rs")
PDF = os.path.join(WORK, "pdf")
SITE = "https://www.eduqas.co.uk"
QUALIFICATION = 38464  # the hidden QualificationId on /qualifications/religious-studies-asa-level/
SERIES = {"Summer": "JUN", "Autumn": "OCT"}
OLD = {"01": "a", "02": "2", "03": "3", "04": "b", "05": "c", "06": "d", "07": "e", "08": "f"}  # 8121-04: Option B
CODE = re.compile(r"\b([AB])120U([A-F23])0", re.I)


def get(url, tries=3):
    for n in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90).read()
        except Exception:  # noqa: BLE001
            if n == tries - 1:
                raise
            time.sleep(2 * (n + 1))


def tab(name):
    page = get(f"{SITE}/umbraco/surface/TabSurface/Get{name}Tab?qualificationId={QUALIFICATION}&cultureId=en-GB").decode("utf-8", "replace")
    items = []
    for m in re.finditer(r'<textarea class="react-component--props">(.*?)</textarea>', page, re.S):
        items += json.loads(html.unescape(m.group(1))).get("listItems", [])
    return items


def component(name, url):
    """"a120ub0" from the listing's title ("Past Paper - Summer - RS Component 1B Intro to Islam:…"), checked
    against the code in the file's name where it has one."""
    m = re.search(r"Component\s*([123])\s*([A-F])?\b", name)
    if not m:
        return None
    level = "b" if re.search(r"\bIntro\b", name) else "a"
    comp = f"{level}120u{(m.group(2) or m.group(1)).lower()}0"
    file = urllib.parse.unquote(url.rsplit("/", 1)[-1])
    c = CODE.search(file)
    old = re.search(r"812([01])-(0\d)", file)
    said = f"{c.group(1).lower()}120u{c.group(2).lower()}0" if c else f"{'a' if old.group(1) == '1' else 'b'}120u{OLD[old.group(2)]}0" if old else comp
    return comp if said == comp else f"!{comp}/{said}"


def cover(path):
    """The component code a paper or scheme prints on its first pages, if one."""
    doc = pymupdf.open(path)
    found = {f"{a.lower()}120u{b.lower()}0" for a, b in CODE.findall(" ".join(doc[i].get_text() for i in range(min(2, len(doc)))))}
    return found.pop() if len(found) == 1 else None


def main():
    os.makedirs(PDF, exist_ok=True)
    os.makedirs(os.path.join(WORK, "specs"), exist_ok=True)
    out, gaps, seen = [], [], set()
    for it in sorted(tab("pastpapers"), key=lambda r: (not re.search(r"/S\d\d", r.get("Url") or "", re.I), r.get("Url") or "")):
        ref, name, url = it.get("ProductReference") or "", it.get("FileName") or "", it.get("Url") or ""
        if ref not in ("Past Paper", "Mark Scheme") or not url.lower().endswith(".pdf") or it.get("Series") not in SERIES:
            continue
        comp = component(name, url)
        if not comp or comp.startswith("!"):
            gaps.append(f"can't place {url} ({name}): {comp}")
            continue
        kind = "ms" if ref == "Mark Scheme" else "qp"
        series = f"{SERIES[it['Series']]}{it['Year'][2:]}"
        if (comp, kind, series) in seen:
            continue  # 2022's schemes are listed twice
        seen.add((comp, kind, series))
        title = name.split(":", 1)[-1].strip()  # "A Study of Religion - Option B: Islam"
        out.append({"component": comp, "spec": comp[:4].upper(), "kind": kind, "series": series, "title": title, "source": url})
    # Examiner's reports: one per level and series, a section per component.
    comps = {}
    for f in out:
        if f["kind"] == "qp":
            comps.setdefault((f["spec"], f["series"]), set()).add(f["component"])
    docs = tab("keydocuments")
    for d in docs:
        name, link = d.get("Name") or "", d.get("Link") or ""
        m = re.search(r"^(AS|A Level)\b.*Examiners.? Report\W+(Summer|Autumn) (20\d\d)", name)
        if not m or not link.lower().endswith(".pdf"):
            continue
        spec = "B120" if m.group(1) == "AS" else "A120"
        series = f"{SERIES[m.group(2)]}{m.group(3)[2:]}"
        if (spec, series) not in comps:
            gaps.append(f"{name}: no papers published for that series yet")
            continue
        for comp in sorted(comps[(spec, series)]):
            out.append({"component": comp, "spec": spec, "kind": "er", "series": series, "title": name, "source": SITE + link})
    for prefix, suffix in (("A Level", ""), ("AS", "-as")):
        spec_doc = next((d for d in docs if d.get("DocumentType") == "Specification" and (d.get("Name") or "").startswith(prefix + " ")), None)
        dest = os.path.join(WORK, "specs", f"rs{suffix}.pdf")
        if spec_doc and not os.path.exists(dest):
            open(dest, "wb").write(get(SITE + spec_doc["Link"]))
    for (spec, series), cs in sorted(comps.items()):
        for comp in sorted(cs):
            have = {f["kind"] for f in out if f["component"] == comp and f["series"] == series}
            for k in ("ms", "er"):
                if k not in have:
                    gaps.append(f"{comp} {series} has no {k}")
    for f in out:
        if f["kind"] == "ms" and f["component"] not in comps.get((f["spec"], f["series"]), ()):
            gaps.append(f"{f['component']} {f['series']} has a mark scheme but no question paper")
    for f in out:
        # (an examiner's report covers every component of its level: one file, named for the level)
        f["file"] = f"{f['spec'].lower()}-er-{f['series'].lower()}.pdf" if f["kind"] == "er" else f"{f['component']}-{f['kind']}-{f['series'].lower()}.pdf"
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
