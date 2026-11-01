"""Write the AQA GCSE History bank's data files from the cut questions and their tags.

    python3 scripts/question-bank/aqa_gcse_history/build_gcse_history.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-history

build_gcse_geography.py for History, with eduqas_gcse/build_eduqas_gcse.py's options: the same rows and
files (src/content/questionBank/aqa-gcse-history.json and public/question-bank/aqa-gcse-history/
{parts,text,reports}.json). What differs:
  - Every option is a paper of its own ("81451AB", Paper 1A/B, Germany) and a section of the topic
    tree, and the bank's `options` filter ("Option") keeps one option's paper and topics. A
    student's four options together are their four papers under Paper.
  - A question's sources or interpretations are its stem (`st`), shown above it; the insert is
    the paper's "ins" in `wholes`.
  - Essays: no calculations (noCalc). Reports are by question.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-history")
SLUG = "aqa-gcse-history"


def own_text(p):
    """The question's own words, from its label ("0 4") to its marks."""
    m = re.search(r"0\s*" + p["question"][1] + r"\s+(.*)", p["text"])
    words = BOILERPLATE.sub(" ", m.group(1) if m else p["text"])
    marks = re.search(r"\[\d+ marks?\]", words)
    return re.sub(r"\s+", " ", words[:marks.start()] if marks else words).strip()


def paper_name(comp):
    """"81451AB" -> "Paper 1A/B"."""
    return f"Paper {comp[4]}{comp[5]}/{comp[6]}"


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    sections = {s["code"]: s for s in tree["sections"]}

    series_cut = {p["series"] for p in parts}
    wholes = {}
    for f in manifest:
        if f["series"] not in series_cut:
            continue
        if f["kind"] == "er" and len(f["component"]) == 6:  # a section's report is each of its options'
            for c in {p["component"] for p in parts if p["component"].startswith(f["component"])}:
                wholes.setdefault(f"{c}-{f['series']}", {})["er"] = f"aqa/{f['file']}"
        else:
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        words = own_text(p)
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [c for c in tags.get(p["id"], []) if c in valid],
               "w": p["w"], "h": p["h"], "x": words[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", p["er"])
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", " ".join([p.get("stemText", ""), p["text"], p.get("msText", "")])).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], int(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    # A title more than one option has ("The historic environment", "Outbreak of war") names its option: "The historic
    # environment (Elizabethan England)"
    seen = {}
    for t in tree["topics"]:
        seen[t["title"].lower()] = seen.get(t["title"].lower(), 0) + 1
    topics, used = [], set()
    for t in tree["topics"]:
        title = t["title"] if seen[t["title"].lower()] == 1 else f"{t['title']} ({re.split(r',| c\d| \d', sections[t['section']]['title'].replace('Britain: ', ''))[0].split(':')[0]})"
        s = slug(title)
        assert s not in used and len(s) < 70, s
        used.add(s)
        topics.append({"code": t["code"], "ref": "", "title": title, "section": t["section"], "slug": s, "count": counts.get(t["code"], 0), "year": 0})
    comps = sorted({r["p"] for r in rows})
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "GCSE", "subject": "History", "specs": ["8145"],
        "sections": [{"code": s["code"], "title": s["title"], "option": s["option"]} for s in tree["sections"]],
        "topics": topics,
        "papers": [{"id": c, "name": paper_name(c), "title": sections[c[4:]]["title"], "as": False, "option": sections[c[4:]]["option"]} for c in comps],
        "options": {"label": "Option", "list": [{"id": s["option"], "name": f"{s['code'][:2]}/{s['code'][2]} {s['title']}"} for s in tree["sections"]]},
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps},
        "noCalc": True,
        "note": "Every option of Papers 1 and 2. Pick an option to see its questions and topics, or your four options under Paper "
                "to see them together; a question's sources or interpretations are shown above it.",
        "count": len(rows), "firstYear": min(years), "lastYear": max(years), "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} questions, {sum(1 for r in rows if r['t'])} tagged, {sum(1 for r in rows if r.get('st'))} with sources, "
          f"{sum(1 for r in rows if r.get('ms'))} scheme crops, {sum(1 for r in rows if r.get('er'))} with report comments ({len(reports)}), "
          f"{len(comps)} papers, {len(topics)} topics, series {series}", file=sys.stderr)


if __name__ == "__main__":
    main()
