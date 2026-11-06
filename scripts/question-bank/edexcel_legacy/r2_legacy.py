"""Snapshot the current bank or upload this additive legacy import to R2.

Requires boto3 and the four R2_* process variables. Never overwrites a different
object. Metadata hashes change only after every upload is read back and verified.
"""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import gzip
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile

from append_legacy import ROOT, SLUG, read, write


@contextmanager
def client():
    import boto3
    import botocore.session
    from botocore.config import Config
    # This is a Cloudflare connection with explicit R2 keys, not an AWS identity.
    # Select a separate non-secret profile without changing inherited variables.
    with tempfile.TemporaryDirectory(prefix="plumi-r2-") as directory:
        profile = Path(directory) / "config"
        profile.write_text("[profile plumi-r2]\nregion = auto\n")
        session = botocore.session.Session(profile="plumi-r2")
        session.set_config_variable("config_file", str(profile))
        session.set_config_variable("credentials_file", "/dev/null")
        values = {key: os.environ[key].strip() for key in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")}
        if any(not value for value in values.values()):
            raise ValueError("Empty R2 setting")
        s3 = boto3.Session(botocore_session=session).client("s3",
            endpoint_url=f"https://{values['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
            aws_access_key_id=values["R2_ACCESS_KEY_ID"], aws_secret_access_key=values["R2_SECRET_ACCESS_KEY"],
            region_name="auto", config=Config(connect_timeout=20, read_timeout=60, retries={"max_attempts": 2}))
        yield s3, values["R2_BUCKET"]


def snapshot(work, meta_file=None):
    baseline = work / "baseline"
    if baseline.exists():
        raise ValueError("Preserve the existing baseline; choose a new work directory for a fresh snapshot")
    meta = read(meta_file or ROOT / "src/content/questionBank" / f"{SLUG}.json")
    with client() as (s3, bucket):
        files = {}
        for name, digest in meta["data"].items():
            if name == "solutions":
                continue
            body = s3.get_object(Bucket=bucket, Key=f"bank-data/{SLUG}/{name}.{digest}.json")["Body"].read()
            if body[:2] == b"\x1f\x8b":
                body = gzip.decompress(body)
            if hashlib.sha256(body).hexdigest()[:10] != digest:
                raise ValueError(f"Baseline checksum mismatch: {name}")
            files[name] = body
        baseline.mkdir(parents=True)
        write(baseline / "meta.json", meta)
        for name, body in files.items():
            (baseline / f"{name}.json").write_bytes(body)
    print(f"Verified {len(files)} baseline files; existing solution hash preserved")


def upload(work):
    meta_path = ROOT / "src/content/questionBank" / f"{SLUG}.json"
    meta = read(meta_path)
    jobs = []
    for record in read(work / "manifest.json"):
        jobs.append((work / "pdf" / record["file"], "edexcel-legacy/" + record["file"], "application/pdf", False))
    for part in read(work / "parts.json"):
        for kind in ("qp", "ms"):
            if part.get(kind):
                name = f"{part['id']}-{kind}.webp"
                jobs.append((work / "img" / name, "bank/legacy-edx-" + name, "image/webp", False))
    hashes = dict(meta["data"])
    for name in ("parts", "text", "reports", "year13"):
        path = ROOT / "public/question-bank" / SLUG / f"{name}.json"
        hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()[:10]
        jobs.append((path, f"bank-data/{SLUG}/{name}.{hashes[name]}.json", "application/json; charset=utf-8", True))
    payloads = []
    for path, key, content_type, compressed in jobs:
        body = path.read_bytes()
        if compressed:
            body = gzip.compress(body, compresslevel=9, mtime=0)
        payloads.append((key, body, content_type, compressed, hashlib.md5(body).hexdigest()))
    if len({item[0] for item in payloads}) != len(payloads):
        raise ValueError("Duplicate upload keys")
    with client() as (s3, bucket):
        existing = {}
        for prefix in ("edexcel-legacy/", "bank/legacy-edx-", f"bank-data/{SLUG}/"):
            for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
                existing.update((obj["Key"], obj["ETag"].strip('"')) for obj in page.get("Contents", []))
        for key, _, _, _, digest in payloads:
            if key in existing and existing[key] != digest:
                raise ValueError(f"Refusing to overwrite an immutable object: {key}")

        def put(item):
            key, body, content_type, compressed, digest = item
            if key not in existing:
                extra = {"ContentEncoding": "gzip"} if compressed else {}
                s3.put_object(Bucket=bucket, Key=key, Body=body, ContentType=content_type,
                              CacheControl="public, max-age=31536000, immutable", IfNoneMatch="*", **extra)
            head = s3.head_object(Bucket=bucket, Key=key)
            if head["ETag"].strip('"') != digest:
                raise ValueError(f"Read-back ETag mismatch: {key}")
            if compressed and s3.get_object(Bucket=bucket, Key=key)["Body"].read() != body:
                raise ValueError(f"Read-back data mismatch: {key}")

        with ThreadPoolExecutor(max_workers=8) as pool:
            for count, _ in enumerate(pool.map(put, payloads), 1):
                if count % 100 == 0:
                    print(f"Verified {count}/{len(payloads)} objects", flush=True)
    meta["data"] = hashes
    write(meta_path, meta)
    print(f"Verified {len(payloads)} objects; saved new hashes; solutions unchanged")


if __name__ == "__main__":
    try:
        work = Path(sys.argv[2]).resolve()
        if sys.argv[1] == "snapshot":
            snapshot(work, Path(sys.argv[3]) if len(sys.argv) > 3 else None)
        elif sys.argv[1] == "upload":
            upload(work)
        else:
            raise ValueError("Expected snapshot or upload")
    except Exception as error:
        # SDK exceptions can include signed headers; never dump them or secrets.
        print(f"R2 operation failed: {type(error).__name__}", file=sys.stderr)
        response = getattr(error, "response", None)
        if isinstance(response, dict):
            print("Service error code:", response.get("Error", {}).get("Code"), file=sys.stderr)
        raise SystemExit(1)
