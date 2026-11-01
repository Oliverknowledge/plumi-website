"""Read Pearson Edexcel's GCSE (9–1) Combined Science (1SC0) specification into a topic tree.

    python3 scripts/question-bank/edexcel_combined/spec_combined.py [work-dir]   # default scripts/question-bank/.work/edexcel-combined

1SC0's content is the separate sciences' (1BI0, 1CH0, 1PH0) less the statements for those
sciences alone, numbered as theirs: Biology Topics 1–9, Chemistry 1–4 and 6–8, Physics 1–6,
8–10 and 12–15. So the sub-topics are spec_gcse.py's GROUPS, each kept to the statements
1SC0 prints, and a group left with none is dropped. Codes carry the science, as the three
share topic numbers: sections "B1", "C3", "P10"; sub-topics "B1.1", "C3.2", each with the
separate science's code for the same group (`separate`, "1.1"). A group whose
title named what only the separate science covers is renamed (TITLES).

Writes <work-dir>/spec.json as {"1SC0": {"sections": [...], "topics": [...]}}, spec_gcse.py's shape.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-combined")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_gcse"))
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from spec_gcse import BASE, GROUPS  # noqa: E402
from spec_pearson import clean, sentence_case  # noqa: E402

URL = BASE + "gcse-combinedscience-spec.pdf"
SCIENCES = [("B", "1BI0", "Key concepts in biology"), ("C", "1CH0", "Key concepts in chemistry"), ("P", "1PH0", "Key concepts of physics")]
# Groups whose separate-science title names statements 1SC0 leaves out.
TITLES = {
    "1BI0": {"Selective breeding and tissue culture": "Selective breeding", "Homeostasis and thermoregulation": "Homeostasis"},
    "1PH0": {"Generators, dynamos and microphones": "Induced potential difference"},
}


def sciences(path):
    """{"B": Biology's content, ...}: each science's Topic 1 to the next science (or the appendices)."""
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    starts = [[m.start() for m in re.finditer(rf"^\s*(?:Topic )?1 [–-]? ?{title}\s*$", text, re.M)][-1] for _, _, title in SCIENCES]
    end = text.find("Appendix 1", starts[-1])
    bounds = starts + [end if end > 0 else len(text)]
    return {s: text[bounds[i]:bounds[i + 1]] for i, (s, _, _) in enumerate(SCIENCES)}


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    path = os.path.join(WORK, "spec", os.path.basename(URL))
    if not os.path.exists(path):
        with urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"}), timeout=60) as r:
            open(path, "wb").write(r.read())
    sections, topics = [], []
    for letter, code, _ in SCIENCES:
        body = sciences(path)[letter]
        titles = {}
        for m in re.finditer(r"^\s*(?:Topic )?(\d+) [–-] ?([^\n]+)", body, re.M):
            titles.setdefault(int(m.group(1)), re.sub(r"\s+", " ", m.group(2)).strip().rstrip("."))
        found = re.split(r"^\s*(\d{1,2})\.(\d{1,2})\b", body, flags=re.M)
        statements = {}
        for k in range(1, len(found) - 2, 3):
            key = (int(found[k]), int(found[k + 1]))
            if not re.match(r"\s*[A-Z]", found[k + 2]):
                continue  # not a statement: "6.43, 6.44, 6.45 and 6.46 are in the GCSE in Physics only"
            statements[key] = statements.get(key, "") + " " + found[k + 2]
        count, covered, used, sep = {}, set(), set(), {}
        for n, title, ranges in GROUPS[code]:
            sep[n] = sep.get(n, 0) + 1
            keys = [(n, i) for a, b in ranges for i in range(a, b + 1) if (n, i) in statements]
            covered.update((n, i) for a, b in ranges for i in range(a, b + 1))
            if not keys:
                continue  # for the separate science alone
            used.add(n)
            count[n] = count.get(n, 0) + 1
            runs, nums = [], [i for _, i in keys]
            for i in nums:
                if runs and i == runs[-1][1] + 1:
                    runs[-1][1] = i
                else:
                    runs.append([i, i])
            points = ", ".join(f"{n}.{a}–{n}.{b}" if a != b else f"{n}.{a}" for a, b in runs)
            topics.append({"code": f"{letter}{n}.{count[n]}", "ref": "", "title": TITLES.get(code, {}).get(title, title), "section": f"{letter}{n}",
                           "points": points, "year": 0, "separate": f"{n}.{sep[n]}", "text": clean(" ".join(statements[k] for k in keys))})
        missed = sorted(k for k in statements if k not in covered and k[0] in titles)
        for n in sorted(used):
            t = sentence_case(titles[n]).replace("earth science", "Earth science")
            sections.append({"code": f"{letter}{n}", "title": f"Topic {letter}{n}: {t}", "short": t, "year": 0})
        print(f"{code[1:3]}: {len(used)} topics, {sum(1 for t in topics if t['code'][0] == letter)} sub-topics"
              + (f"; statements in no group: {missed}" if missed else ""), file=sys.stderr)
    empty = [t["code"] for t in topics if len(t["text"]) < 40]
    if empty:
        print(f"no text for {empty}", file=sys.stderr)
    json.dump({"1SC0": {"sections": sections, "topics": topics}}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
