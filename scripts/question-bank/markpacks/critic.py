#!/usr/bin/env python3
"""Second pass over readings: a model checks each reading against the same pictures and reports definite discrepancies.
Same model family as the reader, so NOT independent: use it as a cheap first filter and keep a human or a different model on a sample.

  DEEPSEEK_API_KEY=... python3 scripts/question-bank/markpacks/critic.py <readings-dir> [--only ids.txt] [--cap 0.05]
Writes <readings-dir>/critic.json: {part id: {"verdict": ..., "issues": [...]}}.
"""
import argparse, base64, io, json, os, sys, urllib.request
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent
PRICE_IN, PRICE_HIT, PRICE_OUT = 0.30, 0.006, 1.20

def jpeg_b64(path):
    im = Image.open(path).convert("RGB")
    if im.width > 1200: im = im.resize((1200, int(im.height * 1200 / im.width)))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

def check(d, ids, cap):
    key = os.environ["DEEPSEEK_API_KEY"]; system = (HERE / "critic_prompt.txt").read_text()
    d = Path(d); out, spent = {}, 0.0
    for pid in ids:
        if spent >= cap: print("cap reached before", pid); break
        stem = d / f"{pid}.stem.webp"
        imgs = ([stem] if stem.exists() else []) + [d / f"{pid}.qp.webp", d / f"{pid}.ms.webp"]
        note = ("Images: 1 the introduction, 2 the part, 3 the mark scheme." if stem.exists() else "Images: 1 the part, 2 the mark scheme.")
        body = {"model": "deepseek-flash", "temperature": 0, "max_tokens": 900, "thinking": {"type": "disabled"}, "response_format": {"type": "json_object"},
                "messages": [{"role": "system", "content": system},
                             {"role": "user", "content": [{"type": "text", "text": note + "\n\nTranscription:\n" + (d / f"{pid}.json").read_text()}]
                              + [{"type": "image_url", "image_url": {"url": jpeg_b64(p)}} for p in imgs]}]}
        try:
            req = urllib.request.Request("https://api.deepseek.com/chat/completions", data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "Authorization": "Bearer " + key})
            r = json.load(urllib.request.urlopen(req, timeout=120)); u = r["usage"]
            hit = u.get("prompt_cache_hit_tokens", 0)
            spent += ((u["prompt_tokens"] - hit) * PRICE_IN + hit * PRICE_HIT + u["completion_tokens"] * PRICE_OUT) / 1e6
            out[pid] = json.loads(r["choices"][0]["message"]["content"])
        except Exception as e:
            out[pid] = {"verdict": "error", "issues": [{"where": "other", "problem": str(e)[:120]}]}
    (d / "critic.json").write_text(json.dumps(out, indent=1))
    return out, spent

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("dir"); ap.add_argument("--only"); ap.add_argument("--cap", type=float, default=0.05)
    a = ap.parse_args()
    ids = Path(a.only).read_text().split() if a.only else [p.stem for p in Path(a.dir).glob("*.json") if not p.name.startswith("_") and p.name != "critic.json"]
    out, spent = check(a.dir, sorted(ids), a.cap)
    from collections import Counter
    print(dict(Counter(v["verdict"] for v in out.values())), f"spent ${spent:.4f}")
