"""Turn PMT's page-by-page listing into Plumi's past paper library.

    npm run papers:crawl     # fetch PMT's listings (polite, cached in scripts/past-papers/.cache)
    npm run papers:build     # write src/content/pastPapers.json

PMT arranges papers one page per paper; students search by level, subject and
board. This regroups every file into one page per (subject, board), each with
its specifications as groups, its papers as cards and each sitting as a row.
Stored hrefs are relative to PMT's download host (see src/content/pastPapers.ts).
"""
import collections, datetime, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "src", "content", "pastPapers.json")
DOWNLOAD = "https://pmt.physicsandmathstutor.com/download/"

# ── Subjects and boards ──────────────────────────────────────────────────────
SUBJECTS = [  # slug, level, name — in the order the hub shows them
    ("a-level-maths", "A-Level", "Maths"),
    ("a-level-further-maths", "A-Level", "Further Maths"),
    ("a-level-biology", "A-Level", "Biology"),
    ("a-level-chemistry", "A-Level", "Chemistry"),
    ("a-level-physics", "A-Level", "Physics"),
    ("gcse-maths", "GCSE", "Maths"),
    ("gcse-biology", "GCSE", "Biology"),
    ("gcse-chemistry", "GCSE", "Chemistry"),
    ("gcse-physics", "GCSE", "Physics"),
]
# slug -> (board as written in a heading, short label for chips, qualification at each level)
BOARDS = {
    "aqa": ("AQA", "AQA", {"A-Level": "A-Level", "GCSE": "GCSE"}),
    "edexcel": ("Edexcel", "Edexcel", {"A-Level": "A-Level", "GCSE": "GCSE"}),
    "ocr": ("OCR", "OCR", {"A-Level": "A-Level", "GCSE": "GCSE"}),
    "ocr-mei": ("OCR MEI", "OCR MEI", {"A-Level": "A-Level"}),
    "eduqas": ("Eduqas", "Eduqas", {"A-Level": "A-Level", "GCSE": "GCSE"}),
    "wjec": ("WJEC", "WJEC", {"A-Level": "A-Level", "GCSE": "GCSE"}),
    "cie": ("CAIE", "CAIE", {"A-Level": "A-Level"}),
    "edexcel-ial": ("Edexcel", "Edexcel IAL", {"A-Level": "International A-Level"}),
    "cie-igcse": ("Cambridge", "Cambridge IGCSE", {"GCSE": "IGCSE"}),
    "edexcel-igcse": ("Edexcel", "Edexcel IGCSE", {"GCSE": "International GCSE"}),
}
BOARD_ORDER = list(BOARDS)

SCIENCE = {"/past-papers/a-level-biology/": "a-level-biology", "/past-papers/a-level-chemistry/": "a-level-chemistry",
           "/past-papers/a-level-physics/": "a-level-physics", "/past-papers/gcse-biology/": "gcse-biology",
           "/past-papers/gcse-chemistry/": "gcse-chemistry", "/past-papers/gcse-physics/": "gcse-physics"}
OLD_SPEC_BOARD = {"AQA papers": "aqa", "Edexcel papers": "edexcel", "OCR papers": "ocr", "OCR-MEI papers": "ocr-mei"}
MODULE_NAMES = {"C": "Core", "M": "Mechanics", "S": "Statistics", "D": "Decision", "FP": "Further Pure"}


def clean(s):
    return re.sub(r"\s+", " ", (s or "").replace("\xa0", " ")).strip()


def route(leaf):
    """(subject, board, group label, legacy) for a PMT leaf, from where PMT's index listed it."""
    idx, h3, h4, h5, label = leaf["index"], clean(leaf["h3"]), clean(leaf["h4"]), clean(leaf["h5"]), clean(leaf["label"])
    if idx in SCIENCE:
        subject = SCIENCE[idx]
        legacy = h3.startswith("Legacy")
        if h3.startswith("International") or h3.startswith("IGCSE"):
            board = {"CAIE": "cie", "Edexcel": "edexcel-ial"}[h4] if subject.startswith("a-level") else {"CAIE": "cie-igcse", "Edexcel": "edexcel-igcse"}[h4]
        else:
            board = {"AQA": "aqa", "Edexcel": "edexcel", "OCR": "ocr", "Eduqas": "eduqas", "WJEC": "wjec"}[h4]
        variant = "" if h5 in ("GCSE",) else h5
        return subject, board, variant, legacy
    if idx == "/past-papers/gcse-maths/":
        legacy = h3.startswith("Legacy")
        if h4 == "CAIE":
            return "gcse-maths", "cie-igcse", "Additional Maths" if h5 == "Further" else "", False
        if h4 == "Edexcel" and (h5.startswith("IGCSE") or h5 == "Further"):
            return "gcse-maths", "edexcel-igcse", {"IGCSE A": "Specification A", "IGCSE B": "Specification B", "Further": "Further Pure Maths"}[h5], False
        board = {"AQA": "aqa", "Edexcel": "edexcel", "OCR": "ocr", "Eduqas": "eduqas", "WJEC": "wjec"}[h4]
        variant = {"Further": "Level 2 Further Maths", "GCSE": ""}.get(h5, h5)
        return "gcse-maths", board, variant, legacy
    # A-Level Maths and Further Maths
    if h3.startswith("UK AS"):
        further = "Further" in h4
        board = {"AQA": "aqa", "Edexcel": "edexcel", "OCR (A)": "ocr", "OCR (MEI)": "ocr-mei", "WJEC": "wjec"}[h4.replace(" Further", "")]
        return ("a-level-further-maths" if further else "a-level-maths"), board, "", False
    if h4 == "CAIE":
        further = label.startswith("Further")
        return ("a-level-further-maths" if further else "a-level-maths"), "cie", "", False
    if h4 == "Edexcel IAL":
        return ("a-level-further-maths" if label.startswith("Further") else "a-level-maths"), "edexcel-ial", "", False
    if h3.startswith("UK Modular"):
        return ("a-level-further-maths" if h4.startswith("FP") else "a-level-maths"), OLD_SPEC_BOARD[label], "Old specification modules", True
    raise ValueError(f"unrouted {leaf['url']}")


# ── Files ────────────────────────────────────────────────────────────────────
KIND_TOKENS = {"QP": "qp", "MS": "ms", "MA": "ma", "VS": "vs", "INS": "ins", "IN": "ins", "AB": "ab"}
COLUMN_KIND = {"Question Papers": "qp", "QP": "qp", "Mark Schemes": "ms", "Mark Scheme": "ms", "MS": "ms", "Model Answers": "ma", "MA": "ma",
               "Video Solutions": "vs", "Inserts": "ins", "Answer Booklets": "ab", "Answer Booklet": "ab", "AB": "ab"}
EXTRA_HEADINGS = {"Grade Boundaries", "Formulae List", "Data Booklet"}
TIERS = {"Foundation", "Higher", "Intermediate", "EMPA", "ISA"}
MONTHS = {"jan": 1, "january": 1, "feb": 2, "march": 3, "mar": 3, "may": 5, "june": 6, "jun": 6, "oct": 10, "october": 10, "nov": 11, "november": 11}
MONTH_NAME = {"jan": "January", "nov": "November", "oct": "October", "mar": "March", "jun": "June"}


def rel(href):
    return href[len(DOWNLOAD):] if href.startswith(DOWNLOAD) else href


def split_label(label, column_kind):
    """'June 2019 (v2) QP - Paper 1 CAIE Biology' -> ('June 2019 (v2)', 'qp', None)."""
    text = clean(re.sub(r"\s+-\s+.*$", "", clean(label))) or clean(label)
    words = text.split(" ")
    kind, extra = None, None
    for i, w in enumerate(words):
        if w in KIND_TOKENS:
            kind = KIND_TOKENS[w]
            words = words[:i] + words[i + 1:]
            break
    if kind is None:
        if words and re.fullmatch(r"T\d|TN|TS|ERR|SA", words[-1]):
            extra = words.pop()
        elif column_kind:
            kind = column_kind
    session = " ".join(words).strip()
    session = re.sub(r"^(Jan|Nov|Oct|Mar|Jun)\b", lambda m: MONTH_NAME[m.group(1).lower()], session)
    return session, kind, extra


def session_key(session):
    m = re.search(r"(19|20)\d{2}", session)
    year = int(m.group(0)) if m else 0
    month = next((v for k, v in MONTHS.items() if session.lower().startswith(k)), 0)
    if not m:  # Specimen, Sample, Combined: after every dated sitting
        return (-1, 0, session)
    return (year, month, session)


def is_session(session):
    return bool(re.search(r"(19|20)\d{2}", session)) or session.split(" ")[0] in ("Specimen", "Sample", "Combined")


SPEC_RE = re.compile(r"\b(\d{4}|\d[A-Z]{2}\d|\d[A-Z]{3}\d?|[A-Z]\d{3}|9[A-Z]{2}\d)\b")


def spec_codes(title):
    m = re.search(r"\(([^)]*)\)\s*$", title)
    if not m:
        return []
    return [c for c in (re.split(r"\s*/\s*", m.group(1)) if "/" in m.group(1) and not re.search(r"/\d+$", m.group(1)) else [m.group(1).split("/")[0]]) if SPEC_RE.fullmatch(c.strip())]


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


SPEC_MARKER = re.compile(r"spec|syllabus|legacy|international \(|old", re.I)


def cards_for(leaf, subject, board):
    """Split one PMT page into paper cards: by in-page heading (paper or spec era) and tier."""
    cards = collections.OrderedDict()
    for sec in leaf["sections"]:
        h4, h5 = clean(sec["h4"]), clean(sec["h5"])
        if h4.startswith("PMT Mocks") or h4.startswith("Madas"):
            continue
        tier = h5 if h5 in TIERS else (h4 if h4 in ("Foundation", "Higher") else "")
        sub = "" if h4 in ("Foundation", "Higher") else h4
        key = (sub, tier)
        card = cards.setdefault(key, {"sub": sub, "tier": tier, "rows": {}, "extras": []})
        column = COLUMN_KIND.get(h5)
        for link in sec["links"]:
            if link.get("video"):
                session, _, _ = split_label(link["label"], None)
                session = re.sub(r"\s*VS$", "", session)
                card["rows"].setdefault(session, {"files": {}, "more": []})["files"]["vs"] = link["href"]
                continue
            session, kind, extra = split_label(link["label"], column)
            if h5 in EXTRA_HEADINGS or not is_session(session) or session.startswith("- "):
                label = clean(re.sub(r"\s+-\s+.*$", "", clean(link["label"]))).lstrip("- ").strip() or h5
                if label in ("Grade Boundaries",) and h5 == "Grade Boundaries" and sub:
                    label = "Grade boundaries"
                card["extras"].append({"label": label, "href": rel(link["href"])})
                continue
            row = card["rows"].setdefault(session, {"files": {}, "more": []})
            if kind and kind not in row["files"]:
                row["files"][kind] = rel(link["href"])
            else:
                row["more"].append({"label": extra or clean(link["label"]), "href": rel(link["href"])})
    return cards


# Specification codes PMT's maths pages don't print in their titles.
KNOWN_CODES = {
    ("a-level-maths", "aqa"): ("7357", "7356"), ("a-level-maths", "edexcel"): ("9MA0", "8MA0"),
    ("a-level-maths", "ocr"): ("H240", "H230"), ("a-level-maths", "ocr-mei"): ("H640", "H630"),
    ("a-level-further-maths", "aqa"): ("7367", "7366"), ("a-level-further-maths", "edexcel"): ("9FM0", "8FM0"),
    ("a-level-further-maths", "ocr"): ("H245", "H235"), ("a-level-further-maths", "ocr-mei"): ("Y420", "Y410"),
    ("a-level-further-maths", "cie"): ("9231", "9231"),
}
IAL_MODULE = {"Pure": "C", "Mechanics": "M", "Statistics": "S", "Decision": "D", "Further Pure": "FP"}
MODULE_ORDER = {"C": 0, "S": 1, "M": 2, "D": 3, "FP": 4}


def tidy_era(text):
    """PMT's era headings, as a student would read them."""
    text = re.sub(r"(\d{4})\+ Spec", r"Syllabus from \1", text)
    text = re.sub(r"(?:CAIE \w+ )?(\d{4})-(\d{4}) Spec", r"Syllabus \1–\2", text)
    text = re.sub(r"^9-1 syllabus \((\d{4})\)", r"IGCSE 9–1 for UK schools (\1)", text)
    text = re.sub(r"^International \((\d{4})\)", r"IGCSE (\1)", text)
    text = re.sub(r"^New Spec \((\w+)\)", r"Current specification (\1)", text)
    return text


def module_of(label):
    """'Pure 2' on an Edexcel IAL page -> 'C2', the UK module it shares a page with."""
    m = re.match(r"(Further Pure|Pure|Mechanics|Statistics|Decision) (\d)", label)
    return f"{IAL_MODULE[m.group(1)]}{m.group(2)}" if m else label


def main(cache_dir):
    leaves = json.load(open(os.path.join(cache_dir, "leaves.json")))
    pages = collections.OrderedDict()  # (subject, board) -> {group key -> group}
    for leaf in leaves:
        subject, board, variant, legacy = route(leaf)
        label = clean(leaf["label"])
        title = clean(leaf["h1"])
        is_as = label.startswith("AS") or "AS-level" in title or bool(re.search(r"\bAS\b", title))
        cards = [(k, c) for k, c in cards_for(leaf, subject, board).items() if c["rows"] or c["extras"]]
        # A data sheet listed above the tiers belongs to the paper, not a card of its own.
        loose = [c for _, c in cards if not c["rows"]]
        cards = [(k, c) for k, c in cards if c["rows"]]
        if loose and cards:
            cards[0][1]["extras"] = [x for c in loose for x in c["extras"]] + cards[0][1]["extras"]
        for (sub, tier), card in cards:
            ial_science = board == "edexcel-ial" and not subject.endswith("maths")
            card_legacy = legacy or bool(re.search(r"old spec|legacy|\b(19|20)\d\d-(19|20)\d\d spec|specification \(", sub, re.I)) \
                or (ial_science and bool(re.match(r"\d|.*\(W", sub)))
            target_board = board
            uk_module = board == "edexcel-ial" and subject.endswith("maths") and bool(re.search(r"old spec|^A-level \(\d{4}\)", sub, re.I))
            if uk_module:
                target_board, card_legacy = "edexcel", True  # the UK modular C1-C4, FP1-3 etc. that share PMT's IAL pages
            # Group: the specification (and AS or A-Level) the paper belongs to.
            maths_alevel = subject in ("a-level-maths", "a-level-further-maths")
            if card_legacy:
                if maths_alevel and (legacy or uk_module):
                    group = "Old specification modules"
                elif ial_science:
                    group = "Older specification (" + "/".join(re.findall(r"\b6[A-Z]{2}0\b", sub + " " + title)[:1] or ["6xx0"]) + ")"
                elif sub and SPEC_MARKER.search(sub) and not legacy:
                    group = tidy_era(re.sub(r"^Old Spec\s*", "Old specification ", sub))
                else:
                    group = variant or "Legacy specification"
            else:
                level_label = "AS" if is_as else ("A-Level" if subject.startswith("a-level") else "")
                spec_era = tidy_era(sub) if sub and SPEC_MARKER.search(sub) else ""
                if ial_science:
                    spec_era = "Current specification (" + (re.findall(r"W[A-Z]{2}1", sub) or ["W"])[0] + ")"
                    level_label = ""
                group = " · ".join(x for x in (variant, spec_era, level_label) if x) or "GCSE"
            # Card name and title
            if uk_module:
                mod = module_of(label)
                code = re.findall(r"\((\d{4})\)", sub)
                name = mod
                full = f"{mod} ({MODULE_NAMES[re.match(r'[A-Z]+?(?=\d)', mod).group(0)]} {mod[-1]}){' · ' + code[0] if code else ''}"
            elif card_legacy and leaf["h3"].startswith("UK Modular"):
                mod = clean(leaf["h4"])
                name = mod
                full = f"{mod} ({MODULE_NAMES[re.match(r'[A-Z]+?(?=\d)', mod).group(0)]} {mod[-1]})"
            elif sub and not SPEC_MARKER.search(sub) and sub != "IAL":
                name = sub
                full = sub if (maths_alevel and "Papers" in title) else f"{title}: {sub}"
            else:
                name = label if not label.endswith("papers") else title.replace(" Papers", "")
                full = title
            if tier:
                name, full = f"{name} ({tier})", f"{full} ({tier})"
            rows = [{"session": s, "files": r["files"], **({"more": r["more"]} if r["more"] else {})}
                    for s, r in sorted(card["rows"].items(), key=lambda kv: session_key(kv[0]), reverse=True)]
            gkey = slug(group) or "papers"
            page = pages.setdefault((subject, target_board), collections.OrderedDict())
            g = page.setdefault(gkey, {"id": gkey, "heading": group, "legacy": card_legacy, "papers": [], "codes": []})
            pid = slug(name)
            existing = next((p for p in g["papers"] if p["id"] == pid), None)
            if existing and uk_module:  # one module listed on two PMT pages: merge the sittings
                have = {r["session"] for r in existing["rows"]}
                existing["rows"] = sorted(existing["rows"] + [r for r in rows if r["session"] not in have], key=lambda r: session_key(r["session"]), reverse=True)
                continue
            while any(p["id"] == pid for p in g["papers"]):
                pid += "-b"
            g["papers"].append({"id": pid, "name": name, "title": full, "source": leaf["url"], "extras": card["extras"], "rows": rows})
            if not card_legacy:
                known = KNOWN_CODES.get((subject, target_board))
                found = [known[1 if is_as else 0]] if known else spec_codes(title)
                if ial_science:
                    found = re.findall(r"W[A-Z]{2}1", sub)[:1]
                g["codes"] += [c for c in found if c not in g["codes"]]
        # Old UK modules in the order every board lists them: Core, Statistics, Mechanics, Decision, Further Pure.
        for page in pages.values():
            for g in page.values():
                if g["heading"] == "Old specification modules":
                    g["papers"].sort(key=lambda p: (MODULE_ORDER.get(re.match(r"[A-Z]+?(?=\d)|[A-Z]+", p["name"]).group(0), 9), p["name"]))

    boards_out, subjects_out = [], []
    for subj, level, name in SUBJECTS:
        present = [b for b in BOARD_ORDER if (subj, b) in pages]
        subjects_out.append({"slug": subj, "level": level, "name": name, "boards": present})
        for b in present:
            groups = list(pages[(subj, b)].values())
            # Current specifications first, A-Level before AS, then legacy, newest era first.
            groups.sort(key=lambda g: (g["legacy"], bool(re.search(r"Further|Additional|Level 2", g["heading"])) and b != "edexcel-igcse" or g["heading"].startswith("Further Pure"),
                                       "AS" in g["heading"].split(" · "), "9–1" in g["heading"], g["heading"]))
            codes = []
            for g in groups:
                if g["codes"] and not g["legacy"] and "(" not in g["heading"]:
                    g["heading"] = f"{g['heading']} ({', '.join(g['codes'][:2])})"
                codes += [c for c in g["codes"] if c not in codes]
                del g["codes"]
            years = [int(y) for g in groups for p in g["papers"] for r in p["rows"] for y in re.findall(r"(?:19|20)\d{2}", r["session"])[:1]]
            files = sum(len(r["files"]) + len(r.get("more", [])) for g in groups for p in g["papers"] for r in p["rows"]) + sum(len(p["extras"]) for g in groups for p in g["papers"])
            display, short, quals = BOARDS[b]
            boards_out.append({
                "subject": subj, "slug": b, "board": display, "label": short, "qualification": quals[level],
                "specCodes": codes[:4], "groups": groups,
                "firstYear": min(years) if years else 0, "lastYear": max(years) if years else 0, "fileCount": files,
            })

    out = {"generated": datetime.date.today().isoformat(), "source": "https://www.physicsandmathstutor.com/past-papers/",
           "subjects": subjects_out, "boards": boards_out}
    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    total = sum(b["fileCount"] for b in boards_out)
    print(f"{len(subjects_out)} subjects, {len(boards_out)} board pages, {total} files -> {os.path.relpath(OUT)}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, ".cache"))
