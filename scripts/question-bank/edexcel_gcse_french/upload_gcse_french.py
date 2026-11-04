"""Upload the Edexcel GCSE French bank's papers, crops and recordings to Cloudflare R2.

    python3 scripts/question-bank/edexcel_gcse_french/upload_gcse_french.py [work-dir] [--dry-run]

upload_r2.py sends a languages bank's recordings to aqa/audio/, which isn't where Pearson's belong: these go to edexcel/audio/, the papers to edexcel/ and the crops
to bank/. Only what parts.json and manifest.json name is sent, so crops left in the work directory by an earlier cut stay out of the bucket. What is
already there byte for byte is skipped. Keys come from .env.local, as upload_r2.py's do.
"""
import hashlib, json, os, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-gcse-french")
DRY = "--dry-run" in sys.argv
sys.path.insert(0, os.path.dirname(HERE))
from upload_r2 import env  # noqa: E402


def main():
    import boto3  # noqa: PLC0415
    e = env()
    s3 = boto3.client("s3", endpoint_url=f"https://{e['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                      aws_access_key_id=e["R2_ACCESS_KEY_ID"], aws_secret_access_key=e["R2_SECRET_ACCESS_KEY"], region_name="auto")
    bucket = e["R2_BUCKET"]
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    wanted = {}
    for p in parts:
        for name in (p.get("qp"), p.get("ms"), p.get("stem")):
            if name:
                wanted["bank/" + name] = (os.path.join(WORK, "img", name), "image/webp")
        if p.get("audio"):
            wanted["edexcel/audio/" + p["audio"]] = (os.path.join(WORK, "audio-out", p["audio"]), "audio/mpeg")
    for f in manifest:
        if f.get("file") and f["kind"] in ("qp", "ms", "er", "tr"):
            wanted["edexcel/" + f["file"]] = (os.path.join(WORK, "pdf", f["file"]), "application/pdf")
    existing = {}
    for prefix in ("bank/1fr", "edexcel/1fr", "edexcel/audio/1fr"):
        for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                existing[obj["Key"]] = obj["ETag"].strip('"')
    jobs = [(path, key, ctype) for key, (path, ctype) in sorted(wanted.items()) if existing.get(key) != hashlib.md5(open(path, "rb").read()).hexdigest()]
    print(f"{len(wanted)} files wanted, {len(existing)} under these prefixes already, {len(jobs)} to upload, {sum(os.path.getsize(j[0]) for j in jobs) / 1e6:.0f} MB", file=sys.stderr)
    if DRY or not jobs:
        return

    def put(job):
        path, key, ctype = job
        extra = {"ContentType": ctype, "CacheControl": "public, max-age=31536000, immutable"}
        if ctype == "application/pdf":
            extra["ContentDisposition"] = f'inline; filename="{os.path.basename(key)}"'
        s3.upload_file(path, bucket, key, ExtraArgs=extra)

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(put, jobs))
    print(f"uploaded {len(jobs)}", file=sys.stderr)


if __name__ == "__main__":
    main()
