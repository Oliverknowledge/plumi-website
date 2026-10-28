"""Gather WJEC's public A-Level papers, mark schemes and examiners' reports for the question bank.

    python3 scripts/question-bank/wjec/fetch_wjec.py [work-dir] [--only=physics]
    # default work dir: scripts/question-bank/.work/wjec
    # needs: pip install pymupdf

Only WJEC's own site. Each qualification page on wjec.co.uk loads its "Past Papers /
Mark Schemes" tab from /umbraco/surface/TabSurface/GetpastpapersTab, a list of every
paper it publishes with links to pastpapers.download.wjec.co.uk, and its "Key
documents" tab from GetkeydocumentsTab: the specification and the examiners' reports,
one report a summer for the whole subject, a section per unit. (Mirrors such as
Physics & Maths Tutor are never used, whatever the past paper library links to.)

From the papers list it keeps the English-medium written units' question papers and
mark schemes; it leaves out modified (large-print) papers, the practical exam (Unit 5
in the sciences: instructions for apparatus in front of the candidate) and its
resources, and inserts and data booklets. The list's labels aren't to be trusted
(2016's "Past Paper" for Physics Unit 1 is two copies of the paper and its mark
scheme; 2019 lists every mark scheme twice), so each file is read: its cover says
what it is, which unit ("2420U10-1") and which language. One copy of each is kept.

Writes <work-dir>/pdf/WJEC-<unit>-<KIND>-<SERIES>.pdf ("WJEC-2420U10-1-QP-JUN23.pdf"),
uploaded as wjec/<that name>; <work-dir>/raw/ (the downloads as WJEC names them),
<work-dir>/spec/<subject>.pdf, and <work-dir>/manifest.json, a row per file in
fetch_caie.py's shape: {component, spec, kind, series, title, source, file, r2,
bytes, bank, as}; an examiner's report is an `er` row for each of its units, with
`section` the unit's number, so the cutter reads only its own section.
"""
import hashlib, html, json, os, re, shutil, sys, time, urllib.parse, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "wjec")
SITE = "https://www.wjec.co.uk"
UA = {"User-Agent": "Mozilla/5.0 (Plumi question bank; tryplumi.app)"}
# subject: (qualification page, bank, the units' code stem: AS units are 2<stem>, A-Level 1<stem>)
QUALS = {
    "physics": ("physics-asa-level", "wjec-a-level-physics", "420"),
    "chemistry": ("chemistry-asa-level", "wjec-a-level-chemistry", "410"),
    "biology": ("biology-asa-level", "wjec-a-level-biology", "400"),
    "maths": ("mathematics-aas-level", "wjec-a-level-maths", "300"),
    "business": ("business-asa-level", "wjec-a-level-business", "510"),
}
PRACTICAL = {"420": "50", "410": "50", "400": "50"}  # the sciences' Unit 5, the practical exam
UNIT = re.compile(r"\b([12]\d{3})U(\d)0-(\d)\b")
SEASON = {"Summer": "JUN", "Autumn": "NOV", "Winter": "JAN"}


def get(url, binary=False):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                data = r.read()
            return data if binary else data.decode("utf-8", "replace")
        except Exception:  # noqa: BLE001
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))


def tab(qual_id, name):
    """A qualification page's tab, as the page itself loads it."""
    return get(f"{SITE}/umbraco/surface/TabSurface/Get{name}Tab?qualificationId={qual_id}&cultureId=en-gb")


def items(fragment):
    """The FilterableList's rows: the tab sends them as JSON in a <textarea> for its React component."""
    out = []
    for m in re.finditer(r'<textarea class="react-component--props">(.*?)</textarea>', fragment, re.S):
        out += json.loads(html.unescape(m.group(1))).get("listItems", [])
    return out


def read_cover(path):
    """(kind, unit code, Welsh?) from a PDF's first pages."""
    doc = pymupdf.open(path)
    text = "\n".join(doc[i].get_text() for i in range(min(3, len(doc))))
    unit = UNIT.search(text)
    welsh = bool(re.search(r"Atebwch bob cwestiwn|CYNLLUN MARCIO|Cyfenw|cwestiwn", text))
    if re.search(r"MARKING SCHEME|MARK SCHEME", text, re.I):
        kind = "ms"
    elif re.search(r"INSTRUCTIONS TO CANDIDATES", text) and re.search(r"Answer\s+all\s+(the\s+)?questions|answer booklet", text, re.I):
        # (maths papers are answered in a separate booklet, so have no candidate boxes)
        # (Business AS Unit 1 says "Answer all the questions")
        kind = "qp"
    else:
        kind = "other"  # a data booklet, an insert, a formula booklet
    code = f"{unit.group(1)}U{unit.group(2)}0-{unit.group(3)}" if unit else None
    said = re.search(r"\bUNIT\s*[–-]?\s*(\d)\b", text)
    if code and kind == "ms" and said:
        # A scheme's cover can misprint its code ("CHEMISTRY - UNIT 3 / 2410U20-1" in 2017, "2410U30-1" in 2018):
        # its unit's name wins, and Units 1 and 2 are AS (2…), the rest A-Level (1…).
        n = int(said.group(1))
        code = f"{2 if n <= 2 else 1}{code[1:4]}U{n}0-{code[-1]}"
    return kind, code, welsh


def main():
    raw, pdf, spec_dir = (os.path.join(WORK, d) for d in ("raw", "pdf", "spec"))
    for d in (raw, pdf, spec_dir):
        os.makedirs(d, exist_ok=True)
    manifest, gaps = [], []
    for subject, (page, bank, stem) in QUALS.items():
        if ONLY and subject != ONLY:
            continue
        qual_id = re.search(r'id="QualificationId"[^>]*value="(\d+)"', get(f"{SITE}/qualifications/{page}/")).group(1)
        rows = items(tab(qual_id, "pastpapers"))
        kept = {}  # (unit, kind, series): row
        seen = {}  # md5: file, so a second copy of a file is left out
        for it in sorted(rows, key=lambda r: r["Url"]):
            name = it["FileName"] or ""
            if it["ProductReference"] not in ("Past Paper", "Mark Scheme") or re.search(r"Practical|Further Math", name, re.I):
                continue
            if re.search(r"-mlp\.pdf$", it["Url"], re.I) or re.search(r"Modified|Font size", name, re.I):
                continue  # a large-print copy, sometimes listed as the "Past Paper" itself (2018 Maths Unit 1)
            series = SEASON.get(it["Series"], "X") + it["Year"][2:]
            url = urllib.parse.quote(it["Url"].replace("http://", "https://"), safe=":/")
            local = os.path.join(raw, re.sub(r"[^\w.-]+", "_", urllib.parse.unquote(url.split("/", 3)[3])))
            if not os.path.exists(local):
                try:
                    data = get(url, binary=True)
                except Exception as e:  # noqa: BLE001
                    gaps.append(f"{subject} {series}: {name}: download failed ({e})")
                    continue
                if not data.startswith(b"%PDF"):
                    gaps.append(f"{subject} {series}: {name}: not a PDF")
                    continue
                open(local, "wb").write(data)
            md5 = hashlib.md5(open(local, "rb").read()).hexdigest()
            if md5 in seen:
                continue
            seen[md5] = local
            kind, unit, welsh = read_cover(local)
            listed = re.search(r"Unit (\d)", name)
            if not unit and kind == "ms" and listed:  # 2016's schemes print no unit code: the list's "Unit 1"
                n = int(listed.group(1))
                unit = f"{2 if n <= 2 else 1}{stem}U{n}0-1"
            if kind == "other" or welsh or not unit or unit[1:4] != stem or unit[5:7] == PRACTICAL.get(stem):
                continue
            key = (unit, kind, series)
            if key in kept:
                continue
            title = re.sub(r"\s*\[.*?\]\s*$", "", name.split(" - ", 2)[-1]).strip()  # "Physics Unit 1: Written:Motion, Energy and Matter"
            kept[key] = {"component": unit.split("-")[0], "spec": unit[:4], "kind": kind, "series": series, "title": title,
                         "source": it["Url"], "local": local, "bank": bank, "as": unit.startswith("2")}
        # Examiners' reports and the specification, from the key documents.
        docs = items(tab(qual_id, "keydocuments"))
        reports = {}
        for d in docs:
            link = SITE + d["Link"] if d["Link"].startswith("/") else d["Link"]
            if d["DocumentType"] == "Specification" and not os.path.exists(os.path.join(spec_dir, f"{subject}.pdf")):
                open(os.path.join(spec_dir, f"{subject}.pdf"), "wb").write(get(link, binary=True))
            m = re.search(r"Report (Summer|Autumn) (\d{4})", d["Name"])
            if "Examiner" in d["DocumentType"] + d["Name"] and m and not re.search(r"-w\.pdf$|welsh|cymraeg", d["Link"], re.I):
                reports[SEASON[m.group(1)] + m.group(2)[2:]] = (link, d["Name"])
        for (unit, kind, series), row in sorted(kept.items()):
            name = f"WJEC-{unit}-{kind.upper()}-{series}.pdf"
            dest = os.path.join(pdf, name)
            local = row.pop("local")
            if not os.path.exists(dest):
                shutil.copyfile(local, dest)
            manifest.append({**row, "file": name, "r2": f"wjec/{name}", "bytes": os.path.getsize(dest)})
            if kind == "qp" and series in reports:
                link, report_name = reports[series]
                er = f"WJEC-{subject}-ER-{series}.pdf"
                if not os.path.exists(os.path.join(pdf, er)):
                    open(os.path.join(pdf, er), "wb").write(get(link, binary=True))
                manifest.append({**row, "kind": "er", "title": report_name, "source": link, "file": er, "r2": f"wjec/{er}",
                                 "bytes": os.path.getsize(os.path.join(pdf, er)), "section": unit[5]})
        for (unit, kind, series) in kept:
            if kind == "qp" and (unit, "ms", series) not in kept:
                gaps.append(f"{subject} {series} {unit}: no mark scheme")
            if kind == "qp" and series not in reports:
                gaps.append(f"{subject} {series} {unit}: no examiners' report")
        print(f"{subject}: {sum(1 for k in kept if k[1] == 'qp')} papers, {sum(1 for k in kept if k[1] == 'ms')} schemes, "
              f"reports {sorted(reports)}", file=sys.stderr)
    old = json.load(open(os.path.join(WORK, "manifest.json"))) if ONLY and os.path.exists(os.path.join(WORK, "manifest.json")) else []
    manifest = [r for r in old if r["bank"] != QUALS[ONLY][1]] + manifest if ONLY else manifest
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    open(os.path.join(WORK, "gaps.txt"), "w").write("\n".join(gaps) + "\n")
    print(f"{len(manifest)} rows; {len(gaps)} gaps (gaps.txt)", file=sys.stderr)


if __name__ == "__main__":
    main()
