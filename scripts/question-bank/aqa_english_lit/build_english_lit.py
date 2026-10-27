"""Write the AQA GCSE English Literature bank's data files from the cut questions.

    python3 scripts/question-bank/aqa_english_lit/build_english_lit.py [work-dir]   # default scripts/question-bank/.work/aqa-english-lit-gcse

build_economics.py for Literature: the same rows and files
(src/content/questionBank/aqa-gcse-english-literature.json and
public/question-bank/aqa-gcse-english-literature/{parts,text,reports}.json). What differs:
  - The topics are the set texts (texts.py), under the specification's sections, and
    each question's tag is the text the cutter read from its heading: no tagging pass.
  - Every question is whole ("01", "27.1"), and the reports are keyed by question id (reportsBy "question").
    The two unseen questions share a stem, the first poem.
  - The choices are marked: in each section every question after the first carries
    "or", so a paper's marks count the one question a student answers there (64 for
    Paper 1, 96 for Paper 2), as the paper's front cover says. Both unseen questions count.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
from build_bank import BOILERPLATE, series_label, series_rank  # noqa: E402
import texts  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-english-lit-gcse")
SLUG = "aqa-gcse-english-literature"
# November 2021 and June 2022 split Paper 1 into a paper per section, and set Shakespeare on Paper 2.
PAPERS = {"87021": ("Paper 1", "Shakespeare and the 19th-century novel"), "87022": ("Paper 2", "Modern texts and poetry"),
          "87021M": ("Paper 1M", "Modern prose or drama"), "87021N": ("Paper 1N", "The 19th-century novel"), "87021P": ("Paper 1P", "Poetry anthology")}
# Each paper's maximum, from its front cover; Paper 2 was 70 when it was Shakespeare and unseen poetry.
MAXIMUM = {"87021": 64, "87022": 96, "87021M": 30, "87021N": 30, "87021P": 30}


def own_words(text, label):
    """The question's own words: after the last time its label is printed (an extract question prints it twice)."""
    q, _, p = label.partition(".")
    pat = r"\s*".join(list(q)) + (r"\s*\.\s*" + r"\s*".join(list(p)) if p else "")
    found = list(re.finditer(r"(?<!\d)" + pat + r"\s+", text))
    words = text[found[-1].end():] if found else text
    return BOILERPLATE.sub(" ", re.split(r"\[\d+ marks?\]", words)[0]).strip()


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    series_cut = {p["series"] for p in parts}
    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er") and f["series"] in series_cut:
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        own = own_words(p["text"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [p["text_code"]] if p["text_code"] else [],
               "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p["or"]:
            row["or"] = 1
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        if p.get("er"):
            row["er"] = 1
            reports[p["id"]] = p["er"]
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    order = list(PAPERS)
    rows.sort(key=lambda r: (-series_rank(r["s"]), order.index(r["p"]), int(r["l"].split(".")[0]), r["l"]))
    totals = {}
    for r in rows:
        if not r.get("or"):
            totals[(r["p"], r["s"])] = totals.get((r["p"], r["s"]), 0) + (r["m"] or 0)
    off = {k: v for k, v in totals.items() if v != (70 if k[0] == "87022" and k[1] in ("NOV21", "JUN22") else MAXIMUM[k[0]])}
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    sections = [{"code": code, "title": title} for code, title, _ in texts.GCSE]
    topics = [{"code": code, "ref": "", "title": title, "section": sec, "slug": code, "count": counts.get(code, 0), "year": 0}
              for sec, _, ts in texts.GCSE for code, title, _ in ts]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = [c for c in order if any(r["p"] == c for r in rows)]
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "GCSE", "subject": "English Literature", "specs": ["8702"],
        "sections": sections, "topics": topics,
        "papers": [{"id": c, "name": PAPERS[c][0], "title": PAPERS[c][1], "as": False} for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps},
        "noCalc": True, "reportsBy": "question",
        "note": "AQA publishes its English Literature papers from November 2020 on. Each paper asks a question on every set text, so the topics here are the texts: pick the ones you studied.",
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    empty = [t["code"] for t in topics if not t["count"]]
    print(f"{SLUG}: {len(rows)} questions, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, "
          f"{sum(1 for r in rows if r.get('or'))} alternatives, papers {comps}" + (f"; marks off: {off}" if off else "; every paper's marks add up")
          + (f"; empty topics {empty}" if empty else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
