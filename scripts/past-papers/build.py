"""Build the past paper library's data from our own copies of the boards' papers.

    python3 scripts/past-papers/build.py

Reads every board's manifest (scripts/past-papers/.work/<board>/manifest.json, written
by boards/<board>.py, see boards/README.md) and writes src/content/pastPapers.json:
the subjects, and for each subject every board we hold papers for, grouped by
specification, then paper, then sitting. Every file is a key in our R2 bucket.

Pages whose papers are the question bank's own (AQA A-Level sciences; Edexcel
A-Level Maths, Further Maths and sciences) are written here with their names only;
src/content/pastPapers.ts fills them from the bank's file lists. A board with no
papers at all has no page.
"""
import datetime, glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "src", "content", "pastPapers.json")

SUBJECTS = [
    ("a-level-maths", "A-Level", "Maths", ["aqa", "edexcel", "ocr", "ocr-mei", "wjec", "cie", "edexcel-ial"]),
    ("a-level-further-maths", "A-Level", "Further Maths", ["aqa", "edexcel", "ocr", "ocr-mei", "wjec", "cie", "edexcel-ial"]),
    ("a-level-biology", "A-Level", "Biology", ["aqa", "edexcel", "ocr", "eduqas", "wjec", "cie", "edexcel-ial"]),
    ("a-level-chemistry", "A-Level", "Chemistry", ["aqa", "edexcel", "ocr", "eduqas", "wjec", "cie", "edexcel-ial"]),
    ("a-level-physics", "A-Level", "Physics", ["aqa", "edexcel", "ocr", "eduqas", "wjec", "cie", "edexcel-ial"]),
    ("gcse-maths", "GCSE", "Maths", ["aqa", "edexcel", "ocr", "eduqas", "wjec", "cie-igcse", "edexcel-igcse"]),
    ("gcse-biology", "GCSE", "Biology", ["aqa", "edexcel", "ocr", "eduqas", "wjec", "cie-igcse", "edexcel-igcse"]),
    ("gcse-chemistry", "GCSE", "Chemistry", ["aqa", "edexcel", "ocr", "eduqas", "wjec", "cie-igcse", "edexcel-igcse"]),
    ("gcse-physics", "GCSE", "Physics", ["aqa", "edexcel", "ocr", "eduqas", "wjec", "cie-igcse", "edexcel-igcse"]),
    ("gcse-english-language", "GCSE", "English Language", ["aqa"]),
    ("gcse-computer-science", "GCSE", "Computer Science", ["edexcel"]),
    ("gcse-geography", "GCSE", "Geography", ["aqa"]),
]
# slug -> (how the board is written in a heading, its label on its own, the qualification at A-Level, at GCSE)
BOARDS = {
    "aqa": ("AQA", "AQA", "A-Level", "GCSE"),
    "edexcel": ("Edexcel", "Edexcel", "A-Level", "GCSE"),
    "ocr": ("OCR", "OCR", "A-Level", "GCSE"),
    "ocr-mei": ("OCR MEI", "OCR MEI", "A-Level", "GCSE"),
    "wjec": ("WJEC", "WJEC", "A-Level", "GCSE"),
    "eduqas": ("Eduqas", "Eduqas", "A-Level", "GCSE"),
    "cie": ("Cambridge", "Cambridge", "International A-Level", "IGCSE"),
    "edexcel-ial": ("Edexcel", "Edexcel IAL", "International A-Level", "International GCSE"),
    "cie-igcse": ("Cambridge", "Cambridge IGCSE", "International A-Level", "IGCSE"),
    "edexcel-igcse": ("Edexcel", "Edexcel IGCSE", "International A-Level", "International GCSE"),
}
# Filled from the question bank's files in src/content/pastPapers.ts.
BANK_OWNED = {("a-level-biology", "aqa"), ("a-level-chemistry", "aqa"), ("a-level-physics", "aqa"),
              ("a-level-maths", "edexcel"), ("a-level-further-maths", "edexcel"),
              ("a-level-biology", "edexcel"), ("a-level-chemistry", "edexcel"), ("a-level-physics", "edexcel")}
MONTH = {"JAN": "January", "FEB": "February", "MAR": "March", "MAY": "May", "JUN": "June", "OCT": "October", "NOV": "November"}
ROW_KINDS = ["qp", "ms", "er", "ins", "gt"]
# Files a sitting comes with that aren't a paper, linked under "More": Pearson GCSE Computer Science's
# Paper 2 is sat on screen, editing the code files in its zip; AQA GCSE Geography's Paper 3 is set on a
# pre-release resources booklet, beside the sitting's insert (an OS map key).
MORE = {"data": "Code files", "pm": "Resources booklet"}
# What a board keeps from the public, said on its pages instead of linking elsewhere.
NOTES = {
    "cie": "Cambridge publishes one recent sitting and its specimen papers openly. Earlier papers are on its School Support Hub, for schools.",
    "cie-igcse": "Cambridge publishes one recent sitting and its specimen papers openly. Earlier papers are on its School Support Hub, for schools.",
}
WHOLE = ("Examiner", "Grade thresholds", "Sample assessment materials", "Papers ")


def slugify(s):
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s.lower()))


def series_name(s):
    return "Specimen" if s == "SPEC" else f"{MONTH[s[:3]]} 20{s[3:]}"


def series_order(s):
    if s == "SPEC":
        return 0
    return int("20" + s[3:]) * 100 + list(MONTH).index(s[:3]) + 1


def natural(s):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", s)]


def group_order(heading):
    h = heading.lower()
    return (h.endswith("legacy"), "as (" in h or h.startswith("as") or "· as" in h, "foundation" in h, natural(heading))


def board_entry(subject, slug, level, files):
    head, label, a_level, gcse = BOARDS[slug]
    groups = {}
    for f in files:
        # A report for several specifications (WJEC's) lists them all in "groups".
        for g in f.get("groups") or [f["group"]]:
            groups.setdefault(g, {}).setdefault(f["paper"], []).append(f)
    out_groups = []
    for heading in sorted(groups, key=group_order):
        papers = []
        # Cards for the whole specification (examiner's reports, grade thresholds, sample
        # assessment materials) go after the papers.
        # A booklet for the whole specification (OCR's "Data Sheet") isn't a paper: it goes on every paper's card.
        spec_booklets = [f for name, mine in groups[heading].items() if not any(x["kind"] in ROW_KINDS for x in mine) for f in mine if f["kind"] == "db"]
        for name, mine in sorted(groups[heading].items(), key=lambda kv: (kv[0].startswith(WHOLE), natural(min(f["code"] for f in kv[1])))):
            codes = sorted({f["code"] for f in mine}, key=natural)
            # A sitting with several versions of the paper (Cambridge's /11, /12, /13; Pearson's R
            # papers) gets a row per version; otherwise one row, whatever its code.
            per_series = {}
            for f in mine:
                per_series.setdefault(f["series"], set()).add(f["code"])
            rows, more = {}, {}
            for f in mine:
                key = (f["series"], f["code"] if len(per_series[f["series"]]) > 1 else "")
                if f["kind"] in MORE:
                    more.setdefault(key, []).append({"label": MORE[f["kind"]], "href": f["file"]})
                if f["kind"] not in ROW_KINDS:
                    continue
                rows.setdefault(key, {})[f["kind"]] = f["file"]
            ordered = sorted(rows, key=lambda k: (-series_order(k[0]), natural(k[1])))
            # The latest sitting's booklets: a formula booklet and statistical tables can come as a pair.
            pool = [f for f in mine if f["kind"] == "db"] or spec_booklets
            newest = max((series_order(f["series"]) for f in pool), default=None)
            booklets = sorted({f["file"]: f for f in pool if series_order(f["series"]) == newest}.values(), key=lambda f: f["file"])
            short, _, title = name.partition(": ")
            code_label = ", ".join(codes[:3]) + ("…" if len(codes) > 3 else "")
            papers.append({
                "id": slugify(name), "name": short,
                "title": f"{head} {name} ({code_label})",
                "source": "",
                "extras": [{"label": ("Formula booklet" if "math" in subject else "Data booklet") + (f" {i + 1}" if len(booklets) > 1 else ""), "href": b["file"]} for i, b in enumerate(booklets)],
                "rows": [{"session": series_name(s) + (f" ({c.split('/')[-1]})" if c else ""), "files": rows[(s, c)],
                          **({"more": more[(s, c)]} if (s, c) in more else {})} for s, c in ordered],
            })
        papers = [p for p in papers if p["rows"]]
        if papers:
            out_groups.append({"id": slugify(heading), "heading": heading, "legacy": heading.endswith("legacy"), "papers": papers})
    # A new specification with only sample papers so far doesn't push the real past papers
    # into the folded "older specifications": they stay open, and first.
    specimen_only = lambda g: not any("qp" in r["files"] and not r["session"].startswith("Specimen") for p in g["papers"] for r in p["rows"])  # noqa: E731
    current = [g for g in out_groups if not g["legacy"]]
    if current and all(specimen_only(g) for g in current):
        for g in out_groups:
            g["legacy"] = False
            g["heading"] = re.sub(r",? legacy$", "", g["heading"])
        out_groups.sort(key=specimen_only)
    # The years a student can practise: question papers only (Cambridge's grade thresholds run
    # years past its public papers).
    years = [int("20" + f["series"][3:]) for f in files if f["series"] != "SPEC" and f["kind"] == "qp"]
    specs = []
    for g in [g for g in out_groups if not g["legacy"]] or out_groups:
        for code in re.findall(r"\(([0-9A-Z]{4})\)", g["heading"]):
            if code not in specs:
                specs.append(code)
    return {
        "subject": subject, "slug": slug, "board": head, "label": label,
        "qualification": a_level if level == "A-Level" else gcse,
        "specCodes": specs, "groups": out_groups,
        **({"note": NOTES[slug]} if slug in NOTES else {}),
        "firstYear": min(years) if years else 0, "lastYear": max(years) if years else 0,
        "fileCount": sum(len(r["files"]) + len(r.get("more", [])) for g in out_groups for p in g["papers"] for r in p["rows"]) + sum(len(p["extras"]) for g in out_groups for p in g["papers"]),
    }


def main():
    files = []
    for path in sorted(glob.glob(os.path.join(HERE, ".work", "*", "manifest.json"))):
        mine = json.load(open(path))
        files += mine
        print(f"{os.path.relpath(path, HERE)}: {len(mine)} files", file=sys.stderr)
    # One file can rightly sit in two places (OCR's MEI units under Maths and Further Maths;
    # a data sheet under both tiers): drop only true repeats.
    seen, unique = set(), []
    for f in files:
        key = (f["file"], f["subject"], f["board"], f["group"], f["paper"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(f)
    subjects, boards = [], []
    for subject, level, name, slugs in SUBJECTS:
        kept = []
        for slug in slugs:
            mine = [f for f in unique if f["subject"] == subject and f["board"] == slug]
            if (subject, slug) in BANK_OWNED:
                entry = board_entry(subject, slug, level, [])
            elif not mine:
                print(f"  no papers: {subject} {slug}", file=sys.stderr)
                continue
            else:
                entry = board_entry(subject, slug, level, mine)
                if not entry["groups"]:
                    continue
            boards.append(entry)
            kept.append(slug)
        subjects.append({"slug": subject, "level": level, "name": name, "boards": kept})
    data = {"generated": datetime.date.today().isoformat(), "subjects": subjects, "boards": boards}
    json.dump(data, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{len(boards)} board pages, {sum(b['fileCount'] for b in boards)} files -> {os.path.relpath(OUT, ROOT)}", file=sys.stderr)


if __name__ == "__main__":
    main()
