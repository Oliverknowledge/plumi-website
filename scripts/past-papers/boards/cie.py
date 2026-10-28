"""Cambridge International's papers for the past paper library, from Cambridge's own site.

    python3 scripts/past-papers/boards/cie.py [--refresh]

Two public sources on cambridgeinternational.org, both plain server-rendered pages
(no endpoint behind them; the lists are in the HTML):

  1. Each syllabus's "Past papers, examiner reports and specimen papers" page,
     <syllabus page>/past-papers/. Cambridge makes one recent series public there
     (one variant per component), its examiner report, and the specimen papers.
  2. The grade threshold tables, one page per series per qualification, linked
     from .../grade-threshold-tables/. Every syllabus has one PDF per series.

Everything older is on the School Support Hub, behind a school login, and is not
fetched (gaps.md says what's missing per syllabus). Covers:

  cie        International AS & A Level Maths 9709, Further Maths 9231,
             Biology 9700, Chemistry 9701, Physics 9702
  cie-igcse  IGCSE Maths 0580, Maths (9-1) 0980, Additional Maths 0606,
             Biology 0610 / 0970, Chemistry 0620 / 0971, Physics 0625 / 0972

Downloads question papers, mark schemes, examiner reports, confidential
instructions (kind "ins"), inserts and grade thresholds, unmodified, to
.work/cie/pdf/CIE-<code with / as ->-<KIND>-<SERIES>.pdf, and writes
.work/cie/manifest.json (boards/README.md) and .work/cie/gaps.md. Polite: one
request at a time, pages cached for a week (--refresh re-reads them), PDFs cached
for good, so a re-run fetches only what's missing.
"""
import datetime, html, json, os, re, sys, time, urllib.error, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(os.path.join(HERE, "..", ".work", "cie"))
PDF = os.path.join(WORK, "pdf")
PAGES = os.path.join(WORK, "pages")
SITE = "https://www.cambridgeinternational.org"
PAGE_MAX_AGE = 7 * 86400
REFRESH = "--refresh" in sys.argv

GT_INDEX = {
    "cie": SITE + "/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/grade-threshold-tables/",
    "cie-igcse": SITE + "/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/grade-threshold-tables/",
}

# syllabus -> (subject, board, group, syllabus page slug)
SYLLABUSES = {
    "9709": ("a-level-maths", "cie", "AS & A Level (9709)", "cambridge-international-as-and-a-level-mathematics-9709"),
    "9231": ("a-level-further-maths", "cie", "AS & A Level (9231)", "cambridge-international-as-and-a-level-mathematics-further-9231"),
    "9700": ("a-level-biology", "cie", "AS & A Level (9700)", "cambridge-international-as-and-a-level-biology-9700"),
    "9701": ("a-level-chemistry", "cie", "AS & A Level (9701)", "cambridge-international-as-and-a-level-chemistry-9701"),
    "9702": ("a-level-physics", "cie", "AS & A Level (9702)", "cambridge-international-as-and-a-level-physics-9702"),
    "0580": ("gcse-maths", "cie-igcse", "IGCSE Mathematics (0580)", "cambridge-igcse-mathematics-0580"),
    "0980": ("gcse-maths", "cie-igcse", "IGCSE Mathematics 9–1 (0980)", "cambridge-igcse-mathematics-9-1-0980"),
    "0606": ("gcse-maths", "cie-igcse", "IGCSE Additional Mathematics (0606)", "cambridge-igcse-mathematics-additional-0606"),
    "0610": ("gcse-biology", "cie-igcse", "IGCSE (0610)", "cambridge-igcse-biology-0610"),
    "0970": ("gcse-biology", "cie-igcse", "IGCSE 9–1 (0970)", "cambridge-igcse-biology-9-1-0970"),
    "0620": ("gcse-chemistry", "cie-igcse", "IGCSE (0620)", "cambridge-igcse-chemistry-0620"),
    "0971": ("gcse-chemistry", "cie-igcse", "IGCSE 9–1 (0971)", "cambridge-igcse-chemistry-9-1-0971"),
    "0625": ("gcse-physics", "cie-igcse", "IGCSE (0625)", "cambridge-igcse-physics-0625"),
    "0972": ("gcse-physics", "cie-igcse", "IGCSE 9–1 (0972)", "cambridge-igcse-physics-9-1-0972"),
}

# Paper names as Cambridge prints them on the cover, by syllabus and component.
SCIENCE_AL = {"1": "Multiple Choice", "2": "AS Level Structured Questions", "3": "Advanced Practical Skills",
              "4": "A Level Structured Questions", "5": "Planning, Analysis and Evaluation"}
SCIENCE_IG = {"1": "Multiple Choice (Core)", "2": "Multiple Choice (Extended)", "3": "Theory (Core)",
              "4": "Theory (Extended)", "5": "Practical Test", "6": "Alternative to Practical"}
MATHS_IG = {"1": "Non-calculator (Core)", "2": "Non-calculator (Extended)", "3": "Calculator (Core)", "4": "Calculator (Extended)"}
MATHS_IG_TO_2024 = {"1": "(Core)", "2": "(Extended)", "3": "(Core)", "4": "(Extended)"}
PAPER_NAMES = {
    "9709": {"1": "Pure Mathematics 1", "2": "Pure Mathematics 2", "3": "Pure Mathematics 3", "4": "Mechanics",
             "5": "Probability & Statistics 1", "6": "Probability & Statistics 2"},
    "9231": {"1": "Further Pure Mathematics 1", "2": "Further Pure Mathematics 2", "3": "Further Mechanics",
             "4": "Further Probability & Statistics"},
    "9700": SCIENCE_AL, "9701": SCIENCE_AL, "9702": SCIENCE_AL,
    "0580": MATHS_IG, "0980": MATHS_IG,
    "0606": {"1": "Non-calculator", "2": "Calculator"},
    "0610": SCIENCE_IG, "0970": SCIENCE_IG, "0620": SCIENCE_IG, "0971": SCIENCE_IG, "0625": SCIENCE_IG, "0972": SCIENCE_IG,
}
# Syllabuses revised for first exams in 2025 (non-calculator papers came in): their
# 2024-and-earlier papers, report and thresholds sit in a ", legacy" group, under their old names.
OLD_NAMES_BEFORE_2025 = {"0580": MATHS_IG_TO_2024, "0980": MATHS_IG_TO_2024, "0606": {"1": "", "2": ""}}

MONTHS = {"january": "JAN", "february": "FEB", "march": "MAR", "may": "MAY", "june": "JUN", "october": "OCT", "november": "NOV"}
SKIP = re.compile(r"modified|large print|braille|enlarged|\bA3\b|\bUEB\b", re.I)


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                body = r.read()
                return body if binary else body.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (403, 404, 410):
                return None
            time.sleep(2)
        except Exception:  # noqa: BLE001
            time.sleep(2)
    return None


def page(url):
    """A Cambridge page's HTML, from the cache when it's under a week old."""
    os.makedirs(PAGES, exist_ok=True)
    path = os.path.join(PAGES, re.sub(r"[^a-z0-9]+", "-", url.split("//", 1)[1].lower()).strip("-") + ".html")
    if not REFRESH and os.path.exists(path) and time.time() - os.path.getmtime(path) < PAGE_MAX_AGE:
        return open(path, encoding="utf-8").read()
    body = get(url)
    time.sleep(1)
    if body is None:
        print("  page failed", url, file=sys.stderr)
        return None
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(body)
    return body


def text(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<!--.*?-->|<[^>]+>", " ", s))).strip()


def classify(title):
    """'June 2024 Mark Scheme Paper 11' -> ('ms', '11'); '2023 Specimen Paper 5 Confidential Instructions' -> ('ins', '5')."""
    t = title.lower()
    if re.search(r"confidential instructions|insert|pre-release|source booklet", t):
        kind = "ins"
    elif re.search(r"mark ?scheme", t):
        kind = "ms"
    elif "examiner report" in t:
        return "er", ""
    elif "question paper" in t or "specimen paper" in t:
        kind = "qp"
    else:
        return None, ""
    m = re.search(r"paper\s+(\d{1,2})\b", t)
    return (kind, m.group(1)) if m else (None, "")


def syllabus_files(syl):
    """Every file on one syllabus's past papers page: dicts with kind, comp, series, title, source."""
    slug = SYLLABUSES[syl][3]
    url = f"{SITE}/programmes-and-qualifications/{slug}/past-papers/"
    body = page(url)
    if not body:
        return [], url
    out = []
    # Walk the three lists in page order, tracking the year (h3) and month (h4) headings.
    for sec in re.finditer(r'<div class="related-dynamic-content-list ([a-z-]+)">(.*?)</div>', body, re.S):
        section, chunk = sec.group(1), sec.group(2)
        year = month = None
        for tok in re.finditer(r"<h3>(.*?)</h3>|<h4>(.*?)</h4>|<a href=\"(/Images/[^\"]+\.pdf)\"[^>]*>(.*?)</a>", chunk, re.S):
            if tok.group(1) is not None:
                year, month = text(tok.group(1)), None
                continue
            if tok.group(2) is not None:
                month = text(tok.group(2)).lower()
                continue
            href, title = tok.group(3), re.sub(r"\(PDF[^)]*\)", "", text(tok.group(4))).strip()
            if SKIP.search(title) or SKIP.search(href):
                continue
            kind, comp = classify(title)
            if not kind:
                print(f"  {syl}: skipped {title!r}", file=sys.stderr)
                continue
            if section == "specimen-paper":
                series = "SPEC"
            elif month in MONTHS and year and year.isdigit():
                series = MONTHS[month] + year[2:]
            else:
                print(f"  {syl}: no series for {title!r}", file=sys.stderr)
                continue
            out.append({"kind": kind, "comp": comp, "series": series, "title": title, "source": SITE + href, "year": year})
    return out, url


def threshold_files(board):
    """{(syllabus, series): (title, url)} from every grade threshold series page for one qualification."""
    index = GT_INDEX[board]
    body = page(index)
    found, pages = {}, []
    if not body:
        return found, pages
    base = index.split(SITE, 1)[1]
    for slug in sorted(set(re.findall(re.escape(base) + r"([a-z0-9-]+)", body))):
        m = re.match(r"(january|february|march|may|june|october|november)-?(\d{4})", slug)
        if not m:
            continue
        series = MONTHS[m.group(1)] + m.group(2)[2:]
        pages.append(series)
        listing = page(f"{index}{slug}/")
        if not listing:
            continue
        for a in re.finditer(r'<a href="(/Images/[^"]+\.pdf)"[^>]*>(.*?)</a>', listing, re.S):
            href, title = a.group(1), text(a.group(2))
            code = re.search(r"\((\d{4})\)", title)
            if not code or code.group(1) not in SYLLABUSES or SKIP.search(title):
                continue
            key = (code.group(1), series)
            if key in found and found[key][1] != SITE + href:
                print(f"  two threshold tables for {key}: {found[key][0]!r}, {title!r}", file=sys.stderr)
                continue
            found[key] = (re.sub(r"\(PDF[^)]*\)", "", title).strip(), SITE + href)
    return found, pages


def legacy(syl, series):
    return syl in OLD_NAMES_BEFORE_2025 and series != "SPEC" and int(series[3:]) < 25


def paper_name(syl, comp, series):
    n = comp[0]
    names = PAPER_NAMES[syl]
    if legacy(syl, series):
        title = OLD_NAMES_BEFORE_2025[syl].get(n, "")
        return f"Paper {n} {title}".strip()
    return f"Paper {n}: {names[n]}" if n in names else f"Paper {n}"


def code_of(syl, comp):
    """The component code as printed: variants ('11') as they are, specimens ('1') as '01'."""
    return f"{syl}/{comp.zfill(2)}"


def download(url, out):
    if os.path.exists(out):
        return True
    body = get(url, binary=True)
    time.sleep(0.5)
    if not body or not body.startswith(b"%PDF"):
        print("  not a pdf", url, file=sys.stderr)
        return False
    with open(out, "wb") as fh:
        fh.write(body)
    return True


def main():
    os.makedirs(PDF, exist_ok=True)
    manifest, failed, report = [], [], {}
    gts, gt_series = {}, {}
    for board in GT_INDEX:
        found, pages = threshold_files(board)
        gts.update(found)
        gt_series[board] = pages
    for syl, (subject, board, group, slug) in SYLLABUSES.items():
        files, url = syllabus_files(syl)
        entries = []
        for f in files:
            if f["kind"] == "er":
                code, paper = syl, "Examiner report"
            else:
                code, paper = code_of(syl, f["comp"]), paper_name(syl, f["comp"], f["series"])
            entries.append((code, paper, f["kind"], f["series"], f["source"]))
        for (s, series), (title, src) in sorted(gts.items()):
            if s == syl:
                entries.append((syl, "Grade thresholds", "gt", series, src))
        seen = set()
        for code, paper, kind, series, src in entries:
            name = f"CIE-{code.replace('/', '-')}-{kind.upper()}-{series}.pdf"
            if name in seen:
                print(f"  {syl}: two files for {name}, kept the first", file=sys.stderr)
                continue
            seen.add(name)
            if not download(src, os.path.join(PDF, name)):
                failed.append(src)
                continue
            manifest.append({"subject": subject, "board": board, "group": group + (", legacy" if legacy(syl, series) else ""), "paper": paper, "code": code,
                             "series": series, "kind": kind, "source": src, "file": f"cie/{name}"})
        spec_years = sorted({f["year"] for f in files if f["series"] == "SPEC" and f.get("year")})
        report[syl] = (url, [e for e in manifest if e["code"].split("/")[0] == syl], spec_years[-1] if spec_years else "")
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1, ensure_ascii=False)
    write_gaps(report, gt_series, failed)
    size = sum(os.path.getsize(os.path.join(PDF, os.path.basename(f["file"]))) for f in manifest)
    print(f"{len(manifest)} files, {size / 1e6:.1f} MB in {PDF}; {len(failed)} failed", file=sys.stderr)


def series_label(s):
    if s == "SPEC":
        return "specimen"
    return {"JAN": "Jan", "FEB": "Feb", "MAR": "Feb/Mar", "MAY": "May", "JUN": "May/Jun", "OCT": "Oct", "NOV": "Oct/Nov"}[s[:3]] + " 20" + s[3:]


def series_key(s):
    return (0, 0) if s == "SPEC" else (int(s[3:]), list(MONTHS.values()).index(s[:3]))


def ranges(series):
    """['MAR22', 'JUN22', 'NOV22', 'MAR23'] -> 'Feb/Mar 2022 to Feb/Mar 2023 (4 series)'."""
    s = sorted(series, key=series_key)
    if not s:
        return "none"
    return series_label(s[0]) if len(s) == 1 else f"{series_label(s[0])} to {series_label(s[-1])} ({len(s)} series)"


def write_gaps(report, gt_series, failed):
    today = datetime.date.today().isoformat()
    every = {b: sorted(v, key=series_key) for b, v in gt_series.items()}
    lines = [
        "# Cambridge International (CAIE): what isn't public",
        "",
        f"Checked {today} by `boards/cie.py` against cambridgeinternational.org.",
        "",
        "Cambridge keeps its past paper archive on the **School Support Hub**, which needs a",
        "login from a registered Cambridge school. We don't fetch anything from it, or from",
        "any mirror. On its public site Cambridge publishes, per syllabus, only:",
        "",
        "- **one recent series** of question papers and mark schemes, currently May/June 2024,",
        "  and only **one time-zone variant** of each component (9709/11, not /12 or /13);",
        "  plus the confidential instructions for practical papers, where it has them;",
        "- that series's **examiner report** (one report for the whole syllabus);",
        "- the **specimen papers** and mark schemes for the current syllabus;",
        "- **grade threshold tables**, one PDF per syllabus per series, on separate pages: "
        + "; ".join(f"{'AS & A Level' if b == 'cie' else 'IGCSE'} {ranges(v)}" for b, v in every.items() if v) + ".",
        "  Tables before Feb/March 2022 are no longer on the public site.",
        "",
        "So for every syllabus, everything else is **School Support Hub only**: every Feb/March",
        "and Oct/Nov paper, every May/June series except 2024, the other variants of the 2024",
        "papers, and the examiner reports for every series except May/June 2024.",
        "",
        "## Per syllabus",
        "",
    ]
    for syl, (url, files, spec_year) in report.items():
        subject, board, group, _ = SYLLABUSES[syl]
        exam = [f for f in files if f["series"] != "SPEC"]
        live = sorted({f["series"] for f in exam if f["kind"] in ("qp", "ms")}, key=series_key)
        comps = sorted({f["code"] for f in exam if f["kind"] == "qp"})
        spec = sorted({f["code"] for f in files if f["series"] == "SPEC" and f["kind"] == "qp"})
        er = sorted({f["series"] for f in files if f["kind"] == "er"}, key=series_key)
        gt = sorted({f["series"] for f in files if f["kind"] == "gt"}, key=series_key)
        ins = sorted({f"{f['code']} ({series_label(f['series'])})" for f in files if f["kind"] == "ins"})
        no_ms = sorted({f["code"] for f in exam if f["kind"] == "qp"} - {f["code"] for f in exam if f["kind"] == "ms"})
        sat = [s for s in every.get(board, []) if s in gt]  # a syllabus has a threshold table for each series it was sat in
        no_march = gt and not any(s.startswith("MAR") for s in gt)
        lines += [f"### {syl}: {group} ({subject}, `{board}`)", "", f"Page: {url}", ""]
        if not files:
            lines += ["- Nothing public on Cambridge's site: School Support Hub only.", ""]
            continue
        lines.append(f"- **Public, fetched:** {', '.join(series_label(s) for s in live) or 'no exam series'} "
                     f"question papers and mark schemes, {', '.join(comps) or 'none'}"
                     + (f"; examiner report {', '.join(series_label(s) for s in er)}" if er else "")
                     + (f"; specimen papers {', '.join(spec)}" + (f" (for exams from {spec_year})" if spec_year else "") if spec else "")
                     + (f"; confidential instructions {', '.join(ins)}" if ins else "")
                     + (f"; grade thresholds {ranges(gt)}" if gt else "") + ".")
        if no_ms:
            lines.append(f"- No public mark scheme for {', '.join(no_ms)}.")
        others = [s for s in sat if s not in live]
        live_names = ", ".join(series_label(s) for s in live)
        lines.append("- **School Support Hub only:** question papers, mark schemes and examiner reports for "
                     + (f"every series it was sat in from {series_label(sat[0])} to {series_label(sat[-1])}"
                        + (f" except {live_names}" if live else "") + f", {len(others)} series ({', '.join(series_label(s) for s in others)}); "
                        if others else "")
                     + "every series before Feb/Mar 2022"
                     + (f"; the other time-zone variants of the {live_names} papers" if live else "")
                     + "; grade thresholds before Feb/Mar 2022.")
        if no_march:
            lines.append("- Not sat in Feb/March (no March threshold tables), so there are no March papers to miss.")
        if any(syl == s for s in OLD_NAMES_BEFORE_2025):
            lines.append("- Revised for first exams in 2025: the 2024 papers, report and older thresholds are the "
                         "previous syllabus, grouped as legacy.")
        lines.append("")
    if failed:
        lines += ["## Listed but not downloadable", ""] + [f"- {u}" for u in failed] + [""]
    with open(os.path.join(WORK, "gaps.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


if __name__ == "__main__":
    main()
