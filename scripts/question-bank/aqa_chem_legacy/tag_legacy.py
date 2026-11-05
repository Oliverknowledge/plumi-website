"""Split the legacy Chemistry parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_chem_legacy/tag_legacy.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_chem_legacy/tag_legacy.py merge [work-dir]

Like tag_batches.py, but the topics are the current specification's (7405), which these 2010-2016
questions were never written for, so a part can also be "off": its content isn't on 7405 (the
blast furnace, a magnetic-sector mass spectrometer). The brief is "AQA A-Level Chemistry, legacy
units" in tag.md. split writes <work-dir>/tag/chemistry-topics.txt (7405's topics and sub-topics)
and batch-NN.jsonl; each batch is tagged into batch-NN.tags.json: {"<id>": ["3.2.2"] or ["off", "why"]}.
merge writes <work-dir>/tags.json ({id: [codes]}) and off.json ({id: why}) for build_legacy.py.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work-chem-legacy")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 260
TAG = os.path.join(WORK, "tag")
UNIT = {"CHEM1": "CHEM1 (AS) Foundation Chemistry", "CHEM2": "CHEM2 (AS) Chemistry in Action",
        "CHEM4": "CHEM4 (A2) Kinetics, Equilibria and Organic Chemistry", "CHEM5": "CHEM5 (A2) Energetics, Redox and Inorganic Chemistry"}


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").replace("…", "").strip()
    s = re.sub(r"\.{4,}", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def topics():
    return json.load(open(os.path.join(WORK, "spec.json")))["7405"]


def split():
    os.makedirs(TAG, exist_ok=True)
    lines = []
    for n in topics():
        if n["level"] == 1:
            lines.append(f"\n{n['code']} {n['title']}")
        elif n["level"] == 2:
            lines.append(f"{n['code']} {n['title']}" + (" [A-level only]" if n.get("alevelOnly") else ""))
        else:
            lines.append(f"    {n['code']} {n['title']}: {clip(n['text'], 3000)}")
    open(os.path.join(TAG, "chemistry-topics.txt"), "w").write("\n".join(lines).strip() + "\n")
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                at = p["text"].find(p["own"][:40])
                setup = p["text"][:at] if at > 0 else ""  # the question's stem and its part's opening words
                f.write(json.dumps({"id": p["id"], "unit": UNIT[p["component"]], "label": p["label"], "setup": clip(setup, 220),
                                    "question": clip(p["own"], 420), "scheme": clip(p.get("msText", ""), 220)}, ensure_ascii=False) + "\n")
    print(f"{n} batches in {TAG}", file=sys.stderr)


def merge():
    valid = {t["code"] for t in topics() if t["level"] == 2}
    tags, off, missing = {}, {}, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        ids = [json.loads(line)["id"] for line in open(path)]
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for pid in ids:
            ans = got.get(pid, [])
            if ans and ans[0] == "off":
                off[pid] = ans[1] if len(ans) > 1 else ""
                continue
            codes = [c for c in ans if c in valid][:2]
            if codes:
                tags[pid] = codes
            else:
                missing.append(pid)
    overrides = os.path.join(TAG, "overrides.json")
    if os.path.exists(overrides):
        for pid, ans in json.load(open(overrides)).items():
            if ans and ans[0] == "off":
                tags.pop(pid, None)
                off[pid] = ans[1] if len(ans) > 1 else ""
            else:
                off.pop(pid, None)
                tags[pid] = ans
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    json.dump(off, open(os.path.join(WORK, "off.json"), "w"), indent=0, ensure_ascii=False)
    print(f"{len(tags)} parts tagged, {len(off)} off the current spec, {len(missing)} without an answer {missing[:10]}", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
