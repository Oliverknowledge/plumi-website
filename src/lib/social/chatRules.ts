/**
 * The group chat's message rule, so a student is told before sending that a message has a link or a
 * word Plumi does not allow, instead of waiting on a refusal from the server.
 *
 * THE SERVER DECIDES. `chat_refusal` in Supabase/migrations/0109_groupChat.sql (with the words of
 * 0111) is the authority and this is its mirror, step for step: the iPad's ChatRules.swift is the other
 * mirror. The word list is a table there and can grow without a release; a term added on the server is
 * refused by the server at once and reaches this copy at the next release. `chat.vectors.json` holds the
 * message vectors of the app's chat_test.sql with the answers the real function gave, and
 * `npm run social:test` fails if this file disagrees with any of them.
 *
 * THE STEPS (as chat_refusal takes them)
 *  1. Tidy: NFC; soft hyphens, zero-width spaces, word joiners, byte-order marks and direction controls
 *     dropped; whitespace and control runs become one space; trimmed. 1 to 280 characters (code points).
 *  2. Fold: compatibility decomposition (fullwidth and styled letters become plain), combining marks,
 *     joiners and variation selectors dropped, lookalike Cyrillic, Greek and Latin letters made ASCII,
 *     lower case.
 *  3. Links: a scheme, www, word.tld, "dot com", an email or @handle, a phone number (9 or more digits
 *     in one run of digits, spaces, hyphens, brackets and +).
 *  4. Words: leetspeak folded (0 1 3 4 5 7 8 @ $), anything not a letter or * splits words, runs of
 *     single letters join ("f u c k"), neighbouring words are also tried joined ("sh it"). Contact terms
 *     refuse as a link, the rest as language.
 */

export const MAX_LENGTH = 280;
export const RULES_LINE = "No links. No swearing. Be kind.";

export type ChatRefusal = "empty" | "too_long" | "link" | "language";
export type Verdict = { ok: true; body: string } | { ok: false; refusal: ChatRefusal };

/** One short line for the student. Never says which word matched. */
export function refusalLine(r: ChatRefusal): string {
  switch (r) {
    case "empty": return "Write something first";
    case "too_long": return "Keep it under 280 characters";
    case "link": return "No links or contact details";
    case "language": return "No swearing, please";
  }
}

/* ── 1. Tidy ─────────────────────────────────────────────────────────── */

const dropped = (v: number) =>
  v === 0xad || v === 0x180e || v === 0x200b || v === 0x200e || v === 0x200f ||
  (v >= 0x202a && v <= 0x202e) || (v >= 0x2060 && v <= 0x2064) || (v >= 0x2066 && v <= 0x2069) || v === 0xfeff;

const isSpace = (v: number) =>
  (v >= 0x01 && v <= 0x20) || (v >= 0x7f && v <= 0xa0) || v === 0x1680 || (v >= 0x2000 && v <= 0x200a) ||
  v === 0x2028 || v === 0x2029 || v === 0x202f || v === 0x205f || v === 0x3000;

export function tidy(raw: string): string {
  let out = "";
  let pendingSpace = false;
  for (const ch of raw.normalize("NFC")) {
    const v = ch.codePointAt(0)!;
    if (dropped(v)) continue;
    if (isSpace(v)) { pendingSpace = true; continue; }
    if (pendingSpace && out.length > 0) out += " ";
    pendingSpace = false;
    out += ch;
  }
  return out;
}

/* ── 2. Fold ─────────────────────────────────────────────────────────── */

/** `chat_fold`'s translate(), pair for pair. */
const LOOK_FROM = Array.from("аеёорсухкмнвтіјѕԁӏԛԝһАЕЁОРСУХКМНВТІЈЅαβεικνορτυχΑΒΕΙΚΝΟΡΤΥΧΖΗΜøØłŁđĐħıßæÆœŒþ");
const LOOK_TO = Array.from("aeeopcyxkmhbtijsdlqwhaeeopcyxkmhbtijsabeikvoptuxabeiknoptyxzhmoollddhisaaoop");
const LOOKALIKES = new Map<string, string>();
LOOK_FROM.slice(0, Math.min(LOOK_FROM.length, LOOK_TO.length)).forEach((c, i) => { if (!LOOKALIKES.has(c)) LOOKALIKES.set(c, LOOK_TO[i]); });

export function fold(raw: string): string {
  let out = "";
  for (const ch of tidy(raw).normalize("NFKD")) {
    const v = ch.codePointAt(0)!;
    if ((v >= 0x0300 && v <= 0x036f) || (v >= 0x1ab0 && v <= 0x1aff) || (v >= 0x1dc0 && v <= 0x1dff) ||
        (v >= 0x20d0 && v <= 0x20ff) || (v >= 0xfe20 && v <= 0xfe2f) || v === 0x200c || v === 0x200d ||
        (v >= 0xfe00 && v <= 0xfe0f)) continue;
    out += LOOKALIKES.get(ch) ?? ch;
  }
  return out.toLowerCase();
}

/* ── 3. Links ────────────────────────────────────────────────────────── */

const TLDS = "com|net|org|co|uk|io|gg|ly|tv|xyz|info|biz|link|site|online|club|live|" +
  "app|dev|ai|me|be|ca|de|fr|ru|cn|ws|cc|tk|ml|ga|cf|gq|pw|top|fun|store|" +
  "shop|blog|chat|page|gl|gd|vu|lol|wtf|sex|porn|xxx|onion|bio|ink|zip|" +
  "mov|cam|icu|nz|au|ie|es|nl|se|ch|eu|edu|gov|ac|sch|im|fm|sh|to|gs|tw";

/**
 * JavaScript's \b counts only ASCII letters as word characters; the server's regex counts every Unicode
 * letter and digit, so "世界dot com" is not a link there. These are \b with the server's meaning.
 */
const W = "[\\p{L}\\p{N}_]";
const START = `(?<!${W})`;
const END = `(?!${W})`;

const LINK_PATTERNS: RegExp[] = [
  "[a-z]\\s*:\\s*/\\s*/",
  `${START}https?${END}`,
  `${START}w\\s*w\\s*w${END}`,
  `[a-z0-9]\\.(${TLDS})${END}`,
  `[a-z0-9]\\s*\\.\\s*(com|net|org|xyz|biz|onion)${END}`,
  `${START}d\\s*[o0]\\s*t\\s*(com|net|org|co|uk|io|gg|app|tv)${END}`,
  "@[a-z0-9_]",
  "[a-z0-9._%+-]@",
].map((p) => new RegExp(p, "u"));

const PHONE_RUN = /(^|[^0-9.,])(\+?[0-9][0-9 ()+-]*[0-9])/g;

export function hasLink(folded: string): boolean {
  if (LINK_PATTERNS.some((r) => r.test(folded))) return true;
  for (const m of folded.matchAll(PHONE_RUN)) {
    if ((m[2].match(/[0-9]/g) ?? []).length >= 9) return true;
  }
  return false;
}

/* ── 4. Words ────────────────────────────────────────────────────────── */

type Match = "part" | "word" | "phrase";
type Category = "language" | "contact";
export interface Term { term: string; match: Match; category: Category }

const list = (words: string, match: Match, category: Category): Term[] =>
  words.split(",").map((t) => ({ term: t.trim(), match, category }));

/** The seed of `public.chat_banned_term` (0109, then 0111), in the migrations' order. */
export const TERMS: readonly Term[] = [
  ...list("fuck, phuck, shit, cunt, bitch, bastard, wank, twat, bollock, whore, slut, skank, " +
    "nigger, nigga, faggot, dickhead, asshole, arsehole, bellend, knobhead, tosser, " +
    "dildo, porn, jizz, piss, spastic, tranny", "part", "language"),
  ...list("ass, asses, arse, arses, dick, dicks, cock, cocks, prick, pricks, tits, titty, " +
    "titties, cum, anal, rape, raped, rapist, nonce, paedo, pedo, crap, crappy, bum, " +
    "slag, slags, pussy, minge, spaz, retard, retarded, retards, fag, fags, dyke, lesbo, " +
    "paki, pakis, chink, coon, wog, kike, gook, spic, kys, nude, nudes, horny, sexy, hoes, " +
    "shag, fuk, fukin, fuking, fck, fcking, fking, fkn, stfu, gtfo, wtf, omfg", "word", "language"),
  ...list("kill yourself, kill urself, kill ur self, kill your self, neck yourself, hang yourself, " +
    "go die, send nudes", "phrase", "language"),
  ...list("snapchat, whatsapp, instagram, onlyfans, gmail, hotmail, icloud", "part", "contact"),
  ...list("yahoo, kik, discord, insta", "word", "contact"),
  ...list("dm me, snap me, my snap, my insta", "phrase", "contact"),
  // 0111_chatSlang.sql: sexual slang students use, whole words so "lagoon" and "nutty" are not caught.
  ...list("goon, goons, gooning, gooned, gooner, gooners, goonin, goonmaxxing, gyat, thot, thots, fap, " +
    "fapping, fapped, coom, coomer, cooming, nutted, nutting, milf, dilf, nsfw, jork, jorking", "word", "language"),
  ...list("hentai, ahegao", "part", "language"),
  ...list("bust a nut, jerk off, jack off", "phrase", "language"),
];

/** `chat_term_pattern`: every letter may repeat; inner letters of a word may be *. */
export function termPattern(term: string): string {
  const letters = Array.from(term);
  if (term.includes(" ") || letters.length < 3) return letters.map((l) => (l === " " ? " " : `${l}+`)).join("");
  let p = `${letters[0]}+`;
  for (const l of letters.slice(1, -1)) p += `[${l}*]+`;
  return p + `${letters[letters.length - 1]}+`;
}

interface Compiled { term: Term; anywhere: RegExp; whole: RegExp }

/** Checked in the server's order: contact terms first, then by term. */
const COMPILED: Compiled[] = [...TERMS]
  .sort((a, b) => {
    const ka = a.category === "contact" ? 0 : 1, kb = b.category === "contact" ? 0 : 1;
    return ka - kb || (a.term < b.term ? -1 : a.term > b.term ? 1 : 0);
  })
  .map((term) => {
    const p = termPattern(term.term);
    return { term, anywhere: new RegExp(p), whole: new RegExp(`(^| )${p}( |$)`) };
  });

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s" };

export function words(folded: string): string[] {
  const plain = Array.from(folded).map((c) => LEET[c] ?? c).join("");
  // Anything that is not a-z or * splits words.
  const raw = plain.split(/[^a-z*]+/).filter(Boolean);
  const tokens: string[] = [];
  let run = "";
  for (const token of raw) {
    if (token.length === 1) run += token;
    else {
      if (run) { tokens.push(run); run = ""; }
      tokens.push(token);
    }
  }
  if (run) tokens.push(run);
  return tokens;
}

function termRefusal(folded: string): ChatRefusal | null {
  const tokens = words(folded);
  if (tokens.length === 0) return null;
  const joined = tokens.join(" ");
  const pairs: string[] = [];
  for (let i = 0; i + 1 < tokens.length; i++) {
    if (tokens[i].length >= 2 && tokens[i + 1].length >= 2) pairs.push(tokens[i] + tokens[i + 1]);
  }
  const pairText = pairs.join(" ");
  const found = (r: RegExp, text: string) => text !== "" && r.test(text);
  for (const c of COMPILED) {
    let hit: boolean;
    switch (c.term.match) {
      case "phrase": hit = found(c.whole, joined); break;
      case "part": hit = found(c.anywhere, joined) || found(c.whole, pairText); break;
      case "word": hit = found(c.whole, joined) || found(c.whole, pairText); break;
    }
    if (hit) return c.term.category === "contact" ? "link" : "language";
  }
  return null;
}

/* ── The whole rule ──────────────────────────────────────────────────── */

export function refusal(raw: string): ChatRefusal | null {
  const tidied = tidy(raw);
  if (tidied === "") return "empty";
  if (Array.from(tidied).length > MAX_LENGTH) return "too_long";
  const folded = fold(tidied);
  if (hasLink(folded)) return "link";
  return termRefusal(folded);
}

/** The message as it will be stored, or why it will not be. */
export function check(raw: string): Verdict {
  const why = refusal(raw);
  return why ? { ok: false, refusal: why } : { ok: true, body: tidy(raw) };
}
