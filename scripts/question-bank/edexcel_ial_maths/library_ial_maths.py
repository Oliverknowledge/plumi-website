"""Point the IAL Maths banks' whole papers at the past paper library's copies where the bucket already has them.

    python3 scripts/question-bank/edexcel_ial_maths/library_ial_maths.py   # needs: pip install boto3; .env.local's R2 keys

The library keeps Pearson's IAL papers in the bucket as edexcel/EDX-<UNIT>-01-<KIND>-<SERIES>.pdf, under series read
off file dates (its "March 2020" is January 2020). A file fetched here that is byte for byte one of those (the same
MD5 as the object's ETag) takes that key as its `r2` in manifest.json, so the bank links the library's copy. The
rest are copied to <work-dir>/upload/pdf/, for upload_r2.py <work-dir>/upload --pdf-prefix=edexcel-ial/.
"""
import hashlib, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
WORK = os.path.join(HERE, "..", ".work", "edexcel-ial-maths")
sys.argv = sys.argv[:1]
import upload_r2  # noqa: E402


def main():
    import boto3  # noqa: PLC0415

    e = upload_r2.env()
    s3 = boto3.client("s3", endpoint_url=f"https://{e['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                      aws_access_key_id=e["R2_ACCESS_KEY_ID"], aws_secret_access_key=e["R2_SECRET_ACCESS_KEY"], region_name="auto")
    by_md5 = {}
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=e["R2_BUCKET"], Prefix="edexcel/EDX-W"):
        for obj in page.get("Contents", []):
            by_md5.setdefault(obj["ETag"].strip('"'), obj["Key"])
    path = os.path.join(WORK, "manifest.json")
    manifest = json.load(open(path))
    out = os.path.join(WORK, "upload", "pdf")
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    linked = 0
    for f in manifest:
        md5 = hashlib.md5(open(os.path.join(WORK, "pdf", f["file"]), "rb").read()).hexdigest()
        f.pop("r2", None)
        if md5 in by_md5:
            f["r2"] = by_md5[md5]
            linked += 1
        else:
            shutil.copyfile(os.path.join(WORK, "pdf", f["file"]), os.path.join(out, f["file"]))
    json.dump(manifest, open(path, "w"), indent=1)
    print(f"{linked} of {len(manifest)} files are the library's; {len(manifest) - linked} to upload from {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
