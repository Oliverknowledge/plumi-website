"""Check a bank before its PR: the mistakes that have shipped before, caught where a script can catch them.

    npm run bank:check -- <slug> [<slug> ...]                  # the rows
    npm run bank:check -- <slug> --img <work-dir>/img          # and the crops: files, sizes, cut edges, a sheet to read

Rows come from public/question-bank/<slug>/parts.json, pulled from R2 if this checkout doesn't have them.
With --img it needs Pillow and writes <work-dir>/check-sheet-<n>.png: every crop it doubts and a fixed sample
of the rest. Read those sheets. Numbers alone have passed cutters that merged questions and cut sentences off,
and a page's own border can read as a cut edge, so a doubt here is a reason to look, not a verdict.

Exits 1 if anything under FAIL turns up. WARN doesn't stop a PR, but list what you found in it.
"""
import json, os, random, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PUB = os.path.join(ROOT, "public", "question-bank")
META = os.path.join(ROOT, "src", "content", "questionBank")
DO_NOT_WRITE = re.compile(r"do not write on this page", re.I)
MIN_HEIGHT = 24  # px: shorter than one line of print at SCALE 2.2
MAX_RATIO = 12  # a crop this much taller than wide has taken in more than its part
SAMPLE, PER_SHEET, COLUMN = 24, 24, 560
argv = sys.argv[1:]
IMG = argv[argv.index("--img") + 1] if "--img" in argv else None
slugs = [a for i, a in enumerate(argv) if not a.startswith("--") and (i == 0 or argv[i - 1] != "--img")]


def load(slug):
    path = os.path.join(PUB, slug, "parts.json")
    if not os.path.exists(path):
        subprocess.run([sys.executable, os.path.join(HERE, "upload_data.py"), "--pull", slug], check=True)
    return json.load(open(path))


def check_rows(meta, parts):
    """(fails, warns), each a list of (part id, what's wrong)."""
    fails, warns, seen = [], [], set()
    papers = {p["id"] for p in meta.get("papers") or []}
    series = {s["id"] for s in meta.get("series") or []}
    topics = {t["code"] for t in meta.get("topics") or []}
    for p in parts:
        pid = p.get("id", "?")
        if pid in seen:
            fails.append((pid, "id used twice"))
        seen.add(pid)
        if p.get("p") not in papers:
            fails.append((pid, f"paper {p.get('p')} isn't in the meta"))
        if p.get("s") not in series:
            fails.append((pid, f"series {p.get('s')} isn't in the meta"))
        if not p.get("t"):
            fails.append((pid, "no topic"))
        elif set(p["t"]) - topics:
            fails.append((pid, f"topic {sorted(set(p['t']) - topics)[0]} isn't in the meta"))
        if not (p.get("ms") or p.get("msf") or p.get("k")):
            fails.append((pid, "no scheme crop, whole-scheme file or key"))
        if not p.get("w") or not p.get("h"):
            fails.append((pid, "no crop size"))
        elif p["h"] < MIN_HEIGHT:
            warns.append((pid, f"only {p['h']}px tall"))
        elif p["h"] > p["w"] * MAX_RATIO:
            warns.append((pid, f"{p['w']}x{p['h']}: very tall for its width"))
        if p.get("m") is None:
            warns.append((pid, "no marks"))
        if not p.get("x"):
            warns.append((pid, "no opening words"))
        elif DO_NOT_WRITE.search(p["x"]):
            fails.append((pid, 'holds a "do not write on this page" page'))
    return fails, warns


def stem_name(p):
    return f"{p['sk']}-stem" if p.get("sk") else f"{p['id'].rsplit('-', 1)[0]}-stem"


def check_crops(parts, img_dir):
    """(fails, warns, doubts): doubts are crops worth reading, as (crop name, why)."""
    try:
        from PIL import Image
    except ImportError:
        sys.exit("--img needs Pillow: pip install pillow")
    sliced = load_sliced()
    fails, warns, doubts = [], [], []
    for p in parts:
        path = os.path.join(img_dir, f"{p['id']}-qp.webp")
        if not os.path.exists(path):
            fails.append((p["id"], "question crop missing"))
            continue
        with Image.open(path) as im:
            if (im.width, im.height) != (p.get("w"), p.get("h")):
                # The study feed draws a crop at its row's size, so a mismatch squashes it.
                fails.append((p["id"], f"crop is {im.width}x{im.height}, row says {p.get('w')}x{p.get('h')}"))
            cut = sliced(im.convert("RGB"))
        for edge, hit in zip(("top", "bottom"), cut):
            if hit:
                warns.append((p["id"], f"{edge} edge may cut through something"))
                doubts.append((f"{p['id']}-qp", f"{edge} edge"))
        if p.get("ms") and not os.path.exists(os.path.join(img_dir, f"{p['id']}-ms.webp")):
            fails.append((p["id"], "row says it has a scheme crop, but there's no file"))
        if p.get("st") and not os.path.exists(os.path.join(img_dir, f"{stem_name(p)}.webp")):
            fails.append((p["id"], f"row says it has a setup, but there's no {stem_name(p)}.webp"))
    return fails, warns, doubts


def load_sliced():
    """recut_compare.py's test for a cut edge, without needing its storage client to be installed."""
    source = open(os.path.join(HERE, "recut_compare.py")).read()
    code = re.search(r"^def sliced\(img\):.*?(?=^def )", source, re.M | re.S).group(0)
    scope = {}
    exec(code, scope)
    return scope["sliced"]


def write_sheets(parts, doubts, img_dir):
    """Every doubted crop and a fixed sample of the rest, labelled, on sheets a person or a model can read."""
    from PIL import Image, ImageDraw

    chosen, have = list(doubts), {name for name, _ in doubts}
    rest = sorted(f"{p['id']}-qp" for p in parts if f"{p['id']}-qp" not in have)
    random.Random(0).shuffle(rest)
    chosen += [(name, "sample") for name in rest[:SAMPLE]]
    out = []
    for start in range(0, len(chosen), PER_SHEET):
        tiles = []
        for name, why in chosen[start:start + PER_SHEET]:
            path = os.path.join(img_dir, f"{name}.webp")
            if os.path.exists(path):
                with Image.open(path) as im:
                    crop = im.convert("RGB")
                crop.thumbnail((COLUMN, 900))
                tiles.append((f"{name}: {why}", crop))
        if not tiles:
            continue
        columns = [[], [], []]
        tops = [0, 0, 0]
        for tile in tiles:
            i = tops.index(min(tops))
            columns[i].append((tops[i], tile))
            tops[i] += tile[1].height + 34
        sheet = Image.new("RGB", (COLUMN * 3 + 40, max(tops) + 10), "#dddddd")
        draw = ImageDraw.Draw(sheet)
        for i, column in enumerate(columns):
            for top, (label, crop) in column:
                x = 10 + i * (COLUMN + 10)
                draw.text((x, top + 6), label[:90], fill="#aa0000")
                sheet.paste(crop, (x, top + 24))
        path = os.path.join(os.path.dirname(os.path.abspath(img_dir)), f"check-sheet-{len(out) + 1}.png")
        sheet.save(path)
        out.append(path)
    return out


def report(label, rows, limit=20):
    print(f"  {label}: {len(rows)}")
    kinds = {}
    for pid, what in rows:
        kinds.setdefault(re.sub(r"\d+", "n", what), []).append((pid, what))
    for group in kinds.values():
        for pid, what in group[:limit]:
            print(f"    {pid}: {what}")
        if len(group) > limit:
            print(f"    ... and {len(group) - limit} more like that")


def main():
    if not slugs:
        sys.exit(__doc__)
    failed = False
    for slug in slugs:
        meta = json.load(open(os.path.join(META, f"{slug}.json")))
        parts = load(slug)
        fails, warns = check_rows(meta, parts)
        sheets = []
        if IMG:
            crop_fails, crop_warns, doubts = check_crops(parts, IMG)
            fails += crop_fails
            warns += crop_warns
            sheets = write_sheets(parts, doubts, IMG)
        print(f"{slug}: {len(parts):,} parts")
        report("FAIL", fails)
        report("WARN", warns, limit=5)
        for path in sheets:
            print(f"  read: {path}")
        failed = failed or bool(fails)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
