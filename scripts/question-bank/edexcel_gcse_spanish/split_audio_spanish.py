"""Find where each question starts in Pearson's whole-paper Spanish recordings, and check its tracked ones.

    python3 scripts/question-bank/edexcel_gcse_spanish/split_audio_spanish.py [work-dir] [--check-tracks]
    # needs ffmpeg, and whisper-cli with ~/.cache/whisper/ggml-base.en.bin; reads <work-dir>/parts.json for the printed titles

June 2022 onwards Pearson publishes one track per question; June 2018, June 2019, November 2020, November 2021 and the 2026
specimens have one long recording. Every recording reads out each question's printed title in English ("Occupations.", "My best friend."; the specimens add "Question 3."),
in a short burst of speech, then leaves a long pause for reading the question (9s or more). Each short burst of speech, Pearson's between-extract tones
left out, is transcribed, and they are matched in order to the paper's titles, one to one. A Spanish title (Section B's) is read badly by the English
model, but it has the right place in the order. The start of a question is 0.3s
before its title. Writes edexcel_gcse_spanish/audio_splits.json, {"1sp0-1f-jun18": {"starts": {"01": 365.5, ...}, "heard": {...}, "titles": {...}}},
which cut_gcse_spanish.py reads, so re-cutting needs no whisper. A match the words don't support is printed for checking by ear or by hand.

--check-tracks runs the same finder on the whole recordings of the tracked sittings, and compares its starts with the tracks' own lengths.
"""
import difflib, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-gcse-spanish")
CHECK = "--check-tracks" in sys.argv
OUT = os.path.join(HERE, "audio_splits.json")
MODEL = os.path.expanduser("~/.cache/whisper/ggml-base.en.bin")
LEAD = 0.3
# Starts the finder placed wrongly, each found by transcribing the seconds around it: June 2019 Foundation's 1 and 2 (an example's Spanish read as the title,
# and "Question 2, part 3" read as question 2), November 2020 Higher's 1 (taken from the opening instructions) and the specimen Foundation's 3 ("Buenos Aires").
PINS = {"1sp0-1f-jun19": {"01": 370.8, "02": 448.9}, "1sp0-1h-nov20": {"01": 371.5}, "1sp1-2f-spec": {"03": 585.3}}


def silences(path, db=-40, least=1.0):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", f"silencedetect=noise={db}dB:d={least}", "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r)]
    return list(zip(starts, ends))


def exact(path):
    """A recording decoded once to WAV, which can be cut to the sample: ffmpeg's seek into these MP3s lands up to ~12 seconds from where it was told to
    (June 2019's Foundation recording), so a slice cut from the MP3 isn't the seconds it was asked for."""
    wav = os.path.join(WORK, "audio-wav", os.path.basename(os.path.dirname(path)) + ".wav")
    if not os.path.exists(wav):
        os.makedirs(os.path.dirname(wav), exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ac", "1", "-ar", "22050", wav + ".part.wav"], check=True)
        os.replace(wav + ".part.wav", wav)
    return wav


CACHE_PATH = os.path.join(WORK, "whisper-cache.json")
CACHE = json.load(open(CACHE_PATH)) if os.path.exists(CACHE_PATH) else {}


def heard(path, start, length):
    key = f"exact/{os.path.basename(os.path.dirname(path))}/{os.path.basename(path)}:{start:.1f}:{length:.1f}"
    if key not in CACHE:
        with tempfile.NamedTemporaryFile(suffix=".wav") as w:
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-t", f"{length:.2f}", "-i", exact(path), "-ar", "16000", "-ac", "1", w.name], check=True)
            r = subprocess.run(["whisper-cli", "-m", MODEL, "-f", w.name, "-nt", "-np"], capture_output=True, text=True).stdout
        CACHE[key] = " ".join(r.split())
        json.dump(CACHE, open(CACHE_PATH, "w"))
    return CACHE[key]


def candidates(path):
    """[(start, what was heard, pause after, after two bleeps)]: from the end of the paper's five minutes' reading on, the opening of any speech
    after a long pause, and each short burst with a pause after it. A title usually has a long pause after it, and in older recordings a question's first burst
    comes after the two bleeps that end the one before. A recording's floor can hide its pauses at one threshold, so bursts are pooled across thresholds."""
    out = {}
    for db in (-40, -50, -32):
        spans = silences(path, db, 0.8)
        reading = next((b for a, b in spans if b - a > 120), 0)
        end, gap, before = 0.0, 0.0, []
        for a, b in spans:
            speech, after = a - end, b - a
            opening = gap >= 6
            burst = 0.3 < speech < 14 and after >= 4 and gap >= 1.5
            if end >= reading and (opening or burst) and not any(abs(k - end) < 1.5 for k in out):
                words = heard(path, max(0, end - 0.2), min(speech + 0.4, 6) if opening else speech + 0.4)
                if not re.fullmatch(r"\W*(\(?\[?(beep|bleep)\w*\]?\)?|\(?\[?(music|tone|BLANK_AUDIO)\]?\)?)?\W*", words, re.I):
                    out[end] = (end, words, after, len(before) > 1 and all(0.5 < x < 1.0 for x in before[-2:]))
            before = before + [speech]
            end, gap = b, after
    return [out[k] for k in sorted(out)]


def norm(t):
    return re.sub(r"[^a-z ]", "", re.sub(r"^\s*(section [ab]\W*)?(question \d+\W*)?", "", t.lower())).strip()


def fit(q, title, found, section_b):
    """How well a burst of speech fits a question's title, 0 to about 1.3. "Question 3." read out says which it is, and so does
    "Section A." or "Section B.", read over the first question of each. The pause for reading after a title is 9s or more."""
    said = re.search(r"\bquestion (\d+)", found[1], re.I)
    if said:
        later = re.search(r"\bpart\s*(b|c|2|two)\b|\d\s*[-–]?\s*[b-c]\b\W*$", found[1], re.I)  # "Question 5, part B.", part way through
        return 0.3 if later and int(said.group(1)) == int(q) else 1.2 if int(said.group(1)) == int(q) else 0.0
    section = re.match(r"\s*section ([ab])\b", found[1], re.I)
    if section:
        return 1.2 if int(q) == (section_b if section.group(1).lower() == "b" else 1) else 0.0
    if not title:  # the specimens' dictation, under a heading of its own
        return 1.0 if re.search(r"section b|dictation|you will (now )?(hear|listen)|sentence", found[1], re.I) else 0.0
    t, h = norm(title), norm(found[1])
    score = max(difflib.SequenceMatcher(None, t, h).ratio(), difflib.SequenceMatcher(None, t, h[:len(t) + 3]).ratio())
    return score + (0.15 if found[2] >= 8.5 else 0) + (0.15 if found[3] else 0)


def match(found, qs, titles, section_b):
    """The best one-to-one, in-order match of bursts to questions: [index of each question's burst], and each match's score."""
    n, m = len(qs), len(found)
    score = [[fit(q, titles[q], c, section_b) for c in found] for q in qs]
    best = [[-1e9] * (m + 1) for _ in range(n + 1)]
    best[0] = [0.0] * (m + 1)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            best[i][j] = max(best[i][j - 1], best[i - 1][j - 1] + score[i - 1][j - 1])
    pick, j = [], m
    for i in range(n, 0, -1):
        while j > 0 and best[i][j] == best[i][j - 1]:
            j -= 1
        pick.append(j - 1)
        j -= 1
    pick.reverse()
    return pick, [score[i][k] for i, k in enumerate(pick)]


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    audio = {f"{f['component']}-{f['series']}": f for f in manifest if f["kind"] == "audio"}
    done = json.load(open(OUT)) if os.path.exists(OUT) and not CHECK else {}
    for key, f in sorted(audio.items()):
        comp, series = key.rsplit("-", 1)
        tracked = f["tracked"] and any(re.search(r"_\d{3}\.mp3$", t, re.I) for t in f["tracks"])
        if tracked != CHECK or key.lower() in done:
            continue
        set_id = f"{comp.replace('-', '')}-{series}".lower()
        titles = {}
        for p in parts:
            if p["set"] == set_id:
                titles.setdefault(p["question"], p["title"])
        if CHECK:
            # The whole recording beside the tracks: 1sp0-1f-recording-2406.mp3
            path = os.path.join(WORK, "download", f"{comp}-recording-{series[3:]}06.mp3")
            track_dir = os.path.join(WORK, "audio-src", key)
            lengths = [float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", os.path.join(track_dir, t)], capture_output=True, text=True).stdout)
                       for t in sorted(f["tracks"])]
        else:
            d = os.path.join(WORK, "audio-src", key)
            path = os.path.join(d, sorted(n for n in os.listdir(d) if n.lower().endswith(".mp3"))[0])
        found = candidates(path)
        qs = sorted(titles)
        if len(found) < len(qs):
            print(f"{key}: only {len(found)} candidates for {len(qs)} questions", file=sys.stderr)
            for c in found:
                print("    ", round(c[0], 1), c[1], file=sys.stderr)
            continue
        # (Foundation's Section B is its last two questions, Higher's its third on; the specimens' is the dictation, the last.)
        section_b = len(qs) if comp.startswith("1sp1") else (13 if comp.endswith("f") else 3)
        pick, scores = match(found, qs, titles, section_b)
        # 1SP0's recordings read the title, pause, then "Question 3.": the question starts at the burst before.
        if comp.startswith("1sp0"):
            for n, k in enumerate(pick):
                if k and re.fullmatch(r"\W*question \d+\W*((example|part \w)\W*)?", found[k][1], re.I) and found[k][0] - found[k - 1][0] < 20 and (n == 0 or pick[n - 1] != k - 1):
                    pick[n] = k - 1
        starts = {q: round(max(0, found[k][0] - LEAD), 2) for q, k in zip(qs, pick)}
        starts.update(PINS.get(key.lower(), {}))
        print(f"{key}: {len(found)} candidates, {len(qs)} questions, weakest {min(scores):.2f}", file=sys.stderr)
        for q, k, s in zip(qs, pick, scores):
            note = "   pinned" if q in PINS.get(key.lower(), {}) else "" if s >= 0.6 else "   <-- check"
            line = f"   {q} {starts[q]:8.1f} {s:.2f} printed {titles[q]!r} heard {found[k][1]!r}{note}"
            if CHECK:
                truth = sum(lengths[:int(q)])
                line += f"  tracks at {truth:.1f}, off by {starts[q] - truth:+.1f}"
            print(line, file=sys.stderr)
        if not CHECK:
            done[key.lower()] = {"starts": starts, "heard": {q: found[k][1] for q, k in zip(qs, pick) if q not in PINS.get(key.lower(), {})}, "titles": {q: titles[q] for q in qs}}
            json.dump(done, open(OUT, "w"), ensure_ascii=False, indent=0)


if __name__ == "__main__":
    main()
