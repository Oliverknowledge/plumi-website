"""Append reviewed 2008–2009 archive parts to the existing science banks.

    python3 scripts/question-bank/aqa_2008/build_archive.py [work-dir]

Never rebuilds existing rows or crops. Read existing data from R2 first, then
append the separately prepared Physics 2009 import before running this script.
Topic decisions and off-spec reasons are in decisions.json beside this file.
"""
from collections import Counter
import json
from pathlib import Path
import re
import sys

import pymupdf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORK = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else HERE.parent / ".work/archive-2008"
CATALOGUE = {
    "PA01": ("Particles, radiation and quantum phenomena", True),
    "PA02": ("Mechanics and molecular kinetic theory", True),
    "PHA3W": ("Current electricity and elastic properties of solids", True),
    "PA04A": ("Waves, fields and nuclear energy — objective test", False),
    "PA04B": ("Waves, fields and nuclear energy — written section", False),
    "PHA5CORE": ("Nuclear instability — shared core", False),
    "PHA5W": ("Astrophysics option", False),
    "PHA6W": ("Medical physics option", False),
    "PHA7W": ("Applied physics option", False),
    "PHA8W": ("Turning points option", False),
    "PHA9W": ("Electronics option", False),
    "PA10": ("Synoptic unit", False),
    "CHM1": ("Atomic structure, bonding and periodicity", True),
    "CHM2": ("Foundation physical and inorganic chemistry", True),
    "CHM3W": ("Introduction to organic chemistry", True),
    "CHM4": ("Further physical and organic chemistry", False),
    "CHM5": ("Thermodynamics and further inorganic chemistry", False),
    "CHM6W": ("Synoptic assessment — objective test", False),
}
MONTHS = {"JAN": "January", "JUN": "June", "NOV": "November"}
CALC = re.compile(r"calculate|show that|show your working|determine the value", re.I)
BOILER = re.compile(r"\.{4,}|_{4,}|Question \d+ continues[^.]*?(?:page|\d\d?)|END\s+OF\s+QUESTIONS|Quality of Written Communication", re.I)


def clean(text):
    return re.sub(r"\s+", " ", BOILER.sub(" ", text)).strip()


def rank(series):
    return 0 if series == "SPEC" else int(series[3:]) * 100 + {"JAN": 1, "JUN": 6, "NOV": 11}[series[:3]]


def reports(manifest):
    out = {}
    for entry in manifest:
        if entry["kind"] != "er":
            continue
        doc = pymupdf.open(WORK / "pdf" / entry["file"])
        lines = []
        for page in doc:
            # Keep the question commentary, dropping running page furniture.
            for line in page.get_text().splitlines():
                if re.search(r"AQA GCE|Report on the Examination|^\s*\d+\s*$", line):
                    continue
                lines.append(line)
        text = "\n".join(lines)
        matches = list(re.finditer(r"^\s*Question\s+(\d+)\s*$", text, re.M))
        for n, match in enumerate(matches):
            body = text[match.end():matches[n + 1].start() if n + 1 < len(matches) else len(text)]
            body = re.split(r"Grade [Bb]oundar|Mark [Rr]ange|UMS conversion", body)[0]
            key = f"{entry['component']}-{entry['series']}-{int(match[1])}".lower()
            out[key] = re.sub(r"\s+", " ", body).strip()
    return out


def main():
    parts = json.loads((WORK / "parts.json").read_text())
    manifest = json.loads((WORK / "manifest.json").read_text())
    decisions = json.loads((HERE / "decisions.json").read_text())
    tags, off = decisions["tags"], decisions["off"]
    missing = {p["id"] for p in parts} - tags.keys() - off.keys()
    if missing:
        sys.exit(f"Missing tagging decisions: {sorted(missing)}")
    report_text = reports(manifest)
    file_map = {(f["component"], f["series"], f["kind"]): f"aqa/{f['file']}" for f in manifest}
    summary = []
    for subject in ("Physics", "Chemistry"):
        slug = "aqa-a-level-" + subject.lower()
        path = ROOT / "src/content/questionBank" / f"{slug}.json"
        pub = ROOT / "public/question-bank" / slug
        meta = json.loads(path.read_text())
        rows = json.loads((pub / "parts.json").read_text())
        text = json.loads((pub / "text.json").read_text())
        existing = {p["id"]: p for p in rows}
        valid = {t["code"] for t in meta["topics"]}
        added, counts = [], Counter()
        for part in parts:
            if part["subject"] != subject:
                continue
            pid, comp, series = part["id"], part["component"], part["series"]
            counts[f"{comp}-{series}:cut"] += 1
            if pid in off:
                counts[f"{comp}-{series}:off"] += 1
                continue
            codes = tags[pid]
            if not codes or set(codes) - valid or not part["marks"] or not part["qp"]:
                sys.exit(f"Invalid incoming part: {pid}")
            # Every option repeats the same Nuclear Instability question.
            # Keep it once in a separately filterable shared-core paper.
            if comp in {"PHA5W", "PHA6W", "PHA7W", "PHA8W", "PHA9W"} and part["question"] == "1":
                if comp != "PHA5W":
                    counts[f"{comp}-{series}:duplicate-core"] += 1
                    continue
                comp = "PHA5CORE"
            row = {"id": pid, "p": comp, "s": series, "l": part["label"], "m": part["marks"], "t": codes,
                   "w": part["w"], "h": part["h"], "x": clean(part["ownText"])[:160]}
            if part.get("stem"):
                row.update(st=1, sk=part["stemKey"])
            if part.get("key"):
                row["k"] = part["key"]
            elif part.get("ms"):
                row.update(ms=1, msq=1)
            else:
                source_comp = "PA04" if comp in ("PA04A", "PA04B") else part["component"]
                row["msf"] = file_map[(source_comp, series, "ms")]
            if CALC.search(part["ownText"]):
                row["calc"] = 1
            report_key = f"{part['component']}-{series}-{part['question']}".lower()
            if report_key in report_text:
                row["er"] = 1
            search = clean(part["text"] + " " + part["msText"]).lower()
            if pid in existing:
                if row != existing[pid] or text[pid] != search:
                    sys.exit(f"{pid}: refusing to change an existing part")
                continue
            added.append(row)
            text[pid] = search
            counts[f"{comp}-{series}:added"] += 1
        added.sort(key=lambda p: (-rank(p["s"]), p["p"], int(re.match(r"\d+", p["l"])[0]), p["id"]))
        rows += added
        # Reports for the separately imported PHYA1/PHYA2 2009 sets.
        for row in rows:
            key = "-".join(row["id"].split("-")[:3])
            if key in report_text:
                row["er"] = 1
        codes = Counter(c for p in rows for c in p["t"])
        for topic in meta["topics"]:
            topic["count"] = codes[topic["code"]]
        used = {p["p"] for p in rows}
        known = {p["id"] for p in meta["papers"]}
        for comp, (title, as_level) in CATALOGUE.items():
            if comp in used and comp not in known:
                meta["papers"].append({"id": comp, "name": f"{comp} (2008 spec)", "title": title, "as": as_level})
        for row in rows:
            comp, series = row["p"], row["s"]
            if comp not in CATALOGUE and not (comp in {"PHYA1", "PHYA2", "CHEM1", "CHEM2"} and series.endswith("09")):
                continue
            source = "PA04" if comp == "PA04A" else "PHA5W" if comp == "PHA5CORE" else comp
            if comp == "PA04B" and (comp, series, "qp") not in file_map:
                source = "PA04"
            whole = meta["wholes"].setdefault(f"{comp}-{series}", {})
            for kind in ("qp", "ms", "er"):
                key = (source, series, kind)
                if key not in file_map and comp == "PA04B" and kind == "ms":
                    key = ("PA04", series, kind)
                if key in file_map:
                    whole[kind] = file_map[key]
        series = sorted({p["s"] for p in rows}, key=rank, reverse=True)
        meta["series"] = [{"id": s, "label": "Specimen" if s == "SPEC" else f"{MONTHS[s[:3]]} 20{s[3:]}"} for s in series]
        meta["firstYear"], meta["count"] = min(2000 + int(s[3:]) for s in series if s != "SPEC"), len(rows)
        meta["specs"] = list(dict.fromkeys(meta["specs"] + (["5451", "6451"] if subject == "Physics" else ["5421", "6421", "2420"])))
        meta["note"] = ("Questions from 2008 to 2016 include AQA's earlier specifications, labelled by their original units and sorted into today's topics. "
                        "Content no longer on the current specification is left out. Prompts with a shared mark award stay together; some answers show the whole question's scheme.")
        old_reports = json.loads((pub / "reports.json").read_text())
        old_reports.update({k: v for k, v in report_text.items() if k.startswith(("phya",) if subject == "Physics" else ("chem",))})
        (pub / "reports.json").write_text(json.dumps(old_reports, ensure_ascii=False, separators=(",", ":")))
        # Classification follows the current syllabus, including thermal
        # physics that was AS in the old specification but is Year 13 today.
        year13 = set(json.loads((pub / "year13.json").read_text()))
        def advanced(code):
            fields = list(map(int, code.split(".")))
            return fields[1] >= 6 if subject == "Physics" else (fields[1] == 1 and fields[2] >= 8 or fields[1] == 2 and fields[2] >= 4 or fields[1] == 3 and fields[2] >= 7)
        year13.update(p["id"] for p in added if any(advanced(c) for c in p["t"]))
        (pub / "year13.json").write_text(json.dumps(sorted(year13), separators=(",", ":")))
        practicals = set(json.loads((pub / "practicals.json").read_text()))
        practicals.update(pid for pid in decisions.get("practicals", []) if pid in {p["id"] for p in rows})
        (pub / "practicals.json").write_text(json.dumps(sorted(practicals), separators=(",", ":")))
        (pub / "parts.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
        (pub / "text.json").write_text(json.dumps(text, ensure_ascii=False, separators=(",", ":")))
        path.write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
        summary.append({"subject": subject, "added": len(added), "total": len(rows), "sets": dict(counts)})
        print(subject, len(added), "added;", len(rows), "total")
    (WORK / "build-summary.json").write_text(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
