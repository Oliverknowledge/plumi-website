"""Fetch OCR's own past papers (OCR and OCR MEI) for Plumi's past paper library.

    python3 scripts/past-papers/boards/ocr.py           # list, download what's missing, write manifest + gaps
    python3 scripts/past-papers/boards/ocr.py --list    # parse OCR's pages and print the plan, download nothing

Source: each qualification's "Assessment" page on ocr.org.uk, e.g.
  https://www.ocr.org.uk/qualifications/as-and-a-level/mathematics-a-h230-h240-from-2017/assessment/
The page is plain server-rendered HTML (no API): tabs per level ("A Level", "AS
Level"; GCSE pages have one), then accordions "Question papers, mark schemes and
reports" > "2025 - June series" > (GCSE) "Foundation tier" / "Higher tier" /
"Other links", each a list of links to /Images/<id>-<slug>.pdf with the
component code beside it. "Sample assessment materials", "Pre-release materials"
and "Withdrawn qualification materials" (the legacy specifications) sit beside it.

The newest series sit only on Teach Cambridge (OCR's teacher login); they are
recorded in gaps.md, never fetched. Modified papers (zips), answer books, errata,
moderators' reports and other teacher material are left out.

Writes, under scripts/past-papers/.work/ocr/:
  pdf/<name>.pdf     OCR's PDF, unmodified (name = basename of the R2 key)
  manifest.json      one entry per file in the shape boards/README.md gives
  gaps.md            what OCR doesn't publish publicly, per specification
Polite: one request at a time, a pause between downloads, cached on disk, so a
re-run only fetches the 16 listing pages and whatever is new.
"""
import collections, hashlib, html as htmllib, json, os, re, shutil, sys, time, urllib.error, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
SITE = "https://www.ocr.org.uk"
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "..", ".work", "ocr")
PDF = os.path.join(WORK, "pdf")

# ── What to fetch ─────────────────────────────────────────────────────────────
# One assessment page per qualification. "specs" maps each specification on the
# page to its library slot; "legacy" maps the unit codes under "Withdrawn
# qualification materials" to the legacy specification they belonged to.
A, AS, F, H = "A-Level", "AS", "Foundation tier", "Higher tier"
PAGES = [
    dict(path="as-and-a-level/mathematics-a-h230-h240-from-2017", subject="a-level-maths", board="ocr",
         specs={"H240": A, "H230": AS}, tabs={"A Level": "H240", "AS Level": "H230"},
         legacy={r"47\d\d": "7890"}),
    dict(path="as-and-a-level/mathematics-b-mei-h630-h640-from-2017", subject="a-level-maths", board="ocr-mei",
         specs={"H640": A, "H630": AS}, tabs={"A Level": "H640", "AS Level": "H630"},
         legacy={r"47\d\d": "7895"}),
    dict(path="as-and-a-level/further-mathematics-a-h235-h245-from-2017", subject="a-level-further-maths", board="ocr",
         specs={"H245": A, "H235": AS}, tabs={"A Level": "H245", "AS Level": "H235"},
         legacy={r"47\d\d": "7892"}),
    dict(path="as-and-a-level/further-mathematics-b-mei-h635-h645-from-2017", subject="a-level-further-maths", board="ocr-mei",
         specs={"H645": A, "H635": AS}, tabs={"A Level": "H645", "AS Level": "H635"},
         legacy={r"47\d\d": "7896"}),
    dict(path="as-and-a-level/biology-a-h020-h420-from-2015", subject="a-level-biology", board="ocr",
         specs={"H420": A, "H020": AS}, tabs={"A Level": "H420", "AS Level": "H020"}, label="Biology A"),
    dict(path="as-and-a-level/biology-b-advancing-biology-h022-h422-from-2015", subject="a-level-biology", board="ocr",
         specs={"H422": A, "H022": AS}, tabs={"A Level": "H422", "AS Level": "H022"}, label="Biology B"),
    dict(path="as-and-a-level/chemistry-a-h032-h432-from-2015", subject="a-level-chemistry", board="ocr",
         specs={"H432": A, "H032": AS}, tabs={"A Level": "H432", "AS Level": "H032"}, label="Chemistry A"),
    dict(path="as-and-a-level/chemistry-b-salters-h033-h433-from-2015", subject="a-level-chemistry", board="ocr",
         specs={"H433": A, "H033": AS}, tabs={"A Level": "H433", "AS Level": "H033"}, label="Chemistry B"),
    dict(path="as-and-a-level/physics-a-h156-h556-from-2015", subject="a-level-physics", board="ocr",
         specs={"H556": A, "H156": AS}, tabs={"A Level": "H556", "AS Level": "H156"}, label="Physics A",
         legacy={r"G48\d": "H558"}),
    dict(path="as-and-a-level/physics-b-advancing-physics-h157-h557-from-2015", subject="a-level-physics", board="ocr",
         specs={"H557": A, "H157": AS}, tabs={"A Level": "H557", "AS Level": "H157"}, label="Physics B",
         legacy={r"G49\d": "H559"}),
    dict(path="gcse/mathematics-j560-from-2015", subject="gcse-maths", board="ocr",
         specs={"J560": "GCSE"}, legacy={r"J567": "J567", r"A50\d": "J562"}),
    dict(path="gcse/gateway-science-suite-biology-a-j247-from-2016", subject="gcse-biology", board="ocr",
         specs={"J247": "GCSE"}, label="Biology A", legacy={r"B73\d": "J263"}),
    dict(path="gcse/twenty-first-century-science-suite-biology-b-j257-from-2016", subject="gcse-biology", board="ocr",
         specs={"J257": "GCSE"}, label="Biology B", legacy={r"A16\d": "J243"}),
    dict(path="gcse/gateway-science-suite-chemistry-a-j248-from-2016", subject="gcse-chemistry", board="ocr",
         specs={"J248": "GCSE"}, label="Chemistry A", legacy={r"B74\d": "J264"}),
    dict(path="gcse/twenty-first-century-science-suite-chemistry-b-j258-from-2016", subject="gcse-chemistry", board="ocr",
         specs={"J258": "GCSE"}, label="Chemistry B", legacy={r"A17\d": "J244"}),
    dict(path="gcse/gateway-science-suite-physics-a-j249-from-2016", subject="gcse-physics", board="ocr",
         specs={"J249": "GCSE"}, label="Physics A", legacy={r"B75\d": "J265"}),
    dict(path="gcse/twenty-first-century-science-suite-physics-b-j259-from-2016", subject="gcse-physics", board="ocr",
         specs={"J259": "GCSE"}, label="Physics B", legacy={r"A18\d": "J245"}),
]
# Further Maths components carry their own codes (Y5xx for OCR, Y4xx for MEI).
COMPONENT_SPEC = {"Y54": "H245", "Y53": "H235", "Y42": "H645", "Y43": "H645", "Y41": "H635"}
# Legacy (pre-2017 maths, pre-2015 A-Level science, pre-2016 GCSE) unit names as students knew them.
LEGACY_UNITS = {
    "4721": "C1: Core Mathematics 1", "4722": "C2: Core Mathematics 2", "4723": "C3: Core Mathematics 3",
    "4724": "C4: Core Mathematics 4", "4725": "FP1: Further Pure Mathematics 1", "4726": "FP2: Further Pure Mathematics 2",
    "4727": "FP3: Further Pure Mathematics 3", "4728": "M1: Mechanics 1", "4729": "M2: Mechanics 2",
    "4730": "M3: Mechanics 3", "4731": "M4: Mechanics 4", "4732": "S1: Probability and Statistics 1",
    "4733": "S2: Probability and Statistics 2", "4734": "S3: Probability and Statistics 3",
    "4735": "S4: Probability and Statistics 4", "4736": "D1: Decision Mathematics 1", "4737": "D2: Decision Mathematics 2",
    "4751": "C1: Introduction to Advanced Mathematics", "4752": "C2: Concepts for Advanced Mathematics",
    "4753": "C3: Methods for Advanced Mathematics", "4754": "C4: Applications of Advanced Mathematics",
    "4755": "FP1: Further Concepts for Advanced Mathematics", "4756": "FP2: Further Methods for Advanced Mathematics",
    "4757": "FP3: Further Applications of Advanced Mathematics", "4758": "DE: Differential Equations",
    "4761": "M1: Mechanics 1", "4762": "M2: Mechanics 2", "4763": "M3: Mechanics 3", "4764": "M4: Mechanics 4",
    "4766": "S1: Statistics 1", "4767": "S2: Statistics 2", "4768": "S3: Statistics 3", "4769": "S4: Statistics 4",
    "4771": "D1: Decision Mathematics 1", "4772": "D2: Decision Mathematics 2", "4776": "NM: Numerical Methods",
    "4777": "NC: Numerical Computation", "4798": "FPT: Further Pure Mathematics with Technology",
    "A501": "Unit A", "A502": "Unit B", "A503": "Unit C",
}
# Names for a booklet that belongs to a whole specification rather than one paper.
DB_NAME = {"H245": "Formulae Booklet", "H235": "Formulae Booklet", "H645": "Formulae Booklet", "H635": "Formulae Booklet",
           "H556": "Data, Formulae and Relationships Booklet", "H156": "Data, Formulae and Relationships Booklet",
           "H557": "Data, Formulae and Relationships Booklet", "H157": "Data, Formulae and Relationships Booklet",
           "J560": "Formulae Sheet", "J249": "Equation Sheet"}
KIND_CODE = {"qp": "QP", "ms": "MS", "er": "ER", "ins": "INS", "db": "DB"}
MONTHS = {"january": "JAN", "march": "MAR", "may": "MAY", "june": "JUN", "october": "OCT", "november": "NOV"}
# OCR's listing files the June 2024 H433/02 question paper under a "2024 - January series" heading
# (the paper is (c) OCR 2024 and June 2024 has its mark scheme and article but no paper). A-Levels
# have had no January sitting since 2014, so any January heading on an A-Level page is read as June.
JANUARY_IS_JUNE = True
# Links on OCR's pages that serve the wrong file, found by reading the code and series printed
# inside every downloaded PDF. Keyed by the number OCR's file names start with: None leaves the
# link out, a dict corrects what OCR's listing says about it.
FIXES = {
    "643848": None,  # H020/02 Nov 2020 mark scheme link serves H420/02's
    "643563": None,  # H422/01 Nov 2020 mark scheme link serves H032/01's
    "752782": None,  # H022/02 Jun 2025 mark scheme link serves H022/01's (same bytes)
    "727474": None,  # J247/04 Jun 2024 examiners' report link serves the June 2023 report
    "727397": None,  # J257/04 Jun 2024 examiners' report link serves Gateway J247/04's (added to J247 below)
    "240203": {"code": "A162/02"},  # listed as A162/01; the PDF is the A162/02 (Higher) mark scheme
    "321824": {"code": "A162/02"},
    "240205": {"code": "A163/02"},
    "470037": {"code": "B752/01"},  # listed as a second B751/01 paper; the PDF is B752/01
}
# Files OCR lists on the wrong page, as rows for the page they belong to.
EXTRA = {"gcse/gateway-science-suite-biology-a-j247-from-2016": [
    dict(tab="", section="Question papers, mark schemes and reports", series="2024 - June series", sub="Higher tier",
         href="/Images/727397-examiners-report-depth-in-biology.pdf", title="Examiners' report - Paper 4", code="J247/04")]}
SECTIONS = {"Question papers, mark schemes and reports": "current", "Sample assessment materials": "sam",
            "Pre-release materials": "prerelease", "Withdrawn qualification materials": "legacy"}
SKIP = re.compile(r"modified|large print|braille|enlarged|analysis grid|highlights|comment summary|moderator|"
                  r"answer ?book|\bpab\b|erratum|correction|notice to centres|instructions|exemplar|annotated|"
                  r"teacher|guide|checklist|hints|poster|candidate|taster", re.I)


# ── Fetching ──────────────────────────────────────────────────────────────────
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


# ── Reading an assessment page ────────────────────────────────────────────────
TOKEN = re.compile(
    r'<div id="specification-tab-(\d+)"'                                   # 1: a tab's body starts
    r'|<a id="[^"]+" href="#specification-tab-(\d+)">([^<]*)</a>'           # 2,3: a tab's name
    r'|<h[3-6]\s[^>]*class="level-(\d) heading[^"]*"[^>]*>\s*<span>(.*?)</span>'  # 4,5: accordion heading
    r'|<li class="resource[^"]*">\s*<a href="([^"]+)"[^>]*>(.*?)</a>(.*?)</li>', re.S)  # 6,7,8: a file


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
            out.append(dict(tab=tab, section=heads.get(1, ""), series=heads.get(2, ""), sub=heads.get(3, ""),
                            href=m.group(6).strip(), title=text(m.group(7)), code=text(code.group(1)) if code else ""))
    return out


def series_of(heading, title, gcse):
    if not heading:
        m = re.search(r"(January|March|May|June|October|November) (20\d\d)", title)
        return MONTHS[m.group(1).lower()] + m.group(2)[2:] if m else None
    m = re.match(r"(20\d\d) - (\w+) series", heading)
    if not m:
        return None
    month = MONTHS.get(m.group(2).lower())
    if month == "JAN" and JANUARY_IS_JUNE and not gcse:
        month = "JUN"
    return month + m.group(1)[2:] if month else None


def kind_of(title, section):
    t = title.lower()
    if SKIP.search(t):
        return None
    if section == "sam":
        if re.search(r"data|formula|equation", t):
            return "db"
        return "qp"  # OCR's sample assessment material is one PDF: question paper then mark scheme
    if re.search(r"\binsert\b|advance notice|pre-release|\barticle\b", t):  # not "particle"
        return "ins"
    if re.search(r"data sheet|data booklet|formula|equation sheet|data, formulae", t):
        return "db"
    if t.startswith("question paper"):
        return "qp"
    if t.startswith("mark scheme"):
        return "ms"
    if t.startswith("examiners") or t.startswith("examiner's"):
        return "er"
    if section == "prerelease":
        return None
    return None


SPEC_TOKEN = re.compile(r"(?<![A-Za-z0-9])([A-HJ-Z]\d{3}|4\d{3})A?(?![0-9])")


def components(s):
    """'H240/01' -> [('H240','01')]; 'J560 04/05/06' -> three; 'H240/01-H240/03' -> 01..03;
    'Y420-01' and 'H245/Y540' -> Y-code component 01; '4754/01/B' -> ('4754','01B'); 'H032/H432' -> specs only."""
    s = s.replace("//", "/")
    hits = list(SPEC_TOKEN.finditer(s))
    comps, specs = [], []
    for i, m in enumerate(hits):
        spec = m.group(1)
        tail = s[m.end(): hits[i + 1].start() if i + 1 < len(hits) else len(s)]
        nums = re.match(r"\s*[-/ ]\s*((?:\d{1,2}\s*(?:/\s*[AB]\b|[AB]\b)?\s*[/,-]?\s*(?:and\s*)?)+)", tail)
        if spec.startswith("Y") and not nums:
            comps.append((spec, "01"))
            continue
        if not nums:
            specs.append(spec)
            continue
        for n in re.finditer(r"(\d{1,2})\s*(?:/\s*([AB])\b|([AB])\b)?", nums.group(1)):
            num = n.group(1)
            num = "01" if num == "0" else num.zfill(2)
            comps.append((spec, num + (n.group(2) or n.group(3) or "")))
        if re.search(r"\d\s*-\s*$", nums.group(1)) and i + 1 < len(hits) and hits[i + 1].group(1) == spec:
            comps.append(("RANGE", ""))
    # 'X/01-X/03' and 'X/01-03' are ranges.
    out, i = [], 0
    while i < len(comps):
        if comps[i][0] == "RANGE" and out and i + 1 < len(comps):
            a, b = int(out[-1][1][:2]), int(comps[i + 1][1][:2])
            out += [(out[-1][0], str(k).zfill(2)) for k in range(a + 1, b + 1)]
            i += 2
            continue
        if comps[i][0] != "RANGE":
            out.append(comps[i])
        i += 1
    if re.search(r"\b(\d{2})\s*-\s*(\d{2})\b", s) and len(out) == 2 and out[0][0] == out[1][0]:
        a, b = int(out[0][1][:2]), int(out[1][1][:2])
        out = [(out[0][0], str(k).zfill(2)) for k in range(a, b + 1)]
    seen, uniq = set(), []
    for c in out:
        if c not in seen:
            seen.add(c)
            uniq.append(c)
    return uniq, specs


def title_case(s):
    small = {"and", "in", "of", "with", "for", "the", "to", "on"}
    words = s.split(" ")
    out = []
    for i, w in enumerate(words):
        lw = w.lower()
        if i and lw in small:
            out.append(lw)
        elif re.fullmatch(r"[a-z]", lw) or re.fullmatch(r"[a-z]\d", lw):
            out.append(w.upper())
        elif w.isupper() and len(w) > 1:
            out.append(w)
        else:
            out.append(w[:1].upper() + w[1:].lower())
    return " ".join(out)


def clean_title(title):
    t = re.sub(r"^(question paper|mark scheme|examiners'? report|insert)\s*-\s*", "", title, flags=re.I)
    t = re.sub(r"^unit [A-Z]?\d{3,4}(/\s*\d+)?\s*-?\s*", "", t, flags=re.I)
    t = re.sub(r"\s*-?\s*(june|november|january)(\s+20\d\d)?\s*$", "", t, flags=re.I)
    t = re.sub(r"\s*-?\s*\b(foundation|higher) tier\b", "", t, flags=re.I)
    t = re.sub(r"\s*-\s*$", "", t)
    t = re.sub(r"\s*(insert|advance notice article|data booklet|formulae sheet)\s*$", "", t, flags=re.I)
    return t.strip(" -")


# ── Turning OCR's listing into library entries ────────────────────────────────
def group_label(spec, level, tier=None, legacy=False, label=None):
    name = f"{tier} ({spec})" if tier else f"{level} ({spec})"
    if label:
        name = f"{label} {name}" if tier else f"{label} ({spec})" if level == A else f"{label} AS ({spec})"
    return name + (", legacy" if legacy else "")


def tier_of_component(spec, comp, legacy_spec):
    n = int(comp[:2])
    if legacy_spec in ("J567",):
        return F if n <= 2 else H
    if spec.startswith("J"):
        return F if n <= (3 if spec == "J560" else 2) else H
    return F if n == 1 else H  # legacy GCSE units: /01 foundation, /02 higher


def entries_for(page):
    html = get(f"{SITE}/qualifications/{page['path']}/assessment/")
    if not html:
        raise SystemExit(f"could not fetch the assessment page for {page['path']}")
    gcse = page["subject"].startswith("gcse")
    rows, headings = [], collections.defaultdict(set)
    for r in listing(html):
        fix = FIXES.get(re.sub(r"^.*/(\d+)-[^/]*$", r"\1", r["href"]), False)
        if fix is None:
            continue
        r = dict(r, **fix) if fix else r
        r["code"] = re.sub(r"\b(4754)\s*/\s*([AB])\b", r"\1/01\2", r["code"])  # MEI C4 'Paper A/B' as '4754/A'
        rows.append(r)
    rows += EXTRA.get(page["path"], [])
    items, skipped = [], collections.Counter()
    for r in rows:
        section = SECTIONS.get(r["section"])
        if not section:
            continue
        if r["series"]:
            headings[(r["tab"], section)].add(r["series"])
        href = r["href"]
        if href.startswith("/"):
            href = SITE + href
        if not re.match(r"https://(www\.)?ocr\.org\.uk/", href, re.I):
            skipped["not on ocr.org.uk"] += 1
            continue
        if not href.lower().endswith(".pdf"):
            skipped["not a PDF (" + href.rsplit(".", 1)[-1].lower() + ")"] += 1
            continue
        kind = kind_of(r["title"], section)
        if not kind:
            skipped[r["title"].split(" - ")[0][:40]] += 1
            continue
        series = "SPEC" if section == "sam" else series_of(r["series"], r["title"], gcse)
        if not series:
            skipped["no series"] += 1
            continue
        comps, specs = components(r["code"] or "")
        if not comps and not specs or (section == "legacy" and not comps):
            c2, s2 = components(r["title"])
            comps, specs = comps or c2, specs or s2
        base = dict(subject=page["subject"], board=page["board"], series=series, kind=kind, source=href,
                    title=r["title"], tab=r["tab"], sub=r["sub"], section=section)
        if section == "legacy":
            items += legacy_entries(page, base, comps, specs, r)
        else:
            items += current_entries(page, base, comps, r, gcse)
    return items, headings, skipped


def current_entries(page, base, comps, r, gcse):
    out = []
    if gcse:
        spec = next(iter(page["specs"]))
        own = [c for c in comps if c[0] == spec]
        tiers = {tier_of_component(spec, c[1], None) for c in own}
        t = r["title"].lower() + " " + r["sub"].lower()
        if "foundation" in t:
            tiers = {F}
        elif "higher" in t:
            tiers = {H}
        if len(own) == 1 or (len(own) > 1 and base["kind"] != "db"):
            code = spec + "/" + "/".join(c[1] for c in own) if len(own) > 1 else f"{spec}/{own[0][1]}"
            out.append(dict(base, group=group_label(spec, None, tiers.pop() if len(tiers) == 1 else F, label=page.get("label")),
                            code=code, comps=own, spec=spec))
        else:
            for tier in (sorted(tiers) if tiers else [F, H]):
                # A tier's own sheet gets the tier's components in its code, so the two tiers' files stay apart.
                code = spec if not tiers or base["kind"] != "db" or len(tiers) > 1 else \
                    spec + "/" + "/".join(f"0{n}" for n in ((1, 2, 3) if spec == "J560" else (1, 2)) if tier == F) + \
                    "/".join(f"0{n}" for n in ((4, 5, 6) if spec == "J560" else (3, 4)) if tier == H)
                out.append(dict(base, group=group_label(spec, None, tier, label=page.get("label")), code=code, comps=[], spec=spec))
        return out
    # A-Level: the component's code says which specification it is; booklets follow the tab.
    by_spec = collections.defaultdict(list)
    for spec, comp in comps:
        by_spec[spec].append((spec, comp))
    tab_spec = page["tabs"].get(base["tab"])
    if base["kind"] == "db" and (not by_spec or sum(len(v) for v in by_spec.values()) > 1):
        by_spec = {}
    if not by_spec:
        if not tab_spec:
            return []
        level = page["specs"][tab_spec]
        out.append(dict(base, group=group_label(tab_spec, level, label=page.get("label")), code=tab_spec, comps=[], spec=tab_spec))
        return out
    for _, cs in by_spec.items():
        comp_specs = {c[0] for c in cs}
        owner = cs[0][0] if cs[0][0] in page["specs"] else COMPONENT_SPEC.get(cs[0][0][:3])
        if owner not in page["specs"]:
            owner = tab_spec
        if not owner:
            continue
        level = page["specs"][owner]
        if len(comp_specs) == 1 and len(cs) > 1:
            code = cs[0][0] + "/" + "-".join([cs[0][1], cs[-1][1]]) if len(cs) > 2 else cs[0][0] + "/" + "-".join(c[1] for c in cs)
        else:
            code = "/".join(cs[0])
        out.append(dict(base, group=group_label(owner, level, label=page.get("label")), code=code, comps=cs, spec=owner))
    return out


def legacy_entries(page, base, comps, specs, r):
    gcse = page["subject"].startswith("gcse")

    def legacy_spec(unit):
        for pattern, spec in page.get("legacy", {}).items():
            if re.fullmatch(pattern, unit):
                return spec
        return None

    out = []
    units = [c for c in comps if legacy_spec(c[0])]
    if not units and not gcse:
        # 'Mark scheme - Unit G484 - The Newtonian world': the unit has one paper, /01.
        units = [(u, "01") for u in specs if legacy_spec(u)][:1]
    if not units:
        # A report for every unit of the old specification.
        lspecs = set(page.get("legacy", {}).values())
        if base["kind"] == "er" and len(lspecs) == 1 and not gcse:
            ls = lspecs.pop()
            out.append(dict(base, group=group_label(ls, A, legacy=True), code=ls, comps=[], spec=ls, legacy=True))
        return out
    unit, comp = units[0]
    ls = legacy_spec(unit)
    if gcse:
        # The component number decides the tier: OCR's titles get it wrong (a B751/02 "Foundation tier" paper is Higher).
        tier = tier_of_component(unit, comp, ls)
        group = group_label(ls, None, tier, legacy=True)
    else:
        group = group_label(ls, A, legacy=True)
    ab = re.search(r"\bpaper ([ab])\b", r["title"], re.I)
    if unit == "4754" and ab and len(units) == 1:
        comp = comp[:2] + ab.group(1).upper()
        units = [(unit, comp)]
    code = f"{unit}/{comp}" if len(units) == 1 else unit + "/" + "/".join(c[1] for c in units)
    out.append(dict(base, group=group, code=code, comps=units, spec=ls, legacy=True))
    return out


def paper_names(items):
    """One name per (group, code), from the titles OCR gives its question papers."""
    titles = collections.defaultdict(collections.Counter)
    for it in items:
        if it["comps"] and it["kind"] in ("qp", "ms", "er"):
            weight = {"qp": 3, "ms": 2, "er": 1}[it["kind"]]
            titles[(it["group"], it["code"], True)][clean_title(it["title"])] += weight
    names = {}
    for it in items:
        key = (it["group"], it["code"], bool(it["comps"]))
        if key in names:
            continue
        gcse = it["subject"].startswith("gcse")
        tier = "Foundation" if it["group"].startswith(F) or F in it["group"] else "Higher" if H in it["group"] else None
        best = titles[key].most_common(1)[0][0] if titles[key] else clean_title(it["title"])
        best = re.sub(r"^(paper \d|modules?)\s*", lambda m: m.group(0), best, flags=re.I)
        if not it["comps"]:
            if it["kind"] == "er":
                names[key] = "Examiners' Report (all papers)" if not it.get("legacy") else "Examiners' Report (all units)"
            else:
                names[key] = DB_NAME.get(it["spec"], "Data Sheet")
            continue
        unit, comp = it["comps"][0]
        nums = [int(c[1][:2]) for c in it["comps"]]
        if it.get("legacy"):
            if unit in LEGACY_UNITS and not gcse:
                name = LEGACY_UNITS[unit]
                if unit == "4754" and comp[-1:] in "AB":
                    name += f" (Paper {comp[-1]})"
            elif unit in LEGACY_UNITS:
                name = f"{LEGACY_UNITS[unit]} ({tier})"
            elif unit == "J567":
                name = f"Paper {nums[0]} ({tier})"
            elif gcse:
                name = f"{unit} ({tier}): {title_case(best)}"
            else:
                name = f"{unit}: {title_case(best)}"
            names[key] = name
            continue
        if len(nums) > 1:
            listed = ", ".join(str(n) for n in nums[:-1]) + f" and {nums[-1]}"
            names[key] = f"Papers {listed}" + (f" ({tier})" if gcse else "")
            continue
        clean = re.sub(r"^paper \d+\s*", "", best, flags=re.I).strip()
        clean = re.sub(r"\s*(foundation|higher)\s*(tier)?\s*(paper \d)?$", "", clean, flags=re.I).strip()
        if unit.startswith("Y"):
            names[key] = title_case(clean) if clean else unit
        elif gcse:
            names[key] = f"Paper {nums[0]} ({tier})" + (f": {title_case(clean)}" if clean else "")
        else:
            names[key] = f"Paper {nums[0]}" + (f": {title_case(clean)}" if clean else "")
    return names


def r2_key(board, code, kind, series, n=1):
    name = f"OCR-{re.sub(r'[^A-Z0-9]+', '-', code.upper()).strip('-')}-{KIND_CODE[kind]}-{series}"
    return f"{board}/{name}{'' if n == 1 else f'-{n}'}.pdf"


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    list_only = "--list" in sys.argv
    os.makedirs(PDF, exist_ok=True)
    items, headings, skipped = [], {}, collections.Counter()
    for page in PAGES:
        got, heads, sk = entries_for(page)
        print(f"  {page['path']}: {len(got)} entries", file=sys.stderr)
        items += got
        headings[page["path"]] = heads
        skipped.update(sk)
        time.sleep(1)

    # One entry per (place on the page, file).
    seen, uniq = set(), []
    for it in items:
        k = (it["subject"], it["board"], it["group"], it["code"], it["series"], it["kind"], it["source"])
        if k not in seen:
            seen.add(k)
            uniq.append(it)
    items = uniq

    # A series whose papers are still on Teach Cambridge can still list its data sheet or
    # pre-release article; without the paper there is nothing to sit, so leave those out.
    sat = {(it["subject"], it["board"], it["group"], it["series"]) for it in items if it["kind"] in ("qp", "ms")}
    held_back = collections.Counter()
    kept = []
    for it in items:
        if (it["subject"], it["board"], it["group"], it["series"]) in sat:
            kept.append(it)
        else:
            held_back[(it["group"], it["series"], it["kind"])] += 1
    items = kept

    names = paper_names(items)
    for it in items:
        it["paper"] = names[(it["group"], it["code"], bool(it["comps"]))]

    # R2 keys: <board>/OCR-<code>-<KIND>-<series>.pdf; a second, different file in the same
    # slot (an insert and an advance-notice article, say) gets -2.
    slots = collections.defaultdict(list)
    for it in items:
        slot = (it["board"], it["code"], it["kind"], it["series"])
        if it["source"] not in slots[slot]:
            slots[slot].append(it["source"])
    key_of = {}
    for slot, sources in slots.items():
        for n, src in enumerate(sources, 1):
            key_of[(slot, src)] = r2_key(*slot, n=n)

    if list_only:
        for it in sorted(items, key=lambda x: (x["subject"], x["board"], x["group"], x["code"], x["series"], x["kind"])):
            slot = (it["board"], it["code"], it["kind"], it["series"])
            print(f"{it['subject']} | {it['board']} | {it['group']} | {it['paper']} | {it['code']} | {it['series']} | {it['kind']} | {key_of[(slot, it['source'])]} | {it['title']}")
        print(f"{len(items)} entries, {len({it['source'] for it in items})} distinct files; skipped {dict(skipped)}", file=sys.stderr)
        return

    # Download each source once; write it under every key it has.
    body_cache, failed, sha = {}, [], {}
    by_source = collections.defaultdict(list)
    for (slot, src), key in key_of.items():
        by_source[src].append(key)
    # sources.json remembers which file each link ended up as, so a link whose bytes matched
    # another file in its slot (and so has no file of its own) isn't fetched again.
    done_path = os.path.join(WORK, "sources.json")
    done = json.load(open(done_path)) if os.path.exists(done_path) else {}

    names = {os.path.basename(k) for k in key_of.values()}

    def known(src):
        return src in done and done[src] in names and os.path.exists(os.path.join(PDF, done[src]))

    todo = [src for src, keys in by_source.items()
            if not known(src) and not all(os.path.exists(os.path.join(PDF, os.path.basename(k))) for k in keys)]
    print(f"{len(by_source)} files listed, {len(todo)} to download", file=sys.stderr)
    for i, src in enumerate(todo, 1):
        keys = by_source[src]
        have = [k for k in keys if os.path.exists(os.path.join(PDF, os.path.basename(k)))]
        if not have and src in done and os.path.exists(os.path.join(PDF, done[src])):
            have = [done[src]]  # renamed since the last run: reuse the file
        if have:
            for k in keys:
                if k not in have:
                    shutil.copyfile(os.path.join(PDF, os.path.basename(have[0])), os.path.join(PDF, os.path.basename(k)))
            continue
        body = get(src, binary=True)
        if not body or not body.startswith(b"%PDF"):
            failed.append(src)
            print(f"  [{i}/{len(todo)}] not a PDF, skipped: {src}", file=sys.stderr)
            continue
        for k in keys:
            with open(os.path.join(PDF, os.path.basename(k)), "wb") as fh:
                fh.write(body)
        if i % 25 == 0 or i == len(todo):
            print(f"  [{i}/{len(todo)}] {os.path.basename(keys[0])}", file=sys.stderr)
        time.sleep(0.6)

    # Same slot, same bytes: one file. (OCR lists some files twice under different ids.)
    def digest(path):
        if path not in sha:
            sha[path] = hashlib.sha1(open(path, "rb").read()).hexdigest()
        return sha[path]

    final_key = {}
    for slot, sources in slots.items():
        firsts = {}
        for src in sources:
            key = key_of[(slot, src)]
            path = os.path.join(PDF, os.path.basename(key))
            if not os.path.exists(path):
                if known(src):
                    final_key[(slot, src)] = key.split("/")[0] + "/" + done[src]
                continue
            d = digest(path)
            if d in firsts:
                final_key[(slot, src)] = firsts[d]
                if os.path.basename(firsts[d]) != os.path.basename(key):
                    os.remove(path)
            else:
                firsts[d] = key
                final_key[(slot, src)] = key

    manifest, seen = [], set()
    for it in sorted(items, key=lambda x: (x["subject"], x["board"], x["group"], x["code"], x["series"], x["kind"])):
        slot = (it["board"], it["code"], it["kind"], it["series"])
        key = final_key.get((slot, it["source"]))
        if not key:
            continue
        entry = {k: it[k] for k in ("subject", "board", "group", "paper", "code", "series", "kind", "source")}
        entry["file"] = key
        sig = (entry["subject"], entry["board"], entry["group"], entry["code"], entry["series"], entry["kind"], key)
        if sig in seen:
            continue
        seen.add(sig)
        manifest.append(entry)
    with open(done_path, "w") as fh:
        json.dump({src: os.path.basename(k) for (slot, src), k in sorted(final_key.items())}, fh, indent=0)
    with open(os.path.join(WORK, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=1)
    write_gaps(manifest, headings, held_back, skipped, failed)
    # Files from an earlier run that no entry uses any more (renamed or corrected) go.
    used = {os.path.basename(e["file"]) for e in manifest}
    for name in os.listdir(PDF):
        if name.startswith("OCR-") and name.endswith(".pdf") and name not in used:
            os.remove(os.path.join(PDF, name))
    files = {e["file"] for e in manifest}
    size = sum(os.path.getsize(os.path.join(PDF, os.path.basename(f))) for f in files)
    print(f"{len(manifest)} entries, {len(files)} files, {size / 1e6:.0f} MB in {os.path.relpath(PDF)}", file=sys.stderr)


SERIES_ORDER = {"JAN": 1, "MAR": 3, "MAY": 5, "JUN": 6, "OCT": 10, "NOV": 11}


def series_key(s):
    return (0, 0) if s == "SPEC" else (int(s[3:]), SERIES_ORDER[s[:3]])


def write_gaps(manifest, headings, held_back, skipped, failed):
    by_group = collections.defaultdict(list)
    for e in manifest:
        by_group[(e["subject"], e["board"], e["group"])].append(e)
    lines = ["# OCR and OCR MEI: what isn't here, and why", "",
             "Everything in manifest.json comes from the Assessment page of each qualification on ocr.org.uk.",
             "OCR's pages say: \"Full assessment teaching materials, including secure assessment materials, are now",
             "only available on Teach Cambridge.\" Teach Cambridge is OCR's teacher login; nothing behind it was fetched.", "",
             "## Not public on ocr.org.uk", "",
             "- **The newest series.** On every page the newest series with papers is June 2025. June 2026 (and November",
             "  2025 for GCSE Maths) are on Teach Cambridge only. GCSE pages already carry headings up to November 2027",
             "  holding only formulae/data sheets and modified-paper zips; those sheets, and the June 2026 advance-notice",
             "  articles for H422/02, H433/02 and H557/02 (under Pre-release materials), are left out until their papers",
             "  are public (listed at the end).",
             "- **A-Level Maths formulae booklets (H240/H230, H640/H630).** Not listed on either Maths page (the Further",
             "  Maths pages do list theirs). The formulae are printed in the specification instead.",
             "- **Large data sets** (A-Level Maths, both boards) are .xlsx/.xls, not PDF, so they aren't in the manifest.",
             "- **Answer books** (printed answer booklets for Maths and Further Maths) are left out: not a kind the library",
             "  has. They are on the pages if we want them.",
             "- **Errata, post-exam corrections, notices to centres, moderators' reports, analysis grids, candidate",
             "  exemplars and modified papers** (zips of large-print/Braille versions) are left out by design.",
             "- **Sample assessment materials** are one PDF holding the question paper and its mark scheme together; they",
             "  are listed as `qp` with series `SPEC`. GCSE Maths' samples are one PDF per tier (all three papers).",
             "- **Links on OCR's pages that serve the wrong file** (found by reading the code and date printed inside",
             "  every PDF). Left out, so these show as missing below: H020/02 Nov 2020 mark scheme (serves H420/02's),",
             "  H422/01 Nov 2020 mark scheme (serves H032/01's), H022/02 Jun 2025 mark scheme (serves H022/01's), J247/04",
             "  Jun 2024 examiners' report (serves Jun 2023's). Corrected rather than dropped: J257/04's Jun 2024 report link",
             "  is Gateway J247/04's (filed under J247), A162/A163 and B751 legacy files listed under the wrong",
             "  component. See FIXES in ocr.py.",
             "- **OCR's 2024 \"January\" heading** on Chemistry B holds the June 2024 H433/02 paper; it's filed as JUN24.", "",
             "## Legacy specifications", "",
             "OCR still hosts some legacy material under \"Withdrawn qualification materials\". It's in the manifest as",
             "`, legacy` groups. What OCR hosts is partial:", "",
             "- A-Level Maths 7890 (June 2014-2018), Further Maths 7892 (June 2015-2017), MEI Maths 7895 and MEI Further",
             "  Maths 7896 (June 2015-2018; no June 2015 mark schemes). Units shared by both MEI pages (M1, M2, S1, S2, D1,",
             "  NM) appear under both subjects and share one file where OCR's bytes match.",
             "- A-Level Physics A H558 (G481, G482, G484, G485) and Physics B H559 (G491, G492, G494, G495): June 2014-2017;",
             "  the practical units (G483, G486, G493, G496) aren't listed.",
             "- **A-Level Biology (H021/H421), Chemistry A (H034/H434) and Chemistry B (H035/H435) legacy: not hosted at all**",
             "  (no withdrawn section on those pages).",
             "- GCSE Maths: linear J567 (June 2014-June 2017) and modular J562 units A501-A503 (June 2014-November 2016).",
             "- GCSE Gateway Biology B J263: B731, B732 only, June 2015-2017 (B733 controlled assessment isn't listed);",
             "  Gateway Physics B J265: B751, B752, June 2014-2017; **Gateway Chemistry B J264: not hosted**.",
             "- GCSE Twenty First Century Biology A J243 (A161-A163), Chemistry A J244 (A171-A173), Physics A J245",
             "  (A181-A183): June 2014 to November 2017.",
             "- Pre-2014 series of every legacy specification aren't on OCR's site.", ""]
    lines += ["## Coverage per group", "",
              "Series present (earliest-latest), then the series in that range where a paper has no question paper or no",
              "mark scheme on OCR's page.", ""]
    for (subject, board, group), es in sorted(by_group.items()):
        series = sorted({e["series"] for e in es if e["series"] != "SPEC"}, key=series_key)
        spec = any(e["series"] == "SPEC" for e in es)
        span = f"{series[0]}-{series[-1]}" if series else "none"
        lines.append(f"### {subject} / {board} / {group}")
        lines.append("")
        lines.append(f"- {len(es)} files; series {span} ({', '.join(series)}){'; plus sample assessment materials' if spec else ''}")
        missing = []
        for code in sorted({e["code"] for e in es if e["code"].count("/") == 1 and "-" not in e["code"]}):
            own = sorted({e["series"] for e in es if e["code"] == code and e["series"] != "SPEC"}, key=series_key)
            if not own:
                continue
            for s_ in series:
                if not (series_key(own[0]) <= series_key(s_) <= series_key(own[-1])):
                    continue
                kinds = {e["kind"] for e in es if e["code"] == code and e["series"] == s_}
                gone = [k for k in ("qp", "ms") if k not in kinds]
                if gone:
                    missing.append(f"{s_} {code} (no {'/'.join(gone)})")
        if not group.endswith("legacy") and series:
            family = {e["series"] for (sj, bd, gp), es2 in by_group.items() if sj == subject and bd == board
                      and not gp.endswith("legacy") for e in es2 if e["series"] != "SPEC"}
            unlisted = [x for x in sorted(family, key=series_key)
                        if series_key(series[0]) < series_key(x) < series_key(series[-1]) and x not in series]
            if unlisted:
                lines.append(f"- not listed by OCR for this group: {', '.join(unlisted)}")
        if missing:
            lines.append("- missing: " + "; ".join(missing))
        lines.append("")
    if held_back:
        lines += ["## Listed but left out (series not yet public)", ""]
        for (group, series, kind), n in sorted(held_back.items(), key=lambda x: (x[0][0], series_key(x[0][1]), x[0][2])):
            lines.append(f"- {group} {series}: {n} {kind}")
        lines.append("")
    if failed:
        lines += ["## Downloads that weren't a PDF", ""] + [f"- {u}" for u in failed] + [""]
    lines += ["## Skipped while reading the pages", ""] + [f"- {k}: {v}" for k, v in sorted(skipped.items(), key=lambda x: -x[1])] + [""]
    with open(os.path.join(WORK, "gaps.md"), "w") as fh:
        fh.write("\n".join(lines))


if __name__ == "__main__":
    main()
