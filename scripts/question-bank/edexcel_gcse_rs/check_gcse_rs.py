"""Check the cut Edexcel GCSE Religious Studies parts against the papers' shapes.

    python3 scripts/question-bank/edexcel_gcse_rs/check_gcse_rs.py [work-dir]

Every question should run (a) 3, (b) 4, (c) 5, (d) 12 or 15 marks, and a paper add up to its printed total (102 for
1RA0 Paper 1 and all of 1RB0, 51 for 1RA0 Papers 2 to 4). Each part's scheme should open on its own label and stop
before the next part's; each (d)'s should hold its indicative content and its levels grid, and SPaG's where the
part has 15 marks. Each question's heading in the paper ("Question 3: Living the Jewish Life") should agree with the
section spec.json gives it. Prints what fails.
"""
import json, os, re, sys

import pymupdf
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-rs")


def norm(s):
    return re.sub(r"[^a-z]", "", s.lower().replace("the", ""))


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))
    titles = {s["code"]: s["title"].lower() for s in tree["sections"]}
    manifest = {f"{f['component'].replace('-', '')}-{f['series']}": f for f in json.load(open(os.path.join(WORK, "manifest.json"))) if f["kind"] == "qp"}
    sets, bad = {}, 0
    for p in parts:
        sets.setdefault(p["set"], []).append(p)
    heads = set()
    for set_id, ps in sorted(sets.items()):
        problems = []
        comp = ps[0]["component"]
        total = sum(p["marks"] or 0 for p in ps)
        want = 51 if comp.startswith("1ra0") and comp[4] in "234" else 102
        if total != want:
            problems.append(f"marks {total} (want {want}): " + ",".join(f"{p['label']}={p['marks']}" for p in ps))
        want_labels = [f"{q}({x})" for q in range(1, 5 if want == 102 else 3) for x in "abcd"]
        if [p["label"] for p in ps] != want_labels:
            problems.append("labels " + ",".join(p["label"] for p in ps))
        for p in ps:
            marks = {"a": [3], "b": [4], "c": [5], "d": [12, 15]}.get(p["part"] or "", [])
            if p["marks"] not in marks:
                problems.append(f"{p['label']} marks {p['marks']}")
            if not p.get("ms"):
                problems.append(f"{p['label']} has no scheme crop")
                continue
            text = p.get("msText", "")
            flat = re.sub(r"\s+", "", text[:120])
            if re.sub(r"[()]", "", p["label"]) not in re.sub(r"[()]", "", flat):
                problems.append(f"{p['label']} scheme opens {text[:50]!r}")
            h = Image.open(os.path.join(WORK, "img", p["ms"])).height
            if p["part"] == "d" and h < 1500:
                problems.append(f"{p['label']} scheme only {h}px")
            if p["part"] != "d" and (h > 1500 or re.search(r"\bLevel 1\b", text)):
                problems.append(f"{p['label']} scheme {h}px, looks overlong")
            if not p.get("er"):
                problems.append(f"{p['label']} no report")
        # the question headings
        doc = pymupdf.open(os.path.join(WORK, "pdf", manifest[f"{comp}-{ps[0]['series']}"]["file"]))
        for i in range(1, len(doc)):
            for m in re.finditer(r"^\s*(?:Question|Section) (\d): (.+)$", doc[i].get_text(), re.M):
                q, name = int(m.group(1)), m.group(2).strip().lower()
                heads.add((comp[:6], q, name))
        if problems:
            bad += 1
            problems.sort(key=lambda t: t.endswith("no report"))
            print(f"{set_id}: " + "; ".join(problems[:8]))
    print(f"{len(sets)} papers, {len(parts)} parts; {bad} with something to look at", file=sys.stderr)
    for comp, q, name in sorted(heads):
        sec = tree["map"][comp][q - 1]
        print(f"{comp} Q{q} {name!r} -> {sec} {titles[sec]!r}")


if __name__ == "__main__":
    main()
