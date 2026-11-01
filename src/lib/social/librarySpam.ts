import { check as chatCheck, fold, tidy, type ChatRefusal } from "./chatRules";

/**
 * The Grand Library chat's spam rule, so a student is told before sending that a message looks like spam,
 * instead of waiting on a refusal from the server. The iPad's LibrarySpam.swift is the other mirror.
 *
 * THE SERVER DECIDES. `public.library_spam` in Supabase/migrations/0123_libraryChatScripts.sql (which replaced
 * 0120's) is the authority and this is its mirror, rule for rule; the repeat check lives in
 * `send_library_message` (0120). It runs after `chat_refusal` (links, contact details, swearing, 1 to 280
 * characters) on the same tidied and folded text. `npm run social:fuzz-library` holds this file to the real
 * function over a corpus; `library.test.ts` holds the hand-made cases.
 *
 * THE RULES (in the server's order; the first that fits wins)
 *   spam      one character six or more times in a row ("aaaaaaa", "?????!!!!!")
 *   spam      a short run repeated four or more times ("hahahahaha", "no no no no")
 *   spam      keyboard mashing: a word of eight or more letters with no vowel, or a keyboard row ("asdfghjkl")
 *   spam      nothing but symbols or emoji, longer than 8 characters (decided by what is left once the
 *             decorative characters are taken out, so a sentence in Chinese, Arabic or Hindi is writing)
 *   shouting  twelve or more letters, four in five of them capitals
 *   repeat    equal (folded) to one of your last five messages in the last five minutes
 *
 * The pace (3 s a message, 8 a minute, 30 in 10 minutes) and the two-hour mute after two reported messages are
 * the server's alone: the page only answers "Slow down a little".
 */

export type SpamRefusal = "spam" | "shouting" | "repeat";
export type LibraryRefusal = ChatRefusal | SpamRefusal;
export type LibraryVerdict = { ok: true; body: string } | { ok: false; refusal: LibraryRefusal };

const KEYBOARD_ROWS = ["qwert", "werty", "asdfg", "sdfgh", "dfghj", "fghjk", "ghjkl", "zxcvb", "xcvbn", "cvbnm"];

// Postgres regexes read characters (code points); JavaScript's need the `u` flag, and `s` so `.` takes any.
const SAME_SIX = new RegExp("(.)\\1{5,}", "su");
const RUN_FOUR = new RegExp("(.{2,6})\\1{3,}", "su");
const LONG_WORD = /[a-z]{8,}/g;
/**
 * The server's character class, range for range: whitespace, ASCII punctuation, Latin-1 symbols, general
 * punctuation to the dingbats, CJK punctuation, variation selectors, full-width punctuation and emoji.
 */
const DECORATIVE = /[\s!-/:-@[-`{-~ -¿×÷ -⯿　-〿︀-️！-／\u{1F000}-\u{1FAFF}]/gu;

/** `public.library_spam(raw)`: why a message is spam or shouting, or null. */
export function spam(raw: string): "spam" | "shouting" | null {
  const tidied = tidy(raw);
  const f = fold(tidied);
  if (SAME_SIX.test(f) || RUN_FOUR.test(f)) return "spam";
  for (const w of f.match(LONG_WORD) ?? []) if (!/[aeiouy]/.test(w)) return "spam";
  const lettersOnly = f.replace(/[^a-z]/g, "");
  if (KEYBOARD_ROWS.some((row) => lettersOnly.includes(row))) return "spam";
  if (Array.from(f).length > 8 && f.replace(DECORATIVE, "") === "") return "spam";
  const letters = (tidied.match(/[A-Za-z]/g) ?? []).length;
  const capitals = (tidied.match(/[A-Z]/g) ?? []).length;
  if (letters >= 12 && capitals * 5 >= letters * 4) return "shouting";
  return null;
}

/** What you said lately, newest last: the repeat rule looks at your last five in the last five minutes. */
export interface Said { body: string; at: number }
export const REPEAT_WINDOW_MS = 5 * 60_000;
export const REPEAT_LAST = 5;

/** Whether `body` is the same (folded) as one of the last five you sent in the last five minutes. */
export function repeats(body: string, recent: readonly Said[], now: number): boolean {
  const f = fold(tidy(body));
  return recent
    .filter((m) => now - m.at < REPEAT_WINDOW_MS)
    .sort((a, b) => b.at - a.at)
    .slice(0, REPEAT_LAST)
    .some((m) => fold(tidy(m.body)) === f);
}

/** Everything the page can tell before sending, in the server's order: chat rules, spam, then saying it again. */
export function check(raw: string, recent: readonly Said[] = [], now = Date.now()): LibraryVerdict {
  const v = chatCheck(raw);
  if (!v.ok) return v;
  const s = spam(v.body);
  if (s) return { ok: false, refusal: s };
  if (repeats(v.body, recent, now)) return { ok: false, refusal: "repeat" };
  return v;
}

/** The line for the student (never a rule's name or a matched word). */
export function refusalLine(r: LibraryRefusal): string {
  switch (r) {
    case "empty": return "Write something first";
    case "too_long": return "Keep it under 280 characters";
    case "link": return "No links or contact details";
    case "language": return "No swearing, please";
    case "spam": return "That looks like spam. Say something real";
    case "shouting": return "Easy on the capitals";
    case "repeat": return "You already said that";
  }
}
