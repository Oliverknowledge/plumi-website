#!/usr/bin/env python3
"""One short prompt per part through DeepSeek (text only, no pictures): the cheap reader for the text-first route.

  python3 scripts/question-bank/markpacks/deepseek_reader.py <batchDir> [--out outD] [--ids file] [--max-tokens 600000] [--workers 4]

<batchDir> holds prompt.txt (the instruction set, used as the system message), text/<id>.txt (the board's text layer for the scheme) and either ocr/<id>.txt or
_ocr.json at the batch root (the bank's OCR: question then scheme). Writes <batchDir>/<out>/<id>.json with the model's JSON and <out>/_usage.json. The key is
injected by the session's network proxy: nothing here reads or sends a credential. It STOPS when the token budget is spent (default 600,000 tokens, about
$0.15 at DeepSeek list prices), so a mistake cannot become a bill. Model: deepseek-chat by default (the non-thinking mode of the same flash model the app uses); --model deepseek-flash --max-out 6000 is its thinking mode.
"""
import argparse, concurrent.futures as cf, json, re, sys, threading, time, urllib.request
from pathlib import Path

URL = "https://api.deepseek.com/chat/completions"
MODEL = "deepseek-chat"
USER = "BOARD TEXT LAYER (exact words, columns may be run together):\n<<<\n{text}\n>>>\n\nBANK OCR OF THE PART (question first, then its scheme, lossy):\n<<<\n{ocr}\n>>>\n\nReturn the JSON object only."

def call(system, user, model=MODEL, max_out=2500, retries=3):
    body = json.dumps({"model": model, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                       "temperature": 0, "max_tokens": max_out, "response_format": {"type": "json_object"}}).encode()
    for k in range(retries):
        try:
            req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
        except Exception as e:
            err = e; time.sleep(2 * (k + 1))
    raise RuntimeError(str(err)[:200])

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("batch"); ap.add_argument("--out", default="outD"); ap.add_argument("--ids")
    ap.add_argument("--max-tokens", type=int, default=600_000); ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--model", default=MODEL, help="deepseek-chat (non-thinking) or deepseek-flash (thinking: set --max-out 6000)"); ap.add_argument("--max-out", type=int, default=2500)
    a = ap.parse_args()
    b = Path(a.batch); out = b / a.out; out.mkdir(exist_ok=True)
    system = (b / "prompt.txt").read_text()
    ids = (Path(a.ids) if a.ids else b / "ids.txt").read_text().split()
    ocr_all = json.loads((b / "_ocr.json").read_text()) if (b / "_ocr.json").exists() else {}
    used = {"prompt": 0, "completion": 0, "calls": 0, "failed": []}; lock = threading.Lock()

    def one(i):
        with lock:
            if used["prompt"] + used["completion"] >= a.max_tokens: return i, "budget"
        text = (b / "text" / f"{i}.txt").read_text() if (b / "text" / f"{i}.txt").exists() else ""
        ocr = (b / "ocr" / f"{i}.txt").read_text() if (b / "ocr" / f"{i}.txt").exists() else ocr_all.get(i, "")
        try: r = call(system, USER.format(text=text[:6000], ocr=ocr[:6000]), a.model, a.max_out)
        except Exception as e:
            with lock: used["failed"].append(f"{i}: {e}")
            return i, "error"
        u = r.get("usage", {})
        with lock: used["prompt"] += u.get("prompt_tokens", 0); used["completion"] += u.get("completion_tokens", 0); used["calls"] += 1
        content = r["choices"][0]["message"]["content"] or ""
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
        try: json.loads(content)
        except Exception: (out / f"{i}.raw.txt").write_text(content); return i, "badjson"
        (out / f"{i}.json").write_text(content); return i, "ok"

    res = {}
    with cf.ThreadPoolExecutor(a.workers) as ex:
        for i, s in ex.map(one, ids): res[i] = s
    (out / "_usage.json").write_text(json.dumps(used, indent=1))
    counts = {s: sum(1 for v in res.values() if v == s) for s in set(res.values())}
    est = used["prompt"] / 1e6 * 0.28 + used["completion"] / 1e6 * 0.42
    print(json.dumps(counts), f"tokens in {used['prompt']} out {used['completion']} (about ${est:.3f} at list prices)")
    if used["failed"]: print("failed:", used["failed"][:3])

if __name__ == "__main__": main()
