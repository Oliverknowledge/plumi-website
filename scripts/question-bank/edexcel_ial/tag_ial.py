"""Split the cut Edexcel International A Level parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_ial/tag_ial.py split [work-dir] [batch-size]
    python3 scripts/question-bank/edexcel_ial/tag_ial.py merge [work-dir]

edexcel_sciences/tag_pearson.py for the International A Level specifications. split writes
<work-dir>/tag/<subject>-topics.txt (each sub-topic's code, its topic, its title, its statement
numbers, [AS] or [A-Level only], and what the specification says under it) and
<work-dir>/tag/batch-NN-<subject>.jsonl, one part per line with its unit ("AS Unit 2"). Each batch
is tagged following ../tag.md ("Edexcel International A Level sciences") into
batch-NN-<subject>.tags.json: {"<part id>": ["8.B"], ...}. merge combines them into
<work-dir>/tags.json for build_ial.py, as tag_pearson.py does.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "edexcel-ial")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 260
sys.argv[2:] = [WORK, str(SIZE)]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import tag_pearson as tp  # noqa: E402

TAG = os.path.join(WORK, "tag")
SUBJECTS = {"biology": ("WBI", "WBI"), "chemistry": ("WCH", "WCH"), "physics": ("WPH", "WPH")}


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    n = 0
    for subject, (code, _) in SUBJECTS.items():
        tree = spec[code]
        titles = {s["code"]: s["title"] for s in tree["sections"]}
        lines = [f"{t['code']} | {titles[t['section']]} | {(t['ref'] + ' ') if t['ref'] else ''}{t['title']}"
                 + (f" (statements {t['points']})" if t.get("points") else "")
                 + (" [AS]" if t["year"] == 1 else " [A-Level only]") + f" — {tp.clip(t['text'], 3000)}"
                 for t in tree["topics"]]
        open(os.path.join(TAG, f"{subject}-topics.txt"), "w").write("\n".join(lines) + "\n")
        mine = [p for p in parts if p["component"][:3].upper() == code and p.get("qp")]
        for i in range(0, len(mine), SIZE):
            n += 1
            with open(os.path.join(TAG, f"batch-{n:02d}-{subject}.jsonl"), "w") as f:
                for p in mine[i:i + SIZE]:
                    unit = int(p["component"][4])
                    setup, question = tp.own(p["text"], p["label"])
                    f.write(json.dumps({"id": p["id"], "paper": f"{'AS ' if unit <= 3 else ''}Unit {unit}",
                                        "setup": tp.clip(setup, 200), "question": tp.clip(question, 360),
                                        "scheme": tp.clip(p.get("msText", ""), 200)}, ensure_ascii=False) + "\n")
    print(f"{n} batches in {TAG}", file=sys.stderr)


if __name__ == "__main__":
    tp.SUBJECTS, tp.TAG = SUBJECTS, TAG
    split() if mode == "split" else tp.merge()
