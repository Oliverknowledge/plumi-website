"""
Check the bank's worked solutions before anyone reads them.

    python3 scripts/question-bank/solutions/check_solutions.py [subject-slug] [-v] [--only <id prefix>]

For every solutions/<id>.json beside a bank (public/question-bank/<slug>/solutions/):

  1. Lines: every line of working with numbers is recalculated. Each line is split at its
     = signs; neighbouring pieces must be equal: exactly, or to the places shown when a
     piece is rounded (73.74) or truncated (0.211...). Pieces with letters are checked as
     identities at sample points, or with the values a part or step gives in `check.vals`
     (the answer it reaches, so an equation being solved is checked too).
  2. Answers: each part's `check.answers` names a piece of its final answer and the mark
     scheme's answer for it (`scheme`, transcribed from Pearson's scheme); the two are
     compared numerically or algebraically with SymPy. `derive`, where given, works the
     answer out again from the question alone and must agree as well.
  3. Marks: the codes tagged on the steps and answers, in order, are the scheme's own
     (`check.marks`), and they add up to the question's marks in parts.json.
  4. TeX: every piece of maths, display or inline \\( ... \\), renders with KaTeX
     (render_tex.mjs), and parts.json flags each question with a solution (`sol: 1`).

Also: no em dashes in what students read, no stray control characters (a JSON "\\t" where
"\\\\t" was meant turns \\theta into a tab).

Needs SymPy and its LaTeX parser: pip install sympy antlr4-python3-runtime==4.11
Exits 1 if anything fails; lists what it could not check either way.
"""

import json
import math
import random
import re
import subprocess
import sys
from pathlib import Path

import sympy as sp
from sympy.calculus.util import function_range
from sympy.parsing.latex import parse_latex

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent

MARK_CODE = re.compile(r"^(d{0,2}M|A|B)\d(\*|ft)?$")
TRIG = (sp.sin, sp.cos, sp.tan, sp.sec, sp.csc, sp.cot)
INVTRIG = (sp.asin, sp.acos, sp.atan)
NAMESPACE = {name: getattr(sp, name) for name in dir(sp) if not name.startswith("_")}
NAMESPACE.update(rad=lambda v: v * sp.pi / 180, deg=lambda v: v * 180 / sp.pi, function_range=function_range)
for name in "a b c k r t x y A B K R T".split():
    NAMESPACE[name] = sp.Symbol(name)


class Report:
    def __init__(self):
        self.fails: list[str] = []
        self.unchecked: list[str] = []
        self.skipped: list[str] = []
        self.counts = {"lines": 0, "comparisons": 0, "answers": 0, "tex": 0}

    def fail(self, where, msg):
        self.fails.append(f"{where}: {msg}")


# ---------- TeX to SymPy ----------

def strip_braces(s: str, start: int) -> tuple[str, int]:
    """The {...} group starting at s[start] == '{', and the index after it."""
    depth = 0
    for i in range(start, len(s)):
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                return s[start + 1:i], i + 1
    return s[start + 1:], len(s)


def split_top(s: str, seps: list[str]) -> list[str]:
    """Split at any separator that sits outside brackets and braces."""
    out, depth, cur, i = [], 0, "", 0
    while i < len(s):
        ch = s[i]
        if ch in "({[":
            depth += 1
        elif ch in ")}]":
            depth -= 1
        if depth == 0:
            hit = next((sep for sep in seps if s.startswith(sep, i)
                        and not (sep[0] == "\\" and i + len(sep) < len(s) and s[i + len(sep)].isalpha())), None)
            if hit:
                out.append(cur)
                cur = ""
                i += len(hit)
                continue
        cur += ch
        i += 1
    out.append(cur)
    return out


def statements(tex: str) -> list[list[str]]:
    """A line of working as statements (split at implies, commas, colons, words), each a chain of = pieces."""
    s = tex
    # \text{...} is a word or a unit: either way it ends a piece.
    while "\\text{" in s:
        i = s.index("\\text{")
        _, j = strip_braces(s, i + 5)
        s = s[:i] + " \\Rightarrow " + s[j:]
    s = re.sub(r"(\d)\\,(\d)", r"\1\2", s)  # 19\,600
    s = re.sub(r"\\[,;!: ]", " ", s)  # spacing
    stmts = split_top(s, ["\\Rightarrow", "\\implies", "\\therefore", "\\qquad", "\\quad", ",", ":", ";"])
    chains = []
    for st in stmts:
        for part in split_top(st, ["\\leq", "\\geq", "\\neq", "<", ">", "\\le", "\\ge"]):
            pieces = split_top(part, ["=", "\\approx"])
            if len(pieces) > 1:
                chains.append([p.strip() for p in pieces])
    return chains


def approx_info(piece: str) -> tuple[bool, int | None, bool]:
    """(approximate?, decimals of a lone number, truncated?) for one piece as written."""
    trunc = "\\ldots" in piece or "\\dots" in piece
    bare = re.sub(r"\\ldots|\\dots|\^\\circ|\^\{\\circ\}|\s|\\[,;!]", "", piece)
    lone = re.fullmatch(r"-?\d+\.(\d+)", bare)
    has_decimal = re.search(r"\d\.\d", piece) is not None
    return (trunc or has_decimal), (len(lone.group(1)) if lone else None), trunc


def to_sympy(piece: str, deg: bool):
    """Parse one piece of TeX, or None if it isn't plain maths (a function name, a limit, an integral...)."""
    s = piece.strip()
    if not s or re.search(r"\\(lim|int|to|infty|pm|mathbb|cdots|in\b|sum)|\\frac\{\\mathrm\{d\}|'|\\mathrm\{(?!e\})|\\(R|L)ightarrow|\\cup|\\cap", s):
        return None
    s = re.sub(r"\\mathrm\{e\}", "e", s)
    s = re.sub(r"\\ldots|\\dots|\^\\circ|\^\{\\circ\}|\\displaystyle|\\[,;!]|\\ ", " ", s)
    s = s.replace("\\left", "").replace("\\right", "").replace("\\tfrac", "\\frac").replace("\\dfrac", "\\frac")
    s = re.sub(r"\\(sin|cos|tan|sec|csc|cot)\^\{?(\d)\}?\s*(\d*(?:\\[a-zA-Z]+|[a-zA-Z]))", r"\\\1^{\2}(\3)", s)  # \sin^2 2\theta
    # \sin\theta \cdot 2a would read as sin(theta*2a): bracket a short argument.
    s = re.sub(r"\\(sin|cos|tan|sec|csc|cot)(?![a-zA-Z])\s*(\d*\.?\d*\s*(?:\\(?:theta|alpha|beta|phi|pi)(?![a-zA-Z])|[a-zA-Z])|\d+\.?\d*)", r"\\\1(\2)", s)
    s = re.sub(r"(?<![\\a-zA-Z])([a-zA-Z])\s*\(", r"\1 \\cdot (", s)  # a(1 - x) is a product, not a function
    try:
        e = parse_latex(s)
    except Exception:
        return None
    if isinstance(e, sp.Basic) and not isinstance(e, sp.Expr):
        return None
    if any(isinstance(f, sp.core.function.AppliedUndef) for f in e.atoms(sp.Function)) or e.has(sp.Derivative, sp.Integral):
        return None
    e = e.subs({sp.Symbol("e"): sp.E, sp.Symbol("pi"): sp.pi})
    if deg:
        e = e.replace(lambda n: isinstance(n, TRIG), lambda n: n.func(n.args[0] * sp.pi / 180))
        e = e.replace(lambda n: isinstance(n, INVTRIG), lambda n: n * 180 / sp.pi)
    return e


def symbol_values(vals: dict) -> dict:
    out = {}
    for key, value in (vals or {}).items():
        sym = parse_latex(key) if "\\" in key or "_" in key else sp.Symbol(key)
        out[sym] = sp.sympify(value, locals=NAMESPACE) if isinstance(value, str) else sp.nsimplify(value)
    return out


def numeric(e) -> complex | None:
    try:
        v = complex(sp.N(e, 30))
    except Exception:
        return None
    return v if not (math.isnan(v.real) or math.isinf(v.real)) else None


def samples(symbols, n=4, seed=7):
    rng = random.Random(seed)
    return [{s: sp.Float(rng.uniform(0.2, 1.3)) for s in symbols} for _ in range(n)]


def same(a, b, tol_abs=0.0, tol_rel=1e-9) -> bool:
    if a is None or b is None:
        return False
    return abs(a - b) <= max(tol_abs, tol_rel * max(1.0, abs(a), abs(b)))


def tolerance(raw: str) -> tuple[float, float]:
    """(absolute, relative) tolerance a piece as written allows."""
    approx, places, trunc = approx_info(raw)
    if not approx:
        return 0.0, 1e-9
    if places is not None:
        return (10 ** -places if trunc else 0.5 * 10 ** -places + 1e-12), 1e-9
    return 0.0, 2e-4  # an expression built from rounded numbers


def compare_pieces(where, raw_a, raw_b, a, b, vals, rep: Report):
    a, b = a.subs(vals), b.subs(vals)
    free = a.free_symbols | b.free_symbols
    ta, tb = tolerance(raw_a), tolerance(raw_b)
    tol_abs, tol_rel = max(ta[0], tb[0]), max(ta[1], tb[1])
    rep.counts["comparisons"] += 1
    if not free:
        va, vb = numeric(a), numeric(b)
        if not same(va, vb, tol_abs, tol_rel):
            rep.fail(where, f"{raw_a} = {raw_b} does not hold ({fmt(va)} vs {fmt(vb)})")
        return
    if a.free_symbols != b.free_symbols:
        rep.skipped.append(f"{where}: {raw_a} = {raw_b} is an equation in {', '.join(sorted(map(str, free)))} (no values given)")
        return
    for point in samples(sorted(free, key=str)):
        va, vb = numeric(a.subs(point)), numeric(b.subs(point))
        if not same(va, vb, tol_abs, max(tol_rel, 1e-8)):
            rep.fail(where, f"{raw_a} = {raw_b} is not an identity (at {fmt_point(point)}: {fmt(va)} vs {fmt(vb)})")
            return


def fmt(v):
    if v is None:
        return "?"
    return f"{v.real:.10g}" if abs(v.imag) < 1e-12 else f"{v:.6g}"


def fmt_point(p):
    return ", ".join(f"{k}={float(v):.3f}" for k, v in p.items())


def check_line(where, tex, vals, deg, rep: Report, carry=None):
    """Check one line. A line that starts with = (or \\approx) carries on from the last piece
    of the line before (`carry`); returns this line's last piece for the next one."""
    rep.counts["lines"] += 1
    continues = tex.lstrip().startswith(("=", "\\approx"))
    last = None
    for i, chain in enumerate(statements(tex)):
        parsed = [(raw, to_sympy(raw, deg)) for raw in chain]
        if i == 0 and continues and not chain[0]:
            if carry:
                parsed[0] = carry
            else:
                rep.skipped.append(f"{where}: carries on from a line that could not be read")
        for raw, e in parsed:
            if e is None and raw:
                rep.skipped.append(f"{where}: could not read \"{raw}\"")
        for (ra, a), (rb, b) in zip(parsed, parsed[1:]):
            if a is not None and b is not None:
                compare_pieces(where, ra, rb, a, b, vals, rep)
        last = parsed[-1] if parsed[-1][1] is not None else None
    return last


# ---------- answers ----------

def parse_set(tex: str, var: str):
    """'x < -1 \\ \\text{or}\\ x > 4' or '\\frac12 < k < 3' as a SymPy set of the reals."""
    joiner = "or" if re.search(r"\\text\{\s*or\s*\}", tex) else "and"
    pieces = re.split(r"\\ *\\text\{\s*(?:or|and)\s*\}\\ *", tex)
    sets = []
    for piece in pieces:
        bits = re.split(r"(\\leq|\\geq|<|>)", piece)
        terms, ops = bits[0::2], bits[1::2]
        s = sp.S.Reals
        for left, op, right in zip(terms, ops, terms[1:]):
            l_var, r_var = left.strip() == var, right.strip() == var
            if not (l_var or r_var):
                raise ValueError(f"no {var} in {piece}")
            bound = to_sympy(right if l_var else left, False)
            strict = op in "<>"
            less = op in ("<", "\\leq")
            if l_var == less:  # var < b  or  b > var
                s &= sp.Interval(-sp.oo, bound, right_open=strict)
            else:
                s &= sp.Interval(bound, sp.oo, left_open=strict)
        sets.append(s)
    return sp.Union(*sets) if joiner == "or" else sp.Intersection(*sets)


def as_value(where, item, part, deg):
    """Our answer for one check item, as SymPy."""
    if "text" in item:
        if item["text"] not in (part.get("answerText") or ""):
            raise ValueError(f"\"{item['text']}\" is not in the answer")
        return sp.sympify(item["value"], locals=NAMESPACE)
    tex = item["tex"]
    if tex not in (part.get("answer") or "") and tex not in (part.get("answerText") or ""):
        raise ValueError(f"\"{tex}\" is not in the answer")
    kind = item.get("kind", "value")
    if kind == "set":
        return parse_set(tex, item.get("var", "x"))
    if kind == "point":
        return sp.Tuple(*[to_sympy(c, deg) for c in split_top(tex.strip()[1:-1], [","])])
    if kind == "equation":
        lhs, rhs = tex.split("=")
        return sp.Eq(to_sympy(lhs, deg), to_sympy(rhs, deg))
    if kind == "identity":
        return None
    rhs = split_top(tex, ["="])[-1]
    rhs = re.sub(r"\\ *\\text\{[^}]*\}", "", rhs)
    e = to_sympy(rhs, deg)
    if e is None:
        raise ValueError(f"could not read \"{rhs}\"")
    return e


def equal_values(ours, theirs, tol) -> bool:
    if isinstance(ours, sp.Set) or isinstance(theirs, sp.Set):
        return sp.simplify(sp.Complement(ours, theirs)) == sp.S.EmptySet and sp.simplify(sp.Complement(theirs, ours)) == sp.S.EmptySet
    if isinstance(ours, sp.Tuple):
        return len(ours) == len(theirs) and all(equal_values(a, b, tol) for a, b in zip(ours, theirs))
    if isinstance(ours, sp.Equality):
        ratio = sp.simplify((ours.lhs - ours.rhs) / (theirs.lhs - theirs.rhs))
        return not ratio.free_symbols and ratio != 0
    free = sorted(ours.free_symbols | theirs.free_symbols, key=str)
    points = samples(free) if free else [{}]
    return all(same(numeric(ours.subs(p)), numeric(theirs.subs(p)), tol, 1e-9) for p in points)


def check_answers(where, part, rep: Report):
    check = part.get("check", {})
    items = check.get("answers")
    deg = check.get("deg", False)
    if isinstance(items, str):
        rep.unchecked.append(f"{where}: {items}")
        return
    for item in items or []:
        rep.counts["answers"] += 1
        label = item.get("tex") or item.get("text")
        tol = item.get("tol", 0)
        try:
            ours = as_value(where, item, part, deg)
            theirs = sp.sympify(item["scheme"], locals=NAMESPACE)
            derived = sp.sympify(item["derive"], locals=NAMESPACE) if "derive" in item else None
        except Exception as e:  # noqa: BLE001
            rep.fail(where, f"answer {label}: {e}")
            continue
        if isinstance(derived, (list, sp.FiniteSet)) and len(derived) == 1:
            derived = list(derived)[0]
        if item.get("kind") == "identity":
            if derived is None or not equal_values(derived, theirs, tol):
                rep.fail(where, f"answer {label}: the working does not reduce to the scheme's {item['scheme']}")
            continue
        if item.get("kind") == "positive":
            if sp.simplify(ours - theirs) != 0 or not (sp.minimum(theirs, *theirs.free_symbols, sp.S.Reals) > 0):
                rep.fail(where, f"answer {label}: {item['value']} is not shown positive")
            continue
        try:
            if not equal_values(ours, theirs, tol):
                rep.fail(where, f"answer {label} ({ours}) differs from the scheme's {item['scheme']}")
            if derived is not None and not equal_values(derived, theirs, max(tol, 1e-9)):
                rep.fail(where, f"answer {label}: working it out again gives {derived}, not the scheme's {item['scheme']}")
        except Exception as e:  # noqa: BLE001
            rep.fail(where, f"answer {label}: could not compare ({type(e).__name__}: {e})")


# ---------- the rest ----------

def strings(obj, path=""):
    """Every student-facing string in a solution, with where it is (the checker's own data left out)."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k != "check":
                yield from strings(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from strings(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield path, obj


def tex_jobs(qid, sol):
    jobs = []
    for path, s in strings(sol):
        key = path.rsplit(".", 1)[-1]
        if key in ("tex", "answer"):
            jobs.append({"where": f"{qid} {path}", "tex": s, "display": True})
        elif key in ("ask", "why", "text", "answerText", "method"):
            if s.count("\\(") != s.count("\\)"):
                jobs.append({"where": f"{qid} {path}", "tex": "\\unbalancedInlineMath", "display": False})
            for m in re.finditer(r"\\\((.+?)\\\)", s):
                jobs.append({"where": f"{qid} {path}", "tex": m.group(1), "display": False})
    return jobs


def render_check(jobs, rep: Report):
    rep.counts["tex"] += len(jobs)
    out = subprocess.run(["node", str(HERE / "render_tex.mjs")], input=json.dumps(jobs), capture_output=True, text=True, cwd=ROOT)
    if out.returncode != 0:
        rep.fail("KaTeX", out.stderr.strip() or "render_tex.mjs failed")
        return
    for bad in json.loads(out.stdout):
        rep.fail(bad["where"], f"TeX does not render: {bad['error']}")


def check_solution(path: Path, parts_by_id: dict, rep: Report):
    sol = json.loads(path.read_text())
    qid = sol["id"]
    if path.stem != qid:
        rep.fail(qid, f"file is named {path.name}")
    bank = parts_by_id.get(qid)
    if not bank:
        rep.fail(qid, "not in parts.json")
        return []
    if not bank.get("sol"):
        rep.fail(qid, "parts.json has no sol: 1 for it")
    for where, s in strings(sol):
        if "\u2014" in s:
            rep.fail(f"{qid} {where}", "em dash in student-facing text")
        if re.search(r"[\x00-\x1f]", s):
            rep.fail(f"{qid} {where}", "control character (a JSON escape like \\t or \\f where \\\\ was meant?)")

    total, labels = 0, set()
    for part in sol["parts"]:
        where = f"{qid}({part['label']})" if part["label"] else qid
        if part["label"] in labels:
            rep.fail(where, "label used twice")
        labels.add(part["label"])
        if not part.get("method") or not part.get("steps") or not (part.get("answer") or part.get("answerText")):
            rep.fail(where, "needs a method, steps and an answer")
        check = part.get("check", {})
        deg = check.get("deg", False)
        tagged = [m for st in part["steps"] for m in st.get("marks", [])] + part.get("answerMarks", [])
        for m in tagged:
            if not MARK_CODE.match(m):
                rep.fail(where, f"{m} is not a mark code")
        if tagged != check.get("marks"):
            rep.fail(where, f"marks tagged {tagged} but the scheme has {check.get('marks')}")
        total += sum(int(re.search(r"\d", m).group()) for m in tagged)

        part_vals = symbol_values(check.get("vals"))
        carry = None  # the last piece of the line before, for a line that starts with =
        for i, step in enumerate(part["steps"]):
            sw = f"{where} step {i + 1}"
            step_check = step.get("check", True)
            if "tex" not in step:
                carry = None
                continue
            if step_check is False:
                rep.unchecked.append(f"{sw}: {step['tex']} (a formula or statement, not a calculation)")
                carry = None
                continue
            vals = {**part_vals, **symbol_values(step_check.get("vals") if isinstance(step_check, dict) else None)}
            carry = check_line(sw, step["tex"], vals, deg, rep, carry)
        if part.get("answer"):
            check_line(f"{where} answer", part["answer"], part_vals, deg, rep, carry)
        check_answers(where, part, rep)
        if "assert" in check:
            try:
                ok = eval(check["assert"], {**NAMESPACE, "__builtins__": {"range": range, "any": any, "all": all}})  # noqa: S307
            except Exception as e:  # noqa: BLE001
                ok = False
                rep.fail(where, f"assert raised {e}")
            if not ok:
                rep.fail(where, f"assert failed: {check['assert']}")
            rep.counts["answers"] += 1

    if total != sol["m"] or total != bank.get("m"):
        rep.fail(qid, f"marks tagged add up to {total}; the solution says {sol['m']}, parts.json {bank.get('m')}")
    return tex_jobs(qid, sol)


def main():
    argv = sys.argv[1:]
    only = argv[argv.index("--only") + 1] if "--only" in argv else ""
    if only:
        argv.remove("--only")
        argv.remove(only)
    args = [a for a in argv if not a.startswith("-")]
    verbose = "-v" in argv
    slugs = args or [p.parent.name for p in sorted((ROOT / "public/question-bank").glob("*/solutions"))]
    rep, jobs, n = Report(), [], 0
    for slug in slugs:
        bank_dir = ROOT / "public/question-bank" / slug
        parts = json.loads((bank_dir / "parts.json").read_text())
        parts_by_id = {p["id"]: p for p in parts}
        files = sorted((bank_dir / "solutions").glob(f"{only}*.json"))
        have = {f.stem for f in files}
        for p in parts:
            if p.get("sol") and p["id"].startswith(only) and p["id"] not in have:
                rep.fail(p["id"], "parts.json says sol: 1 but there is no solution file")
        for f in files:
            jobs += check_solution(f, parts_by_id, rep)
            n += 1
    render_check(jobs, rep)

    c = rep.counts
    print(f"Checked {n} solutions: {c['lines']} lines of working ({c['comparisons']} equalities), {c['answers']} answers, {c['tex']} pieces of TeX.")
    if rep.unchecked:
        print(f"\nNot checkable by code ({len(rep.unchecked)}), for a person to read:")
        for u in rep.unchecked if verbose else [u for u in rep.unchecked if "step" not in u]:
            print("  -", u)
        if not verbose:
            print(f"  (and {sum('step' in u for u in rep.unchecked)} formula or statement lines; -v lists them)")
    if rep.skipped:
        print(f"\nSkipped pieces ({len(rep.skipped)}): {'listed below' if verbose else 'run with -v to list them'}")
        if verbose:
            for s in rep.skipped:
                print("  -", s)
    if rep.fails:
        print(f"\nFAILED ({len(rep.fails)}):")
        for f in rep.fails:
            print("  x", f)
        sys.exit(1)
    print("\nAll checks passed.")


if __name__ == "__main__":
    main()
