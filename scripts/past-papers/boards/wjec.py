"""Fetch WJEC's and Eduqas's own past papers for Plumi's past paper library.

    python3 scripts/past-papers/boards/wjec.py            # list, download what's missing, write manifest + gaps
    python3 scripts/past-papers/boards/wjec.py --list     # print the plan, download nothing
    python3 scripts/past-papers/boards/wjec.py --offline  # reuse the listings saved by the last run
    python3 scripts/past-papers/boards/wjec.py --retry    # try again the URLs that failed last time

WJEC and Eduqas (WJEC's England brand) run the same site software. Each
qualification page (e.g. https://www.wjec.co.uk/qualifications/biology-asa-level/)
carries a hidden QualificationId; its "Past Papers" tab is filled by
  /umbraco/surface/TabSurface/GetpastpapersTab?qualificationId=<id>&cultureId=en-GB
and its "Key Documents" tab by GetkeydocumentsTab. Both return HTML holding a
React "FilterableList" whose props are JSON: every past paper, mark scheme and
"[Resource]" (data/formula booklet, practical task, teacher instructions) with
its series, year and URL on pastpapers.download.wjec.co.uk; and every key
document (sample assessment materials, examiners' reports) with its /media/ path.

The board's labels are not always right (a mark scheme filed as a past paper, a
question paper filed as a resource), and older files are named by product code
(s18-2405-01.pdf) rather than unit code. So each PDF's first pages are read with
a tiny stdlib text sniffer (FlateDecode + string literals) for the unit code and
for "MARKING SCHEME" / "Data Booklet" / "Candidate Number"; the listing, the URL
and a product-code table fill in when the sniffer finds nothing.

Writes, under scripts/past-papers/.work/wjec/:
  pdf/<name>.pdf     the board's PDF, unmodified (name = basename of the R2 key;
                     a hard link into cache/, which holds one copy per URL)
  manifest.json      one entry per file in the shape boards/README.md gives
  gaps.md            what the boards don't publish publicly, per specification
Polite: one request at a time, a pause between downloads, cached on disk, so a
re-run only fetches the ~40 listing pages and whatever is new.
"""
import collections, hashlib, html as htmllib, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request, zlib

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
SITES = {"wjec": "https://www.wjec.co.uk", "eduqas": "https://www.eduqas.co.uk"}
PREFIX = {"wjec": "WJEC", "eduqas": "EDUQAS"}
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(os.path.join(HERE, "..", ".work", "wjec"))
PDF, CACHE, PAGES_DIR = (os.path.join(WORK, d) for d in ("pdf", "cache", "pages"))
STATE = os.path.join(WORK, "sources.json")
LIST_ONLY, OFFLINE, RETRY = ("--list" in sys.argv), ("--offline" in sys.argv), ("--retry" in sys.argv)

# ── What to fetch ─────────────────────────────────────────────────────────────
# Group headings, one per specification (and tier).
AS_, AL = "AS", "A-Level"
F, I, H, FH = "Foundation tier", "Intermediate tier", "Higher tier", "Foundation and Higher tier"


def units(subject, rows):
    """rows: (code, group, paper) -> {code: (subject, group, paper)}"""
    return {code: (subject, group, paper) for code, group, paper in rows}


def gcse_science(spec, subject, u1, u2):
    g = lambda tier: f"{tier} ({spec})"  # noqa: E731
    return units(subject, [
        (f"{spec}U10-1", g(F), f"Unit 1: {u1}"), (f"{spec}UA0-1", g(H), f"Unit 1: {u1}"),
        (f"{spec}U20-1", g(F), f"Unit 2: {u2}"), (f"{spec}UB0-1", g(H), f"Unit 2: {u2}"),
        (f"{spec}U40-1", g(F), f"Unit 2 contingency: {u2}"), (f"{spec}UD0-1", g(H), f"Unit 2 contingency: {u2}"),
        (f"{spec}U30-1", g(FH), "Unit 3: Practical Assessment"),
    ])


def gcse_maths_legacy(spec, name):
    g = lambda tier: f"{name}, {tier} ({spec}), legacy"  # noqa: E731
    u1, u2 = "Unit 1: Non-calculator", "Unit 2: Calculator-allowed"
    return units("gcse-maths", [
        (f"{spec}U10-1", g(F), u1), (f"{spec}U20-1", g(F), u2), (f"{spec}U30-1", g(I), u1),
        (f"{spec}U40-1", g(I), u2), (f"{spec}U50-1", g(H), u1), (f"{spec}U60-1", g(H), u2)])


def a_level(subject, as_spec, a_spec, rows, as_label=AS_, a_label=AL):
    out = {}
    for code, title in rows:
        group = f"{as_label} ({as_spec})" if code.startswith(as_spec) else f"{a_label} ({a_spec})"
        out[code] = (subject, group, title)
    return out


M320 = "Mathematics and Numeracy"
QUALS = [
    dict(board="wjec", slug="biology-asa-level", units=a_level("a-level-biology", "2400", "1400", [
        ("2400U10-1", "Unit 1: Basic Biochemistry and Cell Organisation"),
        ("2400U20-1", "Unit 2: Biodiversity and Physiology of Body Systems"),
        ("1400U30-1", "Unit 3: Energy, Homeostasis and the Environment"),
        ("1400U40-1", "Unit 4: Variation, Inheritance and Options"),
        ("1400U50-1", "Unit 5: Practical Examination")])),
    dict(board="wjec", slug="chemistry-asa-level", units=a_level("a-level-chemistry", "2410", "1410", [
        ("2410U10-1", "Unit 1: The Language of Chemistry, Structure of Matter and Simple Reactions"),
        ("2410U20-1", "Unit 2: Energy, Rate and Chemistry of Carbon Compounds"),
        ("1410U30-1", "Unit 3: Physical and Inorganic Chemistry"),
        ("1410U40-1", "Unit 4: Organic Chemistry and Analysis"),
        ("1410U50-1", "Unit 5: Practical Examination")])),
    dict(board="wjec", slug="physics-asa-level", units=a_level("a-level-physics", "2420", "1420", [
        ("2420U10-1", "Unit 1: Motion, Energy and Matter"),
        ("2420U20-1", "Unit 2: Electricity and Light"),
        ("1420U30-1", "Unit 3: Oscillations and Nuclei"),
        ("1420U40-1", "Unit 4: Fields and Options"),
        ("1420U50-1", "Unit 5: Practical Examination")])),
    dict(board="wjec", slug="mathematics-aas-level", units={
        **a_level("a-level-maths", "2300", "1300", [
            ("2300U10-1", "Unit 1: Pure Mathematics A"), ("2300U20-1", "Unit 2: Applied Mathematics A"),
            ("1300U30-1", "Unit 3: Pure Mathematics B"), ("1300U40-1", "Unit 4: Applied Mathematics B")]),
        **a_level("a-level-further-maths", "2305", "1305", [
            ("2305U10-1", "Unit 1: Further Pure Mathematics A"), ("2305U20-1", "Unit 2: Further Statistics A"),
            ("2305U30-1", "Unit 3: Further Mechanics A"), ("1305U40-1", "Unit 4: Further Pure Mathematics B"),
            ("1305U50-1", "Unit 5: Further Statistics B"), ("1305U60-1", "Unit 6: Further Mechanics B")])}),
    dict(board="wjec", slug="biology-gcse", units=gcse_science(
        "3400", "gcse-biology", "Cells, Organ Systems and Ecosystems", "Variation, Homeostasis and Micro-organisms")),
    dict(board="wjec", slug="chemistry-gcse", units=gcse_science(
        "3410", "gcse-chemistry", "Chemical Substances, Reactions and Essential Resources",
        "Chemical Bonding, Application of Chemical Reactions and Organic Chemistry")),
    dict(board="wjec", slug="physics-gcse", units=gcse_science(
        "3420", "gcse-physics", "Electricity, Energy and Waves", "Forces, Space and Radioactivity")),
    dict(board="wjec", slug="mathematics-gcse-legacy", units={
        **gcse_maths_legacy("3300", "Mathematics"), **gcse_maths_legacy("3310", "Mathematics–Numeracy")}),
    dict(board="wjec", slug="gcse-mathematics-and-numeracy-double-award-teaching-from-2025", units=units("gcse-maths", [
        ("3320U10-1", f"{M320}, {F} (3320)", "Unit 1: Financial Mathematics and Other Applications of Numeracy"),
        ("3320U20-1", f"{M320}, {F} (3320)", "Unit 2: Non-calculator"),
        ("3320U30-1", f"{M320}, {F} (3320)", "Unit 3: Calculator-allowed"),
        ("3320UA0-1", f"{M320}, {H} (3320)", "Unit 1: Financial Mathematics and Other Applications of Numeracy"),
        ("3320UB0-1", f"{M320}, {H} (3320)", "Unit 2: Non-calculator"),
        ("3320UC0-1", f"{M320}, {H} (3320)", "Unit 3: Calculator-allowed")])),
    dict(board="eduqas", slug="biology-asa-level", units=a_level("a-level-biology", "B400", "A400", [
        ("B400U10-1", "Component 1: Basic Biochemistry and Cell Organisation"),
        ("B400U20-1", "Component 2: Biodiversity and Physiology of Body Systems"),
        ("A400U10-1", "Component 1: Energy for Life"),
        ("A400U20-1", "Component 2: Continuity of Life"),
        ("A400U30-1", "Component 3: Requirements for Life")])),
    dict(board="eduqas", slug="chemistry-asa-level", units=a_level("a-level-chemistry", "B410", "A410", [
        ("B410U10-1", "Component 1: The Language of Chemistry, Structure of Matter and Simple Reactions"),
        ("B410U20-1", "Component 2: Energy, Rate and Chemistry of Carbon Compounds"),
        ("A410U10-1", "Component 1: Physical and Inorganic Chemistry"),
        ("A410U20-1", "Component 2: Organic Chemistry and Analysis"),
        ("A410U30-1", "Component 3: Chemistry in Practice")])),
    dict(board="eduqas", slug="physics-asa-level", units=a_level("a-level-physics", "B420", "A420", [
        ("B420U10-1", "Component 1: Motion, Energy and Matter"),
        ("B420U20-1", "Component 2: Electricity and Light"),
        ("A420U10-1", "Component 1: Newtonian Physics"),
        ("A420U20-1", "Component 2: Electricity and the Universe"),
        ("A420U30-1", "Component 3: Light, Nuclei and Options")])),
    dict(board="eduqas", slug="mathematics-gcse", units=units("gcse-maths", [
        ("C300U10-1", f"{F} (C300)", "Component 1: Non-calculator Mathematics"),
        ("C300UA0-1", f"{H} (C300)", "Component 1: Non-calculator Mathematics"),
        ("C300U20-1", f"{F} (C300)", "Component 2: Calculator-allowed Mathematics"),
        ("C300UB0-1", f"{H} (C300)", "Component 2: Calculator-allowed Mathematics")])),
]

# Files named by product code before 2023: s18-2405-01.pdf is 2400U10-1 sat in June 2018.
PRODUCT = {
    "2405-01": "2400U10-1", "2406-01": "2400U20-1", "2407-01": "1400U30-1", "2408-01": "1400U40-1",
    "2415-01": "2410U10-1", "2416-01": "2410U20-1", "2417-01": "1410U30-1", "2418-01": "1410U40-1",
    "2425-01": "2420U10-1", "2426-01": "2420U20-1", "2427-01": "1420U30-1", "2428-01": "1420U40-1",
    "2302-01": "2300U10-1", "2303-01": "2300U20-1", "2304-01": "1300U30-1", "2305-01": "1300U40-1",
    "2307-01": "2305U10-1", "2308-01": "2305U20-1", "2309-01": "2305U30-1",
    "2310-01": "1305U40-1", "2312-01": "1305U50-1", "2313-01": "1305U60-1",
    "8400-01": "B400U10-1", "8400-02": "B400U20-1", "8401-01": "A400U10-1", "8401-02": "A400U20-1", "8401-03": "A400U30-1",
    "8410-01": "B410U10-1", "8410-02": "B410U20-1", "8411-01": "A410U10-1", "8411-02": "A410U20-1", "8411-03": "A410U30-1",
    "8420-01": "B420U10-1", "8420-02": "B420U20-1", "8421-01": "A420U10-1", "8421-02": "A420U20-1", "8421-03": "A420U30-1",
    "5300-01": "C300U10-1", "5300-02": "C300U20-1", "5300-03": "C300UA0-1", "5300-04": "C300UB0-1",
}
for _spec, _unit1 in (("3400", "3402"), ("3410", "3411"), ("3420", "3421")):  # Biology counts from 3402, the others from 3411/3421
    for _n, _tiers in ((0, "U10 UA0"), (1, "U20 UB0 U40 UD0")):
        PRODUCT.update({f"{int(_unit1) + _n}-0{t}": f"{_spec}{u}-1" for t, u in enumerate(_tiers.split(), 1)})
for _spec in ("3300", "3310"):
    PRODUCT.update({f"{_spec}-0{n}": f"{_spec}U{n}0-1" for n in range(1, 7)})

KIND_CODE = {"qp": "QP", "ms": "MS", "er": "ER", "ins": "INS", "db": "DB"}
SEASON = {"summer": "JUN", "november": "NOV", "january": "JAN", "winter": "JAN", "spring": "MAR", "october": "OCT", "june": "JUN"}
MODIFIED = re.compile(r"mlp|mmm|[-_ ]brl|braille|large print|modified|[-_]lp\.pdf|welsh|cymraeg", re.I)


# ── Fetching ──────────────────────────────────────────────────────────────────
def get(url, binary=False):
    req = urllib.request.Request(urllib.parse.quote(url, safe=":/?&=%#~"), headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                body = r.read()
                return (body if binary else body.decode("utf-8", "replace")), None
        except urllib.error.HTTPError as e:
            if e.code in (403, 404, 410):
                return None, f"HTTP {e.code}"
            err = f"HTTP {e.code}"
        except Exception as e:  # noqa: BLE001
            err = type(e).__name__
        time.sleep(2 + 3 * attempt)
    return None, err


def page(name, url):
    """A listing page, saved under pages/ so --offline can reuse it."""
    path = os.path.join(PAGES_DIR, name)
    if OFFLINE and os.path.exists(path):
        return open(path, encoding="utf-8").read()
    body, err = get(url)
    if body is None:
        if os.path.exists(path):
            print(f"  {err} for {url}; using last run's copy", file=sys.stderr)
            return open(path, encoding="utf-8").read()
        raise SystemExit(f"could not fetch {url}: {err}")
    open(path, "w", encoding="utf-8").write(body)
    time.sleep(0.5)
    return body


def filterable_lists(tab_html):
    out = []
    for m in re.finditer(r'react-component--FilterableList">\s*<textarea class="react-component--props">(.*?)</textarea>', tab_html, re.S):
        out += json.loads(htmllib.unescape(m.group(1)))["listItems"]
    return out


def listings(q):
    site = SITES[q["board"]]
    tag = f"{q['board']}-{q['slug']}"
    qpage = page(f"{tag}.html", f"{site}/qualifications/{q['slug']}/")
    qid = re.search(r'id="QualificationId"[^>]*value="(\d+)"', qpage)
    cid = re.search(r'id="CultureId"[^>]*value="([^"]+)"', qpage)
    if not qid:
        raise SystemExit(f"no QualificationId on {site}/qualifications/{q['slug']}/")
    tabs = {}
    for tab in ("pastpapers", "keydocuments"):
        url = f"{site}/umbraco/surface/TabSurface/Get{tab}Tab?qualificationId={qid.group(1)}&cultureId={cid.group(1) if cid else 'en-GB'}"
        tabs[tab] = filterable_lists(page(f"{tag}-{tab}.html", url))
    return tabs["pastpapers"], tabs["keydocuments"]


def download(url, state):
    """Cache one URL's PDF under cache/; returns the cached path or None."""
    rec = state.get(url)
    if rec and rec.get("cache") and os.path.exists(os.path.join(CACHE, rec["cache"])):
        return os.path.join(CACHE, rec["cache"])
    if rec and rec.get("failed") and not RETRY:
        return None
    if LIST_ONLY:
        return None
    base = re.sub(r"[^A-Za-z0-9.+-]+", "_", url.split("://", 1)[-1].split("/", 1)[-1])
    name = hashlib.sha1(url.encode()).hexdigest()[:8] + "-" + base[-80:]
    body, err = get(url, binary=True)
    time.sleep(0.4)
    if not body or not body.startswith(b"%PDF"):
        state[url] = {"failed": err or "not a PDF"}
        print(f"  skip ({err or 'not a PDF'}) {url}", file=sys.stderr)
        return None
    path = os.path.join(CACHE, name)
    open(path, "wb").write(body)
    state[url] = {"cache": name, "bytes": len(body)}
    return path


# ── Reading a PDF's first page, stdlib only ───────────────────────────────────
SNIFF_VERSION = 2


def _objects(b):
    """{object number: body bytes}, including objects packed in object streams."""
    objs = {int(m.group(1)): m.group(2) for m in re.finditer(rb"(?<![0-9])(\d+)\s+0\s+obj\b(.*?)\bendobj", b, re.S)}
    for num, body in list(objs.items()):
        if b"/ObjStm" not in body[:300]:
            continue
        data = _stream(body)
        n = re.search(rb"/N\s+(\d+)", body)
        first = re.search(rb"/First\s+(\d+)", body)
        if not data or not n or not first:
            continue
        head = data[:int(first.group(1))].split()
        pairs = [(int(head[i]), int(head[i + 1])) for i in range(0, min(len(head) - 1, 2 * int(n.group(1))), 2)]
        for i, (onum, off) in enumerate(pairs):
            a = int(first.group(1)) + off
            z = int(first.group(1)) + pairs[i + 1][1] if i + 1 < len(pairs) else len(data)
            objs.setdefault(onum, data[a:z])
    return objs


def _stream(body):
    m = re.search(rb"stream\r?\n", body)
    if not m:
        return None
    raw = body[m.end():body.rfind(b"endstream")]
    try:
        return zlib.decompressobj().decompress(raw) if b"/FlateDecode" in body[:m.start()] else raw
    except Exception:  # noqa: BLE001
        return None


def _text(d):
    t = b"".join(re.findall(rb"\(((?:\\.|[^\\)])*)\)", d)).decode("latin-1")
    t = re.sub(r"\\(\d{3})", lambda x: chr(int(x.group(1), 8)), t).replace("\\", "")
    return re.sub(r"\s+", " ", re.sub(r"(en|cy)-(GB|US)", " ", t))


def _first_page_streams(b):
    objs = _objects(b)
    ref = lambda body, key: re.search(key + rb"\s+(\d+)\s+0\s+R", body)  # noqa: E731
    root = next((o for o in objs.values() if re.search(rb"/Type\s*/Catalog", o[:500])), None)
    node = objs.get(int(ref(root, rb"/Pages").group(1))) if root is not None and ref(root, rb"/Pages") else None
    for _ in range(20):
        if node is None:
            return []
        if re.search(rb"/Type\s*/Page(?!s)", node[:2000]):
            break
        kids = re.search(rb"/Kids\s*\[\s*(\d+)\s+0\s+R", node)
        node = objs.get(int(kids.group(1))) if kids else None
    contents = re.search(rb"/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)", node)
    if not contents:
        return []
    out = []
    for num in re.findall(rb"(\d+)\s+0\s+R", contents.group(1)):
        body = objs.get(int(num))
        data = _stream(body) if body else None
        if data:
            out.append(data)
    return out


def sniff(path):
    """The text of a PDF's first page (its cover), stdlib only; falls back to the first content streams."""
    b = open(path, "rb").read()
    try:
        cover = _text(b"".join(_first_page_streams(b)))
    except Exception:  # noqa: BLE001
        cover = ""
    if len(cover.strip()) > 20:
        return cover[:3000]
    out = []
    for m in re.finditer(rb"stream\r?\n", b):
        try:
            d = zlib.decompressobj().decompress(b[m.end():b.find(b"endstream", m.end())])
        except Exception:  # noqa: BLE001
            continue
        if b"BT" in d and (b"Tj" in d or b"TJ" in d):
            t = _text(d)
            if len(t.strip()) > 20:
                out.append(t)
        if len(out) >= 4:
            break
    return " | ".join(out)[:3000]


CODE_RE = re.compile(r"(?<![0-9A-Z])([0-9ABC]\d{3}U[0-9A-Z]0)\s?[-/]\s?0?1([A-H](?![0-9A-Za-z]))?")


def codes_in(text):
    return [(m.group(1).upper() + "-1", (m.group(2) or "").upper()) for m in CODE_RE.finditer(text.upper())]


def kind_from_text(t):
    head = t[:2000].upper()
    if re.search(r"MARKING SCHEME|MARK SCHEME", head):
        return "ms"
    if re.search(r"TO BE OPENED|SETTING UP INSTRUCTIONS|CONFIDENTIAL|INSTRUCTIONS FOR TEACHERS|TECHNICIAN", head):
        return "ins"
    if re.search(r"CANDIDATE ?NUMBER|CENTRE ?NUMBER|INSTRUCTIONS TO CANDIDATES|SURNAME", head):
        return "qp"
    if re.search(r"FORMULA BOOKLET|FORMULAE BOOKLET|STATISTICAL TABLES|ADDITIONAL FORMULAE|DATA BOOKLET|DATA SHEET|FORMULA SHEET", head):
        return "db"
    return None


# ── Classifying ───────────────────────────────────────────────────────────────
def norm_title(t):
    t = re.sub(r"^(Past Paper|Mark Scheme|Modified Paper) - \w+ - ", "", t)
    t = re.sub(r"\[[^\]]*\]", "", t).replace("&", "and")
    return re.sub(r"\s+", " ", t).strip().lower()


def url_codes(url):
    name = urllib.parse.unquote(url.rsplit("/", 1)[-1])
    found = [(m.group(1).upper() + "-1", (m.group(2) or "").upper())
             for m in re.finditer(r"(?i)(?<![0-9a-z])([0-9abc]\d{3}u[0-9a-z]0)-1([a-h](?![0-9a-z]))?", name)]
    if not found:
        m = re.match(r"(?i)[a-z]\d\d-(\d{4}-\d\d)(?![0-9])", name)
        if m and m.group(1) in PRODUCT:
            found = [(PRODUCT[m.group(1)], "")]
    return found


def series_of(season, year, group):
    s = season.lower()
    if s == "autumn":
        mon = "NOV" if "tier" in group else "OCT"  # GCSE resits are November; Eduqas's autumn A-Levels sat in October
    else:
        mon = SEASON.get(s)
    return f"{mon}{str(year)[-2:]}" if mon else None


def series_from_name(name, group):
    m = re.search(r"(?i)(summer|autumn|november|january|winter|spring|october|june)\s*(20\d\d)", name)
    return series_of(m.group(1), m.group(2), group) if m else None


def order(series):
    if series == "SPEC":
        return 0
    return int(series[3:]) * 100 + ["JAN", "FEB", "MAR", "MAY", "JUN", "OCT", "NOV"].index(series[:3])


def classify(q, items, state, log):
    """-> {(code, kind, series): entry} for one qualification's past paper list."""
    table = q["units"]
    # Learn which unit codes each listing title stands for, from the files whose names carry them.
    learned = collections.defaultdict(collections.Counter)
    for it in items:
        cs = tuple(sorted({c for c, suffix in url_codes(it["Url"]) if c in table and not suffix}))
        if cs:
            learned[norm_title(it["FileName"])][cs] += 1
    found, candidates = {}, []
    for it in items:
        url, title = it["Url"].strip(), it["FileName"] or ""
        if it.get("ProductReference") == "Modified Paper" or MODIFIED.search(url) or MODIFIED.search(title):
            continue
        candidates.append(it)
    # Files whose names carry their code first, so a duplicate under a product-code name is the one dropped.
    candidates.sort(key=lambda it: (not url_codes(it["Url"]), it["Url"]))
    for it in candidates:
        url, title, label = it["Url"].strip(), it["FileName"] or "", it.get("ProductReference") or ""
        path = download(url, state)
        if path is None and not LIST_ONLY:
            log.append(f"unavailable: {url} ({state.get(url, {}).get('failed')})")
            continue
        rec = state.get(url, {})
        if path and rec.get("sniffed") != SNIFF_VERSION:
            rec["sniff"], rec["sniffed"] = sniff(path), SNIFF_VERSION
        text = rec.get("sniff", "")
        # Unit code(s): the cover page, else the file name, else what the listing title stood for elsewhere.
        cover = [(c, s) for c, s in codes_in(text[:1500]) if c in table]
        named = [(c, s) for c, s in url_codes(url) if c in table]
        if cover and named and not {c for c, _ in cover} >= {c for c, _ in named}:
            # The cover and the file name disagree (a typo on one of them): believe the one whose
            # unit matches the "UNIT 3" / "COMPONENT 2" the cover spells out.
            said = re.search(r"\b(UNIT|COMPONENT)\s*(\d)\b", text[:1500].upper())
            fits = lambda cs: said and any(table[c][2].upper().startswith(f"{said.group(1)} {said.group(2)}") for c, _ in cs)  # noqa: E731
            codes = cover if fits(cover) and not fits(named) else named
            log.append(f"cover says {[c + x for c, x in cover]}, name says {[c + x for c, x in named]}; kept {[c + x for c, x in codes]}: {url}")
        elif cover and named:  # agree; the cover may name more (a re-badged paper prints its old code too)
            codes = [x for x in cover if x[0] in {c for c, _ in named}]
        elif cover:
            codes = cover
        elif named:
            codes = named
        else:
            guess = learned.get(norm_title(title))
            codes = [(c, "") for c in guess.most_common(1)[0][0]] if guess else []
        if not codes:  # a cover that names units without the variant number: 'BIOLOGY - Unit 3 (3400U30)'
            codes = [(c + "-1", "") for c in re.findall(r"([0-9ABC]\d{3}U[0-9A-Z]0)\)", text[:1500].upper()) if c + "-1" in table]
        if not codes:  # last resort: the only paper in the table with the title's unit number
            n = re.search(r"(?i)\b(unit|component)\s*(\d)\b", title)
            pick = [c for c, (_, _, p) in table.items() if n and p.lower().startswith(f"{n.group(1).lower()} {n.group(2)}:")]
            codes = [(pick[0], "")] if len(pick) == 1 else []
        codes = list(dict.fromkeys(codes))
        if not codes:
            log.append(f"no unit code: {url} [{title}]")
            continue
        # Kind: the cover page, else the file name and the listing's label.
        kind = kind_from_text(text)
        resource = "[resource]" in title.lower() or any(s for _, s in codes)
        if kind is None:
            if re.search(r"(?i)[-_ ]ms([-_ .]|$)|\bms\b|mark ?scheme", url.rsplit("/", 1)[-1]):
                kind = "ms"
            elif resource:
                subject = table[codes[0][0]][0]
                kind = "db" if "math" in subject else "ins"
            else:
                kind = {"Past Paper": "qp", "Mark Scheme": "ms"}.get(label)
        if kind is None:
            log.append(f"no kind: {url} [{title}]")
            continue
        if re.search(r"(?i)[-_ ]ms[-_ .]", url.rsplit("/", 1)[-1]) and kind != "ms":
            log.append(f"named as a mark scheme but reads as {kind}: {url}")
        series = series_of(it["Series"], it["Year"], table[codes[0][0]][1])
        if not series:
            log.append(f"no series: {url} [{it['Series']} {it['Year']}]")
            continue
        if kind == "ms":  # one mark scheme often covers both tiers: one entry per tier's paper
            codes = [(c, "") for c, _ in codes]
        elif len(codes) > 1:
            codes = codes[:1]
        for code, suffix in codes:
            key = (code + suffix, kind, series)
            if key in found:
                continue
            found[key] = dict(code=code, suffix=suffix, kind=kind, series=series, source=url, path=path, title=title)
    return found


def key_documents(q, docs, papers, state, log):
    """Sample assessment materials and examiners' reports from the Key Documents tab."""
    table = q["units"]
    groups = collections.OrderedDict()
    for code, (subject, group, _) in table.items():
        groups.setdefault((subject, group), []).append(code)
    spec_of = lambda group: re.search(r"\(([0-9A-Z]{4})\)", group).group(1)  # noqa: E731
    sat = collections.defaultdict(set)  # spec -> series its papers were sat in
    for (_, _, series), f in papers.items():
        sat[spec_of(table[f["code"]][1])].add(series)
    out = []
    for d in docs:
        name, link, dtype = d.get("Name") or "", (d.get("Link") or "").strip(), d.get("DocumentType") or ""
        if not link.lower().endswith(".pdf") or MODIFIED.search(name + link):
            continue
        if "Sample Assessment" in dtype:
            kind, series = "qp", "SPEC"
        elif "Examiner" in dtype and re.search(r"(?i)examiners?'?\s*report", name):
            kind, series = "er", None
        else:
            continue
        # Which of the qualification's groups the document covers.
        n = name.lower()
        cover = list(groups)
        subjects = {s for s, _ in cover}
        if len(subjects) > 1:  # WJEC's Maths page holds Maths and Further Maths
            want = "a-level-further-maths" if "further" in n else "a-level-maths"
            cover = [g for g in cover if g[0] == want]
        if any("Numeracy" in g for _, g in cover) and any("Numeracy" not in g for _, g in cover):
            cover = [g for g in cover if ("Numeracy" in g[1]) == ("numeracy" in n)]
        if any(g.startswith(AS_ + " (") for _, g in cover) and q["board"] == "eduqas":
            cover = [g for g in cover if g[1].startswith(AS_ + " (") == bool(re.search(r"\bas\b", n))]
        if not cover:
            log.append(f"no group for key document: {name}")
            continue
        tier = None
        if "tier" in cover[0][1]:
            tier = F if "foundation" in n else H if "higher" in n else None
        unit = re.search(r"(?i)\bunit\s*(\d)", name)
        if kind == "qp" and unit and tier:  # one SAM per unit and tier (WJEC Maths and Numeracy, 2025)
            pick = [c for c in table if table[c][1].startswith(f"{M320}, {tier}") and table[c][2].startswith(f"Unit {unit.group(1)}:")]
            if pick:
                out.append(dict(code=pick[0], suffix="", kind="qp", series="SPEC", source=link, title=name))
                continue
        if kind == "er":
            series = series_from_name(name, cover[0][1])
            if not series:
                log.append(f"no series for report: {name}")
                continue
            specs = {spec_of(g) for _, g in cover}
            seen = set().union(*(sat[s] for s in specs))
            if seen and (order(series) < min(map(order, seen)) or (order(series) <= max(map(order, seen)) and series not in seen)):
                log.append(f"report for a series with no papers on this spec (legacy?), left out: {name}")
                continue
        specs = list(dict.fromkeys(spec_of(g) for _, g in cover))
        out.append(dict(code="/".join(specs), suffix="", kind=kind, series=series, source=link, title=name,
                        subject=cover[0][0], group=cover[-1][1], groups=[g for _, g in cover],
                        paper="Sample assessment materials" if kind == "qp" else "Examiners' report"))
    return out


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    for d in (PDF, CACHE, PAGES_DIR):
        os.makedirs(d, exist_ok=True)
    state = json.load(open(STATE)) if os.path.exists(STATE) else {}
    manifest, log, per_qual = [], [], []
    try:
        for q in QUALS:
            items, docs = listings(q)
            print(f"{q['board']} {q['slug']}: {len(items)} listed papers, {len(docs)} key documents", file=sys.stderr)
            papers = classify(q, items, state, log)
            extra = key_documents(q, docs, papers, state, log)
            per_qual.append((q, papers, extra))
            json.dump(state, open(STATE, "w"), indent=0)
            for f in extra:
                url = f["source"] if f["source"].startswith("http") else SITES[q["board"]] + f["source"]
                f["source"] = url
                f["path"] = download(url, state)
                if f["path"] is None and not LIST_ONLY:
                    log.append(f"unavailable: {url}")
                if f.get("path") and state[url].get("sniffed") != SNIFF_VERSION:
                    state[url]["sniff"], state[url]["sniffed"] = sniff(f["path"]), SNIFF_VERSION
    finally:
        json.dump(state, open(STATE, "w"), indent=0)
    if LIST_ONLY:
        for q, papers, extra in per_qual:
            print(f"{q['board']} {q['slug']}: {len(papers)} papers, {len(extra)} key documents")
        return

    keys = set()
    for q, papers, extra in per_qual:
        table, board = q["units"], q["board"]
        for (_, kind, series), f in sorted(papers.items()):
            subject, group, paper = table[f["code"]]
            printed = f["code"] + f["suffix"]
            # Practical exams sit as several lettered papers (1400U50-1A experimental task, -1E analysis
            # task): each keeps its printed code, so it gets a row of its own. Lettered booklets and
            # teacher instructions take the paper's code, so they sit on the paper's own row.
            code = printed if (f["suffix"] and kind == "qp") else f["code"]
            manifest.append(dict(subject=subject, board=board, group=group, paper=paper, code=code, series=series,
                                 kind=kind, source=f["source"], file=f"{board}/{PREFIX[board]}-{printed}-{KIND_CODE[kind]}-{series}.pdf",
                                 _path=f["path"]))
        for f in extra:
            if not f.get("path"):
                continue
            if "group" in f:
                subject, group, paper, groups = f["subject"], f["group"], f["paper"], f["groups"]
            else:
                (subject, group, paper), groups = table[f["code"]], None
            entry = dict(subject=subject, board=board, group=group, paper=paper, code=f["code"], series=f["series"],
                         kind=f["kind"], source=f["source"],
                         file=f"{board}/{PREFIX[board]}-{f['code'].replace('/', '-')}-{KIND_CODE[f['kind']]}-{f['series']}.pdf",
                         _path=f["path"])
            if groups and len(groups) > 1:
                entry["groups"] = groups
            manifest.append(entry)
    # Unique keys; link each into pdf/.
    out, seen = [], set()
    for e in manifest:
        if e["file"] in seen:
            log.append(f"duplicate key dropped: {e['file']} <- {e['source']}")
            continue
        seen.add(e["file"])
        out.append(e)
    wanted = {os.path.basename(e["file"]) for e in out}
    for name in os.listdir(PDF):
        if name not in wanted:
            os.remove(os.path.join(PDF, name))
    for e in out:
        dest = os.path.join(PDF, os.path.basename(e["file"]))
        src = e.pop("_path")
        if os.path.exists(dest) and os.path.samefile(dest, src):
            continue
        if os.path.exists(dest):
            os.remove(dest)
        try:
            os.link(src, dest)
        except OSError:
            import shutil  # noqa: PLC0415
            shutil.copyfile(src, dest)
    out.sort(key=lambda e: (e["board"], e["subject"], e["group"], e["code"], -order(e["series"]), e["kind"]))
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1, ensure_ascii=False)
    write_gaps(per_qual, out, log)
    total = sum(os.path.getsize(os.path.join(PDF, os.path.basename(e["file"]))) for e in out)
    print(f"{len(out)} files, {total / 1e6:.0f} MB in {PDF}", file=sys.stderr)
    if log:
        print(f"{len(log)} notes in {os.path.join(WORK, 'log.txt')}", file=sys.stderr)
    open(os.path.join(WORK, "log.txt"), "w").write("\n".join(log) + "\n")


GAPS_HEAD = """# WJEC and Eduqas: what isn't here, and why

Everything in manifest.json comes from the boards' own public pages: each
qualification's "Past Papers" and "Key Documents" tabs on wjec.co.uk and
eduqas.co.uk, with the PDFs on pastpapers.download.wjec.co.uk and the sites'
own /media/. Nothing is behind the WJEC/Eduqas secure portal, and nothing here
tried to reach it.

## Across both boards

- **The newest series.** Under the WJEC Publication Policy, question papers and
  mark schemes go to centres (secure website) first and to the public later. At
  the time of this run the public lists stop at {latest}; the June 2026 papers
  (and November 2025 for GCSE Maths) are not public yet. Their examiners'
  reports are public and are included.
- **2020 and 2021 summer series** were cancelled (Covid). Eduqas A-Level ran an
  autumn series in October 2020 and 2021 (included, as OCT20/OCT21); WJEC GCSE
  Maths ran November series as usual (NOV).
- **Legacy specifications** before the current ones (WJEC GCE units BY1-BY5,
  CH1-CH6, PH1-PH6, C1-C4/FP/M/S; WJEC GCSE Maths 4370 and Science 4xxx; Eduqas's
  pre-2015 England specifications) are not listed on either site any more, so
  they are not here. WJEC GCSE Mathematics and Mathematics–Numeracy (3300/3310)
  are what WJEC itself calls "Legacy" now (replaced by GCSE Mathematics and
  Numeracy 3320 from 2025); they are included, with groups ending ", legacy".
- **Modified, large-print and Braille papers** are skipped, as are Welsh-medium
  versions (the English listing is used).
- **Specification-wide booklets** (WJEC/Eduqas Chemistry data booklet, Physics
  data booklets, AS/A Level Maths formula booklet, Eduqas GCSE Maths "additional
  formulae" sheets) have no series, so they are left out; the per-series copies
  WJEC lists as "[Resource]" beside the papers (2022 onwards) are included as db.
- **Examiners' reports cover a whole qualification**, not a unit. Each is one
  entry with paper "Examiners' report", the spec code(s) as code, and the groups
  it covers in "groups".
- **One mark scheme for both tiers.** WJEC's GCSE science mark schemes (and a
  few others) cover the Foundation and Higher paper in one PDF; it is filed once
  per tier's paper, under each paper's own code (same bytes, two keys).
- **GCSE science Unit 3 (practical assessment)** is listed from June 2024 only;
  its June 2025 mark scheme is not listed yet.
- **Lettered papers.** A-Level Unit 5 practicals and GCSE Unit 3 are several
  papers with letter codes (1400U50-1A experimental task, -1E analysis task,
  3400U30-1A section A, ...); each keeps its printed code. Lettered data or
  formula booklets and teacher instructions (-1C setting-up instructions) take
  the paper's code, with the letter only in the file name.
- **Sample assessment materials**: WJEC and Eduqas publish one PDF of every
  unit's specimen paper and mark scheme together per qualification; each is one
  entry (kind qp, series SPEC, paper "Sample assessment materials"). WJEC GCSE
  Mathematics and Numeracy (3320) has one per unit and tier, filed per paper.

## Eduqas

- **GCSE Biology, Chemistry and Physics (C400/C410/C420): not available.** Their
  qualification pages now redirect to eduqas.co.uk/qualifications/, the pages
  are gone from the site's qualification list, and the past papers service has
  no entry for them (the IDs beside the A-Level pages return nothing). The PDFs
  are not on the download server under the names the other Eduqas papers use
  (tried S24/S24-C400U10-1.pdf and the like: 403). Nothing to fetch.
- **A-Level Maths and Further Maths**: not in the library, skipped as asked.
- **GCSE (9-1) Combined Science / Science**: not a library subject.

## WJEC

- **GCSE The Sciences (Double Award) 3455 and Integrated Science 3450** (teaching
  from 2026) replace the separate sciences in Wales; they are not library
  subjects and have no papers yet.
- **GCSE Mathematics and Numeracy (3320)**, teaching from 2025: only the sample
  assessment materials and the June 2026 examiners' report are public so far.
"""


def write_gaps(per_qual, manifest, log):
    lines = []
    latest = max((e["series"] for e in manifest if e["series"] != "SPEC" and e["kind"] in ("qp", "ms")), key=order)
    by_spec = collections.defaultdict(list)
    for e in manifest:
        if e["kind"] in ("qp", "ms"):
            by_spec[(e["board"], e["subject"], e["group"])].append(e)
    lines.append("\n## Per specification: what was found, and the holes\n")
    for (board, subject, group), es in sorted(by_spec.items()):
        series = sorted({e["series"] for e in es if e["series"] != "SPEC"}, key=order)
        if not series:
            lines.append(f"- **{board} {subject}, {group}**: sample assessment materials only.")
            continue
        holes, by = [], collections.defaultdict(set)
        for e in es:
            if e["series"] != "SPEC":
                by[(re.sub(r"[A-H]$", "", e["code"]), e["paper"].split(":")[0], e["series"])].add(e["kind"])
        for (code, unit, s), kinds in sorted(by.items(), key=lambda kv: (kv[0][0], order(kv[0][2]))):
            for k, label in (("qp", "question paper"), ("ms", "mark scheme")):
                if k not in kinds:
                    holes.append(f"{unit} ({code}) {s} {label}")
        lines.append(f"- **{board} {subject}, {group}**: {series[0]} to {series[-1]} ({', '.join(series)})."
                     + (f" Not listed by the board: {'; '.join(holes)}." if holes else ""))
    unavailable = [l for l in log if l.startswith("unavailable")]
    if unavailable:
        lines.append("\n## Listed by the board but not downloadable (not a PDF, or 403)\n")
        lines += [f"- {l.split(': ', 1)[1]}" for l in unavailable]
    open(os.path.join(WORK, "gaps.md"), "w").write(GAPS_HEAD.format(latest=latest) + "\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
