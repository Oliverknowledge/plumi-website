"""Mark the A-Level Computer Science banks' questions Year 12 or Year 13, for the bank's "Year" filter.

    python3 scripts/question-bank/computer_science_years.py build              # write year13.json for the three banks
    python3 scripts/question-bank/computer_science_years.py sample <slug> <rule> [n]   # n hits of a rule (or "none": the Year 12 left)

Same file as maths_years.py writes (public/question-bank/<slug>/year13.json, the ids that need
Year 13), but the split is decided by a map, not by reading every question. Computer Science
topics are mostly one year or the other, so:

  1. Every AS paper question is Year 12.
  2. A question on a full A-Level paper is Year 13 when it is tagged a topic that only the
     A-Level specification teaches (Y13_TOPICS), or its question or scheme says something only the
     A-Level teaches inside a topic both teach (RULES: a regex over the lower-cased question, its stem or its
     scheme in text.json, for some topic tags or all). Anything else is Year 12.

Not read by hand question by question: the rules were checked on samples from both sides (the hits of each rule, and the
Year 12 left over for each topic), and a few questions read where a rule was wrong. Where a specification is
ambiguous (OCR's Boolean-algebra rules such as De Morgan; Eduqas's file indexes) the question stays Year 12.

The map comes from each board's own public specifications, the AS one set against the A-Level one:
  - AQA 7516/7517, one document: the AS content is the 3.x sections, and a heading with no 3.x twin is
    A-Level only (4.2.2 Queues … 4.3.x, 4.4.3-4.4.5, 4.9.3-4.9.4, 4.10-4.12). Inside topics both have, the A-Level
    adds recursion and stack frames (4.1.1.15-16), object-oriented programming (4.1.2.3), abstract data types
    (4.2.1.4), FSMs with output, regular expressions and set maths (4.4.2.1-4), floating point and errors
    (4.5.4.4-9), vector graphics (4.5.6.5-6), interrupts (4.7.3.6), pointers, half/full adders and flip-flops.
  - OCR H046 and H446: AS teaches every H446 topic except 1.3.1 (compression methods, encryption, hashing) and
    2.1.5 (concurrency); H446's 2.2.2 "Computational methods" is A-Level only (the AS 2.2.2 is software development,
    which the bank files under 1.2.3). Inside shared topics the A-Level adds pipelining and GPUs, stages of
    compilation, paradigms and object-oriented languages, addressing modes, SQL and normalisation, network security,
    server/client-side processing, floating point arithmetic and bitwise masks, linked lists / graphs / trees /
    hash tables (AS has arrays, records, lists, tuples, stacks, queues), logic of flip-flops and adders, caching
    (2.1.2), recursion, and merge/quick sort, Dijkstra, A*, Big O and tree traversals.
  - Eduqas A500 and B500: the AS specification is a subset of each A-Level topic. A-Level only is 1.6 System design,
    stacks/queues/linked lists/trees (AS: arrays and records), recursion, Big O, merge/quick sort and shortest path,
    BNF, Waterfall/Agile, SQL, normalisation, DBMS, Big Data, distributed systems, hashing and file overflow, shifts,
    overflow and underflow, interrupts, scheduling and buffering, cryptography, biometrics and malware.

The CAIE A-Level Computer Science bank is a different build and isn't touched here.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

# Topics only the A-Level specification teaches: every question on a full A-Level paper tagged one is Year 13.
Y13_TOPICS = {
    "aqa-a-level-computer-science": {
        "4.2.2", "4.2.3", "4.2.4", "4.2.5", "4.2.6", "4.2.7", "4.2.8",            # queues … vectors (AS stops at arrays/records)
        "4.3.1", "4.3.2", "4.3.3", "4.3.4", "4.3.5", "4.3.6",                    # all of the algorithms section
        "4.4.3", "4.4.4", "4.4.5",                                               # BNF, complexity/computability, Turing machines
        "4.9.3", "4.9.4",                                                        # the Internet, TCP/IP
        "4.10.1", "4.10.2", "4.10.3", "4.10.4", "4.10.5", "4.11.1",              # databases, Big Data
        "4.12.1", "4.12.2", "4.12.3",                                            # functional programming
    },
    "ocr-a-level-computer-science": {"2.1.5", "2.2.2"},  # (1.3.1 is mixed: see RULES)
    "eduqas-a-level-computer-science": {"1.6"},
}

# (name, topics the rule applies to or None for any, regex, where to look = "own" | "ctx" | "all", regex of own words that cancel it).
# Where to look, in text.json's stem + question + scheme: "own" the part's question (a stem's "or a linked list" shouldn't move a stack-v-queue
# question), "ctx" the stem as well (a linked list scenario's "state the purpose of headPointer"), "all" the scheme too (a word only the
# A-Level teaches: Dijkstra).
_OO = r"object[- ]oriented|\binherit|encapsulat|polymorphi|\bclass(es)?\b|instantiat|\battributes?\b|\bconstructor"
RULES = {
    "aqa-a-level-computer-science": [
        ("only-A-Level words", None, r"dijkstra|breadth-first|depth-first|big-o|order of complexity|halting problem|turing machine|backus|\bbnf\b|regular expression|mealy|mantissa|vector graphic|half[- ]adder|full[- ]adder|flip[- ]flop|stack frame", "all"),
        ("recursion", None, r"recurs"),
        ("number-errors", {"4.5.4"}, r"type of error|\berrors?\b"),
        ("oop", {"4.1.1", "4.1.2"}, _OO),
        ("pointer", {"4.1.1"}, r"\bpointers?\b|reference data type"),
        ("adt", {"4.2.1"}, r"abstract data type"),
        ("fsm-sets", {"4.4.2"}, r"regular expression|regular language|cardinality|\bsets?\b|subset|mealy|with output"),
        ("floating", {"4.5.4"}, r"floating|mantissa|exponent|normalis|rounding|absolute error|relative error|underflow|overflow|precision"),
        ("vector-graphics", {"4.5.6"}, r"vector graphic"),
        ("interrupt", {"4.7.3"}, r"interrupt"),
        ("adders", {"4.6.4"}, r"half[- ]adder|full[- ]adder|flip[- ]flop|d[- ]type"),
    ],
    "ocr-a-level-computer-science": [
        ("pipelining", {"1.1.1"}, r"pipelin"),
        ("gpu", {"1.1.2"}, r"\bgpu|graphics processing"),
        ("compilation", {"1.2.2"}, r"lexical|syntax analysis|code generation|\blinkers?\b|\bloaders?\b|stages of compilation"),
        ("paradigms", {"1.2.4"}, r"paradigm|declarative|\bimperative"),
        ("oop", {"2.1.1", "2.1.2", "2.1.3", "2.1.4"}, _OO + r"|\bobjects?\b|\bmethods?\b"),
        ("oop-scenario", {"1.2.4", "2.2.1", "1.4.2"}, _OO + r"|\bobjects?\b|\bmethods?\b|instance of", "ctx", r"\b(ide|array|iteration|loop)\b"),
        ("structures-anywhere", None, r"linked[- ]list|binary (search )?tree|hash table|tree data structure|graph data structure"),
        ("addressing", {"1.2.4"}, r"addressing mode|immediate addressing|direct addressing|indirect addressing|indexed"),
        ("sql", {"1.3.2"}, r"\bsql\b|normalis|normal form|\bacid\b|record lock|transaction|referential integrity"),
        ("security-web", {"1.3.3", "1.3.4"}, r"firewall|proxy|server[- ]side|client[- ]side|search engine|page ?rank"),
        ("float-bitwise", {"1.4.1"}, r"floating point (addition|subtraction|arithmetic)|bitwise|\bmask(s|ing)?\b|bit shift|logical shift|shifts?\b"),
        ("structures", {"1.4.2", "2.3.1"}, r"linked[- ]list|\bgraphs?\b|\btrees?\b|hash|adjacency|binary search tree|\bnodes?\b|freelistpointer", "ctx", r"\b(stack|queue|array|tuple|record|ide)\b"),
        ("flipflop", {"1.4.3"}, r"flip[- ]flop|half[- ]adder|full[- ]adder|d[- ]type"),
        ("caching", {"2.1.2"}, r"\bcach"),
        ("only-A-Level words", None, r"dijkstra|merge sort|quick ?sort|big[- ]?o\b|half[- ]adder|full[- ]adder|flip[- ]flop|pipelin|\bgpu\b|lexical analysis|run[- ]length|\bsql\b|polymorphi|inheritance"),  # (question only: OCR schemes compare methods freely)
        ("recursion", None, r"recurs", "ctx", r"parameter|branching|iterat|\bmod\b|by value|by reference|\bide\b"),
        ("algorithms", {"2.3.1"}, r"merge sort|quick ?sort|dijkstra|\ba\*|a star|big[- ]?o\b|complexity|traversal|post[- ]order|pre[- ]order|in[- ]order|breadth|depth[- ]first|backtrack"),
        # 1.3.1 is A-Level except lossy v lossless compression, which AS has under web technologies: a rule, not a topic.
        ("compression-methods", {"1.3.1"}, r"run[- ]length|\brle\b|dictionary|encrypt|decrypt|cipher|symmetric|hash|public key|private key|digital signature", "ctx"),
    ],
    "eduqas-a-level-computer-science": [
        ("only-A-Level words", None, r"dijkstra|merge sort|quick ?sort|big[- ]?o\b|backus|\bbnf\b|\bsql\b|normali[sz]ation|cryptograph|biometric|linked[- ]list|binary tree|amdahl", "all"),
        ("data-structures", {"1.1"}, r"\bstacks?\b|\bqueues?\b|linked[- ]list|\btrees?\b|\bpointers?\b|\bgraphs?\b|hash"),
        ("algorithms", {"1.3"}, r"recurs|merge sort|quick ?sort|big[- ]?o\b|dijkstra|shortest[- ]path|traversal|in[- ]?order|pre[- ]?order|post[- ]?order|compression ratio|saving percentage|percentage saving|decompression time"),
        ("complexity", {"1.3"}, r"time (complexity|performance|efficiency)|growth rate|order of (time|space)|space complexity"),
        ("syntax", {"1.4"}, r"backus|\bbnf\b|syntax diagram|standardi[sz]|ambigu|inherit|polymorphi|encapsulat|advantages?.{0,40}(object|procedural)|nature of procedural|non-procedural"),
        ("methodologies", {"1.5"}, r"waterfall|agile|spiral|extreme programming|rapid application"),
        ("version", {"1.7"}, r"version (management|control)"),
        ("conduct", {"1.9"}, r"code of conduct|codes of conduct|professional"),
        ("architecture", {"2.1"}, r"limitations? of parallel|parallelis|assembly|mnemonic|opcode|amdahl|limiting factor|speed[- ]?up|lowest cost|transfer rate|voice (input|recogni|print)|dictation"),
        ("shifts", {"2.3"}, r"shift|overflow|underflow"),
        ("files", {"2.4"}, r"hash|multi-?level index|overflow|re-?organis|collision"),
        ("databases", {"2.5"}, r"\bsql\b|normali[sz]|normal form|\b[123]nf\b|dbms|database management|data dictionar|big data|data mining|warehous|predictive|distribut|consistency|redundan|data independence"),
        ("os", {"2.6"}, r"interrupt|buffer|partition|schedul|time-?slic|polling|thread|blocked|round robin|multi-?programming|multi-?tasking|multi-?user|single-?user"),
        ("systems", {"2.7"}, r"safety[- ](critical|related)|search engine|intranet|automation|dependab"),
        ("security", {"2.8"}, r"plain ?text|cipher ?text|cryptograph|encrypt|cipher|biometric|penetration|black hat|white hat|hacker|malware|malicious software|virus|worm|trojan|ransomware|spyware|phishing|online updat"),
    ],
}
BANKS = list(RULES)


def load(slug):
    meta = json.load(open(os.path.join(ROOT, "src", "content", "questionBank", f"{slug}.json")))
    pub = os.path.join(ROOT, "public", "question-bank", slug)
    return meta, json.load(open(os.path.join(pub, "parts.json"))), json.load(open(os.path.join(pub, "text.json"))), pub


def question_of(whole, x=""):
    """The part's own question: text.json is the stem, the question, then its scheme. The question starts where parts.json's x
    does and ends at its first mark total ("[3 marks]", "[2]"). A total follows a full stop or the like; failing that, the
    first bracketed number that isn't an array index ("[0] c 1"). So the stem's "…or a linked list" doesn't count."""
    start = whole.find(re.sub(r"\s+", " ", x.lower()).strip()[:40]) if x else 0
    whole = whole[max(start, 0):]
    m = re.search(r"(?<=[.?:!)])\s*\[\d{1,2}( marks?)?\]", whole)
    if not m:
        m = next((y for y in re.finditer(r"\[\d{1,2}( marks?)?\]", whole) if not re.match(r"\s[a-z0-9]{1,3}\s", whole[y.end():y.end() + 5])), None)
    return whole[:m.end()] if m else whole[:1000]


def verdict(slug, part, text):
    """(13, why) where a full A-Level paper's question needs second-year content, else (12, None)."""
    tags = set(part["t"])
    if tags & Y13_TOPICS[slug]:
        return 13, "topic " + min(tags & Y13_TOPICS[slug])
    whole = text.get(part["id"], part["x"]).lower()
    own = question_of(whole, part["x"])
    ctx = whole[:whole.find(own) + len(own)] if own in whole else own
    for name, topics, rx, *rest in RULES[slug]:
        mode, unless = (rest[0] if rest else "own"), (rest[1] if len(rest) > 1 else None)
        if (topics is None or tags & topics) and re.search(rx, {"own": own, "ctx": ctx, "all": whole}[mode]) and not (unless and re.search(unless, own)):
            return 13, name
    return 12, None


def classify(slug):
    meta, parts, text, pub = load(slug)
    papers = {p["id"]: p for p in meta["papers"]}
    out = []
    for p in parts:
        if papers[p["p"]].get("as"):
            out.append((p, 12, "AS paper"))
            continue
        y, why = verdict(slug, p, text)
        out.append((p, y, why or "no A-Level-only content"))
    return meta, out, pub


def build():
    for slug in BANKS:
        meta, rows, pub = classify(slug)
        ids = [p["id"] for p, y, _ in rows if y == 13]
        json.dump(ids, open(os.path.join(pub, "year13.json"), "w"), separators=(",", ":"))
        why = {}
        for p, y, w in rows:
            why[w] = why.get(w, 0) + 1
        print(f"{slug}: {len(rows) - len(ids)} Year 12, {len(ids)} Year 13")
        for w, n in sorted(why.items(), key=lambda kv: -kv[1]):
            print(f"    {n:4}  {w}")


def sample(slug, rule, n=12):
    meta, rows, _ = classify(slug)
    hits = [(p, w) for p, y, w in rows if (rule == "none" and w == "no A-Level-only content") or (rule != "none" and w == rule)]
    step = max(1, len(hits) // n)
    print(f"{len(hits)} questions for {rule!r} in {slug}")
    for p, w in hits[::step][:n]:
        print(f"  {p['id']:28} {','.join(p['t']):12} {p['x'][:170]!r}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    if cmd == "build":
        build()
    elif cmd == "sample":
        sample(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 12)
