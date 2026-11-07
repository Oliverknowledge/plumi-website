"""Append legacy module filters without rebuilding or recutting current questions.

Requires an independently downloaded, hash-verified baseline in <work>/baseline.
Legacy module topics deliberately do not claim current-syllabus topic mappings.
Run upload_data.py afterwards to refresh the content hashes, preserving solutions.
"""
import collections
import copy
import json
from pathlib import Path
import re
import sys

from fetch_legacy import MODULES

ROOT = Path(__file__).resolve().parents[3]
SLUG = "edexcel-a-level-maths"


def read(path):
    return json.loads(path.read_text())


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")))


def append(work):
    baseline = work / "baseline"
    meta = read(baseline / "meta.json")
    rows = read(baseline / "parts.json")
    text = read(baseline / "text.json")
    reports = read(baseline / "reports.json")
    year13 = read(baseline / "year13.json")
    original = copy.deepcopy(rows)
    existing = {row["id"] for row in rows}
    months = {"JAN": (1, "January"), "JUN": (6, "June"), "NOV": (11, "November")}
    parts = sorted(read(work / "parts.json"), key=lambda p: (-int(p["series"][3:]),
                   -months[p["series"][:3]][0], p["component"], int(p["label"])))
    manifest = read(work / "manifest.json")
    audit = read(work / "cut-audit.json")
    if any(item["error"] or not item["count"] for item in audit):
        raise ValueError("Resolve empty papers and cutter failures before building")
    totals = collections.Counter()
    for part in parts:
        totals[part["set"]] += part.get("marks") or 0
    if any(total != 75 for total in totals.values()):
        raise ValueError("Each legacy paper must account for all 75 marks")
    wholes = {}
    for record in manifest:
        wholes.setdefault(f"{record['component']}-{record['series']}", {})[record["kind"]] = f"edexcel-legacy/{record['file']}"
    for part in parts:
        # A fresh namespace also avoids crops left by older, unpublished builds.
        pid = "legacy-edx-" + part["id"]
        if pid in existing:
            raise ValueError(f"Duplicate/current question ID: {pid}")
        existing.add(pid)
        if not part.get("qp") or not part.get("w") or not part.get("h"):
            raise ValueError(f"Missing crop: {pid}")
        if part.get("marks") is None:
            raise ValueError(f"Review missing marks: {pid}")
        module = MODULES[part["spec"]]
        own = re.sub(r"^\s*" + re.escape(part["label"]) + r"\.\s*", "", part["text"])
        row = dict(id=pid, p=part["component"], s=part["series"], l=part["label"], m=part["marks"],
                   t=["L." + module], w=part["w"], h=part["h"], x=own[:160])
        if part.get("ms"):
            row["ms"] = 1
        else:
            row["msf"] = wholes[f"{part['component']}-{part['series']}"]["ms"]
        if part.get("er"):
            row["er"] = 1
            reports[pid] = part["er"]
        rows.append(row)
        text[pid] = (part["text"] + " " + part.get("msText", "")).lower()
        if module in ("C3", "C4"):
            year13.append(pid)
    assert rows[:len(original)] == original
    meta["sections"].append(dict(code="L", title="Legacy modules (2010–2018)"))
    counts = collections.Counter(topic for row in rows for topic in row["t"])
    for code, module in MODULES.items():
        title = ("Core Mathematics " if module.startswith("C") else "Statistics " if module.startswith("S") else "Mechanics ") + module[1:]
        meta["topics"].append(dict(code="L." + module, title=f"Legacy {module} — {title}", section="L",
                                   slug="legacy-" + module.lower(), count=counts["L." + module], year=0))
    components = sorted({p["component"] for p in parts})
    for component in components:
        code, _, variant = component.partition("-")
        module = MODULES[code]
        meta["papers"].append(dict(id=component, name=f"Legacy {module}" + (f" ({variant})" if variant else ""),
                                   title=f"Legacy {module} ({component}), previous specification", **{"as": module not in ("C3", "C4")}))
    series = sorted({row["s"] for row in rows}, key=lambda s: (int(s[3:]), months[s[:3]][0]), reverse=True)
    meta["series"] = [dict(id=s, label=f"{months[s[:3]][1]} 20{s[3:]}") for s in series]
    meta["specs"] = sorted(set(meta["specs"]) | set(MODULES))
    meta["wholes"].update(wholes)
    meta["count"] = len(rows)
    meta["firstYear"] = min(int("20" + s[3:]) for s in series)
    meta["note"] = "Legacy C1–C4, S1 and M1 questions use the previous specification. Find them under Legacy modules; they are not mapped to current-syllabus topics. C3/C4 are A2; C1/C2/S1/M1 are legacy AS modules."
    # Existing content hashes are retained until the upload step updates them.
    write(ROOT / "src/content/questionBank" / f"{SLUG}.json", meta)
    out = ROOT / "public/question-bank" / SLUG
    for name, data in (("parts", rows), ("text", text), ("reports", reports), ("year13", year13)):
        write(out / f"{name}.json", data)
    print(f"Preserved {len(original)} current questions; appended {len(parts)} legacy questions")


if __name__ == "__main__":
    append(Path(sys.argv[1]).resolve())
