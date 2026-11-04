export interface Sym { ch: string; name: string }

/** The characters a typed maths or science answer needs, one tap each, and the plain-text sub and superscripts (Unicode, no LaTeX). */
export const SYMBOLS: readonly { ch: string; name: string }[] = [
  { ch: "²", name: "squared" }, { ch: "³", name: "cubed" }, { ch: "⁻¹", name: "to the power minus one" }, { ch: "₂", name: "subscript 2" },
  { ch: "½", name: "one half" }, { ch: "¼", name: "one quarter" }, { ch: "¾", name: "three quarters" }, { ch: "√", name: "square root" },
  { ch: "π", name: "pi" }, { ch: "°", name: "degrees" }, { ch: "±", name: "plus or minus" }, { ch: "×", name: "times" }, { ch: "÷", name: "divide" },
  { ch: "≈", name: "approximately" }, { ch: "≤", name: "less than or equal" }, { ch: "≥", name: "greater than or equal" }, { ch: "→", name: "arrow" },
  { ch: "Δ", name: "delta" }, { ch: "θ", name: "theta" }, { ch: "µ", name: "mu" },
];

/** The few a numeric answer in Geography, Economics, Business or Psychology needs. */
const NUMERIC: readonly Sym[] = [
  { ch: "²", name: "squared" }, { ch: "³", name: "cubed" }, { ch: "½", name: "one half" }, { ch: "°", name: "degrees" }, { ch: "±", name: "plus or minus" },
  { ch: "×", name: "times" }, { ch: "÷", name: "divide" }, { ch: "≈", name: "approximately" }, { ch: "≤", name: "less than or equal" }, { ch: "≥", name: "greater than or equal" },
];
const FRENCH: readonly Sym[] = [
  { ch: "é", name: "e acute" }, { ch: "è", name: "e grave" }, { ch: "ê", name: "e circumflex" }, { ch: "ë", name: "e diaeresis" }, { ch: "à", name: "a grave" },
  { ch: "â", name: "a circumflex" }, { ch: "ç", name: "c cedilla" }, { ch: "î", name: "i circumflex" }, { ch: "ï", name: "i diaeresis" }, { ch: "ô", name: "o circumflex" },
  { ch: "œ", name: "o e ligature" }, { ch: "ù", name: "u grave" }, { ch: "û", name: "u circumflex" }, { ch: "«", name: "opening French quotation mark" }, { ch: "»", name: "closing French quotation mark" },
];
const SPANISH: readonly Sym[] = [
  { ch: "á", name: "a acute" }, { ch: "é", name: "e acute" }, { ch: "í", name: "i acute" }, { ch: "ó", name: "o acute" }, { ch: "ú", name: "u acute" }, { ch: "ü", name: "u diaeresis" },
  { ch: "ñ", name: "n tilde" }, { ch: "¿", name: "inverted question mark" }, { ch: "¡", name: "inverted exclamation mark" }, { ch: "«", name: "opening quotation mark" }, { ch: "»", name: "closing quotation mark" },
];
const BENGALI: readonly Sym[] = [
  { ch: "।", name: "danda, the Bengali full stop" }, { ch: "‘", name: "opening single quotation mark" }, { ch: "’", name: "closing single quotation mark" },
  { ch: "“", name: "opening double quotation mark" }, { ch: "”", name: "closing double quotation mark" }, { ch: "…", name: "ellipsis" }, { ch: "৳", name: "taka" },
];

export interface SymbolKit {
  keys: readonly Sym[];
  /** The superscript and subscript buttons (maths and science). */
  script: boolean;
  /** The language the answer is written in, where it is not English ("fr", "es", "bn"). */
  lang?: string;
  /** The browser underlines misspelt words: only for answers written in English prose (not a language, not code). */
  spell: boolean;
  /** The answer is code: no auto-capital, no auto-correct. */
  code: boolean;
}
const PLAIN = { spell: true, code: false } as const;
const NONE: SymbolKit = { keys: [], script: false, ...PLAIN };
const CODE: readonly Sym[] = [
  { ch: "(", name: "open bracket" }, { ch: ")", name: "close bracket" }, { ch: "[", name: "open square bracket" }, { ch: "]", name: "close square bracket" },
  { ch: "{", name: "open brace" }, { ch: "}", name: "close brace" }, { ch: "\"", name: "double quote" }, { ch: "'", name: "single quote" },
  { ch: "<", name: "less than" }, { ch: ">", name: "greater than" }, { ch: "=", name: "equals" }, { ch: "!", name: "exclamation mark" },
  { ch: "&", name: "ampersand" }, { ch: "|", name: "vertical bar" }, { ch: "_", name: "underscore" }, { ch: ";", name: "semicolon" },
  { ch: ":", name: "colon" }, { ch: "#", name: "hash" }, { ch: "%", name: "percent" }, { ch: "\\", name: "backslash" },
];

/**
 * What the typing strip offers for a subject (its bank slug, "aqa-gcse-french"): the accents of French and Spanish, the punctuation of Bengali, the maths and science
 * symbols with superscripts for maths, the sciences and computing, a few numerals for the subjects that count, and nothing at all for English, History, Religious Studies
 * and the other essay subjects (a strip of symbols on an essay is clutter, not help).
 */
export function symbolsFor(slug: string): SymbolKit {
  const s = `-${slug.toLowerCase()}-`;
  const has = (...words: string[]) => words.some((w) => s.includes(`-${w}-`));
  if (has("french")) return { keys: FRENCH, script: false, lang: "fr", spell: false, code: false };
  if (has("spanish")) return { keys: SPANISH, script: false, lang: "es", spell: false, code: false };
  if (has("bengali")) return { keys: BENGALI, script: false, lang: "bn", spell: false, code: false };
  if (has("computer-science", "computing")) return { keys: CODE, script: false, spell: false, code: true };
  if (has("maths", "physics", "chemistry", "biology", "science")) return { keys: SYMBOLS, script: true, ...PLAIN };
  if (has("geography", "economics", "business", "psychology", "engineering-manufacture")) return { keys: NUMERIC, script: false, ...PLAIN };
  return NONE;
}

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ" };
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", o: "ₒ", x: "ₓ", n: "ₙ" };

/** Raise what can be raised; anything else is left as typed. */
export const toSup = (s: string) => Array.from(s, (c) => SUP[c] ?? c).join("");
export const toSub = (s: string) => Array.from(s, (c) => SUB[c] ?? c).join("");
/** Insert `text` at the selection of a field's value, returning the new value and where the cursor goes. */
export function insertAt(value: string, start: number | null, end: number | null, text: string): { value: string; caret: number } {
  const s = start ?? value.length, e = end ?? s;
  return { value: value.slice(0, s) + text + value.slice(e), caret: s + text.length };
}
