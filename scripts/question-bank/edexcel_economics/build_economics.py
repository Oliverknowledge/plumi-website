"""Write the Edexcel A-Level Economics A bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_economics/build_economics.py [work-dir]

edexcel_sciences/build_pearson.py, pointed at Economics A: the same shapes, written to
src/content/questionBank/edexcel-a-level-economics-a.json and public/question-bank/edexcel-a-level-economics-a/.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-economics")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import build_pearson as bp  # noqa: E402

bp.SUBJECTS = [("edexcel-a-level-economics-a", "Economics A", "Economics A", ("8EC0", "9EC0"))]
bp.TITLES = {
    "9EC0": ["Markets and Business Behaviour", "The National and Global Economy", "Microeconomics and Macroeconomics"],
    "8EC0": ["Introduction to Markets and Market Failure", "The UK Economy – Performance and Policies"],
}
bp.FILES_JSON = None  # no past paper library page for economics yet

def mark_alternatives():
    """The essay choices, "EITHER 1(d) OR 1(e)" (AS: 6(f) or 6(g)): a question's last two parts, worth the
    same 20 or 25 marks. The second carries "or", so a whole question's marks count only one of them."""
    root = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
    for slug, *_ in bp.SUBJECTS:
        rows_path = os.path.join(root, "public", "question-bank", slug, "parts.json")
        meta_path = os.path.join(root, "src", "content", "questionBank", f"{slug}.json")
        rows, meta = json.load(open(rows_path)), json.load(open(meta_path))
        questions = {}
        for r in rows:
            questions.setdefault((r["p"], r["s"], re.match(r"\d+", r["l"]).group()), []).append(r)
        alt = set()
        for parts in questions.values():
            if len(parts) >= 3 and parts[-2]["m"] and parts[-2]["m"] == parts[-1]["m"] and parts[-1]["m"] >= 15:
                alt.add(parts[-1]["id"])
        for r in rows + meta["sample"]:
            if r["id"] in alt:
                r["or"] = 1
        json.dump(rows, open(rows_path, "w"), ensure_ascii=False, separators=(",", ":"))
        json.dump(meta, open(meta_path, "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"{slug}: {len(alt)} essay choices marked as alternatives", file=sys.stderr)


if __name__ == "__main__":
    bp.main()
    mark_alternatives()
