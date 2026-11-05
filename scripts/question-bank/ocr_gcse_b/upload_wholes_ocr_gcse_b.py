"""Put OCR's Twenty First Century Science whole papers on R2 under the past paper library's names.

    python3 scripts/question-bank/ocr_gcse_b/upload_wholes_ocr_gcse_b.py [work-dir] [--dry-run]   # default .work/ocr-gcse-b

The banks link each sitting's question paper, mark scheme and report to the library's copy
(ocr/OCR-J257-01-QP-JUN24.pdf, the manifest's `r2`). The library has J257-J259; J260 (Combined Science B) isn't on its
list, so its files are uploaded here under the same scheme, the way Gateway's J250 were. Anything already in the bucket
under its key is left alone. Keys come from .env.local, as upload_r2.py's.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
from upload_r2 import env  # noqa: E402

args = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "ocr-gcse-b")


def main():
    import boto3  # noqa: PLC0415

    e = env()
    s3 = boto3.client("s3", endpoint_url=f"https://{e['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                      aws_access_key_id=e["R2_ACCESS_KEY_ID"], aws_secret_access_key=e["R2_SECRET_ACCESS_KEY"], region_name="auto")
    bucket = e["R2_BUCKET"]
    have = {o["Key"]: o["Size"] for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix="ocr/") for o in page.get("Contents", [])}
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    todo = [f for f in manifest if f["r2"] not in have]
    print(f"{len(manifest)} files in the manifest; {len(manifest) - len(todo)} already in {bucket}; {len(todo)} to upload", file=sys.stderr)
    differs = [f["r2"] for f in manifest if f["r2"] in have and have[f["r2"]] != f["bytes"]]
    if differs:
        print(f"{len(differs)} in the bucket under the same key with another size (left alone): {differs[:5]}", file=sys.stderr)
    if "--dry-run" in sys.argv:
        for f in todo[:5]:
            print("  would upload", f["r2"], file=sys.stderr)
        return
    for f in todo:
        s3.upload_file(os.path.join(WORK, "pdf", f["file"]), bucket, f["r2"],
                       ExtraArgs={"ContentType": "application/pdf", "CacheControl": "public, max-age=31536000, immutable",
                                  "ContentDisposition": f'inline; filename="{os.path.basename(f["r2"])}"'})
    print(f"uploaded {len(todo)}", file=sys.stderr)


if __name__ == "__main__":
    main()
