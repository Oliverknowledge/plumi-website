#!/usr/bin/env python3
"""Reads bank parts' question and scheme IMAGES into mark-pack readings with a vision model (costs money), then the gates
(check.ts) decide what may be used. Used for the 6 Nov 2026 pilot (README.md).

  DEEPSEEK_API_KEY=... python3 scripts/question-bank/markpacks/extract.py --slug aqa-a-level-biology \
      --ids 74023-jun17-05-1,74022-jun19-05-1 --out /tmp/packs [--cap 0.50]
  npx tsx scripts/question-bank/markpacks/check.ts /tmp/packs

Prints tokens and cost per call and STOPS at --cap dollars. Prices are DeepSeek's published list prices for deepseek-flash
(Plumi's CostMeter.swift): $0.30 / $0.006 cached / $1.20 per million tokens. Bank data is read from the public bucket: use it
for a handful of parts, not a bulk run (AGENTS.md: bulk reads go through the S3 API).
"""
import argparse, base64, io, json, os, re, subprocess, sys, time, urllib.request
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
# The bank's public address is read from src/config/papers.ts (the one place it is written), not repeated here.
BASE = re.search(r'R2_DEV_URL = "([^"]+)"', (HERE.parents[2] / "src/config/papers.ts").read_text()).group(1)
PRICE_IN, PRICE_HIT, PRICE_OUT = 0.30, 0.006, 1.20

def get(url, tries=3):
    time.sleep(0.15)   # the public bucket is rate limited and students use it: go gently
    for i in range(tries):
        r = subprocess.run(["curl", "-sS", "--max-time", "60", "-w", "\n%{http_code}", url], capture_output=True)
        body, _, code = r.stdout.rpartition(b"\n")
        if code == b"200": return body
        time.sleep(1 + i)
    raise RuntimeError(f"{url} -> {code!r}")

def jpeg_b64(webp_bytes):
    im = Image.open(io.BytesIO(webp_bytes)).convert("RGB")
    if im.width > 1200: im = im.resize((1200, int(im.height * 1200 / im.width)))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

def run(slug, ids, out, cap=0.50, prompt_file=None):
    """Reads the given parts of one bank into `out` (one reading per part, plus _parts.json and _ocr.json). Returns dollars spent."""
    key = os.environ["DEEPSEEK_API_KEY"]
    system = Path(prompt_file or HERE / "extraction_prompt.txt").read_text()
    meta = json.loads((HERE.parents[2] / "src/content/questionBank" / f"{slug}.json").read_text())
    cv, data = meta.get("cropVersion") or 0, meta["data"]
    rows = {r["id"]: r for r in json.loads(get(f"{BASE}/bank-data/{slug}/parts.{data['parts']}.json"))}
    text = json.loads(get(f"{BASE}/bank-data/{slug}/text.{data['text']}.json"))
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    (out / "_parts.json").write_text(json.dumps([rows[i] for i in ids], indent=1))
    (out / "_ocr.json").write_text(json.dumps({i: text.get(i, "") for i in ids}, indent=1))
    spent = 0.0
    for pid in ids:
        if spent >= cap: print("cap reached, stopping before", pid); break
        try:
            qp = get(f"{BASE}/bank/{pid}-qp.webp"); ms = get(f"{BASE}/bank/{pid}-ms.webp?v={max(2, cv)}")
            stem = None
            r0 = rows[pid]
            if r0.get("st") or r0.get("sk"):            # the shared introduction (src/lib/studyapp/questions/cropUrls.ts: stemImage)
                sid = r0.get("sk") or re.sub(r"-[^-]+$", "", pid)
                try: stem = get(f"{BASE}/bank/{sid}-stem.webp", tries=2)
                except Exception: stem = None
            body = {"model": "deepseek-flash", "temperature": 0, "max_tokens": 1500, "thinking": {"type": "disabled"},
                    "response_format": {"type": "json_object"},
                    "messages": [{"role": "system", "content": system},
                                 {"role": "user", "content": ([{"type": "text", "text": "Image 1: the question's introduction. Image 2: the part being marked. Image 3: the official mark scheme."},
                                                               {"type": "image_url", "image_url": {"url": jpeg_b64(stem)}}] if stem else
                                                              [{"type": "text", "text": "Image 1: the question. Image 2: the official mark scheme."}])
                                              + [{"type": "image_url", "image_url": {"url": jpeg_b64(qp)}},
                                                 {"type": "image_url", "image_url": {"url": jpeg_b64(ms)}}]}]}
            req = urllib.request.Request("https://api.deepseek.com/chat/completions", data=json.dumps(body).encode(),
                                         headers={"Content-Type": "application/json", "Authorization": "Bearer " + key})
            r = json.load(urllib.request.urlopen(req, timeout=120)); u = r["usage"]
        except Exception as e:
            print(f"{pid}: ERROR {str(e)[:100]}"); continue
        hit = u.get("prompt_cache_hit_tokens", 0)
        cost = ((u["prompt_tokens"] - hit) * PRICE_IN + hit * PRICE_HIT + u["completion_tokens"] * PRICE_OUT) / 1e6
        spent += cost
        (out / f"{pid}.json").write_text(r["choices"][0]["message"]["content"])
        (out / f"{pid}.qp.webp").write_bytes(qp); (out / f"{pid}.ms.webp").write_bytes(ms)
        if stem: (out / f"{pid}.stem.webp").write_bytes(stem)   # kept so a critic can look at the same pictures
    return spent

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", required=True); ap.add_argument("--ids", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--cap", type=float, default=0.50); ap.add_argument("--prompt")
    a = ap.parse_args()
    spent = run(a.slug, a.ids.split(","), a.out, a.cap, a.prompt)
    print(f"spent ${spent:.4f}")

if __name__ == "__main__": main()
