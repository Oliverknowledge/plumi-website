"""Upload our papers and question crops to Cloudflare R2.

    pip install boto3
    python3 scripts/question-bank/upload_r2.py [work-dir] [--dry-run]

Reads the bucket and keys from .env.local (never committed):
    R2_ACCOUNT_ID=...            # Cloudflare dashboard > R2 > Account details
    R2_ACCESS_KEY_ID=...         # an R2 API token with Object Read & Write on the bucket
    R2_SECRET_ACCESS_KEY=...
    R2_BUCKET=plumi-papers
    NEXT_PUBLIC_PAPERS_URL=https://papers.tryplumi.app   # the bucket's public domain

Uploads <work-dir>/pdf/*.pdf to aqa/ and <work-dir>/img/*.webp to bank/, each
with its content type and a year-long immutable cache (file names change when
contents do). Skips anything already there with the same size, so re-runs are cheap.
"""
import os, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(args[0]) if args else os.path.join(HERE, ".work")
DRY = "--dry-run" in sys.argv


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
    bucket = e["R2_BUCKET"]
    existing = {}
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            existing[obj["Key"]] = obj["Size"]
    jobs = []
    for folder, prefix, ctype in (("pdf", "aqa/", "application/pdf"), ("img", "bank/", "image/webp")):
        d = os.path.join(WORK, folder)
        for name in sorted(os.listdir(d)):
            path = os.path.join(d, name)
            if existing.get(prefix + name) == os.path.getsize(path):
                continue
            jobs.append((path, prefix + name, ctype))
    print(f"{len(existing)} already in {bucket}; {len(jobs)} to upload", file=sys.stderr)
    if DRY or not jobs:
        return

    def put(job):
        path, key, ctype = job
        extra = {"ContentType": ctype, "CacheControl": "public, max-age=31536000, immutable"}
        if ctype == "application/pdf":
            extra["ContentDisposition"] = f'inline; filename="{os.path.basename(key)}"'
        s3.upload_file(path, bucket, key, ExtraArgs=extra)
        return key

    done = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        for _ in pool.map(put, jobs):
            done += 1
            if done % 500 == 0:
                print(f"  {done}/{len(jobs)}", file=sys.stderr)
    print(f"uploaded {done}", file=sys.stderr)


if __name__ == "__main__":
    main()
