"""The bucket's public address, for scripts that read its files back.

NEXT_PUBLIC_PAPERS_URL from the environment or .env.local, otherwise the bucket's r2.dev address
(as src/config/papers.ts). A bulk fetch belongs on the S3 API instead: r2.dev answers 429 at about
45 requests a second.
"""
import os

R2_DEV_URL = "https://pub-e8a9dbab8e2a4d089f52b2a45e0d0b50.r2.dev"
ENV_LOCAL = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env.local"))


def papers_url():
    url = os.environ.get("NEXT_PUBLIC_PAPERS_URL", "")
    if not url and os.path.exists(ENV_LOCAL):
        for line in open(ENV_LOCAL):
            if line.startswith("NEXT_PUBLIC_PAPERS_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
    return (url if url.startswith("http") else R2_DEV_URL).rstrip("/")
