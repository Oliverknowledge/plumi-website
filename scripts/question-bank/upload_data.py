"""Put a question bank's data (parts, text, reports, ...) on Cloudflare R2, and record where.

    pip install boto3
    python3 scripts/question-bank/upload_data.py <slug> [<slug> ...]   # after building a bank
    python3 scripts/question-bank/upload_data.py --all                  # every bank in public/question-bank
    python3 scripts/question-bank/upload_data.py --pull <slug> [...]    # fetch a bank's data back from R2
    add --dry-run to see what would change; --verify to read every file back through the public URL;
    --drop=practicals to let a file the bank had on R2 go (otherwise a missing one stops the upload)

The builders write a bank's data to public/question-bank/<slug>/ (parts.json, text.json,
reports.json, and practicals.json, year13.json, tiers.json, solutions/<id>.json where the bank
has them). That folder is gitignored: the site reads the files from R2, beside the crops, under
their content hash:

    bank-data/<slug>/<file>.<hash>.json            e.g. bank-data/aqa-a-level-biology/parts.3f9c0a1b2d.json
    bank-data/<slug>/solutions.<hash>/<id>.json    the solutions folder hashed as a whole

so a new cut is a new name: each is uploaded once, gzipped (R2's public URL doesn't compress) and
cached for a year as immutable, and an older deployment still finds its own files. The hashes go
into the bank's meta, src/content/questionBank/<slug>.json, as "data": {"parts": "3f9c0a1b2d", ...};
commit that. Run this again whenever a builder rewrites the data or the meta (a builder that
rewrites the meta drops "data", and `next build` then stops at the bank's topic pages until this puts it back).

--pull does the reverse for a fresh worktree, writing the bank's files from its meta's hashes into
public/question-bank/<slug>/, for the scripts that read a bank's earlier data (tiers.py, ms_fallback.py,
a rebuild that keeps its tags). Pulling needs no keys: it reads the public URL.

Keys and bucket come from .env.local, as for upload_r2.py.
"""
import gzip, hashlib, json, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA = os.path.join(ROOT, "public", "question-bank")
META = os.path.join(ROOT, "src", "content", "questionBank")
FILES = ("parts", "text", "reports", "practicals", "year13", "tiers")
args = [a for a in sys.argv[1:] if not a.startswith("--")]
DRY = "--dry-run" in sys.argv
PULL = "--pull" in sys.argv
VERIFY = "--verify" in sys.argv
DROP = {f for a in sys.argv[1:] if a.startswith("--drop=") for f in a.split("=", 1)[1].split(",")}


def env():
    values = dict(os.environ)
    path = os.path.join(ROOT, ".env.local")
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                values.setdefault(k.strip(), v.strip().strip('"'))
    return values


def short(h):
    return h.hexdigest()[:10]


def plan(slug):
    """The bank's files on disk: ({file: hash}, [(path, key)])."""
    folder = os.path.join(DATA, slug)
    hashes, jobs = {}, []
    for f in FILES:
        path = os.path.join(folder, f"{f}.json")
        if os.path.exists(path):
            hashes[f] = short(hashlib.sha256(open(path, "rb").read()))
            jobs.append((path, f"bank-data/{slug}/{f}.{hashes[f]}.json"))
    sol = os.path.join(folder, "solutions")
    names = sorted(n for n in os.listdir(sol) if n.endswith(".json")) if os.path.isdir(sol) else []
    if names:
        h = hashlib.sha256()
        for n in names:
            h.update(n.encode() + b"\0" + open(os.path.join(sol, n), "rb").read() + b"\0")
        hashes["solutions"] = short(h)
        jobs += [(os.path.join(sol, n), f"bank-data/{slug}/solutions.{hashes['solutions']}/{n}") for n in names]
    return hashes, jobs


def meta_path(slug):
    path = os.path.join(META, f"{slug}.json")
    if not os.path.exists(path):
        sys.exit(f"{slug}: no {os.path.relpath(path, ROOT)} (the bank's meta, which the builder writes)")
    return path


def write_data(slug, hashes):
    """Record the hashes in the meta, written as the builders write it (compact, UTF-8)."""
    path = meta_path(slug)
    meta = json.load(open(path))
    if meta.get("data") == hashes:
        return False
    meta["data"] = hashes
    if not DRY:
        with open(path, "w") as out:
            json.dump(meta, out, ensure_ascii=False, separators=(",", ":"))
    return True


def get(url):
    req = urllib.request.Request(url, headers={"Accept-Encoding": "gzip", "User-Agent": "plumi-upload-data"})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read()
        return gzip.decompress(body) if r.headers.get("Content-Encoding") == "gzip" else body


def public_base(e):
    base = e.get("NEXT_PUBLIC_PAPERS_URL", "").rstrip("/")
    if not base.startswith("http"):
        sys.exit("NEXT_PUBLIC_PAPERS_URL in .env.local must be the bucket's public URL")
    return base


def pull(slugs, e):
    base = public_base(e)
    jobs = []
    for slug in slugs:
        data = json.load(open(meta_path(slug))).get("data")
        if not data:
            sys.exit(f"{slug}: its meta has no \"data\" (never uploaded)")
        folder = os.path.join(DATA, slug)
        for f, h in data.items():
            if f != "solutions":
                jobs.append((f"{base}/bank-data/{slug}/{f}.{h}.json", os.path.join(folder, f"{f}.json")))
    print(f"{len(jobs)} files to pull, and any worked solutions", file=sys.stderr)
    if DRY:
        return

    def fetch(job):
        url, path = job
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as out:
            out.write(get(url))
    list(ThreadPoolExecutor(8).map(fetch, jobs))
    # A worked solution is named by its part (`sol` in parts.json), so the list says which to fetch.
    sols = []
    for slug in slugs:
        h = json.load(open(meta_path(slug)))["data"].get("solutions")
        if h:
            parts = json.load(open(os.path.join(DATA, slug, "parts.json")))
            sols += [(f"{base}/bank-data/{slug}/solutions.{h}/{p['id']}.json", os.path.join(DATA, slug, "solutions", f"{p['id']}.json")) for p in parts if p.get("sol")]
    list(ThreadPoolExecutor(8).map(fetch, sols))
    print(f"pulled {len(jobs) + len(sols)} files", file=sys.stderr)


def main():
    e = env()
    slugs = sorted(n for n in os.listdir(DATA) if os.path.isdir(os.path.join(DATA, n))) if "--all" in sys.argv else args
    if not slugs:
        sys.exit(__doc__)
    if PULL:
        return pull(slugs, e)

    missing = [k for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET") if not e.get(k)]
    if missing:
        sys.exit(f"Missing in .env.local: {', '.join(missing)}")
    import boto3  # noqa: PLC0415

    s3 = boto3.client("s3", endpoint_url=f"https://{e['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                      aws_access_key_id=e["R2_ACCESS_KEY_ID"], aws_secret_access_key=e["R2_SECRET_ACCESS_KEY"], region_name="auto")
    bucket = e["R2_BUCKET"]

    todo, changed, keys = [], [], []
    for slug in slugs:
        if not os.path.exists(os.path.join(DATA, slug, "parts.json")):
            sys.exit(f"{slug}: no public/question-bank/{slug}/parts.json (build the bank first, or --pull it)")
        hashes, jobs = plan(slug)
        # practicals.json, year13.json and tiers.json are made once, apart from the build: missing here, they were never pulled.
        lost = [f for f in json.load(open(meta_path(slug))).get("data", {}) if f not in hashes and f not in DROP]
        if lost:
            sys.exit(f"{slug}: the bank has {', '.join(lost)} on R2 but not in public/question-bank/{slug}/. "
                     f"--pull {slug} first (then rebuild), or --drop={','.join(lost)} if it should go")
        existing = set()
        for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=f"bank-data/{slug}/"):
            existing.update(o["Key"] for o in page.get("Contents", []))
        todo += [j for j in jobs if j[1] not in existing]
        keys += jobs
        if write_data(slug, hashes):
            changed.append(slug)
    print(f"{len(slugs)} banks: {len(todo)} of {len(keys)} files to upload; "
          f"{'would update' if DRY else 'updated'} the data hashes of {len(changed)}{': ' + ', '.join(changed) if changed and len(changed) <= 10 else ''}",
          file=sys.stderr)
    if DRY:
        return

    def put(job):
        path, key = job
        s3.put_object(Bucket=bucket, Key=key, Body=gzip.compress(open(path, "rb").read(), 9, mtime=0),
                      ContentType="application/json; charset=utf-8", ContentEncoding="gzip",
                      CacheControl="public, max-age=31536000, immutable")
        return key
    for i, _ in enumerate(ThreadPoolExecutor(16).map(put, todo), 1):
        if i % 100 == 0 or i == len(todo):
            print(f"  {i}/{len(todo)}", file=sys.stderr)

    if VERIFY:
        base = public_base(e)

        def same(job):
            path, key = job
            return get(f"{base}/{key}") == open(path, "rb").read() or key
        bad = [k for k in ThreadPoolExecutor(16).map(same, keys) if k is not True]
        print(f"verified {len(keys) - len(bad)} of {len(keys)} through {base}", file=sys.stderr)
        if bad:
            sys.exit("differ: " + ", ".join(bad[:10]))


if __name__ == "__main__":
    main()
