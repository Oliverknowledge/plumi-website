/**
 * Holds the browser's copy of the library chat's rules (src/lib/social/librarySpam.ts, with chatRules.ts under it)
 * to the REAL server functions over a large corpus, and fails on any disagreement.
 *
 *   PGHOST=localhost PGPORT=5545 PGUSER=postgres PGDATABASE=postgres npm run social:fuzz-library
 *
 * For every message it asks the database what `send_library_message` would answer before it touches a table:
 *   chat_refusal(chat_tidy(body))   -> empty | too_long | link | language
 *   then library_spam(chat_tidy(body)) -> spam | shouting
 * and asks `check` (the browser's copy) the same, and diffs the two. The repeat rule needs history, so it is
 * covered by the end-to-end run (scripts/social-e2e.ts), not here.
 *
 * The corpus is generated from a fixed seed, so a failure reproduces: spam shapes (repeats, mashing, keyboard
 * rows, symbols, emoji), shouting at every ratio around the 4/5 line, every script the founder named
 * (Chinese, Japanese, Korean, Arabic, Hindi, Thai, Hebrew, Persian, Tamil, Bengali), lookalike and full-width
 * letters, zero-width and combining characters, leet, and plain sentences that must pass.
 *
 * FUZZ_SEED=n picks another corpus; FUZZ_SAMPLE=10 runs a tenth of it. It only reads: it calls pure functions, and refuses any database that is not on this machine.
 */
import { execFileSync } from "node:child_process";
import * as spamRules from "../src/lib/social/librarySpam";

const host = process.env.PGHOST ?? "";
if (!(host === "localhost" || host === "127.0.0.1" || host === "::1" || host.startsWith("/"))) {
  console.error("social:fuzz-library only runs against a database on this machine. Set PGHOST=localhost (and PGPORT, PGUSER, PGDATABASE).");
  process.exit(2);
}

/* ── a seeded generator ─────────────────────────────────────────────── */
let seed = Number(process.env.FUZZ_SEED ?? 20261101);
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const chars = (s: string) => Array.from(s);
const rep = (s: string, n: number) => s.repeat(n);

const WORDS = ["hello", "anyone", "revising", "physics", "chem", "paper", "two", "tomorrow", "good", "luck", "thanks", "the", "a", "is", "revision", "question", "mark", "scheme",
  "quiet", "library", "focus", "timer", "break", "tea", "maths", "biology", "mock", "exam", "gcse", "alevel", "pomodoro", "study", "stuck", "help", "please", "nice", "work", "lol", "haha", "yes", "no", "ok",
  "strengths", "rhythms", "crypt", "lynx", "nymph", "myths", "psych", "sphynx", "tryst", "gypsy", "glyph", "rhythm", "syzygy", "cwm", "pfft", "shhh", "hmm", "brr", "mmm", "tsk", "psst"];
const PUNCT = ["!", "?", ".", ",", ";", ":", "-", "_", "*", "#", "~", "^", "%", "&", "(", ")", "[", "]", "{", "}", "<", ">", "=", "+", "/", "\\", "|", "\"", "'", "`", "@", "$"];
const EMOJI = ["\u{1F600}", "\u{1F44D}", "\u{1F525}", "\u{2764}\u{FE0F}", "\u{1F4DA}", "\u{2728}", "\u{1F389}", "\u{1F4AF}", "\u{1F64F}", "\u{1FAE0}", "\u{2B50}", "\u{1F9E0}"];
const KEYROWS = ["qwert", "werty", "asdfg", "sdfgh", "dfghj", "fghjk", "ghjkl", "zxcvb", "xcvbn", "cvbnm", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
const SCRIPTS = [
  "今天一起复习物理吧", "今日は一緒に勉強しましょう", "오늘 같이 공부해요",
  "هل أحد يراجع الفيزياء", "क्या कोई भौतिकी पढ़ रहा है", "ใครอ่านฟิสิกส์บ้าง",
  "מישהו לומד פיזיקה", "آیا کسی فیزیک میخواند", "யாராவது பொருளியல் படிக்கிறார்களா",
  "কেউ কি পদার্থবিজ্ঞান পড়ছে", "добрый день всем", "καλημέρα σε όλους",
  "café crème brûlée", "straße münchen", "señor niño", "ångström",
];
const LOOK = ["а", "е", "о", "р", "с", "у", "х", "α", "ο", "ρ", "ａ", "ｂ", "ｃ", "K", "Ⅰ", "ⓐ"];
const INVIS = ["​", "‍", "‌", "­", "⁠", "﻿", "‮", "‎", "́", "̈", "️", "\t", "\n", " ", "　", " "];

const corpus: string[] = [];
const add = (s: string) => { if (!s.includes("\u0000")) corpus.push(s); };

// the hand-made ones
for (const s of ["", " ", "hi", "aaaaa", "aaaaaa", "aaaaaaa", "?????!!!!!", "hahahahaha", "no no no no", "no no no", "lolololol", "asdfghjkl", "qwertyui", "zxcvbnm",
  "ASDFGHJKL", "THIS IS FINE", "THIS IS ABSOLUTELY FINE", "This Is Fine", "WHY IS NOBODY ANSWERING ME", "rhythms", "strengths", "bcdfghjk", "bcdfghj", "bcdfghjkl m",
  "\u{1F600}\u{1F600}\u{1F600}\u{1F600}\u{1F600}\u{1F600}\u{1F600}\u{1F600}\u{1F600}", "\u{1F600}".repeat(8), "!!!!!!!!!", "........", "!!!!!!!!", "- - - - - - - - -",
  "今天一起复习物理吧", "❤❤❤❤❤❤❤❤❤", "a b c d e f g h", "ok ok ok ok", "ha ha ha ha", "yes yes yes", "the the the the",
  "good luck everyone with the maths paper tomorrow", "anyone doing q3?", "see you", "hello", "¡¡¡¡¡¡¡¡¡", "¿¿¿¿¿¿¿¿¿", "×÷×÷×÷×÷×"]) add(s);

// the same character six or more times, in text, in caps, in digits, in symbols, in emoji
for (let i = 0; i < 1500; i++) {
  const c = pick([...chars("abcdefghijklmnopqrstuvwxyz0123456789"), ...PUNCT, ...EMOJI, " ", "一", "ا", "א"]);
  const n = int(3, 9);
  add(`${rnd() < .5 ? pick(WORDS) + " " : ""}${rep(c, n)}${rnd() < .5 ? " " + pick(WORDS) : ""}`);
}
// short runs repeated
for (let i = 0; i < 2000; i++) {
  const unit = chars(pick(WORDS) + pick(["", " ", "-", "!"])).slice(0, int(1, 8)).join("") || "ab";
  const n = int(2, 6);
  add(`${rnd() < .3 ? pick(WORDS) + " " : ""}${rep(unit, n)}${rnd() < .3 ? " " + pick(WORDS) : ""}`);
  add(rep(unit + (rnd() < .5 ? " " : ""), n));
}
// keyboard rows and vowel-less words, inside and around other text
for (let i = 0; i < 1500; i++) {
  const row = pick(KEYROWS);
  const w = row.slice(int(0, 2), int(4, row.length));
  add(`${pick(WORDS)} ${rnd() < .5 ? w : w.toUpperCase()} ${pick(WORDS)}`);
  const consonants = chars("bcdfghjklmnpqrstvwxz");
  add(Array.from({ length: int(5, 12) }, () => pick(consonants)).join(""));
  add(`${pick(WORDS)} ${Array.from({ length: int(6, 10) }, () => pick(consonants)).join("")}${rnd() < .3 ? "y" : ""}`);
}
// only symbols and emoji, at lengths around 8; sprinkled with one letter or digit
const SYM = [...PUNCT, ...EMOJI, " ", "©", "®", "•", "…", "→", "✓", "♠", "。", "、", "！", "？", "£", "€", "°", "±", "×", "÷", "★", "♪", "\u{1F680}"];
for (let i = 0; i < 3000; i++) {
  const len = int(5, 14);
  const s = Array.from({ length: len }, () => pick(SYM)).join("");
  add(s);
  if (rnd() < .4) { const a = chars(s); a[int(0, a.length - 1)] = pick(["a", "7", "中", "ا", "z"]); add(a.join("")); }
}
// shouting at every ratio around four in five
for (let i = 0; i < 2500; i++) {
  const letters = int(8, 24), caps = Math.max(0, Math.min(letters, Math.round(letters * (int(60, 100) / 100))));
  const idx = new Set<number>(); while (idx.size < caps) idx.add(int(0, letters - 1));
  let s = "";
  for (let k = 0; k < letters; k++) { const l = pick(chars("abcdefghijklmnopqrstuvwxyz")); s += idx.has(k) ? l.toUpperCase() : l; if (rnd() < .15) s += " "; }
  add(s);
  add(`${s.trim()}${pick(["", "!", "!!!", "?", "\u{1F600}", " 123", " 中文"])}`);
}
// other scripts: alone, repeated, mixed with symbols
for (let i = 0; i < 2500; i++) {
  const s = pick(SCRIPTS);
  add(s); add(`${s} ${s}`); add(`${s}${rep(pick(SYM), int(1, 6))}`); add(`${rep(pick(SYM), int(1, 9))}${s}`);
  add(`${pick(WORDS)} ${s} ${rnd() < .5 ? pick(EMOJI) : ""}`);
  add(chars(s).join(pick([" ", "", "​", "-"])));
}
// lookalikes, full-width, invisible and combining characters, leet
for (let i = 0; i < 4000; i++) {
  const base = rnd() < .5 ? pick(WORDS) + " " + pick(WORDS) : rep(pick(chars("abcxyzo")), int(2, 8)) + pick(WORDS);
  const out: string[] = [];
  for (const ch of chars(base)) {
    out.push(rnd() < .12 ? pick(LOOK) : ch);
    if (rnd() < .12) out.push(pick(INVIS));
  }
  add(out.join(""));
  add(chars(base).map((c) => (rnd() < .3 ? ({ a: "4", e: "3", i: "1", o: "0", s: "5", t: "7" } as Record<string, string>)[c] ?? c : c)).join(""));
  add(base.toUpperCase()); add(base.normalize("NFKD")); add(base.split("").map((c) => String.fromCodePoint(c.codePointAt(0)! + (/[a-z]/.test(c) ? 0xff41 - 97 : 0))).join(""));
}
// plain sentences, which must pass, and sentences of every length for the length rules
for (let i = 0; i < 3000; i++) {
  add(Array.from({ length: int(1, 14) }, () => pick(WORDS)).join(" ") + pick(["", ".", "!", "?", " :)", " \u{1F44D}"]));
}
for (const n of [279, 280, 281, 300]) { add(rep("a b ", n / 4)); add(rep("x", n)); add(rep("hello there ", Math.ceil(n / 12)).slice(0, n)); add(rep("中", n)); add(rep("\u{1F600}", n)); }
// random soup of everything
for (let i = 0; i < 3000; i++) {
  const pool = [...chars("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789   "), ...PUNCT, ...EMOJI, ...LOOK, ...INVIS, "中", "ا", "é", "ß", "ı", "İ", "ø"];
  add(Array.from({ length: int(1, 40) }, () => pick(pool)).join(""));
}

// FUZZ_SAMPLE=10 takes every tenth message: a quick run (the full corpus takes a few minutes in chat_refusal).
const every = Math.max(1, Number(process.env.FUZZ_SAMPLE ?? 1));
const unique = [...new Set(corpus)].filter((_, i) => i % every === 0);

/* ── what the server says ───────────────────────────────────────────── */
const lines = unique.map((s, i) => `${i}\t${Buffer.from(s, "utf8").toString("base64")}`).join("\n");
const sql = `
CREATE TEMP TABLE fuzz (id int, b64 text);
COPY fuzz FROM stdin;
${lines}
\\.
SELECT id || E'\\t' || coalesce(
  public.chat_refusal(public.chat_tidy(convert_from(decode(b64, 'base64'), 'UTF8'))),
  public.library_spam(public.chat_tidy(convert_from(decode(b64, 'base64'), 'UTF8'))),
  '-')
FROM fuzz ORDER BY id;
`;
let out: string;
try {
  out = execFileSync("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], { input: sql, maxBuffer: 1 << 28, stdio: ["pipe", "pipe", "pipe"] }).toString();
} catch (e) {
  console.error((e as { stderr?: Buffer }).stderr?.toString() || String(e));
  process.exit(2);
}
const server = new Map<number, string>();
for (const l of out.split("\n")) { if (!l) continue; const [id, why] = l.split("\t"); server.set(Number(id), why); }

/* ── what the browser's copy says, and the diff ─────────────────────── */
const mine = (s: string): string => {
  const v = spamRules.check(s, [], 0);
  return v.ok ? "-" : v.refusal;
};
const tally = new Map<string, number>();
const diffs: string[] = [];
unique.forEach((s, i) => {
  const want = server.get(i), got = mine(s);
  tally.set(want ?? "?", (tally.get(want ?? "?") ?? 0) + 1);
  if (want !== got) diffs.push(`${JSON.stringify(s).slice(0, 90)}  server=${want}  browser=${got}`);
});
console.log(`corpus ${unique.length} messages (seed ${process.env.FUZZ_SEED ?? 20261101}); server verdicts: ${[...tally.entries()].sort().map(([k, v]) => `${k} ${v}`).join(", ")}`);
if (diffs.length) {
  console.log(`${diffs.length} DISAGREEMENTS:`);
  for (const d of diffs.slice(0, 60)) console.log("  " + d);
  process.exit(1);
}
console.log("0 disagreements between the browser's copy and the server's chat_refusal + library_spam.");
