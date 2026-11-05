"""After a bank's cutter is fixed: which question crops really changed, so only those go live.

    python3 scripts/question-bank/upload_data.py --pull <slug> [...]
    <the bank's cutter> <work-dir>                                       # cuts into <work-dir>/img
    python3 scripts/question-bank/recut_compare.py compare <work-dir> <slug> [...]
    python3 scripts/question-bank/upload_r2.py <work-dir>/changed --crops-only --checksum
    python3 scripts/question-bank/recut_compare.py apply <work-dir>
    python3 scripts/question-bank/upload_data.py <slug> [...]            # then commit the metas

`compare` reads each question and setup crop the bank has live (through the storage API: the public r2.dev address
is rate limited, and students use it) and sets each against the new cut:
  same     no more than the odd pixel differs: a re-render, left alone
  changed  a new crop whose height moved by no more than MAX_MOVE, copied to <work-dir>/changed/img/
  review   moved further (a part got words back, or lost them): listed, and held back unless --accept-review,
           because a cutter run today can also disagree with a cut made for a reason since forgotten
  marks    the new crop's "[n marks]" add up differently from the live row, or it holds a "do not write" page: a part took in its neighbour, left alone
  sliced   the new crop's top or bottom edge cuts through something the live crop's didn't, left alone
  narrower narrower than live: another cutter made it wider for a reason (cut_aqa_bio_pmt.py keeps "[1 mark]" on AS June 2016), left alone
  missing  live, but this run did not cut it: listed, left alone
The list is <work-dir>/report.json.

`apply` writes the new sizes into each changed bank's live rows (and nothing else: a work folder's other data can be
older than what is live) and bumps the bank's cropVersion, so browsers fetch the new crops. Keys and bucket come from .env.local.
"""
import io, json, os, re, shutil, sys
from concurrent.futures import ThreadPoolExecutor

import boto3
import botocore.config
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PUB = os.path.join(ROOT, "public", "question-bank")
META = os.path.join(ROOT, "src", "content", "questionBank")
MAX_MOVE = 48  # px: an answer box or a tall line's overhang, at SCALE 2.2
DO_NOT_WRITE = re.compile(r"do not write on this page", re.I)


def client():
    e = dict(os.environ)
    path = os.path.join(ROOT, ".env.local")
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                e.setdefault(k.strip(), v.strip().strip('"'))
    s3 = boto3.client("s3", endpoint_url=f"https://{e['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com", aws_access_key_id=e["R2_ACCESS_KEY_ID"],
                      aws_secret_access_key=e["R2_SECRET_ACCESS_KEY"], region_name="auto", config=botocore.config.Config(max_pool_connections=24, retries={"max_attempts": 6}))
    return s3, e["R2_BUCKET"]


def differ(a, b):
    """The share of pixels that differ by more than a re-encode would."""
    d = ImageChops.difference(a.convert("L"), b.convert("L")).point(lambda v: 255 if v > 48 else 0)
    return sum(1 for v in d.getdata() if v) / max(1, a.width * a.height) if d.getbbox() else 0


def sliced(img):
    """(top, bottom): does an edge cut through something? Short dark runs along the edge, away from the page's own border lines at either side."""
    w, h = img.size
    grey = img.convert("L")
    out = []
    for y in (0, h - 1):
        row = [grey.getpixel((x, y)) < 150 for x in range(w // 20, w - w // 20)]
        runs, n = [], 0
        for dark in row + [False]:
            if dark:
                n += 1
            elif n:
                runs.append(n)
                n = 0
        out.append(bool(runs) and max(runs) < w * 0.2)
    return out


def compare(work, slugs, accept_review):
    s3, bucket = client()
    names = {}  # crop name: (slug, part id or None for a setup)
    live = {}
    cut = {p["id"]: p for p in json.load(open(os.path.join(work, "parts.json")))}
    for slug in slugs:
        for p in json.load(open(os.path.join(PUB, slug, "parts.json"))):
            live[p["id"]] = p
            names[f"{p['id']}-qp"] = (slug, p["id"])
            if p.get("st"):
                names[f"{p['sk'] if p.get('sk') else p['id'].rsplit('-', 1)[0]}-stem"] = (slug, None)
    # (A part's text starts with its setup's, so this holds back a setup that took in a "do not write" page too.)
    blank_page = set()
    for pid, p in cut.items():
        if DO_NOT_WRITE.search(p.get("text") or ""):
            blank_page.add(f"{pid}-qp")
            if p.get("stem"):
                blank_page.add(p["stem"].removesuffix(".webp"))
    img = os.path.join(work, "img")
    out = os.path.join(work, "changed", "img")
    shutil.rmtree(os.path.join(work, "changed"), ignore_errors=True)
    os.makedirs(out)

    def one(item):
        name, (slug, pid) = item
        path = os.path.join(img, f"{name}.webp")
        row = {"name": name, "slug": slug, "id": pid}
        if not os.path.exists(path):
            return {**row, "state": "missing"}
        new = Image.open(path).convert("RGB")
        old = Image.open(io.BytesIO(s3.get_object(Bucket=bucket, Key=f"bank/{name}.webp")["Body"].read())).convert("RGB")
        row.update(old=old.size, new=new.size)
        if old.size == new.size and differ(old, new) < 0.0005:
            return {**row, "state": "same"}
        if new.width < old.width - 1:
            return {**row, "state": "narrower"}
        if pid and pid in cut and (cut[pid].get("marks") or 0) != (live[pid].get("m") or 0) or name in blank_page:
            return {**row, "state": "marks"}
        if any(n and not o for n, o in zip(sliced(new), sliced(old))):
            return {**row, "state": "sliced"}
        if abs(old.height - new.height) <= MAX_MOVE and new.width - old.width <= 16:
            return {**row, "state": "changed"}
        return {**row, "state": "review"}

    with ThreadPoolExecutor(16) as ex:
        rows = list(ex.map(one, names.items()))
    # A setup this cut found that the live rows don't offer (a title that had sat on the end of the question before): the crop goes up, and `apply` marks its parts.
    fresh = {}
    for pid, p in cut.items():
        if pid in live and p.get("stem") and not live[pid].get("st") and not live[pid].get("sk"):
            fresh.setdefault(p["stem"].removesuffix(".webp"), {"name": p["stem"].removesuffix(".webp"), "slug": next(s for s in slugs if names.get(f"{pid}-qp", (None,))[0] == s), "id": None, "state": "newstem", "parts": []})["parts"].append(pid)
    rows += fresh.values()
    counts = {}
    for r in rows:
        key = (r["slug"], r["state"])
        counts[key] = counts.get(key, 0) + 1
        if r["state"] in ("changed", "newstem") or (accept_review and r["state"] == "review"):
            shutil.copy(os.path.join(img, f"{r['name']}.webp"), out)
    json.dump(rows, open(os.path.join(work, "report.json"), "w"))
    for slug in slugs:
        print(slug, {s: counts.get((slug, s), 0) for s in ("same", "changed", "review", "marks", "sliced", "narrower", "missing", "newstem")}, file=sys.stderr)


def apply(work):
    rows = [r for r in json.load(open(os.path.join(work, "report.json"))) if os.path.exists(os.path.join(work, "changed", "img", f"{r['name']}.webp"))]
    for slug in sorted({r["slug"] for r in rows}):
        sizes = {r["id"]: r["new"] for r in rows if r["slug"] == slug and r["id"]}
        path = os.path.join(PUB, slug, "parts.json")
        parts = json.load(open(path))
        started = {pid for r in rows if r["slug"] == slug for pid in r.get("parts", [])}
        for p in parts:
            if p["id"] in sizes:
                p["w"], p["h"] = sizes[p["id"]]
            if p["id"] in started:
                p["st"] = 1
        json.dump(parts, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
        path = os.path.join(META, f"{slug}.json")
        meta = json.load(open(path))
        for p in meta.get("sample", []):
            if p["id"] in sizes:
                p["w"], p["h"] = sizes[p["id"]]
        meta["cropVersion"] = (meta.get("cropVersion") or 0) + 1
        json.dump(meta, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"{slug}: {len(sizes)} sizes, cropVersion {meta['cropVersion']}", file=sys.stderr)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if args[:1] == ["compare"]:
        compare(os.path.abspath(args[1]), args[2:], "--accept-review" in sys.argv)
    elif args[:1] == ["apply"]:
        apply(os.path.abspath(args[1]))
    else:
        sys.exit(__doc__)
