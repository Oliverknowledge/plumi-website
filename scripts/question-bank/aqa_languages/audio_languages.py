"""Make one recording per listening question from AQA's Paper 1 audio.

    python3 scripts/question-bank/aqa_languages/audio_languages.py [work-dir]   # needs ffmpeg

A listening question names its tracks above its number ("Tracks: 02–14", then "0 1"). AQA's
tracked recording (fetch_languages.py) is one MP3 per track, so a question's recording is its
tracks joined in order. November 2020 was published only as one untracked MP3: it is cut where
the recording falls silent nearest the end of each passage, found from the passage lengths the
paper prints ("Length of passage: One minute and 29 seconds"), and the silence has to be a long
one (the gap between passages, not between sentences).

Writes <work-dir>/audio-out/<component>-<series>-<question>.mp3 (mono, 64 kbps: speech) and
<work-dir>/audio.map.json, { "76521-jun23-01": "76521-jun23-01.mp3" }, for build_languages.py.
"""
import json, os, re, subprocess, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-languages")
OUT = os.path.join(WORK, "audio-out")
os.makedirs(OUT, exist_ok=True)
NUMBERS = {w: n for n, w in enumerate("zero one two three four five six seven eight nine ten eleven twelve".split())}
TRACKS = re.compile(r"Tracks?\s*:?\s*(\d+)\s*[–−-]\s*(\d+)")  # an en dash, or a minus sign (November 2021)
LENGTH = re.compile(r"Length of passage:\s*([A-Za-z]+) minutes?(?: and ([A-Za-z0-9]+) seconds?)?", re.I)
LABEL = re.compile(r"^\s*(\d)\s*(\d)\s*$")


def listening(qp):
    """[(question, first track, last track, seconds or None)] in the order the paper sets them."""
    lines = [l for p in pymupdf.open(qp) for l in p.get_text().split("\n")]
    out, pending, length = [], None, None
    for line in lines:
        if m := LENGTH.search(line):
            secs = m.group(2) or "0"
            length = NUMBERS.get(m.group(1).lower(), 0) * 60 + (int(secs) if secs.isdigit() else NUMBERS.get(secs.lower(), 0))
        if m := TRACKS.search(line):
            pending = (int(m.group(1)), int(m.group(2)))
        elif pending and (m := LABEL.match(line)):
            out.append((m.group(1) + m.group(2), *pending, length))
            pending, length = None, None
    return out


def track_no(name):
    return int(re.findall(r"\d+", os.path.splitext(name)[0])[-1])


def encode(inputs, dest, start=None, end=None):
    """Join MP3s (or cut one) into a mono 64 kbps MP3. The tracks aren't all encoded alike,
    so they are decoded and joined by the concat filter, not stream-copied."""
    cmd = ["ffmpeg", "-v", "error", "-y"]
    if start is not None:
        cmd += ["-ss", f"{start:.2f}"]
    if end is not None:
        cmd += ["-to", f"{end:.2f}"]
    for path in inputs:
        cmd += ["-i", path]
    joined = "".join(f"[{n}:a]aresample=44100,aformat=channel_layouts=mono[a{n}];" for n in range(len(inputs)))
    joined += "".join(f"[a{n}]" for n in range(len(inputs))) + f"concat=n={len(inputs)}:v=0:a=1[out]"
    subprocess.run(cmd + ["-filter_complex", joined, "-map", "[out]", "-b:a", "64k", "-map_metadata", "-1", dest], check=True)


def silences(path):
    log = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "silencedetect=noise=-45dB:d=1.2", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    ends = [(float(m.group(1)), float(m.group(2))) for m in re.finditer(r"silence_end: ([\d.]+) \| silence_duration: ([\d.]+)", log)]
    return [(end - dur, end, dur) for end, dur in ends]


def split_untracked(path, questions):
    """[(start, end)] per question: each cut in the middle of the longest gap near where its passage should end."""
    gaps = silences(path)
    total = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True).stdout)
    # The gaps between passages are the longest few, leaving out the silence the recording ends on.
    long = sorted(d for _, e, d in gaps if e < total - 5)[-(len(questions) - 1):]
    floor = min(long) * 0.8 if long else 0
    cuts, at = [], 0.0
    for q, first, last, secs in questions[:-1]:
        guess = at + (secs or 0)
        near = [g for g in gaps if g[2] >= floor and g[0] > at + 20]
        if not near:
            raise ValueError(f"no gap after question {q}")
        s, e, _ = min(near, key=lambda g: abs(g[0] - guess))
        cuts.append((s + e) / 2)
        at = e
    bounds = [0.0] + cuts + [None]
    return list(zip(bounds[:-1], bounds[1:]))


def main():
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    mapping = {}
    for f in sorted(manifest, key=lambda f: (f["component"], f["series"])):
        if f["kind"] != "qp" or f["component"][4] != "1":
            continue
        key = f"{f['component']}-{f['series']}"
        src = os.path.join(WORK, "audio", key)
        qs = listening(os.path.join(WORK, "pdf", f["file"]))
        if not os.path.isdir(src) or not qs:
            print(f"{key}: no recording or no listening questions", file=sys.stderr)
            continue
        names = [n for n in os.listdir(src) if n.lower().endswith(".mp3")]
        if names == ["untracked.mp3"]:
            spans = split_untracked(os.path.join(src, "untracked.mp3"), qs)
            for (q, *_), (start, end) in zip(qs, spans):
                name = f"{key.lower()}-{q}.mp3"
                if not os.path.exists(os.path.join(OUT, name)):
                    encode([os.path.join(src, "untracked.mp3")], os.path.join(OUT, name), start, end)
                mapping[f"{key.lower()}-{q}"] = name
            print(f"{key}: untracked, cut at {[round(s or 0) for s, _ in spans[1:]]}s", file=sys.stderr)
            continue
        by_no = {track_no(n): n for n in names}
        for q, first, last, _ in qs:
            missing = [n for n in range(first, last + 1) if n not in by_no]
            if missing:
                raise SystemExit(f"{key} question {q}: no track {missing}")
            name = f"{key.lower()}-{q}.mp3"
            if not os.path.exists(os.path.join(OUT, name)):
                encode([os.path.join(src, by_no[n]) for n in range(first, last + 1)], os.path.join(OUT, name))
            mapping[f"{key.lower()}-{q}"] = name
        print(f"{key}: {len(qs)} questions from tracks {qs[0][1]}-{qs[-1][2]} of {max(by_no)}", file=sys.stderr)
    json.dump(mapping, open(os.path.join(WORK, "audio.map.json"), "w"), indent=1)
    print(f"{len(mapping)} recordings in {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
