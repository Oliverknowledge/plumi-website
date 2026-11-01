"""Download Eduqas's GCSE English Language (C700QS) or English Literature (C720QS) papers, mark schemes,
resource inserts and examiner's reports from eduqas.co.uk.

    python3 scripts/question-bank/eduqas_gcse_english/fetch_english.py lang|lit [work-dir]
    # default work dir: scripts/question-bank/.work/eduqas-gcse-english-<lang|lit>
    # needs: pip install pymupdf

eduqas/fetch_eduqas.py's get() and tab(), on the two GCSE pages (QualificationId 38422 and 38424): the
"pastpapers" tab lists the papers, schemes and inserts, the "keydocuments" tab the specification and
the examiner's reports, one per series covering every component. Only eduqas.co.uk and the files it
links to on pastpapers.download.wjec.co.uk: no mirrors. Large-print ("Modified Paper") and braille
("-BRL") copies are left out.

A file is placed by the code in its name ("S24-C700U10-1.pdf"), or by the paper number 2017 to 2022 use
("s18-5700-02.pdf" is Language's Component 2, "s19-5720-01.pdf" Literature's Component 1), and checked
against the code on its cover. Eduqas calls the resits "Autumn" but sits them in November (the covers
say so, one Monday 31 October): "NOV17".
  - English Language: Component 1 (20th Century Literature Reading and Creative Prose Writing, C700U10)
    and Component 2 (19th and 21st Century Non-Fiction Reading and Transactional/Persuasive Writing,
    U20), each with a separate "Resource Material for use with Section A" ("...-1A.pdf", "[Resource]"),
    the insert. A few sittings list the paper and its insert as one file ("[Includes Resources]",
    June 2022 and 2023, November 2018 and 2022): it's split at the insert's own cover. Component 3,
    spoken language, is non-exam assessment.
  - English Literature: Component 1 (Shakespeare and Poetry, C720U10) and Component 2 (Post-1914
    Prose/Drama, 19th Century Prose and Unseen Poetry, U20). June 2022's adapted papers (C722) split
    them into five ("z22-5721-01.pdf" to "-05"): Shakespeare (C722U10-A), Post-1914 Prose/Drama
    (U10-B), the Poetry Anthology (U20-A), 19th Century Prose (U20-B) and Unseen Poetry (U20-C).
    Eduqas has published only one of each autumn's two papers (November 2020's Component 2, November
    2021's Component 1, which has no scheme): gaps are listed.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf ("c700u10-ins-jun24.pdf"), uploaded as
eduqas/<that name>; <work-dir>/manifest.json, in fetch_eduqas_gcse.py's shape: {component, spec, kind
(qp, ms, er, ins), series, title, source, file, bytes, r2}, an examiner's report listed once per
component; <work-dir>/specs/spec.pdf; gaps.txt.
"""
import importlib.util, json, os, re, sys, urllib.parse
from concurrent.futures import ThreadPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
SUBJECT = ARGS[0] if ARGS else "lang"
WORK = os.path.abspath(ARGS[1]) if len(ARGS) > 1 else os.path.join(HERE, "..", ".work", f"eduqas-gcse-english-{SUBJECT}")
PDF = os.path.join(WORK, "pdf")

# The sciences' fetcher, loaded from its file for its get() and tab().
_spec = importlib.util.spec_from_file_location("fetch_eduqas", os.path.join(HERE, "..", "eduqas", "fetch_eduqas.py"))
fetch_eduqas = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fetch_eduqas)
get, tab, SITE = fetch_eduqas.get, fetch_eduqas.tab, fetch_eduqas.SITE

SUBJECTS = {"lang": {"qualification": 38422, "spec": "C700", "old": "5700"},
            "lit": {"qualification": 38424, "spec": "C720", "old": "5720"}}
CONF = SUBJECTS[SUBJECT]
SERIES = {"Summer": "JUN", "Autumn": "NOV"}
CODE = re.compile(r"\b(C7(?:00|20|22)U[12]0)(?:-?([ABC]))?", re.I)
C722 = ["c722u10a", "c722u10b", "c722u20a", "c722u20b", "c722u20c"]  # z22-5721-01 to -05
INSERT_COVER = re.compile(r"C700U[12]0-1A\b")


def component(url):
    """"c700u10" from the file's name: its code ("S24-C700U10-1A.pdf", "s22-C722U20-B-ms.pdf") or its paper number."""
    file = urllib.parse.unquote(url.rsplit("/", 1)[-1])
    c = CODE.search(file)
    if c:
        return (c.group(1) + (c.group(2) or "" if c.group(1).upper().startswith("C722") else "")).lower()
    old = re.search(r"\b(57[02]\d)-0(\d)", file)
    if not old:
        return None
    if old.group(1) == "5721":
        return C722[int(old.group(2)) - 1]
    if old.group(1) == CONF["old"]:
        return f"{CONF['spec'].lower()}u{old.group(2)}0"
    return None


def cover(path):
    """The component code a paper prints on its first pages ("C722U10-A", "C700U20-1"), if one."""
    doc = pymupdf.open(path)
    text = " ".join(doc[i].get_text() for i in range(min(2, len(doc))))
    found = {(a + (b or "" if a.upper().startswith("C722") else "")).lower() for a, b in CODE.findall(text)}
    return found.pop() if len(found) == 1 else None


def split(path, qp_dest, ins_dest):
    """A paper bound with its insert: the pages before the insert's cover, and the rest."""
    doc = pymupdf.open(path)
    at = next((i for i in range(1, len(doc)) if INSERT_COVER.search(doc[i].get_text())), None)
    if at is None:
        return False
    for dest, pages in ((qp_dest, (0, at - 1)), (ins_dest, (at, len(doc) - 1))):
        if dest and not os.path.exists(dest):
            out = pymupdf.open()
            out.insert_pdf(doc, from_page=pages[0], to_page=pages[1])
            out.save(dest, garbage=3, deflate=True)
    return True


def main():
    os.makedirs(PDF, exist_ok=True)
    os.makedirs(os.path.join(WORK, "specs"), exist_ok=True)
    raw = os.path.join(WORK, "raw")
    os.makedirs(raw, exist_ok=True)
    gaps, rows = [], []
    for it in tab(CONF["qualification"], "pastpapers"):
        ref, name, url = it.get("ProductReference") or "", it.get("FileName") or "", it.get("Url") or ""
        if ref not in ("Past Paper", "Mark Scheme") or not url.lower().endswith(".pdf") or it.get("Series") not in SERIES:
            continue
        if re.search(r"-BRL\.pdf$|-mlp", url, re.I) or "[Braille" in name:
            continue
        comp = component(url)
        kind = "ms" if ref == "Mark Scheme" else "both" if re.search(r"\[Includes Resource", name) else "ins" if "[Resource" in name else "qp"
        series = f"{SERIES[it['Series']]}{it['Year'][2:]}"
        title = re.sub(r"\s*\[[^\]]*\]$", "", name.split(":", 1)[-1]).strip()
        rows.append({"component": comp, "kind": kind, "series": series, "title": title, "source": url,
                     "name": name})
    # The oldest schemes ("s17-english11-ms.pdf") are placed by their component's title, which a file with a code carries.
    by_title = {r["title"]: r["component"] for r in rows if r["component"]}
    for r in rows:
        r["component"] = r["component"] or by_title.get(r["title"])
        if not r["component"]:
            gaps.append(f"can't place {r['source']} ({r['name']})")
            continue
        r["spec"] = r["component"][:4].upper()
        r["raw"] = os.path.join(raw, f"{r['component']}-{r['kind']}-{r['series'].lower()}.pdf")
    rows = [r for r in rows if r["component"]]

    def download(r):
        if not os.path.exists(r["raw"]):
            body = get(urllib.parse.quote(r["source"], safe=":/%"))
            if body.startswith(b"%PDF"):
                open(r["raw"], "wb").write(body)
    with ThreadPoolExecutor(6) as pool:
        list(pool.map(download, rows))

    out, have = [], {}
    for r in rows:
        if os.path.exists(r["raw"]):
            if r["kind"] in ("qp", "ins") and SUBJECT == "lang":
                # (June 2023's Component 1 is listed as its "[Resource]" but is the paper and its insert together)
                doc = pymupdf.open(r["raw"])
                if not INSERT_COVER.search(doc[0].get_text()) and any(INSERT_COVER.search(doc[i].get_text()) for i in range(1, len(doc))):
                    r["kind"] = "both"
            have[(r["component"], r["series"], r["kind"])] = r
        else:
            gaps.append(f"not a PDF: {r['source']}")
    sittings = sorted({(c, s) for c, s, k in have if k in ("qp", "both")})
    for comp, series in sittings:
        both = have.get((comp, series, "both"))
        for kind in ("qp", "ms", "ins"):
            r = have.get((comp, series, kind))
            if kind == "ins" and SUBJECT == "lit":
                continue
            f = {"component": comp, "spec": comp[:4].upper(), "kind": kind, "series": series, "file": f"{comp}-{kind}-{series.lower()}.pdf"}
            dest = os.path.join(PDF, f["file"])
            if r:
                if not os.path.exists(dest):
                    open(dest, "wb").write(open(r["raw"], "rb").read())
                f.update(title=r["title"], source=r["source"])
            elif both and kind in ("qp", "ins"):
                # (the paper and its insert listed as one file: each half is ours to host)
                if not split(both["raw"], dest if kind == "qp" else None, dest if kind == "ins" else None):
                    gaps.append(f"{both['source']}: no insert cover to split at")
                    continue
                f.update(title=both["title"], source=both["source"], split=True)
            else:
                gaps.append(f"{comp} {series} has no {kind}")
                continue
            f["bytes"] = os.path.getsize(dest)
            f["r2"] = f"eduqas/{f['file']}"
            out.append(f)
    for comp, series, kind in have:
        if kind == "ms" and (comp, series) not in sittings:
            gaps.append(f"{comp} {series} has a mark scheme but no question paper")
    for f in out:
        if f["kind"] in ("qp", "ms"):
            on_cover = cover(os.path.join(PDF, f["file"]))
            if on_cover and on_cover != f["component"]:
                gaps.append(f"{f['file']}: its cover says {on_cover}")

    # Examiner's reports: one per series ("GCSE English Language Examiners' Report November 2024"); the 2019
    # "Examination Summary Report"s are a page of statistics, not comments.
    docs = tab(CONF["qualification"], "keydocuments")
    for d in docs:
        name, link = d.get("Name") or "", d.get("Link") or ""
        m = re.search(r"Examiners.? Report\W+(Summer|Autumn|November) (20\d\d)", name)
        if not m or not link.lower().endswith(".pdf"):
            continue
        series = f"{'JUN' if m.group(1) == 'Summer' else 'NOV'}{m.group(2)[2:]}"
        comps = sorted({c for c, s in sittings if s == series})
        if not comps:
            gaps.append(f"{name}: no papers published for that series")
            continue
        file = f"{CONF['spec'].lower()}-er-{series.lower()}.pdf"
        dest = os.path.join(PDF, file)
        if not os.path.exists(dest):
            open(dest, "wb").write(get(SITE + link))
        for comp in comps:
            out.append({"component": comp, "spec": comp[:4].upper(), "kind": "er", "series": series, "title": name, "source": SITE + link,
                        "file": file, "bytes": os.path.getsize(dest), "r2": f"eduqas/{file}"})
    for comp, series in sittings:
        if not any(f["kind"] == "er" and f["component"] == comp and f["series"] == series for f in out):
            gaps.append(f"{comp} {series} has no er")
    spec_doc = next((d for d in docs if d.get("DocumentType") == "Specification"), None)
    dest = os.path.join(WORK, "specs", "spec.pdf")
    if spec_doc and not os.path.exists(dest):
        open(dest, "wb").write(get(SITE + spec_doc["Link"]))

    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    open(os.path.join(WORK, "gaps.txt"), "w").write("\n".join(gaps) + "\n")
    n = {k: sum(1 for f in out if f["kind"] == k) for k in ("qp", "ms", "ins", "er")}
    print(f"{n['qp']} papers, {n['ms']} schemes, {n['ins']} inserts, {n['er']} report rows in {PDF}", file=sys.stderr)
    for g in gaps:
        print("  gap:", g, file=sys.stderr)


if __name__ == "__main__":
    main()
