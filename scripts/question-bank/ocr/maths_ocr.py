"""The OCR A and OCR MEI Maths and Further Maths banks: tag batches, merge, build.

    python3 scripts/question-bank/ocr/maths_ocr.py split [work-dir]   # default .work/ocr-maths
    python3 scripts/question-bank/ocr/maths_ocr.py merge [work-dir]
    python3 scripts/question-bank/ocr/maths_ocr.py build [work-dir]

The papers are gathered by fetch_ocr.py --maths and cut a whole question at a time by
edexcel_sciences/cut_pearson.py --whole (in maths a later part builds on an earlier
one, as the Edexcel maths bank has it). A-Level Maths content is the same for every
board, so the topics are the Edexcel maths bank's (edexcel_topics.json): Pure 1-10,
Statistics, Mechanics, and for Further Maths, Core Pure and the option areas, with
"Decision" renamed for OCR's Discrete Mathematics and Modelling with Algorithms.

build writes, per bank, the same files as build_ocr.py; its whole papers are the past
paper library's copies (manifest `r2`).
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
mode = sys.argv[1] if len(sys.argv) > 1 else "build"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "ocr-maths")
TAG = os.path.join(WORK, "tag")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, slug  # noqa: E402
from tag_pearson import clip  # noqa: E402
sys.path.insert(0, HERE)
from build_ocr import ocr_report  # noqa: E402

BANKS = {  # slug: (board, subject, topic list)
    "ocr-a-level-maths": ("OCR", "Maths", "maths"),
    "ocr-a-level-further-maths": ("OCR", "Further Maths", "further"),
    "ocr-mei-a-level-maths": ("OCR MEI", "Maths", "maths"),
    "ocr-mei-a-level-further-maths": ("OCR MEI", "Further Maths", "further"),
}
SECTION_TITLES = {"D": "Discrete maths and algorithms"}
# OCR's Further Maths options cover a few things Edexcel's don't (the taggers found no
# code for them): added after the area's own topics.
OCR_EXTRA = [
    {"code": "FM.8", "title": "Dimensional analysis", "section": "FM", "text": "dimensions of quantities, checking formulae, finding indices in a model"},
    {"code": "FM.9", "title": "Projectiles", "section": "FM", "text": "projectile motion, including on inclined planes"},
    {"code": "FM.10", "title": "Statics and friction", "section": "FM", "text": "equilibrium of particles and rigid bodies, friction, ladders, beams, moments"},
    {"code": "FS.8", "title": "Non-parametric tests", "section": "FS", "text": "Wilcoxon signed-rank and rank-sum tests, sign test"},
    {"code": "FP.10", "title": "Multivariable calculus", "section": "FP", "text": "surfaces, sections and contours, partial derivatives, stationary points of surfaces, tangent planes"},
    {"code": "FP.11", "title": "Vector product", "section": "FP", "text": "vector (cross) product, areas and volumes, shortest distance using the vector product"},
    {"code": "D.7", "title": "Counting and combinatorics", "section": "D", "text": "permutations and combinations, pigeonhole principle, inclusion-exclusion, derangements, partitions"},
]
MECHANICS = r"y(?:543|533|421|431|411|415)"  # OCR A Mechanics; MEI Mechanics Major, Minor, A, B
STATISTICS = r"y(?:542|532|422|432|412|416)"
EXTRA_PURE = r"y(?:545|535|435)"  # OCR A Additional Pure; MEI Extra Pure
DISCRETE = r"y(?:544|534|433|413)"  # OCR A Discrete; MEI Modelling with Algorithms
# Questions the taggers gave a nearest-fit code because the right one wasn't listed yet:
# (pattern in the question or scheme, papers it applies to, code to replace, new code).
RETAG = [
    (r"dimension", MECHANICS, "FM.7", "FM.8"),
    (r"projectile|projected", MECHANICS, "FM.7", "FM.9"),
    (r"friction|ladder|in (?:limiting )?equilibrium|beam|rough", MECHANICS, "FM.6", "FM.10"),
    (r"wilcoxon|rank.?sum|sign(?:ed)?.rank|sign test", STATISTICS, "FS.7", "FS.8"),
    (r"partial|surface|saddle|section|contour|∂", EXTRA_PURE, "FP.2", "FP.10"),
    (r"vector product|cross product", EXTRA_PURE, "CP.6", "FP.11"),
    (r"pigeonhole|derangement|inclusion|exclusion|partition|how many (?:different )?(?:ways|arrangements|subsets)", DISCRETE, "FP.7", "D.7"),
]
MONTH = {"JUN": "June", "NOV": "November"}
OCR_BOILER = re.compile(r"© OCR \d{4}|Turn over|\.{6,}", re.I)


def topic_lists():
    raw = json.load(open(os.path.join(HERE, "..", "edexcel_topics.json")))
    out = {}
    for key in ("maths", "further"):
        sections = [{"code": t["code"], "title": SECTION_TITLES.get(t["code"], t["title"])} for t in raw[key] if t["level"] == 1]
        topics = [{"code": t["code"], "title": t["title"], "section": t["code"].split(".")[0], "text": t["text"]} for t in raw[key] if t["level"] == 2]
        if key == "further":
            topics += OCR_EXTRA
            topics.sort(key=lambda t: ([s["code"] for s in sections].index(t["section"]), int(t["code"].split(".")[1])))
            for t in topics:
                if t["code"] == "FP.6":  # MEI's Numerical Methods papers go wider than Edexcel's option
                    t["text"] += ", rounding and errors, root-finding, numerical differentiation, interpolation"
        out[key] = {"sections": sections, "topics": topics}
    return out


def bank_of():
    """component ('h24001') -> its manifest entry's bank and AS flag."""
    return {f["component"].replace("-", ""): f for f in json.load(open(os.path.join(WORK, "manifest.json"))) if f["kind"] == "qp"}


def split(size=200):
    os.makedirs(TAG, exist_ok=True)
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    lists, banks = topic_lists(), bank_of()
    for key, tree in lists.items():
        names = {s["code"]: s["title"] for s in tree["sections"]}
        open(os.path.join(TAG, f"{key}-topics.txt"), "w").write(
            "\n".join(f"{t['code']} | {names[t['section']]} | {t['title']} — {t['text']}" for t in tree["topics"]) + "\n")
    n = 0
    for key in ("maths", "further"):
        mine = [p for p in parts if p.get("qp") and BANKS[banks[p["component"]]["bank"]][2] == key]
        for i in range(0, len(mine), size):
            n += 1
            with open(os.path.join(TAG, f"batch-{n:02d}-{key}.jsonl"), "w") as f:
                for p in mine[i:i + size]:
                    m = banks[p["component"]]
                    f.write(json.dumps({"id": p["id"], "paper": f"{'AS ' if m['as'] else ''}{m['title']}",
                                        "question": clip(OCR_BOILER.sub(" ", p["text"]), 700), "scheme": clip(p.get("msText", ""), 300)},
                                       ensure_ascii=False) + "\n")
    print(f"{n} batches in {TAG}", file=sys.stderr)


def merge():
    lists = topic_lists()
    tags, missing = {}, 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        key = re.search(r"batch-\d+-(\w+)\.jsonl$", path).group(1)
        valid = {t["code"] for t in lists[key]["topics"]}
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = [c for c in got.get(pid, []) if c in valid][:3]
            if codes:
                tags[pid] = codes
            else:
                missing += 1
    parts = {p["id"]: p for p in json.load(open(os.path.join(WORK, "parts.json")))}
    moved = 0
    for pid, codes in tags.items():
        p = parts.get(pid)
        if not p:
            continue
        words = (p["text"] + " " + p.get("msText", "")).lower()
        for pattern, papers, old, new in RETAG:
            if old in codes and re.match(papers, pid) and re.search(pattern, words):
                codes[codes.index(old)] = new
                moved += 1
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} questions tagged, {missing} without a valid topic; {moved} moved to OCR-only topics", file=sys.stderr)


def series_rank(s):
    return int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def build():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    lists, banks = topic_lists(), bank_of()
    wholes = {}
    for f in manifest:
        wholes.setdefault(f"{f['component'].replace('-', '')}-{f['series']}", {})[f["kind"]] = f["r2"]
    out_dir = os.path.join(ROOT, "src", "content", "questionBank")
    for bank, (board, subject, key) in BANKS.items():
        tree = lists[key]
        valid = {t["code"] for t in tree["topics"]}
        mine = [p for p in parts if p.get("qp") and p["h"] > 0 and banks[p["component"]]["bank"] == bank]
        rows, text, reports = [], {}, {}
        for p in mine:
            words = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", OCR_BOILER.sub(" ", p["text"]))).strip()
            own = re.sub(r"^\d{1,2}\s+", "", words)
            row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
                   "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": own[:160]}
            if p.get("ms"):
                row["ms"] = 1
            elif wholes.get(f"{p['component']}-{p['series']}", {}).get("ms"):
                row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]
            if p.get("er"):
                row["er"] = 1
                reports[p["id"]] = ocr_report(p["er"])
            rows.append(row)
            text[p["id"]] = (words + " " + re.sub(r"\s+", " ", p.get("msText", ""))).lower()
        rows.sort(key=lambda r: (-series_rank(r["s"]), banks[r["p"]]["as"], r["p"], int(r["l"])))
        counts = {}
        for r in rows:
            for c in r["t"]:
                counts[c] = counts.get(c, 0) + 1
        topics = [{"code": t["code"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]),
                   "count": counts.get(t["code"], 0), "year": 0} for t in tree["topics"]]
        comps = sorted({r["p"] for r in rows}, key=lambda c: (banks[c]["as"], c))
        papers = []
        for c in comps:
            m = banks[c]
            name = m["title"].split(":")[0].strip()
            papers.append({"id": c, "name": f"AS {name}" if m["as"] and not name.startswith("AS") else name,
                           "title": m["title"].split(":", 1)[1].strip() if ":" in m["title"] else f"{m['spec']}/{m['component'][-2:]}", "as": m["as"]})
        series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
        years = [int("20" + s[3:]) for s in series]
        meta = {
            "slug": bank, "board": board, "level": "A-Level", "subject": subject, "specs": sorted({banks[c]["spec"] for c in comps}),
            "sections": tree["sections"], "topics": topics, "papers": papers,
            "series": [{"id": s, "label": f"{MONTH[s[:3]]} 20{s[3:]}"} for s in series],
            "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
            "noCalc": True, "reportsBy": "question",
            "count": len(rows), "firstYear": min(years), "lastYear": max(years), "sample": rows[:20],
        }
        json.dump(meta, open(os.path.join(out_dir, f"{bank}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        pub = os.path.join(ROOT, "public", "question-bank", bank)
        os.makedirs(pub, exist_ok=True)
        for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
            json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"{bank}: {len(rows)} questions, {sum(1 for r in rows if r['t'])} tagged, {len(papers)} papers", file=sys.stderr)


if __name__ == "__main__":
    {"split": split, "merge": merge, "build": build}[mode]()
