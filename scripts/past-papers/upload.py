"""Upload the past paper library's files to Cloudflare R2.

    pip install boto3
    python3 scripts/past-papers/upload.py [board ...] [--dry-run]

Sends every file in every board's manifest (scripts/past-papers/.work/<board>/manifest.json)
to its R2 key (the entry's "file"), from .work/<board>/pdf/ (PDFs, and GCSE Computer Science's code-file zips). Same keys, settings and
.env.local as scripts/question-bank/upload_r2.py, whose helpers this uses: a year-long
immutable cache, and anything already there with the same size is skipped.
"""
import glob, json, os, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "question-bank"))
from upload_r2 import env  # noqa: E402

DRY = "--dry-run" in sys.argv
ONLY = [a for a in sys.argv[1:] if not a.startswith("--")]


def main():
    import boto3  # noqa: PLC0415

    jobs = {}
    for path in sorted(glob.glob(os.path.join(HERE, ".work", "*", "manifest.json"))):
        board = os.path.basename(os.path.dirname(path))
        if ONLY and board not in ONLY:
            continue
        for f in json.load(open(path)):
            local = os.path.join(os.path.dirname(path), "pdf", os.path.basename(f["file"]))
            if os.path.exists(local):
                jobs[f["file"]] = local
    e = env()
    s3 = boto3.client("s3", endpoint_url=f"https://{e['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                      aws_access_key_id=e["R2_ACCESS_KEY_ID"], aws_secret_access_key=e["R2_SECRET_ACCESS_KEY"], region_name="auto")
    bucket = e["R2_BUCKET"]
    existing = {}
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            existing[obj["Key"]] = obj["Size"]
    todo = [(local, key) for key, local in sorted(jobs.items()) if existing.get(key) != os.path.getsize(local)]
    print(f"{len(jobs)} library files; {len(todo)} to upload", file=sys.stderr)
    if DRY or not todo:
        return

    def put(job):
        local, key = job
        zipped = key.endswith(".zip")  # GCSE Computer Science's code files: saved, not shown
        s3.upload_file(local, bucket, key, ExtraArgs={
            "ContentType": "application/zip" if zipped else "application/pdf", "CacheControl": "public, max-age=31536000, immutable",
            "ContentDisposition": f'{"attachment" if zipped else "inline"}; filename="{os.path.basename(key)}"'})

    with ThreadPoolExecutor(max_workers=8) as pool:
        for i, _ in enumerate(pool.map(put, todo), 1):
            if i % 500 == 0:
                print(f"  {i}/{len(todo)}", file=sys.stderr)
    print(f"uploaded {len(todo)}", file=sys.stderr)


if __name__ == "__main__":
    main()
