"""Cut Eduqas's AS and A Level Religious Studies papers into parts, each with its mark scheme and examiner's comments.

    python3 scripts/question-bank/eduqas_rs/cut_eduqas_rs.py [work-dir] [--only=a120ua0-jun24]
    # work-dir: .work/eduqas-rs (fetch_eduqas_rs.py); needs: pip install pymupdf pillow

Every paper, every year since 2017, is set the same way, so this is self-contained (the
shared cutters are untouched): two or three pages, five essay questions, a choice of one of
questions 1-2 (Section A, "Either, … Or,") and one of 3-5 (Section B), each in two parts:
  - (a), knowledge and understanding (AO1: 20 marks at A Level, 25 at AS), and
  - (b), a quotation to evaluate (AO2: 30 marks at A Level, 25 at AS).
A question's number is "1." (to 2019) or two boxes, "0" "1" (from 2020); its parts "(a)" or
"a)"; each part ends with its marks, "[20]". A part runs from its label to the next label,
"Either,"/"Or,", the next section or END OF PAPER; part (a) starts at its question's number.

The mark scheme opens with the generic band descriptors, a page for each assessment objective
("Assessment Objective AO1 – Part (a) questions 20 marks"), then each part's indicative content,
headed "1. (a)" or "0 1 (a)" and, for (b), sometimes just "(b)". A part's scheme crop is its
indicative content and, under it, its objective's band descriptors: the levels it is marked on.

The examiner's report is one per level and series, a section per component ("COMPONENT 1A: A
STUDY OF CHRISTIANITY", "Component 1: Option B - An Introduction to Islam", "COMPONENT 2: …"),
its comments headed "Q.1", "1." or "Q1a". Some years list what each question tested first
("Q1 - Theme 1b: Jesus – his resurrection"): those are kept as hints for tagging (a part's "hint"),
and the comments are the run of headings with the most to say.

Writes <work-dir>/img/<id>-qp.webp and -ms.webp, <work-dir>/parts.json in cut_pearson.py's shape
(a part's "hint" is its report's theme). Ids are <component>-<series>-<question>-<part>: "a120ua0-jun24-03-b".
"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

import pymupdf
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "eduqas-rs")
IMG = os.path.join(WORK, "img")
SCALE = 2.2  # ~160 dpi, as the other cutters
STOP = re.compile(r"^(Either,?|Or,?|Section [AB]|END OF PAPER|Answer one question)\b")
PART = re.compile(r"^\(?([ab])\)(?:\s|$)")
MARKS = re.compile(r"\[(\d{1,2})\]")


def lines(page, clip=None):
    """[{text, x0, y0, y1, bold}] in reading order, top to bottom."""
    out = []
    for b in page.get_text("dict", clip=clip)["blocks"]:
        for l in b.get("lines", []):
            text = "".join(s["text"] for s in l["spans"]).strip()
            if text:
                out.append({"text": text, "x0": l["bbox"][0], "y0": l["bbox"][1], "y1": l["bbox"][3],
                            "bold": "Bold" in l["spans"][0]["font"]})
    return sorted(out, key=lambda l: (round(l["y0"]), l["x0"]))


def crop(doc, pg, rect):
    pix = doc[pg].get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), clip=rect)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def trim(img, keep=24, sides=False):
    if img is None:
        return None
    box = ImageChops.difference(img, Image.new("RGB", img.size, (255, 255, 255))).convert("L").point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box:
        return None
    if sides:
        return img.crop((max(0, box[0] - 10), max(0, box[1] - 8), min(img.width, box[2] + 10), min(img.height, box[3] + keep)))
    return img.crop((0, 0, img.width, min(img.height, box[3] + keep)))


def stack(images, gap=12):
    images = [i for i in images if i is not None]
    if not images:
        return None
    out = Image.new("RGB", (max(i.width for i in images), sum(i.height for i in images) + gap * (len(images) - 1)), (255, 255, 255))
    y = 0
    for i in images:
        out.paste(i, (0, y))
        y += i.height + gap
    return out


def save(img, name):
    if img is None:
        return None
    if img.height > 16000:
        img = img.resize((round(img.width * 16000 / img.height), 16000))
    img.save(os.path.join(IMG, name), "WEBP", quality=72, method=4)
    return name


def body(page, top=70):
    """The page's text area: below the page number, above the "© WJEC CBAC Ltd." footer and the page number under it."""
    foot = [l["y0"] for l in lines(page) if l["y0"] > page.rect.height - 90 and (l["text"].startswith("©") or re.fullmatch(r"\d{1,2}|\(?[AB]120U\w+-\d\)?|\S*\([AB]120U\w+-\d\)", l["text"]))]
    return top, min(foot + [page.rect.height - 40]) - 3


def pieces(doc, start, end, top=70):
    """[(page, rect)] from (page, y) to (page, y), across page breaks, inside each page's text area."""
    out = []
    for pg in range(start[0], end[0] + 1):
        page = doc[pg]
        t, b = body(page, top)
        y0 = start[1] if pg == start[0] else t
        y1 = end[1] if pg == end[0] else b
        y1 = min(y1, b)
        # (a stretch with no words, the top of a page before the next question's heading, is left out)
        if y1 > y0 + 6 and page.get_text("text", clip=pymupdf.Rect(40, y0, page.rect.width - 40, y1)).strip():
            out.append((pg, pymupdf.Rect(40, y0, page.rect.width - 40, y1)))
    return out


def text_of(doc, ps):
    return re.sub(r"\s+", " ", " ".join(doc[pg].get_text("text", clip=r) for pg, r in ps)).strip()


# ---------- question paper ----------

def qp_labels(doc):
    """[(page, y, q, letter)] for each part, and the stops ("Or,", "Section B", END OF PAPER) between them."""
    labels, stops, q = [], [], 0
    for pg in range(1, len(doc)):
        ls = lines(doc[pg])
        # A row read left to right: a part's "a)" can sit a few points above its question's boxed number.
        row = {id(l): min(o["y0"] for o in ls if abs(o["y0"] - l["y0"]) < 6) for l in ls}
        ls.sort(key=lambda l: (round(row[id(l)]), l["x0"]))
        for k, l in enumerate(ls):
            if l["y0"] < 70:
                continue
            if STOP.match(l["text"]) and l["x0"] < 300:
                stops.append((pg, l["y0"]))
                if l["text"].startswith("END OF PAPER"):
                    return labels, stops
                continue
            # The question's number, "3." or in boxes, "0" then "3" (a line of its own or the start of one).
            m = re.match(r"^(\d)\.(?:\s|$)", l["text"]) if l["x0"] < 75 else None
            if not m and l["x0"] < 75 and l["text"] == "0":
                nxt = next((o for o in ls if o is not l and abs(o["y0"] - l["y0"]) < 3 and re.fullmatch(r"\d", o["text"]) and 15 < o["x0"] - l["x0"] < 40), None)
                m = re.match(r"(\d)", nxt["text"]) if nxt else None
            if not m and l["x0"] < 75:
                m = re.match(r"^0\s?(\d)(?:\s|$)", l["text"])
            if m and int(m.group(1)) == q + 1:
                q = int(m.group(1))
                labels.append((pg, l["y0"], q, None))
                continue
            m = PART.match(l["text"]) if q and 75 < l["x0"] < 130 else None
            if m:
                letter = m.group(1)
                done = [x[3] for x in labels if x[2] == q and x[3]]
                if letter == "abc"[len(done)]:
                    labels.append((pg, l["y0"], q, letter))
    return labels, stops


# ---------- mark scheme ----------

def ms_parts(doc):
    """{(q, letter): [(page, rect)]} for each part's indicative content, and {"AO1": [...], "AO2": [...]}, the band descriptors."""
    grids, found, q = {}, [], 0
    for pg in range(len(doc)):
        for l in lines(doc[pg]):
            m = re.search(r"Assessment Objective (AO[12])", l["text"])
            if m and m.group(1) not in grids:
                grids[m.group(1)] = pg
        if len(grids) == 2:
            break
    # (AS Hinduism's 2018 scheme prints no band descriptors: its parts start after the guidance pages)
    for pg in range(max(grids.values()) + 1 if grids else 3, len(doc)):
        ls = lines(doc[pg])
        for l in ls:
            if not l["bold"] or l["x0"] > 125:
                continue
            text = l["text"]
            if text == "0":  # the boxes as two lines, "0" then "5"
                nxt = next((o for o in ls if o is not l and abs(o["y0"] - l["y0"]) < 3 and re.fullmatch(r"\d", o["text"]) and 10 < o["x0"] - l["x0"] < 30), None)
                text = f"0 {nxt['text']}" if nxt else text
            m = re.match(r"^(?:(\d)\.|0\s?(\d))(?:\s+\(?([ab])\))?$", text)
            if m and int(m.group(1) or m.group(2)) in (q, q + 1):
                q = int(m.group(1) or m.group(2))
                letter = m.group(3) or next((o["text"][1] for o in ls if abs(o["y0"] - l["y0"]) < 3 and re.fullmatch(r"\([ab]\)", o["text"])), None)
                if letter:
                    found.append((pg, l["y0"], q, letter))
                continue
            m = re.fullmatch(r"\(?([ab])\)", l["text"])
            if m and q and not any(f[:2] == (pg, l["y0"]) or (f[0] == pg and abs(f[1] - l["y0"]) < 3) for f in found):
                # "(b)" alone, under its question's "(a)" a page or two before; or "(a)" beside a boxed "0 1" read after it
                found.append((pg, l["y0"], q, m.group(1)))
    found.sort()
    # Each label once, in order: (1, a), (1, b), (2, a), …
    seen, keep = set(), []
    for f in found:
        if (f[2], f[3]) not in seen:
            seen.add((f[2], f[3]))
            keep.append(f)
    out = {}
    for n, (pg, y, q, letter) in enumerate(keep):
        end = (keep[n + 1][0], keep[n + 1][1] - 4) if n + 1 < len(keep) else (len(doc) - 1, doc[-1].rect.height)
        ps = pieces(doc, (pg, y - 4), end, top=55)
        # "Either," / "Or," / "Section B" above the next question's label belong to it
        trimmed = []
        for p, r in ps:
            cut = [l["y0"] for l in lines(doc[p], r) if STOP.match(l["text"]) and l["y0"] > r.y0 + 8]
            if cut:
                trimmed.append((p, pymupdf.Rect(r.x0, r.y0, r.x1, min(cut) - 4)))
                break
            trimmed.append((p, r))
        out[(q, letter)] = trimmed
    grid = {}
    first = keep[0][0] if keep else None
    if len(grids) == 2 and first is not None:
        bounds = {"AO1": (grids["AO1"], grids["AO2"]), "AO2": (grids["AO2"], first)}
        for ao, (a, b) in bounds.items():
            grid[ao] = [(p, pymupdf.Rect(36, body(doc[p], 50)[0], doc[p].rect.width - 36, body(doc[p], 50)[1])) for p in range(a, max(a + 1, b))
                        if not any(re.search(r"MARK SCHEME$|^(SUMMER|AUTUMN) 20\d\d", l["text"]) for l in lines(doc[p]))]
    return out, grid


# ---------- examiner's report ----------

COMPONENT = re.compile(r"(?im)^[ \t]*(COMPONENT\s*)?(1\s*:?\s*(?:OPTION\s*)?([A-F])|[23])\s*[:.–-]\s*([^\n]*)\n([^\n]*)")
# A section is known by its name: AS 2024 heads Buddhism "COMPONENT 1C".
NAMES = [("1A", "christianity"), ("1B", "islam"), ("1C", "judaism"), ("1D", "buddhism"), ("1E", "hinduism"), ("1F", "sikhism"), ("2", "philosophy"), ("3", "ethics")]
# "Q.1", "Q1.", "Question 1", "1.", "Q1a": never a bare "3", which is a page number
HEAD = re.compile(r"(?m)^[ \t]*(?:(?:Q\.?\s*|Question\s+)([1-5])\s*\.?|([1-5])\s*\.)\s*(?:\(?[ab]\)?\.?)?[ \t]*$")
# "Q1 - Theme 1b: Jesus – his resurrection", or the theme on the line under "Q.1"
HINT = re.compile(r"(?m)^[ \t]*Q\.?\s*([1-5])\.?\s*(?:[-–:]\s*|\n\s*)Theme\s*([1-4])\s*\(?([a-fA-F])\)?\s*[:–-]?\s*([^\n]*)")


def report(path):
    """{component key ("1A", "2"): ({"01": comments}, {"01": {"theme": "1B", "title": …}})}."""
    if not path or not os.path.exists(path):
        return {}
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.sub(r"\n\s*© WJEC CBAC Ltd\.?(\d{4})?\s*\n(\s*\d{1,3}\s*\n)?", "\n", text)
    heads = []
    for m in COMPONENT.finditer(text):
        said = (m.group(4) + " " + m.group(5)).lower()
        named = next((k for k, w in NAMES if w in said), None)
        if not m.group(1) and not (named and re.match(r"\s*(an? (study|introduction)|(the )?philosophy|religion)", m.group(4), re.I)):
            continue  # "2. (a) Examine Islamic teachings …", a question, not a heading
        code = m.group(2).strip()
        heads.append((m.start(), m.end(), named or (f"1{m.group(3).upper()}" if m.group(3) else code)))
    chunks = {}
    for n, (start, end, key) in enumerate(heads):
        chunk = text[end:heads[n + 1][0] if n + 1 < len(heads) else len(text)]
        chunk = re.split(r"\n\s*(?:Supporting you|Summary of key points)", chunk)[0]
        if len(chunk) > len(chunks.get(key, "")):
            chunks[key] = chunk
    out = {}
    for key, chunk in chunks.items():
        hints = {f"{int(m.group(1)):02d}": {"theme": f"{m.group(2)}{m.group(3).upper()}", "title": m.group(4).strip()} for m in HINT.finditer(chunk)}
        # The comments come after the overview (which can list Q.1 to Q.5 with their themes): runs of headings 1 to 5
        # in order from there, one heading for (a) and (b) both ("Q1a", "Q1b"), a question no one commented on left
        # out; a "1." in a list starts a run of its own, so the comments are the run with most to say.
        start = re.search(r"Comments on individual questions", chunk)
        at = start.end() if start else max([m.end() for m in HINT.finditer(chunk)] + [0])
        runs = [[]]
        for m in HEAD.finditer(chunk, at):
            before = chunk[:m.start()].rstrip(" \t\n").rsplit("\n", 1)[-1]
            if re.search(r"\b(to|than|and|in|with|of|from|as|by|for|see|on)$", before):
                continue  # "… slightly lower mean scores compared to" / "Q1.": the end of a sentence
            q = int(m.group(1) or m.group(2))
            if q == 1 and runs[-1] and runs[-1][-1][0] > 1:
                runs.append([])
            if q > (runs[-1][-1][0] if runs[-1] else 0):
                runs[-1].append((q, m.start(), m.end()))
        best = {}
        for r in runs:
            comments = {}
            for n, (q, s_, e) in enumerate(r):
                para = tidy(chunk[e:r[n + 1][1] if n + 1 < len(r) else len(chunk)])
                if para:
                    comments[f"{q:02d}"] = para
            if sum(map(len, comments.values())) > sum(map(len, best.values())):
                best = comments
        out[key] = (best, hints)
    return out


def tidy(chunk):
    """Paragraphs: lines run together, bullets kept as their own lines, section headings dropped."""
    chunk = re.sub(r"(?m)^[ \t]*Section [AB][ \t]*$", "", chunk)
    chunk = re.sub(r"(?m)^[ \t]*\d{1,3}[ \t]*$", "", chunk)  # page numbers
    chunk = re.sub(r"\n[ \t]*•[ \t]*\n", "\n• ", "\n" + chunk)
    chunk = re.sub(r"(?m)^[ \t]*\(([ab])\)[ \t]*$", r"\n(\1)", chunk)
    chunk = re.sub(r"(?<=[^\n])[ \t]*\n(?![ \t]*\n|• |\([ab]\))", " ", chunk)
    paras = [re.sub(r"[ \t]+", " ", p).strip() for p in re.split(r"\n[ \t]*\n|\n(?=• |\([ab]\))", chunk)]
    paras = [p for p in paras if len(p) > 2]
    text = "\n".join(paras).strip()
    return text if len(text) > 60 else ""


# ---------- one sitting ----------

def cut_set(job):
    set_id, files, meta = job
    try:
        qp = pymupdf.open(os.path.join(WORK, "pdf", files["qp"]["file"]))
        ms = pymupdf.open(os.path.join(WORK, "pdf", files["ms"]["file"])) if "ms" in files else None
        labels, stops = qp_labels(qp)
        schemes, grids = ms_parts(ms) if ms else ({}, {})
        if ms and not grids and meta.get("gridsFrom"):
            # No band descriptors of its own: the same level's, that summer, from another paper's scheme (they're generic)
            ms = {"own": ms, "other": pymupdf.open(os.path.join(WORK, "pdf", meta["gridsFrom"]))}
            grids = {k: [("other", p, r) for p, r in v] for k, v in ms_parts(ms["other"])[1].items()}
            schemes = {k: [("own", p, r) for p, r in v] for k, v in schemes.items()}
        else:
            ms = {"own": ms}
            grids = {k: [("own", p, r) for p, r in v] for k, v in grids.items()}
            schemes = {k: [("own", p, r) for p, r in v] for k, v in schemes.items()}
        er = files.get("er")
        key = meta["component"][5].upper()
        key = f"1{key}" if key in "ABCDEF" else key
        comments, hints = report(os.path.join(WORK, "pdf", er["file"]) if er else None).get(key, ({}, {}))
        parts = []
        for n, (pg, y, q, letter) in enumerate(labels):
            if letter is None:
                continue
            # (a) starts at its question's number, on the same line or just above
            start = next(((p, yy) for p, yy, qq, ll in labels if qq == q and ll is None), (pg, y)) if letter == "a" else (pg, y)
            later = [(p, yy) for p, yy, *_ in labels[n + 1:]] + [s for s in stops if s > (pg, y)]
            end = min(later) if later else (len(qp) - 1, qp[-1].rect.height)
            ps = pieces(qp, (start[0], start[1] - 6), (end[0], end[1] - 6))
            img = stack([trim(crop(qp, p, r)) for p, r in ps])
            text = text_of(qp, ps)
            marks = next((int(m.group(1)) for m in [MARKS.search(text)] if m), None)
            pid = f"{set_id}-{q:02d}-{letter}"
            msimg, ms_text = None, ""
            if (q, letter) in schemes:
                content = [trim(crop(ms[d], p, r), 10, sides=True) for d, p, r in schemes[(q, letter)]]
                grid = [trim(crop(ms[d], p, r), 10, sides=True) for d, p, r in grids.get("AO1" if letter == "a" else "AO2", [])]
                msimg = stack(content + ([stack(grid)] if grid else []), gap=28)
                ms_text = text_of(ms["own"], [(p, r) for _, p, r in schemes[(q, letter)]])
            parts.append({
                "id": pid, "set": set_id, **{k: v for k, v in meta.items() if k != "gridsFrom"}, "question": f"{q:02d}", "part": letter, "label": f"{q}({letter})", "marks": marks,
                "qp": save(img, f"{pid}-qp.webp"), "ms": save(msimg, f"{pid}-ms.webp"), "stem": None,
                "w": img.width if img else 0, "h": img.height if img else 0,
                "text": text[:1500], "msText": ms_text[:800], "er": comments.get(f"{q:02d}"),
                **({"hint": hints[f"{q:02d}"]} if f"{q:02d}" in hints else {}),
            })
        return set_id, parts, None
    except Exception:  # noqa: BLE001
        import traceback  # noqa: PLC0415
        return set_id, [], traceback.format_exc(limit=4)


def main():
    os.makedirs(IMG, exist_ok=True)
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = []
    for (comp, series), files in sorted(sets.items()):
        set_id = f"{comp}-{series}".lower()
        if "qp" not in files or (ONLY and not set_id.startswith(ONLY)):
            continue
        sibling = next((f["file"] for f in manifest if f["kind"] == "ms" and f["spec"] == comp[:4].upper() and f["series"] == series and f["component"] != comp), None)
        jobs.append((set_id, files, {"component": comp, "spec": comp[:4].upper(), "series": series, "paperTitle": files["qp"]["title"], "gridsFrom": sibling}))
    parts_path = os.path.join(WORK, "parts.json")
    all_parts = [p for p in json.load(open(parts_path)) if not p["set"].startswith(ONLY)] if ONLY and os.path.exists(parts_path) else []
    problems = []
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, err in pool.map(cut_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            no_ms = sum(1 for p in parts if not p["ms"])
            no_er = sum(1 for p in parts if not p["er"])
            odd = [p["label"] for p in parts if p["marks"] not in (20, 25, 30)]
            print(f"{set_id}: {len(parts)} parts, {no_ms} without scheme, {no_er} without report{', marks? ' + ' '.join(odd) if odd else ''}", file=sys.stderr, flush=True)
            if len(parts) != 10 or no_ms:
                problems.append(f"{set_id}: {len(parts)} parts, {no_ms} without scheme")
            all_parts += parts
    json.dump(all_parts, open(parts_path, "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
