"""Write the Edexcel A-Level Psychology bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_psychology/build_psychology.py [work-dir]

edexcel_sciences/build_pearson.py, pointed at Psychology: the same shapes, written to
src/content/questionBank/edexcel-a-level-psychology.json and public/question-bank/edexcel-a-level-psychology/.
Every topic of the specification has the same six parts ("Content", "Methods", "Studies"…),
so each topic here takes its spec_psychology.py `short` ("Social psychology studies") for
its page title and its address (and topic 9's, "Psychological skills methods").

Paper 2's Section B is a choice of one option (Criminological, Child or Health) of whole
questions, so, as in the Geography banks, no part is marked "or": each option's questions
are tagged to its own topic (6, 7 or 8), and check_psychology.py checks the totals with the choice.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-psychology")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import build_pearson as bp  # noqa: E402

SLUG = "edexcel-a-level-psychology"
bp.SUBJECTS = [(SLUG, "Psychology", "Psychology", ("8PS0", "9PS0"))]
bp.TITLES = {
    "9PS0": ["Foundations in Psychology", "Applications of Psychology", "Psychological Skills"],
    "8PS0": ["Social and Cognitive Psychology", "Biological Psychology and Learning Theories"],
}
bp.FILES_JSON = None  # the past paper library has no Psychology page yet


def shorten():
    spec = json.load(open(os.path.join(bp.WORK, "spec.json")))["9PS0"]
    short = {t["code"]: t["short"] for t in spec["topics"]}
    path = os.path.join(bp.ROOT, "src", "content", "questionBank", f"{SLUG}.json")
    meta = json.load(open(path))
    for t in meta["topics"]:
        t["short"] = short[t["code"]]
        t["slug"] = bp.slug(t["short"])
    assert len({t["slug"] for t in meta["topics"]}) == len(meta["topics"]), "two topics share an address"
    json.dump(meta, open(path, "w"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    bp.main()
    shorten()
