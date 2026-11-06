"""Put the maths booklets on R2: everything build.py wrote under <work-dir>/r2/, at the same keys.

    python3 scripts/booklets/upload.py [work-dir] [--dry-run] [--verify]

<work-dir>/r2/booklets/madasmaths/<group>/<slug>.pdf goes to booklets/madasmaths/<group>/<slug>.pdf, and so on:
PDFs inline (they open in the browser's viewer), previews as WebP, each cached for a year as immutable, as
upload_r2.py does for the question bank. Lists only the booklets/ prefix, and skips anything already there
at the same size. --verify reads every key back by its ETag (an MD5 for these single-part uploads; files
over boto3's 8 MB threshold go up in parts, so those are checked by size).

Keys and bucket come from .env.local, or the environment (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
R2_SECRET_ACCESS_KEY, R2_BUCKET).
"""
import hashlib, os, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(args[0]) if args else os.path.join(HERE, ".work")
DRY, VERIFY = "--dry-run" in sys.argv, "--verify" in sys.argv
TYPES = {".pdf": "application/pdf", ".webp": "image/webp"}
SINGLE_PART = 8 * 1024 * 1024  # boto3's multipart threshold


def env():
    values = dict(os.environ)
    path = os.path.join(ROOT, ".env.local")
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                values.setdefault(k.strip(), v.strip().strip('"'))
    missing = [k for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET") if not values.get(k)]
    if missing:
        sys.exit(f"Missing in .env.local: {', '.join(missing)}")
    return values


def main():
    import boto3  # noqa: PLC0415

    e = env()
    s3 = boto3.client("s3", endpoint_url=f"https://{e['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                      aws_access_key_id=e["R2_ACCESS_KEY_ID"], aws_secret_access_key=e["R2_SECRET_ACCESS_KEY"], region_name="auto")
    bucket, base = e["R2_BUCKET"], os.path.join(WORK, "r2")
    local = {}
    for d, _, names in os.walk(base):
        for n in names:
            if os.path.splitext(n)[1] in TYPES:
                path = os.path.join(d, n)
                local[os.path.relpath(path, base).replace(os.sep, "/")] = path
    remote = {}
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix="booklets/"):
        for obj in page.get("Contents", []):
            remote[obj["Key"]] = (obj["Size"], obj["ETag"].strip('"'))
    jobs = sorted(k for k, p in local.items() if remote.get(k, (None,))[0] != os.path.getsize(p))
    print(f"{len(local)} files here, {len(remote)} under booklets/ on R2; {len(jobs)} to upload", file=sys.stderr)

    def put(key):
        ctype = TYPES[os.path.splitext(key)[1]]
        extra = {"ContentType": ctype, "CacheControl": "public, max-age=31536000, immutable"}
        if ctype == "application/pdf":
            extra["ContentDisposition"] = f'inline; filename="{os.path.basename(key)}"'
        s3.upload_file(local[key], bucket, key, ExtraArgs=extra)
        return key

    if jobs and not DRY:
        done = 0
        with ThreadPoolExecutor(max_workers=8) as pool:
            for _ in pool.map(put, jobs):
                done += 1
                if done % 100 == 0:
                    print(f"  {done}/{len(jobs)}", file=sys.stderr)
        print(f"uploaded {done}", file=sys.stderr)

    if VERIFY:
        bad = []

        def check(key):
            head = s3.head_object(Bucket=bucket, Key=key)
            path = local[key]
            if head["ContentLength"] != os.path.getsize(path):
                return f"{key}: {head['ContentLength']} bytes on R2, {os.path.getsize(path)} here"
            if os.path.getsize(path) < SINGLE_PART and head["ETag"].strip('"') != hashlib.md5(open(path, "rb").read()).hexdigest():
                return f"{key}: different bytes"
            if head.get("CacheControl") != "public, max-age=31536000, immutable" or head.get("ContentType") != TYPES[os.path.splitext(key)[1]]:
                return f"{key}: headers {head.get('ContentType')}, {head.get('CacheControl')}"
            return None

        with ThreadPoolExecutor(max_workers=16) as pool:
            bad = [r for r in pool.map(check, sorted(local)) if r]
        print(f"verified {len(local) - len(bad)}/{len(local)}" + "".join(f"\n  {b}" for b in bad), file=sys.stderr)
        sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
