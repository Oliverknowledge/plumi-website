import { toSub, toSup } from "./symbols";

/**
 * The text a Fraction key puts into a typed answer: plain text in storage, never markup. Two whole numbers (a leading minus allowed) read as a stacked fraction in Unicode,
 * super-script numerator, fraction slash (U+2044), sub-script denominator: "3" over "5" is "³⁄₅". Anything else (letters, sums, decimals) is "top/bottom" with brackets round any part
 * that is more than one token, so it can only be read one way: "a+1" over "b" is "(a+1)/b".
 */
export const FRACTION_PART_MAX = 60;
export type FractionResult = { ok: true; text: string; spoken: string } | { ok: false; hint: string };

const WHOLE = /^[-−–]?\d{1,12}$/;
/** One token: a number (decimals too), a name, a symbol; nothing that is a sum, a product or a space. */
const TOKEN = /^[-−–]?[\p{L}\p{N}.²³¹°√π]+$/u;
const norm = (s: string) => s.trim().replace(/\s+/g, " ").replace(/^[−–]/, "-");
/** Already wrapped in one pair of brackets: "(a+1)" but not "(a)+(b)". */
function wrapped(s: string): boolean {
  if (!s.startsWith("(") || !s.endsWith(")")) return false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") { depth--; if (depth === 0 && i < s.length - 1) return false; }
    if (depth < 0) return false;
  }
  return depth === 0;
}
const bracket = (s: string) => (TOKEN.test(s) || wrapped(s) ? s : `(${s})`);

const NAMES: Record<string, string> = { "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten" };
const spokenOf = (top: string, bottom: string) => {
  const n = NAMES[top.replace(/^-/, "")], d = NAMES[bottom.replace(/^-/, "")];
  return n && d && !top.startsWith("-") && !bottom.startsWith("-") ? `${n} over ${d}` : `${top} over ${bottom}`;
};

export function buildFraction(topRaw: string, bottomRaw: string): FractionResult {
  const top = norm(topRaw), bottom = norm(bottomRaw);
  if (!top || !bottom) return { ok: false, hint: "Add a top and a bottom" };
  if (top.length > FRACTION_PART_MAX || bottom.length > FRACTION_PART_MAX) return { ok: false, hint: "Keep each part short" };
  if (/[\n\r]/.test(topRaw.trim() + bottomRaw.trim())) return { ok: false, hint: "Keep each part on one line" };
  if (WHOLE.test(top) && WHOLE.test(bottom)) {
    if (/^-?0+$/.test(bottom)) return { ok: false, hint: "The bottom cannot be zero" };
    const tn = top.startsWith("-"), bn = bottom.startsWith("-");
    const abs = (s: string) => s.replace(/^-/, "");
    // One minus (on the top or on the bottom) is a plain minus in front of the whole fraction, "−³⁄₅"; two make it positive but are kept as they were typed, on their own parts.
    const text = tn !== bn ? `\u2212${toSup(abs(top))}\u2044${toSub(abs(bottom))}` : `${toSup(top)}\u2044${toSub(bottom)}`;
    return { ok: true, text, spoken: spokenOf(top, bottom) };
  }
  return { ok: true, text: `${bracket(top)}/${bracket(bottom)}`, spoken: spokenOf(top, bottom) };
}

/**
 * Does this key press ask for the Fraction box? Ctrl+/ (Cmd+/ on a Mac). On a layout where the slash needs Shift (German: Shift+7) the key still produces "/", and on one where it is
 * somewhere else the physical key beside the right Shift (`Slash`) is accepted too.
 */
export const isFractionShortcut = (e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey?: boolean; code?: string }) =>
  (e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "/" || e.code === "Slash");

