"""Read AQA's GCSE Combined Science: Trilogy specification into a topic tree.

    python3 scripts/question-bank/aqa_trilogy/spec_trilogy.py [work-dir]   # default scripts/question-bank/.work-gcse-trilogy

spec.py's reader over Trilogy (8464), whose content is numbered by science: 4 Biology
(4.1 Cell biology), 5 Chemistry (5.1 Atomic structure and the periodic table), 6 Physics
(6.1 Energy). Writes <work-dir>/spec.json as {"8464": [nodes]}, as spec_gcse.py does.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work-gcse-trilogy")]
sys.path.insert(0, os.path.dirname(HERE))
import spec  # noqa: E402

URL = "https://filestore.aqa.org.uk/resources/science/specifications/AQA-8464-SP-2016.PDF"
spec.HEADING = re.compile(r"^([456](?:\.\d+){1,3})\s+(.+)$")
ONLY = re.compile(r"\s*\((?:HT|higher tier)\s+only\)", re.I)


def main():
    os.makedirs(spec.WORK, exist_ok=True)
    nodes = spec.read(spec.fetch(URL, os.path.join(spec.WORK, os.path.basename(URL))))
    for n in nodes:
        n["title"] = ONLY.sub("", n["title"]).strip()
        n.pop("alevelOnly", None)
    for n in nodes:
        subs = [c["title"] for c in nodes if c["level"] == 3 and c["code"].startswith(n["code"] + ".")]
        if n["level"] == 2 and subs:
            n["text"] = ("Covers: " + "; ".join(subs) + ". " + n["text"]).strip()
    json.dump({"8464": nodes}, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    for lv in (1, 2, 3):
        print(f"level {lv}: {sum(1 for n in nodes if n['level'] == lv)}", file=sys.stderr)
    for n in nodes:
        if n["level"] <= 2:
            print(("  " if n["level"] == 2 else "") + n["code"], n["title"], file=sys.stderr)


if __name__ == "__main__":
    main()
