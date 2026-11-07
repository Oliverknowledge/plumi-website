#!/usr/bin/env python3
"""The board's own text layer for a bank part's mark scheme, from the whole-paper PDF the bank already stores (R2, `wholes` in the
bank's meta). Replaces the bank's lossy page OCR as the source the word check runs against.

  python3 scripts/question-bank/markpacks/pdf_text.py <slug> <parts.json> <out_ocr.json> [--cache DIR]

<parts.json> is the _parts.json extract.py writes (rows with id, p, s, l). Writes {partId: text} for the parts whose scheme text could
be located (the rows from that part's label to the next part's label); a part that cannot be located is left out, and the caller
falls back to "held". Reads the public bucket gently (one PDF per paper, cached): AGENTS.md says bulk reads go through the S3 API.
"""
import json, re, subprocess, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
BASE = re.search(r'R2_DEV_URL = "([^"]+)"', (ROOT / "src/config/papers.ts").read_text()).group(1)

def fetch(path, cache):
    out = Path(cache) / path.replace("/", "_")
    if not out.exists() or out.stat().st_size == 0:
        time.sleep(0.3)
        r = subprocess.run(["curl", "-sS", "--max-time", "120", "-o", str(out), "-w", "%{http_code}", f"{BASE}/{path}"], capture_output=True)
        if r.stdout != b"200": out.unlink(missing_ok=True); raise RuntimeError(f"{path} -> {r.stdout!r}")
    return out

def pdf_text(pdf):
    return subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True).stdout

def label_regex(label):
    """'2(a)(iv)' / '02.4' / '20(b)(i)' -> a regex that finds that label at the start of a line in the scheme's text, however the board spaces it."""
    toks = re.findall(r"\d+|[A-Za-z]+", label)
    if not toks: return None
    body = r"[\s.()\-]*".join(r"\s?".join(re.escape(c) for c in t) if t.isdigit() else re.escape(t) for t in toks)   # "09" is "0 9" in some schemes
    return re.compile(rf"^[ \t]*{body}(?=[\s(;:)]|$)", re.I | re.M)

MARGIN_SLACK = 4   # characters: labels of one scheme share a left margin, give or take pdftotext's spacing

def margin(text, pos):
    """The left margin (leading spaces) of the line that contains `pos`."""
    ls = text.rfind("\n", 0, pos + 1) + 1
    return len(text[ls:]) - len(text[ls:].lstrip(" \t"))

def at_margin(m, base):
    """Is the label match `m` (it includes its line's leading spaces) at this scheme's label margin?"""
    s = m.group()
    return len(s) - len(s.lstrip(" \t")) <= base + MARGIN_SLACK

SUB_ROW = re.compile(r"^[ \t]*(?:\d+\s*)?\([a-z]{1,2}\)(?:\s*\([ivx]+\))?[ \t]{2,}", re.M)   # OCR schemes: "(e)   For fuel OR energy ..."

def ocr_style_starts(text, label):
    """OCR prints the question number once, then rows that begin with only the sub-label. Find the sub-label row after the number."""
    m = re.match(r"^(\d+)((?:\([a-z]+\))+)$", label.replace(" ", ""))
    if not m: return []
    num, subs = m.group(1), re.findall(r"\([a-z]+\)", m.group(2))
    head = r"(?:" + r"\s*".join(re.escape(x) for x in subs[:-1]) + r"\s*)?" if len(subs) > 1 else ""   # "(a)(iii)" may print as just "(iii)"
    sub = re.compile(r"^[ \t]*" + head + re.escape(subs[-1]) + r"(?=[ \t]{2,}|$)", re.M)
    out = []
    for a in re.finditer(rf"^[ \t]*{num}(?=[ \t]+\(|[ \t]{{3,}}|$)", text, re.M):
        h = sub.search(text, a.start(), a.start() + 9000)
        if h: out.append(h.start())
    return out[:1]

def segment(text, label, other_labels):
    me = label_regex(label)
    if not me: return None
    plain = re.fullmatch(r"\d+", label.strip()) is not None
    # a bare number alone on its line is usually a page number, not the question's row
    starts = [m.start() for m in me.finditer(text) if not (plain and re.match(r"[ \t]*\d+[ \t]*(?:\n|$)", text[m.start():m.start() + 40]))] or ocr_style_starts(text, label)
    if not starts: return None
    ocr_style = not me.search(text)
    best = None
    for st in starts:
        base = margin(text, st)
        # In a tall table row pdftotext prints the label in the MIDDLE of the row, so a scheme's words can sit above the label line.
        # Start just after the previous part's label line (looser by one neighbouring row, but still local), end at the next label.
        # A neighbouring part's label only counts at (about) THIS label's left margin: OCR schemes number their mark points "1", "2", "3"
        # inside the answer cell, deeper in the line, and those are not the next question.
        prevs = []
        for o in other_labels:
            rx = label_regex(o)
            ms = [m.start() for m in rx.finditer(text, 0, st) if at_margin(m, base)] if rx else []
            if ms: prevs.append(ms[-1])
        begin = (text.find("\n", max(prevs)) + 1) if prevs else max(0, st - 1500)
        ends = []
        for o in other_labels:
            rx = label_regex(o)
            m = next((m for m in rx.finditer(text, st + 1) if at_margin(m, base)), None) if rx else None
            if m: ends.append(m.start())
        if ocr_style:
            nxt = SUB_ROW.search(text, st + 2)
            if nxt: ends.append(nxt.start())
        e = min(ends) if ends else min(len(text), st + 4000)
        seg = text[begin:min(e, begin + 7000)]
        if best is None: best = seg
    return best

def main():
    slug, parts_file, out_file = sys.argv[1:4]
    cache = Path(sys.argv[5] if len(sys.argv) > 5 and sys.argv[4] == "--cache" else "/tmp/markpack-pdfs"); cache.mkdir(parents=True, exist_ok=True)
    meta = json.loads((ROOT / "src/content/questionBank" / f"{slug}.json").read_text())
    wholes = meta.get("wholes") or {}
    parts = json.loads(Path(parts_file).read_text())
    # Every part of the same paper bounds a segment, not only the batch's parts (the bank's own rows, one small file).
    data = meta["data"]
    allrows = json.loads(subprocess.run(["curl", "-sS", "--max-time", "60", f"{BASE}/bank-data/{slug}/parts.{data['parts']}.json"], capture_output=True).stdout)
    bank_rows = {}
    for r in allrows: bank_rows.setdefault((r["p"], r["s"]), []).append(r["l"])
    out, texts = {}, {}
    for r in parts:
        key = f"{r['p']}-{r['s']}".upper()
        w = next((v for k, v in wholes.items() if k.upper() == key), None)
        if not w or not w.get("ms"): print(r["id"], "no whole-paper scheme PDF"); continue
        if key not in texts: texts[key] = pdf_text(fetch(w["ms"], cache))
        seg = segment(texts[key], r["l"], [l for l in bank_rows[(r["p"], r["s"])] if l != r["l"]])
        if seg: out[r["id"]] = seg
        else: print(r["id"], "label", r["l"], "not found in the text layer")
    Path(out_file).write_text(json.dumps(out, indent=1))
    print(f"{len(out)} of {len(parts)} parts located")

if __name__ == "__main__": main()
