"""Write the AQA GCSE French, Spanish and Bengali banks' data files from the cut parts and their tags.

    python3 scripts/question-bank/aqa_gcse_languages/build_gcse_languages.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-languages

build_gcse_business.py for languages, one bank per language: src/content/questionBank/aqa-gcse-<language>.json
and public/question-bank/aqa-gcse-<language>/{parts,text,reports}.json. What differs:
  - Papers come in two tiers, named as the GCSE science banks' are ("Paper 3 Reading Higher"), for the
    tier links and tiers.py; their ids are the component codes ("8658RH"). Paper 1 is Listening, 3
    Reading, 4 Writing; Speaking (Paper 2) isn't in the bank.
  - French and Spanish hold two specifications: the 2018 to 2025 papers (8658, 8698) and the 2026
    specimens (8652, 8692), told apart by each paper's title, its series ("2026 specimen") and the
    bank's "Specification" filter (options).
  - A question with no parts that shares the start of the one before (cut_gcse_languages.share_leads) has it
    under its own name, which its id doesn't give (the site strips a part off an id for its start): "sk".
  - A Listening part carries its recording ("au", "aqa/audio/<file>.mp3" on R2), "auw" when it is the
    whole paper's.
  - A choice of writing tasks marks its alternatives "or", and each paper's parts, a choice counted
    once, must add up to its marks less any question left out for copyright (cut_gcse_languages.py).
  - Bengali's own words in the text layer are unreadable (see the cutter), so a part that is only
    Bengali shows its question's English instructions instead, and its search text adds its topics.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
from build_bank import BOILERPLATE, own_text, series_label, series_rank, slug  # noqa: E402
from spec_gcse_languages import tree as spec_tree  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-languages")
BANKS = [("aqa-gcse-french", "French", "8658", "8652"), ("aqa-gcse-spanish", "Spanish", "8698", "8692"), ("aqa-gcse-bengali", "Bengali", "8638", None)]
SKILL = {"L": (1, "Listening"), "R": (3, "Reading"), "W": (4, "Writing")}
TIER = {"H": "Higher", "F": "Foundation"}
TOTAL = {"L": {"F": 40, "H": 50}, "R": {"F": 60, "H": 60}, "W": {"F": 50, "H": 60}}
TOTAL_NEW = {"L": {"F": 40, "H": 50}, "R": {"F": 50, "H": 50}, "W": {"F": 50, "H": 50}}
NOTE = {
    "French": ("AQA changed GCSE French for exams from summer 2026: the new specification (8652) has new themes, set vocabulary lists, "
               "a dictation in the Listening paper and shorter writing tasks. Most questions here are from the 2018 to 2025 papers (8658), still "
               "good practice for reading, listening and writing; the 2026 format is in AQA's specimen papers, marked \"2026 specimen\" "
               "(pick it with the Specification filter). "),
    "Spanish": ("AQA changed GCSE Spanish for exams from summer 2026: the new specification (8692) has new themes, set vocabulary lists, "
                "a dictation in the Listening paper and shorter writing tasks. Most questions here are from the 2018 to 2025 papers (8698), still "
                "good practice for reading, listening and writing; the 2026 format is in AQA's specimen papers, marked \"2026 specimen\" "
                "(pick it with the Specification filter). "),
    "Bengali": "",
}
COMMON = ("Listening questions play AQA's own recording. The Speaking paper is left out, as its role-plays and photo cards are "
          "marked by a teacher, and so are the few Reading questions whose texts AQA removes from its published copies for copyright.")


def paper_for(comp, new):
    n, skill = SKILL[comp[4]]
    title = "" if not new and comp[:4] == "8638" else ("2026 format" if comp[:4] == new else "2018 to 2025 format")
    return {"id": comp, "name": f"Paper {n} {skill} {TIER[comp[5]]}", "title": title, "as": False,
            **({"option": comp[:4]} if new else {})}


def paper_order(comp, new):
    """Old specification first, then Listening, Reading, Writing, Higher before Foundation (1H, 1F, 3H, 3F…)."""
    return (comp[:4] == new, "LRW".index(comp[4]), comp[5] != "H")


def english(text):
    """What is left of a Bengali paper's text once its Bengali script is gone: the English instructions and questions,
    or nothing when that is only labels, answer lines and punctuation."""
    t = re.sub(r"\[\d+ marks?\]|_{2,}|…|\.{3,}|\b\d( \d)*( \. \d+)?\b", " ", BOILERPLATE.sub(" ", text))
    t = re.sub(r"\s+([,.?!:;])", r"\1", re.sub(r"(?<!\w)[-,.?!:;'’“”\"()]+(?!\w)", " ", t))
    t = re.sub(r"\s+", " ", t).strip()
    return t if len(re.findall(r"[A-Za-z]{3,}", t)) >= 3 else ""


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    tree = spec_tree()
    valid = {t["code"] for t in tree["topics"]}
    titles = {t["code"]: t["title"] for t in tree["topics"]}
    for bank, name, old, new in BANKS:
        specs = [old] + ([new] if new else [])
        mine = [p for p in parts if p["spec"] in specs and p.get("qp") and p["h"]]
        series_cut = {(p["component"], p["series"]) for p in mine}
        wholes = {}
        for f in manifest:
            if (f["component"], f["series"]) in series_cut and f["kind"] in ("qp", "ms", "er"):
                wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
        rows, text, reports = [], {}, {}
        for p in mine:
            own = own_text(p["text"], p["label"])
            marks = re.search(r"\[\d+ marks?\]", own)
            own = re.sub(r"\s+", " ", own[:marks.end()] if marks else own).strip()
            t = [c for c in tags.get(p["id"], []) if c in valid]
            if p["spec"] == "8638" and len(re.findall(r"[A-Za-z]{3,}", re.sub(r"\[\d+ marks?\]", "", own))) < 3:
                own = english(p["text"]) or (f"A question in Bengali on {' and '.join(titles[c] for c in t[:2])}" if t else "A question in Bengali")
            row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": t,
                   "w": p["w"], "h": p["h"], "x": own[:160]}
            if p.get("or"):
                row["or"] = 1
            if p.get("stem"):
                row["st"] = 1
                if p["stem"] != f"{p['id'].rsplit('-', 1)[0]}-stem.webp":
                    row["sk"] = p["stem"][:-len("-stem.webp")]  # a question with no parts sharing the start of the one before (cut's share_leads)
            if p.get("ms"):
                row["ms"] = 1
            if p.get("msq"):
                row["msq"] = 1
            if p.get("key"):
                row["k"] = p["key"]
            if p.get("er"):
                row["er"] = 1
                reports.setdefault(f"{p['set']}-{p['question']}", p["er"])
            if p.get("audio"):
                row["au"] = f"aqa/audio/{p['audio']}"
            elif p.get("audioWhole"):
                row["au"], row["auw"] = f"aqa/audio/{p['audioWhole']}", 1
            rows.append(row)
            search = p["text"] + " " + p.get("msText", "") + (" " + " ".join(titles[c] for c in t) if p["spec"] == "8638" else "")
            text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", search).lower()).strip()
        rows.sort(key=lambda r: (-series_rank(r["s"]), paper_order(r["p"], new), [int(x) for x in r["l"].split(".")]))
        totals = {}
        for r in rows:
            if not r.get("or"):
                totals[(r["p"], r["s"])] = totals.get((r["p"], r["s"]), 0) + (r["m"] or 0)
        # Only AQA's copyright-removed copies fall short: their questions on a removed text are left out (cut_gcse_languages.py).
        cr = {(f["component"], f["series"]) for f in manifest if f["kind"] == "qp" and f["cr"]}
        off = {k: v for k, v in totals.items() if v != (TOTAL_NEW if k[0][:4] == new else TOTAL)[k[0][4]][k[0][5]]}
        short = {k: v for k, v in off.items() if k in cr and v < (TOTAL_NEW if k[0][:4] == new else TOTAL)[k[0][4]][k[0][5]]}
        off = {k: v for k, v in off.items() if k not in short}
        counts = {}
        for r in rows:
            for c in r["t"]:
                counts[c] = counts.get(c, 0) + 1
        topics = [{"code": t["code"], "ref": t["ref"], "title": t["title"], **({"short": t["short"]} if t.get("short") else {}), "section": t["section"],
                   "slug": slug(t.get("short") or t["title"]), "count": counts.get(t["code"], 0), "year": 0} for t in tree["topics"]]
        assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
        comps = sorted({r["p"] for r in rows}, key=lambda c: paper_order(c, new))
        series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
        years = [int("20" + s[3:]) for s in series if s != "SPEC"]
        meta = {
            "slug": bank, "board": "AQA", "level": "GCSE", "subject": name, "specs": specs,
            "sections": tree["sections"], "topics": topics,
            "papers": [paper_for(c, new) for c in comps],
            "series": [{"id": s, "label": "2026 specimen" if s == "SPEC" else series_label(s)} for s in series],
            "wholes": {k: v for k, v in sorted(wholes.items())},
            **({"options": {"label": "Specification", "list": [{"id": new, "name": f"From 2026 ({new})"}, {"id": old, "name": f"2018 to 2025 ({old})"}]}} if new else {}),
            "noCalc": True,
            "note": NOTE[name] + COMMON,
            "count": len(rows), "firstYear": min(years), "lastYear": max(years),
            "sample": rows[:20],
        }
        json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{bank}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        pub = os.path.join(ROOT, "public", "question-bank", bank)
        os.makedirs(pub, exist_ok=True)
        for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
            json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"{bank}: {len(rows)} parts in {len(totals)} papers, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, "
              f"{sum(1 for r in rows if r.get('ms'))} scheme crops ({sum(1 for r in rows if r.get('msq'))} whole-question), "
              f"{sum(1 for r in rows if r.get('au'))} with audio ({sum(1 for r in rows if r.get('auw'))} whole recordings), "
              f"{sum(1 for r in rows if not r.get('ms') and not r.get('k'))} without a scheme"
              + (f"; marks off: {off}" if off else "; every paper's marks add up") + (f" (less the left-out questions on {len(short)} copyright-removed papers)" if short else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
