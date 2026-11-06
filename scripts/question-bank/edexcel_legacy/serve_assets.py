"""Read-only local R2 asset mirror for builds, avoiding bulk reads from r2.dev."""
import argparse
from concurrent.futures import Future
import gzip
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import re
import threading
from urllib.parse import unquote, urlsplit

from r2_legacy import client


def serve(port):
    lock, slots, cache = threading.Lock(), threading.Semaphore(8), {}
    with client() as (s3, bucket):
        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *_):
                pass

            def do_GET(self):
                key = unquote(urlsplit(self.path).path).lstrip("/")
                if ".." in key.split("/") or not key.startswith(("bank-data/", "bank/", "edexcel/", "edexcel-legacy/")):
                    self.send_error(404)
                    return
                with lock:
                    owner = key not in cache
                    if owner:
                        cache[key] = Future()
                    future = cache[key]
                if owner:
                    try:
                        with slots:
                            obj = s3.get_object(Bucket=bucket, Key=key)
                            body = obj["Body"].read()
                        match = re.search(r"/(?:parts|text|reports|year13)\.([0-9a-f]{10})\.json$", key)
                        if match:
                            plain = gzip.decompress(body) if body[:2] == b"\x1f\x8b" else body
                            if hashlib.sha256(plain).hexdigest()[:10] != match[1]:
                                raise ValueError("Asset checksum mismatch")
                        future.set_result((body, obj.get("ContentType", "application/octet-stream"), obj.get("ContentEncoding")))
                    except Exception as error:
                        # Never expose SDK exception text, which may contain signed headers.
                        future.set_exception(RuntimeError(type(error).__name__))
                        with lock:
                            cache.pop(key, None)
                try:
                    body, content_type, encoding = future.result()
                except Exception:
                    self.send_error(502, "R2 asset unavailable")
                    return
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Access-Control-Allow-Origin", "*")
                if encoding:
                    self.send_header("Content-Encoding", encoding)
                self.end_headers()
                self.wfile.write(body)

        with ThreadingHTTPServer(("127.0.0.1", port), Handler) as server:
            print(f"Read-only R2 asset mirror ready (port {port})", flush=True)
            server.serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=3033)
    serve(parser.parse_args().port)
