"""Write the Edexcel A-Level Politics bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_politics/build_politics.py [work-dir]

edexcel_sciences/build_pearson.py, pointed at Politics: the same shapes, written to
src/content/questionBank/edexcel-a-level-politics.json and public/question-bank/edexcel-a-level-politics/.
Paper 3 is two papers, 3A (USA) and 3B (Global), of which a student sits one: they are papers of their
own ("9pl03a", "Paper 3A"), so the paper filter picks one, as do the topic tiles' "Paper 3 options".

Every question is a choice, "EITHER 1(a) OR 1(b)" (Paper 3's Section C: two of 3(a), 3(b) and 3(c)), each
choice worth the same: every part after a question's first carries "or", so a whole question's marks
count one essay.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-politics")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import build_pearson as bp  # noqa: E402

SLUG = "edexcel-a-level-politics"
bp.SUBJECTS = [(SLUG, "Politics", "Politics", ("8PL0", "9PL0"))]
bp.TITLES = {
    "9PL0": ["UK Politics and Core Political Ideas", "UK Government and Non-core Political Ideas"],
    "8PL0": ["UK Politics", "UK Government"],
}
OPTIONS = {"a": "Comparative Politics: USA", "b": "Comparative Politics: Global"}
bp.FILES_JSON = None  # the past paper library has no Politics page yet
_paper_for = bp.paper_for


def paper_for(comp):
    """'9pl03a' -> {id, name: 'Paper 3A', title: 'Comparative Politics: USA', as: False}."""
    m = re.fullmatch(r"9pl03([ab])", comp)
    if m:
        return {"id": comp, "name": f"Paper 3{m.group(1).upper()}", "title": OPTIONS[m.group(1)], "as": False}
    return _paper_for(comp)


bp.paper_for = paper_for


def mark_alternatives():
    rows_path = os.path.join(bp.ROOT, "public", "question-bank", SLUG, "parts.json")
    meta_path = os.path.join(bp.ROOT, "src", "content", "questionBank", f"{SLUG}.json")
    rows, meta = json.load(open(rows_path)), json.load(open(meta_path))
    first = {}
    for r in sorted(rows, key=lambda r: (r["p"], r["s"], bp.label_order(r["l"]))):
        first.setdefault((r["p"], r["s"], re.match(r"\d+", r["l"]).group()), r["id"])
    alt = {r["id"] for r in rows if "(" in r["l"] and first[(r["p"], r["s"], re.match(r"\d+", r["l"]).group())] != r["id"]}
    for r in rows + meta["sample"]:
        if r["id"] in alt:
            r["or"] = 1
    json.dump(rows, open(rows_path, "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(meta, open(meta_path, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(alt)} essay choices marked as alternatives", file=sys.stderr)


if __name__ == "__main__":
    bp.main()
    mark_alternatives()
