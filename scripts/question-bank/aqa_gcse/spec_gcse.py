"""Read AQA's GCSE Biology, Chemistry and Physics specifications into a topic tree.

    python3 scripts/question-bank/aqa_gcse/spec_gcse.py [work-dir]   # default scripts/question-bank/.work-gcse

spec.py's reader, pointed at the GCSE specifications, whose subject content is
numbered 4 (4.1 Cell biology, 4.1.1 Cell structure) where the A-Level's is 3.
Writes <work-dir>/spec.json in the same shape, keyed by spec code.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work-gcse")]
sys.path.insert(0, os.path.dirname(HERE))
import spec  # noqa: E402

SPECS = {
    "8461": "https://filestore.aqa.org.uk/resources/biology/specifications/AQA-8461-SP-2016.PDF",
    "8462": "https://filestore.aqa.org.uk/resources/chemistry/specifications/AQA-8462-SP-2016.PDF",
    "8463": "https://filestore.aqa.org.uk/resources/physics/specifications/AQA-8463-SP-2016.PDF",
}
spec.HEADING = re.compile(r"^(4(?:\.\d+){1,3})\s+(.+)$")
# "(physics only)", "(HT only)": content left out of Combined Science or Foundation. Dropped from titles.
ONLY = re.compile(r"\s*\((?:biology|chemistry|physics|HT|separate science)\s+only\)", re.I)


def main():
    os.makedirs(spec.WORK, exist_ok=True)
    out = {}
    for code, url in SPECS.items():
        nodes = spec.read(spec.fetch(url, os.path.join(spec.WORK, os.path.basename(url))))
        for n in nodes:
            n["title"] = ONLY.sub("", n["title"]).strip()
            n.pop("alevelOnly", None)
        for n in nodes:
            # Most GCSE topics keep their words under sub-topics: lead with those titles, for tagging.
            subs = [c["title"] for c in nodes if c["level"] == 3 and c["code"].startswith(n["code"] + ".")]
            if n["level"] == 2 and subs:
                n["text"] = ("Covers: " + "; ".join(subs) + ". " + n["text"]).strip()
        out[code] = nodes
        print(f"{code}: {sum(1 for n in nodes if n['level'] == 1)} sections, {sum(1 for n in nodes if n['level'] == 2)} topics, "
              f"{sum(1 for n in nodes if n['level'] == 3)} sub-topics", file=sys.stderr)
    json.dump(out, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
