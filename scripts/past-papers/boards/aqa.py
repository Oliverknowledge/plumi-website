"""AQA's papers for the past paper library, from AQA's own site.

    python3 scripts/past-papers/boards/aqa.py

The question bank's fetcher (scripts/question-bank/fetch_aqa.py) run over every AQA
specification the library shows that the bank doesn't already cover: A-Level Maths
(7357, AS 7356), Further Maths (7367, AS 7366), GCSE Maths (8300) and Level 2 Further
Maths (8365), the GCSE sciences (8461-8463) and GCSE English Language (8700), whose
question bank fetches the same files (aqa_english_lang/fetch_english_lang.py). The A-Level sciences are the bank's
own files and pages (ownAqaBoard in src/content/pastPapers.ts), so they aren't here.

Writes .work/aqa/pdf/AQA-<component>-<KIND>-<series>.pdf, the same names the bank
uploads, so files already on R2 under aqa/ aren't sent twice, and .work/aqa/manifest.json
in the library's shape (boards/README.md).
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.join(HERE, "..", ".work", "aqa")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(ROOT, "scripts", "question-bank"))
import fetch_aqa  # noqa: E402

PAGES = {
    "7357": "mathematics/a-level/mathematics-7357", "7356": "mathematics/as/mathematics-7356",
    "7367": "mathematics/a-level/further-mathematics-7367", "7366": "mathematics/as/further-mathematics-7366",
    "8300": "mathematics/gcse/mathematics-8300", "8365": "mathematics/level-2/further-mathematics-8365",
    "8461": "biology/gcse/biology-8461", "8462": "chemistry/gcse/chemistry-8462", "8463": "physics/gcse/physics-8463",
    "8700": "english/gcse/english-8700",
}
fetch_aqa.PAGES = [f"https://www.aqa.org.uk/subjects/{p}/assessment-resources" for p in PAGES.values()]
tiers = lambda spec, papers: [f"{spec}{n}{t}" for n in papers for t in "FH"]  # noqa: E731
fetch_aqa.COMPONENTS = {
    "7357": ["73571", "73572", "73573"], "7356": ["73561", "73562"],
    "7367": ["73671", "73672", "73673D", "73673M", "73673S"], "7366": ["73661", "73662D", "73662M", "73662S"],
    "8300": tiers("8300", "123"), "8365": ["83651", "83652"],
    **{spec: tiers(spec, "12") for spec in ("8461", "8462", "8463")},
    "8700": ["87001", "87002"],
}
# Maths has a November series for GCSE resits; the A-Levels were first sat in 2018 (AS 2017).
fetch_aqa.SERIES = ["JUN17", "JUN18", "NOV18", "JUN19", "NOV19", "NOV20", "NOV21", "JUN22", "NOV22", "JUN23", "NOV23", "JUN24", "NOV24", "JUN25"]
_parse = fetch_aqa.parse_name
TITLES = {"87001": "Explorations in creative reading and writing", "87002": "Writers’ viewpoints and perspectives"}


def parse_name(name):
    # June 2022's GCSE Biology Paper 1 reports went up as "AQA-84611F-WRE-%202022.PDF".
    m = re.match(r"AQA-(\d{5}[FH])-WRE-%20(20\d\d)\.PDF$", name, re.I)
    if m:
        return m.group(1), "er", "JUN" + m.group(2)[2:], False
    # English Language's specimens for its updated questions (first exam 2026): "AQA-8700-1-SQP-2026.pdf", "AQA-87002-SINS-2026.PDF".
    m = re.match(r"AQA-8700-?([12])-S(QP|MS|INS)-20\d\d\.PDF$", name, re.I)
    if m:
        return "8700" + m.group(1), fetch_aqa.KINDS[m.group(2).upper()], "SPEC", False
    return _parse(name)


fetch_aqa.parse_name = parse_name

SUBJECT = {"7357": "a-level-maths", "7356": "a-level-maths", "7367": "a-level-further-maths", "7366": "a-level-further-maths",
           "8300": "gcse-maths", "8365": "gcse-maths", "8461": "gcse-biology", "8462": "gcse-chemistry", "8463": "gcse-physics",
           "8700": "gcse-english-language"}
OPTION = {"D": "Discrete", "M": "Mechanics", "S": "Statistics"}


def describe(comp):
    """'73673M' -> ('A-Level (7367)', 'Paper 3: Mechanics', '7367/3M')."""
    spec, rest = comp[:4], comp[4:]
    n, tail = rest[0], rest[1:]
    if spec in ("7356", "7366"):
        group = f"AS ({spec})"
    elif spec == "8365":
        group = "Level 2 Further Maths (8365)"
    elif spec == "8700":
        return f"GCSE ({spec})", f"Paper {n}: {TITLES[comp]}", f"{spec}/{n}"
    elif spec.startswith("8"):
        group = f"{'Higher' if tail == 'H' else 'Foundation'} tier ({spec})"
    else:
        group = f"A-Level ({spec})"
    paper = f"Paper {n}" + (f": {OPTION[tail]}" if tail in OPTION else "") + (" (Higher)" if tail == "H" else " (Foundation)" if tail == "F" else "")
    return group, paper, f"{spec}/{rest}"


def main():
    # The GCSE science papers were fetched for the question bank; reuse them rather than download again.
    seed = os.path.join(ROOT, "..", "plumi-website-aqa-gcse", "scripts", "question-bank", ".work-gcse", "pdf")
    os.makedirs(fetch_aqa.PDF, exist_ok=True)
    if os.path.isdir(seed):
        for name in os.listdir(seed):
            if not os.path.exists(os.path.join(fetch_aqa.PDF, name)):
                shutil.copy2(os.path.join(seed, name), fetch_aqa.PDF)
    fetch_aqa.main()
    found = json.load(open(os.path.join(WORK, "manifest.json")))
    out = []
    for f in found:
        comp = f["component"]
        if comp[:4] not in SUBJECT or f["kind"] == "db":
            continue
        group, paper, code = describe(comp)
        out.append({"subject": SUBJECT[comp[:4]], "board": "aqa", "group": group, "paper": paper, "code": code,
                    "series": f["series"], "kind": f["kind"], "source": f["source"], "file": f"aqa/{f['file']}"})
    json.dump(out, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(out)} library files", file=sys.stderr)


if __name__ == "__main__":
    main()
